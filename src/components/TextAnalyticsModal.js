/**
 * ============================================================================
 * BLOCK GUARD - TEXT ANALYTICS MODAL
 * ============================================================================
 * 
 * Modal que muestra análisis detallado del texto del editor.
 * Incluye conteos de caracteres, palabras, oraciones, párrafos, etc.
 * 
 * PROPS:
 * - isOpen: boolean - Si el modal está abierto
 * - onClose: function - Callback al cerrar
 * - editorContent: string - Contenido HTML del editor
 * 
 * ============================================================================
 */

import React from 'react';
import { useTranslation } from '../utils/i18n';

function TextAnalyticsModal({ isOpen, onClose, editorContent }) {
  const { t } = useTranslation();
  
  /**
   * Realiza análisis completo del texto basado en el contenido del editor
   * @returns {Object} Objeto con todas las métricas de análisis
   */
  const analyzeText = () => {
    if (!editorContent) {
      return {
        totalChars: 0,
        charsNoSpaces: 0,
        charsPerWord: 0,
        words: 0,
        uniqueWords: 0,
        sentences: 0,
        paragraphs: 0,
        readingTime: 0,
        avgWordLength: 0,
        avgSentenceLength: 0
      };
    }

    // Convertir HTML a texto plano
    const parser = new DOMParser();
    const doc = parser.parseFromString(editorContent, 'text/html');
    const plainText = doc.body.innerText || '';

    // Caracteres totales
    const totalChars = plainText.length;

    // Caracteres sin espacios
    const charsNoSpaces = plainText.replace(/\s/g, '').length;

    // Palabras (dividir por espacios y filtrar vacíos)
    const wordArray = plainText
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0);
    const words = wordArray.length;

    // Palabras únicas (case-insensitive)
    const uniqueWordsSet = new Set(wordArray.map(w => w.toLowerCase()));
    const uniqueWords = uniqueWordsSet.size;

    // Promedio de caracteres por palabra
    const charsPerWord = words > 0 ? (totalChars / words).toFixed(1) : 0;

    // Promedio de longitud de palabra
    const avgWordLength = words > 0 
      ? (charsNoSpaces / words).toFixed(1) 
      : 0;

    // Oraciones (dividir por puntuación final)
    const sentenceArray = plainText
      .split(/[.!?]+/)
      .filter(s => s.trim().length > 0);
    const sentences = sentenceArray.length;

    // Promedio de palabras por oración
    const avgSentenceLength = sentences > 0 
      ? (words / sentences).toFixed(1) 
      : 0;

    // Párrafos (contar líneas vacías o párrafos HTML)
    const paragraphArray = plainText
      .split(/\n\n+/)
      .filter(p => p.trim().length > 0);
    const paragraphs = Math.max(1, paragraphArray.length);

    // Tiempo de lectura (promedio 200 palabras por minuto)
    const readingTime = Math.ceil(words / 200);

    return {
      totalChars,
      charsNoSpaces,
      charsPerWord,
      words,
      uniqueWords,
      sentences,
      paragraphs,
      readingTime,
      avgWordLength,
      avgSentenceLength
    };
  };

  const analytics = analyzeText();

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="text-analytics-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2>
            <i className="fas fa-chart-bar"></i> {t('analytics.title')}
          </h2>
          <button className="modal-close-btn" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Contenido */}
        <div className="modal-body">
          <div className="analytics-grid">
            
            {/* Card: Caracteres */}
            <div className="analytics-card">
              <div className="card-icon">
                <i className="fas fa-keyboard"></i>
              </div>
              <div className="card-content">
                <span className="card-label">{t('analytics.characters')}</span>
                <span className="card-value">{analytics.totalChars.toLocaleString()}</span>
              </div>
            </div>

            {/* Card: Caracteres sin espacios */}
            <div className="analytics-card">
              <div className="card-icon">
                <i className="fas fa-compress"></i>
              </div>
              <div className="card-content">
                <span className="card-label">{t('analytics.charactersNoSpaces')}</span>
                <span className="card-value">{analytics.charsNoSpaces.toLocaleString()}</span>
              </div>
            </div>

            {/* Card: Palabras */}
            <div className="analytics-card">
              <div className="card-icon">
                <i className="fas fa-font"></i>
              </div>
              <div className="card-content">
                <span className="card-label">{t('analytics.words')}</span>
                <span className="card-value">{analytics.words.toLocaleString()}</span>
              </div>
            </div>

            {/* Card: Palabras únicas */}
            <div className="analytics-card">
              <div className="card-icon">
                <i className="fas fa-star"></i>
              </div>
              <div className="card-content">
                <span className="card-label">{t('analytics.mostUsedWords')}</span>
                <span className="card-value">{analytics.uniqueWords.toLocaleString()}</span>
              </div>
            </div>

            {/* Card: Oraciones */}
            <div className="analytics-card">
              <div className="card-icon">
                <i className="fas fa-heading"></i>
              </div>
              <div className="card-content">
                <span className="card-label">{t('analytics.sentences')}</span>
                <span className="card-value">{analytics.sentences}</span>
              </div>
            </div>

            {/* Card: Párrafos */}
            <div className="analytics-card">
              <div className="card-icon">
                <i className="fas fa-paragraph"></i>
              </div>
              <div className="card-content">
                <span className="card-label">{t('analytics.paragraphs')}</span>
                <span className="card-value">{analytics.paragraphs}</span>
              </div>
            </div>

            {/* Card: Caracteres por palabra */}
            <div className="analytics-card">
              <div className="card-icon">
                <i className="fas fa-divide"></i>
              </div>
              <div className="card-content">
                <span className="card-label">{t('analytics.averageWordLength')}</span>
                <span className="card-value">{analytics.charsPerWord}</span>
              </div>
            </div>

            {/* Card: Tiempo de lectura */}
            <div className="analytics-card">
              <div className="card-icon">
                <i className="fas fa-clock"></i>
              </div>
              <div className="card-content">
                <span className="card-label">{t('analytics.readingTime')}</span>
                <span className="card-value">{analytics.readingTime} {t('analytics.minutes')}</span>
              </div>
            </div>

            {/* Card: Promedio longitud de palabra */}
            <div className="analytics-card">
              <div className="card-icon">
                <i className="fas fa-ruler"></i>
              </div>
              <div className="card-content">
                <span className="card-label">{t('analytics.averageWordLength')}</span>
                <span className="card-value">{analytics.avgWordLength}</span>
              </div>
            </div>

            {/* Card: Promedio palabras por oración */}
            <div className="analytics-card">
              <div className="card-icon">
                <i className="fas fa-list"></i>
              </div>
              <div className="card-content">
                <span className="card-label">{t('analytics.averageSentenceLength')}</span>
                <span className="card-value">{analytics.avgSentenceLength}</span>
              </div>
            </div>
          </div>

          {/* Resumen */}
          <div className="analytics-summary">
            <h3>{t('analytics.title')}</h3>
            <p>
              Tu texto contiene <strong>{analytics.words.toLocaleString()} palabras</strong> y{' '}
              <strong>{analytics.paragraphs} párrafo{analytics.paragraphs !== 1 ? 's' : ''}</strong>.
              Tomará aproximadamente <strong>{analytics.readingTime} minuto{analytics.readingTime !== 1 ? 's' : ''}</strong> leerlo.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            <i className="fas fa-times"></i> {t('analytics.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TextAnalyticsModal;
