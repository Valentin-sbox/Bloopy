/**
 * BLOCK GUARD - EDITOR CONTEXT MENU
 * Menú contextual que aparece al hacer clic derecho en el editor.
 * Props:
 * - position: { x, y }
 * - onClose: function - Callback al cerrar el menú
 * - onAction: function(action) - Callback al seleccionar una acción
 */

import React, { useEffect } from 'react';
import { getShortcutDisplay } from '../utils/shortcuts';
import { useTranslation } from '../utils/i18n';

function EditorContextMenu({ position = { x: 0, y: 0 }, onClose = () => {}, onAction }) {
  const { t } = useTranslation();
  
  useEffect(() => {
    const handleClickOutside = () => onClose();
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [onClose]);

  const actions = [
    { id: 'cut', label: t('editor.contextMenu.cut'), icon: 'fa-cut', hotkey: getShortcutDisplay('cut') },
    { id: 'copy', label: t('editor.contextMenu.copy'), icon: 'fa-copy', hotkey: getShortcutDisplay('copy') },
    { id: 'paste', label: t('editor.contextMenu.paste'), icon: 'fa-paste', hotkey: getShortcutDisplay('paste') },
    { id: 'separator', label: '' },
    { id: 'selectAll', label: t('editor.contextMenu.selectAll'), icon: 'fa-check-square', hotkey: getShortcutDisplay('selectAll') },
    { id: 'separator', label: '' },
    { id: 'clearFormat', label: t('editor.contextMenu.clearFormat'), icon: 'fa-eraser', hotkey: '' },
    { id: 'clearHighlights', label: t('editor.contextMenu.clearHighlights'), icon: 'fa-highlighter', hotkey: '' }
  ];

  const handleAction = (actionId) => {
    if (actionId !== 'separator') {
      if (onAction) onAction(actionId);
      onClose();
    }
  };

  // Calcular posición para mantener dentro del viewport
  const adjustPosition = () => {
    const maxX = window.innerWidth - 250;
    const maxY = window.innerHeight - 300;
    return {
      top: `${Math.min(position.y, maxY)}px`,
      left: `${Math.min(position.x, maxX)}px`,
      position: 'fixed'
    };
  };

  return (
    <div
      className="context-menu editor-context-menu"
      style={adjustPosition()}
      onClick={(e) => e.stopPropagation()}
    >
      {actions.map((action, idx) => {
        if (action.id === 'separator') {
          return <div key={idx} className="context-separator"></div>;
        }
        return (
          <div
            key={action.id}
            className="context-item"
            onClick={() => handleAction(action.id)}
            title={action.hotkey}
          >
            <i className={`fas ${action.icon}`}></i>
            <span className="context-label">{action.label}</span>
            {action.hotkey && <span className="context-hotkey">{action.hotkey}</span>}
          </div>
        );
      })}
    </div>
  );
}

export default EditorContextMenu;
