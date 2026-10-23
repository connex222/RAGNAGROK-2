"""Real Chromium post-match phone feedback, using mock socket snapshots.
Not a test of live transport or actual player enjoyment.
"""
import asyncio
import importlib.util
import json
import shutil
import subprocess
from pathlib import Path
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location('ragna_p4', ROOT/'test'/'phase4-browser.py')
p4=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(p4)

async def main():
    fixture=json.loads(subprocess.check_output(['node','-e',p4.FIXTURE_SCRIPT],cwd=ROOT,text=True))['finished']
    config=json.loads((ROOT/'src/data/v2.json').read_text())
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,executable_path=shutil.which('chromium') or None,args=['--no-sandbox'])
        for width in (320,375,430):
            data=json.loads(json.dumps(fixture));data['meta'].pop('feedbackSubmitted',None);data['meta'].pop('playtest',None)
            ctx,page,errors=await p4.open_screen(browser,data,config,width=width)
            assert await page.locator('[data-act="rematch"]').is_visible(), 'rematch remains prominent'
            assert await page.locator('[data-act="pulseRating"]').count()==5
            assert await page.locator('[data-act="pulseSend"]').is_disabled()
            await page.locator('[data-act="pulseRating"][data-rating="4"]').click()
            await page.locator('[data-act="pulseAgain"][data-again="true"]').click()
            assert await page.locator('[data-act="pulseSend"]').is_enabled()
            await page.locator('[data-act="pulseSend"]').click()
            messages=await page.evaluate('window.__QA_COMMANDS')
            answers=[m for m in messages if m['ev']=='playtest:feedback']
            assert len(answers)==1 and answers[0]['payload']=={'enjoyment':4,'rematch':True}, answers
            assert not any(m['ev']=='host:rematch' for m in messages), 'survey must not rematch'
            assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'{width}px overflows'
            assert not errors,errors
            await ctx.close()
            print(f'  ✔ {width}px: optional two-answer pulse without automatic rematch or overflow')
        data=json.loads(json.dumps(fixture))
        data['meta']['feedbackSubmitted']=True
        data['meta']['playtest']={'count':3,'players':4,'minimum':3,'mean':4.3,'wouldRematch':2}
        ctx,page,errors=await p4.open_screen(browser,data,config,width=375)
        assert await page.locator('[data-act="pulseSend"]').count()==0
        assert await page.locator('[data-act="pulseCopy"]').count()==1
        assert '4.3/5' in await page.locator('.playtest-recap').inner_text()
        assert not errors,errors
        await ctx.close()
        print('  ✔ submitted host view shows grouped results and cannot resubmit')
        data['meta'].pop('playtest')
        data['meta']['isHost']=False
        ctx,page,errors=await p4.open_screen(browser,data,config,width=375)
        assert await page.locator('[data-act="pulseCopy"]').count()==0
        assert await page.locator('.playtest-recap').count()==0
        assert not errors,errors
        await ctx.close()
        print('  ✔ nonhost view has no group figures')
        await browser.close()
    print('✔ All 5 Phase 8 Chromium phone checks passed (mock sockets)')
if __name__=='__main__': asyncio.run(main())
