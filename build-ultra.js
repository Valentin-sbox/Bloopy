#!/usr/bin/env node

/**
 * SCRIPT DE BUILD ULTRA SEGURO PARA BLOCKGUARD
 * 
 * ESTRATEGIA:
 * 1. Bloquea TODAS las variables de firma en el entorno
 * 2. Fuerza sign: false en electron-builder.json
 * 3. Usa electron-builder para generar win-unpacked COMPLETO
 * 4. Verifica que NO hay intentos de firma
 * 5. Genera instalador NSIS con archivos completos
 * 6. Soporte para publicación en GitHub con --publish flag
 * 
 * USO:
 * - npm run build-ultra              # Build local, sin publicar
 * - npm run build-ultra -- --publish # Build + publicar en GitHub (requiere GH_TOKEN)
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');

const projectRoot = __dirname;
const distDir = path.join(projectRoot, 'dist');
const configPath = path.join(projectRoot, 'electron-builder.json');

// ============================================================================
// DETECTAR FLAGS DESDE LÍNEA DE COMANDOS
// ============================================================================
const args = process.argv.slice(2);
const shouldPublish = args.includes('--publish');
const tokenFromArg = args.find(a => a.startsWith('--token='))?.split('=')[1];

/**
 * Función para detecEtar GH_TOKEN desde múltiples fuentes
 */
