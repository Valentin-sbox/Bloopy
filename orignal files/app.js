/**
 * Block Guard - Versión 3.3 (Unificada)
 * - Sistema de guardado mejorado
 * - Icono de comentario mejorado y posicionado
 * - Selección de línea con background
 * - Marcar con colores predefinidos
 * - Drag & Drop sincronizado físico/lógico
 * - Estadísticas simplificadas con debounce
 * - Settings de estados consolidados
 * - Sistema de atajos de teclado configurables
 * - Corrector ortográfico integrado
 * - Import/Export de datos
 */


// ============================================
// CONNECTION MANAGER - MEJORADO
// ============================================

const ConnectionManager = {
    async connect() {
        try {
            this.showConnectingState(true);

            const handle = await window.showDirectoryPicker({
                id: 'blockguard_workspace',
                mode: 'readwrite',
                startIn: 'documents'
            });

            if (!handle) throw new Error('No se seleccionó carpeta');

            const permission = await handle.queryPermission({ mode: 'readwrite' });

            if (permission !== 'granted') {
                const newPermission = await handle.requestPermission({ mode: 'readwrite' });
                if (newPermission !== 'granted') {
                    throw new Error('Permisos denegados');
                }
            }

            await this.saveHandle(handle);

            state.workspaceHandle = handle;
            await scanWorkspace();

            this.showSuccess(`Conectado a: ${handle.name}`);
            return true;

        } catch (err) {
            console.error('[ConnectionManager] Error:', err);
            this.handleError(err);
            return false;
        } finally {
            this.showConnectingState(false);
        }
    },

    async reconnect() {
        const savedHandle = await this.loadHandle();
        if (!savedHandle) {
            this.showError('No hay carpeta guardada. Conecta una nueva.');
            return false;
        }

        try {
            const permission = await savedHandle.queryPermission({ mode: 'readwrite' });

            if (permission === 'granted') {
                state.workspaceHandle = savedHandle;
                await scanWorkspace();
                this.showSuccess('Reconectado automáticamente');
                return true;
            } else {
                const newPermission = await savedHandle.requestPermission({ mode: 'readwrite' });
                if (newPermission === 'granted') {
                    state.workspaceHandle = savedHandle;
                    await scanWorkspace();
                    this.showSuccess('Permisos restaurados');
                    return true;
                }
            }
        } catch (err) {
            console.error('[ConnectionManager] Reconnect error:', err);
        }

        this.showReconnectUI();
        return false;
    },

    async saveHandle(handle) {
        try {
            const db = await openDB('BlockGuardDB', 1, {
                upgrade(db) {
                    if (!db.objectStoreNames.contains('handles')) {
                        db.createObjectStore('handles', { keyPath: 'id' });
                    }
                }
            });
            await db.put('handles', { id: 'workspace', handle });
        } catch (e) {
            console.warn('Error guardando handle:', e);
        }
    },

    async loadHandle() {
        try {
            const db = await openDB('BlockGuardDB', 1);
            const result = await db.get('handles', 'workspace');
            return result?.handle;
        } catch (e) {
            return null;
        }
    },

    showConnectingState(show) {
        const btn = document.getElementById('setup-folder');
        if (btn) {
            btn.innerHTML = show 
                ? '<i class="fas fa-spinner fa-spin"></i>' 
                : '<i class="fas fa-folder-open"></i>';
            btn.disabled = show;
        }
    },

    showReconnectUI() {
        document.body.classList.add('no-workspace');
        const welcomeMsg = document.getElementById('welcome-message');
        if (welcomeMsg) {
            welcomeMsg.innerHTML = `
                <p>Se necesita reconectar la carpeta de trabajo.</p>
                <button onclick="ConnectionManager.connect()" class="btn-primary">
                    <i class="fas fa-plug"></i> Reconectar
                </button>
            `;
        }
        const sidebarRecon = document.getElementById('sidebar-reconnect-btn');
        if (sidebarRecon) sidebarRecon.classList.remove('hidden');
    },

    showSuccess(msg) {
        notify(msg, 'success');
    },

    showError(msg) {
        notify(msg, 'error');
    },

    handleError(err) {
        if (err.name === 'AbortError') {
            notify('Selección cancelada', 'info');
        } else if (err.message.includes('Permisos')) {
            this.showReconnectUI();
        } else {
            notify('Error: ' + err.message, 'error');
        }
    }
};

// Helper para IndexedDB
function openDB(name, version, upgradeCallback) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(name, version);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        if (upgradeCallback) {
            request.onupgradeneeded = (e) => upgradeCallback(e.target.result);
        }
    });
}


// ============================================
// THEME MANAGER - TEMAS PERSONALIZADOS INDEPENDIENTES
// ============================================

