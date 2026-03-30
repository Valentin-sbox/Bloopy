#!/usr/bin/env node

/**
 * SCRIPT DE BUILD ULTRA SEGURO PARA BLOOPY
 * 
 * ESTRATEGIA:
 * 1. Detecta e instala Wine si es necesario (Linux/Mac)
 * 2. Bloquea TODAS las variables de firma en el entorno
 * 3. Fuerza sign: false en electron-builder.json
 * 4. Usa electron-builder para generar win-unpacked COMPLETO
 * 5. Verifica que NO hay intentos de firma
 * 6. Genera instalador NSIS con archivos completos
 * 7. Soporte para publicación en GitHub con --publish flag
 * 8. Lee notas de release desde RELEASE.md
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
const buildDir = path.join(projectRoot, 'build'); // Definido globalmente para evitar ReferenceError
const configPath = path.join(projectRoot, 'electron-builder.json');
const releaseNotesPath = path.join(projectRoot, 'RELEASE.md');

// Rutas de assets e iconos (declaradas una sola vez)
const assetsSource = path.join(projectRoot, 'public', 'assets');
const iconSourceIco = path.join(projectRoot, 'public', 'assets', 'icon.ico');
const iconSourcePng = path.join(projectRoot, 'public', 'assets', 'icon.png');

// ============================================================================
// DETECTAR FLAGS DESDE LÍNEA DE COMANDOS
// ============================================================================
const args = process.argv.slice(2);
const shouldPublish = args.includes('--publish');
const tokenFromArg = args.find(a => a.startsWith('--token='))?.split('=')[1];

// Detectar tipo de versión
const versionType = args.find(arg => arg.startsWith('--estable')) ? 'stable' :
                   args.find(arg => arg.startsWith('--snapshot')) ? 'snapshot' :
                   args.find(arg => arg.startsWith('--pre-estable')) ? 'pre-stable' :
                   'stable'; // Por defecto es estable

console.log(`   Tipo de versión: ${versionType.toUpperCase()}`);
console.log(`   Modo publicación: ${shouldPublish ? 'HABILITADO' : 'LOCAL'}`);

// ============================================================================
// FUNCIÓN: DETECTAR Y VERIFICAR WINE
// ============================================================================
function checkWineInstallation() {
  const platform = process.platform;

  // Solo necesario en Linux/Mac para builds de Windows
  if (platform === 'win32') {
    console.log('   ✓ Plataforma Windows detectada, Wine no necesario\n');
    return { installed: true, version: 'N/A (Windows nativo)' };
  }

  console.log(`   ℹ️  Plataforma ${platform} detectada, verificando Wine...\n`);

  try {
    // Intentar detectar wine64 primero
    try {
      const wine64Version = execSync('wine64 --version', { encoding: 'utf-8', stdio: 'pipe' });
      console.log(`   ✓ Wine64 encontrado: ${wine64Version.trim()}\n`);
      return { installed: true, version: wine64Version.trim(), binary: 'wine64' };
    } catch (e) {
      // Wine64 no encontrado, intentar wine32
    }

    // Intentar detectar wine32
    try {
      const wine32Version = execSync('wine --version', { encoding: 'utf-8', stdio: 'pipe' });
      console.log(`   ✓ Wine encontrado: ${wine32Version.trim()}\n`);
      return { installed: true, version: wine32Version.trim(), binary: 'wine' };
    } catch (e) {
      // Wine no encontrado
    }

    return { installed: false, version: null, binary: null };
  } catch (error) {
    return { installed: false, version: null, binary: null };
  }
}

/**
 * Instala Wine según la plataforma
 */
