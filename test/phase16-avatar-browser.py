"""Check eight portrait picks and legacy emoji display in real Chromium at 320–430px.
Uses local image bytes and synthetic authenticated network state; no Render claims.
Run: python test/phase16-avatar-browser.py
"""
import asyncio
import importlib.util
import json
import re
import shutil
import subprocess
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('visual_fixture', ROOT / 'test/phase3-visual.py')
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)

async def main():
    snaps = json.loads(subprocess.check_output(
        ['node', '-e', fixture.FIXTURES_JS], cwd=ROOT, text=True))
    data = json.loads((ROOT / 'src/data/v2.json').read_text())
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True,
            executable_path=shutil.which('chromium') or None, args=['--no-sandbox'])
        try:
            async def image_route(route):
                name = route.request.url.rsplit('/', 1)[-1]
                if not re.fullmatch(r'deity-[a-z]+-face\.webp', name):
                    await route.abort()
                    return
                path = ROOT / 'public/img' / name
                assert path.is_file(), name
                await route.fulfill(content_type='image/webp', body=path.read_bytes())

            for width in [320, 375, 430]:
                context = await browser.new_context(viewport={'width': width, 'height': 800})
                page = await context.new_page()
                await page.route('https://ragnagrok.test/img/**', image_route)
                html = fixture.markup('phone', snaps, data).replace(
                    "let saved = {code:'TEST',token:'test-token'};", 'let saved = null;')
                html = html.replace('</head>', '<base href="https://ragnagrok.test/"></head>')
                errors = []
                page.on('pageerror', lambda e: errors.append(str(e)))
                await page.set_content(html, wait_until='domcontentloaded')
                await page.wait_for_function(
                    "document.querySelectorAll('#avatarGrid img.player-portrait').length === 8")
                await page.wait_for_function("""() => [...document.querySelectorAll('#avatarGrid img')]
                    .every(img => img.complete && img.naturalWidth > 0)""")
                assert not errors, f'{width}px JS errors: {errors}'
                gallery = page.locator('#avatarGrid')
                assert await gallery.locator('button').count() == 8
                assert await gallery.locator('button[aria-pressed="true"]').count() == 1
                await gallery.locator('[data-av="loki"]').click()
                assert await gallery.locator('[data-av="loki"]').get_attribute('aria-pressed') == 'true'
                assert await page.evaluate('window.__rg.ui.avatar') == 'loki'
                assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                print(f'  ✔ {width}px: eight decoded illustrated avatars, labelled selection and no overflow')
                await context.close()

            # Even an old saved emoji avatar should appear as a portrait in the top bar.
            context = await browser.new_context(viewport={'width': 375, 'height': 800})
            page = await context.new_page()
            await page.route('https://ragnagrok.test/img/**', image_route)
            html = fixture.markup('phone', snaps, data)
            html = html.replace('</head>', '<base href="https://ragnagrok.test/"></head>')
            await page.set_content(html, wait_until='domcontentloaded')
            await page.wait_for_function("document.querySelector('#top img.player-portrait') !== null")
            await page.wait_for_function(
                "document.querySelector('#top img.player-portrait').naturalWidth > 0")
            assert not await page.locator('#top .av').inner_text(), 'Old emoji still appears'
            await context.close()
            print('  ✔ existing phone room: legacy emoji becomes a real rendered portrait')

            for width, height in [(1280, 720), (1920, 1080)]:
                context = await browser.new_context(viewport={'width': width, 'height': height})
                page = await context.new_page()
                await page.route('https://ragnagrok.test/img/**', image_route)
                html = fixture.markup('tv', snaps, data)
                html = html.replace('</head>', '<base href="https://ragnagrok.test/"></head>')
                await page.set_content(html, wait_until='domcontentloaded')
                await page.wait_for_function('document.querySelectorAll("#lobbyPlayers .player-portrait").length > 0')
                await page.wait_for_function("""() => [...document.querySelectorAll('#lobbyPlayers img.player-portrait')]
                    .every(img => img.complete && img.naturalWidth > 0)""")
                assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                print(f'  ✔ TV {width}×{height}: lobby portraits decode and display')
                await context.close()
        finally:
            await browser.close()
    print('✔ Browser avatars: all 6 responsive phone/TV cases passed with actual local WebP bytes')

if __name__ == '__main__':
    asyncio.run(main())