const ThemeManager = {
    customThemes: [],

    init() {
        this.loadCustomThemes();
        this.renderCustomThemesList();
    },

    loadCustomThemes() {
        const saved = localStorage.getItem('bg_custom_themes');
        if (saved) {
            try {
                this.customThemes = JSON.parse(saved);
            } catch (e) {
                this.customThemes = [];
            }
        }
    },

    saveCustomThemes() {
        localStorage.setItem('bg_custom_themes', JSON.stringify(this.customThemes));
    },

    createTheme(name, colors) {
        const theme = {
            id: 'custom_' + Date.now(),
            name: name,
            created: Date.now(),
            colors: {
                bgPrimary: colors.bgPrimary || '#0a0a0a',
                bgSecondary: colors.bgSecondary || '#121212',
                bgTertiary: colors.bgTertiary || '#1d1d1d',
                accent: colors.accent || '#0071e3',
                accentSecondary: colors.accentSecondary || '#af52de',
                text: colors.text || '#f5f5f7',
                textSecondary: colors.textSecondary || '#86868b',
                border: colors.border || 'rgba(255,255,255,0.08)'
            }
        };

        this.customThemes.push(theme);
        this.saveCustomThemes();
        this.renderCustomThemesList();

        return theme;
    },

    deleteTheme(themeId) {
        this.customThemes = this.customThemes.filter(t => t.id !== themeId);
        this.saveCustomThemes();
        this.renderCustomThemesList();
    },

    applyTheme(themeId) {
        const theme = this.customThemes.find(t => t.id === themeId);
        if (!theme) return;

        state.config.customTheme = theme.colors;
        state.config.theme = 'custom';
        applyTheme('custom');

        localStorage.setItem('bg_active_custom_theme', themeId);
        notify('Tema aplicado: ' + theme.name, 'success');
    },

    editTheme(themeId) {
        const theme = this.customThemes.find(t => t.id === themeId);
        if (!theme) return;

        const nameInput = document.getElementById('custom-theme-name');
        if (nameInput) nameInput.value = theme.name;

        // Actualizar todos los inputs de color
        const colorInputs = ['bgPrimary', 'bgSecondary', 'bgTertiary', 'accent', 'accentSecondary', 'text', 'textSecondary', 'border'];
        colorInputs.forEach(color => {
            const input = document.getElementById('custom-' + color);
            if (input && theme.colors[color]) input.value = theme.colors[color];
        });

        state.editingCustomThemeId = themeId;

        const saveBtn = document.getElementById('save-custom-theme-btn');
        if (saveBtn) saveBtn.textContent = 'Actualizar Tema';
    },

    renderCustomThemesList() {
        const container = document.getElementById('custom-themes-list');
        if (!container) return;

        if (this.customThemes.length === 0) {
            container.innerHTML = '<p class="no-custom-themes">No hay temas personalizados</p>';
            return;
        }

        container.innerHTML = this.customThemes.map(theme => `
            <div class="custom-theme-card" data-theme-id="${theme.id}">
                <div class="theme-preview-colors">
                    <span style="background: ${theme.colors.bgPrimary}" title="Fondo principal"></span>
                    <span style="background: ${theme.colors.bgSecondary}" title="Fondo secundario"></span>
                    <span style="background: ${theme.colors.accent}" title="Acento"></span>
                    <span style="background: ${theme.colors.text}" title="Texto"></span>
                </div>
                <div class="theme-info">
                    <span class="theme-name">${escapeHtml(theme.name)}</span>
                    <span class="theme-date">${new Date(theme.created).toLocaleDateString()}</span>
                </div>
                <div class="theme-actions">
                    <button onclick="ThemeManager.applyTheme('${theme.id}')" title="Aplicar">
                        <i class="fas fa-check"></i>
                    </button>
                    <button onclick="ThemeManager.editTheme('${theme.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="ThemeManager.deleteTheme('${theme.id}')" class="danger" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }
};

// ============================================
// CONFIGURACIÓN Y ESTADO GLOBAL
// ============================================

function generateUUID() {
    return 'p-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
}

function trapFocus(modal) {
    const focusableElements = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const firstFocusableElement = modal.querySelectorAll(focusableElements)[0];
    const focusableContent = modal.querySelectorAll(focusableElements);
    const lastFocusableElement = focusableContent[focusableContent.length - 1];

    modal.addEventListener('keydown', function (e) {
        let isTabPressed = e.key === 'Tab' || e.keyCode === 9;
        if (!isTabPressed) return;

        if (e.shiftKey) {
            if (document.activeElement === firstFocusableElement) {
                lastFocusableElement.focus();
                e.preventDefault();
            }
        } else {
            if (document.activeElement === lastFocusableElement) {
                firstFocusableElement.focus();
                e.preventDefault();
            }
        }
    });

    if (firstFocusableElement) firstFocusableElement.focus();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function sanitizeHTML(html) {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const allowedTags = ['B', 'I', 'U', 'S', 'MARK', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'P', 'BR'];

    const clean = (node) => {
        const children = Array.from(node.childNodes);
        children.forEach(child => {
            if (child.nodeType === 1) {
                if (!allowedTags.includes(child.tagName)) {
                    const textNode = document.createTextNode(child.textContent);
                    child.parentNode.replaceChild(textNode, child);
                } else {
                    const attrs = Array.from(child.attributes);
                    attrs.forEach(attr => {
                        if (attr.name !== 'style' && attr.name !== 'data-paragraph-id') {
                            child.removeAttribute(attr.name);
                        }
                    });
                    clean(child);
                }
            }
        });
    };

    clean(doc.body);
    return doc.body.innerHTML;
}

function validateImportData(data) {
    if (!data || typeof data !== 'object') return false;
    const required = ['version', 'config', 'projects'];
    return required.every(field => field in data);
}

function smartTruncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 2) + '...';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================
// ESTADO GLOBAL COMPLETO
// ============================================

const state = {
    workspaceHandle: null,
    projectsJSON: [],
    projects: [],
    activeFile: null,
    activeProjectIndex: undefined,
    activeParagraphIndex: undefined,
    activeParagraphId: null,
    exploringFolder: null,
    editorAbortController: null,
    isSaving: false,
    config: {
        states: [
            { id: 'draft', name: 'Primer Borrador', color: '#ff3b30', goal: 30000, countType: 'absolute' },
            { id: 'review', name: 'En Revisión', color: '#ff9500', goal: 15000, countType: 'edited' },
            { id: 'final', name: 'Últimos Retoques', color: '#34c759', goal: 5000, countType: 'delta' }
        ],
        autosaveInterval: 30,
        defaultGoal: 30000,
        theme: 'dark',
        customTheme: null,
        shortcuts: {
            save: { key: 's', ctrl: true, shift: false, alt: false },
            selectAll: { key: 'a', ctrl: true, shift: false, alt: false },
            bold: { key: 'b', ctrl: true, shift: false, alt: false },
            italic: { key: 'i', ctrl: true, shift: false, alt: false },
            underline: { key: 'u', ctrl: true, shift: false, alt: false },
            find: { key: 'f', ctrl: true, shift: false, alt: false },
            newFile: { key: 'n', ctrl: true, shift: false, alt: false },
            closeFile: { key: 'w', ctrl: true, shift: false, alt: false },
            comment: { key: '/', ctrl: true, shift: false, alt: false },
            heading: { key: 'h', ctrl: true, shift: false, alt: false }
        }
    },
    sidebarCollapsed: false,
    contextTarget: null,
    autosaveTimer: null,
    modalResolver: null,
    confirmResolver: null,
    editingStateIndex: null,
    avatarCrop: {
        image: null,
        ratio: 1,
        startX: 0,
        startY: 0,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0
    },
    textContextMenuVisible: false,
    textSelectionRange: null,
    hoverTimeout: null,
    dragState: {
        isDragging: false,
        draggedItem: null,
        draggedPath: null,
        draggedPIdx: null,
        draggedType: null,
        dropTarget: null
    },
    recordingShortcut: null
};

// ============================================
// REFERENCIAS DOM COMPLETAS
// ============================================

const el = {
    sidebar: document.getElementById('sidebar'),
    collapseSidebar: document.getElementById('collapse-sidebar'),
    showSidebarBtn: document.getElementById('show-sidebar-btn'),
    sidebarHoverZone: document.getElementById('sidebar-hover-zone'),
    avatarContainer: document.getElementById('avatar-container'),
    userAvatar: document.getElementById('user-avatar'),
    userAvatarPlaceholder: document.getElementById('user-avatar-placeholder'),
    userNameDisplay: document.getElementById('user-name-display'),
    setupFolder: document.getElementById('setup-folder'),
    sidebarReconnect: document.getElementById('sidebar-reconnect-btn'),
    addProject: document.getElementById('add-project'),
    projectList: document.getElementById('project-list'),
    openSettings: document.getElementById('open-settings'),
    editor: document.getElementById('editor-body'),
    breadcrumb: document.getElementById('breadcrumb'),
    manualSave: document.getElementById('manual-save'),
    spellCheck: document.getElementById('spell-check'),
    metadataPanel: document.getElementById('metadata-panel'),
    activeFileTitle: document.getElementById('active-file-title'),
    editorRenameBtn: document.getElementById('editor-rename-btn'),
    paraToolbar: document.getElementById('para-toolbar'),
    paraCommentCount: document.getElementById('para-comment-count'),
    statLines: document.getElementById('stat-lines'),
    statWords: document.getElementById('stat-words'),
    statChars: document.getElementById('stat-chars'),
    statusBar: document.getElementById('status-bar'),
    upgradeStatus: document.getElementById('upgrade-status'),
    charGoal: document.getElementById('char-goal'),
    goalProgress: document.getElementById('goal-progress'),
    progressText: document.getElementById('progress-text'),
    autosaveIndicator: document.getElementById('autosave-indicator'),
    commentsSidebar: document.getElementById('comments-sidebar'),
    commentsOverlay: document.getElementById('comments-overlay'),
    commentsList: document.getElementById('comments-list'),
    newCommentInput: document.getElementById('new-comment'),
    postCommentBtn: document.getElementById('post-comment'),
    closeComments: document.getElementById('close-comments'),
    welcomeScreen: document.getElementById('welcome-screen'),
    welcomeUserName: document.getElementById('welcome-user-name'),
    welcomeMessage: document.getElementById('welcome-message'),
    reconnectFolderBtn: document.getElementById('reconnect-folder-btn'),
    recentProjects: document.getElementById('recent-projects'),
    childrenLinks: document.getElementById('children-links'),
    linksList: document.getElementById('links-list'),
    settingsModal: document.getElementById('settings-modal'),
    saveSettingsBtn: document.getElementById('save-settings-btn'),
    restoreDefaultsBtn: document.getElementById('restore-defaults-btn'),
    closeSettingsTop: document.getElementById('close-settings-top'),
    settingsTabTitle: document.getElementById('settings-tab-title'),
    userNameInput: document.getElementById('user-name-input'),
    autosaveInterval: document.getElementById('autosave-interval'),
    defaultGoal: document.getElementById('default-goal'),
    settingsAvatarImg: document.getElementById('settings-avatar-img'),
    settingsAvatarPlaceholder: document.getElementById('settings-avatar-placeholder'),
    changeAvatarBtn: document.getElementById('change-avatar-btn'),
    removeAvatarBtn: document.getElementById('remove-avatar-btn'),
    themePreviewGrid: document.getElementById('theme-preview-grid'),
    customBgPrimary: document.getElementById('custom-bg-primary'),
    customBgSecondary: document.getElementById('custom-bg-secondary'),
    customAccent: document.getElementById('custom-accent'),
    customText: document.getElementById('custom-text'),
    saveCustomThemeBtn: document.getElementById('save-custom-theme-btn'),
    statesConfigList: document.getElementById('states-config-list'),
    addStateBtn: document.getElementById('add-state-btn'),
    shortcutsConfigList: document.getElementById('shortcuts-config-list'),
    exportDataBtn: document.getElementById('export-data-btn'),
    importDataBtn: document.getElementById('import-data-btn'),
    clearCacheBtn: document.getElementById('clear-cache-btn'),
    importDataInput: document.getElementById('import-data-input'),
    ctxMenu: document.getElementById('custom-context-menu'),
    ctxSidebarList: document.getElementById('ctx-sidebar-list'),
    ctxRename: document.getElementById('ctx-rename'),
    ctxAddSub: document.getElementById('ctx-add-sub'),
    ctxUpgradeSidebar: document.getElementById('ctx-upgrade-sidebar'),
    ctxResetStatus: document.getElementById('ctx-reset-status'),
    ctxDelete: document.getElementById('ctx-delete'),
    inputModal: document.getElementById('input-modal'),
    inputModalTitle: document.getElementById('input-modal-title'),
    customInputField: document.getElementById('custom-input-field'),
    inputModalConfirm: document.getElementById('input-modal-confirm'),
    confirmModal: document.getElementById('confirm-modal'),
    confirmModalIcon: document.getElementById('confirm-modal-icon'),
    confirmModalTitle: document.getElementById('confirm-modal-title'),
    confirmModalText: document.getElementById('confirm-modal-text'),
    confirmModalYes: document.getElementById('confirm-modal-yes'),
    avatarUploadInput: document.getElementById('avatar-upload-input'),
    spellModal: document.getElementById('spell-modal'),
    spellDontShow: document.getElementById('spell-dont-show'),
    spellConfirmBtn: document.getElementById('spell-confirm-btn'),
    stateEditModal: document.getElementById('state-edit-modal'),
    editStateName: document.getElementById('edit-state-name'),
    editStateType: document.getElementById('edit-state-type'),
    editStateColor: document.getElementById('edit-state-color'),
    notificationContainer: document.getElementById('notification-container'),
    topBar: document.querySelector('.top-bar'),
    customThemesList: document.getElementById('custom-themes-list'),
    tabGeneral: document.getElementById('tab-general'),
    tabAppearance: document.getElementById('tab-appearance'),
    tabStates: document.getElementById('tab-states'),
    tabShortcuts: document.getElementById('tab-shortcuts'),
    tabData: document.getElementById('tab-data'),
    upgradeText: document.getElementById('upgrade-text'),
    upgradeIcon: document.getElementById('upgrade-icon'),
    footerGoalContainer: document.getElementById('footer-goal-container'),
    textContextMenu: null,
    formattingToolbar: null
};

// ============================================
// INICIALIZACIÓN
// ============================================

async function init() {
    console.log('[Block Guard] Inicializando v3.4...');
    console.time('Initialization');

    if (!verifyDOMElements()) {
        console.error('[Block Guard] Elementos DOM críticos faltantes');
        notify('Error de inicialización', 'error');
        return;
    }

    createFormattingToolbar();
    loadConfig();
    applyTheme(state.config.theme || 'dark');
    loadAvatar();
    ThemeManager.init();
    setupEventListeners();
    setupSidebarHover();
    setupTextFormatting();
    setupKeyboardShortcuts();
    setupTabs();
    setupAutosave();
    applyUserIdentity();

    // Cargar metadatos guardados
    const savedMeta = localStorage.getItem('bg_meta');
    if (savedMeta) {
        try {
            state.projectsJSON = JSON.parse(savedMeta);
        } catch (e) {
            console.warn('[Block Guard] Error parseando metadatos:', e);
        }
    }

    // Intentar restaurar workspace
    const workspaceConnected = localStorage.getItem('bg_workspace_connected');
    const workspaceName = localStorage.getItem('bg_workspace_name');

    try {
        const handle = await loadHandle();
        if (handle) {
            state.workspaceHandle = handle;
            console.log(`[Block Guard] Workspace encontrado: ${handle.name}`);

            // Intentar restaurar desde caché JSON primero para mostrar algo rápido
            await restoreFromJSONCache();

            // Verificar permisos
            const permission = await handle.queryPermission({ mode: 'readwrite' });
            if (permission === 'granted') {
                document.body.classList.remove('no-workspace');

                // Mostrar sidebar y topbar
                if (el.sidebar) {
                    el.sidebar.style.display = 'flex';
                    el.sidebar.classList.remove('hidden');
                }
                if (el.topBar) {
                    el.topBar.style.display = 'flex';
                }

                // Escanear workspace
                await scanWorkspace();
                renderSidebar();

                // IR DIRECTAMENTE AL SELECTOR DE PROYECTO (no a pantalla de conectar)
                showWelcomeMessage();

                updateUI();
                notify(`Conectado a: ${handle.name}`, 'success');
            } else {
                // Permisos expirados - mostrar UI de reconexión
                console.log('[Block Guard] Permisos expirados, mostrando UI de reconexión');
                showReconnectUI();

                // Mostrar nombre del workspace en el mensaje
                const welcomeMsg = document.getElementById('welcome-message');
                if (welcomeMsg && workspaceName) {
                    welcomeMsg.innerHTML = `Reconecta para acceder a <strong>${escapeHtml(workspaceName)}</strong>`;
                }
            }
        } else if (workspaceConnected === 'true' && workspaceName) {
            // Había un workspace conectado pero no se pudo cargar el handle
            console.log('[Block Guard] Workspace previo no encontrado');
            document.body.classList.add('no-workspace');
            const welcomeMsg = document.getElementById('welcome-message');
            if (welcomeMsg) {
                welcomeMsg.innerHTML = `Conecta nuevamente <strong>${escapeHtml(workspaceName)}</strong> o selecciona otra carpeta.`;
            }
        } else {
            // No hay workspace conectado
            document.body.classList.add('no-workspace');
            const welcomeMsg = document.getElementById('welcome-message');
            if (welcomeMsg) welcomeMsg.innerText = 'Conecta una carpeta local para empezar.';
        }
    } catch (err) {
        console.error('[Block Guard] Error crítico:', err);
        document.body.classList.add('no-workspace');
        notify('Error al inicializar', 'error');
    }

    updateUI();
    console.timeEnd('Initialization');

    window.addEventListener('beforeunload', (e) => {
        const indicator = document.getElementById('autosave-indicator');
        if (indicator && !indicator.classList.contains('hidden')) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
            if (el.commentsSidebar && !el.commentsSidebar.classList.contains('hidden')) {
                const closeBtn = document.getElementById('close-comments');
                if (closeBtn) closeBtn.click();
            }
        }
    });
}

function verifyDOMElements() {
    const criticalElements = [
        'sidebar', 'editor-body', 'breadcrumb', 'project-list',
        'welcome-screen', 'settings-modal', 'comments-sidebar',
        'notification-container', 'custom-context-menu',
        'input-modal', 'confirm-modal'
    ];
    const missing = criticalElements.filter(id => !document.getElementById(id));
    if (missing.length > 0) {
        console.error('[Block Guard] Elementos faltantes:', missing);
        return false;
    }
    return true;
}

// ============================================
// SISTEMA DE WORKSPACE Y PROYECTOS
// ============================================

async function selectWorkspace() {
    try {
        const handle = await window.showDirectoryPicker({
            id: 'blockguard_workspace',
            mode: 'readwrite',
            startIn: 'documents'
        });
        if (!handle) return;

        // Verificar permisos inmediatamente
        const permission = await handle.queryPermission({ mode: 'readwrite' });
        if (permission !== 'granted') {
            const newPermission = await handle.requestPermission({ mode: 'readwrite' });
            if (newPermission !== 'granted') {
                notify('Se necesitan permisos para acceder a la carpeta', 'error');
                return;
            }
        }

        resetUIState();
        state.workspaceHandle = handle;

        // Guardar en localStorage para persistencia
        localStorage.setItem('bg_workspace_name', handle.name);
        localStorage.setItem('bg_workspace_connected', 'true');
        localStorage.setItem('bg_workspace_timestamp', Date.now().toString());

        await saveHandle(handle);

        document.body.classList.remove('no-workspace');

        // Mostrar sidebar y topbar
        if (el.sidebar) {
            el.sidebar.style.display = 'flex';
            el.sidebar.classList.remove('hidden');
        }
        if (el.topBar) {
            el.topBar.style.display = 'flex';
        }

        await scanWorkspace();
        renderSidebar();

        // Ir directamente al área de trabajo - mostrar primer proyecto si existe
        if (state.projects.length > 0) {
            state.activeProjectIndex = 0;
            state.projects[0].open = true;
            showWelcomeMessage(); // Esto muestra el área de trabajo
        } else {
            showWelcomeMessage();
        }

        updateUI();
        notify('Carpeta conectada: ' + handle.name, 'success');
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('Error seleccionando workspace:', err);
            notify('Error al conectar carpeta: ' + err.message, 'error');
        }
    }
}

// Exponer globalmente
window.selectWorkspace = selectWorkspace;

async function requestWorkspacePermission() {
    if (!state.workspaceHandle) {
        notify('No hay carpeta conectada', 'error');
        return;
    }

    try {
        const permission = await state.workspaceHandle.requestPermission({ mode: 'readwrite' });
        if (permission === 'granted') {
            document.body.classList.remove('no-workspace');

            // Mostrar sidebar y topbar
            if (el.sidebar) {
                el.sidebar.style.display = 'flex';
                el.sidebar.classList.remove('hidden');
            }
            if (el.topBar) {
                el.topBar.style.display = 'flex';
            }

            // Ocultar botones de reconectar
            const sidebarReconnectBtn = document.getElementById('sidebar-reconnect-btn');
            const reconnectFolderBtn = document.getElementById('reconnect-folder-btn');
            if (sidebarReconnectBtn) sidebarReconnectBtn.classList.add('hidden');
            if (reconnectFolderBtn) reconnectFolderBtn.classList.add('hidden');

            await scanWorkspace();
            renderSidebar();
            updateUI();
            autoOpenFile();
            notify('Permisos restaurados', 'success');
        } else {
            notify('Permisos denegados', 'error');
        }
    } catch (err) {
        console.error('Error solicitando permisos:', err);
        notify('Error al solicitar permisos', 'error');
    }
}

// Exponer globalmente
window.requestWorkspacePermission = requestWorkspacePermission;

function showReconnectUI() {
    document.body.classList.add('no-workspace');

    // Ocultar sidebar y topbar
    if (el.sidebar) {
        el.sidebar.style.display = 'none';
    }
    if (el.topBar) {
        el.topBar.style.display = 'none';
    }

    // Mostrar pantalla de bienvenida
    if (el.welcomeScreen) {
        el.welcomeScreen.classList.remove('hidden');
        el.welcomeScreen.style.display = 'flex';
    }

    // Actualizar mensaje
    const welcomeMsg = document.getElementById('welcome-message');
    if (welcomeMsg) {
        welcomeMsg.innerHTML = 'Se necesita reconectar la carpeta de trabajo.';
    }

    // Mostrar botón de reconectar y ocultar acciones normales
    const reconnectBtn = document.getElementById('reconnect-folder-btn');
    const welcomeActions = document.getElementById('welcome-actions-container');

    if (reconnectBtn) {
        reconnectBtn.classList.remove('hidden');
        reconnectBtn.onclick = requestWorkspacePermission;
    }
    if (welcomeActions) {
        welcomeActions.classList.add('hidden');
    }

    // Mostrar botón en sidebar
    const sidebarRecon = document.getElementById('sidebar-reconnect-btn');
    if (sidebarRecon) sidebarRecon.classList.remove('hidden');
}

async function scanWorkspace() {
    if (!state.workspaceHandle) return;

    state.projects = [];

    for await (const entry of state.workspaceHandle.values()) {
        if (entry.kind === 'directory') {
            const project = {
                name: entry.name,
                handle: entry,
                items: [],
                open: false
            };
            await scanDirectory(entry, project.items, entry);
            state.projects.push(project);
        }
    }

    loadMetadata();
    saveMetadata();
}

async function scanDirectory(dirHandle, itemsArray, parentDirHandle) {
    const entries = [];
    for await (const entry of dirHandle.values()) {
        entries.push(entry);
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
        if (entry.kind === 'file' && entry.name.endsWith('.txt')) {
            const item = {
                name: entry.name,
                handle: entry,
                parentDirHandle: parentDirHandle,
                status: 'draft',
                lastCharCount: 0,
                initialCharCount: 0,
                goal: state.config.defaultGoal || 30000,
                comments: [],
                items: []
            };

            try {
                const file = await entry.getFile();
                const content = await file.text();
                const data = parseFileContent(content);

                if (data.metadata) {
                    item.status = data.metadata.status || item.status;
                    item.lastCharCount = data.metadata.lastCharCount || 0;
                    item.initialCharCount = data.metadata.initialCharCount || 0;
                    item.goal = data.metadata.goal || item.goal;
                    item.comments = data.metadata.comments || [];
                }
            } catch (e) {
                console.warn('Error leyendo archivo:', entry.name, e);
            }

            itemsArray.push(item);

            const subDirName = 'sub_' + entry.name.replace('.txt', '');
            try {
                const subDir = await dirHandle.getDirectoryHandle(subDirName);
                await scanDirectory(subDir, item.items, subDir);
            } catch (e) {
                // Subdirectorio no existe, ignorar
            }
        }
    }
}

function parseFileContent(content) {
    const metadataMatch = content.match(/<!--METADATA\n([\s\S]*?)\n-->/);

    if (metadataMatch) {
        try {
            const metadata = JSON.parse(metadataMatch[1]);
            const htmlContent = content.replace(metadataMatch[0], '').trim();
            return { metadata, content: htmlContent };
        } catch (e) {
            console.warn('Error parseando metadata:', e);
        }
    }

    return { metadata: null, content };
}

async function createProjectAction() {
    if (!state.workspaceHandle) {
        notify('Primero selecciona una carpeta de trabajo', 'error');
        return;
    }

    const name = await window.openInputModal('Nuevo Proyecto', 'Nombre del proyecto');
    if (!name) return;

    try {
        const newDirHandle = await state.workspaceHandle.getDirectoryHandle(name, { create: true });

        const newProject = {
            name: name,
            handle: newDirHandle,
            items: [],
            open: true
        };

        state.projects.push(newProject);
        saveMetadata();
        renderSidebar();
        notify('Proyecto creado: ' + name);
    } catch (err) {
        console.error('Error creando proyecto:', err);
        notify('Error al crear proyecto', 'error');
    }
}

// Exponer globalmente
window.createProjectAction = createProjectAction;

// ============================================
// SISTEMA JERÁRQUICO DE ARCHIVOS
// ============================================

window.openFileSmart = async function(pIdx, path) {
    const item = findItemByPath(pIdx, path);
    if (!item) {
        console.error('Item no encontrado:', pIdx, path);
        return;
    }

    if (item.items && item.items.length > 0 && !item.handle.getFile) {
        openFolderViewer(pIdx, path);
        return;
    }

    await openFileInEditor(pIdx, path);
};

async function openFileInEditor(pIdx, path) {
    const item = findItemByPath(pIdx, path);
    if (!item) return;

    if (state.isSaving) {
        notify('Guardando... espera un momento', 'info');
        return;
    }

    if (state.activeFile && state.activeFile !== item) {
        await saveFileContent(true);
    }

    state.activeFile = item;
    state.activeProjectIndex = pIdx;
    state.exploringFolder = null;

    try {
        const file = await item.handle.getFile();
        const content = await file.text();
        const data = parseFileContent(content);

        el.editor.innerHTML = data.content || '<p><br></p>';
        normalizeEditorHTML();
        assignParagraphUUIDs();
        migrateComments(item);

        item.sessionStartLength = content.length;
        if (!item.hist) item.hist = { added: 0, removed: 0, edited: 0 };
        item.lastModified = file.lastModified;

        el.charGoal.value = item.goal || state.config.defaultGoal || 30000;

        updateUI();
        updateStats();
        renderSidebar();
        updateParagraphCommentIndicators();

        localStorage.setItem('bg_last_file', JSON.stringify({ pIdx, path }));
        notify('Archivo abierto: ' + item.name.replace('.txt', ''));
    } catch (err) {
        console.error('Error abriendo archivo:', err);
        state.activeFile = item;
        el.editor.innerHTML = '<p><br></p>';
        notify('Error al abrir archivo', 'error');
    }
}

function openFolderViewer(pIdx, path) {
    const item = findItemByPath(pIdx, path);
    if (!item) return;

    state.activeFile = null;
    state.exploringFolder = { ...item, pIdx, path };
    state.activeProjectIndex = pIdx;
    updateUI();
    renderSidebar();
}

window.closeFile = async function() {
    if (state.activeFile) {
        notify('Guardando...');
        await saveFileContent(false);
    }

    state.activeFile = null;
    state.exploringFolder = null;
    state.activeProjectIndex = undefined;
    state.activeParagraphIndex = undefined;
    state.activeParagraphId = null;

    el.editor.innerHTML = '<p><br></p>';
    updateUI();
    renderSidebar();
};

// Mostrar pantalla de bienvenida/inicio
window.showWelcomeMessage = function() {
    // Cerrar archivo activo si hay uno
    if (state.activeFile) {
        saveFileContent(true);
        state.activeFile = null;
    }

    // Limpiar visor de carpetas
    state.exploringFolder = null;

    // Actualizar contenido de bienvenida según si hay workspace
    const welcomeContent = document.querySelector('.welcome-content');
    if (welcomeContent) {
        if (state.workspaceHandle && state.projects.length > 0) {
            // Pantalla con workspace - mostrar proyectos
            const projectList = state.projects.map((p, idx) => `
                <div class="welcome-project-item" onclick="openProjectViewer(${idx})">
                    <i class="fas fa-folder"></i>
                    <span>${escapeHtml(p.name)}</span>
                </div>
            `).join('');

            welcomeContent.innerHTML = `
                <div class="welcome-logo">
                    <i class="fas fa-shield-halved"></i>
                </div>
                <h1>Hola, <span id="welcome-user-name">${escapeHtml(localStorage.getItem('bg_user_name') || 'Escritor')}</span></h1>
                <p class="welcome-subtitle">Selecciona un proyecto para continuar</p>
                <div class="welcome-projects-list">
                    ${projectList}
                </div>
            `;
        } else {
            // Pantalla sin workspace - mostrar botón de conectar
            welcomeContent.innerHTML = `
                <div class="welcome-logo">
                    <i class="fas fa-shield-halved"></i>
                </div>
                <h1>Block Guard</h1>
                <p class="welcome-subtitle">Tu espacio de escritura protegido</p>
                <div class="welcome-actions">
                    <button class="btn-primary btn-large" onclick="window.selectWorkspace()">
                        <i class="fas fa-folder-open"></i> Conectar Carpeta
                    </button>
                    <p class="welcome-hint">Selecciona una carpeta de tu computadora para empezar</p>
                </div>
            `;
        }
    }

    // Mostrar pantalla de bienvenida
    if (el.welcomeScreen) {
        el.welcomeScreen.classList.remove('hidden');
        el.welcomeScreen.style.display = 'flex';
    }

    // Asegurar que sidebar y topbar estén visibles (si hay workspace)
    if (state.workspaceHandle) {
        if (el.sidebar) {
            el.sidebar.style.display = 'flex';
            el.sidebar.classList.remove('hidden');
        }
        if (el.topBar) {
            el.topBar.style.display = 'flex';
        }
    }

    updateBreadcrumbs();
    updateUI();
};

function resetUIState() {
    state.activeFile = null;
    state.activeProjectIndex = undefined;
    state.activeParagraphIndex = undefined;
    state.activeParagraphId = null;
    state.exploringFolder = null;

    el.editor.innerHTML = '<p><br></p>';
    if (el.breadcrumb) el.breadcrumb.innerHTML = '';
    if (el.statChars) el.statChars.innerText = '0';
    if (el.statWords) el.statWords.innerText = '0';
    if (el.statLines) el.statLines.innerText = '0';

    const welcome = document.getElementById('welcome-message');
    if (welcome) welcome.innerText = 'Conecta una carpeta local para empezar.';

    document.body.classList.add('no-workspace');
    renderSidebar();
    updateUI();
}

function autoOpenFile() {
    const lastFile = localStorage.getItem('bg_last_file');
    if (lastFile) {
        try {
            const { pIdx, path } = JSON.parse(lastFile);
            window.openFileSmart(pIdx, path);
        } catch (e) {
            console.log('No se pudo abrir último archivo');
        }
    }
}

// ============================================
// SIDEBAR JERÁRQUICO
// ============================================

function renderSidebar() {
    if (!el.projectList) return;
    el.projectList.innerHTML = '';

    if (!state.workspaceHandle) return;

    state.projects.forEach((project, pIdx) => {
        const li = document.createElement('li');
        li.className = `project-container ${project.open ? 'open' : ''}`;

        const navItem = document.createElement('div');
        navItem.className = `nav-item ${state.activeFile === project ? 'active' : ''}`;
        navItem.setAttribute('data-type', 'project');
        navItem.setAttribute('data-pidx', pIdx);
        navItem.setAttribute('data-path', '');
        navItem.title = project.name;
        navItem.innerHTML = `
            <span class="file-name-text">
                <span class="folder-icons-wrapper">
                    <i class="fas fa-chevron-${project.open ? 'down' : 'right'} toggle-icon"></i>
                    <i class="fas fa-folder folder-icon"></i>
                </span>
                <span class="text-content">${smartTruncate(project.name, 15)}</span>
            </span>
            <div class="nav-item-actions">
                <i class="fas fa-ellipsis-v nav-item-dots"></i>
            </div>
        `;

        navItem.onclick = (e) => {
            e.stopPropagation();
            if (e.target.closest('.nav-item-dots')) {
                window.showCtxManual(e, 'project', pIdx, '');
                return;
            }
            project.open = !project.open;
            renderSidebar();
            saveMetadata();
        };

        makeItemDroppable(navItem, pIdx, '', 'project');
        li.appendChild(navItem);

        const subList = document.createElement('ul');
        subList.className = `sub-nav-list ${project.open ? 'open' : ''}`;

        if (project.items && project.items.length > 0) {
            renderItems(project.items, pIdx, '', subList);
        }

        li.appendChild(subList);
        el.projectList.appendChild(li);
    });

    updateWelcomeRecent();
}

function renderItems(items, pIdx, parentPath, container) {
    items.forEach((item, iIdx) => {
        const currentPath = parentPath === '' ? `${iIdx}` : `${parentPath},${iIdx}`;
        const isActive = state.activeFile === item;
        const status = state.config.states.find(s => s.id === item.status) || state.config.states[0];
        const pct = Math.min((item.lastCharCount / (item.goal || state.config.defaultGoal || 30000)) * 100, 100);
        const offset = 56.5 - (56.5 * pct / 100);
        const hasChildren = item.items && item.items.length > 0;
        const displayName = item.name.replace('.txt', '');

        const li = document.createElement('li');
        li.className = `sub-nav-item ${isActive ? 'active' : ''} ${hasChildren ? 'has-children' : ''}`;
        li.setAttribute('data-type', 'file');
        li.setAttribute('data-pidx', pIdx);
        li.setAttribute('data-path', currentPath);
        li.title = item.name;
        li.innerHTML = `
            <span class="file-name-text">
                <span class="folder-icons-wrapper">
                    ${hasChildren ? `<i class="fas fa-chevron-${item.open ? 'down' : 'right'} toggle-icon"></i>` : ''}
                    <svg class="circle-progress" viewBox="0 0 24 24">
                        <circle class="bg" cx="12" cy="12" r="9"></circle>
                        <circle class="fg" cx="12" cy="12" r="9" style="stroke: ${status.color}; stroke-dashoffset: ${offset}"></circle>
                    </svg>
                </span>
                <span class="text-content">${smartTruncate(displayName, 18)}</span>
            </span>
            <i class="fas fa-ellipsis-v sub-nav-dots"></i>
        `;

        li.onclick = (e) => {
            e.stopPropagation();
            if (e.target.closest('.toggle-icon')) {
                item.open = !item.open;
                renderSidebar();
                saveMetadata();
                return;
            }
            if (e.target.closest('.sub-nav-dots')) {
                window.showCtxManual(e, 'file', pIdx, currentPath);
                return;
            }

            if (hasChildren && !item.open) {
                item.open = true;
                renderSidebar();
                saveMetadata();
            }
            window.openFileSmart(pIdx, currentPath);
        };

        makeItemDraggable(li, pIdx, currentPath, 'file');
        makeItemDroppable(li, pIdx, currentPath, 'file');

        container.appendChild(li);

        if (hasChildren) {
            const childrenContainer = document.createElement('ul');
            childrenContainer.className = `nested-list ${item.open ? 'open' : ''}`;
            renderItems(item.items, pIdx, currentPath, childrenContainer);
            container.appendChild(childrenContainer);
        }
    });
}

window.showCtxManual = function(e, type, pIdx, path) {
    state.contextTarget = { type, pIdx, path };

    const ctxAddSub = document.getElementById('ctx-add-sub');
    if (ctxAddSub) {
        ctxAddSub.innerHTML = type === 'project'
            ? '<i class="fas fa-file-plus"></i> <span>Nuevo Archivo</span>'
            : '<i class="fas fa-level-down-alt"></i> <span>Añadir Sub-archivo</span>';
    }

    if (el.ctxMenu) {
        el.ctxMenu.classList.remove('hidden');
        el.ctxMenu.style.top = `${e.clientY}px`;
        el.ctxMenu.style.left = `${e.clientX}px`;
    }
};

// ============================================
// DRAG & DROP
// ============================================

function makeItemDraggable(element, pIdx, path, type) {
    element.draggable = true;

    element.addEventListener('dragstart', (e) => {
        state.dragState.isDragging = true;
        state.dragState.draggedItem = findItemByPath(pIdx, path);
        state.dragState.draggedPath = path;
        state.dragState.draggedPIdx = pIdx;
        state.dragState.draggedType = type;

        element.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({ pIdx, path, type }));
    });

    element.addEventListener('dragend', () => {
        element.classList.remove('dragging');
        document.querySelectorAll('.drag-over, .drag-over-top, .drag-over-bottom').forEach(el => {
            el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
        });

        state.dragState.isDragging = false;
        state.dragState.draggedItem = null;
        state.dragState.draggedPath = null;
        state.dragState.draggedPIdx = null;
        state.dragState.draggedType = null;
    });
}

function makeItemDroppable(element, pIdx, path, type) {
    element.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (!state.dragState.isDragging) return;

        const rect = element.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        element.classList.remove('drag-over-top', 'drag-over-bottom');
        element.classList.add(e.clientY < midY ? 'drag-over-top' : 'drag-over-bottom');
    });

    element.addEventListener('dragleave', () => {
        element.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    element.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        element.classList.remove('drag-over-top', 'drag-over-bottom');

        if (!state.dragState.isDragging || !state.dragState.draggedItem) return;

        const targetItem = findItemByPath(pIdx, path);
        if (!targetItem) return;

        const draggedItem = state.dragState.draggedItem;
        if (draggedItem === targetItem) return;
        if (isDescendant(draggedItem, targetItem)) return;

        const rect = element.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const position = e.clientY < midY ? 'before' : 'after';

        await performDragDrop(targetItem, pIdx, path, type, position);
    });
}

function isDescendant(parent, child) {
    if (!parent.items || parent.items.length === 0) return false;
    for (const item of parent.items) {
        if (item === child) return true;
        if (isDescendant(item, child)) return true;
    }
    return false;
}

async function performDragDrop(targetItem, targetPIdx, targetPath, targetType, position) {
    const draggedItem = state.dragState.draggedItem;
    const draggedPIdx = state.dragState.draggedPIdx;
    const draggedPath = state.dragState.draggedPath;

    if (!draggedItem || !targetItem) return;

    try {
        let targetDirHandle;
        if (targetType === 'project') {
            targetDirHandle = targetItem.handle;
        } else {
            if (position === 'before') {
                targetDirHandle = targetItem.parentDirHandle;
            } else {
                const isTargetAtRoot = !targetPath.includes(',');
                if (isTargetAtRoot && targetItem.items) {
                    const subDirName = 'sub_' + targetItem.name.replace('.txt', '');
                    targetDirHandle = await targetItem.parentDirHandle.getDirectoryHandle(subDirName, { create: true });
                } else {
                    targetDirHandle = targetItem.parentDirHandle;
                }
            }
        }

        await physicalFileMove(draggedItem, targetDirHandle);

        const sourceCollection = getParentCollection(draggedPIdx, draggedPath);
        const sourceIndex = getIndexFromPath(draggedPath);
        sourceCollection.splice(sourceIndex, 1);

        let targetCollection;
        let targetIndex;

        if (targetType === 'project') {
            targetCollection = targetItem.items;
            targetIndex = position === 'before' ? 0 : targetCollection.length;
        } else {
            const parentCollection = getParentCollection(targetPIdx, targetPath);
            const itemIndex = getIndexFromPath(targetPath);

            if (position === 'before') {
                targetCollection = parentCollection;
                targetIndex = itemIndex;
            } else {
                const isTargetAtRoot = !targetPath.includes(',');
                if (isTargetAtRoot && targetItem.items) {
                    targetCollection = targetItem.items;
                    targetIndex = targetItem.items.length;
                    targetItem.open = true;
                } else {
                    targetCollection = parentCollection;
                    targetIndex = itemIndex + 1;
                }
            }
        }

        targetCollection.splice(targetIndex, 0, draggedItem);
        updateItemProjectName(draggedItem, targetPIdx);

        state.dragState = {
            isDragging: false,
            draggedItem: null,
            draggedPath: null,
            draggedPIdx: null,
            dropTarget: null
        };

        saveMetadata();
        renderSidebar();
        updateUI();
        notify('Archivo movido');
    } catch (err) {
        console.error('Error en drag & drop:', err);
        notify('Error al mover archivo', 'error');
    }
}

async function physicalFileMove(fileItem, newParentDirHandle) {
    const oldHandle = fileItem.handle;
    const fileName = fileItem.name;
    const oldParentDir = fileItem.parentDirHandle;

    try {
        const newFileHandle = await newParentDirHandle.getFileHandle(fileName, { create: true });
        const oldFile = await oldHandle.getFile();
        const writable = await newFileHandle.createWritable();
        await writable.write(await oldFile.arrayBuffer());
        await writable.close();

        const subDirName = 'sub_' + fileName.replace('.txt', '');
        let oldSubDir;
        try {
            oldSubDir = await oldParentDir.getDirectoryHandle(subDirName);
        } catch (e) { }

        if (oldSubDir) {
            const newSubDir = await newParentDirHandle.getDirectoryHandle(subDirName, { create: true });
            await copyDirRecursive(oldSubDir, newSubDir);
            await oldParentDir.removeEntry(subDirName, { recursive: true });
        }

        await oldParentDir.removeEntry(fileName);

        fileItem.handle = newFileHandle;
        fileItem.parentDirHandle = newParentDirHandle;

        return true;
    } catch (err) {
        console.error('Error moviendo archivo físicamente:', err);
        throw err;
    }
}

async function copyDirRecursive(srcHandle, destHandle) {
    for await (const entry of srcHandle.values()) {
        if (entry.kind === 'file') {
            const srcFile = await entry.getFile();
            const destFileHandle = await destHandle.getFileHandle(entry.name, { create: true });
            const writable = await destFileHandle.createWritable();
            await writable.write(await srcFile.arrayBuffer());
            await writable.close();
        } else if (entry.kind === 'directory') {
            const newDestHandle = await destHandle.getDirectoryHandle(entry.name, { create: true });
            await copyDirRecursive(entry, newDestHandle);
        }
    }
}

function updateItemProjectName(item, pIdx) {
    const project = state.projects[pIdx];
    if (project) {
        item.projectName = project.name;
    }
    if (item.items) {
        item.items.forEach(child => updateItemProjectName(child, pIdx));
    }
}

// ============================================
// UTILIDADES DE RUTAS
// ============================================

function findItemByPath(pIdx, pathStr) {
    if (pIdx === undefined || pIdx === null) return null;
    let item = state.projects[pIdx];
    if (!item) return null;
    if (!pathStr || pathStr === '') return item;

    const parts = (pathStr + '').split(',').filter(x => x !== '').map(Number);
    for (const idx of parts) {
        if (!item.items || !item.items[idx]) return item;
        item = item.items[idx];
    }
    return item;
}

function getParentCollection(pIdx, pathStr) {
    if (!pathStr) return state.projects[pIdx]?.items || [];
    const parts = pathStr.split(',').map(Number);
    let p = state.projects[pIdx];
    if (parts.length === 1) return p.items;
    for (let i = 0; i < parts.length - 1; i++) {
        p = p.items[parts[i]];
    }
    return p.items;
}

function getIndexFromPath(path) {
    if (!path) return 0;
    const parts = path.split(',').map(Number);
    return parts[parts.length - 1];
}

function getPathFromItem(target) {
    let found = null;
    state.projects.forEach((p, pIdx) => {
        const check = (items, path) => {
            items.forEach((it, idx) => {
                const current = path === '' ? `${idx}` : `${path},${idx}`;
                if (it === target) found = current;
                if (it.items) check(it.items, current);
            });
        };
        check(p.items, '');
    });
    return found || '';
}

// ============================================
// EDITOR RICO - TOOLBAR DE FORMATO
// ============================================

function createFormattingToolbar() {
    const toolbar = document.createElement('div');
    toolbar.id = 'formatting-toolbar';
    toolbar.className = 'formatting-toolbar hidden';

    toolbar.innerHTML = `
        <div class="format-group">
            <button class="format-btn" data-action="bold" title="Negrita (Ctrl+B)"><i class="fas fa-bold"></i></button>
            <button class="format-btn" data-action="italic" title="Cursiva (Ctrl+I)"><i class="fas fa-italic"></i></button>
            <button class="format-btn" data-action="underline" title="Subrayado (Ctrl+U)"><i class="fas fa-underline"></i></button>
            <button class="format-btn" data-action="strikethrough" title="Tachado"><i class="fas fa-strikethrough"></i></button>
        </div>
        <div class="format-group">
            <button class="format-btn" data-action="h1" title="Título 1">H1</button>
            <button class="format-btn" data-action="h2" title="Título 2">H2</button>
            <button class="format-btn" data-action="h3" title="Título 3">H3</button>
        </div>
        <div class="format-group">
            <div style="position: relative;">
                <button class="format-btn" id="highlighter-btn" data-action="highlight" title="Marcar">
                    <i class="fas fa-highlighter"></i>
                </button>
                <div id="highlight-picker" class="highlight-color-picker">
                    <div class="color-option" style="background: #ffff00;" data-color="#ffff00"></div>
                    <div class="color-option" style="background: #00ff00;" data-color="#00ff00"></div>
                    <div class="color-option" style="background: #00ffff;" data-color="#00ffff"></div>
                    <div class="color-option" style="background: #ff00ff;" data-color="#ff00ff"></div>
                    <div class="color-option" style="background: #ff8000;" data-color="#ff8000"></div>
                    <div class="color-option" style="background: transparent; border: 1px solid var(--text-tertiary);" data-color="transparent">
                        <i class="fas fa-times" style="font-size: 10px; color: var(--text-tertiary)"></i>
                    </div>
                </div>
            </div>
            <button class="format-btn" data-action="insertUnorderedList" title="Lista"><i class="fas fa-list-ul"></i></button>
            <button class="format-btn" data-action="comment" title="Comentar"><i class="fas fa-comment-medical"></i></button>
        </div>
    `;

    document.body.appendChild(toolbar);
    el.formattingToolbar = toolbar;

    toolbar.querySelectorAll('.format-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.getAttribute('data-action');
            if (action === 'highlight') {
                document.getElementById('highlight-picker').classList.toggle('open');
            } else {
                executeFormatAction(action);
            }
        });
    });

    toolbar.querySelectorAll('.color-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            const color = opt.getAttribute('data-color');
            window.applyHighlight(color);
            document.getElementById('highlight-picker').classList.remove('open');
        });
    });

    document.addEventListener('mousedown', (e) => {
        const picker = document.getElementById('highlight-picker');
        if (picker && !picker.contains(e.target) && !e.target.closest('#highlighter-btn')) {
            picker.classList.remove('open');
        }
    });
}

function executeFormatAction(action) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0).cloneRange();

    switch (action) {
        case 'bold':
            document.execCommand('bold', false, null);
            break;
        case 'italic':
            document.execCommand('italic', false, null);
            break;
        case 'underline':
            document.execCommand('underline', false, null);
            break;
        case 'strikethrough':
            document.execCommand('strikeThrough', false, null);
            break;
        case 'h1':
        case 'h2':
        case 'h3':
            toggleHeading(action);
            break;
        case 'insertUnorderedList':
            document.execCommand('insertUnorderedList', false, null);
            break;
        case 'comment':
            addCommentToSelection();
            break;
    }

    if (selection.rangeCount === 0 || !el.editor.contains(selection.anchorNode)) {
        selection.removeAllRanges();
        selection.addRange(range);
    }

    el.editor.focus();
    updateFormattingToolbarState();
    updateStats();
    saveFileContent(false);
}

function toggleHeading(tag) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const node = selection.anchorNode.parentElement;
    const currentTag = node.tagName.toLowerCase();

    // Si ya es el mismo heading, convertir a párrafo
    if (currentTag === tag) {
        document.execCommand('formatBlock', false, 'p');
    } else if (['h1', 'h2', 'h3'].includes(currentTag)) {
        // Cambiar de un heading a otro
        document.execCommand('formatBlock', false, tag);
    } else {
        // Aplicar nuevo heading
        document.execCommand('formatBlock', false, tag);
    }

    // Actualizar estado visual de botones
    updateFormattingToolbarState();

    // Guardar cambios
    updateStats();
    saveFileContent(false);
}

window.applyHighlight = function(color) {
    const selection = window.getSelection();
    if (!selection.rangeCount || selection.isCollapsed) {
        notify('Selecciona texto primero', 'info');
        return;
    }

    if (color === 'transparent' || color === 'none' || color === 'remove') {
        removeHighlight();
    } else {
        const range = selection.getRangeAt(0);

        // Verificar si ya está marcado con el mismo color
        const existingMark = range.commonAncestorContainer.parentElement;
        if (existingMark && existingMark.tagName === 'MARK' && 
            existingMark.style.backgroundColor === color) {
            // Quitar el marcado si es el mismo color
            removeHighlight();
            return;
        }

        // Crear nuevo marcado
        const mark = document.createElement('mark');
        mark.style.backgroundColor = color;
        mark.style.padding = '2px 4px';
        mark.style.borderRadius = '4px';
        mark.style.color = 'inherit';

        try {
            const contents = range.extractContents();
            mark.appendChild(contents);
            range.insertNode(mark);

            // Limpiar selección
            selection.removeAllRanges();

            notify('Texto resaltado', 'success');
        } catch (err) {
            console.error('Error al resaltar:', err);
        }
    }

    updateStats();
    saveFileContent(false);
};

function removeHighlight() {
    const selection = window.getSelection();
    if (!selection.rangeCount || selection.isCollapsed) {
        notify('Selecciona texto resaltado', 'info');
        return;
    }

    const range = selection.getRangeAt(0);
    let node = range.commonAncestorContainer;

    // Buscar el elemento mark más cercano
    if (node.nodeType === Node.TEXT_NODE) {
        node = node.parentElement;
    }

    // Buscar hacia arriba en el DOM
    let markElement = null;
    let current = node;
    while (current && current !== el.editor) {
        if (current.tagName === 'MARK') {
            markElement = current;
            break;
        }
        current = current.parentElement;
    }

    if (markElement) {
        // Reemplazar el mark con su contenido de texto
        const textContent = markElement.textContent;
        const textNode = document.createTextNode(textContent);
        markElement.parentNode.replaceChild(textNode, markElement);
        notify('Resaltado eliminado', 'success');
    } else {
        // Intentar con removeFormat como fallback
        document.execCommand('removeFormat', false, null);
    }

    updateStats();
    saveFileContent(false);
}

// Función para quitar todos los resaltados de un párrafo
window.clearParagraphHighlights = function(paragraph) {
    if (!paragraph) return;

    const marks = paragraph.querySelectorAll('mark');
    marks.forEach(mark => {
        const textNode = document.createTextNode(mark.textContent);
        mark.parentNode.replaceChild(textNode, mark);
    });

    if (marks.length > 0) {
        saveFileContent(false);
    }
};

function setupTextFormatting() {
    if (!el.editor) return;

    el.editor.addEventListener('mouseup', handleTextSelection);
    el.editor.addEventListener('keyup', (e) => {
        if (e.key.length === 1 || ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
            setTimeout(() => {
                handleTextSelection();
                updateFormattingToolbarState();
            }, 10);
        }
    });

    el.editor.addEventListener('click', () => {
        setTimeout(updateFormattingToolbarState, 10);
    });

    el.editor.addEventListener('paste', handlePaste);
}

function handlePaste(e) {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');

    if (html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        const allowedTags = ['B', 'I', 'U', 'S', 'MARK', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'P'];

        const sanitize = (node) => {
            const children = Array.from(node.childNodes);
            children.forEach(child => {
                if (child.nodeType === 1) {
                    if (!allowedTags.includes(child.tagName)) {
                        const textNode = document.createTextNode(child.textContent);
                        child.parentNode.replaceChild(textNode, child);
                    } else {
                        while (child.attributes.length > 0) {
                            child.removeAttribute(child.attributes[0].name);
                        }
                        sanitize(child);
                    }
                }
            });
        };

        sanitize(div);
        document.execCommand('insertHTML', false, div.innerHTML);
    } else {
        document.execCommand('insertText', false, text);
    }
    updateStats();
}

function handleTextSelection() {
    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text.length > 0 && el.editor.contains(selection.anchorNode)) {
        showFormattingToolbar();
    } else {
        hideFormattingToolbar();
    }
}

function showFormattingToolbar() {
    if (!el.formattingToolbar) return;
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    const toolbarWidth = el.formattingToolbar.offsetWidth || 400;
    const toolbarHeight = 50;

    let left = rect.left + (rect.width / 2) - (toolbarWidth / 2);
    let top = rect.top - toolbarHeight - 10;

    const padding = 10;
    left = Math.max(padding, Math.min(left, window.innerWidth - toolbarWidth - padding));

    if (top < padding) {
        top = rect.bottom + 10;
    }

    el.formattingToolbar.style.left = `${left}px`;
    el.formattingToolbar.style.top = `${top}px`;
    el.formattingToolbar.classList.remove('hidden');

    updateFormattingToolbarState();
}

function hideFormattingToolbar() {
    if (el.formattingToolbar) {
        el.formattingToolbar.classList.add('hidden');
    }
    const picker = document.getElementById('highlight-picker');
    if (picker) picker.classList.remove('open');
}

function updateFormattingToolbarState() {
    if (!el.formattingToolbar) return;

    const buttons = el.formattingToolbar.querySelectorAll('.format-btn');
    const selection = window.getSelection();

    let currentBlock = null;
    if (selection.rangeCount > 0) {
        let node = selection.anchorNode;
        if (node.nodeType === 3) node = node.parentElement;
        currentBlock = node.closest('h1, h2, h3, p, blockquote');
    }

    const currentTag = currentBlock?.tagName.toLowerCase() || 'p';

    buttons.forEach(btn => {
        const action = btn.getAttribute('data-action');
        let isActive = false;

        switch (action) {
            case 'bold':
                isActive = document.queryCommandState('bold');
                break;
            case 'italic':
                isActive = document.queryCommandState('italic');
                break;
            case 'underline':
                isActive = document.queryCommandState('underline');
                break;
            case 'strikethrough':
                isActive = document.queryCommandState('strikeThrough');
                break;
            case 'h1':
                isActive = currentTag === 'h1';
                break;
            case 'h2':
                isActive = currentTag === 'h2';
                break;
            case 'h3':
                isActive = currentTag === 'h3';
                break;
            case 'insertUnorderedList':
                isActive = document.queryCommandState('insertUnorderedList');
                break;
        }

        btn.classList.toggle('active', isActive);

        // Actualizar tooltip para indicar toggle
        if (['h1', 'h2', 'h3'].includes(action)) {
            const tooltip = isActive ? 'Convertir a párrafo' : `Aplicar ${action.toUpperCase()}`;
            btn.title = tooltip;
        }
    });
}

function normalizeEditorHTML() {
    if (!el.editor) return;

    if (el.editor.childNodes.length > 0 && el.editor.firstChild.nodeType === 3) {
        document.execCommand('formatBlock', false, 'p');
    }

    const forbidden = el.editor.querySelectorAll('blockquote h1, blockquote h2, blockquote h3, h1 p, h2 p, h3 p');
    if (forbidden.length > 0) {
        console.warn('[Block Guard] Detectada anidación inválida, normalizando...');
        forbidden.forEach(node => {
            const parent = node.parentNode;
            while (node.firstChild) {
                parent.insertBefore(node.firstChild, node);
            }
            parent.removeChild(node);
        });
    }
}

function assignParagraphUUIDs() {
    const children = Array.from(el.editor.children);
    children.forEach(child => {
        if (['P', 'H1', 'H2', 'H3', 'BLOCKQUOTE'].includes(child.tagName)) {
            if (!child.getAttribute('data-paragraph-id')) {
                child.setAttribute('data-paragraph-id', generateUUID());
            }
        }
    });
}

// ============================================
// SISTEMA DE COMENTARIOS
// ============================================

function addCommentToSelection() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const block = range.startContainer.parentElement?.closest('p, h1, h2, h3, blockquote');

    if (block && state.activeFile) {
        const paragraphs = Array.from(el.editor.querySelectorAll('p, h1, h2, h3, blockquote'));
        state.activeParagraphIndex = paragraphs.indexOf(block);

        if (!block.getAttribute('data-paragraph-id')) {
            block.setAttribute('data-paragraph-id', generateUUID());
        }
        state.activeParagraphId = block.getAttribute('data-paragraph-id');

        if (el.commentsSidebar) el.commentsSidebar.classList.remove('hidden');
        if (el.commentsOverlay) el.commentsOverlay.classList.remove('hidden');
        renderComments();
    }
}

function postComment(text) {
    if (!text.trim() || !state.activeFile) return;

    if (!state.activeParagraphId) {
        const paragraphs = Array.from(el.editor.querySelectorAll('p, h1, h2, h3, blockquote'));
        if (paragraphs.length > 0) {
            const firstP = paragraphs[0];
            if (!firstP.getAttribute('data-paragraph-id')) {
                firstP.setAttribute('data-paragraph-id', generateUUID());
            }
            state.activeParagraphId = firstP.getAttribute('data-paragraph-id');
            state.activeParagraphIndex = 0;
        }
    }

    if (!state.activeParagraphId) {
        notify('No hay párrafo seleccionado', 'error');
        return;
    }

    if (!state.activeFile.comments) state.activeFile.comments = [];

    const comment = {
        id: generateUUID(),
        paragraphId: state.activeParagraphId,
        text: text,
        timestamp: Date.now(),
        author: localStorage.getItem('bg_user_name') || 'Escritor'
    };

    state.activeFile.comments.push(comment);
    saveFileContent(false);
    renderComments();
    updateParagraphCommentIndicators();
    notify('Comentario añadido');
}

function renderComments() {
    const list = el.commentsList;
    if (!list) return;

    const comments = (state.activeFile?.comments || []).filter(c => {
        if (state.activeParagraphId) {
            return c.paragraphId === state.activeParagraphId;
        }
        return true;
    });

    if (comments.length === 0) {
        list.innerHTML = '<p class="no-comments">No hay comentarios aún.</p>';
        return;
    }

    list.innerHTML = comments.map(c => `
        <div class="comment-item" data-comment-id="${c.id}">
            <div class="comment-header">
                <span class="comment-author">${escapeHtml(c.author)}</span>
                <span class="comment-date">${new Date(c.timestamp).toLocaleString()}</span>
            </div>
            <div class="comment-text">${escapeHtml(c.text)}</div>
            <button class="delete-comment-btn" onclick="deleteComment('${c.id}')">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}
// ============================================
// INDICADORES DE COMENTARIOS EN PÁRRAFOS
// ============================================

function updateParagraphCommentIndicators() {
    if (!state.activeFile?.comments) return;

    // Limpiar indicadores anteriores
    document.querySelectorAll('.comment-indicator').forEach(el => el.remove());
    document.querySelectorAll('.has-comments-marker').forEach(el => el.classList.remove('has-comments-marker'));

    // Limpiar comentarios huérfanos (que no tienen párrafo asociado)
    const validParagraphIds = new Set();
    document.querySelectorAll('[data-paragraph-id]').forEach(el => {
        validParagraphIds.add(el.getAttribute('data-paragraph-id'));
    });

    // Filtrar comentarios huérfanos
    const orphanComments = state.activeFile.comments.filter(c => !validParagraphIds.has(c.paragraphId));
    if (orphanComments.length > 0) {
        console.log(`[Block Guard] Eliminando ${orphanComments.length} comentarios huérfanos`);
        state.activeFile.comments = state.activeFile.comments.filter(c => validParagraphIds.has(c.paragraphId));
        saveFileContent(false);
    }

    // Agrupar comentarios por párrafo
    const commentsByParagraph = {};
    state.activeFile.comments.forEach(c => {
        if (!commentsByParagraph[c.paragraphId]) {
            commentsByParagraph[c.paragraphId] = [];
        }
        commentsByParagraph[c.paragraphId].push(c);
    });

    // Añadir indicadores
    Object.entries(commentsByParagraph).forEach(([paraId, comments]) => {
        const paragraph = document.querySelector(`[data-paragraph-id="${paraId}"]`);
        if (!paragraph) return;

        // Verificar si ya tiene indicador
        if (paragraph.querySelector('.comment-indicator')) return;

        const indicator = document.createElement('div');
        indicator.className = 'comment-indicator';
        indicator.innerHTML = `
            <i class="fas fa-comment"></i>
            ${comments.length > 1 ? `<span class="comment-count">${comments.length}</span>` : ''}
        `;
        indicator.title = `${comments.length} comentario${comments.length > 1 ? 's' : ''}`;

        // Hacer clickeable
        indicator.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            state.activeParagraphId = paraId;
            openCommentsSidebar();
        };

        // Asegurar que el párrafo tenga posición relativa
        paragraph.style.position = 'relative';
        paragraph.appendChild(indicator);

        // Añadir clase para estilo
        paragraph.classList.add('has-comments-marker');
    });
}

// Función para limpiar todos los comentarios huérfanos del archivo
window.cleanOrphanComments = function() {
    if (!state.activeFile?.comments) return;

    const validParagraphIds = new Set();
    document.querySelectorAll('[data-paragraph-id]').forEach(el => {
        validParagraphIds.add(el.getAttribute('data-paragraph-id'));
    });

    const originalCount = state.activeFile.comments.length;
    state.activeFile.comments = state.activeFile.comments.filter(c => validParagraphIds.has(c.paragraphId));

    if (state.activeFile.comments.length < originalCount) {
        saveFileContent(false);
        updateParagraphCommentIndicators();
        notify(`${originalCount - state.activeFile.comments.length} comentarios huérfanos eliminados`, 'success');
    } else {
        notify('No hay comentarios huérfanos', 'info');
    }
};

function openCommentsSidebar() {
    if (el.commentsSidebar) {
        el.commentsSidebar.classList.remove('hidden');
        renderComments();

        // Scroll al área de comentarios
        if (el.newCommentInput) {
            setTimeout(() => el.newCommentInput.focus(), 100);
        }
    }
    if (el.commentsOverlay) {
        el.commentsOverlay.classList.remove('hidden');
    }
}


window.deleteComment = function(commentId) {
    if (!state.activeFile?.comments) return;
    state.activeFile.comments = state.activeFile.comments.filter(c => c.id !== commentId);
    saveFileContent(false);
    renderComments();
    updateParagraphCommentIndicators();
    notify('Comentario eliminado');
};

function migrateComments(file) {
    if (!file.comments || file.comments.length === 0) return;

    let changed = false;
    const paras = Array.from(el.editor.children);

    file.comments.forEach(c => {
        if (!c.paragraphId && c.pIdx !== undefined) {
            const p = paras[c.pIdx];
            if (p) {
                c.paragraphId = p.getAttribute('data-paragraph-id');
                changed = true;
            }
        }
    });

    if (changed) saveMetadata();
}

// ============================================
// SISTEMA DE ESTADOS Y PROGRESO
// ============================================

function renderStateConfig() {
    const list = el.statesConfigList;
    if (!list) return;

    const actionLabels = {
        'absolute': 'Contar Totales',
        'edited': 'Contar Ediciones',
        'delta': 'Contar Nuevos'
    };

    list.innerHTML = state.config.states.map((s, i) => `
        <div class="state-config-item">
            <div class="state-reorder-actions">
                <i class="fas fa-chevron-up ${i === 0 ? 'hidden' : ''}" onclick="moveStateUp(${i})"></i>
                <i class="fas fa-chevron-down ${i === state.config.states.length - 1 ? 'hidden' : ''}" onclick="moveStateDown(${i})"></i>
            </div>
            <div class="state-color-indicator" style="background: ${s.color}"></div>
            <div class="state-info-edit">
                <span class="state-name-display">${escapeHtml(s.name)}</span>
                <span class="action-label">${actionLabels[s.countType] || 'Contar Totales'}</span>
            </div>
            <div class="state-item-actions">
                <button class="btn-icon-small" onclick="fullEditState(${i})" title="Editar"><i class="fas fa-pen"></i></button>
                <button class="btn-icon-small danger" onclick="removeState(${i})" title="Eliminar"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

window.fullEditState = async function(index) {
    const s = state.config.states[index];
    state.editingStateIndex = index;

    if (el.editStateName) el.editStateName.value = s.name;
    if (el.editStateType) el.editStateType.value = s.countType || 'absolute';
    if (el.editStateColor) el.editStateColor.value = s.color;

    const modal = document.getElementById('state-edit-modal');
    if (modal) {
        modal.classList.add('open');
        trapFocus(modal);
    }
};

window.saveStateFullEdit = function() {
    const index = state.editingStateIndex;
    if (index === undefined) return;

    const s = state.config.states[index];
    s.name = el.editStateName?.value || s.name;
    s.countType = el.editStateType?.value || s.countType;
    s.color = el.editStateColor?.value || s.color;

    const modal = document.getElementById('state-edit-modal');
    if (modal) modal.classList.remove('open');

    saveConfig();
    renderStateConfig();
    updateUI();
    notify('Estado actualizado');
};

window.moveStateUp = function(index) {
    if (index <= 0) return;
    [state.config.states[index], state.config.states[index - 1]] = [state.config.states[index - 1], state.config.states[index]];
    saveConfig();
    renderStateConfig();
};

window.moveStateDown = function(index) {
    if (index >= state.config.states.length - 1) return;
    [state.config.states[index], state.config.states[index + 1]] = [state.config.states[index + 1], state.config.states[index]];
    saveConfig();
    renderStateConfig();
};

window.removeState = function(index) {
    if (state.config.states.length <= 1) {
        notify('Debe haber al menos un estado', 'error');
        return;
    }
    if (!confirm('¿Eliminar este estado?')) return;

    state.config.states.splice(index, 1);
    saveConfig();
    renderStateConfig();
    renderSidebar();
    notify('Estado eliminado');
};

function getStateColor(stateId) {
    const s = state.config.states.find(st => st.id === stateId);
    return s ? s.color : '#0071e3';
}

function getStateName(stateId) {
    const s = state.config.states.find(st => st.id === stateId);
    return s ? s.name : 'Desconocido';
}

function getFileProgress(item) {
    const stateId = item.status || 'draft';
    const s = state.config.states.find(st => st.id === stateId);
    if (!s) return { current: 0, goal: 30000, percentage: 0 };

    let current = 0;
    switch (s.countType) {
        case 'absolute':
            current = item.lastCharCount || 0;
            break;
        case 'edited':
            current = item.hist?.edited || item.lastCharCount || 0;
            break;
        case 'delta':
            current = Math.abs((item.lastCharCount || 0) - (item.initialCharCount || 0));
            break;
    }

    const percentage = Math.min(100, Math.round((current / s.goal) * 100));
    return { current, goal: s.goal, percentage };
}

let updateStatsTimeout = null;
function updateStats() {
    if (updateStatsTimeout) clearTimeout(updateStatsTimeout);
    updateStatsTimeout = setTimeout(() => {
        const text = el.editor?.innerText || '';
        const file = state.activeFile;
        if (!file) return;

        const paragraphs = el.editor?.querySelectorAll('p, h1, h2, h3, blockquote') || [];
        if (el.statLines) el.statLines.innerHTML = `<i class="fas fa-paragraph"></i> ${paragraphs.length}`;
        if (el.statWords) el.statWords.innerHTML = `<i class="fas fa-font"></i> ${text.trim() ? text.trim().split(/\s+/).length : 0}`;
        if (el.statChars) el.statChars.innerHTML = `<i class="fas fa-align-left"></i> ${text.length}`;

        file.lastCharCount = text.length;

        if (file.hist) {
            const change = Math.abs(text.length - (file.sessionStartLength || 0));
            file.hist.edited = change;
        }

        updateActiveFileProgress();
        saveMetadata();
        renderSidebar();
    }, 500);
}

function updateActiveFileProgress() {
    if (!state.activeFile) return;

    const { current, goal, percentage } = getFileProgress(state.activeFile);
    const stateObj = state.config.states.find(s => s.id === state.activeFile.status) || state.config.states[0];

    if (el.progressText) el.progressText.innerText = `${percentage}%`;

    if (el.goalProgress) {
        el.goalProgress.style.width = `${percentage}%`;
        el.goalProgress.style.background = stateObj.color;
    }

    // Actualizar badge de estado
    const statusBar = document.getElementById('status-bar');
    if (statusBar) {
        statusBar.textContent = stateObj.name;
        statusBar.style.background = stateObj.color;
    }

    // Actualizar botón upgrade
    if (el.upgradeStatus) {
        const currentIndex = state.config.states.findIndex(s => s.id === state.activeFile.status);
        const isFinal = currentIndex >= state.config.states.length - 1;

        if (isFinal) {
            el.upgradeStatus.innerHTML = '<i class="fas fa-check"></i> Completado';
            el.upgradeStatus.style.background = '#34c759';
            el.upgradeStatus.disabled = true;
            el.upgradeStatus.style.cursor = 'not-allowed';
            el.upgradeStatus.style.opacity = '0.7';
        } else {
            el.upgradeStatus.innerHTML = '<i class="fas fa-arrow-up"></i> Upgrade';
            el.upgradeStatus.style.background = 'var(--accent-blue)';
            el.upgradeStatus.disabled = false;
            el.upgradeStatus.style.cursor = 'pointer';
            el.upgradeStatus.style.opacity = '1';
        }
    }
}

function handleCharGoalChange() {
    const goal = parseInt(el.charGoal?.value) || 30000;
    if (state.activeFile) {
        state.activeFile.goal = goal;
        updateActiveFileProgress();
        saveMetadata();
    }
}

window.upgradeStatusAction = async function() {
    if (!state.activeFile) return;

    const currentIndex = state.config.states.findIndex(s => s.id === state.activeFile.status);
    const newIndex = currentIndex + 1;

    if (newIndex >= state.config.states.length) {
        notify('Ya está en el estado final', 'info');
        return;
    }

    const newState = state.config.states[newIndex];
    state.activeFile.status = newState.id;
    state.activeFile.goal = newState.goal;

    saveMetadata();
    renderSidebar();
    updateActiveFileProgress();
    notify(`Estado actualizado a: ${newState.name}`, 'success');
};

// Función para reiniciar estado a borrador (desde menú contextual)
window.resetStatusToDraft = async function() {
    const target = state.contextTarget;
    if (!target) return;

    const item = findItemByPath(target.pIdx, target.path);
    if (!item) return;

    const confirmed = await window.openConfirmModal(
        'Reiniciar Progreso',
        `¿Volver "${item.name}" a "Primer Borrador"? Esto reiniciará las estadísticas pero mantendrá el texto.`,
        'fa-exclamation-triangle'
    );

    if (!confirmed) return;

    item.status = 'draft';
    item.initialCharCount = item.lastCharCount || 0;
    item.hist = { added: 0, removed: 0, edited: 0 };
    item.goal = state.config.states[0].goal;

    saveMetadata();
    renderSidebar();
    if (state.activeFile === item) {
        updateActiveFileProgress();
    }
    notify('Progreso reiniciado', 'success');
};

// ============================================
// SISTEMA DE UI/UPDATE
// ============================================

function updateUI() {
    const hasWorkspace = !!state.workspaceHandle;
    const hasActiveFile = !!state.activeFile;
    const isExploring = !!state.exploringFolder;

    // Manejar pantalla de bienvenida cuando no hay workspace
    if (!hasWorkspace) {
        document.body.classList.add('no-workspace');
        if (el.sidebar) {
            el.sidebar.style.display = 'none';
        }
        if (el.welcomeScreen) {
            el.welcomeScreen.classList.remove('hidden');
            el.welcomeScreen.style.display = 'flex';
        }
        if (el.topBar) {
            el.topBar.style.display = 'none';
        }
        return;
    } else {
        document.body.classList.remove('no-workspace');
        if (el.sidebar) {
            el.sidebar.style.display = 'flex';
        }
        if (el.topBar) {
            el.topBar.style.display = 'flex';
        }
    }

    if (el.welcomeScreen) {
        el.welcomeScreen.classList.toggle('hidden', hasActiveFile || isExploring);
    }

    if (el.editor) {
        el.editor.classList.toggle('hidden', !hasActiveFile);
    }

    if (el.metadataPanel) {
        el.metadataPanel.classList.toggle('hidden', !hasActiveFile);
    }

    if (el.activeFileTitle) {
        el.activeFileTitle.innerText = hasActiveFile ? state.activeFile.name.replace('.txt', '') : '';
    }

    updateBreadcrumbs();
    updateActiveFileProgress();

    if (isExploring) {
        renderFolderViewer();
    }
}

function updateBreadcrumbs() {
    if (!el.breadcrumb) return;

    if (!state.activeFile) {
        el.breadcrumb.innerHTML = `
            <button id="show-sidebar-btn" class="show-sidebar-btn ${state.sidebarCollapsed ? 'visible' : ''}" title="Mostrar Sidebar">
                <i class="fas fa-bars"></i>
            </button>
            <span class="breadcrumb-item" onclick="showWelcomeMessage()" title="Ir al inicio"><i class="fas fa-home"></i> Inicio</span>
        `;
        // Re-asignar event listener al botón
        const btn = document.getElementById('show-sidebar-btn');
        if (btn) {
            btn.onclick = () => {
                if (el.sidebar) {
                    el.sidebar.classList.remove('collapsed');
                    el.sidebar.style.width = '280px';
                    btn.classList.remove('visible');
                    if (el.mainContent) {
                        el.mainContent.style.marginLeft = '280px';
                        el.mainContent.style.width = 'calc(100% - 280px)';
                    }
                    state.sidebarCollapsed = false;
                    localStorage.setItem('bg_sidebar_collapsed', 'false');
                }
            };
        }
        return;
    }

    const project = state.projects[state.activeProjectIndex];
    const projectName = project ? project.name : 'Proyecto';
    const fileName = state.activeFile.name;

    // Construir ruta de carpetas
    let folderParts = [];
    let folderPath = '';
    if (state.activeFile.path && state.activeFile.path.includes('/')) {
        const parts = state.activeFile.path.split('/');
        parts.pop(); // Remover archivo
        folderParts = parts;
        folderPath = parts.join('/');
    }

    let html = `
        <button id="show-sidebar-btn" class="show-sidebar-btn ${state.sidebarCollapsed ? 'visible' : ''}" title="Mostrar Sidebar">
            <i class="fas fa-bars"></i>
        </button>
        <span class="breadcrumb-item" onclick="showWelcomeMessage()" title="Ir al inicio"><i class="fas fa-home"></i></span>
    `;
    html += `<span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>`;
    html += `<span class="breadcrumb-item" onclick="openProjectViewer(${state.activeProjectIndex})" title="Ver proyecto: ${escapeHtml(projectName)}">${escapeHtml(truncateText(projectName, 15))}</span>`;

    // Agregar carpetas intermedias (click para ver carpeta)
    folderParts.forEach((folder, i) => {
        const currentPath = folderParts.slice(0, i + 1).join('/');
        html += `<span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>`;
        html += `<span class="breadcrumb-item" onclick="openFolderViewer(${state.activeProjectIndex}, '${escapeHtml(currentPath)}')" title="Ver carpeta: ${escapeHtml(folder)}">${escapeHtml(truncateText(folder, 12))}</span>`;
    });

    // Archivo actual (no clickeable, es el actual)
    html += `<span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>`;
    html += `<span class="breadcrumb-item active" title="${escapeHtml(fileName)}">${escapeHtml(truncateText(fileName, 25))}</span>`;

    el.breadcrumb.innerHTML = html;

    // Re-asignar event listener al botón
    const btn = document.getElementById('show-sidebar-btn');
    if (btn) {
        btn.onclick = () => {
            if (el.sidebar) {
                el.sidebar.classList.remove('collapsed');
                el.sidebar.style.width = '280px';
                btn.classList.remove('visible');
                if (el.mainContent) {
                    el.mainContent.style.marginLeft = '280px';
                    el.mainContent.style.width = 'calc(100% - 280px)';
                }
                state.sidebarCollapsed = false;
                localStorage.setItem('bg_sidebar_collapsed', 'false');
            }
        };
    }
}

// Abrir visor de proyecto
window.openProjectViewer = function(pIdx) {
    const project = state.projects[pIdx];
    if (!project) return;

    state.activeProjectIndex = pIdx;
    state.exploringFolder = {
        type: 'project',
        projectIndex: pIdx,
        path: '',
        name: project.name,
        items: project.items
    };

    // Cerrar archivo activo si hay uno
    if (state.activeFile) {
        state.activeFile = null;
    }

    updateUI();
    renderProjectFileList();
};

// Renderizar lista de archivos del proyecto (estilo sidebar)
function renderProjectFileList() {
    const container = document.getElementById('folder-viewer');
    if (!container) return;

    if (!state.exploringFolder) {
        container.classList.add('hidden');
        container.style.display = 'none';
        return;
    }

    container.classList.remove('hidden');
    container.style.display = 'block';

    const item = state.exploringFolder;
    const pIdx = item.projectIndex !== undefined ? item.projectIndex : state.activeProjectIndex;
    const project = state.projects[pIdx];

    // Generar lista de archivos estilo sidebar (vertical)
    let filesHtml = '';
    if (item.items && item.items.length > 0) {
        filesHtml = renderProjectItems(item.items, pIdx, 0);
    }

    container.innerHTML = `
        <div class="folder-viewer-content">
            <div class="folder-viewer-header">
                <h2><i class="fas fa-folder-open"></i> ${escapeHtml(item.name)}</h2>
                <span class="file-count">${countFiles(item.items)} archivos</span>
            </div>
            <div class="project-file-list">
                ${filesHtml || '<p class="folder-viewer-empty"><i class="fas fa-folder-open"></i><br>No hay archivos en este proyecto</p>'}
            </div>
        </div>
    `;
}

// Renderizar items del proyecto recursivamente
function renderProjectItems(items, pIdx, depth) {
    if (!items || items.length === 0) return '';

    let html = '<ul class="project-items-ul" style="padding-left: ' + (depth * 16) + 'px;">';

    items.forEach(item => {
        const isFolder = item.type === 'folder' || item.items;
        const hasChildren = isFolder && item.items && item.items.length > 0;

        if (isFolder) {
            html += `
                <li class="project-item folder" data-folder="${escapeHtml(item.name)}">
                    <div class="project-item-row" onclick="toggleProjectFolder(this)">
                        <i class="fas fa-chevron-right toggle-icon"></i>
                        <i class="fas fa-folder folder-icon"></i>
                        <span class="item-name">${escapeHtml(item.name)}</span>
                    </div>
                    ${hasChildren ? `<div class="folder-children hidden">${renderProjectItems(item.items, pIdx, depth + 1)}</div>` : ''}
                </li>
            `;
        } else {
            html += `
                <li class="project-item file">
                    <div class="project-item-row" onclick="openFileSmart(${pIdx}, '${escapeHtml(item.path || item.name)}')">
                        <i class="fas fa-file-alt file-icon"></i>
                        <span class="item-name">${escapeHtml(item.name.replace('.txt', ''))}</span>
                    </div>
                </li>
            `;
        }
    });

    html += '</ul>';
    return html;
}

// Toggle carpeta en visor de proyecto
window.toggleProjectFolder = function(element) {
    const folder = element.closest('.project-item.folder');
    const children = folder.querySelector('.folder-children');
    const toggle = element.querySelector('.toggle-icon');

    if (children) {
        children.classList.toggle('hidden');
        toggle.classList.toggle('fa-chevron-right');
        toggle.classList.toggle('fa-chevron-down');
    }
};

// Contar archivos recursivamente
function countFiles(items) {
    if (!items) return 0;
    let count = 0;
    items.forEach(item => {
        if (item.type === 'folder' || item.items) {
            count += countFiles(item.items);
        } else {
            count++;
        }
    });
    return count;
}

// Abrir visor de carpeta
window.openFolderViewer = function(pIdx, folderPath) {
    const project = state.projects[pIdx];
    if (!project) return;

    // Buscar la carpeta en el proyecto
    const findFolder = (items, path) => {
        for (const item of items) {
            if (item.type === 'folder') {
                if (item.path === path) {
                    return item;
                }
                if (item.items) {
                    const found = findFolder(item.items, path);
                    if (found) return found;
                }
            }
        }
        return null;
    };

    const folder = findFolder(project.items, folderPath);
    if (!folder) {
        notify('Carpeta no encontrada', 'error');
        return;
    }

    state.exploringFolder = {
        type: 'folder',
        projectIndex: pIdx,
        path: folderPath,
        name: folder.name,
        items: folder.items || []
    };

    // Cerrar archivo activo si hay uno
    if (state.activeFile) {
        state.activeFile = null;
    }

    updateUI();
};

// Helper para truncar texto
function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

// Seleccionar proyecto desde breadcrumb
window.selectProject = function(index) {
    if (index >= 0 && index < state.projects.length) {
        state.activeProjectIndex = index;
        renderSidebar();
        showWelcomeMessage();
    }
};

function renderFolderViewer() {
    const container = document.getElementById('folder-viewer');
    if (!container) return;

    if (!state.exploringFolder) {
        container.classList.add('hidden');
        container.style.display = 'none';
        return;
    }

    container.classList.remove('hidden');
    container.style.display = 'block';

    const item = state.exploringFolder;
    const pIdx = item.projectIndex !== undefined ? item.projectIndex : state.activeProjectIndex;

    // Generar lista de archivos estilo sidebar
    let filesHtml = '';
    if (item.items && item.items.length > 0) {
        filesHtml = renderFileTreeForViewer(item.items, pIdx, item.path || '');
    }

    container.innerHTML = `
        <div class="folder-viewer-content">
            <div class="folder-viewer-header">
                <h2><i class="fas fa-folder-open"></i> ${escapeHtml(item.name)}</h2>
            </div>
            <div class="folder-viewer-list">
                ${filesHtml || '<p class="folder-viewer-empty">No hay archivos</p>'}
            </div>
        </div>
    `;
}

// Renderizar árbol de archivos para el visor (estilo sidebar)
function renderFileTreeForViewer(items, pIdx, parentPath) {
    if (!items || items.length === 0) return '';

    let html = '<ul class="folder-viewer-tree">';

    items.forEach((item, idx) => {
        const currentPath = parentPath ? `${parentPath}/${item.name}` : item.name;
        const isFolder = item.type === 'folder' || item.items;
        const icon = isFolder ? 'fa-folder' : 'fa-file-alt';
        const hasChildren = isFolder && item.items && item.items.length > 0;

        if (isFolder) {
            html += `
                <li class="folder-viewer-folder">
                    <div class="folder-viewer-item" onclick="toggleViewerFolder(this)">
                        <i class="fas fa-chevron-right folder-toggle"></i>
                        <i class="fas ${icon}"></i>
                        <span>${escapeHtml(item.name)}</span>
                    </div>
                    ${hasChildren ? `<div class="folder-viewer-children hidden">${renderFileTreeForViewer(item.items, pIdx, currentPath)}</div>` : ''}
                </li>
            `;
        } else {
            html += `
                <li class="folder-viewer-file">
                    <div class="folder-viewer-item" onclick="openFileSmart(${pIdx}, '${currentPath}')">
                        <i class="fas ${icon}"></i>
                        <span>${escapeHtml(item.name.replace('.txt', ''))}</span>
                    </div>
                </li>
            `;
        }
    });

    html += '</ul>';
    return html;
}

// Toggle carpeta en visor
window.toggleViewerFolder = function(element) {
    const folder = element.closest('.folder-viewer-folder');
    const children = folder.querySelector('.folder-viewer-children');
    const toggle = element.querySelector('.folder-toggle');

    if (children) {
        children.classList.toggle('hidden');
        toggle.classList.toggle('fa-chevron-right');
        toggle.classList.toggle('fa-chevron-down');
    }
};

function renderChildrenLinks() {
    if (!el.linksList) return;

    if (!state.activeFile || !state.activeFile.items || state.activeFile.items.length === 0) {
        if (el.childrenLinks) el.childrenLinks.classList.add('hidden');
        return;
    }

    if (el.childrenLinks) el.childrenLinks.classList.remove('hidden');

    const pIdx = state.activeProjectIndex;
    const path = getPathFromItem(state.activeFile);

    el.linksList.innerHTML = state.activeFile.items.map((child, idx) => {
        const childPath = path ? `${path},${idx}` : `${idx}`;
        return `
            <li class="child-link-item" onclick="openFileSmart(${pIdx}, '${childPath}')">
                <i class="fas fa-file-alt"></i>
                <span>${escapeHtml(child.name.replace('.txt', ''))}</span>
            </li>
        `;
    }).join('');
}

function updateWelcomeRecent() {
    if (!el.recentProjects) return;

    const allFiles = [];
    state.projects.forEach((p, pIdx) => {
        const collect = (items, path) => {
            items.forEach((item, idx) => {
                const currentPath = path ? `${path},${idx}` : `${idx}`;
                allFiles.push({
                    name: item.name.replace('.txt', ''),
                    pIdx,
                    path: currentPath,
                    lastUpdated: item.lastUpdated
                });
                if (item.items) collect(item.items, currentPath);
            });
        };
        collect(p.items, '');
    });

    allFiles.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
    const recent = allFiles.slice(0, 5);

    if (recent.length === 0) {
        el.recentProjects.innerHTML = '<p class="no-recent">No hay archivos recientes</p>';
        return;
    }

    el.recentProjects.innerHTML = recent.map(f => `
        <div class="recent-file-item" onclick="openFileSmart(${f.pIdx}, '${f.path}')">
            <i class="fas fa-file-alt"></i>
            <span>${escapeHtml(f.name)}</span>
        </div>
    `).join('');
}

// ============================================
// SISTEMA DE GUARDADO
// ============================================

async function saveFileContent(manual = false) {
    if (!state.activeFile || !state.activeFile.handle) {
        console.warn('[saveFileContent] No hay archivo activo o handle');
        return;
    }

    if (state.isSaving) {
        if (manual) notify('Guardando... espera un momento', 'info');
        return;
    }

    state.isSaving = true;
    const indicator = document.getElementById('autosave-indicator');

    try {
        // Verificar que el editor existe
        if (!el.editor) {
            throw new Error('Editor no disponible');
        }

        const htmlContent = el.editor.innerHTML || '<p><br></p>';

        const metadata = {
            status: state.activeFile.status || 'draft',
            goal: state.activeFile.goal || state.config.defaultGoal || 30000,
            lastCharCount: state.activeFile.lastCharCount || 0,
            initialCharCount: state.activeFile.initialCharCount || 0,
            comments: state.activeFile.comments || [],
            lastUpdated: Date.now()
        };

        const fullContent = `<!--METADATA\n${JSON.stringify(metadata, null, 2)}\n-->\n\n${htmlContent}`;

        // Verificar permisos antes de escribir
        if (state.activeFile.handle.queryPermission) {
            const permission = await state.activeFile.handle.queryPermission({ mode: 'readwrite' });
            if (permission !== 'granted') {
                const newPermission = await state.activeFile.handle.requestPermission({ mode: 'readwrite' });
                if (newPermission !== 'granted') {
                    throw new Error('Permisos denegados');
                }
            }
        }

        const writable = await state.activeFile.handle.createWritable();
        await writable.write(fullContent);
        await writable.close();

        state.activeFile.lastModified = Date.now();

        if (indicator) indicator.classList.add('hidden');
        if (manual) notify('Guardado correctamente', 'success');

        saveMetadata();
    } catch (err) {
        console.error('[saveFileContent] Error:', err);

        let errorMsg = 'Error al guardar';
        if (err.name === 'NotAllowedError' || err.message.includes('Permisos')) {
            errorMsg = 'Permisos insuficientes. Intenta reconectar la carpeta.';
        } else if (err.name === 'NotFoundError') {
            errorMsg = 'Archivo no encontrado. Puede haber sido movido o eliminado.';
        } else if (err.name === 'InvalidStateError') {
            errorMsg = 'El archivo está en uso. Cierra otras aplicaciones.';
        } else if (err.message) {
            errorMsg = err.message;
        }

        if (manual) notify(errorMsg, 'error');
    } finally {
        state.isSaving = false;
    }
}

// ============================================
// CONFIGURACIÓN Y PERSISTENCIA
// ============================================

function loadConfig() {
    const saved = localStorage.getItem('bg_config');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            state.config = {
                ...state.config,
                ...parsed,
                states: (parsed.states || []).map(s => ({
                    ...s,
                    countType: s.countType || 'absolute',
                    goal: s.goal || 30000
                })),
                shortcuts: { ...state.config.shortcuts, ...(parsed.shortcuts || {}) }
            };

            if (el.autosaveInterval) el.autosaveInterval.value = state.config.autosaveInterval || 30;
            if (el.defaultGoal) el.defaultGoal.value = state.config.defaultGoal || 30000;
        } catch (e) {
            console.warn('[Block Guard] Error cargando config:', e);
        }
    }
}

function saveConfig() {
    if (el.autosaveInterval) {
        state.config.autosaveInterval = parseInt(el.autosaveInterval.value) || 30;
    }
    if (el.defaultGoal) {
        state.config.defaultGoal = parseInt(el.defaultGoal.value) || 30000;
    }
    if (el.userNameInput) {
        localStorage.setItem('bg_user_name', el.userNameInput.value);
        applyUserIdentity();
    }

    localStorage.setItem('bg_config', JSON.stringify(state.config));
    saveWorkspaceCache();
    setupAutosave();
}

async function saveHandle(handle) {
    try {
        // Guardar el handle en IndexedDB para persistencia
        const db = await openDB('BlockGuardDB', 1, {
            upgrade(db) {
                if (!db.objectStoreNames.contains('handles')) {
                    db.createObjectStore('handles', { keyPath: 'id' });
                }
            }
        });
        await db.put('handles', { id: 'workspace', handle: handle });
        console.log('[Block Guard] Handle guardado en IndexedDB');
    } catch (e) {
        console.warn('[Block Guard] Error guardando handle:', e);
    }
}

async function loadHandle() {
    try {
        const db = await openDB('BlockGuardDB', 1);
        const result = await db.get('handles', 'workspace');
        return result?.handle || null;
    } catch (e) {
        console.warn('[Block Guard] Error cargando handle:', e);
        return null;
    }
}

// Helper para IndexedDB
function openDB(name, version, upgradeCallback) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(name, version);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        if (upgradeCallback) {
            request.onupgradeneeded = (e) => upgradeCallback(e.target.result);
        }
    });
}

function loadMetadata() {
    const saved = localStorage.getItem('bg_meta');
    if (!saved) return;

    try {
        const meta = JSON.parse(saved);
        state.projects.forEach((p, pIdx) => {
            const savedProject = meta[pIdx];
            if (savedProject) {
                p.open = savedProject.open;
                const mergeItems = (items, savedItems) => {
                    items.forEach((item, iIdx) => {
                        const savedItem = savedItems[iIdx];
                        if (savedItem) {
                            item.status = savedItem.status || item.status;
                            item.goal = savedItem.goal || item.goal;
                            item.lastCharCount = savedItem.lastCharCount || item.lastCharCount;
                            item.comments = savedItem.comments || item.comments;
                            if (item.items && savedItem.items) {
                                mergeItems(item.items, savedItem.items);
                            }
                        }
                    });
                };
                if (savedProject.items) {
                    mergeItems(p.items, savedProject.items);
                }
            }
        });
    } catch (e) {
        console.warn('Error cargando metadata:', e);
    }
}

function saveMetadata() {
    const meta = state.projects.map(p => ({
        name: p.name,
        open: p.open,
        items: p.items ? p.items.map(item => serializeItem(item)) : []
    }));
    localStorage.setItem('bg_meta', JSON.stringify(meta));
    saveWorkspaceCache();
}

function serializeItem(item) {
    return {
        name: item.name,
        status: item.status,
        goal: item.goal,
        lastCharCount: item.lastCharCount,
        items: (item.items || []).map(serializeItem),
        comments: item.comments || [],
        lastUpdated: item.lastUpdated
    };
}

function deserializeItem(item) {
    return {
        name: item.name,
        status: item.status || 'draft',
        goal: item.goal || state.config.defaultGoal || 30000,
        lastCharCount: item.lastCharCount || 0,
        items: (item.items || []).map(deserializeItem),
        comments: item.comments || [],
        lastUpdated: item.lastUpdated
    };
}

async function saveWorkspaceCache() {
    if (!state.workspaceHandle) return;

    try {
        const metadata = {
            version: '3.3',
            lastUpdated: new Date().toISOString(),
            config: state.config,
            userName: localStorage.getItem('bg_user_name'),
            avatar: localStorage.getItem('bg_user_avatar'),
            projects: state.projects.map(p => ({
                name: p.name,
                open: p.open,
                items: p.items.map(serializeItem)
            }))
        };

        const fh = await state.workspaceHandle.getFileHandle('block_guard_metadata.json', { create: true });
        const w = await fh.createWritable();
        await w.write(JSON.stringify(metadata, null, 4));
        await w.close();
    } catch (err) {
        console.warn('[Block Guard] Error guardando cache:', err);
    }
}

async function restoreFromJSONCache() {
    if (!state.workspaceHandle) return;

    try {
        const fh = await state.workspaceHandle.getFileHandle('block_guard_metadata.json', { create: false });
        const file = await fh.getFile();
        const text = await file.text();
        const metadata = JSON.parse(text);

        if (metadata && metadata.projects) {
            if (metadata.config) {
                state.config = {
                    ...state.config,
                    ...metadata.config,
                    autosaveInterval: metadata.config.autosaveInterval || 30,
                    states: (metadata.config.states || []).map(s => ({
                        ...s,
                        countType: s.countType || 'absolute',
                        goal: s.goal || 30000
                    })),
                    shortcuts: { ...state.config.shortcuts, ...(metadata.config.shortcuts || {}) }
                };
            }

            if (metadata.userName) localStorage.setItem('bg_user_name', metadata.userName);
            if (metadata.avatar) localStorage.setItem('bg_user_avatar', metadata.avatar);
        }
    } catch (err) {
        console.log('[Block Guard] No se encontró cache previo');
    }
}

// ============================================
// NOTIFICACIONES
// ============================================

function notify(message, type = 'info', duration = 3000) {
    const container = el.notificationContainer;
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    const iconClass = type === 'error' ? 'fa-exclamation-circle' :
                      type === 'success' ? 'fa-check-circle' : 'fa-info-circle';

    notification.innerHTML = `
        <i class="fas ${iconClass}"></i>
        <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(notification);

    requestAnimationFrame(() => {
        notification.classList.add('show');
    });

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

// ============================================
// EVENT LISTENERS BÁSICOS
// ============================================

function setupEventListeners() {
    document.addEventListener('click', handleGlobalClick);

    if (el.editor) {
        el.editor.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const selection = window.getSelection();
            if (selection.toString().trim()) {
                showFormattingToolbar();
            }
        });
    }

    if (el.manualSave) el.manualSave.onclick = () => saveFileContent(true);
    if (el.setupFolder) el.setupFolder.onclick = selectWorkspace;
    if (el.addProject) el.addProject.onclick = createProjectAction;

    // Botón flecha para colapsar sidebar
    if (el.collapseSidebar) {
        el.collapseSidebar.onclick = () => {
            state.sidebarCollapsed = true;
            el.sidebar.classList.add('collapsed');
            el.sidebar.classList.remove('peek');
            el.collapseSidebar.classList.add('hidden');

            // Mostrar botón hamburguesa en breadcrumb
            if (el.showSidebarBtn) el.showSidebarBtn.classList.remove('hidden');

            // Ajustar main content
            if (el.mainContent) {
                el.mainContent.style.marginLeft = '60px';
                el.mainContent.style.width = 'calc(100% - 60px)';
            }

            localStorage.setItem('bg_sidebar_collapsed', 'true');
        };
    }

    // Botón hamburguesa para expandir sidebar
    if (el.showSidebarBtn) {
        el.showSidebarBtn.onclick = () => {
            state.sidebarCollapsed = false;
            el.sidebar.classList.remove('collapsed', 'peek');
            el.showSidebarBtn.classList.add('hidden');
            if (el.collapseSidebar) el.collapseSidebar.classList.remove('hidden');

            // Ajustar main content
            if (el.mainContent) {
                el.mainContent.style.marginLeft = '280px';
                el.mainContent.style.width = 'calc(100% - 280px)';
            }

            localStorage.setItem('bg_sidebar_collapsed', 'false');
        };
    }



    if (el.reconnectFolderBtn) el.reconnectFolderBtn.onclick = () => requestWorkspacePermission();
    if (el.sidebarReconnect) el.sidebarReconnect.onclick = () => requestWorkspacePermission();
    if (el.spellCheck) el.spellCheck.onclick = toggleSpellCheck;

    setupCommentsControls();
    setupSettingsControls();
    setupEditorControls();

    if (el.charGoal) el.charGoal.oninput = handleCharGoalChange;

    if (el.inputModalConfirm) {
        el.inputModalConfirm.onclick = handleInputModalConfirm;
    }

    if (el.customInputField) {
        el.customInputField.onkeydown = (e) => {
            if (e.key === 'Enter' && el.inputModalConfirm) {
                el.inputModalConfirm.click();
            }
        };
    }

    setupAvatarUpload();
    setupDataManagement();
    setupContextMenuActions();

    if (el.upgradeStatus) {
        el.upgradeStatus.onclick = () => {
            if (state.activeFile) upgradeStatusAction();
        };
    }

    if (el.editor) {
        el.editor.addEventListener('input', () => {
            const indicator = document.getElementById('autosave-indicator');
            if (indicator) indicator.classList.remove('hidden');
            updateStats();
        });
    }
}

function setupContextMenuActions() {
    if (el.ctxRename) {
        el.ctxRename.onclick = () => {
            el.ctxMenu.classList.add('hidden');
            renameItem();
        };
    }

    if (el.ctxAddSub) {
        el.ctxAddSub.onclick = () => {
            el.ctxMenu.classList.add('hidden');
            createFileSystemItemAction();
        };
    }

    if (el.ctxUpgradeSidebar) {
        el.ctxUpgradeSidebar.onclick = () => {
            el.ctxMenu.classList.add('hidden');
            upgradeStatusAction();
        };
    }

    if (el.ctxResetStatus) {
        el.ctxResetStatus.onclick = () => {
            el.ctxMenu.classList.add('hidden');
            resetStatusToDraft();
        };
    }

    if (el.ctxDelete) {
        el.ctxDelete.onclick = () => {
            el.ctxMenu.classList.add('hidden');
            deleteItemSmart();
        };
    }
}

function setupCommentsControls() {
    if (el.postCommentBtn) {
        el.postCommentBtn.onclick = () => {
            const input = document.getElementById('new-comment');
            if (input && input.value.trim()) {
                postComment(input.value);
                input.value = '';
            }
        };
    }

    if (el.closeComments) {
        el.closeComments.onclick = () => {
            if (el.commentsSidebar) el.commentsSidebar.classList.add('hidden');
            if (el.commentsOverlay) el.commentsOverlay.classList.add('hidden');
        };
    }
}

function handleGlobalClick(e) {
    if (!e.target.closest('#custom-context-menu')) {
        if (el.ctxMenu) el.ctxMenu.classList.add('hidden');
    }

    if (e.target.classList.contains('modal')) {
        if (e.target.id === 'settings-modal') e.target.classList.remove('open');
        else if (e.target.id === 'input-modal') window.closeInputModal();
        else if (e.target.id === 'confirm-modal') window.closeConfirmModal(false);
        else if (e.target.id === 'spell-modal') e.target.classList.remove('open');
        
        else if (e.target.id === 'state-edit-modal') e.target.classList.remove('open');
    }

    if (e.target.id === 'comments-overlay') {
        if (el.commentsSidebar) el.commentsSidebar.classList.add('hidden');
        e.target.classList.add('hidden');
    }
}

function handleInputModalConfirm() {
    const val = document.getElementById('custom-input-field')?.value;
    if (state.modalResolver) {
        state.modalResolver(val);
        window.closeInputModal();
    }
}

// ============================================
// CONFIGURACIÓN DE SETTINGS
// ============================================

function setupSettingsControls() {
    if (el.openSettings) {
        el.openSettings.onclick = () => {
            const modal = document.getElementById('settings-modal');
            if (modal) {
                modal.classList.add('open');
                trapFocus(modal);

                const currentName = localStorage.getItem('bg_user_name') ||
                    (state.workspaceHandle ? state.workspaceHandle.name : 'Usuario');
                if (el.userNameInput) el.userNameInput.value = currentName;

                updateSettingsAvatar();
                renderStateConfig();
                renderThemePreviews();
                renderShortcutsConfig();
            }
        };
    }

    document.querySelectorAll('.settings-nav-btn').forEach(btn => {
        btn.onclick = () => {
            const tabId = btn.getAttribute('data-tab');
            document.querySelectorAll('.settings-nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const tabContent = document.getElementById(tabId);
            if (tabContent) tabContent.classList.add('active');
            if (el.settingsTabTitle) el.settingsTabTitle.innerText = btn.innerText.trim();
        };
    });

    if (el.closeSettingsTop) {
        el.closeSettingsTop.onclick = () => {
            const modal = document.getElementById('settings-modal');
            if (modal) modal.classList.remove('open');
        };
    }

    if (el.saveSettingsBtn) {
        el.saveSettingsBtn.onclick = () => {
            saveConfig();
            if (el.userNameInput && el.userNameInput.value) {
                localStorage.setItem('bg_user_name', el.userNameInput.value);
                applyUserIdentity();
            }
            const modal = document.getElementById('settings-modal');
            if (modal) modal.classList.remove('open');
            notify('Configuración guardada correctamente');
        };
    }

    if (el.addStateBtn) {
        el.addStateBtn.onclick = () => {
            state.config.states.push({
                id: 'state_' + Date.now(),
                name: 'Nuevo Estado',
                color: '#0071e3',
                countType: 'absolute',
                goal: state.config.defaultGoal || 30000
            });
            renderStateConfig();
        };
    }

    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.onclick = () => {
            const theme = btn.getAttribute('data-theme');
            applyTheme(theme);
            document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
    });

    setupCustomColorPickers();

    if (el.saveCustomThemeBtn) {
        el.saveCustomThemeBtn.onclick = saveCustomTheme;
    }

    if (el.changeAvatarBtn) {
        el.changeAvatarBtn.onclick = () => {
            const input = document.getElementById('avatar-upload-input');
            if (input) input.click();
        };
    }

    if (el.removeAvatarBtn) {
        el.removeAvatarBtn.onclick = removeAvatar;
    }

    if (el.restoreDefaultsBtn) {
        el.restoreDefaultsBtn.onclick = () => {
            if (confirm('¿Restaurar configuración por defecto?')) {
                localStorage.removeItem('bg_config');
                location.reload();
            }
        };
    }
}

function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            const tabContent = document.getElementById(btn.dataset.tab);
            if (tabContent) tabContent.classList.add('active');
        };
    });
}

