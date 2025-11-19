import sys
import asyncio
from playwright.async_api import async_playwright

async def run(ip):
    
    async with async_playwright() as p: 
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(ignore_https_errors=True)
        page = await context.new_page()

        await page.goto("https://189.50.96.10:10443")
        await page.fill('input[name="username"]', "admin")
        await page.fill('input[type="password"]', "m@x7200unimedbotucatu!")
        
        await page.click('div.sw-login__trigger')
        await page.wait_for_selector('div.sw-avatar__inner', timeout=90000)
        await page.click('text=Object')
        await page.click('text=Addresses')
        # Clicar no botão "Add"
        await page.click("//span[contains(@class, 'sw-icon-button__label-cont') and normalize-space(text())='Add']")

        # Esperar carregamento sumir após abrir o modal
        await page.wait_for_selector('.sw-blocking-progress', state='detached', timeout=10100)
        await page.wait_for_selector("//input[@name='name']", timeout=10200)

        # Preencher o nome
        await page.fill("//input[@name='name']", f"2810-{ip}")

        # Abrir dropdown "Zone Assignment" (ex: LAN)
        await page.wait_for_selector("//div[contains(@class, 'sw-select') and .//input[@name='zoneAssignment']]", timeout=10300)
        await page.locator("//div[contains(@class, 'sw-select') and .//input[@name='zoneAssignment']]").click()

        # Selecionar opção "LAN"
        await page.wait_for_selector("//div[contains(@id, 'sw-select__option') and .//span[normalize-space(text())='LAN']]", timeout=10400)
        await page.click("//div[contains(@id, 'sw-select__option') and .//span[normalize-space(text())='LAN']]")

        # Abrir dropdown "Type" (ex: Host)
        await page.wait_for_selector("//div[contains(@class, 'sw-select') and .//input[@name='type']]", timeout=10400)
        await page.locator("//div[contains(@class, 'sw-select') and .//input[@name='type']]").click()

        # Selecionar opção "Host"
        await page.wait_for_selector("//div[contains(@id, 'sw-select__option') and .//span[normalize-space(text())='Host']]", timeout=10500)
        await page.click("//div[contains(@id, 'sw-select__option') and .//span[normalize-space(text())='Host']]")

        # Preencher o campo de IP
        await page.wait_for_selector("//input[@name='ip-address']", timeout=10600)
        await page.fill("//input[@name='ip-address']", ip)

        # Salvar
        await page.wait_for_selector('button:has-text("Save")', timeout=10700)
        await page.click('button:has-text("Save")')

        #Sair
        await page.wait_for_selector(f"//span[contains(@class, 'icon-close-thin') ]", timeout=10800)
        
        
        try:      #Click de fechar o modal
            await page.locator("//span[contains(@class, 'icon-close-thin')]").click(timeout=10810)
        except Exception as e:
            await page.get_by_role("button", name="OK").click(timeout=10820)
            await page.locator("//span[contains(@class, 'icon-close-thin')]").click(timeout=10830)

            #Localizar o grupo de endereços e editar
            await page.click("//li[contains(@class, 'sw-tab') and .//span[normalize-space(text())='Address Groups']]")
            await page.fill("//input[@name='searchBox1']", "2810-GP-MAQ-LIBERADAS-INTERNET")
            await page.click('text=2810-GP-MAQ-LIBERADAS-INTERNET')
            
            await page.click('span.icon-pencil', timeout=10840)  #ícone de editar

            await page.fill("//input[@name='search']", f"2810-{ip}")
            await page.wait_for_timeout(5000)  # Aguarda a UI atualizar
            await page.wait_for_selector(f"//span[contains(@class, 'sw-transfer-list-pane__item-label') and contains(text(), '2810-{ip}')]", timeout=10850)
            await page.click(f"//span[contains(@class, 'sw-transfer-list-pane__item-label') and contains(text(), '2810-{ip}')]") #Lista dinamca


            await page.click("//span[contains(@class, 'sw-icon-button__inner') and .//span[contains(@class, 'icon-play')]]")
            await page.click('button:has-text("Save")')

            await page.wait_for_timeout(10900)
            
            # Fecha o modal manualmente
            await page.click("//span[contains(@class, 'icon-close-thin')]", timeout=10005)

            # Finalizar
            await browser.close()

            print(f"IP ja existente no Firewall, inserido no Grupo de navegacao:", file=sys.stdout)
            return

        #Localizar o grupo de endereços e editar
        await page.click("//li[contains(@class, 'sw-tab') and .//span[normalize-space(text())='Address Groups']]")
        await page.fill("//input[@name='searchBox1']", "2810-GP-MAQ-LIBERADAS-INTERNET")
        await page.click('text=2810-GP-MAQ-LIBERADAS-INTERNET')
        

    
        await page.click('span.icon-pencil', timeout=10901)  #ícone de editar


        await page.fill("//input[@name='search']", f"2810-{ip}")
        await page.wait_for_timeout(500)  # Aguarda a UI atualizar
        await page.wait_for_selector(f"//span[contains(@class, 'sw-transfer-list-pane__item-label') and contains(text(), '2810-{ip}')]", timeout=10001)
        await page.click(f"//span[contains(@class, 'sw-transfer-list-pane__item-label') and contains(text(), '2810-{ip}')]") #Lista dinamca


        await page.click("//span[contains(@class, 'sw-icon-button__inner') and .//span[contains(@class, 'icon-play')]]")
        await page.click('button:has-text("Save")')

        await page.wait_for_timeout(10900)

        # Fecha o modal manualmente
        await page.click("//span[contains(@class, 'icon-close-thin')]", timeout=10005)

        # Finalizar
        await browser.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Erro: IP não fornecido.", file=sys.stderr)
        sys.exit(1)

    ip_input = sys.argv[1]
    try:
        asyncio.run(run(ip_input))
        print("Maquina Liberada Para Navegação!")
    except Exception as e:
        print(f"Ocorreu um erro durante a automação: {e}", file=sys.stderr)
        sys.exit(1)

