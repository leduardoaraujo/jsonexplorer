
const CONFIG = {
    zoom: {
        scale: 1.3,
        duration: 300,
        initialLevel: 1
    },
    node: {
        baseHeight: 50,
        minWidth: 190,
        padding: 10,      
        borderRadius: 6   
    },
    debounceDelay: 300,
    font: {
        family: 'Monaco, Menlo, Ubuntu Moo, monospace',
        size: '13px'
    },
    editor: {
        fontSize: 14,
        theme: "ace/theme/gruvbox",
        mode: "ace/mode/json"
    },
    layout: {
        nodeSpacingX: 190, 
        nodeSpacingY: 80   
    },
    grouping: {
        enabled: true,           
        maxPropertiesPerNode: 15, 
        maxDepth: 3,             
        excludeFromGrouping: []  
    },
    search: {
        highlightColor: '#FFA500',
        resultBufferSize: 50 
    }
};
const state = {
    editor: null,
    svg: null,
    mainGroup: null,
    zoom: null,
    collapsedNodes: new Map(), 
    measurementCache: new Map(),
    currentZoom: CONFIG.zoom.initialLevel,
    groupingEnabled: CONFIG.grouping.enabled,
    searchResults: [],        
    currentSearchIndex: -1,   
    searchTerm: '',           
    lastClickedNode: null,    
    nodePaths: new Map()      
};
function initializeEditor() {
    state.editor = ace.edit("editor");
    state.editor.setTheme(CONFIG.editor.theme);
    state.editor.session.setMode(CONFIG.editor.mode);
    state.editor.setOptions({
        fontSize: CONFIG.editor.fontSize,
        showPrintMargin: false,
        showGutter: true,
        highlightActiveLine: true,
        wrap: true,
        vScrollBarAlwaysVisible: true,
        hScrollBarAlwaysVisible: false,
        scrollPastEnd: 0.5,
        animatedScroll: true,
        fadeFoldWidgets: true,
        showFoldWidgets: true
    });
    const LINE_LIMIT = 50000;
    state.editor.getSession().on('change', function (e) {
        const lineCount = state.editor.session.getLength();
        if (lineCount > LINE_LIMIT) {
            state.editor.session.getUndoManager().undo(true);
            showLimitAlert(LINE_LIMIT);
            return;
        }
        debounceVisualization();
    });
    const debounceVisualization = debounce(() => {
        try {
            const content = state.editor.getValue().trim();
            if (content) {
                updateVisualization(JSON.parse(content));
            } else {
                clearVisualization();
            }
        } catch (e) {
            console.log("Aguardando JSON válido...");
        }
    }, CONFIG.debounceDelay);
    state.editor.container.addEventListener('paste', function (e) {
        const clipboardData = e.clipboardData || window.clipboardData;
        const pastedText = clipboardData.getData('text');
        if (!pastedText) return;
        const pastedLines = pastedText.split('\n').length;
        const currentLines = state.editor.session.getLength();
        if ((currentLines + pastedLines - 1) > LINE_LIMIT) {
            e.preventDefault();
            e.stopPropagation();
            showLimitAlert(LINE_LIMIT);
        }
    });
    customizeEditorAppearance();
}
/**
 * Apply custom styling to editor elements that can't be controlled via CSS
 */
function customizeEditorAppearance() {
    setTimeout(() => {
        const editorElement = document.getElementById('editor');
        if (editorElement) {
            editorElement.classList.add('custom-scrollbar');
            const scrollbars = editorElement.querySelectorAll('.ace_scrollbar');
            scrollbars.forEach(scrollbar => {
                scrollbar.classList.add('custom-ace-scrollbar');
            });
        }
        const gutter = document.querySelector('.ace_gutter');
        if (gutter) {
            gutter.style.backgroundColor = '#1a1a1a';
            gutter.style.color = '#6b7280';
        }
    }, 100);
}
/**
 * Show an alert popup when content exceeds line limit
 * @param {number} limit - The maximum number of lines allowed
 */
function showLimitAlert(limit) {
    const modal = document.createElement('div');
    modal.className = 'limit-alert-modal';
    modal.innerHTML = `
        <div class="limit-alert-content">
            <h3>Limite de linhas excedido</h3>
            <p>O editor tem um limite máximo de ${limit.toLocaleString()} linhas.</p>
            <p>Por favor, reduza o tamanho do conteúdo e tente novamente.</p>
            <button id="limit-alert-close">OK</button>
        </div>
    `;
    const styleTag = document.createElement('style');
    if (!document.getElementById('limit-alert-styles')) {
        styleTag.id = 'limit-alert-styles';
        styleTag.textContent = `
            .limit-alert-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 9999;
            }
            .limit-alert-content {
                background-color: #282c34;
                color: #e6e6e6;
                border-radius: 8px;
                padding: 20px 30px;
                max-width: 400px;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
                text-align: center;
            }
            .limit-alert-content h3 {
                color: #f44336;
                margin-top: 0;
            }
            .limit-alert-content button {
                background-color: #4a5568;
                color: white;
                border: none;
                padding: 8px 20px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
                margin-top: 10px;
                transition: background-color 0.2s;
            }
            .limit-alert-content button:hover {
                background-color: #2d3748;
            }
        `;
        document.head.appendChild(styleTag);
    }
    document.body.appendChild(modal);
    document.getElementById('limit-alert-close').addEventListener('click', function () {
        state.editor.setValue("");
        clearVisualization();
        showFileFeedback('info', 'Editor limpo devido ao excesso de linhas.');
        document.body.removeChild(modal);
    });
    setTimeout(() => {
        if (document.body.contains(modal)) {
            document.body.removeChild(modal);
        }
    }, 5000);
}
/**
 * Display feedback toast for file operations
 * @param {string} type - Type of feedback: 'loading', 'success', 'error', or 'info'
 * @param {string} message - Message to display
 */
function showFileFeedback(type, message) {
    let feedbackEl = document.getElementById('fileFeedback');
    if (!feedbackEl) {
        feedbackEl = document.createElement('div');
        feedbackEl.id = 'fileFeedback';
        feedbackEl.className = 'file-feedback';
        document.body.appendChild(feedbackEl);
    }
    let icon = '';
    switch (type) {
        case 'loading':
            icon = '<div class="spinner" style="width: 16px; height: 16px;"></div>';
            feedbackEl.className = 'file-feedback show';
            break;
        case 'success':
            icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
            feedbackEl.className = 'file-feedback show success';
            break;
        case 'error':
            icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
            feedbackEl.className = 'file-feedback show error';
            break;
        case 'info':
            icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
            feedbackEl.className = 'file-feedback show info';
            break;
    }
    feedbackEl.innerHTML = `
        <div class="file-feedback-icon">${icon}</div>
        <div class="file-feedback-message">${message}</div>
    `;
    if (type !== 'loading') {
        setTimeout(() => {
            feedbackEl.classList.remove('show');
        }, 3000);
    }
}
/**
 * Completely rewrites the visualization SVG element to fix rendering artifacts
 */