function setupAutosave() {
    if (state.autosaveTimer) clearInterval(state.autosaveTimer);
    const interval = (state.config.autosaveInterval || 30) * 1000;
    state.autosaveTimer = setInterval(() => {
        if (state.activeFile) saveFileContent(false);
    }, interval);
}

// ============================================
// TEMAS Y APARIENCIA
// ============================================

function applyTheme(themeId) {
    // Guardar tema actual
    state.config.theme = themeId;
    localStorage.setItem('bg_theme', themeId);

    // Remover tema anterior
    document.body.removeAttribute('data-theme');

    // Aplicar tema personalizado si existe
    if (themeId === 'custom' && state.config.customTheme) {
        applyCustomTheme(state.config.customTheme);
        return;
    }

    // Temas predefinidos completos
    const themes = {
        dark: {
            '--bg-primary': '#0a0a0a',
            '--bg-secondary': '#121212',
            '--bg-tertiary': '#1d1d1d',
            '--bg-hover': 'rgba(255, 255, 255, 0.05)',
            '--bg-active': 'rgba(0, 113, 227, 0.1)',
            '--text-primary': '#f5f5f7',
            '--text-secondary': '#86868b',
            '--text-tertiary': '#6e6e73',
            '--accent-blue': '#0071e3',
            '--accent-red': '#ff3b30',
            '--accent-orange': '#ff9500',
            '--accent-green': '#34c759',
            '--accent-purple': '#af52de',
            '--accent-pink': '#ff2d55',
            '--border-color': 'rgba(255, 255, 255, 0.08)',
            '--border-hover': 'rgba(255, 255, 255, 0.15)',
            '--shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.3)',
            '--shadow-md': '0 4px 12px rgba(0, 0, 0, 0.4)',
            '--shadow-lg': '0 8px 30px rgba(0, 0, 0, 0.5)',
            '--shadow-float': '0 4px 20px rgba(0, 0, 0, 0.6)'
        },
        light: {
            '--bg-primary': '#ffffff',
            '--bg-secondary': '#f5f5f7',
            '--bg-tertiary': '#e8e8ed',
            '--bg-hover': 'rgba(0, 0, 0, 0.04)',
            '--bg-active': 'rgba(0, 113, 227, 0.08)',
            '--text-primary': '#1d1d1f',
            '--text-secondary': '#86868b',
            '--text-tertiary': '#a1a1a6',
            '--accent-blue': '#0071e3',
            '--accent-red': '#ff3b30',
            '--accent-orange': '#ff9500',
            '--accent-green': '#34c759',
            '--accent-purple': '#af52de',
            '--accent-pink': '#ff2d55',
            '--border-color': 'rgba(0, 0, 0, 0.08)',
            '--border-hover': 'rgba(0, 0, 0, 0.15)',
            '--shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.08)',
            '--shadow-md': '0 4px 12px rgba(0, 0, 0, 0.1)',
            '--shadow-lg': '0 8px 30px rgba(0, 0, 0, 0.12)',
            '--shadow-float': '0 4px 20px rgba(0, 0, 0, 0.15)'
        },
        midnight: {
            '--bg-primary': '#0d1b2a',
            '--bg-secondary': '#1b263b',
            '--bg-tertiary': '#243b53',
            '--bg-hover': 'rgba(100, 181, 246, 0.08)',
            '--bg-active': 'rgba(100, 181, 246, 0.15)',
            '--text-primary': '#e0e1dd',
            '--text-secondary': '#778da9',
            '--text-tertiary': '#415a77',
            '--accent-blue': '#64b5f6',
            '--accent-red': '#ef5350',
            '--accent-orange': '#ffa726',
            '--accent-green': '#66bb6a',
            '--accent-purple': '#ab47bc',
            '--accent-pink': '#f06292',
            '--border-color': 'rgba(255, 255, 255, 0.08)',
            '--border-hover': 'rgba(255, 255, 255, 0.15)',
            '--shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.4)',
            '--shadow-md': '0 4px 12px rgba(0, 0, 0, 0.5)',
            '--shadow-lg': '0 8px 30px rgba(0, 0, 0, 0.6)',
            '--shadow-float': '0 4px 20px rgba(0, 0, 0, 0.7)'
        },
        forest: {
            '--bg-primary': '#1a1f1b',
            '--bg-secondary': '#242d26',
            '--bg-tertiary': '#2d3a31',
            '--bg-hover': 'rgba(129, 199, 132, 0.08)',
            '--bg-active': 'rgba(129, 199, 132, 0.15)',
            '--text-primary': '#e8f5e9',
            '--text-secondary': '#a5d6a7',
            '--text-tertiary': '#66bb6a',
            '--accent-blue': '#81c784',
            '--accent-red': '#e57373',
            '--accent-orange': '#ffb74d',
            '--accent-green': '#4caf50',
            '--accent-purple': '#ba68c8',
            '--accent-pink': '#f06292',
            '--border-color': 'rgba(255, 255, 255, 0.08)',
            '--border-hover': 'rgba(255, 255, 255, 0.15)',
            '--shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.4)',
            '--shadow-md': '0 4px 12px rgba(0, 0, 0, 0.5)',
            '--shadow-lg': '0 8px 30px rgba(0, 0, 0, 0.6)',
            '--shadow-float': '0 4px 20px rgba(0, 0, 0, 0.7)'
        },
        lavender: {
            '--bg-primary': '#181824',
            '--bg-secondary': '#252538',
            '--bg-tertiary': '#30304d',
            '--bg-hover': 'rgba(186, 104, 200, 0.08)',
            '--bg-active': 'rgba(186, 104, 200, 0.15)',
            '--text-primary': '#f3e5f5',
            '--text-secondary': '#ce93d8',
            '--text-tertiary': '#ab47bc',
            '--accent-blue': '#9c7bf8',
            '--accent-red': '#f07178',
            '--accent-orange': '#fabc66',
            '--accent-green': '#86d992',
            '--accent-purple': '#ba68c8',
            '--accent-pink': '#f48fb1',
            '--border-color': 'rgba(255, 255, 255, 0.08)',
            '--border-hover': 'rgba(255, 255, 255, 0.15)',
            '--shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.4)',
            '--shadow-md': '0 4px 12px rgba(0, 0, 0, 0.5)',
            '--shadow-lg': '0 8px 30px rgba(0, 0, 0, 0.6)',
            '--shadow-float': '0 4px 20px rgba(0, 0, 0, 0.7)'
        },
        cyber: {
            '--bg-primary': '#0a0f1c',
            '--bg-secondary': '#111827',
            '--bg-tertiary': '#1f2937',
            '--bg-hover': 'rgba(56, 189, 248, 0.08)',
            '--bg-active': 'rgba(56, 189, 248, 0.15)',
            '--text-primary': '#f0f9ff',
            '--text-secondary': '#7dd3fc',
            '--text-tertiary': '#38bdf8',
            '--accent-blue': '#38bdf8',
            '--accent-red': '#f87171',
            '--accent-orange': '#fb923c',
            '--accent-green': '#4ade80',
            '--accent-purple': '#a78bfa',
            '--accent-pink': '#f472b6',
            '--border-color': 'rgba(56, 189, 248, 0.2)',
            '--border-hover': 'rgba(56, 189, 248, 0.4)',
            '--shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.5)',
            '--shadow-md': '0 4px 12px rgba(0, 0, 0, 0.6)',
            '--shadow-lg': '0 8px 30px rgba(0, 0, 0, 0.7)',
            '--shadow-float': '0 4px 20px rgba(56, 189, 248, 0.3)'
        }
    };

    const theme = themes[themeId] || themes.dark;

    // Aplicar variables CSS
    Object.entries(theme).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value);
    });

    // Actualizar atributo para selectores específicos
    document.body.setAttribute('data-theme', themeId);

    // Actualizar UI de selección de tema
    updateThemeUI(themeId);

    // Guardar en config
    saveConfig();
}