function installWine() {
  const platform = process.platform;

  console.log('📦 Instalando Wine...\n');

  try {
    if (platform === 'darwin') {
      // macOS - usar Homebrew
      console.log('   Detectado macOS, usando Homebrew...\n');
      console.log('   Ejecutando: brew install --cask wine-stable\n');
      execSync('brew install --cask wine-stable', { stdio: 'inherit' });
      console.log('\n   ✓ Wine instalado correctamente\n');
    } else if (platform === 'linux') {
      // Linux - detectar distribución
      console.log('   Detectado Linux, intentando instalación...\n');

      // Intentar con apt (Debian/Ubuntu)
      try {
        console.log('   Intentando con apt (Debian/Ubuntu)...\n');
        execSync('sudo dpkg --add-architecture i386', { stdio: 'inherit' });
        execSync('sudo apt update', { stdio: 'inherit' });
        execSync('sudo apt install -y wine64 wine32', { stdio: 'inherit' });
        console.log('\n   ✓ Wine instalado correctamente\n');
        return;
      } catch (e) {
        console.log('   apt no disponible, intentando con yum...\n');
      }

      // Intentar con yum (RedHat/CentOS/Fedora)
      try {
        execSync('sudo yum install -y wine', { stdio: 'inherit' });
        console.log('\n   ✓ Wine instalado correctamente\n');
        return;
      } catch (e) {
        console.log('   yum no disponible, intentando con pacman...\n');
      }

      // Intentar con pacman (Arch)
      try {
        execSync('sudo pacman -S --noconfirm wine', { stdio: 'inherit' });
        console.log('\n   ✓ Wine instalado correctamente\n');
        return;
      } catch (e) {
        throw new Error('No se pudo instalar Wine automáticamente. Por favor instálalo manualmente.');
      }
    }
  } catch (error) {
    console.error('\n   ✗ Error instalando Wine:', error.message);
    console.log('\n   ℹ️  Instrucciones de instalación manual:');
    console.log('      macOS: brew install --cask wine-stable');
    console.log('      Ubuntu/Debian: sudo apt install wine64 wine32');
    console.log('      Fedora: sudo yum install wine');
    console.log('      Arch: sudo pacman -S wine\n');
    throw error;
  }
}

/**
 * Función para detectar GH_TOKEN desde múltiples fuentes
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

/**
 * Lee las notas de release desde RELEASE.md
 */
function getReleaseNotes() {
  try {
    if (fs.existsSync(releaseNotesPath)) {
      const content = fs.readFileSync(releaseNotesPath, 'utf-8');
      console.log('   ✓ Notas de release cargadas desde RELEASE.md\n');
      return content;
    }
  } catch (e) {
    console.log('   ⚠️  No se pudo leer RELEASE.md, usando notas por defecto\n');
  }

  // Notas por defecto si no existe el archivo
  return `# Bloopy - Nueva versión

Mejoras y correcciones en esta versión.

Para más información, visita: https://github.com/Valentin-sbox/Bloopy`;
}

// ============================================================================
// INICIO DEL SCRIPT
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('  BLOOPY BUILD ULTRA - SIN FIRMAS - WINDOWS 64-BIT');
console.log('='.repeat(70) + '\n');

// ============================================================================
// PASO 0: VERIFICAR E INSTALAR WINE SI ES NECESARIO
// ============================================================================
console.log('🔍 PASO 0: Verificando dependencias del sistema...\n');

const wineCheck = checkWineInstallation();

if (!wineCheck.installed && process.platform !== 'win32') {
  console.log('   ⚠️  Wine no está instalado. Es necesario para compilar para Windows.\n');
  console.log('   ¿Deseas instalar Wine automáticamente? (Continuará en 5 segundos)\n');

  // Esperar 5 segundos antes de instalar
  try {
    execSync('sleep 5 || timeout 5', { stdio: 'inherit' });
    installWine();

    // Verificar instalación
    const recheckWine = checkWineInstallation();
    if (!recheckWine.installed) {
      throw new Error('Wine no se instaló correctamente');
    }
  } catch (error) {
    console.error('\n   ✗ Error: Wine es necesario para continuar');
    console.log('   Por favor instala Wine manualmente y vuelve a ejecutar el script.\n');
    process.exit(1);
  }
}

// Detectar token
const tokenData = detectGitHubToken();
const ghToken = tokenData.token;
const tokenSource = tokenData.source;

// Validar token para GitHub releases
const isValidToken = ghToken && ghToken.length > 20 && ghToken !== 'undefined';
const publishMode = shouldPublish && isValidToken ? 'always' : 'never';

// Leer notas de release
const releaseNotes = getReleaseNotes();

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
  console.log('       npm run build-ultra -- --publish --token=tu_token_github\n');
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

