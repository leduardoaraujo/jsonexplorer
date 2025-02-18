// Inicialização do editor ACE
let editor = ace.edit("editor");
editor.setTheme("ace/theme/monokai");
editor.session.setMode("ace/mode/json");
editor.setOptions({
    fontSize: "14px",
    showPrintMargin: true,
    showGutter: true,
    highlightActiveLine: true,
    wrap: true
});

// Adicionar após a inicialização do editor
editor.getSession().on('change', debounce(() => {
    try {
        const content = editor.getValue();
        if (content.trim()) {
            const data = JSON.parse(content);
            updateVisualization(data);
        }
    } catch (e) {
        // Silenciosamente ignora erros durante a digitação
        console.log("Aguardando JSON válido...");
    }
}, 300));

// Inicialização do SVG e zoom
let svg = d3.select("#visualizer")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%");

let g = svg.append("g");
let zoom = d3.zoom().on("zoom", (event) => g.attr("transform", event.transform));
svg.call(zoom);

// Formatação de JSON
function formatJSON() {
    try {
        const content = editor.getValue();
        if (!content.trim()) {
            alert("Editor está vazio. Por favor, insira um conteúdo JSON.");
            return;
        }
        const obj = JSON.parse(content);
        editor.setValue(JSON.stringify(obj, null, 2), -1);
    } catch (e) {
        alert("JSON inválido: " + e.message);
    }
}

// Salvando o diagrama em SVG
function saveDiagram() {
    const content = editor.getValue();
    
    // Verifica se o conteúdo do editor está vazio
    if (!content.trim()) {
        alert("O diagrama está vazio. Não é possível salvar.");
        return;
    }

    // Se o conteúdo não estiver vazio, cria o SVG
    const svgData = svg.node().outerHTML; // Obtém o conteúdo do SVG

    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "diagram.svg";
    a.click();
    URL.revokeObjectURL(url);
}


function clearEditor() {
    const content = editor.getValue(); 
    if (!content.trim()) {
        alert("Editor está vazio. Por favor, insira um conteúdo JSON.");
        return;
    } else {
        editor.setValue("");
    }
}

// Visualizando o JSON
function visualizeJSON() {
    try {
        const content = editor.getValue();
        if (!content.trim()) {
            alert("Editor está vazio. Por favor, insira um conteúdo JSON.");
            return;
        }
        const data = JSON.parse(content);
        updateVisualization(data);
    } catch (e) {
        alert("JSON inválido: " + e.message);
    }
}

