/**
 * ============================================================================
 * HOOK: useKeyboardShortcuts
 * ============================================================================
 * 
 * Hook personalizado para gestionar atajos de teclado.
 * 
 * FUNCIONALIDADES:
 * - Registro dinámico de atajos
 * - Soporte para Ctrl+, Shift+, Alt+, Cmd+ (macOS)
 * - Configuración desde settings
 * - Persistencia de custom shortcuts
 * - Validación de conflictos
 * - Sincronización con sistema centralizado de atajos
 * 
 * USO:
 * useKeyboardShortcuts({
 *   'Ctrl+S': saveFile,
 *   'Ctrl+B': toggleBold,
 *   'Ctrl+Shift+C': toggleComments
 * }, [saveFile, toggleBold]);
 * 
 * O usar atajos por ID:
 * useShortcutAction('save', () => handleSaveFile());
 * @useShortcutAction('bold', () => executeFormat('bold'));
 * 
 * @param {Object} shortcuts - Mapa de shortcut -> callback (legacy)
 * @param {Array} dependencies - Dependencias para useEffect
 * @param {Object} config - Configuración de shortcuts (opcional)
 */

import { useEffect, useRef, useCallback } from 'react';
import {
  getAllShortcuts,
  getShortcutDisplay,
  registerShortcutCallback,
  subscribeToShortcutChanges
} from '../utils/shortcuts';

/**
 * Hook para ejecutar una acción cuando se presiona un atajo
 * @param {string} shortcutId - ID del atajo (ej: 'save')
 * @param {Function} callback - Función a ejecutar
 */
export function useShortcutAction(shortcutId, callback) {
  useEffect(() => {
    return registerShortcutCallback(shortcutId, callback);
  }, [shortcutId, callback]);
}

export function useKeyboardShortcuts(shortcuts = {}, dependencies = [], config = null) {
  // Cargar atajos desde el sistema centralizado
  const allShortcuts = useRef(getAllShortcuts());
  const shortcutsRef = useRef(shortcuts);
  const configRef = useRef(config);
  const shortcutCallbacksRef = useRef({});

  // Actualizar referencias cuando cambian
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Suscribirse a cambios en los atajos centrales
  useEffect(() => {
    const unsubscribe = subscribeToShortcutChanges((newShortcuts) => {
      allShortcuts.current = newShortcuts;
    });

    return unsubscribe;
  }, []);

  /**
   * Parsea un shortcut string y retorna objeto con modificadores
   * Soporta formatos: "Ctrl+Shift+S", "Ctrl+S", "Cmd+S", etc.
   * @param {string} shortcutStr - Ej: "Ctrl+Shift+S" o "Ctrl+S"
   * @returns {Object} { ctrl, shift, alt, cmd, key }
   */
  const parseShortcut = (shortcutStr) => {
    const parts = shortcutStr.split('+').map(p => p.trim().toLowerCase());
    const result = {
      ctrl: false,
      shift: false,
      alt: false,
      cmd: false,
      key: ''
    };

    for (let i = 0; i < parts.length - 1; i++) {
      const modifier = parts[i];
      if (modifier === 'ctrl' || modifier === 'control') result.ctrl = true;
      if (modifier === 'shift') result.shift = true;
      if (modifier === 'alt') result.alt = true;
      if (modifier === 'cmd' || modifier === 'meta') result.cmd = true;
    }

    result.key = parts[parts.length - 1];
    return result;
  };

  /**
   * Verifica si una tecla presionada coincide con un shortcut
   */
  const matchesShortcut = (event, shortcutStr) => {
    const parsed = parseShortcut(shortcutStr);
    
    // En macOS, usar Cmd en lugar de Ctrl
    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    
    // Determinar la tecla de control efectiva según SO
    const effectiveCtrlKey = isMac ? event.metaKey : event.ctrlKey;
    
    // Determinar si ctrl es needed según SO
    const ctrlNeeded = isMac ? parsed.cmd : parsed.ctrl;
    
    // Verificar cada modificador
    const ctrlMatch = ctrlNeeded === effectiveCtrlKey;
    const shiftMatch = parsed.shift === event.shiftKey;
    const altMatch = parsed.alt === event.altKey;
    const keyMatch = event.key.toLowerCase() === parsed.key;
    
    return ctrlMatch && shiftMatch && altMatch && keyMatch;
  };

  /**
   * Handler del evento keydown
   */
  const handleKeyDown = (event) => {
    // Obtener el target del evento
    const target = event.target;
    const tagName = target.tagName;
    
    // Determinar si estamos en un elemento editable
    const isInput = tagName === 'INPUT' || tagName === 'TEXTAREA';
    const isContentEditable = target.isContentEditable || target.closest('[contenteditable="true"]');
    const isEditor = target.closest('.editor-body');
    
    // No procesar shortcuts en inputs/textareas regulares a menos que sea universal
    if (isInput && !isEditor) return;
    
    // Primero intentar con atajos legacy (para compatibilidad hacia atrás)
    for (const [shortcutStr, callback] of Object.entries(shortcutsRef.current)) {
      if (matchesShortcut(event, shortcutStr)) {
        event.preventDefault();
        event.stopPropagation();
        
        if (typeof callback === 'function') {
          callback(event);
        }
        
        return; // Solo ejecutar el primer match
      }
    }
    
    // Luego intentar con atajos centrales
    for (const [shortcutId, shortcut] of Object.entries(allShortcuts.current)) {
      if (matchesShortcut(event, shortcut.keys)) {
        event.preventDefault();
        event.stopPropagation();
        
        // Ejecutar callback registrado en sistema central
        executeShortcut(shortcutId, event);
        
        return;
      }
    }
  };

  /**
   * Efecto: Agregar listener cuando el componente se monta
   */
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  /**
   * Retorna funciones útiles de manejo de shortcuts
   */
  return {
    parseShortcut,
    matchesShortcut,
    registerShortcut: (shortcut, callback) => {
      shortcutsRef.current[shortcut] = callback;
    },
    unregisterShortcut: (shortcut) => {
      delete shortcutsRef.current[shortcut];
    },
    getShortcuts: () => shortcutsRef.current,
    getAllShortcuts: () => allShortcuts.current
  };
}

export default useKeyboardShortcuts;
