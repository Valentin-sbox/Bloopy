/**
 * ============================================================================
 *  EDITOR SIDEBAR (DERECHA)
 * ============================================================================
 * 
 * Sidebar lateral derecha del editor con acceso rápido a:
 * - Comentarios del archivo
 * - Corrector ortográfico
 * - Caracteres especiales y símbolos
 */

import React, { useState } from 'react';
import { useTranslation } from '../utils/i18n';
import '../styles/editor-sidebar.css';
import Icon from '@mdi/react';
import { mdiCommentTextMultiple, mdiKeyboardVariant, mdiClose } from '@mdi/js';

export function SpecialCharsPanel({ onClose, onInsertText }) {
  const { t } = useTranslation();
  const [copiedChar, setCopiedChar] = useState(null);

  // Caracteres especiales organizados por categorías
  const specialChars = {
    [t('editor.charCategories.quotes')]: ['\u201C', '\u201D', '\u2018', '\u2019', '\u00AB', '\u00BB', '\u2039', '\u203A'],
    [t('editor.charCategories.punctuation')]: ['\u2026', '\u2013', '\u2014', '\u2016', '\u2020', '\u2021', '\u00A7', '\u00B6'],
    [t('editor.charCategories.math')]: ['\u00B1', '\u00D7', '\u00F7', '\u2248', '\u2260', '\u2264', '\u2265', '\u221E'],
    [t('editor.charCategories.arrows')]: ['\u2192', '\u2190', '\u2191', '\u2193', '\u21D2', '\u21D0', '\u21D1', '\u21D3', '\u2B9E', '\u2B9F', '\u00AB', '\u00BB', '\u203A', '\u2039', '\u27F6', '\u27F5'],
    [t('editor.charCategories.symbols')]: ['\u00A9', '\u00AE', '\u2122', '\u20AC', '\u00A3', '\u00A5', '\u00A2', '\u00A7', '\u2020', '\u2021', '\u266B', '\u2666'],
    [t('editor.charCategories.others')]: ['\u00B0', '\u2713', '\u2717', '\u2605', '\u2660', '\u2663', '\u2665', '\u2666', '\u00D7', '\u00F7', '\u221A', '\u221B']
  };

  const insertCharacter = (char) => {
    // Copiar al clipboard
    navigator.clipboard.writeText(char).catch(() => {});
    if (onInsertText) onInsertText(char);
    setCopiedChar(char);
    setTimeout(() => setCopiedChar(null), 1500);
  };

  return (
    <div className="special-chars-panel">
      <div className="special-chars-header">
        <span>{t('editor.specialChars')}</span>
        <button className="close-btn" onClick={onClose} aria-label={t('editor.closePanel')}>
          <Icon path={mdiClose} size={0.7} />
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
                  onClick={() => insertCharacter(char)}
                  title={`Insertar "${char}"`}
                >
                  {copiedChar === char ? '✓' : char}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditorSidebar({
  activeFile,
  editorContent,
  onOpenComments,
  activeRightPanel,
  onToggleSpecialChars,
  config,
  commentCount = 0,
  onInsertText,
  isSplitView = false
}) {
  const { t } = useTranslation();
  const [copiedChar, setCopiedChar] = useState(null);

  // Caracteres especiales organizados por categorías
  const specialChars = {
    [t('editor.charCategories.quotes')]: ['\u201C', '\u201D', '\u2018', '\u2019', '\u00AB', '\u00BB', '\u2039', '\u203A'],
    [t('editor.charCategories.punctuation')]: ['\u2026', '\u2013', '\u2014', '\u2016', '\u2020', '\u2021', '\u00A7', '\u00B6'],
    [t('editor.charCategories.math')]: ['\u00B1', '\u00D7', '\u00F7', '\u2248', '\u2260', '\u2264', '\u2265', '\u221E'],
    [t('editor.charCategories.arrows')]: ['\u2192', '\u2190', '\u2191', '\u2193', '\u21D2', '\u21D0', '\u21D1', '\u21D3', '\u2B9E', '\u2B9F', '\u00AB', '\u00BB', '\u203A', '\u2039', '\u27F6', '\u27F5'],
    [t('editor.charCategories.symbols')]: ['\u00A9', '\u00AE', '\u2122', '\u20AC', '\u00A3', '\u00A5', '\u00A2', '\u00A7', '\u2020', '\u2021', '\u266B', '\u2666'],
    [t('editor.charCategories.others')]: ['\u00B0', '\u2713', '\u2717', '\u2605', '\u2660', '\u2663', '\u2665', '\u2666', '\u00D7', '\u00F7', '\u221A', '\u221B']
  };

  return (
    <aside className="editor-sidebar">
      {/* Botón de Comentarios */}
      <button
        className={`editor-sidebar-btn comments-btn ${activeRightPanel === 'comments' ? 'active' : ''}`}
        onClick={onOpenComments}
        title={t('comments.title') + ` (${commentCount})`}
        aria-label={t('editor.openComments')}
      >
        <Icon path={mdiCommentTextMultiple} size={0.9} />
        {commentCount > 0 && <span className="badge">{commentCount}</span>}
      </button>


      {/* Botón de Caracteres Especiales */}
      <button
        className={`editor-sidebar-btn special-chars-btn ${activeRightPanel === 'specialChars' ? 'active' : ''}`}
        onClick={onToggleSpecialChars}
        title={t('editor.specialCharsTooltip')}
        aria-label={t('editor.specialCharsTooltip')}
      >
        <Icon path={mdiKeyboardVariant} size={0.9} />
      </button>
    </aside>
  );
}

export default EditorSidebar;
