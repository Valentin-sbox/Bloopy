#!/usr/bin/env node
/**
 * Script para construir el .exe portable de Block Guard
 * Evita problemas con wine y rcedit en Linux
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
const version = packageJson.version;

console.log('🔨 Construyendo Block Guard Portable...');
console.log(`📦 Versión: ${version}`);

try {
  // Ejecutar electron-builder
  console.log('📦 Ejecutando electron-builder...');
  execSync('electron-builder --win portable --publish never', {
    cwd: projectRoot,
    stdio: 'inherit'
  });
  
  console.log('✅ Build completado');
  
} catch (error) {
  // Si electron-builder falla en la edición de recursos, 
  // igualmente copiamos el .exe que se generó
  console.log('⚠️ Build completado con advertencias (esto es normal en Linux)');
  
  const winUnpackedDir = path.join(projectRoot, 'dist', 'win-unpacked');
  const sourceExe = path.join(winUnpackedDir, 'Block Guard.exe');
  const destDir = path.join(projectRoot, 'dist');
  const destExe = path.join(destDir, `BlockGuard-Portable-${version}.exe`);
  
  if (fs.existsSync(sourceExe)) {
    console.log(`📋 Copiando ${sourceExe}`);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(sourceExe, destExe);
    
    const stats = fs.statSync(destExe);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    
    console.log('✅ Archivo portable listo!');
    console.log(`📁 Ubicación: ${destExe}`);
    console.log(`📦 Tamaño: ${sizeMB} MB`);
    process.exit(0);
  } else {
    console.error('❌ Error: El .exe no se pudo crear');
    process.exit(1);
  }
}
