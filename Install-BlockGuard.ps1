# Block Guard - Script de Instalación para Windows
# Ejecutar como Administrador

param(
    [Parameter(Mandatory=$false)]
    [string]$InstallPath = "$env:ProgramFiles\Block Guard"
)

# Verificar si se ejecuta como administrador
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]"Administrator")) {
    Write-Host "Este script debe ejecutarse como Administrador. Reiniciando..." -ForegroundColor Red
    Start-Process powershell.exe -ArgumentList "-File", $MyInvocation.MyCommand.Path -Verb RunAs
    exit
}

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Block Guard - Instalador v4.0.0" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Crear directorio de instalación si no existe
if (-not (Test-Path $InstallPath)) {
    Write-Host "Creando directorio de instalación..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
}

# Obtener la ruta del script
$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path

# Copiar los archivos
Write-Host "Copiando archivos de instalación..." -ForegroundColor Yellow
Copy-Item -Path "$ScriptPath\*" -Destination $InstallPath -Recurse -Force -Exclude "*.ps1", "*.nsi"

# Crear acceso directo en el escritorio
Write-Host "Creando acceso directo en el escritorio..." -ForegroundColor Yellow
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = "$DesktopPath\Block Guard.lnk"
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "$InstallPath\Block Guard.exe"
$Shortcut.WorkingDirectory = $InstallPath
$Shortcut.IconLocation = "$InstallPath\Block Guard.exe,0"
$Shortcut.Save()

# Crear acceso directo en Menú Inicio
Write-Host "Creando acceso directo en Menú Inicio..." -ForegroundColor Yellow
$StartMenuPath = "$env:AppData\Microsoft\Windows\Start Menu\Programs\Block Guard"
New-Item -ItemType Directory -Path $StartMenuPath -Force | Out-Null
$StartMenuShortcut = "$StartMenuPath\Block Guard.lnk"
$Shortcut = $WshShell.CreateShortcut($StartMenuShortcut)
$Shortcut.TargetPath = "$InstallPath\Block Guard.exe"
$Shortcut.WorkingDirectory = $InstallPath
$Shortcut.IconLocation = "$InstallPath\Block Guard.exe,0"
$Shortcut.Save()

# Crear desinstalador
Write-Host "Creando desinstalador..." -ForegroundColor Yellow
$UninstallerScript = @"
`$InstallPath = "$InstallPath"
`$Choice = [System.Windows.Forms.MessageBox]::Show("¿Está seguro de que desea desinstalar Block Guard?", "Confirmar desinstalación", [System.Windows.Forms.MessageBoxButtons]::YesNo)
if (`$Choice -eq "Yes") {
    Remove-Item -Path `$InstallPath -Recurse -Force
    Remove-Item -Path "$DesktopPath\Block Guard.lnk" -Force -ErrorAction SilentlyContinue
    Remove-Item -Path "$StartMenuPath" -Recurse -Force -ErrorAction SilentlyContinue
    [System.Windows.Forms.MessageBox]::Show("Block Guard ha sido desinstalado.", "Desinstalación completa")
}
"@

$UninstallerPath = "$InstallPath\Uninstall.ps1"
Set-Content -Path $UninstallerPath -Value $UninstallerScript -Encoding UTF8

Write-Host ""
Write-Host "==================================" -ForegroundColor Green
Write-Host "✓ ¡Instalación completada!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""
Write-Host "Block Guard se ha instalado en: $InstallPath" -ForegroundColor Cyan
Write-Host "Acceso directo creado en el escritorio" -ForegroundColor Cyan
Write-Host ""
Write-Host "¿Desea ejecutar Block Guard ahora?" -ForegroundColor Yellow
$RunNow = Read-Host "Escriba 'si' para ejecutar: "
if ($RunNow.ToLower() -eq "si") {
    & "$InstallPath\Block Guard.exe"
}
