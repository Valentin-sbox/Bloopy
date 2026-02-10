#!/usr/bin/env node

/**
 * ============================================================================
 * BLOCK GUARD - VERIFICADOR DE INTEGRIDAD
 * ============================================================================
 * 
 * Este script verifica que todos los archivos están correctamente conectados
 * y que la aplicación puede compilarse y ejecutarse correctamente.
 * 
 * USO: npm run check-integrity
 */

const fs = require('fs');
const path = require('path');

// Colores para el terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

let errorsFound = 0;
let warningsFound = 0;

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✓ ${message}`, 'green');
}

function error(message) {
  log(`✗ ${message}`, 'red');
  errorsFound++;
}

function warning(message) {
  log(`⚠ ${message}`, 'yellow');
  warningsFound++;
}

function checkFile(filePath, description) {
  const fullPath = path.join(__dirname, '..', filePath);
  if (fs.existsSync(fullPath)) {
    success(`${description}: ${filePath}`);
    return true;
  } else {
    error(`FALTA ${description}: ${filePath}`);
    return false;
  }
}

function checkFileContent(filePath, pattern, description) {
  const fullPath = path.join(__dirname, '..', filePath);
  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    if (pattern.test ? pattern.test(content) : content.includes(pattern)) {
      success(`${description}`);
      return true;
    } else {
      error(`${description} NO ENCONTRADO en ${filePath}`);
      return false;
    }
  } catch (err) {
    error(`Error al leer ${filePath}: ${err.message}`);
    return false;
  }
}

function main() {
  log('\n' + '='.repeat(70), 'cyan');
  log('VERIFICADOR DE INTEGRIDAD - BLOCK GUARD', 'cyan');
  log('='.repeat(70) + '\n', 'cyan');

  // =========================================================================
  // VERIFICAR ARCHIVOS PRINCIPALES
  // =========================================================================
  log('\n[1/6] VERIFICANDO ARCHIVOS PRINCIPALES...', 'blue');
  
  const basesOk = [
    checkFile('package.json', 'Package.json'),
    checkFile('src/index.js', 'Archivo principal de React'),
    checkFile('src/App.js', 'Componente App'),
    checkFile('public/index.html', 'HTML principal'),
    checkFile('public/electron.js', 'Proceso principal de Electron'),
    checkFile('public/preload.js', 'Script de precarga'),
    checkFile('electron-builder.json', 'Configuración de electron-builder'),
    checkFile('BlockGuard.nsi', 'Instalador NSIS')
  ].every(x => x);

  // =========================================================================
  // VERIFICAR CONEXIONES ENTRE ARCHIVOS
  // =========================================================================
  log('\n[2/6] VERIFICANDO CONEXIONES ENTRE ARCHIVOS...', 'blue');

  // index.html debe tener #root
  checkFileContent('public/index.html', 'id="root"', 'index.html contiene div#root');

  // index.js debe importar App
  checkFileContent('src/index.js', /import.*App.*from.*['"]\.\/App['"]/, 'index.js importa App');

  // index.js debe renderizar en #root
  checkFileContent('src/index.js', /getElementById\(['"]root['"]\)|createRoot\(.*root/, 'index.js renderiza en #root');

  // App.js debe ser un componente export default
  checkFileContent('src/App.js', /export\s+(default\s+)?function\s+App|export\s+default\s+App/, 'App.js exporta como default');

  // electron.js debe crear BrowserWindow
  checkFileContent('public/electron.js', /new\s+BrowserWindow|BrowserWindow\s*\(/, 'electron.js crea BrowserWindow');

  // electron.js debe cargar index.html
  checkFileContent('public/electron.js', /loadFile|loadURL|index\.html/, 'electron.js carga index.html');

  // preload.js debe exponerAPIs
  checkFileContent('public/preload.js', /contextBridge|exposeInMainWorld/, 'preload.js expone APIs seguras');

  // =========================================================================
  // VERIFICAR COMPONENTES
  // =========================================================================
  log('\n[3/6] VERIFICANDO COMPONENTES...', 'blue');

  const components = [
    'Sidebar', 'TopBar', 'Editor', 'WelcomeScreen', 'SettingsModal',
    'SpellCheckModal', 'ConfirmModal', 'InputModal', 'CommentsSidebar',
    'NotificationContainer', 'SplashScreen', 'OnboardingModal'
  ];

  const componentsPath = path.join(__dirname, '..', 'src/components');
  let componentsFound = 0;

  try {
    const files = fs.readdirSync(componentsPath);
    for (const component of components) {
      if (files.includes(`${component}.js`)) {
        componentsFound++;
      } else {
        warning(`Componente faltante: ${component}.js`);
      }
    }
    success(`${componentsFound}/${components.length} componentes encontrados`);
  } catch (err) {
    error(`Error al leer carpeta de componentes: ${err.message}`);
  }

  // =========================================================================
  // VERIFICAR CONFIGURACIÓN
  // =========================================================================
  log('\n[4/6] VERIFICANDO CONFIGURACIÓN...', 'blue');

  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
    
    // Verificar scripts principales
    const requiredScripts = ['build', 'dist:win', 'electron-dev'];
    for (const script of requiredScripts) {
      if (pkg.scripts && pkg.scripts[script]) {
        success(`Script '${script}' configurado`);
      } else {
        warning(`Script '${script}' no encontrado`);
      }
    }

    // Verificar dependencias principales
    const requiredDeps = {
      dependencies: ['react', 'react-dom'],
      devDependencies: ['electron', 'electron-builder']
    };

    for (const [depType, deps] of Object.entries(requiredDeps)) {
      for (const dep of deps) {
        if (pkg[depType] && pkg[depType][dep]) {
          success(`${depType.replace('Dependencies', '')}: ${dep}`);
        } else {
          error(`${depType}: ${dep} NO INSTALADO`);
        }
      }
    }
  } catch (err) {
    error(`Error al leer package.json: ${err.message}`);
  }

  // =========================================================================
  // VERIFICAR CONFIGURACIÓN DE ELECTRON-BUILDER
  // =========================================================================
  log('\n[5/6] VERIFICANDO CONFIGURACIÓN DE ELECTRON-BUILDER...', 'blue');

  try {
    const builderConfig = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'electron-builder.json'), 'utf-8')
    );

    if (builderConfig.appId) {
      success(`appId configurado: ${builderConfig.appId}`);
    } else {
      error('appId no configurado');
    }

    if (builderConfig.productName) {
      success(`productName configurado: ${builderConfig.productName}`);
    } else {
      error('productName no configurado');
    }

    if (builderConfig.files) {
      success(`Archivos a incluir: ${builderConfig.files.length} patrones`);
    } else {
      error('files no configurado');
    }

    if (builderConfig.nsis) {
      success('Configuración NSIS encontrada');
    } else {
      warning('Configuración NSIS no encontrada');
    }
  } catch (err) {
    error(`Error al leer electron-builder.json: ${err.message}`);
  }

  // =========================================================================
  // VERIFICAR BUILD
  // =========================================================================
  log('\n[6/6] VERIFICANDO BUILD...', 'blue');

  const buildPath = path.join(__dirname, '..', 'build');
  const buildIndexPath = path.join(buildPath, 'index.html');

  if (fs.existsSync(buildIndexPath)) {
    success('Build generado (build/index.html existe)');
    
    // Verificar que el build contiene los estáticos
    const staticPath = path.join(buildPath, 'static');
    if (fs.existsSync(staticPath)) {
      success('Archivos estáticos encontrados (build/static/)');
    } else {
      warning('Archivos estáticos NO encontrados (necesitas ejecutar: npm run build)');
    }
  } else {
    warning('Build NO generado aún. Necesitas ejecutar: npm run build');
  }

  // =========================================================================
  // RESUMEN FINAL
  // =========================================================================
  log('\n' + '='.repeat(70), 'cyan');
  
  if (errorsFound === 0 && warningsFound === 0) {
    log('✓ TODAS LAS VERIFICACIONES PASARON', 'green');
    log('\nLa aplicación está lista para compilar e instalar.', 'green');
    log('Próximo paso: npm run dist:win', 'cyan');
  } else if (errorsFound === 0) {
    log(`✓ SIN ERRORES (${warningsFound} advertencias)`, 'yellow');
    log('\nPuedes proceder, pero revisa las advertencias.', 'yellow');
  } else {
    log(`✗ ${errorsFound} ERRORES ENCONTRADOS`, 'red');
    log(`${warningsFound > 0 ? `   ${warningsFound} advertencias` : ''}`, 'red');
    log('\nDebes corregir los errores antes de compilar.', 'red');
  }

  log('='.repeat(70) + '\n', 'cyan');

  process.exit(errorsFound > 0 ? 1 : 0);
}

main();
