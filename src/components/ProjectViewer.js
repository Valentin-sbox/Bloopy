/**
 * ============================================================================
 *  PROJECTVIEWER.JS
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

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from '../utils/i18n';
import { getIconById, DEFAULT_FILE_ICON } from '../utils/iconLibrary';
import Icon from '@mdi/react';
import { 
  mdiChevronDown, 
  mdiChevronRight, 
  mdiClose 
} from '@mdi/js';

function ProjectViewer({ project, projectIndex, onOpenFile, onClose, config, onCreateFile, onRefresh, notify, onCreateSubFile, fileIcons }) {
  const { t } = useTranslation();

  // Estado de carpetas expandidas (almacena rutas)
  const [expandedFolders, setExpandedFolders] = useState({});

  /**
   * Toggle de expansión de una carpeta
   */
  const toggleFolder = useCallback((nodeKey) => {
    setExpandedFolders(prev => ({
      ...prev,
      [nodeKey]: !prev[nodeKey]
    }));
  }, []);

  /**
   * Renderiza recursivamente el árbol de items
   */
  const renderItemTree = useCallback((items, basePath = '') => {
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

    // Sort items by order for consistency
    const sortedItems = [...items].sort((a, b) => {
      const orderA = a.order ?? 0;
      const orderB = b.order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return (a.name || '').localeCompare(b.name || '');
    });

    return sortedItems.map((item) => {
      const currentPath = basePath ? `${basePath}/${item.name}` : item.name;
      const isExpanded = expandedFolders[item.fullPath];

      // Si es carpeta
      if (item.type === 'folder') {
        const hasChildren = item.items && item.items.length > 0;
        return (
          <div key={currentPath} className="tree-item folder-item">
            <div className="tree-item-header">
              <button
                className="toggle-folder-btn"
                onClick={() => hasChildren && toggleFolder(item.fullPath)}
                aria-expanded={isExpanded}
                title={isExpanded ? t('projectViewer.collapseFolder') : t('projectViewer.expandFolder')}
              >
                {hasChildren ? (
                  <Icon path={isExpanded ? mdiChevronDown : mdiChevronRight} size={0.6} />
                ) : (
                  <span style={{ width: 14 }} />
                )}
              </button>

              <span className="folder-name">{item.name}</span>
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
      const progress = Math.min(100, (item.lastCharCount / (item.goal || 30000)) * 100) || 0;

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
          >
            <div className="tree-item-header">
              {/* Botón de expandir si tiene sub-archivos */}
              <button
                className="toggle-folder-btn"
                onClick={(e) => {
                  if (item.items && item.items.length > 0) {
                    e.stopPropagation();
                    toggleFolder(item.fullPath);
                  }
                }}
                style={{ visibility: (item.items && item.items.length > 0) ? 'visible' : 'hidden' }}
              >
                <Icon path={isExpanded ? mdiChevronDown : mdiChevronRight} size={0.6} />
              </button>

              {/* Custom icon display */}
              <div className="file-icon-display">
                {(() => {
                  // Get custom icon from fileIcons state or use default
                  const customIconId = fileIcons?.get(item.fullPath);
                  const iconData = customIconId ? getIconById(customIconId) : DEFAULT_FILE_ICON;
                  const iconPath = iconData?.icon || DEFAULT_FILE_ICON.icon;

                  return <Icon path={iconPath} size={0.7} title={iconData?.label || 'Archivo'} style={{ color: status?.color || 'var(--accent-primary)' }} />;
                })()}
              </div>

              {/* Nombre del archivo */}
              <span className="file-name-simple">
                {item.name.replace(/\.(txt|canvas)$/i, '')}
              </span>

              {/* Indicador de progreso mini */}
              <div className="progress-indicator-mini">
                <div
                  className="progress-bar-mini"
                  style={{
                    width: `${progress}%`,
                    background: status?.color || 'var(--accent-primary)'
                  }}
                />
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
  }, [expandedFolders, toggleFolder, t, config, projectIndex, onOpenFile, onClose, onRefresh, fileIcons]);

  const visibleItems = useMemo(() => {
    if (!project || !project.items) return [];
    return project.items.filter(item => item && item.name);
  }, [project]);

  if (!project) return null;

  return (
    <div className="project-viewer-container">
      <div className="project-viewer-header">
        <div className="project-viewer-breadcrumb">
          <span className="breadcrumb-item" onClick={onClose}>{t('sidebar.home')}</span>
          <span className="breadcrumb-separator"><Icon path={mdiChevronRight} size={0.6} /></span>
          <span className="breadcrumb-item active">{project.name}</span>
        </div>
        <button className="close-viewer-btn" onClick={onClose}>
          <Icon path={mdiClose} size={0.7} />
        </button>
      </div>
      <div className="project-viewer-content">
        <div className="project-tree">
          {project.items && project.items.length > 0 ? (
            renderItemTree(project.items)
          ) : (
            <div className="empty-project-message">
              {t('projectViewer.emptyProject')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectViewer;
