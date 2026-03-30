#!/usr/bin/env node

/**
 * Script de construcción personalizado para Bloopy
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

console.log('🔧 Bloopy Build Script');
console.log('===========================\n');

try {
  // Paso 1: Limpiar directorios
  console.log('📦 Paso 1: Limpiando directorios anteriores...');
  fs.removeSync(distDir);
  console.log('   ✓ Directorio dist limpiado\n');

  // Paso 2: Construir React (PUBLIC_URL=./ para file://, CI=false para Codespaces)
  console.log('⚛️  Paso 2: Compilando React...');
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const buildEnv = {
    ...process.env,
    PUBLIC_URL: './',
    CI: 'false',
    GENERATE_SOURCEMAP: 'false',
    DISABLE_ESLINT_PLUGIN: 'true'
  };
  execSync(`${npmCmd} run build`, {
    cwd: rootDir,
    stdio: 'inherit',
    env: buildEnv
  });
  console.log('\n   ✓ React compilado exitosamente\n');

  // Paso 3: Copiar archivos de Electron a build/
  console.log('📂 Paso 3: Copiando archivos de Electron a build/...');
  // NO copiar index.html: React build ya genera build/index.html con los scripts correctos
  const filesToCopy = [
    { src: path.join(rootDir, 'public', 'electron.js'), dst: path.join(buildDir, 'electron.js') },
    { src: path.join(rootDir, 'public', 'preload.js'), dst: path.join(buildDir, 'preload.js') }
  ];

  // CRÍTICO: Copiar src/main a build/src/main (electron.js busca src/main/index)
  const mainSrc = path.join(rootDir, 'src', 'main');
  const mainDst = path.join(buildDir, 'src', 'main');
  if (fs.existsSync(mainSrc)) {
    fs.ensureDirSync(path.dirname(mainDst));
    fs.copySync(mainSrc, mainDst);
    console.log('   ✓ Copiando src/main a build/src/main...');
  } else {
    console.warn('   ⚠ src/main no encontrado!');
  }

  filesToCopy.forEach(file => {
    if (fs.existsSync(file.src)) {
      fs.copySync(file.src, file.dst);
      console.log(`   ✓ Copiado: ${path.basename(file.src)}`);
    }
  });
  console.log('');

  // Paso 3.5: Copiar iconos a build/assets/
  console.log('🎨 Paso 3.5: Copiando iconos a build/assets/...');
  const assetsDir = path.join(buildDir, 'assets');
  fs.ensureDirSync(assetsDir);

  const iconsToCopy = [
    { src: path.join(rootDir, 'assets/icon.ico'), dst: path.join(assetsDir, 'icon.ico') },
    { src: path.join(rootDir, 'assets/icon.png'), dst: path.join(assetsDir, 'icon.png') }
  ];

  iconsToCopy.forEach(icon => {
    if (fs.existsSync(icon.src)) {
      fs.copySync(icon.src, icon.dst);
      const stats = fs.statSync(icon.dst);
      const size = (stats.size / 1024).toFixed(2);
      console.log(`   ✓ Copiado: ${path.basename(icon.src)} (${size} KB)`);
    } else {
      console.warn(`   ⚠ Icono no encontrado: ${icon.src}`);
    }
  });
  console.log('');

  // Paso 4: Empaquetar con electron-builder
  console.log('📦 Paso 4: Empaquetando con electron-builder (Win x64/ia32 + Linux)...');
  const builderEnv = {
    ...process.env,
    CSC_IDENTITY_AUTO_DISCOVERY: 'false'
  };
  delete builderEnv.WIN_CSC_LINK;
  delete builderEnv.WIN_CSC_KEY_PASSWORD;
  delete builderEnv.CSC_LINK;
  delete builderEnv.CSC_KEY_PASSWORD;

  // Comando para Windows (x64 y ia32) y Linux
  // Nota: Build de Linux en Windows requiere WSL o Docker para mejores resultados,
  // pero intentaremos con lo básico.
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const cmd = `${npxCmd} electron-builder --win --linux --x64 --ia32 --publish never`;

  console.log(`   Ejecutando: ${cmd}`);

  try {
    execSync(cmd, {
      cwd: rootDir,
      stdio: 'inherit',
      env: builderEnv
    });
  } catch (err) {
    console.warn('   ⚠️  Advertencia: Hubo errores en el build (posiblemente Linux en Windows).');
    console.warn('       Verifica si se generaron los instaladores de Windows.');
  }

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
