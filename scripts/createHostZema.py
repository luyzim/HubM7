import requests
import os


#variabeis de ambiente
ZBX_URL = os.getenv("ZBX5_URL")
ZBX_USER = os.getenv("ZBX5_USER")
ZBX_PASS = os.getenv("ZBX5_PASS")

missing = [k for k, v in {
    "ZBX5_URL": ZBX_URL,
    "ZBX5_USER": ZBX_USER,
    "ZBX5_PASS": ZBX_PASS,
}.items() if not v]

if missing:
    raise Exception(f"Variáveis de ambiente ausentes: {', '.join(missing)}")

# ====== MAPA DE REDES (fixo por tipo); último octeto vem do parâmetro ======
NETS = {
    "COMPARTILHADO":              "10.41.4.",
    "DEDICADO":                   "10.25.4.",
    "VPN-CRUZADA-COMPARTILHADO":  "10.25.5.",
    "VPN-CRUZADA-DEDICADO":       "10.41.5.",
    "AWS01":                      "169.254.34.",
    "AWS02":                      "169.254.35.",
    "AWS03":                      "169.254.36.",
    "AWS04":                      "169.254.37.",
}

# ====== VARIANTES DOS 9 HOSTS ======
VARIANTS = [
    {"suffix": "COMPARTILHADO",                 "net": "COMPARTILHADO",             "proxy": "zabbix-zema",    "tpls": ["Template ICMP Ping - Zema", "Template ICMP Ping IPL"]},
    {"suffix": "COMPARTILHADO-AWS01",           "net": "AWS01",                     "proxy": "proxy-zema-aws", "tpls": ["Template ICMP Ping - Zema", "Template ICMP Ping IPL"]},
    {"suffix": "COMPARTILHADO-AWS03",           "net": "AWS03",                     "proxy": "proxy-zema-aws", "tpls": ["Template ICMP Ping - Zema", "Template ICMP Ping IPL"]},
    {"suffix": "DEDICADO",                      "net": "DEDICADO",                  "proxy": "zabbix-zema",    "tpls": ["Template ICMP Ping - Zema", "Template ICMP Ping IPL"]},
    {"suffix": "DEDICADO-AWS02",                "net": "AWS02",                     "proxy": "proxy-zema-aws", "tpls": ["Template ICMP Ping - Zema", "Template ICMP Ping IPL"]},
    {"suffix": "DEDICADO-AWS04",                "net": "AWS04",                     "proxy": "proxy-zema-aws", "tpls": ["Template ICMP Ping - Zema", "Template ICMP Ping IPL"]},
    {"suffix": "VPN-CRUZADA-COMPARTILHADO",     "net": "VPN-CRUZADA-COMPARTILHADO", "proxy": "zabbix-zema",    "tpls": ["Template ICMP Ping - Zema VPN Dedicado", "Template ICMP Ping IPL"]},
    {"suffix": "VPN-CRUZADA-DEDICADO",          "net": "VPN-CRUZADA-DEDICADO",      "proxy": "zabbix-zema",    "tpls": ["Template ICMP Ping - Zema VPN Dedicado", "Template ICMP Ping IPL"]},
    {
        "suffix": "ZEMA-LAN",
        "net": None,
        "proxy": "zabbix-zema",
        "tpls": ["Template Fortigate 100D", "Template ICMP Ping - Zema"],
        "lan": True,
        "snmp": {"version": 2, "bulk": 1, "community": "public"},
        # descrição usa os campos passados à função
        "desc_tpl": "PARCEIRO COMPARTILHADO:{ParceiroCom}  | PARCEIRO DEDICADO:{ParceiroDedi}"
    },
]

# ========== CLIENTE SIMPLES ==========
def zbx(method, params, auth=None):
    payload = {"jsonrpc": "2.0", "method": method, "params": params, "id": 1}
    if auth:
        payload["auth"] = auth
    headers = {"Content-Type": "application/json-rpc", "Accept": "application/json"}
    r = requests.post(ZBX_URL, json=payload, headers=headers, timeout=30, verify=VERIFY_SSL)
    r.raise_for_status()
    data = r.json()
    if "error" in data:
        raise RuntimeError(data["error"])
    return data["result"]

def login():
    return zbx("user.login", {"user": ZBX_USER, "password": ZBX_PASS})

def id_group(api, name, auth):
    name = name.strip()

    r = zbx("hostgroup.get", {"filter": {"name": [name]}, "output": ["groupid"]}, auth)
    if r:
        return r[0]["groupid"]

    try:
        res = zbx("hostgroup.create", {"name": name}, auth)
        return res["groupids"][0]
    except RuntimeError:

        r2 = zbx("hostgroup.get", {"filter": {"name": [name]}, "output": ["groupid"]}, auth)
        if r2:
            return r2[0]["groupid"]
        raise

def ids_templates(api, names, auth):
    out = []
    for n in names:
        r = zbx("template.get", {"filter": {"host": [n]}, "output": ["templateid"]}, auth) \
            or zbx("template.get", {"filter": {"name": [n]}, "output": ["templateid"]}, auth)
        if not r:
            raise SystemExit(f"Template não encontrado: {n}")
        out.append(r[0]["templateid"])
    return out

def id_proxy(api, name, auth):
    r = zbx("proxy.get", {"filter": {"host": [name]}}, auth) or \
        zbx("proxy.get", {"search": {"host": name}, "limit": 1}, auth)
    return r[0]["proxyid"] if r else None

def hostid_by_host(api, host, auth):
    r = zbx("host.get", {"filter": {"host": [host]}, "output": ["hostid"]}, auth)
    return r[0]["hostid"] if r else None