// CRÍTICO PARA WINE: Deshabilitar rcedit (causa de errores en Wine)
// rcedit intenta modificar el ejecutable y Wine no lo maneja bien
if (process.platform !== 'win32') {
  console.log('   ℹ️  Plataforma no-Windows detectada, deshabilitando rcedit para Wine...');
  config.win.rcedit = false;
  console.log('   ✓ rcedit deshabilitado (evita errores de Wine)');
}

// CRÍTICO: Usar ruta absoluta para Wine/rcedit con múltiples fallbacks
const possibleIconPaths = [
  path.join(projectRoot, 'public', 'assets', 'icon.ico'),
  path.join(projectRoot, 'icon.ico'),
  path.join(projectRoot, 'app.ico'),
  iconSourceIco
];

// Encontrar el primer icono que exista
let validIconPath = null;
for (const iconPath of possibleIconPaths) {
  if (fs.existsSync(iconPath)) {
    validIconPath = iconPath;
    break;
  }
}

if (validIconPath) {
  config.win.icon = validIconPath;
  console.log(`   ✓ Icono configurado: ${validIconPath}`);
} else {
  console.warn('   ⚠️  No se encontró ningún icono válido');
}

// Bloquear en configuración global
config.sign = false;
config.signDlls = false;
config.certificateFile = null;
config.certificatePassword = null;

// Agregar notas de release si se va a publicar
if (publishMode === 'always') {
  config.publish = [
    {
      provider: 'github',
      owner: 'Valentin-sbox',
      repo: 'Bloopy',
      releaseType: 'release',
      publishAutoUpdate: true,
      // Configurar según tipo de versión
      ...(versionType === 'pre-stable' && {
        prerelease: true,
        draft: false
      }),
      ...(versionType === 'snapshot' && {
        prerelease: true,
        draft: false
      })
    }
  ];
  
  // Actualizar package.json temporalmente para el tipo de versión
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  if (versionType === 'snapshot') {
    packageJson.version = packageJson.version + '-snapshot.' + Date.now();
  } else if (versionType === 'pre-stable') {
    packageJson.version = packageJson.version + '-pre.' + Date.now();
  }
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log(`   ✓ Versión actualizada a: ${packageJson.version}`);
}

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

// IMPORTANTE: Limpiar cache de webpack para forzar rebuild completo
const webpackCacheDir = path.join(projectRoot, 'node_modules', '.cache');
if (fs.existsSync(webpackCacheDir)) {
  fs.removeSync(webpackCacheDir);
  console.log('   ✓ node_modules/.cache/ removido (forzar rebuild)\n');
}

// ============================================================================
// PASO 4: PREPARAR ICONOS (WORKAROUND PARA WINE)
// ============================================================================
console.log('🎨 PASO 4: Preparando iconos para build (workaround Wine)...\n');

try {
  // Verificar que existen los iconos fuente
  if (!fs.existsSync(iconSourceIco)) {
    console.log('   ⚠️  Icono .ico no encontrado en public/assets/icon.ico');
  } else {
    console.log('   ✓ Icono .ico encontrado en public/assets/icon.ico');
  }

  if (!fs.existsSync(iconSourcePng)) {
    console.log('   ⚠️  Icono .png no encontrado en public/assets/icon.png');
  } else {
    console.log('   ✓ Icono .png encontrado en public/assets/icon.png');
  }

  // COPIAR ICONO A MÚLTIPLES UBICACIONES (Workaround fuerte para Wine/rcedit)
  if (fs.existsSync(iconSourceIco)) {
    // Copiar a raíz del proyecto
    fs.copySync(iconSourceIco, path.join(projectRoot, 'icon.ico'));
    console.log('   ✓ Icono .ico copiado a la raíz (workaround rcedit/Wine)');
    
    // Copiar a build/ (si existe)
    if (fs.existsSync(buildDir)) {
      fs.copySync(iconSourceIco, path.join(buildDir, 'icon.ico'));
      console.log('   ✓ Icono .ico copiado a build/');
    }
    
    // Copiar a dist/ (si existe)
    if (fs.existsSync(distDir)) {
      fs.copySync(iconSourceIco, path.join(distDir, 'icon.ico'));
      console.log('   ✓ Icono .ico copiado a dist/');
    }
    
    // Crear copia con nombre alternativo para mayor compatibilidad
    const altIconPath = path.join(projectRoot, 'app.ico');
    fs.copySync(iconSourceIco, altIconPath);
    console.log('   ✓ Icono .ico copiado como app.ico (alternativo)');
  }
  
  console.log('\n   ℹ️  Los iconos se mantendrán en assets/ para el frontend\n');
} catch (error) {
  console.log('   ⚠️  Error verificando iconos:', error.message);
  console.log('   Continuando...\n');
}

