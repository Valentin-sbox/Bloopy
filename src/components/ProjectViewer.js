/**
 * ============================================================================
 * BLOCK GUARD v4.0.0 - PROJECTVIEWER.JS
 * ============================================================================
 * 
 * COMPONENTE: VISOR DE PROYECTO
 * 
 * Muestra la estructura completa de un proyecto (carpetas y archivos)
 * en una vista jerárquica tipo árbol. Permite navegar y abrir archivos
 * directamente desde esta vista.
 * 
 * FUNCIONALIDADES:
 * - Ver estructura de carpetas y archivos del proyecto
 * - Expandir/colapsar carpetas
 * - Abrir archivos directamente
 * - Mostrar progreso de escritura en cada archivo
 * - Navegar por breadcrumbs
 * 
 * PROPS:
 * - project: Object - Proyecto a visualizar
 * - projectIndex: number - Índice del proyecto
 * - onOpenFile: function - Callback al abrir archivo
 * - onClose: function - Callback al cerrar
 * - config: Object - Configuración (color de estados)
 * 
 * RELACIONADO CON:
 * - src/App.js: Contenedor principal
 * - src/components/Sidebar.js: Puede activar este viewer
 * ============================================================================
 */

import React, { useState } from 'react';
import { smartTruncate } from '../utils/helpers';
import { useTranslation } from '../utils/i18n';

