/**
 * ============================================================================
 * BLOCK GUARD v4.0.0 - ELECTRON.JS (PROCESO PRINCIPAL)
 * ============================================================================
 * 
 * PROCESO PRINCIPAL DE ELECTRON (Main Process)
 * 
 * Este archivo se ejecuta en el contexto de Node.js, NO en el navegador.
 * Es el "cerebro" de la aplicación de escritorio.
 * 
 * RESPONSABILIDADES:
 * 1. Crear y gestionar la ventana principal de la aplicación
 * 2. Manejar todas las operaciones del sistema de archivos (CRUD)
 * 3. Gestionar diálogos nativos del sistema operativo
 * 4. Persistir configuración y datos del usuario
 * 5. Comunicarse con el proceso de renderizado vía IPC
 * 
 * ARQUITECTURA:
 * - Main Process (este archivo): Tiene acceso completo a Node.js y OS
 * - Renderer Process (React): Corre en un navegador aislado
 * - Preload Script: Puente seguro entre ambos procesos
 * 
 * RELACIONADO CON:
 * - public/preload.js: Define las APIs expuestas al renderer
 * - src/App.js: Consume las APIs del preload
 * - package.json: Configura este archivo como "main"
 * ============================================================================
 */

// =============================================================================
// IMPORTACIONES DE MÓDULOS
// =============================================================================

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');           // Manejo de rutas de archivo
const fs = require('fs-extra');         // Operaciones de archivo mejoradas
const { autoUpdater } = require('electron-updater');  // Auto-actualización

// =============================================================================
// ALMACENAMIENTO PERSISTENTE SIMPLE
// =============================================================================

class SimpleStore {
  constructor(name = 'config') {
    this.storePath = path.join(app.getPath('userData'), `${name}.json`);
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.storePath)) {
        return JSON.parse(fs.readFileSync(this.storePath, 'utf8'));
      }
    } catch (error) {
      console.error('Error loading store:', error);
    }
    return {};
  }

  save() {
    try {
      fs.ensureDirSync(path.dirname(this.storePath));
      fs.writeFileSync(this.storePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving store:', error);
    }
  }

  get(key, defaultValue = null) {
    return this.data[key] !== undefined ? this.data[key] : defaultValue;
  }

  set(key, value) {
    this.data[key] = value;
    this.save();
  }

  delete(key) {
    delete this.data[key];
    this.save();
  }

  clear() {
    this.data = {};
    this.save();
  }
}

const store = new SimpleStore();

// Conjunto para trackear operaciones asincrónicas en curso (guard contra races)
const pendingOps = new Set();

const beginOp = () => {
  const id = Symbol('op');
  pendingOps.add(id);
  return id;
};

const endOp = (id) => {
  try { pendingOps.delete(id); } catch (e) { /* no-op */ }
};

// IPC para esperar a que no haya operaciones pendientes (útil antes de recargar)
ipcMain.handle('wait-pending-ops', async (event, timeoutMs = 3000) => {
  const start = Date.now();
  while (pendingOps.size > 0 && (Date.now() - start) < timeoutMs) {
    // esperar 100ms
    await new Promise(r => setTimeout(r, 100));
  }
  return pendingOps.size === 0;
});

// =============================================================================
// CONFIGURACIÓN DE AUTO-UPDATER
// =============================================================================

// Configurar electron-updater con logger simple
const simpleLogger = {
  info: (msg) => console.log('[AUTO-UPDATE]', msg),
  warn: (msg) => console.warn('[AUTO-UPDATE]', msg),
  error: (msg) => console.error('[AUTO-UPDATE]', msg),
  debug: (msg) => console.debug('[AUTO-UPDATE]', msg),
  transports: {
    file: { level: 'info' }
  }
};

autoUpdater.logger = simpleLogger;

// Configurar feed URL para GitHub releases (usar token si existe para aumentar rate limit)
const gh_token = process.env.GH_TOKEN || '';
const feedUrl = gh_token
  ? `https://${gh_token}@github.com/Valentin-sbox/Blockguard/releases/download/v\${version}/BlockGuard-Setup-\${version}.exe`
  : 'https://github.com/Valentin-sbox/Blockguard/releases/download/v${version}/BlockGuard-Setup-${version}.exe';

try {
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'Valentin-sbox',
    repo: 'Blockguard',
    token: gh_token || undefined
  });
  console.log('[AUTO-UPDATE] Feed URL configurado');
} catch (e) {
  console.warn('[AUTO-UPDATE] Error configurando feed:', e.message);
}

// No llamar checkForUpdatesAndNotify aquí - hacerlo bajo demanda en initializeApp

// Variable global para almacenar el estado de actualización
let updateState = {
  updateAvailable: false,
  updateDownloaded: false,
  updateInfo: null,
  currentProgress: 0,
  totalSize: 0,
  downloadedSize: 0
};

// Listeners de autoUpdater
autoUpdater.on('checking-for-update', () => {
  console.log('Verificando actualizaciones...');
  if (mainWindow) {
    mainWindow.webContents.send('update-checking');
  }
});

autoUpdater.on('update-available', (info) => {
  console.log('Actualización disponible:', info.version);
  updateState.updateAvailable = true;
  updateState.updateInfo = info;
  if (mainWindow) {
    mainWindow.webContents.send('update-available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes
    });
  }
});

autoUpdater.on('update-not-available', () => {
  console.log('No hay actualizaciones disponibles');
  if (mainWindow) {
    mainWindow.webContents.send('update-not-available');
  }
});

