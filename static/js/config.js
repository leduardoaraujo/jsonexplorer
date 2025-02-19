// Definir CONFIG imediatamente no escopo global
window.CONFIG = {
    // Editor
    EDITOR: {
        THEME: 'ace/theme/github_dark',
        MODE: 'ace/mode/json',
        FONT_SIZE: '13px',
        FONT_FAMILY: 'Monaco, Menlo, Ubuntu Mono, monospace',
        OPTIONS: {
            showPrintMargin: true,
            showGutter: true,
            highlightActiveLine: true,
            wrap: true
        }
    },
    
    //Atalhos
    SHORTCUTS: {
        TOGGLE_SETTINGS: 'Ctrl+Shift+P',
        TOGGLE_GRID: 'Ctrl+Shift+G',
        TOGGLE_SEARCH: 'Ctrl+Shift+F',
        TOGGLE_VISUALIZATION: 'Ctrl+Shift+V',
        TOGGLE_FULLSCREEN: 'F11',
        ZOOM_IN: 'Ctrl+Plus',
        ZOOM_OUT: 'Ctrl+-',
        RESET_ZOOM: 'Ctrl+0',
        FOCUS_EDITOR: 'Ctrl+Shift+E',
        FOCUS_VISUALIZER: 'Ctrl+Shift+M'
    },

    // Visualização
    VISUALIZATION: {
        NODE_BASE_HEIGHT: 45,
        NODE_MIN_WIDTH: 180,
        TREE_NODE_SPACING: {
            VERTICAL: 100,
            HORIZONTAL: 280
        }
    },

    // Zoom
    ZOOM: {
        SCALE: 1.3,
        DURATION: 300,
        MIN_SCALE: 0.1,
        MAX_SCALE: 3,
        FIT_PADDING: 0.9
    },

    // UI
    UI: {
        DEBOUNCE_DELAY: 300,
        TRANSITION_DURATION: 750,
        MIN_PANEL_WIDTH: 200,
        MAX_PANEL_WIDTH_RATIO: 0.8
    },

    // Cores
    COLORS: {
        STRING: '#F87171',
        NUMBER: '#3B82F6',
        BOOLEAN: '#10B981',
        DEFAULT: '#D1D5DB',
        LINK: '#4B5563',
        GRID: 'rgba(51, 51, 51, 0.1)'
    },

    // Grid
    GRID: {
        SIZE: '20px',
        OPACITY: 0.1
    },

    // Seletores
    SELECTORS: {
        EDITOR: '#editor',
        VISUALIZER: '#visualizer',
        SEARCH_INPUT: '#searchInput',
        RESULT_COUNT: '#resultCount',
        ZOOM_LEVEL: '#zoomLevel',
        SETTINGS_MENU: '#settings-menu',
        LEFT_PANEL: '.left-panel',
        RESIZER: '.resizer'
    },

    // Local Storage
    STORAGE_KEYS: {
        WELCOME_SHOWN: 'welcomeShown'
    },

    // Mensagens
    MESSAGES: {
        EMPTY_EDITOR: "Editor está vazio. Por favor, insira um conteúdo JSON.",
        INVALID_JSON: "JSON inválido: ",
        LOADING_ERROR: "Erro ao carregar JSON padrão: "
    }
};

// Exportar para uso em outros arquivos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.CONFIG;
}
