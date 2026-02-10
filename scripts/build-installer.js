#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

console.log('🔨 Construyendo Block Guard Installer...');
const packageJson = require('../package.json');
console.log(`📦 Versión: ${packageJson.version}`);

// Ejecutar electron-builder sin intentar firmar
console.log('📦 Ejecutando electron-builder...');

try {
  const env = { ...process.env };
  
  // Desactivar completamente la firma
  delete env.CSC_KEY_PASSWORD;
  delete env.CSC_LINK;
  delete env.WIN_CSC_LINK;
  delete env.WIN_CSC_KEY_PASSWORD;
  
  execSync(
    'electron-builder --win nsis --publish never',
    { 
      cwd: __dirname.replace('/scripts', ''),
      stdio: 'inherit',
      env: env,
      shell: '/bin/bash'
    }
  );
  
  // Verificar que el instalador se generó
  const distDir = path.join(__dirname, '../dist');
  const installers = fs.globSync(path.join(distDir, '**/*.exe'));
  
  if (installers.length > 0) {
    console.log('✅ ¡Instalador generado correctamente!');
    installers.forEach(installer => {
      const stats = fs.statSync(installer);
      console.log(`📁 ${path.relative(distDir, installer)}`);
      console.log(`📦 Tamaño: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    });
  } else {
    console.log('⚠️ No se encontró instalador generado');
    process.exit(1);
  }
  
} catch (error) {
  console.error('❌ Error al generar el instalador:', error.message);
  
  // Revisar si se generó parcialmente
  const distDir = path.join(__dirname, '../dist');
  if (fs.existsSync(distDir)) {
    const files = fs.globSync(path.join(distDir, '**/*.exe'));
    if (files.length > 0) {
      console.log('⚠️ Se generó un instalador parcial, pero con advertencias');
      console.log('Intentando continuar...');
    }
  }
}

