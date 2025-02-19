// Variáveis globais
let editor = null;
let svg = null;
let g = null;
let zoom = null;
let currentZoom = 1;
let collapsedNodes = new Map();
let measurementCache = new Map();
let searchResults = [];
let currentResultIndex = -1;

// Função de inicialização principal
window.addEventListener('DOMContentLoaded', async function() {
    if (typeof window.CONFIG === 'undefined') {
        console.error('CONFIG não está definido. Verifique se config.js está carregado corretamente.');
        return;
    }

    try {
        // Inicializações em ordem correta
        await initializeEditor();
        await initializeVisualization();
        initializeResizer();
        setupEventListeners();
        await loadDefaultJSON();
    } catch (error) {
        console.error('Erro na inicialização:', error);
    }
});

async function initializeEditor() {
    return new Promise((resolve) => {
        // Garantir que o elemento editor existe
        const editorElement = document.getElementById('editor');
        if (!editorElement) {
            console.error('Elemento editor não encontrado');
            return;
        }

        // Inicialização do editor ACE
        editor = ace.edit("editor");
        editor.setTheme(CONFIG.EDITOR.THEME);
        editor.session.setMode(CONFIG.EDITOR.MODE);
        editor.setOptions({
            fontSize: CONFIG.EDITOR.FONT_SIZE,
            ...CONFIG.EDITOR.OPTIONS
        });

        // Adicionar evento de mudança depois que o editor estiver pronto
        editor.session.on('change', debounce(() => {
            try {
                const content = editor.getValue().trim();
                if (content) {
                    updateVisualization(JSON.parse(content));
                } else {
                    g?.selectAll("*").remove();
                }
            } catch (e) {
                console.log("Aguardando JSON válido...");
            }
        }, CONFIG.UI.DEBOUNCE_DELAY));

        // Forçar um resize inicial após um pequeno delay
        setTimeout(() => {
            editor.resize();
            resolve();
        }, 100);
    });
}

async function initializeVisualization() {
    // Setup D3
    svg = d3.select(CONFIG.SELECTORS.VISUALIZER)
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%");

    // Adicionar padrão de grid
    svg.append("defs")
        .append("pattern")
        .attr("id", "grid-pattern")
        .attr("width", CONFIG.GRID.SIZE)
        .attr("height", CONFIG.GRID.SIZE)
        .attr("patternUnits", "userSpaceOnUse")
        .append("path")
        .attr("d", "M 20 0 L 0 0 0 20")
        .attr("class", "grid-pattern");

    // Adicionar grid ao background
    svg.append("rect")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("class", "grid")
        .style("fill", "url(#grid-pattern)");

    g = svg.append("g");
    zoom = d3.zoom().on("zoom", (event) => {
        g.attr("transform", event.transform);
        updateZoomLevel(event.transform.k);
    });
    svg.call(zoom);

    return new Promise(resolve => setTimeout(resolve, 100));
}

async function loadDefaultJSON() {
    if (!editor) {
        console.error('Editor não está inicializado');
        return;
    }

    try {
        const response = await fetch('/static/public/default.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        editor.setValue(JSON.stringify(data, null, 2), -1);
        updateVisualization(data);
    } catch (error) {
        console.error('Erro ao carregar JSON padrão:', error);
    }
}

function setupEventListeners() {
    // Event listeners para pesquisa
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', debounce(searchDiagram, CONFIG.UI.DEBOUNCE_DELAY));
    searchInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && searchResults.length > 0) {
            event.preventDefault();
            focusNextResult();
        }
    });

    // Event listener para menu de configurações
    document.addEventListener('click', function(event) {
        const menu = document.getElementById('settings-menu');
        const button = document.querySelector('.settings-button');
        if (!menu.contains(event.target) && !button.contains(event.target)) {
            menu.classList.remove('show');
            button.classList.remove('active');
        }
    });

    // Verificar se é primeira visita
    if (!localStorage.getItem(CONFIG.STORAGE_KEYS.WELCOME_SHOWN)) {
        showWelcomePopup();
        localStorage.setItem(CONFIG.STORAGE_KEYS.WELCOME_SHOWN, 'true');
    }
}

