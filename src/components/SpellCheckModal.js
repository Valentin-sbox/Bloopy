/**
 * ============================================================================
 *  SPELLCHECKMODAL.JS
 * ============================================================================
 * 
 * COMPONENTE: MODAL DE CORRECTOR ORTOGRÁFICO
 * 
 * Permite al usuario revisar la ortografía usando herramientas externas.
 * Divide el texto en secciones manejables y copia al portapapeles.
 * 
 * FUNCIONALIDADES:
 * - Divide el texto en secciones de tamaño configurable
 * - Copia sección al portapapeles y abre página de corrección
 * - Gestión de páginas de corrección personalizables
 * - Soporte para LanguageTool, Corrector.co, DeepL Write, etc.
 * 
 * PROPS:
 * - text: string - Texto plano a revisar
 * - onClose: function - Callback al cerrar
 * - config: Object - Configuración de la app
 * 
 * RELACIONADO CON:
 * - src/App.js: Gestiona la visibilidad
 * - src/styles/index.css: Estilos de .spellcheck-*
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from '../utils/i18n';
import Icon from '@mdi/react';
import { 
  mdiClose, 
  mdiArrowLeft, 
  mdiTrashCan, 
  mdiPlus, 
  mdiContentSave, 
  mdiSpellcheck, 
  mdiCheck, 
  mdiOpenInNew 
} from '@mdi/js';

function SpellCheckModal({ text, onClose, config }) {
  const { t } = useTranslation();
  // =============================================================================
  // ESTADOS LOCALES
  // =============================================================================

  // Secciones de texto divididas
  const [sections, setSections] = useState([]);

  // Páginas de corrección configuradas
  const [spellcheckPages, setSpellcheckPages] = useState([]);

  // Página por defecto seleccionada
  const [defaultPage, setDefaultPage] = useState(null);

  // Tamaño de cada sección (en caracteres)
  const [sectionSize, setSectionSize] = useState(5000);

  // Si se muestra el gestor de páginas
  const [showPagesManager, setShowPagesManager] = useState(false);

  // Índice de la sección recién copiada (para feedback visual)
  const [copiedSection, setCopiedSection] = useState(null);

  // =============================================================================
  // EFECTOS
  // =============================================================================

  /**
   * Efecto: Cargar configuración inicial y dividir texto.
   */
  useEffect(() => {
    // Detectar idioma del programa desde config o usar el del corrector específicamente
    const programLanguage = config?.spellCheck?.language || config?.language || 'es';

    // Mapeo de códigos de idioma a URLs de LanguageTool con soporte para más idiomas
    const languageUrls = {
      'es': 'https://languagetool.org/es',
      'en': 'https://languagetool.org/',
      'ja': 'https://languagetool.org/ja',
      'zh': 'https://languagetool.org/zh',
      'fr': 'https://languagetool.org/fr',
      'de': 'https://languagetool.org/de',
      'it': 'https://languagetool.org/it',
      'pt': 'https://languagetool.org/pt'
    };

    // Cargar páginas guardadas en localStorage
    const savedPages = localStorage.getItem('bg_spellcheck_pages');
    let pages;
    if (savedPages) {
      try {
        pages = JSON.parse(savedPages);
        // Actualizar la URL de LanguageTool si ya existe y el idioma cambió
        const ltIndex = pages.findIndex(p => p.name === 'LanguageTool');
        if (ltIndex !== -1 && languageUrls[programLanguage]) {
          pages[ltIndex].url = languageUrls[programLanguage];
        }
      } catch (e) {
        pages = getDefaultPages(programLanguage, languageUrls);
      }
    } else {
      pages = getDefaultPages(programLanguage, languageUrls);
    }

    setSpellcheckPages(pages);
    setDefaultPage(pages.find(p => p.default) || pages[0]);

    // Cargar tamaño de sección guardado
    const savedSize = localStorage.getItem('bg_spellcheck_section_size');
    if (savedSize) {
      setSectionSize(parseInt(savedSize));
    }

    // Dividir texto en secciones
    divideTextIntoSections(text, savedSize ? parseInt(savedSize) : 5000);
  }, [text, config]);

  // =============================================================================
  // FUNCIONES AUXILIARES
  // =============================================================================

  /**
   * Obtiene las páginas de corrección por defecto.
   * @param {string} language - Código de idioma del programa
   * @param {Object} languageUrls - Mapeo de idiomas a URLs
   * @returns {Array} Lista de páginas predefinidas
   */
  const getDefaultPages = (language = 'es', languageUrls = {}) => {
    const languageToolUrl = languageUrls[language] || 'https://languagetool.org/es';

    return [
      { name: 'LanguageTool', url: languageToolUrl, default: true },
      { name: 'Corrector.co', url: 'https://www.corrector.co/', default: false },
      { name: 'DeepL Write', url: 'https://www.deepl.com/write', default: false }
    ];
  };

  /**
   * Divide el texto en secciones del tamaño especificado.
   * @param {string} fullText - Texto completo
   * @param {number} size - Tamaño de cada sección
   */
  const divideTextIntoSections = (fullText, size) => {
    const newSections = [];
    for (let i = 0; i < fullText.length; i += size) {
      newSections.push({
        index: Math.floor(i / size) + 1,
        text: fullText.substring(i, i + size),
        start: i,
        end: Math.min(i + size, fullText.length)
      });
    }
    setSections(newSections);
  };

  /**
   * Maneja la copia de una sección.
   * Copia al portapapeles y abre la página de corrección.
   * @param {Object} section - Sección a copiar
   */
  const handleCopySection = async (section) => {
    try {
      // Copiar al portapapeles
      await window.electronAPI.copyToClipboard(section.text);

      // Abrir página de corrección
      if (defaultPage) {
        await window.electronAPI.openExternal(defaultPage.url);
      }

      // Feedback visual
      setCopiedSection(section.index);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (error) {
      console.error('Error copying section:', error);
      alert(t('spellCheck.errorCopying'));
    }
  };

  /**
   * Maneja el cambio de tamaño de sección.
   * @param {number} newSize - Nuevo tamaño en caracteres
   */
  const handleSectionSizeChange = (newSize) => {
    setSectionSize(newSize);
    localStorage.setItem('bg_spellcheck_section_size', newSize.toString());
    divideTextIntoSections(text, newSize);
  };

  /**
   * Guarda las páginas de corrección en localStorage.
   */
  const saveSpellcheckPages = () => {
    localStorage.setItem('bg_spellcheck_pages', JSON.stringify(spellcheckPages));
    setDefaultPage(spellcheckPages.find(p => p.default) || spellcheckPages[0]);
    setShowPagesManager(false);
  };

  /**
   * Añade una nueva página de corrección.
   */
  const addNewPage = () => {
    setSpellcheckPages([...spellcheckPages, {
      name: t('spellCheck.newPage') || 'Nueva Página',
      url: 'https://',
      default: false
    }]);
  };

  /**
   * Actualiza un campo de una página.
   * @param {number} index - Índice de la página
   * @param {string} field - Campo a actualizar
   * @param {string} value - Nuevo valor
   */
  const updatePage = (index, field, value) => {
    const newPages = [...spellcheckPages];
    newPages[index] = { ...newPages[index], [field]: value };
    setSpellcheckPages(newPages);
  };

  /**
   * Elimina una página.
   * @param {number} index - Índice de la página a eliminar
   */
  const removePage = (index) => {
    if (spellcheckPages.length <= 1) {
      alert(t('spellCheck.minOnePage'));
      return;
    }
    const newPages = spellcheckPages.filter((_, i) => i !== index);
    // Si eliminamos el default, poner el primero como default
    if (!newPages.some(p => p.default)) {
      newPages[0].default = true;
    }
    setSpellcheckPages(newPages);
  };

  /**
   * Establece una página como predeterminada.
   * @param {number} index - Índice de la página
   */
  const setDefault = (index) => {
    const newPages = spellcheckPages.map((p, i) => ({
      ...p,
      default: i === index
    }));
    setSpellcheckPages(newPages);
  };

  // =============================================================================
  // RENDERIZADO: GESTOR DE PÁGINAS
  // =============================================================================

  if (showPagesManager) {
    return (
      <div className="modal open" onClick={(e) => e.target === e.currentTarget && setShowPagesManager(false)}>
        <div className="modal-content medium">
          <button className="close-btn" onClick={() => setShowPagesManager(false)}>
            <Icon path={mdiClose} size={0.7} />
          </button>

          <div className="modal-body">
            <div className="spellcheck-manager-header">
              <button className="btn-back" onClick={() => setShowPagesManager(false)}>
                <Icon path={mdiArrowLeft} size={0.7} /> Volver
              </button>
              <h2>Gestionar Páginas de Corrección</h2>
            </div>

            <div className="spellcheck-pages-list">
              {spellcheckPages.map((page, index) => (
                <div key={index} className={`spellcheck-page-row ${page.default ? 'default' : ''}`}>
                  <input
                    type="radio"
                    name="default-page"
                    checked={page.default}
                    onChange={() => setDefault(index)}
                    title="Establecer como predeterminada"
                  />
                  <div className="page-inputs">
                    <input
                      type="text"
                      value={page.name}
                      onChange={(e) => updatePage(index, 'name', e.target.value)}
                      placeholder="Nombre"
                    />
                    <input
                      type="url"
                      value={page.url}
                      onChange={(e) => updatePage(index, 'url', e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="page-actions">
                    {page.default && <span className="default-badge">Default</span>}
                    <button onClick={() => removePage(index)} title="Eliminar">
                      <Icon path={mdiTrashCan} size={0.7} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="spellcheck-manager-actions">
              <button onClick={addNewPage} className="btn-secondary">
                <Icon path={mdiPlus} size={0.7} /> Añadir Página
              </button>
              <button onClick={saveSpellcheckPages} className="btn-primary">
                <Icon path={mdiContentSave} size={0.7} /> Guardar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =============================================================================
  // RENDERIZADO PRINCIPAL
  // =============================================================================

  return ( 
    <div className="modal open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content medium">
        <button className="close-btn" onClick={onClose}>
          <Icon path={mdiClose} size={0.7} />
        </button>

        <div className="modal-body">
          {/* Cabecera */}
          <div className="spellcheck-header modern-header">
            <div className="spellcheck-title-group">
              <div className="spellcheck-icon-large">
                <Icon path={mdiSpellcheck} size={1.2} />
              </div>
              <div className="spellcheck-title-text">
                <h2>{t('spellCheck.title')}</h2>
                <p className="spellcheck-subtitle">
                  {text.length.toLocaleString()} {t('analytics.characters')} · {sections.length} {t('spellCheck.sections')}
                </p>
              </div>
            </div>
          </div>

          {/* Opciones */}
          <div className="spellcheck-options">
            <div className="option-group">
              <label>Tamaño de secciones:</label>
              <select
                value={sectionSize}
                onChange={(e) => handleSectionSizeChange(parseInt(e.target.value))}
              >
                <option value="3000">3,000 caracteres</option>
                <option value="5000">5,000 caracteres</option>
                <option value="10000">10,000 caracteres</option>
                <option value="15000">15,000 caracteres</option>
              </select>
            </div>

            <div className="option-group">
              <label>Página predeterminada:</label>
              <span className="default-page-name">{defaultPage?.name}</span>
              <button
                className="btn-link"
                onClick={() => setShowPagesManager(true)}
              >
                Gestionar páginas
              </button>
            </div>
          </div>

          {/* Grid de secciones */}
          <div className="spellcheck-grid modern-grid">
            {sections.map((section) => (
              <div key={section.index} className={`spell-card ${copiedSection === section.index ? 'active' : ''}`}>
                <div className="spell-card-info">
                  <div className="spell-card-index">#{section.index}</div>
                  <div className="spell-card-details">
                    <span>{section.end - section.start} {t('analytics.characters')}</span>
                  </div>
                </div>
                <button
                  className={`btn-spell-action ${copiedSection === section.index ? 'success' : ''}`}
                  onClick={() => handleCopySection(section)}
                  title={`Copiar y abrir en ${defaultPage?.name}`}
                >
                  {copiedSection === section.index ? (
                    <><Icon path={mdiCheck} size={0.7} /> {t('common.copied')}</>
                  ) : (
                    <><Icon path={mdiOpenInNew} size={0.7} /></>
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="spellcheck-footer">
            <button onClick={onClose} className="btn-secondary">
              <Icon path={mdiClose} size={0.7} /> Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SpellCheckModal;
