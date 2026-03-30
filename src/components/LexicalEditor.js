/**
 * ============================================================================
 * LEXICAL EDITOR v1.0.0 - MIGRACIÓN COMPLETA
 * ============================================================================
 * 
 * Editor de texto enriquecido usando Lexical Framework
 * Mantiene todas las funcionalidades del editor anterior con mejor rendimiento
 * 
 * CARACTERÍSTICAS:
 * - Rich text editing con Lexical
 * - Formato: negrita, cursiva, subrayado, tachado
 * - Headings (H1, H2, H3)
 * - Listas (ordenadas y desordenadas)
 * - Blockquotes
 * - Resaltado de texto (highlights)
 * - Colores de texto
 * - Enlaces
 * - Código inline
 * - Atajos de teclado
 * - Undo/Redo
 * - Find & Replace
 * - Markdown shortcuts
 * - Drag & Drop de bloques
 * - Auto-save
 * - Comentarios por párrafo
 * ============================================================================
 */

import React, { useState, useEffect, useRef, useCallback, useMemo, forwardRef } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { CodeNode } from '@lexical/code';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { TRANSFORMERS } from '@lexical/markdown';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  UNDO_COMMAND,
  REDO_COMMAND,
  SELECT_ALL_COMMAND,
  COPY_COMMAND,
  CUT_COMMAND,
  PASTE_COMMAND,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_LOW,
  KEY_ENTER_COMMAND,
  KEY_DOWN_COMMAND,
  $createTextNode,
  $isElementNode,
  DecoratorNode,
  $insertNodes,
  $isRootOrShadowRoot,
  $applyNodeReplacement,
  $getNodeByKey,
  $nodesOfType,
  $getNearestNodeFromDOMNode,
  DROP_COMMAND,
  DRAGOVER_COMMAND,
  COMMAND_PRIORITY_HIGH
} from 'lexical';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { $setBlocksType } from '@lexical/selection';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { $findMatchingParent } from '@lexical/utils';
import {
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND
} from '@lexical/list';
import { TOGGLE_LINK_COMMAND } from '@lexical/link';
import { HorizontalRuleNode, $createHorizontalRuleNode, $isHorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin';

import EditorSidebar, { SpecialCharsPanel } from './EditorSidebar';
import CommentsSidebar from './CommentsSidebar';
import FindReplace from './FindReplace';
import SlashMenu from './SlashMenu';
import LinkModal from './LinkModal';
import SubFilesFooter from './SubFilesFooter';
import SpellingContextMenu from './SpellingContextMenu';
import IconSelector from './IconSelector';
import LinkTooltip from './lexical/LinkTooltip';
import { HighlightNode } from './lexical/nodes/HighlightNode';
import { SubFileNode, $createSubFileNode, $isSubFileNode } from './lexical/nodes/SubFileNode';
import { registerShortcutCallback, getShortcutCallback } from '../utils/shortcuts';
import { useKeyboardShortcuts } from '../hooks';
import { SLASH_COMMANDS } from '../utils/slashCommands';
import { getIconById, DEFAULT_FILE_ICON } from '../utils/iconLibrary';
import Icon from '@mdi/react';
import * as mdi from '@mdi/js';
const { 
  mdiFormatBold, 
  mdiFormatItalic, 
  mdiFormatUnderline, 
  mdiFormatStrikethrough, 
  mdiFormatListBulleted, 
  mdiFormatQuoteClose, 
  mdiMarker, 
  mdiClose, 
  mdiPalette, 
  mdiLink, 
  mdiCodeTags 
} = mdi;
// Nota: estilos de drag-handles eliminados al desactivar funcionalidad

// Importar plugins personalizados
// DragDropPlugin eliminado
import { ParagraphIDPlugin } from './lexical/plugins/ParagraphIDPlugin';

// Tema personalizado para Lexical
const theme = {
  ltr: 'ltr',
  rtl: 'rtl',
  paragraph: 'editor-paragraph',
  quote: 'editor-quote',
  heading: {
    h1: 'editor-heading-h1',
    h2: 'editor-heading-h2',
    h3: 'editor-heading-h3',
  },
  list: {
    nested: {
      listitem: 'editor-nested-listitem',
    },
    ol: 'editor-list-ol',
    ul: 'editor-list-ul',
    listitem: 'editor-listitem',
  },
  link: 'editor-link',
  text: {
    bold: 'editor-text-bold',
    italic: 'editor-text-italic',
    underline: 'editor-text-underline',
    strikethrough: 'editor-text-strikethrough',
    code: 'editor-text-code',
  },
  code: 'editor-code',
};

// Configuración inicial del editor
function onError(error) {
  console.error('Lexical Error:', error);
}

// ============================================================================
// PLUGINS — definidos FUERA del componente para evitar TDZ y remounts
// ============================================================================

function SubFileTrackerPlugin({ setPlacedSubFilePaths }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const paths = new Set();
        const nodes = $nodesOfType(SubFileNode);
        for (const node of nodes) {
          const data = node.getData();
          if (data && data.fullPath) paths.add(data.fullPath);
        }
        setPlacedSubFilePaths(prev => {
          const next = new Set(paths);
          if (prev.size === next.size && [...prev].every(p => next.has(p))) return prev;
          return next;
        });
      });
    });
  }, [editor, setPlacedSubFilePaths]);
  return null;
}

function ContentSyncPlugin() {
  return null;
}

function OnChangePluginComponent({ onChange, setEditorContent }) {
  const [editor] = useLexicalComposerContext();
  const handleChange = useCallback((editorState) => {
    editorState.read(() => {
      const htmlString = $generateHtmlFromNodes(editor, null);
      setEditorContent(htmlString);
      if (onChange && typeof onChange === 'function') onChange(htmlString);
    });
  }, [editor, onChange, setEditorContent]);
  return <OnChangePlugin onChange={handleChange} ignoreSelectionChange />;
}

function EditorCapturePlugin({ lexicalEditorRef, onOpenSubFile }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    lexicalEditorRef.current = editor;
    const handleOpenSubFileEvent = (e) => { if (onOpenSubFile) onOpenSubFile(e.detail); };
    window.addEventListener('open-subfile', handleOpenSubFileEvent);
    return () => {
      lexicalEditorRef.current = null;
      window.removeEventListener('open-subfile', handleOpenSubFileEvent);
    };
  }, [editor, lexicalEditorRef, onOpenSubFile]);
  return null;
}

function SubFileDragDropPlugin({ subFiles }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    const unregisterDragOver = editor.registerCommand(
      DRAGOVER_COMMAND,
      (event) => {
        const isSubFile = event.dataTransfer.types.includes('application/json') ||
          event.dataTransfer.types.includes('application/x-lexical-subfile-key');
        if (isSubFile) { event.preventDefault(); return true; }
        return false;
      },
      COMMAND_PRIORITY_LOW
    );
    const unregisterDrop = editor.registerCommand(
      DROP_COMMAND,
      (event) => {
        const data = event.dataTransfer.getData('application/json');
        const nodeKey = event.dataTransfer.getData('application/x-lexical-subfile-key');
        if (!data && !nodeKey) return false;
        try {
          if (nodeKey) {
            event.preventDefault();
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if ($isSubFileNode(node)) {
                node.remove();
                const targetDOMNode = document.elementFromPoint(event.clientX, event.clientY);
                if (targetDOMNode && editor.getRootElement().contains(targetDOMNode)) {
                  const targetNode = $getNearestNodeFromDOMNode(targetDOMNode);
                  if (targetNode) {
                    const topLevelElement = targetNode.getTopLevelElementOrThrow();
                    const rect = targetDOMNode.getBoundingClientRect();
                    const isUpperHalf = (event.clientY - rect.top) < (rect.height / 2);
                    if (isUpperHalf) topLevelElement.insertBefore(node);
                    else topLevelElement.insertAfter(node);
                    return;
                  }
                }
                const currentSelection = $getSelection();
                if ($isRangeSelection(currentSelection)) $insertNodes([node]);
                else $getRoot().append(node);
              }
            });
            return true;
          }
          if (data) {
            const payload = JSON.parse(data);
            if (payload.type === 'subfile-internal') {
              event.preventDefault();
              const subFile = subFiles.find(f => f.fullPath === payload.fullPath);
              if (subFile) {
                editor.update(() => {
                  const subFileNode = $createSubFileNode(subFile);
                  const targetDOMNode = document.elementFromPoint(event.clientX, event.clientY);
                  if (targetDOMNode && editor.getRootElement().contains(targetDOMNode)) {
                    const targetNode = $getNearestNodeFromDOMNode(targetDOMNode);
                    if (targetNode) {
                      const topLevelElement = targetNode.getTopLevelElementOrThrow();
                      const rect = targetDOMNode.getBoundingClientRect();
                      const isUpperHalf = (event.clientY - rect.top) < (rect.height / 2);
                      if (isUpperHalf) topLevelElement.insertBefore(subFileNode);
                      else topLevelElement.insertAfter(subFileNode);
                      return;
                    }
                  }
                  const currentSelection = $getSelection();
                  if ($isRangeSelection(currentSelection)) $insertNodes([subFileNode]);
                  else $getRoot().append(subFileNode);
                });
                return true;
              }
            }
          }
        } catch (e) { console.error('Error handling drop:', e); }
        return false;
      },
      COMMAND_PRIORITY_HIGH
    );
    return () => { unregisterDragOver(); unregisterDrop(); };
  }, [editor, subFiles]);
  return null;
}

