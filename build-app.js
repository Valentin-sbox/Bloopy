#!/usr/bin/env node

/**
 * Script de construcción personalizado para BlockGuard
 * Este script realiza las siguientes tareas:
 * 1. Limpia los directorios anteriores
 * 2. Ejecuta el build de React
 * 3. Limpia los archivos de electron del directorio build
 * 4. Empaqueta con electron-builder
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = __dirname;
const buildDir = path.join(rootDir, 'build');
const distDir = path.join(rootDir, 'dist');

console.log('🔧 BlockGuard Build Script');
console.log('===========================\n');

try {
  // Paso 1: Limpiar directorios
  console.log('📦 Paso 1: Limpiando directorios anteriores...');
  fs.removeSync(distDir);
  console.log('   ✓ Directorio dist limpiado\n');

  // Paso 2: Construir React
  console.log('⚛️  Paso 2: Compilando React...');
  execSync('npm run build', { 
    cwd: rootDir,
    stdio: 'inherit'
  });
  console.log('\n   ✓ React compilado exitosamente\n');

  // Paso 3: Copiar archivos de Electron a build/
  console.log('📂 Paso 3: Copiando archivos de Electron a build/...');
  const filesToCopy = [
    { src: path.join(rootDir, 'public/electron.js'), dst: path.join(buildDir, 'electron.js') },
    { src: path.join(rootDir, 'public/preload.js'), dst: path.join(buildDir, 'preload.js') },
    { src: path.join(rootDir, 'public/index.html'), dst: path.join(buildDir, 'index.html') }
  ];
  
  filesToCopy.forEach(file => {
    if (fs.existsSync(file.src)) {
      fs.copySync(file.src, file.dst);
      console.log(`   ✓ Copiado: ${path.basename(file.src)}`);
    }
  });
  console.log('');

  // Paso 4: Empaquetar con electron-builder
  // Paso 4: Empaquetar con electron-builder para Windows 64-bit
  console.log('📦 Paso 4: Empaquetando con electron-builder para Windows 64-bit...');
  const buildEnv = {
    ...process.env,
    CSC_IDENTITY_AUTO_DISCOVERY: 'false'
  };
  
  // Remover variables de firma si existen
  delete buildEnv.WIN_CSC_LINK;
  delete buildEnv.WIN_CSC_KEY_PASSWORD;
  delete buildEnv.CSC_LINK;
  delete buildEnv.CSC_KEY_PASSWORD;
  
  execSync('npx electron-builder --win --x64 --publish never', {
    cwd: rootDir,
    stdio: 'inherit',
    env: buildEnv
  });
  
  console.log('\n✅ ¡Build completado exitosamente!');
  console.log(`📁 Instalador disponible en: ${distDir}`);
  console.log('\n');
  
  // Listar archivos generados
  if (fs.existsSync(distDir)) {
    console.log('📄 Archivos generados:');
    const files = fs.readdirSync(distDir);
    files.forEach(file => {
      const filePath = path.join(distDir, file);
      const stats = fs.statSync(filePath);
      const size = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`   • ${file} (${size} MB)`);
    });
  }

} catch (error) {
  console.error('\n❌ Error durante el build:');
  console.error(error.message);
  process.exit(1);
}
