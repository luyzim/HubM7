import asyncio
from playwright.async_api import async_playwright

async def executar_automacao(ip):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(ignore_https_errors=True)
        page = await context.new_page()

        await page.goto("https://191.5.140.98:10443/sonicui/7/login/#/")
        await page.fill('input[name="username"], input[name="emailInput"]', "tecnologiam7")
        await page.fill('input[type="password"]', "Tecm7@royalfic23!")
        await page.click('div.sw-login__trigger')
        await page.wait_for_selector('div.sw-avatar__inner', timeout=60000)
        await page.click('text=Object')
        await page.click('text=Addresses')
        await page.fill('input[name="addressObject"]', "Modem4G-Sonicwall-LAN-Unidade")
        await page.press('input[name="addressObject"]', "Enter")
        await page.click('text=Modem4G-Sonicwall-LAN-Unidade')
        await page.click('span.icon-pencil')
        await page.fill('input[name="ip-address"]', ip)
        await page.wait_for_selector('.sw-blocking-progress', state='hidden')
        await page.click('button:has-text("Save")')
        await asyncio.sleep(10)
        await browser.close()
