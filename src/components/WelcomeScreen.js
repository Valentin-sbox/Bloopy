/**
 * ============================================================================
 * BLOCK GUARD v4.0.0 - WELCOMESCREEN.JS
 * ============================================================================
 * 
 * COMPONENTE: PANTALLA DE BIENVENIDA
 * 
 * Muestra la pantalla inicial cuando no hay ningún archivo abierto.
 * Incluye acciones principales, proyectos recientes y archivos recientes.
 * 
 * FUNCIONALIDADES:
 * - Mostrar logo y mensaje de bienvenida personalizado
 * - Botones para crear o abrir workspace
 * - Grid de proyectos disponibles
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

import React from 'react';
import { smartTruncate } from '../utils/helpers';
import { useTranslation } from '../utils/i18n';

function WelcomeScreen({ 
  workspacePath, 
  projects, 
  userName, 
  onCreateWorkspace, 
  onSelectWorkspace, 
  onOpenFile,
  hasWorkspace,
  showSection = 'all' // 'all' | 'recent'
}) {
  const { t } = useTranslation();

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
            <i className="fas fa-shield-halved"></i>
          </div>
          <h1>Block Guard</h1>
          <p className="welcome-subtitle">{t('welcome.subtitle')}</p>
          
          <div className="welcome-actions">
            <button className="btn-primary btn-large" onClick={onCreateWorkspace}>
              <i className="fas fa-plus-circle"></i> {t('welcome.createWorkspace')}
            </button>
            <button className="btn-sub btn-large" onClick={onSelectWorkspace}>
              <i className="fas fa-folder-open"></i> {t('welcome.openWorkspace')}
            </button>
          </div>
          
          <p className="welcome-hint">
            {t('welcome.createWorkspaceHint')}
          </p>
          
          <div className="welcome-features">
            <div className="feature-item">
              <i className="fas fa-folder-tree"></i>
              <span>{t('welcome.features.organize')}</span>
            </div>
            <div className="feature-item">
              <i className="fas fa-pen-fancy"></i>
              <span>{t('welcome.features.write')}</span>
            </div>
            <div className="feature-item">
              <i className="fas fa-chart-line"></i>
              <span>{t('welcome.features.track')}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Renderizar contenido según seccion solicitada
  const renderProjectsSection = () => (
    projects.length > 0 ? (
      <div className="projects-grid">
        <h3>{t('welcome.yourProjects')}</h3>
        <div className="projects-list">
          {projects.map((project, index) => (
            <div 
              key={index} 
              className="project-card"
            >
              <i className="fas fa-folder"></i>
              <span className="project-name">{smartTruncate(project.name, 20)}</span>
              <span className="project-count">
                {t('welcome.filesCount', { count: countFiles(project.items) })}
              </span>
            </div>
          ))}
        </div>
      </div>
    ) : (
      <div className="empty-projects">
        <i className="fas fa-folder-open"></i>
        <p>{t('welcome.noProjects')}</p>
        <button className="btn-primary">
          <i className="fas fa-plus"></i> {t('welcome.createFirstProject')}
        </button>
      </div>
    )
  );

  const renderRecentSection = () => (
    recentFiles.length > 0 ? (
      <div className="recent-files">
        <h3>{t('welcome.recentFiles')}</h3>
        <div className="recent-files-list">
          {recentFiles.map((file, index) => (
            <div 
              key={index}
              className="recent-file-item"
              onClick={() => onOpenFile(file.projectIndex, file)}
            >
              <i className="fas fa-file-alt"></i>
              <div className="file-info">
                <span className="file-name">
                  {smartTruncate(file.name.replace('.txt', ''), 25)}
                </span>
                <span className="file-project">{file.projectName}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    ) : (
      <div className="empty-projects">
        <p>{t('welcome.noRecentFiles')}</p>
      </div>
    )
  );

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-logo">
          <i className="fas fa-shield-halved"></i>
        </div>
        <h1>{t('welcome.greetingWithName', { name: userName })}</h1>
        <p className="welcome-subtitle">{t('welcome.selectToStart')}</p>

        {showSection === 'all' && renderProjectsSection()}
        { (showSection === 'all' || showSection === 'recent') && renderRecentSection() }

        {/* Información del workspace */}
        <div className="workspace-info">
          <i className="fas fa-folder"></i>
          <span>{workspacePath}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Cuenta recursivamente el número de archivos en un proyecto.
 * @param {Array} items - Items del proyecto
 * @returns {number} Cantidad de archivos
 */
function countFiles(items) {
  if (!items) return 0;
  let count = 0;
  
  items.forEach(item => {
    if (item.type === 'file') {
      count++;
    }
    if (item.items) {
      count += countFiles(item.items);
    }
  });
  
  return count;
}

export default WelcomeScreen;
