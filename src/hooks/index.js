/**
 * ============================================================================
 * HOOKS INDEX
 * ============================================================================
 * 
 * Exports de todos los hooks personalizados
 */

export { useAutoSave } from './useAutoSave';
// OPTIMIZACIÓN: Los hooks usan useCallback/useMemo internamente para evitar cálculos repetidos
export { useKeyboardShortcuts } from './useKeyboardShortcuts';
export { useDragDrop } from './useDragDrop';
