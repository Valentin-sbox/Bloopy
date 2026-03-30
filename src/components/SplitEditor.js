/**
 * ============================================================================
 * SPLIT EDITOR COMPONENT
 * ============================================================================
 * 
 * Contenedor para vista dividida del editor
 * Permite ver y editar dos archivos simultáneamente
 * ============================================================================
 */

import React, { useState, useRef, useEffect } from 'react';
import { useCallback, useMemo } from 'react';
import Editor from './LexicalEditor';
import FileSelector from './FileSelector';
import CommentsSidebar from './CommentsSidebar';
import EditorSidebar, { SpecialCharsPanel } from './EditorSidebar';
import '../styles/split-editor.css';

const SplitEditor = ({
  splitMode,
  leftFile,
  rightFile,
  leftContent,
  rightContent,
  onLeftChange,
  onRightChange,
  onLeftFileSelect,
  onRightFileSelect,
  onCreateSubFile,
  onOpenSubFile,
  onAddComment,
  onDeleteComment,
  onSetFileIcon,
  onSpellCheck,
  projects,
  activeProjectIndex,
  config,
  editorRefLeft,
  editorRefRight,
  activePanelSide = 'left',
  onPanelClick,
  fileIcons,
  onNotify,
  activeRightPanel,
  setActiveRightPanel
}) => {
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const [dividerPosition, setDividerPosition] = useState(50);
  const dividerRef = useRef(null);

  const handleDividerMove = useCallback((pos) => {
    setDividerPosition(pos);
    localStorage.setItem('bloopy.dividerPosition', pos);
  }, []);

  // Cargar posición guardada al montar
  useEffect(() => {
    try {
      const saved = localStorage.getItem('bloopy.dividerPosition');
      if (saved) {
        setDividerPosition(parseFloat(saved));
      }
    } catch (error) {
      console.error('[DIVIDER] Error cargando posición:', error);
    }
  }, []);

  // Manejar inicio de drag
  const handleDividerMouseDown = (e) => {
    e.preventDefault();
    setIsDraggingDivider(true);
  };

  // Manejar doble click para resetear
  const handleDividerDoubleClick = () => {
    setDividerPosition(50);
    try {
      localStorage.setItem('bloopy.dividerPosition', '50');
    } catch (error) {
      console.error('[DIVIDER] Error guardando posición:', error);
    }
  };

  // Manejar drag del divider
  useEffect(() => {
    if (!isDraggingDivider) return;

    const handleMouseMove = (e) => {
      const container = dividerRef.current?.parentElement;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      let newPosition;

      if (splitMode === 'vertical') {
        // Vertical: calcular basado en Y
        newPosition = ((e.clientY - rect.top) / rect.height) * 100;
      } else {
        // Horizontal: calcular basado en X
        newPosition = ((e.clientX - rect.left) / rect.width) * 100;
      }

      // Limitar entre 20% y 80%
      newPosition = Math.max(20, Math.min(80, newPosition));
      setDividerPosition(newPosition);
    };

    const handleMouseUp = () => {
      setIsDraggingDivider(false);
      // Guardar posición en localStorage
      try {
        localStorage.setItem('bloopy.dividerPosition', dividerPosition.toString());
      } catch (error) {
        console.error('[DIVIDER] Error guardando posición:', error);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingDivider, splitMode, dividerPosition]);

  // Lógica de compresión ELIMINADA para que ambos paneles sean siempre visibles
  const activeFile = activePanelSide === 'left' ? leftFile : rightFile;
  const activeContent = activePanelSide === 'left' ? leftContent : rightContent;
  const activeEditorRef = activePanelSide === 'left' ? editorRefLeft : editorRefRight;

  return (
    <div className={`split-editor-outer ${activeRightPanel ? 'has-right-panel' : ''}`}>
      <div className={`split-editor-layout ${splitMode === 'vertical' ? 'vertical' : 'horizontal'}`}>
        <div className={`split-editor ${splitMode === 'vertical' ? 'vertical' : 'horizontal'}`}>
          {/* PANEL IZQUIERDO */}
          <div
            className={`split-panel left-panel ${activePanelSide === 'left' ? 'active-panel' : 'inactive-panel'}`}
            onClick={() => {
              if (activePanelSide !== 'left' && onPanelClick) {
                onPanelClick('left');
              }
            }}
            style={splitMode === 'vertical' 
              ? { height: `${dividerPosition}%` }
              : { width: `${dividerPosition}%` }
            }
          >
            {leftFile ? (
              <Editor
                ref={editorRefLeft}
                content={leftContent}
                onChange={onLeftChange}
                activeFile={leftFile}
                onOpenComments={() => setActiveRightPanel('comments')}
                onSetFileIcon={onSetFileIcon}
                onSpellCheck={onSpellCheck}
                config={config}
                showSidebar={false}
                activeRightPanel={activePanelSide === 'left' ? activeRightPanel : null}
                setActiveRightPanel={setActiveRightPanel}
                onToggleSpecialChars={() => setActiveRightPanel(prev => prev === 'specialChars' ? null : 'specialChars')}
              />
            ) : (
              <FileSelector
                projects={projects}
                activeProjectIndex={activeProjectIndex}
                onFileSelect={(file) => {
                  if (file.fullPath && file.fullPath.toLowerCase().endsWith('.canvas')) {
                    if (onNotify) onNotify('Los archivos .canvas no soportan vista dividida', 'warning');
                    return;
                  }
                  if (rightFile && file.fullPath === rightFile.fullPath) return;
                  onLeftFileSelect(file);
                }}
                title="Selecciona un archivo para el panel izquierdo"
                showSubFiles={true}
                fileIcons={fileIcons}
              />
            )}
          </div>

          {/* DIVISOR */}
          <div 
            ref={dividerRef}
            className={`split-divider ${isDraggingDivider ? 'dragging' : ''}`}
            onMouseDown={handleDividerMouseDown}
            onDoubleClick={handleDividerDoubleClick}
            style={{ cursor: splitMode === 'vertical' ? 'row-resize' : 'col-resize' }}
          ></div>

          {/* PANEL DERECHO */}
          <div
            className={`split-panel right-panel ${activePanelSide === 'right' ? 'active-panel' : 'inactive-panel'}`}
            onClick={() => {
              if (activePanelSide !== 'right' && onPanelClick) {
                onPanelClick('right');
              }
            }}
            style={splitMode === 'vertical'
              ? { height: `${100 - dividerPosition}%` }
              : { width: `${100 - dividerPosition}%` }
            }
          >
            {rightFile ? (
              <Editor
                ref={editorRefRight}
                content={rightContent}
                onChange={onRightChange}
                activeFile={rightFile}
                onOpenComments={() => setActiveRightPanel('comments')}
                onSetFileIcon={onSetFileIcon}
                onSpellCheck={onSpellCheck}
                config={config}
                showSidebar={false}
                activeRightPanel={activePanelSide === 'right' ? activeRightPanel : null}
                setActiveRightPanel={setActiveRightPanel}
                onToggleSpecialChars={() => setActiveRightPanel(prev => prev === 'specialChars' ? null : 'specialChars')}
              />
            ) : (
              <FileSelector
                projects={projects}
                activeProjectIndex={activeProjectIndex}
                onFileSelect={(file) => {
                  if (file.fullPath && file.fullPath.toLowerCase().endsWith('.canvas')) {
                    if (onNotify) onNotify('Los archivos .canvas no soportan vista dividida', 'warning');
                    return;
                  }
                  if (leftFile && file.fullPath === leftFile.fullPath) return;
                  onRightFileSelect(file);
                }}
                title="Selecciona un archivo para el panel derecho"
                showSubFiles={true}
                fileIcons={fileIcons}
              />
            )}
          </div>
        </div>
        
        {/* SIDEBAR DE HERRAMIENTAS Y PANELES DERECHOS (Solo para el panel activo) */}
        {activeFile && (
          <div className="split-right-panels-container">
            {activeRightPanel === 'comments' && (
              <div className="editor-panel-overlay split-panel-overlay">
                <CommentsSidebar
                  comments={activeFile?.comments || []}
                  fileName={activeFile?.name}
                  onClose={() => setActiveRightPanel(null)}
                  isSplitView={true}
                  onAddComment={(text) => onAddComment(activeFile, text)}
                  onDeleteComment={(commentId) => onDeleteComment(activeFile, commentId)}
                />
              </div>
            )}

            {activeRightPanel === 'specialChars' && (
              <div className="editor-panel-overlay split-panel-overlay">
                <SpecialCharsPanel
                  onClose={() => setActiveRightPanel(null)}
                  onInsertText={(text) => {
                    if (activeEditorRef && typeof activeEditorRef !== 'function' && activeEditorRef.current?.insertText) {
                      activeEditorRef.current.insertText(text);
                    }
                  }}
                />
              </div>
            )}

            <EditorSidebar
              activeFile={activeFile}
              editorContent={activeContent || ''}
              onOpenComments={() => setActiveRightPanel(prev => prev === 'comments' ? null : 'comments')}
              activeRightPanel={activeRightPanel}
              onToggleSpecialChars={() => setActiveRightPanel(prev => prev === 'specialChars' ? null : 'specialChars')}
              isSplitView={true}
              onInsertText={(text) => {
                if (activeEditorRef && typeof activeEditorRef !== 'function' && activeEditorRef.current?.insertText) {
                  activeEditorRef.current.insertText(text);
                }
              }}
              commentCount={activeFile.comments?.length || 0}
              config={config}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default SplitEditor;
