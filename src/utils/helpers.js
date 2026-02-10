/**
 * ============================================================================
 * BLOCK GUARD v4.0.0 - HELPERS.JS
 * ============================================================================
 * 
 * MÓDULO DE UTILIDADES Y FUNCIONES AUXILIARES
 * 
 * Este archivo contiene funciones de utilidad que se usan en toda la aplicación.
 * Todas las funciones son puras (no tienen side effects) y reutilizables.
 * 
 * CATEGORÍAS DE FUNCIONES:
 * 1. Generación de IDs únicos
 * 2. Seguridad (XSS prevention)
 * 3. Manipulación de texto
 * 4. Formateo de datos
 * 5. Utilidades de archivos
 * 6. Debounce/Throttle
 * 
 * RELACIONADO CON:
 * - Todos los componentes que necesitan estas funciones
 * - src/components/Editor.js: usa escapeHtml, generateUUID
 * - src/components/Sidebar.js: usa smartTruncate
 * ============================================================================
 */

// =============================================================================
// SECCIÓN 1: GENERACIÓN DE IDs ÚNICOS
// =============================================================================

/**
 * Genera un UUID (Universally Unique Identifier) para párrafos y comentarios.
 * 
 * FORMATO: 'p-' + string aleatorio + timestamp
 * EJEMPLO: 'p-abc123def-1699123456789'
 * 
 * @returns {string} UUID único
 */
export function generateUUID() {
  // Math.random().toString(36) genera un string base36 aleatorio
  // .substr(2, 9) toma 9 caracteres después del '0.'
  // Date.now().toString(36) añade el timestamp en base36
  return 'p-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
}

// =============================================================================
// SECCIÓN 2: SEGURIDAD (PREVENCIÓN DE XSS)
// =============================================================================

/**
 * Escapa caracteres HTML especiales para prevenir ataques XSS.
 * 
 * CONVIERTE:
 * - <  →  &lt;
 * - >  →  &gt;
 * - &  →  &amp;
 * - "  →  &quot;
 * - '  →  &#039;
 * 
 * USO: Mostrar texto de usuario de forma segura en el DOM.
 * 
 * @param {string} text - Texto a escapar
 * @returns {string} Texto escapado seguro para HTML
 */
export function escapeHtml(text) {
  // Si el texto es falsy (null, undefined, ''), devolver string vacío
  if (!text) return '';
  
  // Crear un div temporal
  const div = document.createElement('div');
  
  // Asignar el texto como textContent (automáticamente escapa HTML)
  div.textContent = text;
  
  // Devolver el HTML escapado
  return div.innerHTML;
}

// =============================================================================
// SECCIÓN 3: MANIPULACIÓN DE TEXTO
// =============================================================================

/**
 * Trunca un texto a una longitud máxima añadiendo "..." al final.
 * 
 * USO: Mostrar nombres largos de archivos o proyectos en el sidebar.
 * 
 * @param {string} text - Texto a truncar
 * @param {number} maxLength - Longitud máxima deseada
 * @returns {string} Texto truncado o original si cabe
 */
export function smartTruncate(text, maxLength) {
  // Si no hay texto, devolver string vacío
  if (!text) return '';
  
  // Si el texto cabe, devolverlo completo
  if (text.length <= maxLength) return text;
  
  // Truncar y añadir "..."
  return text.substring(0, maxLength - 3) + '...';
}

// =============================================================================
// SECCIÓN 4: FORMATEO DE DATOS
// =============================================================================

/**
 * Formatea un tamaño en bytes a una unidad legible (B, KB, MB, GB).
 * 
 * EJEMPLOS:
 * - 512       → '512 B'
 * - 1024      → '1 KB'
 * - 1048576   → '1 MB'
 * 
 * @param {number} bytes - Tamaño en bytes
 * @returns {string} Tamaño formateado con unidad
 */
export function formatFileSize(bytes) {
  // Si es 0, devolver directamente
  if (bytes === 0) return '0 B';
  
  // Unidades disponibles
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  
  // Calcular el índice de la unidad apropiada
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  // Formatear con 2 decimales y la unidad correspondiente
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Formatea un timestamp a fecha legible en español.
 * 
 * EJEMPLO: '6 ene 2025'
 * 
 * @param {number} timestamp - Timestamp en milisegundos
 * @returns {string} Fecha formateada
 */
export function formatDate(timestamp) {
  // Si no hay timestamp, devolver vacío
  if (!timestamp) return '';
  
  // Crear objeto Date
  const date = new Date(timestamp);
  
  // Formatear a español
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// =============================================================================
// SECCIÓN 5: UTILIDADES DE ARCHIVOS
// =============================================================================

/**
 * Valida si un string es un email válido.
 * 
 * @param {string} email - Email a validar
 * @returns {boolean} true si es válido
 */
export function isValidEmail(email) {
  // Regex simple pero efectivo para emails
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Copia texto al portapapeles usando la API moderna.
 * 
 * @param {string} text - Texto a copiar
 * @returns {Promise<boolean>} true si se copió correctamente
 */
export async function copyToClipboard(text) {
  try {
    // Usar la API moderna del portapapeles
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Error copying to clipboard:', err);
    return false;
  }
}

/**
 * Descarga contenido como archivo.
 * 
 * @param {string} content - Contenido del archivo
 * @param {string} filename - Nombre del archivo
 * @param {string} type - MIME type (default: 'text/plain')
 */
export function downloadFile(content, filename, type = 'text/plain') {
  // Crear blob con el contenido
  const blob = new Blob([content], { type });
  
  // Crear URL del blob
  const url = URL.createObjectURL(blob);
  
  // Crear elemento <a> temporal
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  
  // Añadir al DOM, hacer clic y eliminar
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  // Liberar la URL del blob
  URL.revokeObjectURL(url);
}

/**
 * Lee un archivo como texto usando FileReader.
 * 
 * @param {File} file - Objeto File a leer
 * @returns {Promise<string>} Contenido del archivo como texto
 */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    
    reader.readAsText(file);
  });
}

