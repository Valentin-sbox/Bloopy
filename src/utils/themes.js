/**
 * ============================================================================
 * BLOCK GUARD v4.0.0 - THEMES.JS
 * ============================================================================
 * 
 * SISTEMA DE TEMAS DE COLORES
 * 
 * Este módulo define todos los temas visuales disponibles en la aplicación
 * y proporciona funciones para aplicarlos dinámicamente.
 * 
 * ESTRUCTURA DE UN TEMA:
 * Cada tema es un objeto con variables CSS que definen:
 * - Colores de fondo (bg-primary, bg-secondary, bg-tertiary)
 * - Colores de texto (text-primary, text-secondary, text-tertiary)
 * - Colores de acento (accent-blue, accent-red, etc.)
 * - Bordes y sombras
 * 
 * TEMAS DISPONIBLES:
 * - dark: Tema oscuro por defecto
 * - light: Tema claro
 * - midnight: Azul oscuro profundo
 * - forest: Verde oscuro natural
 * - lavender: Púrpura elegante
 * - cyber: Estilo cyberpunk neón
 * 
 * RELACIONADO CON:
 * - src/styles/index.css: Usa las variables CSS definidas aquí
 * - src/components/SettingsModal.js: Permite cambiar de tema
 * - src/App.js: Aplica el tema seleccionado al cargar
 * ============================================================================
 */

// =============================================================================
// DEFINICIÓN DE TEMAS
// =============================================================================

/**
 * Objeto que contiene todos los temas disponibles.
 * Cada tema es un mapeo de nombres de variables CSS a valores de color.
 */
