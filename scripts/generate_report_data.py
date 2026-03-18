import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
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

NAV_PATHS = {
    "/home",
    "/login",
    "/result.js",
    "/tabela/ips",
    "/js/sessionReminder.js",
    "/js/home.js",
    "/api/status/automations",
    "/api/work-session/active",
}

LOG_PATTERN = re.compile(
    r"^(?P<ip>\d+\.\d+\.\d+\.\d+) - - \[(?P<ts>[^\]]+)\] \"(?P<method>GET|POST|PUT|DELETE|PATCH|HEAD) (?P<path>[^ ]+) HTTP/[0-9.]+\" (?P<status>\d{3}) (?P<size>-|\d+)(?: -)?(?: user=(?P<user>[^ ]+))?",
    re.IGNORECASE,
)

RELATORIO_PATTERN = re.compile(
    r"^\[relatorio\]\[(?P<route>[^\]]+)\]\[(?P<result>[^\]]+)\](?:\s+(?P<meta>.*))?$",
    re.IGNORECASE,
)

KEY_VALUE_PATTERN = re.compile(r"(?P<key>[A-Za-z][A-Za-z0-9_]*)=(?P<value>\S+)")
DATE_FORMAT = "%d/%b/%Y %H:%M:%S"
DATE_ONLY_FORMAT = "%Y-%m-%d"
MAX_RANGE_DAYS = 90
CACHE_SCHEMA_VERSION = 2


def empty_stats():
    return {
        "kpis": {
            "totalRequests": 0,
            "distinctUsers": set(),
            "productiveActions": 0,
            "navigationActions": 0,
            "totalEconomyMin": 0,
            "pythonLogs": 0,
            "bridgeLogs": 0,
        },
        "statusDistribution": Counter(),
        "endpoints": defaultdict(
            lambda: {
                "frequency": 0,
                "economyMin": 0,
                "timePerCallMin": 0,
                "users": defaultdict(int),
            }
        ),
        "users": defaultdict(
            lambda: {
                "totalRequests": 0,
                "productiveActions": 0,
                "economyMin": 0,
                "endpoints": defaultdict(int),
            }
        ),
        "dailyActivity": Counter(),
        "relatorio": {
            "totalEvents": 0,
            "distinctUsers": set(),
            "actions": Counter(),
            "routes": Counter(),
            "results": Counter(),
            "dailyActivity": Counter(),
            "maxSyncVersion": 0,
            "users": defaultdict(
                lambda: {
                    "events": 0,
                    "actions": Counter(),
                    "results": Counter(),
                    "lastTickets": 0,
                    "maxTickets": 0,
                    "lastSyncVersion": 0,
                    "lastEventTs": "",
                }
            ),
        },
    }


def month_range(target_date):
    start_of_month = target_date.replace(day=1)
    last_month_end = start_of_month - timedelta(days=1)
    last_month_start = last_month_end.replace(day=1)
    return last_month_start.date(), last_month_end.date()


def parse_http_line(line):
    match = LOG_PATTERN.search(line)
    if not match:
        return None

    try:
        ts = datetime.strptime(match["ts"], DATE_FORMAT)
    except ValueError:
        return None

    path = match["path"]
    if "?" in path:
        path = path.split("?", 1)[0]

    return {
        "ts": ts,
        "user": match.group("user") or "",
        "method": match.group("method"),
        "path": path,
        "status": int(match.group("status")),
    }


def parse_relatorio_line(line):
    match = RELATORIO_PATTERN.search(line)
    if not match:
        return None

    meta = {}
    for item in KEY_VALUE_PATTERN.finditer(match.group("meta") or ""):
        meta[item.group("key")] = item.group("value")

    route = match.group("route").strip()
    route_method, _, route_path = route.partition(" ")

    return {
        "route": route,
        "routeMethod": route_method.upper(),
        "routePath": route_path.strip() or "",
        "result": (match.group("result") or "").upper(),
        "action": (meta.get("action") or "unknown").lower(),
        "user": (meta.get("user") or "").strip().lower(),
        "ticketId": meta.get("ticketId") or "",
        "tickets": int(meta["tickets"]) if meta.get("tickets", "").isdigit() else None,
        "syncVersion": int(meta["syncVersion"]) if meta.get("syncVersion", "").isdigit() else None,
    }


