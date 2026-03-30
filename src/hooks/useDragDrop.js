/**
 * ============================================================================
 * HOOK: useDragDrop
 * ============================================================================
 * 
 * Hook personalizado para gestionar Drag & Drop de proyectos/archivos.
 * 
 * FUNCIONALIDADES:
 * - Arrastrar proyectos y archivos
 * - Drop en carpetas o root
 * - Feedback visual (dragging, drag-over)
 * - Sincronización con filesystem
 * - Validaciones (no arrastrar sobre sí mismo)
 * 
 * USO:
 * const { dragState, startDrag, handleDragOver, handleDrop } = useDragDrop(
 *   projects,
 *   onUpdateProjects,
 *   onNotify
 * );
 * 
 * @param {Array} projects - Lista de proyectos
 * @param {function} onUpdateProjects - Callback para actualizar proyectos
 * @param {function} onNotify - Callback para notificaciones
 * @returns {Object} { dragState, startDrag, handleDragOver, handleDrop }
 */

import { useState, useCallback, useRef } from 'react';

export function useDragDrop(projects = [], onUpdateProjects = () => {}, onNotify = () => {}, onLocalUpdate = () => {}) {
  const [dragState, setDragState] = useState({
    isDragging: false,
    draggedItem: null,
    draggedPath: null,
    draggedProjectIndex: null,
    dragOverId: null
  });

  const dragStateRef = useRef(dragState);

  // Actualizar ref cuando dragState cambia
  const updateDragStateRef = (newState) => {
    const updated = { ...dragState, ...newState };
    setDragState(updated);
    dragStateRef.current = updated;
  };

  /**
   * Inicia el dragging
   */
  const startDrag = useCallback((event, item, projectIndex) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', item.id);

    updateDragStateRef({
      isDragging: true,
      draggedItem: item,
      draggedProjectIndex: projectIndex,
      draggedPath: item.path
    });
  }, []);

  /**
   * Maneja drag over de elementos
   */
  const handleDragOver = useCallback((event, targetItemId = null) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    updateDragStateRef({
      ...dragStateRef.current,
      dragOverId: targetItemId
    });
  }, []);

  /**
   * Maneja drag leave
   */
  const handleDragLeave = useCallback((event) => {
    updateDragStateRef({
      ...dragStateRef.current,
      dragOverId: null
    });
  }, []);

  /**
   * Maneja el drop de elementos
   */
  const handleDrop = useCallback(async (event, targetPath = null, targetItemId = null) => {
    event.preventDefault();
    event.stopPropagation();

    if (!dragStateRef.current.isDragging || !dragStateRef.current.draggedItem) {
      return;
    }

    try {
      const draggedItem = dragStateRef.current.draggedItem;
      const sourcePath = dragStateRef.current.draggedPath;

      // Validaciones
      if (sourcePath === targetPath) {
        onNotify('No puedes arrastrar sobre el mismo elemento', 'warning');
        return;
      }

      console.log('[DRAG-DROP] Moviendo archivo:', { sourcePath, targetPath });

      // Intentar mover via Electron API
      let movedToPath = null;
      if (window.electronAPI) {
        movedToPath = await window.electronAPI.moveFile(sourcePath, targetPath);
        console.log('[DRAG-DROP] Archivo movido a:', movedToPath);
      }

      // Actualizar estructura local
      const updatedProjects = JSON.parse(JSON.stringify(projects));

      // 1. Remover item de su ubicación actual (búsqueda recursiva mejorada)
      let removedItem = null;
      const removeByFullPath = (items) => {
        if (!Array.isArray(items)) return false;
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          if (it.fullPath === sourcePath) {
            removedItem = items.splice(i, 1)[0];
            console.log('[DRAG-DROP] Item removido:', removedItem.name);
            return true;
          }
          // Búsqueda recursiva en items anidados
          if (it.items && removeByFullPath(it.items)) {
            return true;
          }
        }
        return false;
      };

      // Buscar en todos los proyectos
      for (const proj of updatedProjects) {
        if (proj.items && removeByFullPath(proj.items)) break;
      }

      if (!removedItem) {
        console.error('[DRAG-DROP] No se pudo encontrar el item a mover');
        onNotify('Error: archivo no encontrado', 'error');
        return;
      }

      // 2. Actualizar fullPath del item movido
      removedItem.fullPath = movedToPath || targetPath;

      // 3. Insertar en nueva ubicación (búsqueda recursiva mejorada)
      const insertIntoTarget = (items, targetFullPath) => {
        if (!Array.isArray(items)) return false;
        for (const item of items) {
          if (item.fullPath === targetFullPath) {
            item.items = item.items || [];
            item.items.push(removedItem);
            console.log('[DRAG-DROP] Item insertado en:', item.name);
            return true;
          }
          // Búsqueda recursiva en items anidados
          if (item.items && insertIntoTarget(item.items, targetFullPath)) {
            return true;
          }
        }
        return false;
      };

      let inserted = false;

      // Intentar insertar en proyecto raíz
      for (const proj of updatedProjects) {
        if (proj.path === targetPath) {
          proj.items = proj.items || [];
          proj.items.push(removedItem);
          inserted = true;
          console.log('[DRAG-DROP] Item insertado en proyecto raíz:', proj.name);
          break;
        }
      }

      // Si no se insertó en raíz, buscar en carpetas anidadas
      if (!inserted) {
        for (const proj of updatedProjects) {
          if (proj.items && insertIntoTarget(proj.items, targetPath)) {
            inserted = true;
            break;
          }
        }
      }

      // Fallback: si no se insertó, añadir al primer proyecto
      if (!inserted && updatedProjects.length > 0) {
        console.warn('[DRAG-DROP] Fallback: insertando en primer proyecto');
        updatedProjects[0].items = updatedProjects[0].items || [];
        updatedProjects[0].items.push(removedItem);
      }

      // 4. Actualizar referencias en openTabs si el archivo está abierto
      if (window.updateOpenTabsPath) {
        window.updateOpenTabsPath(sourcePath, movedToPath || targetPath);
      }

      onUpdateProjects(updatedProjects);
      onNotify('Archivo movido correctamente', 'success');

      // Notificar al main/App para persistir actualizaciones locales
      onLocalUpdate && onLocalUpdate({ 
        type: 'move', 
        oldPath: sourcePath, 
        newPath: movedToPath || targetPath 
      });

    } catch (error) {
      console.error('[DRAG-DROP] Error:', error);
      onNotify('Error al mover el archivo: ' + error.message, 'error');
    } finally {
      setDragState({
        isDragging: false,
        draggedItem: null,
        draggedPath: null,
        draggedProjectIndex: null,
        dragOverId: null
      });
    }
  }, [projects, onUpdateProjects, onNotify, onLocalUpdate]);

  return {
    dragState,
    startDrag,
    handleDragOver,
    handleDragLeave,
    handleDrop
  };
}

export default useDragDrop;
