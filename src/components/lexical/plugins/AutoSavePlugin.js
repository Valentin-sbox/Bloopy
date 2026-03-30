/**
 * ============================================================================
 * AUTO SAVE PLUGIN
 * ============================================================================
 * 
 * Plugin para auto-guardar el contenido del editor
 * Compatible con el sistema de auto-save existente
 * ============================================================================
 */

import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $generateHtmlFromNodes } from '@lexical/html';

export function AutoSavePlugin({ 
  onSave, 
  interval = 30000,
  contentHashManager,
  saveTracker,
  filePath
}) {
  const [editor] = useLexicalComposerContext();
  const timeoutRef = useRef(null);
  const cooldownRef = useRef(null);
  const queuedSaveRef = useRef(null);
  const cooldownPeriod = 1000; // 1 second cooldown

  useEffect(() => {
    const saveContent = async () => {
      // Check if in cooldown
      if (cooldownRef.current) {
        console.log('[SAVE-CYCLE] AutoSavePlugin in cooldown, queueing save');
        queuedSaveRef.current = Date.now();
        return;
      }

      const htmlString = await editor.getEditorState().read(() => {
        return $generateHtmlFromNodes(editor, null);
      });

      // Check if content actually changed
      if (contentHashManager && filePath && !contentHashManager.hasChanged(filePath, htmlString)) {
        console.log('[SAVE-CYCLE] AutoSavePlugin: Content unchanged, skipping save');
        return;
      }

      // Compute and store new hash
      let contentHash = '';
      if (contentHashManager && filePath) {
        contentHash = contentHashManager.updateHash(filePath, htmlString);
      }
      
      // Register save operation
      let operationId = '';
      if (saveTracker && filePath) {
        operationId = saveTracker.registerSave(filePath, contentHash);
        console.log('[SAVE-CYCLE] AutoSavePlugin starting save operation:', operationId);
      }

      try {
        if (onSave && typeof onSave === 'function') {
          await onSave(htmlString);
        }
        
        console.log('[SAVE-CYCLE] AutoSavePlugin save completed:', operationId);
      } catch (error) {
        console.error('[SAVE-CYCLE] AutoSavePlugin save failed:', error);
        if (saveTracker && filePath && operationId) {
          saveTracker.clearOperation(filePath, operationId);
        }
      }

      // Enter cooldown period
      cooldownRef.current = setTimeout(() => {
        cooldownRef.current = null;
        
        // Execute queued save if any
        if (queuedSaveRef.current) {
          queuedSaveRef.current = null;
          console.log('[SAVE-CYCLE] AutoSavePlugin executing queued save');
          saveContent();
        }
      }, cooldownPeriod);
    };

    const scheduleAutoSave = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(saveContent, interval);
    };

    // Guardar cuando hay cambios
    const unregister = editor.registerUpdateListener(() => {
      scheduleAutoSave();
    });

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (cooldownRef.current) {
        clearTimeout(cooldownRef.current);
      }
      unregister();
    };
  }, [editor, onSave, interval, contentHashManager, saveTracker, filePath]);

  return null;
}
