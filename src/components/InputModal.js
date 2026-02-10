/**
 * ============================================================================
 * BLOCK GUARD v4.0.0 - INPUTMODAL.JS
 * ============================================================================
 * 
 * COMPONENTE: MODAL DE INPUT
 * 
 * Muestra un diálogo con un campo de texto para que el usuario
 * introduzca información (nombre de proyecto, nombre de archivo, etc.)
 * 
 * PROPS:
 * - title: string - Título del modal
 * - placeholder: string - Placeholder del input
 * - defaultValue: string - Valor inicial del input (opcional)
 * - onConfirm: function(value) - Callback con el valor introducido
 * - onCancel: function - Callback al cancelar
 * 
 * RELACIONADO CON:
 * - src/App.js: Controla la visibilidad
 * - src/components/Sidebar.js: Lo usa para crear proyectos/archivos
 * ============================================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../utils/i18n';

function InputModal({ title, placeholder, defaultValue = '', onConfirm, onCancel }) {
  const { t } = useTranslation();
  
  // Estado del input
  const [value, setValue] = useState(defaultValue);
  
  // Referencia al input para auto-focus
  const inputRef = useRef(null);
  
  // Auto-focus al abrir
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      // Seleccionar todo si hay valor por defecto
      if (defaultValue) {
        inputRef.current.select();
      }
    }
  }, [defaultValue]);
  
  /**
   * Maneja el envío del formulario.
   */
  const handleSubmit = (e) => {
    e.preventDefault();
    if (value.trim()) {
      onConfirm(value.trim());
    }
  };
  
  /**
   * Maneja teclas especiales (Escape para cancelar).
   */
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };
  
  return (
    <div className="modal open" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal-content">
        {/* Botón de cerrar */}
        <button className="close-btn" onClick={onCancel}>
          <i className="fas fa-times"></i>
        </button>
        
        <div className="modal-body">
          <h2>{title}</h2>
          
          <form onSubmit={handleSubmit}>
            <div className="setting-item" style={{ marginTop: '24px' }}>
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                autoComplete="off"
              />
            </div>
            
            <div className="modal-actions">
              <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                {t('common.confirm')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default InputModal;