def normalize_path(path):
    if path.startswith("/api/"):
        return path.split("?", 1)[0]
    return path


def normalize_productive_request_key(method, path):
    if method != "POST":
        return None

    if path.startswith("/api/comandos-mkt/run"):
        return "POST /api/comandos-mkt/scan-super"
    if path.startswith("/api/4g/run"):
        return "POST /api/4g"

    candidate = f"{method} {path}"
    if candidate in PRODUCTIVE_ENDPOINTS:
        return candidate

    candidates = [key for key in PRODUCTIVE_ENDPOINTS if candidate.startswith(key)]
    if not candidates:
        return None

    return max(candidates, key=len)


def is_productive_request(method, path):
    if method != "POST":
        return False

    return normalize_productive_request_key(method, normalize_path(path)) is not None


def is_navigation_path(method, path):
    if path in NAV_PATHS:
        return True
    if path.startswith("/api/") and not is_productive_request(method, path):
        return False
    return path.startswith("/js/") or path.startswith("/tabela/") or path.startswith("/login")


def is_relatorio_http_request(parsed_http):
    return normalize_path(parsed_http["path"]).startswith("/api/relatorio")


def matches_relatorio_http_event(relatorio_event, parsed_http):
    if not is_relatorio_http_request(parsed_http):
        return False

    if relatorio_event["routeMethod"] != parsed_http["method"]:
        return False

    relatorio_user = relatorio_event["user"]
    http_user = (parsed_http["user"] or "").strip().lower()
    if relatorio_user and http_user and relatorio_user != http_user:
        return False

    normalized_http_path = normalize_path(parsed_http["path"])
    relatorio_path = relatorio_event["routePath"]

    if relatorio_path == "/tickets":
        return normalized_http_path == "/api/relatorio/tickets"

    if relatorio_path == "/tickets/:id":
        return normalized_http_path.startswith("/api/relatorio/tickets/")

    return normalized_http_path.startswith("/api/relatorio")


def should_track_user_endpoint(productive_key):
    return productive_key is not None


def to_date_key(ts):
    return ts.strftime(DATE_ONLY_FORMAT)


def get_day_stats(daily_stats, ts):
    key = to_date_key(ts)
    if key not in daily_stats:
        daily_stats[key] = empty_stats()
    return daily_stats[key]


def process_relatorio_event(stats, relatorio_event, event_ts):
    if event_ts is None:
        return

    relatorio_stats = stats["relatorio"]
    user = (relatorio_event["user"] or "").strip().lower()
    action = relatorio_event["action"] or "unknown"
    result = relatorio_event["result"] or "UNKNOWN"
    route = relatorio_event["route"] or "unknown"
    tickets = relatorio_event["tickets"]
    sync_version = relatorio_event["syncVersion"]
    event_key = to_date_key(event_ts)
    event_iso = event_ts.isoformat(timespec="seconds")

    relatorio_stats["totalEvents"] += 1
    relatorio_stats["actions"][action] += 1
    relatorio_stats["routes"][route] += 1
    relatorio_stats["results"][result] += 1
    relatorio_stats["dailyActivity"][event_key] += 1

    if sync_version is not None:
        relatorio_stats["maxSyncVersion"] = max(relatorio_stats["maxSyncVersion"], sync_version)

    if user:
        relatorio_stats["distinctUsers"].add(user)
        user_stats = relatorio_stats["users"][user]
        user_stats["events"] += 1
        user_stats["actions"][action] += 1
        user_stats["results"][result] += 1

        if tickets is not None:
            user_stats["maxTickets"] = max(user_stats["maxTickets"], tickets)
            if not user_stats["lastEventTs"] or event_iso >= user_stats["lastEventTs"]:
                user_stats["lastTickets"] = tickets

        if sync_version is not None:
            user_stats["lastSyncVersion"] = max(user_stats["lastSyncVersion"], sync_version)

        if not user_stats["lastEventTs"] or event_iso >= user_stats["lastEventTs"]:
            user_stats["lastEventTs"] = event_iso


