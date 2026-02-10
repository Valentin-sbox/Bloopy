; Block Guard Installer Script - NSIS Installer
; Version: 4.0.0

!include "MUI2.nsh"
!include "x64.nsh"

; ============================================================================
; CONFIGURACIONES
; ============================================================================

SetCompress off
CRCCheck on

; Definiciones de producto
!define PRODUCT_NAME "Block Guard"
!define PRODUCT_VERSION "4.0.0"
!define PRODUCT_PUBLISHER "Block Guard Team"
!define PRODUCT_WEB_SITE "https://github.com/wishpixel12-boop/blockGuard"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\Block Guard.exe"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKLM"

; Información general
Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "/workspaces/blockGuard/dist/Block-Guard-Setup-4.0.0.exe"
InstallDir "$PROGRAMFILES64\Block Guard"
InstallDirRegKey HKLM "${PRODUCT_DIR_REGKEY}" ""
ShowInstDetails show
ShowUnInstDetails show
RequestExecutionLevel admin

; ============================================================================
; CONFIGURACIÓN MUI2 - INTERFAZ VISUAL
; ============================================================================

; Establecer icono del instalador
!define MUI_ICON "/workspaces/blockGuard/assets/icon.ico"
!define MUI_UNICON "/workspaces/blockGuard/assets/icon.ico"

; Márgenes en el lado izquierdo
!define MUI_WELCOMEPAGE_TITLE "Bienvenido a Block Guard ${PRODUCT_VERSION}"
!define MUI_WELCOMEPAGE_TEXT "Este asistente lo guiará a través de la instalación de Block Guard.$\n$\nBlock Guard es un editor de texto nativo para escritores. Organiza proyectos, escribe con formato enriquecido y realiza un seguimiento de tu progreso.$\n$\nHaga clic en Siguiente para continuar."

!define MUI_FINISHPAGE_TITLE "Instalación completada"
!define MUI_FINISHPAGE_TEXT "Block Guard se ha instalado exitosamente en seu computadora.$\n$\nHaga clic en Terminar para cerrar este asistente."
!define MUI_FINISHPAGE_RUN "$INSTDIR\Block Guard.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Ejecutar Block Guard ahora"

; Páginas del instalador
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; ============================================================================
; IDIOMAS
; ============================================================================

!insertmacro MUI_LANGUAGE "Spanish"
!insertmacro MUI_LANGUAGE "English"

; ============================================================================
; SECCIONES DE INSTALACIÓN
; ============================================================================

; Sección principal - Instalar archivos
Section "Instalar Block Guard"
  SetOverwrite try
  SetOutPath "$INSTDIR"
  
  ; Copiar TODOS los archivos de win-unpacked
  File /r "/workspaces/blockGuard/dist/win-unpacked\*.*"
  
  ; Crear desinstalador
  WriteUninstaller "$INSTDIR\uninstall.exe"
  
  ; Crear entradas de registro para Agregar/Quitar Programas
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayName" "$(^Name)"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\uninstall.exe"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\Block Guard.exe"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
  WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\Block Guard.exe"
  
SectionEnd

; Sección libre
Section -AdditionalIcons
  CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\Block Guard.exe"
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\Desinstalar ${PRODUCT_NAME}.lnk" "$INSTDIR\uninstall.exe"
  CreateShortCut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\Block Guard.exe" "" "$INSTDIR\Block Guard.exe" 0
SectionEnd

; ============================================================================
; SECCIÓN DE DESINSTALACIÓN
; ============================================================================

Section Uninstall
  
  ; Eliminar accesos directos del menú Inicio
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\Desinstalar ${PRODUCT_NAME}.lnk"
  RMDir "$SMPROGRAMS\${PRODUCT_NAME}"
  
  ; Eliminar acceso directo del Escritorio
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  
  ; Eliminar archivos instalados de forma recursiva
  RMDir /r "$INSTDIR\locales"
  RMDir /r "$INSTDIR\resources"
  Delete "$INSTDIR\*.*"
  RMDir "$INSTDIR"
  
  ; Eliminar entradas de registro
  DeleteRegKey HKLM "${PRODUCT_UNINST_KEY}"
  DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"
  
  SetAutoClose true
  
SectionEnd

; ============================================================================
; FUNCIONES
; ============================================================================

Function .onInit
  ${If} ${RunningX64}
    ; Sistema de 64 bits detectado
  ${Else}
    MessageBox MB_OK "Este instalador solo funciona en sistemas de 64 bits."
    Quit
  ${EndIf}
FunctionEnd

