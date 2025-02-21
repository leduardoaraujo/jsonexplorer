/**
 * Constantes globais para configuração da aplicação
 * ZOOM_SCALE: Fator de ampliação/redução do zoom
 * ZOOM_DURATION: Duração das animações de zoom em milissegundos
 * DEBOUNCE_DELAY: Atraso para atualização do diagrama após mudanças no editor
 * NODE_BASE_HEIGHT: Altura mínima dos nós no diagrama
 * NODE_MIN_WIDTH: Largura mínima dos nós no diagrama
 */
const ZOOM_SCALE = 1.3;
const ZOOM_DURATION = 300;
const DEBOUNCE_DELAY = 300;
const NODE_BASE_HEIGHT = 45;
const NODE_MIN_WIDTH = 180;
const DEFAULT_FONT = 'Monaco, Menlo, Ubuntu Mono, monospace';
const DEFAULT_FONT_SIZE = '13px';

/**
 * Inicialização do editor ACE
 * - Configura o tema dark do GitHub
 * - Define o modo como JSON
 * - Configura opções básicas do editor
 */
let editor = ace.edit("editor");
editor.setTheme("ace/theme/github_dark");
editor.session.setMode("ace/mode/json");
editor.setOptions({
    fontSize: 14,
    showPrintMargin: false,
    showGutter: true,
    highlightActiveLine: true,
    wrap: true
});

/**
 * Configuração do D3.js para visualização
 * - Cria o elemento SVG principal
 * - Configura o padrão de grid
 * - Inicializa o sistema de zoom
 */
let svg = d3.select("#visualizer")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%");

// Adicionar padrão de grid
svg.append("defs")
    .append("pattern")
    .attr("id", "grid-pattern")
    .attr("width", 20)
    .attr("height", 20)
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

let g = svg.append("g");
let zoom = d3.zoom().on("zoom", (event) => g.attr("transform", event.transform));
svg.call(zoom);

/**
 * Estruturas de dados globais
 * collapsedNodes: Mantém registro dos nós colapsados
 * measurementCache: Cache para otimizar cálculos de dimensões
 * currentZoom: Mantém o nível atual de zoom
 */
let collapsedNodes = new Map();

// Cache para medições de texto
const measurementCache = new Map();

// Atualizar o zoom level global
let currentZoom = 1;

// Modificar as funções de zoom para atualizar o indicador
function updateZoomLevel(scale) {
    currentZoom = scale;
    const percentage = Math.round(scale * 100);
    document.getElementById('zoomLevel').textContent = `${percentage}%`;
}

// Eventos
editor.getSession().on('change', debounce(() => {
    try {
        const content = editor.getValue().trim();
        if (content) {
            updateVisualization(JSON.parse(content));
        } else {
            g.selectAll("*").remove();
        }
    } catch (e) {
        console.log("Aguardando JSON válido...");
    }
}, DEBOUNCE_DELAY));

/**
 * updateVisualization(data, shouldAnimate)
 * Função principal que atualiza o diagrama visual
 * @param {Object} data - Dados JSON a serem visualizados
 * @param {boolean} shouldAnimate - Se deve animar a transição
 * 
 * - Limpa o diagrama existente
 * - Transforma os dados em estrutura hierárquica
 * - Cria os nós e links do diagrama
 * - Aplica layout em árvore
 */
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

/**
 * transformData(data, key)
 * Converte dados JSON em estrutura hierárquica para o D3
 * @param {any} data - Dados a serem transformados
 * @param {string} key - Chave/nome do nó atual
 * @returns {Object} Estrutura de dados hierárquica
 */
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

//switch de collapse
function handleCollapseToggle(isChecked) {
    if (isChecked) {
        collapseAll();
        resetZoom();
    } else {
        expandAll();
        fitContent();
    }
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
        font-family: ${DEFAULT_FONT};
        font-size: ${DEFAULT_FONT_SIZE};
    `;

    temp.textContent = d.data.children ?
        `${d.data.name} [${d.data.children.length}]` :
        `${d.data.name}: ${d.data.value}`;

    document.body.appendChild(temp);
    const width = Math.max(NODE_MIN_WIDTH, temp.offsetWidth + 40);
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
        font-family: ${DEFAULT_FONT};
        font-size: ${DEFAULT_FONT_SIZE};
    `;

    temp.textContent = d.data.children ?
        `${d.data.name} [${d.data.children.length}]` :
        `${d.data.name}: ${d.data.value}`;

    document.body.appendChild(temp);
    const height = Math.max(NODE_BASE_HEIGHT, temp.offsetHeight + 20);
    document.body.removeChild(temp);

    measurementCache.set(cacheKey, height);
    return height;
}

/**
 * Funções de manipulação de nós
 * - toggleNode: Alterna estado de um nó entre expandido/colapsado
 * - collapseAll: Colapsa todos os nós do diagrama
 * - expandAll: Expande todos os nós do diagrama
 */
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

