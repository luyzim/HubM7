import argparse
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path

PRODUCTIVE_ENDPOINTS = {
    "POST /api/mkt": 51,
    "POST /api/mkt/gerawiki": 17,
    "POST /api/mkt/mensagem": 8,
    "POST /api/bkpMkt": 30,
    "POST /api/comandos-oxidized/run": 17,
    "POST /api/ccsFortgate": 23,
    "POST /api/4g": 25,
    "POST /api/comandos-mkt/scan-super": 25,
    "POST /api/wiki": 17,
    "POST /api/unimed": 15,
}

# endpoints de navegação conhecidos (Home + assets + API de status)
NAV_PATHS = {
    "/home",
    "/login",
    "/result.js",
    "/tabela/ips",
    "/js/sessionReminder.js",
    "/js/home.js",
    "/js/sessionReminder.js",
    "/api/status/automations",
    "/api/work-session/active",
}

LOG_PATTERN = re.compile(
    r"^(?P<ip>\d+\.\d+\.\d+\.\d+) - - \[(?P<ts>[^\]]+)\] \"(?P<method>GET|POST|PUT|DELETE|PATCH|HEAD) (?P<path>[^ ]+) HTTP/[0-9.]+\" (?P<status>\d{3}) (?P<size>-|\d+)(?: -)?(?: user=(?P<user>[^ ]+))?",
    re.IGNORECASE,
)

DATE_FORMAT = "%d/%b/%Y %H:%M:%S"


def parse_http_line(line):
    m = LOG_PATTERN.search(line)
    if not m:
        return None

    try:
        ts = datetime.strptime(m["ts"], DATE_FORMAT)
    except ValueError:
        return None

    path = m["path"]
    if "?" in path:
        path = path.split("?")[0]

    return {
        "ts": ts,
        "user": m.group("user") or "",
        "method": m.group("method"),
        "path": path,
        "status": int(m.group("status")),
    }


def month_range(target_date):
    start_of_month = target_date.replace(day=1)
    last_month_end = start_of_month - timedelta(days=1)
    last_month_start = last_month_end.replace(day=1)
    return last_month_start, last_month_end


def is_productive_endpoint(path):
    return any(path.startswith(k.split(' ', 1)[1]) for k in PRODUCTIVE_ENDPOINTS)


def normalize_productive_request_key(method, path):
    if method != 'POST':
        return None

    # alias conversions to match o conjunto conhecido
    if path.startswith('/api/comandos-mkt/run'):
        return 'POST /api/comandos-mkt/scan-super'
    if path.startswith('/api/4g/run'):
        return 'POST /api/4g'

    # prefira correspondência exata de endpoint produtivo
    candidate = f'{method} {path}'
    if candidate in PRODUCTIVE_ENDPOINTS:
        return candidate

    # correspondência de prefixo para endpoints com path dinâmico (se necessário)
    candidates = [key for key in PRODUCTIVE_ENDPOINTS if candidate.startswith(key)]
    if not candidates:
        return None
    return max(candidates, key=len)


def is_navigation_path(path):
    if path in NAV_PATHS:
        return True
    if path.startswith("/api/") and not is_productive_endpoint(path):
        return False
    # assets, pages and endpoints de nav
    return path.startswith("/js/") or path.startswith("/tabela/") or path.startswith("/login")


def normalize_path(path):
    if path.startswith("/api/"):
        # mapeia uso de endpoint com query
        return path.split('?', 1)[0]
    return path


def build_report(stats, last_month_start, last_month_end):
    economy_total_min = stats["kpis"]["totalEconomyMin"]

    user_activity = []
    user_productivity = []

    for user, info in stats["users"].items():
        top_endpoints = sorted(info["endpoints"].items(), key=lambda x: -x[1])[:5]
        user_activity.append(
            {
                "user": user,
                "totalRequests": info["totalRequests"],
                "economyHours": round(info["economyMin"] / 60, 2),
                "topEndpoints": [{"endpoint": k, "requests": v} for k, v in top_endpoints],
            }
        )
        user_productivity.append(
            {
                "user": user,
                "productiveActions": info["productiveActions"],
                "economyMin": info["economyMin"],
                "economyHours": round(info["economyMin"] / 60, 2),
            }
        )

    for item in user_activity:
        item["economyHours"] = round(item["economyHours"], 2)

    endpoint_economy = []
    for endpoint, endpoint_stat in stats["endpoints"].items():
        if endpoint_stat["frequency"] > 0:
            endpoint_economy.append(
                {
                    "endpoint": endpoint,
                    "frequency": endpoint_stat["frequency"],
                    "economyMin": endpoint_stat["economyMin"],
                    "economyHours": round(endpoint_stat["economyMin"] / 60, 2),
                    "timePerCallMin": endpoint_stat["timePerCallMin"],
                }
            )

    endpoint_economy = sorted(endpoint_economy, key=lambda x: -x["economyHours"])

    report = {
        "kpis": {
            "totalRequests": stats["kpis"]["totalRequests"],
            "distinctUsers": len(stats["kpis"]["distinctUsers"]),
            "productiveActions": stats["kpis"]["productiveActions"],
            "navigationActions": stats["kpis"]["navigationActions"],
            "totalEconomyMin": economy_total_min,
            "totalEconomyHours": round(economy_total_min / 60, 2),
        },
        "summary": {
            "totalRequests": stats["kpis"]["totalRequests"],
            "totalUsers": len(stats["kpis"]["distinctUsers"]),
            "productiveActions": stats["kpis"]["productiveActions"],
            "navigationActions": stats["kpis"]["navigationActions"],
            "totalEconomyHours": round(economy_total_min / 60, 2),
            "totalEconomyMin": economy_total_min,
            "pythonLogs": stats["kpis"].get("pythonLogs", 0),
            "bridgeLogs": stats["kpis"].get("bridgeLogs", 0),
        },
        "statusDistribution": dict(stats["statusDistribution"]),
        "endpointEconomy": endpoint_economy,
        "userActivityEndpoints": sorted(user_activity, key=lambda x: -x["economyHours"])[:5],
        "userProductivity": sorted(user_productivity, key=lambda x: -x["economyHours"])[:10],
        "productiveEndpoints": endpoint_economy,
        "dailyActivity": [
            {"date": d, "requests": stats["dailyActivity"][d]} for d in sorted(stats["dailyActivity"])
        ],
    }

    return report


