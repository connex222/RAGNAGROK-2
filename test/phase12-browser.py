"""Real Chromium TV overscan regression across 720p, 1080p and 4K.

Uses synthetic server snapshots and does not replace real-device acceptance.
Run: python test/phase12-browser.py
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
    fixtures = json.loads(subprocess.check_output(
        ['node', '-e', fixture_module.FIXTURES_JS], cwd=ROOT, text=True))
    config = json.loads((ROOT / 'src/data/v2.json').read_text())
    html = fixture_module.markup('tv', fixtures, config)
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            headless=True,
            executable_path=shutil.which('chromium') or shutil.which('google-chrome') or None,
            args=['--no-sandbox'])
        try:
            for w, h in [(1280, 720), (1920, 1080), (3840, 2160)]:
                context = await browser.new_context(viewport={'width': w, 'height': h})
                try:
                    page = await context.new_page()
                    errors = []
                    page.on('pageerror', lambda err: errors.append(str(err)))
                    await page.set_content(html, wait_until='domcontentloaded')
                    await page.wait_for_timeout(450)
                    result = await page.evaluate("""() => {
                        const r = selector => { const el = document.querySelector(selector);
                          if (!el) throw new Error('Missing '+selector);
                          const b = el.getBoundingClientRect();
                          return {left:b.left, top:b.top, right:b.right, bottom:b.bottom};
                        };
                        return {stage:r('#stage'), corner:r('#corner'), clock:r('#clock'),
                          scroll:document.documentElement.scrollWidth, width:window.innerWidth};
                    }""")
                    assert not errors, f'{w}x{h} browser errors: {errors}'
                    assert result['scroll'] <= w, f'{w}x{h} horizontal overflow: {result}'
                    for element in ('stage', 'corner', 'clock'):
                        b = result[element]
                        assert b['left'] >= w * .05 - 1, f'{w}x{h}: {element} clips left overscan: {b}'
                        assert b['right'] <= w * .95 + 1, f'{w}x{h}: {element} clips right overscan: {b}'
                        assert b['top'] >= h * .05 - 1, f'{w}x{h}: {element} clips top overscan: {b}'
                        assert b['bottom'] <= h * .95 + 1, f'{w}x{h}: {element} clips bottom overscan: {b}'
                    print(f'  ✔ {w}×{h}: stage, controls and countdown within physical-TV safe area')
                finally:
                    await context.close()
        finally:
            await browser.close()
    print('✔ Real Chromium TV overscan checks passed (synthetic state, not physical hardware)')

if __name__ == '__main__':
    asyncio.run(main())
