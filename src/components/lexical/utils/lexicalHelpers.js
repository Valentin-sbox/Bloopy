/**
 * ============================================================================
 * LEXICAL HELPERS
 * ============================================================================
 * 
 * Funciones auxiliares para trabajar con Lexical
 * ============================================================================
 */

import { 
  $getRoot, 
  $getSelection, 
  $isRangeSelection,
  $createParagraphNode,
  $createTextNode
} from 'lexical';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';

/**
 * Convierte el contenido del editor a HTML
 */
export function $exportToHTML(editor) {
  let html = '';
  editor.getEditorState().read(() => {
    html = $generateHtmlFromNodes(editor, null);
  });
  return html;
}

/**
 * Importa HTML al editor
 */
export function $importFromHTML(editor, htmlString) {
  editor.update(() => {
    const parser = new DOMParser();
    const dom = parser.parseFromString(htmlString, 'text/html');
    const nodes = $generateNodesFromDOM(editor, dom);
    
    const root = $getRoot();
    root.clear();
    root.append(...nodes);
  });
}

/**
 * Obtiene el texto plano del editor
 */
export function $getPlainText(editor) {
  let text = '';
  editor.getEditorState().read(() => {
    const root = $getRoot();
    text = root.getTextContent();
  });
  return text;
}

/**
 * Inserta texto en la posición actual del cursor
 */
export function $insertTextAtCursor(editor, text) {
  editor.update(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      selection.insertText(text);
    }
  });
}

/**
 * Reemplaza todo el contenido del editor
 */
export function $replaceContent(editor, htmlString) {
  editor.update(() => {
    const parser = new DOMParser();
    const dom = parser.parseFromString(htmlString, 'text/html');
    const nodes = $generateNodesFromDOM(editor, dom);
    
    const root = $getRoot();
    root.clear();
    root.append(...nodes);
  });
}

/**
 * Limpia todo el formato del texto seleccionado
 */
export function $clearFormatting(editor) {
  editor.update(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const nodes = selection.getNodes();
      nodes.forEach(node => {
        if (node.__type === 'text') {
          node.setFormat(0);
          node.setStyle('');
        }
      });
    }
  });
}

/**
 * Obtiene estadísticas del documento
 */
export function $getDocumentStats(editor) {
  let stats = { chars: 0, words: 0, lines: 0, paragraphs: 0 };
  
  editor.getEditorState().read(() => {
    const root = $getRoot();
    const text = root.getTextContent();
    
    stats.chars = text.length;
    stats.words = text.trim() ? text.trim().split(/\s+/).length : 0;
    stats.lines = text.split('\n').length;
    stats.paragraphs = root.getChildren().length;
  });
  
  return stats;
}

/**
 * Busca texto en el editor
 */
export function $findText(editor, searchTerm, caseSensitive = false) {
  const matches = [];
  
  editor.getEditorState().read(() => {
    const root = $getRoot();
    const text = root.getTextContent();
    const searchText = caseSensitive ? text : text.toLowerCase();
    const term = caseSensitive ? searchTerm : searchTerm.toLowerCase();
    
    let index = 0;
    while ((index = searchText.indexOf(term, index)) !== -1) {
      matches.push({
        index,
        length: term.length,
        text: text.substr(index, term.length)
      });
      index += term.length;
    }
  });
  
  return matches;
}

/**
 * Reemplaza texto en el editor
 */
export function $replaceText(editor, searchTerm, replaceTerm, replaceAll = false) {
  editor.update(() => {
    const root = $getRoot();
    const text = root.getTextContent();
    
    const newText = replaceAll 
      ? text.replaceAll(searchTerm, replaceTerm)
      : text.replace(searchTerm, replaceTerm);
    
    root.clear();
    const paragraph = $createParagraphNode();
    paragraph.append($createTextNode(newText));
    root.append(paragraph);
  });
}

/**
 * Obtiene el nodo actual bajo el cursor
 */
export function $getCurrentNode(editor) {
  let currentNode = null;
  
  editor.getEditorState().read(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      currentNode = selection.anchor.getNode();
    }
  });
  
  return currentNode;
}

/**
 * Verifica si hay texto seleccionado
 */
export function $hasSelection(editor) {
  let hasSelection = false;
  
  editor.getEditorState().read(() => {
    const selection = $getSelection();
    hasSelection = $isRangeSelection(selection) && !selection.isCollapsed();
  });
  
  return hasSelection;
}

/**
 * Obtiene el texto seleccionado
 */
export function $getSelectedText(editor) {
  let selectedText = '';
  
  editor.getEditorState().read(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      selectedText = selection.getTextContent();
    }
  });
  
  return selectedText;
}

/**
 * Aplica un estilo a la selección actual
 */
export function $applyStyle(editor, styleName, styleValue) {
  editor.update(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const nodes = selection.getNodes();
      nodes.forEach(node => {
        if (node.__type === 'text') {
          const currentStyle = node.getStyle() || '';
          const newStyle = `${currentStyle}; ${styleName}: ${styleValue}`;
          node.setStyle(newStyle);
        }
      });
    }
  });
}

/**
 * Exporta el contenido a Markdown
 */
export function $exportToMarkdown(editor) {
  let markdown = '';
  
  editor.getEditorState().read(() => {
    const root = $getRoot();
    const children = root.getChildren();
    
    children.forEach(node => {
      const type = node.getType();
      const text = node.getTextContent();
      
      switch (type) {
        case 'heading':
          const level = node.getTag().replace('h', '');
          markdown += '#'.repeat(parseInt(level)) + ' ' + text + '\n\n';
          break;
        case 'quote':
          markdown += '> ' + text + '\n\n';
          break;
        case 'list':
          // Manejar listas
          markdown += text + '\n\n';
          break;
        default:
          markdown += text + '\n\n';
      }
    });
  });
  
  return markdown.trim();
}

/**
 * Valida si el contenido del editor está vacío
 */
export function $isEmpty(editor) {
  let isEmpty = true;
  
  editor.getEditorState().read(() => {
    const root = $getRoot();
    const text = root.getTextContent().trim();
    isEmpty = text.length === 0;
  });
  
  return isEmpty;
}
