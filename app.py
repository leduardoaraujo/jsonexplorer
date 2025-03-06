import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import uvicorn
import re

os.makedirs("templates", exist_ok=True)
os.makedirs("static/css", exist_ok=True)
os.makedirs("static/js", exist_ok=True)

app = FastAPI(
    title="JSON Explorer API",
    description="API para converter JSON em Markdown e vice-versa",
    version="1.0.0",
    contact={
        "name": "Luiz Eduardo Gonçalves de Araujo",
        "email": "luiz.araujo@gavresorts.com.br",
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT",
    }
)
class MarkdownProcessor:
    def __init__(self):
        self.chunks = []
        self.current_path = []

    def add_chunk(self, content, metadata):
        chunk = {
            "content": content,
            "path": " > ".join(self.current_path) if self.current_path else "root",
            "metadata": metadata
        }
        self.chunks.append(chunk)
        return content

    def process_value(self, value):
        if isinstance(value, bool):
            return str(value).lower()
        if value is None:
            return "null"
        return str(value)
    def process_json(self, data, level=1):
        markdown_lines = []

        def handle_dict(d, current_level):
            for key, value in d.items():
                self.current_path.append(key)
                heading = "#" * current_level
                topic_line = f"{heading} {key}"
                markdown_lines.append(self.add_chunk(topic_line, {
                    "type": "heading",
                    "level": current_level,
                    "key": key
                }))
                if isinstance(value, dict):
                    handle_dict(value, current_level + 1)
                elif isinstance(value, list):
                    handle_list(value, current_level + 1)
                else:
                    value_line = f"  - {self.process_value(value)}"
                    markdown_lines.append(self.add_chunk(value_line, {
                        "type": "value",
                        "level": current_level,
                        "key": key,
                        "value_type": type(value).__name__
                    }))

                self.current_path.pop()

        def handle_list(lst, current_level):
            for idx, item in enumerate(lst):
                list_index = f"[{idx}]"
                self.current_path.append(list_index)
                
                if isinstance(item, dict):
                    heading = "#" * current_level
                    topic_line = f"{heading} Item {idx + 1}"
                    markdown_lines.append(self.add_chunk(topic_line, {
                        "type": "heading",
                        "level": current_level,
                        "key": f"item_{idx}"
                    }))
                    handle_dict(item, current_level + 1)
                else:
                    value_line = f"  - {self.process_value(item)}"
                    markdown_lines.append(self.add_chunk(value_line, {
                        "type": "list_item",
                        "level": current_level,
                        "index": idx
                    }))
                
                self.current_path.pop()

        if isinstance(data, dict):
            handle_dict(data, level)
        elif isinstance(data, list):
            handle_list(data, level)

        return "\n".join(markdown_lines)
@app.post("/convert/to-markdown",
          summary="Converter JSON para Markdown",
          description="Este endpoint recebe um objeto JSON, processa-o e o converte em uma representação em Markdown. A resposta inclui o conteúdo em Markdown e os 'chunks' que contêm informações adicionais sobre a conversão de cada item do JSON.",
          tags=["Conversão"],
          responses={
              200: {
                  "description": "Conversão realizada com sucesso",
                  "content": {
                      "application/json": {
                          "example": {
                              "markdown": "# Título\nDescrição do item.",
                              "chunks": [
                                  {"content": "Título", "path": "root > Título", "metadata": {}}
                              ]
                          }
                      }
                  }
              },
              400: {
                  "description": "Erro ao processar o JSON",
                  "content": {
                      "application/json": {
                          "example": {"detail": "Erro ao processar o JSON"}
                      }
                  }
              }
          })
