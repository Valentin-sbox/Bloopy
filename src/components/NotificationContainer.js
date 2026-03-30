/**
 * ============================================================================
 *  NOTIFICATIONCONTAINER.JS
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
import Icon from '@mdi/react';
import { mdiCheckCircle, mdiAlertCircle, mdiInformation } from '@mdi/js';

function NotificationContainer({ notifications }) {
  /**
   * Obtiene el icono MDI según el tipo de notificación.
   * @param {string} type - Tipo de notificación
   * @returns {string} Ruta del icono
   */
  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return mdiCheckCircle;
      case 'error':
        return mdiAlertCircle;
      default:
        return mdiInformation;
    }
  };
  
  return (
    <div id="notification-container">
      {notifications.map(notification => (
        <div 
          key={notification.id} 
          className={`notification ${notification.type}`}
        >
          <Icon path={getIcon(notification.type)} size={0.7} />
          {/* escapeHtml previene XSS en mensajes de usuario */}
          <span>{escapeHtml(notification.message)}</span>
        </div>
      ))}
    </div>
  );
}

export default NotificationContainer;
