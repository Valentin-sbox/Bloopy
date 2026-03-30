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
 * @param {Object} contentHashManager - Manager para hashes de contenido
 * @param {Object} saveTracker - Tracker para operaciones de guardado
 * 
 * @returns {Object} { isSaving, saveFile, startAutoSave, stopAutoSave, lastSaved }
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { saveFileWithHierarchyCheck } from '../utils/fileOperations';

export function useAutoSave(
  openTabs = [],
  config,
  intervalSeconds = 30,
  onNotify = () => { },
  contentHashManager,
  saveTracker
) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(new Date());
  const autosaveTimerRef = useRef(null);
  const cooldownRef = useRef(false);

  /**
   * Guarda todos los archivos abiertos con cambios.
   */
  const saveOpenTabs = useCallback(async (showNotification = false) => {
    if (!openTabs || openTabs.length === 0) return;
    if (cooldownRef.current) {
      console.log('[SAVE-CYCLE] useAutoSave in cooldown, skipping save');
      return;
    }
    setIsSaving(true);
    cooldownRef.current = true;
    let savedCount = 0;
    try {
      for (const tab of openTabs) {
        if (!tab.hasChanges || !tab.fullPath || !tab.content) continue;
        // Check hash
        if (contentHashManager && tab.fullPath) {
          const hasChanged = contentHashManager.hasChanged(tab.fullPath, tab.content);
          if (!hasChanged) continue;
        }
        // Guardar en localStorage como caché
        const cache = JSON.parse(localStorage.getItem('Bloopy_cache') || '{}');
        cache[tab.fullPath] = {
          content: tab.content,
          timestamp: new Date().toISOString(),
          status: tab.status || 'initial',
          hash: contentHashManager ? contentHashManager.updateHash(tab.fullPath, tab.content) : ''
        };
        localStorage.setItem('Bloopy_cache', JSON.stringify(cache));
        // Guardar archivo
        if (window.electronAPI && window.electronAPI.saveFile) {
          await window.electronAPI.saveFile(
            tab.fullPath,
            tab.content,
            {
              status: tab.status,
              goal: tab.goal,
              lastCharCount: tab.content.length,
              comments: tab.comments
            }
          );
        } else if (window.electronAPI && tab.fullPath) {
          await saveFileWithHierarchyCheck(
            tab.fullPath,
            tab.content,
            {
              status: tab.status,
              goal: tab.goal,
              lastCharCount: tab.content.length,
              comments: tab.comments
            }
          );
        }
        savedCount++;
      }
      setLastSaved(new Date());
      if (showNotification && savedCount > 0) {
        onNotify(`${savedCount} archivo(s) guardado(s) correctamente`, 'success');
      }
      return true;
    } catch (error) {
      console.error('[SAVE-CYCLE] useAutoSave error saving open tabs:', error);
      onNotify('Error al guardar archivos', 'error');
      return false;
    } finally {
      setIsSaving(false);
      setTimeout(() => {
        cooldownRef.current = false;
      }, 1000);
    }
  }, [openTabs, onNotify, contentHashManager, saveTracker]);

  /**
   * Inicia el auto-guardado.
   */
  const startAutoSave = useCallback(() => {
    if (autosaveTimerRef.current) return; // Ya está activo
    autosaveTimerRef.current = setInterval(() => {
      if (openTabs && openTabs.length > 0) {
        saveOpenTabs(false);
      }
    }, intervalSeconds * 1000);
  }, [openTabs, saveOpenTabs, intervalSeconds]);

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
    if (openTabs && openTabs.length > 0) {
      startAutoSave();
    }
    return () => {
      stopAutoSave();
    };
  }, [openTabs, startAutoSave, stopAutoSave]);

  /**
   * Efecto: Guardar cuando el contenido cambia sin auto-guardado activo.
   */
  // Eliminado: ya no se requiere para múltiples archivos

  return {
    isSaving,
    saveOpenTabs,
    startAutoSave,
    stopAutoSave,
    lastSaved
  };
}

export default useAutoSave;
