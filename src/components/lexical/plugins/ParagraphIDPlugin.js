/**
 * ============================================================================
 * PARAGRAPH ID PLUGIN
 * ============================================================================
 * 
 * Plugin para asignar IDs únicos a cada párrafo
 * Necesario para el sistema de comentarios
 * ============================================================================
 */

import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $isParagraphNode } from 'lexical';
import { $isHeadingNode } from '@lexical/rich-text';
import { generateUUID } from '../../../utils/helpers';

export function ParagraphIDPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const assignIDs = () => {
      editor.update(() => {
        const root = $getRoot();
        const children = root.getChildren();

        children.forEach(node => {
          // Asignar ID a párrafos y headings
          if ($isParagraphNode(node) || $isHeadingNode(node)) {
            const element = editor.getElementByKey(node.getKey());
            if (element && !element.getAttribute('data-paragraph-id')) {
              element.setAttribute('data-paragraph-id', generateUUID());
            }
          }
        });
      });
    };

    // Asignar IDs cuando cambia el contenido
    const unregister = editor.registerUpdateListener(() => {
      assignIDs();
    });

    // Asignar IDs inicialmente
    assignIDs();

    return () => {
      unregister();
    };
  }, [editor]);

  return null;
}