autoUpdater.on('error', (error) => {
  console.error('Error en auto-updater:', error);
  if (mainWindow) {
    mainWindow.webContents.send('update-error', error.message);
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  updateState.currentProgress = progressObj.percent;
  updateState.downloadedSize = progressObj.transferred;
  updateState.totalSize = progressObj.total;
  if (mainWindow) {
    mainWindow.webContents.send('update-download-progress', {
      percent: progressObj.percent,
      bytesPerSecond: progressObj.bytesPerSecond,
      transferred: progressObj.transferred,
      total: progressObj.total
    });
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Actualización descargada. Se aplicará al reiniciar.');
  updateState.updateDownloaded = true;
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded');
  }
});

// =============================================================================
// VARIABLES GLOBALES
// =============================================================================

// =============================================================================
// ERROR HANDLERS GLOBALES
// =============================================================================

// Manejar errores no capturados en el main process
process.on('uncaughtException', (error) => {
  console.error('ERROR NO CAPTURADO:', error);
});

// Manejar promesas que se rechazan sin manejo
process.on('unhandledRejection', (reason, promise) => {
  console.error('PROMESA RECHAZADA SIN MANEJO:', reason);
});

/**
 * FUNCIÓN: CREAR VENTANA PRINCIPAL
 * Crea y configura la ventana principal de la aplicación.
 * Esta función se llama cuando Electron está listo (app.whenReady)
 */
function createWindow() {
  // Preparar ruta del icono con fallback
  let iconPath = null;
  const possibleIconPaths = [
    path.join(__dirname, '../assets/icon.ico'),
    path.join(__dirname, './assets/icon.ico'),
    path.join(__dirname, '../../assets/icon.ico'),
    path.join(__dirname, '/assets/icon.ico'),
    path.join(__dirname, 'icon.ico'),
  ];

  for (const iconPath_ of possibleIconPaths) {
    try {
      if (fs.existsSync(iconPath_)) {
        iconPath = iconPath_;
        break;
      }
    } catch (e) {
      // continuar
    }
  }

  /**
   * BrowserWindow: Crea una ventana nativa del sistema operativo.
   * 
   * CONFIGURACIÓN:
   * - width/height: Dimensiones iniciales de la ventana
   * - minWidth/minHeight: Límites mínimos para redimensionar
   * - title: Título de la ventana (se puede cambiar dinámicamente)
   * - icon: Icono de la ventana (usado en barra de tareas y esquina)
   * - webPreferences: Configuración de seguridad y funcionalidad
   */
  mainWindow = new BrowserWindow({
    width: 1400,           // Ancho inicial en píxeles
    height: 900,           // Alto inicial en píxeles
    minWidth: 900,         // Ancho mínimo permitido
    minHeight: 600,        // Alto mínimo permitido
    title: 'Block Guard',  // Título de la ventana

    // Icono de la aplicación (múltiples tamaños en .ico)
    icon: iconPath || undefined,

    // Configuración de seguridad y funcionalidad del renderer
    webPreferences: {
      // Node.js DESACTIVADO en el renderer (seguridad)
      nodeIntegration: false,

      // Context isolation ACTIVADO (seguridad crítica)
      // El preload corre en un contexto aislado del renderer
      contextIsolation: true,

      // Remote module desactivado (obsoleto e inseguro)
      enableRemoteModule: false,

      // Script de precarga que expone APIs seguras
      preload: path.join(__dirname, 'preload.js')
    },

    // Usar el marco nativo del sistema (barra de título del SO)
    frame: false,

    // Mostrar la barra de menús de forma explícita (no auto-ocultar)
    autoHideMenuBar: true,

    // No mostrar hasta que esté lista (evita parpadeo)
    show: false
  });

  // =============================================================================
  // CARGAR LA APLICACIÓN
  // =============================================================================

  /**
   * Determina qué URL cargar según el entorno:
   * - Desarrollo: http://localhost:3000 (servidor de React)
   * - Producción: archivo local de build/index.html (archivos estáticos)
   */

  if (process.env.ELECTRON_START_URL) {
    // Modo desarrollo: servidor local de React
    console.log('Modo DESARROLLO - Cargando desde:', process.env.ELECTRON_START_URL);
    mainWindow.loadURL(process.env.ELECTRON_START_URL).catch(err => {
      console.error('Error loading development URL:', err);
    });
  } else {
    // Modo producción: usar path.join para obtener ruta correcta
    // __dirname = /resources/app.asar/public
    // Por lo tanto: __dirname/../build/index.html = /resources/app.asar/build/index.html
    const indexPath = path.join(__dirname, '../build/index.html');

    console.log('Modo PRODUCCIÓN - Cargando desde:', indexPath);

    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath).catch(err => {
        console.error('Error loading production file:', err);
        mainWindow.loadURL('data:text/html,<h2>Error: No se pudo cargar la aplicación</h2>');
      });
    } else {
      console.error('Error: index.html no encontrado en', indexPath);
      mainWindow.loadURL('data:text/html,<h2>Error: index.html no encontrado</h2>');
    }
  }

  // =============================================================================
  // EVENTOS DE LA VENTANA
  // =============================================================================

  // Mostrar ventana cuando el contenido esté listo (evita parpadeo blanco)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // En desarrollo, abrir DevTools automáticamente
    if (process.env.ELECTRON_START_URL) {
      mainWindow.webContents.openDevTools();
    }

    // Verificar actualizaciones después de mostrar la ventana (con delay para que todo esté listo)
    setTimeout(() => {
      console.log('[AUTO-UPDATE] Iniciando verificación automática...');
      autoUpdater.checkForUpdatesAndNotify().catch(err => {
        console.error('[AUTO-UPDATE] Error en checkForUpdatesAndNotify:', err);
      });
    }, 2000);
  });

  // Manejo de errores al cargar la página
  mainWindow.webContents.on('crashed', () => {
    console.error('ERROR: El renderer de la aplicación se crasheó');
    mainWindow = null;
  });

  mainWindow.webContents.on('unresponsive', () => {
    console.warn('ADVERTENCIA: La aplicación no responde');
  });

  mainWindow.on('unresponsive', () => {
    console.warn('ADVERTENCIA: La ventana no responde');
  });

  // Manejo de errores en la precarga
  mainWindow.webContents.on('preload-error', (event, preloadPath, error) => {
    console.error(`ERROR en preload (${preloadPath}):`, error);
  });

  // Limpiar referencia cuando se cierra la ventana
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// =============================================================================
// EVENTOS DE LA APLICACIÓN
// =============================================================================

/**
 * Evento: app.whenReady
 * Se dispara cuando Electron ha terminado de inicializarse.
 * Aquí es seguro crear ventanas y usar APIs del sistema.
 */
