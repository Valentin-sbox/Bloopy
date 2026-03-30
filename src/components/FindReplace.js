/**
 * ============================================================================
 *  FINDREPLACE.JS
 * ============================================================================
 * 
 * COMPONENTE: BUSCADOR Y REEMPLAZADOR DE TEXTO
 * 
 * Proporciona funcionalidad de búsqueda y reemplazo en el editor:
 * - Búsqueda en tiempo real con Ctrl+F
 * - Resaltado de coincidencias
 * - Navegación entre coincidencias (siguiente/anterior)
 * - Reemplazo simple o global
 * - Case-sensitive toggle
 * - Contador de coincidencias
 * 
 * PROPS:
 * - isOpen: boolean - Mostrar/ocultar panel
 * - onClose: function - Callback para cerrar
 * - content: string - Contenido a buscar (HTML)
 * - onReplace: function(searchTerm, replaceTerm, replaceAll) - Callback para reemplazar
 * 
 * RELACIONADO CON:
 * - src/components/Editor.js: Integración del find/replace
 * - src/styles/index.css: Estilos de .find-replace-panel
 * ============================================================================
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../utils/i18n';
import Icon from '@mdi/react';
import * as mdi from '@mdi/js';
const { 
  mdiMagnify, 
  mdiClose, 
  mdiChevronUp, 
  mdiChevronDown, 
  mdiFormatLetterCase, 
  mdiSwapHorizontal,
  mdiCheck,
  mdiCheckAll
} = mdi;

export default function FindReplace({ isOpen, onClose, content, onReplace, onNavigate, editorRef }) {
  const { t } = useTranslation();
  
  // Estado del input de búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estado del input de reemplazo
  const [replaceTerm, setReplaceTerm] = useState('');
  
  // Número de coincidencias encontradas
  const [matchCount, setMatchCount] = useState(0);
  
  // Índice de coincidencia actual
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  
  // Case-sensitive toggle
  const [caseSensitive, setCaseSensitive] = useState(false);
  
  // Mostrar panel de reemplazo
  const [showReplace, setShowReplace] = useState(false);
  
  // Referencia al input de búsqueda
  const searchInputRef = useRef(null);

  /**
   * Efecto: Enfocar el input cuando se abre el panel y prevenir drag
   */
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current.focus(), 100);
    }
    
    // Prevenir que el panel sea draggable en Electron
    const panel = document.querySelector('.find-replace-panel');
    if (panel) {
      panel.style.webkitAppRegion = 'no-drag';
    }
  }, [isOpen]);

  /**
   * Calcula el número de coincidencias en el contenido
   */
  const calculateMatches = () => {
    // Validar que haya al menos 2 caracteres para buscar
    if (!searchTerm || searchTerm.length < 2 || !editorRef?.current) {
      setMatchCount(0);
      setCurrentMatchIndex(0);
      return;
    }

    const text = editorRef.current.innerText || '';
    const flags = caseSensitive ? 'g' : 'gi';
    try {
      const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, flags);
      const matches = text.match(regex);
      const count = matches ? matches.length : 0;
      setMatchCount(count);
      setCurrentMatchIndex(count > 0 ? 1 : 0);
      if (count > 0 && typeof onNavigate === 'function') {
        onNavigate(searchTerm, 1, caseSensitive);
      }
    } catch (error) {
      console.error('Regex error:', error);
      setMatchCount(0);
    }
  };

  /**
   * Efecto: Recalcular coincidencias cuando cambia el término
   */
  useEffect(() => {
    calculateMatches();
  }, [searchTerm, caseSensitive]);

  /**
   * Maneja el click en "Siguiente"
   */
  const handleNextMatch = () => {
    if (matchCount > 0) {
      const nextIndex = currentMatchIndex < matchCount ? currentMatchIndex + 1 : 1;
      setCurrentMatchIndex(nextIndex);
      if (typeof onNavigate === 'function') onNavigate(searchTerm, nextIndex, caseSensitive);
    }
  };

  /**
   * Maneja el click en "Anterior"
   */
  const handlePreviousMatch = () => {
    if (matchCount > 0) {
      const prevIndex = currentMatchIndex > 1 ? currentMatchIndex - 1 : matchCount;
      setCurrentMatchIndex(prevIndex);
      if (typeof onNavigate === 'function') onNavigate(searchTerm, prevIndex, caseSensitive);
    }
  };

  /**
   * Maneja el reemplazo de la coincidencia actual
   */
  const handleReplaceCurrent = () => {
    if (searchTerm && onReplace) {
      onReplace(searchTerm, replaceTerm, false);
      calculateMatches();
    }
  };

  /**
   * Maneja el reemplazo global
   */
  const handleReplaceAll = () => {
    if (searchTerm && onReplace) {
      onReplace(searchTerm, replaceTerm, true);
      calculateMatches();
      setSearchTerm('');
    }
  };

  /**
   * Maneja la tecla Enter o Escape
   */
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNextMatch();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="find-replace-panel">
      <div className="find-replace-container">
        {/* Fila de búsqueda */}
        <div className="find-replace-row">
          <label className="find-replace-label">
            <Icon path={mdiMagnify} size={0.7} />
          </label>
          <input
            ref={searchInputRef}
            type="text"
            className="find-replace-input"
            placeholder={t('findReplace.find')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          
          {/* Contador de coincidencias */}
          {matchCount > 0 && (
            <span className="match-counter">
              {t('findReplace.matches', { current: currentMatchIndex, total: matchCount })}
            </span>
          )}
          {matchCount === 0 && searchTerm && (
            <span className="match-counter no-match">
              <Icon path={mdiClose} size={0.5} /> {t('findReplace.noMatches')}
            </span>
          )}

          {/* Botones de navegación */}
          <button
            className="find-replace-btn icon-btn"
            onClick={handlePreviousMatch}
            disabled={matchCount === 0}
            title={t('findReplace.previous')}
          >
            <Icon path={mdiChevronUp} size={0.7} />
          </button>
          <button
            className="find-replace-btn icon-btn"
            onClick={handleNextMatch}
            disabled={matchCount === 0}
            title={t('findReplace.next')}
          >
            <Icon path={mdiChevronDown} size={0.7} />
          </button>

          {/* Toggle Case-Sensitive */}
          <button
            className={`find-replace-btn toggle-btn ${caseSensitive ? 'active' : ''}`}
            onClick={() => setCaseSensitive(!caseSensitive)}
            title={t('findReplace.caseSensitive')}
          >
            <Icon path={mdiFormatLetterCase} size={0.7} />
            <span>aA</span>
          </button>

          {/* Toggle Reemplazar */}
          <button
            className="find-replace-btn toggle-btn"
            onClick={() => setShowReplace(!showReplace)}
            title={t('findReplace.replace')}
          >
            <Icon path={mdiSwapHorizontal} size={0.7} />
          </button>

          {/* Botón cerrar */}
          <button
            className="find-replace-btn close-btn"
            onClick={onClose}
            title={t('findReplace.close')}
          >
            <Icon path={mdiClose} size={0.7} />
          </button>
        </div>

        {/* Fila de reemplazo (condicional) */}
        {showReplace && (
          <div className="find-replace-row">
            <label className="find-replace-label">
              <Icon path={mdiSwapHorizontal} size={0.7} />
            </label>
            <input
              type="text"
              className="find-replace-input"
              placeholder={t('findReplace.replace')}
              value={replaceTerm}
              onChange={(e) => setReplaceTerm(e.target.value)}
              onKeyDown={handleKeyDown}
            />

            {/* Botón reemplazar actual */}
            <button
              className="find-replace-btn replace-btn"
              onClick={handleReplaceCurrent}
              disabled={matchCount === 0}
              title={t('findReplace.replace')}
            >
              <Icon path={mdiCheck} size={0.7} />
              {t('findReplace.replace')}
            </button>

            {/* Botón reemplazar todos */}
            <button
              className="find-replace-btn replace-all-btn"
              onClick={handleReplaceAll}
              disabled={matchCount === 0}
              title={t('findReplace.replaceAll')}
            >
              <Icon path={mdiCheckAll} size={0.7} />
              {t('findReplace.replaceAll')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
