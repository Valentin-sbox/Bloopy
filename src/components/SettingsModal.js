
/**
 * ============================================================================
 *  SETTINGSMODAL.JS
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
import BaseModal from './BaseModal';
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
import '../styles/settings-modal.css';
import Icon from '@mdi/react';
import { 
  mdiTune, 
  mdiPalette, 
  mdiTag, 
  mdiKeyboard, 
  mdiDatabase, 
  mdiAccount, 
  mdiCamera, 
  mdiTrashCan, 
  mdiUndo, 
  mdiContentSave, 
  mdiChevronUp, 
  mdiChevronDown, 
  mdiPlus, 
  mdiAlert, 
  mdiCheckCircle, 
  mdiCloseCircle, 
  mdiDownload, 
  mdiUpload, 
  mdiFolder, 
  mdiGithub, 
  mdiHeart,
  mdiClose
} from '@mdi/js';

function SettingsModal({ config, userName, avatar, onClose, onSave, onExport, onImport, notify, onOpenUpdateModal }) {
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
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.getAppVersion) {
      window.electronAPI.getAppVersion().then(setAppVersion).catch(console.error);
    }
  }, []);

  const handleOpenUpdates = () => {
    if (onOpenUpdateModal) {
      onOpenUpdateModal();
      return;
    }

    // Fallback: si no hay callback, intentar abrir desde electronAPI
    if (window.electronAPI?.checkForUpdates) {
      window.electronAPI.checkForUpdates().catch(() => {
        if (notify) notify('Error al abrir actualizaciones', 'error');
      });
    }
  };

  // =============================================================================
  // CONFIGURACIÓN DE PESTAÑAS
  // =============================================================================

  const tabs = [
    { id: 'general', label: 'General', icon: mdiTune },
    { id: 'appearance', label: 'Apariencia', icon: mdiPalette },
    { id: 'states', label: 'Estados', icon: mdiTag },
    { id: 'shortcuts', label: 'Atajos', icon: mdiKeyboard },
    { id: 'data', label: 'Datos', icon: mdiDatabase }
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
      alert(t('settings.general.invalidImage'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert(t('settings.general.imageTooLarge'));
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
   * Añade un nuevo estado custom (con checklist, sin tracking numérico).
   */
  const addState = () => {
    const newState = {
      id: `state_${Date.now()}`,
      name: 'Nuevo Estado',
      color: '#0071e3',
      checklist: []
    };
    setLocalConfig({
      ...localConfig,
      customStates: [...(localConfig.customStates || []), newState]
    });
  };

  /**
   * Actualiza un campo de un estado custom existente.
   */
  const updateState = (index, field, value) => {
    const newStates = [...(localConfig.customStates || [])];
    newStates[index] = { ...newStates[index], [field]: value };
    setLocalConfig({ ...localConfig, customStates: newStates });
  };

  /**
   * Elimina un estado custom.
   */
  const removeState = (index) => {
    const newStates = (localConfig.customStates || []).filter((_, i) => i !== index);
    setLocalConfig({ ...localConfig, customStates: newStates });
  };

  /**
   * Mueve un estado custom arriba o abajo.
   */
  const moveState = (index, direction) => {
    const newStates = [...(localConfig.customStates || [])];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= newStates.length) return;
    [newStates[index], newStates[newIndex]] = [newStates[newIndex], newStates[index]];
    setLocalConfig({ ...localConfig, customStates: newStates });
  };

  /**
   * Agrega un item a la checklist de un estado custom.
   */
  const addChecklistItem = (stateIndex) => {
    const newStates = [...(localConfig.customStates || [])];
    const checklist = [...(newStates[stateIndex].checklist || []), ''];
    newStates[stateIndex] = { ...newStates[stateIndex], checklist };
    setLocalConfig({ ...localConfig, customStates: newStates });
  };

  /**
   * Actualiza un item de checklist.
   */
  const updateChecklistItem = (stateIndex, itemIndex, value) => {
    const newStates = [...(localConfig.customStates || [])];
    const checklist = [...(newStates[stateIndex].checklist || [])];
    checklist[itemIndex] = value;
    newStates[stateIndex] = { ...newStates[stateIndex], checklist };
    setLocalConfig({ ...localConfig, customStates: newStates });
  };

  /**
   * Elimina un item de checklist.
   */
  const removeChecklistItem = (stateIndex, itemIndex) => {
    const newStates = [...(localConfig.customStates || [])];
    const checklist = (newStates[stateIndex].checklist || []).filter((_, i) => i !== itemIndex);
    newStates[stateIndex] = { ...newStates[stateIndex], checklist };
    setLocalConfig({ ...localConfig, customStates: newStates });
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
              <Icon path={mdiAccount} size={2} />
            )}
          </div>
          <div className="avatar-actions">
            <label className="btn-primary-small">
              <Icon path={mdiCamera} size={0.7} /> Cambiar
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
                <Icon path={mdiTrashCan} size={0.7} /> Quitar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Nombre de usuario */}
      <div className="setting-item">
        <label>{t('settings.general.userName')}</label>
        <span className="setting-desc">{t('settings.general.userNameDesc')}</span>
        <input
          type="text"
          value={localUserName}
          onChange={(e) => setLocalUserName(e.target.value)}
          placeholder={t('settings.general.userNamePlaceholder')}
        />
      </div>

      {/* Idioma de la interfaz */}
      <div className="setting-item">
        <label>{t('settings.general.language')}</label>
        <span className="setting-desc">{t('settings.general.languageDesc')}</span>
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
        <label>{t('settings.general.autosave')}</label>
        <span className="setting-desc">{t('settings.general.autosaveDesc')}</span>
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
        <label>{t('settings.general.notifications')}</label>
        <span className="setting-desc">{t('settings.general.notificationsDesc')}</span>
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

      {/* Meta por defecto */}
      <div className="setting-item">
        <label>{t('settings.general.defaultGoalLabel')}</label>
        <span className="setting-desc">{t('settings.general.defaultGoalLabelDesc')}</span>
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
        <label>{t('settings.appearance.themeLabel')}</label>
        <span className="setting-desc">{t('settings.appearance.themeLabelDesc')}</span>
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
        <label>{t('settings.appearance.customColors')}</label>
        <span className="setting-desc">{t('settings.appearance.customColorsDesc')}</span>

        <div className="custom-theme-editor">
          {/* Nombre del tema */}
          <div className="custom-theme-name">
            <label>{t('settings.appearance.themeName')}</label>
            <input
              type="text"
              className="setting-input"
              placeholder={t('settings.appearance.themeNamePlaceholder')}
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
              <Icon path={mdiUndo} size={0.7} /> Restaurar Colores
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                // Aplicar tema personalizado (se guardará al hacer clic en "Guardar" del modal)
                setLocalConfig({ ...localConfig, theme: 'custom' });
              }}
            >
              <Icon path={mdiContentSave} size={0.7} /> Aplicar Tema
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStatesTab = () => {
    const BASE_STATES = [
      { id: 'draft',  label: 'Primer Borrador', goal: 30000, tracking: 'Caracteres escritos' },
      { id: 'review', label: 'Revisión',         goal: 15000, tracking: 'Caracteres editados' },
      { id: 'final',  label: 'Finalizado',        goal: 5000,  tracking: 'Caracteres finales'  },
    ];
    const customStates = localConfig.customStates || [];

    return (
      <div className="settings-tab-content">
        {/* Estados base — fijos */}
        <div className="setting-item">
          <label>Estados base</label>
          <span className="setting-desc">Estos 3 estados son fijos. Solo podés cambiar su color.</span>
          <div className="states-list">
            {BASE_STATES.map((base) => {
              const stateInConfig = localConfig.states?.find(s => s.id === base.id);
              const color = stateInConfig?.color || '#0071e3';
              return (
                <div key={base.id} className="state-config-item state-base">
                  <div className="state-color-dot" style={{ background: color }} />
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => {
                      const newStates = (localConfig.states || []).map(s =>
                        s.id === base.id ? { ...s, color: e.target.value } : s
                      );
                      setLocalConfig({ ...localConfig, states: newStates });
                    }}
                    className="color-picker-small"
                    title="Cambiar color"
                  />
                  <div className="state-fields">
                    <span className="state-base-name">{base.label}</span>
                    <span className="state-base-meta">{base.tracking} · meta {base.goal.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Estados custom — con checklist */}
        <div className="setting-item">
          <label>Estados personalizados</label>
          <span className="setting-desc">Se insertan entre Revisión y Finalizado. Solo tienen checklist, sin tracking numérico.</span>
          <div className="states-list">
            {customStates.map((state, index) => (
              <div key={state.id} className="state-config-item state-custom">
                {/* Reordenar */}
                <div className="state-reorder">
                  <button onClick={() => moveState(index, -1)} disabled={index === 0} className="btn-icon-small">
                    <Icon path={mdiChevronUp} size={0.6} />
                  </button>
                  <button onClick={() => moveState(index, 1)} disabled={index === customStates.length - 1} className="btn-icon-small">
                    <Icon path={mdiChevronDown} size={0.6} />
                  </button>
                </div>

                {/* Color */}
                <input
                  type="color"
                  value={state.color}
                  onChange={(e) => updateState(index, 'color', e.target.value)}
                  className="color-picker-small"
                />

                {/* Nombre */}
                <div className="state-fields" style={{ flex: 1 }}>
                  <input
                    type="text"
                    value={state.name}
                    onChange={(e) => updateState(index, 'name', e.target.value)}
                    placeholder="Nombre del estado"
                    style={{ width: '100%' }}
                  />

                  {/* Checklist items */}
                  <div className="checklist-editor">
                    {(state.checklist || []).map((item, itemIndex) => (
                      <div key={itemIndex} className="checklist-editor-item">
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => updateChecklistItem(index, itemIndex, e.target.value)}
                          placeholder={`Tarea ${itemIndex + 1}`}
                        />
                        <button
                          className="btn-icon-small danger"
                          onClick={() => removeChecklistItem(index, itemIndex)}
                        >
                          <Icon path={mdiClose} size={0.5} />
                        </button>
                      </div>
                    ))}
                    <button className="btn-sub-small" onClick={() => addChecklistItem(index)}>
                      <Icon path={mdiPlus} size={0.6} /> Agregar tarea
                    </button>
                  </div>
                </div>

                {/* Eliminar estado */}
                <button onClick={() => removeState(index)} className="btn-icon-small danger">
                  <Icon path={mdiTrashCan} size={0.7} />
                </button>
              </div>
            ))}
          </div>

          <button onClick={addState} className="btn-sub">
            <Icon path={mdiPlus} size={0.7} /> Añadir Estado Personalizado
          </button>
        </div>
      </div>
    );
  };

  const renderDataTab = () => {
    const handleExportShortcuts = () => {
      const profile = {
        profileName: config.appName || 'Bloopy',
        shortcuts: shortcuts,
        customTheme: config.customTheme || null,
        exportDate: new Date().toISOString()
      };

      const dataStr = JSON.stringify(profile, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Bloopy-shortcuts-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
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
                text: t('settings.shortcuts.invalidFile') || '✗ Archivo inválido: no contiene configuración de atajos'
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
              text: t('settings.shortcuts.invalidJSON') || '✗ Error al leer archivo: formato JSON inválido'
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
            <Icon path={conflictMessage.type === 'warning' ? mdiAlert :
              conflictMessage.type === 'success' ? mdiCheckCircle :
                mdiCloseCircle
              } size={0.7} />
            <span>{conflictMessage.text}</span>
          </div>
        )}

        <div className="setting-item">
          <label>Gestión de datos</label>
          <span className="setting-desc">Exporta o importa tu configuración y datos.</span>
          <div className="data-actions">
            <button onClick={onExport} className="btn-primary">
              <Icon path={mdiDownload} size={0.7} /> Exportar Todo (JSON)
            </button>
            <button onClick={onImport} className="btn-sub">
              <Icon path={mdiUpload} size={0.7} /> Importar Datos
            </button>
          </div>
        </div>

        <div className="setting-item">
          <label>Perfiles de Atajos</label>
          <span className="setting-desc">Exporta e importa tus configuraciones de atajos personalizados.</span>
          <div className="data-actions">
            <button onClick={handleExportShortcuts} className="btn-primary">
              <Icon path={mdiContentSave} size={0.7} /> Exportar Atajos
            </button>
            <button onClick={handleImportShortcuts} className="btn-sub">
              <Icon path={mdiUpload} size={0.7} /> Importar Atajos
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
      e.stopPropagation();

      // Construir combinación de teclas
      const modifiers = [];
      if (e.ctrlKey || e.metaKey) modifiers.push(e.metaKey ? 'Cmd' : 'Ctrl');
      if (e.shiftKey) modifiers.push('Shift');
      if (e.altKey) modifiers.push('Alt');

      // Normalizar nombre de tecla
      let keyName = e.key;

      // Mapear teclas especiales
      const keyMap = {
        ' ': 'Space',
        'Escape': 'Esc',
        'ArrowUp': 'Up',
        'ArrowDown': 'Down',
        'ArrowLeft': 'Left',
        'ArrowRight': 'Right'
      };

      keyName = keyMap[keyName] || keyName.toUpperCase();

      // Ignorar teclas modificadoras solas
      if (['CONTROL', 'SHIFT', 'ALT', 'META', 'CMD'].includes(keyName)) {
        return;
      }

      modifiers.push(keyName);
      const newShortcut = modifiers.join('+');

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
            text: t('settings.shortcuts.invalidKeyCombination') || '✗ Combinación de teclas inválida'
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
            <Icon path={conflictMessage.type === 'warning' ? mdiAlert :
              conflictMessage.type === 'success' ? mdiCheckCircle :
                mdiCloseCircle
              } size={0.7} />
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
              <Icon path={mdiFolder} size={0.7} />{' '}
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
                      {shortcut.icon && <Icon path={shortcut.icon} size={0.7} />}
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
                      <Icon path={mdiUndo} size={0.7} />
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
            <Icon path={mdiUndo} size={0.7} /> Restaurar Todos
          </button>
        </div>
      </div>
    );
  };

  // =============================================================================
  // RENDERIZADO PRINCIPAL
  // =============================================================================

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      title={t('settings.title')}
      size="large"
      className="settings-modal-wrapper"
    >
      <div className="settings-layout">
        {/* Sidebar de pestañas */}
        <aside className="settings-sidebar">
          <nav className="settings-nav">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`settings-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon path={tab.icon} size={0.7} />
                {t(`settings.tabs.${tab.id}`)}
              </button>
            ))}
          </nav>

          {/* Footer: GitHub, Donar, Versión */}
          <div className="settings-sidebar-footer">
            <button
              className="settings-sidebar-icon-btn"
              onClick={() => window.electronAPI.openExternal('https://github.com/Valentin-sbox/Bloopy/')}
              title="GitHub"
            >
              <Icon path={mdiGithub} size={0.7} />
            </button>
            <button
              className="settings-sidebar-icon-btn donate"
              onClick={() => window.electronAPI.openExternal('https://www.paypal.me/Valenhere1')}
              title="Donar"
            >
              <Icon path={mdiHeart} size={0.7} />
            </button>
            <span className="settings-sidebar-version">v{appVersion || '?'}</span>
          </div>
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
    </BaseModal>
  );
}

export default SettingsModal;