/**
 * Lee un archivo como DataURL (base64).
 * Útil para imágenes.
 * 
 * @param {File} file - Objeto File a leer
 * @returns {Promise<string>} Contenido como DataURL
 */
export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    
    reader.readAsDataURL(file);
  });
}

/**
 * Sanitiza un nombre de archivo eliminando caracteres peligrosos.
 * 
 * @param {string} name - Nombre a sanitizar
 * @returns {string} Nombre seguro para archivos
 */
export function sanitizeFileName(name) {
  // Reemplazar caracteres no permitidos con '_'
  return name.replace(/[^a-zA-Z0-9\-_\.\s]/g, '_').trim();
}

/**
 * Recorre la estructura de proyectos y se asegura que cada item tenga un `id`
 * único y que los hijos contengan `parentId` apuntando al id del padre.
 * Devuelve una nueva copia de los proyectos con los ids añadidos.
 * @param {Array} projects
 * @returns {Array}
 */
export function ensureIdsOnProjects(projects) {
  if (!Array.isArray(projects)) return projects;

  const cloneProjects = JSON.parse(JSON.stringify(projects));

  const assignRec = (items, parentId = null) => {
    if (!Array.isArray(items)) return;
    items.forEach(item => {
      if (!item.id) item.id = generateUUID();
      if (parentId) item.parentId = parentId;
      if (item.type === 'folder' && Array.isArray(item.items)) {
        assignRec(item.items, item.id);
      }
    });
  };

  cloneProjects.forEach(proj => {
    if (!proj.id) proj.id = generateUUID();
    if (Array.isArray(proj.items)) assignRec(proj.items, proj.id);
  });

  return cloneProjects;
}

/**
 * Actualiza recursivamente los fullPath en la estructura de proyectos
 * reemplazando el prefijo `oldPath` por `newPath` en todos los items cuyo
 * fullPath comienza con `oldPath`.
 * Devuelve una nueva copia de los proyectos modificada.
 * @param {Array} projects
 * @param {string} oldPath
 * @param {string} newPath
 */
export function updateProjectPaths(projects, oldPath, newPath) {
  if (!projects || !oldPath) return projects;
  const cloned = JSON.parse(JSON.stringify(projects));

  const replaceIfStarts = (str) => {
    if (!str) return str;
    if (str === oldPath) return newPath;
    if (str.startsWith(oldPath + '/')) return newPath + str.slice(oldPath.length);
    return str;
  };

  const walk = (items) => {
    if (!Array.isArray(items)) return;
    items.forEach(item => {
      if (item.fullPath) item.fullPath = replaceIfStarts(item.fullPath);
      if (item.path) item.path = replaceIfStarts(item.path);
      if (item.type === 'folder' && Array.isArray(item.items)) {
        walk(item.items);
      }
    });
  };

  cloned.forEach(proj => {
    if (proj.path) proj.path = replaceIfStarts(proj.path);
    if (proj.items) walk(proj.items);
  });

  return cloned;
}

/**
 * Calcula el nuevo fullPath sustituyendo el último segmento por newName.
 * Conserva la extensión si `keepExtension` es true.
 */
export function calcRenamedPath(oldFullPath, newName, keepExtension = true) {
  if (!oldFullPath) return oldFullPath;
  const lastSlash = oldFullPath.lastIndexOf('/');
  const dir = lastSlash >= 0 ? oldFullPath.slice(0, lastSlash + 1) : '';
  if (keepExtension && oldFullPath.includes('.') && !newName.includes('.')) {
    const ext = oldFullPath.slice(oldFullPath.lastIndexOf('.'));
    return dir + newName + ext;
  }
  return dir + newName;
}

/**
 * Obtiene la extensión de un nombre de archivo.
 * 
 * @param {string} filename - Nombre del archivo
 * @returns {string} Extensión (sin el punto) o string vacío
 */
export function getFileExtension(filename) {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
}

/**
 * Remueve la extensión de un nombre de archivo.
 * 
 * @param {string} filename - Nombre del archivo
 * @returns {string} Nombre sin extensión
 */
export function removeFileExtension(filename) {
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
}

// =============================================================================
// SECCIÓN 6: DEBOUNCE/THROTTLE
// =============================================================================

/**
 * Crea una función debounced que retrasa la ejecución hasta que
 * dejen de llamarla durante un tiempo especificado.
 * 
 * USO: Auto-guardado, búsquedas, resize handlers.
 * 
 * @param {Function} func - Función a debounce
 * @param {number} wait - Tiempo de espera en milisegundos
 * @returns {Function} Función debounced
 */
export function debounce(func, wait) {
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

/**
 * Crea una función throttled que solo se ejecuta una vez cada X milisegundos.
 * 
 * USO: Scroll handlers, eventos de mouse frecuentes.
 * 
 * @param {Function} func - Función a throttle
 * @param {number} limit - Límite de tiempo en milisegundos
 * @returns {Function} Función throttled
 */
export function throttle(func, limit) {
  let inThrottle;
  
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}
