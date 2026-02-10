/**
 * ============================================================================
 * BLOCK GUARD v4.0.0 - SPLASHSCREEN.JS
 * ============================================================================
 * 
 * COMPONENTE: PANTALLA DE INICIO (SPLASH SCREEN)
 * 
 * Este componente muestra el logo de Block Guard con un fondo gris
 * mientras la aplicación se está cargando.
 * 
 * FUNCIONALIDAD:
 * - Muestra el logo con animación de pulso
 * - Se oculta automáticamente cuando la app está lista
 * - Proporciona feedback visual de carga al usuario
 * 
 * PROPS:
 * - visible: boolean - Controla si se muestra o no
 * 
 * RELACIONADO CON:
 * - src/App.js: Controla la visibilidad del splash
 * - src/styles/index.css: Estilos de .splash-screen
 * ============================================================================
 */

import React from 'react';
import { useTranslation } from '../utils/i18n';

/**
 * Componente SplashScreen
 * @param {Object} props - Propiedades del componente
 * @param {boolean} props.visible - Si el splash debe mostrarse
 */
function SplashScreen({ visible, phase = 'loading' }) {
  const { t } = useTranslation();
  
  if (!visible) return null;

  const subtitle = phase === 'checking'
    ? t('splash.checking')
    : t('splash.loading');

  return (
    <div className="splash-screen">
      <div className="splash-logo">
        <i className="fas fa-shield-halved"></i>
      </div>
      <h1 className="splash-title">Block Guard</h1>
      <p className="splash-subtitle">{subtitle}</p>
    </div>
  );
}

export default SplashScreen;
