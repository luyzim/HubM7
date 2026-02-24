

def _placeholders_de(path: Path) -> list[str]:
    md = path.read_text(encoding="utf-8")
    return sorted(set(re.findall(r"{([^}]+)}", md)))