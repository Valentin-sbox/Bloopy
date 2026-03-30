/**
 * ============================================================================
 *  SPLASHSCREEN.JS
 * ============================================================================
 *
 * Pantalla de carga inicial con diseño en 2 columnas:
 * - Columna izquierda: imagen estática (assets/inloading.jpg)
 * - Columna derecha: logo Bloopy + texto "Cargando Bloopy"
 *
 * OPTIMIZADO: Muestra contenido inmediatamente, imágenes cargan en segundo plano
 * ============================================================================
 */

import React from 'react';
import { useTranslation } from '../utils/i18n';
import Icon from '@mdi/react';
import { mdiWeb } from '@mdi/js';

function SplashScreen({ visible, phase = 'loading', onImageReady }) {
  const { t } = useTranslation();

  if (!visible) return null;

  const subtitle = phase === 'checking'
    ? t('splash.checking')
    : t('splash.loading');

  const imgSrc = "assets/inloading.webp";
  const iconSrc = "assets/icon.png";

  return (
    <div className="splash-screen">
      <div className="splash-layout">
        <div className="splash-image-col">
          <img
            src={imgSrc}
            alt=""
            className="splash-image"
            loading="eager"
            decoding="async"
            onLoad={() => { if (onImageReady) onImageReady(); }}
            ref={(el) => {
              // Si la imagen ya está en caché, onLoad no dispara — verificar complete
              if (el && el.complete && onImageReady) onImageReady();
            }}
            onError={(e) => {
              console.error('[SplashScreen] Error loading image:', imgSrc);
              e.target.style.display = 'none';
              e.target.parentElement.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
              if (onImageReady) onImageReady();
            }}
          />
          <a 
            href="https://www.pixiv.net/en/users/66097249"
            target="_blank"
            rel="noopener noreferrer"
            className="splash-art-credit"
          >
            <Icon path={mdiWeb} size={0.6} />
            <span>MOKA - Pixiv</span>
          </a>
        </div>
        <div className="splash-content-col">
          <img
            src={iconSrc}
            alt="Bloopy"
            className="splash-logo-img"
            loading="eager"
            decoding="async"
            onError={(e) => {
              console.error('[SplashScreen] Error loading icon:', iconSrc);
              e.target.style.display = 'none';
            }}
          />
          <h1 className="splash-title">Bloopy</h1>
          <p className="splash-subtitle">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

export default SplashScreen;
