/**
 * ============================================================================
 * BLOCK GUARD v4.0.0 - ONBOARDINGMODAL.JS
 * ============================================================================
 * 
 * COMPONENTE: ONBOARDING (PRIMERA VEZ)
 * 
 * Este componente guía al usuario a través de la configuración inicial
 * cuando abre Block Guard por primera vez.
 * 
 * PASOS DEL ONBOARDING:
 * 1. Bienvenida - Logo y presentación
 * 2. Perfil - Nombre y avatar del usuario
 * 3. Workspace - Ubicación donde se guardarán los proyectos
 * 
 * PROPS:
 * - onComplete: function - Callback cuando el usuario termina el onboarding
 * 
 * RELACIONADO CON:
 * - src/App.js: Muestra este modal si es la primera vez
 * - public/electron.js: createWorkspace, selectWorkspace
 * - src/styles/index.css: Estilos de .onboarding-container
 * ============================================================================
 */

import React, { useState, useRef } from 'react';
import { useTranslation } from '../utils/i18n';

function OnboardingModal({ onComplete }) {
  // =============================================================================
  // ESTADOS DEL COMPONENTE
  // =============================================================================
  
  const { t, changeLanguage } = useTranslation();
  
  // Paso actual del onboarding (0=idioma, 1=bienvenida, 2=perfil, 3=workspace)
  const [currentStep, setCurrentStep] = useState(0);
  
  // Idioma seleccionado
  const [selectedLanguage, setSelectedLanguage] = useState('es');
  
  // Datos del usuario
  const [userName, setUserName] = useState('');
  const [avatar, setAvatar] = useState(null);
  
  // Ubicación del workspace
  const [workspacePath, setWorkspacePath] = useState('');
  
  // Referencia al input de archivo (oculto)
  const fileInputRef = useRef(null);
  
  // =============================================================================
  // TOTAL DE PASOS
  // =============================================================================
  const totalSteps = 4; // Ahora son 4 pasos (idioma + 3 anteriores)
  
  // =============================================================================
  // MANEJADORES DE EVENTOS
  // =============================================================================
  
  /**
   * Avanza al siguiente paso del onboarding.
   * Si es el último paso, llama a onComplete con los datos.
   */
  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Completar onboarding
      onComplete({
        userName: userName || 'Escritor',
        avatar,
        workspacePath,
        language: selectedLanguage
      });
    }
  };
  
  /**
   * Maneja la selección de idioma
   */
  const handleLanguageSelect = (lang) => {
    setSelectedLanguage(lang);
    changeLanguage(lang);
    handleNext();
  };
  
  /**
   * Retrocede al paso anterior.
   */
  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  /**
   * Maneja la selección de avatar.
   * Lee la imagen seleccionada y la convierte a base64.
   * 
   * @param {Event} e - Evento de cambio del input file
   */
  const handleAvatarSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validar que sea una imagen
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen válida');
      return;
    }
    
    // Validar tamaño (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen es demasiado grande (máx 5MB)');
      return;
    }
    
    // Leer imagen como DataURL
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Crear canvas para redimensionar
        const canvas = document.createElement('canvas');
        const size = 200;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // Calcular recorte cuadrado centrado
        let sx, sy, sWidth, sHeight;
        const aspectRatio = img.width / img.height;
        
        if (aspectRatio > 1) {
          sHeight = img.height;
          sWidth = img.height;
          sx = (img.width - sWidth) / 2;
          sy = 0;
        } else {
          sWidth = img.width;
          sHeight = img.width;
          sx = 0;
          sy = (img.height - sHeight) / 2;
        }
        
        // Dibujar imagen redimensionada
        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, size, size);
        
        // Guardar como base64
        setAvatar(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };
  
  /**
   * Abre el diálogo para seleccionar la ubicación del workspace.
   * Usa la API de Electron para mostrar el diálogo nativo.
   */
  const handleSelectWorkspace = async () => {
    try {
      const path = await window.electronAPI.createWorkspace();
      if (path) {
        setWorkspacePath(path);
      }
    } catch (error) {
      console.error('Error selecting workspace:', error);
    }
  };
  
  // =============================================================================
  // RENDERIZADO DE CADA PASO
  // =============================================================================
  
  /**
   * Paso 0: Selector de Idioma
   */
  const renderStep0 = () => (
    <>
      <div className="onboarding-logo">
        <i className="fas fa-language"></i>
      </div>
      <h1>{t('languageSelector.title')}</h1>
      <p>{t('languageSelector.subtitle')}</p>
      
      <div className="language-selector-grid">
        <button 
          className="language-option"
          onClick={() => handleLanguageSelect('es')}
        >
          <span className="language-flag">🇪🇸</span>
          <span className="language-name">{t('languageSelector.spanish')}</span>
        </button>
        
        <button 
          className="language-option"
          onClick={() => handleLanguageSelect('en')}
        >
          <span className="language-flag">🇬🇧</span>
          <span className="language-name">{t('languageSelector.english')}</span>
        </button>
        
        <button 
          className="language-option"
          onClick={() => handleLanguageSelect('ja')}
        >
          <span className="language-flag">🇯🇵</span>
          <span className="language-name">{t('languageSelector.japanese')}</span>
        </button>
        
        <button 
          className="language-option"
          onClick={() => handleLanguageSelect('zh')}
        >
          <span className="language-flag">🇨🇳</span>
          <span className="language-name">{t('languageSelector.chinese')}</span>
        </button>
      </div>
      
      <p className="onboarding-hint">
        {t('languageSelector.changeAnytime')}
      </p>
    </>
  );
  
  /**
   * Paso 1: Bienvenida
   */
  const renderStep1 = () => (
    <>
      <div className="onboarding-logo">
        <i className="fas fa-shield-halved"></i>
      </div>
      <h1>{t('onboarding.welcome')}</h1>
      <p>
        {t('onboarding.step1Desc')}
      </p>
      <div className="onboarding-actions">
        <button className="btn-sub" onClick={handleBack}>
          <i className="fas fa-arrow-left"></i> {t('onboarding.previous')}
        </button>
        <button className="btn-primary btn-large" onClick={handleNext}>
          {t('onboarding.getStarted')} <i className="fas fa-arrow-right"></i>
        </button>
      </div>
    </>
  );
  
  /**
   * Paso 2: Perfil (nombre y avatar)
   */
  const renderStep2 = () => (
    <>
      <h1>{t('onboarding.step2Title')}</h1>
      <p>{t('onboarding.step2Desc')}</p>
      
      <div className="onboarding-form">
        {/* Campo de nombre */}
        <div className="form-group">
          <label>{t('settings.general.userName')}</label>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder={t('settings.general.userNamePlaceholder')}
            autoFocus
          />
        </div>
        
        {/* Selector de avatar */}
        <div className="form-group">
          <label>{t('settings.general.avatar')} ({t('onboarding.optional')})</label>
          <div className="avatar-selector">
            <div className="avatar-preview-xl">
              {avatar ? (
                <img src={avatar} alt="Avatar" />
              ) : (
                <i className="fas fa-user"></i>
              )}
            </div>
            <button 
              className="btn-select-avatar"
              onClick={() => fileInputRef.current?.click()}
            >
              <i className="fas fa-camera"></i>
              {avatar ? t('settings.general.changeAvatar') : t('onboarding.selectAvatar')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarSelect}
              style={{ display: 'none' }}
            />
          </div>
        </div>
      </div>
      
      <div className="onboarding-actions">
        <button className="btn-sub" onClick={handleBack}>
          <i className="fas fa-arrow-left"></i> {t('onboarding.previous')}
        </button>
        <button className="btn-primary" onClick={handleNext}>
          {t('onboarding.next')} <i className="fas fa-arrow-right"></i>
        </button>
      </div>
    </>
  );
  
  /**
   * Paso 3: Ubicación del workspace
   */
  const renderStep3 = () => (
    <>
      <h1>{t('onboarding.step3Title')}</h1>
      <p>
        {t('onboarding.step3Desc')}
      </p>
      
      <div className="onboarding-form">
        <div className="form-group">
          <label>{t('onboarding.workspaceLocation')}</label>
          <div className="workspace-location">
            {workspacePath && (
              <div className="selected-path">
                <i className="fas fa-folder"></i> {workspacePath}
              </div>
            )}
            <button 
              className="btn-select-location"
              onClick={handleSelectWorkspace}
            >
              <i className="fas fa-folder-plus"></i>
              {workspacePath ? t('onboarding.changeLocation') : t('onboarding.selectLocation')}
            </button>
          </div>
        </div>
      </div>
      
      <div className="onboarding-actions">
        <button className="btn-sub" onClick={handleBack}>
          <i className="fas fa-arrow-left"></i> {t('onboarding.previous')}
        </button>
        <button 
          className="btn-primary" 
          onClick={handleNext}
          disabled={!workspacePath}
        >
          {t('onboarding.finish')} <i className="fas fa-check"></i>
        </button>
      </div>
    </>
  );
  
  // =============================================================================
  // RENDERIZADO PRINCIPAL
  // =============================================================================
  
  return (
    <div className="onboarding-container">
      <div className="onboarding-content">
        {/* Indicador de pasos */}
        <div className="step-indicator">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div 
              key={i} 
              className={`step-dot ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'completed' : ''}`}
            />
          ))}
        </div>
        
        {/* Contenido del paso actual */}
        {currentStep === 0 && renderStep0()}
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </div>
    </div>
  );
}

export default OnboardingModal;
