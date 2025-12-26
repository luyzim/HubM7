#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import logging
import paramiko
import os

logging.basicConfig(
    level="INFO",
    format="%(asctime)s - %(levelname)s - %(message)s",
    stream=sys.stdout,
)



def exec_and_capture(client: paramiko.SSHClient, command: str) -> tuple[str, str]:
    stdin, stdout, stderr = client.exec_command(command)
    out = stdout.read().decode("utf-8", "ignore")
    err = stderr.read().decode("utf-8", "ignore")
    return out, err

def run_ssh_command(host, command, username, password, port=22, timeout=15):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        client.connect(
            hostname=host,
            port=port,
            username=username,
            password=password,
            timeout=timeout,
            look_for_keys=False,
            allow_agent=False,
        )

        # força sem paginação e evita quebra por terminal
        exec_and_capture(client, "/terminal length 0")
        exec_and_capture(client, "/terminal width 200")

        out, err = exec_and_capture(client, command)
        sys.stdout.write(out)
        if err.strip():
            sys.stderr.write(err)

    except Exception as e:
        sys.stderr.write(f"Erro ao executar comando em {host}: {e}\n")
        sys.exit(1)
    finally:
        try:
            if client.get_transport() and client.get_transport().is_active():
                client.close()
        except Exception:
            pass

def main():
    if len(sys.argv) < 3:
        sys.stderr.write("Erro: Uso incorreto. Esperado: python comandosMkt.py <ip_do_host> <comando>\n")
        sys.exit(1)

    host_ip = sys.argv[1]
    command_to_run = sys.argv[2]

    username = os.getenv("MKT_USERNAME")
    password = os.getenv("MKT_M1_PASSWORD")
    port = 22

    run_ssh_command(host_ip, command_to_run, username, password, port)

if __name__ == "__main__":
    main()
