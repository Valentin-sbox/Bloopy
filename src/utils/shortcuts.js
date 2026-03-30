/**
 * ============================================================================
 * - SHORTCUTS.JS
 * ============================================================================
 * 
 * UTILIDAD: SISTEMA CENTRALIZADO DE ATAJOS
 * 
 * Gestión centralizada de atajos de teclado con:
 * - Definición de atajos predeterminados
 * - Validación y sincronización
 * - Generación automática de títulos en UI
 * - Registro dinámico de callbacks
 * 
 * VENTAJAS:
 * - DRY: Un único lugar para definir atajos
 * - Coherencia: Mismos atajos en todos lados
 * - Sincronización: Al cambiar un atajo, se refleja automáticamente
 * - Tipo-seguro: Validación de IDs de atajos
 * 
 * USO:
 * import { SHORTCUTS, getShortcutDisplay, registerShortcutCallback } from '@/utils/shortcuts';
 * 
 * // Usar en componentes
 * <button title={`Guardar (${SHORTCUTS.save.keys})`}>
 *   <Icon path={mdiContentSave} size={0.7} />
 * </button>
 * 
 * // Registrar callback
 * registerShortcutCallback('save', () => { saveFile(); });
 * 
 * ============================================================================
 */

import * as mdi from '@mdi/js';
const { 
  mdiContentSave, 
  mdiFilePlus, 
  mdiFolderPlus, 
  mdiClose, 
  mdiFormatBold, 
  mdiFormatItalic, 
  mdiFormatUnderline, 
  mdiFormatStrikethrough, 
  mdiFormatHeaderPound, 
  mdiCheckboxMarked, 
  mdiUndo, 
  mdiRedo, 
  mdiContentCopy, 
  mdiContentCut, 
  mdiContentPaste, 
  mdiComment, 
  mdiSpellcheck, 
  mdiChartLine, 
  mdiCog, 
  mdiMenu, 
  mdiFolderOpen, 
  mdiMinus, 
  mdiWindowMaximize, 
  mdiWindowClose,
  mdiWindowRestore,
  mdiPencil,
  mdiSwapHorizontal,
  mdiTrashCan,
  mdiSync,
  mdiMagnify
} = mdi;

/**
 * DEFINICIÓN DE ATAJOS PREDETERMINADOS
 * Formato: { id: { label, icon, keys, description, category } }
 */
