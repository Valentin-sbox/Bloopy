/**
 * ============================================================================
 * ICON LIBRARY
 * ============================================================================
 * 
 * BIBLIOTECA DE ICONOS PERSONALIZABLES PARA ARCHIVOS
 * 
 * Este archivo define todos los iconos disponibles para asignar a archivos
 * en el sistema de iconos personalizados. Los iconos están organizados por
 * categorías para facilitar la navegación en el selector de iconos.
 * 
 * CATEGORÍAS:
 * - writing: Iconos relacionados con escritura y documentos
 * - project: Iconos relacionados con proyectos y organización
 * - general: Iconos de uso general
 * - symbols: Símbolos y marcadores especiales
 * 
 * FORMATO DE ICONOS:
 * Todos los iconos usan rutas de Material Design Icons (mdi*).
 * 
 * RELACIONADO CON:
 * - src/components/IconSelector.js: Usa esta biblioteca para mostrar iconos
 * - src/components/LexicalEditor.js: Usa iconos para mostrar en metadata
 * - src/components/Sidebar.js: Muestra iconos personalizados en archivos
 * - src/components/TabBar.js: Muestra iconos en tabs
 * ============================================================================
 */

import * as mdi from '@mdi/js';

/**
 * Biblioteca de iconos organizados por categoría.
 * 
 * ESTRUCTURA:
 * {
 *   categoryId: {
 *     label: string,        // Nombre de la categoría para mostrar
 *     icons: Array<{
 *       id: string,         // Identificador único del icono
 *       icon: string,       // Ruta de MDI (ej: mdiBook)
 *       label: string       // Nombre descriptivo del icono
 *     }>
 *   }
 * }
 */
