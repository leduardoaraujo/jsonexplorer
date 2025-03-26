document.addEventListener('DOMContentLoaded', function() {
    const editor = document.getElementById('editor');
    const treeView = document.getElementById('tree-view');
    const dataTypeSelect = document.getElementById('data-type');
    const parseBtn = document.getElementById('parse-btn');
    const formatBtn = document.getElementById('format-btn');
    const clearBtn = document.getElementById('clear-btn');
    const copyBtn = document.getElementById('copy-btn');
    const errorContainer = document.getElementById('error-container');
    const statusEl = document.getElementById('status');
    const searchInput = document.getElementById('search-input');

    let currentData = null;
    let currentType = 'json';

    // Load sample data
    const sampleJSON = {
        "name": "JSON Editor",
        "version": 1.0,
        "features": ["Tree View", "Syntax Highlighting", "Search", "Format"],
        "isActive": true,
        "metadata": {
            "created": "2025-03-10",
            "author": {
                "name": "Web Developer",
                "email": "dev@example.com"
            }
        },
        "stats": {
            "users": 1500,
            "rating": 4.8
        }
    };

    const sampleXML = 
`<?xml version="1.0" encoding="UTF-8"?>
<root>
<name>XML Editor</name>
<version>1.0</version>
<features>
<feature>Tree View</feature>
<feature>Syntax Highlighting</feature>
<feature>Search</feature>
<feature>Format</feature>
</features>
<isActive>true</isActive>
<metadata>
<created>2025-03-10</created>
<author>
<name>Web Developer</name>
<email>dev@example.com</email>
</author>
</metadata>
<stats>
<users>1500</users>
<rating>4.8</rating>
</stats>
</root>`;

    // Initialize with JSON sample
    editor.value = JSON.stringify(sampleJSON, null, 2);
    parseData();

    // Event listeners
    parseBtn.addEventListener('click', parseData);
    formatBtn.addEventListener('click', formatData);
    clearBtn.addEventListener('click', clearData);
    copyBtn.addEventListener('click', copyToClipboard);
    
    // FIX: Update the change handler to actually change the content
    dataTypeSelect.addEventListener('change', () => {
        const newType = dataTypeSelect.value;
        
        // Only change the content if the type has actually changed
        if (newType !== currentType) {
            currentType = newType;
            
            // Switch the editor content based on the selected type
            if (currentType === 'json') {
                editor.value = JSON.stringify(sampleJSON, null, 2);
                updateStatus('Switched to JSON mode');
            } else {
                editor.value = sampleXML;
                updateStatus('Switched to XML mode');
            }
            
            // Parse the new content
            parseData();
        }
    });
    
    searchInput.addEventListener('input', performSearch);

    // Parse the data and render tree
    function parseData() {
        errorContainer.innerHTML = '';
        try {
            if (dataTypeSelect.value === 'json') {
                currentData = JSON.parse(editor.value);
                renderJSONTree(currentData);
                updateStatus(`JSON parsed successfully: ${countNodes(currentData)} nodes`);
            } else {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(editor.value, "text/xml");
                
                // Check for parsing errors
                const parsererror = xmlDoc.getElementsByTagName('parsererror');
                if (parsererror.length > 0) {
                    throw new Error('XML parsing error: ' + parsererror[0].textContent);
                }
                
                currentData = xmlDoc;
                renderXMLTree(xmlDoc.documentElement);
                updateStatus(`XML parsed successfully: ${countXMLNodes(xmlDoc)} nodes`);
            }
        } catch (error) {
            showError(error.message);
            updateStatus('Parse failed');
        }
    }

    // Format the data
    function formatData() {
        try {
            if (dataTypeSelect.value === 'json') {
                const parsed = JSON.parse(editor.value);
                editor.value = JSON.stringify(parsed, null, 2);
                updateStatus('JSON formatted');
            } else {
                // Basic XML formatting (this is simplified)
                let formatted = '';
                let indent = '';
                
                editor.value.split(/>\s*</).forEach(node => {
                    if (node.match(/^\/\w/)) {
                        indent = indent.substring(2);
                    }
                    
                    formatted += indent + '<' + node + '>\n';
                    
                    if (node.match(/^<?\w[^>]*[^\/]$/) && !node.match(/\/>/)) {
                        indent += '  ';
                    }
                });
                
                // Clean up the result
                formatted = formatted
                    .replace(/\n<\?xml/g, '<?xml')
                    .replace(/>\n/g, '>')
                    .replace(/>\n</g, '><')
                    .replace(/^</, '')
                    .replace(/>$/, '');
                
                editor.value = formatted;
                updateStatus('XML formatted');
            }
            parseData();
        } catch (error) {
            showError(error.message);
        }
    }

    // Clear data
    function clearData() {
        editor.value = '';
        treeView.innerHTML = '';
        errorContainer.innerHTML = '';
        updateStatus('Cleared');
    }

    // Copy to clipboard
    function copyToClipboard() {
        editor.select();
        document.execCommand('copy');
        updateStatus('Copied to clipboard');
        setTimeout(() => {
            updateStatus('Ready');
        }, 2000);
    }

    // Show error message
    function showError(message) {
        errorContainer.innerHTML = `<div class="error">${message}</div>`;
    }

    // Update status
    function updateStatus(message) {
        statusEl.textContent = message;
    }

    // Count nodes in JSON
    function countNodes(obj) {
        let count = 1;
        if (obj && typeof obj === 'object') {
            Object.keys(obj).forEach(key => {
                if (obj[key] && typeof obj[key] === 'object') {
                    count += countNodes(obj[key]);
                } else {
                    count++;
                }
            });
        }
        return count;
    }

    // Count nodes in XML
    function countXMLNodes(node) {
        let count = 1;
        for (let i = 0; i < node.childNodes.length; i++) {
            if (node.childNodes[i].nodeType === 1) { // Element node
                count += countXMLNodes(node.childNodes[i]);
            }
        }
        return count;
    }

    // Search functionality
    function performSearch() {
        const searchTerm = searchInput.value.toLowerCase();
        
        // Remove existing highlights
        document.querySelectorAll('.highlight').forEach(el => {
            el.classList.remove('highlight');
        });
        
        if (!searchTerm) return;
        
        // Add new highlights
        const allNodes = document.querySelectorAll('.tree-key, .tree-value');
        let matchCount = 0;
        
        allNodes.forEach(node => {
            const text = node.textContent.toLowerCase();
            if (text.includes(searchTerm)) {
                node.classList.add('highlight');
                matchCount++;
                
                // Make sure parent nodes are expanded
                let parent = node.parentElement;
                while (parent) {
                    if (parent.classList && parent.classList.contains('collapsible')) {
                        parent.classList.remove('collapsed');
                    }
                    parent = parent.parentElement;
                }
            }
        });
        
        updateStatus(`Found ${matchCount} matches for "${searchTerm}"`);
    }

    // Render JSON tree
    function renderJSONTree(data) {
        treeView.innerHTML = '';
        
        const rootNode = document.createElement('div');
        rootNode.className = 'tree-root';
        treeView.appendChild(rootNode);
        
        createJSONTreeNode(data, rootNode, 'root');
        
        // Add event listeners for expanding/collapsing
        document.querySelectorAll('.collapsible').forEach(node => {
            node.addEventListener('click', function() {
                this.classList.toggle('collapsed');
            });
        });
        
        // Add event listeners for editing values
        document.querySelectorAll('.editable-value').forEach(node => {
            node.addEventListener('click', function(e) {
                e.stopPropagation();
                const path = this.getAttribute('data-path');
                const currentValue = getValueByPath(data, path);
                const newValue = prompt('Edit value:', currentValue);
                
                if (newValue !== null) {
                    try {
                        // Try to parse as JSON if possible
                        let parsedValue;
                        try {
                            parsedValue = JSON.parse(newValue);
                        } catch (e) {
                            parsedValue = newValue;
                        }
                        
                        setValueByPath(data, path, parsedValue);
                        editor.value = JSON.stringify(data, null, 2);
                        parseData();
                    } catch (error) {
                        showError(error.message);
                    }
                }
            });
        });
    }

    // Create JSON tree node
    function createJSONTreeNode(data, parentElement, path = '') {
        if (data === null) {
            const valueEl = document.createElement('span');
            valueEl.className = 'tree-value null';
            valueEl.textContent = 'null';
            parentElement.appendChild(valueEl);
            return;
        }
        
        if (typeof data !== 'object') {
            const valueEl = document.createElement('span');
            valueEl.className = `tree-value ${typeof data}`;
            valueEl.textContent = typeof data === 'string' ? `"${data}"` : String(data);
            parentElement.appendChild(valueEl);
            
            // Make values editable
            if (path !== 'root') {
                valueEl.classList.add('editable-value');
                valueEl.setAttribute('data-path', path);
            }
            return;
        }
        
        const isArray = Array.isArray(data);
        const bracket = document.createElement('span');
        bracket.className = 'tree-key collapsible';
        bracket.textContent = isArray ? '[' : '{';
        parentElement.appendChild(bracket);
        
        const nodeContainer = document.createElement('div');
        nodeContainer.className = 'tree-node';
        parentElement.appendChild(nodeContainer);
        
        Object.keys(data).forEach((key, index) => {
            const itemContainer = document.createElement('div');
            nodeContainer.appendChild(itemContainer);
            
            if (!isArray) {
                const keyEl = document.createElement('span');
                keyEl.className = 'tree-key';
                keyEl.textContent = `"${key}": `;
                itemContainer.appendChild(keyEl);
            }
            
            const newPath = path === 'root' ? key : `${path}.${key}`;
            createJSONTreeNode(data[key], itemContainer, newPath);
            
            if (index < Object.keys(data).length - 1) {
                const comma = document.createElement('span');
                comma.textContent = ',';
                itemContainer.appendChild(comma);
            }
        });
        
        const closingBracket = document.createElement('span');
        closingBracket.textContent = isArray ? ']' : '}';
        parentElement.appendChild(closingBracket);
    }

    // Get value by path
    function getValueByPath(obj, path) {
        const parts = path.split('.');
        let current = obj;
        
        for (let i = 0; i < parts.length; i++) {
            if (current[parts[i]] === undefined) {
                return undefined;
            }
            current = current[parts[i]];
        }
        
        return current;
    }

    // Set value by path
    function setValueByPath(obj, path, value) {
        const parts = path.split('.');
        let current = obj;
        
        for (let i = 0; i < parts.length - 1; i++) {
            if (current[parts[i]] === undefined) {
                return;
            }
            current = current[parts[i]];
        }
        
        current[parts[parts.length - 1]] = value;
    }

    // Render XML tree
    function renderXMLTree(node, parentElement) {
        if (!parentElement) {
            treeView.innerHTML = '';
            parentElement = document.createElement('div');
            parentElement.className = 'tree-root';
            treeView.appendChild(parentElement);
        }
        
        const nodeContainer = document.createElement('div');
        
        if (node.nodeType === 1) { // Element node
            const keyEl = document.createElement('span');
            keyEl.className = 'tree-key collapsible';
            keyEl.textContent = `<${node.nodeName}>`;
            parentElement.appendChild(keyEl);
            
            // Handle attributes
            if (node.attributes && node.attributes.length > 0) {
                const attrsContainer = document.createElement('div');
                attrsContainer.className = 'tree-node';
                
                for (let i = 0; i < node.attributes.length; i++) {
                    const attr = node.attributes[i];
                    const attrEl = document.createElement('div');
                    attrEl.innerHTML = `<span class="tree-key">@${attr.name}:</span> <span class="tree-value string editable-value">"${attr.value}"</span>`;
                    attrsContainer.appendChild(attrEl);
                }
                
                parentElement.appendChild(attrsContainer);
            }
            
            // Handle child nodes
            if (node.hasChildNodes()) {
                nodeContainer.className = 'tree-node';
                parentElement.appendChild(nodeContainer);
                
                let hasElements = false;
                
                // First, look for text nodes
                for (let i = 0; i < node.childNodes.length; i++) {
                    const child = node.childNodes[i];
                    if (child.nodeType === 3 && child.nodeValue.trim()) { // Text node with content
                        const valueContainer = document.createElement('div');
                        const valueEl = document.createElement('span');
                        valueEl.className = 'tree-value string editable-value';
                        valueEl.textContent = `"${child.nodeValue.trim()}"`;
                        valueContainer.appendChild(valueEl);
                        nodeContainer.appendChild(valueContainer);
                    } else if (child.nodeType === 1) { // Element node
                        hasElements = true;
                    }
                }
                
                // Then, look for element nodes
                if (hasElements) {
                    for (let i = 0; i < node.childNodes.length; i++) {
                        const child = node.childNodes[i];
                        if (child.nodeType === 1) { // Element node
                            const childContainer = document.createElement('div');
                            nodeContainer.appendChild(childContainer);
                            renderXMLTree(child, childContainer);
                        }
                    }
                }
            }
            
            const closingEl = document.createElement('span');
            closingEl.textContent = `</${node.nodeName}>`;
            parentElement.appendChild(closingEl);
        } else if (node.nodeType === 3 && node.nodeValue.trim()) { // Text node with content
            const valueEl = document.createElement('span');
            valueEl.className = 'tree-value string';
            valueEl.textContent = node.nodeValue.trim();
            parentElement.appendChild(valueEl);
        }
        
        // Add event listeners for expanding/collapsing
        document.querySelectorAll('.collapsible').forEach(node => {
            node.addEventListener('click', function() {
                this.classList.toggle('collapsed');
            });
        });
    }
});