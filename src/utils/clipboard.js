/**
 * ============================================================================
 * CLIPBOARD.JS
 * ============================================================================
 * 
 * UTILIDADES PARA OPERACIONES DE PORTAPAPELES
 * 
 * Proporciona funciones para copiar, pegar y cortar texto usando la API
 * del navegador con fallback para navegadores antiguos.
 * ============================================================================
 */

/**
 * Copia texto al portapapeles del sistema.
 * 
 * @param {string} text - Texto a copiar
 * @returns {Promise<boolean>} true si tuvo éxito, false si falló
 */
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    // Fallback para navegadores antiguos
    return copyToClipboardFallback(text);
  }
};

/**
 * Lee texto del portapapeles del sistema.
 * 
 * @returns {Promise<string|null>} Texto del portapapeles o null si falló
 */
export const pasteFromClipboard = async () => {
  try {
    const text = await navigator.clipboard.readText();
    return text;
  } catch (err) {
    console.error('Failed to paste:', err);
    return null;
  }
};

/**
 * Corta texto (copia y luego ejecuta callback de eliminación).
 * 
 * @param {string} text - Texto a cortar
 * @param {Function} deleteCallback - Función para eliminar el texto del origen
 * @returns {Promise<boolean>} true si tuvo éxito, false si falló
 */
export const cutToClipboard = async (text, deleteCallback) => {
  const success = await copyToClipboard(text);
  if (success && deleteCallback) {
    deleteCallback();
  }
  return success;
};

/**
 * Fallback para copiar usando document.execCommand (navegadores antiguos).
 * 
 * @param {string} text - Texto a copiar
 * @returns {boolean} true si tuvo éxito, false si falló
 */
const copyToClipboardFallback = (text) => {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  
  try {
    document.execCommand('copy');
    return true;
  } catch (err) {
    console.error('Fallback copy failed:', err);
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
};
