Entendido. Aquí tienes el **PROMPT EXTENSO MASTER** dividido en fases y tareas, con todo lo que necesitas para que el agente de AI implemente todo correctamente:

---

# 🚀 PROMPT MASTER: BLOCK GUARD v5.0.0 - REFACTOR COMPLETO

**Contexto**: Editor de texto enriquecido tipo Notion, offline, Electron. Código base en los archivos proporcionados (`Editor.js`, `FindReplace.js`, `EditorSidebar.js`, `SpellCheckModal.js`).

**Objetivo**: Sistema estable, con nuevos efectos, exportación a Word, y mejoras de UX.

---

## 📋 FASE 1: FIXES CRÍTICOS (Estabilidad Base)

### Tarea 1.1: Fix FindReplace - Navegación y Drag
**Archivo**: `src/components/FindReplace.js`

**Problemas a solucionar**:
- Panel permite arrastrar ventana (webkit-app-region)
- Navegación no scrollea al texto
- No resalta coincidencia activa
- Regex inconsistente con contenido HTML

**Implementación exacta**:

```javascript
// AGREGAR al inicio del componente, después de los estados:
useEffect(() => {
  // Prevenir que el panel sea draggable en Electron
  const panel = document.querySelector('.find-replace-panel');
  if (panel) {
    panel.style.webkitAppRegion = 'no-drag';
  }
}, []);

// REEMPLAZAR navigateToMatch completamente:
const navigateToMatch = (searchTerm, matchIndex = 1, caseSensitive = false) => {
  if (!editorRef || !searchTerm) return;
  const editor = editorRef.current;
  if (!editor) return;

  // Limpiar highlights previos
  editor.querySelectorAll('.find-match-active').forEach(el => {
    const parent = el.parentNode;
    if (parent) {
      parent.insertBefore(document.createTextNode(el.textContent), el);
      parent.removeChild(el);
      parent.normalize();
    }
  });

  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
  const term = caseSensitive ? searchTerm : searchTerm.toLowerCase();
  let node;
  let count = 0;

  while (node = walker.nextNode()) {
    const textContent = node.textContent;
    const text = caseSensitive ? textContent : textContent.toLowerCase();
    let idx = 0;
    
    while ((idx = text.indexOf(term, idx)) !== -1) {
      count++;
      if (count === matchIndex) {
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + searchTerm.length);
        
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        
        // Scroll suave
        const rect = range.getBoundingClientRect();
        const editorRect = editor.getBoundingClientRect();
        if (rect.top < editorRect.top || rect.bottom > editorRect.bottom) {
          const scrollTop = editor.scrollTop + (rect.top - editorRect.top) - 100;
          editor.scrollTo({ top: scrollTop, behavior: 'smooth' });
        }
        
        // Highlight temporal
        try {
          const span = document.createElement('span');
          span.className = 'find-match-active';
          span.style.cssText = 'background:#ffeb3b;color:#000;padding:0 2px;border-radius:2px;';
          range.surroundContents(span);
          
          setTimeout(() => {
            if (span.parentNode) {
              const parent = span.parentNode;
              parent.insertBefore(document.createTextNode(span.textContent), span);
              parent.removeChild(span);
              parent.normalize();
            }
          }, 2000);
        } catch (e) {
          // Si cruza nodos, solo dejar seleccionado
        }
        return;
      }
      idx += term.length;
    }
  }
};

// REEMPLAZAR calculateMatches:
const calculateMatches = () => {
  if (!searchTerm || !editorRef?.current) {
    setMatchCount(0);
    setCurrentMatchIndex(0);
    return;
  }

  const text = editorRef.current.innerText || '';
  const flags = caseSensitive ? 'g' : 'gi';
  try {
    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, flags);
    const matches = text.match(regex);
    const count = matches ? matches.length : 0;
    setMatchCount(count);
    setCurrentMatchIndex(count > 0 ? 1 : 0);
    if (count > 0 && typeof onNavigate === 'function') {
      onNavigate(searchTerm, 1, caseSensitive);
    }
  } catch (error) {
    console.error('Regex error:', error);
    setMatchCount(0);
  }
};
```

**CSS a agregar en `index.css`**:
```css
.find-replace-panel {
  -webkit-app-region: no-drag !important;
  user-select: none;
}

.find-match-active {
  animation: findPulse 2s ease;
}

@keyframes findPulse {
  0%, 100% { background-color: #ffeb3b; }
  50% { background-color: #ff9800; }
}
```

