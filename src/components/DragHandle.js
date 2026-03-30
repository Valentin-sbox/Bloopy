/**
 * ============================================================================
 *  DRAGHANDLE.JS
 * ============================================================================
 * 
 * COMPONENTE: DRAG HANDLE PARA REORDENAR BLOQUES
 * 
 * Componente que renderiza un handle visual (⋮⋮) al lado de cada bloque
 * del editor, permitiendo reordenar bloques mediante drag and drop.
 * 
 * FUNCIONALIDADES:
 * - Renderizado de handle visual posicionado absolutamente
 * - Visibilidad basada en hover sobre el bloque
 * - Drag and drop usando HTML5 API
 * - Indicador visual de posición de drop
 * - Preservación de atributos al reordenar
 * 
 * PROPS:
 * - blockElement: HTMLElement - Elemento del bloque asociado
 * - blockIndex: number - Índice del bloque en el editor
 * - onDragStart: function(element, index) - Callback al iniciar drag
 * - onDragEnd: function(element, index) - Callback al finalizar drag
 * 
 * RELACIONADO CON:
 * - src/components/Editor.js: Integra los DragHandles
 * - src/styles/drag-handles.css: Estilos del componente
 * ============================================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import '../styles/drag-handles.css';

const DragHandle = ({ blockElement, blockIndex, onDragStart, onDragEnd }) => {
  const [visible, setVisible] = useState(false);
  const hideTimeoutRef = useRef(null);
  const handleRef = useRef(null);

  useEffect(() => {
    if (!blockElement) return;

    // Mostrar handle al hacer hover sobre el bloque
    const handleMouseEnter = () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      setVisible(true);
    };

    // Ocultar handle después de 300ms al salir del hover
    const handleMouseLeave = () => {
      hideTimeoutRef.current = setTimeout(() => {
        setVisible(false);
      }, 300);
    };

    // También mantener visible si el mouse está sobre el handle
    const handleHandleEnter = () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      setVisible(true);
    };

    const handleHandleLeave = () => {
      hideTimeoutRef.current = setTimeout(() => {
        setVisible(false);
      }, 300);
    };

    blockElement.addEventListener('mouseenter', handleMouseEnter);
    blockElement.addEventListener('mouseleave', handleMouseLeave);

    const handle = handleRef.current;
    if (handle) {
      handle.addEventListener('mouseenter', handleHandleEnter);
      handle.addEventListener('mouseleave', handleHandleLeave);
    }

    return () => {
      blockElement.removeEventListener('mouseenter', handleMouseEnter);
      blockElement.removeEventListener('mouseleave', handleMouseLeave);
      if (handle) {
        handle.removeEventListener('mouseenter', handleHandleEnter);
        handle.removeEventListener('mouseleave', handleHandleLeave);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [blockElement]);

  const handleDragStart = (e) => {
    e.stopPropagation();
    
    // Aplicar estilos de arrastre al bloque
    if (blockElement) {
      blockElement.style.opacity = '0.5';
      blockElement.classList.add('dragging');
    }

    // Notificar al padre
    if (typeof onDragStart === 'function') {
      onDragStart(blockElement, blockIndex);
    }

    // Configurar datos de transferencia
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', blockElement.outerHTML);
    e.dataTransfer.setData('text/plain', blockIndex.toString());
  };

  const handleDrag = (e) => {
    // Durante el drag, el componente padre manejará la lógica de posicionamiento
    e.stopPropagation();
  };

  const handleDragEnd = (e) => {
    e.stopPropagation();

    // Restaurar estilos del bloque
    if (blockElement) {
      blockElement.style.opacity = '';
      blockElement.classList.remove('dragging');
    }

    // Notificar al padre
    if (typeof onDragEnd === 'function') {
      onDragEnd(blockElement, blockIndex);
    }
  };

  if (!blockElement) return null;

  // Calcular posición del handle relativa al bloque
  const blockRect = blockElement.getBoundingClientRect();
  const editorBody = blockElement.closest('.editor-body');
  const editorRect = editorBody ? editorBody.getBoundingClientRect() : { left: 0, top: 0 };

  const handleStyle = {
    position: 'absolute',
    left: `${blockRect.left - editorRect.left - 30}px`,
    top: `${blockRect.top - editorRect.top}px`,
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? 'auto' : 'none',
    transition: 'opacity 0.15s ease',
  };

  return (
    <div
      ref={handleRef}
      className="drag-handle"
      style={handleStyle}
      draggable={true}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      title="Arrastrar para reordenar"
    >
      <span className="drag-handle-icon">⋮⋮</span>
    </div>
  );
};

export default DragHandle;
