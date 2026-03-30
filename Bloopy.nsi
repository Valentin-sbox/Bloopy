; ============================================================================
; BLOOPY - Instalador NSIS Minimalista y Moderno
; ============================================================================
; Instalador personalizado con diseño limpio y moderno
; ============================================================================

!include "MUI2.nsh"
!include "x64.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"

; ============================================================================
; CONFIGURACIÓN BÁSICA
; ============================================================================

SetCompressor /SOLID lzma
AllowSkipFiles off
SetDateSave on
SetDatablockOptimize on
CRCCheck on
SilentInstall normal

; Información del instalador
Name "Bloopy"
!ifndef VERSION
  !define VERSION "1.26.34"
!endif
!define APPID "com.Bloopy.app"
!define COMPANY "Bloopy Team"
!define URL "https://github.com/Valentin-sbox/Bloopy"
OutFile "dist\Bloopy-Setup-${VERSION}.exe"
InstallDir "$PROGRAMFILES\Bloopy"
InstallDirRegKey HKLM "Software\Bloopy" "InstallPath"

; Iconos
Icon "public\assets\icon.ico"
UninstallIcon "public\assets\icon.ico"

; Permisos de administrador
RequestExecutionLevel admin

; Colores modernos (fondo blanco, texto oscuro)
InstallColors /windows

; ============================================================================
; CONFIGURACIÓN DE LA INTERFAZ MODERNA
; ============================================================================

!define MUI_ABORTWARNING
!define MUI_ICON "public\assets\icon.ico"
!define MUI_UNICON "public\assets\icon.ico"

; Personalización de colores y fuentes
!define MUI_BGCOLOR FFFFFF
!define MUI_TEXTCOLOR 2D3748

; Página de bienvenida personalizada
!define MUI_WELCOMEPAGE_TITLE "Bienvenido a Bloopy"
!define MUI_WELCOMEPAGE_TEXT "Este asistente te guiará en la instalación de Bloopy.$\r$\n$\r$\nBloopy es un editor de texto nativo diseñado para escritores.$\r$\n$\r$\nHaz clic en Siguiente para continuar."

; Página de finalización personalizada
!define MUI_FINISHPAGE_TITLE "Instalación Completada"
!define MUI_FINISHPAGE_TEXT "Bloopy se ha instalado correctamente en tu computadora.$\r$\n$\r$\nPuedes iniciar Bloopy desde el acceso directo en tu escritorio o menú de inicio."
!define MUI_FINISHPAGE_RUN "$INSTDIR\Bloopy.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Iniciar Bloopy ahora"
!define MUI_FINISHPAGE_LINK "Visitar el sitio web de Bloopy"
!define MUI_FINISHPAGE_LINK_LOCATION "${URL}"

; ============================================================================
; PÁGINAS DEL INSTALADOR
; ============================================================================

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; ============================================================================
; PÁGINAS DEL DESINSTALADOR
; ============================================================================

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; ============================================================================
; IDIOMAS
; ============================================================================

!insertmacro MUI_LANGUAGE "Spanish"
!insertmacro MUI_LANGUAGE "English"

; ============================================================================
; SECCIÓN: INSTALACIÓN
; ============================================================================

Section "Bloopy" SecMain
  SectionIn RO  ; Obligatorio
  
  SetOutPath "$INSTDIR"
  SetOverwrite on
  SetOverwrite ifnewer  ; Sobrescribir si es más nuevo
  
  ; Mostrar progreso
  DetailPrint "Instalando Bloopy ${VERSION}..."
  
  ; Eliminar archivos antiguos primero (con reintentos)
  DetailPrint "Limpiando instalación anterior..."
  Delete /REBOOTOK "$INSTDIR\Bloopy.exe"
  RMDir /r /REBOOTOK "$INSTDIR\resources"
  RMDir /r /REBOOTOK "$INSTDIR\locales"
  
  ; Esperar un momento
  Sleep 500
  
  ; Copiar archivos de la aplicación
  DetailPrint "Copiando archivos nuevos..."
  File /r "dist\win-unpacked\*.*"
  
  ; Copiar icono
  ${If} ${FileExists} "public\assets\icon.ico"
    CopyFiles /SILENT "public\assets\icon.ico" "$INSTDIR\icon.ico"
  ${EndIf}
  
  ; Crear desinstalador
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  
  ; Registrar en Windows
  WriteRegStr HKLM "Software\Bloopy" "InstallPath" "$INSTDIR"
  WriteRegStr HKLM "Software\Bloopy" "Version" "${VERSION}"
  WriteRegStr HKLM "Software\Bloopy" "InstallDate" "$\"$0$\""
  
  ; Agregar a Programas y Características
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Bloopy" \
    "DisplayName" "Bloopy"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Bloopy" \
    "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Bloopy" \
    "Publisher" "${COMPANY}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Bloopy" \
    "URLInfoAbout" "${URL}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Bloopy" \
    "DisplayIcon" "$INSTDIR\Bloopy.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Bloopy" \
    "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Bloopy" \
    "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Bloopy" \
    "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Bloopy" \
    "NoRepair" 1
  
  ; Tamaño estimado de instalación (aproximado en KB)
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Bloopy" \
    "EstimatedSize" 200000
  
  ; Crear accesos directos
  DetailPrint "Creando accesos directos..."
  
  ; Menú de inicio
  CreateDirectory "$SMPROGRAMS\Bloopy"
  CreateShortCut "$SMPROGRAMS\Bloopy\Bloopy.lnk" \
    "$INSTDIR\Bloopy.exe" \
    "" \
    "$INSTDIR\Bloopy.exe" \
    0 \
    SW_SHOWNORMAL \
    "" \
    "Editor de texto para escritores"
  
  CreateShortCut "$SMPROGRAMS\Bloopy\Desinstalar Bloopy.lnk" \
    "$INSTDIR\Uninstall.exe" \
    "" \
    "$INSTDIR\Uninstall.exe" \
    0
  
  ; Escritorio
  CreateShortCut "$DESKTOP\Bloopy.lnk" \
    "$INSTDIR\Bloopy.exe" \
    "" \
    "$INSTDIR\Bloopy.exe" \
    0 \
    SW_SHOWNORMAL \
    "" \
    "Editor de texto para escritores"
  
  DetailPrint "Instalación completada exitosamente"
  DetailPrint "Versión instalada: ${VERSION}"