export const ICON_LIBRARY = {
  writing: {
    label: 'Escritura',
    icons: [
      { id: 'book', icon: mdi.mdiBook, label: 'Libro' },
      { id: 'book-open', icon: mdi.mdiBookOpen, label: 'Libro Abierto' },
      { id: 'pen', icon: mdi.mdiPen, label: 'Pluma' },
      { id: 'pen-fancy', icon: mdi.mdiPenPlus, label: 'Pluma Elegante' },
      { id: 'feather', icon: mdi.mdiFeather, label: 'Pluma de Ave' },
      { id: 'pencil', icon: mdi.mdiPencil, label: 'Lápiz' },
      { id: 'edit', icon: mdi.mdiFileEdit, label: 'Editar' },
      { id: 'file-alt', icon: mdi.mdiFileDocument, label: 'Documento' },
      { id: 'file-word', icon: mdi.mdiFileWord, label: 'Documento Word' },
      { id: 'scroll', icon: mdi.mdiScriptText, label: 'Pergamino' },
      { id: 'newspaper', icon: mdi.mdiNewspaper, label: 'Periódico' },
      { id: 'quote-left', icon: mdi.mdiFormatQuoteOpen, label: 'Cita' },
      { id: 'paragraph', icon: mdi.mdiFormatParagraph, label: 'Párrafo' },
      { id: 'heading', icon: mdi.mdiFormatHeaderPound, label: 'Título' },
      { id: 'font', icon: mdi.mdiFormatSize, label: 'Fuente' },
      { id: 'text-height', icon: mdi.mdiFormatLineHeight, label: 'Altura de Texto' },
      { id: 'align-left', icon: mdi.mdiFormatAlignLeft, label: 'Alinear Izquierda' },
    ]
  },
  
  project: {
    label: 'Proyecto',
    icons: [
      { id: 'folder', icon: mdi.mdiFolder, label: 'Carpeta' },
      { id: 'folder-open', icon: mdi.mdiFolderOpen, label: 'Carpeta Abierta' },
      { id: 'project-diagram', icon: mdi.mdiProjectorScreen, label: 'Proyecto' },
      { id: 'sitemap', icon: mdi.mdiSitemap, label: 'Estructura' },
      { id: 'tasks', icon: mdi.mdiFormatListChecks, label: 'Tareas' },
      { id: 'list', icon: mdi.mdiFormatListBulleted, label: 'Lista' },
      { id: 'list-ul', icon: mdi.mdiFormatListBulleted, label: 'Lista con Viñetas' },
      { id: 'list-ol', icon: mdi.mdiFormatListNumbered, label: 'Lista Numerada' },
      { id: 'check-square', icon: mdi.mdiCheckboxMarked, label: 'Casilla Marcada' },
      { id: 'clipboard-list', icon: mdi.mdiClipboardList, label: 'Lista de Portapapeles' },
      { id: 'calendar', icon: mdi.mdiCalendar, label: 'Calendario' },
      { id: 'calendar-alt', icon: mdi.mdiCalendarMonth, label: 'Calendario Alternativo' },
      { id: 'clock', icon: mdi.mdiClock, label: 'Reloj' },
      { id: 'hourglass', icon: mdi.mdiTimer, label: 'Reloj de Arena' },
      { id: 'chart-line', icon: mdi.mdiChartLine, label: 'Gráfico de Líneas' },
      { id: 'chart-bar', icon: mdi.mdiChartBar, label: 'Gráfico de Barras' },
      { id: 'chart-pie', icon: mdi.mdiChartPie, label: 'Gráfico Circular' },
      { id: 'briefcase', icon: mdi.mdiBriefcase, label: 'Maletín' },
    ]
  },
  
  general: {
    label: 'General',
    icons: [
      { id: 'star', icon: mdi.mdiStar, label: 'Estrella' },
      { id: 'heart', icon: mdi.mdiHeart, label: 'Corazón' },
      { id: 'flag', icon: mdi.mdiFlag, label: 'Bandera' },
      { id: 'bookmark', icon: mdi.mdiBookmark, label: 'Marcador' },
      { id: 'tag', icon: mdi.mdiTag, label: 'Etiqueta' },
      { id: 'tags', icon: mdi.mdiTagMultiple, label: 'Etiquetas' },
      { id: 'paperclip', icon: mdi.mdiPaperclip, label: 'Clip' },
      { id: 'thumbtack', icon: mdi.mdiPin, label: 'Chincheta' },
      { id: 'lightbulb', icon: mdi.mdiLightbulb, label: 'Bombilla' },
      { id: 'fire', icon: mdi.mdiFire, label: 'Fuego' },
      { id: 'bolt', icon: mdi.mdiFlash, label: 'Rayo' },
      { id: 'magic', icon: mdi.mdiMagicStaff, label: 'Magia' },
      { id: 'gem', icon: mdi.mdiDiamond, label: 'Gema' },
      { id: 'crown', icon: mdi.mdiCrown, label: 'Corona' },
      { id: 'trophy', icon: mdi.mdiTrophy, label: 'Trofeo' },
      { id: 'medal', icon: mdi.mdiMedal, label: 'Medalla' },
      { id: 'gift', icon: mdi.mdiGift, label: 'Regalo' },
      { id: 'bell', icon: mdi.mdiBell, label: 'Campana' },
      { id: 'envelope', icon: mdi.mdiEmail, label: 'Sobre' },
      { id: 'comment', icon: mdi.mdiComment, label: 'Comentario' },
      { id: 'comments', icon: mdi.mdiCommentMultiple, label: 'Comentarios' },
      { id: 'user', icon: mdi.mdiAccount, label: 'Usuario' },
      { id: 'users', icon: mdi.mdiAccountGroup, label: 'Usuarios' },
      { id: 'home', icon: mdi.mdiHome, label: 'Inicio' },
      { id: 'cog', icon: mdi.mdiCog, label: 'Configuración' },
      { id: 'search', icon: mdi.mdiMagnify, label: 'Buscar' },
      { id: 'eye', icon: mdi.mdiEye, label: 'Ojo' },
      { id: 'lock', icon: mdi.mdiLock, label: 'Candado' },
      { id: 'unlock', icon: mdi.mdiLockOpen, label: 'Desbloquear' },
      { id: 'key', icon: mdi.mdiKey, label: 'Llave' },
      { id: 'shield', icon: mdi.mdiShield, label: 'Escudo' },
    ]
  },
  
  symbols: {
    label: 'Símbolos',
    icons: [
      { id: 'circle', icon: mdi.mdiCircle, label: 'Círculo' },
      { id: 'square', icon: mdi.mdiSquare, label: 'Cuadrado' },
      { id: 'check', icon: mdi.mdiCheck, label: 'Marca de Verificación' },
      { id: 'times', icon: mdi.mdiClose, label: 'X' },
      { id: 'plus', icon: mdi.mdiPlus, label: 'Más' },
      { id: 'minus', icon: mdi.mdiMinus, label: 'Menos' },
      { id: 'exclamation', icon: mdi.mdiExclamation, label: 'Exclamación' },
      { id: 'question', icon: mdi.mdiHelpCircle, label: 'Pregunta' },
      { id: 'info', icon: mdi.mdiInformation, label: 'Información' },
      { id: 'ban', icon: mdi.mdiCancel, label: 'Prohibido' },
      { id: 'arrow-right', icon: mdi.mdiArrowRight, label: 'Flecha Derecha' },
      { id: 'arrow-left', icon: mdi.mdiArrowLeft, label: 'Flecha Izquierda' },
      { id: 'arrow-up', icon: mdi.mdiArrowUp, label: 'Flecha Arriba' },
      { id: 'arrow-down', icon: mdi.mdiArrowDown, label: 'Flecha Abajo' },
      { id: 'chevron-right', icon: mdi.mdiChevronRight, label: 'Chevron Derecha' },
      { id: 'chevron-left', icon: mdi.mdiChevronLeft, label: 'Chevron Izquierda' },
      { id: 'chevron-up', icon: mdi.mdiChevronUp, label: 'Chevron Arriba' },
      { id: 'chevron-down', icon: mdi.mdiChevronDown, label: 'Chevron Abajo' },
      { id: 'play', icon: mdi.mdiPlay, label: 'Reproducir' },
      { id: 'pause', icon: mdi.mdiPause, label: 'Pausar' },
      { id: 'stop', icon: mdi.mdiStop, label: 'Detener' },
    ]
  }
};

