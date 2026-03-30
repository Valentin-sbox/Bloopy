/**
 * ============================================================================
 *  CONFIRMMODAL.JS
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
import Icon from '@mdi/react';
import { mdiClose, mdiHelpCircle, mdiAlert } from '@mdi/js';

function ConfirmModal({ title, text, icon = mdiHelpCircle, onConfirm, onCancel }) {
  const { t } = useTranslation();
  
  return (
    <div className="modal open" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal-content small text-center">
        {/* Botón de cerrar */}
        <button className="close-btn" onClick={onCancel}>
          <Icon path={mdiClose} size={0.7} />
        </button>
        
        <div className="modal-body">
          {/* Icono según el tipo de confirmación */}
          <Icon 
            path={icon} 
            size={2.5}
            style={{ 
              color: icon === mdiAlert ? 'var(--accent-red)' : 'var(--accent-blue)',
              marginBottom: '16px'
            }}
          />
          
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