// Atualizando a visualização
function updateVisualization(data) {
    g.selectAll("*").remove();
    const root = d3.hierarchy(transformData(data));

    const treeLayout = d3.tree()
        .nodeSize([100, 280])  // Aumentado o espaçamento vertical e horizontal
        .separation((a, b) => (a.parent == b.parent ? 1.5 : 2)); // Aumentado o fator de separação

    treeLayout(root);

    // Adicionando links com curvas suaves
    g.selectAll(".link")
        .data(root.links())
        .join("path")
        .attr("class", "link")
        .attr("d", d3.linkHorizontal()
            .x(d => d.y)
            .y(d => d.x))
        .attr("stroke", "#4a5568")
        .attr("stroke-width", 1.5)
        .attr("fill", "none");

    const nodes = g.selectAll(".node")
        .data(root.descendants())
        .join("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.y},${d.x})`);

    // Adicionando cartões para os nós
    nodes.append("foreignObject")
        .attr("x", d => -(getNodeWidth(d) / 2))
        .attr("y", d => -(getNodeHeight(d) / 2))
        .attr("width", getNodeWidth)
        .attr("height", getNodeHeight)
        .append("xhtml:div")
        .attr("class", "node-card")
        .html(d => createNodeContent(d.data));
}

// Função para criar o conteúdo do nó
function createNodeContent(data) {
    let content = '<div class="node-container">';
    
    if (Array.isArray(data.children)) {
        content += `
            <div class="node-header">
                <span class="node-name">${data.name}</span>
                <span class="node-count">[${data.children.length}]</span>
            </div>
        `;
    } else {
        const valueClass = getValueClass(data.type);
        content += `
            <div class="node-content">
                <span class="node-key">${data.name}:</span>
                <span class="${valueClass}">${formatValue(data.value, data.type)}</span>
            </div>
        `;
    }
    
    content += '</div>';
    return content;
}

// Função para formatar valores
function formatValue(value, type) {
    switch (type) {
        case 'string':
            return `"${value}"`;
        case 'boolean':
            return `<span style="color: #10B981">${value}</span>`;
        case 'number':
            return `<span style="color: #3B82F6">${value}</span>`;
        case 'null':
            return 'null';
        default:
            return value;
    }
}

// Função para obter classe do valor
function getValueClass(type) {
    switch (type) {
        case 'string':
            return 'string-value';
        case 'number':
            return 'number-value';
        case 'boolean':
            return 'boolean-value';
        default:
            return 'default-value';
    }
}

// Transformando dados
function transformData(data, key = "root") {
    if (data === null) return { name: key, type: "null", value: "null" };

    const type = Array.isArray(data) ? "array" : typeof data;

    if (type === "object" || type === "array") {
        const children = Object.entries(data).map(([k, v]) => transformData(v, k));
        return {
            name: key,
            type: type,
            children: children,
            value: type === "array" ? `${children.length} items` : `${Object.keys(data).length} props`
        };
    }

    return {
        name: key,
        type: type,
        value: String(data)
    };
}

// Ajustando tamanhos dos nós
function getNodeWidth(d) {
    // Criar elemento temporário para medir o texto
    const temp = document.createElement('div');
    temp.style.position = 'absolute';
    temp.style.visibility = 'hidden';
    temp.style.whiteSpace = 'nowrap';
    temp.style.fontFamily = 'Monaco, Menlo, Ubuntu Mono, monospace';
    temp.style.fontSize = '13px';
    
    // Adicionar conteúdo baseado no tipo de nó
    if (d.data.children) {
        temp.textContent = `${d.data.name} [${d.data.children.length}]`;
    } else {
        temp.textContent = `${d.data.name}: ${d.data.value}`;
    }
    
    document.body.appendChild(temp);
    const width = Math.max(180, temp.offsetWidth + 40); // 40px para padding
    document.body.removeChild(temp);
    
    return width;
}

function getNodeHeight(d) {
    let baseHeight = 45;
    
    // Criar elemento temporário para medir o texto
    const temp = document.createElement('div');
    temp.style.position = 'absolute';
    temp.style.visibility = 'hidden';
    temp.style.width = getNodeWidth(d) + 'px';
    temp.style.fontFamily = 'Monaco, Menlo, Ubuntu Mono, monospace';
    temp.style.fontSize = '13px';
    
    // Adicionar conteúdo para medir altura
    if (d.data.children) {
        temp.textContent = `${d.data.name} [${d.data.children.length}]`;
    } else {
        temp.textContent = `${d.data.name}: ${d.data.value}`;
    }
    
    document.body.appendChild(temp);
    const height = Math.max(baseHeight, temp.offsetHeight + 20); // 20px para padding
    document.body.removeChild(temp);
    
    return height;
}

// Controles de zoom
function zoomIn() {
    svg.transition().call(zoom.scaleBy, 1.3);
}

function zoomOut() {
    svg.transition().call(zoom.scaleBy, 0.7);
}

function resetZoom() {
    svg.transition().call(zoom.transform, d3.zoomIdentity);
}

function fitContent() {
    const bounds = g.node().getBBox();
    const parent = svg.node().getBoundingClientRect();
    const fullWidth = parent.width;
    const fullHeight = parent.height;

    const scale = Math.min(
        0.9 * fullWidth / bounds.width,
        0.9 * fullHeight / bounds.height
    );

    const transform = d3.zoomIdentity
        .translate(
            fullWidth / 2 - (bounds.x + bounds.width / 2) * scale,
            fullHeight / 2 - (bounds.y + bounds.height / 2) * scale
        )
        .scale(scale);

    svg.transition().duration(750).call(zoom.transform, transform);
}

// Funções do modal de boas-vindas
function showWelcomePopup() {
    const modal = document.getElementById('welcome-modal');
    modal.classList.add('show');
}

function closeWelcomePopup() {
    const modal = document.getElementById('welcome-modal');
    modal.classList.remove('show');
}

function searchDiagram() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const nodes = d3.selectAll('.node');
    let matchCount = 0;

    nodes.each(function(d) {
        const node = d3.select(this);
        const nodeData = d.data;
        const nodeCard = node.select('.node-card');

        // Se a barra de pesquisa estiver vazia, restaura o conteúdo original
        if (!searchTerm) {
            node.classed('node-highlight', false);
            nodeCard.html(createNodeContent(nodeData));
            return;
        }

        const fullText = `${nodeData.name}:${nodeData.value || ''}`.toLowerCase();
        const matchFound = fullText.includes(searchTerm);

        node.classed('node-highlight', matchFound);
        
        if (matchFound) {
            matchCount++;
            
            // Recriar o conteúdo do nó com o highlight
            const nodeContent = nodeData.children ? 
                `<div class="node-container">
                    <div class="node-header">
                        <span class="node-name">${highlightText(nodeData.name, searchTerm)}</span>
                        <span class="node-count">[${nodeData.children.length}]</span>
                    </div>
                </div>` :
                `<div class="node-container">
                    <div class="node-content">
                        <span class="node-key">${highlightText(nodeData.name, searchTerm)}:</span>
                        <span class="${getValueClass(nodeData.type)}">${highlightText(formatValue(nodeData.value, nodeData.type), searchTerm)}</span>
                    </div>
                </div>`;
            
            nodeCard.html(nodeContent);
        } else {
            // Restaura o conteúdo original para nós que não correspondem
            nodeCard.html(createNodeContent(nodeData));
        }
    });

    // Atualizar contador de resultados
    const resultCount = document.getElementById('resultCount');
    if (searchTerm.length > 0) {
        resultCount.textContent = `${matchCount} resultado${matchCount !== 1 ? 's' : ''} encontrado${matchCount !== 1 ? 's' : ''}`;
        resultCount.style.opacity = '1';
    } else {
        resultCount.style.opacity = '0';
        setTimeout(() => resultCount.textContent = '', 200);
    }
}

// Nova função para destacar o texto procurado
function highlightText(text, searchTerm) {
    if (!searchTerm) return text;
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.toString().replace(regex, '<span class="text-highlight">$1</span>');
}

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    if (!localStorage.getItem('welcomeShown')) {
        showWelcomePopup();
        localStorage.setItem('welcomeShown', 'true');
    }
    
    // Adicionar evento de pesquisa
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', debounce(searchDiagram, 300));
});

// Função auxiliar para debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function handleEditorAction(action) {
    if (!action) return;
    
    switch (action) {
        case 'format':
            formatJSON();
            break;
        case 'clear':
            clearEditor();
            break;
    }
    
    // Reset dropdown
    event.target.value = '';
}

function handleZoomAction(action) {
    if (!action) return;
    
    switch (action) {
        case 'in':
            zoomIn();
            break;
        case 'out':
            zoomOut();
            break;
        case 'reset':
            resetZoom();
            break;
        case 'fit':
            fitContent();
            break;
    }
    
    // Reset dropdown
    event.target.value = '';
}

function handleVisualizerAction(action) {
    if (!action) return;
    
    switch (action) {
        case 'save':
            saveDiagram();
            break;
    }
    
    // Reset dropdown
    event.target.value = '';
}