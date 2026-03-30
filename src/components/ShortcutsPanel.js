/**
 * ============================================================================
 *  SHORTCUTSPANEL.JS
 * ============================================================================
 * 
 * COMPONENTE: PANEL DE CONFIGURACIÓN DE ATAJOS DE TECLADO
 * 
 * Permite al usuario ver y personalizar todos los atajos de teclado de la aplicación.
 * 
 * FUNCIONALIDADES:
 * - Listar todos los atajos disponibles
 * - Editar atajos existentes
 * - Detectar conflictos entre atajos
 * - Restaurar atajos por defecto
 * - Validación en tiempo real
 * 
 * PROPS:
 * - onClose: function - Callback para cerrar el panel
 * - onSave: function(shortcuts) - Callback al guardar cambios
 * 
 * RELACIONADO CON:
 * - src/utils/shortcuts.js: Sistema centralizado de atajos
 * - src/components/SettingsModal.js: Integración en configuración
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { getAllShortcuts, updateShortcuts, getDefaultShortcuts } from '../utils/shortcuts';
import { useTranslation } from '../utils/i18n';
import Icon from '@mdi/react';
import { 
  mdiKeyboard, 
  mdiClose, 
  mdiMagnify, 
  mdiUndo, 
  mdiAlert, 
  mdiCheck, 
  mdiFileEdit, 
  mdiContentSave 
} from '@mdi/js';

function ShortcutsPanel({ onClose, onSave }) {
  const { t } = useTranslation();
  
  // Estado de atajos (copia editable)
  const [shortcuts, setShortcuts] = useState({});
  
  // Estado de conflictos detectados
  const [conflicts, setConflicts] = useState([]);
  
  // ID del atajo siendo editado
  const [editingId, setEditingId] = useState(null);
  
  // Valor temporal durante la edición
  const [editingValue, setEditingValue] = useState('');
  
  // Filtro de búsqueda
  const [searchFilter, setSearchFilter] = useState('');
  
  // Cargar atajos al montar
  useEffect(() => {
    const currentShortcuts = getAllShortcuts();
    setShortcuts(currentShortcuts);
  }, []);
  
  /**
   * Detecta conflictos entre atajos
   */
  const detectConflicts = (shortcutsToCheck) => {
    const conflicts = [];
    const keysMap = new Map();
    
    for (const [id, shortcut] of Object.entries(shortcutsToCheck)) {
      const key = shortcut.keys.toLowerCase();
      if (keysMap.has(key)) {
        conflicts.push({
          key: shortcut.keys,
          shortcuts: [keysMap.get(key), id]
        });
      } else {
        keysMap.set(key, id);
      }
    }
    
    return conflicts;
  };
  
  /**
   * Maneja el inicio de edición de un atajo
   */
  const handleStartEdit = (id) => {
    setEditingId(id);
    setEditingValue(shortcuts[id].keys);
  };
  
  /**
   * Maneja el cambio del valor durante la edición
   */
  const handleEditChange = (e) => {
    setEditingValue(e.target.value);
  };
  
  /**
   * Captura la combinación de teclas presionada
   */
  const handleKeyDown = (e) => {
    e.preventDefault();
    
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    
    // Agregar la tecla principal (si no es un modificador)
    const key = e.key;
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
      parts.push(key.toUpperCase());
    }
    
    if (parts.length > 1) {
      setEditingValue(parts.join('+'));
    }
  };
  
  /**
   * Guarda el atajo editado
   */
  const handleSaveEdit = () => {
    if (!editingId || !editingValue) return;
    
    const newShortcuts = {
      ...shortcuts,
      [editingId]: {
        ...shortcuts[editingId],
        keys: editingValue
      }
    };
    
    setShortcuts(newShortcuts);
    setEditingId(null);
    setEditingValue('');
    
    // Detectar conflictos
    const newConflicts = detectConflicts(newShortcuts);
    setConflicts(newConflicts);
  };
  
  /**
   * Cancela la edición
   */
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingValue('');
  };
  
  /**
   * Restaura un atajo a su valor por defecto
   */
  const handleRestore = (id) => {
    const defaults = getDefaultShortcuts();
    if (defaults[id]) {
      const newShortcuts = {
        ...shortcuts,
        [id]: defaults[id]
      };
      setShortcuts(newShortcuts);
      
      // Detectar conflictos
      const newConflicts = detectConflicts(newShortcuts);
      setConflicts(newConflicts);
    }
  };
  
  /**
   * Restaura todos los atajos a sus valores por defecto
   */
  const handleRestoreAll = () => {
    const defaults = getDefaultShortcuts();
    setShortcuts(defaults);
    setConflicts([]);
  };
  
  /**
   * Guarda los cambios
   */
  const handleSave = () => {
    if (conflicts.length > 0) {
      alert(t('settings.shortcuts.conflictAlert'));
      return;
    }
    
    updateShortcuts(shortcuts);
    if (onSave) onSave(shortcuts);
    if (onClose) onClose();
  };
  
  /**
   * Filtra atajos según el término de búsqueda
   */
  const filteredShortcuts = Object.entries(shortcuts).filter(([id, shortcut]) => {
    if (!searchFilter) return true;
    const search = searchFilter.toLowerCase();
    return (
      shortcut.label.toLowerCase().includes(search) ||
      shortcut.keys.toLowerCase().includes(search) ||
      shortcut.description?.toLowerCase().includes(search) ||
      shortcut.category?.toLowerCase().includes(search)
    );
  });
  
  /**
   * Agrupa atajos por categoría
   */
  const groupedShortcuts = filteredShortcuts.reduce((acc, [id, shortcut]) => {
    const category = shortcut.category || 'general';
    if (!acc[category]) acc[category] = [];
    acc[category].push([id, shortcut]);
    return acc;
  }, {});
  
  /**
   * Verifica si un atajo tiene conflicto
   */
  const hasConflict = (id) => {
    return conflicts.some(c => c.shortcuts.includes(id));
  };
  
  return (
    <div className="shortcuts-panel">
      <div className="shortcuts-panel-header">
        <h2>
          <Icon path={mdiKeyboard} size={0.9} />
          {t('settings.shortcuts')}
        </h2>
        <button className="btn-close" onClick={onClose}>
          <Icon path={mdiClose} size={0.7} />
        </button>
      </div>
      
      {/* Barra de búsqueda y acciones */}
      <div className="shortcuts-toolbar">
        <div className="search-box">
          <Icon path={mdiMagnify} size={0.7} />
          <input
            type="text"
            placeholder={t('shortcuts.search')}
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
        </div>
        <button className="btn-secondary" onClick={handleRestoreAll}>
          <Icon path={mdiUndo} size={0.7} />
          {t('shortcuts.restoreAll')}
        </button>
      </div>
      
      {/* Advertencia de conflictos */}
      {conflicts.length > 0 && (
        <div className="conflicts-warning">
          <Icon path={mdiAlert} size={0.7} />
          <span>
            {t('shortcuts.conflictsDetected', { count: conflicts.length })}
          </span>
        </div>
      )}
      
      {/* Lista de atajos agrupados por categoría */}
      <div className="shortcuts-list">
        {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
          <div key={category} className="shortcuts-category">
            <h3 className="category-title">
              {t(`shortcuts.category.${category}`)}
            </h3>
            
            {categoryShortcuts.map(([id, shortcut]) => (
              <div 
                key={id} 
                className={`shortcut-item ${hasConflict(id) ? 'conflict' : ''} ${editingId === id ? 'editing' : ''}`}
              >
                <div className="shortcut-info">
                  <div className="shortcut-label">
                    {shortcut.icon && <Icon path={shortcut.icon} size={0.7} />}
                    <span>{shortcut.label}</span>
                  </div>
                  {shortcut.description && (
                    <div className="shortcut-description">
                      {shortcut.description}
                    </div>
                  )}
                </div>
                
                <div className="shortcut-keys">
                  {editingId === id ? (
                    <div className="shortcut-edit">
                      <input
                        type="text"
                        value={editingValue}
                        onChange={handleEditChange}
                        onKeyDown={handleKeyDown}
                        onBlur={handleSaveEdit}
                        autoFocus
                        placeholder="Presiona una combinación..."
                      />
                      <button className="btn-icon" onClick={handleSaveEdit}>
                        <Icon path={mdiCheck} size={0.7} />
                      </button>
                      <button className="btn-icon" onClick={handleCancelEdit}>
                        <Icon path={mdiClose} size={0.7} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <kbd className="shortcut-kbd">{shortcut.keys}</kbd>
                      <button 
                        className="btn-icon" 
                        onClick={() => handleStartEdit(id)}
                        title={t('shortcuts.edit')}
                      >
                        <Icon path={mdiFileEdit} size={0.7} />
                      </button>
                      <button 
                        className="btn-icon" 
                        onClick={() => handleRestore(id)}
                        title={t('shortcuts.restore')}
                      >
                        <Icon path={mdiUndo} size={0.7} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      
      {/* Footer con botones de acción */}
      <div className="shortcuts-panel-footer">
        <button className="btn-secondary" onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button 
          className="btn-primary" 
          onClick={handleSave}
          disabled={conflicts.length > 0}
        >
          <Icon path={mdiContentSave} size={0.7} />
          {t('common.save')}
        </button>
      </div>
    </div>
  );
}

export default ShortcutsPanel;
