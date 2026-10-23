"""Extended real-Chromium interaction smoke tests, using ENGINE-GENERATED fixtures.

These tests exercise the actual phone/TV browser code without claiming a live
Socket.io session. They cover Pray's two-stage plot picker, Sympathy Vote,
results ceremony, responsive navigation, and sunlight/dusk styles.
Requires optional Python Playwright and an installed Chromium binary.
Run: python test/phase4-browser.py
"""
import asyncio
import json
import shutil
import subprocess
import sys
from pathlib import Path
from playwright.async_api import async_playwright

sys.path.insert(0, str(Path(__file__).parent))
from importlib import import_module
phase3 = import_module('phase3-visual')
ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / 'reports' / 'phase4'
REPORT.mkdir(parents=True, exist_ok=True)

FIXTURE_SCRIPT = r"""
const E = require('./src/engine/garden');
const {playGame} = require('./test/sim2');
const now = Date.now();
const s = E.createGame({roomCode:'TEST',seed:77,now});
['Alex','Bea','Chris','Dawn'].forEach(name=>E.addPlayer(s,{name},now));
E.apply(s,0,{type:'start'},now);
const gods=['thor','freya','loki','hel'];
while(s.phase.stage==='draft'){
 const seat=s.phase.draftQueue[0];
 const r=E.apply(s,seat,{type:'chooseGod',god:gods[seat]},now);
 if(!r.ok)throw Error(r.error);
}
E.advance(s);
const meta={code:'TEST',paused:false,isHost:true,serverNow:now,version:require('./package.json').version};
const make=state=>({...E.privateView(state,0),topology:E.clientTopology(state.board.layoutId),meta});
const pray = make(s);
const copy=JSON.parse(JSON.stringify(s));
copy.phase.step='sympathy'; copy.phase.deadline=now+20000;
copy.sympathy={chooser:0,nextIndex:1,options:Object.keys(E.CONTENT.categories).slice(0,3)};
const sympathy=make(copy);
const game=playGame(95001,4,'standard').state;
const finished=make(game);
process.stdout.write(JSON.stringify({pray,sympathy,finished}));
"""

STUB = r"""
(function(){
const fixture=window.__QA_FIXTURE, config=window.__QA_CONFIG;
window.__QA_COMMANDS=[];
window.io=function(){
 const hs={}; const s={connected:true,
 on(n,fn){(hs[n]??=[]).push(fn);return s;},timeout(){return s;},
 async emitWithAck(ev,payload){
  window.__QA_COMMANDS.push({ev,payload});
  if(ev==='player:rejoin') {setTimeout(()=>s.push('state',fixture),25);
   return {ok:true,seat:0,code:'TEST'};}
  return {ok:true};
 },push(n,v){(hs[n]||[]).forEach(fn=>fn(v));}};
 setTimeout(()=>s.push('connect'),30);return s;
};
window.XMLHttpRequest=class {open(method,url){this.url=url;}send(){
 this.status=200;this.responseText=this.url.includes('v2.json')?JSON.stringify(config):
  (this.url.includes('art.json')?'{}':'null');setTimeout(()=>this.onload?.(),1);}};
})();
"""

def make_html(fixture, config):
    html = phase3.markup('phone', {'tv': fixture, 'phone': fixture}, config)
    # use an action-logging fake socket instead of the default no-op acknowledgement
    return html.replace(phase3.STUB, STUB)

async def open_screen(browser, fixture, config, width=320, height=690, theme='dusk'):
    context = await browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1)
    page=await context.new_page(); errors=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    await page.set_content(make_html(fixture,config),wait_until='domcontentloaded')
    await page.wait_for_timeout(320)
    assert not errors, f'browser page errors: {errors}'
    assert not await page.locator('#joinScreen').is_visible(), 'fixture must join'
    if theme == 'day':
        await page.locator('#top [data-act="menu"]').click()
        await page.locator('#sheet [data-act="toggleDay"]').click()
        await page.locator('#sheet [data-act="closeSheet"]').click()
    return context,page,errors

async def main():
    fixtures=json.loads(subprocess.check_output(['node','-e',FIXTURE_SCRIPT],cwd=ROOT,text=True))
    config=json.loads((ROOT/'src/data/v2.json').read_text())
    assert fixtures['pray']['me']['legal']['pray'], 'seeded first round needs a forecast hit'
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,executable_path=shutil.which('chromium') or None,args=['--no-sandbox'])
        cases=0
        for width in (320,375,430):
            context,page,errors=await open_screen(browser,fixtures['pray'],config,width)
            await page.locator('#actionBar [data-act="editSlot"]').first.click()
            await page.locator('#sheet [data-act="pickKind"][data-kind="pray"]').click()
            available=page.locator('#sheet [data-spot]')
            assert await available.count()>0, 'Pray must present tappable forecast target'
            first=available.first
            selected=await first.get_attribute('data-spot')
            await first.click()
            await page.locator('#sheet [data-act="targetOk"]').click()
            dest=page.locator('#sheet [data-spot]')
            assert await dest.count()>0, 'Pray must offer legal adjacent destination'
            target=await dest.first.get_attribute('data-spot')
            await dest.first.click()
            await page.locator('#sheet [data-act="saveSlot"]').click()
            await page.wait_for_timeout(80)
            commands=await page.evaluate('window.__QA_COMMANDS')
            plan=[x for x in commands if x['ev']=='action' and x['payload']['type']=='plan']
            assert len(plan)==1, f'exactly one plan emitted: {commands}'
            slot=plan[0]['payload']['slots'][0]
            assert slot['kind']=='pray' and slot['target']==selected and slot['to']==target and isinstance(slot['index'],int),slot
            assert await page.locator('#sheetWrap').is_hidden(), 'Save closes planner on accepted ACK'
            overflow=await page.evaluate('document.documentElement.scrollWidth > innerWidth')
            assert not overflow, f'Pray sheet overflows {width}px'
            assert not errors, errors
            await page.screenshot(path=str(REPORT/f'pray-{width}.png'))
            await context.close();cases+=1
            print(f'  ✔ {width}px phone: Pray picks forecast, legal destination, sends one plan')
        for theme in ('day','dusk'):
            ctx,page,errors=await open_screen(browser,fixtures['sympathy'],config,375,690,theme)
            opts=page.locator('[data-act="sympathyPick"]')
            assert await opts.count()==3, 'losing player receives three genuine choices'
            category=await opts.first.get_attribute('data-category')
            await opts.first.click()
            commands=await page.evaluate('window.__QA_COMMANDS')
            found=[x for x in commands if x['ev']=='action' and x['payload'].get('type')=='sympathyPick']
            assert found and found[0]['payload']['category']==category, 'Sympathy Vote must submit selected category'
            assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            assert not errors,errors
            await page.screenshot(path=str(REPORT/f'sympathy-{theme}.png'))
            await ctx.close();cases+=1
            print(f'  ✔ Sympathy Vote in {theme} theme: three options, command submitted')
        ctx,page,errors=await open_screen(browser,fixtures['finished'],config,375)
        assert await page.locator('[data-act="rematch"]').count()==1,'host has rematch control'
        await page.locator('[data-act="rematch"]').click()
        commands=await page.evaluate('window.__QA_COMMANDS')
        assert any(x['ev']=='host:rematch' for x in commands)
        assert not errors,errors
        await page.screenshot(path=str(REPORT/'final-375.png'))
        await ctx.close();cases+=1
        print('  ✔ final results: host rematch control issues correct command')
        await browser.close()
        print(f'✔ {cases} Chromium interaction checks passed (mock sockets; no claim of network tests)')

if __name__=='__main__':
    asyncio.run(main())
