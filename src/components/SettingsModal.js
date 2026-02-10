/**
 * ============================================================================
 * BLOCK GUARD v4.0.0 - SETTINGSMODAL.JS
 * ============================================================================
 * 
 * COMPONENTE: MODAL DE CONFIGURACIÓN
 * 
 * Permite al usuario personalizar la aplicación:
 * - Perfil (nombre y avatar)
 * - Apariencia (tema de colores)
 * - Estados de proyecto (personalizar flujo de trabajo)
 * - Datos (exportar/importar)
 * - Atajos de teclado (integrado con sistema centralizado)
 * 
 * PROPS:
 * - config: Object - Configuración actual
 * - userName: string - Nombre del usuario
 * - avatar: string - Avatar en base64
 * - onClose: function - Callback al cerrar
 * - onSave: function(config, userName, avatar) - Callback al guardar
 * - onExport: function - Callback para exportar datos
 * - onImport: function - Callback para importar datos
 * 
 * RELACIONADO CON:
 * - src/App.js: Gestiona el estado y pasa datos/props
 * - src/utils/themes.js: Lista de temas disponibles
 * - src/utils/shortcuts.js: Sistema centralizado de atajos
 * - src/styles/index.css: Estilos de .modal y .settings-layout
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { themes } from '../utils/themes';
import {
  SHORTCUTS_DEFAULTS,
  getShortcutsByCategory,
  getShortcutDisplay,
  detectShortcutConflicts,
  isValidKeyCombo,
  resetShortcut,
  resetAllShortcuts
} from '../utils/shortcuts';
import { useTranslation } from '../utils/i18n';

function SettingsModal({ config, userName, avatar, onClose, onSave, onExport, onImport }) {
  const { t, changeLanguage } = useTranslation();
  
  // =============================================================================
  // ESTADOS LOCALES
  // =============================================================================

  // Pestaña activa (general, appearance, states, data)
  const [activeTab, setActiveTab] = useState('general');

  // Copias locales de la configuración (para editar sin afectar el original)
  const [localConfig, setLocalConfig] = useState({ ...config });
  const [localUserName, setLocalUserName] = useState(userName);
  const [localAvatar, setLocalAvatar] = useState(avatar);

  // Estado para shortcuts editables desde sistema centralizado
  const [shortcuts, setShortcuts] = useState(() => {
    // 1. Obtener defaults del sistema
    const shortcutsByCategory = getShortcutsByCategory();
    const defaultMap = Object.values(shortcutsByCategory).reduce((acc, category) => {
      category.forEach(s => {
        acc[s.id] = s.keys;
      });
      return acc;
    }, {});

    // 2. Sobrescribir con la configuración actual (si existe)
    if (config.shortcuts) {
      Object.entries(config.shortcuts).forEach(([id, data]) => {
        if (data && data.keys) {
          defaultMap[id] = data.keys;
        }
      });
    }

    return defaultMap;
  });

  // Estado para edición de shortcut
  const [editingShortcut, setEditingShortcut] = useState(null);

  // Estado para mostrar conflictos de atajos
  const [shortcutConflicts, setShortcutConflicts] = useState({});

  // Estado para mostrar mensaje de error/advertencia
  const [conflictMessage, setConflictMessage] = useState(null);

  // Estado para versión de la app
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.getAppVersion) {
      window.electronAPI.getAppVersion().then(setAppVersion).catch(console.error);
    }
  }, []);

  // =============================================================================
  // CONFIGURACIÓN DE PESTAÑAS
  // =============================================================================

  const tabs = [
    { id: 'general', label: 'General', icon: 'fa-sliders-h' },
    { id: 'appearance', label: 'Apariencia', icon: 'fa-palette' },
    { id: 'states', label: 'Estados', icon: 'fa-tag' },
    { id: 'shortcuts', label: 'Atajos', icon: 'fa-keyboard' },
    { id: 'data', label: 'Datos', icon: 'fa-database' }
  ];

  // =============================================================================
  // MANEJADORES DE EVENTOS
  // =============================================================================

  /**
   * Guarda los cambios y cierra el modal.
   */
  const handleSave = () => {
    // Guardar shortcuts personalizados
    const shortcutsObj = {};
    Object.entries(shortcuts).forEach(([id, keys]) => {
      shortcutsObj[id] = { keys };
    });

    const updatedConfig = {
      ...localConfig,
      shortcuts: shortcutsObj
    };
    
    // Actualizar idioma inmediatamente si cambió
    if (updatedConfig.language && updatedConfig.language !== config.language) {
      changeLanguage(updatedConfig.language);
    }
    
    onSave(updatedConfig, localUserName, localAvatar);
    onClose();
  };

  /**
   * Maneja la selección de un nuevo avatar.
   * @param {Event} e - Evento de cambio del input file
   */
  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validaciones
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen válida');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen es demasiado grande (máx 5MB)');
      return;
    }

    // Leer y redimensionar imagen
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 200;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Recorte cuadrado centrado
        let sx, sy, sWidth, sHeight;
        const aspectRatio = img.width / img.height;

        if (aspectRatio > 1) {
          sHeight = img.height;
          sWidth = img.height;
          sx = (img.width - sWidth) / 2;
          sy = 0;
        } else {
          sWidth = img.width;
          sHeight = img.width;
          sx = 0;
          sy = (img.height - sHeight) / 2;
        }

        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, size, size);
        setLocalAvatar(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  /**
   * Añade un nuevo estado de proyecto.
   */
  const addState = () => {
    const newState = {
      id: `state_${Date.now()}`,
      name: 'Nuevo Estado',
      color: '#0071e3',
      goal: 30000,
      countType: 'absolute'
    };
    setLocalConfig({
      ...localConfig,
      states: [...localConfig.states, newState]
    });
  };

  /**
   * Actualiza un campo de un estado existente.
   * @param {number} index - Índice del estado
   * @param {string} field - Campo a actualizar
   * @param {any} value - Nuevo valor
   */
  const updateState = (index, field, value) => {
    const newStates = [...localConfig.states];
    newStates[index] = { ...newStates[index], [field]: value };
    setLocalConfig({ ...localConfig, states: newStates });
  };

  /**
   * Elimina un estado.
   * @param {number} index - Índice del estado a eliminar
   */
  const removeState = (index) => {
    if (localConfig.states.length <= 1) {
      alert('Debe haber al menos un estado');
      return;
    }
    const newStates = localConfig.states.filter((_, i) => i !== index);
    setLocalConfig({ ...localConfig, states: newStates });
  };

  /**
   * Mueve un estado arriba o abajo en la lista.
   * @param {number} index - Índice del estado
   * @param {number} direction - -1 para arriba, 1 para abajo
   */
  const moveState = (index, direction) => {
    const newStates = [...localConfig.states];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= newStates.length) return;

    [newStates[index], newStates[newIndex]] = [newStates[newIndex], newStates[index]];
    setLocalConfig({ ...localConfig, states: newStates });
  };

  // =============================================================================
  // RENDERIZADO DE PESTAÑAS
  // =============================================================================

  const renderGeneralTab = () => (
    <div className="settings-tab-content">
      {/* Avatar */}
      <div className="setting-item">
        <label>Avatar</label>
        <div className="avatar-setting">
          <div className="avatar-preview-large">
            {localAvatar ? (
              <img src={localAvatar} alt="Avatar" />
            ) : (
              <i className="fas fa-user"></i>
            )}
          </div>
          <div className="avatar-actions">
            <label className="btn-primary-small">
              <i className="fas fa-camera"></i> Cambiar
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                style={{ display: 'none' }}
              />
            </label>
            {localAvatar && (
              <button
                className="btn-sub-small"
                onClick={() => setLocalAvatar(null)}
              >
                <i className="fas fa-trash"></i> Quitar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Nombre de usuario */}
      <div className="setting-item">
        <label>Nombre de Usuario</label>
        <span className="setting-desc">Tu nombre que se mostrará en la interfaz.</span>
        <input
          type="text"
          value={localUserName}
          onChange={(e) => setLocalUserName(e.target.value)}
          placeholder="Tu nombre"
        />
      </div>

      {/* Idioma de la interfaz */}
      <div className="setting-item">
        <label>Idioma de la Interfaz</label>
        <span className="setting-desc">Selecciona el idioma de la aplicación.</span>
        <select
          className="setting-select"
          value={localConfig.language || 'es'}
          onChange={(e) => {
            setLocalConfig({ ...localConfig, language: e.target.value });
          }}
        >
          <option value="es">🇪🇸 Español</option>
          <option value="en">🇬🇧 English</option>
          <option value="ja">🇯🇵 日本語 (Japonés)</option>
          <option value="zh">🇨🇳 中文 (Chino)</option>
        </select>
      </div>

      {/* Auto-guardado */}
      <div className="setting-item">
        <label>Auto-guardado</label>
        <span className="setting-desc">Intervalo en segundos para guardar automáticamente.</span>
        <input
          type="number"
          value={localConfig.autosaveInterval}
          onChange={(e) => setLocalConfig({
            ...localConfig,
            autosaveInterval: parseInt(e.target.value) || 30
          })}
          min="10"
          max="300"
        />
      </div>
      {/* Notificaciones */}
      <div className="setting-item">
        <label>Mostrar notificaciones</label>
        <span className="setting-desc">Habilita o deshabilita las notificaciones emergentes.</span>
        <div>
          <label className="switch">
            <input
              type="checkbox"
              checked={localConfig.showNotifications !== false}
              onChange={(e) => setLocalConfig({ ...localConfig, showNotifications: e.target.checked })}
            />
            <span className="slider" />
          </label>
        </div>
      </div>

      <div className="setting-item">
        <label>Donar</label>
        <span className="setting-desc">Si quieres apoyar el proyecto, puedes donar vía PayPal.</span>
        <div className="donate-actions">
          <button
            className="btn-primary"
            onClick={() => window.electronAPI.openExternal('https://www.paypal.me/Valenhere1')}
          >
            <i className="fas fa-donate"></i> Donar
          </button>
        </div>
      </div>

      <div className="setting-item">
        <label>Repositorio del Proyecto</label>
        <span className="setting-desc">Visita el repositorio en GitHub para reportar bugs o contribuir.</span>
        <div className="donate-actions">
          <button
            className="btn-sub"
            onClick={() => window.electronAPI.openExternal('https://github.com/Valentin-sbox/Blockguard/')}
          >
            <i className="fab fa-github"></i> Ver en GitHub
          </button>
        </div>
      </div>

      {/* Actualizaciones */}
      <div className="setting-item">
        <label>Acerca de Block Guard</label>
        <span className="setting-desc">Versión actual: {appVersion || 'Cargando...'}</span>
        <div className="donate-actions">
          <button
            className="btn-sub"
            onClick={async () => {
              if (window.electronAPI && window.electronAPI.checkForUpdates) {
                try {
                  const result = await window.electronAPI.checkForUpdates();
                  if (result && result.hasUpdate) {
                    alert('¡Nueva versión disponible! Descargando en segundo plano...');
                  } else {
                    alert('Block Guard está actualizado.');
                  }
                } catch (e) {
                  console.error(e);
                  alert('Error al buscar actualizaciones.');
                }
              } else {
                alert('La búsqueda de actualizaciones no está disponible en este entorno.');
              }
            }}
          >
            <i className="fas fa-sync-alt"></i> Buscar Actualizaciones
          </button>
        </div>
      </div>

      {/* Meta por defecto */}
      <div className="setting-item">
        <label>Meta de caracteres por defecto</label>
        <span className="setting-desc">Meta inicial para nuevos archivos.</span>
        <input
          type="number"
          value={localConfig.defaultGoal}
          onChange={(e) => setLocalConfig({
            ...localConfig,
            defaultGoal: parseInt(e.target.value) || 30000
          })}
          min="1000"
          max="1000000"
        />
      </div>
    </div>
  );

  const renderAppearanceTab = () => (
    <div className="settings-tab-content">
      {/* Selector de temas predefinidos */}
      <div className="setting-item">
        <label>Temas de color</label>
        <span className="setting-desc">Elige un tema predefinido para personalizar la apariencia.</span>
        <div className="theme-selector">
          {Object.entries(themes).map(([key, theme]) => (
            <button
              key={key}
              className={`theme-btn ${localConfig.theme === key ? 'active' : ''}`}
              onClick={() => setLocalConfig({ ...localConfig, theme: key })}
              style={{
                background: theme['--bg-primary'],
                color: theme['--text-primary'],
                borderColor: localConfig.theme === key ? theme['--accent-blue'] : 'transparent'
              }}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
          <button
            className={`theme-btn ${localConfig.theme === 'custom' ? 'active' : ''}`}
            onClick={() => setLocalConfig({ ...localConfig, theme: 'custom' })}
            style={{
              background: localConfig.customColors?.['--bg-primary'] || '#2a2a2a',
              color: localConfig.customColors?.['--text-primary'] || '#ffffff',
              borderColor: localConfig.theme === 'custom' ? (localConfig.customColors?.['--accent-blue'] || '#0071e3') : 'transparent'
            }}
          >
            Personalizado
          </button>
        </div>
      </div>

      {/* Editor de colores personalizado */}
      <div className="setting-item">
        <label>Colores personalizados</label>
        <span className="setting-desc">Personaliza los colores principales de la interfaz.</span>

        <div className="custom-theme-editor">
          {/* Nombre del tema */}
          <div className="custom-theme-name">
            <label>Nombre del tema</label>
            <input
              type="text"
              className="setting-input"
              placeholder="Mi tema personalizado"
              value={localConfig.customThemeName || 'Mi Tema'}
              onChange={(e) => setLocalConfig({ ...localConfig, customThemeName: e.target.value })}
            />
          </div>

          {/* Grid de selectores de color */}
          <div className="color-grid">
            {[
              { key: '--bg-primary', label: 'Fondo Principal', value: localConfig.customColors?.['--bg-primary'] || '#0a0a0a' },
              { key: '--bg-secondary', label: 'Fondo Secundario', value: localConfig.customColors?.['--bg-secondary'] || '#121212' },
              { key: '--text-primary', label: 'Texto Principal', value: localConfig.customColors?.['--text-primary'] || '#f5f5f7' },
              { key: '--accent-blue', label: 'Acento Azul', value: localConfig.customColors?.['--accent-blue'] || '#0071e3' },
              { key: '--accent-red', label: 'Acento Rojo', value: localConfig.customColors?.['--accent-red'] || '#ff3b30' },
              { key: '--accent-green', label: 'Acento Verde', value: localConfig.customColors?.['--accent-green'] || '#34c759' }
            ].map(({ key, label, value }) => (
              <div key={key} className="color-setting">
                <label>{label}</label>
                <div className="color-input-wrapper">
                  <input
                    type="color"
                    value={value}
                    onChange={(e) => {
                      const newColors = {
                        ...localConfig.customColors,
                        [key]: e.target.value
                      };
                      setLocalConfig({ ...localConfig, customColors: newColors });
                    }}
                    className="color-picker"
                  />
                  <span className="color-value">{value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Botones de acción */}
          <div className="custom-theme-actions">
            <button
              className="btn-sub"
              onClick={() => {
                // Restaurar colores default
                setLocalConfig({
                  ...localConfig,
                  customColors: {
                    '--bg-primary': '#0a0a0a',
                    '--bg-secondary': '#121212',
                    '--text-primary': '#f5f5f7',
                    '--accent-blue': '#0071e3',
                    '--accent-red': '#ff3b30',
                    '--accent-green': '#34c759'
                  }
                });
              }}
            >
              <i className="fas fa-undo"></i> Restaurar Colores
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                // Guardar y aplicar tema personalizado
                localStorage.setItem('customTheme', JSON.stringify(localConfig.customColors));
                localStorage.setItem('customThemeName', localConfig.customThemeName || 'Mi Tema');
                setLocalConfig({ ...localConfig, theme: 'custom' });
              }}
            >
              <i className="fas fa-save"></i> Guardar y Aplicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStatesTab = () => (
    <div className="settings-tab-content">
      <div className="setting-item">
        <label>Estados de proyecto</label>
        <span className="setting-desc">Define los niveles de progreso para tus archivos.</span>
        <div className="states-list">
          {localConfig.states.map((state, index) => (
            <div key={state.id} className="state-config-item">
              {/* Botones de reordenar */}
              <div className="state-reorder">
                <button
                  onClick={() => moveState(index, -1)}
                  disabled={index === 0}
                  className="btn-icon-small"
                >
                  <i className="fas fa-chevron-up"></i>
                </button>
                <button
                  onClick={() => moveState(index, 1)}
                  disabled={index === localConfig.states.length - 1}
                  className="btn-icon-small"
                >
                  <i className="fas fa-chevron-down"></i>
                </button>
              </div>

              {/* Selector de color */}
              <input
                type="color"
                value={state.color}
                onChange={(e) => updateState(index, 'color', e.target.value)}
                className="color-picker-small"
              />

              {/* Campos de nombre y meta */}
              <div className="state-fields">
                <input
                  type="text"
                  value={state.name}
                  onChange={(e) => updateState(index, 'name', e.target.value)}
                  placeholder="Nombre del estado"
                />
                <input
                  type="number"
                  value={state.goal}
                  onChange={(e) => updateState(index, 'goal', parseInt(e.target.value) || 30000)}
                  placeholder="Meta"
                />
              </div>

              {/* Tipo de conteo */}
              <select
                value={state.countType}
                onChange={(e) => updateState(index, 'countType', e.target.value)}
              >
                <option value="absolute">Contar Totales</option>
                <option value="edited">Contar Ediciones</option>
                <option value="delta">Contar Nuevos</option>
              </select>

              {/* Botón eliminar */}
              <button
                onClick={() => removeState(index)}
                className="btn-icon-small danger"
              >
                <i className="fas fa-trash"></i>
              </button>
            </div>
          ))}
        </div>

        {/* Botón añadir estado */}
        <button onClick={addState} className="btn-sub">
          <i className="fas fa-plus"></i> Añadir Estado
        </button>
      </div>
    </div>
  );

  const renderDataTab = () => {
    const handleExportShortcuts = () => {
      const profile = {
        profileName: config.appName || 'BlockGuard',
        shortcuts: shortcuts,
        customTheme: config.customTheme || null,
        exportDate: new Date().toISOString()
      };

      const dataStr = JSON.stringify(profile, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `blockguard-shortcuts-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setConflictMessage({
        type: 'success',
        text: '✓ Perfil de atajos exportado correctamente'
      });
      setTimeout(() => setConflictMessage(null), 2000);
    };

    const handleImportShortcuts = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const profile = JSON.parse(event.target.result);

            if (!profile.shortcuts || typeof profile.shortcuts !== 'object') {
              setConflictMessage({
                type: 'error',
                text: '✗ Archivo inválido: no contiene configuración de atajos'
              });
              setTimeout(() => setConflictMessage(null), 3000);
              return;
            }

            // Validar que todos los atajos existan en SHORTCUTS_DEFAULTS
            const allShortcutIds = Object.values(SHORTCUTS_DEFAULTS).flat().map(s => s.id);
            const invalidIds = Object.keys(profile.shortcuts).filter(id => !allShortcutIds.includes(id));

            if (invalidIds.length > 0) {
              setConflictMessage({
                type: 'error',
                text: `✗ Archivo corrupto: contiene atajos no reconocidos: ${invalidIds.join(', ')}`
              });
              setTimeout(() => setConflictMessage(null), 3000);
              return;
            }

            // Importar atajos
            setShortcuts(profile.shortcuts);

            // Importar tema personalizado si existe
            if (profile.customTheme) {
              setLocalConfig({
                ...localConfig,
                customTheme: profile.customTheme
              });
            }

            setConflictMessage({
              type: 'success',
              text: `✓ Perfil "${profile.profileName}" importado correctamente`
            });
            setTimeout(() => setConflictMessage(null), 2000);

          } catch (error) {
            setConflictMessage({
              type: 'error',
              text: '✗ Error al leer archivo: formato JSON inválido'
            });
            setTimeout(() => setConflictMessage(null), 3000);
          }
        };
        reader.readAsText(file);
      };
      input.click();
    };

    return (
      <div className="settings-tab-content">
        {/* Mensaje de conflicto/éxito/error */}
        {conflictMessage && (
          <div className={`shortcut-message shortcut-message-${conflictMessage.type}`}>
            <i className={`fas ${conflictMessage.type === 'warning' ? 'fa-exclamation-triangle' :
              conflictMessage.type === 'success' ? 'fa-check-circle' :
                'fa-times-circle'
              }`}></i>
            <span>{conflictMessage.text}</span>
          </div>
        )}

        <div className="setting-item">
          <label>Gestión de datos</label>
          <span className="setting-desc">Exporta o importa tu configuración y datos.</span>
          <div className="data-actions">
            <button onClick={onExport} className="btn-primary">
              <i className="fas fa-download"></i> Exportar Todo (JSON)
            </button>
            <button onClick={onImport} className="btn-sub">
              <i className="fas fa-upload"></i> Importar Datos
            </button>
          </div>
        </div>

        <div className="setting-item">
          <label>Perfiles de Atajos</label>
          <span className="setting-desc">Exporta e importa tus configuraciones de atajos personalizados.</span>
          <div className="data-actions">
            <button onClick={handleExportShortcuts} className="btn-primary">
              <i className="fas fa-save"></i> Exportar Atajos
            </button>
            <button onClick={handleImportShortcuts} className="btn-sub">
              <i className="fas fa-upload"></i> Importar Atajos
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderShortcutsTab = () => {
    const shortcutsByCategory = getShortcutsByCategory();

    const handleShortcutEdit = (shortcutId) => {
      setEditingShortcut(shortcutId);
    };

    const handleKeyCapture = (e, shortcutId) => {
      e.preventDefault();

      // Construir la combinación de teclas
      const modifiers = [];
      if (e.ctrlKey || e.metaKey) modifiers.push(e.metaKey ? 'Cmd' : 'Ctrl');
      if (e.shiftKey) modifiers.push('Shift');
      if (e.altKey) modifiers.push('Alt');

      const keyName = e.key.toUpperCase();
      if (!['CONTROL', 'SHIFT', 'ALT', 'META'].includes(keyName)) {
        modifiers.push(keyName);
      }

      const newShortcut = modifiers.length > 0 ? modifiers.join('+') : '';

      if (newShortcut) {
        // Detectar conflictos con otros atajos
        const conflicts = detectShortcutConflicts(newShortcut, shortcutId);

        if (conflicts.length > 0) {
          // Mostrar mensaje de conflicto en UI sin alert()
          const conflictNames = conflicts.map(id => {
            const allShortcuts = getShortcutsByCategory();
            for (const category of Object.values(allShortcuts)) {
              const found = category.find(s => s.id === id);
              if (found) return found.label;
            }
            return id;
          }).join(', ');

          setConflictMessage({
            type: 'warning',
            text: `⚠️ Conflicto: Este atajo ya está asignado a: ${conflictNames}`
          });

          // Limpiar mensaje después de 4 segundos
          setTimeout(() => setConflictMessage(null), 4000);
        } else if (isValidKeyCombo(newShortcut)) {
          setShortcuts({ ...shortcuts, [shortcutId]: newShortcut });
          setShortcutConflicts({ ...shortcutConflicts, [shortcutId]: null });

          // Mostrar mensaje de éxito
          setConflictMessage({
            type: 'success',
            text: `✓ Atajo actualizado a: ${newShortcut}`
          });

          // Limpiar mensaje después de 2 segundos
          setTimeout(() => setConflictMessage(null), 2000);
        } else {
          setConflictMessage({
            type: 'error',
            text: '⚠️ Combinación de teclas inválida'
          });

          setTimeout(() => setConflictMessage(null), 3000);
        }
      }

      setEditingShortcut(null);
    };

    return (
      <div className="settings-tab-content">
        {/* Mensaje de conflicto/éxito/error */}
        {conflictMessage && (
          <div className={`shortcut-message shortcut-message-${conflictMessage.type}`}>
            <i className={`fas ${conflictMessage.type === 'warning' ? 'fa-exclamation-triangle' :
              conflictMessage.type === 'success' ? 'fa-check-circle' :
                'fa-times-circle'
              }`}></i>
            <span>{conflictMessage.text}</span>
          </div>
        )}

        <div className="setting-item">
          <label>Atajos de Teclado</label>
          <span className="setting-desc">Haz click en un atajo para editarlo. Presiona cualquier combinación de teclas.</span>
        </div>

        {Object.entries(shortcutsByCategory).map(([category, shortcutList]) => (
          <div key={category} className="shortcuts-category">
            <h4 className="category-title">
              <i className="fas fa-folder"></i>{' '}
              {category === 'file' && 'Archivo'}
              {category === 'edit' && 'Editar'}
              {category === 'format' && 'Formato'}
              {category === 'tools' && 'Herramientas'}
              {category === 'view' && 'Vista'}
              {category === 'window' && 'Ventana'}
              {category === 'editor' && 'Editor'}
            </h4>

            <div className="shortcuts-list">
              {shortcutList.map((shortcut) => (
                <div
                  key={shortcut.id}
                  className={`shortcut-item ${editingShortcut === shortcut.id ? 'editing' : ''} ${shortcutConflicts[shortcut.id] ? 'conflict' : ''}`}
                >
                  <div className="shortcut-info">
                    <div className="shortcut-label">
                      <i className={`fas ${shortcut.icon}`}></i>
                      {shortcut.label}
                    </div>
                    <small className="shortcut-desc">{shortcut.description}</small>
                  </div>

                  {editingShortcut === shortcut.id ? (
                    <input
                      type="text"
                      className="shortcut-edit-input"
                      placeholder="Presiona cualquier tecla..."
                      value="Escuchando..."
                      readOnly
                      onKeyDown={(e) => handleKeyCapture(e, shortcut.id)}
                      onKeyUp={(e) => {
                        if (e.key === 'Escape') {
                          setEditingShortcut(null);
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <div
                      className="shortcut-keys"
                      onClick={() => handleShortcutEdit(shortcut.id)}
                      role="button"
                      tabIndex={0}
                      title="Click para editar"
                    >
                      {shortcuts[shortcut.id] || shortcut.keys}
                    </div>
                  )}

                  {shortcuts[shortcut.id] !== shortcut.keys && (
                    <button
                      className="btn-reset-shortcut"
                      onClick={() => {
                        setShortcuts({
                          ...shortcuts,
                          [shortcut.id]: shortcut.keys
                        });
                        resetShortcut(shortcut.id);
                      }}
                      title="Restaurar valor por defecto"
                    >
                      <i className="fas fa-undo"></i>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="setting-item">
          <button
            className="btn-sub"
            onClick={() => {
              const allShortcuts = getShortcutsByCategory();
              const defaultShortcuts = {};
              Object.values(allShortcuts).forEach(category => {
                category.forEach(s => {
                  defaultShortcuts[s.id] = s.keys;
                });
              });
              setShortcuts(defaultShortcuts);
              setShortcutConflicts({});
              resetAllShortcuts();
            }}
          >
            <i className="fas fa-undo"></i> Restaurar Todos
          </button>
        </div>
      </div>
    );
  };

  // =============================================================================
  // RENDERIZADO PRINCIPAL
  // =============================================================================

  return (
    <div className="modal open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content settings-large">
        <button className="close-btn" onClick={onClose}>
          <i className="fas fa-times"></i>
        </button>

        <div className="settings-layout">
          {/* Sidebar de pestañas */}
          <aside className="settings-sidebar">
            <div className="settings-sidebar-header">
              <i className="fas fa-shield-halved"></i>
              <span>{t('settings.title')}</span>
            </div>
            <nav className="settings-nav">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  className={`settings-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <i className={`fas ${tab.icon}`}></i>
                  {t(`settings.tabs.${tab.id}`)}
                </button>
              ))}
            </nav>
          </aside>

          {/* Contenido de la pestaña activa */}
          <main className="settings-main">
            <header className="settings-main-header">
              <h2>{tabs.find(t => t.id === activeTab)?.label}</h2>
            </header>

            <div className="settings-content">
              {activeTab === 'general' && renderGeneralTab()}
              {activeTab === 'appearance' && renderAppearanceTab()}
              {activeTab === 'states' && renderStatesTab()}
              {activeTab === 'shortcuts' && renderShortcutsTab()}
              {activeTab === 'data' && renderDataTab()}
            </div>

            <footer className="settings-main-footer">
              <button onClick={onClose} className="btn-sub">
                {t('common.cancel')}
              </button>
              <button onClick={handleSave} className="btn-primary">
                {t('common.save')}
              </button>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
