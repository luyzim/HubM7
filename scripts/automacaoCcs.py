import argparse
import ipaddress
import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
TEMPLATES_DIR = BASE.parent / "data" / "ccs"
EXT_MAP = {
    "mkt": "rsc",
    "cisco": "crs",
    "mensagem": "txt",
}


class SafeDict(dict):
    def __missing__(self, key):
        return "{" + key + "}"


def escolher_template(dados: dict) -> Path:
    nome = (dados.get("TEMPLATE") or "").strip()
    if not nome:
        raise SystemExit("O nome do template nao foi fornecido.")

    alvo = TEMPLATES_DIR / nome
    if not alvo.exists():
        raise SystemExit(f"Template '{nome}' nao encontrado em {TEMPLATES_DIR}.")

    return alvo


def render_template(path: Path, data: dict) -> str:
    txt = path.read_text(encoding="utf-8")
    return txt.format_map(SafeDict(data))


def verificar_ip_valido(dados: dict, campo_ip: str) -> bool:
    valor_ip = (dados.get(campo_ip) or "").strip()
    iface = ipaddress.ip_interface(valor_ip)
    if iface.version != 4:
        raise ValueError("Somente IPv4 e aceito.")


def normalizar_ip_valido(
    dados: dict,
    campo_ip: str = "IP_VALIDO",
    destino_mask: str = "MASCARA_EXTENSO",
    campo_mask_dotted_opcional: str | None = None,
    manter_host: bool = True,
    default_mask_when_missing: str | None = None,
):
    valor_ip = (dados.get(campo_ip) or "").strip()
    if not valor_ip:
        return

    try:
        # Caso 1: IP/CIDR no proprio campo
        if "/" in valor_ip:
            iface = ipaddress.ip_interface(valor_ip)
            if iface.version != 4:
                raise ValueError("Somente IPv4 e aceito.")
            ip_usado = iface.ip if manter_host else iface.network.network_address
            dados[campo_ip] = str(ip_usado)
            dados[destino_mask] = str(iface.network.netmask)
            dados["IP_VALIDO_BARRADO"] = f"{ip_usado}/{iface.network.prefixlen}"
            return

        # Caso 2: Apenas IP (sem mascara no mesmo campo)
        ip_obj = ipaddress.ip_address(valor_ip)
        ip_str = str(ip_obj)
        dados[campo_ip] = ip_str

        prefixlen = None

        # 2a) Mascara dotted informada em outro campo
        if campo_mask_dotted_opcional and dados.get(campo_mask_dotted_opcional):
            m = str(dados[campo_mask_dotted_opcional]).strip()
            try:
                net = ipaddress.IPv4Network(f"0.0.0.0/{m}")
                dados[destino_mask] = str(net.netmask)
                prefixlen = net.prefixlen
            except Exception:
                pass

        # 2b) Fallback de mascara (ex.: "255.255.255.255" ou "32")
        if prefixlen is None and default_mask_when_missing:
            net = ipaddress.IPv4Network(f"0.0.0.0/{default_mask_when_missing}")
            dados[destino_mask] = str(net.netmask)
            prefixlen = net.prefixlen

        # 2c) Preenche o barrado se conseguimos determinar prefixo
        if prefixlen is not None:
            if not manter_host:
                rede = ipaddress.IPv4Network(f"{ip_str}/{prefixlen}", strict=False)
                ip_str = str(rede.network_address)
                dados[campo_ip] = ip_str
            dados["IP_VALIDO_BARRADO"] = f"{ip_str}/{prefixlen}"
    except Exception as e:
        print(f"[WARN] IP invalido em {campo_ip}: {e}", file=sys.stderr)


def derivar_ip_p1_m1(campo_ip: str, prefixo_saida: str, dados: dict):
    raw = (dados.get(campo_ip) or "").split("/")[0].strip()
    if not raw:
        return
    try:
        base = ipaddress.IPv4Address(raw)
        dados[f"{prefixo_saida}_P1"] = str(base + 1)
        dados[f"{prefixo_saida}_P2"] = str(base + 2)
        dados[f"{prefixo_saida}_M1"] = str(base - 1)
    except Exception as e:
        print(f"[WARN] IP invalido para derivacao em {campo_ip}: {e}", file=sys.stderr)


def derivar_ipBarrado_p1_m1(campo_ip: str, prefixo_saida: str, dados: dict):
    valor = (dados.get(campo_ip) or "").strip()
    if not valor:
        return
    try:
        ip_str, prefix = (valor.split("/", 1) + [""])[:2]
        base = ipaddress.IPv4Address(ip_str.strip())
        sufixo = f"/{prefix}" if prefix else ""
        dados[f"{prefixo_saida}_P1"] = f"{base + 1}{sufixo}"
        dados[f"{prefixo_saida}_M1"] = f"{base - 1}{sufixo}"
    except Exception as e:
        print(f"[WARN] IP invalido para derivacao em {campo_ip}: {e}", file=sys.stderr)


