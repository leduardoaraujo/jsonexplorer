import json
import random
import string
from faker import Faker
import fastapi as FastAPI

def gerar_nome():
    fake = Faker("pt_BR")
    return fake.name()

def gerar_email(nome):
    return nome.lower().replace(" ", ".") + "@example.com"

def gerar_endereco():
    fake = Faker("pt_BR")
    return {
        "rua": fake.street_name(),
        "numero": random.randint(1, 9999),
        "cidade": fake.city(),
        "estado": fake.state_abbr(),
        "cep": fake.postcode()
    }

def gerar_pedidos():
    pedidos = []
    for _ in range(random.randint(1, 3)):
        itens = [
            {
                "produto": random.choice(["Café", "Açúcar", "Leite", "Pão", "Queijo"]),
                "quantidade": random.randint(1, 5),
                "preco_unitario": round(random.uniform(3, 20), 2)
            }
            for _ in range(random.randint(1, 3))
        ]
        valor_total = sum(item["quantidade"] * item["preco_unitario"] for item in itens)
        pedidos.append({
            "id_pedido": random.randint(100, 999),
            "data": Faker().date_this_year().isoformat(),
            "status": random.choice(["Entregue", "Em processamento", "Cancelado"]),
            "itens": itens,
            "valor_total": round(valor_total, 2)
        })
    return pedidos

def gerar_dados(qtd_linhas):
    dados = []
    for i in range(qtd_linhas):
        nome = gerar_nome()
        item = {
            "usuario": {
                "id": i + 1,
                "nome": nome,
                "email": gerar_email(nome),
                "endereco": gerar_endereco(),
                "pedidos": gerar_pedidos()
            }
        }
        dados.append(item)
    return dados

def salvar_json(dados, nome_arquivo="dados.json"):
    with open(nome_arquivo, "w", encoding="utf-8") as f:
        json.dump(dados, f, indent=4, ensure_ascii=False)
    print(f"Arquivo {nome_arquivo} gerado com sucesso!")

if __name__ == "__main__":
    qtd = int(input("Quantas linhas deseja gerar? "))
    dados = gerar_dados(qtd)
    salvar_json(dados)