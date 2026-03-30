/**
 * ============================================================================
 *  SLASH COMMANDS
 * ============================================================================
 * 
 * Definición de comandos disponibles en el Slash Menu.
 * Cada comando tiene un ID, label, icono y acción a ejecutar.
 * 
 * FORMATO DE ACCIÓN:
 * - "formatBlock:tag" - Convierte el bloque actual al tag especificado
 * - "insertUnorderedList" - Inserta lista desordenada
 * - "insertOrderedList" - Inserta lista ordenada
 * - "insertHR" - Inserta línea divisoria horizontal
 * 
 * ============================================================================
 */

export const SLASH_COMMANDS = [
  {
    id: 'paragraph',
    label: 'Párrafo',
    icon: '¶',
    action: 'formatBlock:p',
    keywords: ['parrafo', 'texto', 'normal'],
    description: 'Texto de párrafo estándar',
    placeholder: 'Escribe un párrafo...'
  },
  {
    id: 'h1',
    label: 'Título 1',
    icon: 'H1',
    action: 'formatBlock:h1',
    keywords: ['titulo', 'heading', 'grande'],
    description: 'Título principal grande',
    placeholder: 'Escribe un título...'
  },
  {
    id: 'h2',
    label: 'Título 2',
    icon: 'H2',
    action: 'formatBlock:h2',
    keywords: ['titulo', 'subtitulo', 'heading'],
    description: 'Subtítulo',
    placeholder: 'Escribe un subtítulo...'
  },
  {
    id: 'h3',
    label: 'Título 3',
    icon: 'H3',
    action: 'formatBlock:h3',
    keywords: ['titulo', 'encabezado', 'heading'],
    description: 'Encabezado',
    placeholder: 'Escribe un encabezado...'
  },
  {
    id: 'ul',
    label: 'Lista',
    icon: '•',
    action: 'insertUnorderedList',
    keywords: ['lista', 'bullets', 'viñetas'],
    description: 'Lista con viñetas',
    placeholder: 'Elemento de lista...'
  },
  {
    id: 'ol',
    label: 'Lista numerada',
    icon: '1.',
    action: 'insertOrderedList',
    keywords: ['lista', 'numeros', 'ordenada'],
    description: 'Lista ordenada',
    placeholder: 'Elemento de lista...'
  },
  {
    id: 'quote',
    label: 'Cita',
    icon: '"',
    action: 'formatBlock:blockquote',
    keywords: ['cita', 'quote', 'bloque'],
    description: 'Bloque de cita resaltada',
    placeholder: 'Escribe una cita...'
  },
  {
    id: 'code',
    label: 'Código',
    icon: '</>',
    action: 'formatBlock:pre',
    keywords: ['codigo', 'code', 'programacion'],
    description: 'Bloque de código',
    placeholder: 'Escribe código...'
  },
  {
    id: 'divider',
    label: 'Divisor',
    icon: '—',
    action: 'insertHR',
    keywords: ['divisor', 'linea', 'separador', 'hr'],
    description: 'Línea separadora',
    placeholder: 'Continúa escribiendo...'
  }
];
