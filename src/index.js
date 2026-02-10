/**
 * ============================================================================
 * BLOCK GUARD v4.0.0 - INDEX.JS
 * ============================================================================
 * 
 * PUNTO DE ENTRADA DE REACT
 * 
 * Este archivo es el primer código JavaScript que se ejecuta en el navegador.
 * Su responsabilidad es:
 * 1. Importar React y ReactDOM
 * 2. Importar el componente principal App
 * 3. Importar los estilos globales
 * 4. Renderizar la aplicación en el DOM
 * 
 * RELACIONADO CON:
 * - public/index.html: Contiene el div#root donde se monta la app
 * - src/App.js: Componente principal que se renderiza
 * - src/styles/index.css: Estilos globales
 * ============================================================================
 */

import React from 'react';           // Biblioteca principal de React
import ReactDOM from 'react-dom/client';  // React 18+ renderizado

// Importación del componente principal
import App from './App';

// Importación del provider de i18n
import { I18nProvider } from './utils/i18n';

// Importación de estilos globales
import './styles/index.css';

// =============================================================================
// CREACIÓN DEL ROOT Y RENDERIZADO
// =============================================================================

// Crear el root usando la nueva API de React 18
// Esto permite características como Concurrent Features
const root = ReactDOM.createRoot(document.getElementById('root'));

// Renderizar la aplicación con I18nProvider
// StrictMode ayuda a detectar problemas potenciales en desarrollo
root.render(
  <React.StrictMode>
    <I18nProvider initialLanguage="es">
      <App />
    </I18nProvider>
  </React.StrictMode>
);
