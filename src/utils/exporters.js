/**
 * ============================================================================
 * EXPORTERS.JS
 * ============================================================================
 * 
 * MÓDULO DE EXPORTACIÓN DE DOCUMENTOS
 * 
 * Este archivo contiene funciones para convertir el contenido HTML del editor
 * a diferentes formatos (Markdown, HTML autocontenido, texto plano) y
 * descargar los archivos resultantes.
 * 
 * FUNCIONES PRINCIPALES:
 * 1. htmlToMarkdown() - Convierte HTML a sintaxis Markdown
 * 2. htmlToPlainText() - Extrae texto sin formato
 * 3. htmlToStandaloneHTML() - Genera HTML autocontenido con estilos inline
 * 4. exportAsMarkdown() - Wrapper para exportar como .md
 * 5. exportAsHTML() - Wrapper para exportar como .html
 * 6. exportAsPlainText() - Wrapper para exportar como .txt
 * 
 * RELACIONADO CON:
 * - src/components/TopBar.js: usa las funciones de exportación
 * - src/utils/helpers.js: usa downloadFile
 * 
 * VALIDACIONES:
 * - Requirements 4.2, 4.3, 4.4, 4.5, 4.6
 * ============================================================================
 */

import { downloadFile } from './helpers.js';

// =============================================================================
// SECCIÓN 0: FUNCIONES AUXILIARES DE VALIDACIÓN Y NOTIFICACIÓN
// =============================================================================

/**
 * Valida y sanitiza el nombre de archivo para exportación.
 * Si el nombre está vacío o es inválido, usa "documento-sin-titulo".
 * 
 * @param {string} fileName - Nombre de archivo a validar
 * @returns {string} Nombre de archivo válido
 */
function validateFileName(fileName) {
  // Si el nombre está vacío, undefined, null, o solo espacios en blanco
  if (!fileName || typeof fileName !== 'string' || fileName.trim().length === 0) {
    console.warn('Empty or invalid filename provided, using default: documento-sin-titulo');
    return 'documento-sin-titulo';
  }

  // Eliminar espacios al inicio y final
  const trimmed = fileName.trim();

  // Si después de trim está vacío
  if (trimmed.length === 0) {
    console.warn('Filename is empty after trimming, using default: documento-sin-titulo');
    return 'documento-sin-titulo';
  }

  // Sanitizar caracteres inválidos para nombres de archivo
  // Reemplazar caracteres no permitidos con guiones
  const sanitized = trimmed.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-');

  return sanitized;
}

/**
 * Muestra una notificación de error al usuario.
 * Crea un elemento temporal en el DOM para mostrar el mensaje.
 * 
 * @param {string} message - Mensaje de error a mostrar
 */