/**
 * Funções de utilidade
 * - formatValue: Formata valores para exibição
 * - getNodeWidth: Calcula largura dos nós
 * - getNodeHeight: Calcula altura dos nós
 * - debounce: Limita frequência de chamadas de função
 */
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

/**
 * Funções de controle de zoom
 * - zoomIn: Aumenta o zoom
 * - zoomOut: Diminui o zoom
 * - resetZoom: Reseta zoom focando no nó raiz
 * - fitContent: Ajusta zoom para mostrar todo o conteúdo
 */
function zoomIn() {
    svg.transition()
        .duration(ZOOM_DURATION)
        .call(zoom.scaleBy, ZOOM_SCALE)
        .on("end", () => updateZoomLevel(currentZoom * ZOOM_SCALE));
}

function zoomOut() {
    svg.transition()
        .duration(ZOOM_DURATION)
        .call(zoom.scaleBy, 1 / ZOOM_SCALE)
        .on("end", () => updateZoomLevel(currentZoom / ZOOM_SCALE));
}

function resetZoom() {
    // Encontrar o nó raiz (primeiro nó do diagrama)
    const rootNode = d3.select('.node').datum();
    if (!rootNode) return;

    const scale = 1.2; // Escala um pouco maior para melhor visualização
    const parent = svg.node().getBoundingClientRect();
    
    const transform = d3.zoomIdentity
        .translate(
            parent.width / 2 - rootNode.y,
            parent.height / 2 - rootNode.x
        )
        .scale(scale);

    svg.transition()
        .duration(ZOOM_DURATION)
        .call(zoom.transform, transform)
        .on("end", () => updateZoomLevel(scale));
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

/**
 * Funções de interação
 * - handleEditorAction: Processa ações do editor
 * - searchDiagram: Implementa busca no diagrama
 * - highlightText: Destaca texto encontrado na busca
 * - initializeResizer: Configura redimensionamento de painéis
 */
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
    const leftPanel = document.querySelector('.left-panel');
    const resizer = document.querySelector('.resizer');
    const container = document.querySelector('.container');

    let isResizing = false;
    let startX, startWidth;

    // Usar requestAnimationFrame para melhor performance
    let animationFrameId = null;

    function onMouseMove(e) {
        if (!isResizing) return;

        // Cancelar frame anterior se existir
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }

        // Agendar próxima atualização
        animationFrameId = requestAnimationFrame(() => {
            const dx = e.pageX - startX;
            const newWidth = startWidth + dx;
            const containerWidth = container.offsetWidth;

            if (newWidth >= 200 && newWidth <= containerWidth * 0.8) {
                leftPanel.style.width = `${newWidth}px`;
                if (editor) editor.resize();
            }
        });
    }

    function onMouseUp() {
        if (!isResizing) return;
        
        isResizing = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        resizer.classList.remove('active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
    }

    resizer.addEventListener('mousedown', (e) => {
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

/**
 * Funções de inicialização e configuração
 * - loadDefaultJSON: Carrega JSON inicial
 * - toggleSettings: Controla menu de configurações
 * - toggleGrid: Controla visibilidade do grid
 */
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

/**
 * Event Listeners
 * - Inicialização do DOM
 * - Manipulação de cliques fora do menu
 * - Eventos de redimensionamento
 * - Eventos de zoom
 */

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

function searchDiagram() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const nodes = d3.selectAll('.node');
    let matchCount = 0;
    let firstMatch = null;

    nodes.each(function (d) {
        const node = d3.select(this);
        const nodeData = d.data;
        const nodeCard = node.select('.node-card');

        if (!searchTerm) {
            node.classed('node-highlight', false);
            nodeCard.html(d => createNodeContent(d));
            return;
        }

        const fullText = `${nodeData.name}:${nodeData.value || ''}`.toLowerCase();
        const matchFound = fullText.includes(searchTerm);

        node.classed('node-highlight', matchFound);

        if (matchFound) {
            matchCount++;
            if (!firstMatch) firstMatch = node;

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
                        <span class="${getValueClass(nodeData.type)}">${highlightText(formatValue(nodeData.value, nodeData.type), searchTerm)}</span>
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

        // Zoom no primeiro resultado encontrado
        if (firstMatch) {
            const transform = firstMatch.datum();
            const scale = 1.5; // Nível de zoom

            const newTransform = d3.zoomIdentity
                .translate(
                    svg.node().clientWidth / 2 - transform.y,
                    svg.node().clientHeight / 2 - transform.x
                )
                .scale(scale);

            svg.transition()
                .duration(750)
                .call(zoom.transform, newTransform);
        }
    } else {
        resultCount.style.opacity = '0';
        setTimeout(() => resultCount.textContent = '', 200);
        // Resetar o zoom quando a pesquisa estiver vazia
        resetZoom();
    }
}

// Nova função para destacar o texto procurado
function highlightText(text, searchTerm) {
    if (!searchTerm) return text;
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.toString().replace(regex, '<span class="text-highlight">$1</span>');
}

// Inicialização
document.addEventListener('DOMContentLoaded', function () {
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