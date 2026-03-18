import argparse
from datetime import date, datetime, timedelta
from pathlib import Path

from generate_report_data import (
    MAX_RANGE_DAYS,
    build_report,
    collect_with_daily_cache,
)


def format_iso_day(value: date):
    return value.isoformat()


def parse_iso_date(raw_value, field_name):
    try:
        return date.fromisoformat(raw_value)
    except ValueError as error:
        raise ValueError(f"Parametro '{field_name}' invalido. Use YYYY-MM-DD.") from error


def resolve_range(args):
    today = datetime.now().date()

    if args.from_date or args.to_date:
        if not args.from_date or not args.to_date:
            raise ValueError("Informe --from e --to juntos.")

        start_day = parse_iso_date(args.from_date, "from")
        end_day = parse_iso_date(args.to_date, "to")
    else:
        days = max(1, args.days)
        start_day = today - timedelta(days=days - 1)
        end_day = today

    if start_day > end_day:
        raise ValueError("A data inicial nao pode ser maior que a final.")

    if start_day > today or end_day > today:
        raise ValueError("Nao e permitido solicitar datas futuras.")

    total_days = (end_day - start_day).days + 1
    if total_days > MAX_RANGE_DAYS:
        raise ValueError(f"O intervalo maximo permitido e de {MAX_RANGE_DAYS} dias.")

    return (
        datetime.combine(start_day, datetime.min.time()),
        datetime.combine(end_day, datetime.max.time()),
    )


def resolve_default_log_path():
    candidates = [
        Path.home() / "OneDrive" / "Documentos" / "Logs" / "Hub" / "Log Geral.txt",
        Path.home() / "OneDrive" / "Documentos" / "Logs" / "Hub" / "LogGeral.txt",
        Path.home() / ".pm2" / "logs" / "hub-out.log",
    ]

    for candidate in candidates:
        if candidate.exists():
            return candidate

    return candidates[0]


def main():
    project_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="Aquece o cache diario de insights do HUB.")
    parser.add_argument("--log", default=str(resolve_default_log_path()), help="Caminho do arquivo de log")
    parser.add_argument("--cache-dir", default=str(project_root / "data" / "hub-insights-daily"), help="Diretorio do cache diario")
    parser.add_argument("--days", type=int, default=1, help="Quantidade de dias retroativos para aquecer")
    parser.add_argument("--from", dest="from_date", default=None, help="Data inicial (YYYY-MM-DD)")
    parser.add_argument("--to", dest="to_date", default=None, help="Data final (YYYY-MM-DD)")
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
    report = build_report(stats, start_dt, end_dt, log_path, MAX_RANGE_DAYS, cache_meta)

    print(f"Cache HUB aquecido para {format_iso_day(start_dt.date())} ate {format_iso_day(end_dt.date())}.")
    print(f"Cache diario: {cache_meta['hits']} hit(s) / {cache_meta['misses']} miss(es).")
    print(f"Total requests no intervalo: {report['kpis']['totalRequests']}.")


if __name__ == "__main__":
    main()
