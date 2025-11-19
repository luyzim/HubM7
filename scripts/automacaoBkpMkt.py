import ipaddress, sys, json, argparse
from pathlib import Path
import tempfile, os

# Use the TPL_DIR environment variable if it exists, otherwise fall back to the old logic.
TEMPLATES_DIR = Path(os.environ.get("TPL_DIR", Path(__file__).resolve().parent / "data"))

class SafeDict(dict):
    def __missing__(self, k):
        return "{" + k + "}"



def escolher_template(dados: dict) -> Path:
    nome = (dados.get("TEMPLATE") or "").strip()
    if not nome:
        raise SystemExit("O nome do template não foi fornecido.")

    # Extract just the filename from the path provided by the Node.js script
    base_nome = os.path.basename(nome)
    alvo = TEMPLATES_DIR / base_nome
    if not alvo.exists():
        raise SystemExit(f"Template '{base_nome}' não encontrado em {TEMPLATES_DIR}.")

    return alvo


def render_template(path: Path, data: dict) -> str:
    txt = path.read_text(encoding="utf-8")
    return txt.format_map(SafeDict(data))



def run_command(dados: dict, cmd: str) -> dict:
    try:
        
        tpl_path = escolher_template(dados)
        preview = render_template(tpl_path, dados)

        # Definir a extensão do arquivo com base no comando
        ext = "rsc" if cmd == "mkt" else "crs"

        # Criar nome do arquivo
        num_pa = dados.get("NUM_PA", "sem_pa")
        identificacao = dados.get("IDENTIFICACAO", "sem_id")
        filename = f"{num_pa}-{identificacao}.{ext}"

        return {
            "status": "ok",
            "preview": preview,                    # conteúdo gerado
            "unidade": dados.get("NOME_PA", ""),
            "loja": dados.get("NUM_PA", ""),
            "filename": filename,
        }
    except (ValueError, SystemExit) as e:
        return {
            "status": "error",
            "error": str(e),
        }
    

def carregar_dados_interativo() -> dict:
    # === o que você já faz hoje com input() ===
    dados = {
        "NUM_PA": input("Numero da UNIDADE: ").strip(),
        "NOME_PA": input("Nome da UNIDADE: ").strip(),
        "IDENTIFICACAO": input("IDENTIFICACAO: ").strip(),
        "PARCEIRO": input("PARCEIRO: ").strip(),
        "IP_UNIDADE": input("IP INTERNO DA UNIDADE: ").strip(),
        "IP_VALIDO": input("IP VÁLIDO: ").strip(),
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
    return {k: input(f"{k}: ").strip() for k in dados}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--cmd", default="mkt")
    parser.add_argument("--mode", choices=["auto","interactive","stdin"], default="auto")
    args = parser.parse_args()

    usar_stdin = (args.mode == "stdin") or (args.mode == "auto" and not sys.stdin.isatty())

    if usar_stdin:
        raw = sys.stdin.read() or "{}"
        try:
            dados = json.loads(raw)          # <<< recebe do Node
        except json.JSONDecodeError:
            print(json.dumps({"status": "error", "error": "JSON inválido no stdin"}))
            sys.exit(2)
    else:
        dados = carregar_dados_interativo()  # <<< seu fluxo atual (inputs)

    if args.cmd in ["mkt", "cisco"]:
        result = run_command(dados, args.cmd)
        print(json.dumps(result, ensure_ascii=False))
    else:
        print(json.dumps({"status":"error","error":f"comando desconhecido: {args.cmd}"}))
        sys.exit(3)