function PlaceholderPlugin() {
  const [editor] = useLexicalComposerContext();
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const root = $getRoot();
        setShowPlaceholder(root.getTextContent().trim().length === 0);
      });
    });
  }, [editor]);
  if (!showPlaceholder) return null;
  return <div className="editor-placeholder">Escribe algo increíble...</div>;
}

function FloatingToolbarPlugin({ setShowToolbar, setToolbarPosition, setActiveFormats, setShowTextColorPicker, setShowHighlightPicker }) {
  const [editor] = useLexicalComposerContext();
  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || selection.isCollapsed()) {
      setShowToolbar(false); setShowTextColorPicker(false); setShowHighlightPicker(false);
      return;
    }
    const nativeSelection = window.getSelection();
    if (!nativeSelection || nativeSelection.rangeCount === 0) {
      setShowToolbar(false); setShowTextColorPicker(false); setShowHighlightPicker(false);
      return;
    }
    const range = nativeSelection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setToolbarPosition({ x: rect.left + rect.width / 2, y: rect.top - 60 });
    setActiveFormats({
      bold: selection.hasFormat('bold'),
      italic: selection.hasFormat('italic'),
      underline: selection.hasFormat('underline'),
      strikethrough: selection.hasFormat('strikethrough'),
      code: selection.hasFormat('code'),
    });
    setShowToolbar(true);
  }, [setShowToolbar, setToolbarPosition, setActiveFormats, setShowTextColorPicker, setShowHighlightPicker]);
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => { updateToolbar(); });
    });
  }, [editor, updateToolbar]);
  return null;
}

function CustomClipboardPlugin({ handleEditAction }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerCommand(
      SELECT_ALL_COMMAND,
      () => { handleEditAction('selectAll'); return false; },
      COMMAND_PRIORITY_EDITOR
    );
  }, [editor, handleEditAction]);
  return null;
}

function CustomKeyboardPlugin({ getAllShortcuts, matchesShortcut, setShowFindReplace }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return false;
        const anchorNode = selection.anchor.getNode();
        const element = anchorNode.getTopLevelElementOrThrow();
        const text = element.getTextContent().trim();
        if ((text === '---' || text === '***' || text === '___') && element.getType() === 'paragraph') {
          event.preventDefault();
          const hrNode = $createHorizontalRuleNode();
          const newParagraph = $createParagraphNode();
          element.replace(hrNode);
          hrNode.insertAfter(newParagraph);
          newParagraph.select();
          return true;
        }
        if (element.getType() === 'quote' && text === '') {
          event.preventDefault();
          const newParagraph = $createParagraphNode();
          element.insertAfter(newParagraph);
          newParagraph.select();
          element.remove();
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_CRITICAL
    );
  }, [editor]);
  useEffect(() => {
    const handleKeyDown = (event) => {
      const shortcuts = getAllShortcuts();
      if (matchesShortcut(event, shortcuts.find?.keys) || matchesShortcut(event, shortcuts.findAndReplace?.keys)) {
        event.preventDefault();
        setShowFindReplace(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [getAllShortcuts, matchesShortcut, setShowFindReplace]);
  return null;
}

function KeyboardShortcutPlugin({ getAllShortcuts, matchesShortcut }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        const allShortcuts = getAllShortcuts();
        for (const [shortcutId, shortcut] of Object.entries(allShortcuts)) {
          if (matchesShortcut(event, shortcut.keys)) {
            const callback = getShortcutCallback(shortcutId);
            if (callback && typeof callback === 'function') {
              event.preventDefault();
              callback(event);
              return true;
            }
          }
        }
        return false;
      },
      COMMAND_PRIORITY_EDITOR
    );
  }, [editor, getAllShortcuts, matchesShortcut]);
  return null;
}

function SlashMenuPlugin({ setShowSlashMenu, setSlashMenuPosition, setSlashSearchQuery, setSlashSelectedIndex }) {
  const [editor] = useLexicalComposerContext();
  const updateSlashMenu = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || !selection.isCollapsed()) { setShowSlashMenu(false); return; }
    const anchorNode = selection.anchor.getNode();
    const textContent = anchorNode.getTextContent();
    const anchorOffset = selection.anchor.offset;
    const textBeforeCursor = textContent.slice(0, anchorOffset);
    const slashIndex = textBeforeCursor.lastIndexOf('/');
    if (slashIndex !== -1 && slashIndex === anchorOffset - 1) {
      const nativeSelection = window.getSelection();
      if (nativeSelection && nativeSelection.rangeCount > 0) {
        const range = nativeSelection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSlashMenuPosition({ x: rect.left, y: rect.bottom + 5 });
        setSlashSearchQuery('');
        setSlashSelectedIndex(0);
        setShowSlashMenu(true);
      }
    } else if (slashIndex !== -1 && slashIndex < anchorOffset) {
      setSlashSearchQuery(textBeforeCursor.slice(slashIndex + 1));
      setShowSlashMenu(true);
    } else {
      setShowSlashMenu(false);
    }
  }, [setShowSlashMenu, setSlashMenuPosition, setSlashSearchQuery, setSlashSelectedIndex]);
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => { updateSlashMenu(); });
    });
  }, [editor, updateSlashMenu]);
  return null;
}

function LinkClickPlugin({ setLinkTooltip }) {
  const [editor] = useLexicalComposerContext();
  const hoverTimeoutRef = useRef(null);
  const hideTimeoutRef = useRef(null);
  useEffect(() => {
    const handleClick = (event) => {
      const target = event.target;
      if (target.tagName === 'A' && target.href) {
        event.preventDefault();
        if (window.electronAPI?.openExternal) window.electronAPI.openExternal(target.href);
        else window.open(target.href, '_blank');
      }
    };
    const handleMouseOver = (event) => {
      const target = event.target;
      if (target.tagName === 'A' && target.href) {
        if (hideTimeoutRef.current) { clearTimeout(hideTimeoutRef.current); hideTimeoutRef.current = null; }
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => {
          const rect = target.getBoundingClientRect();
          setLinkTooltip({ url: target.href, position: { x: rect.left, y: rect.bottom + 5 }, linkElement: target });
        }, 300);
      }
    };
    const handleMouseOut = (event) => {
      const target = event.target;
      if (target.tagName === 'A') {
        if (hoverTimeoutRef.current) { clearTimeout(hoverTimeoutRef.current); hoverTimeoutRef.current = null; }
        hideTimeoutRef.current = setTimeout(() => setLinkTooltip(null), 200);
      }
    };
    const editorElement = editor.getRootElement();
    if (editorElement) {
      editorElement.addEventListener('click', handleClick);
      editorElement.addEventListener('mouseover', handleMouseOver);
      editorElement.addEventListener('mouseout', handleMouseOut);
      return () => {
        editorElement.removeEventListener('click', handleClick);
        editorElement.removeEventListener('mouseover', handleMouseOver);
        editorElement.removeEventListener('mouseout', handleMouseOut);
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      };
    }
  }, [editor, setLinkTooltip]);
  return null;
}

// ============================================================================
// FIN PLUGINS
// ============================================================================

