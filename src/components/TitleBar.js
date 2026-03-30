import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../utils/i18n';
import Icon from '@mdi/react';
import { 
  mdiTurtle, 
  mdiTune, 
  mdiFolderPlus, 
  mdiHistory, 
  mdiChevronRight, 
  mdiFile, 
  mdiFileExport, 
  mdiFileEdit, 
  mdiConsole, 
  mdiCog, 
  mdiSync, 
  mdiMinus, 
  mdiWindowMaximize, 
  mdiWindowRestore, 
  mdiClose 
} from '@mdi/js';

function TitleBar({
  workspacePath,
  recentWorkspaces = [],
  projects = [],
  activeFile = null,
  activeProjectIndex = null,
  onSelectWorkspace,
  onCreateWorkspace,
  onCreateFile,
  onCreateProject,
  onCreateSubFile,
  onRenameFile,
  onUndo,
  onRedo,
  onEditAction,
  onDevTools,
  onOpenWorkspace,
  onCheckUpdates,
  onOpenSettings,
  showInput,
  notify,
  hideMenu = false // Nueva prop para ocultar el menú
}) {
  const { t } = useTranslation();
  const [isMaximized, setIsMaximized] = useState(false);
  const [iconPath, setIconPath] = useState('assets/icon.png');
  const [iconError, setIconError] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null); // 'menu' | null
  const menuRef = useRef(null);

  useEffect(() => {
    // Verificar estado inicial de maximizado
    const checkInitialState = async () => {
      if (window.electronAPI?.isWindowMaximized) {
        try {
          const state = await window.electronAPI.isWindowMaximized();
          setIsMaximized(state);
        } catch (error) {
          console.error('Error checking initial maximize state:', error);
        }
      }
    };
    
    checkInitialState();

    // Escuchar cambios de estado de maximizado
    let unsubscribeMaximize = null;
    if (window.electronAPI?.onMaximizeChange) {
      unsubscribeMaximize = window.electronAPI.onMaximizeChange((maximized) => {
        setIsMaximized(maximized);
      });
    }

    // Cerrar dropdown al hacer click fuera
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      if (unsubscribeMaximize) {
        unsubscribeMaximize();
      }
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleIconError = () => {
    if (iconPath === 'assets/icon.png') {
      setIconPath('./assets/icon.png');
    } else if (iconPath === './assets/icon.png') {
      setIconPath('/assets/icon.png');
    } else {
      setIconError(true);
    }
  };

  const handleMinimize = () => {
    if (window.electronAPI && window.electronAPI.minimizeWindow) {
      window.electronAPI.minimizeWindow();
    }
  };

  const handleMaximize = async () => {
    if (window.electronAPI?.maximizeWindow) {
      try {
        await window.electronAPI.maximizeWindow();
        // El estado se actualizará a través del listener onMaximizeChange
      } catch (error) {
        console.error('Error maximizing window:', error);
      }
    }
  };

  const handleClose = () => {
    if (window.electronAPI && window.electronAPI.closeWindow) {
      window.electronAPI.closeWindow();
    }
  };

  const handleMenuAction = (action, data = null) => {
    setActiveDropdown(null);
    switch (action) {
      case 'connect':
        onSelectWorkspace && onSelectWorkspace();
        break;
      case 'open-recent':
        onOpenWorkspace && onOpenWorkspace(data);
        break;
      case 'create-file':
        if (projects.length === 0) {
          notify && notify(t('notifications.selectProjectAlert'), 'warning');
        } else if (projects.length === 1) {
          showInput && showInput(t('modals.input.newFile'), t('modals.input.fileName'), (name) => {
            if (name) onCreateFile && onCreateFile(0, name);
          });
        } else {
          showInput && showInput(t('modals.input.newFile'), t('modals.input.fileName'), (name) => {
            if (!name) return;
            showInput(t('modals.input.selectProject'), t('modals.input.projectIndex', { max: projects.length - 1 }), (pIndex) => {
              if (pIndex !== null) {
                onCreateFile && onCreateFile(parseInt(pIndex), name);
              }
            });
          });
        }
        break;
      case 'create-subfile':
        if (!activeFile) {
          notify && notify(t('notifications.openFileFirst'), 'warning');
        } else {
          onCreateSubFile && onCreateSubFile(activeFile);
        }
        break;
      case 'rename':
        onRenameFile && onRenameFile();
        break;
      case 'devtools':
        onDevTools && onDevTools();
        break;
      case 'settings':
        onOpenSettings && onOpenSettings();
        break;
      case 'check-updates':
        onCheckUpdates && onCheckUpdates();
        break;
      default:
        break;
    }
  };

  return (
    <div className="title-bar" style={{ WebkitAppRegion: 'drag' }}>
      {/* Lado izquierdo: Logo, nombre y Menú */}
      <div className="title-bar-left">
        <div className="title-bar-brand" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '12px' }}>
          <Icon path={mdiTurtle} size={0.7} className="title-bar-icon" />
          <span className="title-bar-title">BLOOPY</span>
        </div>
        
        <span className="title-bar-separator" style={{ color: 'var(--text-secondary)', margin: '0 4px', opacity: 0.5, fontSize: '14px' }}>|</span>

        {!hideMenu ? (
          <div className="dropdown-container" ref={menuRef} style={{ WebkitAppRegion: 'no-drag' }}>
            <button
              className={`title-bar-menu-btn ${activeDropdown === 'menu' ? 'active' : ''}`}
              onClick={() => setActiveDropdown(activeDropdown === 'menu' ? null : 'menu')}
            >
              <Icon path={mdiTune} size={0.7} />
            </button>

            {activeDropdown === 'menu' && (
              <div className="title-bar-dropdown">
                <div className="dropdown-item" onClick={() => handleMenuAction('connect')}>
                  <Icon path={mdiFolderPlus} size={0.7} /> {t('titlebar.connectWorkspace')}
                </div>

                {recentWorkspaces.length > 0 && (
                  <div className="dropdown-submenu">
                    <div className="dropdown-item submenu-trigger">
                      <Icon path={mdiHistory} size={0.7} /> {t('welcome.recentFiles')} <Icon path={mdiChevronRight} size={0.6} />
                    </div>
                    <div className="submenu-content">
                      {recentWorkspaces.map((path, i) => (
                        <div key={i} className="dropdown-item" onClick={() => handleMenuAction('open-recent', path)}>
                          {path.split(/[\\/]/).pop()}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="dropdown-divider"></div>

                <div
                  className={`dropdown-item ${!workspacePath || projects.length === 0 ? 'disabled' : ''}`}
                  onClick={() => (workspacePath && projects.length > 0) && handleMenuAction('create-file')}
                >
                  <Icon path={mdiFile} size={0.7} /> {t('sidebar.newFile')}
                </div>

                <div
                  className={`dropdown-item ${!activeFile ? 'disabled' : ''}`}
                  onClick={() => activeFile && handleMenuAction('create-subfile')}
                >
                  <Icon path={mdiFileExport} size={0.7} /> {t('sidebar.newSubFile')}
                </div>

                <div
                  className={`dropdown-item ${!activeFile ? 'disabled' : ''}`}
                  onClick={() => activeFile && handleMenuAction('rename')}
                >
                  <Icon path={mdiFileEdit} size={0.7} /> {t('titlebar.renameCurrentFile')}
                </div>

                <div className="dropdown-item" onClick={() => handleMenuAction('devtools')}>
                  <Icon path={mdiConsole} size={0.7} /> {t('titlebar.devTools')}
                </div>

                <div className="dropdown-divider"></div>

                <div className="dropdown-item" onClick={() => handleMenuAction('settings')}>
                  <Icon path={mdiCog} size={0.7} /> {t('common.settings')}
                </div>

                <div className="dropdown-item" onClick={() => handleMenuAction('check-updates')}>
                  <Icon path={mdiSync} size={0.7} /> {t('titlebar.checkUpdates')}
                </div>
              </div>
            )}
          </div>
        ) : (
          <span style={{ width: '40px' }}></span>
        )}
      </div>

      <div className="title-bar-center" style={{ pointerEvents: 'none' }}>
        {/* Logo movido a la izquierda */}
      </div>

      {/* Lado derecho: Controles de ventana */}
      <div className="title-bar-controls">
        <button
          className="title-bar-btn minimize-btn"
          onClick={handleMinimize}
          title={t('titlebar.minimize')}
          style={{ WebkitAppRegion: 'no-drag' }}
        >
          <Icon path={mdiMinus} size={0.7} />
        </button>

        <button
          className={`title-bar-btn maximize-btn ${isMaximized ? 'active' : ''}`}
          onClick={handleMaximize}
          title={isMaximized ? t('common.restore') : t('titlebar.maximize')}
          style={{ WebkitAppRegion: 'no-drag' }}
        >
          <Icon path={isMaximized ? mdiWindowRestore : mdiWindowMaximize} size={0.7} />
        </button>

        <button
          className="title-bar-btn title-bar-close-btn"
          onClick={handleClose}
          title={t('titlebar.close')}
          style={{ WebkitAppRegion: 'no-drag' }}
        >
          <Icon path={mdiClose} size={0.7} />
        </button>
      </div>
    </div>
  );
}

export default TitleBar;