export const SHORTCUTS_DEFAULTS = {
  // Archivo
  save: {
    id: 'save',
    label: 'Guardar',
    icon: mdiContentSave,
    keys: 'Ctrl+S',
    description: 'Guardar archivo actual',
    category: 'file'
  },
  newFile: {
    id: 'newFile',
    label: 'Nuevo Archivo',
    icon: mdiFilePlus,
    keys: 'Ctrl+N',
    description: 'Crear nuevo archivo',
    category: 'file'
  },
  newProject: {
    id: 'newProject',
    label: 'Nuevo Proyecto',
    icon: mdiFolderPlus,
    keys: 'Ctrl+Shift+N',
    description: 'Crear nuevo proyecto',
    category: 'file'
  },
  closeFile: {
    id: 'closeFile',
    label: 'Cerrar Archivo',
    icon: mdiClose,
    keys: 'Escape',
    description: 'Cerrar archivo actual',
    category: 'file'
  },

  // Editor - Formato
  bold: {
    id: 'bold',
    label: 'Negrita',
    icon: mdiFormatBold,
    keys: 'Ctrl+B',
    description: 'Aplicar negrita al texto',
    category: 'format'
  },
  italic: {
    id: 'italic',
    label: 'Cursiva',
    icon: mdiFormatItalic,
    keys: 'Ctrl+I',
    description: 'Aplicar cursiva al texto',
    category: 'format'
  },
  underline: {
    id: 'underline',
    label: 'Subrayado',
    icon: mdiFormatUnderline,
    keys: 'Ctrl+U',
    description: 'Aplicar subrayado al texto',
    category: 'format'
  },
  strikethrough: {
    id: 'strikethrough',
    label: 'Tachado',
    icon: mdiFormatStrikethrough,
    keys: 'Ctrl+Shift+X',
    description: 'Aplicar tachado al texto',
    category: 'format'
  },

  // Editor - Navegación
  heading1: {
    id: 'heading1',
    label: 'Título 1',
    icon: mdiFormatHeaderPound,
    keys: 'Ctrl+Alt+1',
    description: 'Convertir a Título 1',
    category: 'format'
  },
  heading2: {
    id: 'heading2',
    label: 'Título 2',
    icon: mdiFormatHeaderPound,
    keys: 'Ctrl+Alt+2',
    description: 'Convertir a Título 2',
    category: 'format'
  },
  heading3: {
    id: 'heading3',
    label: 'Título 3',
    icon: mdiFormatHeaderPound,
    keys: 'Ctrl+Alt+3',
    description: 'Convertir a Título 3',
    category: 'format'
  },

  // Editor - Acciones
  selectAll: {
    id: 'selectAll',
    label: 'Seleccionar Todo',
    icon: mdiCheckboxMarked,
    keys: 'Ctrl+A',
    description: 'Seleccionar todo el texto',
    category: 'edit'
  },
  undo: {
    id: 'undo',
    label: 'Deshacer',
    icon: mdiUndo,
    keys: 'Ctrl+Z',
    description: 'Deshacer último cambio',
    category: 'edit'
  },
  redo: {
    id: 'redo',
    label: 'Rehacer',
    icon: mdiRedo,
    keys: 'Ctrl+Shift+Z',
    description: 'Rehacer cambio deshecho',
    category: 'edit'
  },
  copy: {
    id: 'copy',
    label: 'Copiar',
    icon: mdiContentCopy,
    keys: 'Ctrl+C',
    description: 'Copiar texto seleccionado',
    category: 'edit'
  },
  cut: {
    id: 'cut',
    label: 'Cortar',
    icon: mdiContentCut,
    keys: 'Ctrl+X',
    description: 'Cortar texto seleccionado',
    category: 'edit'
  },
  paste: {
    id: 'paste',
    label: 'Pegar',
    icon: mdiContentPaste,
    keys: 'Ctrl+V',
    description: 'Pegar desde clipboard',
    category: 'edit'
  },

  // Herramientas
  comment: {
    id: 'comment',
    label: 'Comentar',
    icon: mdiComment,
    keys: 'Ctrl+Shift+C',
    description: 'Añadir comentario',
    category: 'tools'
  },
  spellCheck: {
    id: 'spellCheck',
    label: 'Corrector',
    icon: mdiSpellcheck,
    keys: 'Ctrl+K',
    description: 'Abrir corrector ortográfico',
    category: 'tools'
  },
  analytics: {
    id: 'analytics',
    label: 'Análisis',
    icon: mdiChartLine,
    keys: 'Ctrl+Shift+A',
    description: 'Análisis de texto',
    category: 'tools'
  },
  settings: {
    id: 'settings',
    label: 'Configuración',
    icon: mdiCog,
    keys: 'Ctrl+,',
    description: 'Abrir configuración',
    category: 'view'
  },
  toggleSidebar: {
    id: 'toggleSidebar',
    label: 'Toggle Sidebar',
    icon: mdiMenu,
    keys: 'Ctrl+M',
    description: 'Mostrar/Ocultar sidebar',
    category: 'view'
  },
  viewProject: {
    id: 'viewProject',
    label: 'Ver Proyecto',
    icon: mdiFolderOpen,
    keys: 'Ctrl+Shift+P',
    description: 'Ver estructura del proyecto',
    category: 'view'
  },

  // Ventana - Controls
  minimizeWindow: {
    id: 'minimizeWindow',
    label: 'Minimizar Ventana',
    icon: mdiMinus,
    keys: 'Alt+F9',
    description: 'Minimizar ventana',
    category: 'window'
  },
  maximizeWindow: {
    id: 'maximizeWindow',
    label: 'Maximizar Ventana',
    icon: mdiWindowMaximize,
    keys: 'Alt+F10',
    description: 'Maximizar/Restaurar ventana',
    category: 'window'
  },
  closeWindow: {
    id: 'closeWindow',
    label: 'Cerrar Ventana',
    icon: mdiWindowClose,
    keys: 'Alt+F4',
    description: 'Cerrar aplicación',
    category: 'window'
  },
  toggleTitleBar: {
    id: 'toggleTitleBar',
    label: 'Toggle Barra de Título',
    icon: mdiWindowRestore,
    keys: 'Ctrl+Alt+T',
    description: 'Mostrar/Ocultar barra de título del sistema',
    category: 'window'
  },

  // Editor - Búsqueda
  find: {
    id: 'find',
    label: 'Buscar',
    icon: mdiMagnify,
    keys: 'Ctrl+F',
    description: 'Abrir panel de búsqueda',
    category: 'editor'
  },
  findAndReplace: {
    id: 'findAndReplace',
    label: 'Buscar y Reemplazar',
    icon: mdiSwapHorizontal,
    keys: 'Ctrl+H',
    description: 'Abrir panel de búsqueda y reemplazo',
    category: 'editor'
  },

  // Archivo - Operaciones
  deleteProject: {
    id: 'deleteProject',
    label: 'Eliminar Proyecto',
    icon: mdiTrashCan,
    keys: 'Ctrl+Shift+Delete',
    description: 'Eliminar proyecto actual',
    category: 'file'
  },
  renameItem: {
    id: 'renameItem',
    label: 'Renombrar',
    icon: mdiPencil,
    keys: 'F2',
    description: 'Renombrar archivo o carpeta',
    category: 'file'
  },
  refreshSidebar: {
    id: 'refreshSidebar',
    label: 'Actualizar',
    icon: mdiSync,
    keys: 'Ctrl+R',
    description: 'Actualizar lista de archivos',
    category: 'file'
  }
};

