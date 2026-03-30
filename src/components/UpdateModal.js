/**
 * ============================================================================
 * UpdateModal - Modal de Actualización Mejorado
 * ============================================================================
 * 
 * Modal completo para gestionar actualizaciones de Bloopy con feedback visual
 * detallado de cada paso del proceso.
 * 
 * ESTADOS:
 * - idle: Estado inicial
 * - checking: Verificando actualizaciones
 * - available: Actualización disponible
 * - not-available: Sin actualizaciones
 * - downloading: Descargando actualización
 * - downloaded: Descarga completada
 * - installing: Preparando instalación
 * - error: Error en el proceso
 */

import React, { useState, useEffect } from 'react';
import BaseModal from './BaseModal';
import { useTranslation } from '../utils/i18n';
import '../styles/update-modal.css';
import Icon from '@mdi/react';
import { 
  mdiShieldCheck, 
  mdiCamera, 
  mdiFlask, 
  mdiSourceBranch, 
  mdiCalendar, 
  mdiClose, 
  mdiSync, 
  mdiMagnify, 
  mdiCheckCircle, 
  mdiDownload, 
  mdiRocketLaunch, 
  mdiAlert,
  mdiInformationOutline,
  mdiLoading
} from '@mdi/js';

const UpdateModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  // Estados
  const [updateState, setUpdateState] = useState('idle');
  const [updateInfo, setUpdateInfo] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [downloadedMB, setDownloadedMB] = useState(0);
  const [totalMB, setTotalMB] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentVersion, setCurrentVersion] = useState('');
  const [selectedVersionType, setSelectedVersionType] = useState('stable'); // stable, snapshot, pre-stable
  const [availableVersions, setAvailableVersions] = useState({});
  const [showVersionOptions, setShowVersionOptions] = useState(false);

  // Obtener versión actual al abrir
  useEffect(() => {
    if (isOpen && window.electronAPI && window.electronAPI.getAppVersion) {
      window.electronAPI.getAppVersion().then(version => {
        setCurrentVersion(version);
      });
    }
  }, [isOpen]);

  // Listeners de eventos (consolidados)
  useEffect(() => {
    if (!isOpen || !window.electronAPI) return;

    const unlisteners = [];

    // Verificando actualizaciones
    if (window.electronAPI?.onUpdateChecking) {
      const unlisten = window.electronAPI.onUpdateChecking(() => {
        setUpdateState('checking');
        setErrorMessage('');
      });
      unlisteners.push(unlisten);
    }

    // Actualización disponible
    if (window.electronAPI?.onUpdateAvailable) {
      const unlisten = window.electronAPI.onUpdateAvailable((info) => {
        console.log('[UPDATE-MODAL] Actualización disponible:', info);
        setUpdateInfo(info);
        setUpdateState('available');
      });
      unlisteners.push(unlisten);
    }

    // No hay actualizaciones
    if (window.electronAPI?.onUpdateNotAvailable) {
      const unlisten = window.electronAPI.onUpdateNotAvailable(() => {
        console.log('[UPDATE-MODAL] No hay actualizaciones');
        setUpdateState('not-available');
      });
      unlisteners.push(unlisten);
    }

    // Progreso de descarga
    if (window.electronAPI?.onUpdateDownloadProgress) {
      const unlisten = window.electronAPI.onUpdateDownloadProgress((progress) => {
        console.log('[UPDATE-MODAL] Progreso descarga:', progress);
        setDownloadProgress(progress.percent || 0);
        setDownloadSpeed(progress.bytesPerSecond || 0);
        setDownloadedMB((progress.transferred || 0) / 1024 / 1024);
        setTotalMB((progress.total || 0) / 1024 / 1024);
      });
      unlisteners.push(unlisten);
    }

    // Descarga completada
    if (window.electronAPI?.onUpdateDownloaded) {
      const unlisten = window.electronAPI.onUpdateDownloaded(() => {
        console.log('[UPDATE-MODAL] Descarga completada');
        setUpdateState('downloaded');
      });
      unlisteners.push(unlisten);
    }

    // Error en actualización
    if (window.electronAPI?.onUpdateError) {
      const unlisten = window.electronAPI.onUpdateError((error) => {
        console.error('[UPDATE-MODAL] Error en actualización:', error);
        setErrorMessage(error.message || t('modals.update.unknownError'));
        setUpdateState('error');
      });
      unlisteners.push(unlisten);
    }

    // Cleanup de listeners
    return () => {
      unlisteners.forEach(unlisten => {
        if (typeof unlisten === 'function') {
          unlisten();
        }
      });
    };
  }, [isOpen]);

  // Handlers
  const handleCheckUpdates = async () => {
    setUpdateState('checking');
    setErrorMessage('');

    try {
      if (window.electronAPI?.checkForUpdates) {
        const result = await window.electronAPI.checkForUpdates();
        if (!result.success && result.error) {
          setErrorMessage(result.error);
          setUpdateState('error');
        } else if (result.success && result.availableVersions) {
          // Si hay múltiples versiones disponibles, mostrar opciones
          setAvailableVersions(result.availableVersions);
          if (Object.keys(result.availableVersions).length > 1) {
            setShowVersionOptions(true);
            setUpdateState('version-selection');
          } else {
            // Solo una versión disponible, usarla
            const versionType = Object.keys(result.availableVersions)[0];
            setSelectedVersionType(versionType);
            setUpdateInfo(result.availableVersions[versionType]);
            setUpdateState('available');
          }
        }
      }
    } catch (error) {
      console.error('[UPDATE-MODAL] Error:', error);
      setErrorMessage('Error al verificar actualizaciones');
      setUpdateState('error');
    }
  };

  const handleDownload = async () => {
    setUpdateState('downloading');
    setDownloadProgress(0);
    setErrorMessage('');

    try {
      if (window.electronAPI?.downloadUpdate) {
        const result = await window.electronAPI.downloadUpdate();
        if (!result.success) {
          setErrorMessage(result.error || 'Error al descargar');
          setUpdateState('error');
        }
      }
    } catch (error) {
      console.error('[UPDATE-MODAL] Error descargando:', error);
      setErrorMessage(t('modals.update.downloadError') || 'Error al descargar la actualización');
      setUpdateState('error');
    }
  };

  const handleInstall = async () => {
    setUpdateState('installing');

    try {
      if (window.electronAPI?.installUpdate) {
        await window.electronAPI.installUpdate();
        // La app se cerrará automáticamente
      }
    } catch (error) {
      console.error('[UPDATE-MODAL] Error instalando:', error);
      setErrorMessage(t('modals.update.installError') || 'Error al instalar la actualización');
      setUpdateState('error');
    }
  };

  const handleVersionTypeSelect = async (type) => {
    setSelectedVersionType(type);
    if (availableVersions[type]) {
      setUpdateInfo(availableVersions[type]);
      setUpdateState('available');
      setShowVersionOptions(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Desconocida';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getVersionTypeLabel = (type) => {
    switch (type) {
      case 'stable': return 'Estable';
      case 'snapshot': return 'Snapshot';
      case 'pre-stable': return 'Pre-estable';
      default: return type;
    }
  };

  const getVersionTypeIcon = (type) => {
    switch (type) {
      case 'stable': return mdiShieldCheck;
      case 'snapshot': return mdiCamera;
      case 'pre-stable': return mdiFlask;
      default: return mdiSourceBranch;
    }
  };

  const getVersionTypeDescription = (type) => {
    switch (type) {
      case 'stable': return t('modals.update.stableVersion') || 'Versión estable y probada, recomendada para todos los usuarios';
      case 'snapshot': return t('modals.update.snapshotVersion') || 'Última versión en desarrollo, puede tener errores';
      case 'pre-stable': return t('modals.update.preStableVersion') || 'Versión casi estable, en fase de pruebas finales';
      default: return t('modals.update.versionAvailable') || 'Versión disponible';
    }
  };

  if (!isOpen) return null;

  const getModalTitle = () => {
    switch (updateState) {
      case 'checking': return t('modals.update.checking');
      case 'version-selection': return t('modals.update.selectUpdate') || 'Seleccionar Actualización';
      case 'available': return t('modals.update.title');
      case 'not-available': return t('modals.update.upToDate');
      case 'downloading': return t('modals.update.downloading');
      case 'downloaded': return t('modals.update.readyToInstall');
      case 'installing': return t('modals.update.installing');
      case 'error': return t('modals.update.errorTitle');
      case 'idle': return t('modals.update.title');
      default: return t('modals.update.title');
    }
  };

  const getModalSize = () => {
    if (updateState === 'version-selection') return 'large';
    if (updateState === 'available') return 'large';
    return 'medium';
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={getModalTitle()}
      size={getModalSize()}
      showCloseButton={updateState !== 'downloading' && updateState !== 'installing'}
      className="update-modal-wrapper"
    >
      <div className="update-modal-content">
          {/* Estado: Version Selection */}
          {updateState === 'version-selection' && (
            <div className="update-version-selection">
              <div className="update-icon">
                <Icon path={mdiSourceBranch} size={2} />
              </div>
              <h3>¿Qué actualización quieres?</h3>
              <p className="update-description">
                Se encontraron múltiples versiones disponibles. Selecciona la que prefieras:
              </p>
              
              <div className="version-options">
                {Object.entries(availableVersions).map(([type, info]) => (
                  <div 
                    key={type}
                    className={`version-option ${selectedVersionType === type ? 'selected' : ''}`}
                    onClick={() => handleVersionTypeSelect(type)}
                  >
                    <div className="version-option-header">
                      <Icon path={getVersionTypeIcon(type)} size={1} />
                      <div className="version-option-title">
                        <h4>{getVersionTypeLabel(type)}</h4>
                        <span className="version-number">v{info.version}</span>
                      </div>
                    </div>
                    <p className="version-option-description">
                      {getVersionTypeDescription(type)}
                    </p>
                    {info.releaseDate && (
                      <div className="version-option-date">
                        <Icon path={mdiCalendar} size={0.6} />
                        {formatDate(info.releaseDate)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="update-actions">
                <button className="btn btn-ghost" onClick={onClose}>
                  <Icon path={mdiClose} size={0.7} /> Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Estado: Idle */}
          {updateState === 'idle' && (
            <div className="update-idle">
              <div className="update-icon">
                <Icon path={mdiSync} size={2} />
              </div>
              <p className="update-description">
                Verifica si hay nuevas versiones de Bloopy disponibles.
              </p>
              {currentVersion && (
                <p className="current-version">Versión actual: {currentVersion}</p>
              )}
              <button className="btn btn-primary" onClick={handleCheckUpdates}>
                <Icon path={mdiMagnify} size={0.7} /> Verificar Actualizaciones
              </button>
            </div>
          )}

          {/* Estado: Checking */}
          {updateState === 'checking' && (
            <div className="update-checking">
              <div className="spinner-container">
                <Icon path={mdiLoading} size={2} spin={1} />
              </div>
              <p className="update-status">Verificando Actualizaciones</p>
              <p className="update-substatus">Conectando con GitHub...</p>
            </div>
          )}

          {/* Estado: Not Available */}
          {updateState === 'not-available' && (
            <div className="update-not-available">
              <div className="update-icon success">
                <Icon path={mdiCheckCircle} size={2} />
              </div>
              <h3>¡Estás al día!</h3>
              <p className="update-description">
                Ya tienes instalada la versión más reciente de Bloopy (v{currentVersion}).
              </p>
              <button className="btn btn-primary" onClick={onClose}>
                Entendido
              </button>
            </div>
          )}

          {/* Estado: Available */}
          {updateState === 'available' && updateInfo && (
            <div className="update-available">
              <div className="update-header-info">
                <div className="update-icon info">
                  <Icon path={mdiRocketLaunch} size={2} />
                </div>
                <div className="update-title-info">
                  <h3>¡Nueva versión disponible!</h3>
                  <div className="version-badges">
                    <span className="version-badge">v{updateInfo.version}</span>
                    <span className={`type-badge ${selectedVersionType}`}>{getVersionTypeLabel(selectedVersionType)}</span>
                  </div>
                </div>
              </div>

              <div className="update-details">
                <div className="detail-item">
                  <Icon path={mdiCalendar} size={0.7} />
                  <span>Publicado el {formatDate(updateInfo.releaseDate)}</span>
                </div>
                {updateInfo.releaseNotes && (
                  <div className="update-notes">
                    <h4>Novedades:</h4>
                    <div className="notes-content" dangerouslySetInnerHTML={{ __html: updateInfo.releaseNotes }}></div>
                  </div>
                )}
              </div>

              <div className="update-actions">
                <button className="btn btn-ghost" onClick={onClose}>
                  Más tarde
                </button>
                <button className="btn btn-primary" onClick={handleDownload}>
                  <Icon path={mdiDownload} size={0.7} /> Descargar ahora
                </button>
              </div>
            </div>
          )}

          {/* Estado: Downloading */}
          {updateState === 'downloading' && (
            <div className="update-downloading">
              <div className="update-icon info">
                <Icon path={mdiDownload} size={2} />
              </div>
              <h3>Descargando Bloopy v{updateInfo?.version}</h3>
              
              <div className="download-progress-container">
                <div className="progress-bar-wrapper">
                  <div 
                    className="progress-bar-fill" 
                    style={{ width: `${downloadProgress}%` }}
                  ></div>
                </div>
                <div className="progress-stats">
                  <span>{downloadProgress.toFixed(1)}%</span>
                  <span>{downloadedMB.toFixed(1)} MB / {totalMB.toFixed(1)} MB</span>
                </div>
              </div>
              
              <p className="download-speed">
                Velocidad: {(downloadSpeed / 1024 / 1024).toFixed(2)} MB/s
              </p>
            </div>
          )}

          {/* Estado: Downloaded */}
          {updateState === 'downloaded' && (
            <div className="update-downloaded">
              <div className="update-icon success">
                <Icon path={mdiCheckCircle} size={2} />
              </div>
              <h3>Descarga completada</h3>
              <p className="update-description">
                La nueva versión se ha descargado correctamente. La aplicación se reiniciará para aplicar los cambios.
              </p>
              <div className="update-actions">
                <button className="btn btn-primary btn-large" onClick={handleInstall}>
                  <Icon path={mdiRocketLaunch} size={0.7} /> Instalar y Reiniciar
                </button>
              </div>
            </div>
          )}

          {/* Estado: Installing */}
          {updateState === 'installing' && (
            <div className="update-installing">
              <div className="spinner-container">
                <Icon path={mdiLoading} size={2} spin={1} />
              </div>
              <p className="update-status">Preparando instalación</p>
              <p className="update-substatus">
                La aplicación se cerrará en breve...
              </p>
            </div>
          )}

          {/* Estado: Error */}
          {updateState === 'error' && (
            <div className="update-error">
              <div className="update-icon danger">
                <Icon path={mdiAlert} size={2} />
              </div>
              <h3>Algo salió mal</h3>
              <p className="error-message">{errorMessage}</p>
              <div className="update-actions">
                <button className="btn btn-ghost" onClick={onClose}>
                  Cerrar
                </button>
                <button className="btn btn-primary" onClick={handleCheckUpdates}>
                  <Icon path={mdiSync} size={0.7} /> Reintentar
                </button>
              </div>
            </div>
          )}
        </div>
    </BaseModal>
  );
};

export default UpdateModal;
