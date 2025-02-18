import os
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import uvicorn

os.makedirs("templates", exist_ok=True)
os.makedirs("static/css", exist_ok=True)
os.makedirs("static/js", exist_ok=True)

app = FastAPI()


if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")


if os.path.exists("templates"):
    templates = Jinja2Templates(directory="templates")
else:
    raise Exception("Diretório 'templates' não encontrado!")

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

if __name__ == "__main__":
    print("\n🌎 JSON Explorer")
    print("Estrutura de diretórios criada/verificada")
    uvicorn.run(app, host="localhost", port=8000)