def update_http_stats(stats, parsed_http):
    user = parsed_http["user"].strip().lower()
    is_guest = user == "guest" or not user

    stats["kpis"]["totalRequests"] += 1
    if not is_guest:
        stats["kpis"]["distinctUsers"].add(user)

    stats["statusDistribution"][str(parsed_http["status"])] += 1
    stats["dailyActivity"][to_date_key(parsed_http["ts"])] += 1

    normalized_path = normalize_path(parsed_http["path"])
    productive_key = normalize_productive_request_key(parsed_http["method"], normalized_path)
    is_prod = productive_key is not None
    is_nav = is_navigation_path(parsed_http["method"], parsed_http["path"])

    if is_prod and not is_guest:
        economy_min = PRODUCTIVE_ENDPOINTS.get(productive_key, 0)
        stats["kpis"]["productiveActions"] += 1
        stats["kpis"]["totalEconomyMin"] += economy_min

        endpoint_stats = stats["endpoints"][productive_key]
        endpoint_stats["frequency"] += 1
        endpoint_stats["economyMin"] += economy_min
        endpoint_stats["timePerCallMin"] = PRODUCTIVE_ENDPOINTS.get(productive_key, 0)
        endpoint_stats["users"][user] += 1

        user_stats = stats["users"][user]
        user_stats["productiveActions"] += 1
        user_stats["economyMin"] += economy_min
    elif is_nav:
        stats["kpis"]["navigationActions"] += 1

    if not is_guest:
        user_stats = stats["users"][user]
        user_stats["totalRequests"] += 1
        if should_track_user_endpoint(productive_key):
            user_stats["endpoints"][productive_key] += 1


def serialize_stats(stats):
    return {
        "kpis": {
            "totalRequests": stats["kpis"]["totalRequests"],
            "distinctUsers": sorted(stats["kpis"]["distinctUsers"]),
            "productiveActions": stats["kpis"]["productiveActions"],
            "navigationActions": stats["kpis"]["navigationActions"],
            "totalEconomyMin": stats["kpis"]["totalEconomyMin"],
            "pythonLogs": stats["kpis"].get("pythonLogs", 0),
            "bridgeLogs": stats["kpis"].get("bridgeLogs", 0),
        },
        "statusDistribution": dict(stats["statusDistribution"]),
        "endpoints": {
            endpoint: {
                "frequency": data["frequency"],
                "economyMin": data["economyMin"],
                "timePerCallMin": data["timePerCallMin"],
                "users": dict(data["users"]),
            }
            for endpoint, data in stats["endpoints"].items()
        },
        "users": {
            user: {
                "totalRequests": data["totalRequests"],
                "productiveActions": data["productiveActions"],
                "economyMin": data["economyMin"],
                "endpoints": dict(data["endpoints"]),
            }
            for user, data in stats["users"].items()
        },
        "dailyActivity": dict(stats["dailyActivity"]),
        "relatorio": {
            "totalEvents": stats["relatorio"]["totalEvents"],
            "distinctUsers": sorted(stats["relatorio"]["distinctUsers"]),
            "actions": dict(stats["relatorio"]["actions"]),
            "routes": dict(stats["relatorio"]["routes"]),
            "results": dict(stats["relatorio"]["results"]),
            "dailyActivity": dict(stats["relatorio"]["dailyActivity"]),
            "maxSyncVersion": stats["relatorio"]["maxSyncVersion"],
            "users": {
                user: {
                    "events": data["events"],
                    "actions": dict(data["actions"]),
                    "results": dict(data["results"]),
                    "lastTickets": data["lastTickets"],
                    "maxTickets": data["maxTickets"],
                    "lastSyncVersion": data["lastSyncVersion"],
                    "lastEventTs": data.get("lastEventTs", ""),
                }
                for user, data in stats["relatorio"]["users"].items()
            },
        },
    }


