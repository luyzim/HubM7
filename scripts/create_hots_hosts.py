
import sys
import json
import configparser
import requests
import os

# --- Helper Functions for Zabbix API ---

def zbx_call(url, token, method, params):
    """Generic function to make a Zabbix API call."""
    payload = {
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "id": 1,
        "auth": token
    }
    headers = {"Content-Type": "application/json-rpc"}
    try:
        response = requests.post(url, data=json.dumps(payload), headers=headers, timeout=10, verify=False)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        raise Exception(f"HTTP Request Error: {e}")

    try:
        result = response.json()
    except json.JSONDecodeError:
        raise Exception(f"Failed to decode JSON. Server responded with status {response.status_code}: {response.text}")

    if 'error' in result:
        raise Exception(f"Zabbix API Error: {result['error']['data']}")
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
        response = requests.post(url, data=json.dumps(payload), headers=headers, timeout=10, verify=False)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        raise Exception(f"HTTP Request Error during login: {e}")

    try:
        result = response.json()
    except json.JSONDecodeError:
        raise Exception(f"Failed to decode JSON during login. Server responded with status {response.status_code}: {response.text}")

    if 'error' in result:
        raise Exception(f"Zabbix Login Error: {result['error']['data']}")
    return result['result']

def get_template_id(url, token, template_name):
    """Get the ID of a template by its name."""
    params = {
        "output": ["templateid"],
        "filter": {"host": [template_name]}
    }
    templates = zbx_call(url, token, "template.get", params)
    if not templates:
        raise Exception(f"Template '{template_name}' not found.")
    return templates[0]['templateid']

def get_or_create_group_id(url, token, group_name):
    """Get the ID of a host group by name, or create it if it doesn't exist."""
    # Check if group exists
    params = {
        "output": ["groupid"],
        "filter": {"name": [group_name]}
    }
    groups = zbx_call(url, token, "hostgroup.get", params)
    if groups:
        return groups[0]['groupid']
    
    # If not, create it
    params = {"name": group_name}
    result = zbx_call(url, token, "hostgroup.create", params)
    return result['groupids'][0]

def create_host(url, token, host_name, group_id, template_id, ip):
    """Create a new host in Zabbix."""
    params = {
        "host": host_name,
        "interfaces": [{
            "type": 1,
            "main": 1,
            "useip": 1,
            "ip": ip,
            "dns": "",
            "port": "10050"
        }],
        "groups": [{"groupid": group_id}],
        "templates": [{"templateid": template_id}]
    }
    result = zbx_call(url, token, "host.create", params)
    return result['hostids'][0]

# --- Main Execution ---

def main():
    try:
        # Read config file
        config = configparser.ConfigParser()
        # Path to config file in the same directory as the script
        config_path = os.path.join(os.path.dirname(__file__), 'config.ini')
        config.read(config_path)
        zabbix_url = config.get('zabbix', 'url')
        zabbix_user = config.get('zabbix', 'user')
        zabbix_password = config.get('zabbix', 'password')

        # Get command line arguments, stripping quotes added by shell
        if len(sys.argv) != 13:
            raise Exception(f"Usage: python {sys.argv[0]} <group> <identifier> <ip1>...<ip10>")

        group_name = sys.argv[1].strip('"')
        identifier = sys.argv[2].strip('"')
        ips = [ip.strip('"') for ip in sys.argv[3:]]

        # Login to Zabbix
        auth_token = login(zabbix_url, zabbix_user, zabbix_password)

        # Get IDs for Group and Template
        host_group_id = get_or_create_group_id(zabbix_url, auth_token, group_name)
        template_id = get_template_id(zabbix_url, auth_token, 'Template ICMP Ping')

        # Define host structures
        base_name = f"SICOOB-CCS-{group_name.upper()}-{identifier.upper()}"
        host_definitions = [
            {'prefix': 'MKT', 'suffix': ''},
            {'prefix': 'VCN-GARY', 'suffix': ''},
            {'prefix': 'VCN-PLANKTON', 'suffix': ''},
            {'prefix': 'WAN-CISCO', 'suffix': ''},
            {'prefix': 'LAN-CISCO', 'suffix': ''},
            {'prefix': 'MKT', 'suffix': '-MPLS'},
            {'prefix': 'VCN-GARY', 'suffix': '-MPLS'},
            {'prefix': 'VCN-PLANKTON', 'suffix': '-MPLS'},
            {'prefix': 'WAN-CISCO', 'suffix': '-MPLS'},
            {'prefix': 'LAN-CISCO', 'suffix': '-MPLS'},
        ]

        results = []
        for i, definition in enumerate(host_definitions):
            host_name = f"{definition['prefix']}-{base_name}{definition['suffix']}"
            ip = ips[i]

            # If IP is empty, skip this host
            if not ip or not ip.strip():
                results.append({
                    "hostname": host_name,
                    "ip": "",
                    "status": "Skipped"
                })
                continue
            
            try:
                host_id = create_host(zabbix_url, auth_token, host_name, host_group_id, template_id, ip)
                results.append({
                    "hostname": host_name,
                    "ip": ip,
                    "status": "Created",
                    "hostid": host_id
                })
            except Exception as e:
                # Check if host already exists
                if "host already exists" in str(e):
                     results.append({
                        "hostname": host_name,
                        "ip": ip,
                        "status": "Already Exists"
                    })
                else:
                    results.append({
                        "hostname": host_name,
                        "ip": ip,
                        "status": "Error",
                        "error": str(e)
                    })

        # Print results as a JSON string
        print(json.dumps(results, indent=4))

    except Exception as e:
        print(json.dumps([{"status": "Fatal Error", "error": str(e)}]), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    # Suppress InsecureRequestWarning from requests
    requests.packages.urllib3.disable_warnings(requests.packages.urllib3.exceptions.InsecureRequestWarning)
    main()