/**
 * Almacenamiento en memoria de callbacks de atajos
 */
let shortcutCallbacks = {};

/**
 * Almacenamiento de configuración personalizada de atajos
 */
let customShortcuts = {};

/**
 * Observadores registrados para cambios de atajos
 */
let shortcutObservers = [];

/**
 * Obtiene todos los atajos (combinación de defaults y custom)
 * @returns {Object} Atajos combinados
 */
export function getAllShortcuts() {
  return Object.entries(SHORTCUTS_DEFAULTS).reduce((acc, [key, shortcut]) => {
    acc[key] = {
      ...shortcut,
      keys: customShortcuts[key]?.keys || shortcut.keys
    };
    return acc;
  }, {});
}

/**
 * Obtiene la definición completa de un atajo específico
 * @param {string} shortcutId - ID del atajo (ej: 'save')
 * @returns {Object|null} Definición del atajo o null
 */
export function getShortcut(shortcutId) {
  if (!SHORTCUTS_DEFAULTS[shortcutId]) return null;
  
  const keysOverride = customShortcuts[shortcutId]?.keys;
  return {
    ...SHORTCUTS_DEFAULTS[shortcutId],
    keys: keysOverride || SHORTCUTS_DEFAULTS[shortcutId].keys
  };
}

/**
 * Obtiene la cadena de teclas para mostrar en la UI
 * @param {string} shortcutId - ID del atajo
 * @returns {string} Cadena formateada (ej: "Ctrl+S")
 */
export function getShortcutDisplay(shortcutId) {
  const shortcut = getShortcut(shortcutId);
  return shortcut ? shortcut.keys : '';
}

/**
 * Obtiene la información de título para un botón
 * @param {string} shortcutId - ID del atajo
 * @returns {string} Título formateado (ej: "Guardar (Ctrl+S)")
 */
