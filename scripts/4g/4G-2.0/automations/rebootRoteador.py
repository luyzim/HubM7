import asyncio
from playwright.async_api import async_playwright


async def roteador_reboot(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(ignore_https_errors=True)
        page = await context.new_page()


        await page.goto(url, timeout=10011)
        try:
            await page.click('span:has-text("Status do sistema")', timeout=5000)
            await page.click('input.botao_reset[value="Sistema"]')
            await page.click('input#estilo_input[value="Reiniciar"]')
            await browser.close()
            return "Reboot executado! Aguardando normalização no Zabbix."
        except Exception as e:
            await browser.close()
            raise Exception(f"Roteador não acessível ou não respondeu ao comando de reboot. Favor acionar parceiro. Erro: {e}")