def deserialize_stats(payload):
    stats = empty_stats()

    kpis = payload.get("kpis", {})
    stats["kpis"]["totalRequests"] = int(kpis.get("totalRequests", 0))
    stats["kpis"]["distinctUsers"].update(kpis.get("distinctUsers", []))
    stats["kpis"]["productiveActions"] = int(kpis.get("productiveActions", 0))
    stats["kpis"]["navigationActions"] = int(kpis.get("navigationActions", 0))
    stats["kpis"]["totalEconomyMin"] = int(kpis.get("totalEconomyMin", 0))
    stats["kpis"]["pythonLogs"] = int(kpis.get("pythonLogs", 0))
    stats["kpis"]["bridgeLogs"] = int(kpis.get("bridgeLogs", 0))

    for status, count in payload.get("statusDistribution", {}).items():
        stats["statusDistribution"][status] += int(count)

    for endpoint, data in payload.get("endpoints", {}).items():
        endpoint_stats = stats["endpoints"][endpoint]
        endpoint_stats["frequency"] += int(data.get("frequency", 0))
        endpoint_stats["economyMin"] += int(data.get("economyMin", 0))
        endpoint_stats["timePerCallMin"] = max(
            endpoint_stats["timePerCallMin"],
            int(data.get("timePerCallMin", 0)),
        )
        for user, count in data.get("users", {}).items():
            endpoint_stats["users"][user] += int(count)

    for user, data in payload.get("users", {}).items():
        user_stats = stats["users"][user]
        user_stats["totalRequests"] += int(data.get("totalRequests", 0))
        user_stats["productiveActions"] += int(data.get("productiveActions", 0))
        user_stats["economyMin"] += int(data.get("economyMin", 0))
        for endpoint, count in data.get("endpoints", {}).items():
            user_stats["endpoints"][endpoint] += int(count)

    for day, count in payload.get("dailyActivity", {}).items():
        stats["dailyActivity"][day] += int(count)

    relatorio_payload = payload.get("relatorio", {})
    stats["relatorio"]["totalEvents"] = int(relatorio_payload.get("totalEvents", 0))
    stats["relatorio"]["distinctUsers"].update(relatorio_payload.get("distinctUsers", []))
    stats["relatorio"]["maxSyncVersion"] = int(relatorio_payload.get("maxSyncVersion", 0))

    for action, count in relatorio_payload.get("actions", {}).items():
        stats["relatorio"]["actions"][action] += int(count)
    for route, count in relatorio_payload.get("routes", {}).items():
        stats["relatorio"]["routes"][route] += int(count)
    for result, count in relatorio_payload.get("results", {}).items():
        stats["relatorio"]["results"][result] += int(count)
    for day, count in relatorio_payload.get("dailyActivity", {}).items():
        stats["relatorio"]["dailyActivity"][day] += int(count)

    for user, data in relatorio_payload.get("users", {}).items():
        user_stats = stats["relatorio"]["users"][user]
        user_stats["events"] += int(data.get("events", 0))
        for action, count in data.get("actions", {}).items():
            user_stats["actions"][action] += int(count)
        for result, count in data.get("results", {}).items():
            user_stats["results"][result] += int(count)
        user_stats["maxTickets"] = max(user_stats["maxTickets"], int(data.get("maxTickets", 0)))
        user_stats["lastSyncVersion"] = max(
            user_stats["lastSyncVersion"],
            int(data.get("lastSyncVersion", 0)),
        )
        incoming_last_event = data.get("lastEventTs", "") or ""
        if incoming_last_event and incoming_last_event >= user_stats["lastEventTs"]:
            user_stats["lastEventTs"] = incoming_last_event
            user_stats["lastTickets"] = int(data.get("lastTickets", 0))

    return stats


