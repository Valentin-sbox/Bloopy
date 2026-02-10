/**
 * ============================================================================
 * BLOCK GUARD - EDITOR SIDEBAR (DERECHA)
 * ============================================================================
 * 
 * Sidebar lateral derecha del editor con acceso rápido a:
 * - Comentarios del archivo
 * - Corrector ortográfico
 * - Caracteres especiales y símbolos
 */

import React, { useState } from 'react';
import SpellCheckModal from './SpellCheckModal';
import '../styles/editor-sidebar.css';

function EditorSidebar({ 
  activeFile, 
  editorContent, 
  onOpenComments, 
  config,
  commentCount = 0 
}) {
  const [isSpellCheckOpen, setIsSpellCheckOpen] = useState(false);
  const [showSpecialChars, setShowSpecialChars] = useState(false);
  const [copiedChar, setCopiedChar] = useState(null);

  // Caracteres especiales organizados por categorías
  const specialChars = {
    'Comillas': ['\u201C', '\u201D', '\u2018', '\u2019', '\u00AB', '\u00BB', '\u2039', '\u203A'],
    'Puntuación': ['\u2026', '\u2013', '\u2014', '\u2016', '\u2020', '\u2021', '\u00A7', '\u00B6'],
    'Matemáticas': ['\u00B1', '\u00D7', '\u00F7', '\u2248', '\u2260', '\u2264', '\u2265', '\u221E'],
    'Flechas': ['\u2192', '\u2190', '\u2191', '\u2193', '\u21D2', '\u21D0', '\u21D1', '\u21D3', '\u2B9E', '\u2B9F', '\u00AB', '\u00BB', '\u203A', '\u2039', '\u27F6', '\u27F5'],
    'Símbolos': ['\u00A9', '\u00AE', '\u2122', '\u20AC', '\u00A3', '\u00A5', '\u00A2', '\u00A7', '\u2020', '\u2021', '\u266B', '\u2666'],
    'Otros': ['\u00B0', '\u2713', '\u2717', '\u2605', '\u2660', '\u2663', '\u2665', '\u2666', '\u00D7', '\u00F7', '\u221A', '\u221B']
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedChar(text);
      setTimeout(() => setCopiedChar(null), 1500);
    });
  };

  return (
    <>
      <aside className="editor-sidebar">
        {/* Botón de Comentarios */}
        <button
          className="editor-sidebar-btn comments-btn"
          onClick={onOpenComments}
          title={`Comentarios (${commentCount})`}
          aria-label="Abrir comentarios"
        >
          <i className="fas fa-comments"></i>
          {commentCount > 0 && <span className="badge">{commentCount}</span>}
        </button>

        {/* Botón de Corrector Ortográfico */}
        <button
          className="editor-sidebar-btn spellcheck-btn"
          onClick={() => setIsSpellCheckOpen(true)}
          title="Corrector ortográfico (Ctrl+K)"
          aria-label="Abrir corrector ortográfico"
        >
          <i className="fas fa-spell-check"></i>
        </button>

        {/* Botón de Caracteres Especiales */}
        <button
          className="editor-sidebar-btn special-chars-btn"
          onClick={() => setShowSpecialChars(!showSpecialChars)}
          title="Caracteres especiales"
          aria-label="Caracteres especiales"
        >
          <i className="fas fa-keyboard"></i>
        </button>
      </aside>

      {/* Panel de Caracteres Especiales */}
      {showSpecialChars && (
        <div className="special-chars-panel">
          <div className="special-chars-header">
            <span>Caracteres Especiales</span>
            <button
              className="close-btn"
              onClick={() => setShowSpecialChars(false)}
              aria-label="Cerrar"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="special-chars-content">
            {Object.entries(specialChars).map(([category, chars]) => (
              <div key={category} className="char-category">
                <div className="category-name">{category}</div>
                <div className="chars-grid">
                  {chars.map((char, idx) => (
                    <button
                      key={idx}
                      className={`char-btn ${copiedChar === char ? 'copied' : ''}`}
                      onClick={() => copyToClipboard(char)}
                      title={`Copiar "${char}"`}
                    >
                      {copiedChar === char ? '✓' : char}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Corrector Ortográfico */}
      {isSpellCheckOpen && (
        <SpellCheckModal
          text={editorContent.replace(/<[^>]*>/g, '')}
          onClose={() => setIsSpellCheckOpen(false)}
          config={config}
        />
      )}
    </>
  );
}

export default EditorSidebar;
