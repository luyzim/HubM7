#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import json
import re
import ipaddress
from pathlib import Path
from typing import Dict
import argparse


PLACEHOLDER_RE = re.compile(r"{{([A-Z0-9_]+)}}")


def verificar_ip_valido(dados: dict, campo_ip: str):
    """Verifica se um determinado campo no dicionário é um IP válido."""
    if campo_ip not in dados or not dados[campo_ip]:
        return
    
    valor_ip = (dados.get(campo_ip) or "").strip()
    try:
        ipaddress.ip_address(valor_ip)
    except ValueError:
        raise ValueError(f"O campo '{campo_ip}' com valor '{valor_ip}' não é um endereço de IP válido.")


def derivar_ip_p1_m1(campo_ip: str, prefixo_saida: str, payload: dict):
    """
    Calcula IPs (+1, +2, -1) a partir de um IP base e adiciona ao payload.
    Modifica o dicionário 'payload' in-place.
    """
    raw = (payload.get(campo_ip) or "").split("/")[0].strip()
    if not raw:
        return
    try:
        base = ipaddress.IPv4Address(raw)
        payload[f"{prefixo_saida}_P1"] = str(base + 1)
        payload[f"{prefixo_saida}_P2"] = str(base + 2)
        payload[f"{prefixo_saida}_M1"] = str(base - 1)
    except Exception as e:
        print(f"[WARN] IP invalido para derivacao em '{campo_ip}': {e}", file=sys.stderr)


def load_template(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(f"Template não encontrado: {path}")
    return path.read_text(encoding="utf-8")


def render_template(template: str, data: Dict[str, str]) -> str:
    """Substitui os placeholders no template com os dados fornecidos."""
    output = template
    for key, value in data.items():
        placeholder_tag = f"{{{{{key}}}}}"
        output = output.replace(placeholder_tag, str(value))
    return output


def write_output(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Renderiza um template de configuração FortiGate.")
    parser.add_argument("--template", required=True, help="Caminho para o arquivo de template.")
    args = parser.parse_args()

    try:
        payload = json.loads(sys.stdin.read())
        if not isinstance(payload, dict):
            raise ValueError("Payload precisa ser um objeto JSON")

        # --- Etapa de Processamento de Dados Dinâmico ---
        # Determina o nome do campo de IP (público ou privado) com base na VRF
        is_mpls = payload.get("VRF", "").lower().startswith("mpls")
        ip_field_name = "IP_PRIVADO" if is_mpls else "IP_PUBLICO"

        # 1. Valida os IPs de entrada
        verificar_ip_valido(payload, "WAN_IP")
        verificar_ip_valido(payload, ip_field_name)
        
        # 2. Deriva novos IPs e os adiciona ao payload
        derivar_ip_p1_m1("WAN_IP", "WAN_IP", payload)
        derivar_ip_p1_m1(ip_field_name, ip_field_name, payload)

        # --- Etapa de Renderização ---
        template_path = Path(args.template)
        template = load_template(template_path)
        
        rendered = render_template(template, payload)

        # --- Etapa de Saída ---
        output_dir = Path("output/fortigate")
        output_dir.mkdir(parents=True, exist_ok=True)
        unidade_nome = payload.get("SINGULAR", "fortigate_conf")
        template_name = "mpls" if is_mpls else "internet"
        
        filename = f"{unidade_nome}-{template_name}.conf"
        output_file = output_dir / filename

        write_output(output_file, rendered)

        sys.stdout.write(rendered)

    except Exception as e:
        sys.stderr.write(f"ERRO: {e}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