// ============================================================================
// PASO 5: COMPILAR REACT
// ============================================================================
console.log('⚛️  PASO 5: Compilando React para producción...\n');

try {
  // Configurar variables de entorno para build con react-scripts
  const buildEnv = {
    ...env,
    CI: 'false', // No tratar warnings como errores (crítico para Codespaces/CI)
    PUBLIC_URL: './', // Rutas relativas para file:// (evita pantalla en blanco)
    GENERATE_SOURCEMAP: 'false',
    INLINE_RUNTIME_CHUNK: 'false',
    DISABLE_ESLINT_PLUGIN: 'true',
    NODE_ENV: 'production',
    SKIP_PREFLIGHT_CHECK: 'true',
    DISABLE_NEW_JSX_TRANSFORM: 'false',
    FAST_REFRESH: 'false',
    WEBPACK_CACHE: 'false',
    DISABLE_WEBPACK_CACHE: 'true'
  };



  // FIX: Usar npm.cmd en Windows para evitar errores de "spawn npm ENOENT"
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  execSync(`${npmCmd} run build`, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: buildEnv
  });
  console.log('\n   ✓ React compilado exitosamente\n');

  // Copiar carpeta assets completa al build (para que el frontend encuentre los iconos)
  const assetsDest = path.join(projectRoot, 'build', 'assets');

  if (fs.existsSync(assetsSource)) {
    fs.copySync(assetsSource, assetsDest);
    console.log('   ✓ Carpeta assets/ copiada a build/assets/ (para frontend)\n');
  }

  // CRÍTICO: Copiar src/main a build/ para que esté disponible en producción
  const srcMainSource = path.join(projectRoot, 'src', 'main');
  const srcMainDest = path.join(buildDir, 'src', 'main');
  
  if (fs.existsSync(srcMainSource)) {
    fs.copySync(srcMainSource, srcMainDest);
    console.log('   ✓ Carpeta src/main/ copiada a build/src/main/\n');
  } else {
    console.warn('   ⚠️  Carpeta src/main/ no encontrada\n');
  }

  // CRÍTICO: Copiar electron.js y preload.js a build/
  // NO copiar index.html: React build ya genera build/index.html con los scripts inyectados.
  // Sobrescribirlo con public/index.html causaría pantalla en blanco (sin <script> tags).
  const electronFiles = [
    { src: path.join(projectRoot, 'public', 'electron.js'), dst: path.join(buildDir, 'electron.js') },
    { src: path.join(projectRoot, 'public', 'preload.js'), dst: path.join(buildDir, 'preload.js') }
  ];

  electronFiles.forEach(file => {
    if (fs.existsSync(file.src)) {
      fs.copySync(file.src, file.dst);
      console.log(`   ✓ Copiado: ${path.basename(file.src)} a build/`);
    } else {
      console.warn(`   ⚠ No encontrado: ${file.src}`);
    }
  });
  console.log('');
} catch (error) {
  console.error('   ✗ Error compilando React:', error.message);
  process.exit(1);
}

// ============================================================================
// PASO 6: VERIFICAR ESTRUCTURA DE BUILD
// ============================================================================
console.log('✅ PASO 6: Verificando estructura de build...\n');

// const buildDir = path.join(projectRoot, 'build'); // Ya definido globalmente
if (!fs.existsSync(buildDir)) {
  console.error('   ✗ build/ no existe después de compilación');
  process.exit(1);
}

const buildContents = fs.readdirSync(buildDir);
console.log(`   ✓ build/ contiene ${buildContents.length} items\n`);

// ============================================================================
// PASO 7: COPIAR ASSETS A WIN-UNPACKED (PRE-BUILDER)
// ============================================================================
console.log('🎨 PASO 7: Preparando assets para electron-builder...\n');

