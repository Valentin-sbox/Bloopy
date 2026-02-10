/**
 * ============================================================================
 * BLOCK GUARD v4.0.0 - CONFIRMMODAL.JS
 * ============================================================================
 * 
 * COMPONENTE: MODAL DE CONFIRMACIÓN
 * 
 * Muestra un diálogo de confirmación para acciones destructivas
 * como eliminar archivos o proyectos.
 * 
 * PROPS:
 * - title: string - Título del modal
 * - text: string - Texto descriptivo
 * - icon: string - Clase Font Awesome del icono (default: 'fa-question-circle')
 * - onConfirm: function - Callback al confirmar
 * - onCancel: function - Callback al cancelar
 * 
 * RELACIONADO CON:
 * - src/App.js: Controla la visibilidad y callbacks
 * - src/components/Sidebar.js: Lo usa para eliminar archivos
 * ============================================================================
 */

import React from 'react';
import { useTranslation } from '../utils/i18n';

function ConfirmModal({ title, text, icon = 'fa-question-circle', onConfirm, onCancel }) {
  const { t } = useTranslation();
  
  return (
    <div className="modal open" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal-content small text-center">
        {/* Botón de cerrar */}
        <button className="close-btn" onClick={onCancel}>
          <i className="fas fa-times"></i>
        </button>
        
        <div className="modal-body">
          {/* Icono según el tipo de confirmación */}
          <i 
            className={`fas ${icon}`} 
            style={{ 
              fontSize: '2.5rem', 
              color: icon === 'fa-exclamation-triangle' ? 'var(--accent-red)' : 'var(--accent-blue)',
              marginBottom: '16px'
            }}
          ></i>
          
          <h2>{title}</h2>
          <p style={{ margin: '16px 0', color: 'var(--text-secondary)' }}>{text}</p>
        </div>
        
        <div className="modal-actions">
          {/* Botón de confirmar (peligro si es eliminar) */}
          <button 
            onClick={onConfirm} 
            className="btn-primary danger" 
            style={{ width: '100%' }}
          >
            {t('common.confirm')}
          </button>
          
          {/* Botón de cancelar */}
          <button 
            onClick={onCancel} 
            className="btn-sub" 
            style={{ width: '100%', marginTop: '10px' }}
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
