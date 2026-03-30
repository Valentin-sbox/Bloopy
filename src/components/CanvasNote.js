/**
 * ============================================================================
 * CANVASNOTE.JS - Componente de Canvas con tldraw
 * ============================================================================
 * 
 * Componente para editar notas visuales usando tldraw (canvas infinito)
 * 
 * CARACTERÍSTICAS:
 * - Integración completa con tldraw
 * - Auto-guardado centralizado con useAutoSave hook (configurable)
 * - Carga y serialización de snapshots JSON
 * - Validación de estructura de snapshots
 * - Manejo de errores robusto
 * - Integración con sistema de temas
 * - Soporte para i18n
 * - Detección de cambios por hash
 * - Tracking de operaciones de guardado
 * 
 * PROPS:
 * - file: Object - Archivo activo con fullPath y content
 * - onContentChange: Function - Callback cuando el contenido cambia
 * - onSave: Function - Callback para guardar
 * - theme: Object - Tema actual de la aplicación
 * - language: String - Idioma actual
 * - config: Object - Configuración de la aplicación (para auto-guardado)
 * - onNotify: Function - Sistema de notificaciones
 * - contentHashManager: Object - Manager de hashes para detección de cambios
 * - saveTracker: Object - Tracker de operaciones de guardado
 * ============================================================================
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';
import { useTranslation } from '../utils/i18n';
import Icon from '@mdi/react';
import * as mdi from '@mdi/js';
const { mdiLoading, mdiAlert, mdiRedo, mdiCircle } = mdi;

/**
 * Valida la estructura del snapshot de tldraw
 * @param {object} snapshot - Snapshot a validar
 * @returns {boolean} - true si es válido, false si no
 */
const validateTldrawSnapshot = (snapshot) => {
  // Validar que snapshot existe y es un objeto
  if (!snapshot || typeof snapshot !== 'object') {
    console.error('[CANVAS] Snapshot inválido: no es un objeto');
    return false;
  }
  
  // Validar existencia de store (esencial para tldraw)
  // En algunas versiones/configuraciones, la estructura puede variar levemente,
  // pero store es el corazón de los datos.
  const hasStore = snapshot.store || (snapshot.document && snapshot.document.store);
  
  if (!hasStore) {
    console.error('[CANVAS] Snapshot inválido: falta store');
    return false;
  }
  
  console.log('[CANVAS] Snapshot validado correctamente');
  return true;
};