def merge_stats(target, source):
    target["kpis"]["totalRequests"] += source["kpis"]["totalRequests"]
    target["kpis"]["distinctUsers"].update(source["kpis"]["distinctUsers"])
    target["kpis"]["productiveActions"] += source["kpis"]["productiveActions"]
    target["kpis"]["navigationActions"] += source["kpis"]["navigationActions"]
    target["kpis"]["totalEconomyMin"] += source["kpis"]["totalEconomyMin"]
    target["kpis"]["pythonLogs"] += source["kpis"].get("pythonLogs", 0)
    target["kpis"]["bridgeLogs"] += source["kpis"].get("bridgeLogs", 0)

    target["statusDistribution"].update(source["statusDistribution"])
    target["dailyActivity"].update(source["dailyActivity"])

    for endpoint, data in source["endpoints"].items():
        endpoint_stats = target["endpoints"][endpoint]
        endpoint_stats["frequency"] += data["frequency"]
        endpoint_stats["economyMin"] += data["economyMin"]
        endpoint_stats["timePerCallMin"] = max(endpoint_stats["timePerCallMin"], data["timePerCallMin"])
        for user, count in data["users"].items():
            endpoint_stats["users"][user] += count

    for user, data in source["users"].items():
        user_stats = target["users"][user]
        user_stats["totalRequests"] += data["totalRequests"]
        user_stats["productiveActions"] += data["productiveActions"]
        user_stats["economyMin"] += data["economyMin"]
        for endpoint, count in data["endpoints"].items():
            user_stats["endpoints"][endpoint] += count

    target["relatorio"]["totalEvents"] += source["relatorio"]["totalEvents"]
    target["relatorio"]["distinctUsers"].update(source["relatorio"]["distinctUsers"])
    target["relatorio"]["actions"].update(source["relatorio"]["actions"])
    target["relatorio"]["routes"].update(source["relatorio"]["routes"])
    target["relatorio"]["results"].update(source["relatorio"]["results"])
    target["relatorio"]["dailyActivity"].update(source["relatorio"]["dailyActivity"])
    target["relatorio"]["maxSyncVersion"] = max(
        target["relatorio"]["maxSyncVersion"],
        source["relatorio"]["maxSyncVersion"],
    )

    for user, data in source["relatorio"]["users"].items():
        user_stats = target["relatorio"]["users"][user]
        user_stats["events"] += data["events"]
        user_stats["actions"].update(data["actions"])
        user_stats["results"].update(data["results"])
        user_stats["maxTickets"] = max(user_stats["maxTickets"], data["maxTickets"])
        user_stats["lastSyncVersion"] = max(user_stats["lastSyncVersion"], data["lastSyncVersion"])
        incoming_last_event = data.get("lastEventTs", "") or ""
        if incoming_last_event and incoming_last_event >= user_stats["lastEventTs"]:
            user_stats["lastEventTs"] = incoming_last_event
            user_stats["lastTickets"] = data["lastTickets"]


