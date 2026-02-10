/**
 * ============================================================================
 * BLOCK GUARD v4.0.0 - PRELOAD.JS
 * ============================================================================
 * 
 * Script de precarga de Electron (Preload Script).
 * 
 * PROPÓSITO:
 * Este archivo se ejecuta en un contexto aislado ANTES de que cargue la
 * aplicación React. Su función es exponer de forma segura APIs de Node.js
 * y Electron al proceso de renderizado.
 * 
 * SEGURIDAD:
 * - contextIsolation: true (configurado en electron.js)
 * - Este script es el ÚNICO puente entre el mundo de Node y el navegador
 * - No se permite acceso directo a require() o process desde React
 * 
 * APIs EXPUESTAS:
 * - Manejo de archivos: leer, escribir, crear, eliminar
 * - Diálogos nativos: seleccionar carpetas, guardar archivos
 * - Configuración: guardar/cargar preferencias del usuario
 * - Utilidades: abrir enlaces externos, portapapeles
 * 
 * RELACIONADO CON:
 * - public/electron.js: Configura este script como preload
 * - src/App.js: Consume estas APIs a través de window.electronAPI
 * ============================================================================
 */

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expone APIs seguras al proceso de renderizado.
 * Todas las funciones están disponibles en window.electronAPI
 */
