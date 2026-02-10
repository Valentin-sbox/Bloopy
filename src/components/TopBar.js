/**
 * ============================================================================
 * BLOCK GUARD v4.0.0 - TOPBAR.JS
 * ============================================================================
 * 
 * COMPONENTE: BARRA SUPERIOR (TOP BAR)
 * 
 * Muestra la navegación breadcrumb y los botones de acción del editor.
 * 
 * FUNCIONALIDADES:
 * - Breadcrumb de navegación (Inicio > Proyecto > Archivo)
 * - Botón para mostrar/ocultar sidebar
 * - Botón de guardar
 * - Botón de corrector ortográfico
 * - Indicador de cambios sin guardar
 * - Atajos dinámicos sincronizados con configuración central
 * 
 * PROPS:
 * - activeFile: Object - Archivo actualmente abierto
 * - activeProjectIndex: number - Índice del proyecto activo
 * - projects: Array - Lista de proyectos
 * - onCloseFile: function - Callback al cerrar el archivo
 * - onSaveFile: function - Callback al guardar
 * - onSpellCheck: function - Callback al abrir corrector
 * - onToggleSidebar: function - Callback para mostrar/ocultar sidebar
 * - sidebarCollapsed: boolean - Estado del sidebar
 * - hasChanges: boolean - Si hay cambios sin guardar
 * 
 * RELACIONADO CON:
 * - src/App.js: Gestiona el estado y pasa datos/props
 * - src/styles/index.css: Estilos de .top-bar
 * - src/utils/shortcuts.js: Sistema centralizado de atajos
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { smartTruncate } from '../utils/helpers';
import { subscribeToShortcutChanges, getShortcutTitle } from '../utils/shortcuts';
import ButtonWithShortcut from './ButtonWithShortcut';
import { useTranslation } from '../utils/i18n';

function TopBar({ 
  activeFile, 
  activeProjectIndex, 
  projects, 
  onCloseFile, 
  onSaveFile, 
  onSpellCheck,
  onToggleSidebar,
  sidebarCollapsed,
  hasChanges,
  onViewProject
}) {
  const { t } = useTranslation();
  
  // Estado para rerender cuando cambian los atajos
  const [shortcuts, setShortcuts] = useState({});
  // Estado para seguimiento de ventana maximizada
  const [isMaximized, setIsMaximized] = useState(false);

  // Suscribirse a cambios en los atajos
  useEffect(() => {
    const unsubscribe = subscribeToShortcutChanges((updatedShortcuts) => {
      setShortcuts(updatedShortcuts);
    });

    return unsubscribe;
  }, []);

  // Verificar estado de maximización al montar el componente
  useEffect(() => {
    if (window.electronAPI?.isWindowMaximized) {
      window.electronAPI.isWindowMaximized().then(setIsMaximized);
    }

    // Escuchar cuando la ventana cambia de tamaño para actualizar el estado
    const handleWindowResize = () => {
      if (window.electronAPI?.isWindowMaximized) {
        window.electronAPI.isWindowMaximized().then(setIsMaximized);
      }
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  /**
   * Maneja el click en el botón de minimizar
   */
  const handleMinimize = () => {
    if (window.electronAPI?.minimizeWindow) {
      window.electronAPI.minimizeWindow();
    }
  };

  /**
   * Maneja el click en el botón de maximizar/restaurar
   */
  const handleMaximize = () => {
    if (window.electronAPI?.maximizeWindow) {
      window.electronAPI.maximizeWindow().then(() => {
        if (window.electronAPI?.isWindowMaximized) {
          window.electronAPI.isWindowMaximized().then(setIsMaximized);
        }
      });
    }
  };

  /**
   * Maneja el click en el botón de cerrar
   */
  const handleClose = () => {
    if (window.electronAPI?.closeWindow) {
      window.electronAPI.closeWindow();
    }
  };



  /**
   * Genera el breadcrumb de navegación según el estado actual.
   * @returns {JSX.Element} Elementos del breadcrumb
   */
  const getBreadcrumb = () => {
    // Si no hay archivo abierto, mostrar solo "Inicio"
    if (!activeFile) {
      return (
        <>
          {/* Botón para mostrar sidebar si está colapsado */}
          {sidebarCollapsed && (
            <button 
              className="show-sidebar-btn" 
              onClick={onToggleSidebar}
              title={getShortcutTitle('toggleSidebar')}
            >
              <i className="fas fa-bars"></i>
            </button>
          )}
          <span className="breadcrumb-item" onClick={onCloseFile}>
            <i className="fas fa-home"></i> {t('sidebar.home')}
          </span>
        </>
      );
    }
    
    // Obtener el proyecto del archivo activo
    const project = activeProjectIndex >= 0 && projects ? projects[activeProjectIndex] : null;
    
    if (!project) {
      return (
        <>
          <div className="breadcrumb-container">
            <div className="breadcrumb">
              <span className="breadcrumb-item">BlockGuard</span>
            </div>
          </div>
        </>
      );
    }
    
    return (
      <>
        {/* Botón para mostrar sidebar */}
        {sidebarCollapsed && (
          <button 
            className="show-sidebar-btn" 
            onClick={onToggleSidebar}
            title={getShortcutTitle('toggleSidebar')}
          >
            <i className="fas fa-bars"></i>
          </button>
        )}
        
        {/* Inicio */}
        <span className="breadcrumb-item" onClick={onCloseFile}>
          <i className="fas fa-home"></i>
        </span>
        
        {/* Separador */}
        <span className="breadcrumb-separator">
          <i className="fas fa-chevron-right"></i>
        </span>
        
        {/* Nombre del proyecto (clickeable para ver estructura) */}
        <span 
          className="breadcrumb-item clickeable"
          onClick={() => onViewProject && onViewProject(project)}
          title={getShortcutTitle('viewProject')}
        >
          {smartTruncate(project?.name || 'Proyecto', 15)}
        </span>
        
        {/* Separador */}
        <span className="breadcrumb-separator">
          <i className="fas fa-chevron-right"></i>
        </span>
        
        {/* Nombre del archivo (activo) */}
        <span className="breadcrumb-item active">
          {smartTruncate(activeFile.name.replace('.txt', ''), 25)}
          {/* Indicador de cambios sin guardar */}
          {hasChanges && <span className="unsaved-indicator">*</span>}
        </span>
      </>
    );
  };
  
  return (
    <header className="top-bar">
      {/* Breadcrumb de navegación */}
      <div className="breadcrumb">
        {getBreadcrumb()}
      </div>
      
      {/* Botones de acción */}
      <div className="editor-actions">
        {/* Botón de guardar */}
        {activeFile && (
          <button 
            className="btn-primary-small"
            onClick={onSaveFile}
            title={getShortcutTitle('save')}
          >
            <i className="fas fa-save"></i>
            <span>{t('topbar.save')}</span>
          </button>
        )}
      </div>

      {/* Controles de ventana (Custom Title Bar) */}
      <div className="window-controls" style={{ WebkitAppRegion: 'no-drag' }}>
        <button 
          className="window-control-btn minimize-btn"
          onClick={handleMinimize}
          title={`${t('common.minimize')} (Alt+F9)`}
          aria-label={t('common.minimize')}
        >
          <i className="fas fa-minus"></i>
        </button>
        
        <button 
          className="window-control-btn maximize-btn"
          onClick={handleMaximize}
          title={`${isMaximized ? t('common.restore') : t('common.maximize')} (Alt+F10)`}
          aria-label={isMaximized ? t('common.restore') : t('common.maximize')}
        >
          {isMaximized ? (
            <i className="fas fa-window-restore"></i>
          ) : (
            <i className="fas fa-window-maximize"></i>
          )}
        </button>
        
        <button 
          className="window-control-btn close-btn-window"
          onClick={handleClose}
          title={`${t('common.close')} (Alt+F4)`}
          aria-label={t('common.close')}
        >
          <i className="fas fa-times"></i>
        </button>
      </div>
    </header>
  );
}

export default TopBar;
