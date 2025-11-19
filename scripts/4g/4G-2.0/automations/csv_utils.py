import csv

from normalizacao import normalizar
def ler_csv_com_normalizacao(ips_RoyalFic):
    dados = []
    with open(ips_RoyalFic, newline='', encoding='utf-8') as csvfile:
        leitor = csv.DictReader(csvfile)
        for row in leitor:
            row['unidade_normalizada'] = normalizar(row['unidade'])
            dados.append(row)
    return dados

def buscar_ip_lan(lista_dados, nome_unidade):
    nome_normalizado = normalizar(nome_unidade)
    unidades_filtradas = [row for row in lista_dados if row['unidade_normalizada'] == nome_normalizado]

    if not unidades_filtradas:
        unidades_filtradas = [row for row in lista_dados if nome_normalizado in row['unidade_normalizada']]

    if unidades_filtradas:
        if len(unidades_filtradas) > 1:
            print(f"\nMúltiplas unidades encontradas para '{nome_unidade}':")
            for count, row in enumerate(unidades_filtradas, start=1):
                print(f"{count}. {row['unidade']} - IP: {row['ip_lan']}")
            while True:
                try:
                    escolha = int(input("\nSelecione o número da unidade desejada (0 para ignorar): "))
                    if escolha == 0:
                        return "Seleção ignorada pelo usuário"
                    elif 1 <= escolha <= len(unidades_filtradas):
                        unidade_escolhida = unidades_filtradas[escolha - 1]
                        print(f"Unidade selecionada: {unidade_escolhida['unidade']}")
                        return unidade_escolhida['ip_lan']
                except ValueError:
                    print("Por favor, digite um número válido.")
        return unidades_filtradas[0]['ip_lan']
    else:
        return "Não encontrado"