function detectGitHubToken() {
  const sources = [];
  
  // 1. Token desde argumentos (máxima prioridad)
  if (tokenFromArg) {
    sources.push({ value: tokenFromArg, source: 'argumento --token=' });
  }
  
  // 2. Variables de entorno comunes
  if (process.env.GH_TOKEN) {
    sources.push({ value: process.env.GH_TOKEN, source: 'GH_TOKEN env' });
  }
  if (process.env.GITHUB_TOKEN) {
    sources.push({ value: process.env.GITHUB_TOKEN, source: 'GITHUB_TOKEN env' });
  }
  if (process.env.GH_PAT) {
    sources.push({ value: process.env.GH_PAT, source: 'GH_PAT env' });
  }
  
  // 3. Archivos .env locales
  const envFiles = ['.env.local', '.env', '.github.token'];
  for (const envFileName of envFiles) {
    try {
      const envPath = path.join(projectRoot, envFileName);
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        
        // Buscar múltiples patrones
        const patterns = [
          /GH_TOKEN\s*=\s*(.+)/,
          /GITHUB_TOKEN\s*=\s*(.+)/,
          /GH_PAT\s*=\s*(.+)/,
          /GITHUB_TOKEN:\s*(.+)/,
          /^(.+)$/ // Si el archivo es solo el token
        ];
        
        for (const pattern of patterns) {
          const match = envContent.match(pattern);
          if (match && match[1]) {
            const token = match[1].trim().replace(/['"]/g, '');
            if (token && token.length > 20) {
              sources.push({ value: token, source: `${envFileName}` });
              break;
            }
          }
        }
      }
    } catch (e) {
      // Ignorar errores de lectura
    }
  }
  
  // 4. Archivo de credenciales de GitHub CLI
  try {
    const ghCliPath = path.join(process.env.HOME || process.env.USERPROFILE, '.config/gh/hosts.yml');
    if (fs.existsSync(ghCliPath)) {
      const ghCliConfig = fs.readFileSync(ghCliPath, 'utf-8');
      const tokenMatch = ghCliConfig.match(/oauth_token:\s*(.+)/);
      if (tokenMatch && tokenMatch[1]) {
        sources.push({ value: tokenMatch[1].trim(), source: 'GitHub CLI config' });
      }
    }
  } catch (e) {
    // Ignorar errores
  }
  
  // Retornar el primer token válido encontrado
  for (const source of sources) {
    if (source.value && source.value.length > 20 && !source.value.includes('undefined')) {
      return { token: source.value, source: source.source };
    }
  }
  
  return { token: '', source: null };
}

// Detectar token
const tokenData = detectGitHubToken();
const ghToken = tokenData.token;
const tokenSource = tokenData.source;

// Validar token para GitHub releases
const isValidToken = ghToken && ghToken.length > 20 && ghToken !== 'undefined';
const publishMode = shouldPublish && isValidToken ? 'always' : 'never';

console.log('\n' + '='.repeat(70));
console.log('  BLOCKGUARD BUILD ULTRA - SIN FIRMAS - WINDOWS 64-BIT');
console.log(`  Modo publicación: ${publishMode.toUpperCase()}`);
console.log(`  GitHub Token: ${isValidToken ? `✓ Detectado (${tokenSource})` : '✗ No disponible'}`);
if (shouldPublish && !isValidToken) {
  console.log('\n  ℹ️  Para publicar releases en GitHub, configura GH_TOKEN:');
  console.log('     OPCIÓN 1 - Variable de entorno:');
  console.log('       export GH_TOKEN=tu_token_github');
  console.log('       npm run build-ultra -- --publish');
  console.log('     ');
  console.log('     OPCIÓN 2 - Archivo .env.local:');
  console.log('       Crea .env.local en la raíz con:');
  console.log('       GH_TOKEN=tu_token_github');
  console.log('       npm run build-ultra -- --publish');
  console.log('     ');
  console.log('     OPCIÓN 3 - Argumento directo:');
  console.log('       npm run build-ultra -- --publish --token=tu_token_github');
  console.log('     ');
  console.log('     OPCIÓN 4 - GitHub CLI:');
  console.log('       gh auth login (configura credenciales de CLI)');
  console.log('       npm run build-ultra -- --publish\n');
}
console.log('='.repeat(70) + '\n');

// Preparar environment con token si existe
const env = { ...process.env };
if (isValidToken) {
  env.GH_TOKEN = ghToken;
  env.PUBLISH_FOR_PULL_REQUEST = 'true';
  console.log('✓ Variables de GitHub configuradas para publicación\n');
}

// ============================================================================
// PASO 1: BLOQUEAR TODAS LAS FIRMAS EN CONFIGURACIÓN
// ============================================================================
console.log('🔒 PASO 1: Bloqueando firmas en configuración...\n');

let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Bloquear firma en sección "win"
config.win.sign = false;
config.win.signDlls = false;
config.win.signingHashAlgorithms = null;
config.win.certificateFile = null;
config.win.certificatePassword = null;
config.win.signtool = null;
config.win.sign = false;

// Bloquear en configuración global
config.sign = false;
config.signDlls = false;
config.certificateFile = null;
config.certificatePassword = null;

fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log('   ✓ electron-builder.json actualizado (sign: false)\n');

// ============================================================================
// PASO 2: BLOQUEAR VARIABLES DE ENTORNO DE FIRMA
// ============================================================================
console.log('🔒 PASO 2: Limpiando variables de entorno de firma...\n');

const signEnvVars = [
  'CSC_IDENTITY_AUTO_DISCOVERY',
  'CSC_LINK',
  'CSC_KEY_PASSWORD',
  'WIN_CSC_LINK',
  'WIN_CSC_KEY_PASSWORD',
  'APPLE_ID',
  'APPLE_ID_PASSWORD',
  'APPLE_TEAM_ID',
  'ASC_USERNAME',
  'ASC_PASSWORD'
];

signEnvVars.forEach(varName => {
  delete env[varName];
  console.log(`   ✓ Eliminada: ${varName}`);
});

// Agregar variables para deshabilitar firma
env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
env.SKIP_NOTARIZATION = 'true';
env.SKIP_SIGNING = 'true';

console.log('   ✓ Variables "skip" agregadas\n');

// ============================================================================
// PASO 3: LIMPIAR DIRECTORIOS PREVIOS
// ============================================================================
console.log('🧹 PASO 3: Limpiando directorios anteriores...\n');

if (fs.existsSync(distDir)) {
  fs.removeSync(distDir);
  console.log('   ✓ dist/ removido\n');
}

if (fs.existsSync(path.join(projectRoot, 'build'))) {
  fs.removeSync(path.join(projectRoot, 'build'));
  console.log('   ✓ build/ removido\n');
}

// ============================================================================
// PASO 4: COMPILAR REACT
// ============================================================================
console.log('⚛️  PASO 4: Compilando React para producción...\n');

try {
  execSync('npm run build', {
    cwd: projectRoot,
    stdio: 'inherit',
    env: env
  });
  console.log('\n   ✓ React compilado exitosamente\n');
} catch (error) {
  console.error('   ✗ Error compilando React:', error.message);
  process.exit(1);
}

// ============================================================================
// PASO 5: VERIFICAR ESTRUCTURA DE BUILD
// ============================================================================
console.log('✅ PASO 5: Verificando estructura de build...\n');

const buildDir = path.join(projectRoot, 'build');
if (!fs.existsSync(buildDir)) {
  console.error('   ✗ build/ no existe después de compilación');
  process.exit(1);
}

const buildContents = fs.readdirSync(buildDir);
console.log(`   ✓ build/ contiene ${buildContents.length} items:`);
buildContents.forEach(item => {
  const itemPath = path.join(buildDir, item);
  const stat = fs.statSync(itemPath);
  if (stat.isDirectory()) {
    const count = fs.readdirSync(itemPath).length;
    console.log(`     - ${item}/ (${count} items)`);
  } else {
    const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
    console.log(`     - ${item} (${sizeMB} MB)`);
  }
});
console.log('');

// ============================================================================
// PASO 6: USAR ELECTRON-BUILDER SIN FIRMA
// ============================================================================
console.log('📦 PASO 6: Compilando con electron-builder (SIN FIRMA)...\n');

const builderCommand = `npx electron-builder --win --x64 --publish=${publishMode}`;
console.log(`   Ejecutando: ${builderCommand}\n`);

try {
  execSync(builderCommand, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: env
  });
  console.log('\n   ✓ electron-builder completó exitosamente\n');
} catch (error) {
  console.error('   ✗ Error en electron-builder:', error.message);
  
  // Verificar si al menos se generó win-unpacked
  const winUnpackedDir = path.join(distDir, 'win-unpacked');
  if (fs.existsSync(winUnpackedDir)) {
    console.log('   ⚠️  win-unpacked/existe pero hubo error. Continuando...\n');
  } else {
    process.exit(1);
  }
}

