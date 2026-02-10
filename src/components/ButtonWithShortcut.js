/**
 * ============================================================================
 * BLOCK GUARD v4.0.0 - BUTTONWITHSHORTCUT.JS
 * ============================================================================
 * 
 * COMPONENTE: BOTÓN CON ATAJO DE TECLADO INTEGRADO
 * 
 * Componente reutilizable que proporciona:
 * - Botón con vista previa del atajo en el title
 * - Registro automático del callback en el sistema centralizado
 * - Sincronización cuando cambian los atajos
 * - Estilos consistentes con la aplicación
 * 
 * USO:
 * <ButtonWithShortcut 
 *   shortcutId="save"
 *   onClick={handleSave}
 *   icon="fa-save"
 *   label="Guardar"
 *   variant="primary"
 * />
 * 
 * PROPS:
 * - shortcutId: string - ID del atajo en el sistema (requerido)
 * - onClick: function - Callback al hacer click (requerido)
 * - icon: string - Clase de Font Awesome (ej: 'fa-save')
 * - label: string - Texto del botón
 * - variant: 'primary' | 'secondary' | 'icon' (default: 'icon')
 * - disabled: boolean (default: false)
 * - className: string - Clases CSS adicionales
 * - tooltip: string - Tooltip personalizado (sobrescribe el automático)
 * 
 * RELACIONADO CON:
 * - src/utils/shortcuts.js: Sistema centralizado de atajos
 * - src/styles/index.css: Estilos base de botones
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import { getShortcutTitle, registerShortcutCallback, unregisterShortcutCallback, subscribeToShortcutChanges } from '../utils/shortcuts';

export default function ButtonWithShortcut({
  shortcutId,
  onClick,
  icon,
  label,
  variant = 'icon',
  disabled = false,
  className = '',
  tooltip
}) {
  // Estado para actualizar título cuando cambian los atajos
  const [shortcutDisplay, setShortcutDisplay] = useState('');

  /**
   * Efecto: Registrar callback y suscribirse a cambios de atajos
   */
  useEffect(() => {
    if (!shortcutId) {
      console.warn('ButtonWithShortcut: shortcutId es requerido');
      return;
    }

    // Actualizar display del atajo
    const title = getShortcutTitle(shortcutId);
    setShortcutDisplay(title);

    // Registrar el callback
    const unregister = registerShortcutCallback(shortcutId, onClick);

    // Suscribirse a cambios en los atajos
    const unsubscribe = subscribeToShortcutChanges(() => {
      const newTitle = getShortcutTitle(shortcutId);
      setShortcutDisplay(newTitle);
    });

    // Limpiar al desmontar
    return () => {
      unregister();
      unsubscribe();
    };
  }, [shortcutId, onClick]);

  // Determinar clases CSS del botón
  let buttonClassName = className;
  const baseClasses = ['button-with-shortcut'];

  if (variant === 'primary') {
    baseClasses.push('btn-primary-small');
  } else if (variant === 'secondary') {
    baseClasses.push('btn-secondary');
  } else {
    baseClasses.push('btn-icon');
  }

  if (disabled) {
    baseClasses.push('disabled');
  }

  buttonClassName = `${baseClasses.join(' ')} ${className}`;

  // Determinar título (tooltip)
  const finalTooltip = tooltip || shortcutDisplay;

  return (
    <button
      className={buttonClassName}
      onClick={onClick}
      disabled={disabled}
      title={finalTooltip}
      aria-label={label || shortcutId}
    >
      {icon && <i className={`fas ${icon}`}></i>}
      {label && variant !== 'icon' && <span>{label}</span>}
    </button>
  );
}
