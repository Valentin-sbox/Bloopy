/**
 * ============================================================================
 *  SIDEBAR.JS
 * ============================================================================
 * 
 * COMPONENTE: BARRA LATERAL (SIDEBAR)
 * 
 * Muestra el perfil del usuario, la lista de proyectos y archivos,
 * y proporciona acceso a la configuración.
 * 
 * FUNCIONALIDADES:
 * - Mostrar perfil de usuario (avatar y nombre)
 * - Listar proyectos y archivos en estructura de árbol
 * - Crear nuevos proyectos y archivos
 * - Renombrar y eliminar elementos (menú contextual)
 * - Expandir/colapsar proyectos
 * - Indicador de progreso circular en cada archivo
 * 
 * PROPS:
 * - projects: Array - Lista de proyectos con sus archivos
 * - activeFile: Object - Archivo actualmente abierto
 * - activeProjectIndex: number - Índice del proyecto activo
 * - collapsed: boolean - Si el sidebar está colapsado
 * - onToggleCollapse: function - Callback para colapsar/expandir
 * - onCreateProject: function - Callback para crear proyecto
 * - onCreateFile: function - Callback para crear archivo
 * - onOpenFile: function - Callback al abrir un archivo
 * - onOpenSettings: function - Callback al abrir configuración
 * - workspacePath: string - Ruta del workspace actual
 * - userName: string - Nombre del usuario
 * - avatar: string - Avatar del usuario (base64)
 * - config: Object - Configuración de la app (para colores de estado)
 * - showConfirm: function - Función para mostrar modal de confirmación
 * - showInput: function - Función para mostrar modal de input
 * - notify: function - Función para mostrar notificaciones
 * - onRefresh: function - Callback para recargar el workspace
 * 
 * RELACIONADO CON:
 * - src/App.js: Gestiona el estado y pasa datos/props
 * - src/styles/index.css: Estilos de .sidebar y elementos relacionados
 * ============================================================================
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { calcRenamedPath } from '../utils/helpers';
import { registerShortcutCallback } from '../utils/shortcuts';
import { useTranslation } from '../utils/i18n';
import { getIconById, DEFAULT_FILE_ICON } from '../utils/iconLibrary';
import Icon from '@mdi/react';
import { 
  mdiViewSplitVertical, 
  mdiFolder, 
  mdiFolderOpen, 
  mdiFileDocument, 
  mdiNote,
  mdiChevronDown,
  mdiChevronRight,
  mdiChevronLeft,
  mdiAlert,
  mdiFolderPlus,
  mdiFile,
  mdiPlus,
  mdiAccount,
  mdiTrashCan,
  mdiFileEdit
} from '@mdi/js';

function Sidebar({
  projects,
  activeFile,
  activeProjectIndex,
  viewingProject,
  collapsed,
  onToggleCollapse,
  onCreateProject,
  onCreateFile,
  onOpenFile,
  onOpenSettings,
  onViewProject,
  workspacePath,
  userName,
  avatar,
  config,
  showConfirm,
  showInput,
  notify,
  onRefresh,
  onLocalUpdate,
  splitMode,
  onCloseSplit,
  onSplitHorizontal,
  fileIcons
}) {
  const { t } = useTranslation();

  const addDragOver = useCallback((el, isValid = true) => {
    if (!el) return;
    if (isValid) {
      el.classList.add('drag-over');
      el.classList.remove('drop-target-invalid');
    } else {
      el.classList.add('drop-target-invalid');
      el.classList.remove('drag-over');
    }
  }, []);

  const removeDragOver = useCallback((el) => {
    if (!el) return;
    el.classList.remove('drag-over');
    el.classList.remove('drop-target-invalid');
  }, []);

  const shouldIgnoreDragLeave = useCallback((e, currentTarget) => {
    const next = e.relatedTarget;
    return !!(next && currentTarget && currentTarget.contains(next));
  }, []);

  /**
   * Determina el icono apropiado para un archivo o carpeta.
   * Asegura que los archivos con hijos muestren icono de archivo, no de carpeta.
   * @param {Object} item - El archivo o carpeta
   * @returns {string} Clase de FontAwesome para el icono
   */
  const getFileIcon = useCallback((item) => {
    if (!item || !item.fullPath) {
      console.warn('[SIDEBAR] getFileIcon llamado con item inválido:', item);
      return mdiFileDocument;
    }
    if (item.type === 'folder') return mdiFolder;
    if (item.fullPath?.toLowerCase().endsWith('.canvas')) {
      return mdiNote;
    }
    return mdiFileDocument;
  }, []);

  // =============================================================================
  // ESTADOS LOCALES
  // =============================================================================

  // Estado del menú contextual (click derecho)
  const [contextMenu, setContextMenu] = useState(null);

  // Estado de proyectos expandidos (mapa de índice -> boolean)
  const [expandedProjects, setExpandedProjects] = useState({});

  // Estado del dropdown de proyectos
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Estado para resize del sidebar
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef(null);

  // Cargar estado de expansión desde localStorage al iniciar
  useEffect(() => {
    try {
      const raw = localStorage.getItem('bg.expanded');
      if (raw) {
        const parsed = JSON.parse(raw);
        setExpandedProjects(parsed || {});
      }
    } catch (e) {
      // no-op
    }
  }, []);

  // Persistir cambios de expansión
  useEffect(() => {
    try {
      localStorage.setItem('bg.expanded', JSON.stringify(expandedProjects));
    } catch (e) {
      // no-op
    }
  }, [expandedProjects]);

  // Cargar ancho del sidebar desde localStorage
  useEffect(() => {
    try {
      const savedWidth = localStorage.getItem('sidebar.width');
      if (savedWidth) {
        const width = parseInt(savedWidth, 10);
        if (width >= 200 && width <= 500) {
          setSidebarWidth(width);
        }
      }
    } catch (e) {
      // no-op
    }
  }, []);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowProjectDropdown(false);
      }
    };

    if (showProjectDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProjectDropdown]);

  // Manejar resize del sidebar
  useEffect(() => {
    if (!isResizing) return;

    // Agregar clase al body para prevenir selección de texto
    document.body.classList.add('resizing-sidebar');

    const handleMouseMove = (e) => {
      const newWidth = e.clientX;

      // Threshold de colapso: si es menor a 50px, colapsar
      if (newWidth < 50) {
        onToggleCollapse && onToggleCollapse();
        setIsResizing(false);
        document.body.classList.remove('resizing-sidebar');
        return;
      }

      // Aplicar límites: 200px - 500px
      if (newWidth >= 200 && newWidth <= 500) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.classList.remove('resizing-sidebar');
      // Guardar ancho en localStorage con debouncing
      setTimeout(() => {
        try {
          localStorage.setItem('sidebar.width', sidebarWidth.toString());
        } catch (e) {
          // no-op
        }
      }, 300);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.classList.remove('resizing-sidebar');
    };
  }, [isResizing, sidebarWidth, onToggleCollapse]);

  /**
   * Efecto: Registrar atajos de teclado para operaciones de Sidebar
   */


  // =============================================================================
  // MANEJADORES DE EVENTOS
  // =============================================================================

  /**
   * Maneja la creación de un nuevo proyecto.
   * Muestra el modal de input para pedir el nombre.
   */
  const handleCreateProject = () => {
    showInput(t('sidebar.newProject'), t('sidebar.newProject'), (name) => {
      if (name) onCreateProject(name);
    });
  };


  /**
   * Maneja la creación de un nuevo archivo.
   * @param {number|null} projectIndex - Índice del proyecto donde crear el archivo (null = root)
   * @param {Object} parentItem - Carpeta o archivo padre (opcional, para subarchivos)
   * @param {string} targetPath - Ruta específica donde crear (opcional)
   * @param {string} targetDir - Directorio específico donde crear (opcional)
   */
  const handleCreateFile = (projectIndex, parentItem = null, targetPath = null, targetDir = null) => {
    // Si el padre es un archivo, crear un sub-archivo (se creará carpeta .d automáticamente)
    // Si el padre es una carpeta, crear archivo dentro de la carpeta
    // Si no hay padre, crear en la raíz del proyecto o workspace

    showInput(t('sidebar.newFile'), t('sidebar.fileNamePlaceholder'), (name) => {
      if (name) {
        // Si projectIndex es null, crear en root del workspace
        if (projectIndex === null && workspacePath) {
          const finalPath = targetDir || targetPath || workspacePath;
          onCreateFile(null, name, finalPath);
        } else {
          // Crear en proyecto específico
          const finalPath = targetPath || (parentItem ? parentItem.fullPath : null);
          onCreateFile(projectIndex, name, finalPath);
        }
      }
    });
  };

  /**
   * Maneja la creación de una nueva nota canvas.
   * @param {number|null} projectIndex - Índice del proyecto donde crear la nota (null = root)
   * @param {Object} parentItem - Carpeta o archivo padre (opcional, para subarchivos)
   * @param {string} targetPath - Ruta específica donde crear (opcional)
   * @param {string} targetDir - Directorio específico donde crear (opcional)
   */
  const handleCreateCanvas = (projectIndex, parentItem = null, targetPath = null, targetDir = null) => {
    showInput(t('canvas.newNote'), t('sidebar.fileNamePlaceholder'), (name) => {
      if (name) {
        // Asegurar que el nombre termine en .canvas
        const canvasName = name.endsWith('.canvas') ? name : `${name}.canvas`;
        
        // Si projectIndex es null, crear en root del workspace
        if (projectIndex === null && workspacePath) {
          const finalPath = targetDir || targetPath || workspacePath;
          onCreateFile(null, canvasName, finalPath);
        } else {
          // Crear en proyecto específico
          const finalPath = targetPath || (parentItem ? parentItem.fullPath : null);
          onCreateFile(projectIndex, canvasName, finalPath);
        }
      }
    });
  };

  /**
   * Encuentra el padre de un archivo en la jerarquía
   * @param {string} fullPath - Ruta completa del archivo
   * @param {Array} projects - Lista de proyectos
   * @returns {Object|null} El padre (archivo o carpeta) o null si está en la raíz
   */
  const findParent = (fullPath, projects) => {
    // Buscar en todos los proyectos
    for (const project of projects) {
      if (!project.items) continue;

      // Función recursiva para buscar en el árbol
      const searchInItems = (items, targetPath) => {
        for (const item of items) {
          if (item.items && item.items.length > 0) {
            // Verificar si alguno de los hijos es el archivo buscado
            for (const child of item.items) {
              if (child.fullPath === targetPath) {
                return item; // Este item es el padre
              }
            }
            // Buscar recursivamente en los hijos
            const found = searchInItems(item.items, targetPath);
            if (found) return found;
          }
        }
        return null;
      };

      // Primero verificar si está en la raíz del proyecto
      for (const item of project.items) {
        if (item.fullPath === fullPath) {
          return null; // Está en la raíz, no tiene padre
        }
      }

      // Buscar en el árbol
      const parent = searchInItems(project.items, fullPath);
      if (parent) return parent;
    }

    return null;
  };

  /**
   * Alterna el estado expandido/colapsado de un proyecto.
   * @param {number} index - Índice del proyecto
   */
  const toggleProject = (index) => {
    setExpandedProjects(prev => ({ ...prev, [index]: !prev[index] }));
  };

  // Toggle genérico para cualquier nodo (proyecto, carpeta o archivo que tenga hijos)
  const toggleNode = (nodeKey) => {
    setExpandedProjects(prev => ({ ...prev, [nodeKey]: !prev[nodeKey] }));
  };

  /**
   * Maneja el menú contextual (click derecho).
   * @param {Event} e - Evento de click
   * @param {string} type - Tipo de elemento ('project', 'file', 'folder')
   * @param {number} projectIndex - Índice del proyecto
   * @param {Object} item - Elemento sobre el que se hizo click
   */
  const handleContextMenu = (e, type, projectIndex, item = null) => {
    e.preventDefault();
    e.stopPropagation(); 
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuWidth = 220;
    const menuHeight = 300;
    
    let x = e.clientX;
    let y = e.clientY;
    
    if (x + menuWidth > viewportWidth) x = viewportWidth - menuWidth - 10;
    if (y + menuHeight > viewportHeight) y = viewportHeight - menuHeight - 10;

    setContextMenu({
      x,
      y,
      type,
      projectIndex,
      item
    });
  };

  /**
   * Cierra el menú contextual.
   */
  const closeContextMenu = () => {
    setContextMenu(null);
  };

  /**
   * Abre un archivo en el panel derecho (split view)
   */
  const handleOpenToRight = (projectIndex, item) => {
    if (!activeFile) {
      notify(t('sidebar.needActiveFile'), 'warning');
      return;
    }
    
    // Verificar que no sea el mismo archivo que está activo
    if (activeFile.fullPath === item.fullPath) {
      notify(t('notifications.cannotOpenSameFileInBothPanels'), 'warning');
      return;
    }
    
    // Si no está en split mode, activarlo primero
    if (splitMode === 'none' && onSplitHorizontal) {
      onSplitHorizontal(item);
    } else {
      // Si ya está en split, abrir el archivo en el panel derecho
      onOpenFile(projectIndex, item, true);
    }
    closeContextMenu();
  };

  /**
   * Muestra el archivo/carpeta en el explorador del sistema
   */
  const handleShowInExplorer = async (item) => {
    try {
      if (window.electronAPI && window.electronAPI.showItemInFolder) {
        await window.electronAPI.showItemInFolder(item.fullPath);
      } else if (window.electronAPI && window.electronAPI.shell && window.electronAPI.shell.showItemInFolder) {
        await window.electronAPI.shell.showItemInFolder(item.fullPath);
      } else {
        notify(t('sidebar.featureNotAvailable'), 'warning');
      }
    } catch (error) {
      console.error('Error showing in explorer:', error);
      notify(t('sidebar.errorShowingInExplorer'), 'error');
    }
    closeContextMenu();
  };

  /**
   * Maneja el click en un archivo.
   */
  const handleFileClick = (projectIndex, item) => {
    // Abrir archivo directamente - el manejo de split view se hace en App.js
    onOpenFile(projectIndex, item);
  };

  /**
   * Verifica si sourceFile es ancestro de targetFile (evitar ciclos).
   * @param {string} sourcePath - Ruta del archivo origen
   * @param {string} targetPath - Ruta del archivo destino
   * @returns {boolean} true si source es ancestro de target
   */
  const isAncestor = (sourcePath, targetPath) => {
    // Si targetPath comienza con sourcePath, entonces source es ancestro
    return targetPath.startsWith(sourcePath + '/') || targetPath.startsWith(sourcePath + '\\');
  };

  /**
   * Valida si un drop sería válido (no circular, sin límite de anidamiento)
   * @param {string} sourceFullPath - Ruta del archivo siendo arrastrado
   * @param {string} destFullPath - Ruta del destino
   * @param {string} destType - Tipo del destino ('file' o 'folder')
   * @returns {boolean} true si el drop es válido
   */
  const isValidDrop = (sourceFullPath, destFullPath, destType) => {
    // No permitir soltar sobre sí mismo
    if (sourceFullPath === destFullPath) return false;

    // No permitir ciclos (arrastrar padre sobre hijo)
    if (isAncestor(sourceFullPath, destFullPath)) return false;

    // No hay límite de profundidad - permitir jerarquías ilimitadas
    // Solo validación anti-ciclo

    return true;
  };

  /**
   * Maneja el renombrado de un elemento.
   */
  const handleRename = async () => {
    if (!contextMenu) return;
    const { type, projectIndex, item } = contextMenu;

    closeContextMenu(); // Cerrar primero

    if (type === 'file' && item) {
      // Detectar si es archivo .canvas o .txt
      const isCanvas = item.fullPath && item.fullPath.toLowerCase().endsWith('.canvas');
      const displayName = item.name.replace(/\.(txt|canvas)$/i, '');
      
      showInput(t('sidebar.rename'), displayName, async (newName) => {
        if (newName && newName !== displayName) {
          try {
            // Agregar extensión correcta según tipo de archivo
            const finalName = isCanvas 
              ? (newName.endsWith('.canvas') ? newName : newName + '.canvas')
              : (newName.endsWith('.txt') ? newName : newName + '.txt');
            const newFull = calcRenamedPath(item.fullPath, finalName, true);
            await window.electronAPI.renameFile(item.fullPath, finalName);
            notify(t('notifications.fileRenamed'), 'success');
            // Update locally first for snappy UI
            onLocalUpdate && onLocalUpdate({ type: 'rename', oldPath: item.fullPath, newPath: newFull });
            onRefresh();
          } catch (error) {
            notify(t('notifications.fileRenameError'), 'error');
          }
        }
      });
    } else if (type === 'project' && projects[projectIndex]) {
      showInput(t('sidebar.rename'), projects[projectIndex].name, async (newName) => {
        if (newName && newName !== projects[projectIndex].name) {
          try {
            await window.electronAPI.renameProject(projectIndex, newName);
            notify(t('notifications.projectRenamed'), 'success');
            const oldPath = projects[projectIndex].path;
            const newPath = calcRenamedPath(oldPath, newName, false);
            onLocalUpdate && onLocalUpdate({ type: 'rename', oldPath, newPath });
            onRefresh();
          } catch (error) {
            notify(t('notifications.projectRenameError'), 'error');
          }
        }
      });
    } else if (type === 'folder' && item) {
      showInput(t('sidebar.rename'), item.name, async (newName) => {
        if (newName && newName !== item.name) {
          try {
            const newFull = calcRenamedPath(item.fullPath, newName, false);
            await window.electronAPI.renameFolder(item.fullPath, newName);
            notify(t('notifications.folderRenamed'), 'success');
            onLocalUpdate && onLocalUpdate({ type: 'rename', oldPath: item.fullPath, newPath: newFull });
            onRefresh();
          } catch (error) {
            notify(t('notifications.folderRenameError'), 'error');
          }
        }
      });
    }
  };

  /**
   * Maneja la eliminación de un elemento.
   */
  const handleDelete = async () => {
    if (!contextMenu) return;
    const { type, projectIndex, item } = contextMenu;

    closeContextMenu(); // Cerrar primero

    let itemName = '';
    let itemPath = '';
    let isDir = false;

    if (type === 'project') {
      if (!projects || projectIndex === null || projectIndex < 0 || projectIndex >= projects.length) return;
      itemName = projects[projectIndex].name;
      itemPath = projects[projectIndex].path;
      isDir = true;
    } else if (item) {
      itemName = item.name;
      itemPath = item.fullPath;
      isDir = type === 'folder';
    } else {
      return;
    }

    showConfirm(
      t('common.delete'),
      `¿Estás seguro de que quieres eliminar "${itemName}"?`,
      async () => {
        try {
          await window.electronAPI.deleteItem(itemPath, isDir);
          notify(t('notifications.itemDeleted'), 'success');
          
          // Actualizar localmente y refrescar
          onLocalUpdate && onLocalUpdate({ type: 'delete', path: itemPath });
          onRefresh();
        } catch (error) {
          console.error('Error deleting item:', error);
          notify(t('notifications.deleteError'), 'error');
        }
      },
      mdiAlert
    );
  };

  // =============================================================================
  // REGISTRO DE ATAJOS PARA SIDEBAR
  // =============================================================================

  useEffect(() => {
    const unsubs = [
      registerShortcutCallback('newProject', () => handleCreateProject()),
      registerShortcutCallback('refreshSidebar', () => onRefresh && onRefresh()),
      registerShortcutCallback('renameItem', () => { if (contextMenu) handleRename(); }),
      registerShortcutCallback('deleteProject', () => { if (contextMenu) handleDelete(); })
    ];

    return () => {
      unsubs.forEach(unsub => unsub && unsub());
    };
  }, [contextMenu, onRefresh, handleCreateProject, handleRename, handleDelete]);

  // Cerrar menú contextual al hacer click fuera
  useEffect(() => {
    if (!contextMenu) return;

    const handleClickOutside = (event) => {
      // Verificar si el click fue fuera del menú contextual
      const contextMenuElement = document.querySelector('.context-menu');
      if (contextMenuElement && !contextMenuElement.contains(event.target)) {
        closeContextMenu();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        closeContextMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu]);

  // =============================================================================
  // RENDERIZADO DEL ÁRBOL DE ARCHIVOS
  // =============================================================================

  /**
   * Función auxiliar para calcular tiempo relativo
   */
  const getRelativeTime = useCallback((timestamp) => {
    if (!timestamp) return t('sidebar.never');
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return t('sidebar.now');
    if (minutes < 60) return t('sidebar.minutesAgo', { minutes });
    if (hours < 24) return t('sidebar.hoursAgo', { hours });
    if (days < 7) return t('sidebar.daysAgo', { days });
    return new Date(timestamp).toLocaleDateString('es-ES');
  }, [t]);

  const renderFileTree = useCallback((items, projectIndex, parentPath = '', parentFullPath = null, depth = 0) => {
    // Validación defensiva: filtrar items que no tengan propiedades mínimas requeridas
    if (!items || !Array.isArray(items)) {
      console.warn('[SIDEBAR] renderFileTree llamado con items inválidos:', items);
      return [];
    }
    
    // Filtrar items que no tengan las propiedades mínimas requeridas
    const validItems = items.filter(item => {
      if (!item || typeof item !== 'object') {
        console.warn('[SIDEBAR] Item inválido en renderFileTree:', item);
        return false;
      }
      if (!item.fullPath || typeof item.fullPath !== 'string') {
        console.warn('[SIDEBAR] Item sin fullPath válido en renderFileTree:', item);
        return false;
      }
      if (!item.name || typeof item.name !== 'string') {
        console.warn('[SIDEBAR] Item sin name válido en renderFileTree:', item);
        return false;
      }
      return true;
    });
    
    // Ordenar items por orden si existe, si no por nombre
    const sortedItems = [...validItems].sort((a, b) => {
      const orderA = a.order ?? 0;
      const orderB = b.order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return (a.name || '').localeCompare(b.name || '');
    });

    return sortedItems.map((item) => {
      const nodeKey = item.fullPath;
      const isActive = activeFile && activeFile.fullPath === item.fullPath;

      // =========================================================================
      // CARPETAS: Renderizado simplificado
      // =========================================================================
      if (item.type === 'folder') {
        const isNodeExpanded = !!expandedProjects[nodeKey];

        return (
          <li key={nodeKey} className="folder-item" style={{ paddingLeft: `${depth * 12}px` }}>
            <div
              className="folder-header"
              onContextMenu={(e) => handleContextMenu(e, 'folder', projectIndex, item)}
              onDragEnter={(e) => {
                e.preventDefault();
                const draggedData = e.dataTransfer.getData('application/json');
                if (draggedData) {
                  const dragData = JSON.parse(draggedData);
                  const isValid = isValidDrop(dragData.fullPath, item.fullPath, 'folder');
                  e.dataTransfer.dropEffect = isValid ? 'move' : 'none';
                  addDragOver(e.currentTarget, isValid);
                } else {
                  e.dataTransfer.dropEffect = 'move';
                  addDragOver(e.currentTarget);
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                const draggedData = e.dataTransfer.getData('application/json');
                if (draggedData) {
                  const dragData = JSON.parse(draggedData);
                  const isValid = isValidDrop(dragData.fullPath, item.fullPath, 'folder');
                  e.dataTransfer.dropEffect = isValid ? 'move' : 'none';
                  addDragOver(e.currentTarget, isValid);
                } else {
                  e.dataTransfer.dropEffect = 'move';
                  addDragOver(e.currentTarget);
                }
              }}
              onDragLeave={(e) => {
                if (shouldIgnoreDragLeave(e, e.currentTarget)) return;
                removeDragOver(e.currentTarget);
              }}
              onDragEnd={(e) => {
                // Limpiar todos los drag-over
                document.querySelectorAll('.drag-over, .drop-target-invalid').forEach(el => {
                  el.classList.remove('drag-over');
                  el.classList.remove('drop-target-invalid');
                });
              }}
              onDrop={(e) => {
                e.preventDefault();
                removeDragOver(e.currentTarget);
                const draggedData = e.dataTransfer.getData('application/json');
                if (!draggedData) return;

                const dragData = JSON.parse(draggedData);
                const sourceFullPath = dragData.fullPath;
                const destFolderPath = item.fullPath;
                const fileName = sourceFullPath.split(/[/\\]/).pop() || '';
                const newFilePath = (destFolderPath.replace(/[/\\]$/, '') || destFolderPath) + '/' + fileName;

                // No permitir soltar sobre sí mismo
                if (sourceFullPath === destFolderPath) return;

                // No permitir ciclos (arrastrar padre sobre hijo)
                if (isAncestor(sourceFullPath, destFolderPath)) {
                  notify(t('sidebar.cannotMoveIntoItself'), 'error');
                  return;
                }

                // Mover archivo a la carpeta
                if (window.electronAPI && window.electronAPI.moveFile) {
                  window.electronAPI.moveFile(sourceFullPath, destFolderPath)
                    .then(() => {
                      onLocalUpdate && onLocalUpdate({
                        type: 'move',
                        oldPath: sourceFullPath,
                        newPath: newFilePath,
                        destParent: destFolderPath
                      });
                      onRefresh();
                      notify('Archivo movido correctamente', 'success');
                    })
                    .catch((err) => {
                      console.error('Error moving file:', err);
                      notify('Error al mover archivo', 'error');
                    });
                }
              }}
            >
              <div className="folder-indicator">
                <button
                  className="folder-toggle"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleNode(nodeKey);
                  }}
                >
                  <Icon path={isNodeExpanded ? mdiChevronDown : mdiChevronRight} size={0.6} />
                </button>
                <Icon path={mdiFolder} size={0.7} className="folder-icon" />
              </div>
              <span className="folder-name">{item.name}</span>
            </div>

            {isNodeExpanded && item.items && item.items.length > 0 && (
              <ul className="folder-contents">
                {renderFileTree(item.items, projectIndex, '', item.fullPath, depth + 1)}
              </ul>
            )}
          </li>
        );
      }

      // =========================================================================
      // ARCHIVOS: Estructura unificada para TODOS los archivos
      // =========================================================================
      const isFileWithChildren = item.type === 'file' && item.items && item.items.length > 0;
      const isExpanded = !!expandedProjects[nodeKey];

      // Calcular progreso (siempre, para consistencia)
      const status = config?.states.find(s => s.id === item.status) || config?.states[0];
      const progress = Math.min(100, (item.lastCharCount / (item.goal || 30000)) * 100);
      const circumference = 2 * Math.PI * 9;
      const strokeDashoffset = circumference - (progress / 100) * circumference;

      return (
        <li
          key={nodeKey}
          className={`file-item ${isActive ? 'active' : ''} ${isFileWithChildren ? 'has-children' : ''} ${isExpanded ? 'expanded' : ''}`}
          style={{ paddingLeft: `${depth * 12}px` }}
          onContextMenu={(e) => handleContextMenu(e, 'file', projectIndex, item)}
          draggable={true}
          onDragStart={(e) => {
            e.stopPropagation();
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('application/json', JSON.stringify({
              type: 'file',
              fullPath: item.fullPath,
              name: item.name,
              projectIndex: projectIndex,
              depth: depth
            }));
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const draggedData = e.dataTransfer.getData('application/json');
            if (draggedData) {
              const dragData = JSON.parse(draggedData);
              const isValid = isValidDrop(dragData.fullPath, item.fullPath, 'file');
              e.dataTransfer.dropEffect = isValid ? 'move' : 'none';
            } else {
              e.dataTransfer.dropEffect = 'move';
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const draggedData = e.dataTransfer.getData('application/json');
            if (draggedData) {
              const dragData = JSON.parse(draggedData);
              const isValid = isValidDrop(dragData.fullPath, item.fullPath, 'file');
              addDragOver(e.currentTarget, isValid);
            } else {
              addDragOver(e.currentTarget);
            }
          }}
          onDragLeave={(e) => {
            if (shouldIgnoreDragLeave(e, e.currentTarget)) return;
            removeDragOver(e.currentTarget);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            removeDragOver(e.currentTarget);

            const draggedData = e.dataTransfer.getData('application/json');
            if (!draggedData) return;

            const dragData = JSON.parse(draggedData);
            const sourceFullPath = dragData.fullPath;
            const destFullPath = item.fullPath;

            // No permitir soltar sobre sí mismo
            if (sourceFullPath === destFullPath) return;

            // No permitir ciclos (arrastrar padre sobre hijo)
            if (isAncestor(sourceFullPath, destFullPath)) {
              notify(t('sidebar.cannotMoveIntoItself'), 'error');
              return;
            }

            // Mover archivo (como sub-archivo del destino); la pestaña sigue con la misma ruta del archivo
            if (window.electronAPI && window.electronAPI.moveFile) {
              window.electronAPI.moveFile(sourceFullPath, destFullPath)
                .then(() => {
                  onLocalUpdate && onLocalUpdate({
                    type: 'move',
                    oldPath: sourceFullPath,
                    newPath: sourceFullPath,
                    destParent: destFullPath
                  });
                  onRefresh();
                  notify('Archivo movido correctamente', 'success');
                })
                .catch((err) => {
                  console.error('Error moving file:', err);
                  notify('Error al mover archivo', 'error');
                });
            }
          }}
          onDragEnd={(e) => {
            // Limpiar todos los drag-over y drop-target-invalid
            document.querySelectorAll('.drag-over, .drop-target-invalid').forEach(el => {
              el.classList.remove('drag-over');
              el.classList.remove('drop-target-invalid');
            });
          }}
        >
          <div
            className="file-item-inner"
            onClick={!isFileWithChildren ? () => handleFileClick(projectIndex, item) : undefined}
          >
            {/* LADO IZQUIERDO: Toggle y Custom Icon */}
            <div className="file-indicator">
              {isFileWithChildren ? (
                <button
                  className="file-toggle-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleNode(nodeKey);
                  }}
                  title={isExpanded ? 'Ocultar sub-archivos' : 'Mostrar sub-archivos'}
                >
                  <Icon path={isExpanded ? mdiChevronDown : mdiChevronRight} size={0.6} />
                </button>
              ) : null}
              <div className="file-icon-display">
                {(() => {
                  // Check if it's a canvas file first
                  if (item.fullPath && item.fullPath.toLowerCase().endsWith('.canvas')) {
                    return <Icon path={mdiNote} size={0.7} color="#8B5CF6" title={t('canvas.note') || 'Canvas Note'} />;
                  }
                  
                  // Get custom icon from fileIcons state, then from item.customIcon, or use default
                  const customIconId = fileIcons?.get(item.fullPath) || item.customIcon;
                  const iconData = customIconId ? getIconById(customIconId) : DEFAULT_FILE_ICON;
                  const iconPath = iconData?.icon || DEFAULT_FILE_ICON.icon;

                  return <Icon path={iconPath} size={0.7} title={iconData?.label || t('sidebar.fileLabel')} />;
                })()}
              </div>
            </div>

            {/* CENTRO: Nombre y metadata (menú solo con click derecho) */}
            <div className="file-info" onClick={isFileWithChildren ? () => handleFileClick(projectIndex, item) : undefined}>
              <span className="file-name">
                {(item.name || 'Sin nombre').replace(/\.(txt|canvas)$/i, '')}
              </span>
              {!isFileWithChildren && item.lastUpdated && (
                <span className="file-meta">{getRelativeTime(item.lastUpdated)}</span>
              )}
            </div>
          </div>

          {/* SUBARCHIVOS (si existen y están expandidos) */}
          {isFileWithChildren && isExpanded && (
            <ul className="subfiles-list">
              {renderFileTree(item.items, projectIndex, '', item.fullPath, depth + 1)}
            </ul>
          )}
        </li>
      );
    });
  });

  // =============================================================================
  // RENDERIZADO PRINCIPAL
  // =============================================================================

  return (
    <>
      <aside
        ref={sidebarRef}
        className={`sidebar ${collapsed ? 'collapsed' : ''}`}
        style={{ width: collapsed ? 0 : `${sidebarWidth}px` }}
      >
        {/* Header: Barra de iconos de acción */}
        <div className="sidebar-header">
          <div className="sidebar-icon-bar">
            {/* Botón: Nuevo Proyecto */}
            <button
              className="icon-btn"
              onClick={handleCreateProject}
              title={t('sidebar.newProject') || 'Nuevo Proyecto'}
              aria-label={t('sidebar.newProject') || 'Nuevo Proyecto'}
            >
              <Icon path={mdiFolderPlus} size={0.7} />
            </button>

            {/* Botón: Nuevo Archivo */}
            <button
              className="icon-btn"
              onClick={() => {
                // Detectar contexto: si hay proyecto activo, crear archivo en ese proyecto
                // De lo contrario, crear archivo suelto en el workspace root (projectIndex=null)
                if (activeProjectIndex !== null && activeProjectIndex >= 0) {
                  handleCreateFile(activeProjectIndex);
                } else {
                  handleCreateFile(null);
                }
              }}
              title={t('sidebar.newFile') || 'Nuevo Archivo'}
              aria-label={t('sidebar.newFile') || 'Nuevo Archivo'}
            >
              <Icon path={mdiFile} size={0.7} />
            </button>

            {/* Botón: Nueva Nota (Canvas) */}
            <button
              className="icon-btn"
              onClick={() => {
                // Crear nota canvas en el proyecto activo o en root
                if (activeProjectIndex !== null && activeProjectIndex >= 0) {
                  handleCreateCanvas(activeProjectIndex);
                } else {
                  handleCreateCanvas(null);
                }
              }}
              title={t('sidebar.newNote') || 'Nueva Nota'}
              aria-label={t('sidebar.newNote') || 'Nueva Nota'}
              style={{ color: '#8B5CF6' }}
            >
              <Icon path={mdiNote} size={0.7} />
            </button>

            {/* Spacer para empujar el botón de colapsar a la derecha */}
            <div style={{ flex: 1 }}></div>

            {/* Botón: Colapsar Sidebar (a la derecha) */}
            <button
              className="icon-btn"
              onClick={onToggleCollapse}
              title={t('sidebar.collapse') || 'Ocultar Sidebar'}
              aria-label={t('sidebar.collapse') || 'Ocultar Sidebar'}
            >
              <Icon path={mdiChevronLeft} size={0.7} />
            </button>
          </div>
        </div>

        {/* Contenido: Lista de proyectos y archivos */}
        <div
          className="sidebar-content"
          onContextMenu={(e) => {
            // Detectar si el click fue en un área vacía (no en un item específico)
            const target = e.target;
            const isEmptyArea = target.classList.contains('sidebar-content') || 
                               target.classList.contains('project-list');
            
            if (isEmptyArea) {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                type: 'empty-area',
                projectIndex: activeProjectIndex,
                item: null
              });
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();

            const draggedData = e.dataTransfer.getData('application/json');
            if (!draggedData) return;

            const dragData = JSON.parse(draggedData);
            const sourceFullPath = dragData.fullPath;

            // Mover a la raíz del workspace
            if (window.electronAPI && window.electronAPI.moveFileToRoot) {
              window.electronAPI.moveFileToRoot(sourceFullPath, workspacePath)
                .then(() => {
                  onLocalUpdate && onLocalUpdate({
                    type: 'move',
                    oldPath: sourceFullPath,
                    newPath: workspacePath,
                    destParent: null
                  });
                  onRefresh();
                  notify(t('sidebar.fileMovedToWorkspaceRoot'), 'success');
                })
                .catch((err) => {
                  console.error('Error moving file to workspace root:', err);
                  notify('Error al mover archivo: ' + err.message, 'error');
                });
            }
          }}
        >
          {/* Unified file list: iconbar at top, then folders and files mixed without dividers */}
          <ul 
            className="project-list"
            onContextMenu={(e) => {
              // Detectar si el click fue en un área vacía de la lista
              const target = e.target;
              const isEmptyArea = target.classList.contains('project-list');
              
              if (isEmptyArea) {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  type: 'empty-area',
                  projectIndex: activeProjectIndex,
                  item: null
                });
              }
            }}
          >
            {(() => {
              if (!projects) return null;

              // Separate projects from root files
              const projectItems = projects.filter(item =>
                item.path !== undefined && (item.type === undefined || item.type === 'project')
              );
              const rootFileItems = projects.filter(item =>
                !(item.path !== undefined && (item.type === undefined || item.type === 'project'))
              );
              
              console.log('[SIDEBAR] Total items:', projects.length);
              console.log('[SIDEBAR] Project items:', projectItems.length, projectItems.map(p => p.name));
              console.log('[SIDEBAR] Root file items:', rootFileItems.length, rootFileItems.map(f => ({ name: f.name, type: f.type })));

              // Render projects first
              const renderedProjects = projectItems.map((project) => {
                const pOriginalIndex = projects.indexOf(project);
                const isViewing = viewingProject && viewingProject.path === project.path;
                const nodeKey = `project-${pOriginalIndex}`;

                return (
                  <li
                    key={nodeKey}
                    className={`project-item ${expandedProjects[pOriginalIndex] ? 'open' : ''} ${isViewing ? 'viewing' : ''}`}
                  >
                    {/* Cabecera del proyecto */}
                    <div
                      className="project-header"
                      onContextMenu={(e) => handleContextMenu(e, 'project', pOriginalIndex)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = 'move';
                        addDragOver(e.currentTarget);
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        addDragOver(e.currentTarget);
                      }}
                      onDragLeave={(e) => {
                        if (shouldIgnoreDragLeave(e, e.currentTarget)) return;
                        removeDragOver(e.currentTarget);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeDragOver(e.currentTarget);

                        const draggedData = e.dataTransfer.getData('application/json');
                        if (!draggedData) return;

                        const dragData = JSON.parse(draggedData);
                        const sourceFullPath = dragData.fullPath;

                        // Permitir mover archivos entre proyectos
                        if (window.electronAPI && window.electronAPI.moveFileToRoot) {
                          window.electronAPI.moveFileToRoot(sourceFullPath, project.path)
                            .then(() => {
                              onLocalUpdate && onLocalUpdate({
                                type: 'move',
                                oldPath: sourceFullPath,
                                newPath: project.path,
                                destParent: project.path
                              });
                              onRefresh();
                              notify(t('sidebar.fileMovedToProjectRoot'), 'success');
                            })
                            .catch((err) => {
                              console.error('Error moving file to project root:', err);
                              notify('Error al mover archivo: ' + err.message, 'error');
                            });
                        }
                      }}
                    >
                      {/* Chevron + Carpeta: Estilo unificado con archivos jerárquicos */}
                      <button
                        className="toggle-folder-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleProject(pOriginalIndex);
                        }}
                        title={expandedProjects[pOriginalIndex] ? 'Colapsar' : 'Expandir'}
                        aria-expanded={expandedProjects[pOriginalIndex]}
                      >
                        <Icon path={expandedProjects[pOriginalIndex] ? mdiChevronDown : mdiChevronRight} size={0.6} />
                      </button>

                      <Icon path={mdiFolder} size={0.7} className="project-folder-icon" />

                      {/* Nombre: También toggle collapse/expand */}
                      <span
                        className="project-name"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleProject(pOriginalIndex);
                        }}
                        title="Click para expandir/contraer"
                      >
                        {project.name}
                      </span>
                      {/* Botón Ver estructura (abrir visor) */}
                      <button
                        className="project-view-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewProject && onViewProject(project);
                        }}
                        title="Ver estructura del proyecto"
                      >
                        <Icon
                          path={mdiFolderOpen}
                          size={0.85}
                          className="project-view-icon"
                        />
                      </button>
                    </div>

                    {/* Lista de archivos (visible si expandido) */}
                    {expandedProjects[pOriginalIndex] && project.items && (
                      <ul
                        className="file-list"
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = 'move';
                        }}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();

                          const draggedData = e.dataTransfer.getData('application/json');
                          if (!draggedData) return;

                          const dragData = JSON.parse(draggedData);
                          const sourceFullPath = dragData.fullPath;

                          if (window.electronAPI && window.electronAPI.moveFileToRoot) {
                            window.electronAPI.moveFileToRoot(sourceFullPath, project.path)
                              .then(() => {
                                onLocalUpdate && onLocalUpdate({
                                  type: 'move',
                                  oldPath: sourceFullPath,
                                  newPath: project.path,
                                  destParent: project.path
                                });
                                onRefresh();
                                notify(t('sidebar.fileMovedToProjectRoot'), 'success');
                              })
                              .catch((err) => {
                                console.error('Error moving file to root:', err);
                                notify('Error al mover archivo: ' + err.message, 'error');
                              });
                          }
                        }}
                      >
                        {renderFileTree(project.items, pOriginalIndex, '', project.path)}
                      </ul>
                    )}
                  </li>
                );
              });

              // Render root files last
              const renderedRootFiles = rootFileItems.map((item) => {
                return renderFileTree([item], null, '', workspacePath, 0);
              });

              return (
                <>
                  {renderedProjects}
                  {renderedRootFiles}
                </>
              );
            })()}
          </ul>
        </div>

        {/* Footer: Perfil de usuario */}
        <div className="sidebar-footer" onClick={onOpenSettings} style={{ cursor: 'pointer' }} title={t('sidebar.openSettings')}>
          <div className="user-profile-footer">
            <div className="avatar-container" title={t('sidebar.userLabel')}>
              {avatar ? (
                <img src={avatar} alt="Avatar" className="avatar-img" />
              ) : (
                <div className="avatar-placeholder">
                  <Icon path={mdiAccount} size={0.7} />
                </div>
              )}
            </div>
            <div className="user-info">
              <span className="user-name">{userName}</span>
              <span className="user-status">
                <span className="status-dot"></span>
                Local
              </span>
            </div>
          </div>
        </div>

        {/* Handle de resize */}
        {!collapsed && (
          <div
            className="sidebar-resize-handle"
            onMouseDown={() => setIsResizing(true)}
            role="separator"
            aria-label="Redimensionar sidebar"
          />
        )}
      </aside>

      {/* Menú contextual (click derecho) */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {/* MENÚ PARA ARCHIVOS */}
          {contextMenu.type === 'file' && (
            <>
              {/* Open */}
              <div className="context-item" onClick={() => {
                handleFileClick(contextMenu.projectIndex, contextMenu.item);
                closeContextMenu();
              }}>
                <Icon path={mdiFolderOpen} size={0.8} />
                <span>{t('sidebar.contextMenu.open')}</span>
              </div>

              {/* Open to the right - solo si hay archivo activo y no es el mismo archivo */}
              {activeFile && activeFile.fullPath !== contextMenu.item?.fullPath && (
                <div className="context-item" onClick={() => handleOpenToRight(contextMenu.projectIndex, contextMenu.item)}>
                  <Icon path={mdiViewSplitVertical} size={0.8} />
                  <span>{t('sidebar.contextMenu.openToRight')}</span>
                </div>
              )}

              <div className="context-divider"></div>

              {/* Rename */}
              <div className="context-item" onClick={handleRename}>
                <Icon path={mdiFileEdit} size={0.8} />
                <span>{t('sidebar.contextMenu.renameFile')}</span>
              </div>

              <div className="context-divider"></div>

              {/* Delete */}
              <div className="context-item danger" onClick={handleDelete}>
                <Icon path={mdiTrashCan} size={0.8} />
                <span>{t('sidebar.contextMenu.deleteFile')}</span>
              </div>

              <div className="context-divider"></div>

              {/* Show in system explorer */}
              <div className="context-item" onClick={() => handleShowInExplorer(contextMenu.item)}>
                <Icon path={mdiFolder} size={0.8} />
                <span>{t('sidebar.contextMenu.showInExplorer')}</span>
              </div>
            </>
          )}

          {/* MENÚ PARA CARPETAS */}
          {contextMenu.type === 'folder' && (
            <>
              {/* New note */}
              <div className="context-item" onClick={() => {
                handleCreateCanvas(contextMenu.projectIndex, null, null, contextMenu.item.fullPath);
                closeContextMenu();
              }}>
                <Icon path={mdiNote} size={0.8} />
                <span>{t('sidebar.contextMenu.newNote')}</span>
              </div>

              {/* New file */}
              <div className="context-item" onClick={() => {
                handleCreateFile(contextMenu.projectIndex, null, null, contextMenu.item.fullPath);
                closeContextMenu();
              }}>
                <Icon path={mdiFile} size={0.8} />
                <span>{t('sidebar.contextMenu.newFile')}</span>
              </div>

              <div className="context-divider"></div>

              {/* Rename */}
              <div className="context-item" onClick={handleRename}>
                <Icon path={mdiFileEdit} size={0.8} />
                <span>{t('sidebar.contextMenu.renameFolder')}</span>
              </div>

              <div className="context-divider"></div>

              {/* Delete */}
              <div className="context-item danger" onClick={handleDelete}>
                <Icon path={mdiTrashCan} size={0.8} />
                <span>{t('sidebar.contextMenu.deleteFolder')}</span>
              </div>

              <div className="context-divider"></div>

              {/* Show in system explorer */}
              <div className="context-item" onClick={() => handleShowInExplorer(contextMenu.item)}>
                <Icon path={mdiFolder} size={0.8} />
                <span>{t('sidebar.contextMenu.showInExplorer')}</span>
              </div>
            </>
          )}

          {/* MENÚ PARA PROYECTOS */}
          {contextMenu.type === 'project' && (
            <>
              {/* New note */}
              <div className="context-item" onClick={() => {
                handleCreateCanvas(contextMenu.projectIndex, null, null, null);
                closeContextMenu();
              }}>
                <Icon path={mdiNote} size={0.8} />
                <span>{t('sidebar.contextMenu.newNote')}</span>
              </div>

              {/* New file */}
              <div className="context-item" onClick={() => {
                handleCreateFile(contextMenu.projectIndex, null, null, null);
                closeContextMenu();
              }}>
                <Icon path={mdiFile} size={0.8} />
                <span>{t('sidebar.contextMenu.newFile')}</span>
              </div>

              <div className="context-divider"></div>

              {/* Rename */}
              <div className="context-item" onClick={handleRename}>
                <Icon path={mdiFileEdit} size={0.8} />
                <span>{t('sidebar.contextMenu.renameProject')}</span>
              </div>

              <div className="context-divider"></div>

              {/* Delete */}
              <div className="context-item danger" onClick={handleDelete}>
                <Icon path={mdiTrashCan} size={0.8} />
                <span>{t('sidebar.contextMenu.deleteProject')}</span>
              </div>

              <div className="context-divider"></div>

              {/* View structure */}
              <div className="context-item" onClick={() => {
                if (contextMenu?.projectIndex >= 0 && projects?.[contextMenu.projectIndex]) {
                  onViewProject && onViewProject(projects[contextMenu.projectIndex]);
                }
                closeContextMenu();
              }}>
                <Icon path={mdiFolderOpen} size={0.8} />
                <span>{t('sidebar.viewStructure')}</span>
              </div>

              {/* Show in system explorer */}
              <div className="context-item" onClick={() => {
                if (contextMenu?.projectIndex >= 0 && projects?.[contextMenu.projectIndex]) {
                  handleShowInExplorer(projects[contextMenu.projectIndex]);
                }
              }}>
                <Icon path={mdiFolder} size={0.8} />
                <span>{t('sidebar.contextMenu.showInExplorer')}</span>
              </div>
            </>
          )}

          {/* MENÚ PARA ÁREA VACÍA */}
          {contextMenu.type === 'empty-area' && (
            <>
              {/* New note */}
              <div className="context-item" onClick={() => {
                if (contextMenu.projectIndex !== null && contextMenu.projectIndex >= 0) {
                  handleCreateCanvas(contextMenu.projectIndex);
                } else {
                  handleCreateCanvas(null);
                }
                closeContextMenu();
              }}>
                <Icon path={mdiNote} size={0.8} />
                <span>{t('sidebar.contextMenu.newNote')}</span>
              </div>

              {/* New file */}
              <div className="context-item" onClick={() => {
                if (contextMenu.projectIndex !== null && contextMenu.projectIndex >= 0) {
                  handleCreateFile(contextMenu.projectIndex);
                } else {
                  handleCreateFile(null);
                }
                closeContextMenu();
              }}>
                <Icon path={mdiFile} size={0.8} />
                <span>{t('sidebar.contextMenu.newFile')}</span>
              </div>

              {/* New folder */}
              <div className="context-item" onClick={() => {
                handleCreateProject();
                closeContextMenu();
              }}>
                <Icon path={mdiFolderPlus} size={0.8} />
                <span>{t('sidebar.contextMenu.newFolder')}</span>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

export default Sidebar;