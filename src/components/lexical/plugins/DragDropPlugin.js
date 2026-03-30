/**
 * ============================================================================
 * DRAG & DROP PLUGIN - OPTIMIZADO
 * ============================================================================
 * 
 * Plugin para arrastrar y soltar párrafos completos con handles visuales
 * ============================================================================
 */

import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { 
  $getRoot,
  $isParagraphNode,
  $isElementNode
} from 'lexical';
import { $isHeadingNode } from '@lexical/rich-text';

export function DragDropPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    let rootElement = editor.getRootElement();
    let dropIndicator = null;
    let observer = null;
    let unregisterUpdate = null;
    let unregisterRoot = null;
    let draggedNode = null;
    let draggedElement = null;
    let scheduled = false;

    let enabled = true;
    try {
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const count = root.getChildren().length;
        if (count > 400) {
          enabled = false;
        }
      });
    } catch {}

    if (!enabled) {
      return () => {};
    }

    const createDropIndicator = (root) => {
      if (dropIndicator) return dropIndicator;
      const indicator = document.createElement('div');
      indicator.className = 'drop-indicator';
      indicator.style.cssText = `
        position: absolute;
        left: 0;
        right: 0;
        height: 3px;
        background: var(--accent-blue);
        pointer-events: none;
        z-index: 5000;
        opacity: 0;
        transition: opacity 0.2s;
        border-radius: 2px;
      `;
      root.appendChild(indicator);
      return indicator;
    };

    const addDragHandles = () => {
      const rootEl = editor.getRootElement();
      if (!rootEl) return;

      // Asegurar que el root tenga posición relativa
      if (getComputedStyle(rootEl).position === 'static') {
        rootEl.style.position = 'relative';
      }

      editor.getEditorState().read(() => {
        const root = $getRoot();
        const children = root.getChildren();
        let addedCount = 0;

        children.forEach(node => {
          const nodeKey = node.getKey();
          const element = editor.getElementByKey(nodeKey);

          if (element && !element.querySelector('.drag-handle')) {
            if ($isParagraphNode(node) || $isHeadingNode(node) || $isElementNode(node)) {
              const handle = document.createElement('div');
              handle.className = 'drag-handle';
              handle.draggable = true;
              handle.contentEditable = false;
              handle.innerHTML = '<span class="drag-handle-icon">⋮⋮</span>';
              
              // Estilos aplicados directamente para asegurar visibilidad inmediata
              handle.style.cssText = `
                position: absolute;
                left: -44px;
                top: 50%;
                transform: translateY(-50%);
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: grab;
                color: var(--accent-blue);
                background: rgba(0, 113, 227, 0.15);
                border-radius: 4px;
                opacity: 0.8;
                transition: all 0.2s ease;
                user-select: none;
                z-index: 2000;
              `;

              // Eventos
              handle.addEventListener('dragstart', (e) => {
                draggedNode = node;
                draggedElement = element;
                element.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', element.innerText);
              });

              handle.addEventListener('dragend', () => {
                if (draggedElement) draggedElement.classList.remove('dragging');
                draggedNode = null;
                draggedElement = null;
                if (dropIndicator) dropIndicator.style.opacity = '0';
              });

              element.style.position = 'relative';
              element.style.overflow = 'visible';
              element.appendChild(handle);
              addedCount++;

              element.addEventListener('mouseenter', () => {
                handle.style.opacity = '1';
                handle.style.background = 'rgba(0, 113, 227, 0.3)';
              });
              element.addEventListener('mouseleave', () => {
                handle.style.opacity = '0.8';
                handle.style.background = 'rgba(0, 113, 227, 0.15)';
              });
            }
          }
        });

        // Fallback para elementos que Lexical no reconoce como bloques pero lo son en el DOM
        const domChildren = Array.from(rootEl.children);
        domChildren.forEach(el => {
          if (el.nodeType === 1 && !el.querySelector('.drag-handle')) {
            const className = el.className || '';
            if (className.includes('editor-paragraph') || className.includes('editor-heading') || className.includes('editor-quote')) {
              // Inyectar handle si no existe
              const handle = document.createElement('div');
              handle.className = 'drag-handle';
              handle.draggable = true;
              handle.contentEditable = false;
              handle.innerHTML = '<span class="drag-handle-icon">⋮⋮</span>';
              handle.style.cssText = `
                position: absolute;
                left: -44px;
                top: 50%;
                transform: translateY(-50%);
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: grab;
                color: var(--accent-blue);
                background: rgba(0, 113, 227, 0.15);
                border-radius: 4px;
                opacity: 0.8;
                z-index: 2000;
              `;
              el.style.position = 'relative';
              el.style.overflow = 'visible';
              el.appendChild(handle);
            }
          }
        });
      });
    };

    const scheduleAddDragHandles = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        addDragHandles();
      });
    };

    const setupListeners = (root) => {
      if (!root) return;

      dropIndicator = createDropIndicator(root);
      
      observer = new MutationObserver(() => {
        scheduleAddDragHandles();
      });

      observer.observe(root, { childList: true });

      unregisterUpdate = editor.registerUpdateListener(() => {
        scheduleAddDragHandles();
      });

      const handleDragStart = (e) => {
        const handle = e.target.closest('.lexical-subfile-drag-handle');
        if (!handle) return;

        const container = e.target.closest('.lexical-subfile-node-container');
        if (!container) return;

        const nodeKey = handle.dataset.nodeKey;
        if (!nodeKey) return;

        const nodeMap = editor.getEditorState()._nodeMap;
        const node = nodeMap.get(nodeKey);
        if (node) {
          draggedNode = node;
          draggedElement = container;
        }
      };

      root.addEventListener('dragstart', handleDragStart);
      root.addEventListener('dragover', handleDragOver);
      root.addEventListener('drop', handleDrop);

      // Guardar referencia para cleanup
      root._subfileDragStartHandler = handleDragStart;
      
      // Ejecución inicial
      setTimeout(() => {
        scheduleAddDragHandles();
      }, 100);
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      if (!draggedElement || !dropIndicator) return;

      const target = getDirectChildOfRoot(e.target);
      if (target && target !== draggedElement) {
        const rect = target.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        const insertBefore = e.clientY < midpoint;

        const rootRect = editor.getRootElement().getBoundingClientRect();
        dropIndicator.style.top = `${(insertBefore ? rect.top : rect.bottom) - rootRect.top}px`;
        dropIndicator.style.opacity = '1';
      }
    };

    const handleDrop = (e) => {
      e.preventDefault();
      if (!draggedNode) return;

      const target = getDirectChildOfRoot(e.target);
      if (!target || target === draggedElement) {
        if (dropIndicator) dropIndicator.style.opacity = '0';
        return;
      }

      editor.update(() => {
        const root = $getRoot();
        const children = root.getChildren();
        
        let draggedIndex = -1;
        let targetIndex = -1;

        children.forEach((child, index) => {
          const element = editor.getElementByKey(child.getKey());
          if (element === draggedElement) draggedIndex = index;
          if (element === target) targetIndex = index;
        });

        if (draggedIndex === -1 || targetIndex === -1) return;

        const rect = target.getBoundingClientRect();
        const insertBefore = e.clientY < rect.top + rect.height / 2;

        const nodeToMove = children[draggedIndex];
        nodeToMove.remove();

        const targetNode = children[targetIndex];
        if (insertBefore) {
          targetNode.insertBefore(nodeToMove);
        } else {
          targetNode.insertAfter(nodeToMove);
        }
      });

      if (dropIndicator) dropIndicator.style.opacity = '0';
      setTimeout(addDragHandles, 50);
    };

    const getDirectChildOfRoot = (node) => {
      const root = editor.getRootElement();
      if (!root || !node) return null;
      let el = node.nodeType === 1 ? node : node.parentElement;
      while (el && el.parentElement !== root) {
        el = el.parentElement;
      }
      return el && el.parentElement === root ? el : null;
    };

    // Registrar listener de root para manejar montado/desmontado
    unregisterRoot = editor.registerRootListener((nextRoot, prevRoot) => {
      if (prevRoot) {
        if (observer) observer.disconnect();
        if (unregisterUpdate) unregisterUpdate();
        if (prevRoot._subfileDragStartHandler) {
          prevRoot.removeEventListener('dragstart', prevRoot._subfileDragStartHandler);
          delete prevRoot._subfileDragStartHandler;
        }
        prevRoot.removeEventListener('dragover', handleDragOver);
        prevRoot.removeEventListener('drop', handleDrop);
      }
      if (nextRoot) {
        setupListeners(nextRoot);
      }
    });

    // Si ya hay un root, configurar
    if (rootElement) {
      setupListeners(rootElement);
    }

    return () => {
      if (observer) observer.disconnect();
      if (unregisterUpdate) unregisterUpdate();
      if (unregisterRoot) unregisterRoot();
      const root = editor.getRootElement();
      if (root) {
        if (root._subfileDragStartHandler) {
          root.removeEventListener('dragstart', root._subfileDragStartHandler);
          delete root._subfileDragStartHandler;
        }
        root.removeEventListener('dragover', handleDragOver);
        root.removeEventListener('drop', handleDrop);
      }
      if (dropIndicator && dropIndicator.parentNode) {
        dropIndicator.parentNode.removeChild(dropIndicator);
      }
    };
  }, [editor]);

  return null;
}