contextBridge.exposeInMainWorld('electronAPI', {
  
  // ==========================================================================
  // SECCIÓN: CONTROL DE VENTANA (Window Controls)
  // ==========================================================================
  // APIs para controlar la ventana desde el TopBar personalizado
  
  /**
   * Minimiza la ventana principal
   * @returns {Promise<void>}
   */
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  
  /**
   * Maximiza o restaura la ventana principal
   * @returns {Promise<void>}
   */
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  
  /**
   * Cierra la ventana principal (termina la aplicación)
   * @returns {Promise<void>}
   */
  closeWindow: () => ipcRenderer.invoke('window-close'),
  
  /**
   * Verifica si la ventana está actualmente maximizada
   * @returns {Promise<boolean>}
   */
  isWindowMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  
  /**
   * Toggle del título bar (frame) y barra de menú
   * @returns {Promise<boolean>} true si frame está habilitado después del toggle
   */
  toggleTitleBar: () => ipcRenderer.invoke('window-toggle-title-bar'),
  
  // ==========================================================================
  // SECCIÓN: GESTIÓN DEL WORKSPACE (ÁREA DE TRABAJO)
  // ==========================================================================
  // Estas funciones manejan la carpeta principal donde se guardan todos
  // los proyectos y archivos del usuario.
  
  /**
   * Obtiene la ruta del workspace guardada en la configuración.
   * @returns {Promise<string|null>} Ruta del workspace o null si no existe
   */
  getWorkspacePath: () => ipcRenderer.invoke('get-workspace-path'),
  
  /**
   * Guarda la ruta del workspace en la configuración.
   * @param {string} path - Ruta absoluta del workspace
   * @returns {Promise<boolean>} true si se guardó correctamente
   */
  setWorkspacePath: (path) => ipcRenderer.invoke('set-workspace-path', path),
  
  /**
   * Muestra un diálogo para seleccionar una carpeta existente como workspace.
   * @returns {Promise<string|null>} Ruta seleccionada o null si canceló
   */
  selectWorkspace: () => ipcRenderer.invoke('select-workspace'),
  
  /**
   * Crea un nuevo workspace en la ubicación especificada por el usuario.
   * @returns {Promise<string|null>} Ruta del nuevo workspace o null si canceló
   */
  createWorkspace: () => ipcRenderer.invoke('create-workspace'),
  
  /**
   * Lee todos los proyectos y archivos del workspace.
   * @param {string} path - Ruta del workspace a leer
   * @returns {Promise<Array>} Lista de proyectos con sus archivos
   */
  readWorkspace: (path) => ipcRenderer.invoke('read-workspace', path),
  
  // ==========================================================================
  // SECCIÓN: OPERACIONES CON ARCHIVOS
  // ==========================================================================
  // Funciones para crear, leer, actualizar y eliminar archivos y proyectos.
  
  /**
   * Guarda el contenido de un archivo con sus metadatos.
   * @param {string} filePath - Ruta completa del archivo
   * @param {string} content - Contenido HTML del editor
   * @param {Object} metadata - Metadatos (status, goal, comments, etc.)
   * @returns {Promise<boolean>} true si se guardó correctamente
   */
  saveFile: (filePath, content, metadata) => 
    ipcRenderer.invoke('save-file', filePath, content, metadata),
  
  /**
   * Crea un nuevo proyecto (carpeta) en el workspace.
   * @param {string} workspacePath - Ruta del workspace
   * @param {string} projectName - Nombre del nuevo proyecto
   * @returns {Promise<string>} Ruta del proyecto creado
   */
  createProject: (workspacePath, projectName) => 
    ipcRenderer.invoke('create-project', workspacePath, projectName),
  
  /**
   * Crea un nuevo archivo .txt en un proyecto.
   * @param {string} projectPath - Ruta del proyecto
   * @param {string} fileName - Nombre del archivo (sin extensión)
   * @returns {Promise<string>} Ruta del archivo creado
   */
  createFile: (projectPath, fileName) => 
    ipcRenderer.invoke('create-file', projectPath, fileName),
  
  /**
   * Crea una nueva carpeta en un proyecto.
   * @param {string} projectPath - Ruta del proyecto o directorio padre
   * @param {string} folderName - Nombre de la carpeta
   * @returns {Promise<string>} Ruta de la carpeta creada
   */
  createFolder: (projectPath, folderName) => 
    ipcRenderer.invoke('create-folder', projectPath, folderName),
  
  /**
   * Mueve un archivo a una nueva ubicación.
   * @param {string} sourcePath - Ruta actual del archivo
   * @param {string} destPath - Ruta de destino (carpeta)
   * @returns {Promise<string>} Nueva ruta del archivo
   */
  moveFile: (sourcePath, destPath) => 
    ipcRenderer.invoke('move-file', sourcePath, destPath),
  
  /**
   * Renombra un archivo existente.
   * @param {string} oldPath - Ruta actual del archivo
   * @param {string} newName - Nuevo nombre (sin extensión)
   * @returns {Promise<string>} Nueva ruta del archivo
   */
  renameFile: (oldPath, newName) => 
    ipcRenderer.invoke('rename-file', oldPath, newName),
  
  /**
   * Renombra una carpeta existente.
   * @param {string} oldPath - Ruta actual de la carpeta
   * @param {string} newName - Nuevo nombre de la carpeta
   * @returns {Promise<string>} Nueva ruta de la carpeta
   */
  renameFolder: (oldPath, newName) =>
    ipcRenderer.invoke('rename-folder', oldPath, newName),

  /**
   * Renombra un proyecto por índice.
   * @param {number} projectIndex - Índice del proyecto en el workspace
   * @param {string} newName - Nuevo nombre del proyecto
   * @returns {Promise<string>} Nueva ruta del proyecto
   */
  renameProject: (projectIndex, newName) =>
    ipcRenderer.invoke('rename-project', projectIndex, newName),
  
  /**
   * Elimina un archivo o carpeta.
   * @param {string} itemPath - Ruta del elemento a eliminar
   * @param {boolean} isDirectory - true si es carpeta, false si es archivo
   * @returns {Promise<boolean>} true si se eliminó correctamente
   */
  deleteItem: (itemPath, isDirectory) => 
    ipcRenderer.invoke('delete-item', itemPath, isDirectory),
  
  /**
   * Mueve un archivo de una ubicación a otra.
   * @param {string} sourcePath - Ruta del archivo origen
   * @param {string} targetPath - Ruta del archivo destino
   * @param {string} position - Posición ('before', 'after', o 'inside')
   * @returns {Promise<boolean>} true si se movió correctamente
   */
  moveFile: (sourcePath, targetPath, position) => 
    ipcRenderer.invoke('move-file', sourcePath, targetPath, position),
  
  // ==========================================================================
  // SECCIÓN: CONFIGURACIÓN DE LA APLICACIÓN
  // ==========================================================================
  // Guardado y carga de preferencias del usuario.
  
  /**
   * Obtiene la configuración guardada del usuario.
   * @returns {Promise<Object>} Objeto de configuración
   */
  getConfig: () => ipcRenderer.invoke('get-config'),
  
  /**
   * Guarda la configuración del usuario.
   * @param {Object} config - Objeto de configuración completo
   * @returns {Promise<boolean>} true si se guardó correctamente
   */
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  
  // ==========================================================================
  // SECCIÓN: GESTIÓN DEL AVATAR
  // ==========================================================================
  
  /**
   * Guarda la imagen del avatar del usuario.
   * @param {string} avatarData - Imagen en formato base64/dataURL
   * @returns {Promise<boolean>} true si se guardó correctamente
   */
  saveAvatar: (avatarData) => ipcRenderer.invoke('save-avatar', avatarData),
  
  /**
   * Obtiene la imagen del avatar guardada.
   * @returns {Promise<string|null>} Imagen en base64 o null
   */
  getAvatar: () => ipcRenderer.invoke('get-avatar'),
  
  // ==========================================================================
  // SECCIÓN: UTILIDADES DEL SISTEMA
  // ==========================================================================
  
  /**
   * Abre una URL en el navegador predeterminado del sistema.
   * @param {string} url - URL a abrir
   * @returns {Promise<void>}
   */
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  /**
   * Copia texto al portapapeles del sistema.
   * @param {string} text - Texto a copiar
   * @returns {Promise<boolean>} true si se copió correctamente
   */
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
  
  // ==========================================================================
  // SECCIÓN: IMPORTAR/EXPORTAR DATOS
  // ==========================================================================
  
  /**
   * Exporta todos los datos de la aplicación a un archivo JSON.
   * @param {Object} data - Datos a exportar
   * @returns {Promise<boolean>} true si se exportó correctamente
   */
  exportData: (data) => ipcRenderer.invoke('export-data', data),
  
  /**
   * Importa datos desde un archivo JSON.
   * @returns {Promise<Object|null>} Datos importados o null si canceló
   */
  importData: () => ipcRenderer.invoke('import-data'),
  
  // ==========================================================================
  // SECCIÓN: AUTO-ACTUALIZACIÓN
  // ==========================================================================
  
  /**
   * Verifica si hay actualizaciones disponibles
   * @returns {Promise<Object>} { success: boolean, hasUpdate: boolean, updateInfo: Object|null }
   */
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  
  /**
   * Descarga la actualización disponible
   * @returns {Promise<Object>} { success: boolean, message: string, error?: string }
   */
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  
  /**
   * Instala la actualización descargada y reinicia la aplicación
   * @returns {Promise<Object>} { success: boolean, message: string, error?: string }
   */
  installUpdate: () => ipcRenderer.invoke('install-update'),
  
  /**
   * Obtiene el estado actual de la actualización
   * @returns {Promise<Object>} { updateAvailable, updateDownloaded, currentProgress, updateInfo }
   */
  getUpdateState: () => ipcRenderer.invoke('get-update-state'),
  
  /**
   * Espera a que no haya operaciones pendientes en el main process
   * @param {number} timeoutMs - Timeout máximo en milisegundos
   * @returns {Promise<boolean>} true si se completaron todas las ops, false si timeout
   */
  waitPendingOps: (timeoutMs = 3000) => ipcRenderer.invoke('wait-pending-ops', timeoutMs),
  
  /**
   * Obtiene la versión de la aplicación
   * @returns {Promise<string>} Versión de la app (ej: "1.26.0")
   */
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  /**
   * Escucha evento: verificando actualizaciones
   */
  onUpdateChecking: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('update-checking', handler);
    return () => ipcRenderer.removeListener('update-checking', handler);
  },
  
  /**
   * Escucha evento: actualización disponible
   */
  onUpdateAvailable: (callback) => {
    const handler = (event, info) => callback(info);
    ipcRenderer.on('update-available', handler);
    return () => ipcRenderer.removeListener('update-available', handler);
  },
  
  /**
   * Escucha evento: sin actualizaciones disponibles
   */
  onUpdateNotAvailable: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('update-not-available', handler);
    return () => ipcRenderer.removeListener('update-not-available', handler);
  },
  
  /**
   * Escucha evento: error en actualización
   */
  onUpdateError: (callback) => {
    const handler = (event, error) => callback(error);
    ipcRenderer.on('update-error', handler);
    return () => ipcRenderer.removeListener('update-error', handler);
  },
  
  /**
   * Escucha evento: progreso en descarga
   */
  onUpdateDownloadProgress: (callback) => {
    const handler = (event, progress) => callback(progress);
    ipcRenderer.on('update-download-progress', handler);
    return () => ipcRenderer.removeListener('update-download-progress', handler);
  },
  
  /**
   * Escucha evento: actualización descargada
   */
  onUpdateDownloaded: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('update-downloaded', handler);
    return () => ipcRenderer.removeListener('update-downloaded', handler);
  },

  // ==========================================================================
  // SECCIÓN: EVENTOS (Para futuras expansiones)
  // ==========================================================================
  
  /**
   * Escucha eventos del proceso principal.
   * @param {string} channel - Nombre del canal de eventos
   * @param {Function} callback - Función a ejecutar cuando ocurra el evento
   * @returns {Function} Función para cancelar la suscripción
   */
  on: (channel, callback) => {
    const validChannels = ['workspace-changed', 'file-saved', 'theme-changed'];
    if (validChannels.includes(channel)) {
      const handler = (event, ...args) => callback(...args);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    }
    return () => {}; // No-op si el canal no es válido
  }
});
