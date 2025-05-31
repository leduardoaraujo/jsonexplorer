
# 🧭 JSON Explorer

Uma aplicação web simples e interativa para explorar arquivos JSON. Ideal para desenvolvedores, analistas e entusiastas que lidam com estruturas JSON complexas e precisam de uma forma mais intuitiva de visualizá-las.

## 📌 Descrição

O **JSON Explorer** permite carregar arquivos JSON e navegar por suas estruturas com facilidade. A ferramenta exibe o conteúdo de forma organizada e oferece uma navegação dinâmica por objetos e arrays aninhados.

## 🚀 Funcionalidades

- Upload e visualização de arquivos JSON
- Interface interativa com expansão e recolhimento de nós
- Visualização clara de objetos e arrays
- Carregamento de exemplo via `dados.json`

## 📁 Estrutura do Projeto

```
jsonexplorer/
├── app.py                 # Aplicação principal Flask
├── json_generator.py      # Script para gerar JSON de exemplo
├── dados.json             # Exemplo de JSON
├── requirements.txt       # Dependências do projeto
├── static/                # Arquivos estáticos (CSS, JS)
└── templates/             # Templates HTML (Jinja2)
```

## 🛠 Tecnologias Utilizadas

- Python 3
- Flask
- HTML, CSS, JavaScript

## 🖥️ Como Rodar Localmente

1. Clone o repositório:
   ```bash
   git clone https://github.com/leduardoaraujo/jsonexplorer.git
   cd jsonexplorer
   ```

2. (Opcional) Crie um ambiente virtual:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```

3. Instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```

4. Execute o app:
   ```bash
   python app.py
   ```

5. Acesse via navegador:
   ```
   http://localhost:5000
   ```

## 🤝 Contribuições

Contribuições são bem-vindas! Sinta-se livre para abrir issues, criar pull requests ou sugerir melhorias.

## 📄 Licença

Distribuído sob a licença MIT. Veja `LICENSE` para mais informações.

---

Feito com 💻 por [@leduardoaraujo](https://github.com/leduardoaraujo)