const CanvasNote = ({ 
  file, 
  onContentChange, 
  onSave, 
  theme, 
  language,
  config,
  onNotify,
  contentHashManager,
  saveTracker
}) => {
  const { t } = useTranslation();
  
  // Estados
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState(null);
  const [editorContent, setEditorContent] = useState('');
  
  // Referencias
  const editorRef = useRef(null);

  const lastLoadedPathRef = useRef(null);

  /**
   * Carga el snapshot desde el contenido del archivo
   */
  const loadSnapshot = useCallback(async () => {
    // Si ya cargamos este archivo y no ha cambiado la ruta, no recargar
    // Esto evita loops infinitos cuando App.js actualiza el contenido
    if (lastLoadedPathRef.current === file?.fullPath && !isLoading) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      lastLoadedPathRef.current = file?.fullPath;

      // Validación defensiva: verificar que file existe y tiene propiedades requeridas
      if (!file || !file.fullPath || typeof file.content === 'undefined') {
        console.warn('[CANVAS] Archivo no válido o sin contenido:', file);
        setError(t('canvas.errors.invalidFile') || 'Archivo no válido');
        setIsLoading(false);
        return;
      }

      let snapshot = null;

      if (file.content && file.content.trim()) {
        try {
          const parsed = JSON.parse(file.content);
          
          // Validar estructura del snapshot usando validateTldrawSnapshot
          if (parsed.tldrawSnapshot) {
            if (validateTldrawSnapshot(parsed.tldrawSnapshot)) {
              snapshot = parsed.tldrawSnapshot;
              console.log('[CANVAS] Snapshot cargado correctamente');
            } else {
              console.error('[CANVAS] Estructura de snapshot inválida');
              setError(t('canvas.errors.invalidStructure') || 'La estructura del canvas es inválida');
              
              // No mostrar confirm aquí, mejor fallar silenciosamente o dejar que el usuario decida
              snapshot = null;
            }
          } else {
            console.error('[CANVAS] Falta tldrawSnapshot en el archivo');
            snapshot = null;
          }
        } catch (parseError) {
          console.error('[CANVAS] Error parseando JSON:', parseError);
          setError(t('canvas.errors.invalidJSON') || 'El archivo contiene JSON inválido');
          snapshot = null;
        }
      }

      // Guardar snapshot inicial para cargar en el editor
      setInitialSnapshot(snapshot);
      setIsLoading(false);
    } catch (error) {
      console.error('[CANVAS] Error en loadSnapshot:', error);
      setError(t('canvas.errors.loadFailed') || 'Error al cargar el canvas');
      setIsLoading(false);
    }
  }, [file?.fullPath, file?.content, t, isLoading]);

  /**
   * Serializa el canvas actual a JSON
   */
  const serializeCanvas = useCallback(() => {
    if (!editorRef.current) return null;

    try {
      // Usar el editor para obtener el snapshot
      // Intentar tldraw v2 API: editor.getSnapshot() primero, luego fallback
      let snapshot = null;
      if (typeof editorRef.current.getSnapshot === 'function') {
        snapshot = editorRef.current.getSnapshot();
      } else if (editorRef.current.store && typeof editorRef.current.store.getSnapshot === 'function') {
        snapshot = editorRef.current.store.getSnapshot();
      }
      
      // Validación defensiva: verificar que snapshot existe
      if (!snapshot) {
        console.warn('[CANVAS] No se pudo obtener el snapshot del editor');
        return null;
      }
      
      const canvasData = {
        tldrawSnapshot: snapshot,
        metadata: {
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          version: '1.0'
        }
      };

      return JSON.stringify(canvasData, null, 2);
    } catch (error) {
      console.error('[CANVAS] Error serializando canvas:', error);
      return null;
    }
  }, []);

  /**
   * Maneja cambios en el editor
   */
  const handleChange = useCallback(() => {
    if (!editorRef.current) return;

    setHasUnsavedChanges(true);

    // Serializar y actualizar estado local
    const serialized = serializeCanvas();
    
    if (serialized) {
      // console.log('[CANVAS] Contenido actualizado, longitud:', serialized.length);
      setEditorContent(serialized);
      
      // COMUNICAR CAMBIOS AL APP.JS
      if (onContentChange) {
        onContentChange(serialized);
      }
    }
  }, [serializeCanvas, onContentChange]);

  /**
   * Aplica el tema de la aplicación al canvas
   */
  const applyTheme = useCallback(() => {
    if (!theme) return {};

    // Extraer colores del tema
    const isDark = theme.theme === 'dark' || 
                   (theme.customTheme && theme.customColors?.background?.startsWith('#1'));

    return {
      '--color-background': isDark ? '#1e1e1e' : '#ffffff',
      '--color-foreground': isDark ? '#ffffff' : '#000000',
      '--color-grid': isDark ? '#2a2a2a' : '#f0f0f0',
    };
  }, [theme]);

  // Cargar snapshot al montar o cuando cambia el archivo
  useEffect(() => {
    // Solo cargar si file existe y es un cambio de archivo real (basado en el path)
    if (file && file.fullPath) {
      if (lastLoadedPathRef.current !== file.fullPath) {
        console.log('[CANVAS] Cambió el archivo, cargando snapshot:', file.fullPath);
        loadSnapshot();
      }
    } else {
      console.warn('[CANVAS] useEffect: archivo no válido:', file);
      setIsLoading(false);
      setError(t('canvas.errors.invalidFile') || 'Archivo no válido');
    }
  }, [file?.fullPath, loadSnapshot, t]);

  // Suscribirse a cambios del editor cuando se monta
  const [editorInstance, setEditorInstance] = useState(null);

  useEffect(() => {
    if (!editorInstance) return;

    const unsubscribe = editorInstance.store.listen(() => {
      handleChange();
    }, { scope: 'document' });

    return () => {
      unsubscribe();
    };
  }, [editorInstance, handleChange]);

  // Renderizado de estados de carga y error
  if (isLoading) {
    return (
      <div className="canvas-note-container loading">
        <div className="canvas-loading">
          <Icon path={mdiLoading} size={1.2} spin={1} />
          <p>{t('common.loading') || 'Cargando...'}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="canvas-note-container error">
        <div className="canvas-error">
          <Icon path={mdiAlert} size={1.2} />
          <p>{error}</p>
          <button onClick={loadSnapshot} className="retry-button">
            <Icon path={mdiRedo} size={0.7} />
            {t('common.retry') || 'Reintentar'}
          </button>
        </div>
      </div>
    );
  }

  // Renderizado principal
  return (
    <div className="canvas-note-container">
      <div className="canvas-wrapper">
        <Tldraw
          snapshot={initialSnapshot}
          onMount={(editor) => {
            editorRef.current = editor;
            setEditorInstance(editor);
            console.log('[CANVAS] Editor montado');
            
            // Si hay snapshot inicial, cargarlo defensivamente
            if (initialSnapshot) {
              try {
                // Intentar tldraw v2 API: editor.loadSnapshot(snapshot)
                if (typeof editor.loadSnapshot === 'function') {
                  editor.loadSnapshot(initialSnapshot);
                  console.log('[CANVAS] Snapshot cargado via editor.loadSnapshot');
                } else if (editor.store && typeof editor.store.loadSnapshot === 'function') {
                  editor.store.loadSnapshot(initialSnapshot);
                  console.log('[CANVAS] Snapshot cargado via editor.store.loadSnapshot');
                } else {
                  console.warn('[CANVAS] No se encontró método para cargar snapshot en el editor');
                }
              } catch (loadError) {
                console.error('[CANVAS] Error cargando snapshot:', loadError);
              }
            }
          }}
        />
      </div>
      
      {hasUnsavedChanges && (
        <div className="canvas-unsaved-indicator">
          <Icon path={mdiCircle} size={0.5} />
          {t('canvas.unsavedChanges')}
        </div>
      )}
    </div>
  );
};

export default CanvasNote;