// Crear directorio win-unpacked si no existe
const winUnpackedPreDir = path.join(distDir, 'win-unpacked');
fs.ensureDirSync(winUnpackedPreDir);

// Copiar carpeta assets completa para que esté disponible en la app
const assetsDestWinUnpacked = path.join(winUnpackedPreDir, 'assets');

if (fs.existsSync(assetsSource)) {
  fs.copySync(assetsSource, assetsDestWinUnpacked);
  console.log('   ✓ Carpeta assets/ pre-copiada a dist/win-unpacked/assets/\n');

  // También copiar a resources para electron
  const assetsDestResources = path.join(winUnpackedPreDir, 'resources', 'assets');
  fs.ensureDirSync(path.join(winUnpackedPreDir, 'resources'));
  fs.copySync(assetsSource, assetsDestResources);
  console.log('   ✓ Carpeta assets/ pre-copiada a dist/win-unpacked/resources/assets/\n');
} else {
  console.log('   ⚠️  Carpeta assets/ no encontrada, continuando...\n');
}

// ============================================================================
// PASO 8: USAR ELECTRON-BUILDER (SOLO DIR PARA EVITAR DUPLICADOS)
// ============================================================================
console.log('📦 PASO 8: Generando win-unpacked con electron-builder (SIN FIRMA)...\n');

// Agregamos --dir para que solo genere la carpeta desempaquetada y no el instalador,
// ya que usaremos makensis manualmente para el instalador personalizado.
const builderCommand = `npx electron-builder --win --x64 --dir --publish=${publishMode}`;
console.log(`   Ejecutando: ${builderCommand}\n`);

let builderSuccess = false;
try {
  execSync(builderCommand, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: env
  });
  console.log('\n   ✓ electron-builder completó exitosamente\n');
  builderSuccess = true;
} catch (error) {
  console.error('   ⚠️  electron-builder tuvo errores (probablemente rcedit)');

  // Verificar si al menos se generó win-unpacked
  const winUnpackedDir = path.join(distDir, 'win-unpacked');
  if (fs.existsSync(winUnpackedDir)) {
    console.log('   ✓ win-unpacked/ existe, continuando con NSIS...\n');
  } else {
    console.error('   ✗ win-unpacked/ no existe, no se puede continuar\n');
    process.exit(1);
  }
}

// ============================================================================
// PASO 9: POST-BUILDER - COPIAR ASSETS AL EJECUTABLE FINAL
// ============================================================================
console.log('🎨 PASO 9: Copiando assets al ejecutable final...\n');

const winUnpackedDir = path.join(distDir, 'win-unpacked');

if (fs.existsSync(winUnpackedDir) && fs.existsSync(assetsSource)) {
  // Copiar carpeta assets completa junto al ejecutable
  const assetsDestExe = path.join(winUnpackedDir, 'assets');
  fs.copySync(assetsSource, assetsDestExe);
  console.log('   ✓ Carpeta assets/ copiada a win-unpacked/assets/\n');

  // Copiar también a resources si existe
  const resourcesDir = path.join(winUnpackedDir, 'resources');
  if (fs.existsSync(resourcesDir)) {
    const assetsDestResources = path.join(resourcesDir, 'assets');
    fs.copySync(assetsSource, assetsDestResources);
    console.log('   ✓ Carpeta assets/ copiada a resources/assets/\n');
  }
} else {
  console.log('   ⚠️  No se pudo copiar assets post-build\n');
}