/**
 * Obtiene un icono por su ID.
 * 
 * @param {string} iconId - ID del icono a buscar
 * @returns {Object|null} Objeto del icono o null si no se encuentra
 */
export function getIconById(iconId) {
  if (!iconId) return null;
  
  for (const category of Object.values(ICON_LIBRARY)) {
    const icon = category.icons.find(i => i.id === iconId);
    if (icon) return icon;
  }
  
  return null;
}

/**
 * Obtiene todas las categorías de iconos.
 * 
 * @returns {Array<string>} Array con los IDs de las categorías
 */
export function getIconCategories() {
  return Object.keys(ICON_LIBRARY);
}

/**
 * Obtiene todos los iconos de una categoría específica.
 * 
 * @param {string} categoryId - ID de la categoría
 * @returns {Array<Object>} Array de iconos de la categoría
 */
export function getIconsByCategory(categoryId) {
  const category = ICON_LIBRARY[categoryId];
  return category ? category.icons : [];
}

/**
 * Icono por defecto para archivos sin icono personalizado.
 */
export const DEFAULT_FILE_ICON = {
  id: 'default',
  icon: mdi.mdiFileDocument, // Cambiado de Outline a sólido (blood/bold)
  label: 'Archivo'
};

/**
 * Icono para archivos de canvas (.canvas)
 */
export const CANVAS_NOTE_ICON = {
  id: 'canvas-note',
  icon: mdi.mdiNote, // Cambiado a un icono de nota real (sólido)
  label: 'Nota Canvas',
  color: '#8B5CF6'
};

/**
 * Obtiene el icono apropiado para un archivo basado en su nombre/extensión
 * @param {string} fileName - Nombre del archivo
 * @param {string} customIconId - ID del icono personalizado (opcional)
 * @returns {Object} Objeto del icono
 */
export function getIconForFile(fileName, customIconId = null) {
  // Si tiene icono personalizado, usarlo
  if (customIconId) {
    const customIcon = getIconById(customIconId);
    if (customIcon) return customIcon;
  }
  
  // Si es archivo .canvas, usar icono de canvas
  if (fileName && fileName.toLowerCase().endsWith('.canvas')) {
    return CANVAS_NOTE_ICON;
  }
  
  // Por defecto, icono de archivo
  return DEFAULT_FILE_ICON;
}