const LexicalEditor = forwardRef(({
  content,
  onChange,
  activeFile,
  onOpenSubFile,
  onCreateSubFile,
  onOpenComments,
  onAddComment,
  onDeleteComment,
  onRenameFile,
  onSetFileIcon,
  onSpellCheck,
  config,
  showSidebar = true,
  isSplitView = false,
  onToggleSpecialChars,
  activeRightPanel,
  setActiveRightPanel // Añadir prop para control directo si es necesario
}, ref) => {
  const { matchesShortcut, getAllShortcuts } = useKeyboardShortcuts();

  // 1. Definir todos los REFS primero
  const editorRef = useRef(null);
  const lexicalEditorRef = useRef(null);
  const iconButtonRef = useRef(null);
  const findSessionRef = useRef({
    term: '',
    caseSensitive: false,
    index: 0
  });

  // 2. Definir todos los ESTADOS
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ x: 0, y: 0 });
  const [activeFormats, setActiveFormats] = useState({});
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [lastUserInteraction, setLastUserInteraction] = useState(Date.now());
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  
  // ELIMINADO: activeRightPanel local para usar el de props

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [metadataStatus, setMetadataStatus] = useState('draft');
  const [metadataGoal, setMetadataGoal] = useState(30000);

  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ x: 0, y: 0 });
  const [slashSearchQuery, setSlashSearchQuery] = useState('');
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);
  
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkModalData, setLinkModalData] = useState({ url: '', text: '' });

  const [showIconSelector, setShowIconSelector] = useState(false);
  const [iconSelectorPosition, setIconSelectorPosition] = useState({ top: 0, left: 0 });

  const [spellingMenu, setSpellingMenu] = useState(null);
  const [linkTooltip, setLinkTooltip] = useState(null);

  const [placedSubFilePaths, setPlacedSubFilePaths] = useState(new Set());
  const [editorContent, setEditorContent] = useState('');

  // Obtener subarchivos del archivo activo
  const subFiles = useMemo(() => activeFile?.items || activeFile?.subFiles || [], [activeFile]);

  const [findOverlayRects, setFindOverlayRects] = useState([]);
  const [findCurrentRects, setFindCurrentRects] = useState([]);

  // 3. Definir useMemo
  const memoActiveFormats = useMemo(() => activeFormats, [activeFormats]);

  const filteredSlashCommands = useMemo(() => {
    if (!slashSearchQuery) return SLASH_COMMANDS;
    const query = slashSearchQuery.toLowerCase();
    return SLASH_COMMANDS.filter(command => {
      const labelMatch = command.label.toLowerCase().includes(query);
      const keywordsMatch = command.keywords?.some(keyword => keyword.toLowerCase().includes(query));
      return labelMatch || keywordsMatch;
    });
  }, [slashSearchQuery]);

  // 4. Efectos
  // Sincronizar qué subarchivos están ya colocados en el editor

  const clearFindHighlight = useCallback(() => {
    setFindOverlayRects([]);
    setFindCurrentRects([]);
    findSessionRef.current = { term: '', caseSensitive: false, index: 0 };
  }, []);

  const collectTextNodes = useCallback((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
  }, []);

  const findAllMatches = useCallback((term, caseSensitive) => {
    const rootEl = editorRef.current;
    if (!rootEl) return [];
    if (!term || term.length < 2) return [];

    const haystackNodes = collectTextNodes(rootEl);
    const matches = [];
    const needle = caseSensitive ? term : term.toLowerCase();

    for (const textNode of haystackNodes) {
      const raw = textNode.nodeValue || '';
      const src = caseSensitive ? raw : raw.toLowerCase();
      let from = 0;
      while (from <= src.length) {
        const at = src.indexOf(needle, from);
        if (at === -1) break;
        const range = document.createRange();
        range.setStart(textNode, at);
        range.setEnd(textNode, at + term.length);
        matches.push(range);
        from = at + term.length;
      }
    }

    return matches;
  }, [collectTextNodes]);

  const rangesToOverlayRects = useCallback((ranges) => {
    const rootEl = editorRef.current;
    if (!rootEl) return [];

    const scrollEl = rootEl.closest('.editor-scroll');
    if (!scrollEl) return [];

    const scrollRect = scrollEl.getBoundingClientRect();
    const rects = [];

    for (const r of ranges) {
      const clientRects = Array.from(r.getClientRects());
      for (const cr of clientRects) {
        // Convertir a coords relativas al scroller
        rects.push({
          top: (cr.top - scrollRect.top) + scrollEl.scrollTop,
          left: (cr.left - scrollRect.left) + scrollEl.scrollLeft,
          width: cr.width,
          height: cr.height
        });
      }
    }

    return rects;
  }, []);

  const navigateToMatchDom = useCallback((term, matchIndex, caseSensitive) => {
    const rootEl = editorRef.current;
    if (!rootEl) return;

    const matches = findAllMatches(term, caseSensitive);
    if (matches.length === 0) {
      clearFindHighlight();
      return;
    }

    const idx0 = Math.max(0, Math.min(matches.length - 1, (matchIndex || 1) - 1));
    const target = matches[idx0];

    // Actualizar el índice en la sesión primero
    findSessionRef.current = { term, caseSensitive: !!caseSensitive, index: idx0 + 1 };

    // Scroll al match visible
    const rect = target.getBoundingClientRect();
    const scroller = rootEl.closest('.editor-scroll');
    if (scroller && rect) {
      const sRect = scroller.getBoundingClientRect();
      const top = scroller.scrollTop + (rect.top - sRect.top) - 120;
      scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }

    // Calcular y actualizar overlays DESPUÉS del scroll
    // Usar requestAnimationFrame para asegurar que el cálculo se hace después del scroll
    requestAnimationFrame(() => {
      const overlayAll = rangesToOverlayRects(matches);
      const overlayCurrent = rangesToOverlayRects([target]);
      setFindOverlayRects(overlayAll);
      setFindCurrentRects(overlayCurrent);
      console.log('[FIND] Overlays actualizados - Total:', overlayAll.length, 'Current:', overlayCurrent.length, 'Index:', idx0 + 1);
    });
  }, [clearFindHighlight, findAllMatches, rangesToOverlayRects]);

  useEffect(() => {
    if (!showFindReplace) return;
    const rootEl = editorRef.current;
    if (!rootEl) return;
    const scroller = rootEl.closest('.editor-scroll');
    if (!scroller) return;

    let raf = null;
    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const s = findSessionRef.current;
        if (!s.term || s.term.length < 2) return;
        const matches = findAllMatches(s.term, s.caseSensitive);
        if (matches.length === 0) return;
        const idx0 = Math.max(0, Math.min(matches.length - 1, (s.index || 1) - 1));
        setFindOverlayRects(rangesToOverlayRects(matches));
        setFindCurrentRects(rangesToOverlayRects([matches[idx0]]));
      });
    };

    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [showFindReplace, findAllMatches, rangesToOverlayRects]);

  // Crear el estado inicial del editor desde el contenido HTML o Texto Plano
  const initialEditorState = useMemo(() => {
    return (editor) => {
      // Si no hay contenido, inicializar con párrafo vacío
      if (!content || content.trim() === '') {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          root.append(paragraph);
        });
        return;
      }

      // Detectar si el contenido es HTML o texto plano
      const isHTML = /<[a-z][\s\S]*>/i.test(content);
      let htmlToLoad = content;

      if (!isHTML) {
        // Envolver texto plano en párrafos para Lexical
        htmlToLoad = content
          .split(/\r?\n/)
          .map(line => `<p>${line || '<br>'}</p>`)
          .join('');
      }

      const parser = new DOMParser();
      const dom = parser.parseFromString(htmlToLoad, 'text/html');

      editor.update(() => {
        const root = $getRoot();
        root.clear();

        try {
          const nodes = $generateNodesFromDOM(editor, dom);
          if (nodes.length > 0) {
            // Filtrar para asegurar que los hijos del root sean ElementNodes (párrafos, headings, etc)
            nodes.forEach(node => {
              if ($isElementNode(node)) {
                root.append(node);
              } else {
                // Si es un nodo de texto suelto, envolverlo en un párrafo
                const p = $createParagraphNode();
                p.append(node);
                root.append(p);
              }
            });
            console.log('[INIT] Contenido cargado exitosamente, nodos:', nodes.length);
          } else {
            const paragraph = $createParagraphNode();
            root.append(paragraph);
          }
        } catch (error) {
          console.error('[INIT] Error crítico inicializando editor:', error);
          const paragraph = $createParagraphNode();
          root.append(paragraph);
        }
      });
    };
  }, [activeFile?.fullPath]); // Solo depender del path para evitar re-renders por contenido (App.js lo gestiona)

  // Plugin para sincronizar contenido si cambia externamente (ej: drafts o cambio de archivo sin remount)
  // (ContentSyncPlugin definido fuera del componente)

  // Configuración inicial de Lexical
  const initialConfig = useMemo(() => {
    console.log('[LEXICAL-CONFIG] Creando nueva configuración para:', activeFile?.fullPath);
    return {
      namespace: 'BloopyEditor',
      theme,
      onError,
      editorState: initialEditorState,
      nodes: [
        HeadingNode,
        QuoteNode,
        ListNode,
        ListItemNode,
        CodeNode,
        LinkNode,
        AutoLinkNode,
        HorizontalRuleNode,
        HighlightNode,
        SubFileNode
      ],
    };
  }, [initialEditorState]); // Quitar config de dependencias para evitar reinicios por cambios en settings

  // (OnChangePluginComponent, EditorCapturePlugin, SubFileDragDropPlugin, PlaceholderPlugin,
  //  FloatingToolbarPlugin, CustomClipboardPlugin, CustomKeyboardPlugin, KeyboardShortcutPlugin,
  //  SlashMenuPlugin, LinkClickPlugin — todos definidos fuera del componente)

  // Chunking/lazy loading para archivos grandes
  useEffect(() => {
    if (!activeFile || !content) return;
    if (content.length > 500000) {
      setEditorContent(content.slice(0, 10000));
    } else {
      setEditorContent(content);
    }
  }, [activeFile, content]);
  
  // Guardado eficiente de archivos grandes
  const saveFileWithHierarchyCheckOptimized = useCallback((filePath, content) => {
    if (!activeFile || activeFile.fullPath !== filePath) return;
    if (activeFile.contentHash !== content) {
      window.electronAPI.saveFileWithHierarchyCheck(filePath, content);
    }
  }, [activeFile]);

  // Manejar selección de comando del SlashMenu
  const handleSlashCommand = useCallback((command) => {
    if (!lexicalEditorRef.current) return;

    lexicalEditorRef.current.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      const anchorNode = selection.anchor.getNode();
      const textContent = anchorNode.getTextContent();
      const anchorOffset = selection.anchor.offset;

      // Encontrar y eliminar el "/" y la query
      const textBeforeCursor = textContent.slice(0, anchorOffset);
      const slashIndex = textBeforeCursor.lastIndexOf('/');

      if (slashIndex !== -1) {
        // Eliminar desde "/" hasta el cursor
        const textBefore = textContent.slice(0, slashIndex);
        const textAfter = textContent.slice(anchorOffset);
        anchorNode.setTextContent(textBefore + textAfter);

        // Mover cursor
        selection.anchor.offset = slashIndex;
        selection.focus.offset = slashIndex;
      }

      // Utilidad: insertar bloque debajo del elemento actual con placeholder y un párrafo vacío debajo
      const element = anchorNode.getTopLevelElementOrThrow();
      const insertBlockBelow = (nodeFactory, placeholderText) => {
        const newBlock = nodeFactory();
        if (placeholderText) {
          const tn = $createTextNode(placeholderText);
          newBlock.append(tn);
        }
        const afterParagraph = $createParagraphNode();
        element.insertAfter(newBlock);
        newBlock.insertAfter(afterParagraph);
        newBlock.select();
        return { newBlock, afterParagraph };
      };

      // Ejecutar el comando con placeholders
      if (command.action.startsWith('formatBlock:')) {
        const tag = command.action.split(':')[1];
        if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
          insertBlockBelow(() => $createHeadingNode(tag), command.placeholder || '');
        } else if (tag === 'blockquote') {
          insertBlockBelow(() => $createQuoteNode(), command.placeholder || '');
        } else if (tag === 'p') {
          insertBlockBelow(() => $createParagraphNode(), command.placeholder || '');
        } else if (tag === 'pre') {
          // fallback: usar párrafo con estilo placeholder simulando bloque de código
          insertBlockBelow(() => $createParagraphNode(), command.placeholder || '');
        }
      } else if (command.action === 'insertUnorderedList') {
        const { newBlock } = insertBlockBelow(() => $createParagraphNode(), null);
        lexicalEditorRef.current.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
        const ph = command.placeholder || '';
        if (ph) {
          const s = $getSelection();
          if ($isRangeSelection(s)) s.insertText(ph);
        }
      } else if (command.action === 'insertOrderedList') {
        const { newBlock } = insertBlockBelow(() => $createParagraphNode(), null);
        lexicalEditorRef.current.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
        const ph = command.placeholder || '';
        if (ph) {
          const s = $getSelection();
          if ($isRangeSelection(s)) s.insertText(ph);
        }
      } else if (command.action === 'insertHR') {
        const sel = $getSelection();
        if ($isRangeSelection(sel)) {
          const element = sel.anchor.getNode().getTopLevelElementOrThrow();
          const hrNode = $createHorizontalRuleNode();
          const newParagraph = $createParagraphNode();
          const ph = command.placeholder || '';
          if (ph) {
            newParagraph.append($createTextNode(ph));
          }
          element.insertAfter(hrNode);
          hrNode.insertAfter(newParagraph);
          newParagraph.select();
        }
      }
    });

    setShowSlashMenu(false);
  }, []);

  // Funciones de formato
  const executeFormat = useCallback((format) => {
    if (!lexicalEditorRef.current) return;

    lexicalEditorRef.current.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.formatText(format);
      }
    });
  }, []);

  const toggleHeading = useCallback((headingTag) => {
    if (!lexicalEditorRef.current) return;

    lexicalEditorRef.current.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const anchorNode = selection.anchor.getNode();
        const element = anchorNode.getKey() === 'root'
          ? anchorNode
          : $findMatchingParent(anchorNode, e => $isElementNode(e) && !e.isInline()) || anchorNode.getTopLevelElementOrThrow();

        if (element.getType() === 'heading' && element.getTag() === headingTag) {
          $setBlocksType(selection, () => $createParagraphNode());
        } else {
          $setBlocksType(selection, () => $createHeadingNode(headingTag));
        }
      }
    });
  }, []);

  const toggleBlockquote = useCallback(() => {
    if (!lexicalEditorRef.current) return;

    lexicalEditorRef.current.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const anchorNode = selection.anchor.getNode();
        const element = anchorNode.getKey() === 'root'
          ? anchorNode
          : $findMatchingParent(anchorNode, e => $isElementNode(e) && !e.isInline()) || anchorNode.getTopLevelElementOrThrow();

        if (element.getType() === 'quote') {
          $setBlocksType(selection, () => $createParagraphNode());
        } else {
          $setBlocksType(selection, () => $createQuoteNode());
        }
      }
    });
  }, []);

  const toggleList = useCallback((listType) => {
    if (!lexicalEditorRef.current) return;

    const command = listType === 'ul'
      ? INSERT_UNORDERED_LIST_COMMAND
      : INSERT_ORDERED_LIST_COMMAND;

    lexicalEditorRef.current.dispatchCommand(command, undefined);
  }, []);

  const insertLink = useCallback(() => {
    if (!lexicalEditorRef.current) return;

    // Obtener texto seleccionado si existe
    let selectedText = '';
    lexicalEditorRef.current.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selectedText = selection.getTextContent();
      }
    });

    setLinkModalData({ url: '', text: selectedText });
    setShowLinkModal(true);
  }, []);

  const handleInsertLink = useCallback((url, text) => {
    if (!lexicalEditorRef.current) return;

    lexicalEditorRef.current.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        if (text) {
          // Si hay texto personalizado, reemplazar selección
          selection.insertText(text);
        }
        // Aplicar el link
        lexicalEditorRef.current.dispatchCommand(TOGGLE_LINK_COMMAND, url);
      }
    });
  }, []);

  const applyHighlight = useCallback((color) => {
    if (!lexicalEditorRef.current) return;

    lexicalEditorRef.current.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const nodes = selection.getNodes();
        nodes.forEach(node => {
          if (node.__type === 'text') {
            if (color === 'none') {
              // Remover highlight manteniendo otros estilos
              const currentStyle = node.getStyle() || '';
              const newStyle = currentStyle
                .split(';')
                .filter(s => !s.includes('background-color') && !s.includes('padding') && !s.includes('border-radius'))
                .join(';');
              node.setStyle(newStyle);
            } else {
              // Aplicar highlight
              const currentStyle = node.getStyle() || '';
              const stylesWithoutBg = currentStyle
                .split(';')
                .filter(s => !s.includes('background-color') && !s.includes('padding') && !s.includes('border-radius'))
                .join(';');
              node.setStyle(`${stylesWithoutBg}; background-color: ${color}; padding: 2px 4px; border-radius: 4px;`.trim());
            }
          }
        });
      }
    });

    setShowHighlightPicker(false);
  }, []);

  const applyTextColor = useCallback((color) => {
    if (!lexicalEditorRef.current) return;

    lexicalEditorRef.current.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const nodes = selection.getNodes();
        nodes.forEach(node => {
          if (node.__type === 'text') {
            if (color === 'none') {
              // Remover color manteniendo otros estilos
              const currentStyle = node.getStyle() || '';
              const newStyle = currentStyle
                .split(';')
                .filter(s => !s.includes('color:'))
                .join(';');
              node.setStyle(newStyle);
            } else {
              // Aplicar color
              const currentStyle = node.getStyle() || '';
              const stylesWithoutColor = currentStyle
                .split(';')
                .filter(s => !s.includes('color:'))
                .join(';');
              node.setStyle(`${stylesWithoutColor}; color: ${color};`.trim());
            }
          }
        });
      }
    });

    setShowTextColorPicker(false);
  }, []);

  // Menú contextual: NO hacer preventDefault aquí para que el evento llegue al main process
  // El main process escucha 'context-menu' en webContents y envía spell-check-context o context-menu-edit
  const handleContextMenu = useCallback((e) => {
    // No hacer e.preventDefault() - dejar que el evento llegue al main process
  }, []);

  // Suscripción al menú contextual enviado por el proceso main (solo palabras mal escritas + sugerencias nativas)
  useEffect(() => {
    if (config?.spellCheck?.enabled === false) return;
    const api = window.electronAPI;
    if (!api?.onSpellCheckContext || !api?.onContextMenuEdit) return;
    const unsubSpell = api.onSpellCheckContext((data) => {
      console.log('[LexicalEditor] onSpellCheckContext received:', data);
      
      // Select only the misspelled word in the editor
      if (lexicalEditorRef.current && data.word) {
        lexicalEditorRef.current.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            // Get the selected text to check if it's the whole paragraph
            const selectedText = selection.getTextContent();
            
            // If the selection is longer than the misspelled word, we need to find and select just the word
            if (selectedText.length > data.word.length || selectedText !== data.word) {
              // Get all text nodes in the editor
              const root = $getRoot();
              let found = false;
              
              // Search for the misspelled word in text nodes
              const searchNodes = (node) => {
                if (found) return;
                
                if (node.getType() === 'text') {
                  const text = node.getTextContent();
                  const wordIndex = text.indexOf(data.word);
                  
                  if (wordIndex !== -1) {
                    // Found the word, select it
                    const start = wordIndex;
                    const end = wordIndex + data.word.length;
                    node.select(start, end);
                    found = true;
                    return;
                  }
                }
                
                // Recursively search children
                if ($isElementNode(node)) {
                  const children = node.getChildren();
                  for (const child of children) {
                    searchNodes(child);
                    if (found) break;
                  }
                }
              };
              
              searchNodes(root);
            }
          }
        });
      }
      
      // Reset state first to ensure React detects the change
      setSpellingMenu(null);
      // Use setTimeout to ensure re-render
      setTimeout(() => {
        setSpellingMenu({
          word: data.word || '',
          suggestions: data.suggestions || [],
          x: data.x,
          y: data.y,
          fromSpellCheck: true
        });
      }, 0);
    });
    const unsubEdit = api.onContextMenuEdit((data) => {
      console.log('[LexicalEditor] onContextMenuEdit received:', data);
      // Reset state first to ensure React detects the change
      setSpellingMenu(null);
      // Use setTimeout to ensure re-render
      setTimeout(() => {
        setSpellingMenu({
          word: '',
          suggestions: [],
          x: data.x,
          y: data.y,
          fromSpellCheck: false
        });
      }, 0);
    });
    return () => {
      unsubSpell();
      unsubEdit();
    };
  }, [config?.spellCheck?.enabled]);

  const handleUndo = useCallback(() => {
    if (!lexicalEditorRef.current) return;
    lexicalEditorRef.current.dispatchCommand(UNDO_COMMAND, undefined);
  }, []);

  const handleRedo = useCallback(() => {
    if (!lexicalEditorRef.current) return;
    lexicalEditorRef.current.dispatchCommand(REDO_COMMAND, undefined);
  }, []);

  // Handlers para LinkTooltip
  const handleLinkTooltipOpen = useCallback(() => {
    if (linkTooltip && window.electronAPI) {
      window.electronAPI.openExternal(linkTooltip.url);
    }
    setLinkTooltip(null);
  }, [linkTooltip]);

  const handleLinkTooltipCopy = useCallback(() => {
    if (linkTooltip && window.electronAPI) {
      window.electronAPI.copyToClipboard(linkTooltip.url);
    }
    setLinkTooltip(null);
  }, [linkTooltip]);

  const handleLinkTooltipRemove = useCallback(() => {
    if (linkTooltip && lexicalEditorRef.current) {
      lexicalEditorRef.current.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          // Encontrar el LinkNode y convertirlo a texto
          const nodes = selection.getNodes();
          nodes.forEach(node => {
            // Buscar el nodo padre si es un LinkNode
            let currentNode = node;
            while (currentNode) {
              if (currentNode.getType() === 'link') {
                const textContent = currentNode.getTextContent();
                const textNode = $createTextNode(textContent);
                currentNode.replace(textNode);
                break;
              }
              currentNode = currentNode.getParent();
            }
          });
        }
      });
    }
    setLinkTooltip(null);
  }, [linkTooltip]);

  // Manejar comandos del portapapeles y edición
  const handleEditAction = useCallback(async (action) => {
    if (!lexicalEditorRef.current) return;

    switch (action) {
      case 'cut':
      case 'copy':
      case 'paste':
        // Use Electron IPC for clipboard operations to avoid crashes
        if (window.electronAPI && window.electronAPI.editAction) {
          await window.electronAPI.editAction(action);
        }
        break;
      case 'selectAll':
        lexicalEditorRef.current.dispatchCommand(SELECT_ALL_COMMAND, undefined);
        break;
      case 'undo':
        lexicalEditorRef.current.dispatchCommand(UNDO_COMMAND, undefined);
        break;
      case 'redo':
        lexicalEditorRef.current.dispatchCommand(REDO_COMMAND, undefined);
        break;
      case 'clearFormat':
        lexicalEditorRef.current.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            // 1. Limpiar formatos de carácter en nodos de texto
            const nodes = selection.getNodes();
            nodes.forEach(node => {
              if (node.__type === 'text') {
                // Remover todos los formatos (negrita, cursiva, subrayado, tachado)
                node.setFormat(0);
                // Remover estilos inline (colores, highlights)
                node.setStyle('');
              }
            });
            
            // 2. Convertir encabezados y blockquotes a párrafos
            const anchorNode = selection.anchor.getNode();
            const element = anchorNode.getKey() === 'root'
              ? anchorNode
              : $findMatchingParent(anchorNode, e => $isElementNode(e) && !e.isInline()) 
                || anchorNode.getTopLevelElementOrThrow();
            
            if (element.getType() === 'heading' || element.getType() === 'quote') {
              $setBlocksType(selection, () => $createParagraphNode());
            }
            
            // 3. Convertir enlaces a texto plano
            nodes.forEach(node => {
              // Buscar el nodo padre si es un LinkNode
              let currentNode = node;
              while (currentNode) {
                if (currentNode.getType() === 'link') {
                  const textContent = currentNode.getTextContent();
                  const textNode = $createTextNode(textContent);
                  currentNode.replace(textNode);
                  break;
                }
                currentNode = currentNode.getParent();
              }
            });
            
            // 4. Remover listas (convertir a párrafos)
            if (element.getType() === 'listitem') {
              $setBlocksType(selection, () => $createParagraphNode());
            }
          }
        });
        break;
      case 'clearHighlights':
        lexicalEditorRef.current.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.getNodes().forEach(node => {
              if (node.__type === 'text') {
                const style = node.getStyle();
                if (style && style.includes('background')) {
                  node.setStyle('');
                }
              }
            });
          }
        });
        break;
      default:
        break;
    }
  }, []);

  // Exponer métodos al ref (solo una vez)
  useEffect(() => {
    if (ref) {
      const refObject = typeof ref === 'function' ? null : ref;
      if (refObject) {
        // Inicializar el objeto ref si no existe
        if (!refObject.current) {
          refObject.current = {};
        }

        // Actualizar métodos
        refObject.current.handleEditAction = handleEditAction;
        refObject.current.handleUndo = handleUndo;
        refObject.current.handleRedo = handleRedo;
        refObject.current.insertText = (text) => {
          if (!lexicalEditorRef.current) return;
          lexicalEditorRef.current.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              selection.insertText(text);
            }
          });
        };
        refObject.current.isEditorFocused = isEditorFocused;
        refObject.current.lastUserInteraction = lastUserInteraction;
        refObject.current.isActivelyEditing = () => {
          const timeSinceInteraction = Date.now() - refObject.current.lastUserInteraction;
          const isActive = refObject.current.isEditorFocused || timeSinceInteraction < 5000;
          console.log('[SAVE-CYCLE] isActivelyEditing:', isActive, 'focused:', refObject.current.isEditorFocused, 'timeSince:', timeSinceInteraction);
          return isActive;
        };
      } else if (typeof ref === 'function') {
        ref({
          handleEditAction,
          handleUndo,
          handleRedo,
          insertText: (text) => {
            if (!lexicalEditorRef.current) return;
            lexicalEditorRef.current.update(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) {
                selection.insertText(text);
              }
            });
          },
          isEditorFocused,
          lastUserInteraction,
          isActivelyEditing: () => {
            const timeSinceInteraction = Date.now() - lastUserInteraction;
            const isActive = isEditorFocused || timeSinceInteraction < 5000;
            return isActive;
          }
        });
      }
    }
  }, [ref, handleEditAction, handleUndo, handleRedo, isEditorFocused, lastUserInteraction]);

  // Registrar callbacks de atajos
  useEffect(() => {
    const unsubs = [
      registerShortcutCallback('bold', () => executeFormat('bold')),
      registerShortcutCallback('italic', () => executeFormat('italic')),
      registerShortcutCallback('underline', () => executeFormat('underline')),
      registerShortcutCallback('strikethrough', () => executeFormat('strikethrough')),
      registerShortcutCallback('find', () => setShowFindReplace(true)),
      registerShortcutCallback('findAndReplace', () => setShowFindReplace(true)),
      registerShortcutCallback('undo', handleUndo),
      registerShortcutCallback('redo', handleRedo),
      registerShortcutCallback('copy', () => handleEditAction('copy')),
      registerShortcutCallback('cut', () => handleEditAction('cut')),
      registerShortcutCallback('paste', () => handleEditAction('paste')),
      registerShortcutCallback('selectAll', () => handleEditAction('selectAll')),
      registerShortcutCallback('spellCheck', onSpellCheck)
    ];

    return () => {
      unsubs.forEach(unsub => unsub && unsub());
    };
  }, [executeFormat, handleUndo, handleRedo]);

  // Track user interactions for content preservation
  useEffect(() => {
    const handleInteraction = () => {
      setLastUserInteraction(Date.now());
      console.log('[SAVE-CYCLE] User interaction detected');
    };

    const handleFocus = () => {
      setIsEditorFocused(true);
      console.log('[SAVE-CYCLE] Editor focused');
    };

    const handleBlur = () => {
      setIsEditorFocused(false);
      console.log('[SAVE-CYCLE] Editor blurred');
    };

    const editorElement = editorRef.current;
    if (editorElement) {
      editorElement.addEventListener('keydown', handleInteraction);
      editorElement.addEventListener('click', handleInteraction);
      editorElement.addEventListener('focus', handleFocus);
      editorElement.addEventListener('blur', handleBlur);

      return () => {
        editorElement.removeEventListener('keydown', handleInteraction);
        editorElement.removeEventListener('click', handleInteraction);
        editorElement.removeEventListener('focus', handleFocus);
        editorElement.removeEventListener('blur', handleBlur);
      };
    }
  }, []);

  // Sincronizar metadata con activeFile
  useEffect(() => {
    if (activeFile) {
      setEditedName(activeFile.name.replace(/\.(txt|canvas)$/i, ''));
      setMetadataStatus(activeFile.status || 'draft');
      setMetadataGoal(activeFile.goal || 30000);
    }
  }, [activeFile]);

  // Manejadores de metadata
  const handleNameEdit = () => {
    setIsEditingName(true);
  };

  const handleNameBlur = async () => {
    setIsEditingName(false);

    const displayName = activeFile.name.replace(/\.(txt|canvas)$/i, '');

    // Validar nombre
    if (!editedName || editedName.trim() === '') {
      setEditedName(displayName);
      return;
    }

    // Si el nombre no cambió, no hacer nada
    if (editedName === displayName) {
      return;
    }

    // Validar caracteres inválidos
    const invalidChars = /[<>:"/\\|?*]/g;
    if (invalidChars.test(editedName)) {
      alert(t('notifications.invalidCharacters') || 'El nombre contiene caracteres inválidos');
      setEditedName(displayName);
      return;
    }

    // Renombrar archivo usando el callback del padre
    if (onRenameFile) {
      const success = await onRenameFile(editedName);
      if (!success) {
        // Si falla, restaurar el nombre original
        setEditedName(displayName);
      }
    }
  };

  const handleStatusChange = async (newStatus) => {
    setMetadataStatus(newStatus);

    // Guardar cambio en metadata
    try {
      await window.electronAPI.updateFileMetadata(activeFile.fullPath, {
        status: newStatus
      });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleGoalChange = async (newGoal) => {
    const goalValue = parseInt(newGoal, 10);
    if (isNaN(goalValue) || goalValue < 0) return;

    setMetadataGoal(goalValue);

    // Guardar cambio en metadata
    try {
      await window.electronAPI.updateFileMetadata(activeFile.fullPath, {
        goal: goalValue
      });
    } catch (error) {
      console.error('Error updating goal:', error);
    }
  };

  // Manejadores de icono personalizado
  const handleIconClick = () => {
    if (iconButtonRef.current) {
      const rect = iconButtonRef.current.getBoundingClientRect();
      // Posicionar debajo del botón
      setIconSelectorPosition({
        top: rect.bottom + 8,
        left: rect.left
      });
    }
    setShowIconSelector(prev => !prev);
  };

  const handleIconSelect = (iconId) => {
    if (onSetFileIcon && activeFile) {
      onSetFileIcon(activeFile.fullPath, iconId);
    }
    setShowIconSelector(false);
  };

  const handleIconSelectorClose = () => {
    setShowIconSelector(false);
  };

  // Obtener el icono actual del archivo
  const getCurrentIcon = () => {
    if (activeFile?.customIcon) {
      const icon = getIconById(activeFile.customIcon);
      return icon || DEFAULT_FILE_ICON;
    }
    return DEFAULT_FILE_ICON;
  };

  const handleSubFileClick = (subFile) => {
    // Buscar la pestaña en el padre si existe o abrir nueva
    if (onOpenSubFile) {
      onOpenSubFile(subFile);
    }
  };

  const handleCreateSubFileInternal = () => {
    if (activeFile && onCreateSubFile) {
      onCreateSubFile(activeFile);
    }
  };

  return (
    <div className="editor-wrapper">
      {activeFile && (
        <LexicalComposer key={activeFile?.fullPath || 'empty'} initialConfig={initialConfig}>
          {/* Contenedor interno para asegurar el layout horizontal entre editor y sidebar */}
          <div className="editor-container-inner">
            <div className="editor-layout">
              <div className="editor-content">
                <div className="editor-scroll">
                  {(findOverlayRects.length > 0 || findCurrentRects.length > 0) && (
                    <div className="find-overlay" aria-hidden="true">
                      {findOverlayRects.map((r, idx) => (
                        <div
                          key={`m-${idx}`}
                          className="find-overlay-match"
                          style={{ top: `${r.top}px`, left: `${r.left}px`, width: `${r.width}px`, height: `${r.height}px` }}
                        />
                      ))}
                      {findCurrentRects.map((r, idx) => (
                        <div
                          key={`c-${idx}`}
                          className="find-overlay-current"
                          style={{ top: `${r.top}px`, left: `${r.left}px`, width: `${r.width}px`, height: `${r.height}px` }}
                        />
                      ))}
                    </div>
                  )}

                  <div className="editor-metadata">
                    <button
                      className="file-icon-large file-icon-button"
                      onClick={handleIconClick}
                      ref={iconButtonRef}
                      title="Cambiar icono"
                      aria-label="Cambiar icono del archivo"
                    >
                      <Icon 
                        path={getCurrentIcon().icon} 
                        size={1.2} 
                        color={getCurrentIcon().color}
                      />
                    </button>
                    <div className="active-file-header">
                      {isEditingName ? (
                        <input
                          type="text"
                          className="active-file-title-input"
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          onBlur={handleNameBlur}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.target.blur();
                            } else if (e.key === 'Escape') {
                              setEditedName(activeFile.name.replace(/\.(txt|canvas)$/i, ''));
                              setIsEditingName(false);
                            }
                          }}
                          autoFocus
                        />
                      ) : (
                        <h1
                          className="active-file-title"
                          onClick={handleNameEdit}
                          title="Click para editar"
                        >
                          {activeFile.name.replace(/\.(txt|canvas)$/i, '')}
                        </h1>
                      )}
                    </div>
                  </div>

                  <div className="editor-main">
                    {/* Renderizar Sub-archivos integrados al inicio del editor (solo si no están en el texto) */}
                    <div className="editor-integrated-subfiles" contentEditable={false}>
                      {subFiles && subFiles
                        .filter(f => !placedSubFilePaths.has(f.fullPath))
                        .map((subFile) => {
                          const iconId = subFile.customIcon;
                          const iconData = iconId ? getIconById(iconId) : DEFAULT_FILE_ICON;
                          const lastUpdate = subFile.lastUpdated ? new Date(subFile.lastUpdated).toLocaleDateString() : 'Reciente';
                          
                          return (
                            <div 
                              key={subFile.fullPath} 
                              className="lexical-subfile-card"
                              onClick={() => {
                                if (onOpenSubFile) onOpenSubFile(subFile);
                              }}
                              draggable={true}
                              onDragStart={(e) => {
                                e.dataTransfer.setData('application/json', JSON.stringify({
                                  type: 'subfile-internal',
                                  fullPath: subFile.fullPath,
                                  data: subFile
                                }));
                              }}
                            >
                              <div className="lexical-subfile-drag-handle">
                                <Icon path={mdi.mdiDragVertical} size={0.7} />
                              </div>
                              <div className="lexical-subfile-icon">
                                <Icon path={iconData.icon} size={0.9} color={iconData.color || 'var(--accent-primary)'} />
                              </div>
                              <div className="lexical-subfile-info">
                                <span className="lexical-subfile-name">{subFile.name.replace(/\.(txt|canvas)$/i, '')}</span>
                                <span className="lexical-subfile-meta">{lastUpdate} • {subFile.lastCharCount || 0} caracteres</span>
                              </div>
                              <Icon path={mdi.mdiChevronRight} size={0.8} color="var(--text-tertiary)" />
                            </div>
                          );
                        })}
                    </div>

                    <RichTextPlugin
                      contentEditable={
                        <ContentEditable
                          className={`editor-body ${config?.editorEffects?.enableBlockquoteStyle ? 'enable-blockquote-style' : ''}`}
                          spellCheck="true"
                          ref={editorRef}
                          onContextMenu={handleContextMenu}
                        />
                      }
                      placeholder={null}
                      ErrorBoundary={LexicalErrorBoundary}
                    />

                    <HistoryPlugin />
                    <CustomClipboardPlugin handleEditAction={handleEditAction} />
                    <EditorCapturePlugin lexicalEditorRef={lexicalEditorRef} onOpenSubFile={onOpenSubFile} />
                    <OnChangePluginComponent onChange={onChange} setEditorContent={setEditorContent} />
                    <PlaceholderPlugin />
                    <FloatingToolbarPlugin setShowToolbar={setShowToolbar} setToolbarPosition={setToolbarPosition} setActiveFormats={setActiveFormats} setShowTextColorPicker={setShowTextColorPicker} setShowHighlightPicker={setShowHighlightPicker} />
                    <SubFileDragDropPlugin subFiles={subFiles} />
                    <SubFileTrackerPlugin setPlacedSubFilePaths={setPlacedSubFilePaths} />
                    <CustomKeyboardPlugin getAllShortcuts={getAllShortcuts} matchesShortcut={matchesShortcut} setShowFindReplace={setShowFindReplace} />
                    <KeyboardShortcutPlugin getAllShortcuts={getAllShortcuts} matchesShortcut={matchesShortcut} />
                    <SlashMenuPlugin setShowSlashMenu={setShowSlashMenu} setSlashMenuPosition={setSlashMenuPosition} setSlashSearchQuery={setSlashSearchQuery} setSlashSelectedIndex={setSlashSelectedIndex} />
                    <LinkClickPlugin setLinkTooltip={setLinkTooltip} />
                    <ListPlugin />
                    <LinkPlugin />
                    <HorizontalRulePlugin />
                    <ParagraphIDPlugin />
                    {(config?.editorEffects?.enableMarkdownShortcuts !== false) && (
                      <MarkdownShortcutPlugin transformers={[
                        ...TRANSFORMERS,
                        {
                          dependencies: [HorizontalRuleNode],
                          export: (node) => $isHorizontalRuleNode(node) ? '---' : null,
                          importRegExp: /^(---|\*\*\*|___)$/,
                          regExp: /^(---|\*\*\*|___)$/,
                          replace: (parentNode) => {
                            const hrNode = $createHorizontalRuleNode();
                            parentNode.replace(hrNode);
                            // Crear nuevo párrafo después del HR
                            const newParagraph = $createParagraphNode();
                            hrNode.insertAfter(newParagraph);
                            newParagraph.select();
                          },
                          type: 'element',
                        }
                      ]} />
                    )}
                  </div>
                </div>

                {/* El SubFilesFooter ha sido eliminado según instrucciones del usuario */}
              </div>
            </div>

            {/* EditorSidebar - botones de acción */}
            {activeFile && showSidebar && (
              <EditorSidebar
                activeFile={activeFile}
                editorContent={editorContent || ''}
                onOpenComments={onOpenComments}
                activeRightPanel={activeRightPanel}
                onToggleSpecialChars={onToggleSpecialChars}
                isSplitView={isSplitView}
                onInsertText={(text) => {
                  if (ref && typeof ref !== 'function' && ref.current?.insertText) {
                    ref.current.insertText(text);
                  } else if (lexicalEditorRef.current) {
                    lexicalEditorRef.current.update(() => {
                      const selection = $getSelection();
                      if ($isRangeSelection(selection)) {
                        selection.insertText(text);
                      }
                    });
                  }
                }}
                commentCount={activeFile.comments?.length || 0}
                config={config}
              />
            )}

            {/* Paneles como overlays absolutos - no afectan el layout */}
            {activeRightPanel === 'comments' && showSidebar && (
              <div className="editor-panel-overlay">
                <CommentsSidebar
                  comments={activeFile?.comments || []}
                  fileName={activeFile?.name}
                  onClose={() => setActiveRightPanel(null)}
                  isSplitView={isSplitView}
                  onAddComment={onAddComment}
                  onDeleteComment={onDeleteComment}
                />
              </div>
            )}

            {activeRightPanel === 'specialChars' && showSidebar && (
              <div className="editor-panel-overlay">
                <SpecialCharsPanel
                  onClose={() => setActiveRightPanel(null)}
                  onInsertText={(text) => {
                    if (lexicalEditorRef.current) {
                      lexicalEditorRef.current.update(() => {
                        const selection = $getSelection();
                        if ($isRangeSelection(selection)) {
                          selection.insertText(text);
                        }
                      });
                    }
                  }}
                />
              </div>
            )}
          </div>
          
          {showToolbar && (
            <div
              className="formatting-toolbar"
              style={{
                left: toolbarPosition.x - 150,
                top: toolbarPosition.y
              }}
            >
              <div className="format-group">
                <button
                  className={`format-btn ${activeFormats.bold ? 'active' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    executeFormat('bold');
                  }}
                  title="Negrita (Ctrl+B)"
                >
                  <Icon path={mdiFormatBold} size={0.7} />
                </button>
                <button
                  className={`format-btn ${activeFormats.italic ? 'active' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    executeFormat('italic');
                  }}
                  title="Cursiva (Ctrl+I)"
                >
                  <Icon path={mdiFormatItalic} size={0.7} />
                </button>
                <button
                  className={`format-btn ${activeFormats.underline ? 'active' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    executeFormat('underline');
                  }}
                  title="Subrayado (Ctrl+U)"
                >
                  <Icon path={mdiFormatUnderline} size={0.7} />
                </button>
                <button
                  className={`format-btn ${activeFormats.strikethrough ? 'active' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    executeFormat('strikethrough');
                  }}
                  title="Tachado"
                >
                  <Icon path={mdiFormatStrikethrough} size={0.7} />
                </button>
              </div>

              <div className="format-group">
                <button
                  className="format-btn"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    toggleHeading('h1');
                  }}
                  title="Título 1"
                >
                  H1
                </button>
                <button
                  className="format-btn"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    toggleHeading('h2');
                  }}
                  title="Título 2"
                >
                  H2
                </button>
                <button
                  className="format-btn"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    toggleHeading('h3');
                  }}
                  title="Título 3"
                >
                  H3
                </button>
              </div>

              <div className="format-group">
                <button
                  className="format-btn"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    toggleList('ul');
                  }}
                  title="Lista"
                >
                  <Icon path={mdiFormatListBulleted} size={0.7} />
                </button>
                <button
                  className="format-btn"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    toggleBlockquote();
                  }}
                  title="Cita"
                >
                  <Icon path={mdiFormatQuoteClose} size={0.7} />
                </button>
              </div>

              {config?.editorEffects?.enableHighlights && (
                <div className="format-group">
                  <button
                    className="format-btn"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setShowHighlightPicker(!showHighlightPicker);
                    }}
                    title="Resaltar"
                  >
                    <Icon path={mdiMarker} size={0.7} />
                  </button>
                  {showHighlightPicker && (
                    <div className="highlight-picker">
                      <button
                        onMouseDown={(e) => { e.preventDefault(); applyHighlight('none'); }}
                        style={{ background: 'transparent', border: '2px solid #ccc', position: 'relative' }}
                        title="Quitar resaltado"
                      >
                        <Icon path={mdiClose} size={0.5} color="#666" />
                      </button>
                      <button onMouseDown={(e) => { e.preventDefault(); applyHighlight('#ffeb3b'); }} style={{ background: '#ffeb3b' }} title="Amarillo"></button>
                      <button onMouseDown={(e) => { e.preventDefault(); applyHighlight('#4caf50'); }} style={{ background: '#4caf50' }} title="Verde"></button>
                      <button onMouseDown={(e) => { e.preventDefault(); applyHighlight('#2196f3'); }} style={{ background: '#2196f3' }} title="Azul"></button>
                      <button onMouseDown={(e) => { e.preventDefault(); applyHighlight('#ff9800'); }} style={{ background: '#ff9800' }} title="Naranja"></button>
                      <button onMouseDown={(e) => { e.preventDefault(); applyHighlight('#f44336'); }} style={{ background: '#f44336' }} title="Rojo"></button>
                    </div>
                  )}
                </div>
              )}

              {config?.editorEffects?.enableTextColors && (
                <div className="format-group">
                  <button
                    className="format-btn"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setShowTextColorPicker(!showTextColorPicker);
                    }}
                    title="Color de texto"
                  >
                    <Icon path={mdiPalette} size={0.7} />
                  </button>
                  {showTextColorPicker && (
                    <div className="text-color-picker">
                      <button
                        onMouseDown={(e) => { e.preventDefault(); applyTextColor('none'); }}
                        style={{ background: 'transparent', border: '2px solid #ccc', position: 'relative' }}
                        title="Quitar color"
                      >
                        <Icon path={mdiClose} size={0.5} color="#666" />
                      </button>
                      <button onMouseDown={(e) => { e.preventDefault(); applyTextColor('#000000'); }} style={{ background: '#000000' }} title="Negro"></button>
                      <button onMouseDown={(e) => { e.preventDefault(); applyTextColor('#f44336'); }} style={{ background: '#f44336' }} title="Rojo"></button>
                      <button onMouseDown={(e) => { e.preventDefault(); applyTextColor('#2196f3'); }} style={{ background: '#2196f3' }} title="Azul"></button>
                      <button onMouseDown={(e) => { e.preventDefault(); applyTextColor('#4caf50'); }} style={{ background: '#4caf50' }} title="Verde"></button>
                      <button onMouseDown={(e) => { e.preventDefault(); applyTextColor('#ff9800'); }} style={{ background: '#ff9800' }} title="Naranja"></button>
                      <button onMouseDown={(e) => { e.preventDefault(); applyTextColor('#9c27b0'); }} style={{ background: '#9c27b0' }} title="Morado"></button>
                    </div>
                  )}
                </div>
              )}

              <div className="format-group">
                <button
                  className="format-btn"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertLink();
                  }}
                  title="Insertar enlace"
                >
                  <Icon path={mdiLink} size={0.7} />
                </button>
                <button
                  className="format-btn"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    executeFormat('code');
                  }}
                  title="Código inline"
                >
                  <Icon path={mdiCodeTags} size={0.7} />
                </button>
              </div>
            </div>
          )}

          <FindReplace
            isOpen={showFindReplace}
            onClose={() => {
              setShowFindReplace(false);
              clearFindHighlight();
            }}
            editorRef={editorRef}
            onReplace={(searchTerm, replaceTerm, replaceAll) => {
              // Implementar find & replace con Lexical
              if (lexicalEditorRef.current) {
                lexicalEditorRef.current.update(() => {
                  const root = $getRoot();
                  const textContent = root.getTextContent();
                  const newContent = replaceAll
                    ? textContent.replaceAll(searchTerm, replaceTerm)
                    : textContent.replace(searchTerm, replaceTerm);

                  root.clear();
                  const paragraph = $createParagraphNode();
                  paragraph.append($createTextNode(newContent));
                  root.append(paragraph);
                });
              }
            }}
            onNavigate={(searchTerm, matchIndex, caseSensitive) => {
              navigateToMatchDom(searchTerm, matchIndex, caseSensitive);
            }}
          />
        </LexicalComposer>
      )}

      {/* SlashMenu fuera del LexicalComposer */}
      {showSlashMenu && (
        <SlashMenu
          position={slashMenuPosition}
          searchQuery={slashSearchQuery}
          onSelect={handleSlashCommand}
          onClose={() => setShowSlashMenu(false)}
          selectedIndex={slashSelectedIndex}
          onNavigate={setSlashSelectedIndex}
        />
      )}

      {/* LinkModal */}
      <LinkModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onInsert={handleInsertLink}
        initialUrl={linkModalData.url}
        initialText={linkModalData.text}
      />

      {/* IconSelector */}
      {showIconSelector && (
        <IconSelector
          onSelect={handleIconSelect}
          onClose={handleIconSelectorClose}
          style={{
            position: 'fixed',
            top: iconSelectorPosition.top,
            left: iconSelectorPosition.left,
            zIndex: 10000
          }}
        />
      )}

      {/* SpellingContextMenu */}
      {spellingMenu && (
        <SpellingContextMenu
          word={spellingMenu.word}
          suggestions={spellingMenu.suggestions}
          x={spellingMenu.x}
          y={spellingMenu.y}
          onReplace={(newWord) => {
            if (spellingMenu.fromSpellCheck && window.electronAPI?.replaceMisspelling) {
              window.electronAPI.replaceMisspelling(newWord);
            } else if (lexicalEditorRef.current) {
              lexicalEditorRef.current.update(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                  selection.insertText(newWord);
                }
              });
            }
            setSpellingMenu(null);
          }}
          onAddToDictionary={(word) => {
            if (word && window.electronAPI?.addWordToSpellDictionary) {
              window.electronAPI.addWordToSpellDictionary(word);
            }
            setSpellingMenu(null);
          }}
          onIgnore={() => setSpellingMenu(null)}
          onEditAction={handleEditAction}
          onClose={() => setSpellingMenu(null)}
        />
      )}

      {/* LinkTooltip */}
      {linkTooltip && (
        <LinkTooltip
          url={linkTooltip.url}
          position={linkTooltip.position}
          onOpen={handleLinkTooltipOpen}
          onCopy={handleLinkTooltipCopy}
          onRemove={handleLinkTooltipRemove}
          onClose={() => setLinkTooltip(null)}
        />
      )}
    </div>
  );
});

export default LexicalEditor;