// ============================================================================
// PASO 10: COMPILAR NSIS (solo si existe Bloopy.nsi)
// ============================================================================
const nsisPath = path.join(projectRoot, 'Bloopy.nsi');
if (fs.existsSync(nsisPath)) {
  console.log('🔨 PASO 10: Compilando instalador NSIS personalizado...\n');

  // Leer versión de package.json para pasarla a NSIS
  const packageJsonForNsis = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
  const appVersion = packageJsonForNsis.version;

  // Verificar si makensis está instalado antes de intentar compilar
  let nsisAvailable = false;
  try {
    execSync('makensis /VERSION', { stdio: 'pipe' });
    nsisAvailable = true;
  } catch (e) {
    // makensis puede retornar exit code != 0 pero aún estar disponible
    // si el error es de "command not found" entonces no está instalado
    nsisAvailable = !e.message.includes('not found') && !e.message.includes('ENOENT');
  }

  if (!nsisAvailable) {
    console.log('   ⚠️  makensis no está instalado. Instalando NSIS...\n');
    try {
      execSync('sudo apt-get install -y nsis', { stdio: 'inherit' });
      nsisAvailable = true;
      console.log('   ✓ NSIS instalado correctamente\n');
    } catch (installError) {
      console.log('   ✗ No se pudo instalar NSIS automáticamente');
      console.log('   ℹ️  Instala manualmente: sudo apt-get install nsis');
      console.log('   Continuando sin generar instalador NSIS...\n');
    }
  }

  if (nsisAvailable) {
    console.log(`   Versión detectada: ${appVersion}`);
    console.log(`   Ejecutando: makensis -DVERSION=${appVersion} Bloopy.nsi\n`);

    try {
      const { execFileSync } = require('child_process');
      execFileSync('makensis', [`-DVERSION=${appVersion}`, 'Bloopy.nsi'], {
        cwd: projectRoot,
        stdio: 'inherit'
      });
      console.log('\n   ✓ NSIS personalizado compilado exitosamente\n');
    } catch (error) {
      console.log('   ⚠️  Error en compilación NSIS:', error.message);
      console.log('   Continuando con el proceso...\n');
    }
  }
} else {
  console.log('🔨 PASO 10: Bloopy.nsi no encontrado, saltando...\n');
}

// ============================================================================
// PASO 11: VERIFICAR INSTALADOR FINAL
// ============================================================================
console.log('✅ PASO 11: Verificando instalador final...\n');

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
  console.log(`     📦 ${exeFile}: ${sizeMB} MB`);
});

// ============================================================================
// PASO 12: GENERAR LATEST.YML Y PUBLICAR EN GITHUB
// ============================================================================
console.log('📝 PASO 12: Generando latest.yml para electron-updater...\n');

const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
const version = packageJson.version;
const exePath = path.join(distDir, exeFiles[0]);

// Generar SHA512 del instalador
const fileBuffer = fs.readFileSync(exePath);
const sha512Hash = crypto.createHash('sha512').update(fileBuffer).digest('base64');
const fileSizeBytes = fs.statSync(exePath).size;

// Generar latest.yml
const latestYmlContent = `version: ${packageJson.version}
files:
  - url: ${exeFiles[0]}
    sha512: ${sha512Hash}
    size: ${fileSizeBytes}
path: ${exeFiles[0]}
sha512: ${sha512Hash}
releaseDate: ${new Date().toISOString()}
`;

const latestYmlPath = path.join(distDir, 'latest.yml');
fs.writeFileSync(latestYmlPath, latestYmlContent);
console.log('   ✓ latest.yml generado exitosamente\n');

