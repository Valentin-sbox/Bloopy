/**
 * ============================================================================
 *  CONFIG MIGRATION
 * ============================================================================
 * 
 * SISTEMA DE MIGRACIÓN DE CONFIGURACIÓN
 * 
 * Este módulo maneja la migración de datos de versiones anteriores
 * a la estructura actual de configuración.
 * 
 * MIGRACIONES:
 * - v1 -> v2: Migrar temas personalizados de localStorage a config
 * - Futuras migraciones se agregarán aquí
 * 
 * ============================================================================
 */

/**
 * Migra temas personalizados de localStorage a config
 * 
 * @param {Object} config - Configuración actual
 * @returns {Object} Configuración con temas migrados
 */
export function migrateCustomThemeFromLocalStorage(config) {
  try {
    // Verificar si ya tiene customColors en config
    if (config.customColors) {
      console.log('[MIGRATION] customColors ya existe en config, saltando migración');
      return config;
    }

    // Intentar cargar de localStorage
    const storedCustomTheme = localStorage.getItem('customTheme');
    const storedCustomThemeName = localStorage.getItem('customThemeName');

    if (storedCustomTheme) {
      console.log('[MIGRATION] Migrando tema personalizado de localStorage a config');
      
      const customColors = JSON.parse(storedCustomTheme);
      const customThemeName = storedCustomThemeName || 'Mi Tema';

      // Agregar a config
      const migratedConfig = {
        ...config,
        customColors,
        customThemeName
      };

      console.log('[MIGRATION] Tema migrado exitosamente:', customThemeName);
      
      // Opcional: Limpiar localStorage después de migrar
      // localStorage.removeItem('customTheme');
      // localStorage.removeItem('customThemeName');

      return migratedConfig;
    }

    console.log('[MIGRATION] No hay tema personalizado en localStorage para migrar');
    return config;

  } catch (error) {
    console.error('[MIGRATION] Error al migrar tema personalizado:', error);
    return config;
  }
}

/**
 * Ejecuta todas las migraciones necesarias
 * 
 * @param {Object} config - Configuración actual
 * @returns {Object} Configuración migrada
 */
export function migrateConfig(config) {
  console.log('[MIGRATION] Iniciando migraciones de configuración...');
  
  let migratedConfig = { ...config };

  // Ejecutar migraciones en orden
  migratedConfig = migrateCustomThemeFromLocalStorage(migratedConfig);

  // Agregar versión de config si no existe
  if (!migratedConfig.configVersion) {
    migratedConfig.configVersion = 2; // Versión actual
  }

  console.log('[MIGRATION] Migraciones completadas');
  return migratedConfig;
}

/**
 * Valida que la configuración tenga todos los campos requeridos
 * 
 * @param {Object} config - Configuración a validar
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateConfig(config) {
  const errors = [];

  // Validar campos requeridos
  if (!config.theme) {
    errors.push('Falta campo requerido: theme');
  }

  if (!config.states || !Array.isArray(config.states)) {
    errors.push('Falta campo requerido: states (debe ser array)');
  }

  if (typeof config.autosaveInterval !== 'number') {
    errors.push('Campo autosaveInterval debe ser número');
  }

  if (typeof config.defaultGoal !== 'number') {
    errors.push('Campo defaultGoal debe ser número');
  }

  // Validar estados
  if (config.states && Array.isArray(config.states)) {
    config.states.forEach((state, index) => {
      if (!state.id) {
        errors.push(`Estado ${index}: falta campo 'id'`);
      }
      if (!state.name) {
        errors.push(`Estado ${index}: falta campo 'name'`);
      }
      if (!state.color) {
        errors.push(`Estado ${index}: falta campo 'color'`);
      }
      if (typeof state.goal !== 'number') {
        errors.push(`Estado ${index}: campo 'goal' debe ser número`);
      }
      if (!['absolute', 'edited', 'delta'].includes(state.countType)) {
        errors.push(`Estado ${index}: countType inválido (debe ser 'absolute', 'edited' o 'delta')`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitiza la configuración eliminando campos inválidos
 * 
 * @param {Object} config - Configuración a sanitizar
 * @returns {Object} Configuración sanitizada
 */
export function sanitizeConfig(config) {
  const sanitized = { ...config };

  // Asegurar que autosaveInterval esté en rango válido
  if (sanitized.autosaveInterval < 10) {
    sanitized.autosaveInterval = 10;
  }
  if (sanitized.autosaveInterval > 300) {
    sanitized.autosaveInterval = 300;
  }

  // Asegurar que defaultGoal esté en rango válido
  if (sanitized.defaultGoal < 1000) {
    sanitized.defaultGoal = 1000;
  }
  if (sanitized.defaultGoal > 1000000) {
    sanitized.defaultGoal = 1000000;
  }

  // Asegurar que states tenga al menos un elemento
  if (!sanitized.states || sanitized.states.length === 0) {
    sanitized.states = [
      {
        id: 'draft',
        name: 'Primer Borrador',
        color: '#ff3b30',
        goal: 30000,
        countType: 'absolute'
      }
    ];
  }

  return sanitized;
}