---

### Tarea 1.2: Simplificar Sistema de Comentarios (Por Archivo)
**Archivos**: `src/components/Editor.js`, `src/components/EditorSidebar.js`, `src/components/CommentsModal.js`

**Cambio de arquitectura**: Eliminar completamente comentarios por párrafo. Solo comentarios globales por archivo.

**Pasos**:

1. **En `Editor.js` - ELIMINAR**:
   - Función `assignParagraphUUIDs()` completa
   - Efecto que llama a `assignParagraphUUIDs`
   - Event delegation para `.paragraph-comment-btn`
   - Atributo `data-paragraph-id` en cualquier lugar
   - Opción `case 'comment':` del menú contextual (o cambiarla a abrir modal global)

2. **Crear `src/components/CommentsModal.js`**:
```javascript
import React, { useState, useEffect } from 'react';
import { generateUUID } from '../utils/helpers';

export default function CommentsModal({ filePath, isOpen, onClose }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    if (filePath && isOpen) {
      const saved = localStorage.getItem(`bg_comments_${filePath}`);
      setComments(saved ? JSON.parse(saved) : []);
    }
  }, [filePath, isOpen]);

  const saveComments = (updated) => {
    setComments(updated);
    localStorage.setItem(`bg_comments_${filePath}`, JSON.stringify(updated));
  };

  const addComment = () => {
    if (!newComment.trim()) return;
    const comment = {
      id: generateUUID(),
      text: newComment.trim(),
      author: 'Usuario',
      createdAt: Date.now(),
      resolved: false
    };
    saveComments([...comments, comment]);
    setNewComment('');
  };

  const deleteComment = (id) => {
    saveComments(comments.filter(c => c.id !== id));
  };

  const toggleResolved = (id) => {
    saveComments(comments.map(c => 
      c.id === id ? { ...c, resolved: !c.resolved } : c
    ));
  };

  if (!isOpen) return null;

  const unresolvedCount = comments.filter(c => !c.resolved).length;

  return (
    <div className="modal open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content medium">
        <div className="modal-header">
          <h3>Comentarios del archivo {unresolvedCount > 0 && `(${unresolvedCount})`}</h3>
          <button className="close-btn" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <div className="comments-list">
          {comments.length === 0 ? (
            <p className="no-comments">No hay comentarios aún</p>
          ) : (
            comments.map(comment => (
              <div key={comment.id} className={`comment-item ${comment.resolved ? 'resolved' : ''}`}>
                <div className="comment-header">
                  <span className="comment-author">{comment.author}</span>
                  <span className="comment-date">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="comment-text">{comment.text}</p>
                <div className="comment-actions">
                  <button onClick={() => toggleResolved(comment.id)}>
                    {comment.resolved ? 'Reabrir' : 'Resolver'}
                  </button>
                  <button onClick={() => deleteComment(comment.id)} className="danger">
                    Eliminar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="comment-input-area">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Agregar un comentario..."
            rows={3}
          />
          <button onClick={addComment} disabled={!newComment.trim()}>
            Agregar comentario
          </button>
        </div>
      </div>
    </div>
  );
}
```

3. **En `EditorSidebar.js` - Simplificar**:
```javascript
// REEMPLAZAR la lógica de commentCount:
function EditorSidebar({ activeFile, editorContent, onOpenComments }) {
  const [commentCount, setCommentCount] = useState(0);

  useEffect(() => {
    if (activeFile?.fullPath) {
      const saved = localStorage.getItem(`bg_comments_${activeFile.fullPath}`);
      const comments = saved ? JSON.parse(saved) : [];
      setCommentCount(comments.filter(c => !c.resolved).length);
    } else {
      setCommentCount(0);
    }
  }, [activeFile]);

  // ... resto del componente, pasar commentCount al badge
}
```

4. **En `Editor.js` - Integrar modal**:
```javascript
// Agregar estado:
const [showComments, setShowComments] = useState(false);

// Agregar en el return:
<CommentsModal 
  filePath={activeFile?.fullPath}
  isOpen={showComments}
  onClose={() => setShowComments(false)}
/>

// Modificar EditorSidebar:
<EditorSidebar
  activeFile={activeFile}
  editorContent={editorRef.current?.innerText || ''}
  onOpenComments={() => setShowComments(true)}
/>
```

---

### Tarea 1.3: Fix Formatos - Citas y Limpieza Completa
**Archivo**: `src/components/Editor.js`