def collect(log_path: Path, start_dt: datetime, end_dt: datetime):
    stats = {
        "kpis": {
            "totalRequests": 0,
            "distinctUsers": set(),
            "productiveActions": 0,
            "navigationActions": 0,
            "totalEconomyMin": 0,
        },
        "statusDistribution": Counter(),
        "endpoints": defaultdict(lambda: {"frequency": 0, "economyMin": 0, "timePerCallMin": 0}),
        "users": defaultdict(lambda: {
            "totalRequests": 0,
            "productiveActions": 0,
            "economyMin": 0,
            "endpoints": defaultdict(int),
        }),
        "dailyActivity": Counter(),
    }

    with log_path.open("r", encoding="utf-8", errors="replace") as f:
        for raw in f:
            line = raw.strip()
            if not line:
                continue

            parsed = parse_http_line(line)
            if parsed is None:
                continue

            if not (start_dt <= parsed["ts"] <= end_dt):
                continue

            user = parsed["user"].strip().lower()
            is_guest = (user == "guest" or not user)

            stats["kpis"]["totalRequests"] += 1
            if not is_guest:
                stats["kpis"]["distinctUsers"].add(user)
            stats["statusDistribution"][str(parsed["status"]) ] += 1
            stats["dailyActivity"][parsed["ts"].strftime("%Y-%m-%d")] += 1

            normalized_path = normalize_path(parsed["path"])
            productive_key = normalize_productive_request_key(parsed["method"], normalized_path)
            is_prod = productive_key is not None
            is_nav = is_navigation_path(parsed["path"])

            if is_prod and not is_guest:
                stats["kpis"]["productiveActions"] += 1
                economy_min = PRODUCTIVE_ENDPOINTS.get(productive_key, 0)
                stats["kpis"]["totalEconomyMin"] += economy_min

                ep_stat = stats["endpoints"][productive_key]
                ep_stat["frequency"] += 1
                ep_stat["economyMin"] += economy_min
                ep_stat["timePerCallMin"] = PRODUCTIVE_ENDPOINTS.get(productive_key, 0)

                stats["users"][user]["productiveActions"] += 1
                stats["users"][user]["economyMin"] += economy_min
            elif is_nav:
                stats["kpis"]["navigationActions"] += 1


            if not is_guest:
                stats["users"][user]["totalRequests"] += 1
                stats["users"][user]["endpoints"][normalized_path] += 1


            if user:
                stats["users"][user]["totalRequests"] += 1
                stats["users"][user]["endpoints"][normalized_path] += 1

    return stats


def write_report(report, output_path: Path, export_name='reportData'):
    # output ESM-compatible and browser-friendly JS
    content = f"export const {export_name} = " + json.dumps(report, ensure_ascii=False, indent=2) + ";\n"
    output_path.write_text(content, encoding="utf-8")


def write_browser_report(report, output_path: Path, global_name='reportData'):
    # generate public/reportData.js that can be loaded by a browser script
    content = f"window.{global_name} = " + json.dumps(report, ensure_ascii=False, indent=2) + ";\n"
    output_path.write_text(content, encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Gera reportData.ts a partir de hub-out.log")
    parser.add_argument("--log", default=r"C:\\Users\\aloysio.rosseti\\.pm2\\logs\\hub-out.log", help="Caminho do hub-out.log")
    parser.add_argument("--out", default=r"c:\\Users\\User\\Desktop\\Projetos\\Hub\\reportData.ts", help="Arquivo TS de saída")
    parser.add_argument("--out-browser", default=r"c:\\Users\\User\\Desktop\\Projetos\\Hub\\public\\reportData.js", help="Arquivo JS para browser")
    parser.add_argument("--as-date", default=None, help="Data de referência (YYYY-MM-DD) para mês anterior")
    args = parser.parse_args()

    if args.as_date:
        today = datetime.fromisoformat(args.as_date)
    else:
        today = datetime.now()

    last_month_start, last_month_end = month_range(today)
    start_dt = datetime.combine(last_month_start.date(), datetime.min.time())
    end_dt = datetime.combine(last_month_end.date(), datetime.max.time())

    log_path = Path(args.log)
    if not log_path.exists():
        raise FileNotFoundError(f"Log não encontrado: {log_path}")

    stats = collect(log_path, start_dt, end_dt)
    report = build_report(stats, last_month_start, last_month_end)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    write_report(report, out_path)

    browser_out_path = Path(args.out_browser)
    browser_out_path.parent.mkdir(parents=True, exist_ok=True)
    write_browser_report(report, browser_out_path)

    print("OK: relatório gerado em", out_path)
    print("OK: relatório browser gerado em", browser_out_path)
    print("Período: {} até {}".format(start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")))
    print(f"Total requests: {stats['kpis']['totalRequests']}")
    print(f"Usuários únicos: {len(stats['kpis']['distinctUsers'])}")
    print(f"Ações produtivas: {stats['kpis']['productiveActions']} (economia: {stats['kpis']['totalEconomyMin']} min)")