function applyCustomTheme(customTheme) {
    if (!customTheme) return;

    const variables = {
        '--bg-primary': customTheme.bgPrimary,
        '--bg-secondary': customTheme.bgSecondary,
        '--bg-tertiary': customTheme.bgTertiary,
        '--accent-blue': customTheme.accent,
        '--accent-purple': customTheme.accentSecondary,
        '--text-primary': customTheme.text,
        '--text-secondary': customTheme.textSecondary,
        '--border-color': customTheme.border
    };

    Object.entries(variables).forEach(([key, value]) => {
        if (value) document.documentElement.style.setProperty(key, value);
    });

    // Generar colores derivados si faltan
    if (customTheme.bgPrimary) {
        document.documentElement.style.setProperty('--bg-hover', 
            hexToRgba(customTheme.bgPrimary, 0.05));
    }

    if (customTheme.accent) {
        document.documentElement.style.setProperty('--accent-blue-hover', 
            adjustBrightness(customTheme.accent, 10));
    }

    document.body.setAttribute('data-theme', 'custom');
    updateThemeUI('custom');
}

// Helper para ajustar brillo de color
function adjustBrightness(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255))
        .toString(16).slice(1);
}

function updateThemeUI(themeId) {
    // Actualizar botones de tema
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === themeId);
    });

    // Actualizar previews
    document.querySelectorAll('.theme-preview').forEach(card => {
        card.classList.toggle('active', card.dataset.theme === themeId);
    });
}