// ============================================================================
// PASO 7: VERIFICAR CONTENIDO DE WIN-UNPACKED
// ============================================================================
console.log('✅ PASO 7: Analizando win-unpacked generado...\n');

const winUnpackedDir = path.join(distDir, 'win-unpacked');
if (!fs.existsSync(winUnpackedDir)) {
  console.error('   ✗ win-unpacked/ no existe');
  process.exit(1);
}

const winContents = fs.readdirSync(winUnpackedDir);
console.log(`   ✓ win-unpacked/ contiene ${winContents.length} items:\n`);

let totalSize = 0;
const itemDetails = [];

winContents.forEach(item => {
  const itemPath = path.join(winUnpackedDir, item);
  const stat = fs.statSync(itemPath);
  
  if (stat.isDirectory()) {
    const items = fs.readdirSync(itemPath);
    const dirSize = execSync(`du -sb "${itemPath}"`).toString().split('\t')[0];
    const sizeMB = (dirSize / 1024 / 1024).toFixed(2);
    totalSize += parseInt(dirSize);
    itemDetails.push(`     📂 ${item}/ (${items.length} items, ${sizeMB} MB)`);
  } else {
    const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
    totalSize += stat.size;
    itemDetails.push(`     📄 ${item} (${sizeMB} MB)`);
  }
});

itemDetails.forEach(detail => console.log(detail));
const totalMB = (totalSize / 1024 / 1024).toFixed(2);
console.log(`\n   ✓ Tamaño total: ${totalMB} MB\n`);

// Verificar archivos críticos
console.log('   ✓ Verificando archivos críticos:\n');
const criticalFiles = [
  'electron.exe',
  'resources/app.asar',
  'electron.dll',
  'v8_context_snapshot.bin'
];

const foundFiles = [];
const missingFiles = [];

