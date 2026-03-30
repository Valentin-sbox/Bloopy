/**
 * ============================================================================
 *  LINKTOOLTIP.JS
 * ============================================================================
 * 
 * COMPONENTE: TOOLTIP FLOTANTE PARA ENLACES
 * 
 * Muestra un tooltip flotante cuando el usuario pasa el cursor sobre un enlace.
 * Proporciona acciones rápidas para interactuar con el enlace sin usar menús
 * contextuales.
 * 
 * FUNCIONALIDADES:
 * - Muestra la URL del enlace
 * - Botón "Abrir" - Abre el enlace en el navegador predeterminado
 * - Botón "Copiar URL" - Copia la URL al portapapeles
 * - Botón "Quitar Link" - Convierte el enlace a texto plano
 * - Cierre automático al hacer clic fuera del tooltip
 * - Posicionamiento flotante cerca del enlace
 * 
 * PROPS:
 * - url: string - URL del enlace
 * - position: Object - { x, y } posición del tooltip
 * - onOpen: function - Callback al abrir el enlace
 * - onRemove: function - Callback al quitar el enlace
 * - onCopy: function - Callback al copiar la URL
 * - onClose: function - Callback al cerrar el tooltip
 * 
 * RELACIONADO CON:
 * - src/components/LexicalEditor.js: Integración con el editor
 * - src/styles/index.css: Estilos de .link-tooltip
 * 
 * REQUISITOS:
 * - Requisito 3.2: Interfaz con 3 botones
 * - Requisito 3.7: Posicionamiento flotante
 * ============================================================================
 */

import React, { useEffect, useRef } from 'react';
import Icon from '@mdi/react';
import { mdiLink, mdiOpenInNew, mdiContentCopy, mdiLinkOff } from '@mdi/js';

function LinkTooltip({ url, position, onOpen, onRemove, onCopy, onClose }) {
  const tooltipRef = useRef(null);

  // Cerrar tooltip al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Ajustar posición si el tooltip se sale de la pantalla
  useEffect(() => {
    if (tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = position.x;
      let adjustedY = position.y;

      // Ajustar si se sale por la derecha
      if (rect.right > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 10;
      }

      // Ajustar si se sale por abajo
      if (rect.bottom > viewportHeight) {
        adjustedY = position.y - rect.height - 10;
      }

      // Ajustar si se sale por la izquierda
      if (adjustedX < 10) {
        adjustedX = 10;
      }

      // Ajustar si se sale por arriba
      if (adjustedY < 10) {
        adjustedY = 10;
      }

      tooltipRef.current.style.left = `${adjustedX}px`;
      tooltipRef.current.style.top = `${adjustedY}px`;
    }
  }, [position.x, position.y]);

  // Truncar URL si es muy larga
  const displayUrl = url.length > 50 ? url.substring(0, 47) + '...' : url;

  return (
    <div
      ref={tooltipRef}
      className="link-tooltip"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 10000
      }}
    >
      <div className="link-tooltip-url" title={url}>
        <Icon path={mdiLink} size={0.6} />
        <span>{displayUrl}</span>
      </div>
      
      <div className="link-tooltip-divider"></div>
      
      <div className="link-tooltip-buttons">
        <button 
          className="link-tooltip-button" 
          onClick={onOpen} 
          title="Abrir enlace en el navegador"
        >
          <Icon path={mdiOpenInNew} size={0.6} />
          <span>Abrir</span>
        </button>
        
        <button 
          className="link-tooltip-button" 
          onClick={onCopy} 
          title="Copiar URL al portapapeles"
        >
          <Icon path={mdiContentCopy} size={0.6} />
          <span>Copiar URL</span>
        </button>
        
        <button 
          className="link-tooltip-button" 
          onClick={onRemove} 
          title="Quitar enlace (mantener texto)"
        >
          <Icon path={mdiLinkOff} size={0.6} />
          <span>Quitar Link</span>
        </button>
      </div>
    </div>
  );
}

export default LinkTooltip;
