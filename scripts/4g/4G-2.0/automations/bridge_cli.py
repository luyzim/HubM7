#!/usr/bin/env python3
import os, sys, json, argparse, asyncio

# --- PATHS ---
HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
if HERE not in sys.path: sys.path.insert(0, HERE)

from csv_utils import ler_csv_com_normalizacao, buscar_ip_lan
from playwright_tasks import executar_automacao
from roteador import descobrir_rota_reboot
from rebootRoteador import roteador_reboot

def resolve_csv_path():
    """Encontra o caminho para o arquivo CSV."""
    candidates = [
        os.getenv("CSV_PATH"),
        os.path.join(ROOT, "data", "ips_RoyalFic.csv"),
    ]
    for p in filter(None, candidates):
        if os.path.exists(p):
            return p
    raise FileNotFoundError("ips_RoyalFic.csv não encontrado.")

async def main_async():
    p = argparse.ArgumentParser()
    p.add_argument("--unidade", required=True)
    args = p.parse_args()

    try:
        # 1. Achar IP a partir da unidade
        csv_path = resolve_csv_path()
        dados_csv = ler_csv_com_normalizacao(csv_path)
        ip_lan = buscar_ip_lan(dados_csv, args.unidade)

        if "Não encontrado" in ip_lan or "Seleção ignorada" in ip_lan:
            raise ValueError(f"IP para a unidade '{args.unidade}' não foi encontrado: {ip_lan}")

        # 2. Executar automação do SonicWall
        await executar_automacao(ip_lan)
        
        # 3. Descobrir a rota de reboot
        rota_nome, url_reboot = descobrir_rota_reboot()

        if not url_reboot:
            raise ConnectionError("Nenhuma das URLs de reboot (router.vivo, 191.5.140.98) respondeu.")

        # 4. Executar o reboot na URL encontrada
        resultado_reboot = await roteador_reboot(url_reboot)

        print(json.dumps({
            "success": True,
            "message": f"Feito o Reboot do 4G de'{args.unidade}' || {resultado_reboot}",
            "data": {"unidade": args.unidade, "ip_sonicwall": ip_lan, "reboot_url": url_reboot}
        }, ensure_ascii=False))
        return 0

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}, ensure_ascii=False), file=sys.stderr)
        return 1

def main():
    return asyncio.run(main_async())

if __name__ == "__main__":
    sys.exit(main())
