#!/usr/bin/env node

/**
 * Script para generar instalador NSIS directamente SIN electron-builder
 * Esto evita completamente los problemas de firma
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

const projectRoot = __dirname;
const distDir = path.join(projectRoot, 'dist');
const winUnpackedDir = path.join(distDir, 'win-unpacked');

console.log('\n========================================');
console.log('  BlockGuard - Build NSIS Directo');
console.log('  SIN FIRMA / SIN ELECTRON-BUILDER');
console.log('========================================\n');

try {
  // PASO 1: Verificar que build de React existe
  console.log('✅ PASO 1: Verificando build de React...');
  const buildDir = path.join(projectRoot, 'build');
  if (!fs.existsSync(buildDir)) {
    throw new Error('build/ no existe. Ejecuta: npm run build primero');
  }
  console.log('   ✓ build/ existe\n');

  // PASO 2: Limpiar dist anterior
  console.log('🧹 PASO 2: Limpiando dist anterior...');
  if (fs.existsSync(distDir)) {
    fs.removeSync(distDir);
  }
  fs.ensureDirSync(winUnpackedDir);
  console.log('   ✓ dist limpiado\n');

  // PASO 3: Copiar archivos esenciales a win-unpacked
  console.log('📂 PASO 3: Copiando archivos a win-unpacked...');
  
  // Copiar build de React
  console.log('   • Copiando build/...');
  fs.copySync(buildDir, winUnpackedDir);
  
  // Copiar archivos de public
  console.log('   • Copiando electron.js, preload.js, index.html...');
  fs.copySync(path.join(projectRoot, 'public/electron.js'), path.join(winUnpackedDir, 'electron.js'));
  fs.copySync(path.join(projectRoot, 'public/preload.js'), path.join(winUnpackedDir, 'preload.js'));
  fs.copySync(path.join(projectRoot, 'public/index.html'), path.join(winUnpackedDir, 'index.html'));
  
  // Copiar package.json
  console.log('   • Copiando package.json...');
  fs.copySync(path.join(projectRoot, 'package.json'), path.join(winUnpackedDir, 'package.json'));
  
  // Copiar node_modules
  console.log('   • Copiando node_modules (esto toma tiempo)...');
  const nodeModulesSrc = path.join(projectRoot, 'node_modules');
  const nodeModulesDst = path.join(winUnpackedDir, 'node_modules');
  fs.copySync(nodeModulesSrc, nodeModulesDst);
  
  // Copiar assets
  console.log('   • Copiando assets...');
  const assetsDst = path.join(winUnpackedDir, 'assets');
  fs.ensureDirSync(assetsDst);
  const assetsDir = path.join(projectRoot, 'assets');
  if (fs.existsSync(assetsDir)) {
    fs.copySync(assetsDir, assetsDst);
  }
  
  console.log('   ✓ Todos los archivos copiados\n');

  // PASO 4: Verificar tamaño
  console.log('📊 PASO 4: Verificando estructura...');
  const size = execSync(`du -sh "${winUnpackedDir}"`).toString().trim();
  console.log(`   ✓ Tamaño: ${size}\n`);

  // PASO 5: Listar contenidos principales
  console.log('📄 PASO 5: Contenidos de win-unpacked:');
  const contents = fs.readdirSync(winUnpackedDir);
  contents.forEach(item => {
    const itemPath = path.join(winUnpackedDir, item);
    const stat = fs.statSync(itemPath);
    const sizeStr = stat.isDirectory() 
      ? `${fs.readdirSync(itemPath).length} items`
      : `${(stat.size / 1024 / 1024).toFixed(2)} MB`;
    console.log(`   ✓ ${item}/ (${sizeStr})`);
  });
  console.log('');

  // PASO 6: Compilar NSIS
  console.log('🔨 PASO 6: Compilando NSIS...');
  console.log('   Ejecutando: makensis BlockGuard.nsi\n');
  
  execSync('makensis BlockGuard.nsi', {
    cwd: projectRoot,
    stdio: 'inherit'
  });

  // PASO 7: Verificar archivo generado
  console.log('\n✅ PASO 7: Verificando instalador generado...');
  const exeFiles = fs.readdirSync(distDir).filter(f => f.endsWith('.exe'));
  
  if (exeFiles.length === 0) {
    throw new Error('No se generó el archivo .exe. Revisa los errores de NSIS arriba.');
  }

  exeFiles.forEach(exeFile => {
    const exePath = path.join(distDir, exeFile);
    const stats = fs.statSync(exePath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`   ✓ ${exeFile}: ${sizeMB} MB\n`);
  });

  console.log('🎉 ¡ÉXITO! Instalador generado correctamente.');
  console.log(`📁 Ubicación: ${path.relative(projectRoot, distDir)}/\n`);

} catch (error) {
  console.error('\n❌ ERROR:');
  console.error(error.message);
  console.error('\nPista: Si el error es de wine, asegúrate que nsis esté instalado:');
  console.error('  sudo apt-get install nsis\n');
  process.exit(1);
}