// Helper para convertir hex a rgba
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function renderThemePreviews() {
    const grid = el.themePreviewGrid;
    if (!grid) return;

    const themes = [
        { id: 'dark', name: 'Oscuro', color: '#1a1a1a' },
        { id: 'light', name: 'Claro', color: '#ffffff' },
        { id: 'purple', name: 'Púrpura', color: '#1a0a2e' },
        { id: 'blue', name: 'Azul', color: '#0a1628' },
        { id: 'green', name: 'Verde', color: '#0d2818' }
    ];

    grid.innerHTML = themes.map(t => `
        <div class="theme-preview ${state.config.theme === t.id ? 'active' : ''}" data-theme="${t.id}">
            <div class="theme-preview-box" style="background: ${t.color}"></div>
            <span>${t.name}</span>
        </div>
    `).join('');

    grid.querySelectorAll('.theme-preview').forEach(preview => {
        preview.onclick = () => {
            const theme = preview.getAttribute('data-theme');
            applyTheme(theme);
            grid.querySelectorAll('.theme-preview').forEach(p => p.classList.remove('active'));
            preview.classList.add('active');
        };
    });
}

function setupCustomColorPickers() {
    const pickers = [el.customBgPrimary, el.customBgSecondary, el.customAccent, el.customText];
    pickers.forEach(picker => {
        if (picker) {
            picker.addEventListener('input', () => {
                document.documentElement.style.setProperty(
                    picker.id.replace('custom-', '--'),
                    picker.value
                );
            });
        }
    });
}