function initializeVisualization() {
    d3.select("#visualizer").selectAll("svg").remove();
    state.svg = d3.select("#visualizer")
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("class", "visualization-svg")
        .style("display", "block"); 
    state.svg.append("defs")
        .append("pattern")
        .attr("id", "grid-pattern")
        .attr("width", 20)
        .attr("height", 20)
        .attr("patternUnits", "userSpaceOnUse")
        .append("path")
        .attr("d", "M 20 0 L 0 0 0 20")
        .attr("class", "grid-pattern");
    state.svg.append("rect")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("class", "grid")
        .style("fill", "url(#grid-pattern)")
        .style("pointer-events", "none"); 
    state.mainGroup = state.svg.append("g")
        .attr("class", "main-group")
        .append("rect")
        .attr("width", "200%")  
        .attr("height", "200%")
        .attr("x", "-50%")      
        .attr("y", "-50%")
        .attr("fill", "none")   
        .attr("pointer-events", "all"); 
    state.mainGroup = state.svg.select(".main-group")
        .append("g")
        .attr("class", "content-group");
    state.zoom = d3.zoom()
        .filter(event => {
            return !event.ctrlKey && !event.button && event.type !== 'dblclick';
        })
        .on("start", () => {
            d3.select("#visualizer").classed("is-zooming", true);
        })
        .on("zoom", event => {
            requestAnimationFrame(() => {
                state.mainGroup.attr("transform", event.transform);
                updateZoomLevel(event.transform.k);
            });
        })
        .on("end", () => {
            d3.select("#visualizer").classed("is-zooming", false);
        })
        .scaleExtent([0.1, 8]); 
    state.svg.call(state.zoom);
}
function initializeResizer() {
    const leftPanel = document.querySelector('.left-panel');
    const resizer = document.querySelector('.resizer');
    const container = document.querySelector('.container');
    let isResizing = false;
    let startX, startWidth;
    let animationFrameId = null;
    function onMouseMove(e) {
        if (!isResizing) return;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        animationFrameId = requestAnimationFrame(() => {
            const dx = e.pageX - startX;
            const newWidth = startWidth + dx;
            const containerWidth = container.offsetWidth;
            if (newWidth >= 200 && newWidth <= containerWidth * 0.8) {
                leftPanel.style.width = `${newWidth}px`;
                if (state.editor) state.editor.resize();
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
function initializeEventListeners() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(searchDiagram, 300));
        searchInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                    navigatePreviousResult();
                } else {
                    navigateNextResult();
                }
            }
        });
    }
    document.addEventListener('click', function (event) {
        const menu = document.getElementById('settings-menu');
        const button = document.querySelector('.settings-button');
        if (menu && button && !menu.contains(event.target) && !button.contains(event.target)) {
            menu.classList.remove('show');
            button.classList.remove('active');
        }
    });
    if (!document.getElementById('toggleGrouping')) {
        const controlsContainer = document.querySelector('.controls');
        if (controlsContainer) {
            const groupingBtn = document.createElement('button');
            groupingBtn.id = 'toggleGrouping';
            groupingBtn.className = 'control-button' + (state.groupingEnabled ? ' active' : '');
            groupingBtn.textContent = state.groupingEnabled ? 'Disable Grouping' : 'Enable Grouping';
            groupingBtn.title = 'Toggle property grouping to reduce node count';
            groupingBtn.onclick = toggleGrouping;
            controlsContainer.appendChild(groupingBtn);
        }
    }
    initializeKeyboardShortcuts();
}
function updateVisualization(data, shouldAnimate = true) {
    clearVisualization();
    state.measurementCache.clear();
    const root = d3.hierarchy(transformData(data));
    root.descendants().forEach(d => {
        const nodeId = createNodeId(d);
        if (state.collapsedNodes.has(nodeId)) {
            d._children = d.children;
            d.children = null;
        }
    });
    root.descendants().forEach(d => {
        d.nodeWidth = getNodeWidth(d);
        d.nodeHeight = getNodeHeight(d);
    });
    customTreeLayout(root);
    fixAllOverlaps(root);
    renderLinks(root);
    renderNodes(root);
    if (shouldAnimate) fitContent();
}
/**
 * Custom tree layout that better handles varying node sizes with even tighter spacing
 * @param {Object} root - The hierarchy root node
 */
function customTreeLayout(root) {
    const treeLayout = d3.tree()
        .nodeSize([
            CONFIG.layout.nodeSpacingY * 0.95, 
            CONFIG.layout.nodeSpacingX * 0.9   
        ])
        .separation(function (a, b) {
            const nodeWidthA = a.nodeWidth || 180;
            const nodeWidthB = b.nodeWidth || 180;
            return Math.max(1.05, (nodeWidthA + nodeWidthB) / (CONFIG.layout.nodeSpacingX * 1.5));
        });
    treeLayout(root);
    const maxDepth = d3.max(root.descendants(), d => d.depth);
    const levelWidth = new Array(maxDepth + 1).fill(0);
    root.descendants().forEach(d => {
        levelWidth[d.depth] = Math.max(levelWidth[d.depth] || 0, d.nodeWidth);
    });
    const xPositions = [0];
    for (let i = 0; i < maxDepth; i++) {
        const minGap = Math.max(
            CONFIG.layout.nodeSpacingX * 0.7,  
            (levelWidth[i] + levelWidth[i + 1]) / 2 + 20 
        );
        xPositions.push(xPositions[i] + minGap);
    }
    root.descendants().forEach(d => {
        d.y = xPositions[d.depth];
    });
}
/**
 * Fix all types of overlaps with absolute minimum spacing
 * @param {Object} root - The hierarchy root node
 */
function fixAllOverlaps(root) {
    const nodesByDepth = {};
    root.descendants().forEach(node => {
        if (!nodesByDepth[node.depth]) {
            nodesByDepth[node.depth] = [];
        }
        nodesByDepth[node.depth].push(node);
    });
    Object.keys(nodesByDepth).forEach(depth => {
        const nodes = nodesByDepth[depth].sort((a, b) => a.x - b.x);
        for (let i = 1; i < nodes.length; i++) {
            const prevNode = nodes[i - 1];
            const currNode = nodes[i];
            const minSeparation = (prevNode.nodeHeight / 2 + currNode.nodeHeight / 2) + 10; 
            if (currNode.x - prevNode.x < minSeparation) {
                const delta = minSeparation - (currNode.x - prevNode.x);
                shiftSubtreeVertical(currNode, delta);
            }
        }
    });
    fixBranchOverlaps(root, 15); 
}
/**
 * Fix overlaps between different branches with minimal spacing
 * @param {Object} root - The hierarchy root node
 * @param {number} padding - Extra space between nodes
 */
function fixBranchOverlaps(root, padding = 20) {
    const nodeBounds = [];
    root.descendants().forEach(node => {
        nodeBounds.push({
            node: node,
            left: node.y - node.nodeWidth / 2,
            right: node.y + node.nodeWidth / 2,
            top: node.x - node.nodeHeight / 2,
            bottom: node.x + node.nodeHeight / 2
        });
    });
    let overlapsFixed = 0;
    let iterations = 0;
    const MAX_ITERATIONS = 10; 
    do {
        overlapsFixed = 0;
        iterations++;
        for (let i = 0; i < nodeBounds.length; i++) {
            for (let j = i + 1; j < nodeBounds.length; j++) {
                const a = nodeBounds[i];
                const b = nodeBounds[j];
                if (isAncestorOf(a.node, b.node) || isAncestorOf(b.node, a.node)) {
                    continue;
                }
                if (!(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom)) {
                    const branchToShift = getBranchToShift(a.node, b.node);
                    const verticalOverlap = Math.min(a.bottom - b.top, b.bottom - a.top);
                    const shift = verticalOverlap + padding; 
                    shiftSubtreeVertical(branchToShift, shift);
                    updateSubtreeBounds(branchToShift, nodeBounds, shift);
                    overlapsFixed++;
                }
            }
        }
    } while (overlapsFixed > 0 && iterations < MAX_ITERATIONS);
}
/**
 * Determine which branch should be shifted to resolve an overlap
 * @param {Object} nodeA - First node
 * @param {Object} nodeB - Second node
 * @returns {Object} The node whose branch should be shifted
 */
function getBranchToShift(nodeA, nodeB) {
    if (nodeA.depth > nodeB.depth) return nodeA;
    if (nodeB.depth > nodeA.depth) return nodeB;
    const sizeA = getSubtreeSize(nodeA);
    const sizeB = getSubtreeSize(nodeB);
    return sizeA <= sizeB ? nodeA : nodeB;
}
/**
 * Count the number of nodes in a subtree
 * @param {Object} node - The root node of the subtree
 * @returns {number} The count of nodes in the subtree
 */