async def convert_to_markdown(data: dict):
    """
    Converte um objeto JSON em Markdown.

    Este endpoint recebe um objeto JSON no corpo da requisição, converte-o em uma estrutura de Markdown e retorna esse conteúdo em Markdown junto com informações adicionais sobre os 'chunks'.
    
    **Exemplo de entrada:**
    ```json
    {
        "title": "Exemplo",
        "content": "Este é um exemplo de conteúdo."
    }
    ```

    **Exemplo de saída:**
    ```json
    {
        "markdown": "# Exemplo\nEste é um exemplo de conteúdo.",
        "chunks": [
            {"content": "Exemplo", "path": "root > Exemplo", "metadata": {}}
        ]
    }
    ```

    - O Markdown gerado será estruturado com base nas chaves e valores do JSON.
    - A resposta incluirá uma lista de "chunks", que são as informações sobre o conteúdo e a estrutura de cada item processado.

    - **Parâmetros de erro**:
      - **400 (Bad Request)**: Erro ao processar o JSON (por exemplo, estrutura inválida ou problemas internos).
    """
    try:
        processor = MarkdownProcessor()
        markdown = processor.process_json(data)
        
        return {
            "markdown": markdown,
            "chunks": processor.chunks
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


def markdown_to_json(markdown_text):
    result = {}
    current_section = result
    section_stack = []
    current_list = None
    
    lines = [line.strip() for line in markdown_text.split('\n') if line.strip()]
    
    for line in lines:
        if line.startswith('#'):
            header_level = len(line.split()[0])
            section_name = ' '.join(line.split()[1:])
            while len(section_stack) >= header_level:
                section_stack.pop()
            current_section = result
            for section in section_stack:
                current_section = current_section[section]
            
            current_section[section_name] = {}
            section_stack.append(section_name)
            current_section = current_section[section_name]
            current_list = None
        elif line.startswith('-'):
            content = line[1:].strip()
            if ': ' in content and '**' in content:
                key = content.split('**')[1].split('**')[0].strip()
                value = content.split(': ', 1)[1].strip()
                try:
                    if value.lower() == 'true':
                        value = True
                    elif value.lower() == 'false':
                        value = False
                    elif value.lower() == 'null':
                        value = None
                    else:
                        try:
                            value = int(value)
                        except ValueError:
                            try:
                                value = float(value)
                            except ValueError:
                                value = value.strip('"\'')
                except:
                    pass
                
                current_section[key] = value
            else:
                if current_list is None:
                    current_list = []
                    current_section = current_list
                current_list.append(content)
    
    return result

# @app.post("/convert/to-json")
# async def convert_to_json(markdown_input: dict):
#     try:
#         json_output = markdown_to_json(markdown_input["markdown"])
#         return json_output
#     except Exception as e:
#         raise HTTPException(status_code=400, detail=str(e))

if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")


if os.path.exists("templates"):
    templates = Jinja2Templates(directory="templates")
else:
    raise Exception("Diretório 'templates' não encontrado!")

# @app.get("/", response_class=HTMLResponse, include_in_schema=False)
# async def read_index(request: Request):
#     return templates.TemplateResponse("index.html", {"request": request})

# @app.get("/tojson", response_class=HTMLResponse, include_in_schema=False)
# async def read_tojson(request: Request):
#     template_path = os.path.join("templates", "tojson.html")
#     if not os.path.exists(template_path):
#         raise HTTPException(status_code=404, detail="Template tojson.html não encontrado")
#     return templates.TemplateResponse("tojson.html", {"request": request})

@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def read_tojson(request: Request):
    template_path = os.path.join("templates", "index.html")
    if not os.path.exists(template_path):
        raise HTTPException(status_code=404, detail="Template index.html não encontrado")
    return templates.TemplateResponse("index.html", {"request": request})

# @app.get("/markdown", response_class=HTMLResponse, include_in_schema=False)
# async def markdown_viewer(request: Request):
#     return templates.TemplateResponse("markdownviewer.html", {"request": request})

if __name__ == "__main__":
    print("\n🌎 JSON Explorer")
    print("Estrutura de diretórios criada/verificada")
    uvicorn.run(app, host="localhost", port=3333)