app.whenReady().then(createWindow);

/**
 * Evento: window-all-closed
 * Se dispara cuando todas las ventanas han sido cerradas.
 * En Windows/Linux, esto cierra la aplicación.
 * En macOS, la app suele quedar activa en la barra de dock.
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * Evento: activate
 * Se dispara al hacer clic en el icono de la aplicación (macOS).
 * Recrea la ventana si fue cerrada pero la app sigue corriendo.
 */
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// =============================================================================
// IPC HANDLERS - COMUNICACIÓN CON EL RENDERER
// =============================================================================
// Estas funciones responden a llamadas desde el proceso de renderizado
// (React) a través del preload script.

// -----------------------------------------------------------------------------
// SECCIÓN: AUTO-ACTUALIZACIÓN
// -----------------------------------------------------------------------------

/**
 * IPC Handler: check-for-updates
 * Verifica si hay actualizaciones disponibles
 */
ipcMain.handle('check-for-updates', async () => {
  try {
    console.log('[AUTO-UPDATE] Iniciando verificación manual...');

    // Limpiar estado anterior
    updateState.updateAvailable = false;
    updateState.updateInfo = null;

    // Llamar checkForUpdates y esperar el resultado
    const result = await autoUpdater.checkForUpdates();

    console.log('[AUTO-UPDATE] Resultado checkForUpdates:', {
      updateAvailable: result?.updateInfo ? true : false,
      version: result?.updateInfo?.version,
      currentVersion: app.getVersion()
    });

    // Esperar un poco a que los listeners procesen (max 2 segundos)
    await new Promise(r => setTimeout(r, 500));

    return {
      success: true,
      hasUpdate: updateState.updateAvailable,
      updateInfo: updateState.updateInfo,
      currentVersion: app.getVersion()
    };
  } catch (error) {
    console.error('[AUTO-UPDATE] Error en check-for-updates:', error);
    return {
      success: false,
      error: error.message,
      currentVersion: app.getVersion()
    };
  }
});

/**
 * IPC Handler: download-update
 * Descarga la actualización disponible
 */
