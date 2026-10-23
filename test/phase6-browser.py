"""Real Chromium render checks against authorised public TV snapshots.
Uses synthetic sockets: not a live Socket.io or physical-TV test.
Run: python test/phase6-browser.py
"""
import asyncio
import importlib.util
import json
import shutil
import subprocess
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('phase3visual', ROOT / 'test' / 'phase3-visual.py')
p3 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p3)

JS = r"""
const E = require('./src/engine/garden');
const s = E.createGame({roomCode:'TEST',seed:77,now:Date.now()});
['Alex','Bea','Chris','Dawn'].forEach(name=>E.addPlayer(s,{name},Date.now()));
E.apply(s,0,{type:'start'},Date.now());
const gods=['thor','freya','loki','hel'];
while(s.phase.stage==='draft') {
 const seat=s.phase.draftQueue[0];
 const r=E.apply(s,seat,{type:'chooseGod',god:gods[seat]},Date.now());
 if(!r.ok) throw Error(r.error);
}
E.advance(s);
const copy=()=>JSON.parse(JSON.stringify(s));
const meta={code:'TEST',paused:false,isHost:true,serverNow:Date.now(),version:require('./package.json').version};
const publicSnap=(state)=>({...E.publicView(state),topology:E.clientTopology(state.board.layoutId),meta});
const original=copy(); original.phase.step='omens';
const planning=copy(); planning.phase.step='plan';
const sympathy=copy(); sympathy.phase.step='sympathy';
sympathy.sympathy={chooser:1,nextIndex:1,options:Object.keys(E.CONTENT.categories).slice(0,3)};
const resolving=copy(); resolving.phase.step='resolve';
const first = resolving.board.plots[0].id;
const next=E.clientTopology(resolving.board.layoutId).hexes.find(h=>h.id===first).neighbors[0];
resolving.resolution={events:[{seat:1,kind:'pray',ok:true,from:first,to:next,disasterName:'Frost Giants',victim:0}]};
const disasters=copy(); disasters.phase.step='disasters';
const harvest=copy(); harvest.phase.step='harvest';
const show=copy(); show.phase.step='show';
process.stdout.write(JSON.stringify({omens:publicSnap(original),plan:publicSnap(planning),sympathy:publicSnap(sympathy),resolve:publicSnap(resolving),disasters:publicSnap(disasters),harvest:publicSnap(harvest),show:publicSnap(show)}));
"""

async def main():
    fixtures=json.loads(subprocess.check_output(['node','-e',JS],cwd=ROOT,text=True))
    config=json.loads((ROOT/'src/data/v2.json').read_text())
    assert 'options' not in fixtures['sympathy']['sympathy'], 'TV cannot receive secret Sympathy choices'
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,executable_path=shutil.which('chromium') or None,args=['--no-sandbox'])
        for stage,public in fixtures.items():
            ctx=await browser.new_context(viewport={'width':1280,'height':720})
            page=await ctx.new_page()
            errors=[]
            page.on('pageerror',lambda error: errors.append(str(error)))
            html=p3.markup('tv',{'tv':public,'phone':public},config)
            if stage == 'resolve':
                await page.emulate_media(reduced_motion='reduce')
            await page.set_content(html,wait_until='domcontentloaded')
            await page.wait_for_timeout(550)
            body=await page.locator('#panel').inner_text()
            assert not errors,f'{stage}: {errors}'
            assert body.strip(),f'{stage}: panel empty'
            if stage=='sympathy':
                assert 'Bea' in body and 'Awaiting the judges' in body,body
                for name in [config['categories'][k]['name'] for k in Object_keys(config['categories'])[:3]]:
                    assert name not in body,'private Sympathy category leaked into TV'
            if stage=='resolve':
                assert await page.locator('#boardWrap svg').count()==1, 'TV plot board disappeared'
                assert await page.locator('#boardWrap animateMotion').count()==0, 'reduced-motion TV still animates Pray'
                assert await page.locator('#boardWrap circle[cx][cy][r=".27"]').count()>=1, 'final Pray marker should remain visible'
            assert not await page.evaluate('document.documentElement.scrollWidth > innerWidth'),f'{stage}: layout overflow'
            print(f'  ✔ {stage}: public-TV Chromium screen with no script errors or overflow')
            await ctx.close()
        await browser.close()
        print('✔ 7 public-TV browser phase checks passed (synthetic snapshots, not real networking)')

def Object_keys(obj):
    return list(obj.keys())

if __name__=='__main__':
    asyncio.run(main())
