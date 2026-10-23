"""Chromium first-session coach, keyboard dialog and responsive smoke checks.
Uses engine-generated snapshots + stub socket; it is NOT a network test.
"""
import asyncio
import importlib.util
import json
import shutil
import subprocess
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('ragna_phase4_browser', ROOT/'test'/'phase4-browser.py')
phase4 = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(phase4)
SCREENSHOTS = ROOT / 'reports' / 'phase5'
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

async def main():
    fixtures = json.loads(subprocess.check_output(['node', '-e', phase4.FIXTURE_SCRIPT], cwd=ROOT, text=True))
    config = json.loads((ROOT / 'src/data/v2.json').read_text())
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True, executable_path=shutil.which('chromium') or None, args=['--no-sandbox'])
        count = 0
        for width in (320, 375, 430):
            ctx, page, errors = await phase4.open_screen(browser, fixtures['pray'], config, width=width)
            coach = page.locator('[data-act="coachPlan"]')
            assert await coach.count() == 1, f'{width}px first-round helper missing'
            kind = await coach.get_attribute('data-kind')
            assert kind in ('claim', 'cultivate', 'tend', 'carBoot'), kind
            announcement = await page.locator('#phaseAnnouncement').inner_text()
            assert 'Round 1' in announcement, announcement
            assert await page.locator('#phaseAnnouncement').get_attribute('aria-live') == 'polite'
            await coach.click()
            assert await page.locator('#sheetWrap').is_visible()
            actual = await page.evaluate('window.__rg.ui.sheet.kind')
            assert actual == kind, f'coach navigation wrong: {kind=} {actual=}'
            assert not any(cmd['ev'] == 'action' for cmd in await page.evaluate('window.__QA_COMMANDS')), 'guide must not submit an action'
            # Tab and Shift-Tab wrap within the open planning sheet.
            buttons = page.locator('#sheet button:not([disabled])')
            assert await buttons.count() >= 2
            await buttons.last.focus()
            await page.keyboard.press('Tab')
            assert await buttons.first.evaluate('(el) => document.activeElement === el'), 'Tab escaped the modal'
            await page.keyboard.press('Shift+Tab')
            assert await buttons.last.evaluate('(el) => document.activeElement === el'), 'Shift+Tab escaped the modal'
            await page.keyboard.press('Escape')
            assert await page.locator('#sheetWrap').is_hidden(), 'Escape must close the modal'
            await page.locator('#top [data-act="menu"]').click()
            await page.locator('#sheet [data-act="toggleTips"]').click()
            assert await page.locator('[data-act="coachPlan"]').count() == 0, 'hidden tips must hide the coach'
            assert not await page.evaluate('document.documentElement.scrollWidth > innerWidth'), f'{width}px horizontal overflow'
            assert not errors, errors
            await page.screenshot(path=str(SCREENSHOTS/f'coach-{width}.png'))
            await ctx.close(); count += 1
            print(f'  ✔ {width}px first-round coach, modal focus, no side effects or overflow')
        await browser.close()
    print(f'✔ {count} Phase 5 Chromium checks passed (mock socket, not real network)')

if __name__ == '__main__':
    asyncio.run(main())