ipcMain.handle('download-update', async () => {
  try {
    if (updateState.updateAvailable && !updateState.updateDownloaded) {
      await autoUpdater.downloadUpdate();
      return {
        success: true,
        message: 'Descarga iniciada'
      };
    }
    return {
      success: false,
      message: 'No hay actualización disponible para descargar'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * IPC Handler: install-update
 * Instala la actualización descargada y reinicia la aplicación
 */
ipcMain.handle('install-update', () => {
  try {
    if (updateState.updateDownloaded) {
      // Forzar que se instale la actualización al reiniciar
      autoUpdater.quitAndInstall();
      return {
        success: true,
        message: 'Instalando actualización e iniciando reinicio...'
      };
    }
    return {
      success: false,
      message: 'No hay actualización descargada para instalar'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * IPC Handler: get-update-state
 * Obtiene el estado actual de la actualización
 */
ipcMain.handle('get-update-state', () => {
  return {
    updateAvailable: updateState.updateAvailable,
    updateDownloaded: updateState.updateDownloaded,
    currentProgress: updateState.currentProgress,
    updateInfo: updateState.updateInfo
  };
});

/**
 * IPC Handler: get-app-version
 * Obtiene la versión de la aplicación desde package.json
 */
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// -----------------------------------------------------------------------------
// SECCIÓN: CONTROL DE VENTANA (Custom Title Bar)
// -----------------------------------------------------------------------------

/**
 * IPC Handler: window-minimize
 * Minimiza la ventana principal
 */
ipcMain.handle('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

/**
 * IPC Handler: window-maximize
 * Maximiza o restaura (toggle) la ventana principal
 */
ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

/**
 * IPC Handler: window-close
 * Cierra la ventana principal (termina la aplicación)
 */
ipcMain.handle('window-close', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

/**
 * IPC Handler: window-is-maximized
 * Verifica si la ventana está maximizada
 */
ipcMain.handle('window-is-maximized', () => {
  if (mainWindow) {
    return mainWindow.isMaximized();
  }
  return false;
});

/**
 * IPC Handler: window-toggle-title-bar
 * Toggle del frame y barra de menú
 */
ipcMain.handle('window-toggle-title-bar', () => {
  if (mainWindow) {
    const currentFrame = mainWindow.webPreferences.preload ?
      !mainWindow.isNormal() : mainWindow.webPreferences.frame !== false;

    // Cambiar el estado del frame
    const newFrame = !currentFrame;
    mainWindow.setMenuBarVisibility(!newFrame);

    // Guardar el estado
    store.set('frameTitleBar', newFrame);

    return newFrame;
  }
  return false;
});

// -----------------------------------------------------------------------------
// SECCIÓN: GESTIÓN DEL WORKSPACE
// -----------------------------------------------------------------------------

/**
 * IPC Handler: get-workspace-path
 * Obtiene la ruta del workspace guardada en la configuración.
 * 
 * @returns {string|null} Ruta del workspace o null si no está configurado
 */
ipcMain.handle('get-workspace-path', () => {
  return store.get('workspacePath', null);
});

/**
 * IPC Handler: set-workspace-path
 * Guarda la ruta del workspace en la configuración.
 * 
 * @param {Event} event - Evento IPC
 * @param {string} workspacePath - Ruta absoluta del workspace
 * @returns {boolean} true si se guardó correctamente
 */
ipcMain.handle('set-workspace-path', (event, workspacePath) => {
  store.set('workspacePath', workspacePath);
  return true;
});

/**
 * IPC Handler: select-workspace
 * Muestra un diálogo nativo para seleccionar una carpeta existente.
 * 
 * @returns {string|null} Ruta seleccionada o null si el usuario canceló
 */
ipcMain.handle('select-workspace', async () => {
  // Mostrar diálogo de selección de carpeta
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],  // Solo permitir seleccionar carpetas
    title: 'Seleccionar carpeta de trabajo',
    buttonLabel: 'Seleccionar'
  });

  // Si el usuario no canceló y seleccionó una carpeta
  if (!result.canceled && result.filePaths.length > 0) {
    const workspacePath = result.filePaths[0];
    store.set('workspacePath', workspacePath);
    return workspacePath;
  }
  return null;
});

/**
 * IPC Handler: create-workspace
 * Crea un nuevo workspace en una ubicación seleccionada por el usuario.
 * Genera archivos de bienvenida iniciales.
 * 
 * @returns {string|null} Ruta del nuevo workspace o null si canceló
 */
ipcMain.handle('create-workspace', async () => {
  // Mostrar diálogo para guardar (crear) una nueva carpeta
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Crear nueva área de trabajo',
    defaultPath: 'MiWorkspace',
    buttonLabel: 'Crear',
    properties: ['createDirectory']  // Permite crear directorios nuevos
  });

  if (!result.canceled) {
    const workspacePath = result.filePath;

    // Crear la carpeta del workspace
    await fs.ensureDir(workspacePath);

    // Crear archivos de bienvenida iniciales
    await createWelcomeFiles(workspacePath);

    // Guardar la ruta en configuración
    store.set('workspacePath', workspacePath);
    return workspacePath;
  }
  return null;
});

/**
 * IPC Handler: read-workspace
 * Lee todos los proyectos y archivos del workspace.
 * Escanea recursivamente la estructura de carpetas.
 * 
 * @param {Event} event - Evento IPC
 * @param {string} workspacePath - Ruta del workspace a leer
 * @returns {Array} Lista de proyectos con sus archivos
 */
ipcMain.handle('read-workspace', async (event, workspacePath) => {
  try {
    const projects = [];

    // Leer contenido del workspace
    const entries = await fs.readdir(workspacePath, { withFileTypes: true });

    // Procesar cada entrada (solo carpetas, ignorar archivos sueltos)
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const projectPath = path.join(workspacePath, entry.name);

        // Escanear recursivamente el contenido del proyecto
        const items = await scanDirectory(projectPath);

        projects.push({
          name: entry.name,
          path: projectPath,
          items: items,
          open: false  // Estado inicial del proyecto (colapsado)
        });
      }
    }

    return projects;
  } catch (error) {
    console.error('Error reading workspace:', error);
    throw error;
  }
});

// -----------------------------------------------------------------------------
// SECCIÓN: OPERACIONES CON ARCHIVOS
// -----------------------------------------------------------------------------

/**
 * Escanea un directorio recursivamente buscando archivos .txt
 * y subcarpetas.
 * 
 * @param {string} dirPath - Ruta del directorio a escanear
 * @param {string} parentPath - Ruta relativa para construir jerarquía
 * @returns {Array} Lista de archivos y carpetas con metadatos
 */
async function scanDirectory(dirPath, parentPath = '') {
  const items = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  // Ordenar: primero archivos, luego carpetas; ambos alfabéticamente
  const sortedEntries = entries.sort((a, b) => {
    if (a.isDirectory() === b.isDirectory()) {
      return a.name.localeCompare(b.name);
    }
    return a.isDirectory() ? 1 : -1;
  });

  for (const entry of sortedEntries) {
    // Ignorar archivos ocultos (que empiezan con .)
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(dirPath, entry.name);
    const relativePath = parentPath ? path.join(parentPath, entry.name) : entry.name;

    if (entry.isDirectory()) {
      // Es una carpeta - escanear recursivamente
      const subItems = await scanDirectory(fullPath, relativePath);

      // Solo agregar carpetas que tengan contenido
      if (subItems.length > 0) {
        items.push({
          name: entry.name,
          path: relativePath,
          fullPath: fullPath,
          type: 'folder',
          items: subItems
        });
      }
    } else if (entry.name.endsWith('.txt')) {
      // Es un archivo de texto - leer contenido y metadatos
      const content = await readFileWithMetadata(fullPath);

      // Buscar si existe una carpeta asociada con subarchivos: <file>.d/
      const assocDir = fullPath + '.d';
      let childItems = [];
      if (await fs.pathExists(assocDir)) {
        // Scanear la carpeta asociada pero sin pasar parentPath extra (lo hacemos abajo)
        const assocScan = await scanDirectory(assocDir, path.join(parentPath, entry.name + '.d'));
        // assocScan devuelve items con paths relativos dentro la carpeta; adaptarlos
        childItems = assocScan;
      }

      const fileItem = {
        name: entry.name,
        path: relativePath,
        fullPath: fullPath,
        type: 'file',
        ...content
      };

      if (childItems.length > 0) {
        fileItem.items = childItems;
      }

      items.push(fileItem);
    }
  }

  return items;
}

/**
 * Lee un archivo .txt y extrae su contenido HTML y metadatos.
 * Los metadatos están embebidos en un comentario HTML al inicio.
 * 
 * Formato del archivo:
 * <!--METADATA
 * { "status": "draft", "goal": 30000, ... }
 * -->
 * 
 * <p>Contenido HTML...</p>
 * 
 * @param {string} filePath - Ruta del archivo a leer
 * @returns {Object} Contenido HTML y metadatos parseados
 */
async function readFileWithMetadata(filePath) {
  try {
    // Leer contenido completo del archivo
    const content = await fs.readFile(filePath, 'utf-8');

    // Buscar bloque de metadatos con regex
    // Busca: <!--METADATA\n{...}\n-->
    const metadataMatch = content.match(/<!--METADATA\n([\s\S]*?)\n-->/);

    let metadata = {};
    let htmlContent = content;

    if (metadataMatch) {
      try {
        // Parsear JSON de metadatos
        metadata = JSON.parse(metadataMatch[1]);

        // Extraer solo el contenido HTML (después del bloque de metadatos)
        htmlContent = content.replace(metadataMatch[0], '').trim();
      } catch (e) {
        console.warn('Error parsing metadata:', e);
        // Si falla el parseo, usar todo el contenido como HTML
      }
    }

    return {
      content: htmlContent,
      status: metadata.status || 'draft',
      goal: metadata.goal || 30000,
      lastCharCount: metadata.lastCharCount || 0,
      initialCharCount: metadata.initialCharCount || 0,
      comments: metadata.comments || [],
      lastUpdated: metadata.lastUpdated || Date.now()
    };
  } catch (error) {
    console.error('Error reading file:', error);

    // Valores por defecto si hay error
    return {
      content: '<p><br></p>',
      status: 'draft',
      goal: 30000,
      lastCharCount: 0,
      initialCharCount: 0,
      comments: [],
      lastUpdated: Date.now()
    };
  }
}

/**
 * IPC Handler: save-file
 * Guarda el contenido HTML y metadatos de un archivo.
 * 
 * @param {Event} event - Evento IPC
 * @param {string} filePath - Ruta del archivo a guardar
 * @param {string} htmlContent - Contenido HTML del editor
 * @param {Object} metadata - Metadatos a guardar
 * @returns {boolean} true si se guardó correctamente
 */
ipcMain.handle('save-file', async (event, filePath, htmlContent, metadata) => {
  const op = beginOp();
  try {
    // Registro para depuración: tipo de metadata y resumen de comments
    try {
      console.log('[SAVE-FILE] Guardando:', filePath);
      console.log('[SAVE-FILE] metadata keys:', metadata ? Object.keys(metadata) : 'null');
      const commentsSummary = Array.isArray(metadata?.comments) ? metadata.comments.map(c => ({ id: c.id, paragraphId: c.paragraphId })) : [];
      console.log('[SAVE-FILE] comments count:', commentsSummary.length);
    } catch (logErr) {
      console.warn('[SAVE-FILE] Error al registrar metadata:', logErr);
    }

    // Validar que el destino no sea una carpeta
    try {
      if (await fs.pathExists(filePath)) {
        const stat = await fs.stat(filePath);
        if (stat.isDirectory()) {
          throw new Error('save-file: target path is a directory');
        }
      }
    } catch (statErr) {
      console.error('[SAVE-FILE] Error comprobando destino:', statErr);
      throw statErr;
    }

    // Sanitizar metadatos: normalizar la lista de comments a objetos planos
    let safeMetadata = { ...metadata };
    try {
      if (Array.isArray(metadata?.comments)) {
        safeMetadata.comments = metadata.comments.map(c => ({
          id: c?.id || null,
          paragraphId: c?.paragraphId || null,
          text: c?.text || '',
          timestamp: c?.timestamp || Date.now(),
          author: c?.author || null
        }));
      } else {
        safeMetadata.comments = [];
      }
    } catch (e) {
      console.warn('[SAVE-FILE] Error normalizando comments, se limpia la lista', e);
      safeMetadata.comments = [];
    }

    // Construir contenido completo con metadatos embebidos
    const fullContent = `<!--METADATA\n${JSON.stringify(safeMetadata, null, 2)}\n-->\n\n${htmlContent}`;

    // Escritura atómica: escribir en archivo temporal y mover
    const tmpPath = filePath + '.tmp-' + Date.now();
    try {
      await fs.writeFile(tmpPath, fullContent, 'utf-8');
      await fs.move(tmpPath, filePath, { overwrite: true });
    } catch (fsErr) {
      console.error('[SAVE-FILE] Error escribiendo o moviendo fichero:', fsErr);
      // Intentar limpiar el tmp si existe
      try { if (await fs.pathExists(tmpPath)) await fs.remove(tmpPath); } catch (cleanupErr) { /* ignore */ }
      throw fsErr;
    }

    // Emitir evento para que el renderer refresque si es necesario
    if (mainWindow) mainWindow.webContents.send('file-saved', filePath);
    if (mainWindow) mainWindow.webContents.send('workspace-changed');
    return true;
  } catch (error) {
    console.error('Error saving file:', error);
    throw error;
  } finally {
    endOp(op);
  }
});

/**
 * IPC Handler: create-project
 * Crea una nueva carpeta de proyecto dentro del workspace.
 * 
 * @param {Event} event - Evento IPC
 * @param {string} workspacePath - Ruta del workspace padre
 * @param {string} projectName - Nombre del nuevo proyecto
 * @returns {string} Ruta del proyecto creado
 */
ipcMain.handle('create-project', async (event, workspacePath, projectName) => {
  try {
    const projectPath = path.join(workspacePath, projectName);
    await fs.ensureDir(projectPath);
    if (mainWindow) mainWindow.webContents.send('workspace-changed');
    return projectPath;
  } catch (error) {
    console.error('Error creating project:', error);
    throw error;
  }
});

/**
 * IPC Handler: create-file
 * Crea un nuevo archivo .txt en un proyecto.
 * 
 * @param {Event} event - Evento IPC
 * @param {string} projectPath - Ruta del proyecto donde crear el archivo
 * @param {string} fileName - Nombre del archivo (se añade .txt si no lo tiene)
 * @returns {string} Ruta del archivo creado
 */
ipcMain.handle('create-file', async (event, projectPath, fileName, parentPath = null) => {
  const op = beginOp();
  try {
    // Asegurar extensión .txt
    const finalName = fileName.endsWith('.txt') ? fileName : fileName + '.txt';

    // Determinar directorio destino. Si projectPath apunta a un archivo .txt,
    // creamos/usar una carpeta asociada <file>.d para almacenar subarchivos.
    let targetDir = projectPath;
    let actualParentPath = parentPath || projectPath;
    
    if (projectPath && projectPath.endsWith('.txt')) {
      const assocDir = projectPath + '.d';
      await fs.ensureDir(assocDir);
      targetDir = assocDir;
      actualParentPath = projectPath;  // El padre es el archivo .txt
    } else {
      // Asegurar que el directorio existe
      await fs.ensureDir(targetDir);
    }

    const filePath = path.join(targetDir, finalName);

    // Metadatos iniciales por defecto con información de jerarquía
    const metadata = {
      status: 'draft',
      goal: 30000,
      lastCharCount: 0,
      initialCharCount: 0,
      comments: [],
      lastUpdated: Date.now(),
      createdAt: Date.now(),
      parentPath: actualParentPath  // Guardar referencia al padre
    };

    // Contenido inicial vacío con solo un párrafo
    const content = `<!--METADATA\n${JSON.stringify(metadata, null, 2)}\n-->\n\n<p><br></p>`;

    // Escritura atómica
    const tmpPath = filePath + '.tmp-' + Date.now();
    await fs.writeFile(tmpPath, content, 'utf-8');
    await fs.move(tmpPath, filePath, { overwrite: false });

    if (mainWindow) mainWindow.webContents.send('workspace-changed');
    return filePath;
  } catch (error) {
    console.error('Error creating file:', error);
    throw error;
  } finally {
    endOp(op);
  }
});

/**
 * IPC Handler: create-folder
 * Crea una nueva carpeta en el proyecto.
 * 
 * @param {Event} event - Evento IPC
 * @param {string} projectPath - Ruta del proyecto o directorio padre
 * @param {string} folderName - Nombre de la carpeta a crear
 * @returns {string} Ruta de la carpeta creada
 */
ipcMain.handle('create-folder', async (event, projectPath, folderName) => {
  const op = beginOp();
  try {
    // Determinar directorio destino
    let targetDir = projectPath;
    if (projectPath && projectPath.endsWith('.txt')) {
      // Si es un archivo, crear carpeta en el directorio asociado
      const assocDir = projectPath + '.d';
      await fs.ensureDir(assocDir);
      targetDir = assocDir;
    } else {
      // Asegurar que el directorio padre existe
      await fs.ensureDir(targetDir);
    }

    const folderPath = path.join(targetDir, folderName);

    // Crear la carpeta
    await fs.ensureDir(folderPath);

    if (mainWindow) mainWindow.webContents.send('workspace-changed');
    return folderPath;
  } catch (error) {
    console.error('Error creating folder:', error);
    throw error;
  } finally {
    endOp(op);
  }
});

/**
 * IPC Handler: move-file
 * Mueve un archivo de una ubicación a otra, actualizando su metadata.
 * 
 * @param {Event} event - Evento IPC
 * @param {string} sourcePath - Ruta actual del archivo
 * @param {string} destPath - Ruta de destino (carpeta o proyecto)
 * @returns {string} Nueva ruta del archivo
 */
ipcMain.handle('move-file', async (event, sourcePath, destPath) => {
  const op = beginOp();
  try {
    // 1. Validar que origen existe
    if (!await fs.pathExists(sourcePath)) {
      throw new Error('El archivo origen no existe');
    }

    // 2. Validar que destino es una carpeta
    const destStat = await fs.stat(destPath);
    if (!destStat.isDirectory()) {
      throw new Error('El destino debe ser una carpeta');
    }

    // 3. Validar que no se mueve a sí mismo
    if (sourcePath === destPath || sourcePath.startsWith(destPath + path.sep)) {
      throw new Error('No se puede mover un archivo a sí mismo o a una subcarpeta propia');
    }

    // 4. Calcular nueva ruta
    const fileName = path.basename(sourcePath);
    const newPath = path.join(destPath, fileName);

    // 5. Validar que no existe archivo con mismo nombre en destino
    if (await fs.pathExists(newPath)) {
      throw new Error('Ya existe un archivo con ese nombre en el destino');
    }

    // 6. Leer metadata del archivo origen
    const fileContent = await readFileWithMetadata(sourcePath);

    // 7. Actualizar metadata con nueva ubicación
    fileContent.parentPath = destPath;
    fileContent.lastUpdated = Date.now();

    // 8. Mover archivo físicamente
    await fs.move(sourcePath, newPath);

    // 9. Si tiene carpeta .d asociada, moverla también
    const assocDir = sourcePath + '.d';
    if (await fs.pathExists(assocDir)) {
      await fs.move(assocDir, newPath + '.d');
    }

    // 10. Guardar metadata actualizada
    const metadataToSave = {
      status: fileContent.status,
      goal: fileContent.goal,
      lastCharCount: fileContent.lastCharCount,
      initialCharCount: fileContent.initialCharCount,
      comments: fileContent.comments,
      lastUpdated: fileContent.lastUpdated,
      parentPath: fileContent.parentPath
    };

    const fullContent = `<!--METADATA\n${JSON.stringify(metadataToSave, null, 2)}\n-->\n\n${fileContent.content}`;
    await fs.writeFile(newPath, fullContent, 'utf-8');

    if (mainWindow) mainWindow.webContents.send('workspace-changed');
    return newPath;
  } catch (error) {
    console.error('Error moving file:', error);
    throw error;
  } finally {
    endOp(op);
  }
});

/**
 * IPC Handler: rename-file
 * Renombra un archivo existente.
 * 
 * @param {Event} event - Evento IPC
 * @param {string} oldPath - Ruta actual del archivo
 * @param {string} newName - Nuevo nombre (se añade .txt si es necesario)
 * @returns {string} Nueva ruta del archivo
 */
ipcMain.handle('rename-file', async (event, oldPath, newName) => {
  const op = beginOp();
  try {
    const dir = path.dirname(oldPath);
    const finalName = newName.endsWith('.txt') ? newName : newName + '.txt';
    const newPath = path.join(dir, finalName);

    // Operación atómica: mover dentro del mismo sistema de archivos
    await fs.move(oldPath, newPath, { overwrite: false });

    // Mover carpeta asociada si existe (.d)
    const oldAssocDir = oldPath + '.d';
    const newAssocDir = newPath + '.d';
    if (await fs.pathExists(oldAssocDir)) {
      await fs.move(oldAssocDir, newAssocDir, { overwrite: false });
    }

    // Emitir evento para que el renderer pueda refrescar si lo desea
    if (mainWindow) mainWindow.webContents.send('workspace-changed');
    return newPath;
  } catch (error) {
    console.error('Error renaming file:', error);
    throw error;
  } finally {
    endOp(op);
  }
});

/**
 * IPC Handler: rename-folder
 * Renombra una carpeta existente.
 */
ipcMain.handle('rename-folder', async (event, oldPath, newName) => {
  const op = beginOp();
  try {
    const parent = path.dirname(oldPath);
    const newPath = path.join(parent, newName);
    await fs.move(oldPath, newPath, { overwrite: false });
    if (mainWindow) mainWindow.webContents.send('workspace-changed');
    return newPath;
  } catch (error) {
    console.error('Error renaming folder:', error);
    throw error;
  } finally {
    endOp(op);
  }
});

/**
 * IPC Handler: rename-project
 * Renombra la carpeta de un proyecto (por índice).
 */
ipcMain.handle('rename-project', async (event, projectIndex, newName) => {
  const op = beginOp();
  try {
    const workspacePath = store.get('workspacePath');
    if (!workspacePath) throw new Error('Workspace no configurado');
    const entries = await fs.readdir(workspacePath, { withFileTypes: true });
    const folders = entries.filter(e => e.isDirectory() && !e.name.startsWith('.'));
    if (projectIndex < 0 || projectIndex >= folders.length) throw new Error('Índice de proyecto inválido');
    const oldName = folders[projectIndex].name;
    const oldPath = path.join(workspacePath, oldName);
    const newPath = path.join(workspacePath, newName);
    await fs.move(oldPath, newPath, { overwrite: false });
    if (mainWindow) mainWindow.webContents.send('workspace-changed');
    return newPath;
  } catch (error) {
    console.error('Error renaming project:', error);
    throw error;
  } finally {
    endOp(op);
  }
});

/**
 * IPC Handler: delete-item
 * Elimina un archivo o carpeta.
 * 
 * @param {Event} event - Evento IPC
 * @param {string} itemPath - Ruta del elemento a eliminar
 * @param {boolean} isDirectory - true si es carpeta, false si es archivo
 * @returns {boolean} true si se eliminó correctamente
 */
ipcMain.handle('delete-item', async (event, itemPath, isDirectory) => {
  const op = beginOp();
  try {
    if (isDirectory) {
      // Eliminar carpeta y todo su contenido (recursive: true)
      await fs.remove(itemPath);
    } else {
      // Eliminar archivo individual
      await fs.unlink(itemPath);
      // Eliminar carpeta asociada si existe
      const assocDir = itemPath + '.d';
      if (await fs.pathExists(assocDir)) {
        await fs.remove(assocDir);
      }
    }
    if (mainWindow) mainWindow.webContents.send('workspace-changed');
    return true;
  } catch (error) {
    console.error('Error deleting item:', error);
    throw error;
  } finally {
    endOp(op);
  }
});

/**
 * IPC Handler: move-file
 * Mueve un archivo de una ubicación a otra.
 * 
 * @param {Event} event - Evento IPC
 * @param {string} sourcePath - Ruta del archivo origen
 * @param {string} targetPath - Ruta del archivo destino (carpeta)
 * @param {string} position - Posición ('before', 'after', o 'inside')
 * @returns {boolean} true si se movió correctamente
 */
ipcMain.handle('move-file', async (event, sourcePath, targetPath, position) => {
  const op = beginOp();
  try {
    const sourceFileName = path.basename(sourcePath);
    let destPath;
    try {
      const stat = await fs.stat(targetPath);
      if (stat.isDirectory()) {
        destPath = path.join(targetPath, sourceFileName);
      } else {
        // targetPath es un archivo, tomar su directorio
        destPath = path.join(path.dirname(targetPath), sourceFileName);
      }
    } catch (e) {
      // Si el targetPath no existe, asumimos que es un directorio destino
      destPath = path.join(targetPath, sourceFileName);
    }

    // Si el destino es diferente del origen, mover de forma atómica
    if (sourcePath !== destPath) {
      await fs.move(sourcePath, destPath, { overwrite: false });

      // Mover carpeta asociada si existe (.d)
      const sourceAssocDir = sourcePath + '.d';
      const destAssocDir = destPath + '.d';
      if (await fs.pathExists(sourceAssocDir)) {
        await fs.move(sourceAssocDir, destAssocDir, { overwrite: false });
      }

      if (mainWindow) mainWindow.webContents.send('workspace-changed');
    }

    return destPath;
  } catch (error) {
    console.error('Error moving file:', error);
    throw error;
  } finally {
    endOp(op);
  }
});

// -----------------------------------------------------------------------------
// SECCIÓN: CONFIGURACIÓN Y AVATAR
// -----------------------------------------------------------------------------

/**
 * IPC Handler: get-config
 * Obtiene la configuración completa del usuario.
 * Si no existe, devuelve valores por defecto.
 * 
 * @returns {Object} Objeto de configuración
 */
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-config', () => {
  return store.get('config', {
    // Configuración por defecto
    theme: 'dark',
    autosaveInterval: 30,
    defaultGoal: 30000,
    userName: 'Escritor',

    // Estados de progreso predefinidos
    states: [
      {
        id: 'draft',
        name: 'Primer Borrador',
        color: '#ff3b30',
        goal: 30000,
        countType: 'absolute'
      },
      {
        id: 'review',
        name: 'En Revisión',
        color: '#ff9500',
        goal: 15000,
        countType: 'edited'
      },
      {
        id: 'final',
        name: 'Últimos Retoques',
        color: '#34c759',
        goal: 5000,
        countType: 'delta'
      }
    ],

    // Atajos de teclado por defecto
    shortcuts: {
      save: { key: 's', ctrl: true, shift: false, alt: false },
      bold: { key: 'b', ctrl: true, shift: false, alt: false },
      italic: { key: 'i', ctrl: true, shift: false, alt: false },
      underline: { key: 'u', ctrl: true, shift: false, alt: false }
    }
  });
});

/**
 * IPC Handler: save-config
 * Guarda la configuración completa del usuario.
 * 
 * @param {Event} event - Evento IPC
 * @param {Object} config - Objeto de configuración a guardar
 * @returns {boolean} true si se guardó correctamente
 */
ipcMain.handle('save-config', (event, config) => {
  store.set('config', config);
  return true;
});

/**
 * IPC Handler: save-avatar
 * Guarda la imagen del avatar en base64.
 * 
 * @param {Event} event - Evento IPC
 * @param {string} avatarData - Imagen en formato dataURL/base64
 * @returns {boolean} true si se guardó correctamente
 */
ipcMain.handle('save-avatar', (event, avatarData) => {
  store.set('avatar', avatarData);
  return true;
});

/**
 * IPC Handler: get-avatar
 * Obtiene la imagen del avatar guardada.
 * 
 * @returns {string|null} Imagen en base64 o null si no existe
 */
ipcMain.handle('get-avatar', () => {
  return store.get('avatar', null);
});

// -----------------------------------------------------------------------------
// SECCIÓN: UTILIDADES DEL SISTEMA
// -----------------------------------------------------------------------------

/**
 * IPC Handler: open-external
 * Abre una URL en el navegador predeterminado del sistema.
 * 
 * @param {Event} event - Evento IPC
 * @param {string} url - URL a abrir
 */
ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url);
});