export function getShortcutTitle(shortcutId) {
  const shortcut = getShortcut(shortcutId);
  if (!shortcut) return '';
  
  return `${shortcut.label} (${shortcut.keys})`;
}

/**
 * Registra un callback para ser ejecutado cuando se presiona un atajo
 * @param {string} shortcutId - ID del atajo
 * @param {Function} callback - Función a ejecutar
 * @returns {Function} Función para cancelar el registro
 */
export function registerShortcutCallback(shortcutId, callback) {
  if (!SHORTCUTS_DEFAULTS[shortcutId]) {
    console.warn(`Shortcut "${shortcutId}" not defined`);
    return () => {};
  }
  
  shortcutCallbacks[shortcutId] = callback;
  
  // Retornar función para desregistrar
  return () => {
    delete shortcutCallbacks[shortcutId];
  };
}

/**
 * Desregistra el callback para un atajo
 * @param {string} shortcutId - ID del atajo
 */
export function unregisterShortcutCallback(shortcutId) {
  if (shortcutCallbacks[shortcutId]) {
    delete shortcutCallbacks[shortcutId];
  }
}

/**
 * Obtiene el callback registrado para un atajo
 * @param {string} shortcutId - ID del atajo
 * @returns {Function|null} Callback o null
 */
export function getShortcutCallback(shortcutId) {
  return shortcutCallbacks[shortcutId] || null;
}

/**
 * Ejecuta el callback registrado para un atajo
 * @param {string} shortcutId - ID del atajo
 * @param {...any} args - Argumentos para el callback
 * @returns {any} Resultado del callback
 */
export function executeShortcut(shortcutId, ...args) {
  const callback = getShortcutCallback(shortcutId);
  if (callback && typeof callback === 'function') {
    return callback(...args);
  }
}

/**
 * Actualiza la configuración de atajos y notifica a observadores
 * @param {Object} newShortcuts - Atajos personalizados { id: { keys } }
 */
export function updateShortcuts(newShortcuts = {}) {
  customShortcuts = newShortcuts;
  
  // Guardar en localStorage
  try {
    localStorage.setItem('Bloopy_shortcuts', JSON.stringify(customShortcuts));
  } catch (err) {
    console.error('Error saving shortcuts to localStorage:', err);
  }
  
  // Notificar a observadores
  notifyShortcutObservers();
}

/**
 * Carga atajos personalizados desde localStorage
 */
export function loadCustomShortcuts() {
  try {
    const saved = localStorage.getItem('Bloopy_shortcuts');
    if (saved) {
      customShortcuts = JSON.parse(saved);
    }
  } catch (err) {
    console.error('Error loading shortcuts from localStorage:', err);
  }
}

/**
 * Registra un observador que será notificado cuando cambien los atajos
 * @param {Function} observer - Función llamada cuando cambian los atajos
 * @returns {Function} Función para cancelar la suscripción
 */
export function subscribeToShortcutChanges(observer) {
  shortcutObservers.push(observer);
  
  // Retornar función para desuscribirse
  return () => {
    shortcutObservers = shortcutObservers.filter(obs => obs !== observer);
  };
}

/**
 * Notifica a todos los observadores que los atajos cambiaron
 */
function notifyShortcutObservers() {
  shortcutObservers.forEach(observer => {
    try {
      observer(getAllShortcuts());
    } catch (err) {
      console.error('Error in shortcut observer:', err);
    }
  });
}

/**
 * Restaura un atajo a su valor predeterminado
 * @param {string} shortcutId - ID del atajo
 */
export function resetShortcut(shortcutId) {
  if (!SHORTCUTS_DEFAULTS[shortcutId]) return;
  
  delete customShortcuts[shortcutId];
  updateShortcuts(customShortcuts);
}

/**
 * Restaura todos los atajos a valores predeterminados
 */
