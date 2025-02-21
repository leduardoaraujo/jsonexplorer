document.addEventListener('DOMContentLoaded', function() {
    // Configurar editor
    window.markdownEditor = ace.edit("markdownEditor", {
        theme: "ace/theme/pastel_on_dark",
        mode: "ace/mode/markdown",
        fontSize: 14,
        showPrintMargin: false,
        showGutter: true,
        highlightActiveLine: true,
        wrap: true
    });

    // Exemplo inicial
    markdownEditor.setValue(`# Bem-vindo ao Visualizador Markdown

Este é um exemplo de markdown. Digite seu conteúdo à esquerda e veja o resultado à direita.

## Recursos
- Preview em tempo real
- Sintaxe highlighting
- Suporte a todos elementos markdown
- Export para HTML

### Exemplo de código
\`\`\`javascript
function hello() {
    console.log("Hello, Markdown!");
}
\`\`\`
`);

    // Preview inicial
    updatePreview();

    // Atualização automática após um delay
    let updateTimeout;
    markdownEditor.getSession().on('change', function() {
        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(updatePreview, 1000);
    });
});

function updatePreview() {
    try {
        const markdown = markdownEditor.getValue();
        const html = marked.parse(markdown, { breaks: true });
        document.getElementById('preview').innerHTML = html;
        showNotification('Preview atualizado!');
    } catch (error) {
        showNotification(error.message, true);
    }
}

function copyHtml() {
    try {
        const markdown = markdownEditor.getValue();
        const html = marked.parse(markdown, { breaks: true });
        navigator.clipboard.writeText(html);
        showNotification('HTML copiado para a área de transferência!');
    } catch (error) {
        showNotification('Erro ao copiar HTML', true);
    }
}

function showNotification(message, isError = false) {
    const errorDiv = document.getElementById('error');
    const successDiv = document.getElementById('success');
    
    errorDiv.style.display = isError ? 'block' : 'none';
    successDiv.style.display = isError ? 'none' : 'block';
    (isError ? errorDiv : successDiv).textContent = message;
    
    setTimeout(() => {
        errorDiv.style.display = 'none';
        successDiv.style.display = 'none';
    }, 3000);
}
