#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import logging
import paramiko
import os

# Configuração básica de logging para fins de depuração do próprio script
logging.basicConfig(
    level="INFO",
    format="%(asctime)s - %(levelname)s - %(message)s",
    stream=sys.stderr, # Envia logs para stderr para não poluir o stdout
)

def run_ssh_command(host, command, username, password, port=22, timeout=15):
    """
    Conecta a um host via SSH e executa um único comando.
    Retorna a saída padrão (stdout) e a saída de erro (stderr).
    """
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        logging.info(f"Conectando a {host} na porta {port}...")
        client.connect(
            hostname=host,
            port=port,
            username=username,
            password=password,
            timeout=timeout,
            look_for_keys=False,
            allow_agent=False,
        )
        logging.info("Conexão bem-sucedida.")

        # Garante que a saída não será paginada ou quebrada
        # O shell do Mikrotik processa esses comandos de terminal antes do comando principal
        # Aumentar a largura do terminal ajuda a evitar quebras de linha inesperadas na saída.
        full_command = f"/terminal length 0\n/terminal width 511\n{command}"
        
        stdin, stdout, stderr = client.exec_command(full_command, timeout=30)
        
        # Lê a saída completa
        out = stdout.read().decode("utf-8", "ignore")
        err = stderr.read().decode("utf-8", "ignore")
        
        logging.info(f"Comando executado. Bytes de stdout: {len(out)}, Bytes de stderr: {len(err)}")
        
        return out, err

    except Exception as e:
        logging.error(f"Falha ao conectar ou executar comando em {host}: {e}")
        # Retorna o erro na saída de erro do script para o Node.js capturar
        return None, str(e)

    finally:
        try:
            if client.get_transport() and client.get_transport().is_active():
                client.close()
                logging.info("Conexão fechada.")
        except Exception as e:
            logging.error(f"Erro ao fechar conexão: {e}")


def main():
    """
    Ponto de entrada do script.
    Recebe ip e comando como argumentos de linha de comando.
    """
    if len(sys.argv) < 3:
        sys.stderr.write("Erro: Uso incorreto. Esperado: python comandosMkt.py <ip_do_host> <comando>\n")
        sys.exit(1)

    host_ip = sys.argv[1]
    command_to_run = sys.argv[2]

    username = os.getenv("MKT_USERNAME")
    password = os.getenv("MKT_M1_PASSWORD")

    if not username or not password:
        sys.stderr.write("Erro: Variáveis de ambiente MKT_USERNAME e MKT_M1_PASSWORD não definidas.\n")
        sys.exit(1)
        
    stdout_data, stderr_data = run_ssh_command(host_ip, command_to_run, username, password)

    if stdout_data is not None:
        # Imprime a saída bruta para o Node.js capturar
        sys.stdout.write(stdout_data)
        
    if stderr_data:
        # Imprime qualquer erro para o Node.js capturar
        sys.stderr.write(stderr_data)
        # Se houve um erro de conexão/execução, o script deve sair com um código de erro
        if stdout_data is None:
            sys.exit(1)

if __name__ == "__main__":
    main()
