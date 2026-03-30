/**
 * ============================================================================
 *  ELECTRON.JS (PROCESO PRINCIPAL)
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
// IMPORTAR NUEVO SISTEMA DE METADATOS
// =============================================================================
// CRÍTICO: Path que funciona en desarrollo, producción y GitHub Codespaces
// En desarrollo: electron.js en public/, src/main en raíz
// En producción empaquetada: electron.js en build/, src/main en build/src/main
// Fallback: app.getAppPath() cuando __dirname varía según empaquetado
const isDev = !app.isPackaged;
const log = isDev ? console.log : () => {};
const logWarn = isDev ? console.warn : () => {};

function findMetadataPath() {
  const appPath = app.getAppPath();
  const unpackedPath = appPath.replace(/app\.asar$/, 'app.asar.unpacked');
  const candidates = [
    path.join(__dirname, '..', 'src', 'main', 'index'),           // dev: public/ -> raíz
    path.join(__dirname, 'src', 'main', 'index'),                 // prod: build/electron.js
    path.join(unpackedPath, 'build', 'src', 'main', 'index'),     // asar.unpacked
    path.join(appPath, 'build', 'src', 'main', 'index'),
    path.join(appPath, 'src', 'main', 'index'),
  ];
  for (const p of candidates) {
    const modPath = p + '.js';
    if (fs.existsSync(modPath)) return p;
  }
  return path.join(isDev ? path.join(__dirname, '..') : __dirname, 'src', 'main', 'index');
}

const metadataPath = findMetadataPath();
log('[ELECTRON] Modo:', isDev ? 'DESARROLLO' : 'PRODUCCIÓN');
log('[ELECTRON] __dirname:', __dirname);
log('[ELECTRON] Cargando metadata desde:', metadataPath);
log('[ELECTRON] app.isPackaged:', app.isPackaged);

let metadata;
let metadataWriter;
try {
  metadata = require(metadataPath);
  // Importar metadataWriter para move-file-between-projects
  const metadataWriterPath = metadataPath.replace('index', 'metadataWriter');
  metadataWriter = require(metadataWriterPath);
} catch (err) {
  console.error('[ELECTRON] ERROR crítico cargando metadata:', err.message);
  throw err;
}

/**
 * Convierte un archivo con metadata al formato legacy esperado por App.js
 * @param {object} file - Archivo con metadata
 * @returns {object} - Archivo en formato legacy
 */
function formatForFrontend(file) {
  // Determinar el tipo correcto
  const fileType = file.metadata?.type || file.type || 'file';
  const fileName = file.name || file.metadata?.name || path.basename(file.path, path.extname(file.path));
  
  return {
    name: fileName,
    fullPath: file.path,
    type: fileType, // Respetar el tipo (file o folder)
    content: file.content || '', // Se carga bajo demanda, pero incluir si está disponible
    status: file.status || 'draft',
    goal: file.goal || 30000,
    lastCharCount: file.lastCharCount || 0,
    initialCharCount: file.initialCharCount || 0,
    comments: file.comments || [],
    items: file.children && file.children.length > 0 ? formatTreeForFrontend(file.children) : undefined,
    // Metadata adicional
    id: file.id,
    parentId: file.parentId,
    projectId: file.projectId !== undefined ? file.projectId : null, // null for root files, uuid for project files
    order: file.order,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    customIcon: file.customIcon || null
  };
}

/**
 * Convierte un árbol de archivos con metadata al formato legacy para el frontend
 * @param {Array<object>} tree - Árbol de archivos
 * @returns {Array<object>} - Árbol en formato legacy
 */
function formatTreeForFrontend(tree) {
  return tree.map(node => {
    const legacyNode = formatForFrontend(node);
    return legacyNode;
  });
}

// =============================================================================
// ALMACENAMIENTO PERSISTENTE SIMPLE
// =============================================================================

