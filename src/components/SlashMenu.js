/**
 * ============================================================================
 *  SLASH MENU COMPONENT
 * ============================================================================
 * 
 * Menú contextual que aparece al escribir "/" en el editor.
 * Permite acceso rápido a comandos de formato sin usar botones.
 * 
 * PROPS:
 * - position: { x: number, y: number } - Posición del menú en la pantalla
 * - searchQuery: string - Texto de búsqueda para filtrar comandos
 * - onSelect: function(command) - Callback al seleccionar un comando
 * - onClose: function() - Callback para cerrar el menú
 * - selectedIndex: number - Índice del comando seleccionado (navegación con flechas)
 * - onNavigate: function(newIndex) - Callback para actualizar el índice seleccionado
 * 
 * FUNCIONALIDADES:
 * - Filtrado case-insensitive de comandos
 * - Navegación con flechas arriba/abajo
 * - Selección con Enter o clic
 * - Cierre con Escape o clic fuera
 * 
 * ============================================================================
 */

import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { SLASH_COMMANDS } from '../utils/slashCommands';
import '../styles/slash-menu.css';

const SlashMenu = ({ position, searchQuery, onSelect, onClose, selectedIndex, onNavigate }) => {
  const menuRef = useRef(null);

  // Filtrar comandos basado en searchQuery (case-insensitive)
  const filteredCommands = useMemo(() => {
    if (!searchQuery) return SLASH_COMMANDS;
    const query = searchQuery.toLowerCase();
    return SLASH_COMMANDS.filter(command => {
      const labelMatch = command.label.toLowerCase().includes(query);
      const keywordsMatch = command.keywords?.some(keyword => keyword.toLowerCase().includes(query));
      return labelMatch || keywordsMatch;
    });
  }, [searchQuery]);

  // useCallback para handler de selección
  const handleSelect = useCallback((command) => {
    onSelect(command);
  }, [onSelect]);

  // Manejar navegación con teclado
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const newIndex = selectedIndex < filteredCommands.length - 1 ? selectedIndex + 1 : 0;
        onNavigate(newIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const newIndex = selectedIndex > 0 ? selectedIndex - 1 : filteredCommands.length - 1;
        onNavigate(newIndex);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          handleSelect(filteredCommands[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNavigate, selectedIndex, filteredCommands, handleSelect]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    // Pequeño delay para evitar que el clic que abre el menú lo cierre inmediatamente
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Scroll automático al comando seleccionado
  useEffect(() => {
    if (menuRef.current && selectedIndex >= 0) {
      const selectedElement = menuRef.current.querySelector(
        `.slash-menu-item:nth-child(${selectedIndex + 1})`
      );
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  if (filteredCommands.length === 0) {
    return (
      <div
        ref={menuRef}
        className="slash-menu"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`
        }}
      >
        <div className="slash-menu-empty">
          No se encontraron comandos
        </div>
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      className="slash-menu"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`
      }}
    >
      {filteredCommands.map((command, index) => (
        <div
          key={command.id}
          className={`slash-menu-item ${index === selectedIndex ? 'selected' : ''}`}
          onClick={() => handleSelect(command)}
        >
          <span className="slash-menu-icon">{command.icon}</span>
          <div className="slash-menu-texts">
            <span className="slash-menu-label">{command.label}</span>
            {(command.description || command.placeholder) && (
              <span className="slash-menu-desc">
                {command.description}
                {command.placeholder ? ` • ${command.placeholder}` : ''}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SlashMenu;
