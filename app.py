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

app = FastAPI()

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
                
                # Adiciona o heading do tópico
                heading = "#" * current_level
                topic_line = f"{heading} {key}"
                markdown_lines.append(self.add_chunk(topic_line, {
                    "type": "heading",
                    "level": current_level,
                    "key": key
                }))

                # Processa o valor
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

@app.post("/convert/to-markdown")
async def convert_to_markdown(data: dict):
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
        # Detecta nível do cabeçalho
        if line.startswith('#'):
            header_level = len(line.split()[0])
            section_name = ' '.join(line.split()[1:])
            
            # Ajusta a pilha de seções baseado no nível
            while len(section_stack) >= header_level:
                section_stack.pop()
            
            # Cria nova seção
            current_section = result
            for section in section_stack:
                current_section = current_section[section]
            
            current_section[section_name] = {}
            section_stack.append(section_name)
            current_section = current_section[section_name]
            current_list = None
            
        # Processa itens de lista
        elif line.startswith('-'):
            content = line[1:].strip()
            
            # Verifica se é um par chave-valor
            if ': ' in content and '**' in content:
                key = content.split('**')[1].split('**')[0].strip()
                value = content.split(': ', 1)[1].strip()
                
                # Tenta converter para tipo apropriado
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
                                # Remove aspas se presente
                                value = value.strip('"\'')
                except:
                    pass
                
                current_section[key] = value
            else:
                # Item de lista simples
                if current_list is None:
                    current_list = []
                    current_section = current_list
                current_list.append(content)
    
    return result

@app.post("/convert/to-json")
async def convert_to_json(markdown_input: dict):
    try:
        json_output = markdown_to_json(markdown_input["markdown"])
        return json_output
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")


if os.path.exists("templates"):
    templates = Jinja2Templates(directory="templates")
else:
    raise Exception("Diretório 'templates' não encontrado!")

@app.get("/", response_class=HTMLResponse)
async def read_index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/tojson", response_class=HTMLResponse)
async def read_tojson(request: Request):
    # Verifica se o template existe
    template_path = os.path.join("templates", "tojson.html")
    if not os.path.exists(template_path):
        raise HTTPException(status_code=404, detail="Template tojson.html não encontrado")
    return templates.TemplateResponse("tojson.html", {"request": request})

@app.get("/jsonexplorer", response_class=HTMLResponse)
async def read_tojson(request: Request):
    # Verifica se o template existe
    template_path = os.path.join("templates", "jsonexplorer.html")
    if not os.path.exists(template_path):
        raise HTTPException(status_code=404, detail="Template tojson.html não encontrado")
    return templates.TemplateResponse("jsonexplorer.html", {"request": request})

@app.get("/markdown", response_class=HTMLResponse)
async def markdown_viewer(request: Request):
    return templates.TemplateResponse("markdownviewer.html", {"request": request})

if __name__ == "__main__":
    print("\n🌎 JSON Explorer")
    print("Estrutura de diretórios criada/verificada")
    uvicorn.run(app, host="localhost", port=8000)