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

      // Intentar mover via Electron API
      let movedToPath = null;
      if (window.electronAPI) {
        // moveFile may return the final dest path
        movedToPath = await window.electronAPI.moveFile(sourcePath, targetPath);
      }

      // Actualizar estructura local
      // Actualizar estructura local: remover por fullPath y colocar bajo targetPath
      const updatedProjects = JSON.parse(JSON.stringify(projects));

      // Helper: buscar y remover por fullPath en proyectos
      let removedItem = null;
      const removeByFullPath = (items) => {
        if (!Array.isArray(items)) return false;
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          if (it.fullPath === sourcePath) {
            removedItem = items.splice(i, 1)[0];
            return true;
          }
          if (it.items && removeByFullPath(it.items)) return true;
        }
        return false;
      };

      for (const proj of updatedProjects) {
        if (proj.items && removeByFullPath(proj.items)) break;
      }

      // Determinar destino: si targetPath coincide con project.path -> insertar en root de ese proyecto
      let inserted = false;
      if (removedItem) {
        // if movedToPath provided, compute parent folder
        const destFull = movedToPath || targetPath;
        const lastSlash = destFull.lastIndexOf('/');
        const parentFull = lastSlash >= 0 ? destFull.slice(0, lastSlash) : destFull;

        // Buscar proyecto cuyo path coincide con parentFull
        for (const proj of updatedProjects) {
          if (proj.path === parentFull) {
            proj.items = proj.items || [];
            proj.items.push(removedItem);
            inserted = true;
            break;
          }
        }

        if (!inserted) {
          // Buscar nodo con fullPath == parentFull
          const findAndInsert = (items) => {
            if (!Array.isArray(items)) return false;
            for (const it of items) {
              if (it.fullPath === parentFull) {
                it.items = it.items || [];
                it.items.push(removedItem);
                return true;
              }
              if (it.items && findAndInsert(it.items)) return true;
            }
            return false;
          };

          for (const proj of updatedProjects) {
            if (proj.items && findAndInsert(proj.items)) { inserted = true; break; }
          }
        }

        // Fallback: si no se insertó, añadir al primer proyecto
        if (!inserted && updatedProjects.length > 0) {
          updatedProjects[0].items = updatedProjects[0].items || [];
          updatedProjects[0].items.push(removedItem);
        }
      }

      onUpdateProjects(updatedProjects);
      onNotify('Archivo movido correctamente', 'success');

      // Notificar al main/App para persistir actualizaciones locales
      onLocalUpdate && onLocalUpdate({ type: 'move', oldPath: sourcePath, newPath: movedToPath || targetPath, destParent: movedToPath || targetPath });

    } catch (error) {
      console.error('Error in drop:', error);
      onNotify('Error al mover el archivo', 'error');
    } finally {
      setDragState({
        isDragging: false,
        draggedItem: null,
        draggedPath: null,
        draggedProjectIndex: null,
        dragOverId: null
      });
    }
  }, [projects, onUpdateProjects, onNotify]);

  return {
    dragState,
    startDrag,
    handleDragOver,
    handleDragLeave,
    handleDrop
  };
}

export default useDragDrop;
