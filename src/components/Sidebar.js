/**
 * ============================================================================
 * BLOCK GUARD v4.0.0 - SIDEBAR.JS
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

import React, { useState, useEffect } from 'react';
import { smartTruncate, calcRenamedPath } from '../utils/helpers';
import { registerShortcutCallback } from '../utils/shortcuts';
import { useTranslation } from '../utils/i18n';

function Sidebar({ 
  projects, 
  activeFile, 
  activeProjectIndex,
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
  onRefresh
  , onLocalUpdate
}) {
  const { t } = useTranslation();
  
  // =============================================================================
  // ESTADOS LOCALES
  // =============================================================================
  
  // Estado del menú contextual (click derecho)
  const [contextMenu, setContextMenu] = useState(null);
  
  // Estado de proyectos expandidos (mapa de índice -> boolean)
  const [expandedProjects, setExpandedProjects] = useState({});

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
   * @param {number} projectIndex - Índice del proyecto donde crear el archivo
   * @param {Object} parentItem - Carpeta padre (opcional, para subarchivos)
   */
  const handleCreateFile = (projectIndex, parentItem = null) => {
    // Validar que si es sub-archivo, el padre debe ser una carpeta
    if (parentItem && parentItem.type !== 'folder') {
      notify(t('notifications.subfilesOnlyInFolders'), 'warning');
      return;
    }
    showInput(t('sidebar.newFile'), 'nombre_del_archivo', (name) => {
      if (name) onCreateFile(projectIndex, name, parentItem?.fullPath);
    });
  };
  
  /**
   * Alterna el estado expandido/colapsado de un proyecto.
   * @param {number} index - Índice del proyecto
   */
  const toggleProject = (index) => {
    setExpandedProjects(prev => ({ ...prev, [index]: !prev[index] }));
  };

  // Toggle genérico para cualquier nodo (proyecto, carpeta o archivo que tenga hijos)
  const toggleNode = (projectIndex, pathKey) => {
    const key = `${projectIndex}-${pathKey}`;
    setExpandedProjects(prev => ({ ...prev, [key]: !prev[key] }));
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
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
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
   * Maneja el renombrado de un elemento.
   */
  const handleRename = async () => {
    if (!contextMenu) return;
    const { type, projectIndex, item } = contextMenu;
    
    closeContextMenu(); // Cerrar primero
    
    if (type === 'file' && item) {
      showInput(t('sidebar.rename'), item.name.replace('.txt', ''), async (newName) => {
        if (newName && newName !== item.name.replace('.txt', '')) {
          try {
            const finalName = newName.endsWith('.txt') ? newName : newName + '.txt';
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
    
    if (!projects || projectIndex < 0 || projectIndex >= projects.length) return;
    
    const itemName = type === 'project' ? projects[projectIndex].name : item.name;
    
    showConfirm(
      t('common.delete'),
      `¿Estás seguro de que quieres eliminar "${itemName}"?`,
      async () => {
        try {
          if (type === 'project') {
            await window.electronAPI.deleteItem(projects[projectIndex].path, true);
          } else {
            await window.electronAPI.deleteItem(item.fullPath, false);
          }
          notify(t('notifications.itemDeleted'), 'success');
          // Actualizar localmente y refrescar
          if (type === 'project') {
            onLocalUpdate && onLocalUpdate({ type: 'delete', path: projects[projectIndex].path });
          } else {
            onLocalUpdate && onLocalUpdate({ type: 'delete', path: item.fullPath });
          }
          onRefresh();
        } catch (error) {
          notify(t('notifications.deleteError'), 'error');
        }
      },
      'fa-exclamation-triangle'
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

  // =============================================================================
  // RENDERIZADO DEL ÁRBOL DE ARCHIVOS
  // =============================================================================
  
  /**
   * Renderiza recursivamente el árbol de archivos y carpetas.
   * @param {Array} items - Lista de items a renderizar
   * @param {number} projectIndex - Índice del proyecto padre
   * @param {string} parentPath - Ruta relativa del padre
   * @returns {JSX.Element} Elementos renderizados
   */
  const renderFileTree = (items, projectIndex, parentPath = '', parentFullPath = null) => {
    return items.map((item, index) => {
      const currentPath = parentPath ? `${parentPath}/${index}` : `${index}`;
      const isActive = activeFile && activeFile.fullPath === item.fullPath;
      
      // Si es una carpeta, renderizar recursivamente
      // Si el item tiene hijos (puede ser carpeta o archivo que actúa como contenedor)
      if (item.items && item.items.length > 0) {
        const nodeKey = `${projectIndex}-${currentPath}`;
        const isNodeExpanded = !!expandedProjects[nodeKey];
        const isFolderType = item.type === 'folder';
        return (
          <li key={currentPath} className={`parent-item ${isFolderType ? 'folder-item' : 'parent-file-item'}`}>
            <div 
            className={isFolderType ? 'folder-header' : 'parent-header'}
            onContextMenu={(e) => handleContextMenu(e, 'folder', projectIndex, item)}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
            onDragLeave={(e) => { e.currentTarget.classList.remove('drag-over'); }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('drag-over');
              const draggedData = e.dataTransfer.getData('application/json');
              if (draggedData) {
                const dragData = JSON.parse(draggedData);
                const sourceFullPath = dragData.fullPath;
                const destFullPath = item.fullPath;
                if (window.electronAPI && window.electronAPI.moveFile) {
                  window.electronAPI.moveFile(sourceFullPath, destFullPath)
                    .then(() => {
                      onLocalUpdate && onLocalUpdate({ type: 'move', oldPath: sourceFullPath, newPath: destFullPath, destParent: destFullPath });
                      onRefresh();
                    })
                    .catch((err) => console.error('Error moving file:', err));
                } else {
                  onRefresh();
                }
              }
            }}
          >
              <span className="folder-icons-wrapper">
                {item.items && item.items.length > 0 && (
                  <i 
                    className={`fas fa-chevron-${isNodeExpanded ? 'down' : 'right'} toggle-icon`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleNode(projectIndex, currentPath);
                    }}
                  ></i>
                )}
                <i className={isFolderType ? 'fas fa-folder folder-icon' : 'fas fa-file parent-file-icon'}></i>
              </span>
              <span className="folder-name">{smartTruncate(item.name, 20)}</span>
              <i 
                className="fas fa-ellipsis-v folder-menu-icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleContextMenu(e, 'folder', projectIndex, item);
                }}
                title="Menú"
              ></i>
            </div>
            {isNodeExpanded && item.items && item.items.length > 0 && (
              <ul 
                className="folder-contents"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add('drag-over');
                }}
                onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('drag-over');
                  const draggedData = e.dataTransfer.getData('application/json');
                  if (draggedData) {
                    const dragData = JSON.parse(draggedData);
                    const sourceFullPath = dragData.fullPath;
                    const destFullPath = item.fullPath;
                  
                    // Mover archivo a la carpeta/contendedor destino
                    if (window.electronAPI && window.electronAPI.moveFile) {
                      window.electronAPI.moveFile(sourceFullPath, destFullPath)
                        .then(() => {
                          onLocalUpdate && onLocalUpdate({ type: 'move', oldPath: sourceFullPath, newPath: destFullPath });
                          onRefresh();
                        })
                        .catch((err) => console.error('Error moving file:', err));
                    } else {
                      onRefresh();
                    }
                  }
                }}
              >
                {renderFileTree(item.items, projectIndex, currentPath)}
              </ul>
            )}
          </li>
        );
      }
      
      // Si es un archivo, renderizar con indicador de progreso
      const status = config?.states.find(s => s.id === item.status) || config?.states[0];
      const progress = Math.min(100, (item.lastCharCount / (item.goal || 30000)) * 100);
      const circumference = 2 * Math.PI * 9;
      const strokeDashoffset = circumference - (progress / 100) * circumference;
      
      // Calcular tiempo relativo para la última actualización
      const getRelativeTime = (timestamp) => {
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
      };
      
      const lastUpdated = item.lastUpdated ? getRelativeTime(item.lastUpdated) : t('sidebar.never');
      
      return (
        <li 
          key={currentPath}
          className={`file-item ${isActive ? 'active' : ''}`}
          onClick={() => onOpenFile(projectIndex, item)}
          onContextMenu={(e) => handleContextMenu(e, 'file', projectIndex, item)}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('application/json', JSON.stringify({
              projectIndex,
              fullPath: item.fullPath,
              name: item.name,
              parentFullPath: parentFullPath || null
            }));
          }}
          title={`${t('sidebar.lastUpdated')}: ${lastUpdated}`}
        >
          {/* Indicador de progreso circular */}
          <div className="file-progress">
            <svg className="circle-progress" viewBox="0 0 24 24">
              <circle className="bg" cx="12" cy="12" r="9"></circle>
              <circle 
                className="fg" 
                cx="12" 
                cy="12" 
                r="9"
                style={{ 
                  stroke: status?.color || '#0071e3',
                  strokeDasharray: circumference,
                  strokeDashoffset: strokeDashoffset
                }}
              ></circle>
            </svg>
          </div>
          
          {/* Contenedor de información del archivo */}
          <div className="file-info">
            <span className="file-name">
              {smartTruncate(item.name.replace('.txt', ''), 18)}
            </span>
            <span className="file-updated">{lastUpdated}</span>
          </div>
          
          {/* Icono de menú (aparece en hover) */}
          <i 
            className="fas fa-ellipsis-v file-menu-icon"
            onClick={(e) => {
              e.stopPropagation();
              handleContextMenu(e, 'file', projectIndex, item);
            }}
            title="Menú"
          ></i>
        </li>
      );
    });
  };
  
  // =============================================================================
  // RENDERIZADO PRINCIPAL
  // =============================================================================
  
  return (
    <>
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        {/* Botón para colapsar/expandir */}
        <div 
          className="sidebar-collapse-btn" 
          onClick={onToggleCollapse} 
          title="Colapsar sidebar"
        >
          <i className={`fas fa-chevron-${collapsed ? 'right' : 'left'}`}></i>
        </div>
        
        {/* Header: Perfil de usuario */}
        <div className="sidebar-header">
          <div className="user-profile-header">
            <div className="avatar-container" title="Usuario">
              {avatar ? (
                <img src={avatar} alt="Avatar" className="avatar-img" />
              ) : (
                <div className="avatar-placeholder">
                  <i className="fas fa-user"></i>
                </div>
              )}
            </div>
            <div className="user-info">
              <span className="user-name">{smartTruncate(userName, 12)}</span>
              <span className="user-status">Local</span>
            </div>
          </div>
        </div>
        {/* Navegación rápida: Inicio / Recientes / Tutorial */}
        <div className="sidebar-nav">
          <button className="nav-btn" onClick={() => {
            // Ir a inicio
            if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
              // enviar evento personalizado para manejar en App
              window.dispatchEvent(new CustomEvent('bg-go-home'));
            }
          }}>{t('sidebar.home')}</button>
          <button className="nav-btn" onClick={() => {
            window.dispatchEvent(new CustomEvent('bg-show-recent'));
          }}>{t('sidebar.recent')}</button>
          <button className="nav-btn" onClick={() => {
            // Abrir tutorial en navegador
            if (window && window.electronAPI && window.electronAPI.openExternal) {
              window.electronAPI.openExternal('https://tutorial.com/Blockguard');
            } else {
              window.open('https://tutorial.com/Blockguard', '_blank');
            }
          }}>{t('sidebar.tutorial')}</button>
        </div>
        
        {/* Contenido: Lista de proyectos */}
        <div className="sidebar-content">
          <div className="sidebar-section">
            <div className="section-header">
              <span>{t('sidebar.projects')}</span>
              <button 
                className="btn-add"
                onClick={handleCreateProject}
                title={t('sidebar.newProject')}
              >
                <i className="fas fa-plus"></i>
              </button>
            </div>
            
            <ul className="project-list">
              {projects.map((project, pIndex) => (
                <li 
                  key={pIndex} 
                  className={`project-item ${expandedProjects[pIndex] ? 'open' : ''}`}
                >
                  {/* Cabecera del proyecto */}
                  <div 
                    className="project-header"
                    onContextMenu={(e) => handleContextMenu(e, 'project', pIndex)}
                  >
                    {/* Chevron + Carpeta: Toggle collapse/expand */}
                    <span 
                      className="folder-icons-wrapper"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleProject(pIndex);
                      }}
                      title={expandedProjects[pIndex] ? 'Colapsar' : 'Expandir'}
                    >
                      <i className={`fas fa-chevron-${expandedProjects[pIndex] ? 'down' : 'right'} toggle-icon`}></i>
                      <i className="fas fa-folder folder-icon"></i>
                    </span>
                    {/* Nombre: También toggle collapse/expand */}
                    <span 
                      className="project-name"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleProject(pIndex);
                      }}
                      title="Click para expandir/contraer"
                    >
                      {smartTruncate(project.name, 15)}
                    </span>
                    {/* Botón Ver estructura (abrir visor) */}
                    <i 
                      className="fas fa-folder-open project-view-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewProject && onViewProject(project);
                      }}
                      title="Ver estructura del proyecto"
                    ></i>
                    {/* Menú contextual */}
                    <i 
                      className="fas fa-ellipsis-v project-actions"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleContextMenu(e, 'project', pIndex);
                      }}
                      title="Menú"
                    ></i>
                  </div>
                  
                  {/* Lista de archivos (visible si expandido) */}
                  {expandedProjects[pIndex] && project.items && (
                    <ul className="file-list">
                      {renderFileTree(project.items, pIndex, '', project.path)}
                      
                      {/* Botón para añadir nuevo archivo */}
                      <li 
                        className="add-file-item"
                        onClick={() => handleCreateFile(pIndex)}
                      >
                        <i className="fas fa-plus"></i>
                        <span>{t('sidebar.newFile')}</span>
                      </li>
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        {/* Footer: Configuración */}
        <div className="sidebar-footer">
          <div className="footer-item" onClick={onOpenSettings}>
            <i className="fas fa-cog"></i>
            <span>{t('sidebar.settings')}</span>
          </div>
        </div>
      </aside>
      
      {/* Menú contextual (click derecho) */}
      {contextMenu && (
        <div 
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onMouseLeave={closeContextMenu}
        >
          {contextMenu.type === 'project' && (
            <>
              <div className="context-item" onClick={() => {
                handleCreateFile(contextMenu.projectIndex);
                closeContextMenu();
              }}>
                <i className="fas fa-file-plus"></i>
                <span>{t('sidebar.contextMenu.newFile')} (Ctrl+Shift+N)</span>
              </div>
              <div className="context-item" onClick={() => {
                if (contextMenu?.projectIndex >= 0 && projects?.[contextMenu.projectIndex]) {
                  onViewProject && onViewProject(projects[contextMenu.projectIndex]);
                }
                closeContextMenu();
              }}>
                <i className="fas fa-folder-open"></i>
                <span>{t('sidebar.viewStructure')}</span>
              </div>
              <div className="context-item" onClick={handleRename}>
                <i className="fas fa-edit"></i>
                <span>{t('sidebar.contextMenu.renameProject')}</span>
              </div>
              <div className="context-item" onClick={() => {
                if (contextMenu?.projectIndex >= 0 && projects?.[contextMenu.projectIndex]?.name) {
                  notify(`Proyecto: ${projects[contextMenu.projectIndex].name}`, 'info');
                }
                closeContextMenu();
              }}>
                <i className="fas fa-info-circle"></i>
                <span>{t('sidebar.information')}</span>
              </div>
              <div className="context-item danger" onClick={handleDelete}>
                <i className="fas fa-trash"></i>
                <span>{t('sidebar.contextMenu.deleteProject')}</span>
              </div>
            </>
          )}
          {contextMenu.type === 'file' && (
            <>
              <div className="context-item" onClick={() => {
                // Crear subarchivo dentro del archivo (si el modelo lo permite)
                if (contextMenu?.item) {
                  handleCreateFile(contextMenu.projectIndex, contextMenu.item);
                }
                closeContextMenu();
              }}>
                <i className="fas fa-file-plus"></i>
                <span>{t('sidebar.contextMenu.newSubfile')}</span>
              </div>
              
              <div className="context-item" onClick={handleRename}>
                <i className="fas fa-edit"></i>
                <span>{t('sidebar.contextMenu.renameFile')}</span>
              </div>
              <div className="context-item" onClick={() => {
                onOpenFile(contextMenu.projectIndex, contextMenu.item);
                closeContextMenu();
              }}>
                <i className="fas fa-book-open"></i>
                <span>{t('sidebar.contextMenu.openEdit')}</span>
              </div>
              <div className="context-item danger" onClick={handleDelete}>
                <i className="fas fa-trash"></i>
                <span>{t('sidebar.contextMenu.deleteFile')}</span>
              </div>
            </>
          )}
          {contextMenu.type === 'folder' && (
            <>
              <div className="context-item" onClick={() => {
                handleCreateFile(contextMenu.projectIndex, contextMenu.item);
                closeContextMenu();
              }}>
                <i className="fas fa-file-plus"></i>
                <span>{t('sidebar.contextMenu.newFileInFolder')}</span>
              </div>
              <div className="context-item" onClick={handleRename}>
                <i className="fas fa-edit"></i>
                <span>{t('sidebar.contextMenu.renameFolder')}</span>
              </div>
              <div className="context-item" onClick={() => {
                notify(`Carpeta: ${contextMenu.item.name}`, 'info');
                closeContextMenu();
              }}>
                <i className="fas fa-info-circle"></i>
                <span>{t('sidebar.information')}</span>
              </div>
              <div className="context-item danger" onClick={handleDelete}>
                <i className="fas fa-trash"></i>
                <span>{t('sidebar.contextMenu.deleteFolder')}</span>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

export default Sidebar;
