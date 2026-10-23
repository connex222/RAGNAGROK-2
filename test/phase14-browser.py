"""Actual Chromium keyboard/focus checks using synthetic authorised game views.

No human/device acceptance or live Socket.io test is claimed. Run:
    python test/phase14-browser.py
"""
import asyncio
import importlib.util
import json
import shutil
import subprocess
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('visual_fixture', ROOT / 'test/phase3-visual.py')
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)

async def main():
    snaps = json.loads(subprocess.check_output(['node', '-e', fixture.FIXTURES_JS], cwd=ROOT, text=True))
    config = json.loads((ROOT / 'src/data/v2.json').read_text())
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, executable_path=shutil.which('chromium') or None,
                                           args=['--no-sandbox'])
        try:
            for width in [320, 375, 430]:
                context = await browser.new_context(viewport={'width': width, 'height': 740})
                page = await context.new_page()
                errors = []
                page.on('pageerror', lambda e: errors.append(str(e)))
                await page.set_content(fixture.markup('phone', snaps, config), wait_until='domcontentloaded')
                await page.locator('#app').wait_for(state='visible')
                menu = page.locator('#top [data-act="menu"]')
                await menu.focus()
                await page.keyboard.press('Enter')
                dialog = page.locator('#sheet')
                assert await dialog.is_visible()
                assert await page.evaluate("document.querySelector('#app').inert")
                assert await dialog.get_attribute('aria-labelledby') == 'sheetHeading'
                assert await dialog.locator('#sheetHeading').inner_text() == 'Menu'
                assert await page.evaluate("document.activeElement.dataset.act") == 'closeSheet'
                await page.keyboard.press('Shift+Tab')
                assert await page.evaluate("document.activeElement.closest('#sheet') !== null")
                await page.keyboard.press('Escape')
                assert not await dialog.is_visible()
                assert not await page.evaluate("document.querySelector('#app').inert")
                assert await page.evaluate("document.activeElement.dataset.act") == 'menu', 'Escape must restore Menu focus'

                rules = page.locator('#top [data-act="rules"]')
                await rules.focus()
                await page.keyboard.press('Enter')
                assert await dialog.is_visible()
                assert await dialog.locator('#sheetHeading').count() == 1
                await page.locator('#sheet [data-act="closeSheet"]').click()
                assert await page.evaluate("document.activeElement.dataset.act") == 'rules', 'Close must restore Rules focus'

                slot = page.locator('#actionBar [data-act="editSlot"]').first
                await slot.focus()
                await page.keyboard.press('Enter')
                assert await dialog.is_visible()
                await page.keyboard.press('Escape')
                assert await page.evaluate("document.activeElement.dataset.act") == 'editSlot', 'Plan picker must return to its slot'
                assert not errors, f'phone {width}px JS errors: {errors}'
                await context.close()
                print(f'  ✔ phone {width}px: accessible dialog name, Escape/Close/Tab focus, plan-slot return')

            # Join form must give screen readers a named group of selectable avatars.
            html = fixture.markup('phone', snaps, config).replace("let saved = {code:'TEST',token:'test-token'};", 'let saved = null;')
            context = await browser.new_context(viewport={'width': 320, 'height': 740})
            page = await context.new_page()
            await page.set_content(html, wait_until='domcontentloaded')
            assert await page.locator('#avatarGrid').get_attribute('role') == 'group'
            assert await page.locator('#avatarGroupTitle').inner_text() == 'Pick a face'
            assert await page.locator('#avatarGrid').get_attribute('aria-labelledby') == 'avatarGroupTitle'
            await context.close()
            print('  ✔ join 320px: named avatar group')

            for width, height in [(1280, 720), (1920, 1080)]:
                context = await browser.new_context(viewport={'width': width, 'height': height})
                page = await context.new_page()
                errors = []
                page.on('pageerror', lambda e: errors.append(str(e)))
                await page.set_content(fixture.markup('tv', snaps, config), wait_until='domcontentloaded')
                rules = page.locator('#rulesBtn')
                await rules.focus()
                await page.keyboard.press('Enter')
                dialog = page.locator('#rules')
                assert await dialog.is_visible()
                assert await page.evaluate("document.querySelector('#corner').inert")
                assert await dialog.get_attribute('role') == 'dialog'
                assert await dialog.get_attribute('aria-labelledby') == 'tvRulesTitle'
                assert await page.evaluate('document.activeElement.id') == 'rNext'
                assert await page.evaluate("getComputedStyle(document.activeElement).outlineStyle") != 'none', 'TV keyboard focus must be visible'
                await page.keyboard.press('Tab')
                assert await page.evaluate("document.activeElement.closest('#rules') !== null"), 'TV Tab escaped dialog'
                await page.keyboard.press('ArrowRight')
                assert await page.evaluate('document.activeElement.id') == 'rNext'
                await page.keyboard.press('Escape')
                assert not await dialog.is_visible()
                assert not await page.evaluate("document.querySelector('#corner').inert")
                assert await page.evaluate('document.activeElement.id') == 'rulesBtn', 'TV Escape must restore opener'
                assert not errors, f'tv {width}px JS errors: {errors}'
                await context.close()
                print(f'  ✔ TV {width}×{height}: dialog semantics, keyboard focus, visible outline, focus return')
        finally:
            await browser.close()
    print('✔ All 6 actual-browser accessibility acceptance cases passed (synthetic state)')

if __name__ == '__main__':
    asyncio.run(main())