function saveCustomTheme() {
    const nameInput = document.getElementById('custom-theme-name');
    const name = nameInput?.value?.trim();

    if (!name) {
        notify('Ingresa un nombre para el tema', 'error');
        return;
    }

    const colors = {
        bgPrimary: el.customBgPrimary?.value || '#0a0a0a',
        bgSecondary: el.customBgSecondary?.value || '#121212',
        accent: el.customAccent?.value || '#0071e3',
        text: el.customText?.value || '#f5f5f7'
    };

    if (state.editingCustomThemeId) {
        // Actualizar existente
        const theme = ThemeManager.customThemes.find(t => t.id === state.editingCustomThemeId);
        if (theme) {
            theme.name = name;
            theme.colors = colors;
            ThemeManager.saveCustomThemes();
            ThemeManager.renderCustomThemesList();
            notify('Tema actualizado', 'success');
        }
        state.editingCustomThemeId = null;
        const saveBtn = document.getElementById('save-custom-theme-btn');
        if (saveBtn) saveBtn.textContent = 'Guardar Tema';
    } else {
        // Crear nuevo
        ThemeManager.createTheme(name, colors);
        notify('Tema creado: ' + name, 'success');
    }

    // Limpiar formulario
    if (nameInput) nameInput.value = '';

    // Aplicar el tema personalizado
    state.config.customTheme = colors;
    state.config.theme = 'custom';
    applyTheme('custom');
}

