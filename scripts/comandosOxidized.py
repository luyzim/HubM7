#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import json
import paramiko
import logging
from pathlib import Path

# =========================
# Configuração de logging
# =========================
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s - %(levelname)s - %(message)s",
    stream=sys.stderr,  # IMPORTANTÍSSIMO: nada de log no stdout
)

def insert_line_by_group(routerdb_text: str, new_line: str, target_group: str) -> str:
    
    new_line = (new_line or "").strip()
    if not new_line:
        raise ValueError("Linha nova está vazia, nada a inserir.")

    lines = routerdb_text.splitlines()

    header_to_find = f"##{target_group}"
    current_group = None
    last_idx_same_group = None

    for idx, l in enumerate(lines):
        stripped = l.strip()

        # Detecta cabeçalho de grupo: linha começando com ##
        if stripped.startswith("##"):
            current_group = stripped[2:].strip()  # remove '##' e espaços

        # Se estamos dentro do grupo alvo, atualiza o último índice
        if current_group == target_group:
            last_idx_same_group = idx

    if last_idx_same_group is None:
        # Grupo ainda não existe no arquivo:
        # cria o cabeçalho e adiciona a linha no final
        lines.append(header_to_find)
        lines.append(new_line)
    else:
        # Insere logo após a última linha do bloco do grupo
        lines.insert(last_idx_same_group + 1, new_line)

    return "\n".join(lines).rstrip("\n") + "\n"


# =========================
# Função: atualização remota com inserção por grupo
# =========================
def append_remote_routerdb(line: str, target_group: str) -> dict:
    """
    Conecta via SSH e atualiza o router.db do Oxidized inserindo a linha
    logo abaixo do grupo correspondente (grupo informado por parâmetro).
    Variáveis de ambiente obrigatórias:
      - OXI_ROUTER_DB_PATH  (ex: /root/.config/oxidized/router.db)
      - OXI_SSH_HOST
      - OXI_SSH_USER
      - OXI_SSH_PASSWORD
    """

    ROUTER_DB_PATH = os.getenv("OXI_ROUTER_DB_PATH")
    host = os.getenv("OXI_SSH_HOST")
    user = os.getenv("OXI_SSH_USER")
    password = os.getenv("OXI_SSH_PASSWORD")
    port = int(os.getenv("OXI_SSH_PORT", "22"))

    if not all([ROUTER_DB_PATH, host, user, password]):
        return {
            "ok": False,
            "error": "Variáveis de ambiente ausentes",
            "details": (
                "Uma ou mais variáveis (OXI_ROUTER_DB_PATH, OXI_SSH_HOST, "
                "OXI_SSH_USER, OXI_SSH_PASSWORD) não foram definidas."
            ),
        }

    client = None
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        logging.info(f"Conectando em {host}:{port} como {user}...")
        client.connect(
            hostname=host,
            port=port,
            username=user,
            password=password,
            timeout=15,
        )

        # 1) Lê conteúdo atual do router.db
        cmd_read = f"sudo /bin/cat '{ROUTER_DB_PATH}'"
        logging.info(f"Lendo conteúdo atual de {ROUTER_DB_PATH}")
        stdin, stdout, stderr = client.exec_command(cmd_read, timeout=20)
        exit_code = stdout.channel.recv_exit_status()
        stderr_output = stderr.read().decode("utf-8", errors="ignore").strip()

        if exit_code != 0:
            logging.error(
                f"Falha ao ler router.db (exit={exit_code}). Stderr: {stderr_output}"
            )
            return {
                "ok": False,
                "error": "Falha ao ler router.db no servidor.",
                "details": stderr_output or f"Exit code: {exit_code}",
            }

        current_text = stdout.read().decode("utf-8", errors="ignore")

        # 2) Monta novo conteúdo com inserção por grupo
        try:
            new_text = insert_line_by_group(current_text, line, target_group)
        except Exception as e:
            logging.error("Erro ao calcular novo conteúdo do router.db", exc_info=True)
            return {
                "ok": False,
                "error": "Erro ao montar novo conteúdo do router.db.",
                "details": str(e),
            }

        # 3) Envia arquivo temporário via SFTP
        sftp = client.open_sftp()
        tmp_path = f"/tmp/router.db.{os.getpid()}"
        logging.info(f"Enviando arquivo temporário para {tmp_path}")
        with sftp.open(tmp_path, "w") as f:
            f.write(new_text)
        sftp.close()

        # 4) Aplica o novo arquivo com sudo mv
        cmd_mv = f"sudo /bin/mv '{tmp_path}' '{ROUTER_DB_PATH}'"
        logging.info(f"Aplicando novo router.db em {ROUTER_DB_PATH}")
        stdin, stdout, stderr = client.exec_command(cmd_mv, timeout=20)
        exit_code = stdout.channel.recv_exit_status()
        stderr_output = stderr.read().decode("utf-8", errors="ignore").strip()

        if exit_code == 0:
            logging.info("router.db atualizado com sucesso (inserção por grupo).")
            return {
                "ok": True,
                "message": "Bkp inserido no router.db no grupo correto com sucesso.",
            }

        logging.error(
            f"Falha ao aplicar novo router.db (exit={exit_code}). Stderr: {stderr_output}"
        )
        return {
            "ok": False,
            "error": "Falha ao aplicar novo router.db no servidor.",
            "details": stderr_output or f"Exit code: {exit_code}",
        }

    except Exception as e:
        logging.error(f"Exceção durante SSH / escrita remota: {e}", exc_info=True)
        return {
            "ok": False,
            "error": "Uma exceção ocorreu durante a execução remota.",
            "details": str(e),
        }
    finally:
        if client:
            client.close()


# =========================
# Main
# =========================
if __name__ == "__main__":
    # Espera 2 argumentos: <template_name> <linha_routerdb>
    if len(sys.argv) < 3:
        result = {
            "ok": False,
            "error": "Uso incorreto",
            "details": "Expected 2 arguments: <template_name> <linha_routerdb>",
        }
        print(json.dumps(result, indent=2))
        sys.exit(1)

    template_name = sys.argv[1]
    linha_routerdb = sys.argv[2]

    # Não confiar cegamente em lixo em branco
    linha_routerdb = (linha_routerdb or "").strip()

    try:
        # Ex: TESTE-SOUSA_Mkt.txt  ->  TESTE-SOUSA
        stem = Path(template_name).stem
        group_name = stem.split("_")[0]  # sem .upper() pra manter o hífen como está

        logging.info(
            f"Template recebido: {template_name} | Group derivado: {group_name}"
        )
        logging.info(f"Linha recebida: {repr(linha_routerdb)}")

        if not linha_routerdb:
            raise ValueError("A linha do router.db está vazia.")

        # Agora passamos o group_name para a função remota
        final_result = append_remote_routerdb(linha_routerdb, group_name)

    except ValueError as ve:
        final_result = {
            "ok": False,
            "error": "Dados de entrada inválidos",
            "details": str(ve),
        }
    except Exception as e:
        logging.error(f"Erro inesperado no main(): {e}", exc_info=True)
        final_result = {
            "ok": False,
            "error": "Um erro inesperado ocorreu no script.",
            "details": str(e),
        }

    # Só JSON no stdout, para o Node consumir limpo
    print(json.dumps(final_result, indent=2))
