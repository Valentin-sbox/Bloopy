#!/usr/bin/env node

/**
 * ===========================================================================
 * BUILD RELEASE SCRIPT - BlockGuard v4.1.0
 * ===========================================================================
 * 
 * Crea una nueva versión de BlockGuard:
 * 1. Limpia directorios anteriores
 * 2. Compila la app React
 * 3. Empaquet con Electron en .exe
 * 4. Genera el instalador NSIS
 * 5. Copia archivos a dist/
 * 
 * Uso: npm run build-release
 * ===========================================================================
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

const projectRoot = path.join(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const buildDir = path.join(projectRoot, 'build');

// Colores para terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, icon, message) {
  console.log(`${color}${icon} ${message}${colors.reset}`);
}

function logSection(title) {
  console.log(`\n${colors.bright}${colors.blue}═══════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}${title}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════${colors.reset}\n`);
}

try {
  logSection('BLOCKGUARD BUILD RELEASE v4.1.0');

  // Paso 1: Limpiar directorios anteriores
  logSection('1️⃣  LIMPIANDO DIRECTORIOS');
  
  log(colors.cyan, '🗑️ ', 'Eliminando directorios anteriores...');
  if (fs.existsSync(buildDir)) {
    fs.removeSync(buildDir);
  }
  if (fs.existsSync(distDir)) {
    fs.removeSync(distDir);
  }
  fs.ensureDirSync(distDir);
  log(colors.green, '✓', 'Directorios limpios');

  // Paso 2: Construir la aplicación React
  logSection('2️⃣  COMPILANDO APLICACIÓN REACT');
  
  log(colors.cyan, '🔨', 'Compilando aplicación React...');
  execSync('npm run build', {
    cwd: projectRoot,
    stdio: 'inherit'
  });
  log(colors.green, '✓', 'Aplicación compilada correctamente');

  // Paso 3: Preparar archivos para NSIS (estructura necesaria)
  logSection('3️⃣  PREPARANDO ARCHIVOS PARA NSIS');
  
  log(colors.cyan, '📂', 'Preparando estructura de archivos...');
  
  // Crear la estructura que NSIS espera: dist/win-unpacked/
  const winUnpackedDir = path.join(distDir, 'win-unpacked');
  fs.ensureDirSync(winUnpackedDir);
  
  // Copiar build/ contenido a dist/win-unpacked
  const buildPath = path.join(projectRoot, 'build');
  const publicPath = path.join(projectRoot, 'public');
  
  // Copiar archivos de build
  if (fs.existsSync(buildPath)) {
    fs.copySync(buildPath, path.join(winUnpackedDir, 'build'));
  }
  
  // Copiar archivos de public
  if (fs.existsSync(publicPath)) {
    fs.copySync(publicPath, path.join(winUnpackedDir, 'public'));
  }
  
  // Copiar node_modules (esencial para Electron)
  const nodeModulesSource = path.join(projectRoot, 'node_modules');
  const nodeModulesDest = path.join(winUnpackedDir, 'node_modules');
  if (fs.existsSync(nodeModulesSource) && !fs.existsSync(nodeModulesDest)) {
    log(colors.yellow, '⏳', 'Copiando node_modules (esto puede tardar)...');
    fs.copySync(nodeModulesSource, nodeModulesDest);
  }
  
  // Copiar package.json
  const packageJsonSource = path.join(projectRoot, 'package.json');
  if (fs.existsSync(packageJsonSource)) {
    fs.copySync(packageJsonSource, path.join(winUnpackedDir, 'package.json'));
  }
  
  log(colors.green, '✓', 'Archivos preparados correctamente');
  
  // Paso 4: Compilar el instalador NSIS
  logSection('4️⃣  COMPILANDO INSTALADOR NSIS');
  
  log(colors.cyan, '📝', 'Compilando script NSIS...');
  const nsiScript = path.join(projectRoot, 'BlockGuard.nsi');
  
  if (!fs.existsSync(nsiScript)) {
    throw new Error('❌ BlockGuard.nsi no encontrado');
  }

  execSync(`makensis "${nsiScript}"`, {
    cwd: projectRoot,
    stdio: 'inherit'
  });
  log(colors.green, '✓', 'Instalador NSIS compilado');

  // Paso 5: Verificar archivos generados
  logSection('5️⃣  VERIFICANDO ARCHIVOS GENERADOS');

  const exePath = path.join(projectRoot, 'dist', 'BlockGuard-Setup-4.1.0.exe');
  const portableExePath = path.join(projectRoot, 'dist', 'win-unpacked', 'BlockGuard.exe');

  let installerFound = false;
  let portableFound = false;

  if (fs.existsSync(exePath)) {
    const stats = fs.statSync(exePath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    log(colors.green, '✓', `Instalador: BlockGuard-Setup-4.1.0.exe (${sizeMB} MB)`);
    installerFound = true;
  }

  // Buscar el .exe portable en diferentes ubicaciones
  if (fs.existsSync(portableExePath)) {
    const stats = fs.statSync(portableExePath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    log(colors.green, '✓', `Portable: BlockGuard.exe (${sizeMB} MB)`);
    portableFound = true;
  } else {
    // Buscar en dist/ directamente
    const distExes = fs.readdirSync(distDir).filter(f => f.endsWith('.exe') && !f.includes('Setup'));
    if (distExes.length > 0) {
      distExes.forEach(exe => {
        const fullPath = path.join(distDir, exe);
        const stats = fs.statSync(fullPath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        log(colors.green, '✓', `Portable: ${exe} (${sizeMB} MB)`);
      });
      portableFound = true;
    }
  }

  if (!installerFound && !portableFound) {
    log(colors.yellow, '⚠️ ', 'No se encontraron archivos ejecutables');
  }

  // Resumen final
  logSection('✨ PROCESO COMPLETADO');
  
  console.log(`${colors.bright}${colors.green}✓ Versión 4.1.0 generada correctamente${colors.reset}\n`);
  console.log(`${colors.cyan}📁 Archivos en: ${path.relative(projectRoot, distDir)}/${colors.reset}\n`);
  console.log(`${colors.bright}Archivos generados:${colors.reset}`);
  
  const filesInDist = fs.readdirSync(distDir);
  filesInDist.forEach(file => {
    const fullPath = path.join(distDir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isFile()) {
      const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
      console.log(`  ${colors.green}✓${colors.reset} ${file} (${sizeMB} MB)`);
    }
  });

  console.log(`\n${colors.bright}${colors.green}🎉 ¡Listo para distribuir!${colors.reset}\n`);

} catch (error) {
  logSection('❌ ERROR EN EL PROCESO');
  console.error(`${colors.bright}${error.message}${colors.reset}\n`);
  process.exit(1);
}