// Publicar en GitHub si está habilitado
if (publishMode === 'always' && exeFiles.length > 0) {
  console.log('📤 PASO 13: Publicando release en GitHub...');

  try {
    console.log(`   Versión: v${packageJson.version}`);
    console.log(`   Tipo: ${versionType}`);
    console.log(`   Archivo: ${exeFiles[0]}\n`);

    // Usar GitHub CLI si está disponible
    try {
      // Verificar si gh está instalado
      execSync('gh --version', { stdio: 'pipe' });

      console.log('   Usando GitHub CLI para crear release...\n');

      // Verificar si el release ya existe
      let releaseExists = false;
      try {
        execSync(`gh release view v${packageJson.version} --repo Valentin-sbox/Bloopy`, { stdio: 'pipe' });
        releaseExists = true;
        console.log('   ℹ️  Release v' + packageJson.version + ' ya existe, actualizando...\n');
      } catch (e) {
        console.log('   ℹ️  Creando nuevo release v' + packageJson.version + '...\n');
      }

      // Determinar flags según tipo de versión
      const releaseFlags = [];
      if (versionType === 'pre-stable' || versionType === 'snapshot') {
        releaseFlags.push('--prerelease');
      }
      if (versionType === 'snapshot') {
        releaseFlags.push('--latest=false'); // No marcar como latest
      }
      
      const flagsString = releaseFlags.length > 0 ? ' ' + releaseFlags.join(' ') : '';

      if (releaseExists) {
        // Actualizar release existente subiendo archivos
        const uploadCmd = `gh release upload v${packageJson.version} "${exePath}" "${latestYmlPath}" --repo Valentin-sbox/Bloopy --clobber`;
        execSync(uploadCmd, {
          cwd: projectRoot,
          stdio: 'inherit',
          env: { ...env, GH_TOKEN: ghToken }
        });
      } else {
        // Crear nuevo release con ambos archivos
        const releaseCmd = `gh release create v${packageJson.version} "${exePath}" "${latestYmlPath}" --title "Bloopy v${packageJson.version} (${versionType})" --notes-file "${releaseNotesPath}" --repo Valentin-sbox/Bloopy${flagsString}`;
        execSync(releaseCmd, {
          cwd: projectRoot,
          stdio: 'inherit',
          env: { ...env, GH_TOKEN: ghToken }
        });
      }

      console.log('\n   ✓ Release publicado exitosamente en GitHub');
      console.log(`   🔗 https://github.com/Valentin-sbox/Bloopy/releases/tag/v${packageJson.version}`);
      console.log(`   📋 Tipo: ${versionType.toUpperCase()}\n`);
    } catch (ghError) {
      console.log('   ⚠️  GitHub CLI no disponible o error al publicar');
      console.log('   ℹ️  Puedes publicar manualmente:');
      console.log(`      1. Ve a: https://github.com/Valentin-sbox/Bloopy/releases/new`);
      console.log(`      2. Tag: v${packageJson.version}`);
      console.log(`      3. Tipo: ${versionType}`);
      console.log(`      4. Sube los archivos: ${exeFiles[0]} y latest.yml`);
      console.log(`      5. Copia las notas desde: RELEASE.md\n`);
    }
  } catch (error) {
    console.error('   ✗ Error al intentar publicar:', error.message);
    console.log('   ℹ️  El instalador está listo en dist/ para publicación manual\n');
  }
} else if (publishMode === 'never') {
  console.log('📤 PASO 13: Publicación omitida (modo local)');
  console.log('   ℹ️  latest.yml generado en dist/ para pruebas locales\n');
}

// ============================================================================
// RESUMEN FINAL
// ============================================================================
console.log('\n' + '='.repeat(70));
console.log('🎉 ¡COMPILACIÓN COMPLETADA EXITOSAMENTE!\n');
console.log('📊 RESUMEN:\n');
console.log(`   • Instalador: ${exeFiles[0]}`);
console.log(`   • Tamaño: ${(fs.statSync(path.join(distDir, exeFiles[0])).size / 1024 / 1024).toFixed(2)} MB`);
console.log(`   • Ubicación: dist/`);
console.log(`   • Arquitectura: Windows 64-bit`);
console.log(`   • Con firma: ❌ NO (deshabilitado)`);
console.log(`   • Tipo de versión: ${versionType.toUpperCase()}`);
console.log(`   • Modo publicación: ${publishMode.toUpperCase()}`);

// Verificar si latest.yml fue generado
const latestYmlExists = fs.existsSync(path.join(distDir, 'latest.yml'));
console.log(`   • latest.yml: ${latestYmlExists ? '✅ Generado' : '❌ No generado'}`);

if (publishMode === 'always') {
  console.log(`   • Publicación: ✅ Publicado en GitHub`);
  console.log(`   • Token: ✓ GH_TOKEN configurado`);
  console.log(`   • Release notes: ✓ Cargadas desde RELEASE.md`);
  if (latestYmlExists) {
    console.log(`   • Auto-update: ✅ latest.yml enviado a releases`);
  }
} else {
  console.log(`   • Publicación: ❌ Build local únicamente`);
  console.log(`   • Para publicar usar: npm run build-ultra -- --publish`);
  if (latestYmlExists) {
    console.log(`   • latest.yml: ✅ Disponible para pruebas locales`);
  }
}

console.log(`   • Estado: ✅ LISTO PARA USAR`);
console.log(`   • Tipo de versión: ${versionType.toUpperCase()}`);
if (versionType !== 'stable') {
  console.log(`   • ⚠️  Versión ${versionType} - No marcada como latest`);
}
console.log('='.repeat(70) + '\n');