def inferir_n_por_ip_mkt(ip_mkt: str) -> int:
    raw = (ip_mkt or "").split("/")[0].strip()
    if not raw:
        raise ValueError("IP MKT vazio")

    ip = ipaddress.IPv4Address(raw)
    m = int(str(ip).split(".")[-1])  # último octeto do IP MKT

    # validações conforme sua tabela
    if m < 97 or m > 253:
        raise ValueError(f"IP MKT último octeto não coresponde a tabela: {m}")

    delta = m - 97
    if delta % 4 != 0:
        raise ValueError(f"IP MKT último octeto < 97: {m}")

    n = (delta // 4) + 2  # inversa exata do seu padrão
    if n < 2 or n > 41:
        raise ValueError(f"N inferido fora do range (2..41): {n}")

    return n

def derivarIpGaryPlanktonFinal1(campo_ip: str, prefixo_saida: str, dados: dict):
    raw = (dados.get(campo_ip) or "").split("/")[0].strip()
    if not raw:
        return

    try:
        ip = ipaddress.IPv4Address(raw)
        ip_int = int(ip)
        gary_int = (ip_int & 0xFFFFFF00) | 0x01
        plankton_step = ip_int + (1 << 8)
        plankton_int = (plankton_step & 0xFFFFFF00) | 0x01
        dados[f"{prefixo_saida}_GARY_FINAL1"] = str(ipaddress.IPv4Address(gary_int))
        dados[f"{prefixo_saida}_PLANKTON_FINAL1"] = str(ipaddress.IPv4Address(plankton_int))

    except Exception as e:
        print(f"[WARN] Falha derivando GARY/PLANKTON por IP MKT: {e}", file=sys.stderr)
        raise ValueError(f"Falha ao derivar GARY/PLANKTON por IP MKT: {e}")


def derivar_ip_gary_plankton_por_mkt(campo_ip: str, prefixo_saida: str, dados: dict):
    raw = (dados.get(campo_ip) or "").split("/")[0].strip()
    if not raw:
        return

    try:
        ip_mkt = ipaddress.IPv4Address(raw)
        ip_int = int(ip_mkt)

        # 1) Inferir N (último octeto do P/32) via IP MKT
        n = inferir_n_por_ip_mkt(dados.get(campo_ip))

        # 2) GARY: mesmo /24 do MKT, host = N
        gary_int = (ip_int & 0xFFFFFF00) | n

        # 3) PLANKTON: próximo /24 ( +256 ), host = N
        plankton_step = ip_int + (1 << 8)  # +256
        plankton_int = (plankton_step & 0xFFFFFF00) | n

        dados[f"{prefixo_saida}_GARY"] = str(ipaddress.IPv4Address(gary_int))
        dados[f"{prefixo_saida}_PLANKTON"] = str(ipaddress.IPv4Address(plankton_int))
        dados[f"{prefixo_saida}_N"] = n  # opcional: útil pra auditoria/log

    except Exception as e:
        print(f"[WARN] Falha derivando GARY/PLANKTON por IP MKT: {e}", file=sys.stderr)
        raise ValueError(f"Falha ao derivar GARY/PLANKTON por IP MKT: {e}")


def validar_ip_sem_barra(dados: dict, campo: str):
    valor = (dados.get(campo) or "").strip()
    if valor and "/" in valor:
        raise ValueError(
            f'O campo "{campo}" nao deve conter mascara de rede "/". Todos os IPs ja sao derivados automaticamente.'
        )


def validar_ip_com_barra(dados: dict, campo: str):
    valor = (dados.get(campo) or "").strip()
    if valor and "/" not in valor:
        raise ValueError(f'O campo "{campo}" deve conter mascara de rede /.')


def _process_ip_data(dados: dict):
    validar_ip_sem_barra(dados, "IP_UNIDADE")
    validar_ip_com_barra(dados, "IP_VALIDO")
    verificar_ip_valido(dados, "IP_VALIDO")
    verificar_ip_valido(dados, "IP_UNIDADE")
    normalizar_ip_valido(dados, destino_mask="MASCARA_EXTENSO")
    derivar_ipBarrado_p1_m1("IP_VALIDO_BARRADO", "IP_VALIDO_BARRADO", dados)
    derivar_ip_p1_m1("IP_UNIDADE", "IP_UNIDADE", dados)
    derivar_ip_p1_m1("IP_VALIDO", "IP_VALIDO", dados)
    derivar_ip_gary_plankton_por_mkt("IP_UNIDADE", "IP", dados)
    derivarIpGaryPlanktonFinal1("IP_UNIDADE", "IP", dados)




def run_command_mkt(dados: dict, cmd: str) -> dict:
    try:
        _process_ip_data(dados)
        tpl_path = escolher_template(dados)
        preview = render_template(tpl_path, dados)

        ext = EXT_MAP.get(cmd, "txt")
        num_pa = dados.get("NUM_PA", "sem_pa")
        identificacao = dados.get("IDENTIFICACAO", "sem_id")
        filename = f"{num_pa}-{identificacao}.{ext}"

        return {
            "status": "ok",
            "preview": preview,
            "unidade": dados.get("NOME_PA", ""),
            "loja": dados.get("NUM_PA", ""),
            "filename": filename,
        }
    except (ValueError, SystemExit) as e:
        return {"status": "error", "error": str(e)}
    
def run_command_cisco(dados: dict, cmd: str) -> dict:
    try:
        validar_ip_sem_barra(dados, "IP_UNIDADE")
        validar_ip_com_barra(dados, "IP_VALIDO")
        verificar_ip_valido(dados, "IP_VALIDO")
        verificar_ip_valido(dados, "IP_UNIDADE")
        normalizar_ip_valido(dados, destino_mask="MASCARA_EXTENSO")
        derivar_ipBarrado_p1_m1("IP_VALIDO_BARRADO", "IP_VALIDO_BARRADO", dados)
        derivar_ip_p1_m1("IP_UNIDADE", "IP_UNIDADE", dados)
        derivar_ip_p1_m1("IP_VALIDO", "IP_VALIDO", dados)

        tpl_path = escolher_template(dados)
        preview = render_template(tpl_path, dados)

        ext = EXT_MAP.get(cmd, "txt")
        num_pa = dados.get("NUM_PA", "sem_pa")
        identificacao = dados.get("IDENTIFICACAO", "sem_id")
        filename = f"{num_pa}-{identificacao}.{ext}"

        return {
            "status": "ok",
            "preview": preview,
            "unidade": dados.get("NOME_PA", ""),
            "loja": dados.get("NUM_PA", ""),
            "filename": filename,
        }
    except (ValueError, SystemExit) as e:
        return {"status": "error", "error": str(e)}


def run_command_wiki(dados: dict, cmd: str) -> dict:
    try:
        _process_ip_data(dados) # Call the common IP processing logic
        tpl_path = escolher_template(dados)
        preview = render_template(tpl_path, dados)

        # For wiki, we don't need a specific filename or complex validations,
        # just the rendered content is sufficient.
        return {
            "status": "ok",
            "preview": preview,
            "unidade": dados.get("NOME_PA", ""), # Still useful for context
            "loja": dados.get("NUM_PA", ""),     # Still useful for context
            "filename": "wiki_content.txt", # Generic filename
        }
    except (ValueError, SystemExit) as e:
        return {"status": "error", "error": str(e)}


def carregar_dados_interativo() -> dict:
    dados = {
        "NUM_PA": input("Numero da UNIDADE: ").strip(),
        "NOME_PA": input("Nome da UNIDADE: ").strip(),
        "IDENTIFICACAO": input("IDENTIFICACAO: ").strip(),
        "PARCEIRO": input("PARCEIRO: ").strip(),
        "IP_UNIDADE": input("IP INTERNO DA UNIDADE: ").strip(),
        "IP_VALIDO": input("IP VALIDO: ").strip(),
        "GARY_USER": input("User do L2TP GARY: ").strip(),
        "PLANKTON_USER": input("User do L2TP PLANKTON: ").strip(),
        "SENHA_ROUTER": input("Senha do ROUTER: ").strip(),
        "PPPOE_USER": input("User do PPPOE: ").strip(),
        "PPPOE_PASS": input("Senha do PPPOE: ").strip(),
        "VELOCIDADE": input("Velocidade (ex: 50M/10M): ").strip(),
        "VRF": input("VRF: ").strip(),
        "IP_GARY": input("IP_GARY: ").strip(),
        "IP_PLANKTON": input("IP_PLANKTON: ").strip(),
        "AS_LOCAL": input("AS LOCAL: ").strip(),
        "AS_REMOTO": input("AS REMOTO: ").strip(),
    }
    return dados


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--cmd", default="mkt")
    parser.add_argument("--mode", choices=["auto", "interactive", "stdin"], default="auto")
    args = parser.parse_args()

    usar_stdin = (args.mode == "stdin") or (args.mode == "auto" and not sys.stdin.isatty())

    if usar_stdin:
        raw = sys.stdin.read() or "{}"
        try:
            dados = json.loads(raw)
        except json.JSONDecodeError:
            print(json.dumps({"status": "error", "error": "JSON invalido no stdin"}))
            sys.exit(2)
    else:
        dados = carregar_dados_interativo()

    if args.cmd in ["mkt", "mensagem"]:
        result = run_command_mkt(dados, args.cmd)
        print(json.dumps(result, ensure_ascii=False))
    elif args.cmd == "cisco":
        result = run_command_cisco(dados, args.cmd)
        print(json.dumps(result, ensure_ascii=False))
    elif args.cmd == "wiki":
        result = run_command_wiki(dados, args.cmd)
        print(json.dumps(result, ensure_ascii=False))
    else:
        print(json.dumps({"status": "error", "error": f"comando desconhecido: {args.cmd}"}))
        sys.exit(3)