class SimpleStore {
  constructor(name = 'config') {
    this.storePath = path.join(app.getPath('userData'), `${name}.json`);
    log('[STORE] Inicializando store:', this.storePath);
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.storePath)) {
        const content = fs.readFileSync(this.storePath, 'utf8');
        log('[STORE] Archivo cargado, tamaño:', content.length);
        return JSON.parse(content);
      } else {
        log('[STORE] Archivo no existe, usando datos vacíos');
      }
    } catch (error) {
      console.error('[STORE] Error loading store:', error);
    }
    return {};
  }

  save() {
    try {
      const dir = path.dirname(this.storePath);
      log('[STORE] Asegurando directorio:', dir);
      fs.ensureDirSync(dir);

      const content = JSON.stringify(this.data, null, 2);
      log('[STORE] Guardando archivo, tamaño:', content.length);
      fs.writeFileSync(this.storePath, content, 'utf8');
      log('[STORE] Archivo guardado exitosamente');

      // Verificar que se guardó correctamente
      if (fs.existsSync(this.storePath)) {
        const stats = fs.statSync(this.storePath);
        log('[STORE] Verificación - Archivo existe, tamaño:', stats.size);
      } else {
        console.error('[STORE] ERROR: El archivo no existe después de guardar!');
      }
    } catch (error) {
      console.error('[STORE] Error saving store:', error);
      throw error; // Re-lanzar el error para que se pueda manejar arriba
    }
  }

  get(key, defaultValue = null) {
    const value = this.data[key] !== undefined ? this.data[key] : defaultValue;
    log(`[STORE] GET '${key}':`, value ? 'FOUND' : 'NOT FOUND (usando default)');
    return value;
  }

  set(key, value) {
    log(`[STORE] SET '${key}'`);
    this.data[key] = value;
    this.save();
  }

  delete(key) {
    log(`[STORE] DELETE '${key}'`);
    delete this.data[key];
    this.save();
  }

  clear() {
    log('[STORE] CLEAR - Eliminando todos los datos');
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

// Variable global para almacenar el estado de actualización
let updateState = {
  updateAvailable: false,
  updateDownloaded: false,
  updateInfo: null,
  currentProgress: 0,
  totalSize: 0,
  downloadedSize: 0
};

/**
 * Compara dos versiones semver.
 * @param {string} v1 - Primera versión (ej: "1.26.31")
 * @param {string} v2 - Segunda versión (ej: "1.26.30")
 * @returns {number} 1 si v1 > v2, -1 si v1 < v2, 0 si v1 === v2
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split(/[-.]/).map(p => parseInt(p) || 0);
  const parts2 = v2.split(/[-.]/).map(p => parseInt(p) || 0);
  
  const maxLength = Math.max(parts1.length, parts2.length);
  
  for (let i = 0; i < maxLength; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  
  return 0;
}

/**
 * Verificación silenciosa de actualizaciones (solo notificación)
 */
function checkForUpdatesSilently() {
  try {
    log('[AUTO-UPDATE] Verificación silenciosa iniciada');

    // Deshabilitar descarga automática
    autoUpdater.autoDownload = false;

    // Verificar actualizaciones
    autoUpdater.checkForUpdates().catch(err => {
      console.error('[AUTO-UPDATE] Error en verificación silenciosa:', err);
    });
  } catch (error) {
    console.error('[AUTO-UPDATE] Error en checkForUpdatesSilently:', error);
  }
}

/**
 * Inicializa el sistema de auto-actualización
 * DEBE llamarse DESPUÉS de que app esté ready
 */
function initializeAutoUpdater() {
  log('[AUTO-UPDATE] Inicializando sistema de actualizaciones...');

  // Configurar electron-updater con logger simple
  const simpleLogger = {
    info: (msg) => log('[AUTO-UPDATE]', msg),
    warn: (msg) => logWarn('[AUTO-UPDATE]', msg),
    error: (msg) => console.error('[AUTO-UPDATE]', msg),
    debug: (msg) => console.debug('[AUTO-UPDATE]', msg),
    transports: {
      file: { level: 'info' }
    }
  };

  autoUpdater.logger = simpleLogger;

  // Configurar auto-updater para GitHub releases
  autoUpdater.autoDownload = false; // No descargar automáticamente
  autoUpdater.autoInstallOnAppQuit = false; // No instalar automáticamente al cerrar
  autoUpdater.allowDowngrade = false; // No permitir downgrade
  autoUpdater.allowPrerelease = false; // No permitir prereleases por defecto

  try {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'Valentin-sbox',
      repo: 'Bloopy',
      private: false,
      token: process.env.GH_TOKEN || undefined
    });
    log('[AUTO-UPDATE] Feed URL configurado para GitHub releases');
    log('[AUTO-UPDATE] Repositorio: Valentin-sbox/Bloopy');
  } catch (e) {
    logWarn('[AUTO-UPDATE] Error configurando feed:', e.message);
  }

  // Listeners de autoUpdater
  autoUpdater.on('checking-for-update', () => {
    log('[AUTO-UPDATE] Verificando actualizaciones...');
    log('[AUTO-UPDATE] Versión actual:', app.getVersion());
    log('[AUTO-UPDATE] Repositorio: Valentin-sbox/Bloopy');
    if (mainWindow) {
      mainWindow.webContents.send('update-checking');
    }
  });

  autoUpdater.on('update-available', (info) => {
    log('[AUTO-UPDATE] ¡Actualización disponible!');
    log('[AUTO-UPDATE] Nueva versión:', info.version);
    log('[AUTO-UPDATE] Versión actual:', app.getVersion());
    log('[AUTO-UPDATE] Fecha de lanzamiento:', info.releaseDate);
    log('[AUTO-UPDATE] Archivos:', info.files?.map(f => f.url).join(', '));
    
    // Validación adicional: comparar versiones manualmente para asegurar que es mayor
    const currentVersion = app.getVersion();
    const newVersion = info.version;
    
    if (compareVersions(newVersion, currentVersion) <= 0) {
      logWarn('[AUTO-UPDATE] ADVERTENCIA: La versión remota no es mayor que la actual');
      logWarn('[AUTO-UPDATE] Versión actual:', currentVersion);
      logWarn('[AUTO-UPDATE] Versión remota:', newVersion);
      logWarn('[AUTO-UPDATE] Ignorando actualización inválida');
      return;
    }
    
    log('[AUTO-UPDATE] Validación de versión: OK (remota > actual)');
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
    log('[AUTO-UPDATE] No hay actualizaciones disponibles');
    log('[AUTO-UPDATE] La aplicación está actualizada (v' + app.getVersion() + ')');
    if (mainWindow) {
      mainWindow.webContents.send('update-not-available');
    }
  });

  autoUpdater.on('error', (error) => {
    console.error('[AUTO-UPDATE] Error en auto-updater:', error.message);
    console.error('[AUTO-UPDATE] Detalles del error:', error);
    console.error('[AUTO-UPDATE] Stack trace:', error.stack);
    if (mainWindow) {
      mainWindow.webContents.send('update-error', error.message);
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const percentComplete = Math.round(progressObj.percent);
    const downloadedMB = (progressObj.transferred / 1024 / 1024).toFixed(2);
    const totalMB = (progressObj.total / 1024 / 1024).toFixed(2);
    const speedMBps = (progressObj.bytesPerSecond / 1024 / 1024).toFixed(2);

    log(`[AUTO-UPDATE] Descargando: ${percentComplete}% (${downloadedMB}MB / ${totalMB}MB) - ${speedMBps} MB/s`);

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
    log('[AUTO-UPDATE] ¡Actualización descargada exitosamente!');
    log('[AUTO-UPDATE] Versión descargada:', info.version);
    log('[AUTO-UPDATE] La actualización se aplicará al reiniciar la aplicación');
    updateState.updateDownloaded = true;
    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded');
    }
  });

  log('[AUTO-UPDATE] Sistema de actualizaciones inicializado correctamente');
}

// =============================================================================
// VARIABLES GLOBALES
// =============================================================================