**Problemas**: Blockquote modifica texto, no se puede quitar, clear format no limpia todo.

**Implementación**:

```javascript
// REEMPLAZAR toggleHeading:
const toggleHeading = (tag) => {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  
  let node = selection.anchorNode;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  
  // Buscar elemento de bloque
  let block = node;
  while (block && block !== editorRef.current) {
    if (['P', 'H1', 'H2', 'H3', 'BLOCKQUOTE'].includes(block.tagName)) {
      break;
    }
    block = block.parentElement;
  }
  
  if (block && block !== editorRef.current) {
    if (block.tagName.toLowerCase() === tag) {
      // Ya es el tag, convertir a párrafo
      document.execCommand('formatBlock', false, 'p');
    } else {
      // Cambiar al nuevo tag
      document.execCommand('formatBlock', false, tag);
    }
  } else {
    document.execCommand('formatBlock', false, tag);
  }
  
  handleInput();
  updateActiveFormats();
};

// NUEVA función toggleBlockquote:
const toggleBlockquote = () => {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  
  let node = selection.anchorNode;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  
  const blockquote = node.closest('blockquote');
  
  if (blockquote) {
    document.execCommand('formatBlock', false, 'p');
  } else {
    document.execCommand('formatBlock', false, 'blockquote');
  }
  
  handleInput();
  updateActiveFormats();
};

// REEMPLAZAR updateActiveFormats:
const updateActiveFormats = () => {
  const selection = window.getSelection();
  let currentBlock = 'p';
  
  if (selection.rangeCount > 0) {
    let node = selection.anchorNode;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const block = node.closest('h1, h2, h3, p, blockquote');
    currentBlock = block?.tagName.toLowerCase() || 'p';
  }
  
  setActiveFormats({
    bold: document.queryCommandState('bold'),
    italic: document.queryCommandState('italic'),
    underline: document.queryCommandState('underline'),
    strikeThrough: document.queryCommandState('strikeThrough'),
    insertUnorderedList: document.queryCommandState('insertUnorderedList'),
    h1: currentBlock === 'h1',
    h2: currentBlock === 'h2',
    h3: currentBlock === 'h3',
    blockquote: currentBlock === 'blockquote'
  });
};

// REEMPLAZAR improvedClearFormat:
const improvedClearFormat = () => {
  const selection = window.getSelection();
  if (!selection.rangeCount || selection.isCollapsed) return;

  const range = selection.getRangeAt(0);
  const fragment = range.extractContents();
  
  const cleanNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.cloneNode(true);
    }
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      const removable = ['b', 'strong', 'i', 'em', 'u', 'mark', 'del', 's', 'span', 'font', 'small'];
      const blocks = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code'];
      
      if (removable.includes(tag) || blocks.includes(tag)) {
        const frag = document.createDocumentFragment();
        Array.from(node.childNodes).forEach(child => {
          frag.appendChild(cleanNode(child));
        });
        return frag;
      }
      
      // Para otros elementos, limpiar atributos
      const clone = node.cloneNode(false);
      clone.removeAttribute('style');
      clone.removeAttribute('class');
      clone.removeAttribute('color');
      clone.removeAttribute('face');
      clone.removeAttribute('size');
      
      Array.from(node.childNodes).forEach(child => {
        clone.appendChild(cleanNode(child));
      });
      return clone;
    }
    
    return node.cloneNode(true);
  };
  
  const cleaned = cleanNode(fragment);
  range.insertNode(cleaned);
  
  // Normalizar y limpiar
  editorRef.current.normalize();
  
  // Eliminar elementos vacíos
  editorRef.current.querySelectorAll('p:empty, h1:empty, h2:empty, h3:empty, blockquote:empty, li:empty')
    .forEach(el => el.remove());
  
  handleInput();
  updateActiveFormats();
};

// En el JSX del toolbar, cambiar botón de cita:
<button 
  className={`format-btn ${activeFormats.blockquote ? 'active' : ''}`}
  onClick={toggleBlockquote}
  title={activeFormats.blockquote ? 'Quitar cita' : 'Cita'}
>
  <i className="fas fa-quote-right"></i>
</button>
```

---

## 📋 FASE 2: NUEVOS EFECTOS Y BLOQUES

### Tarea 2.1: Implementar Divider (---)
**Archivo**: `src/components/Editor.js`

**Requisito**: Escribir `---` + Enter o Espacio crea una línea divisoria `<hr>`. Al copiar/pegar debe ser texto plano `---`.

