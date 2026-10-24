"""Real Chromium TV/phone FX mute UI checks using synthetic authorised state.

This does not grade artistic quality or represent a real television/speaker test.
"""
import asyncio
import importlib.util
import json
import shutil
import subprocess
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('phase3_visual', ROOT / 'test/phase3-visual.py')
fixture_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture_module)

async def main():
    fixtures = json.loads(subprocess.check_output(['node','-e',fixture_module.FIXTURES_JS],cwd=ROOT,text=True))
    config = json.loads((ROOT/'src/data/v2.json').read_text())
    markup = fixture_module.markup('tv',fixtures,config)
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            headless=True, executable_path=shutil.which('chromium') or None, args=['--no-sandbox'])
        try:
            for phone_width in [320, 375, 430]:
                context = await browser.new_context(viewport={'width':phone_width,'height':740})
                try:
                    page = await context.new_page()
                    errors = []
                    page.on('pageerror',lambda error: errors.append(str(error)))
                    await page.set_content(fixture_module.markup('phone',fixtures,config),wait_until='domcontentloaded')
                    await page.wait_for_timeout(500)
                    assert await page.evaluate('typeof window.SFX?.play') == 'function', 'Phone must have a working browser sound API'
                    await page.locator('#top [data-act="menu"]').click()
                    control = page.locator('#sheet [data-act="toggleSound"]')
                    assert await control.count() == 1
                    before = await page.evaluate('window.SFX.isMuted()')
                    await control.click()
                    after = await page.evaluate('window.SFX.isMuted()')
                    assert after != before, 'Phone sound toggle must affect the actual sound engine'
                    assert not errors, f'phone {phone_width}px browser errors: {errors}'
                    print(f'  ✔ phone {phone_width}px: real sound API, menu sound toggle')
                finally:
                    await context.close()
            for width,height in [(1280,720),(1920,1080),(3840,2160)]:
                context = await browser.new_context(viewport={'width':width,'height':height})
                try:
                    page = await context.new_page()
                    errors = []
                    page.on('pageerror',lambda error: errors.append(str(error)))
                    await page.set_content(markup,wait_until='domcontentloaded')
                    await page.wait_for_timeout(550)
                    effects = page.locator('#effectsBtn')
                    assert await effects.is_visible() is False, 'FX control should appear after user interaction'
                    await page.locator('#soundGate').click()
                    assert await effects.is_visible(), 'FX toggle must be available after sound activation'
                    assert await effects.get_attribute('aria-label') == 'Mute sound effects'
                    await effects.click()
                    assert await effects.get_attribute('aria-pressed') == 'true'
                    assert await effects.get_attribute('aria-label') == 'Enable sound effects'
                    assert await page.evaluate('SFX.isMuted()'), 'FX mute must change actual audio state'
                    await effects.click()
                    assert await effects.get_attribute('aria-pressed') == 'false'
                    assert not await page.evaluate('SFX.isMuted()')
                    boxes = await page.evaluate("""() => {
                        const rect = x => document.querySelector(x).getBoundingClientRect();
                        const a = rect('#corner'), b = rect('#meter'), c = rect('#clock');
                        return {controlLeft:a.left,controlRight:a.right,progressRight:b.right,clockLeft:c.left};
                    }""")
                    assert boxes['progressRight'] <= boxes['controlLeft']+2, boxes
                    assert boxes['controlRight'] <= boxes['clockLeft']+2, boxes
                    assert not errors, f'{width}x{height} browser errors: {errors}'
                    print(f'  ✔ {width}×{height}: real mute, accessible state, no TV layout overlap')
                finally:
                    await context.close()
        finally:
            await browser.close()
    print('✔ Six Chromium phone/TV audio control tests passed (synthetic state)')

if __name__ == '__main__':
    asyncio.run(main())
