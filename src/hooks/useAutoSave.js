/**
 * ============================================================================
 * HOOK: useAutoSave
 * ============================================================================
 * 
 * Hook personalizado para gestionar el guardado automático de archivos.
 * 
 * FUNCIONALIDADES:
 * - Guardado automático cada X segundos
 * - Indicador visual de "guardando"
 * - Sincronización con filesystem
 * - Persistencia en localStorage
 * - Manejo de errores
 * 
 * USO:
 * const { isSaving, saveFile, startAutoSave, stopAutoSave } = useAutoSave(
 *   activeFile,
 *   editorContent,
 *   config,
 *   12 // intervalos en segundos
 * );
 * 
 * @param {Object} activeFile - Archivo activo
 * @param {string} content - Contenido actual del editor
 * @param {Object} config - Configuración de la app
 * @param {number} intervalSeconds - Intervalo en segundos (default: 30)
 * @param {function} onNotify - Función para notificaciones
 * 
 * @returns {Object} { isSaving, saveFile, startAutoSave, stopAutoSave, lastSaved }
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export function useAutoSave(
  activeFile,
  content,
  config,
  intervalSeconds = 30,
  onNotify = () => { }
) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(new Date());
  const autosaveTimerRef = useRef(null);
  const lastContentRef = useRef(content);
  const lastCommentsRef = useRef(activeFile?.comments || []);

  /**
   * Guarda el archivo actual.
   */
  const saveFile = useCallback(async (showNotification = false) => {
    if (!activeFile || !content) return;

    setIsSaving(true);

    try {
      // Guardar en localStorage como caché
      const cache = JSON.parse(localStorage.getItem('blockguard_cache') || '{}');
      cache[activeFile.fullPath] = {
        content,
        timestamp: new Date().toISOString(),
        status: activeFile.status || 'initial'
      };
      localStorage.setItem('blockguard_cache', JSON.stringify(cache));

      // Intentar guardar en filesystem via Electron API
      if (window.electronAPI && activeFile.fullPath) {
        await window.electronAPI.saveFile(
          activeFile.fullPath,
          content,
          {
            status: activeFile.status,
            goal: activeFile.goal,
            lastCharCount: activeFile.lastCharCount,
            comments: activeFile.comments
          }
        );
      }

      setLastSaved(new Date());
      setLastSaved(new Date());
      lastContentRef.current = content;
      lastCommentsRef.current = activeFile.comments || [];

      if (showNotification) {
        onNotify('Archivo guardado correctamente', 'success');
      }

      return true;
    } catch (error) {
      console.error('Error saving file:', error);
      onNotify('Error al guardar el archivo', 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [activeFile, content, onNotify]);

  /**
   * Inicia el auto-guardado.
   */
  const startAutoSave = useCallback(() => {
    if (autosaveTimerRef.current) return; // Ya está activo

    autosaveTimerRef.current = setInterval(() => {
      const commentsChanged = JSON.stringify(activeFile?.comments || []) !== JSON.stringify(lastCommentsRef.current || []);
      if (activeFile && (content !== lastContentRef.current || commentsChanged)) {
        saveFile(false);
      }
    }, intervalSeconds * 1000);
  }, [activeFile, content, saveFile, intervalSeconds]);

  /**
   * Detiene el auto-guardado.
   */
  const stopAutoSave = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearInterval(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);

  /**
   * Efecto: Iniciar auto-guardado cuando hay archivo activo.
   */
  useEffect(() => {
    if (activeFile) {
      startAutoSave();
    }

    return () => {
      stopAutoSave();
    };
  }, [activeFile, startAutoSave, stopAutoSave]);

  /**
   * Efecto: Guardar cuando el contenido cambia sin auto-guardado activo.
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeFile && content !== lastContentRef.current) {
        lastContentRef.current = content;
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [content, activeFile]);

  return {
    isSaving,
    saveFile,
    startAutoSave,
    stopAutoSave,
    lastSaved
  };
}

export default useAutoSave;