def ensure_agent_ip(hostid, ip, auth):
    h = zbx("host.get", {"hostids": hostid, "selectInterfaces": ["interfaceid","type","main","useip","ip","dns","port"]}, auth)[0]
    agent = next((i for i in h["interfaces"] if int(i["type"]) == 1 and int(i["main"]) == 1), None)
    if agent:
        if agent["ip"] != ip or agent["useip"] != "1":
            zbx("hostinterface.update", {"interfaceid": agent["interfaceid"], "useip": 1, "ip": ip, "dns": "", "port": "10050"}, auth)
    else:
        zbx("hostinterface.create", {"hostid": hostid, "type": 1, "main": 1, "useip": 1, "ip": ip, "dns": "", "port": "10050"}, auth)

def ensure_snmp(hostid, ip, details, auth):
    h = zbx("host.get", {"hostids": hostid, "selectInterfaces": ["interfaceid","type","main","ip","dns","port"]}, auth)[0]
    snmp = next((i for i in h["interfaces"] if int(i["type"]) == 2 and int(i["main"]) == 1), None)
    payload = {"type": 2, "main": 1, "useip": 1, "ip": ip, "dns": "", "port": "161", "details": details}
    if snmp:
        zbx("hostinterface.update", {"interfaceid": snmp["interfaceid"], **payload}, auth)
    else:
        zbx("hostinterface.create", {"hostid": hostid, **payload}, auth)

def upsert_host_unidade(site, cidade, ultimo_octeto, lan_ip, ParceiroCom="", ParceiroDedi=""):
    """
    Cria/atualiza os 9 hosts da unidade e adiciona/atualiza a DESCRIÇÃO no ZEMA-LAN
    usando os campos ParceiroCom e ParceiroDedi. Não altera o sistema de IPs.
    """
    auth = login()

    # grupos padrão da unidade
    groups = ["HOMOLOGACAO", "ZEMA", f"ZEMA-{cidade}"]
    group_ids = [id_group(zbx, g, auth) for g in groups]
    
    for v in VARIANTS:
        host = f"{site}-{v['suffix']}"
        
        current_group_ids = list(group_ids)
        if "DEDICADO" in v["suffix"]:
            dedicated_group_id = id_group(zbx, "ZEMA-DEDICADO", auth)
            if dedicated_group_id not in current_group_ids:
                current_group_ids.append(dedicated_group_id)
        if "COMPARTILHADO" in v["suffix"]:
            dedicated_group_id = id_group(zbx, "ZEMA-COMPARTILHADO", auth)
            if dedicated_group_id not in current_group_ids:
                current_group_ids.append(dedicated_group_id)

        visible = host
        proxyid = id_proxy(zbx, v["proxy"], auth)
        template_ids = ids_templates(zbx, v["tpls"], auth)

        if v.get("lan"):
            ip = lan_ip
        else:
            ip = NETS[v["net"]] + str(ultimo_octeto)

        hid = hostid_by_host(zbx, host, auth)

        if not hid:
            params = {
                "host": host,
                "name": visible,
                "status": 0,
                "groups": [{"groupid": gid} for gid in current_group_ids],
                "templates": [{"templateid": tid} for tid in template_ids],
                "interfaces": [
                    {"type": 1, "main": 1, "useip": 1, "ip": ip, "dns": "", "port": "10050"}
                ]
            }
            if proxyid:
                params["proxy_hostid"] = proxyid
            if v.get("lan") and v.get("snmp"):
                params["interfaces"].append({
                    "type": 2, "main": 1, "useip": 1, "ip": ip, "dns": "", "port": "161",
                    "details": v["snmp"]
                })
            # descrição só no LAN
            if v.get("lan"):
                desc = v.get("desc_tpl", "").format(
                    site=site, cidade=cidade, ip=ip,
                    ParceiroCom=ParceiroCom, ParceiroDedi=ParceiroDedi
                )
                if desc:
                    params["description"] = desc

            res = zbx("host.create", params, auth)
            hid = res["hostids"][0]
            print(f"[CRIADO] {host} -> {ip}")
        else:

            zbx("host.update", {
                "hostid": hid,
                "name": visible,
                "groups": [{"groupid": gid} for gid in current_group_ids],
                **({"proxy_hostid": proxyid} if proxyid else {})
            }, auth)

            ensure_agent_ip(hid, ip, auth)
            if v.get("lan") and v.get("snmp"):
                ensure_snmp(hid, ip, v["snmp"], auth)

            # descrição da LAN
            if v.get("lan"):
                desc = v.get("desc_tpl", "").format(
                    site=site, cidade=cidade, ip=ip,
                    ParceiroCom=ParceiroCom, ParceiroDedi=ParceiroDedi
                )
                if desc:
                    zbx("host.update", {"hostid": hid, "description": desc}, auth)

            print(f"[ATUALIZADO] {host} -> {ip}")



if __name__ == "__main__":


    import sys, json
    if len(sys.argv) > 1 and sys.argv[1] == "--stdin-json":
        cfg = json.load(sys.stdin)
        VERIFY_SSL = bool(cfg["zabbix"].get("verify_ssl", False))
        u = cfg["unidade"]
        upsert_host_unidade(
            site=u["site"],
            cidade=u["cidade"],
            ultimo_octeto=int(u["ultimo_octeto"]),
            lan_ip=u["lan_ip"],
            ParceiroCom=u.get("ParceiroCom",""),
            ParceiroDedi=u.get("ParceiroDedi",""),
        )
        print("OK")

  