function showErrorNotification(message) {
  // Crear elemento de notificación
  const notification = document.createElement('div');
  notification.className = 'export-error-notification';
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: #f44336;
    color: white;
    padding: 16px 24px;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    max-width: 400px;
    animation: slideIn 0.3s ease-out;
  `;

  // Agregar animación
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);

  // Agregar al DOM
  document.body.appendChild(notification);

  // Remover después de 5 segundos
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => {
      if (notification.parentNode && notification.parentNode.contains(notification)) {
        notification.parentNode.removeChild(notification);
      }
      if (style.parentNode && style.parentNode.contains(style)) {
        style.parentNode.removeChild(style);
      }
    }, 300);
  }, 5000);
}

// =============================================================================
// SECCIÓN 1: CONVERSIÓN HTML A MARKDOWN
// =============================================================================

/**
 * Convierte HTML del editor a formato Markdown válido.
 * 
 * CONVERSIONES SOPORTADAS:
 * - <h1> → # Título
 * - <h2> → ## Título
 * - <h3> → ### Título
 * - <strong> o <b> → **texto**
 * - <em> o <i> → *texto*
 * - <ul><li> → - item
 * - <ol><li> → 1. item
 * - <blockquote> → > texto
 * - <a> → [texto](url)
 * - <code> → `código`
 * - <pre> → ```código```
 * - <hr> → ---
 * 
 * @param {string} html - Contenido HTML del editor
 * @returns {string} Contenido en formato Markdown
 */
export function htmlToMarkdown(html) {
  if (!html) return '';

  // Crear un elemento temporal para parsear el HTML
  const temp = document.createElement('div');
  temp.innerHTML = html;

  let markdown = '';

  // Procesar cada nodo hijo del contenedor
  const processNode = (node) => {
    // Si es un nodo de texto, devolver el texto
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }

    // Si no es un elemento, ignorar
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const tagName = node.tagName.toLowerCase();
    let result = '';

    // Procesar según el tipo de elemento
    switch (tagName) {
      case 'h1':
        result = '# ' + getTextContent(node) + '\n\n';
        break;

      case 'h2':
        result = '## ' + getTextContent(node) + '\n\n';
        break;

      case 'h3':
        result = '### ' + getTextContent(node) + '\n\n';
        break;

      case 'p':
        result = processInlineNodes(node) + '\n\n';
        break;

      case 'strong':
      case 'b':
        result = '**' + getTextContent(node) + '**';
        break;

      case 'em':
      case 'i':
        result = '*' + getTextContent(node) + '*';
        break;

      case 'code':
        // Si el padre es <pre>, no procesar aquí (se maneja en 'pre')
        if (node.parentElement && node.parentElement.tagName.toLowerCase() === 'pre') {
          return '';
        }
        result = '`' + getTextContent(node) + '`';
        break;

      case 'pre':
        const codeContent = node.querySelector('code')
          ? node.querySelector('code').textContent
          : node.textContent;
        result = '```\n' + codeContent + '\n```\n\n';
        break;

      case 'blockquote':
        const lines = getTextContent(node).split('\n');
        result = lines.map(line => '> ' + line).join('\n') + '\n\n';
        break;

      case 'ul':
        Array.from(node.children).forEach(li => {
          if (li.tagName.toLowerCase() === 'li') {
            result += '- ' + processInlineNodes(li) + '\n';
          }
        });
        result += '\n';
        break;

      case 'ol':
        Array.from(node.children).forEach((li, index) => {
          if (li.tagName.toLowerCase() === 'li') {
            result += (index + 1) + '. ' + processInlineNodes(li) + '\n';
          }
        });
        result += '\n';
        break;

      case 'a':
        const href = node.getAttribute('href') || '';
        const text = getTextContent(node);
        result = '[' + text + '](' + href + ')';
        break;

      case 'hr':
        result = '---\n\n';
        break;

      case 'br':
        result = '\n';
        break;

      default:
        // Para otros elementos, procesar sus hijos
        result = processInlineNodes(node);
        break;
    }

    return result;
  };

  // Procesar nodos inline (negrita, cursiva, enlaces, etc.)
  const processInlineNodes = (node) => {
    let result = '';

    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        result += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tagName = child.tagName.toLowerCase();

        switch (tagName) {
          case 'strong':
          case 'b':
            result += '**' + getTextContent(child) + '**';
            break;

          case 'em':
          case 'i':
            result += '*' + getTextContent(child) + '*';
            break;

          case 'code':
            result += '`' + getTextContent(child) + '`';
            break;

          case 'a':
            const href = child.getAttribute('href') || '';
            const text = getTextContent(child);
            result += '[' + text + '](' + href + ')';
            break;

          case 'br':
            result += '\n';
            break;

          default:
            result += processInlineNodes(child);
            break;
        }
      }
    });

    return result;
  };

  // Obtener texto de un nodo (recursivo)
  const getTextContent = (node) => {
    return node.textContent || '';
  };

  // Procesar todos los nodos hijos
  Array.from(temp.childNodes).forEach(node => {
    markdown += processNode(node);
  });

  // Limpiar múltiples líneas en blanco consecutivas
  markdown = markdown.replace(/\n{3,}/g, '\n\n');

  // Eliminar espacios en blanco al final
  markdown = markdown.trim();

  return markdown;
}

// =============================================================================
// SECCIÓN 2: CONVERSIÓN HTML A TEXTO PLANO
// =============================================================================

/**
 * Extrae texto plano del HTML del editor, eliminando todo el formato.
 * 
 * USO: Exportar contenido sin formato para copiar/pegar en editores simples.
 * 
 * @param {string} html - Contenido HTML del editor
 * @returns {string} Texto plano sin formato
 */
export function htmlToPlainText(html) {
  if (!html) return '';

  // Crear elemento temporal
  const temp = document.createElement('div');
  temp.innerHTML = html;

  let text = '';

  // Procesar nodos recursivamente preservando estructura
  const processNode = (node, depth = 0) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const tagName = node.tagName.toLowerCase();
    let result = '';

    switch (tagName) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        // Títulos con línea en blanco después
        result = getTextContent(node) + '\n\n';
        break;

      case 'p':
        // Párrafos con línea en blanco después
        result = getTextContent(node) + '\n\n';
        break;

      case 'br':
        // Salto de línea simple
        result = '\n';
        break;

      case 'hr':
        // Separador horizontal
        result = '\n---\n\n';
        break;

      case 'blockquote':
        // Citas con indentación
        const quoteLines = getTextContent(node).split('\n');
        result = quoteLines.map(line => '  ' + line).join('\n') + '\n\n';
        break;

      case 'ul':
      case 'ol':
        // Listas
        Array.from(node.children).forEach((li, index) => {
          if (li.tagName.toLowerCase() === 'li') {
            const bullet = tagName === 'ul' ? '• ' : `${index + 1}. `;
            result += bullet + getTextContent(li) + '\n';
          }
        });
        result += '\n';
        break;

      case 'pre':
      case 'code':
        // Código preservando espacios exactos
        result = node.textContent + '\n\n';
        break;

      default:
        // Para otros elementos, procesar hijos
        Array.from(node.childNodes).forEach(child => {
          result += processNode(child, depth + 1);
        });
        break;
    }

    return result;
  };

  const getTextContent = (node) => {
    let text = '';
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        if (child.tagName.toLowerCase() === 'br') {
          text += '\n';
        } else {
          text += getTextContent(child);
        }
      }
    });
    return text;
  };

  // Procesar todos los nodos
  Array.from(temp.childNodes).forEach(node => {
    text += processNode(node);
  });

  // Normalizar múltiples líneas en blanco (máximo 2 consecutivas)
  text = text.replace(/\n{3,}/g, '\n\n');

  // Eliminar espacios al final de cada línea
  text = text.split('\n').map(line => line.trimEnd()).join('\n');

  return text.trim();
}

// =============================================================================
// SECCIÓN 3: CONVERSIÓN HTML A HTML AUTOCONTENIDO
// =============================================================================

/**
 * Genera un archivo HTML completo y autocontenido con estilos inline.
 * 
 * El HTML generado incluye:
 * - Estructura HTML5 completa
 * - Estilos CSS inline para que se vea correctamente sin hojas de estilo externas
 * - Fuentes web (Google Fonts)
 * - Estilos para todos los elementos del editor
 * 
 * @param {string} html - Contenido HTML del editor
 * @param {string} fileName - Nombre del archivo (para el título)
 * @returns {string} HTML completo autocontenido
 */
export function htmlToStandaloneHTML(html, fileName = 'Documento') {
  if (!html) html = '';

  // Estilos CSS inline para el documento
  const styles = `
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      color: #1a1a1a;
      background-color: #ffffff;
    }
    
    h1, h2, h3, h4, h5, h6 {
      margin-top: 24px;
      margin-bottom: 16px;
      font-weight: 600;
      line-height: 1.25;
    }
    
    h1 {
      font-size: 2em;
      border-bottom: 1px solid #e1e4e8;
      padding-bottom: 8px;
    }
    
    h2 {
      font-size: 1.5em;
      border-bottom: 1px solid #e1e4e8;
      padding-bottom: 8px;
    }
    
    h3 {
      font-size: 1.25em;
    }
    
    p {
      margin-top: 0;
      margin-bottom: 16px;
    }
    
    strong, b {
      font-weight: 600;
    }
    
    em, i {
      font-style: italic;
    }
    
    code {
      background-color: #f6f8fa;
      border-radius: 3px;
      padding: 2px 6px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.9em;
    }
    
    pre {
      background-color: #f6f8fa;
      border-radius: 6px;
      padding: 16px;
      overflow: auto;
      margin-bottom: 16px;
    }
    
    pre code {
      background-color: transparent;
      padding: 0;
    }
    
    blockquote {
      border-left: 4px solid #dfe2e5;
      padding-left: 16px;
      margin-left: 0;
      margin-right: 0;
      color: #6a737d;
    }
    
    ul, ol {
      padding-left: 32px;
      margin-bottom: 16px;
    }
    
    li {
      margin-bottom: 4px;
    }
    
    a {
      color: #0366d6;
      text-decoration: none;
    }
    
    a:hover {
      text-decoration: underline;
    }
    
    hr {
      border: none;
      border-top: 1px solid #e1e4e8;
      margin: 24px 0;
    }
  `;

  // Construir el HTML completo
  const standaloneHTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fileName}</title>
  <style>${styles}</style>
</head>
<body>
${html}
</body>
</html>`;

  return standaloneHTML;
}