function getSubtreeSize(node) {
    let size = 1;
    if (node.children) {
        node.children.forEach(child => {
            size += getSubtreeSize(child);
        });
    }
    return size;
}
/**
 * Check if nodeA is an ancestor of nodeB
 * @param {Object} nodeA - Potential ancestor node
 * @param {Object} nodeB - Potential descendant node
 * @returns {boolean} True if nodeA is an ancestor of nodeB
 */
function isAncestorOf(nodeA, nodeB) {
    let current = nodeB.parent;
    while (current) {
        if (current === nodeA) return true;
        current = current.parent;
    }
    return false;
}
/**
 * Shift a subtree vertically by a delta amount
 * @param {Object} node - The node to shift
 * @param {number} delta - The amount to shift by
 */
function shiftSubtreeVertical(node, delta) {
    node.x += delta;
    if (node.children) {
        node.children.forEach(child => {
            shiftSubtreeVertical(child, delta);
        });
    }
}
/**
 * Update the bounds of all nodes in a subtree after shifting
 * @param {Object} node - The shifted node
 * @param {Array} nodeBounds - Array of node bounds
 * @param {number} delta - The amount shifted
 */
function updateSubtreeBounds(node, nodeBounds, delta) {
    const updateNode = (currentNode) => {
        const bound = nodeBounds.find(b => b.node === currentNode);
        if (bound) {
            bound.top += delta;
            bound.bottom += delta;
        }
        if (currentNode.children) {
            currentNode.children.forEach(child => {
                updateNode(child);
            });
        }
    };
    updateNode(node);
}
/**
 * More precise node rendering with better alignment
 */
function renderNodes(root) {
    state.mainGroup.selectAll(".node").remove();
    const nodes = state.mainGroup.selectAll(".node")
        .data(root.descendants(), d => `node-${d.data.name}-${d.depth}`)
        .join("g")
        .attr("class", "node")
        .attr("id", d => `node-${d.data.name}-${d.depth}`)
        .attr("transform", d => `translate(${d.y},${d.x})`) 
        .attr("opacity", 1); 
    nodes.append("rect")
        .attr("class", "node-bg")
        .attr("x", d => -(d.nodeWidth / 2))
        .attr("y", d => -(d.nodeHeight / 2))
        .attr("width", d => d.nodeWidth)
        .attr("height", d => d.nodeHeight)
        .attr("rx", CONFIG.node.borderRadius)
        .attr("ry", CONFIG.node.borderRadius)
        .attr("fill", "transparent")
        .attr("pointer-events", "all"); 
    const foreignObjects = nodes.append("foreignObject")
        .attr("x", d => -(d.nodeWidth / 2))
        .attr("y", d => -(d.nodeHeight / 2))
        .attr("width", d => d.nodeWidth)
        .attr("height", d => d.nodeHeight)
        .attr("pointer-events", "none");
    foreignObjects.append("xhtml:div")
        .attr("class", "node-card")
        .style("width", "100%")
        .style("height", "100%")
        .style("box-sizing", "border-box")
        .style("overflow", "hidden")
        .style("display", "flex")
        .style("align-items", "center")
        .style("justify-content", "center")
        .style("pointer-events", "auto") 
        .html(d => createNodeContent(d));
    nodes
        .on("mouseover", function () {
            d3.select(this).classed("node-hover", true);
        })
        .on("mouseout", function () {
            d3.select(this).classed("node-hover", false);
        });
    nodes.on("click", function (event, d) {
        if (!event.target.closest('.node-toggle-button')) {
            handleNodeClick(d);
        }
    });
    attachToggleButtonListeners();
}
/**
 * Attach event listeners to all toggle buttons in the visualization
 * This ensures buttons respond immediately to clicks
 */