// Funções principais
function updateVisualization(data, shouldAnimate = true) {
    g.selectAll("*").remove();
    measurementCache.clear();

    const root = d3.hierarchy(transformData(data));

    root.descendants().forEach(d => {
        if (collapsedNodes.has(d.data.name)) {
            d._children = d.children;
            d.children = null;
        }
    });

    const treeLayout = d3.tree().nodeSize([100, 280]);
    treeLayout(root);

    // Links
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

    // Nodes
    const nodes = g.selectAll(".node")
        .data(root.descendants())
        .join("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.y},${d.x})`);

    nodes.append("foreignObject")
        .attr("x", d => -(getNodeWidth(d) / 2))
        .attr("y", d => -(getNodeHeight(d) / 2))
        .attr("width", getNodeWidth)
        .attr("height", getNodeHeight)
        .append("xhtml:div")
        .attr("class", "node-card")
        .html(createNodeContent);

    if (shouldAnimate) fitContent();
}

function transformData(data, key = "root") {
    if (data === null) return { name: key, type: "null", value: "null" };

    const type = Array.isArray(data) ? "array" : typeof data;

    if (type === "object" || type === "array") {
        const children = Object.entries(data).map(([k, v]) => transformData(v, k));
        return {
            name: key,
            type: type,
            children: children,
            collapsed: false,
            value: type === "array" ? `${children.length} items` : `${Object.keys(data).length} props`
        };
    }

    return { name: key, type: type, value: String(data) };
}

function createNodeContent(d) {
    const content = ['<div class="node-container">'];

    if (d.data.children) {
        const isCollapsed = collapsedNodes.has(d.data.name);
        const childCount = d._children ? d._children.length : (d.children ? d.children.length : 0);

        content.push(`
            <div class="node-header">
                <div class="toggle-icon" onclick="toggleNode('${d.data.name}')" 
                    style="cursor: pointer; padding: 5px 10px; margin-right: 5px; display: inline-block;">
                    ${isCollapsed ? '➕' : '➖'}
                </div>
                <span class="node-name">${d.data.name}</span>
                <span class="node-count">[${childCount}]</span>
            </div>
        `);
    } else {
        content.push(`
            <div class="node-content">
                <span class="node-key">${d.data.name}:</span>
                <span class="${getValueClass(d.data.type)}">${formatValue(d.data.value, d.data.type)}</span>
            </div>
        `);
    }

    content.push('</div>');
    return content.join('');
}

// Funções utilitárias otimizadas
function getNodeWidth(d) {
    const cacheKey = `width-${d.data.name}-${d.data.value || ''}-${d.data.children?.length || 0}`;
    if (measurementCache.has(cacheKey)) return measurementCache.get(cacheKey);

    const temp = document.createElement('div');
    temp.style.cssText = `
        position: absolute;
        visibility: hidden;
        white-space: nowrap;
        font-family: ${CONFIG.EDITOR.FONT_FAMILY};
        font-size: ${CONFIG.EDITOR.FONT_SIZE};
    `;

    temp.textContent = d.data.children ?
        `${d.data.name} [${d.data.children.length}]` :
        `${d.data.name}: ${d.data.value}`;

    document.body.appendChild(temp);
    const width = Math.max(CONFIG.VISUALIZATION.NODE_MIN_WIDTH, temp.offsetWidth + 40);
    document.body.removeChild(temp);

    measurementCache.set(cacheKey, width);
    return width;
}

function getNodeHeight(d) {
    const cacheKey = `height-${d.data.name}-${d.data.value || ''}-${d.data.children?.length || 0}`;
    if (measurementCache.has(cacheKey)) return measurementCache.get(cacheKey);

    const width = getNodeWidth(d);
    const temp = document.createElement('div');
    temp.style.cssText = `
        position: absolute;
        visibility: hidden;
        width: ${width}px;
        font-family: ${CONFIG.EDITOR.FONT_FAMILY};
        font-size: ${CONFIG.EDITOR.FONT_SIZE};
    `;

    temp.textContent = d.data.children ?
        `${d.data.name} [${d.data.children.length}]` :
        `${d.data.name}: ${d.data.value}`;

    document.body.appendChild(temp);
    const height = Math.max(CONFIG.VISUALIZATION.NODE_BASE_HEIGHT, temp.offsetHeight + 20);
    document.body.removeChild(temp);

    measurementCache.set(cacheKey, height);
    return height;
}

// Ações do usuário
function toggleNode(nodeName) {
    collapsedNodes.has(nodeName) ?
        collapsedNodes.delete(nodeName) :
        collapsedNodes.set(nodeName, true);

    updateVisualization(JSON.parse(editor.getValue()), false);
}

function collapseAll() {
    d3.selectAll('.node').data().forEach(node => {
        if (node.data.children) collapsedNodes.set(node.data.name, true);
    });
    updateVisualization(JSON.parse(editor.getValue()), false);
}

function expandAll() {
    collapsedNodes.clear();
    updateVisualization(JSON.parse(editor.getValue()), false);
}

// Outras funções necessárias permanecem iguais...
// ...existing code for zoom controls, search, etc...

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

    if (!content.trim()) {
        alert("O diagrama está vazio. Não é possível salvar.");
        return;
    }

    // Criar um clone do SVG original
    const originalSvg = svg.node();
    const clonedSvg = originalSvg.cloneNode(true);

    // Ajustar o estilo do clone para garantir que todos os elementos sejam visíveis
    clonedSvg.style.backgroundColor = 'var(--bg-primary)';

    // Copiar os estilos computados dos nodes
    const nodeCards = clonedSvg.querySelectorAll('.node-card');
    nodeCards.forEach(card => {
        const original = originalSvg.querySelector('.node-card');
        const computedStyle = window.getComputedStyle(original);

        card.style.backgroundColor = computedStyle.backgroundColor;
        card.style.border = computedStyle.border;
        card.style.borderRadius = computedStyle.borderRadius;
        card.style.color = computedStyle.color;
    });

    // Converter para string e fazer o download
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clonedSvg);

    // Adicionar namespaces necessários
    const svgBlob = new Blob([
        `<?xml version="1.0" standalone="no"?>`,
        `<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">`,
        svgString
    ], { type: "image/svg+xml" });

    const url = URL.createObjectURL(svgBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "json-diagram.svg";
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
        // Limpar o diagrama
        g.selectAll("*").remove();
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

// Controles de zoom
function zoomIn() {
    svg.transition()
        .duration(CONFIG.ZOOM.DURATION)
        .call(zoom.scaleBy, CONFIG.ZOOM.SCALE)
        .on("end", () => updateZoomLevel(currentZoom * CONFIG.ZOOM.SCALE));
}

function zoomOut() {
    svg.transition()
        .duration(CONFIG.ZOOM.DURATION)
        .call(zoom.scaleBy, 1 / CONFIG.ZOOM.SCALE)
        .on("end", () => updateZoomLevel(currentZoom / CONFIG.ZOOM.SCALE));
}

function resetZoom() {
    svg.transition()
        .duration(CONFIG.ZOOM.DURATION)
        .call(zoom.transform, d3.zoomIdentity)
        .on("end", () => updateZoomLevel(1));
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

    svg.transition()
        .duration(750)
        .call(zoom.transform, transform)
        .on("end", () => updateZoomLevel(scale));
}

// Atualizar o evento de zoom do D3
zoom.on("zoom", (event) => {
    g.attr("transform", event.transform);
    updateZoomLevel(event.transform.k);
});

// Funções do modal de boas-vindas
function showWelcomePopup() {
    const modal = document.getElementById('welcome-modal');
    modal.classList.add('show');
}

function closeWelcomePopup() {
    const modal = document.getElementById('welcome-modal');
    modal.classList.remove('show');
}

function highlightText(text, searchTerm) {
    if (!searchTerm) return text;
    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedSearchTerm})`, 'gi');
    return text.toString().replace(regex, '<mark class="text-highlight">$1</mark>');
}

function searchDiagram() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const nodes = d3.selectAll('.node');
    let matchCount = 0;
    searchResults = [];
    currentResultIndex = -1;

    nodes.each(function(d) {
        const node = d3.select(this);
        const nodeData = d.data;
        const nodeCard = node.select('.node-card');
        const fullText = `${nodeData.name}${nodeData.value ? ':' + nodeData.value : ''}`.toLowerCase();
        
        if (!searchTerm) {
            node.classed('node-highlight', false);
            node.classed('current-result', false);
            nodeCard.html(d => createNodeContent(d));
            return;
        }

        const matchFound = fullText.includes(searchTerm);
        node.classed('node-highlight', matchFound);
        
        if (matchFound) {
            matchCount++;
            searchResults.push({node, transform: d});
            
            const nodeContent = nodeData.type === 'array' || nodeData.type === 'object' ? 
                `<div class="node-container">
                    <div class="node-header">
                        <span class="toggle-icon" onclick="toggleNode('${nodeData.name}')" 
                            style="cursor: pointer; padding: 5px 10px; margin-right: 5px; display: inline-block;">
                            ${collapsedNodes.has(nodeData.name) ? '➕' : '➖'}
                        </span>
                        <span class="node-name">${highlightText(nodeData.name, searchTerm)}</span>
                        <span class="node-count">[${nodeData.children ? nodeData.children.length : 0}]</span>
                    </div>
                </div>` :
                `<div class="node-container">
                    <div class="node-content">
                        <span class="node-key">${highlightText(nodeData.name, searchTerm)}:</span>
                        <span class="${getValueClass(nodeData.type)}">${highlightText(nodeData.value, searchTerm)}</span>
                    </div>
                </div>`;
            
            nodeCard.html(nodeContent);
        } else {
            nodeCard.html(() => createNodeContent(d));
        }
    });

    // Atualizar contador de resultados
    const resultCount = document.getElementById('resultCount');
    if (searchTerm.length > 0) {
        resultCount.textContent = `${matchCount} resultado${matchCount !== 1 ? 's' : ''} encontrado${matchCount !== 1 ? 's' : ''}`;
        resultCount.style.opacity = '1';

        if (matchCount > 0) {
            focusNextResult();
        }
    } else {
        resultCount.style.opacity = '0';
        setTimeout(() => resultCount.textContent = '', 200);
        resetZoom();
    }
}

function focusNextResult() {
    if (searchResults.length === 0) return;
    
    currentResultIndex = (currentResultIndex + 1) % searchResults.length;
    const result = searchResults[currentResultIndex];
    const transform = result.transform;

    const newTransform = d3.zoomIdentity
        .translate(
            svg.node().clientWidth / 2 - transform.y,
            svg.node().clientHeight / 2 - transform.x
        )
        .scale(1.5);

    svg.transition()
        .duration(750)
        .call(zoom.transform, newTransform);
}

// Adicionar event listener para a tecla Enter
document.getElementById('searchInput').addEventListener('keydown', function(event) {
    if (event.key === 'Enter' && searchResults.length > 0) {
        event.preventDefault();
        focusNextResult();
    }
});

// Inicialização
document.addEventListener('DOMContentLoaded', function () {
    initializeEditor();
    initializeResizer();
    
    if (!localStorage.getItem('welcomeShown')) {
        showWelcomePopup();
        localStorage.setItem('welcomeShown', 'true');
    }

    // Adicionar evento de pesquisa
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', debounce(searchDiagram, 300));

    initializeResizer();

    // Carregar o JSON padrão
    loadDefaultJSON();
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
        case 'collapseAll':
            collapseAll();
            break;
        case 'expandAll':
            expandAll();
            break;
    }

    // Reset dropdown
    event.target.value = '';
}

function initializeResizer() {
    const leftPanel = document.querySelector(CONFIG.SELECTORS.LEFT_PANEL);
    const resizer = document.querySelector(CONFIG.SELECTORS.RESIZER);
    const container = document.querySelector('.container');

    if (!leftPanel || !resizer || !container || !editor) {
        console.error('Elementos necessários para o resizer não encontrados');
        return;
    }

    let isResizing = false;
    let startX, startWidth;

    function onMouseMove(e) {
        if (!isResizing) return;

        requestAnimationFrame(() => {
            const dx = e.pageX - startX;
            const newWidth = startWidth + dx;
            const containerWidth = container.offsetWidth;

            if (newWidth >= CONFIG.UI.MIN_PANEL_WIDTH && newWidth <= containerWidth * CONFIG.UI.MAX_PANEL_WIDTH_RATIO) {
                leftPanel.style.width = `${newWidth}px`;
                editor?.resize();
            }
        });
    }

    function onMouseUp() {
        if (!isResizing) return;
        
        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        
        resizer.classList.remove('active');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        
        editor?.resize();
    }

    resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isResizing = true;
        startX = e.pageX;
        startWidth = leftPanel.offsetWidth;

        resizer.classList.add('active');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

// Função para carregar o JSON padrão
async function loadDefaultJSON() {
    try {
        const response = await fetch('./static/public/default.json');
        const data = await response.json();
        editor.setValue(JSON.stringify(data, null, 2), -1);
        updateVisualization(data);
    } catch (error) {
        console.error('Erro ao carregar JSON padrão:', error);
    }
}

// Funções para o menu de configurações
function toggleSettings() {
    const menu = document.getElementById('settings-menu');
    const button = document.querySelector('.settings-button');
    menu.classList.toggle('show');
    button.classList.toggle('active');
}

function toggleGrid() {
    const visualizer = document.getElementById('visualizer');
    const checkbox = document.getElementById('showGrid');
    
    if (checkbox.checked) {
        visualizer.style.backgroundImage = `
            linear-gradient(to right, rgba(51, 51, 51, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(51, 51, 51, 0.1) 1px, transparent 1px)
        `;
        visualizer.style.backgroundSize = '20px 20px';
    } else {
        visualizer.style.backgroundImage = 'none';
        visualizer.style.backgroundSize = '0';
    }
}

// Fechar menu quando clicar fora
document.addEventListener('click', function(event) {
    const menu = document.getElementById('settings-menu');
    const button = document.querySelector('.settings-button');
    
    if (!menu.contains(event.target) && !button.contains(event.target)) {
        menu.classList.remove('show');
        button.classList.remove('active');
    }
});

function initializeEditor() {
    editor = ace.edit("editor");
    editor.setTheme("ace/theme/github_dark");
    editor.session.setMode("ace/mode/json");
    editor.setOptions({
        fontSize: "14px",
        showPrintMargin: true,
        showGutter: true,
        highlightActiveLine: true,
        wrap: true
    });
    
    // Forçar um resize inicial
    setTimeout(() => editor.resize(), 100);
}

// Aguardar o CONFIG ser carregado
document.addEventListener('DOMContentLoaded', function() {
    if (typeof CONFIG === 'undefined') {
        console.error('Erro: CONFIG não encontrado. Verifique se config.js está carregado corretamente.');
        return;
    }

    // Inicialização do editor ACE
    let editor = ace.edit("editor");
    editor.setTheme(CONFIG.EDITOR.THEME);
    editor.session.setMode(CONFIG.EDITOR.MODE);
    editor.setOptions({
        fontSize: CONFIG.EDITOR.FONT_SIZE,
        ...CONFIG.EDITOR.OPTIONS
    });

    // ...rest of the code...
});

// Move todas as definições de funções para fora do DOMContentLoaded
function initializeEditor() {
    // ...existing code...
}

// ...rest of the functions...

// Add this function near the top with other global variables
function updateZoomLevel(scale) {
    currentZoom = scale;
    const zoomLevelElement = document.getElementById('zoomLevel');
    if (zoomLevelElement) {
        zoomLevelElement.textContent = `${Math.round(scale * 100)}%`;
    }
}

// Replace the initialization sequence
document.addEventListener('DOMContentLoaded', async function() {
    if (typeof window.CONFIG === 'undefined') {
        console.error('CONFIG não está definido. Verifique se config.js está carregado corretamente.');
        return;
    }

    try {
        // Wait for each initialization step to complete
        await initializeEditor();
        await initializeVisualization();
        await setupEventListeners();
        await initializeResizer();
        await loadDefaultJSON();
    } catch (error) {
        console.error('Erro na inicialização:', error);
    }
});

// Update the initializeEditor function
async function initializeEditor() {
    return new Promise((resolve) => {
        if (!document.getElementById('editor')) {
            console.error('Elemento editor não encontrado');
            resolve(false);
            return;
        }

        try {
            editor = ace.edit("editor");
            editor.setTheme(CONFIG.EDITOR.THEME);
            editor.session.setMode(CONFIG.EDITOR.MODE);
            editor.setOptions({
                fontSize: CONFIG.EDITOR.FONT_SIZE,
                ...CONFIG.EDITOR.OPTIONS
            });

            // Ensure editor is ready before resolving
            editor.on("init", () => {
                editor.resize();
                resolve(true);
            });

            // Fallback if init event doesn't fire
            setTimeout(() => {
                editor.resize();
                resolve(true);
            }, 100);
        } catch (error) {
            console.error('Erro ao inicializar editor:', error);
            resolve(false);
        }
    });
}

// Update the loadDefaultJSON function
async function loadDefaultJSON() {
    if (!editor) {
        console.error('Editor não está inicializado');
        return;
    }

    try {
        const response = await fetch('/static/public/default.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (editor && editor.setValue) {
            editor.setValue(JSON.stringify(data, null, 2), -1);
            updateVisualization(data);
        } else {
            console.error('Editor não está pronto para receber valores');
        }
    } catch (error) {
        console.error('Erro ao carregar JSON padrão:', error);
    }
}


// Update initializeResizer
async function initializeResizer() {
    return new Promise((resolve) => {
        const leftPanel = document.querySelector('.left-panel');
        const resizer = document.querySelector('.resizer');
        const container = document.querySelector('.container');

        if (!leftPanel || !resizer || !container) {
            console.error('Elementos necessários para o resizer não encontrados');
            resolve(false);
            return;
        }

        let isResizing = false;
        let startX, startWidth;

        function onMouseMove(e) {
            if (!isResizing) return;

            requestAnimationFrame(() => {
                const dx = e.pageX - startX;
                const newWidth = startWidth + dx;
                const containerWidth = container.offsetWidth;

                if (newWidth >= CONFIG.UI.MIN_PANEL_WIDTH && 
                    newWidth <= containerWidth * CONFIG.UI.MAX_PANEL_WIDTH_RATIO) {
                    leftPanel.style.width = `${newWidth}px`;
                    editor?.resize();
                }
            });
        }

        function onMouseUp() {
            if (!isResizing) return;
            
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            resizer.classList.remove('active');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            
            editor?.resize();
        }

        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isResizing = true;
            startX = e.pageX;
            startWidth = leftPanel.offsetWidth;

            resizer.classList.add('active');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        resolve(true);
    });
}
