/**
 * ============================================================================
 *  SPELLINGCONTEXTMENU.JS
 * ============================================================================
 * 
 * COMPONENTE: MENÚ CONTEXTUAL DE SUGERENCIAS ORTOGRÁFICAS
 * 
 * Muestra un menú contextual con sugerencias de corrección cuando el usuario
 * hace click derecho o hover sobre una palabra mal escrita.
 * 
 * FUNCIONALIDADES:
 * - Detecta palabras con errores ortográficos (marcadas con clase CSS)
 * - Muestra menú contextual con sugerencias
 * - Permite reemplazar palabra con sugerencia
 * - Agregar palabra al diccionario personal
 * - Ignorar palabra en esta sesión
 * 
 * PROPS:
 * - position: Object - { x, y } posición del menú
 * - word: string - Palabra mal escrita
 * - suggestions: Array - Lista de sugerencias
 * - onReplace: function - Callback al reemplazar palabra
 * - onAddToDictionary: function - Callback al agregar al diccionario
 * - onIgnore: function - Callback al ignorar palabra
 * - onClose: function - Callback al cerrar menú
 * 
 * RELACIONADO CON:
 * - src/components/LexicalEditor.js: Integración con el editor
 * - src/styles/index.css: Estilos de .spelling-context-menu
 * ============================================================================
 */

import React, { useEffect, useRef } from 'react';
import { useTranslation } from '../utils/i18n';
import Icon from '@mdi/react';
import { 
  mdiAutoFix, 
  mdiChevronRight, 
  mdiCheck, 
  mdiPlusCircle, 
  mdiEyeOff, 
  mdiUndo, 
  mdiRedo, 
  mdiContentCut, 
  mdiContentCopy, 
  mdiContentPaste, 
  mdiCursorDefaultClick, 
  mdiEraser 
} from '@mdi/js';

function SpellingContextMenu({
  x,
  y,
  word,
  suggestions = [],
  onReplace,
  onAddToDictionary,
  onIgnore,
  onEditAction,
  onClose
}) {
  const { t } = useTranslation();
  const menuRef = useRef(null);

  // Cerrar menú al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
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

  // Ajustar posición si el menú se sale de la pantalla
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      // Si se sale por la derecha, mover a la izquierda de la posición original
      if (x + rect.width > viewportWidth) {
        adjustedX = Math.max(10, viewportWidth - rect.width - 10);
      }
      
      // Si se sale por abajo, mover arriba de la posición original
      if (y + rect.height > viewportHeight) {
        adjustedY = Math.max(10, y - rect.height);
      }

      menuRef.current.style.left = `${adjustedX}px`;
      menuRef.current.style.top = `${adjustedY}px`;
    }
  }, [x, y, suggestions]);

  return (
    <div
      ref={menuRef}
      className="spelling-context-menu"
      style={{
        position: 'fixed',
        left: `${x}px`,
        top: `${y}px`,
        zIndex: 10000
      }}
    >
      {/* SECCIÓN DE CORRECCIÓN (Solo si hay una palabra mal escrita) */}
      {word && word.trim() && (
        <div className="spelling-section">
          <div className="spelling-menu-item suggestion-header">
            <Icon path={mdiAutoFix} size={0.7} />
            <span>{word}</span>
            <Icon path={mdiChevronRight} size={0.6} className="arrow-icon" />
          </div>

          <div className="spelling-submenu">
            {suggestions.length > 0 ? (
              suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  className="spelling-menu-item suggestion"
                  onClick={() => { onReplace(suggestion); onClose(); }}
                >
                  <Icon path={mdiCheck} size={0.7} />
                  <span>{suggestion}</span>
                </button>
              ))
            ) : (
              <div className="spelling-menu-item disabled">
                <span>{t('spelling.noSuggestions')}</span>
              </div>
            )}

            <div className="spelling-menu-divider"></div>

            <button className="spelling-menu-item" onClick={() => { onAddToDictionary(word); onClose(); }}>
              <Icon path={mdiPlusCircle} size={0.7} />
              <span>{t('spelling.addToDictionary')}</span>
            </button>
            <button className="spelling-menu-item" onClick={() => { onIgnore(word); onClose(); }}>
              <Icon path={mdiEyeOff} size={0.7} />
              <span>{t('spelling.ignoreWord')}</span>
            </button>
          </div>
          <div className="spelling-menu-divider"></div>
        </div>
      )}

      {/* SECCIÓN DE HISTORIAL Y EDICIÓN */}
      <div className="edit-section">
        <div className="menu-row">
          <button className="spelling-menu-item half" onClick={() => { onEditAction('undo'); onClose(); }} title={t('common.undo')}>
            <Icon path={mdiUndo} size={0.7} /> <span>{t('common.undo')}</span>
          </button>
          <button className="spelling-menu-item half" onClick={() => { onEditAction('redo'); onClose(); }} title={t('common.redo')}>
            <Icon path={mdiRedo} size={0.7} /> <span>{t('common.redo')}</span>
          </button>
        </div>

        <div className="spelling-menu-divider"></div>

        <button className="spelling-menu-item" onClick={async () => { 
          await onEditAction('cut'); 
          setTimeout(() => onClose(), 50); 
        }}>
          <Icon path={mdiContentCut} size={0.7} />
          <span>{t('editor.contextMenu.cut')}</span>
          <span className="shortcut">Ctrl+X</span>
        </button>
        <button className="spelling-menu-item" onClick={async () => { 
          await onEditAction('copy'); 
          setTimeout(() => onClose(), 50); 
        }}>
          <Icon path={mdiContentCopy} size={0.7} />
          <span>{t('editor.contextMenu.copy')}</span>
          <span className="shortcut">Ctrl+C</span>
        </button>
        <button className="spelling-menu-item" onClick={async () => { 
          await onEditAction('paste'); 
          setTimeout(() => onClose(), 50); 
        }}>
          <Icon path={mdiContentPaste} size={0.7} />
          <span>{t('editor.contextMenu.paste')}</span>
          <span className="shortcut">Ctrl+V</span>
        </button>

        <div className="spelling-menu-divider"></div>

        <button className="spelling-menu-item" onClick={() => { onEditAction('selectAll'); onClose(); }}>
          <Icon path={mdiCursorDefaultClick} size={0.7} />
          <span>{t('editor.contextMenu.selectAll')}</span>
          <span className="shortcut">Ctrl+A</span>
        </button>

        <div className="spelling-menu-divider"></div>

        <button className="spelling-menu-item" onClick={() => { onEditAction('clearFormat'); onClose(); }}>
          <Icon path={mdiEraser} size={0.7} />
          <span>{t('editor.contextMenu.clearFormat')}</span>
        </button>
      </div>
    </div>
  );
}

export default SpellingContextMenu;