// ============================================
// AVATAR - SIMPLIFICADO (sin crop)
// ============================================

function loadAvatar() {
    const avatarData = localStorage.getItem('bg_user_avatar');
    if (avatarData && avatarData.startsWith('data:image')) {
        updateAvatarDisplay(avatarData);
        console.log('[Block Guard] Avatar cargado');
    } else {
        console.log('[Block Guard] No hay avatar guardado');
    }
}

function updateAvatarDisplay(dataUrl) {
    if (!dataUrl) return;

    // Avatar en sidebar
    if (el.userAvatar) {
        el.userAvatar.src = dataUrl;
        el.userAvatar.classList.remove('hidden');
        el.userAvatar.style.display = 'block';
    }
    if (el.userAvatarPlaceholder) {
        el.userAvatarPlaceholder.classList.add('hidden');
        el.userAvatarPlaceholder.style.display = 'none';
    }

    // Avatar en settings
    if (el.settingsAvatarImg) {
        el.settingsAvatarImg.src = dataUrl;
        el.settingsAvatarImg.classList.remove('hidden');
        el.settingsAvatarImg.style.display = 'block';
    }
    if (el.settingsAvatarPlaceholder) {
        el.settingsAvatarPlaceholder.classList.add('hidden');
        el.settingsAvatarPlaceholder.style.display = 'none';
    }

    // Forzar reflow para asegurar que se muestre
    document.querySelectorAll('.avatar-img').forEach(img => {
        img.style.objectFit = 'cover';
        img.style.objectPosition = 'center';
    });
}

function updateSettingsAvatar() {
    const avatarData = localStorage.getItem('bg_user_avatar');
    if (avatarData) {
        updateAvatarDisplay(avatarData);
    } else {
        if (el.settingsAvatarImg) el.settingsAvatarImg.classList.add('hidden');
        if (el.settingsAvatarPlaceholder) el.settingsAvatarPlaceholder.classList.remove('hidden');
    }
}

function setupAvatarUpload() {
    const input = el.avatarUploadInput;
    if (!input) return;

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validar tipo
        if (!file.type.startsWith('image/')) {
            notify('Por favor selecciona una imagen válida', 'error');
            return;
        }

        // Validar tamaño (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            notify('La imagen es demasiado grande (máx 5MB)', 'error');
            return;
        }

        try {
            const resizedImage = await resizeImageToAvatar(file);
            localStorage.setItem('bg_user_avatar', resizedImage);
            updateAvatarDisplay(resizedImage);
            notify('Avatar actualizado', 'success');
        } catch (err) {
            console.error('Error al procesar avatar:', err);
            notify('Error al procesar la imagen', 'error');
        }
    };
}

// Redimensionar imagen a 200x200 automáticamente
function resizeImageToAvatar(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            img.src = e.target.result;
        };

        reader.onerror = reject;

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const size = 200;
            canvas.width = size;
            canvas.height = size;

            const ctx = canvas.getContext('2d');

            // Calcular recorte centrado manteniendo proporción
            let sx, sy, sWidth, sHeight;
            const aspectRatio = img.width / img.height;

            if (aspectRatio > 1) {
                // Imagen más ancha que alta
                sHeight = img.height;
                sWidth = img.height;
                sx = (img.width - sWidth) / 2;
                sy = 0;
            } else {
                // Imagen más alta que ancha
                sWidth = img.width;
                sHeight = img.width;
                sx = 0;
                sy = (img.height - sHeight) / 2;
            }

            // Dibujar imagen recortada y redimensionada
            ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, size, size);

            // Convertir a JPEG comprimido
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            resolve(dataUrl);
        };

        img.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function removeAvatar() {
    localStorage.removeItem('bg_user_avatar');
    if (el.userAvatar) el.userAvatar.classList.add('hidden');
    if (el.userAvatarPlaceholder) el.userAvatarPlaceholder.classList.remove('hidden');
    if (el.settingsAvatarImg) el.settingsAvatarImg.classList.add('hidden');
    if (el.settingsAvatarPlaceholder) el.settingsAvatarPlaceholder.classList.remove('hidden');
    notify('Avatar eliminado');
}

// ============================================
// ATAJOS DE TECLADO
// ============================================

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const shortcuts = state.config.shortcuts;

        for (const [name, shortcut] of Object.entries(shortcuts)) {
            if (matchesShortcut(e, shortcut)) {
                e.preventDefault();
                executeShortcut(name);
                return;
            }
        }
    });
}

function matchesShortcut(e, shortcut) {
    return e.key.toLowerCase() === shortcut.key.toLowerCase() &&
           e.ctrlKey === shortcut.ctrl &&
           e.shiftKey === shortcut.shift &&
           e.altKey === shortcut.alt;
}

function executeShortcut(name) {
    switch (name) {
        case 'save':
            saveFileContent(true);
            break;
        case 'bold':
            executeFormatAction('bold');
            break;
        case 'italic':
            executeFormatAction('italic');
            break;
        case 'underline':
            executeFormatAction('underline');
            break;
        case 'find':
            // Implementar búsqueda
            break;
        case 'newFile':
            createFileSystemItemAction();
            break;
        case 'closeFile':
            window.closeFile();
            break;
        case 'comment':
            addCommentToSelection();
            break;
        case 'heading':
            executeFormatAction('h2');
            break;
    }
}