```javascript
// Agregar en handleInput o crear handleKeyDown específico:
const handleKeyDown = (e) => {
  // ... código existente ...
  
  // Detectar --- al presionar Enter o Espacio
  if (e.key === 'Enter' || e.key === ' ') {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const node = selection.anchorNode;
    if (node.nodeType !== Node.TEXT_NODE) return;
    
    const text = node.textContent;
    
    // Detectar --- al inicio de párrafo
    if (text === '---' || text === '—' || text === '–––') {
      e.preventDefault();
      
      // Eliminar el texto ---
      const range = document.createRange();
      range.selectNodeContents(node);
      range.deleteContents();
      
      // Crear HR
      const hr = document.createElement('hr');
      hr.className = 'editor-divider';
      
      // Insertar HR
      const p = node.parentElement;
      p.parentNode.insertBefore(hr, p);
      
      // Crear nuevo párrafo después
      const newP = document.createElement('p');
      newP.innerHTML = '<br>';
      p.parentNode.insertBefore(newP, p.nextSibling);
      
      // Mover cursor al nuevo párrafo
      const newRange = document.createRange();
      newRange.setStart(newP, 0);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
      
      // Eliminar párrafo vacío si quedó
      if (!p.textContent.trim() && !p.querySelector('img, hr, blockquote')) {
        p.remove();
      }
      
      handleInput();
      return;
    }
  }
};

// CSS para el divider:
// Agregar en index.css:
/*
.editor-divider {
  border: none;
  border-top: 2px solid var(--border-color, #333);
  margin: 24px 0;
  position: relative;
}

.editor-divider::after {
  content: '• • •';
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  background: var(--bg-primary, #1e1e1e);
  padding: 0 16px;
  color: var(--text-muted, #666);
  font-size: 12px;
  letter-spacing: 4px;
}
*/
```

**Para copiar como texto plano**: El HR ya se copia como línea vacía o `---` dependiendo del clipboard. Para forzarlo:

```javascript
// Agregar en handleCopy (si existe) o crear:
const handleCopy = (e) => {
  const selection = window.getSelection();
  const html = selection.toString();
  
  // Reemplazar HR con ---
  const div = document.createElement('div');
  div.innerHTML = editorRef.current.innerHTML;
  div.querySelectorAll('hr').forEach(hr => {
    hr.replaceWith(document.createTextNode('\n---\n'));
  });
  
  const text = div.innerText;
  e.clipboardData.setData('text/plain', text);
  e.clipboardData.setData('text/html', div.innerHTML);
  e.preventDefault();
};
```

---

### Tarea 2.2: Markdown Shortcuts Completos
**Archivo**: `src/components/Editor.js`

```javascript
// Extender handleKeyDown:
const markdownShortcuts = {
  '# ': 'h1',
  '## ': 'h2',
  '### ': 'h3',
  '#### ': 'h4',
  '> ': 'blockquote',
  '- ': 'insertUnorderedList',
  '* ': 'insertUnorderedList',
  '1. ': 'insertOrderedList',
  '[] ': 'todo', // Especial
  '```': 'pre',  // Bloque de código
  '`': 'code'    // Inline (cuidado con este)
};

// En handleKeyDown, agregar:
if (e.key === ' ') {
  const node = selection.anchorNode;
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent;
    const parent = node.parentElement;
    
    // Solo al inicio de párrafo
    if (parent.tagName === 'P' || parent === editorRef.current) {
      for (const [shortcut, command] of Object.entries(markdownShortcuts)) {
        if (text === shortcut.trim()) {
          e.preventDefault();
          
          // Eliminar shortcut
          node.textContent = '';
          
          if (command === 'todo') {
            // Crear checkbox
            document.execCommand('insertUnorderedList');
            // Agregar checkbox al primer LI
            setTimeout(() => {
              const li = document.querySelector('li');
              if (li && !li.querySelector('input[type="checkbox"]')) {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.style.marginRight = '8px';
                li.insertBefore(checkbox, li.firstChild);
              }
            }, 0);
          } else if (command.startsWith('insert')) {
            document.execCommand(command);
          } else {
            document.execCommand('formatBlock', false, command);
          }
          
          handleInput();
          updateActiveFormats();
          break;
        }
      }
    }
  }
}
```

---

### Tarea 2.3: Más Efectos de Texto
**Archivo**: `src/components/Editor.js`

Agregar al toolbar flotante:

```javascript
// Nuevos estados:
const [showLinkInput, setShowLinkInput] = useState(false);
const [linkUrl, setLinkUrl] = useState('');

