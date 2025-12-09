import sys
import json
import configparser
import requests
import os
import ipaddress

# --- Helper Functions for Zabbix API ---

def sanitize_params_for_log(method, params):
    """Evita vazar credenciais em logs."""
    if method == "user.login":
        safe = dict(params)
        if "password" in safe:
            safe["password"] = "***"
        if "user" in safe:
            # ok manter usuário
            pass
        return safe
    return params

def zbx_call(url, token, method, params):
    """Generic function to make a Zabbix API call com logs melhores."""
    payload = {
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "id": 1,
        "auth": token
    }
    headers = {"Content-Type": "application/json-rpc"}
    try:
        response = requests.post(url, data=json.dumps(payload), headers=headers, timeout=15, verify=False)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        raise Exception(
            f"[HTTP] method={method} error={e} payload={json.dumps(sanitize_params_for_log(method, params), ensure_ascii=False)}"
        )

    try:
        result = response.json()
    except json.JSONDecodeError:
        raise Exception(
            f"[JSON] method={method} status={response.status_code} text={response.text[:4000]}"
        )

    if 'error' in result:
        raise Exception(
            f"[ZABBIX] method={method} code={result['error'].get('code')} "
            f"message={result['error'].get('message')} data={result['error'].get('data')} "
            f"params={json.dumps(sanitize_params_for_log(method, params), ensure_ascii=False)}"
        )
    return result['result']

def login(url, user, password):
    """Login to Zabbix API and get an auth token."""
    params = {"user": user, "password": password}
    payload = {
        "jsonrpc": "2.0",
        "method": "user.login",
        "params": params,
        "id": 1
    }
    headers = {"Content-Type": "application/json-rpc"}
    try:
        response = requests.post(url, data=json.dumps(payload), headers=headers, timeout=15, verify=False)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        raise Exception(f"[HTTP] method=user.login error={e}")

    try:
        result = response.json()
    except json.JSONDecodeError:
        raise Exception(f"[JSON] method=user.login status={response.status_code} text={response.text[:4000]}")

    if 'error' in result:
        raise Exception(
            f"[ZABBIX] method=user.login code={result['error'].get('code')} "
            f"message={result['error'].get('message')} data={result['error'].get('data')}"
        )
    return result['result']

def get_template_id(url, token, template_name):
    params = {
        "output": ["templateid"],
        "filter": {"host": [template_name]}
    }
    templates = zbx_call(url, token, "template.get", params)
    if not templates:
        raise Exception(f"Template '{template_name}' not found.")
    return templates[0]['templateid']

def get_or_create_group_id(url, token, group_name):
    params = {"output": ["groupid"], "filter": {"name": [group_name]}}
    groups = zbx_call(url, token, "hostgroup.get", params)
    if groups:
        return groups[0]['groupid']
    result = zbx_call(url, token, "hostgroup.create", {"name": group_name})
    return result['groupids'][0]

def get_host_id_by_name(url, token, host_name):
    res = zbx_call(url, token, "host.get", {"filter": {"host": [host_name]}, "output": ["hostid"]})
    if res:
        return res[0]["hostid"]
    return None

def build_interfaces(ip, needs_snmp):
    """
    Cria interfaces para o host.
    - Sempre cria uma interface 'agent' (type=1) para servir de interface padrão.
    - Se needs_snmp=True, adiciona interface SNMP (type=2) com details completos.
    """
    interfaces = [{
        "type": 1,       # agent
        "main": 1,
        "useip": 1,
        "ip": ip,
        "dns": "",
        "port": "10050"
    }]

    if needs_snmp:
        snmp_comm = os.getenv("ZBX_SNMP_COMMUNITY", "public")
        interfaces.append({
            "type": 2,   # SNMP
            "main": 1,
            "useip": 1,
            "ip": ip,
            "dns": "",
            "port": "161",
            "details": {
                "version": 2,  # 1,2,3
                "bulk": 1,
                "community": "{$SNMP_COMMUNITY}"
            }
        })
    return interfaces

def create_or_get_host(url, token, host_name, group_id, template_ids, interfaces):
    """
    Tenta criar host; se já existir, retorna o existente.
    """
    # Se já existe, retornamos direto (evita erro do create)
    existing = get_host_id_by_name(url, token, host_name)
    if existing:
        return existing, False

    params = {
        "host": host_name,
        "interfaces": interfaces,
        "groups": [{"groupid": group_id}],
        "templates": [{'templateid': tid} for tid in template_ids]
    }

    try:
        result = zbx_call(url, token, "host.create", params)
        return result['hostids'][0], True
    except Exception as e:
        # Se der erro genérico, verifica novamente se o host foi parcialmente criado
        existing = get_host_id_by_name(url, token, host_name)
        if existing:
            return existing, False
        # Propaga erro com contexto
        raise Exception(f"[host.create] host={host_name} ip={interfaces[0].get('ip')} error={e}")