function attachToggleButtonListeners() {
    document.querySelectorAll('.node-toggle-button').forEach(button => {
        const newButton = button.cloneNode(true);
        if (button.parentNode) {
            button.parentNode.replaceChild(newButton, button);
        }
        const buttonId = newButton.id;
        if (buttonId && buttonId.startsWith('toggle-')) {
            const nodeId = buttonId.substring(7); 
            newButton.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                toggleNode(nodeId, event);
            }, true); 
        }
    });
}
function createNodeContent(d) {
    const content = ['<div class="node-container">'];
    const nodeId = createNodeId(d); 
    if (d.data.isGroupNode) {
        content.push(`<div class="node-header"><span class="node-name">${d.data.name}</span></div>`);
        content.push('<div class="group-properties">');
        d.data.properties.forEach(prop => {
            content.push(`
                <div class="group-property">
                    <span class="node-key">${prop.name}:</span>
                    <span class="${getValueClass(prop.type)}">${formatValue(prop.value, prop.type)}</span>
                </div>
            `);
        });
        content.push('</div>');
    } else if (d.data.children || d._children) {
        const isCollapsed = state.collapsedNodes.has(nodeId);
        const childCount = d._children ? d._children.length : (d.children ? d.children.length : 0);
        content.push(`
            <div class="node-header with-toggle">
                <div class="node-title-section">
                    <span class="node-name">${d.data.name}</span>
                    <span class="node-count">[${childCount}]</span>
                </div>
<button class="node-toggle-button" id="toggle-${encodeURIComponent(nodeId)}" type="button" title="${isCollapsed ? 'Expand' : 'Collapse'}">
    ${isCollapsed
                ? `<svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http:
            <g opacity="0.8">
                <path d="M56.3333 39H62.8333C64.256 39 65.6647 39.2802 66.9791 39.8246C68.2934 40.3691 69.4877 41.167 70.4937 42.173C71.4996 43.179 72.2976 44.3732 72.842 45.6876C73.3865 47.002 73.6667 48.4107 73.6667 49.8333C73.6667 51.256 73.3865 52.6647 72.842 53.9791C72.2976 55.2934 71.4996 56.4877 70.4937 57.4937C69.4877 58.4996 68.2934 59.2976 66.9791 59.842C65.6647 60.3865 64.256 60.6667 62.8333 60.6667L62 61.5M43.3333 60.6667H36.8333C35.4107 60.6667 34.002 60.3865 32.6876 59.842C31.3732 59.2976 30.179 58.4996 29.173 57.4937C27.1414 55.462 26 52.7065 26 49.8333C26 46.9602 27.1414 44.2047 29.173 42.173C31.2047 40.1414 33.9602 39 36.8333 39H39M41.1667 49.8333H58.5" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M34 33C34.4 33.4 53.5 53.5 67.5 67.5" stroke="white" stroke-width="5" stroke-linecap="round"/>
            </g>
          </svg>`
                : `<svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http:
            <g opacity="0.8">
                <path d="M56.3333 39H62.8333C64.256 39 65.6647 39.2802 66.9791 39.8246C68.2934 40.3691 69.4877 41.167 70.4937 42.173C71.4996 43.179 72.2976 44.3732 72.842 45.6876C73.3865 47.002 73.6667 48.4107 73.6667 49.8333C73.6667 51.256 73.3865 52.6647 72.842 53.9791C72.2976 55.2934 71.4996 56.4877 70.4937 57.4937C69.4877 58.4996 68.2934 59.2976 66.9791 59.842C65.6647 60.3865 64.256 60.6667 62.8333 60.6667H56.3333M43.3333 60.6667H36.8333C35.4107 60.6667 34.002 60.3865 32.6876 59.842C31.3732 59.2976 30.179 58.4996 29.173 57.4937C27.1414 55.462 26 52.7065 26 49.8333C26 46.9602 27.1414 44.2047 29.173 42.173C31.2047 40.1414 33.9602 39 36.8333 39H43.3333M41.1667 49.8333H58.5" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
            </g>
          </svg>`
            }
</button>
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
/**
 * More robust rendering of links to prevent artifacts
 */
function renderLinks(root) {
    state.mainGroup.selectAll(".link").remove();
    state.mainGroup.selectAll(".link")
        .data(root.links(), d => `link-${d.source.data.name}-${d.target.data.name}`)
        .join("path")
        .attr("class", "link")
        .attr("id", d => `link-${d.source.data.name}-${d.target.data.name}`)
        .attr("d", function (d) {
            const sourceX = d.source.y; 
            const sourceY = d.source.x;
            const targetX = d.target.y;
            const targetY = d.target.x;
            const sourceRight = sourceX + d.source.nodeWidth / 2;
            const targetLeft = targetX - d.target.nodeWidth / 2;
            const midX = sourceRight + (targetLeft - sourceRight) * 0.5;
            return `
                M ${sourceRight},${sourceY}
                C ${midX},${sourceY}
                  ${midX},${targetY}
                  ${targetLeft},${targetY}
            `;
        })
        .attr("stroke", "#4a5568")
        .attr("stroke-width", 1.5)
        .attr("fill", "none")
        .attr("shape-rendering", "geometricPrecision"); 
}
function clearVisualization() {
    if (state.mainGroup) {
        state.mainGroup.selectAll("*:not(.content-group)").remove();
        state.mainGroup.attr("transform", "translate(0,0)scale(1)");
    }
}
function createHighlightedNodeContent(d, searchTerm) {
    const content = ['<div class="node-container">'];
    const nodeId = createNodeId(d); 
    if (d.data.isGroupNode) {
        content.push(`<div class="node-header"><span class="node-name">${highlightText(d.data.name, searchTerm)}</span></div>`);
        content.push('<div class="group-properties">');
        d.data.properties.forEach(prop => {
            content.push(`
                <div class="group-property">
                    <span class="node-key">${highlightText(prop.name, searchTerm)}:</span>
                    <span class="${getValueClass(prop.type)}">${highlightText(formatValue(prop.value, prop.type), searchTerm)}</span>
                </div>
            `);
        });
        content.push('</div>');
    } else if (d.data.children || d._children) {
        const isCollapsed = state.collapsedNodes.has(nodeId);
        const childCount = d._children ? d._children.length : (d.children ? d.children.length : 0);
        content.push(`
            <div class="node-header with-toggle">
                <div class="node-title-section">
                    <span class="node-name">${highlightText(d.data.name, searchTerm)}</span>
                    <span class="node-count">[${childCount}]</span>
                </div>
                <button class="node-toggle-button" id="toggle-${encodeURIComponent(nodeId)}" type="button" title="${isCollapsed ? 'Expand' : 'Collapse'}">
                    <svg class="toggle-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        ${isCollapsed
                ? '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>' 
                : '<line x1="5" y1="12" x2="19" y2="12"></line>' 
            }
                    </svg>
                </button>
            </div>
        `);
    } else {
        content.push(`
            <div class="node-content">
                <span class="node-key">${highlightText(d.data.name, searchTerm)}:</span>
                <span class="${getValueClass(d.data.type)}">${highlightText(formatValue(d.data.value, d.data.type), searchTerm)}</span>
            </div>
        `);
    }
    content.push('</div>');
    return content.join('');
}
function getNodeWidth(d) {
    const cacheKey = `width-${d.data.name}-${d.data.isGroupNode ? 'group' : d.data.value || ''}-${d.data.children?.length || 0}-${d.data.weight || 1}`;
    if (state.measurementCache.has(cacheKey)) return state.measurementCache.get(cacheKey);
    const temp = document.createElement('div');
    temp.style.cssText = `
        position: absolute;
        visibility: hidden;
        white-space: nowrap;
        font-family: ${CONFIG.font.family};
        font-size: ${CONFIG.font.size};
        padding: 15px;
        box-sizing: border-box;
        border: 1px solid transparent;
    `;
    document.body.appendChild(temp);
    if (d.data.isGroupNode) {
        temp.textContent = d.data.name;
        let maxWidth = temp.offsetWidth;
        d.data.properties.forEach(prop => {
            temp.textContent = `${prop.name}: ${prop.value}`;
            maxWidth = Math.max(maxWidth, temp.offsetWidth);
        });
        const width = Math.max(CONFIG.node.minWidth, maxWidth + 40); 
        document.body.removeChild(temp);
        state.measurementCache.set(cacheKey, width);
        return width;
    } else {
        if (d.data.children || d._children) {
            const childCount = d._children ? d._children.length : (d.children ? d.children.length : 0);
            temp.textContent = `${d.data.name} [${childCount}]`;
        } else {
            temp.textContent = `${d.data.name}: ${d.data.value || ''}`;
        }
        const width = Math.max(CONFIG.node.minWidth, temp.offsetWidth + 40); 
        document.body.removeChild(temp);
        state.measurementCache.set(cacheKey, width);
        return width;
    }
}
/**
 * More accurately calculate node height with extra padding for aesthetics
 */
function getNodeHeight(d) {
    const cacheKey = `height-${d.data.name}-${d.data.isGroupNode ? 'group' : d.data.value || ''}-${d.data.children?.length || 0}`;
    if (state.measurementCache.has(cacheKey)) return state.measurementCache.get(cacheKey);
    const temp = document.createElement('div');
    temp.style.cssText = `
        position: absolute;
        visibility: hidden;
        font-family: ${CONFIG.font.family};
        font-size: ${CONFIG.font.size};
        padding: 5px;
        box-sizing: border-box;
        border: 1px solid transparent;
        display: inline-block;
    `;
    document.body.appendChild(temp);
    if (d.data.isGroupNode) {
        temp.innerHTML = `<div>${d.data.name}</div>`;
        let height = temp.offsetHeight; 
        d.data.properties.forEach(prop => {
            temp.innerHTML = `<div>${prop.name}: ${prop.value}</div>`;
            height += temp.offsetHeight; 
        });
        height += 20; 
        document.body.removeChild(temp);
        state.measurementCache.set(cacheKey, height);
        return height;
    } else {
        const width = getNodeWidth(d) - 30; 
        temp.style.width = `${width}px`;
        temp.style.whiteSpace = 'normal'; 
        if (d.data.children || d._children) {
            const childCount = d._children ? d._children.length : (d.children ? d.children.length : 0);
            temp.textContent = `${d.data.name} [${childCount}]`;
        } else {
            temp.textContent = `${d.data.name}: ${d.data.value || ''}`;
        }
        const height = Math.max(CONFIG.node.baseHeight, temp.offsetHeight + 16); 
        document.body.removeChild(temp);
        state.measurementCache.set(cacheKey, height);
        return height;
    }
}
function transformData(data, key = "root", depth = 0) {
    if (data === null) return { name: key, type: "null", value: "null" };
    const type = Array.isArray(data) ? "array" : typeof data;
    if (type !== "object" && type !== "array") {
        return { name: key, type: type, value: String(data) };
    }
    const entries = Object.entries(data);
    if (state.groupingEnabled && type === "object" && depth > 0 && entries.length > 1) {
        const complexProps = [];
        const simpleProps = [];
        entries.forEach(([k, v]) => {
            const propType = Array.isArray(v) ? "array" : typeof v;
            const isSimple = propType !== "object" && propType !== "array";
            const isExcluded = CONFIG.grouping.excludeFromGrouping.includes(k);
            if (isSimple && !isExcluded) {
                simpleProps.push([k, v, propType]);
            } else {
                complexProps.push([k, v]);
            }
        });
        const children = [];
        if (simpleProps.length > 0 && simpleProps.length <= CONFIG.grouping.maxPropertiesPerNode) {
            const groupNode = {
                name: `${key} Properties`,
                type: "group",
                isGroupNode: true,
                properties: simpleProps.map(([k, v, t]) => ({
                    name: k,
                    value: String(v),
                    type: t
                }))
            };
            children.push(groupNode);
        } else if (simpleProps.length > CONFIG.grouping.maxPropertiesPerNode) {
            const groups = [];
            for (let i = 0; i < simpleProps.length; i += CONFIG.grouping.maxPropertiesPerNode) {
                const batch = simpleProps.slice(i, i + CONFIG.grouping.maxPropertiesPerNode);
                const groupNode = {
                    name: `${key}  ${Math.floor(i / CONFIG.grouping.maxPropertiesPerNode) + 1}`,
                    type: "group",
                    isGroupNode: true,
                    properties: batch.map(([k, v, t]) => ({
                        name: k,
                        value: String(v),
                        type: t
                    }))
                };
                children.push(groupNode);
            }
        } else {
            simpleProps.forEach(([k, v, t]) => {
                children.push({ name: k, type: t, value: String(v) });
            });
        }
        complexProps.forEach(([k, v]) => {
            children.push(transformData(v, k, depth + 1));
        });
        return {
            name: key,
            type: type,
            children: children,
            collapsed: false,
            value: type === "array" ? `${entries.length} items` : `${entries.length} props`
        };
    }
    const children = entries.map(([k, v]) => {
        const child = transformData(v, k, depth + 1);
        child.weight = getNodeComplexity(v);
        return child;
    });
    return {
        name: key,
        type: type,
        children: children,
        collapsed: false,
        value: type === "array" ? `${entries.length} items` : `${entries.length} props`,
        weight: getNodeComplexity(data)
    };
}
function getNodeComplexity(data) {
    if (data === null || data === undefined) return 1;
    if (typeof data !== 'object') return 1;
    const isArray = Array.isArray(data);
    const entries = Object.entries(data);
    if (entries.length === 0) return 1;
    return entries.length;
}
function createNodeId(node) {
    let parts = [node.data.name];
    let current = node;
    while (current.parent && current.parent.data.name !== "root") {
        parts.unshift(current.parent.data.name);
        current = current.parent;
    }
    if (parts.length > 5) {
        const firstParts = parts.slice(0, 2);
        const lastParts = parts.slice(-3);
        parts = [...firstParts, "...", ...lastParts];
    }
    return `${parts.join("/")}|${node.depth}`;
}
function toggleNode(nodeId, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
    }
    try {
        console.log("Toggle node triggered for:", nodeId); 
        nodeId = decodeURIComponent(nodeId);
        const currentTransform = d3.zoomTransform(state.svg.node());
        const wasCollapsed = state.collapsedNodes.has(nodeId);
        if (wasCollapsed) {
            state.collapsedNodes.delete(nodeId);
            console.log("Node expanded:", nodeId);
        } else {
            state.collapsedNodes.set(nodeId, true);
            console.log("Node collapsed:", nodeId);
        }
        updateVisualization(JSON.parse(state.editor.getValue()), false);
        state.svg.call(state.zoom.transform, currentTransform);
    } catch (error) {
        console.error("Error toggling node:", error);
    }
}
function collapseAll() {
    d3.selectAll('.node').data().forEach(node => {
        if (node.data.children) {
            const nodeId = createNodeId(node);
            state.collapsedNodes.set(nodeId, true);
        }
    });
    updateVisualization(JSON.parse(state.editor.getValue()), false);
}
function expandAll() {
    state.collapsedNodes.clear();
    updateVisualization(JSON.parse(state.editor.getValue()), false);
}
function handleEditorAction(action) {
    if (action === "import") {
        document.getElementById('jsonFileInput').click();
    }
}
function handleCollapseToggle(isChecked) {
    if (isChecked) {
        collapseAll();
        resetZoom();
    } else {
        expandAll();
        fitContent();
    }
}
function updateZoomLevel(scale) {
    state.currentZoom = scale;
    const percentage = Math.round(scale * 100);
    document.getElementById('zoomLevel').textContent = `${percentage}%`;
}

function zoomIn() {
    state.svg.transition()
        .duration(CONFIG.zoom.duration)
        .call(state.zoom.scaleBy, CONFIG.zoom.scale)
        .on("start", () => {
            d3.select("#visualizer").classed("is-zooming", true);
        })
        .on("end", () => {
            d3.select("#visualizer").classed("is-zooming", false);
            updateZoomLevel(state.currentZoom * CONFIG.zoom.scale);
        });
}
function zoomOut() {
    state.svg.transition()
        .duration(CONFIG.zoom.duration)
        .call(state.zoom.scaleBy, 1 / CONFIG.zoom.scale)
        .on("start", () => {
            d3.select("#visualizer").classed("is-zooming", true);
        })
        .on("end", () => {
            d3.select("#visualizer").classed("is-zooming", false);
            updateZoomLevel(state.currentZoom / CONFIG.zoom.scale);
        });
}
function resetZoom() {
    const rootNode = d3.select('.node').datum();
    if (!rootNode) return;
    const scale = 1.2;
    const parent = state.svg.node().getBoundingClientRect();
    const transform = d3.zoomIdentity
        .translate(
            parent.width / 2 - rootNode.y,
            parent.height / 2 - rootNode.x
        )
        .scale(scale);
    state.svg.transition()
        .duration(CONFIG.zoom.duration)
        .call(state.zoom.transform, transform)
        .on("start", () => {
            d3.select("#visualizer").classed("is-zooming", true);
        })
        .on("end", () => {
            d3.select("#visualizer").classed("is-zooming", false);
            updateZoomLevel(scale);
        });
}
function fitContent() {
    const bounds = state.mainGroup.node().getBBox();
    const parent = state.svg.node().getBoundingClientRect();
    const fullWidth = parent.width;
    const fullHeight = parent.height;
    if (bounds.width === 0 || bounds.height === 0) return;
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
    state.svg.transition()
        .duration(750)
        .call(state.zoom.transform, transform)
        .on("start", () => {
            d3.select("#visualizer").classed("is-zooming", true);
        })
        .on("end", () => {
            d3.select("#visualizer").classed("is-zooming", false);
            updateZoomLevel(scale);
        });
}

function handleResize() {
    if (state.editor) {
        state.editor.resize();
    }
    if (state.svg) {
        if (state.editor && state.editor.getValue().trim()) {
            try {
                const data = JSON.parse(state.editor.getValue());
                const collapsedNodes = new Map(state.collapsedNodes);
                initializeVisualization();
                state.collapsedNodes = collapsedNodes;
                updateVisualization(data, true);
            } catch (e) {
                console.error("Error redrawing visualization:", e);
            }
        } else {
            initializeVisualization();
        }
    }
}

function searchDiagram() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput.value.toLowerCase().trim();
    state.searchResults = [];
    state.currentSearchIndex = -1;
    state.searchTerm = searchTerm;
    const nodes = d3.selectAll('.node');
    if (!searchTerm) {
        clearSearch(nodes);
        document.getElementById('resultCount').textContent = '';
        document.getElementById('resultNavigation').style.display = 'none';
        return;
    }
    nodes.each(function (d) {
        const node = d3.select(this);
        let searchString = '';
        if (d.data.isGroupNode && d.data.properties) {
            searchString = d.data.name + ' ' +
                d.data.properties.map(p => p.name + ' ' + p.value).join(' ');
        } else {
            searchString = (d.data.name + ' ' + (d.data.value || '')).toLowerCase();
        }
        const isMatch = searchString.toLowerCase().includes(searchTerm);
        node.classed('node-highlight', isMatch);
        if (isMatch) {
            state.searchResults.push(d);
            node.select('.node-card')
                .html(() => createHighlightedNodeContent(d, searchTerm));
        } else {
            node.select('.node-card')
                .html(() => createNodeContent(d));
        }
    });
    const resultCount = document.getElementById('resultCount');
    const count = state.searchResults.length;
    resultCount.textContent = count > 0
        ? `${count} resultado${count !== 1 ? 's' : ''} encontrado${count !== 1 ? 's' : ''}`
        : 'Nenhum resultado encontrado';
    updateSearchNavigation();
    if (count > 0) {
        navigateToSearchResult(0);
    }
}

function clearSearch(nodes) {
    nodes.classed('node-highlight', false);
    nodes.classed('current-result', false);
    nodes.each(function (d) {
        d3.select(this).select('.node-card').html(() => createNodeContent(d));
    });
    state.searchResults = [];
    state.currentSearchIndex = -1;
    state.searchTerm = '';
    const resultCount = document.getElementById('resultCount');
    if (resultCount) resultCount.textContent = '';
    const navElement = document.getElementById('resultNavigation');
    if (navElement) navElement.style.display = 'none';
}

function updateSearchNavigation() {
    const count = state.searchResults.length;
    const navElement = document.getElementById('resultNavigation') || createSearchNavigationElement();
    if (count <= 1) {
        navElement.style.display = 'none';
        return;
    }
    navElement.style.display = 'flex';
    const currentIndex = state.currentSearchIndex + 1; 
    document.getElementById('currentResult').textContent = currentIndex;
    document.getElementById('totalResults').textContent = count;
}

function createSearchNavigationElement() {
    if (document.getElementById('resultNavigation')) {
        return document.getElementById('resultNavigation');
    }
    const searchContainer = document.querySelector('.search-container');
    const navElement = document.createElement('div');
    navElement.id = 'resultNavigation';
    navElement.className = 'result-navigation';
    navElement.style.display = 'none';
    navElement.innerHTML = `
        <button id="prevResult" class="nav-button" title="Previous result (Shift+Enter)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
        </button>
        <div class="result-counter">
            <span id="currentResult">0</span>/<span id="totalResults">0</span>
        </div>
        <button id="nextResult" class="nav-button" title="Next result (Enter)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
        </button>
    `;
    searchContainer.appendChild(navElement);
    document.getElementById('prevResult').addEventListener('click', () => {
        navigatePreviousResult();
    });
    document.getElementById('nextResult').addEventListener('click', () => {
        navigateNextResult();
    });
    if (!document.getElementById('search-nav-styles')) {
        const styleTag = document.createElement('style');
        styleTag.id = 'search-nav-styles';
        styleTag.textContent = `
            .result-navigation {
                display: flex;
                align-items: center;
                margin-left: 10px;
                gap: 5px;
            }
            .nav-button {
                background: transparent;
                border: 1px solid #4a5568;
                border-radius: 4px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 2px;
            }
            .nav-button:hover {
                background-color: rgba(74, 85, 104, 0.2);
            }
            .result-counter {
                font-size: 12px;
                color: #e2e8f0;
                padding: 0 5px;
            }
        `;
        document.head.appendChild(styleTag);
    }
    return navElement;
}

function navigateNextResult() {
    if (state.searchResults.length === 0) return;
    let newIndex = state.currentSearchIndex + 1;
    if (newIndex >= state.searchResults.length) {
        newIndex = 0; 
    }
    navigateToSearchResult(newIndex);
}

function navigatePreviousResult() {
    if (state.searchResults.length === 0) return;
    let newIndex = state.currentSearchIndex - 1;
    if (newIndex < 0) {
        newIndex = state.searchResults.length - 1; 
    }
    navigateToSearchResult(newIndex);
}

function navigateToSearchResult(index) {
    if (index < 0 || index >= state.searchResults.length) return;
    state.currentSearchIndex = index;
    const targetNode = state.searchResults[index];
    d3.selectAll('.node.current-result').classed('current-result', false);
    d3.select(`#node-${targetNode.data.name}-${targetNode.depth}`).classed('current-result', true);
    updateSearchNavigation();
    zoomToNode(targetNode);
}

function zoomToNode(node) {
    if (!state.svg || !state.svg.node()) return;
    const scale = Math.max(1.2, Math.min(1.8, 1.5 - (node.depth * 0.05)));
    const viewportWidth = state.svg.node().clientWidth;
    const viewportHeight = state.svg.node().clientHeight;
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;
    const transform = d3.zoomIdentity
        .translate(
            centerX - node.y * scale,  
            centerY - node.x * scale   
        )
        .scale(scale);
    state.svg.transition()
        .duration(400)  
        .ease(d3.easeCubicOut)  
        .call(state.zoom.transform, transform)
        .on("start", () => {
            d3.select("#visualizer").classed("is-zooming", true);
        })
        .on("end", () => {
            d3.select("#visualizer").classed("is-zooming", false);
            updateZoomLevel(scale);
            const nodeElement = d3.select(`#node-${node.data.name}-${node.depth}`);
            nodeElement.classed("node-flash", true);
            setTimeout(() => {
                nodeElement.classed("node-flash", false);
            }, 700);
        });
}

function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', function (e) {
        if (document.activeElement.id === 'searchInput') {
            if (e.key === 'Enter' || e.key === 'ArrowDown') {
                e.preventDefault();
                if (e.shiftKey || e.key === 'ArrowUp') {
                    navigatePreviousResult();
                } else {
                    navigateNextResult();
                }
            }
        }
    });
}

