from pathlib import Path
import sys
import re

BASE = Path(__file__).resolve().parent
TEMPLATES_DIR = BASE.parent / "data" / "oxidized"

class SafeDict(dict):
    def __missing__(self, k):
        return "{" + k + "}"

def listar_templates():
    print("--- Templates Disponíveis ---")
    if not TEMPLATES_DIR.exists():
        raise SystemExit(f"Diretório não existe: {TEMPLATES_DIR}")
    arquivos = sorted(TEMPLATES_DIR.glob("*.txt"))
    if not arquivos:
        raise SystemExit(f"Nenhum template .txt encontrado em {TEMPLATES_DIR}/")
    for i, p in enumerate(arquivos, 1):
        print(f"{i}) {p.name}")
    return arquivos

def render_template(path: Path, data: dict) -> str:
    txt = path.read_text(encoding="utf-8")
    return txt.format_map(SafeDict(data))

# --- NOVO: utilitário simples para extrair placeholders de 1 arquivo
def _placeholders_de(path: Path) -> list[str]:
    txt = path.read_text(encoding="utf-8")
    return sorted(set(re.findall(r"{([^}]+)}", txt)))

# --- NOVO: pergunta apenas uma vez para o conjunto (união) de placeholders
def coletar_dados_uma_vez(arquivos: list[Path]) -> dict:
    todos = set()
    for arq in arquivos:
        todos.update(_placeholders_de(arq))
    placeholders = sorted(todos)

    print("\n--- Preenchimento de Dados (aplicado a todos) ---")
    dados = {}
    for ph in placeholders:
        val = input(f"{ph}: ")
        dados[ph] = val.replace(" ", "").upper()
    return dados

# --- NOVO: escolha interativa do segundo template (sem mapeamentos)
def escolher_pareado(templates: list[Path], idx_principal: int) -> Path | None:
    
    print("\nDeseja gerar em massa? [S/N]: ", end="")
    resp = input().strip().lower()
    if resp not in {"s", "sim"}:
        return None

    print("\n--- Escolha o template agregado (ENTER para pular) ---")
    for i, p in enumerate(templates, 1):
        if i - 1 == idx_principal:
            continue
        print(f"{i}) {p.name}")
    escolha = input("Nº do template agregado: ").strip()
    if not escolha:
        return None
    try:
        idx = int(escolha) - 1
        if idx == idx_principal or not (0 <= idx < len(templates)):
            print("Escolha inválida. Ignorando agregado.")
            return None
        return templates[idx]
    except ValueError:
        print("Entrada inválida. Ignorando agregado.")
        return None

import json

def main_interactive():
    # 0) Definir arquivo de saída e garantir que o diretório existe
    output_dir = TEMPLATES_DIR / "output"
    output_dir.mkdir(exist_ok=True)
    output_file = output_dir / "output.txt"

    # 1) Escolha do template principal
    templates = listar_templates()
    try:
        idx = int(input("Nº do template: ").strip()) - 1
        tpl_principal = templates[idx]
    except (ValueError, IndexError):
        print("Escolha inválida.")
        sys.exit(1)

    # 2) (Opcional) Escolher um segundo template sem mapeamento
    try:
        if idx == 1 or idx == 0:  # 1ª e 2ª opções (1-based)
            tpl_sec = escolher_pareado(templates, idx)
        else:
            tpl_sec = None
    except Exception as e:
        print(f"Erro ao escolher template agregado: {e}")
        tpl_sec = None

    # 3) Perguntar UMA vez (união dos placeholders dos selecionados)
    alvos = [tpl_principal] + ([tpl_sec] if tpl_sec else [])
    dados = coletar_dados_uma_vez(alvos)

    # 4) Renderizar e coletar resultados
    resultados = []
    saida_principal = render_template(tpl_principal, dados)
    resultados.append(saida_principal)
    print("\n--- Resultado Principal ---")
    print(saida_principal)

    if tpl_sec:
        saida_sec = render_template(tpl_sec, dados)
        resultados.append(saida_sec)
        print("\n--- Resultado Agregado ---")
        print(saida_sec)

    # 5) Salvar tudo em um único arquivo
    try:
        # Junta os resultados com uma linha divisória para clareza
        conteudo_final = "\n".join(resultados)
        with open(output_file, "a", encoding="utf-8") as f:
            f.write(conteudo_final + "\n") # Adiciona duas novas linhas para separar os blocos
        print(f"\n✅ Resultado adicionado com sucesso ao final de:\n{output_file.absolute()}")
    except Exception as e:
        print(f"\n❌ Erro ao salvar o arquivo: {e}")


def main_api(api_data: dict):
    """Executa a lógica com dados fornecidos por uma API, de forma não interativa."""
    templates = {p.name: p for p in sorted(TEMPLATES_DIR.glob("*.txt"))}
    
    # 1) Obter templates a partir dos nomes
    nome_principal = api_data.get("template_principal")
    if not nome_principal or nome_principal not in templates:
        raise ValueError(f"Template principal '{nome_principal}' não encontrado.")
    tpl_principal = templates[nome_principal]

    tpl_sec = None
    nome_secundario = api_data.get("template_secundario")
    if nome_secundario and nome_secundario in templates:
        tpl_sec = templates[nome_secundario]

    # 2) Usar dados fornecidos
    dados = api_data.get("dados", {})
    # Sanitizar dados recebidos da API (similar ao modo interativo)
    for key, value in dados.items():
        if isinstance(value, str):
            dados[key] = value.replace(" ", "").upper()

    # 3) Renderizar e coletar resultados
    resultados = []
    saida_principal = render_template(tpl_principal, dados)
    resultados.append(saida_principal)

    if tpl_sec:
        saida_sec = render_template(tpl_sec, dados)
        resultados.append(saida_sec)

    # 4) Salvar tudo em um único arquivo
    output_dir = TEMPLATES_DIR / "output"
    output_dir.mkdir(exist_ok=True)
    output_file = output_dir / "output.txt"
    
    conteudo_final = "\n---END_OF_CONFIG---\n".join(resultados)
    with open(output_file, "a", encoding="utf-8") as f:
        f.write(conteudo_final + "\n")

    # Retorna o conteúdo gerado para o stdout, para a API capturar
    print(conteudo_final)


if __name__ == "__main__":
    # Verifica se está recebendo dados via stdin (para API)
    if not sys.stdin.isatty():
        try:
            input_data = json.load(sys.stdin)
            main_api(input_data)
        except (json.JSONDecodeError, ValueError) as e:
            print(f"Erro ao processar dados da API: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        # Caso contrário, executa no modo interativo
        main_interactive()