export const themes = {
  
  // ---------------------------------------------------------------------------
  // TEMA OSCURO (por defecto)
  // ---------------------------------------------------------------------------
  dark: {
    // Fondos
    '--bg-primary': '#0a0a0a',
    '--bg-secondary': '#121212',
    '--bg-tertiary': '#1d1d1d',
    '--bg-hover': 'rgba(255, 255, 255, 0.05)',
    '--bg-active': 'rgba(0, 113, 227, 0.1)',
    
    // Texto
    '--text-primary': '#f5f5f7',
    '--text-secondary': '#86868b',
    '--text-tertiary': '#6e6e73',
    
    // Acentos
    '--accent-blue': '#0071e3',
    '--accent-red': '#ff3b30',
    '--accent-orange': '#ff9500',
    '--accent-green': '#34c759',
    '--accent-purple': '#af52de',
    '--accent-pink': '#ff2d55',
    
    // Bordes
    '--border-color': 'rgba(255, 255, 255, 0.08)',
    '--border-hover': 'rgba(255, 255, 255, 0.15)',
    
    // Sombras
    '--shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.3)',
    '--shadow-md': '0 4px 12px rgba(0, 0, 0, 0.4)',
    '--shadow-lg': '0 8px 30px rgba(0, 0, 0, 0.5)',
    '--shadow-float': '0 4px 20px rgba(0, 0, 0, 0.6)'
  },
  
  // ---------------------------------------------------------------------------
  // TEMA CLARO
  // ---------------------------------------------------------------------------
  light: {
    '--bg-primary': '#ffffff',
    '--bg-secondary': '#f5f5f7',
    '--bg-tertiary': '#e8e8ed',
    '--bg-hover': 'rgba(0, 0, 0, 0.04)',
    '--bg-active': 'rgba(0, 113, 227, 0.08)',
    
    '--text-primary': '#1d1d1f',
    '--text-secondary': '#86868b',
    '--text-tertiary': '#a1a1a6',
    
    '--accent-blue': '#0071e3',
    '--accent-red': '#ff3b30',
    '--accent-orange': '#ff9500',
    '--accent-green': '#34c759',
    '--accent-purple': '#af52de',
    '--accent-pink': '#ff2d55',
    
    '--border-color': 'rgba(0, 0, 0, 0.08)',
    '--border-hover': 'rgba(0, 0, 0, 0.15)',
    
    '--shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.08)',
    '--shadow-md': '0 4px 12px rgba(0, 0, 0, 0.1)',
    '--shadow-lg': '0 8px 30px rgba(0, 0, 0, 0.12)',
    '--shadow-float': '0 4px 20px rgba(0, 0, 0, 0.15)'
  },
  
  // ---------------------------------------------------------------------------
  // TEMA MIDNIGHT (azul profundo)
  // ---------------------------------------------------------------------------
  midnight: {
    '--bg-primary': '#0d1b2a',
    '--bg-secondary': '#1b263b',
    '--bg-tertiary': '#243b53',
    '--bg-hover': 'rgba(100, 181, 246, 0.08)',
    '--bg-active': 'rgba(100, 181, 246, 0.15)',
    
    '--text-primary': '#e0e1dd',
    '--text-secondary': '#778da9',
    '--text-tertiary': '#415a77',
    
    '--accent-blue': '#64b5f6',
    '--accent-red': '#ef5350',
    '--accent-orange': '#ffa726',
    '--accent-green': '#66bb6a',
    '--accent-purple': '#ab47bc',
    '--accent-pink': '#f06292',
    
    '--border-color': 'rgba(255, 255, 255, 0.08)',
    '--border-hover': 'rgba(255, 255, 255, 0.15)',
    
    '--shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.4)',
    '--shadow-md': '0 4px 12px rgba(0, 0, 0, 0.5)',
    '--shadow-lg': '0 8px 30px rgba(0, 0, 0, 0.6)',
    '--shadow-float': '0 4px 20px rgba(0, 0, 0, 0.7)'
  },
  
  // ---------------------------------------------------------------------------
  // TEMA FOREST (verde natural)
  // ---------------------------------------------------------------------------
  forest: {
    '--bg-primary': '#1a1f1b',
    '--bg-secondary': '#242d26',
    '--bg-tertiary': '#2d3a31',
    '--bg-hover': 'rgba(129, 199, 132, 0.08)',
    '--bg-active': 'rgba(129, 199, 132, 0.15)',
    
    '--text-primary': '#e8f5e9',
    '--text-secondary': '#a5d6a7',
    '--text-tertiary': '#66bb6a',
    
    '--accent-blue': '#81c784',
    '--accent-red': '#e57373',
    '--accent-orange': '#ffb74d',
    '--accent-green': '#4caf50',
    '--accent-purple': '#ba68c8',
    '--accent-pink': '#f06292',
    
    '--border-color': 'rgba(255, 255, 255, 0.08)',
    '--border-hover': 'rgba(255, 255, 255, 0.15)',
    
    '--shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.4)',
    '--shadow-md': '0 4px 12px rgba(0, 0, 0, 0.5)',
    '--shadow-lg': '0 8px 30px rgba(0, 0, 0, 0.6)',
    '--shadow-float': '0 4px 20px rgba(0, 0, 0, 0.7)'
  },
  
  // ---------------------------------------------------------------------------
  // TEMA LAVENDER (púrpura elegante)
  // ---------------------------------------------------------------------------
  lavender: {
    '--bg-primary': '#181824',
    '--bg-secondary': '#252538',
    '--bg-tertiary': '#30304d',
    '--bg-hover': 'rgba(186, 104, 200, 0.08)',
    '--bg-active': 'rgba(186, 104, 200, 0.15)',
    
    '--text-primary': '#f3e5f5',
    '--text-secondary': '#ce93d8',
    '--text-tertiary': '#ab47bc',
    
    '--accent-blue': '#9c7bf8',
    '--accent-red': '#f07178',
    '--accent-orange': '#fabc66',
    '--accent-green': '#86d992',
    '--accent-purple': '#ba68c8',
    '--accent-pink': '#f48fb1',
    
    '--border-color': 'rgba(255, 255, 255, 0.08)',
    '--border-hover': 'rgba(255, 255, 255, 0.15)',
    
    '--shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.4)',
    '--shadow-md': '0 4px 12px rgba(0, 0, 0, 0.5)',
    '--shadow-lg': '0 8px 30px rgba(0, 0, 0, 0.6)',
    '--shadow-float': '0 4px 20px rgba(0, 0, 0, 0.7)'
  },
  
  // ---------------------------------------------------------------------------
  // TEMA CYBER (estilo cyberpunk)
  // ---------------------------------------------------------------------------
  cyber: {
    '--bg-primary': '#0a0f1c',
    '--bg-secondary': '#111827',
    '--bg-tertiary': '#1f2937',
    '--bg-hover': 'rgba(56, 189, 248, 0.08)',
    '--bg-active': 'rgba(56, 189, 248, 0.15)',
    
    '--text-primary': '#f0f9ff',
    '--text-secondary': '#7dd3fc',
    '--text-tertiary': '#38bdf8',
    
    '--accent-blue': '#38bdf8',
    '--accent-red': '#f87171',
    '--accent-orange': '#fb923c',
    '--accent-green': '#4ade80',
    '--accent-purple': '#a78bfa',
    '--accent-pink': '#f472b6',
    
    '--border-color': 'rgba(56, 189, 248, 0.2)',
    '--border-hover': 'rgba(56, 189, 248, 0.4)',
    
    '--shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.5)',
    '--shadow-md': '0 4px 12px rgba(0, 0, 0, 0.6)',
    '--shadow-lg': '0 8px 30px rgba(0, 0, 0, 0.7)',
    '--shadow-float': '0 4px 20px rgba(56, 189, 248, 0.3)'
  }
};

