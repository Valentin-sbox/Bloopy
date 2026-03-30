/**
 * ============================================================================
 *  SUBFILESFOOTER.JS
 * ============================================================================
 * 
 * COMPONENTE: FOOTER DE SUB-ARCHIVOS
 * 
 * Muestra la lista de sub-archivos del archivo activo en el footer del editor,
 * fuera del área de texto editable.
 * 
 * FUNCIONALIDADES:
 * - Mostrar lista de sub-archivos en formato de tarjetas
 * - Botón para crear nuevo sub-archivo
 * - Click en tarjeta para abrir sub-archivo en nueva pestaña
 * - Indicador de cantidad de sub-archivos
 * 
 * PROPS:
 * - activeFile: Object - Archivo actualmente abierto
 * - onCreateSubFile: function - Callback para crear sub-archivo
 * - onOpenSubFile: function - Callback para abrir sub-archivo en pestaña
 * 
 * RELACIONADO CON:
 * - src/components/Editor.js: Integra este componente
 * - src/App.js: Gestiona el estado de archivos
 * ============================================================================
 */

import React from 'react';
import { useTranslation } from '../utils/i18n';
import Icon from '@mdi/react';
import { mdiLayers, mdiPlus, mdiFileDocumentOutline } from '@mdi/js';

function SubFilesFooter({ activeFile, onCreateSubFile, onOpenSubFile }) {
  const { t } = useTranslation();
  
  // Si no hay archivo activo o no tiene subarchivos, no mostrar nada
  if (!activeFile) {
    return null;
  }
  
  // Obtener subarchivos desde items (nuevo sistema) o subFiles (legacy)
  const subFiles = activeFile.items || activeFile.subFiles || [];
  
  if (subFiles.length === 0) {
    return null;
  }
  
  return (
    <div className="subfiles-footer">
      <div className="subfiles-header">
        <h4>
          <Icon path={mdiLayers} size={0.7} />
          {t('editor.subFiles')} ({subFiles.length})
        </h4>
        <button 
          className="btn-add-subfile" 
          onClick={onCreateSubFile}
          title={t('sidebar.newFile')}
        >
          <Icon path={mdiPlus} size={0.6} />
          <span>{t('common.add')}</span>
        </button>
      </div>
      
      <div className="subfiles-grid">
        {subFiles.map((subFile, index) => {
          // Calcular progreso
          const charCount = subFile.lastCharCount || 0;
          const goal = subFile.goal || 30000;
          const progress = Math.min(100, (charCount / goal) * 100);
          
          return (
            <div 
              key={subFile.id || subFile.subFileId || index}
              className="subfile-card"
              onClick={() => onOpenSubFile && onOpenSubFile(subFile)}
              title={`Click para abrir en nueva pestaña\n${charCount} / ${goal} caracteres (${progress.toFixed(0)}%)`}
            >
              <div className="subfile-card-header">
                <Icon path={mdiFileDocumentOutline} size={0.7} />
                <span className="subfile-name">
                  {subFile.name.replace(/\.(txt|canvas)$/i, '')}
                </span>
              </div>
              
              <div className="subfile-card-body">
                <div className="subfile-progress-bar">
                  <div 
                    className="subfile-progress-fill"
                    style={{ 
                      width: `${progress}%`,
                      backgroundColor: subFile.status === 'draft' ? '#ff3b30' : 
                                     subFile.status === 'review' ? '#ff9500' : '#34c759'
                    }}
                  ></div>
                </div>
                <div className="subfile-stats">
                  <span>{charCount.toLocaleString()} caracteres</span>
                  <span className="subfile-progress-percent">{progress.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SubFilesFooter;
