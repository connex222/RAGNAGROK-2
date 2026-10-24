"""Optional real-Chromium visual smoke check. Requires Python Playwright + Chromium.

It intentionally uses mocked authorised state snapshots and no real sockets; the
actual multiplayer integration suite is `npm test`, not this file.
Run: python test/phase3-visual.py
"""
import asyncio
import json
import re
import subprocess
import shutil
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
REPORTS = ROOT / 'reports' / 'phase3'
REPORTS.mkdir(parents=True, exist_ok=True)

FIXTURES_JS = r"""
const fs=require('fs'), E=require('./src/engine/garden');
const now=Date.now(); const s=E.createGame({roomCode:'TEST',seed:77,now});
['Alex','Bea','Chris','Dawn'].forEach(name=>E.addPlayer(s,{name},now));
E.apply(s,0,{type:'start'},now);
const gods=['thor','freya','loki','hel'];
while(s.phase.stage==='draft') {
 const seat=s.phase.draftQueue[0], r=E.apply(s,seat,{type:'chooseGod',god:gods[seat]},now);
 if(!r.ok)throw Error(r.error);
}
E.advance(s);
const meta={code:'TEST',paused:false,isHost:true,serverNow:now,version:require('./package.json').version};
const make=(view)=>({...view,topology:E.clientTopology(s.board.layoutId),meta});
process.stdout.write(JSON.stringify({tv:make(E.publicView(s)),phone:make(E.privateView(s,0))}));
"""

STUB = r"""
(function(){
const fixture=window.__QA_FIXTURE, config=window.__QA_CONFIG;
window.io=function(){const hs={}; const s={connected:true,
 on(n,fn){(hs[n]??=[]).push(fn);return s;},timeout(){return s;},
 async emitWithAck(ev){
 if(['tv:create','tv:attach','player:rejoin'].includes(ev)) {
  setTimeout(()=>s.push('state',fixture),100);
  return {ok:true,seat:0,code:'TEST',hostKey:'aa',joinUrl:'http://test/play?room=TEST',qr:'data:image/png;base64,'};
 }return {ok:true};},push(n,v){(hs[n]||[]).forEach(fn=>fn(v));}};
 setTimeout(()=>s.push('connect'),65);return s;};
window.XMLHttpRequest=class {open(method,url){this.url=url;}send(){
 this.status=200;this.responseText=this.url.includes('v2.json')?JSON.stringify(config):
  (this.url.includes('art.json')?'{}':'null');setTimeout(()=>this.onload?.(),1);}};
})();
"""


def markup(kind, fixtures, config):
    file = 'index.html' if kind == 'tv' else 'play.html'
    html = (PUBLIC / 'v2' / file).read_text()
    def inline(match):
        asset = PUBLIC / match.group(1).lstrip('/')
        return '<script>' + (asset.read_text() if asset.exists() else '') + '</script>'
    html = re.sub(r'<script src="(/[^"]+)"></script>', inline, html)
    fixture = fixtures['tv' if kind == 'tv' else 'phone']
    script = '<script>window.__QA_FIXTURE=' + json.dumps(fixture) + ';window.__QA_CONFIG=' + json.dumps(config) + ';' + STUB + '</script>'
    html = html.replace('</head>', script + '</head>')
    if kind == 'phone':
        # Test an authenticated, already-joined phone without relying on any
        # browser storage state or socket authentication in this synthetic rig.
        html = html.replace('let saved = store.get(KEY);', "let saved = {code:'TEST',token:'test-token'};")
    return html


async def main():
    fixtures = json.loads(subprocess.check_output(['node', '-e', FIXTURES_JS], cwd=ROOT, text=True))
    config = json.loads((ROOT / 'src/data/v2.json').read_text())
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, executable_path=shutil.which('chromium') or shutil.which('google-chrome') or None, args=['--no-sandbox'])
        checked = 0
        for kind, widths in [('join', [320]), ('phone', [320, 375, 430]), ('tv', [1280, 1920])]:
            html = markup('phone' if kind == 'join' else kind, fixtures, config)
            if kind == 'join':
                html = html.replace("let saved = {code:'TEST',token:'test-token'};", 'let saved = null;')
            for width in widths:
                height = 720 if width == 1280 else 1080 if width == 1920 else 690
                context = await browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1)
                page = await context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                await page.set_content(html, wait_until='domcontentloaded')
                await page.wait_for_timeout(500)
                dims = await page.evaluate('''() => ({width:document.documentElement.clientWidth,
                  scrollWidth:document.documentElement.scrollWidth, visible:!document.querySelector('#joinScreen')?.hidden})''')
                assert not errors, f'{kind} {width}px raised browser script errors: {errors}'
                assert dims['scrollWidth'] <= width, f'{kind} {width}px has horizontal overflow: {dims}'
                if kind == 'join':
                    assert dims['visible'], 'Join form is not visible'
                    avatar = await page.locator('#avatarGrid button').count()
                    assert avatar == 8, 'The join screen must show all eight illustrated portraits'
                elif kind == 'phone':
                    assert not dims['visible'], 'Authenticated phone unexpectedly shows the join screen'
                    assert await page.locator('[data-act="editSlot"][data-i="0"]').count() >= 1
                    await page.locator('#actionBar [data-act="editSlot"]').click()
                    assert await page.locator('#sheetWrap').is_visible(), 'CTA must open an action picker'
                    await page.locator('#sheetWrap [data-act="closeSheet"]').click()
                else:
                    boxes = await page.evaluate('''() => {
                      const rect=id=>document.querySelector(id).getBoundingClientRect();
                      const a=rect('#corner'),b=rect('#meter'),c=rect('#clock');
                      return {controlLeft:a.left, progressRight:b.right, controlRight:a.right,clockLeft:c.left};
                    }''')
                    assert boxes['progressRight'] <= boxes['controlLeft'] + 2, f'Controls overlap round timeline: {boxes}'
                    assert boxes['controlRight'] <= boxes['clockLeft'] + 2, f'Controls overlap countdown: {boxes}'
                await page.screenshot(path=str(REPORTS / f'{kind}-{width}.png'))
                checked += 1
                print(f'  ✔ {kind} {width}px: no script errors, no horizontal overflow')
                await context.close()
        await browser.close()
        print(f'✔ {checked} real-browser visual layout checks passed (mock state, NOT live multiplayer)')


if __name__ == '__main__':
    asyncio.run(main())