function ProjectViewer({ project, projectIndex, onOpenFile, onClose, config, onCreateFile, onRefresh, notify, onCreateSubFile }) {
  const { t } = useTranslation();
  
  // Estado de carpetas expandidas (almacena rutas)
  const [expandedFolders, setExpandedFolders] = useState({});

  /**
   * Toggle de expansión de una carpeta
   */
  const toggleFolder = (folderPath) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderPath]: !prev[folderPath]
    }));
  };

  /**
   * Renderiza recursivamente el árbol de items
   */
  const renderItemTree = (items, basePath = '') => {
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

    return items.map((item, index) => {
      const currentPath = basePath ? `${basePath}/${item.name}` : item.name;
      const isExpanded = expandedFolders[currentPath];

      // Si es carpeta
      if (item.type === 'folder') {
        const hasChildren = item.items && item.items.length > 0;
        return (
          <div key={currentPath} className="tree-item folder-item">
            <div className="tree-item-header">
              <button
                className="toggle-folder-btn"
                onClick={() => hasChildren && toggleFolder(currentPath)}
                aria-expanded={isExpanded}
                title={isExpanded ? 'Colapsar carpeta' : 'Expandir carpeta'}
              >
                {hasChildren ? (
                  <i className={`fas fa-chevron-${isExpanded ? 'down' : 'right'}`}></i>
                ) : (
                  <span style={{ width: 14 }} />
                )}
              </button>

              <i className="fas fa-folder folder-icon"></i>
              <span className="item-name">{smartTruncate(item.name, 30)}</span>

              <div className="tree-item-actions">
                <button
                  className="action-btn"
                  title={t('projectViewer.newFile')}
                  onClick={(e) => {
                    e.stopPropagation();
                    const name = window.prompt(t('projectViewer.newFile'));
                    if (name) {
                      const final = name.endsWith('.txt') ? name : `${name}.txt`;
                      if (onCreateFile) onCreateFile(projectIndex, final, item.fullPath);
                      onRefresh && onRefresh();
                    }
                  }}
                >
                  <i className="fas fa-file-medical"></i>
                </button>

                <button
                  className="action-btn"
                  title={t('sidebar.rename')}
                  onClick={async (e) => {
                    e.stopPropagation();
                    const newName = window.prompt(t('sidebar.rename'), item.name);
                    if (newName && newName !== item.name) {
                      try {
                        if (window.electronAPI && window.electronAPI.renameFolder) {
                          const newFull = item.fullPath.replace(item.name, newName);
                          await window.electronAPI.renameFolder(item.fullPath, newName);
                          onRefresh && onRefresh();
                          notify && notify(t('projectViewer.renamed'), 'success');
                        }
                      } catch (err) {
                        console.error(err);
                        notify && notify(t('projectViewer.errorRenaming'), 'error');
                      }
                    }
                  }}
                >
                  <i className="fas fa-edit"></i>
                </button>

                <button
                  className="action-btn danger"
                  title={t('common.delete')}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(t('projectViewer.confirmDelete', { name: item.name }))) {
                      if (window.electronAPI && window.electronAPI.deleteItem) {
                        window.electronAPI.deleteItem(item.fullPath, false).then(() => {
                          onRefresh && onRefresh();
                        }).catch(err => {
                          console.error(err);
                          notify && notify(t('projectViewer.errorDeleting'), 'error');
                        });
                      }
                    }
                  }}
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            </div>

            {isExpanded && hasChildren && (
              <div className="tree-children">
                {renderItemTree(item.items, currentPath)}
              </div>
            )}
          </div>
        );
      }

      // Si es archivo
      const status = config?.states?.find(s => s.id === item.status) || config?.states?.[0];
      const progress = Math.min(100, (item.lastCharCount / (item.goal || 30000)) * 100);
      const circumference = 2 * Math.PI * 9;
      const strokeDashoffset = circumference - (progress / 100) * circumference;
      const lastUpdated = item.lastUpdated ? getRelativeTime(item.lastUpdated) : 'Sin fecha';

      return (
        <div
          key={currentPath}
          className="tree-item-wrapper"
        >
          <div
            className="tree-item file-item"
            onClick={() => {
              onOpenFile(projectIndex, item);
              onClose(); // Cerrar visor automáticamente
            }}
            role="button"
            tabIndex={0}
            title={`${t('sidebar.lastUpdated')}: ${lastUpdated}`}
          >
            <div className="tree-item-header">
              {/* Botón de expandir si tiene sub-archivos */}
              <button
                className="toggle-folder-btn"
                onClick={(e) => {
                  if (item.items && item.items.length > 0) {
                    e.stopPropagation();
                    toggleFolder(currentPath);
                  }
                }}
                style={{ visibility: (item.items && item.items.length > 0) ? 'visible' : 'hidden' }}
              >
                <i className={`fas fa-chevron-${isExpanded ? 'down' : 'right'}`}></i>
              </button>

              <div className="file-progress-small">
                <svg className="circle-progress-small" viewBox="0 0 24 24">
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
              <div className="file-info-project">
                <span className="item-name">
                  {smartTruncate(item.name.replace('.txt', ''), 25)}
                </span>
                <span className="file-updated-small">{lastUpdated}</span>
              </div>
              <div className="tree-item-actions">
                <span className="progress-percent">{Math.round(progress)}%</span>

                {/* Boton Agregar Sub-archivo */}
                <button
                  className="action-btn"
                  title={t('projectViewer.addSubfile')}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onCreateSubFile) onCreateSubFile(item);
                  }}
                >
                  <i className="fas fa-plus-circle"></i>
                </button>

                <button
                  className="action-btn"
                  title={t('sidebar.rename')}
                  onClick={(e) => {
                    e.stopPropagation();
                    const base = item.name.replace('.txt', '');
                    const newName = window.prompt(t('sidebar.rename'), base);
                    if (newName && newName !== base) {
                      const final = newName.endsWith('.txt') ? newName : `${newName}.txt`;
                      if (window.electronAPI && window.electronAPI.renameFile) {
                        window.electronAPI.renameFile(item.fullPath, final).then(() => {
                          onRefresh && onRefresh();
                          notify && notify(t('projectViewer.renamed'), 'success');
                        }).catch(err => {
                          console.error(err);
                          notify && notify(t('projectViewer.errorRenaming'), 'error');
                        });
                      }
                    }
                  }}
                >
                  <i className="fas fa-edit"></i>
                </button>

                <button
                  className="action-btn danger"
                  title={t('common.delete')}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(t('projectViewer.confirmDelete', { name: item.name }))) {
                      if (window.electronAPI && window.electronAPI.deleteItem) {
                        window.electronAPI.deleteItem(item.fullPath, false).then(() => {
                          onRefresh && onRefresh();
                        }).catch(err => {
                          console.error(err);
                          notify && notify(t('projectViewer.errorDeleting'), 'error');
                        });
                      }
                    }
                  }}
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            </div>
          </div>

          {/* Renderizar hijos si está expandido */}
          {isExpanded && item.items && item.items.length > 0 && (
            <div className="tree-children">
              {renderItemTree(item.items, currentPath)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="project-viewer-container">
      {/* Header */}
      <div className="project-viewer-header">
        {/* Botón volver + Título en el mismo contenedor */}
        <div className="header-left">
          <button
            className="back-btn-project-viewer"
            onClick={onClose}
            title={t('common.back')}
          >
            <i className="fas fa-arrow-left"></i>
            <span>{t('common.back')}</span>
          </button>
          <h2 className="project-viewer-title">{smartTruncate(project?.name || t('projectViewer.title'), 30)}</h2>
        </div>
        <div className="header-actions">
          <button
            className="btn-project-viewer btn-new-file"
            onClick={() => {
              const name = window.prompt(t('projectViewer.newFile'));
              if (name && name.trim()) {
                const final = name.endsWith('.txt') ? name : `${name}.txt`;
                if (onCreateFile) onCreateFile(projectIndex, final, project.path);
                if (onRefresh) onRefresh();
              }
            }}
            title={t('projectViewer.newFile')}
          >
            <i className="fas fa-file-medical"></i>
            <span>{t('projectViewer.newFile')}</span>
          </button>

          <button
            className="btn-project-viewer btn-new-folder"
            onClick={async () => {
              const name = window.prompt(t('projectViewer.newFolder'));
              if (!name || !name.trim()) return;
              if (window.electronAPI && window.electronAPI.createFolder) {
                try {
                  await window.electronAPI.createFolder(project.path, name);
                  onRefresh && onRefresh();
                  notify && notify(t('projectViewer.folderCreated'), 'success');
                } catch (err) {
                  console.error('Error creando carpeta', err);
                  notify && notify(t('projectViewer.errorCreating'), 'error');
                }
              } else {
                notify && notify(t('notifications.folderNotSupported'), 'warning');
              }
            }}
            title={t('projectViewer.newFolder')}
          >
            <i className="fas fa-folder-plus"></i>
            <span>{t('projectViewer.newFolder')}</span>
          </button>
        </div>
      </div>

      {/* Contenido del árbol */}
      <div className="project-viewer-tree">
        {project?.items && project.items.length > 0 ? (
          renderItemTree(project.items)
        ) : (
          <div className="empty-state">
            <i className="fas fa-folder-open"></i>
            <p>{t('projectViewer.emptyProject')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectViewer;
