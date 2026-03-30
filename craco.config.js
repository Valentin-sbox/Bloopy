// Configuración de CRACO para personalizar webpack sin eject
module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Deshabilitar ESLint plugin completamente
      webpackConfig.plugins = webpackConfig.plugins.filter(
        plugin => plugin.constructor.name !== 'ESLintWebpackPlugin'
      );

      // SOLUCIÓN COMPLETA para error 'he' - Deshabilitar minificación agresiva
      if (webpackConfig.optimization && webpackConfig.optimization.minimizer) {
        webpackConfig.optimization.minimizer.forEach((minimizer) => {
          // Check for TerserPlugin more robustly
          if (minimizer.constructor.name === 'TerserPlugin' || (minimizer.options && minimizer.options.terserOptions)) {
            minimizer.options.terserOptions = {
              ...minimizer.options.terserOptions,
              mangle: false, // Deshabilitar mangling de nombres
              keep_classnames: true,
              keep_fnames: true,
              compress: {
                ...minimizer.options.terserOptions?.compress,
                // Deshabilitar optimizaciones que causan problemas de orden
                sequences: false,
                join_vars: false,
                collapse_vars: false,
                reduce_vars: false,
                hoist_vars: false,
                hoist_funs: false,
                // Mantener orden de evaluación
                side_effects: false,
                pure_getters: false,
              },
              output: {
                ...minimizer.options.terserOptions?.output,
                beautify: false,
                comments: false,
              }
            };
          }
        });
      }

      // Deshabilitar concatenación de módulos que puede causar problemas de orden
      if (webpackConfig.optimization) {
        webpackConfig.optimization.concatenateModules = false;
      }
      
      return webpackConfig;
    },
  },
};
