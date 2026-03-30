/**
 * CONFIG-OVERRIDE PARA BLOOPY (MASIFICADOR)
 *
 * Objetivo: Mantener la corrección (especialmente el bug de "he")
 * mientras se permite que webpack haga optimizaciones de producción (minificación, tree-shaking).
 */

module.exports = function override(config, env) {
  console.log('\n🔧 [CONFIG-OVERRIDE] Aplicando configuraciones personalizadas (OPTIMIZADAS)...\n');

  // 0. CACHE: filesystem cache en desarrollo, deshabilitado en producción
  if (env === 'development') {
    config.cache = {
      type: 'filesystem',
      buildDependencies: { config: [__filename] }
    };
    console.log('   ✓ Cache de webpack FILESYSTEM habilitado (desarrollo)\n');
  } else {
    config.cache = false;
    console.log('   ✓ Cache de webpack DESHABILITADO (producción)\n');
  }

  // 1. DESHABILITAR MINIFICACIÓN HTML (bug conocido con "he")
  config.plugins = config.plugins.map(plugin => {
    if (plugin.constructor.name === 'HtmlWebpackPlugin') {
      console.log('   ✓ HtmlWebpackPlugin encontrado');

      // Crear nueva instancia con minify deshabilitado
      const newOptions = {
        ...plugin.options,
        minify: false
      };

      const HtmlWebpackPlugin = require('html-webpack-plugin');
      console.log('   ✓ Minificación HTML DESHABILITADA\n');

      return new HtmlWebpackPlugin(newOptions);
    }
    return plugin;
  });

  // 2. MINIFICACIÓN JS: habilitada con seguridad para evitar romper la app
  const disableJSMinify = process.env.DISABLE_MINIFY_JS === 'true';

  // Asegurar que optimization existe
  if (!config.optimization) {
    config.optimization = {};
  }

  // SIEMPRE deshabilitar concatenación de módulos (scope hoisting) para evitar TDZ errors con clases Lexical
  // Esto aplica tanto en desarrollo como en producción
  config.optimization.concatenateModules = false;
  console.log('   ✓ Concatenación de módulos DESHABILITADA (evita TDZ errors)\n');

  if (disableJSMinify) {
    console.log('   ✓ Minificación JS deshabilitada (DISABLE_MINIFY_JS=true)\n');
    config.optimization.minimize = false;
    config.optimization.minimizer = [];
  } else if (env === 'production') {
    // Habilitar minificación para bundles más pequeños (MASIFICADOR)
    config.optimization.minimize = true;

    // Ajustar Terser para mantener nombres de clases/funciones (evita rupturas)
    if (config.optimization.minimizer && Array.isArray(config.optimization.minimizer)) {
      config.optimization.minimizer = config.optimization.minimizer.map((minimizer) => {
        if (minimizer.constructor && minimizer.constructor.name === 'TerserPlugin') {
          minimizer.options = minimizer.options || {};
          minimizer.options.terserOptions = {
            ...minimizer.options.terserOptions,
            keep_classnames: true,
            keep_fnames: true,
            output: {
              ...minimizer.options.terserOptions?.output,
              comments: false
            }
          };
        }
        return minimizer;
      });
      console.log('   ✓ Minificación JavaScript OPTIMIZADA (keep_classnames, keep_fnames)\n');
    }
  }

  console.log('🎉 [CONFIG-OVERRIDE] Configuración aplicada exitosamente\n');
  
  return config;
};