function renderShortcutsConfig() {
    const list = el.shortcutsConfigList;
    if (!list) return;

    const shortcutLabels = {
        save: 'Guardar',
        selectAll: 'Seleccionar todo',
        bold: 'Negrita',
        italic: 'Cursiva',
        underline: 'Subrayado',
        find: 'Buscar',
        newFile: 'Nuevo archivo',
        closeFile: 'Cerrar archivo',
        comment: 'Comentario',
        heading: 'Título'
    };

    // Atajos por defecto para comparar
    const defaultShortcuts = {
        save: { key: 's', ctrl: true, shift: false, alt: false },
        selectAll: { key: 'a', ctrl: true, shift: false, alt: false },
        bold: { key: 'b', ctrl: true, shift: false, alt: false },
        italic: { key: 'i', ctrl: true, shift: false, alt: false },
        underline: { key: 'u', ctrl: true, shift: false, alt: false },
        find: { key: 'f', ctrl: true, shift: false, alt: false },
        newFile: { key: 'n', ctrl: true, shift: false, alt: false },
        closeFile: { key: 'escape', ctrl: false, shift: false, alt: false },
        comment: { key: 'c', ctrl: true, shift: true, alt: false },
        heading: { key: 'h', ctrl: true, shift: false, alt: false }
    };

    list.innerHTML = Object.entries(state.config.shortcuts).map(([name, shortcut]) => {
        const keyCombo = [
            shortcut.ctrl ? 'Ctrl' : '',
            shortcut.shift ? 'Shift' : '',
            shortcut.alt ? 'Alt' : '',
            shortcut.key.toUpperCase()
        ].filter(Boolean).join('+');

        // Verificar si es el valor por defecto
        const defaultShortcut = defaultShortcuts[name];
        const isDefault = defaultShortcut && 
            shortcut.key === defaultShortcut.key &&
            shortcut.ctrl === defaultShortcut.ctrl &&
            shortcut.shift === defaultShortcut.shift &&
            shortcut.alt === defaultShortcut.alt;

        return `
            <div class="shortcut-config-item">
                <span class="shortcut-name">${shortcutLabels[name] || name}</span>
                <div class="shortcut-actions">
                    <button class="shortcut-key" onclick="recordShortcut('${name}')" title="Click para cambiar">
                        ${keyCombo}
                    </button>
                    <button class="btn-reset-shortcut ${isDefault ? 'hidden' : ''}" 
                            onclick="resetShortcut('${name}')" 
                            title="Restaurar valor por defecto">
                        <i class="fas fa-undo"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Resetear un atajo a su valor por defecto
window.resetShortcut = function(name) {
    const defaultShortcuts = {
        save: { key: 's', ctrl: true, shift: false, alt: false },
        selectAll: { key: 'a', ctrl: true, shift: false, alt: false },
        bold: { key: 'b', ctrl: true, shift: false, alt: false },
        italic: { key: 'i', ctrl: true, shift: false, alt: false },
        underline: { key: 'u', ctrl: true, shift: false, alt: false },
        find: { key: 'f', ctrl: true, shift: false, alt: false },
        newFile: { key: 'n', ctrl: true, shift: false, alt: false },
        closeFile: { key: 'escape', ctrl: false, shift: false, alt: false },
        comment: { key: 'c', ctrl: true, shift: true, alt: false },
        heading: { key: 'h', ctrl: true, shift: false, alt: false }
    };

    if (defaultShortcuts[name]) {
        state.config.shortcuts[name] = { ...defaultShortcuts[name] };
        saveConfig();
        renderShortcutsConfig();
        notify('Atajo restaurado: ' + (name === 'save' ? 'Guardar' : name), 'success');
    }
};

window.recordShortcut = function(name) {
    state.recordingShortcut = name;
    notify('Presiona la combinación de teclas...');

    const handler = (e) => {
        e.preventDefault();

        state.config.shortcuts[name] = {
            key: e.key.toLowerCase(),
            ctrl: e.ctrlKey,
            shift: e.shiftKey,
            alt: e.altKey
        };

        document.removeEventListener('keydown', handler);
        state.recordingShortcut = null;

        saveConfig();
        renderShortcutsConfig();
        notify('Atajo guardado');
    };

    document.addEventListener('keydown', handler, { once: true });
};

// ============================================
// CORRECTOR ORTOGRÁFICO
// ============================================

function toggleSpellCheck() {
    const text = el.editor?.innerText || '';

    if (text.length === 0) {
        notify('No hay texto para revisar', 'error');
        return;
    }

    // Siempre mostrar el modal con secciones
    showSpellCheckModal(text);
}

function showSpellCheckModal(text) {
    const modal = el.spellModal;
    const content = document.querySelector('#spell-modal .modal-body');

    if (!modal || !content) return;

    // Cargar página por defecto configurada
    const defaultPage = getDefaultSpellcheckPage();

    // Obtener tamaño de secciones de la configuración
    const sectionSize = parseInt(localStorage.getItem('bg_spellcheck_section_size') || '5000');

    // Dividir en secciones
    const sections = [];
    for (let i = 0; i < text.length; i += sectionSize) {
        sections.push({
            index: Math.floor(i / sectionSize) + 1,
            text: text.substring(i, i + sectionSize),
            start: i,
            end: Math.min(i + sectionSize, text.length)
        });
    }

    // Generar HTML de secciones compactas
    const sectionsHTML = sections.map((section, idx) => `
        <div class="spell-section compact" data-index="${idx}">
            <div class="spell-section-info">
                <span class="spell-section-number">#${section.index}</span>
                <span class="spell-section-chars">${section.end - section.start} chars</span>
            </div>
            <button class="btn-copy-section compact" onclick="copySectionToClipboard(${idx})" title="Copiar y abrir en ${escapeHtml(defaultPage.name)}">
                <i class="fas fa-external-link-alt"></i>
            </button>
        </div>
    `).join('');

    content.innerHTML = `
        <div class="spellcheck-header compact">
            <div class="spellcheck-title">
                <i class="fas fa-spell-check"></i>
                <h2>Revisión Ortográfica</h2>
            </div>
            <p class="spellcheck-stats">${text.length.toLocaleString()} caracteres · ${sections.length} secciones · ${escapeHtml(defaultPage.name)}</p>
        </div>

        <div class="spell-sections-grid">
            ${sectionsHTML}
        </div>

        <div class="spellcheck-footer compact">
            <button class="btn-secondary" onclick="document.getElementById('spell-modal').classList.remove('open')">
                <i class="fas fa-times"></i> Cerrar
            </button>
        </div>
    `;

    // Guardar secciones en estado temporal
    state.spellCheckSections = sections;

    modal.classList.add('open');
    trapFocus(modal);
}

// Gestor de páginas favoritas del corrector
window.openSpellcheckPagesManager = function() {
    const pages = state.spellCheckPages || [
        { name: 'LanguageTool', url: 'https://languagetool.org/es', default: true },
        { name: 'Corrector.co', url: 'https://www.corrector.co/', default: false }
    ];

    const content = document.querySelector('#spell-modal .modal-body');
    if (!content) return;

    const pagesHTML = pages.map((page, idx) => `
        <div class="spellcheck-page-item">
            <input type="radio" name="default-page" value="${idx}" ${page.default ? 'checked' : ''} 
                   onchange="setDefaultSpellcheckPage(${idx})">
            <div class="spellcheck-page-info">
                <input type="text" class="spellcheck-page-name" value="${escapeHtml(page.name)}" 
                       onchange="updateSpellcheckPage(${idx}, 'name', this.value)">
                <input type="text" class="spellcheck-page-url" value="${escapeHtml(page.url)}" 
                       onchange="updateSpellcheckPage(${idx}, 'url', this.value)">
            </div>
            <button class="btn-remove-page" onclick="removeSpellcheckPage(${idx})" title="Eliminar">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');

    content.innerHTML = `
        <div class="spellcheck-manager-header">
            <button class="btn-back" onclick="showSpellCheckModal(state.lastSpellcheckText || '')">
                <i class="fas fa-arrow-left"></i> Volver
            </button>
            <h3>Páginas de Corrección</h3>
        </div>
        <div class="spellcheck-pages-list">
            ${pagesHTML}
        </div>
        <div class="spellcheck-manager-actions">
            <button class="btn-secondary" onclick="addSpellcheckPage()">
                <i class="fas fa-plus"></i> Añadir Página
            </button>
            <button class="btn-primary" onclick="saveSpellcheckPages()">
                <i class="fas fa-save"></i> Guardar
            </button>
        </div>
    `;
};

window.setDefaultSpellcheckPage = function(idx) {
    state.spellCheckPages.forEach((p, i) => p.default = (i === idx));
};

window.updateSpellcheckPage = function(idx, field, value) {
    if (state.spellCheckPages[idx]) {
        state.spellCheckPages[idx][field] = value;
    }
};

window.removeSpellcheckPage = function(idx) {
    if (state.spellCheckPages.length > 1) {
        state.spellCheckPages.splice(idx, 1);
        // Si eliminamos el default, poner el primero como default
        if (!state.spellCheckPages.some(p => p.default)) {
            state.spellCheckPages[0].default = true;
        }
        openSpellcheckPagesManager();
    } else {
        notify('Debe haber al menos una página', 'error');
    }
};

window.addSpellcheckPage = function() {
    state.spellCheckPages.push({
        name: 'Nueva Página',
        url: 'https://',
        default: false
    });
    openSpellcheckPagesManager();
};

window.saveSpellcheckPages = function() {
    localStorage.setItem('bg_spellcheck_pages', JSON.stringify(state.spellCheckPages));
    notify('Páginas guardadas', 'success');
    showSpellCheckModal(state.lastSpellcheckText || '');
};

window.copySectionToClipboard = async function(sectionIndex) {
    const section = state.spellCheckSections?.[sectionIndex];
    if (!section) return;

    try {
        await navigator.clipboard.writeText(section.text);

        // Usar página por defecto configurada
        const defaultPage = getDefaultSpellcheckPage();
        window.open(defaultPage.url, '_blank', 'noopener,noreferrer');

        notify(`Sección #${section.index} copiada`, 'success');

    } catch (err) {
        notify('Error al copiar al portapapeles', 'error');
        console.error('Clipboard error:', err);
    }
};

// ============================================
// IMPORT/EXPORT
// ============================================

function setupDataManagement() {
    if (el.exportDataBtn) {
        el.exportDataBtn.onclick = exportData;
    }

    if (el.importDataBtn) {
        el.importDataBtn.onclick = () => {
            el.importDataInput?.click();
        };
    }

    if (el.importDataInput) {
        el.importDataInput.onchange = importData;
    }

    if (el.clearCacheBtn) {
        el.clearCacheBtn.onclick = () => {
            if (confirm('¿Eliminar todos los datos locales? Esta acción no se puede deshacer.')) {
                localStorage.clear();
                notify('Datos eliminados');
                setTimeout(() => location.reload(), 1000);
            }
        };
    }
}

function exportData() {
    const data = {
        version: '3.3',
        exportDate: new Date().toISOString(),
        config: state.config,
        userName: localStorage.getItem('bg_user_name'),
        avatar: localStorage.getItem('bg_user_avatar'),
        projects: state.projects.map(p => ({
            name: p.name,
            open: p.open,
            items: p.items.map(serializeItem)
        }))
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `block_guard_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    notify('Backup exportado');
}

async function importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!validateImportData(data)) {
            notify('Archivo de backup inválido', 'error');
            return;
        }

        if (data.config) {
            state.config = { ...state.config, ...data.config };
            localStorage.setItem('bg_config', JSON.stringify(state.config));
        }

        if (data.userName) localStorage.setItem('bg_user_name', data.userName);
        if (data.avatar) localStorage.setItem('bg_user_avatar', data.avatar);

        notify('Backup importado correctamente');
        setTimeout(() => location.reload(), 1000);
    } catch (err) {
        console.error('Error importando backup:', err);
        notify('Error al importar backup', 'error');
    }
}

// ============================================
// MODALES
// ============================================

window.openInputModal = function(title, placeholder = '') {
    return new Promise((resolve) => {
        state.modalResolver = resolve;

        if (el.inputModalTitle) el.inputModalTitle.innerText = title;
        if (el.customInputField) {
            el.customInputField.value = '';
            el.customInputField.placeholder = placeholder;
        }

        if (el.inputModal) {
            el.inputModal.classList.add('open');
            trapFocus(el.inputModal);
            setTimeout(() => el.customInputField?.focus(), 100);
        }
    });
};

window.closeInputModal = function() {
    if (el.inputModal) el.inputModal.classList.remove('open');
    state.modalResolver = null;
};

window.openConfirmModal = function(title, text, icon = 'fa-question-circle') {
    return new Promise((resolve) => {
        state.confirmResolver = resolve;

        if (el.confirmModalTitle) el.confirmModalTitle.innerText = title;
        if (el.confirmModalText) el.confirmModalText.innerText = text;
        if (el.confirmModalIcon) el.confirmModalIcon.className = `fas ${icon}`;

        if (el.confirmModal) {
            el.confirmModal.classList.add('open');
            trapFocus(el.confirmModal);
        }

        if (el.confirmModalYes) {
            el.confirmModalYes.onclick = () => {
                resolve(true);
                window.closeConfirmModal(true);
            };
        }
    });
};

window.closeConfirmModal = function(result) {
    if (el.confirmModal) el.confirmModal.classList.remove('open');
    if (state.confirmResolver) {
        state.confirmResolver(result);
        state.confirmResolver = null;
    }
};

// ============================================
// ACCIONES DE ARCHIVOS
// ============================================

window.renameItem = async function() {
    const target = state.contextTarget;
    if (!target) return;

    const item = findItemByPath(target.pIdx, target.path);
    if (!item) return;

    const newName = await window.openInputModal('Renombrar', item.name.replace('.txt', ''));
    if (!newName || newName === item.name.replace('.txt', '')) return;

    try {
        const finalName = newName.endsWith('.txt') ? newName : newName + '.txt';

        if (target.type === 'project') {
            notify('No se puede renombrar proyecto desde aquí', 'error');
            return;
        }

        const newHandle = await item.parentDirHandle.getFileHandle(finalName, { create: true });
        const oldFile = await item.handle.getFile();
        const writable = await newHandle.createWritable();
        await writable.write(await oldFile.arrayBuffer());
        await writable.close();

        await item.parentDirHandle.removeEntry(item.name);

        item.name = finalName;
        item.handle = newHandle;

        saveMetadata();
        renderSidebar();
        updateUI();
        notify('Archivo renombrado');
    } catch (err) {
        console.error('Error renombrando:', err);
        notify('Error al renombrar', 'error');
    }
};

window.createFileSystemItemAction = async function() {
    const target = state.contextTarget;
    if (!target) return;

    const name = await window.openInputModal('Nuevo Archivo', 'nombre_del_archivo');
    if (!name) return;

    const finalName = name.endsWith('.txt') ? name : name + '.txt';

    try {
        let parentDir;
        let targetItem;

        if (target.type === 'project') {
            parentDir = state.projects[target.pIdx].handle;
            targetItem = state.projects[target.pIdx];
        } else {
            targetItem = findItemByPath(target.pIdx, target.path);
            if (!targetItem) return;

            const subDirName = 'sub_' + targetItem.name.replace('.txt', '');
            try {
                parentDir = await targetItem.parentDirHandle.getDirectoryHandle(subDirName);
            } catch (e) {
                parentDir = await targetItem.parentDirHandle.getDirectoryHandle(subDirName, { create: true });
            }
        }

        const newHandle = await parentDir.getFileHandle(finalName, { create: true });
        const writable = await newHandle.createWritable();
        await writable.write('<p><br></p>');
        await writable.close();

        const newItem = {
            name: finalName,
            handle: newHandle,
            parentDirHandle: parentDir,
            status: 'draft',
            lastCharCount: 0,
            initialCharCount: 0,
            goal: state.config.defaultGoal || 30000,
            comments: [],
            items: []
        };

        if (!targetItem.items) targetItem.items = [];
        targetItem.items.push(newItem);
        targetItem.open = true;

        saveMetadata();
        renderSidebar();
        notify('Archivo creado: ' + finalName.replace('.txt', ''));
    } catch (err) {
        console.error('Error creando archivo:', err);
        notify('Error al crear archivo', 'error');
    }
};

window.deleteItemSmart = async function() {
    const target = state.contextTarget;
    if (!target) return;

    const confirmed = await window.openConfirmModal(
        'Eliminar',
        '¿Estás seguro de que quieres eliminar este elemento?',
        'fa-exclamation-triangle'
    );

    if (!confirmed) return;

    const item = findItemByPath(target.pIdx, target.path);
    if (!item) return;

    try {
        if (target.type === 'project') {
            await state.workspaceHandle.removeEntry(item.name, { recursive: true });
            state.projects.splice(target.pIdx, 1);
        } else {
            await item.parentDirHandle.removeEntry(item.name);

            const parentCollection = getParentCollection(target.pIdx, target.path);
            const index = getIndexFromPath(target.path);
            parentCollection.splice(index, 1);
        }

        if (state.activeFile === item) {
            state.activeFile = null;
            el.editor.innerHTML = '<p><br></p>';
        }

        saveMetadata();
        renderSidebar();
        updateUI();
        notify('Elemento eliminado');
    } catch (err) {
        console.error('Error eliminando:', err);
        notify('Error al eliminar', 'error');
    }
};

// ============================================
// SIDEBAR HOVER
// ============================================

function setupSidebarHover() {
    if (!el.sidebar || !el.sidebarHoverZone) return;

    el.sidebarHoverZone.addEventListener('mouseenter', () => {
        if (state.sidebarCollapsed) {
            el.sidebar.classList.add('peek');
        }
    });

    el.sidebar.addEventListener('mouseleave', () => {
        if (state.sidebarCollapsed) {
            el.sidebar.classList.remove('peek');
        }
    });
}

// ============================================
// IDENTIDAD DE USUARIO
// ============================================

function applyUserIdentity() {
    // Prioridad: 1. localStorage, 2. nombre del workspace, 3. default
    let userName = localStorage.getItem('bg_user_name');

    if (!userName && state.workspaceHandle) {
        userName = state.workspaceHandle.name;
    }

    if (!userName) {
        userName = 'Escritor';
    }

    // Actualizar en todas partes
    if (el.userNameDisplay) {
        el.userNameDisplay.innerText = userName;
        el.userNameDisplay.title = userName;
    }
    if (el.welcomeUserName) {
        el.welcomeUserName.innerText = userName;
    }

    // Guardar si no estaba guardado
    if (!localStorage.getItem('bg_user_name')) {
        localStorage.setItem('bg_user_name', userName);
    }

    document.title = `Block Guard - ${userName}`;
    console.log('[Block Guard] Usuario:', userName);
}

function setupEditorControls() {
    if (el.editorRenameBtn) {
        el.editorRenameBtn.onclick = () => {
            state.contextTarget = {
                type: 'file',
                pIdx: state.activeProjectIndex,
                path: getPathFromItem(state.activeFile)
            };
            renameItem();
        };
    }
}

// ============================================
// INICIALIZAR APLICACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', init);


// ============================================
// SPELLCHECK PAGES MANAGER
// ============================================

function loadSpellcheckPages() {
    const saved = localStorage.getItem('bg_spellcheck_pages');
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.warn('Error cargando páginas del corrector:', e);
        }
    }
    // Default pages
    return [
        { name: 'LanguageTool', url: 'https://languagetool.org/es', default: true },
        { name: 'Corrector.co', url: 'https://www.corrector.co/', default: false }
    ];
}

function saveSpellcheckPages(pages) {
    localStorage.setItem('bg_spellcheck_pages', JSON.stringify(pages));
}

function renderSpellcheckPages() {
    const container = document.getElementById('spellcheck-pages-list');
    if (!container) return;

    const pages = loadSpellcheckPages();

    container.innerHTML = pages.map((page, idx) => `
        <div class="spellcheck-page-row ${page.default ? 'default' : ''}">
            <input type="radio" name="default-spellcheck-page" 
                   ${page.default ? 'checked' : ''} 
                   onchange="setDefaultSpellcheckPage(${idx})"
                   title="Establecer como predeterminada">
            <div class="page-inputs">
                <input type="text" name="page-name" value="${escapeHtml(page.name)}" 
                       placeholder="Nombre" onchange="updateSpellcheckPage(${idx}, 'name', this.value)">
                <input type="url" name="page-url" value="${escapeHtml(page.url)}" 
                       placeholder="https://..." onchange="updateSpellcheckPage(${idx}, 'url', this.value)">
            </div>
            <div class="page-actions">
                ${page.default ? '<span class="default-badge">Default</span>' : ''}
                <button onclick="removeSpellcheckPage(${idx})" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

window.setDefaultSpellcheckPage = function(idx) {
    const pages = loadSpellcheckPages();
    pages.forEach((p, i) => p.default = (i === idx));
    saveSpellcheckPages(pages);
    renderSpellcheckPages();
    notify('Página predeterminada actualizada', 'success');
};

window.updateSpellcheckPage = function(idx, field, value) {
    const pages = loadSpellcheckPages();
    if (pages[idx]) {
        pages[idx][field] = value;
        saveSpellcheckPages(pages);
    }
};

window.removeSpellcheckPage = function(idx) {
    const pages = loadSpellcheckPages();
    if (pages.length <= 1) {
        notify('Debe haber al menos una página', 'error');
        return;
    }

    const wasDefault = pages[idx].default;
    pages.splice(idx, 1);

    // Si eliminamos el default, poner el primero como default
    if (wasDefault && pages.length > 0) {
        pages[0].default = true;
    }

    saveSpellcheckPages(pages);
    renderSpellcheckPages();
    notify('Página eliminada', 'success');
};

window.addSpellcheckPage = function() {
    const pages = loadSpellcheckPages();
    pages.push({
        name: 'Nueva Página',
        url: 'https://',
        default: false
    });
    saveSpellcheckPages(pages);
    renderSpellcheckPages();
};

// Obtener la página predeterminada del corrector
function getDefaultSpellcheckPage() {
    const pages = loadSpellcheckPages();
    return pages.find(p => p.default) || pages[0];
}
