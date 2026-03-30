/**
 * ============================================================================
 *  WELCOMESCREEN.JS
 * ============================================================================
 * 
 * COMPONENTE: PANTALLA DE BIENVENIDA
 * 
 * Muestra la pantalla inicial cuando no hay ningún archivo abierto.
 * Incluye saludo personalizado según hora, notas rápidas y archivos recientes.
 * 
 * FUNCIONALIDADES:
 * - Saludo personalizado según hora del día
 * - Input de notas rápidas (150 caracteres)
 * - Lista de archivos recientes
 * - Información del workspace actual
 * 
 * PROPS:
 * - workspacePath: string - Ruta del workspace actual
 * - projects: Array - Lista de proyectos
 * - userName: string - Nombre del usuario para personalizar
 * - onCreateWorkspace: function - Callback para crear nuevo workspace
 * - onSelectWorkspace: function - Callback para abrir workspace existente
 * - onOpenFile: function - Callback al abrir un archivo reciente
 * - hasWorkspace: boolean - Si ya hay un workspace configurado
 * 
 * RELACIONADO CON:
 * - src/App.js: Gestiona el estado y pasa datos/props
 * - src/styles/index.css: Estilos de .welcome-screen
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from '../utils/i18n';
import { getIconById, DEFAULT_FILE_ICON } from '../utils/iconLibrary';
import Icon from '@mdi/react';
import { 
  mdiPlusCircle, 
  mdiFolderOpen, 
  mdiSitemap, 
  mdiPenPlus, 
  mdiChartLine, 
  mdiHistory, 
  mdiInbox, 
  mdiFolder, 
  mdiSwapHorizontal 
} from '@mdi/js';

function WelcomeScreen({ 
  workspacePath, 
  projects, 
  userName, 
  onCreateWorkspace, 
  onSelectWorkspace, 
  onOpenFile,
  onCreateProject,
  hasWorkspace,
  showSection = 'all' // 'all' | 'recent'
}) {
  const { t } = useTranslation();

  // Obtener saludo según hora del día
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return t('welcome.goodMorning');
    } else if (hour >= 12 && hour < 20) {
      return t('welcome.goodAfternoon');
    } else {
      return t('welcome.goodEvening');
    }
  };

  /**
   * Obtiene los archivos más recientes de todos los proyectos.
   * @returns {Array} Lista de archivos ordenados por fecha
   */
  const getRecentFiles = () => {
    const allFiles = [];
    
    // Recorrer todos los proyectos
    projects.forEach((project, pIndex) => {
      /**
       * Función recursiva para recolectar archivos de carpetas anidadas.
       * @param {Array} items - Items a procesar
       */
      const collectFiles = (items) => {
        items.forEach(item => {
          if (item.type === 'file') {
            allFiles.push({
              ...item,
              projectIndex: pIndex,
              projectName: project.name
            });
          }
          // Si tiene subitems (carpeta), procesar recursivamente
          if (item.items) {
            collectFiles(item.items);
          }
        });
      };
      
      if (project.items) {
        collectFiles(project.items);
      }
    });
    
    // Ordenar por fecha de última actualización (más reciente primero)
    // Tomar solo los 6 más recientes
    return allFiles
      .sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0))
      .slice(0, 6);
  };
  
  const recentFiles = getRecentFiles();
  
  // =============================================================================
  // VISTA: Sin workspace configurado
  // =============================================================================
  if (!hasWorkspace) {
    return (
      <div className="welcome-screen">
        <div className="welcome-content">
          <div className="welcome-logo">
            <img src="assets/icon.png" alt="Bloopy" style={{ width: '120px', height: '120px' }} />
          </div>
          <h1>Bloopy</h1>
          <p className="welcome-subtitle">{t('welcome.subtitle')}</p>
          
          <div className="welcome-actions">
            <button className="btn-primary btn-large" onClick={onCreateWorkspace}>
              <Icon path={mdiPlusCircle} size={0.8} /> {t('welcome.createWorkspace')}
            </button>
            <button className="btn-sub btn-large" onClick={onSelectWorkspace}>
              <Icon path={mdiFolderOpen} size={0.8} /> {t('welcome.openWorkspace')}
            </button>
          </div>
          
          <p className="welcome-hint">
            {t('welcome.createWorkspaceHint')}
          </p>
          
          <div className="welcome-features">
            <div className="feature-item">
              <Icon path={mdiSitemap} size={0.8} />
              <span>{t('welcome.features.organize')}</span>
            </div>
            <div className="feature-item">
              <Icon path={mdiPenPlus} size={0.8} />
              <span>{t('welcome.features.write')}</span>
            </div>
            <div className="feature-item">
              <Icon path={mdiChartLine} size={0.8} />
              <span>{t('welcome.features.track')}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // =============================================================================
  // VISTA: Con workspace configurado
  // =============================================================================
  return (
    <div className="welcome-screen">
      <div className="welcome-content-new">
        {/* Header principal con saludo y recientes en 2 columnas */}
        <div className="welcome-two-column-layout">
          {/* Columna izquierda: Saludo */}
          <div className="welcome-greeting-column">
            <h1>{getGreeting()}, {userName}</h1>
            <p className="welcome-subtitle-new">{t('welcome.whatToWriteToday')}</p>
          </div>

          {/* Columna derecha: Archivos recientes */}
          <div className="recent-files-column">
            <h2>
              <Icon path={mdiHistory} size={0.8} /> {t('welcome.recentFiles')}
            </h2>
            {recentFiles.length > 0 ? (
              <ul className="recent-files-list">
                {recentFiles.map((file, index) => {
                  // Get custom icon
                  const customIconId = file.customIcon;
                  const iconData = customIconId ? getIconById(customIconId) : DEFAULT_FILE_ICON;
                  const iconPath = iconData?.icon || DEFAULT_FILE_ICON.icon;
                  
                  return (
                    <li 
                      key={index}
                      className="recent-file-item"
                      onClick={() => onOpenFile(file.projectIndex, file)}
                    >
                      <Icon path={iconPath} size={0.7} className="file-icon" />
                      <span className="file-name">{file.name.replace(/\.(txt|canvas)$/i, '')}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="empty-state">
                <Icon path={mdiInbox} size={1.2} />
                <p>{t('welcome.noRecentFiles')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer con workspace info */}
        <div className="welcome-footer-section">
          <div className="workspace-info-card">
            <div className="workspace-icon">
              <img src="assets/icon.png" alt="Bloopy" />
            </div>
            <div className="workspace-details">
              <span className="workspace-label">{t('welcome.currentWorkspace')}</span>
              <span className="workspace-path" title={workspacePath}>
                <Icon path={mdiFolder} size={0.7} /> {workspacePath}
              </span>
            </div>
            <button 
              className="btn-change-workspace"
              onClick={onSelectWorkspace}
              title={t('welcome.changeWorkspace')}
            >
              <Icon path={mdiSwapHorizontal} size={0.7} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WelcomeScreen;
