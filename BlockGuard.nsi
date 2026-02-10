; ============================================================================
; NSIS Installer for Block Guard v1.24.0
; ============================================================================
; Este instalador está diseñado para trabajar con electron-builder.
; NO edite esto directamente - electron-builder genera la versión final.
; ============================================================================

!include "MUI2.nsh"
!include "x64.nsh"
!include "LogicLib.nsh"

; ============================================================================
; CONFIGURACIÓN BÁSICA DEL INSTALADOR
; ============================================================================

SetCompressor /SOLID lzma
AllowSkipFiles off
SetDateSave on
SetDatablockOptimize on
CRCCheck on
InstallColors 0xFFFFFF 0x3366FF

; Información del instalador
Name "Block Guard"
!define VERSION "1.26.0"
!define APPID "com.blockguard.app"
!define COMPANY "Block Guard Team"

OutFile "dist\BlockGuard-Setup-${VERSION}.exe"
InstallDir "$PROGRAMFILES\Block Guard"  

; Variables globales
Var /GLOBAL MUI_TEMP
Var /GLOBAL UNINSTALL_PATH

; ============================================================================
; PÁGINAS INSTALADOR
; ============================================================================

; Página de bienvenida
!insertmacro MUI_PAGE_WELCOME

; Página de contrato de licencia (opcional)
;!insertmacro MUI_PAGE_LICENSE "LICENSE.txt"

; Página de selección de carpeta
!insertmacro MUI_PAGE_DIRECTORY

; Página de instalación
!insertmacro MUI_PAGE_INSTFILES

; Página final
!insertmacro MUI_PAGE_FINISH

; ============================================================================
; PÁGINAS DESINSTALADOR
; ============================================================================

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; ============================================================================
; IDIOMA
; ============================================================================

!insertmacro MUI_LANGUAGE "Spanish"
!insertmacro MUI_LANGUAGE "English"

; ============================================================================
; SECCIÓN: INSTALAR LA APLICACIÓN
; ============================================================================

Section "Instalar Block Guard"
  SetOverwrite try
  SetOutPath "$INSTDIR"
  
  ; Mostrar estado
  DetailPrint "Copiando archivos de Block Guard..."
  
  ; Copiar todos los archivos desde la carpeta de compilación
  ; electron-builder genera el ejecutable en esta carpeta
  File /r "dist\win-unpacked\*.*"
  
  ; Verificar que el ejecutable existe
  ${If} ${FileExists} "$INSTDIR\Block Guard.exe"
    DetailPrint "Ejecutable encontrado: Block Guard.exe"
  ${ElseIf} ${FileExists} "$INSTDIR\BlockGuard.exe"
    DetailPrint "Ejecutable encontrado: BlockGuard.exe"
  ${Else}
    MessageBox MB_OK "Advertencia: No se encontró el ejecutable de Block Guard"
    DetailPrint "ERROR: Ejecutable no encontrado"
  ${EndIf}
  
  ; Crear el desinstalador
  DetailPrint "Creando desinstalador..."
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  
  ; Guardar ruta de instalación en registro
  DetailPrint "Registrando instalación..."
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Block Guard" "DisplayName" "Block Guard v${VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Block Guard" "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Block Guard" "BackupDirectory" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Block Guard" "InstallPath" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Block Guard" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Block Guard" "DisplayIcon" "$INSTDIR\Block Guard.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Block Guard" "Publisher" "${COMPANY}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Block Guard" "URLInfoAbout" "https://blockguard.app"
  
  ; Crear accesos directos en Menú Inicio
  DetailPrint "Creando accesos directos..."
  CreateDirectory "$SMPROGRAMS\Block Guard"
  CreateShortCut "$SMPROGRAMS\Block Guard\Block Guard.lnk" "$INSTDIR\Block Guard.exe" "" "$INSTDIR\Block Guard.exe" 0
  CreateShortCut "$SMPROGRAMS\Block Guard\Desinstalar.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\Uninstall.exe" 0
  
  ; Crear acceso directo en el escritorio (opcional)
  ${If} ${FileExists} "$INSTDIR\Block Guard.exe"
    CreateShortCut "$DESKTOP\Block Guard.lnk" "$INSTDIR\Block Guard.exe" "" "$INSTDIR\Block Guard.exe" 0
    DetailPrint "Acceso directo en escritorio creado"
  ${EndIf}
  
  DetailPrint "¡Instalación completada!"
  
SectionEnd

; ============================================================================
; SECCIÓN: DESINSTALAR LA APLICACIÓN
; ============================================================================

Section "Uninstall"
  DetailPrint "Eliminando Block Guard..."
  
  ; Eliminar accesos directos
  Delete "$DESKTOP\Block Guard.lnk"
  RMDir /r "$SMPROGRAMS\Block Guard"
  
  ; Eliminar toda la carpeta de instalación
  RMDir /r "$INSTDIR"
  
  ; Limpiar datos del usuario (Appdata) - OPCIONAL
  ; Descomenta esto si quieres eliminar datos guardados del usuario
  ; RMDir /r "$APPDATA\Block Guard"
  
  ; Limpiar registro
  DetailPrint "Limpiando registro..."
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Block Guard"
  DeleteRegKey HKLM "Software\Block Guard"
  
  DetailPrint "¡Desinstalación completada!"
  
SectionEnd

; ============================================================================
; FUNCIONES
; ============================================================================

Function .onInit
  ; Detectar arquitectura del sistema
  ${If} ${RunningX64}
    DetailPrint "Sistema de 64 bits detectado"
  ${Else}
    DetailPrint "Sistema de 32 bits detectado"
  ${EndIf}
FunctionEnd

Function un.onInit
  MessageBox MB_ICONQUESTION|MB_YESNO "¿Están seguros que desean desinstalar Block Guard?" IDYES +2
  Abort
FunctionEnd
