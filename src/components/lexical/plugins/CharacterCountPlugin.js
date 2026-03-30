/**
 * ============================================================================
 * CHARACTER COUNT PLUGIN
 * ============================================================================
 * 
 * Plugin para contar caracteres, palabras y líneas en tiempo real
 * ============================================================================
 */

import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot } from 'lexical';

export function CharacterCountPlugin({ onStatsChange }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const updateStats = () => {
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const text = root.getTextContent();
        
        const chars = text.length;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const lines = text.split('\n').length;

        if (onStatsChange && typeof onStatsChange === 'function') {
          onStatsChange({ chars, words, lines });
        }
      });
    };

    // Actualizar stats cuando cambia el contenido
    const unregister = editor.registerUpdateListener(() => {
      updateStats();
    });

    // Actualizar stats inicialmente
    updateStats();

    return () => {
      unregister();
    };
  }, [editor, onStatsChange]);

  return null;
}
