#!/usr/bin/env node

/**
 * Script para empaquetar BlockGuard para Windows 64-bit
 * Sin firmas digitales
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

const projectRoot = path.join(__dirname);
const distDir = path.join(projectRoot, 'dist');

console.log('📦 Empaquetando BlockGuard para Windows 64-bit...\n');

try {
  // Limpiar dist anterior
  if (fs.existsSync(distDir)) {
    fs.removeSync(distDir);
  }
  
  // Ejecutar electron-builder
  console.log('⏳ Compilando con electron-builder...');
  
  const cmd = 'npx electron-builder --win --x64 --publish=never';
  const env = { ...process.env };
  
  // Deshabilitar firma
  delete env.CSC_LINK;
  delete env.CSC_KEY_PASSWORD;
  delete env.WIN_CSC_LINK;
  delete env.WIN_CSC_KEY_PASSWORD;
  
  execSync(cmd, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: env
  });
  
  console.log('\n✓ Compilación completada');
  
  // Verificar archivos generados
  console.log('\n📁 Archivos generados en dist/:');
  const files = fs.readdirSync(distDir);
  files.forEach(file => {
    const fullPath = path.join(distDir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      console.log(`  📂 ${file}/ (${fs.readdirSync(fullPath).length} items)`);
    } else {
      const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
      console.log(`  📄 ${file} (${sizeMB} MB)`);
    }
  });
  
  // Verificar win-unpacked
  const winUnpackedDir = path.join(distDir, 'win-unpacked');
  if (fs.existsSync(winUnpackedDir)) {
    console.log('\n✓ Estructura win-unpacked encontrada');
    const contents = fs.readdirSync(winUnpackedDir);
    console.log(`  Contiene: ${contents.length} items`);
    contents.slice(0, 10).forEach(item => {
      console.log(`    - ${item}`);
    });
  }
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
}
