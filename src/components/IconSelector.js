/**
 * ============================================================================
 * ICON SELECTOR COMPONENT
 * ============================================================================
 * 
 * Componente para seleccionar iconos personalizados para archivos.
 * Muestra una cuadrícula de iconos organizados por categorías.
 * 
 * PROPS:
 * - onSelect: (iconId: string) => void - Callback cuando se selecciona un icono
 * - onClose: () => void - Callback para cerrar el selector
 * 
 * CARACTERÍSTICAS:
 * - Organización por categorías con tabs
 * - Grid de iconos con hover effects
 * - Cierre al hacer click fuera o presionar Escape
 * - Usa ICON_LIBRARY de src/utils/iconLibrary.js
 * 
 * RELACIONADO CON:
 * - src/utils/iconLibrary.js: Biblioteca de iconos
 * - src/components/LexicalEditor.js: Usa este componente en metadata
 * - Requirements 9.3, 9.4
 * ============================================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import { ICON_LIBRARY, getIconCategories } from '../utils/iconLibrary';
import Icon from '@mdi/react';

const IconSelector = ({ onSelect, onClose, style }) => {
  const [activeCategory, setActiveCategory] = useState('writing');
  const modalRef = useRef(null);

  // Manejar click fuera del selector
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    // Manejar tecla Escape
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

  const handleIconSelect = (iconId) => {
    onSelect(iconId);
  };

  const allIcons = Object.values(ICON_LIBRARY).flatMap(cat => cat.icons);

  return (
    <div 
      className="icon-selector-dropdown minimalist" 
      ref={modalRef}
      style={style}
    >
      <div className="icon-selector-grid-simple">
        {allIcons.map(icon => (
          <button
            key={icon.id}
            className="icon-selector-item-simple"
            onClick={() => handleIconSelect(icon.id)}
            title={icon.label}
          >
            <Icon path={icon.icon} size={0.8} />
          </button>
        ))}
      </div>
    </div>
  );
};

export default IconSelector;
