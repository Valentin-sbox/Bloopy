/**
 * ============================================================================
 * TAB BAR COMPONENT
 * ============================================================================
 * 
 * Barra de pestañas para archivos abiertos.
 * Cada tab tiene 3 botones inline: split view, explorador, cerrar.
 * Sin menú contextual.
 * ============================================================================
 */

import React, { useState } from 'react';
import '../styles/tab-bar.css';
import { getIconById, DEFAULT_FILE_ICON } from '../utils/iconLibrary';
import { useTranslation } from '../utils/i18n';
import Icon from '@mdi/react';
import { 
  mdiViewSplitVertical, 
  mdiNote, 
  mdiClose, 
  mdiFolder
} from '@mdi/js';

const TabBar = ({ 
  tabs, 
  activeTabIndex, 
  onTabClick, 
  onTabClose, 
  onTabReorder,
  onSplitHorizontal,
  splitMode,
  leftPanelFile,
  rightPanelFile,
  activeFile,
  onCloseSplit,
  onRestoreSplit,
  splitViewState,
  fileIcons
}) => {
  const { t } = useTranslation();
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('dragging');
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      onTabReorder(draggedIndex, index);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = (e) => {
    if (e && e.currentTarget) {
      e.currentTarget.classList.remove('dragging');
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const getFileName = (fullPath) => {
    if (!fullPath) return t('common.untitled');
    const parts = fullPath.split(/[/\\]/);
    let name = parts[parts.length - 1].replace(/\.(txt|canvas)$/i, '');
    if (name.length > 12) name = name.substring(0, 12) + '...';
    return name;
  };

  const getFileIcon = (file) => {
    if (file.type === 'folder') return { icon: mdiFolder };
    if (file.fullPath && file.fullPath.toLowerCase().endsWith('.canvas')) {
      return { icon: mdiNote, color: '#8B5CF6' };
    }
    const customIconId = fileIcons?.get(file.fullPath);
    const iconData = customIconId ? getIconById(customIconId) : DEFAULT_FILE_ICON;
    return { 
      icon: iconData?.icon || DEFAULT_FILE_ICON.icon,
      color: iconData?.color
    };
  };

  const handleShowInExplorer = async (e, tab) => {
    e.stopPropagation();
    try {
      if (window.electronAPI?.showItemInFolder) {
        await window.electronAPI.showItemInFolder(tab.fullPath);
      }
    } catch (error) {
      console.error('Error showing in explorer:', error);
    }
  };

  // Determinar si se puede abrir en split view:
  // - no estar ya en split mode
  // - no ser un archivo canvas
  // - no ser el mismo archivo que está activo actualmente
  // - no ser un archivo que ya está en alguno de los paneles del split
  const canSplit = (tab) => {
    if (splitMode !== 'none') return false;
    if (tab.fullPath?.toLowerCase().endsWith('.canvas')) return false;
    if (!activeFile) return false;
    if (tab.fullPath === activeFile.fullPath) return false;
    if (leftPanelFile && tab.fullPath === leftPanelFile.fullPath) return false;
    if (rightPanelFile && tab.fullPath === rightPanelFile.fullPath) return false;
    return true;
  };

  // Split-tab fusionada
  const splitIsVisible = splitMode !== 'none';
  const persistedLeftId = splitViewState?.leftTabId;
  const persistedRightId = splitViewState?.rightTabId;

  const effectiveLeftFile = splitIsVisible
    ? leftPanelFile
    : (persistedLeftId ? tabs.find(t => t.fullPath === persistedLeftId) : null);
  const effectiveRightFile = splitIsVisible
    ? rightPanelFile
    : (persistedRightId ? tabs.find(t => t.fullPath === persistedRightId) : null);

  const hasSplitGroup = !!(effectiveLeftFile && effectiveRightFile);

  if (hasSplitGroup) {
    const leftTabIndex = tabs.findIndex(tab => effectiveLeftFile && tab.fullPath === effectiveLeftFile.fullPath);
    const rightTabIndex = tabs.findIndex(tab => effectiveRightFile && tab.fullPath === effectiveRightFile.fullPath);

    return (
      <div className="tab-bar">
        <div className="tab-list">
          {tabs.map((tab, index) => {
            if (index === leftTabIndex || index === rightTabIndex) return null;
            return (
              <div
                key={tab.fullPath || index}
                className={`tab-item ${index === activeTabIndex ? 'active' : ''}`}
                onClick={() => onTabClick(index)}
              >
                <Icon path={getFileIcon(tab).icon} size={0.6} color={getFileIcon(tab).color} className="tab-icon" />
                <span className="tab-name">{getFileName(tab.fullPath || tab.name)}</span>
                {tab.hasChanges && <span className="tab-unsaved"></span>}
                <div className="tab-actions">
                  <button
                    className="tab-action-btn"
                    onClick={(e) => handleShowInExplorer(e, tab)}
                    title={t('sidebar.contextMenu.showInExplorer')}
                  >
                    <Icon path={mdiFolder} size={0.45} />
                  </button>
                  <button
                    className="tab-close"
                    onClick={(e) => { e.stopPropagation(); onTabClose(index); }}
                    title={t('common.close')}
                  >
                    <Icon path={mdiClose} size={0.5} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Tab fusionada del split */}
          <div
            className={`tab-item split-tab ${splitMode !== 'none' ? 'active' : ''}`}
            onClick={() => {
              if (splitMode === 'none' && onRestoreSplit) {
                onRestoreSplit();
              } else {
                if (leftTabIndex >= 0) onTabClick(leftTabIndex);
              }
            }}
          >
            <div className="split-tab-files">
              <Icon path={getFileIcon(effectiveLeftFile).icon} color={getFileIcon(effectiveLeftFile).color} size={0.6} className="tab-icon" />
              <span className="tab-name">
                <span className="split-label">L</span> {getFileName(effectiveLeftFile.fullPath || effectiveLeftFile.name)}
              </span>
              <div className="split-divider-icon">
                <Icon path={mdiViewSplitVertical} size={0.5} />
              </div>
              <Icon path={getFileIcon(effectiveRightFile).icon} color={getFileIcon(effectiveRightFile).color} size={0.6} className="tab-icon" />
              <span className="tab-name">
                <span className="split-label">R</span> {getFileName(effectiveRightFile.fullPath || effectiveRightFile.name)}
              </span>
              <button
                className="tab-close"
                onClick={(e) => { e.stopPropagation(); onCloseSplit && onCloseSplit(); }}
                title={t('tabBar.closeSplitView')}
                style={{ marginLeft: 8 }}
              >
                <Icon path={mdiClose} size={0.5} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Modo normal
  return (
    <div className="tab-bar">
      <div className="tab-list">
        {tabs.map((tab, index) => (
          <div
            key={tab.fullPath || index}
            className={`tab-item ${index === activeTabIndex ? 'active' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            onClick={() => onTabClick(index)}
          >
            <Icon path={getFileIcon(tab).icon} size={0.6} color={getFileIcon(tab).color} className="tab-icon" />
            <span className="tab-name">{getFileName(tab.fullPath || tab.name)}</span>
            {tab.hasChanges && <span className="tab-unsaved"></span>}
            <div className="tab-actions">
              {canSplit(tab) && (
                <button
                  className="tab-action-btn"
                  onClick={(e) => { e.stopPropagation(); onSplitHorizontal && onSplitHorizontal(tab); }}
                  title={t('sidebar.contextMenu.splitRight')}
                >
                  <Icon path={mdiViewSplitVertical} size={0.45} />
                </button>
              )}
              <button
                className="tab-action-btn"
                onClick={(e) => handleShowInExplorer(e, tab)}
                title={t('sidebar.contextMenu.showInExplorer')}
              >
                <Icon path={mdiFolder} size={0.45} />
              </button>
              <button
                className="tab-close"
                onClick={(e) => { e.stopPropagation(); onTabClose(index); }}
                title={t('common.close')}
              >
                <Icon path={mdiClose} size={0.5} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TabBar;
