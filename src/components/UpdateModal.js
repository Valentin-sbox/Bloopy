/**
 * ============================================================================
 * UpdateModal - Modal de Actualización de BlockGuard
 * ============================================================================
 * 
 * Componente para mostrar el estado de actualización y permitir al usuario
 * revisar, descargar e instalar actualizaciones de BlockGuard.
 * 
 * PROPÓSITO:
 * - Mostrar si hay actualizaciones disponibles
 * - Permitir descargar actualizaciones con indicador de progreso
 * - Permitir instalar y reiniciar la aplicación
 * - Mostrar información sobre la versión disponible
 * 
 * ESTRUCTURA DE ESTADO:
 * - updateState: checking | available | not-available | downloading | downloaded | error
 * - updateInfo: contiene version, releaseDate, releaseNotes
 * - downloadProgress: porcentaje de descarga
 */

import React, { useState, useEffect } from 'react';
import '../styles/update-modal.css';
import { useTranslation } from '../utils/i18n';

const UpdateModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  
  // ========================================================================
  // ESTADO DEL COMPONENTE
  // ========================================================================
  
  const [updateState, setUpdateState] = useState('idle'); // idle, checking, available, downloading, downloaded, not-available, error
  const [updateInfo, setUpdateInfo] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // ========================================================================
  // LISTENERS DE EVENTOS DEL MAIN PROCESS
  // ========================================================================
  
  useEffect(() => {
    if (!isOpen) return;

    // Escuchar eventos de actualización provenientes del main process
    const unlisteners = [];

    if (window.electronAPI && window.electronAPI.onUpdateChecking) {
      const unlisten = window.electronAPI.onUpdateChecking(() => {
        setUpdateState('checking');
        setIsLoading(true);
      });
      unlisteners.push(unlisten);
    }

    if (window.electronAPI && window.electronAPI.onUpdateAvailable) {
      const unlisten = window.electronAPI.onUpdateAvailable((info) => {
        console.log('Actualización disponible:', info);
        setUpdateInfo(info);
        setUpdateState('available');
        setIsLoading(false);
      });
      unlisteners.push(unlisten);
    }

    if (window.electronAPI && window.electronAPI.onUpdateNotAvailable) {
      const unlisten = window.electronAPI.onUpdateNotAvailable(() => {
        setUpdateState('not-available');
        setIsLoading(false);
      });
      unlisteners.push(unlisten);
    }

    if (window.electronAPI && window.electronAPI.onUpdateError) {
      const unlisten = window.electronAPI.onUpdateError((error) => {
        setErrorMessage(error);
        setUpdateState('error');
        setIsLoading(false);
      });
      unlisteners.push(unlisten);
    }

    if (window.electronAPI && window.electronAPI.onUpdateDownloadProgress) {
      const unlisten = window.electronAPI.onUpdateDownloadProgress((progress) => {
        setDownloadProgress(Math.round(progress.percent));
        setUpdateState('downloading');
      });
      unlisteners.push(unlisten);
    }

    if (window.electronAPI && window.electronAPI.onUpdateDownloaded) {
      const unlisten = window.electronAPI.onUpdateDownloaded(() => {
        setUpdateState('downloaded');
        setDownloadProgress(100);
      });
      unlisteners.push(unlisten);
    }

    // Limpiar listeners al desmontar
    return () => {
      unlisteners.forEach(unlisten => {
        if (typeof unlisten === 'function') {
          unlisten();
        }
      });
    };
  }, [isOpen]);

  // ========================================================================
  // FUNCIONES DE ACCIÓN
  // ========================================================================

  /**
   * Verifica si hay actualizaciones disponibles
   */
  const handleCheckUpdates = async () => {
    setIsLoading(true);
    setErrorMessage('');
    setUpdateState('checking');

    try {
      if (window.electronAPI && window.electronAPI.checkForUpdates) {
        const result = await window.electronAPI.checkForUpdates();
        
        if (!result.success) {
          setErrorMessage(result.error || 'Error al verificar actualizaciones');
          setUpdateState('error');
        }
        // Si es exitoso, los listeners se encargarán de actualizar el estado
      }
    } catch (error) {
      console.error('Error verificando actualizaciones:', error);
      setErrorMessage('Error al verificar actualizaciones');
      setUpdateState('error');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Descarga la actualización disponible
   */
  const handleDownload = async () => {
    setIsLoading(true);
    setErrorMessage('');
    setDownloadProgress(0);

    try {
      if (window.electronAPI && window.electronAPI.downloadUpdate) {
        const result = await window.electronAPI.downloadUpdate();
        
        if (!result.success) {
          setErrorMessage(result.error || result.message);
          setUpdateState('error');
          setIsLoading(false);
        }
        // Si es exitoso, los listeners se encargarán de actualizar el estado
      }
    } catch (error) {
      console.error('Error descargando actualización:', error);
      setErrorMessage('Error al descargar la actualización');
      setUpdateState('error');
      setIsLoading(false);
    }
  };

  /**
   * Instala la actualización y reinicia la aplicación
   */
  const handleInstall = async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      if (window.electronAPI && window.electronAPI.installUpdate) {
        const result = await window.electronAPI.installUpdate();
        
        if (!result.success) {
          setErrorMessage(result.error || result.message);
          setUpdateState('error');
          setIsLoading(false);
        } else {
          // La aplicación se reiniciará automáticamente
          console.log('Instalando actualización...');
        }
      }
    } catch (error) {
      console.error('Error instalando actualización:', error);
      setErrorMessage('Error al instalar la actualización');
      setUpdateState('error');
      setIsLoading(false);
    }
  };

  // ========================================================================
  // FUNCIONES AUXILIARES
  // ========================================================================

  /**
   * Formatea la fecha de lanzamiento
   */
  const formatDate = (dateString) => {
    if (!dateString) return 'Desconocida';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // ========================================================================
  // RENDERIZACIÓN CONDICIONAL
  // ========================================================================

  if (!isOpen) return null;

  // Pantalla inicial - Botón para verificar
  if (updateState === 'idle') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="update-modal" onClick={(e) => e.stopPropagation()}>
          <div className="update-header">
            <h2>Actualizaciones</h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>

          <div className="update-content">
            <div className="update-idle">
              <p>Verifica si hay nuevas versiones de Block Guard disponibles.</p>
              <button 
                className="btn btn-primary"
                onClick={handleCheckUpdates}
                disabled={isLoading}
              >
                {isLoading ? 'Verificando...' : 'Verificar actualizaciones'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pantalla de verificación
  if (updateState === 'checking') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="update-modal" onClick={(e) => e.stopPropagation()}>
          <div className="update-header">
            <h2>Verificando Actualizaciones</h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>

          <div className="update-content">
            <div className="update-checking">
              <div className="spinner"></div>
              <p>Buscando actualizaciones...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pantalla - Sin actualizaciones disponibles
  if (updateState === 'not-available') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="update-modal" onClick={(e) => e.stopPropagation()}>
          <div className="update-header">
            <h2>Actualizaciones</h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>

          <div className="update-content">
            <div className="update-not-available">
              <p>✓ BlockGuard está actualizado.</p>
              <p style={{ fontSize: '0.9em', color: '#666' }}>
                Tienes la versión más reciente disponible.
              </p>
              <button 
                className="btn btn-secondary"
                onClick={handleCheckUpdates}
              >
                Verificar nuevamente
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pantalla - Actualización disponible
  if (updateState === 'available') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="update-modal" onClick={(e) => e.stopPropagation()}>
          <div className="update-header">
            <h2>Actualización Disponible</h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>

          <div className="update-content">
            <div className="update-available">
              <div className="version-info">
                <p><strong>Nueva versión:</strong> {updateInfo?.version || 'Desconocida'}</p>
                <p><strong>Fecha:</strong> {formatDate(updateInfo?.releaseDate)}</p>
              </div>

              {updateInfo?.releaseNotes && (
                <div className="release-notes">
                  <h4>Cambios:</h4>
                  <div className="notes-content">
                    {typeof updateInfo.releaseNotes === 'string' ? (
                      <p>{updateInfo.releaseNotes}</p>
                    ) : (
                      Object.values(updateInfo.releaseNotes).map((note, idx) => (
                        <p key={idx}>{note}</p>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="update-actions">
                <button 
                  className="btn btn-primary"
                  onClick={handleDownload}
                  disabled={isLoading}
                >
                  {isLoading ? 'Descargando...' : 'Descargar e Instalar'}
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={onClose}
                >
                  Después
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pantalla - Descargando
  if (updateState === 'downloading') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="update-modal" onClick={(e) => e.stopPropagation()}>
          <div className="update-header">
            <h2>Descargando Actualización</h2>
            <button className="close-btn" onClick={onClose} disabled={true}>×</button>
          </div>

          <div className="update-content">
            <div className="update-downloading">
              <p>Descargando BlockGuard {updateInfo?.version}...</p>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${downloadProgress}%` }}
                ></div>
              </div>
              <p className="progress-text">{downloadProgress}%</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pantalla - Descargado
  if (updateState === 'downloaded') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="update-modal" onClick={(e) => e.stopPropagation()}>
          <div className="update-header">
            <h2>Actualización Descargada</h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>

          <div className="update-content">
            <div className="update-downloaded">
              <p>✓ Actualización lista para instalar.</p>
              <p style={{ fontSize: '0.9em', color: '#666', marginBottom: '20px' }}>
                BlockGuard se reiniciará para aplicar los cambios.
              </p>
              <div className="update-actions">
                <button 
                  className="btn btn-primary"
                  onClick={handleInstall}
                  disabled={isLoading}
                >
                  {isLoading ? 'Instalando...' : 'Reiniciar e Instalar'}
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={onClose}
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pantalla - Error
  if (updateState === 'error') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="update-modal" onClick={(e) => e.stopPropagation()}>
          <div className="update-header">
            <h2>Error en Actualización</h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>

          <div className="update-content">
            <div className="update-error">
              <p>✗ {errorMessage || 'Ocurrió un error desconocido.'}</p>
              <button 
                className="btn btn-primary"
                onClick={handleCheckUpdates}
              >
                Reintentar
              </button>
              <button 
                className="btn btn-secondary"
                onClick={onClose}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default UpdateModal;
