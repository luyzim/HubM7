from scripts.generate_report_data import parse_http_line
line='172.19.5.20 - - [11/Mar/2026 09:49:19] "POST /api/mkt HTTP/1.1" 200 15301 - user=deiver@microset.com user-agent=Mozilla/5.0'
print(parse_http_line(line))