function handleNodeClick(d) {
    state.lastClickedNode = d;
    if (!state.editor) return;
    const path = getNodePath(d);
    if (!path) return;
    try {
        const json = JSON.parse(state.editor.getValue());
        const position = findPositionInEditor(path, json);
        if (position) {
            state.editor.clearSelection();
            state.editor.moveCursorTo(position.row, position.column);
            state.editor.scrollToLine(position.row, true, true, function () { });
            state.editor.focus();
        }
    } catch (e) {
        console.error('Error navigating to node in editor:', e);
    }
}
/**
 * Get the path to a node in the JSON
 * @param {Object} node - The node to find the path for
 * @returns {Array} The path as an array of keys/indices
 */
function getNodePath(node) {
    const path = [];
    let current = node;
    while (current && current.parent && current.parent.data.name !== 'root') {
        path.unshift(current.data.name);
        current = current.parent;
    }
    if (path.length === 0 && node.data.name !== 'root') {
        path.push(node.data.name);
    }
    return path;
}
/**
 * Find the position of a node in the editor's text
 * @param {Array} path - The path to the node
 * @param {Object} json - The parsed JSON
 * @returns {Object|null} The position {row, column} or null if not found
 */
function findPositionInEditor(path, json) {
    if (!path || path.length === 0) return null;
    let targetText = '';
    if (path.length === 1) {
        targetText = `"${path[0]}"`;
    } else {
        let keyPattern = '';
        for (let i = 0; i < path.length; i++) {
            if (i > 0) keyPattern += '.*?';
            keyPattern += `"${escapeRegExp(path[i])}"`;
        }
        targetText = keyPattern;
    }
    const content = state.editor.getValue();
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes(`"${path[path.length - 1]}":`)) {
            const keyIndex = line.indexOf(`"${path[path.length - 1]}"`);
            if (keyIndex >= 0) {
                return { row: i, column: keyIndex };
            }
        }
    }
    try {
        const regex = new RegExp(`"${escapeRegExp(path[path.length - 1])}"\\s*:`);
        for (let i = 0; i < lines.length; i++) {
            const match = regex.exec(lines[i]);
            if (match) {
                return { row: i, column: match.index };
            }
        }
    } catch (e) {
        console.error('Regex search failed:', e);
    }
    return null;
}
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function highlightText(text, searchTerm) {
    if (!text) return '';
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.toString().replace(regex, '<span class="text-highlight">$1</span>');
}
function formatJSON() {
    try {
        const content = state.editor.getValue();
        if (!content.trim()) {
            showFileFeedback('error', "Editor está vazio. Por favor, insira um conteúdo JSON.");
            return;
        }
        const obj = JSON.parse(content);
        state.editor.setValue(JSON.stringify(obj, null, 2), -1);
        showFileFeedback('success', "JSON formatado com sucesso.");
    } catch (e) {
        showFileFeedback('error', "JSON inválido: " + e.message);
    }
}
function clearEditor() {
    const content = state.editor.getValue();
    if (!content.trim()) {
        showFileFeedback('error', "Editor já está vazio.");
        return;
    } else {
        state.editor.setValue("");
        clearVisualization();
        showFileFeedback('info', "Editor limpo com sucesso.");
    }
}
function visualizeJSON() {
    try {
        const content = state.editor.getValue();
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
function handleEditorAction(action) {
    if (!action) return;
    console.log('Action selected:', action); 
    const actions = {
        'format': formatJSON,
        'clear': clearEditor,
        'collapseAll': collapseAll,
        'expandAll': expandAll,
        'import': function () {
            if (window.JSONImportHandler && typeof window.JSONImportHandler.openFileDialog === 'function') {
                window.JSONImportHandler.openFileDialog();
            } else {
                const fileInput = document.getElementById('jsonFileInput');
                if (fileInput) fileInput.click();
            }
        }
    };
    if (actions[action]) {
        actions[action]();
    }
    const dropdown = document.querySelector('.control-dropdown');
    if (dropdown) {
        dropdown.selectedIndex = 0;
    }
}
/**
 * Trigger the file input dialog for importing JSON
 */
function triggerImportDialog() {
    console.log('Triggering import dialog'); 
    const fileInput = document.getElementById('jsonFileInput');
    if (fileInput) {
        fileInput.click();
    } else {
        console.error('File input element not found with id "jsonFileInput"');
        alert('Erro ao abrir o diálogo de importação. Por favor, tente novamente.');
    }
}
/**
 * Import JSON file from user's computer
 * Reads the file, validates it as JSON, and loads it into the editor
 * @param {HTMLInputElement} fileInput - The file input element containing the selected file
 */
function importJSONFile(fileInput) {
    console.log('Import JSON file triggered', fileInput); 
    const file = fileInput.files[0];
    if (!file) {
        console.warn('No file selected');
        return;
    }
    console.log('File selected:', file.name, file.size); 
    const MAX_FILE_SIZE = 5 * 1024 * 1024; 
    if (file.size > MAX_FILE_SIZE) {
        showFileFeedback('error', 'Arquivo muito grande. Tamanho máximo: 5MB.');
        fileInput.value = ''; 
        return;
    }
    const reader = new FileReader();
    showFileFeedback('loading', `Carregando ${file.name}...`);
    reader.onload = function (e) {
        try {
            const content = e.target.result;
            console.log('File content loaded, length:', content.length); 
            const lineCount = content.split('\n').length;
            if (lineCount > LINE_LIMIT) {
                showFileFeedback('error', `Arquivo excede o limite de ${LINE_LIMIT.toLocaleString()} linhas.`);
                fileInput.value = ''; 
                return;
            }
            const jsonObj = JSON.parse(content);
            if (state.editor) {
                state.editor.setValue(JSON.stringify(jsonObj, null, 2));
                state.editor.clearSelection(); 
                state.editor.focus(); 
                showFileFeedback('success', `${file.name} carregado com sucesso.`);
                updateVisualization(jsonObj);
            } else {
                console.error('Editor not initialized');
                showFileFeedback('error', 'Editor não inicializado corretamente.');
            }
        } catch (err) {
            console.error('Error parsing JSON file:', err);
            showFileFeedback('error', 'Arquivo JSON inválido. Verifique o formato.');
        }
        fileInput.value = '';
    };
    reader.onerror = function (e) {
        console.error('FileReader error:', e);
        showFileFeedback('error', 'Erro ao ler o arquivo.');
        fileInput.value = '';
    };
    reader.readAsText(file);
}
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
function saveDiagram() {
    const content = state.editor.getValue();
    if (!content.trim()) {
        alert("O diagrama está vazio. Não é possível salvar.");
        return;
    }
    const svgExport = prepareSvgForExport();
    downloadSvg(svgExport);
}
function prepareSvgForExport() {
    const originalSvg = state.svg.node();
    const clonedSvg = originalSvg.cloneNode(true);
    clonedSvg.style.backgroundColor = 'var(--bg-primary)';
    const nodeCards = clonedSvg.querySelectorAll('.node-card');
    nodeCards.forEach(card => {
        const original = originalSvg.querySelector('.node-card');
        const computedStyle = window.getComputedStyle(original);
        card.style.backgroundColor = computedStyle.backgroundColor;
        card.style.border = computedStyle.border;
        card.style.borderRadius = computedStyle.borderRadius;
        card.style.color = computedStyle.color;
    });
    return clonedSvg;
}
function formatValue(value, type) {
    const formatters = {
        'string': value => `"${value}"`,
        'boolean': value => `<span style="color: #10B981">${value}</span>`,
        'number': value => `<span style="color: #3B82F6">${value}</span>`,
        'null': () => 'null',
        'default': value => value
    };
    return (formatters[type] || formatters.default)(value);
}
function getValueClass(type) {
    const classes = {
        'string': 'string-value',
        'number': 'number-value',
        'boolean': 'boolean-value'
    };
    return classes[type] || 'default-value';
}
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
async function loadDefaultJSON() {
    try {
        const response = await fetch('/static/default.json');
        const data = await response.json();
        state.editor.setValue(JSON.stringify(data, null, 2), -1);
        updateVisualization(data);
    } catch (error) {
        console.error('Erro ao carregar JSON padrão:', error);
    }
}
/**
 * Add custom CSS style to help with rendering issues
 */
function addCustomStyles() {
    if (!document.getElementById('d3-fix-styles')) {
        const styleTag = document.createElement('style');
        styleTag.id = 'd3-fix-styles';
        styleTag.textContent = `
            #visualizer {
                position: relative;
                overflow: hidden;
            }
            #visualizer svg {
                display: block;
                width: 100%;
                height: 100%;
                position: absolute;
                top: 0;
                left: 0;
            }
            .visualization-svg {
                shape-rendering: geometricPrecision;
                text-rendering: geometricPrecision;
            }
            .is-zooming * {
                transition: none !important;
            }
            .node {
                cursor: pointer;
            }
            .node-hover {
                filter: brightness(1.1);
            }
            .link {
                stroke-linecap: round;
                stroke-linejoin: round;
                pointer-events: none;
                transition: opacity 0.3s ease;
            }
            .node-card {
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                border: 1.5px solid rgba(74, 85, 104, 0.2);
                border-radius: ${CONFIG.node.borderRadius}px;
                padding: ${CONFIG.node.padding / 2}px;
                margin: 0;
                box-sizing: border-box;
                background-color: #1e1e1e;
                overflow: hidden;
            }
            .node.current-result .node-card {
                border-color: ${CONFIG.search.highlightColor};
                box-shadow: 0 0 0 2px ${CONFIG.search.highlightColor};
            }
            .node-container {
                height: 100%;
                width: 100%;
                display: flex;
                flex-direction: column;
                justify-content: center;
                overflow: hidden;
            }
            .node-content, .node-header {
                display: flex;
                align-items: center;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
            }
            .node-key {
                margin-right: 5px;
                font-weight: bold;
            }
            .text-highlight {
                background-color: rgba(255, 165, 0, 0.4);
                border-radius: 2px;
                padding: 0 2px;
            }
        `;
        document.head.appendChild(styleTag);
    }
    if (!document.getElementById('group-node-styles')) {
        const styleTag = document.createElement('style');
        styleTag.id = 'group-node-styles';
        styleTag.textContent = `
            .group-properties {
                display: flex;
                flex-direction: column;
                padding: 5px 10px;
            }
            .group-property {
                display: flex;
                justify-content: space-between;
                margin: 2px 0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .group-property .node-key {
                margin-right: 5px;
                font-weight: bold;
            }
        `;
        document.head.appendChild(styleTag);
    }
    if (!document.getElementById('search-highlight-styles')) {
        const styleTag = document.createElement('style');
        styleTag.id = 'search-highlight-styles';
        styleTag.textContent = `
            .node.current-result .node-card {
                border-color: ${CONFIG.search.highlightColor};
                box-shadow: 0 0 0 3px ${CONFIG.search.highlightColor};
            }
            @keyframes node-flash {
                0% { box-shadow: 0 0 0 3px ${CONFIG.search.highlightColor}; }
                50% { box-shadow: 0 0 0 8px ${CONFIG.search.highlightColor}; }
                100% { box-shadow: 0 0 0 3px ${CONFIG.search.highlightColor}; }
            }
            .node-flash .node-card {
                animation: node-flash 0.6s ease-out;
            }
            .text-highlight {
                background-color: rgba(255, 165, 0, 0.5);
                border-radius: 3px;
                padding: 0 3px;
                margin: 0 -1px;
                font-weight: bold;
                color: #fff;
                text-shadow: 0 0 2px rgba(0,0,0,0.5);
            }
        `;
        document.head.appendChild(styleTag);
    }
    if (!document.getElementById('toggle-icon-styles')) {
        const styleTag = document.createElement('style');
        styleTag.id = 'toggle-icon-styles';
        styleTag.textContent = `
            .node-header.with-toggle {
                display: flex;
                align-items: center;
                justify-content: space-between;
                width: 100%;
                padding: 4px 0;
                margin: 0;
                border-bottom: none;
            }
            .node-title-section {
                flex: 1;
                display: flex;
                align-items: center;
                overflow: hidden;
                text-overflow: ellipsis;
                padding-left: 8px;
                min-height: 28px;
            }
            .node-toggle-button {
                display: flex;
                align-items: center;
                justify-content: center;
                min-width: 28px;
                height: 28px;
                margin: 0;
                padding: 0;
                cursor: pointer !important;
                border: none;
                border-left: 1px solid rgba(255, 255, 255, 0.15);
                background-color: rgba(255, 255, 255, 0.05);
                color: rgba(255, 255, 255, 0.8);
                transition: background-color 0.2s ease, color 0.2s ease;
                position: relative;
                z-index: 20;
                pointer-events: auto !important;
                touch-action: manipulation;
            }
            .node-toggle-button:hover {
                background-color: rgba(255, 255, 255, 0.2);
                color: #ffffff;
            }
            .node-toggle-button:active {
                background-color: rgba(255, 255, 255, 0.3);
            }
            .toggle-icon {
                pointer-events: none !important;
                stroke-width: 2px;
            }
            .node-content {
                padding: 4px 8px;
                width: 100%;
            }
            .node-name {
                font-weight: 500;
                margin-right: 4px;
            }
            .node-count {
                font-size: 0.9em;
                opacity: 0.7;
            }
        `;
        document.head.appendChild(styleTag);
    }
}
/**
 * Update document ready function to initialize styles and ensure file input is properly set up
 */
document.addEventListener('DOMContentLoaded', function () {
    if (!localStorage.getItem('welcomeShown')) {
        localStorage.setItem('welcomeShown', 'true');
    }
    addCustomStyles();
    initializeEditor();
    initializeVisualization();
    initializeResizer();
    initializeEventListeners();
    window.addEventListener('resize', debounce(handleResize, 250));
    loadDefaultJSON();
    const visualizer = document.getElementById('visualizer');
    const editor = document.getElementById('editor');
    [visualizer, editor].forEach(element => {
        element.addEventListener('dragover', e => {
            e.preventDefault();
            e.stopPropagation();
            element.classList.add('drag-over');
        });
        element.addEventListener('dragleave', e => {
            e.preventDefault();
            e.stopPropagation();
            element.classList.remove('drag-over');
        });
        element.addEventListener('drop', e => {
            e.preventDefault();
            e.stopPropagation();
            element.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.type === 'application/json') {
                const fakeInput = { files: [file] };
                importJSONFile(fakeInput);
            } else {
                showFileFeedback('error', 'Apenas arquivos JSON são suportados.');
            }
        });
    });
    const fileInput = document.getElementById('jsonFileInput');
    if (fileInput) {
        fileInput.addEventListener('change', function () {
            importJSONFile(this);
        });
        console.log('File input event listener attached');
    } else {
        console.error('File input element not found on DOMContentLoaded');
    }
    window.triggerImportDialog = triggerImportDialog;
    window.importJSONFile = importJSONFile;
    window.importJSON = function () {
        if (window.JSONImportHandler && typeof window.JSONImportHandler.openFileDialog === 'function') {
            window.JSONImportHandler.openFileDialog();
        } else {
            const fileInput = document.getElementById('jsonFileInput');
            if (fileInput) fileInput.click();
        }
    };
    const dropdown = document.getElementById('editorActionDropdown');
    if (dropdown) {
        dropdown.addEventListener('change', function () {
            const value = this.value;
            if (value) {
                handleEditorAction(value);
            }
        });
    }
});
window.toggleNode = toggleNode;
window.collapseAll = collapseAll;
window.expandAll = expandAll;
window.handleCollapseToggle = handleCollapseToggle;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.resetZoom = resetZoom;
window.fitContent = fitContent;
window.searchDiagram = searchDiagram;
window.formatJSON = formatJSON;
window.clearEditor = clearEditor;
window.visualizeJSON = visualizeJSON;
window.handleEditorAction = handleEditorAction;
window.toggleSettings = toggleSettings;
window.toggleGrid = toggleGrid;
window.saveDiagram = saveDiagram;
window.handleResize = handleResize;
window.addCustomStyles = addCustomStyles;
window.importJSONFile = importJSONFile;
window.showFileFeedback = showFileFeedback;
window.triggerImportDialog = triggerImportDialog;
function fixImportFunctionality() {
    const oldInput = document.getElementById('jsonFileInput');
    if (oldInput) {
        oldInput.remove();
    }
    const newInput = document.createElement('input');
    newInput.id = 'jsonFileInput';
    newInput.type = 'file';
    newInput.accept = '.json';
    newInput.style.display = 'none';
    document.body.appendChild(newInput);
    newInput.addEventListener('change', function () {
        console.log('File input change event triggered');
        importJSONFile(this);
    });
    console.log('Fixed file input created and appended to document');
    return newInput;
}
function triggerImportDialog() {
    console.log('Triggering import dialog');
    let fileInput = document.getElementById('jsonFileInput');
    if (!fileInput) {
        fileInput = fixImportFunctionality();
    }
    try {
        fileInput.click();
    } catch (e) {
        console.error('Error clicking file input:', e);
        try {
            const event = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true
            });
            fileInput.dispatchEvent(event);
        } catch (e2) {
            console.error('Failed to trigger file input:', e2);
            alert('Não foi possível abrir o diálogo de arquivos. Por favor, use arrastar e soltar para importar um arquivo JSON.');
        }
    }
}
document.addEventListener('DOMContentLoaded', function () {
    fixImportFunctionality();
    document.addEventListener('change', function (event) {
        if (event.target.classList.contains('control-dropdown')) {
            const value = event.target.value;
            if (value === 'import') {
                console.log('Import option selected from dropdown');
                event.target.selectedIndex = 0;
                setTimeout(triggerImportDialog, 50);
            }
        }
    });
});
window.importJSON = window.importJSON || function () {
    if (window.JSONImportHandler && typeof window.JSONImportHandler.openFileDialog === 'function') {
        window.JSONImportHandler.openFileDialog();
    } else {
        alert("Sistema de importação não inicializado corretamente.");
    }
};
function toggleGrouping() {
    state.groupingEnabled = !state.groupingEnabled;
    const btn = document.getElementById('toggleGrouping');
    if (btn) {
        btn.classList.toggle('active', state.groupingEnabled);
        btn.textContent = state.groupingEnabled ? 'Disable Grouping' : 'Enable Grouping';
    }
    try {
        const content = state.editor.getValue().trim();
        if (content) {
            updateVisualization(JSON.parse(content));
            showFileFeedback('info', state.groupingEnabled ?
                'Node grouping enabled' : 'Node grouping disabled');
        }
    } catch (e) {
        console.error('Error updating visualization after grouping toggle:', e);
    }
}
window.toggleGrouping = toggleGrouping;