let mainWindow = null;

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
    width: 800,            // Ancho inicial para splash (se ajustará después)
    height: 600,           // Alto inicial para splash (se ajustará después)
    minWidth: 900,         // Ancho mínimo permitido
    minHeight: 600,        // Alto mínimo permitido
    title: 'Bloopy',       // Título de la ventana
    center: true,          // Centrar ventana al inicio
    show: false,           // No mostrar hasta que esté lista (evita parpadeo)

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

  // =============================================================================
  // CONFIGURACIÓN DE SPELLCHECKER NATIVO
  // =============================================================================
  // Configurar spell checker nativo usando el idioma del sistema operativo
  const localeToSpell = (locale) => {
    const fullLocale = (locale || app.getLocale() || 'en-US').replace('_', '-');
    
    // Mapeo extendido de códigos de idioma a formatos de Chromium
    const languageMap = {
      'es': 'es-ES', 'es-ES': 'es-ES', 'es-MX': 'es-ES', 'es-AR': 'es-ES',
      'en': 'en-US', 'en-US': 'en-US', 'en-GB': 'en-GB', 'en-CA': 'en-US', 'en-AU': 'en-AU',
      'fr': 'fr-FR', 'fr-FR': 'fr-FR', 'fr-CA': 'fr-FR',
      'de': 'de-DE', 'de-DE': 'de-DE', 'de-AT': 'de-DE', 'de-CH': 'de-DE',
      'it': 'it-IT', 'it-IT': 'it-IT',
      'pt': 'pt-PT', 'pt-PT': 'pt-PT', 'pt-BR': 'pt-BR',
      'ja': 'ja-JP', 'ja-JP': 'ja-JP', 'jp': 'ja-JP',
      'zh': 'zh-CN', 'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW',
      'ko': 'ko-KR', 'ko-KR': 'ko-KR',
      'ru': 'ru-RU', 'ru-RU': 'ru-RU',
      'nl': 'nl-NL', 'nl-NL': 'nl-NL',
      'pl': 'pl-PL', 'pl-PL': 'pl-PL',
      'sv': 'sv-SE', 'sv-SE': 'sv-SE',
      'da': 'da-DK', 'da-DK': 'da-DK',
      'no': 'nb-NO', 'nb': 'nb-NO', 'nb-NO': 'nb-NO',
      'fi': 'fi-FI', 'fi-FI': 'fi-FI',
      'tr': 'tr-TR', 'tr-TR': 'tr-TR',
      'ar': 'ar', 'he': 'he', 'hi': 'hi-IN'
    };
    
    // Try full locale first (e.g., "en-US"), then language code (e.g., "en")
    if (languageMap[fullLocale]) {
      return languageMap[fullLocale];
    }
    
    const langCode = fullLocale.split('-')[0].toLowerCase();
    return languageMap[langCode] || 'en-US';
  };
  
  // Get system locale and set up spell checker
  const systemLocale = app.getLocale();
  const primaryLanguage = localeToSpell(systemLocale);
  
  const languages = [primaryLanguage];
  if (primaryLanguage !== 'en-US') languages.push('en-US');
  
  try {
    mainWindow.webContents.session.setSpellCheckerLanguages(languages);
    mainWindow.webContents.session.setSpellCheckerEnabled(true);
    log('[SPELLCHECK] Sistema locale:', systemLocale);
    log('[SPELLCHECK] Idioma principal:', primaryLanguage);
    log('[SPELLCHECK] Idiomas configurados:', languages);
  } catch (err) {
    console.error('[SPELLCHECK] Error configurando idiomas:', err.message);
    try {
      // Fallback to just English and Spanish
      mainWindow.webContents.session.setSpellCheckerLanguages(['en-US', 'es-ES']);
      mainWindow.webContents.session.setSpellCheckerEnabled(true);
      log('[SPELLCHECK] Idiomas (fallback): en-US, es-ES');
    } catch (e) {
      logWarn('[SPELLCHECK] No se pudo configurar spell checker:', e.message);
    }
  }

  /**
   * Menú contextual: siempre mostrar nuestro menú custom (con Copiar/Cortar/Pegar y sugerencias si hay misspelling).
   */
  mainWindow.webContents.on('context-menu', (event, params) => {
    const { x, y, misspelledWord, dictionarySuggestions } = params;
    event.preventDefault();
    if (misspelledWord) {
      mainWindow.webContents.send('spell-check-context', {
        word: misspelledWord,
        suggestions: Array.isArray(dictionarySuggestions) ? dictionarySuggestions.slice(0, 8) : [],
        x,
        y
      });
    } else {
      mainWindow.webContents.send('context-menu-edit', { x, y });
    }
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
    log('Modo DESARROLLO - Cargando desde:', process.env.ELECTRON_START_URL);
    mainWindow.loadURL(process.env.ELECTRON_START_URL).catch(err => {
      console.error('Error loading development URL:', err);
    });
  } else {
    // Modo producción: determinar ruta según si está empaquetado
    let indexPath;

    if (app.isPackaged) {
      // Producción empaquetada: index.html está en el mismo directorio que electron.js
      indexPath = path.join(__dirname, 'index.html');
      log('Modo PRODUCCIÓN EMPAQUETADA');
      log('__dirname:', __dirname);
      log('Intentando cargar:', indexPath);
      log('Archivo existe:', fs.existsSync(indexPath));

      if (fs.existsSync(indexPath)) {
        log('✓ Cargando index.html desde:', indexPath);
        // Usar loadURL con file:// protocol para mejor resolución de rutas
        mainWindow.loadURL(`file://${indexPath}`).catch(err => {
          console.error('✗ Error loading file:', err);
          mainWindow.loadURL('data:text/html,<h2>Error al cargar</h2><p>' + err.message + '</p>');
        });
      } else {
        console.error('✗ index.html NO ENCONTRADO en:', indexPath);
        mainWindow.loadURL('data:text/html,<h2>Error: index.html no encontrado</h2><p>Ruta: ' + indexPath + '</p>');
      }
    } else {
      // Desarrollo sin servidor: buscar en build/
      indexPath = path.join(__dirname, '..', 'build', 'index.html');
      log('Modo DESARROLLO SIN SERVIDOR');
      log('__dirname:', __dirname);
      log('Intentando cargar:', indexPath);
      log('Archivo existe:', fs.existsSync(indexPath));

      if (fs.existsSync(indexPath)) {
        log('✓ Cargando index.html desde:', indexPath);
        mainWindow.loadFile(indexPath).catch(err => {
          console.error('✗ Error loading file:', err);
          mainWindow.loadURL('data:text/html,<h2>Error al cargar</h2><p>' + err.message + '</p>');
        });
      } else {
        console.error('✗ index.html NO ENCONTRADO en:', indexPath);
        mainWindow.loadURL('data:text/html,<h2>Error: index.html no encontrado</h2><p>Ruta: ' + indexPath + '</p>');
      }
    }
  }

  // =============================================================================
  // EVENTOS DE LA VENTANA
  // =============================================================================

  // Mostrar ventana cuando el contenido esté listo (evita parpadeo blanco)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // Verificar actualizaciones después de mostrar la ventana (solo notificación, sin auto-descarga)
    setTimeout(() => {
      log('[AUTO-UPDATE] Iniciando verificación silenciosa...');
      checkForUpdatesSilently();
    }, 3000);
  });

  // Manejo de errores al cargar la página
  mainWindow.webContents.on('crashed', () => {
    console.error('ERROR: El renderer de la aplicación se crasheó');
    mainWindow = null;
  });

  mainWindow.webContents.on('unresponsive', () => {
    logWarn('ADVERTENCIA: La aplicación no responde');
  });

  mainWindow.on('unresponsive', () => {
    logWarn('ADVERTENCIA: La ventana no responde');
  });

  // Manejo de errores en la precarga
  mainWindow.webContents.on('preload-error', (event, preloadPath, error) => {
    console.error(`ERROR en preload (${preloadPath}):`, error);
  });

  // Prevenir cierre con cambios sin guardar
  mainWindow.on('close', async (e) => {
    try {
      // Preguntar al renderer si hay archivos sin guardar
      const unsavedFiles = await mainWindow.webContents.executeJavaScript(
        'typeof window.__getUnsavedFiles === "function" ? window.__getUnsavedFiles() : []'
      );

      if (unsavedFiles && unsavedFiles.length > 0) {
        e.preventDefault();

        // Formatear la lista de archivos para mostrar en el diálogo
        const fileList = unsavedFiles.map(name => `• ${name}`).join('\n');

        const { dialog } = require('electron');
        const choice = await dialog.showMessageBox(mainWindow, {
          type: 'question',
          buttons: ['Guardar y cerrar', 'Cerrar sin guardar', 'Cancelar'],
          defaultId: 0,
          cancelId: 2,
          title: 'Cambios sin guardar',
          message: 'Tienes cambios sin guardar',
          detail: `Los siguientes archivos tienen modificaciones sin guardar:\n\n${fileList}\n\n¿Qué deseas hacer?`
        });

        if (choice.response === 0) {
          // Usuario elige "Guardar y cerrar"
          log('[WINDOW] Usuario eligió guardar y cerrar. Notificando al renderer...');

          // Prevenir cierre repetido mientras se procesa
          mainWindow.removeAllListeners('close');

          // Enviar señal al renderer para que guarde, el renderer cerrará la app cuando termine
          mainWindow.webContents.send('save-before-close');
        } else if (choice.response === 1) {
          // Usuario elige "Cerrar sin guardar"
          log('[WINDOW] Usuario eligió cerrar descartando cambios.');
          // Remover el listener para permitir el cierre
          mainWindow.removeAllListeners('close');
          mainWindow.close();
        }
        // Si choice.response === 2 (Cancelar), no hacemos nada y el cierre sigue prevenido
      }
      // Si unsavedFiles.length === 0, no hay cambios sin guardar, el cierre continúa normalmente
    } catch (error) {
      console.error('Error checking unsaved changes:', error);
      // Si hay error, permitir cerrar
    }
  });

  // Limpiar referencia cuando se cierra la ventana
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Emitir eventos de cambio de estado de maximizado
  mainWindow.on('maximize', () => {
    if (mainWindow) {
      mainWindow.webContents.send('window-maximized-change', true);
    }
  });

  mainWindow.on('unmaximize', () => {
    if (mainWindow) {
      mainWindow.webContents.send('window-maximized-change', false);
    }
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

// =============================================================================
// FLAGS CHROMIUM/V8 — Fix 5
// Deben configurarse ANTES de app.whenReady()
// =============================================================================
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=512');
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,MediaSessionService');
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-default-apps');
app.commandLine.appendSwitch('disable-extensions');
app.commandLine.appendSwitch('disable-sync');
app.commandLine.appendSwitch('metrics-recording-only');
app.commandLine.appendSwitch('no-first-run');
app.commandLine.appendSwitch('safebrowsing-disable-auto-update');

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
    log('[AUTO-UPDATE] Iniciando verificación manual...');
    log('[AUTO-UPDATE] Versión actual:', app.getVersion());
    log('[AUTO-UPDATE] Repositorio: Valentin-sbox/Bloopy');

    // Limpiar estado anterior
    updateState.updateAvailable = false;
    updateState.updateInfo = null;

    // Crear Promise con timeout de 15 segundos
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout: verificación tardó más de 15 segundos')), 15000)
    );

    // Competir entre checkForUpdates y timeout
    const result = await Promise.race([
      autoUpdater.checkForUpdates(),
      timeoutPromise
    ]);

    log('[AUTO-UPDATE] Resultado checkForUpdates:', {
      hasResult: !!result,
      hasUpdateInfo: !!result?.updateInfo,
      version: result?.updateInfo?.version,
      currentVersion: app.getVersion(),
      files: result?.updateInfo?.files?.map(f => f.url)
    });

    // Esperar a que listeners procesen (máximo 2 segundos)
    const start = Date.now();
    while (!updateState.updateAvailable && (Date.now() - start) < 2000) {
      await new Promise(r => setTimeout(r, 100));
    }

    log('[AUTO-UPDATE] Estado final:', {
      updateAvailable: updateState.updateAvailable,
      updateInfo: updateState.updateInfo
    });

    // Detectar tipos de versión si hay actualización
    let availableVersions = {};
    if (updateState.updateAvailable && updateState.updateInfo) {
      availableVersions = detectVersionTypes(updateState.updateInfo);
    }

    return {
      success: true,
      hasUpdate: updateState.updateAvailable,
      updateInfo: updateState.updateInfo,
      availableVersions: availableVersions,
      currentVersion: app.getVersion(),
      latestVersion: result?.updateInfo?.version || null
    };
  } catch (error) {
    console.error('[AUTO-UPDATE] Error en check-for-updates:', error);
    console.error('[AUTO-UPDATE] Stack:', error.stack);
    return {
      success: false,
      error: error.message,
      currentVersion: app.getVersion(),
      details: error.toString()
    };
  }
});