// =============================================================================
// SECCIÓN 4: FUNCIONES WRAPPER DE EXPORTACIÓN
// =============================================================================

/**
 * Exporta el contenido del editor como archivo Markdown (.md).
 * 
 * @param {string} editorHTML - Contenido HTML del editor
 * @param {string} fileName - Nombre base del archivo (sin extensión)
 */
export function exportAsMarkdown(editorHTML, fileName = 'documento') {
  try {
    // Validar nombre de archivo
    const validFileName = validateFileName(fileName);

    const markdown = htmlToMarkdown(editorHTML);
    downloadFile(markdown, `${validFileName}.md`, 'text/markdown');
  } catch (error) {
    console.error('Error exporting as Markdown:', error);
    console.warn('Falling back to plain text export due to error');

    // Fallback: exportar como texto plano
    try {
      const validFileName = validateFileName(fileName);
      const text = htmlToPlainText(editorHTML);
      downloadFile(text, `${validFileName}.txt`, 'text/plain');
      showErrorNotification('No se pudo exportar como Markdown. Se exportó como texto plano.');
    } catch (fallbackError) {
      console.error('Error in fallback export:', fallbackError);
      showErrorNotification('Error al exportar el documento. Por favor, intenta de nuevo.');
    }
  }
}

/**
 * Exporta el contenido del editor como archivo HTML autocontenido (.html).
 * 
 * @param {string} editorHTML - Contenido HTML del editor
 * @param {string} fileName - Nombre base del archivo (sin extensión)
 */
