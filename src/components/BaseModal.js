/**
 * ============================================================================
 * BASEMODAL.JS - Componente Base para Modales
 * ============================================================================
 * 
 * Componente base que proporciona la estructura y funcionalidad común
 * para todos los modales de Bloopy, asegurando consistencia en el diseño.
 * 
 * PROPS:
 * - isOpen: boolean - Si el modal está visible
 * - onClose: function - Callback al cerrar
 * - title: string - Título del modal
 * - children: React.ReactNode - Contenido del modal
 * - size: 'small' | 'medium' | 'large' - Tamaño del modal (default: medium)
 * - showCloseButton: boolean - Mostrar botón de cerrar (default: true)
 * - closeOnOverlay: boolean - Cerrar al hacer clic fuera (default: true)
 * - className: string - Clases adicionales
 * 
 * USO:
 * <BaseModal
 *   isOpen={isOpen}
 *   onClose={onClose}
 *   title="Título del Modal"
 *   size="medium"
 * >
 *   <div>Contenido del modal</div>
 * </BaseModal>
 * ============================================================================
 */

import React, { useEffect, useRef } from 'react';
import '../styles/base-modal.css';
import Icon from '@mdi/react';
import * as mdi from '@mdi/js';
const { mdiClose } = mdi;

function BaseModal({
  isOpen,
  onClose,
  title,
  children,
  size = 'medium',
  showCloseButton = true,
  closeOnOverlay = true,
  className = '',
  ...props
}) {
  const modalRef = useRef(null);

  // Manejar cierre con tecla Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevenir scroll del body cuando el modal está abierto
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Manejar focus dentro del modal
  useEffect(() => {
    if (isOpen && modalRef.current) {
      // Enfocar el primer elemento focusable dentro del modal
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    }
  }, [isOpen]);

  const handleOverlayClick = (e) => {
    if (closeOnOverlay && e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className={`base-modal-overlay ${className}`}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div 
        ref={modalRef}
        className={`base-modal base-modal--${size}`}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="base-modal__header">
            {title && (
              <h2 id="modal-title" className="base-modal__title">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button 
                className="base-modal__close-btn"
                onClick={onClose}
                aria-label="Cerrar modal"
              >
                <Icon path={mdiClose} size={0.7} />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="base-modal__content">
          {children}
        </div>
      </div>
    </div>
  );
}

export default BaseModal;
