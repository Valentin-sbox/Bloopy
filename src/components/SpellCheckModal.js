/**
 * ============================================================================
 * BLOCK GUARD v4.0.0 - SPELLCHECKMODAL.JS
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

function SpellCheckModal({ text, onClose, config }) {
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
    // Cargar páginas guardadas en localStorage
    const savedPages = localStorage.getItem('bg_spellcheck_pages');
    let pages;
    if (savedPages) {
      try {
        pages = JSON.parse(savedPages);
      } catch (e) {
        pages = getDefaultPages();
      }
    } else {
      pages = getDefaultPages();
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
  }, [text]);
  
  // =============================================================================
  // FUNCIONES AUXILIARES
  // =============================================================================
  
  /**
   * Obtiene las páginas de corrección por defecto.
   * @returns {Array} Lista de páginas predefinidas
   */
  const getDefaultPages = () => [
    { name: 'LanguageTool', url: 'https://languagetool.org/es', default: true },
    { name: 'Corrector.co', url: 'https://www.corrector.co/', default: false },
    { name: 'DeepL Write', url: 'https://www.deepl.com/write', default: false }
  ];
  
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
      alert('Error al copiar al portapapeles');
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
      name: 'Nueva Página', 
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
      alert('Debe haber al menos una página');
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
            <i className="fas fa-times"></i>
          </button>
          
          <div className="modal-body">
            <div className="spellcheck-manager-header">
              <button className="btn-back" onClick={() => setShowPagesManager(false)}>
                <i className="fas fa-arrow-left"></i> Volver
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
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="spellcheck-manager-actions">
              <button onClick={addNewPage} className="btn-secondary">
                <i className="fas fa-plus"></i> Añadir Página
              </button>
              <button onClick={saveSpellcheckPages} className="btn-primary">
                <i className="fas fa-save"></i> Guardar
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
          <i className="fas fa-times"></i>
        </button>
        
        <div className="modal-body">
          {/* Cabecera */}
          <div className="spellcheck-header">
            <div className="spellcheck-title">
              <i className="fas fa-spell-check"></i>
              <h2>Revisión Ortográfica</h2>
            </div>
            <p className="spellcheck-stats">
              {text.length.toLocaleString()} caracteres · {sections.length} secciones
            </p>
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
          <div className="spell-sections-grid">
            {sections.map((section) => (
              <div key={section.index} className="spell-section compact">
                <div className="spell-section-info">
                  <span className="spell-section-number">#{section.index}</span>
                  <span className="spell-section-chars">
                    {section.end - section.start} chars
                  </span>
                </div>
                <button 
                  className={`btn-copy-section compact ${copiedSection === section.index ? 'copied' : ''}`}
                  onClick={() => handleCopySection(section)}
                  title={`Copiar y abrir en ${defaultPage?.name}`}
                >
                  {copiedSection === section.index ? (
                    <><i className="fas fa-check"></i> Copiado</>
                  ) : (
                    <><i className="fas fa-external-link-alt"></i> Revisar</>
                  )}
                </button>
              </div>
            ))}
          </div>
          
          {/* Footer */}
          <div className="spellcheck-footer">
            <button onClick={onClose} className="btn-secondary">
              <i className="fas fa-times"></i> Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SpellCheckModal;
