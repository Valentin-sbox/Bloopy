#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

const projectRoot = path.join(__dirname, '..');

console.log('🔨 Construyendo aplicación Electron para Windows...');

try {
  // Paso 1: Generar el .exe con electron-builder (sin intentar firmarlo)
  console.log('📦 Empaquetando aplicación Electron...');
  
  execSync('npx electron-builder --win --dir --publish never', {
    cwd: projectRoot,
    stdio: 'inherit'
  });
  
  // Paso 2: Compilar el NSIS script
  console.log('📝 Compilando instalador NSIS...');
  
  const nsiScript = path.join(projectRoot, 'BlockGuard.nsi');
  if (!fs.existsSync(nsiScript)) {
    console.error('❌ BlockGuard.nsi no encontrado');
    process.exit(1);
  }
  
  execSync(`makensis "${nsiScript}"`, {
    cwd: projectRoot,
    stdio: 'inherit'
  });
  
  // Paso 3: Verificar que el instalador se generó
  const installerPath = path.join(projectRoot, 'dist', 'BlockGuard-Setup-4.0.0.exe');
  
  if (fs.existsSync(installerPath)) {
    const stats = fs.statSync(installerPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    
    console.log('\n✅ ¡Instalador generado correctamente!');
    console.log(`📁 ${path.relative(projectRoot, installerPath)}`);
    console.log(`📦 Tamaño: ${sizeMB} MB`);
    console.log('\n✨ El instalador está listo para descargar y ejecutar en Windows x64');
  } else {
    console.error('❌ El instalador no se generó');
    process.exit(1);
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