SectionEnd

; ============================================================================
; SECCIÓN: DESINSTALACIÓN
; ============================================================================

Section "Uninstall"
  ; Eliminar accesos directos
  Delete "$DESKTOP\Bloopy.lnk"
  Delete "$SMPROGRAMS\Bloopy\Bloopy.lnk"
  Delete "$SMPROGRAMS\Bloopy\Desinstalar Bloopy.lnk"
  RMDir "$SMPROGRAMS\Bloopy"
  
  ; Eliminar archivos de la aplicación
  RMDir /r "$INSTDIR"
  
  ; Limpiar registro
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Bloopy"
  DeleteRegKey HKLM "Software\Bloopy"
  
  ; Nota: No eliminamos datos de usuario en AppData para preservar configuraciones
  ; Si el usuario quiere eliminar todo, puede hacerlo manualmente desde:
  ; %APPDATA%\Bloopy
SectionEnd

; ============================================================================
; FUNCIONES
; ============================================================================

Function .onInit
  ; Verificar arquitectura del sistema primero
  ${If} ${RunningX64}
    DetailPrint "Sistema de 64 bits detectado"
  ${Else}
    MessageBox MB_OK|MB_ICONEXCLAMATION \
      "Bloopy requiere un sistema operativo de 64 bits.$\r$\n$\r$\nLa instalación se cancelará."
    Abort
  ${EndIf}
  
  ; Verificar si ya está instalado
  ReadRegStr $R0 HKLM "Software\Bloopy" "InstallPath"
  ReadRegStr $R1 HKLM "Software\Bloopy" "Version"
  
  ${If} $R0 != ""
    ; Ya está instalado, verificar versión
    ${If} $R1 == ""
      StrCpy $R1 "desconocida"
    ${EndIf}
    
    MessageBox MB_YESNO|MB_ICONQUESTION \
      "Bloopy versión $R1 ya está instalado en:$\r$\n$R0$\r$\n$\r$\n¿Deseas actualizar/reinstalar a la versión ${VERSION}?$\r$\n$\r$\nNota: La aplicación se cerrará automáticamente si está en ejecución." \
      IDYES continuar
    Abort
    
    continuar:
    ; Intentar cerrar la aplicación si está en ejecución (múltiples intentos)
    DetailPrint "Cerrando Bloopy si está en ejecución..."
    
    ; Primer intento: cerrar normalmente
    nsExec::ExecToStack 'taskkill /IM Bloopy.exe /T'
    Pop $0
    Pop $1
    Sleep 1000
    
    ; Segundo intento: forzar cierre
    nsExec::ExecToStack 'taskkill /F /IM Bloopy.exe /T'
    Pop $0
    Pop $1
    
    ${If} $0 == 0
      DetailPrint "Bloopy cerrado exitosamente"
    ${Else}
      DetailPrint "Bloopy no estaba en ejecución"
    ${EndIf}
    
    ; Esperar más tiempo para que se liberen todos los archivos
    DetailPrint "Esperando a que se liberen los archivos..."
    Sleep 3000
    
    ; Eliminar archivos antiguos antes de instalar (con reintentos)
    DetailPrint "Eliminando archivos antiguos..."
    
    ; Intentar eliminar directorios completos primero
    RMDir /r "$R0\resources"
    RMDir /r "$R0\locales"
    
    ; Eliminar archivos específicos con reintentos
    Delete /REBOOTOK "$R0\Bloopy.exe"
    Delete /REBOOTOK "$R0\*.dll"
    Delete /REBOOTOK "$R0\*.pak"
    Delete /REBOOTOK "$R0\*.bin"
    Delete /REBOOTOK "$R0\*.dat"
    Delete /REBOOTOK "$R0\chrome_*.exe"
    Delete /REBOOTOK "$R0\*.json"
    Delete /REBOOTOK "$R0\*.node"
    
    DetailPrint "Archivos antiguos eliminados, procediendo con la instalación..."
  ${EndIf}
FunctionEnd

Function un.onInit
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "¿Estás seguro de que deseas desinstalar Bloopy?$\r$\n$\r$\nTus documentos y configuraciones se conservarán." \
    IDYES +2
  Abort
FunctionEnd

Function .onInstSuccess
  ; Mensaje de éxito
  DetailPrint "¡Bloopy se instaló correctamente!"
FunctionEnd

Function un.onUninstSuccess
  MessageBox MB_OK|MB_ICONINFORMATION \
    "Bloopy se desinstaló correctamente.$\r$\n$\r$\nTus documentos y configuraciones se conservaron en:%APPDATA%\Bloopy"
FunctionEnd

; ============================================================================
; DESCRIPCIONES DE SECCIONES
; ============================================================================

LangString DESC_SecMain ${LANG_SPANISH} "Archivos principales de Bloopy"
LangString DESC_SecMain ${LANG_ENGLISH} "Bloopy main files"

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecMain} $(DESC_SecMain)
!insertmacro MUI_FUNCTION_DESCRIPTION_END
