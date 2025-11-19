import requests

def verifica_url(url):
    try:
        response = requests.get(url, timeout=10)
        return response.status_code == 200
    except requests.RequestException:
        return False

def descobrir_rota_reboot():
    """Verifica as URLs de reboot e retorna a que funcionar."""
    url_vivo = "http://router.vivo/"
    url_ip_fixo = "http://191.5.140.98/"

    if verifica_url(url_vivo):
        return ("Rota Vivo", url_vivo)
    elif verifica_url(url_ip_fixo):
        return ("Rota IP Fixo", url_ip_fixo)
    else:
        return ("Nenhuma rota encontrada", None)
