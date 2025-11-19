import unicodedata
import re

def normalizar(texto):
    if not isinstance(texto, str):
        return texto
    texto = unicodedata.normalize("NFKD", texto).encode("ASCII", "ignore").decode("ASCII")
    texto = texto.lower()
    texto = re.sub(r'\s+', ' ', texto).strip()
    return texto