// Nuevas funciones:
const insertLink = () => {
  const url = prompt('URL del enlace:', 'https://');
  if (url) {
    document.execCommand('createLink', false, url);
    handleInput();
  }
};

const removeLink = () => {
  document.execCommand('unlink');
  handleInput();
};

const insertCode = () => {
  document.execCommand('formatBlock', false, 'pre');
  handleInput();
};

const insertInlineCode = () => {
  // Envolver selección en <code>
  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  
  const range = selection.getRangeAt(0);
  const code = document.createElement('code');
  code.style.cssText = 'background:#2d2d2d;padding:2px 4px;border-radius:3px;font-family:monospace;font-size:0.9em;';
  
  try {
    range.surroundContents(code);
    handleInput();
  } catch (e) {
    console.error('No se puede aplicar inline code a selección múltiple');
  }
};

// Agregar al toolbar JSX:
<div className="format-group">
  <button onClick={insertLink} title="Enlace">
    <i className="fas fa-link"></i>
  </button>
  <button onClick={removeLink} title="Quitar enlace">
    <i className="fas fa-unlink"></i>
  </button>
  <button onClick={insertInlineCode} title="Código inline">
    <i className="fas fa-code"></i>
  </button>
</div>
```

---

## 📋 FASE 3: EXPORTACIÓN A WORD

### Tarea 3.1: Analizar y Crear Exportador Word
**Nuevo archivo**: `src/utils/exportToWord.js`

**Investigación**: Word acepta HTML con estilos inline. La estrategia es convertir el HTML del editor a formato Word-compatible.

```javascript
// src/utils/exportToWord.js

/**
 * Exporta contenido HTML a documento Word (.doc)
 * Usa formato HTML de Word con estilos inline
 */

