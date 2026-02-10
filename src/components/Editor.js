/**
 * ============================================================================
 * BLOCK GUARD v4.0.0 - EDITOR.JS
 * ============================================================================
 * 
 * COMPONENTE: EDITOR DE TEXTO ENRIQUECIDO
 * 
 * Editor WYSIWYG (What You See Is What You Get) que permite
 * escribir con formato (negrita, cursiva, títulos, etc.)
 * 
 * FUNCIONALIDADES:
 * - Edición de texto enriquecido (contentEditable)
 * - Formato: negrita, cursiva, subrayado, tachado
 * - Títulos (H1, H2, H3)
 * - Listas y citas
 * - Toolbar flotante al seleccionar texto
 * - Atajos de teclado (Ctrl+B, Ctrl+I, Ctrl+U)
 * - Sanitización de contenido pegado
 * 
 * PROPS:
 * - content: string - Contenido HTML actual
 * - onChange: function(content) - Callback al cambiar el contenido
 * - activeFile: Object - Archivo actualmente abierto
 * 
 * RELACIONADO CON:
 * - src/App.js: Gestiona el estado del contenido
 * - src/styles/index.css: Estilos de .editor-body y .formatting-toolbar
 * ============================================================================
 */

import React, { useRef, useEffect, useState, forwardRef } from 'react';
import { generateUUID } from '../utils/helpers';
import EditorContextMenu from './EditorContextMenu';
import EditorSidebar from './EditorSidebar';
import FindReplace from './FindReplace';
import { registerShortcutCallback } from '../utils/shortcuts';
import { useKeyboardShortcuts } from '../hooks';