# --- Main Execution ---

def is_valid_ipv4(s):
    try:
        ipaddress.IPv4Address(s)
        return True
    except Exception:
        return False

def main():
    try:
        # Read config file
        zabbix_url = os.getenv("ZBX6_URL")
        zabbix_user = os.getenv("ZBX_USER")
        zabbix_password = os.getenv("ZBX6_PASS")
        missing = [k for k, v in {
            "ZBX6_URL": zabbix_url,
            "ZBX_USER": zabbix_user,
            "ZBX6_PASS": zabbix_password,
        }.items() if not v]

        if missing: 
            raise Exception(f"Variáveis de ambiente ausentes: {', '.join(missing)}")

        # Get command line arguments
        if len(sys.argv) != 13:
            raise Exception(f"Uso: python {sys.argv[0]} <group> <identifier> <ip1> ... <ip10>")

        group_name = sys.argv[1].strip('"')
        identifier = sys.argv[2].strip('"')
        ips = [ip.strip('"') for ip in sys.argv[3:]]

        # Login
        auth_token = login(zabbix_url, zabbix_user, zabbix_password)

        # Group & Templates
        host_group_id = get_or_create_group_id(zabbix_url, auth_token, group_name)
        template_id_icmp = get_template_id(zabbix_url, auth_token, 'Template ICMP Ping')
        template_id_mikrotik = get_template_id(zabbix_url, auth_token, 'Template Mikrotik RB750-RB1100-Final')
        template_id_interfaces_snmp = get_template_id(zabbix_url, auth_token, 'Template Module Interfaces SNMPv2')
        template_id_cisco_router = get_template_id(zabbix_url, auth_token, 'Template SNMP Router Cisco')

        base_name = f"SICOOB-CCS-{group_name.upper()}-{identifier.upper()}"
        host_definitions = [
            {'prefix': 'MKT',        'suffix': ''},
            {'prefix': 'VCN-GARY',   'suffix': ''},
            {'prefix': 'VCN-PLANKTON','suffix': ''},
            {'prefix': 'WAN-CISCO',  'suffix': ''},
            {'prefix': 'LAN-CISCO',  'suffix': ''},
            {'prefix': 'MKT',        'suffix': '-MPLS'},
            {'prefix': 'VCN-GARY',   'suffix': '-MPLS'},
            {'prefix': 'VCN-PLANKTON','suffix': '-MPLS'},
            {'prefix': 'WAN-CISCO',  'suffix': '-MPLS'},
            {'prefix': 'LAN-CISCO',  'suffix': '-MPLS'},
        ]

        results = []
        for i, definition in enumerate(host_definitions):
            host_name = f"{definition['prefix']}-{base_name}{definition['suffix']}"
            ip = ips[i] if i < len(ips) else ""

            # Skip se IP vazio/inválido
            if not ip or not ip.strip():
                results.append({"hostname": host_name, "ip": "", "status": "Skipped", "reason": "IP vazio"})
                continue
            if not is_valid_ipv4(ip):
                results.append({"hostname": host_name, "ip": ip, "status": "Skipped", "reason": "IP inválido"})
                continue

            # Escolha de templates e interfaces
            needs_snmp = False
            template_ids = [template_id_icmp]  # default: ICMP

            if definition['prefix'] == 'MKT':
                needs_snmp = True
                template_ids = [template_id_mikrotik, template_id_interfaces_snmp]
            elif definition['prefix'] == 'WAN-CISCO':
                needs_snmp = True
                template_ids = [template_id_icmp, template_id_interfaces_snmp, template_id_cisco_router]
            # LAN/VCN com ICMP apenas (ajuste aqui se quiser SNMP neles)

            interfaces = build_interfaces(ip, needs_snmp)

            try:
                host_id, created = create_or_get_host(zabbix_url, auth_token, host_name, host_group_id, template_ids, interfaces)
                results.append({
                    "hostname": host_name,
                    "ip": ip,
                    "status": "Created" if created else "Already Exists",
                    "hostid": host_id,
                    "interfaces": interfaces,
                    "templates": template_ids
                })
            except Exception as e:
                results.append({
                    "hostname": host_name,
                    "ip": ip,
                    "status": "Error",
                    "error": str(e),
                    "interfaces": interfaces,
                    "templates": template_ids
                })

        print(json.dumps(results, indent=4, ensure_ascii=False))

    except Exception as e:
        print(json.dumps([{"status": "Fatal Error", "error": str(e)}], ensure_ascii=False), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    # Suppress InsecureRequestWarning from requests
    requests.packages.urllib3.disable_warnings(requests.packages.urllib3.exceptions.InsecureRequestWarning)
    main()