def build_report(stats, start_dt, end_dt, log_path, max_range_days, cache_meta):
    economy_total_min = stats["kpis"]["totalEconomyMin"]

    user_activity = []
    user_productivity = []

    for user, info in stats["users"].items():
        if info["productiveActions"] <= 0:
            continue

        top_endpoints = sorted(info["endpoints"].items(), key=lambda item: -item[1])[:5]
        user_activity.append(
            {
                "user": user,
                "totalRequests": info["totalRequests"],
                "economyHours": round(info["economyMin"] / 60, 2),
                "topEndpoints": [{"endpoint": endpoint, "requests": count} for endpoint, count in top_endpoints],
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

    endpoint_economy = []
    for endpoint, endpoint_stats in stats["endpoints"].items():
        if endpoint_stats["frequency"] <= 0:
            continue

        endpoint_users = sorted(
            endpoint_stats["users"].items(),
            key=lambda item: (-item[1], item[0]),
        )
        endpoint_economy.append(
            {
                "endpoint": endpoint,
                "frequency": endpoint_stats["frequency"],
                "economyMin": endpoint_stats["economyMin"],
                "economyHours": round(endpoint_stats["economyMin"] / 60, 2),
                "timePerCallMin": endpoint_stats["timePerCallMin"],
                "distinctUsers": len(endpoint_stats["users"]),
                "users": [
                    {"user": user, "requests": count}
                    for user, count in endpoint_users[:5]
                ],
            }
        )

    endpoint_economy = sorted(endpoint_economy, key=lambda item: -item["economyHours"])

    relatorio_users = []
    for user, info in stats["relatorio"]["users"].items():
        relatorio_users.append(
            {
                "user": user,
                "events": info["events"],
                "creates": info["actions"].get("create", 0),
                "updates": info["actions"].get("update", 0),
                "deletes": info["actions"].get("delete", 0),
                "results": dict(info["results"]),
                "lastTickets": info["lastTickets"],
                "maxTickets": info["maxTickets"],
                "lastSyncVersion": info["lastSyncVersion"],
                "lastEventTs": info.get("lastEventTs", ""),
            }
        )

    relatorio_actions = [
        {"action": action, "count": count}
        for action, count in sorted(stats["relatorio"]["actions"].items(), key=lambda item: -item[1])
    ]

    relatorio_routes = [
        {"route": route, "count": count}
        for route, count in sorted(stats["relatorio"]["routes"].items(), key=lambda item: -item[1])
    ]

    total_days = (end_dt.date() - start_dt.date()).days + 1

    return {
        "meta": {
            "from": start_dt.date().isoformat(),
            "to": end_dt.date().isoformat(),
            "days": total_days,
            "maxIntervalDays": max_range_days,
            "generatedAt": datetime.now().isoformat(timespec="seconds"),
            "sourceLog": str(log_path),
            "aggregationMode": "daily-cache-sum",
            "cacheHits": cache_meta["hits"],
            "cacheMisses": cache_meta["misses"],
            "cacheDir": cache_meta["cacheDir"],
        },
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
        "userActivityEndpoints": sorted(user_activity, key=lambda item: -item["totalRequests"])[:5],
        "userProductivity": sorted(user_productivity, key=lambda item: -item["productiveActions"])[:10],
        "productiveEndpoints": endpoint_economy,
        "dailyActivity": [
            {"date": day, "requests": stats["dailyActivity"][day]}
            for day in sorted(stats["dailyActivity"])
        ],
        "relatorioSummary": {
            "totalEvents": stats["relatorio"]["totalEvents"],
            "distinctUsers": len(stats["relatorio"]["distinctUsers"]),
            "results": dict(stats["relatorio"]["results"]),
            "actions": dict(stats["relatorio"]["actions"]),
            "routes": dict(stats["relatorio"]["routes"]),
            "maxSyncVersion": stats["relatorio"]["maxSyncVersion"],
        },
        "relatorioUsers": sorted(relatorio_users, key=lambda item: -item["events"])[:10],
        "relatorioActions": relatorio_actions,
        "relatorioRoutes": relatorio_routes,
        "relatorioDailyActivity": [
            {"date": day, "events": stats["relatorio"]["dailyActivity"][day]}
            for day in sorted(stats["relatorio"]["dailyActivity"])
        ],
    }


def collect_daily_stats(log_path: Path, start_dt: datetime, end_dt: datetime):
    daily_stats = {}
    last_http_ts = None
    pending_relatorio_events = []

    with log_path.open("r", encoding="utf-8", errors="replace") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line:
                continue

            relatorio_event = parse_relatorio_line(line)
            if relatorio_event is not None:
                pending_relatorio_events.append(
                    {
                        "event": relatorio_event,
                        "fallbackTs": last_http_ts,
                    }
                )
                continue

            parsed_http = parse_http_line(line)
            if parsed_http is None:
                continue

            last_http_ts = parsed_http["ts"]

            if pending_relatorio_events:
                remaining_relatorio_events = []
                matched_current_http = False

                for pending in pending_relatorio_events:
                    event = pending["event"]
                    if not matched_current_http and matches_relatorio_http_event(event, parsed_http):
                        if start_dt <= parsed_http["ts"] <= end_dt:
                            process_relatorio_event(
                                get_day_stats(daily_stats, parsed_http["ts"]),
                                event,
                                parsed_http["ts"],
                            )
                        matched_current_http = True
                        continue

                    fallback_ts = pending["fallbackTs"]
                    if fallback_ts is not None and fallback_ts < start_dt:
                        continue

                    remaining_relatorio_events.append(pending)

                pending_relatorio_events = remaining_relatorio_events

            if not (start_dt <= parsed_http["ts"] <= end_dt):
                continue

            if is_relatorio_http_request(parsed_http):
                continue

            update_http_stats(get_day_stats(daily_stats, parsed_http["ts"]), parsed_http)

    for pending in pending_relatorio_events:
        fallback_ts = pending["fallbackTs"]
        if fallback_ts is None:
            continue
        if start_dt <= fallback_ts <= end_dt:
            process_relatorio_event(
                get_day_stats(daily_stats, fallback_ts),
                pending["event"],
                fallback_ts,
            )

    return daily_stats


def iter_days(start_day: date, end_day: date):
    current_day = start_day
    while current_day <= end_day:
        yield current_day
        current_day += timedelta(days=1)


def group_consecutive_days(days):
    if not days:
        return []

    ordered_days = sorted(days)
    groups = []
    group_start = ordered_days[0]
    previous_day = ordered_days[0]

    for current_day in ordered_days[1:]:
        if current_day == previous_day + timedelta(days=1):
            previous_day = current_day
            continue

        groups.append((group_start, previous_day))
        group_start = current_day
        previous_day = current_day

    groups.append((group_start, previous_day))
    return groups


def cache_file_for_day(cache_dir: Path, day: date):
    return cache_dir / f"{day.isoformat()}.json"


def should_refresh_cache(cache_path: Path, day: date, today: date, log_mtime_ns: int):
    if not cache_path.exists():
        return True

    try:
        payload = json.loads(cache_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return True

    if int(payload.get("schemaVersion", 0)) != CACHE_SCHEMA_VERSION:
        return True

    if day == today:
        return int(payload.get("sourceLogMtimeNs", 0)) != int(log_mtime_ns)

    return False


def load_cached_day(cache_path: Path):
    payload = json.loads(cache_path.read_text(encoding="utf-8"))
    return deserialize_stats(payload.get("stats", {}))


def write_cached_day(cache_dir: Path, day: date, stats, log_path: Path, log_mtime_ns: int):
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file = cache_file_for_day(cache_dir, day)
    payload = {
        "schemaVersion": CACHE_SCHEMA_VERSION,
        "date": day.isoformat(),
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "sourceLog": str(log_path),
        "sourceLogMtimeNs": int(log_mtime_ns),
        "stats": serialize_stats(stats),
    }
    cache_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def collect_with_daily_cache(log_path: Path, start_dt: datetime, end_dt: datetime, cache_dir: Path):
    log_mtime_ns = log_path.stat().st_mtime_ns
    today = datetime.now().date()
    daily_stats = {}
    cache_hits = 0
    cache_misses = 0
    missing_days = []

    for current_day in iter_days(start_dt.date(), end_dt.date()):
        cache_path = cache_file_for_day(cache_dir, current_day)
        if should_refresh_cache(cache_path, current_day, today, log_mtime_ns):
            missing_days.append(current_day)
            continue

        daily_stats[current_day.isoformat()] = load_cached_day(cache_path)
        cache_hits += 1

    for group_start, group_end in group_consecutive_days(missing_days):
        generated_days = collect_daily_stats(
            log_path,
            datetime.combine(group_start, datetime.min.time()),
            datetime.combine(group_end, datetime.max.time()),
        )

        for current_day in iter_days(group_start, group_end):
            day_key = current_day.isoformat()
            day_stats = generated_days.get(day_key, empty_stats())
            daily_stats[day_key] = day_stats
            write_cached_day(cache_dir, current_day, day_stats, log_path, log_mtime_ns)
            cache_misses += 1

    aggregate_stats = empty_stats()
    for day_key in sorted(daily_stats):
        merge_stats(aggregate_stats, daily_stats[day_key])

    return aggregate_stats, {
        "hits": cache_hits,
        "misses": cache_misses,
        "cacheDir": str(cache_dir),
    }


def write_report(report, output_path: Path, export_name="reportData"):
    content = f"export const {export_name} = " + json.dumps(report, ensure_ascii=False, indent=2) + ";\n"
    output_path.write_text(content, encoding="utf-8")


def write_browser_report(report, output_path: Path, global_name="reportData"):
    content = f"window.{global_name} = " + json.dumps(report, ensure_ascii=False, indent=2) + ";\n"
    output_path.write_text(content, encoding="utf-8")


def parse_iso_date(raw_value, field_name):
    try:
        return date.fromisoformat(raw_value)
    except ValueError as error:
        raise ValueError(f"Parametro '{field_name}' invalido. Use YYYY-MM-DD.") from error


def resolve_range(args):
    if args.from_date or args.to_date:
        if not args.from_date or not args.to_date:
            raise ValueError("Informe 'from' e 'to' juntos.")
        start_day = parse_iso_date(args.from_date, "from")
        end_day = parse_iso_date(args.to_date, "to")
    else:
        reference_day = parse_iso_date(args.as_date, "as-date") if args.as_date else datetime.now().date()
        start_day, end_day = month_range(datetime.combine(reference_day, datetime.min.time()))

    if start_day > end_day:
        raise ValueError("O inicio do periodo nao pode ser maior que o fim.")

    today = datetime.now().date()
    if start_day > today or end_day > today:
        raise ValueError("Nao e permitido solicitar datas futuras.")

    total_days = (end_day - start_day).days + 1
    if total_days > args.max_days:
        raise ValueError(f"O intervalo maximo permitido e de {args.max_days} dias.")

    return (
        datetime.combine(start_day, datetime.min.time()),
        datetime.combine(end_day, datetime.max.time()),
    )


def main():
    project_root = Path(__file__).resolve().parents[1]
    default_log_path = Path.home() / ".pm2" / "logs" / "hub-out.log"
    default_out_path = project_root / "reportData.ts"
    default_browser_out_path = project_root / "public" / "reportData.js"
    default_cache_dir = project_root / "data" / "hub-insights-daily"

    parser = argparse.ArgumentParser(description="Gera o reportData a partir dos logs do HUB.")
    parser.add_argument("--log", default=str(default_log_path), help="Caminho do arquivo de log")
    parser.add_argument("--out", default=str(default_out_path), help="Arquivo TS de saida")
    parser.add_argument("--out-browser", default=str(default_browser_out_path), help="Arquivo JS para browser")
    parser.add_argument("--as-date", default=None, help="Data de referencia (YYYY-MM-DD) para gerar o mes anterior")
    parser.add_argument("--from", dest="from_date", default=None, help="Data inicial (YYYY-MM-DD)")
    parser.add_argument("--to", dest="to_date", default=None, help="Data final (YYYY-MM-DD)")
    parser.add_argument("--cache-dir", default=str(default_cache_dir), help="Diretorio do cache diario")
    parser.add_argument("--max-days", type=int, default=MAX_RANGE_DAYS, help="Intervalo maximo permitido")
    parser.add_argument("--stdout-json", action="store_true", help="Escreve o relatorio em JSON no stdout")
    args = parser.parse_args()

    try:
        start_dt, end_dt = resolve_range(args)
    except ValueError as error:
        parser.error(str(error))

    log_path = Path(args.log)
    if not log_path.exists():
        raise FileNotFoundError(f"Log nao encontrado: {log_path}")

    cache_dir = Path(args.cache_dir)
    stats, cache_meta = collect_with_daily_cache(log_path, start_dt, end_dt, cache_dir)
    report = build_report(stats, start_dt, end_dt, log_path, args.max_days, cache_meta)

    if args.stdout_json:
        sys.stdout.write(json.dumps(report, ensure_ascii=False))
        return

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    write_report(report, out_path)

    browser_out_path = Path(args.out_browser)
    browser_out_path.parent.mkdir(parents=True, exist_ok=True)
    write_browser_report(report, browser_out_path)

    print("OK: relatorio gerado em", out_path)
    print("OK: relatorio browser gerado em", browser_out_path)
    print("Periodo: {} ate {}".format(start_dt.strftime(DATE_ONLY_FORMAT), end_dt.strftime(DATE_ONLY_FORMAT)))
    print(f"Cache diario: {cache_meta['hits']} hits / {cache_meta['misses']} misses")
    print(f"Total requests: {stats['kpis']['totalRequests']}")
    print(f"Usuarios unicos: {len(stats['kpis']['distinctUsers'])}")
    print(
        "Acoes produtivas: {} (economia: {} min)".format(
            stats["kpis"]["productiveActions"],
            stats["kpis"]["totalEconomyMin"],
        )
    )


if __name__ == "__main__":
    main()