/**
 * Función para detectar tipos de versión
 * Parsea el tag de versión para determinar si es stable, snapshot o pre-stable
 */
function detectVersionTypes(updateInfo) {
  const version = updateInfo.version;
  const types = {};
  
  if (version.includes('-beta') || version.includes('-alpha')) {
    types.snapshot = updateInfo;
  } else if (version.includes('-rc')) {
    types['pre-stable'] = updateInfo;
  } else {
    types.stable = updateInfo;
  }
  
  return types;
}

/**
 * IPC Handler: download-update
 * Descarga la actualización disponible
 */
ipcMain.handle('download-update', async () => {
  try {
    if (updateState.updateAvailable && !updateState.updateDownloaded) {
      log('[AUTO-UPDATE] Iniciando descarga...');
      updateState.downloading = true;
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
    console.error('[AUTO-UPDATE] Error en descarga:', error);
    updateState.downloading = false;
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
ipcMain.handle('install-update', async () => {
  try {
    if (!updateState.updateDownloaded) {
      return {
        success: false,
        error: 'No hay actualización descargada'
      };
    }

    log('[AUTO-UPDATE] Instalando actualización...');
    log('[AUTO-UPDATE] Versión actual:', app.getVersion());
    log('[AUTO-UPDATE] Nueva versión:', updateState.updateInfo?.version);

    // Esperar a que pendingOps esté vacío (máximo 3 segundos)
    log('[AUTO-UPDATE] Esperando operaciones pendientes...');
    const start = Date.now();
    while (pendingOps.size > 0 && (Date.now() - start) < 3000) {
      await new Promise(r => setTimeout(r, 100));
    }
    
    if (pendingOps.size > 0) {
      logWarn('[AUTO-UPDATE] Hay operaciones pendientes, instalando de todos modos');
    }

    // Usar setImmediate para asegurar que el IPC response se envíe antes de cerrar
    setImmediate(() => {
      log('[AUTO-UPDATE] Cerrando aplicación e instalando...');
      try {
        autoUpdater.quitAndInstall(false, true);
        // false = no forzar cierre inmediato
        // true = reiniciar después de instalar
      } catch (error) {
        console.error('[AUTO-UPDATE] Error en quitAndInstall:', error);
        // Fallback: cerrar la aplicación manualmente
        app.quit();
      }
    });

    return {
      success: true,
      message: 'Instalación iniciada, la app se cerrará en breve'
    };
  } catch (error) {
    console.error('[AUTO-UPDATE] Error en instalación:', error);
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
 * Cierra la ventana principal
 */

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
 * IPC Handler: resize-window
 * Redimensiona la ventana principal a las dimensiones especificadas
 * @param {number} width - Ancho deseado
 * @param {number} height - Alto deseado
 */
ipcMain.handle('resize-window', (event, width, height) => {
  if (mainWindow) {
    // Validar dimensiones (mínimo 400x300, máximo tamaño de pantalla)
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    
    const validWidth = Math.max(400, Math.min(width, screenWidth));
    const validHeight = Math.max(300, Math.min(height, screenHeight));
    
    mainWindow.setSize(validWidth, validHeight);
    mainWindow.center();
    
    return { width: validWidth, height: validHeight };
  }
  return null;
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

/**
 * IPC Handler: window-open-devtools
 * Abre las herramientas de desarrollo
 */
ipcMain.handle('window-open-devtools', () => {
  if (mainWindow) {
    mainWindow.webContents.openDevTools();
  }
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
 * Lee una carpeta recursivamente y retorna su estructura
 * @param {string} folderPath - Ruta de la carpeta
 * @returns {Promise<object>} - Estructura de la carpeta
 */
async function readFolderRecursive(folderPath) {
  try {
    const folderName = path.basename(folderPath);
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const children = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue; // Skip hidden files

      const entryPath = path.join(folderPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively read subdirectory
        const subFolder = await readFolderRecursive(entryPath);
        if (subFolder) {
          children.push(subFolder);
        }
      } else if (entry.isFile() && (entry.name.endsWith('.txt') || entry.name.endsWith('.canvas'))) {
        // Read file
        try {
          const { metadata: fileMeta, content } = await metadata.parseFile(entryPath);
          children.push({
            path: entryPath,
            metadata: fileMeta,
            content: entry.name.endsWith('.canvas') ? content : undefined,
            name: entry.name.replace(/\.(txt|canvas)$/i, ''),
            type: 'file'
          });
        } catch (error) {
          logWarn(`[WORKSPACE] Error parsing file ${entry.name}:`, error.message);
        }
      }
    }

    return {
      path: folderPath,
      name: folderName,
      type: 'folder',
      metadata: {
        name: folderName,
        type: 'folder',
        projectId: null
      },
      children: children
    };
  } catch (error) {
    console.error(`[WORKSPACE] Error reading folder ${folderPath}:`, error);
    return null;
  }
}

/**
 * IPC Handler: read-workspace
 * Lee todos los proyectos y archivos del workspace.
 * Escanea recursivamente la estructura de carpetas.
 * NUEVO: También escanea archivos .txt en el root del workspace (con projectId=null)
 * y los mezcla con los proyectos en un array unificado.
 * 
 * @param {Event} event - Evento IPC
 * @param {string} workspacePath - Ruta del workspace a leer
 * @returns {Array} Lista unificada de proyectos y archivos root mezclados
 */
ipcMain.handle('read-workspace', async (event, workspacePath) => {
  try {
    log('[WORKSPACE] Leyendo workspace con nuevo sistema de metadatos:', workspacePath);

    // Run projectId migration for all files (lazy migration on workspace load)
    try {
      if (metadata.migrateWorkspaceProjectIds) {
        log('[WORKSPACE] Running projectId migration...');
        const migrationStats = await metadata.migrateWorkspaceProjectIds(workspacePath);
        log('[WORKSPACE] ProjectId migration complete:', migrationStats);
      }
    } catch (migErr) {
      logWarn('[WORKSPACE] Error during projectId migration:', migErr);
    }

    // Leer el directorio del workspace
    const entries = await fs.readdir(workspacePath, { withFileTypes: true });
    const projects = [];
    const rootFilesList = [];

    // First pass: scan all entries
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const projectPath = path.join(workspacePath, entry.name);

        // Verificar si necesita migración y migrar si es necesario
        try {
          if (metadata.needsMigration && await metadata.needsMigration(projectPath)) {
            log(`[WORKSPACE] Migrando proyecto: ${entry.name}`);
            await metadata.migrateProject(projectPath);
          }
        } catch (migErr) {
          logWarn(`[WORKSPACE] Error verificando migración para ${entry.name}:`, migErr);
        }

        // Cargar árbol de archivos usando el nuevo sistema
        let tree = [];
        if (metadata.loadProjectTree) {
          tree = await metadata.loadProjectTree(projectPath);
        } else {
          console.error('[WORKSPACE] No se encontró loadProjectTree en metadata');
        }

        // Convertir al formato legacy para el frontend
        const items = formatTreeForFrontend(tree);

        projects.push({
          name: entry.name,
          path: projectPath,
          items: items,
          open: false
        });
      } else if (entry.isFile() && (entry.name.endsWith('.txt') || entry.name.endsWith('.canvas')) && !entry.name.startsWith('.')) {
        // Collect all root .txt and .canvas files for tree building
        const filePath = path.join(workspacePath, entry.name);

        try {
          const { metadata: fileMeta, content } = await metadata.parseFile(filePath);

          // Only include files with projectId=null (root files)
          if (fileMeta.projectId === undefined || fileMeta.projectId === null) {
            rootFilesList.push({ 
              path: filePath, 
              metadata: fileMeta,
              content: entry.name.endsWith('.canvas') ? content : undefined // Include content for .canvas files
            });
          }
        } catch (error) {
          logWarn(`[WORKSPACE] Error parsing root file ${entry.name}:`, error.message);
        }
      }
    }

    log('[WORKSPACE] Proyectos cargados:', projects.length);
    log('[WORKSPACE] Archivos root encontrados:', rootFilesList.length);

    // Build tree from root files (handles padre/hijo/nieto/bisnieto hierarchy)
    let rootFilesTree = [];
    if (rootFilesList.length > 0) {
      rootFilesTree = metadata.buildTree(rootFilesList);
      log('[WORKSPACE] Árbol de archivos root construido, nodos raíz:', rootFilesTree.length);
    }

    // Convert root files tree to frontend format
    const formattedRootFiles = formatTreeForFrontend(rootFilesTree);

    // Merge root files with projects into unified array
    // Root files first, then projects (maintains clean sidebar without sections)
    const unifiedList = [...formattedRootFiles, ...projects];

    log('[WORKSPACE] Lista unificada total:', unifiedList.length);
    return unifiedList;
  } catch (error) {
    console.error('[WORKSPACE] Error reading workspace:', error);
    throw error;
  }
});

// -----------------------------------------------------------------------------
// SECCIÓN: OPERACIONES CON ARCHIVOS
// -----------------------------------------------------------------------------
// (Funciones de escaneo de directorio y lectura con metadatos eliminadas
//  al migrar al nuevo sistema de metadatos en src/main)
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
 * Crea un nuevo archivo .txt en un proyecto o como sub-archivo.
 * 
 * NUEVO SISTEMA: Los sub-archivos se guardan en metadata del padre, no en carpetas .d
 * 
 * @param {Event} event - Evento IPC
 * @param {string} projectPath - Ruta del proyecto o archivo padre
 * @param {string} fileName - Nombre del archivo (se añade .txt si no lo tiene)
 * @param {string} parentPath - (Opcional) Ruta del archivo padre si es sub-archivo
 * @returns {string} Ruta o ID del archivo creado
 */
/**
 * IPC Handler: read-file
 * Lee el contenido de un archivo usando el nuevo sistema.
 * Si el archivo no tiene metadata YAML, la inyecta automáticamente.
 */
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    log('[READ-FILE] Reading file:', filePath);

    // Read raw file content to check for YAML frontmatter
    const rawContent = await fs.readFile(filePath, 'utf-8');
    const hasYamlFrontmatter = rawContent.startsWith('---');

    // Parse file (will generate default metadata if missing)
    const { metadata: fileMetadata, content } = await metadata.parseFile(filePath);

    // If file doesn't have YAML frontmatter, inject it
    if (!hasYamlFrontmatter) {
      log('[READ-FILE] File missing YAML frontmatter, injecting default metadata');

      // Generate default metadata with filename
      const fileName = path.basename(filePath, '.txt');
      const defaultMetadata = {
        ...fileMetadata,
        name: fileName,
        status: 'draft',
        goal: 30000
      };

      log('[READ-FILE] Injecting metadata:', JSON.stringify(defaultMetadata, null, 2));

      // Write metadata back to file
      await metadataWriter.writeFile(filePath, defaultMetadata, content);

      log('[READ-FILE] Metadata injected successfully');

      // Notify frontend that workspace changed
      if (mainWindow) {
        mainWindow.webContents.send('workspace-changed');
      }
    }

    return content;
  } catch (error) {
    console.error('[READ-FILE] Error reading file:', error);
    throw error;
  }
});

/**
 * IPC Handler: save-file
 * Guarda el archivo usando el nuevo sistema de metadatos.
 */
ipcMain.handle('save-file', async (event, filePath, content, legacyMetadata = {}) => {
  try {
    log('[SAVE-FILE] Guardando archivo:', filePath);
    log('[SAVE-FILE] Tamaño del contenido:', content ? content.length : 0);
    log('[SAVE-FILE] Metadata recibida:', JSON.stringify(legacyMetadata, null, 2));

    const projectPath = path.dirname(filePath);

    // Detectar si es archivo .canvas
    const isCanvas = filePath.toLowerCase().endsWith('.canvas');

    // Leer metadata existente
    let existingMetadata = {};
    try {
      const parsed = await metadata.parseFile(filePath);
      existingMetadata = parsed.metadata || {};
      log('[SAVE-FILE] Metadata existente:', JSON.stringify(existingMetadata, null, 2));
    } catch (e) {
      log('[SAVE-FILE] No hay metadata existente o error al leer:', e.message);
    }

    // Validar JSON si es archivo .canvas
    if (isCanvas) {
      try {
        JSON.parse(content);
        log('[SAVE-FILE] JSON válido para archivo .canvas');
      } catch (parseError) {
        console.error('[SAVE-FILE] JSON inválido en archivo .canvas:', parseError);
        throw new Error(`Invalid JSON in canvas file: ${parseError.message}`);
      }
    }

    // Calcular conteo de caracteres (solo para archivos .txt)
    let charCount = 0;
    if (!isCanvas) {
      const textContent = content.replace(/<[^>]*>/g, '');
      charCount = textContent.length;
    }

    // CRITICAL: Preservar el nombre original de la metadata, NO usar el nombre del archivo físico
    const updatedMetadata = {
      ...existingMetadata,
      // NO sobrescribir name - preservar el nombre original de la metadata
      lastCharCount: charCount,
      updatedAt: new Date().toISOString(),
      status: legacyMetadata.status || existingMetadata.status || 'draft',
      goal: legacyMetadata.goal || existingMetadata.goal || 30000,
      initialCharCount: legacyMetadata.initialCharCount || existingMetadata.initialCharCount || 0,
      comments: legacyMetadata.comments || existingMetadata.comments || [],
      customIcon: legacyMetadata.customIcon !== undefined ? legacyMetadata.customIcon : existingMetadata.customIcon || null
    };

    log('[SAVE-FILE] Metadata actualizada:', JSON.stringify(updatedMetadata, null, 2));
    log('[SAVE-FILE] Escribiendo archivo...');

    await metadata.writeFile(filePath, updatedMetadata, content);

    log('[SAVE-FILE] Archivo escrito exitosamente');
    log('[SAVE-FILE] Reconstruyendo índice del proyecto...');

    await metadata.rebuildProjectIndex(projectPath);

    log('[SAVE-FILE] Índice reconstruido');

    if (mainWindow) {
      mainWindow.webContents.send('file-saved', filePath);
      mainWindow.webContents.send('workspace-changed');
    }

    log('[SAVE-FILE] Guardado completado exitosamente');
    return updatedMetadata;  // Retornar metadata actualizada
  } catch (error) {
    console.error('[SAVE-FILE] Error al guardar archivo:', error);
    console.error('[SAVE-FILE] Stack:', error.stack);
    throw error;
  }
});

/**
 * IPC Handler: create-file
 */
ipcMain.handle('create-file', async (event, projectPath, fileName, parentPath = null) => {
  const op = beginOp();
  try {
    log('[CREATE-FILE] Creating:', fileName, 'in', projectPath);

    // Get workspace path to determine projectId
    const workspacePath = store.get('workspacePath', null);

    let parentId = null;
    if (parentPath) {
      try {
        const { metadata: parentMeta } = await metadata.parseFile(parentPath);
        parentId = parentMeta.id;
      } catch (e) {
        logWarn('[CREATE-FILE] Failed to parse parent metadata:', e);
      }
    } else if (projectPath && projectPath.endsWith('.txt')) {
      // Legacy fallback: if projectPath is a file, treat it as parent
      try {
        const { metadata: parentMeta } = await metadata.parseFile(projectPath);
        parentId = parentMeta.id;
        projectPath = path.dirname(projectPath);
      } catch (e) {
        logWarn('[CREATE-FILE] Failed to parse project/parent metadata:', e);
      }
    }

    const file = await metadata.createFile(projectPath, fileName, parentId, '', workspacePath);
    if (mainWindow) mainWindow.webContents.send('workspace-changed');
    return file.path;
  } catch (error) {
    console.error('[CREATE-FILE] Error:', error);
    throw error;
  } finally {
    endOp(op);
  }
});

/**
 * IPC Handler: create-folder
 */
ipcMain.handle('create-folder', async (event, projectPath, folderName) => {
  const op = beginOp();
  try {
    // New system uses simple folders
    const targetDir = projectPath;
    await fs.ensureDir(targetDir);
    const folderPath = path.join(targetDir, folderName);
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
 */
ipcMain.handle('move-file', async (event, sourcePath, destPath) => {
  const op = beginOp();
  try {
    log(`[MOVE-FILE] Starting: ${sourcePath} -> ${destPath}`);
    const workspacePath = store.get('workspacePath', null);

    // Parse source file to get its metadata
    const { metadata: fileMeta } = await metadata.parseFile(sourcePath);
    log(`[MOVE-FILE] Source ID: ${fileMeta.id}, Current parent: ${fileMeta.parentId}`);

    let newParentId = null;
    if (destPath && destPath.endsWith('.txt')) {
      try {
        const { metadata: parentMeta } = await metadata.parseFile(destPath);
        newParentId = parentMeta.id;
        log(`[MOVE-FILE] Resolved target parent ID: ${newParentId} from ${destPath}`);
      } catch (e) {
        logWarn(`[MOVE-FILE] Could not resolve parent ID from ${destPath}, defaulting to null`);
      }
    }

    const sourceProjectPath = path.dirname(sourcePath);
    // IMPORTANTE: metadata.moveFile ahora maneja el movimiento físico
    await metadata.moveFile(sourceProjectPath, fileMeta.id, newParentId, destPath, workspacePath);

    log(`[MOVE-FILE] Success: ${fileMeta.id} moved to parent ${newParentId}`);
    if (mainWindow) mainWindow.webContents.send('workspace-changed');
    return sourcePath;
  } catch (error) {
    console.error(`[MOVE-FILE] FAILED: ${error.message}`);
    throw error;
  } finally {
    endOp(op);
  }
});





/**
 * IPC Handler: rename-file
 */
ipcMain.handle('rename-file', async (event, oldPath, newName) => {
  const op = beginOp();
  try {
    log('[RENAME-FILE] Renombrando:', oldPath, '->', newName);
    const projectPath = path.dirname(oldPath);

    // Parsear metadata del archivo
    const { metadata: fileMeta } = await metadata.parseFile(oldPath);
    log('[RENAME-FILE] ID del archivo:', fileMeta.id);
    log('[RENAME-FILE] Nombre anterior:', fileMeta.name);
    log('[RENAME-FILE] Nombre nuevo:', newName);

    // Rename using new system (renombra archivo físico)
    const newPath = await metadata.renameFile(projectPath, fileMeta.id, newName);

    log('[RENAME-FILE] Archivo renombrado exitosamente');
    log('[RENAME-FILE] Nueva ruta:', newPath);

    if (mainWindow) mainWindow.webContents.send('workspace-changed');

    // Retornar la nueva ruta
    return newPath;
  } catch (error) {
    console.error('[RENAME-FILE] Error:', error);
    throw error;
  } finally {
    endOp(op);
  }
});

/**
 * IPC Handler: rename-folder
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
 */
ipcMain.handle('delete-item', async (event, itemPath, isDirectory) => {
  const op = beginOp();
  try {
    log('[DELETE-ITEM]', itemPath);
    if (isDirectory) {
      await fs.remove(itemPath);
    } else {
      const projectPath = path.dirname(itemPath);
      const { metadata: fileMeta } = await metadata.parseFile(itemPath);
      await metadata.deleteFile(projectPath, fileMeta.id);
    }
    if (mainWindow) mainWindow.webContents.send('workspace-changed');
    return true;
  } catch (error) {
    console.error('[DELETE-ITEM] Error:', error);
    throw error;
  } finally {
    endOp(op);
  }
});

/**
 * IPC Handler: reorder-siblings
 */
ipcMain.handle('reorder-siblings', async (event, projectPath, reorderData) => {
  const op = beginOp();
  try {
    await metadata.reorderFiles(projectPath, reorderData);
    if (mainWindow) mainWindow.webContents.send('workspace-changed');
    return true;
  } catch (error) {
    console.error('[REORDER-SIBLINGS] Error:', error);
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
ipcMain.handle('get-config', () => {
  log('[GET-CONFIG] Obteniendo configuración...');
  log('[GET-CONFIG] Ruta del archivo:', store.storePath);

  const config = store.get('config', {
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

  log('[GET-CONFIG] Configuración obtenida:', config ? 'OK' : 'NULL');
  log('[GET-CONFIG] Tema actual:', config.theme);

  return config;
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
  log('[SAVE-CONFIG] Guardando configuración:', JSON.stringify(config, null, 2));
  log('[SAVE-CONFIG] Ruta del archivo:', store.storePath);

  try {
    store.set('config', config);
    log('[SAVE-CONFIG] Configuración guardada exitosamente');

    // Verificar que se guardó correctamente
    const saved = store.get('config');
    log('[SAVE-CONFIG] Verificación - Configuración leída:', saved ? 'OK' : 'NULL');

    return true;
  } catch (error) {
    console.error('[SAVE-CONFIG] Error al guardar:', error);
    throw error;
  }
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
  log('[SAVE-AVATAR] Guardando avatar...');
  log('[SAVE-AVATAR] Tamaño de datos:', avatarData ? avatarData.length : 0);

  try {
    store.set('avatar', avatarData);
    log('[SAVE-AVATAR] Avatar guardado exitosamente');
    return true;
  } catch (error) {
    console.error('[SAVE-AVATAR] Error al guardar:', error);
    throw error;
  }
});

/**
 * IPC Handler: get-avatar
 * Obtiene la imagen del avatar guardada.
 * 
 * @returns {string|null} Imagen en base64 o null si no existe
 */
ipcMain.handle('get-avatar', () => {
  log('[GET-AVATAR] Obteniendo avatar...');
  const avatar = store.get('avatar', null);
  log('[GET-AVATAR] Avatar obtenido:', avatar ? 'OK' : 'NULL');
  return avatar;
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
 * IPC Handler: show-item-in-folder
 * Muestra un archivo o carpeta en el explorador del sistema.
 * 
 * @param {Event} event - Evento IPC
 * @param {string} fullPath - Ruta completa del archivo o carpeta
 */
ipcMain.handle('show-item-in-folder', (event, fullPath) => {
  shell.showItemInFolder(fullPath);
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

/**
 * IPC Handler: edit-action
 * Ejecuta acciones nativas de edición sobre el elemento enfocado (incluye HTML/rich content).
 *
 * Acciones soportadas: copy, cut, paste, selectAll, undo, redo
 */
ipcMain.handle('edit-action', (event, action) => {
  try {
    const wc = mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents : null;
    if (!wc) return false;

    switch (action) {
      case 'copy':
        wc.copy();
        return true;
      case 'cut':
        wc.cut();
        return true;
      case 'paste':
        wc.paste();
        return true;
      case 'selectAll':
        wc.selectAll();
        return true;
      case 'undo':
        wc.undo();
        return true;
      case 'redo':
        wc.redo();
        return true;
      default:
        return false;
    }
  } catch (err) {
    logWarn('[EDIT-ACTION] Error:', err?.message || err);
    return false;
  }
});

/**
 * Reemplaza la palabra mal escrita bajo el cursor por la sugerencia (corrector nativo).
 */
ipcMain.handle('replace-misspelling', (event, suggestion) => {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.replaceMisspelling(suggestion);
  }
});

ipcMain.handle('add-word-to-spell-dictionary', (event, word) => {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && word) {
    mainWindow.webContents.session.addWordToSpellCheckerDictionary(word);
  }
});

// =============================================================================
// SECCIÓN: ZOOM DE VENTANA
// =============================================================================

ipcMain.handle('set-zoom-level', (event, level) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.setZoomLevel(level);
  }
});

ipcMain.handle('get-zoom-level', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow.webContents.getZoomLevel();
  }
  return 0;
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
    title: 'Exportar datos de Blopy',
    defaultPath: `Bloopy_backup_${new Date().toISOString().split('T')[0]}.json`,
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
    title: 'Importar datos de Bloopy',
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
// SECCIÓN: VERIFICACIÓN DE RUTAS Y DIRECTORIOS
// -----------------------------------------------------------------------------

/**
 * IPC Handler: path-exists
 * Verifica si una ruta (archivo o carpeta) existe en el sistema de archivos.
 * 
 * @param {Event} event - Evento IPC
 * @param {string} targetPath - Ruta a verificar
 * @returns {boolean} true si la ruta existe, false en caso contrario
 */
ipcMain.handle('path-exists', async (event, targetPath) => {
  try {
    return await fs.pathExists(targetPath);
  } catch (error) {
    console.error('Error checking path existence:', error);
    return false;
  }
});

/**
 * IPC Handler: read-directory
 * Lee el contenido de un directorio y retorna la lista de archivos y carpetas.
 * 
 * @param {Event} event - Evento IPC
 * @param {string} dirPath - Ruta del directorio a leer
 * @returns {Array<string>} Lista de nombres de archivos y carpetas
 */
ipcMain.handle('read-directory', async (event, dirPath) => {
  try {
    const entries = await fs.readdir(dirPath);
    return entries;
  } catch (error) {
    console.error('Error reading directory:', error);
    return [];
  }
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
  const welcomeContent = `# ¡Bienvenido a Bloopy!

Bloopy es tu espacio de escritura protegido, diseñado para ayudarte a organizar tus proyectos de escritura de manera eficiente y segura.

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

Bloopy integra herramientas externas de corrección:
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

Este es un archivo de ejemplo para que veas cómo funciona Bloopy.

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


// (Patch de metadatos eliminado - integrado en electron.js)