// =============================================================================
// FUNCIONES DE APLICACIÓN DE TEMAS
// =============================================================================

/**
 * Aplica un tema al documento modificando las variables CSS.
 * 
 * PROCESO:
 * 1. Obtiene el tema del objeto themes
 * 2. Itera sobre cada variable CSS
 * 3. Aplica el valor al document.documentElement
 * 4. Guarda el tema en el atributo data-theme del body
 * 
 * @param {string} themeId - ID del tema a aplicar ('dark', 'light', etc.)
 */
export function applyTheme(themeId) {
  let theme = themes.dark;

  if (themeId === 'custom') {
    try {
      const storedCustom = localStorage.getItem('customTheme');
      if (storedCustom) {
        theme = JSON.parse(storedCustom);
      }
    } catch (e) {
      console.error('Error loading custom theme:', e);
    }
  } else {
    theme = themes[themeId] || themes.dark;
  }
  
  // Aplicar cada variable CSS al elemento raíz
  Object.entries(theme).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
  
  // Guardar el tema actual en el body para referencia
  document.body.setAttribute('data-theme', themeId);
}

/**
 * Obtiene el ID del tema actualmente aplicado.
 * 
 * @returns {string} ID del tema actual ('dark', 'light', etc.)
 */
export function getCurrentTheme() {
  return document.body.getAttribute('data-theme') || 'dark';
}

/**
 * Crea un tema personalizado con los colores especificados.
 * 
 * USO: Permitir a usuarios crear sus propios temas.
 * 
 * @param {string} name - Nombre del tema personalizado
 * @param {Object} colors - Objeto con los colores del tema
 * @returns {Object} Objeto de tema personalizado
 */
export function createCustomTheme(name, colors) {
  return {
    name,
    colors: {
      bgPrimary: colors.bgPrimary || '#0a0a0a',
      bgSecondary: colors.bgSecondary || '#121212',
      bgTertiary: colors.bgTertiary || '#1d1d1d',
      accent: colors.accent || '#0071e3',
      accentSecondary: colors.accentSecondary || '#af52de',
      text: colors.text || '#f5f5f7',
      textSecondary: colors.textSecondary || '#86868b',
      border: colors.border || 'rgba(255,255,255,0.08)'
    }
  };
}

/**
 * Lista todos los temas disponibles para mostrar en la UI.
 * 
 * @returns {Array} Array de objetos {id, name}
 */
export function getAvailableThemes() {
  return Object.keys(themes).map(id => ({
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1)
  }));
}