export function exportToWord(htmlContent, fileName = 'documento') {
  // Plantilla HTML de Word
  const wordTemplate = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' 
          xmlns:w='urn:schemas-microsoft-com:office:word' 
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>${fileName}</title>
      <style>
        /* Estilos base de Word */
        body { font-family: 'Calibri', sans-serif; font-size: 11pt; line-height: 1.5; }
        h1 { font-size: 16pt; color: #2E74B5; margin-top: 12pt; margin-bottom: 6pt; }
        h2 { font-size: 13pt; color: #2E74B5; margin-top: 12pt; margin-bottom: 6pt; }
        h3 { font-size: 12pt; color: #1F4E79; margin-top: 12pt; margin-bottom: 6pt; }
        p { margin: 6pt 0; }
        blockquote { 
          margin: 12pt 0; 
          padding-left: 24pt; 
          border-left: 3pt solid #CCCCCC;
          color: #666666;
          font-style: italic;
        }
        ul, ol { margin: 6pt 0; padding-left: 24pt; }
        li { margin: 3pt 0; }
        hr { border: none; border-top: 1pt solid #999999; margin: 12pt 0; }
        mark { background-color: #FFFF00; padding: 0 2pt; }
        code { 
          font-family: 'Courier New', monospace; 
          background-color: #F5F5F5; 
          padding: 1pt 3pt;
          font-size: 10pt;
        }
        pre {
          background-color: #F5F5F5;
          padding: 8pt;
          border: 1pt solid #E0E0E0;
          font-family: 'Courier New', monospace;
          font-size: 10pt;
          white-space: pre-wrap;
        }
        a { color: #0563C1; text-decoration: underline; }
        del, s { text-decoration: line-through; }
        strong, b { font-weight: bold; }
        em, i { font-style: italic; }
        u { text-decoration: underline; }
      </style>
    </head>
    <body>
      ${convertHtmlToWord(htmlContent)}
    </body>
    </html>
  `;

  // Crear blob y descargar
  const blob = new Blob(['\ufeff', wordTemplate], {
    type: 'application/msword'
  });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function convertHtmlToWord(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  
  // Limpiar atributos no compatibles
  const cleanElement = (el) => {
    // Preservar solo atributos esenciales
    const essential = ['href', 'src', 'alt'];
    Array.from(el.attributes).forEach(attr => {
      if (!essential.includes(attr.name)) {
        el.removeAttribute(attr.name);
      }
    });
    
    // Convertir data-paragraph-id y otros data-* a nada
    if (el.hasAttribute('data-paragraph-id')) {
      el.removeAttribute('data-paragraph-id');
    }
    
    // Procesar hijos recursivamente
    Array.from(el.children).forEach(child => cleanElement(child));
  };
  
  cleanElement(div);
  
  // Reemplazar elementos específicos
  let content = div.innerHTML;
  
  // Asegurar que los HR se vean bien
  content = content.replace(/<hr[^>]*>/gi, '<hr style="border:none;border-top:1pt solid #999;margin:12pt 0;"/>');
  
  // Mejorar tablas si existen
  content = content.replace(/<table/g, '<table style="border-collapse:collapse;width:100%;"');
  content = content.replace(/<td/g, '<td style="border:1pt solid #CCC;padding:6pt;"');
  content = content.replace(/<th/g, '<th style="border:1pt solid #CCC;padding:6pt;background:#F5F5F5;"');
  
  return content;
}

// Función para usar en el componente
export function useExportToWord() {
  const exportFile = (html, name) => {
    try {
      exportToWord(html, name);
      return { success: true };
    } catch (error) {
      console.error('Export error:', error);
      return { success: false, error: error.message };
    }
  };
  
  return { exportFile };
}
```

---

### Tarea 3.2: Integrar Exportación en UI
**Archivo**: `src/components/EditorSidebar.js` o crear menú archivo

```javascript
// En EditorSidebar, agregar botón:
<button
  className="editor-sidebar-btn export-btn"
  onClick={handleExportWord}
  title="Exportar a Word"
>
  <i className="fas fa-file-word"></i>
</button>

// Función:
const handleExportWord = () => {
  if (!activeFile || !editorContent) {
    alert('No hay contenido para exportar');
    return;
  }
  
  // Obtener HTML del editor (necesitarás pasar el ref o el HTML)
  const html = document.querySelector('.editor-body')?.innerHTML || '';
  const fileName = activeFile.name.replace('.txt', '');
  
  exportToWord(html, fileName);
};
```

---

## 📋 FASE 4: LAYOUT Y CSS

### Tarea 4.1: Crear CSS de ProjectViewer
**Nuevo archivo**: `src/styles/project-viewer.css`

```css
/* ============================================================================
   PROJECT VIEWER - Block Guard v5.0.0
   ============================================================================ */

.project-viewer {
  position: fixed;
  top: 60px;
  left: 0;
  width: 260px;
  height: calc(100vh - 60px);
  background: var(--bg-secondary, #252526);
  border-right: 1px solid var(--border-color, #333);
  z-index: 150;
  display: flex;
  flex-direction: column;
  -webkit-app-region: no-drag;
  user-select: none;
}

.project-viewer-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-color, #333);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.project-viewer-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #cccccc);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.project-viewer-actions {
  display: flex;
  gap: 4px;
}

.icon-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-secondary, #858585);
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: var(--bg-hover, #2a2d2e);
  color: var(--text-primary, #fff);
}

.project-viewer-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

/* Árbol de archivos */
.file-tree {
  list-style: none;
  margin: 0;
  padding: 0;
}

.file-tree-item {
  display: flex;
  align-items: center;
  padding: 6px 16px;
  cursor: pointer;
  color: var(--text-secondary, #cccccc);
  font-size: 13px;
  transition: all 0.15s;
  gap: 8px;
  border-radius: 4px;
  margin: 0 8px;
}

.file-tree-item:hover {
  background: var(--bg-hover, #2a2d2e);
  color: var(--text-primary, #fff);
}

.file-tree-item.active {
  background: var(--bg-active, #37373d);
  color: var(--text-primary, #fff);
}

.file-tree-item i {
  font-size: 14px;
  width: 18px;
  text-align: center;
  color: var(--accent-color, #4ec9b0);
}

.file-tree-item .folder-icon {
  color: var(--folder-color, #dcb67a);
}

/* Indentación */
.file-tree-item.level-1 { padding-left: 32px; }
.file-tree-item.level-2 { padding-left: 48px; }

/* Scrollbar */
.project-viewer-content::-webkit-scrollbar {
  width: 8px;
}

.project-viewer-content::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb, #424242);
  border-radius: 4px;
}

/* Responsive */
@media (max-width: 768px) {
  .project-viewer {
    transform: translateX(-100%);
    transition: transform 0.3s ease;
  }
  .project-viewer.open {
    transform: translateX(0);
  }
}
```

---

### Tarea 4.2: Fix EditorSidebar Layout
**Archivo**: `src/styles/editor-sidebar.css` (crear/actualizar)

```css
/* ============================================================================
   EDITOR SIDEBAR - Block Guard v5.0.0
   ============================================================================ */

.editor-sidebar {
  position: fixed;
  right: 0;
  top: 60px;
  width: 48px;
  height: calc(100vh - 60px);
  background: var(--bg-secondary, #252526);
  border-left: 1px solid var(--border-color, #333);
  z-index: 100; /* Menor que ProjectViewer (150) */
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  gap: 6px;
  -webkit-app-region: no-drag;
}

.editor-sidebar-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-secondary, #858585);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.2s;
  font-size: 14px;
}

.editor-sidebar-btn:hover {
  background: var(--bg-hover, #2a2d2e);
  color: var(--text-primary, #fff);
}

.editor-sidebar-btn.active {
  background: var(--bg-active, #37373d);
  color: var(--accent-color, #4ec9b0);
}

.badge {
  position: absolute;
  top: -2px;
  right: -2px;
  background: var(--accent-color, #4ec9b0);
  color: #000;
  font-size: 9px;
  font-weight: bold;
  min-width: 14px;
  height: 14px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
}

/* Panel de caracteres especiales */
.special-chars-panel {
  position: fixed;
  right: 56px;
  top: 80px;
  width: 320px;
  max-height: 450px;
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  z-index: 200;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.special-chars-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color, #333);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 13px;
}

.special-chars-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.char-category {
  margin-bottom: 12px;
}

.category-name {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--text-muted, #666);
  margin-bottom: 6px;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.chars-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
}

.char-btn {
  aspect-ratio: 1;
  border: 1px solid var(--border-color, #333);
  background: var(--bg-secondary, #252526);
  color: var(--text-primary, #fff);
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  min-height: 32px;
}

.char-btn:hover {
  background: var(--bg-hover, #2a2d2e);
  border-color: var(--accent-color, #4ec9b0);
}

.char-btn.copied {
  background: var(--success-color, #4ec9b0);
  color: #000;
  border-color: var(--success-color, #4ec9b0);
}
```

---

### Tarea 4.3: Ajustar Layout Global
**Archivo**: `src/components/Editor.js`

```javascript
// En el return, asegurar esta estructura:
return (
  <div className="editor-layout" style={{ display: 'flex', height: '100vh' }}>
    {/* ProjectViewer se renderiza aquí o en App.js */}
    
    <div 
      className="editor-main-container" 
      style={{ 
        flex: 1,
        marginLeft: '260px',  /* Ancho de ProjectViewer */
        marginRight: '48px',  /* Ancho de EditorSidebar */
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Header del archivo */}
      {activeFile && (
        <div className="editor-header">
          <h1>{activeFile.name.replace('.txt', '')}</h1>
        </div>
      )}
      
      {/* Área del editor */}
      <div className="editor-content" style={{ flex: 1, overflow: 'auto' }}>
        <div
          ref={editorRef}
          className="editor-body"
          contentEditable
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onMouseUp={handleMouseUp}
          onPaste={handlePaste}
          onContextMenu={handleContextMenu}
          data-placeholder="Escribe algo increíble... # para título, > para cita, --- para divider"
          suppressContentEditableWarning
          style={{
            minHeight: '100%',
            padding: '40px',
            outline: 'none',
            lineHeight: '1.6'
          }}
        />
      </div>
    </div>
    
    <EditorSidebar
      activeFile={activeFile}
      editorContent={editorRef.current?.innerText || ''}
      onOpenComments={() => setShowComments(true)}
      commentCount={commentCount}
      onExportWord={handleExportWord} // Nueva prop
    />
    
    {/* Modales */}
    <CommentsModal 
      filePath={activeFile?.fullPath}
      isOpen={showComments}
      onClose={() => setShowComments(false)}
    />
    
    <FindReplace
      isOpen={showFindReplace}
      onClose={() => setShowFindReplace(false)}
      editorRef={editorRef} // Pasar ref en lugar de content
      onReplace={handleFindReplace}
      onNavigate={navigateToMatch}
    />
  </div>
);
```

---

## 📋 FASE 5: VARIABLES CSS GLOBALES

### Tarea 5.1: Crear Sistema de Variables
**Archivo**: `src/styles/variables.css` (nuevo) o al inicio de `index.css`

```css
/* ============================================================================
   VARIABLES GLOBALES - Block Guard v5.0.0
   ============================================================================ */

:root {
  /* Backgrounds */
  --bg-primary: #1e1e1e;
  --bg-secondary: #252526;
  --bg-tertiary: #2d2d30;
  --bg-hover: #2a2d2e;
  --bg-active: #37373d;
  --bg-input: #3c3c3c;
  
  /* Texto */
  --text-primary: #d4d4d4;
  --text-secondary: #858585;
  --text-muted: #666666;
  --text-inverse: #1e1e1e;
  
  /* Bordes */
  --border-color: #3e3e42;
  --border-light: #555;
  
  /* Acentos */
  --accent-color: #4ec9b0;
  --accent-hover: #3db89f;
  --folder-color: #dcb67a;
  --success-color: #4ec9b0;
  --warning-color: #cca700;
  --error-color: #f44336;
  --info-color: #3794ff;
  
  /* UI */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --shadow-sm: 0 2px 4px rgba(0,0,0,0.2);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.5);
  
  /* Scrollbar */
  --scrollbar-track: transparent;
  --scrollbar-thumb: #424242;
  --scrollbar-thumb-hover: #4f4f4f;
  
  /* Tipografía */
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'Consolas', 'Monaco', 'Courier New', monospace;
}

/* Scrollbar global */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: var(--scrollbar-track);
}

::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 5px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}

::-webkit-scrollbar-corner {
  background: transparent;
}
```

---

## 📋 FASE 6: TESTING Y VALIDACIÓN

### Tarea 6.1: Checklist de Testing
Crear archivo `TESTING.md`:

```markdown
## Testing Block Guard v5.0.0

### FindReplace
- [ ] Buscar texto simple
- [ ] Buscar con mayúsculas/minúsculas
- [ ] Navegar con Enter/Shift+Enter
- [ ] Verificar que scrollea a coincidencia
- [ ] Verificar highlight amarillo temporal
- [ ] Intentar arrastrar ventana desde panel (no debe funcionar)

### Comentarios
- [ ] Agregar comentario a archivo
- [ ] Ver que persiste en localStorage
- [ ] Cambiar de archivo (contador debe cambiar)
- [ ] Resolver comentario
- [ ] Eliminar comentario
- [ ] Reabrir app (comentarios persisten)

### Formatos
- [ ] Aplicar negrita, cursiva, subrayado
- [ ] Aplicar cita (>), quitar cita (texto idéntico)
- [ ] Aplicar H1, H2, H3, volver a párrafo
- [ ] Limpiar formato completo
- [ ] Aplicar color de texto
- [ ] Aplicar resaltado
- [ ] Quitar resaltado

### Markdown Shortcuts
- [ ] `# ` → H1
- [ ] `## ` → H2
- [ ] `> ` → Blockquote
- [ ] `- ` → Lista
- [ ] `---` → Divider

### Divider
- [ ] Escribir `---` + Enter crea línea
- [ ] Copiar documento con divider pega como `---`

### Exportar Word
- [ ] Exportar documento con formato
- [ ] Abrir en Microsoft Word
- [ ] Verificar que estilos se aplican
- [ ] Verificar que imágenes se ven (si hay)
- [ ] Verificar que tablas se ven bien

### Layout
- [ ] ProjectViewer visible y funcional
- [ ] EditorSidebar no tapa contenido
- [ ] Panel de caracteres especiales se abre correctamente
- [ ] En pantalla pequeña (<768px) ProjectViewer se oculta
```

---

## 🎯 RESUMEN EJECUTIVO PARA EL AGENTE

| Fase | Tareas | Prioridad | Tiempo Est. |
|------|--------|-----------|-------------|
| 1 | Fixes críticos (FindReplace, Comentarios, Formatos) | CRÍTICA | 3-4h |
| 2 | Nuevos efectos (Divider, Markdown, Links) | ALTA | 2-3h |
| 3 | Exportación Word | MEDIA | 2h |
| 4 | CSS y Layout | ALTA | 2h |
| 5 | Variables y polish | BAJA | 1h |
| 6 | Testing | CRÍTICA | 1h |



**Branch sugerida**: `feature/v5.0-comprehensive-update`

**Commits sugeridos** (uno por tarea):
1. `fix: FindReplace navigation and drag issues`
2. `refactor: simplify comments to file-level only`
3. `fix: blockquote toggle and clear formatting`
4. `feat: add markdown shortcuts (h1, h2, quote, list)`
5. `feat: implement divider (---) block`
6. `feat: add link and code formatting tools`
7. `feat: export to Word functionality`
8. `style: create ProjectViewer and EditorSidebar CSS`
9. `style: add global CSS variables`
10. `docs: add testing checklist`

---