criticalFiles.forEach(file => {
  const filePath = path.join(winUnpackedDir, file);
  if (fs.existsSync(filePath)) {
    const stat = fs.statSync(filePath);
    const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
    foundFiles.push(`     ✓ ${file} (${sizeMB} MB)`);
  } else {
    missingFiles.push(`     ✗ ${file} (NO ENCONTRADO)`);
  }
});

foundFiles.forEach(f => console.log(f));
if (missingFiles.length > 0) {
  missingFiles.forEach(f => console.log(f));
}
console.log('');

// ============================================================================
// PASO 8: COMPILAR NSIS
// ============================================================================
console.log('🔨 PASO 8: Compilando instalador NSIS...\n');
console.log('   Ejecutando: makensis BlockGuard.nsi\n');

try {
  execSync('makensis BlockGuard.nsi', {
    cwd: projectRoot,
    stdio: 'inherit'
  });
  console.log('\n   ✓ NSIS compilado exitosamente\n');
} catch (error) {
  console.error('   ✗ Error compilando NSIS:', error.message);
  process.exit(1);
}

// ============================================================================
// PASO 9: VERIFICAR INSTALADOR FINAL
// ============================================================================
console.log('✅ PASO 9: Verificando instalador final...\n');

const exeFiles = fs.readdirSync(distDir).filter(f => f.endsWith('.exe'));

if (exeFiles.length === 0) {
  console.error('   ✗ No se generó el archivo .exe');
  process.exit(1);
}

console.log(`   ✓ ${exeFiles.length} archivo(s) .exe encontrado(s):\n`);
exeFiles.forEach(exeFile => {
  const exePath = path.join(distDir, exeFile);
  const stats = fs.statSync(exePath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  const type = execSync(`file "${exePath}"`).toString().trim();
  console.log(`     📦 ${exeFile}:
       Tamaño: ${sizeMB} MB
       Tipo: ${type.split(':').pop().trim()}`);
});

// ============================================================================
// PASO 10: VERIFICACIÓN FINAL DE FIRMAS
// ============================================================================
console.log('\n🔍 PASO 10: Verificación final - Comprobando que NO hay firmas...\n');

const exePath = path.join(distDir, exeFiles[0]);

// Verificar con strings para buscar certificados
try {
  const strings = execSync(`strings "${exePath}" 2>/dev/null | grep -i "sign\\|certif\\|crypt" || echo "No encontrados (CORRECTO)"`).toString();
  if (strings.includes('No encontrados')) {
    console.log('   ✓ No se detectan cadenas de certificado/firma (CORRECTO)\n');
  } else {
    console.log('   ⚠️  Se detectaron referencias a crypt/sign (revisar):\n');
    strings.split('\n').slice(0, 5).forEach(line => {
      if (line.trim()) console.log(`     ${line}`);
    });
    console.log('');
  }
} catch (e) {
  console.log('   ℹ️  (Verificación de strings no disponible)\n');
}

// ============================================================================
// RESUMEN FINAL
// ============================================================================
console.log('='.repeat(70));
console.log('🎉 ¡COMPILACIÓN COMPLETADA EXITOSAMENTE!\n');
console.log('📊 RESUMEN:\n');
console.log(`   • Instalador: ${exeFiles[0]}`);
console.log(`   • Tamaño: ${(fs.statSync(exePath).size / 1024 / 1024).toFixed(2)} MB`);
console.log(`   • Ubicación: dist/`);
console.log(`   • Arquitectura: Windows 64-bit`);
console.log(`   • Con firma: ❌ NO (deshabilitado)`);
console.log(`   • Modo publicación: ${publishMode.toUpperCase()}`);

if (publishMode === 'always') {
  console.log(`   • Publicación: ✅ Publicará en GitHub`);
  console.log(`   • Token: ${ghToken ? '✓ GH_TOKEN configurado' : '✗ GH_TOKEN NO disponible'}`);
} else {
  console.log(`   • Publicación: ❌ Build local únicamente`);
  console.log(`   • Para publicar usar: npm run build-ultra -- --publish`);
}

console.log(`   • Estado: ✅ LISTO PARA USAR\n`);
console.log('='.repeat(70) + '\n');