export function resetAllShortcuts() {
  customShortcuts = {};
  updateShortcuts({});
}

/**
 * Obtiene los atajos predeterminados (sin personalizaciones)
 * @returns {Object} Atajos predeterminados
 */
export function getDefaultShortcuts() {
  return Object.entries(SHORTCUTS_DEFAULTS).reduce((acc, [key, shortcut]) => {
    acc[key] = {
      ...shortcut,
      keys: shortcut.keys // Siempre usar las keys originales
    };
    return acc;
  }, {});
}

/**
 * ATAJOS EXPORTADOS COMO OBJETO PARA COMPATIBILIDAD
 * Permite: import SHORTCUTS from '@/utils/shortcuts'
 */
export const SHORTCUTS = new Proxy(SHORTCUTS_DEFAULTS, {
  get: (target, prop) => {
    const shortcut = target[prop];
    if (!shortcut) return undefined;
    
    // Retornar con keys actualizadas si existen customShortcuts
    return {
      ...shortcut,
      keys: customShortcuts[prop]?.keys || shortcut.keys
    };
  }
});

/**
 * Obtiene todas las categorías de atajos
 * @returns {Array} Lista de categorías únicas
 */
export function getShortcutCategories() {
  return [...new Set(Object.values(SHORTCUTS_DEFAULTS).map(s => s.category))];
}

/**
 * Obtiene atajos agrupados por categoría
 * @returns {Object} { category: [shortcuts] }
 */
export function getShortcutsByCategory() {
  return Object.values(SHORTCUTS_DEFAULTS).reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push({
      ...shortcut,
      keys: customShortcuts[shortcut.id]?.keys || shortcut.keys
    });
    return acc;
  }, {});
}

/**
 * Valida si una combinación de teclas es válida
 * @param {string} keyCombo - Combinación (ej: "Ctrl+S")
 * @returns {boolean} True si es válida
 */
export function isValidKeyCombo(keyCombo) {
  if (!keyCombo || typeof keyCombo !== 'string') return false;
  
  const parts = keyCombo.split('+').map(p => p.trim());
  if (parts.length < 1) return false;
  
  const validModifiers = ['Ctrl', 'Shift', 'Alt', 'Cmd', 'Meta'];
  const modifiersInCombo = parts.slice(0, -1);
  
  // Permitir atajos sin modificadores para teclas especiales
  const key = parts[parts.length - 1];
  const specialKeys = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'Esc', 'Space', 'Enter'];
  
  if (specialKeys.includes(key) && parts.length === 1) {
    return true;
  }
  
  // Validar modificadores
  if (!modifiersInCombo.every(mod => validModifiers.includes(mod))) {
    return false;
  }
  
  return key.length > 0;
}

/**
 * Detecta conflictos entre atajos
 * @param {string} keyCombo - Combinación a verificar
 * @param {string} excludeId - ID de atajo a excluir de la verificación
 * @returns {Array} Lista de atajos que entran en conflicto
 */
export function detectShortcutConflicts(keyCombo, excludeId = null) {
  const allShortcuts = getAllShortcuts();
  
  return Object.values(allShortcuts)
    .filter(s => s.id !== excludeId && s.keys === keyCombo)
    .map(s => s.id);
}

// Cargar atajos personalizados al inicializar el módulo
loadCustomShortcuts();

export default {
  SHORTCUTS_DEFAULTS,
  SHORTCUTS,
  getAllShortcuts,
  getShortcut,
  getShortcutDisplay,
  getShortcutTitle,
  registerShortcutCallback,
  unregisterShortcutCallback,
  getShortcutCallback,
  executeShortcut,
  updateShortcuts,
  loadCustomShortcuts,
  subscribeToShortcutChanges,
  resetShortcut,
  resetAllShortcuts,
  getDefaultShortcuts,
  getShortcutCategories,
  getShortcutsByCategory,
  isValidKeyCombo,
  detectShortcutConflicts
};
