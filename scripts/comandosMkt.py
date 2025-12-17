#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import logging
import paramiko

# 1. Configura o log para usar a saída padrão (stdout) para mensagens normais.
# Erros de verdade ainda podem ser escritos em sys.stderr.
logging.basicConfig(
    level="INFO",
    format="%(asctime)s - %(levelname)s - %(message)s",
    stream=sys.stdout,
)

logging.info("Iniciando o script comandosMkt.py...")
def run_ssh_command(host: str, command: str, username: str, password: str, port: int = 22, timeout: int = 15):
    """
    Conecta a um host via SSH e executa um comando, transmitindo a saída.
    """
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        logging.info("Conectando a %s:%s ...", host, port)
        client.connect(
            hostname=host,
            port=port,
            username=username,
            password=password,
            timeout=timeout,
            look_for_keys=False,
            allow_agent=False,
        )

        logging.info("Executando comando: %s", command)
        # O print() vai para stdout, que é transmitido para o frontend.
        print("-" * 30)

        stdin, stdout, stderr = client.exec_command(command)

        # Transmite a saída padrão do comando
        for line in iter(stdout.readline, ""):
            print(line, end="")

        # Transmite a saída de erro do comando para o stderr do script
        for line in iter(stderr.readline, ""):
            sys.stderr.write(line)

    except Exception as e:
        # Escreve exceções reais no stderr para o Node.js capturar como erro
        error_message = f"Falha ao executar o comando em {host}: {e}\n"
        sys.stderr.write(error_message)
        logging.error(error_message) # Também loga no stdout
        
    finally:
        if client.get_transport() and client.get_transport().is_active():
            client.close()
            logging.info("Conexão com %s encerrada.", host)


def main():
    """
    Função principal que lê os argumentos da linha de comando.
    """

    # 2. Verifica se os argumentos corretos (IP e comando) foram passados
    if len(sys.argv) != 3:
        msg = "Erro: Uso incorreto. Esperado: python comandosMkt.py <ip_do_host> <comando_para_executar>\n"
        sys.stderr.write(msg)
        sys.exit(1)

    host_ip = sys.argv[1]
    command_to_run = sys.argv[2]
    
    # ATENÇÃO: Credenciais fixas. Idealmente, usar variáveis de ambiente.
    username = "admin"
    password = "M1cr0S3t"
    port = 22

    # 3. Executa o comando com os argumentos recebidos
    run_ssh_command(host_ip, command_to_run, username, password, port)
    
    logging.info("Script comandosMkt.py finalizado.")


if __name__ == "__main__":
    main()