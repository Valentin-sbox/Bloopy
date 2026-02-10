/**
 * ============================================================================
 * BLOCK GUARD v4.0.0 - NOTIFICATIONCONTAINER.JS
 * ============================================================================
 * 
 * COMPONENTE: CONTENEDOR DE NOTIFICACIONES
 * 
 * Muestra notificaciones toast en la esquina inferior derecha.
 * Soporta tres tipos: success (verde), error (rojo), info (azul).
 * 
 * PROPS:
 * - notifications: Array - Lista de notificaciones a mostrar
 *   Cada notificación tiene: { id, message, type }
 * 
 * RELACIONADO CON:
 * - src/App.js: Gestiona el estado de las notificaciones
 * - src/styles/index.css: Estilos de #notification-container
 * ============================================================================
 */

import React from 'react';
import { escapeHtml } from '../utils/helpers';

function NotificationContainer({ notifications }) {
  /**
   * Obtiene el icono Font Awesome según el tipo de notificación.
   * @param {string} type - Tipo de notificación
   * @returns {string} Clase del icono
   */
  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return 'fa-check-circle';
      case 'error':
        return 'fa-exclamation-circle';
      default:
        return 'fa-info-circle';
    }
  };
  
  return (
    <div id="notification-container">
      {notifications.map(notification => (
        <div 
          key={notification.id} 
          className={`notification ${notification.type}`}
        >
          <i className={`fas ${getIcon(notification.type)}`}></i>
          {/* escapeHtml previene XSS en mensajes de usuario */}
          <span>{escapeHtml(notification.message)}</span>
        </div>
      ))}
    </div>
  );
}

export default NotificationContainer;