/**
 * IPC Handler: copy-to-clipboard
 * Copia texto al portapapeles del sistema.
 * 
 * @param {Event} event - Evento IPC
 * @param {string} text - Texto a copiar
 * @returns {boolean} true si se copió correctamente
 */
ipcMain.handle('copy-to-clipboard', (event, text) => {
  const { clipboard } = require('electron');
  clipboard.writeText(text);
  return true;
});

// -----------------------------------------------------------------------------
// SECCIÓN: IMPORTAR/EXPORTAR DATOS
// -----------------------------------------------------------------------------

/**
 * IPC Handler: export-data
 * Exporta todos los datos de la aplicación a un archivo JSON.
 * Muestra un diálogo para seleccionar dónde guardar.
 * 
 * @param {Event} event - Evento IPC
 * @param {Object} data - Datos a exportar (config, proyectos, etc.)
 * @returns {boolean} true si se exportó correctamente
 */
ipcMain.handle('export-data', async (event, data) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar datos de Block Guard',
    defaultPath: `block_guard_backup_${new Date().toISOString().split('T')[0]}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });

  if (!result.canceled) {
    await fs.writeFile(result.filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  }
  return false;
});

/**
 * IPC Handler: import-data
 * Importa datos desde un archivo JSON seleccionado por el usuario.
 * 
 * @returns {Object|null} Datos importados o null si canceló
 */
ipcMain.handle('import-data', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Importar datos de Block Guard',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const content = await fs.readFile(result.filePaths[0], 'utf-8');
    return JSON.parse(content);
  }
  return null;
});

// -----------------------------------------------------------------------------
// SECCIÓN: ARCHIVOS DE BIENVENIDA
// -----------------------------------------------------------------------------

/**
 * Crea archivos de bienvenida iniciales en un nuevo workspace.
 * Esto ayuda al usuario a entender cómo usar la aplicación.
 * 
 * @param {string} workspacePath - Ruta del workspace recién creado
 */
async function createWelcomeFiles(workspacePath) {
  // Contenido del archivo de bienvenida
  const welcomeContent = `# ¡Bienvenido a Block Guard!

Block Guard es tu espacio de escritura protegido, diseñado para ayudarte a organizar tus proyectos de escritura de manera eficiente y segura.

## Características principales:

### 📁 Organización por Proyectos
- Crea múltiples proyectos para diferentes trabajos
- Estructura jerárquica de archivos y subarchivos
- Arrastra y suelta para reorganizar

### 📝 Editor de Texto Enriquecido
- Formato de texto (negrita, cursiva, subrayado)
- Títulos y encabezados
- Resaltado de texto en colores
- Listas y citas

### 📊 Seguimiento de Progreso
- Metas de caracteres personalizables
- Estados de progreso (Borrador, Revisión, Final)
- Estadísticas en tiempo real

### 💬 Sistema de Comentarios
- Añade comentarios por párrafo
- Revisa feedback organizado
- Mejora tu escritura colaborativamente

### 🎨 Personalización
- Múltiples temas de color
- Temas personalizados
- Avatar de usuario

### ⌨️ Atajos de Teclado
- Ctrl+S: Guardar
- Ctrl+B: Negrita
- Ctrl+I: Cursiva
- Ctrl+U: Subrayado

## Empezar

1. Crea un nuevo proyecto desde el sidebar
2. Añade archivos a tu proyecto
3. Empieza a escribir
4. Guarda con Ctrl+S o el botón de guardar

## Corrector Ortográfico

Block Guard integra herramientas externas de corrección:
- LanguageTool
- Corrector.co
- Otras páginas personalizables

¡Feliz escritura! 🚀
`;

  // Crear archivo de bienvenida en la raíz del workspace
  const readmePath = path.join(workspacePath, 'Bienvenido.txt');
  const metadata = {
    status: 'final',
    goal: 1000,
    lastCharCount: welcomeContent.length,
    initialCharCount: 0,
    comments: [],
    lastUpdated: Date.now()
  };

  // Convertir texto plano a HTML simple
  const htmlContent = `<p>${welcomeContent.split('\n\n').join('</p><p>').split('\n').join('<br>')}</p>`;
  const fullContent = `<!--METADATA\n${JSON.stringify(metadata, null, 2)}\n-->\n\n${htmlContent}`;

  await fs.writeFile(readmePath, fullContent, 'utf-8');

  // Crear carpeta de ejemplo con un archivo
  const exampleProjectPath = path.join(workspacePath, 'Mi Primer Proyecto');
  await fs.ensureDir(exampleProjectPath);

  const exampleContent = `# Mi Primer Proyecto

Este es un archivo de ejemplo para que veas cómo funciona Block Guard.

Puedes:
- Escribir texto normal
- **Poner negritas** con Ctrl+B
- *Usar cursiva* con Ctrl+I
- <u>Subrayar texto</u> con Ctrl+U

## Estructura

Organiza tu escritura en secciones claras y concisas.

> "La escritura es la pintura de la voz." - Voltaire

¡Empieza a escribir tu obra maestra!
`;

  const exampleMetadata = {
    status: 'draft',
    goal: 30000,
    lastCharCount: exampleContent.length,
    initialCharCount: 0,
    comments: [],
    lastUpdated: Date.now()
  };

  const exampleHtml = `<p>${exampleContent.split('\n\n').join('</p><p>').split('\n').join('<br>')}</p>`;
  const exampleFullContent = `<!--METADATA\n${JSON.stringify(exampleMetadata, null, 2)}\n-->\n\n${exampleHtml}`;

  await fs.writeFile(path.join(exampleProjectPath, 'Capítulo 1.txt'), exampleFullContent, 'utf-8');
}