const Editor = forwardRef(({ content, onChange, activeFile, onOpenComments, config }, ref) => {
  // =============================================================================
  // REFERENCIAS Y ESTADOS
  // =============================================================================

  // Hook de atajos
  const { matchesShortcut, getAllShortcuts } = useKeyboardShortcuts();

  // Referencia al elemento editable del DOM
  const editorRef = useRef(null);
  // Contenido pendiente que llega desde props mientras el usuario está editando
  const pendingContentRef = useRef(null);
  // Contenido interno pendiente mientras el usuario escribe (debounced)
  const pendingHTMLRef = useRef(null);
  const inputTimeoutRef = useRef(null);
  const isComposingRef = useRef(false);

  // Estado de visibilidad del toolbar flotante
  const [showToolbar, setShowToolbar] = useState(false);

  // Posición del toolbar flotante
  const [toolbarPosition, setToolbarPosition] = useState({ x: 0, y: 0 });

  // Estado de los formatos activos (para resaltar botones)
  const [activeFormats, setActiveFormats] = useState({});

  // Estado para limpiar formatos al cambiar de archivo
  const [lastFileId, setLastFileId] = useState(null);

  // Estado para mostrar/ocultar color picker de resaltado
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);

  // Estado para mostrar/ocultar color picker de texto
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);

  // Estado del menú de contexto (click derecho)
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const contextMenuRef = useRef(null);

  // Estado del panel Find/Replace
  const [showFindReplace, setShowFindReplace] = useState(false);

  // Historial para undo/redo
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const isUndoingRef = useRef(false);

  // =============================================================================
  // EFECTOS
  // =============================================================================

  /**
   * Efecto: Sincronizar contenido externo con el editor.
   * Cuando cambia la prop 'content', actualizar el DOM del editor.
   */
  useEffect(() => {
    if (!editorRef.current) return;

    // Si el editor tiene el foco, no sobrescribimos el HTML para no romper el caret.
    // Guardamos el contenido entrante y lo aplicamos al perder el foco.
    if (document.activeElement === editorRef.current) {
      if (content !== editorRef.current.innerHTML) {
        pendingContentRef.current = content;
      }
      return;
    }

    if (content !== undefined && editorRef.current.innerHTML !== content) {
      editorRef.current.innerHTML = content;
      historyRef.current = [content];
      historyIndexRef.current = 0;
      pendingContentRef.current = null;
    }
  }, [content]);

  // Aplicar contenido pendiente cuando el editor pierde el foco
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    const handleBlur = () => {
      if (pendingContentRef.current != null && el.innerHTML !== pendingContentRef.current) {
        el.innerHTML = pendingContentRef.current;
        // Notificar cambio al padre
        if (typeof onChange === 'function') onChange(el.innerHTML);
        historyRef.current = [el.innerHTML];
        historyIndexRef.current = 0;
        pendingContentRef.current = null;
      }
    };

    const handleCompositionStart = () => { isComposingRef.current = true; };
    const handleCompositionEnd = () => { isComposingRef.current = false; processPendingInput(); };

    el.addEventListener('blur', handleBlur);
    el.addEventListener('compositionstart', handleCompositionStart);
    el.addEventListener('compositionend', handleCompositionEnd);
    return () => {
      el.removeEventListener('blur', handleBlur);
      el.removeEventListener('compositionstart', handleCompositionStart);
      el.removeEventListener('compositionend', handleCompositionEnd);
    };
  }, [onChange]);

  /**
   * Efecto: Limpiar formatos y estado cuando cambia de archivo.
   */
  useEffect(() => {
    const currentFileId = activeFile?.fullPath;

    if (currentFileId && currentFileId !== lastFileId) {
      // Cambió el archivo - limpiar formatos
      setLastFileId(currentFileId);
      setActiveFormats({});
      setShowToolbar(false);
      setShowHighlightPicker(false);
      setShowTextColorPicker(false);

      // Resetear el editor state
      if (editorRef.current) {
        document.execCommand('removeFormat', false, null);
      }
    }
  }, [activeFile?.fullPath, lastFileId]);

  /**
   * Efecto: Cerrar color pickers y menú de contexto al hacer clic fuera.
   */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.highlight-picker') && !e.target.closest('[data-action="highlight"]')) {
        setShowHighlightPicker(false);
      }
      if (!e.target.closest('.text-color-picker') && !e.target.closest('[data-action="textcolor"]')) {
        setShowTextColorPicker(false);
      }
      if (!e.target.closest('.editor-context-menu') && !editorRef.current?.contains(e.target)) {
        setShowContextMenu(false);
      }
      // Si se hace click fuera del editor y fuera del toolbar, ocultar toolbar
      if (!e.target.closest('.formatting-toolbar') && !editorRef.current?.contains(e.target)) {
        setShowToolbar(false);
      }
    };

    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setShowToolbar(false);
        return;
      }
      const anchor = sel.anchorNode;
      if (!editorRef.current?.contains(anchor)) {
        setShowToolbar(false);
      }
    };

    const handleWindowChange = () => setShowToolbar(false);

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('selectionchange', handleSelectionChange);
    window.addEventListener('scroll', handleWindowChange, true);
    window.addEventListener('resize', handleWindowChange);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('selectionchange', handleSelectionChange);
      window.removeEventListener('scroll', handleWindowChange, true);
      window.removeEventListener('resize', handleWindowChange);
    };
  }, []);


  /**
   * Efecto: Configurar event delegation para clicks en comment buttons.
   * Detecta clicks en .paragraph-comment-btn sin listeners individuales.
   */
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleEditorClick = (event) => {
      const commentBtn = event.target.closest('.paragraph-comment-btn');
      if (commentBtn) {
        event.preventDefault();
        event.stopPropagation();
        const paragraphId = commentBtn.getAttribute('data-paragraph-id');
        if (paragraphId && typeof onOpenComments === 'function') {
          onOpenComments(paragraphId);
        }
      }
    };

    editor.addEventListener('click', handleEditorClick, false);
    return () => {
      editor.removeEventListener('click', handleEditorClick, false);
    };
  }, [onOpenComments]);

  /**
   * Efecto: Configurar atajos de teclado globales.
   * Usa el sistema centralizado de atajos para permitir personalización.
   */
  useEffect(() => {
    const handleKeyDown = (e) => {
      const shortcuts = getAllShortcuts();

      // Buscar / Reemplazar (funciona en cualquier parte)
      if (matchesShortcut(e, shortcuts.find.keys) || matchesShortcut(e, shortcuts.findAndReplace.keys)) {
        e.preventDefault();
        setShowFindReplace(true);
        return;
      }

      // Solo procesar formato si el foco está en el editor
      if (e.target === editorRef.current || editorRef.current?.contains(e.target)) {
        // Formato básico
        if (matchesShortcut(e, shortcuts.bold.keys)) {
          e.preventDefault();
          executeFormat('bold');
          return;
        }
        if (matchesShortcut(e, shortcuts.italic.keys)) {
          e.preventDefault();
          executeFormat('italic');
          return;
        }
        if (matchesShortcut(e, shortcuts.underline.keys)) {
          e.preventDefault();
          executeFormat('underline');
          return;
        }

        // Undo / Redo
        if (matchesShortcut(e, shortcuts.undo.keys)) {
          e.preventDefault();
          handleUndo();
          return;
        }
        if (matchesShortcut(e, shortcuts.redo.keys)) {
          e.preventDefault();
          handleRedo();
          return;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []); // Dependencia vacía porque getAllShortcuts accede a ref actual

  // =============================================================================
  // FUNCIONES: UNDO/REDO
  // =============================================================================

  /**
   * Guarda el estado actual en el historial para undo/redo.
   * Llamado después de cada cambio significativo.
   */
  const saveToHistory = (newContent) => {
    if (isUndoingRef.current) return;

    // Eliminar estados futuros si estamos en medio del historial
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    }

    // Agregar nuevo estado
    historyRef.current.push(newContent);
    historyIndexRef.current++;

    // Limitar historial a 50 estados
    if (historyRef.current.length > 50) {
      historyRef.current.shift();
      historyIndexRef.current--;
    }
  };

  // Manejo de atajos Markdown y divider
  const handleEditorKeyDown = (e) => {
    // Solo si el foco está en el editor
    const selection = window.getSelection();
    if (!editorRef.current || !selection || !selection.rangeCount) return;

    const node = selection.anchorNode;
    if (!node) return;

    // Atajos basados en espacio (ej: '# ', '## ', '> ', '- ')
    const beforeCaret = node.nodeType === Node.TEXT_NODE
      ? node.textContent.slice(0, selection.anchorOffset)
      : '';

    const markdownShortcuts = {
      '# ': 'h1',
      '## ': 'h2',
      '### ': 'h3',
      '> ': 'blockquote',
      '- ': 'insertUnorderedList',
      '* ': 'insertUnorderedList',
      '1. ': 'insertOrderedList',
      '[] ': 'todo'
    };

    // Detectar space-triggered shortcuts
    if (e.key === ' ') {
      for (const [shortcut, command] of Object.entries(markdownShortcuts)) {
        if (beforeCaret.endsWith(shortcut.trim())) {
          // Asegurar que el shortcut esté al inicio del bloque
          const full = node.nodeType === Node.TEXT_NODE ? node.textContent : '';
          const idx = full.lastIndexOf(shortcut.trim());
          const before = full.slice(0, idx);
          if (before.trim().length === 0) {
            e.preventDefault();
            // Eliminar el shortcut
            const newText = full.slice(0, idx) + full.slice(idx + shortcut.trim().length);
            if (node.nodeType === Node.TEXT_NODE) node.textContent = newText;

            if (command === 'todo') {
              document.execCommand('insertUnorderedList');
              setTimeout(() => {
                const li = editorRef.current.querySelector('li');
                if (li && !li.querySelector('input[type="checkbox"]')) {
                  const checkbox = document.createElement('input');
                  checkbox.type = 'checkbox';
                  checkbox.style.marginRight = '8px';
                  li.insertBefore(checkbox, li.firstChild);
                }
              }, 0);
            } else if (command === 'insertUnorderedList' || command === 'insertOrderedList') {
              document.execCommand(command);
            } else if (command === 'blockquote') {
              document.execCommand('formatBlock', false, 'blockquote');
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

    // Detectar Enter para divider '---' y code fence '```'
    if (e.key === 'Enter') {
      const full = node.nodeType === Node.TEXT_NODE ? node.textContent : '';
      const before = full.slice(0, selection.anchorOffset).trim();

      // Divider '---'
      if (before === '---' || before === '—' || before === '–––') {
        e.preventDefault();
        // Eliminar el texto --- del nodo
        if (node.nodeType === Node.TEXT_NODE) {
          const remaining = full.slice(0, full.indexOf(before)) + full.slice(full.indexOf(before) + before.length);
          node.textContent = remaining;
        }

        // Insertar HR
        const hr = document.createElement('hr');
        hr.className = 'editor-divider';
        const p = node.parentElement.closest('p') || node.parentElement;
        p.parentNode.insertBefore(hr, p.nextSibling);

        // Crear nuevo párrafo después
        const newP = document.createElement('p');
        newP.innerHTML = '<br>';
        p.parentNode.insertBefore(newP, hr.nextSibling);

        // Mover cursor al nuevo párrafo
        const newRange = document.createRange();
        newRange.setStart(newP, 0);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);

        handleInput();
        return;
      }

      // Code fence '```'
      if (before.endsWith('```')) {
        e.preventDefault();
        // Eliminar ``` del texto
        if (node.nodeType === Node.TEXT_NODE) {
          const idx = full.lastIndexOf('```');
          node.textContent = full.slice(0, idx) + full.slice(idx + 3);
        }
        // Insertar <pre>
        const pre = document.createElement('pre');
        pre.innerHTML = '<br>';
        const p = node.parentElement.closest('p') || node.parentElement;
        p.parentNode.insertBefore(pre, p.nextSibling);

        // Colocar cursor dentro del pre
        const r = document.createRange();
        r.setStart(pre, 0);
        r.collapse(true);
        selection.removeAllRanges();
        selection.addRange(r);
        handleInput();
        return;
      }
    }
  };

  /**
   * Deshace el último cambio.
   */
  const handleUndo = () => {
    if (historyIndexRef.current > 0) {
      isUndoingRef.current = true;
      historyIndexRef.current--;
      const previousContent = historyRef.current[historyIndexRef.current];

      if (editorRef.current) {
        editorRef.current.innerHTML = previousContent;
        onChange(previousContent);
      }

      setTimeout(() => {
        isUndoingRef.current = false;
      }, 0);
    }
  };

  /**
   * Rehace el último cambio deshecho.
   */
  const handleRedo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      isUndoingRef.current = true;
      historyIndexRef.current++;
      const nextContent = historyRef.current[historyIndexRef.current];

      if (editorRef.current) {
        editorRef.current.innerHTML = nextContent;
        onChange(nextContent);
      }

      setTimeout(() => {
        isUndoingRef.current = false;
      }, 0);
    }
  };

  // =============================================================================
  // FUNCIONES AUXILIARES
  // =============================================================================

  /**
   * Asigna IDs únicos a cada párrafo del editor.
   * Esto permite identificar párrafos para comentarios.
   * Usa event delegation para evitar múltiples listeners.
   */
  const assignParagraphUUIDs = () => {
    if (!editorRef.current) return;

    const children = Array.from(editorRef.current.children);
    children.forEach(child => {
      // Solo asignar a elementos de bloque (p, h1-h6, blockquote)
      if (['P', 'H1', 'H2', 'H3', 'BLOCKQUOTE'].includes(child.tagName)) {
        if (!child.getAttribute('data-paragraph-id')) {
          child.setAttribute('data-paragraph-id', generateUUID());
        }
      }
    });
  };



  /**
   * Efecto: Limpiar listeners cuando el componente se desmonta.
   * Previene fugas de memoria.
   */
  useEffect(() => {
    return () => {
      if (editorRef.current) {
        // Los listeners ya se removen en el efecto anterior
        // No es necesario clonar nodos
      }
      if (inputTimeoutRef.current) {
        clearTimeout(inputTimeoutRef.current);
        inputTimeoutRef.current = null;
      }
    };
  }, []);

  /**
   * Maneja cambios en el contenido del editor.
   * Notifica al padre, actualiza formatos activos y guarda en historial.
   * También reasigna UUIDs y listeners a párrafos.
   */
  const handleInput = () => {
    if (!editorRef.current) return;

    const html = editorRef.current.innerHTML;
    pendingHTMLRef.current = html;

    // Si el usuario está en medio de una composición (IME), esperar
    if (isComposingRef.current) return;

    // Debounce para evitar mutaciones frecuentes del DOM que rompan el caret
    if (inputTimeoutRef.current) clearTimeout(inputTimeoutRef.current);
    inputTimeoutRef.current = setTimeout(() => {
      processPendingInput();
    }, 350);
  };

  const processPendingInput = () => {
    if (!editorRef.current) return;
    const newContent = pendingHTMLRef.current ?? editorRef.current.innerHTML;
    try { if (typeof onChange === 'function') onChange(newContent); } catch (e) { console.error(e); }
    updateActiveFormats();
    saveToHistory(newContent);
    assignParagraphUUIDs();
    cleanupEmptyBlockquotes();
    pendingHTMLRef.current = null;
    if (inputTimeoutRef.current) { clearTimeout(inputTimeoutRef.current); inputTimeoutRef.current = null; }
  };

  // =============================================================================
  // FUNCIONES: COLOR Y RESALTADO
  // =============================================================================

  /**
   * Aplica color de resaltado al texto seleccionado.
   * @param {string} color - Color en formato hex (ej: #ffff00)
   */
  const applyHighlight = (color) => {
    const selection = window.getSelection();
    if (!selection.rangeCount || selection.isCollapsed) {
      return;
    }

    if (color === 'transparent' || color === 'none') {
      removeHighlight();
    } else {
      const range = selection.getRangeAt(0);

      // Verificar si ya está marcado con el mismo color
      const existingMark = range.commonAncestorContainer.parentElement;
      if (existingMark && existingMark.tagName === 'MARK' &&
        existingMark.style.backgroundColor === color) {
        removeHighlight();
        return;
      }

      // Crear nuevo marcado
      const mark = document.createElement('mark');
      mark.style.backgroundColor = color;
      mark.style.padding = '2px 4px';
      mark.style.borderRadius = '4px';
      mark.style.color = 'inherit';

      try {
        const contents = range.extractContents();
        mark.appendChild(contents);
        range.insertNode(mark);

        // Limpiar selección
        selection.removeAllRanges();

        handleInput();
      } catch (err) {
        console.error('Error al resaltar:', err);
      }
    }

    setShowHighlightPicker(false);
  };

  /**
   * Quita el resaltado del texto seleccionado.
   */
  const removeHighlight = () => {
    const selection = window.getSelection();
    if (!selection.rangeCount || selection.isCollapsed) {
      return;
    }

    const range = selection.getRangeAt(0);
    let node = range.commonAncestorContainer;

    // Buscar el elemento mark, del o s más cercano
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }

    let formatElement = null;
    let current = node;
    while (current && current !== editorRef.current) {
      if (['MARK', 'DEL', 'S'].includes(current.tagName)) {
        formatElement = current;
        break;
      }
      current = current.parentElement;
    }

    if (formatElement) {
      // Reemplazar el elemento con su contenido
      const parent = formatElement.parentNode;
      while (formatElement.firstChild) {
        parent.insertBefore(formatElement.firstChild, formatElement);
      }
      parent.removeChild(formatElement);
      cleanupEmptyBlockquotes();
      handleInput();
    } else {
      // Intentar con removeFormat como fallback
      document.execCommand('removeFormat', false, null);
      handleInput();
    }
  };

  /**
   * Aplica color de texto al texto seleccionado.
   * @param {string} color - Color en formato hex
   */
  const applyTextColor = (color) => {
    document.execCommand('foreColor', false, color);
    editorRef.current.focus();
    handleInput();
    updateActiveFormats();
    setShowTextColorPicker(false);
  };

  // Insertar enlace (prompt simple)
  const insertLink = () => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const url = prompt('URL del enlace:', 'https://');
    if (url) {
      document.execCommand('createLink', false, url);
      handleInput();
      updateActiveFormats();
    }
  };

  const removeLink = () => {
    document.execCommand('unlink');
    handleInput();
    updateActiveFormats();
  };

  // Insertar bloque de código <pre>
  const insertCode = () => {
    document.execCommand('formatBlock', false, 'pre');
    handleInput();
    updateActiveFormats();
  };

  // Insertar código inline envuelto en <code>
  const insertInlineCode = () => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const code = document.createElement('code');
    code.style.cssText = 'background:#2d2d2d;padding:2px 4px;border-radius:3px;font-family:monospace;font-size:0.9em;color:inherit;';
    try {
      range.surroundContents(code);
      handleInput();
      updateActiveFormats();
    } catch (e) {
      // Si la selección cruza nodos, usar fallback: insertar texto formateado
      const text = selection.toString();
      document.execCommand('insertHTML', false, `<code style="background:#2d2d2d;padding:2px 4px;border-radius:3px;font-family:monospace;font-size:0.9em;color:inherit;">${text}</code>`);
      handleInput();
      updateActiveFormats();
    }
  };

  /**
   * Maneja el menú de contexto (click derecho) en el editor.
   * @param {MouseEvent} e - Evento del mouse
   */
  const handleContextMenu = (e) => {
    e.preventDefault();

    setContextMenuPosition({
      x: e.clientX,
      y: e.clientY
    });
    setShowContextMenu(true);
  };

  /**
   * Ejecuta una acción del menú de contexto.
   * @param {string} action - Acción a realizar (cut, copy, paste, etc.)
   */
  const handleContextMenuAction = (action) => {
    const selection = window.getSelection();

    switch (action) {
      case 'cut':
        document.execCommand('cut');
        handleInput();
        break;
      case 'copy':
        document.execCommand('copy');
        break;
      case 'paste':
        // Usar Clipboard API para obtener texto y pegarlo
        navigator.clipboard.readText()
          .then((text) => {
            if (editorRef.current && editorRef.current.isContentEditable) {
              const selection = window.getSelection();
              if (selection.rangeCount > 0) {
                selection.getRangeAt(0).deleteContents();
                selection.getRangeAt(0).insertNode(document.createTextNode(text));
              }
              handleInput();
            }
          })
          .catch((err) => {
            // Fallback: usar execCommand si Clipboard API falla
            console.warn('Clipboard API no disponible, usando fallback');
            document.execCommand('paste');
            handleInput();
          });
        break;
      case 'selectAll':
        document.execCommand('selectAll');
        updateActiveFormats();
        break;
      case 'clearFormat':
        improvedClearFormat();
        updateActiveFormats();
        break;
      case 'clearHighlights':
        // Remover todos los elementos mark (que usan resaltado)
        if (editorRef.current) {
          const marks = editorRef.current.querySelectorAll('mark');
          marks.forEach(mark => {
            const parent = mark.parentNode;
            while (mark.firstChild) {
              parent.insertBefore(mark.firstChild, mark);
            }
            parent.removeChild(mark);
          });
          // También eliminar del/s tags (strikethrough)
          const delTags = editorRef.current.querySelectorAll('del, s');
          delTags.forEach(del => {
            const parent = del.parentNode;
            while (del.firstChild) {
              parent.insertBefore(del.firstChild, del);
            }
            parent.removeChild(del);
          });
          cleanupEmptyBlockquotes();
          handleInput();
          updateActiveFormats();
        }
        break;
      case 'comment': {
        // Intentar obtener el párrafo seleccionado o el párrafo bajo el caret
        let node = selection && selection.anchorNode ? selection.anchorNode : null;
        if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
        const para = node ? node.closest('[data-paragraph-id]') : null;
        const paragraphId = para ? para.getAttribute('data-paragraph-id') : null;
        if (paragraphId && typeof onOpenComments === 'function') {
          onOpenComments(paragraphId);
        }
        break;
      }
      default:
        break;
    }

    setShowContextMenu(false);
    editorRef.current.focus();
  };

  /**
   * Maneja la selección de texto (mouse up).
   * Muestra el toolbar flotante si hay texto seleccionado.
   */
  const handleMouseUp = () => {
    const selection = window.getSelection();
    const text = selection.toString().trim();

    // Solo mostrar toolbar si hay texto seleccionado y está dentro del editor
    if (text.length > 0 && editorRef.current.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Posicionar toolbar arriba de la selección
      setToolbarPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 60
      });
      setShowToolbar(true);
      updateActiveFormats();
    } else {
      setShowToolbar(false);
    }
  };

  /**
   * Actualiza el estado de los formatos activos.
   * Usa document.queryCommandState para verificar el formato actual.
   * También detecta el tipo de heading activo.
   */
  const updateActiveFormats = () => {
    const selection = window.getSelection();
    let currentBlock = null;

    if (selection.rangeCount > 0) {
      let node = selection.anchorNode;
      if (node.nodeType === 3) node = node.parentElement;
      currentBlock = node.closest('h1, h2, h3, p, blockquote');
    }

    const currentTag = currentBlock?.tagName.toLowerCase() || 'p';

    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      h1: currentTag === 'h1',
      h2: currentTag === 'h2',
      h3: currentTag === 'h3'
      ,
      blockquote: currentTag === 'blockquote'
    });
  };

  /**
   * Ejecuta un comando de formato "inteligente".
   * Si la selección contiene mezcla de estilos (algunos con formato, otros sin),
   * fuerza a eliminar el formato primero para unificar.
   * Si todo tiene formato, lo quita. Si nada tiene, lo pone.
   */
  const smartToggle = (command, tag) => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    // Verificar si el comando está activo actualmente
    const isActive = document.queryCommandState(command);

    // Si está activo, simplemente ejecutar para desactivar (comportamiento default ok)
    // PERO, si es una selección mixta, execCommand a veces es inconsistente.
    // Vamos a intentar forzar limpieza si detectamos que "algo" lo tiene.

    // Aproximación simple: Si document.queryCommandState dice false, pero visualmente vemos que hay mezcla...
    // En contentEditable, queryCommandState suele devolver true solo si TODO lo tiene.
    // Si devuelve false, puede ser que NADA lo tenga o que SOLO PARTE lo tenga.

    if (!isActive) {
      // Podría ser mixto o nada.
      // Intentamos aplicar.
      document.execCommand(command, false, null);
    } else {
      // Todo lo tiene, quitar.
      document.execCommand(command, false, null);
    }

    editorRef.current.focus();
    handleInput();
    updateActiveFormats();
  };

  /**
   * Ejecuta un comando de formato en el editor.
   * @param {string} command - Comando a ejecutar (bold, italic, etc.)
   * @param {string} value - Valor opcional para el comando
   */
  const executeFormat = (command, value = null) => {
    // Verificar si los efectos están habilitados en la configuración
    if (!config?.editorEffects?.enableFormatting && 
        ['bold', 'italic', 'underline', 'strikeThrough'].includes(command)) {
      console.log('Formato deshabilitado en configuración');
      return;
    }
    
    if (!config?.editorEffects?.enableHighlights && command === 'hiliteColor') {
      console.log('Resaltado deshabilitado en configuración');
      return;
    }
    
    if (!config?.editorEffects?.enableTextColors && command === 'foreColor') {
      console.log('Colores de texto deshabilitados en configuración');
      return;
    }
    
    // Ejecutar comando si está habilitado
    if (['bold', 'italic', 'underline', 'strikeThrough'].includes(command)) {
      smartToggle(command);
    } else {
      document.execCommand(command, false, value);
    }
    editorRef.current.focus();
    handleInput();
    updateActiveFormats();
  };

  // Registrar atajos del editor **después** de definir `executeFormat`
  useEffect(() => {
    const unsubs = [
      registerShortcutCallback('bold', () => executeFormat('bold')),
      registerShortcutCallback('italic', () => executeFormat('italic')),
      registerShortcutCallback('underline', () => executeFormat('underline')),
      registerShortcutCallback('strikethrough', () => executeFormat('strikeThrough')),
      registerShortcutCallback('find', () => setShowFindReplace(true)),
      registerShortcutCallback('findAndReplace', () => setShowFindReplace(true)),
      registerShortcutCallback('undo', () => handleUndo()),
      registerShortcutCallback('redo', () => handleRedo())
    ];

    return () => {
      unsubs.forEach(unsub => unsub && unsub());
    };
  }, [handleUndo, handleRedo]);

  /**
   * Limpia TODOS los formatos del texto seleccionado, incluyendo:
   * - Negrita, cursiva, subrayado, tachado
   * - Resaltado (mark)
   * - Color de texto
   * - También elimina blockquotes vacíos
   */
  const improvedClearFormat = () => {
    const selection = window.getSelection();
    if (!selection.rangeCount || selection.isCollapsed) return;

    // Usar removeFormat nativo primero, suele ser bastante bueno
    document.execCommand('removeFormat', false, null);

    // Limpieza adicional manual para casos rebeldes (clases, spans sucios)
    const range = selection.getRangeAt(0);
    const fragment = range.extractContents();

    const cleanNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.cloneNode(true);
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        // Lista de tags permitidos layout (p, div, br)
        // Tags de formato a eliminar: b, i, u, strike, font, span con style, mark

        const tag = node.tagName.toLowerCase();

        // Si es un bloque estructural (p, h1..h6, li, ul, ol), mantener estructura pero limpiar atributos
        if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'li', 'ul', 'ol', 'blockquote'].includes(tag)) {
          const clone = document.createElement(tag);
          Array.from(node.childNodes).forEach(child => {
            clone.appendChild(cleanNode(child));
          });
          return clone;
        }

        // Si es formato, unwrapear (retornar hijos limpios)
        if (['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'mark', 'span', 'font', 'code'].includes(tag)) {
          const frag = document.createDocumentFragment();
          Array.from(node.childNodes).forEach(child => {
            frag.appendChild(cleanNode(child));
          });
          return frag;
        }

        // Default: clonar y limpiar hijos
        const clone = node.cloneNode(false);
        clone.removeAttribute('style');
        clone.removeAttribute('class');
        Array.from(node.childNodes).forEach(child => {
          clone.appendChild(cleanNode(child));
        });
        return clone;
      }
      return node.cloneNode(true);
    };

    const cleaned = cleanNode(fragment);
    range.insertNode(cleaned);
    editorRef.current.normalize();
    handleInput();
    updateActiveFormats();
  };

  /**
   * Elimina blockquotes, párrafos y otros elementos de bloque si están vacíos.
   * Se ejecuta después de cambios para mantener el DOM limpio.
   */
  const cleanupEmptyBlockquotes = () => {
    if (!editorRef.current) return;

    // Encontrar y eliminar blockquotes vacíos
    const blockquotes = editorRef.current.querySelectorAll('blockquote');
    blockquotes.forEach(bq => {
      const text = bq.textContent?.trim();
      if (!text) {
        // Crear un párrafo vacío para reemplazar el blockquote vacío
        const emptyP = document.createElement('p');
        bq.parentNode.replaceChild(emptyP, bq);
      }
    });

    // Encontrar y eliminar párrafos completamente vacíos (excepto el primero)
    const paragraphs = editorRef.current.querySelectorAll('p');
    let emptyCount = 0;
    paragraphs.forEach((p, index) => {
      const text = p.textContent?.trim();
      if (!text) {
        emptyCount++;
        // Remover si no es el único párrafo vacío
        if (emptyCount > 1 || index === 0) {
          // Mantener al menos un párrafo vacío como fallback
        } else {
          p.parentNode.removeChild(p);
        }
      } else {
        emptyCount = 0;
      }
    });
  };

  /**
   * Alterna entre título (H1/H2/H3) y párrafo normal.
   * @param {string} tag - Tag de título (h1, h2, h3)
   */
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

  // NUEVA función toggleBlockquote: unwrap/wrap preservando contenido
  const toggleBlockquote = () => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    let node = selection.anchorNode;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;

    const block = node ? node.closest('p, h1, h2, h3, div, li, blockquote') : null;
    if (!block || block === editorRef.current) {
      // Fallback: aplicar formatBlock
      document.execCommand('formatBlock', false, 'blockquote');
      handleInput();
      updateActiveFormats();
      return;
    }

    const existingBQ = block.closest('blockquote');
    if (existingBQ) {
      // Unwrap blockquote: mover hijos fuera y eliminar blockquote
      const parent = existingBQ.parentNode;
      while (existingBQ.firstChild) {
        parent.insertBefore(existingBQ.firstChild, existingBQ);
      }
      parent.removeChild(existingBQ);
      cleanupEmptyBlockquotes();
      handleInput();
      updateActiveFormats();
      return;
    }

    // Wrap the block element in a blockquote without altering inner text
    const bq = document.createElement('blockquote');
    block.parentNode.insertBefore(bq, block);
    bq.appendChild(block);
    handleInput();
    updateActiveFormats();
  };

  /**
   * Maneja el evento de pegar contenido.
   * Sanitiza el HTML pegado para evitar código malicioso.
   * @param {ClipboardEvent} e - Evento de clipboard
   */
  const handlePaste = (e) => {
    e.preventDefault();

    // Obtener datos del clipboard (preferir texto plano)
    const text = e.clipboardData.getData('text/plain');

    // Pegar solo texto plano sin formatos (preserva espacios y líneas)
    document.execCommand('insertText', false, text);

    handleInput();
  };

  /**
   * Maneja la búsqueda y reemplazo de texto en el contenido HTML.
   * Preserva el HTML y solo busca en el texto visible.
   * @param {string} searchTerm - Término a buscar
   * @param {string} replaceTerm - Texto de reemplazo
   * @param {boolean} replaceAll - Si es true, reemplaza todas las coincidencias
   */
  const handleFindReplace = (searchTerm, replaceTerm, replaceAll) => {
    if (!editorRef.current || !searchTerm) return;

    try {
      // Crear regex escapando caracteres especiales
      const flags = 'g';  // Global
      const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedTerm, flags);

      // Obtener el HTML actual
      let htmlContent = editorRef.current.innerHTML;

      // Dividir por tags HTML para protegerlos
      const parts = htmlContent.split(/(<[^>]+>)/);

      // Procesar cada parte
      const processedParts = parts.map(part => {
        // Si es un tag HTML, devolverlo sin cambios
        if (part.startsWith('<')) {
          return part;
        }
        // Si es texto, aplicar el reemplazo
        if (replaceAll) {
          return part.replace(regex, replaceTerm);
        } else {
          // Reemplazar solo la primera coincidencia
          return part.replace(regex, replaceTerm);
        }
      });

      // Reconstruir el HTML
      const newHtml = processedParts.join('');
      editorRef.current.innerHTML = newHtml;

      // Disparar evento de cambio
      handleInput();

    } catch (error) {
      console.error('Error en find/replace:', error);
    }
  };

  /**
   * Navega a la coincidencia N-ésima del término en el editor y la selecciona.
   * @param {string} searchTerm
   * @param {number} matchIndex 1-based
   * @param {boolean} caseSensitive
   */
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

  // =============================================================================
  // RENDERIZADO
  // =============================================================================

  return (
    <div className="editor-wrapper">
      <div className="editor-container">
        {/* Metadatos del archivo (icono + título) */}
        {activeFile && (
          <div className="editor-metadata">
            <span className="file-icon-large">
              <i className="fas fa-file-alt"></i>
            </span>
            <div className="active-file-header">
              <h1 className="active-file-title">
                {activeFile.name.replace('.txt', '')}
              </h1>
            </div>
          </div>
        )}

        {/* Área editable del editor */}
        <div className="editor-main">
          <div
            ref={editorRef}
            className={`editor-body ${config?.editorEffects?.enableBlockquoteStyle ? 'enable-blockquote-style' : ''}`}
            contentEditable
            spellCheck="true"
            lang={config?.language || 'es'}
            data-gramm="true"
            onInput={handleInput}
            onMouseUp={handleMouseUp}
            onPaste={handlePaste}
            onContextMenu={handleContextMenu}
            onKeyDown={handleEditorKeyDown}
            data-placeholder="Escribe algo increíble..."
            suppressContentEditableWarning
          />

          {/* SECCIÓN DE SUB-ARCHIVOS */}
          {activeFile && activeFile.items && activeFile.items.length > 0 && (
            <div className="editor-subfiles-section">
              <h3 className="subfiles-title">
                <i className="fas fa-folder-tree"></i> Sub Archivos
              </h3>
              <div className="subfiles-grid">
                {activeFile.items.map(subItem => (
                  <div key={subItem.fullPath} className="subfile-card">
                    <i className="fas fa-file-alt"></i>
                    <span className="subfile-name">{subItem.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Sidebar del editor (fijo a la derecha, autónomo) */}
      {activeFile && (
        <EditorSidebar
          activeFile={activeFile}
          editorContent={editorRef.current?.innerText || ''}
          onOpenComments={onOpenComments}
        />
      )}

      {/* Toolbar flotante de formato */}
      {showToolbar && (
        <div
          className="formatting-toolbar"
          style={{
            left: toolbarPosition.x - 150,
            top: toolbarPosition.y
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="format-group">
            <button
              className={`format-btn ${activeFormats.bold ? 'active' : ''}`}
              onClick={() => executeFormat('bold')}
              title="Negrita (Ctrl+B)"
            >
              <i className="fas fa-bold"></i>
            </button>
            <button
              className={`format-btn ${activeFormats.italic ? 'active' : ''}`}
              onClick={() => executeFormat('italic')}
              title="Cursiva (Ctrl+I)"
            >
              <i className="fas fa-italic"></i>
            </button>
            <button
              className={`format-btn ${activeFormats.underline ? 'active' : ''}`}
              onClick={() => executeFormat('underline')}
              title="Subrayado (Ctrl+U)"
            >
              <i className="fas fa-underline"></i>
            </button>
            <button
              className={`format-btn ${activeFormats.strikeThrough ? 'active' : ''}`}
              onClick={() => executeFormat('strikeThrough')}
              title="Tachado"
            >
              <i className="fas fa-strikethrough"></i>
            </button>
          </div>

          <div className="format-group">
            <button
              className={`format-btn ${activeFormats.h1 ? 'active' : ''}`}
              onClick={() => toggleHeading('h1')}
              title={activeFormats.h1 ? 'Convertir a párrafo' : 'Título 1'}
            >
              H1
            </button>
            <button
              className={`format-btn ${activeFormats.h2 ? 'active' : ''}`}
              onClick={() => toggleHeading('h2')}
              title={activeFormats.h2 ? 'Convertir a párrafo' : 'Título 2'}
            >
              H2
            </button>
            <button
              className={`format-btn ${activeFormats.h3 ? 'active' : ''}`}
              onClick={() => toggleHeading('h3')}
              title={activeFormats.h3 ? 'Convertir a párrafo' : 'Título 3'}
            >
              H3
            </button>
          </div>

          <div className="format-group">
            <button
              className={`format-btn ${activeFormats.insertUnorderedList ? 'active' : ''}`}
              onClick={() => executeFormat('insertUnorderedList')}
              title="Lista"
            >
              <i className="fas fa-list-ul"></i>
            </button>
            <button
              className={`format-btn ${activeFormats.blockquote ? 'active' : ''}`}
              onClick={() => toggleBlockquote()}
              title={activeFormats.blockquote ? 'Quitar cita' : 'Cita'}
            >
              <i className="fas fa-quote-right"></i>
            </button>
          </div>
        </div>
      )}
      {showContextMenu && (
        <EditorContextMenu
          position={contextMenuPosition}
          onAction={handleContextMenuAction}
          onClose={() => setShowContextMenu(false)}
        />
      )}

      <FindReplace
        isOpen={showFindReplace}
        onClose={() => setShowFindReplace(false)}
        editorRef={editorRef}
        onReplace={(searchTerm, replaceTerm, replaceAll) => {
          handleFindReplace(searchTerm, replaceTerm, replaceAll);
        }}
        onNavigate={(term, idx, caseSensitive) => navigateToMatch(term, idx, caseSensitive)}
      />

      {/* EditorSidebar moved inside editor-container (see above) */}
    </div>
  );
});

export default Editor;