export function exportAsHTML(editorHTML, fileName = 'documento') {
  try {
    // Validar nombre de archivo
    const validFileName = validateFileName(fileName);

    const html = htmlToStandaloneHTML(editorHTML, validFileName);
    downloadFile(html, `${validFileName}.html`, 'text/html');
  } catch (error) {
    console.error('Error exporting as HTML:', error);
    console.warn('Falling back to plain text export due to error');

    // Fallback: exportar como texto plano
    try {
      const validFileName = validateFileName(fileName);
      const text = htmlToPlainText(editorHTML);
      downloadFile(text, `${validFileName}.txt`, 'text/plain');
      showErrorNotification('No se pudo exportar como HTML. Se exportó como texto plano.');
    } catch (fallbackError) {
      console.error('Error in fallback export:', fallbackError);
      showErrorNotification('Error al exportar el documento. Por favor, intenta de nuevo.');
    }
  }
}

/**
 * Exporta el contenido del editor como archivo de texto plano (.txt).
 * 
 * @param {string} editorHTML - Contenido HTML del editor
 * @param {string} fileName - Nombre base del archivo (sin extensión)
 */
export function exportAsPlainText(editorHTML, fileName = 'documento') {
  try {
    // Validar nombre de archivo
    const validFileName = validateFileName(fileName);

    const text = htmlToPlainText(editorHTML);
    downloadFile(text, `${validFileName}.txt`, 'text/plain');
  } catch (error) {
    console.error('Error exporting as plain text:', error);
    console.warn('Attempting to export raw HTML as fallback');

    // Si falla, intentar al menos descargar el HTML crudo
    try {
      const validFileName = validateFileName(fileName);
      downloadFile(editorHTML, `${validFileName}.txt`, 'text/plain');
      showErrorNotification('No se pudo procesar el texto. Se exportó el contenido sin procesar.');
    } catch (fallbackError) {
      console.error('Error in fallback export:', fallbackError);
      showErrorNotification('Error al exportar el documento. Por favor, intenta de nuevo.');
    }
  }
}
