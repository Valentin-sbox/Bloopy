/**
 * ============================================================================
 * FILE SELECTOR COMPONENT
 * ============================================================================
 * 
 * Lista de archivos para seleccionar en paneles vacíos
 * ============================================================================
 */

import React, { useState } from 'react';
import { useMemo, useCallback } from 'react';
import '../styles/file-selector.css';
import { getIconById, DEFAULT_FILE_ICON } from '../utils/iconLibrary';
import Icon from '@mdi/react';
import { 
  mdiChevronDown, 
  mdiChevronRight, 
  mdiFolder, 
  mdiFolderOpen, 
  mdiHarddisk, 
  mdiInbox 
} from '@mdi/js';

const FileSelector = ({ projects, activeProjectIndex, onFileSelect, title, showSubFiles = false, fileIcons }) => {
  // Separar proyectos de archivos en la raíz
    const projectItems = useMemo(() => (projects || []).filter(item =>
      item.path !== undefined && (item.type === undefined || item.type === 'project')
    ), [projects]);
    const rootItems = useMemo(() => (projects || []).filter(item =>
      !(item.path !== undefined && (item.type === undefined || item.type === 'project'))
    ), [projects]);

  const [selectedProject, setSelectedProject] = useState(
    activeProjectIndex !== null ? activeProjectIndex : (rootItems.length > 0 ? 'root' : 0)
  );
  const [expandedFiles, setExpandedFiles] = useState(new Set());

    const toggleFileExpansion = useCallback((filePath) => {
      const newExpanded = new Set(expandedFiles);
      if (newExpanded.has(filePath)) {
        newExpanded.delete(filePath);
      } else {
        newExpanded.add(filePath);
      }
      setExpandedFiles(newExpanded);
    }, [expandedFiles]);

    const renderFileTree = useCallback((items, level = 0, depth = 0) => {
    if (!items || items.length === 0) return null;

    // Filtrar archivos .canvas - solo mostrar .txt y carpetas
    const filteredItems = items.filter(item => {
      if (item.type === 'folder') return true; // Mostrar todas las carpetas
      if (item.type === 'file') {
        // Solo mostrar archivos .txt, excluir .canvas
        return item.fullPath && !item.fullPath.toLowerCase().endsWith('.canvas');
      }
      return true;
    });

    // Sort items by order for consistency
    const sortedItems = [...filteredItems].sort((a, b) => {
      const orderA = a.order ?? 0;
      const orderB = b.order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return (a.name || '').localeCompare(b.name || '');
    });

    return sortedItems.map((item) => {
      const hasChildren = item.items && item.items.length > 0;
      const isExpanded = expandedFiles.has(item.fullPath);

      return (
        <div key={item.fullPath} className="file-selector-node">
          <div
            className={`file-selector-item ${item.type === 'folder' ? 'folder' : 'file'} ${hasChildren ? 'has-children' : ''}`}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
          >
            {hasChildren && (
              <button
                className="file-toggle-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFileExpansion(item.fullPath);
                }}
              >
                <Icon path={isExpanded ? mdiChevronDown : mdiChevronRight} size={0.6} />
              </button>
            )}
            {!hasChildren && <span className="indicator-spacer" style={{ width: 20 }} />}

            <div
              className="file-selector-item-content"
              onClick={() => {
                if (item.type === 'file') {
                  onFileSelect(item);
                } else {
                  toggleFileExpansion(item.fullPath);
                }
              }}
            >
              {item.type === 'folder' ? (
                <Icon path={mdiFolder} size={0.7} className="folder-icon" />
              ) : (
                (() => {
                  const customIconId = fileIcons?.get(item.fullPath);
                  const iconData = customIconId ? getIconById(customIconId) : DEFAULT_FILE_ICON;
                  const iconPath = iconData?.icon || DEFAULT_FILE_ICON.icon;
                  return <Icon path={iconPath} size={0.7} />;
                })()
              )}
              <span className="name">{item.name.replace(/\.(txt|canvas)$/i, '')}</span>
              {hasChildren && <span className="children-count">({item.items.length})</span>}
            </div>
          </div>

          {hasChildren && isExpanded && (
            <div className="file-selector-children">
              {renderFileTree(item.items, level + 1, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  });

  return (
    <div className="file-selector">
      <div className="file-selector-header">
        <Icon path={mdiFolderOpen} size={0.8} />
        <h3>{title}</h3>
      </div>

      {(projectItems.length > 0 || rootItems.length > 0) && (
        <>
          <div className="file-selector-projects">
            {rootItems.length > 0 && (
              <button
                className={`project-btn root-btn ${selectedProject === 'root' ? 'active' : ''}`}
                onClick={() => setSelectedProject('root')}
              >
                <Icon path={mdiHarddisk} size={0.7} />
                Root
              </button>
            )}
            {projectItems.map((project, index) => (
              <button
                key={project.id || project.path}
                className={`project-btn ${selectedProject === index ? 'active' : ''}`}
                onClick={() => setSelectedProject(index)}
              >
                <Icon path={mdiFolder} size={0.7} />
                {project.name}
              </button>
            ))}
          </div>

          <div className="file-selector-tree">
            {selectedProject === 'root'
              ? renderFileTree(rootItems)
              : projectItems[selectedProject] && renderFileTree(projectItems[selectedProject].items)
            }
          </div>
        </>
      )}

      {projectItems.length === 0 && rootItems.length === 0 && (
        <div className="file-selector-empty">
          <Icon path={mdiInbox} size={1.2} />
          <p>No hay proyectos ni archivos disponibles</p>
        </div>
      )}
    </div>
  );
};

export default FileSelector;
