/**
 * ============================================================================
 *  TOPBAR.JS
 * ============================================================================
 * 
 * COMPONENTE: BARRA SUPERIOR (TOP BAR)
 * 
 * Muestra la navegación breadcrumb y los botones de acción del editor.
 * 
 * FUNCIONALIDADES:
 * - Breadcrumb de navegación (Inicio > Proyecto > Archivo)
 * - Botón para mostrar/ocultar sidebar
 * - Botón de guardar
 * - Botón de corrector ortográfico
 * - Indicador de cambios sin guardar
 * - Atajos dinámicos sincronizados con configuración central
 * 
 * PROPS:
 * - activeFile: Object - Archivo actualmente abierto
 * - activeProjectIndex: number - Índice del proyecto activo
 * - projects: Array - Lista de proyectos
 * - onCloseFile: function - Callback al cerrar el archivo
 * - onSaveFile: function - Callback al guardar
 * - onSpellCheck: function - Callback al abrir corrector
 * - onToggleSidebar: function - Callback para mostrar/ocultar sidebar
 * - sidebarCollapsed: boolean - Estado del sidebar
 * - hasChanges: boolean - Si hay cambios sin guardar
 * 
 * RELACIONADO CON:
 * - src/App.js: Gestiona el estado y pasa datos/props
 * - src/styles/index.css: Estilos de .top-bar
 * - src/utils/shortcuts.js: Sistema centralizado de atajos
 * ============================================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import { subscribeToShortcutChanges, getShortcutTitle } from '../utils/shortcuts';
import { useTranslation } from '../utils/i18n';
import { exportAsMarkdown, exportAsHTML, exportAsPlainText } from '../utils/exporters';
import TabBar from './TabBar';
import Icon from '@mdi/react';
import * as mdi from '@mdi/js';
const { 
  mdiPageLayoutSidebarLeft, 
  mdiHome, 
  mdiChevronRight, 
  mdiLoading,
  mdiDownload,
  mdiFileDocumentOutline,
  mdiLanguageMarkdown,
  mdiFileDocument,
  mdiFileWord,
  mdiSpellcheck,
  mdiContentSave
} = mdi;

function TopBar({
  activeFile,
  activeFooterFile,
  activeProjectIndex,
  projects,
  onCloseFile,
  onSaveFile,
  onSpellCheck,
  onToggleSidebar,
  sidebarCollapsed,
  hasChanges,
  isSaving,
  onViewProject,
  // Tab system props
  openTabs,
  activeTabIndex,
  onTabClick,
  onTabClose,
  onTabReorder,
  onSplitHorizontal,
  splitMode,
  leftPanelFile,
  rightPanelFile,
  onCloseSplit,
  onDisableSplit,
  onRestoreSplit,
  lastClosedSplit,
  splitViewState,
  fileIcons
}) {
  const { t } = useTranslation();

  // In split mode, use activeFooterFile (which tracks the active panel).
  // In normal mode, use activeFile.
  const displayFile = activeFooterFile || activeFile;

  // Estado para rerender cuando cambian los atajos
  const [shortcuts, setShortcuts] = useState({});

  // Estado para el dropdown de exportación
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const exportDropdownRef = useRef(null);

  // Suscribirse a cambios en los atajos
  useEffect(() => {
    const unsubscribe = subscribeToShortcutChanges((updatedShortcuts) => {
      setShortcuts(updatedShortcuts);
    });

    return unsubscribe;
  }, []);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target)) {
        setShowExportDropdown(false);
      }
    };

    if (showExportDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportDropdown]);

  /**
   * Maneja la exportación del documento en el formato especificado.
   * @param {string} format - Formato de exportación: 'markdown', 'html', 'plaintext'
   */
  const handleExport = (format) => {
    if (!activeFile) return;

    // Obtener el contenido del editor
    const editorContent = activeFile.content || '';

    // Obtener el nombre base del archivo (sin extensión .txt o .canvas)
    const fileName = activeFile.name.replace(/\.(txt|canvas)$/i, '');

    // Exportar según el formato seleccionado
    switch (format) {
      case 'markdown':
        exportAsMarkdown(editorContent, fileName);
        break;
      case 'html':
        exportAsHTML(editorContent, fileName);
        break;
      case 'plaintext':
        exportAsPlainText(editorContent, fileName);
        break;
      case 'docx':
        // Exportar como HTML con extensión .doc (compatible con Word)
        const htmlContent = `\u003c!DOCTYPE html\u003e
\u003chtml\u003e
\u003chead\u003e
  \u003cmeta charset="UTF-8"\u003e
  \u003cmeta name="ProgId" content="Word.Document"\u003e
  \u003c/head\u003e
\u003cbody\u003e${editorContent}\u003c/body\u003e
\u003c/html\u003e`;
        const blob = new Blob([htmlContent], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.doc`;
        document.body.appendChild(link);
        link.click();
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        URL.revokeObjectURL(url);
        break;
      default:
        console.warn(t('topbar.exportFormatNotRecognized') || 'Formato de exportación no reconocido:', format);
    }

    // Cerrar el dropdown
    setShowExportDropdown(false);
  };

  /**
   * Genera el breadcrumb de navegación según el estado actual.
   * @returns {JSX.Element} Elementos del breadcrumb
   */
  const getBreadcrumb = () => {
    // Si no hay archivo abierto, mostrar solo "Inicio"
    if (!activeFile) {
      return (
        <>
          {/* Botón para mostrar sidebar si está colapsado */}
          {sidebarCollapsed && (
            <button
              className="show-sidebar-btn"
              onClick={onToggleSidebar}
              title={getShortcutTitle('toggleSidebar')}
            >
              <Icon path={mdiPageLayoutSidebarLeft} size={0.8} />
            </button>
          )}
          <span className="breadcrumb-item" onClick={onCloseFile}>
            <Icon path={mdiHome} size={0.7} /> {t('sidebar.home')}
          </span>
        </>
      );
    }

    // Obtener el proyecto del archivo activo
    const project = activeProjectIndex >= 0 && projects ? projects[activeProjectIndex] : null;

    // Si no hay proyecto, el archivo está en root
    if (!project || activeProjectIndex === null) {
      return (
        <>
          {/* Botón para mostrar sidebar */}
          {sidebarCollapsed && (
            <button
              className="show-sidebar-btn"
              onClick={onToggleSidebar}
              title={getShortcutTitle('toggleSidebar')}
            >
              <Icon path={mdiPageLayoutSidebarLeft} size={0.8} />
            </button>
          )}

          {/* Inicio */}
          <span className="breadcrumb-item" onClick={onCloseFile}>
            <Icon path={mdiHome} size={0.7} />
          </span>

          {/* Separador */}
          <span className="breadcrumb-separator">
            <Icon path={mdiChevronRight} size={0.6} />
          </span>

          {/* Root / Archivos Sueltos */}
          <span className="breadcrumb-item">
            {t('sidebar.looseFiles') || 'Archivos Sueltos'}
          </span>

          {/* Separador */}
          <span className="breadcrumb-separator">
            <Icon path={mdiChevronRight} size={0.6} />
          </span>

          {/* Nombre del archivo (activo) */}
          <span className="breadcrumb-item active">
            {activeFile.name.replace('.txt', '')}
            {/* Indicador de cambios sin guardar */}
            {hasChanges && !isSaving && <span className="unsaved-indicator" title="Cambios sin guardar"></span>}
            {/* Indicador de guardando */}
            {isSaving && <span className="saving-indicator" title="Guardando...">
              <Icon path={mdiLoading} size={0.6} spin={1} />
            </span>}
          </span>
        </>
      );
    }

    return (
      <>
        {/* Botón para mostrar sidebar */}
        {sidebarCollapsed && (
          <button
            className="show-sidebar-btn"
            onClick={onToggleSidebar}
            title={getShortcutTitle('toggleSidebar')}
          >
            <Icon path={mdiPageLayoutSidebarLeft} size={0.8} />
          </button>
        )}

        {/* Inicio */}
        <span className="breadcrumb-item" onClick={onCloseFile}>
          <Icon path={mdiHome} size={0.7} />
        </span>

        {/* Separador */}
        <span className="breadcrumb-separator">
          <Icon path={mdiChevronRight} size={0.6} />
        </span>

        {/* Nombre del proyecto (clickeable para ver estructura) */}
        <span
          className="breadcrumb-item clickeable"
          onClick={() => onViewProject && onViewProject(project)}
          title={getShortcutTitle('viewProject')}
        >
          {project?.name || 'Proyecto'}
        </span>

        {/* Separador */}
        <span className="breadcrumb-separator">
          <Icon path={mdiChevronRight} size={0.6} />
        </span>

        {/* Nombre del archivo (activo) */}
        <span className="breadcrumb-item active">
          {activeFile.name.replace(/\.(txt|canvas)$/i, '')}
          {/* Indicador de cambios sin guardar */}
          {hasChanges && !isSaving && <span className="unsaved-indicator" title="Cambios sin guardar"></span>}
          {/* Indicador de guardando */}
          {isSaving && <span className="saving-indicator" title="Guardando...">
            <Icon path={mdiLoading} size={0.6} spin={1} />
          </span>}
        </span>
      </>
    );
  };

  return (
    <header className="top-bar">
      {/* Sistema de pestañas integrado */}
      <div className="top-bar-tabs">
        {/* Botón sidebar si está colapsado */}
        {sidebarCollapsed && (
          <button
            className="show-sidebar-btn"
            onClick={onToggleSidebar}
            title={getShortcutTitle('toggleSidebar')}
          >
            <Icon path={mdiPageLayoutSidebarLeft} size={0.8} />
          </button>
        )}

        {/* TabBar o pestaña "Inicio" */}
        {openTabs && openTabs.length > 0 ? (
          <TabBar
            tabs={openTabs}
            activeTabIndex={activeTabIndex}
            onTabClick={onTabClick}
            onTabClose={onTabClose}
            onTabReorder={onTabReorder}
            onSplitHorizontal={onSplitHorizontal}
            splitMode={splitMode}
            leftPanelFile={leftPanelFile}
            rightPanelFile={rightPanelFile}
            activeFile={activeFile}
            onCloseSplit={onCloseSplit}
            onDisableSplit={onDisableSplit}
            onRestoreSplit={onRestoreSplit}
            splitViewState={splitViewState}
            fileIcons={fileIcons}
          />
        ) : (
          <div className="home-tab">
            <Icon path={mdiHome} size={0.7} />
            <span>{t('sidebar.home')}</span>
          </div>
        )}
      </div>

      {/* Botones de acción */}
      <div className="editor-actions">
        {/* Se eliminó el botón explícito de restaurar split para evitar ruido visual */}

        {/* Botón de exportar - Solo para archivos .txt, no para .canvas */}
        {displayFile && !activeFile?.fullPath?.toLowerCase().endsWith('.canvas') && (
          <div className="export-dropdown-container" ref={exportDropdownRef}>
            <button
              className="btn-icon"
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              title={t('topbar.exportDocument')}
            >
              <Icon path={mdiDownload} size={0.8} />
            </button>

            {/* Dropdown menu */}
            {showExportDropdown && (
              <div className="export-dropdown">
                <button
                  className="export-option"
                  onClick={() => handleExport('markdown')}
                >
                  <Icon path={mdiLanguageMarkdown} size={0.8} />
                  <span>{t('topbar.exportMarkdown')}</span>
                </button>
                <button
                  className="export-option"
                  onClick={() => handleExport('html')}
                >
                  <Icon path={mdiFileDocumentOutline} size={0.8} />
                  <span>{t('topbar.exportHTML')}</span>
                </button>
                <button
                  className="export-option"
                  onClick={() => handleExport('plaintext')}
                >
                  <Icon path={mdiFileDocument} size={0.8} />
                  <span>{t('topbar.exportPlainText')}</span>
                </button>
                <button
                  className="export-option"
                  onClick={() => handleExport('docx')}
                >
                  <Icon path={mdiFileWord} size={0.8} />
                  <span>{t('topbar.exportDOCX')}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Botón de corrector ortográfico */}
        {displayFile && !displayFile.fullPath?.toLowerCase().endsWith('.canvas') && (
          <button
            className="btn-icon"
            onClick={onSpellCheck}
            title={getShortcutTitle('spellCheck')}
          >
            <Icon path={mdiSpellcheck} size={0.8} />
          </button>
        )}

        {/* Botón de guardar */}
        {displayFile && (
          <button
            className={`btn-primary-small ${isSaving ? 'saving' : ''}`}
            onClick={onSaveFile}
            disabled={isSaving || !hasChanges}
            title={getShortcutTitle('save')}
          >
            {isSaving ? (
              <>
                <Icon path={mdiLoading} size={0.7} spin={1} />
                <span>{t('topbar.saving')}</span>
              </>
            ) : (
              <>
                <Icon path={mdiContentSave} size={0.7} />
                <span>{t('topbar.save')}</span>
              </>
            )}
          </button>
        )}
      </div>
    </header>
  );
}

export default TopBar;
