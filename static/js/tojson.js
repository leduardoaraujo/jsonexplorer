document.addEventListener('DOMContentLoaded', function() {
    // Configurar editores
    window.jsonEditor = ace.edit("jsonEditor", {
        theme: "ace/theme/pastel_on_dark",
        mode: "ace/mode/json",
        fontSize: 14,
        showPrintMargin: false,
        showGutter: true,
        highlightActiveLine: true,
        wrap: true
    });

    window.markdownEditor = ace.edit("markdownEditor", {
        theme: "ace/theme/pastel_on_dark",
        mode: "ace/mode/markdown",
        fontSize: 14,
        showPrintMargin: false,
        showGutter: true,
        highlightActiveLine: true,
        wrap: true,
        readOnly: true
    });

    // Exemplo inicial
    jsonEditor.setValue(JSON.stringify({
        "titulo": "Bem-vindo ao Conversor",
        "descrição": "Cole seu JSON aqui para converter"
    }, null, 2));

    // Ajuste automático de tamanho
    window.addEventListener('resize', () => {
        jsonEditor.resize();
        markdownEditor.resize();
    });
});

function showNotification(message, isError = false) {
    const errorDiv = document.getElementById('jsonError');
    const successDiv = document.getElementById('jsonSuccess');
    
    errorDiv.style.display = isError ? 'block' : 'none';
    successDiv.style.display = isError ? 'none' : 'block';
    (isError ? errorDiv : successDiv).textContent = message;
}

function formatJson() {
    try {
        const jsonStr = jsonEditor.getValue();
        const formatted = JSON.stringify(JSON.parse(jsonStr), null, 2);
        jsonEditor.setValue(formatted, -1);
        showNotification('JSON formatado com sucesso!');
    } catch (error) {
        showNotification(error.message, true);
    }
}

async function convertToMarkdown() {
    try {
        const jsonData = JSON.parse(jsonEditor.getValue());
        
        const response = await fetch('/convert/to-markdown', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jsonData)
        });

        if (!response.ok) {
            throw new Error('Erro na conversão');
        }

        const { markdown } = await response.json();
        markdownEditor.setValue(markdown, -1);
        showNotification('Conversão realizada com sucesso!');
    } catch (error) {
        showNotification(error.message, true);
    }
}

async function copyMarkdown() {
    try {
        await navigator.clipboard.writeText(markdownEditor.getValue());
        showNotification('Markdown copiado!');
    } catch (error) {
        showNotification('Erro ao copiar texto', true);
    }
}