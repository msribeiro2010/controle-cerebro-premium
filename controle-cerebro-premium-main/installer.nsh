; PJE Perito Automation - NSIS Installer Configuration
; Custom installer script for enhanced Windows installation

!define PRODUCT_NAME "PJE Perito Automation"
!define PRODUCT_VERSION "1.0.0"
!define PRODUCT_PUBLISHER "PJE Automation Team"
!define PRODUCT_WEB_SITE "https://github.com/pje-automation"

; Modern UI
!include "MUI2.nsh"

; Request admin privileges on Windows Vista and above
RequestExecutionLevel admin

; Installer pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; Language
!insertmacro MUI_LANGUAGE "PortugueseBR"

; Custom install actions
Section "!${PRODUCT_NAME}" SEC01
  ; Set output path to installation directory
  SetOutPath "$INSTDIR"
  
  ; Create start menu shortcut
  CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_NAME}.exe"
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\Desinstalar.lnk" "$INSTDIR\Uninstall.exe"
  
  ; Create desktop shortcut (optional)
  CreateShortCut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_NAME}.exe"
  
  ; Write uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  
  ; Register uninstaller in Windows
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "NoRepair" 1
SectionEnd

; Uninstaller section
Section "Uninstall"
  ; Remove files
  Delete "$INSTDIR\Uninstall.exe"
  RMDir /r "$INSTDIR"
  
  ; Remove start menu items
  RMDir /r "$SMPROGRAMS\${PRODUCT_NAME}"
  
  ; Remove desktop shortcut
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  
  ; Remove registry entries
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
SectionEnd

; Custom install functions
Function .onInit
  ; Check if already installed
  ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "UninstallString"
  StrCmp $R0 "" done
  
  MessageBox MB_YESNO|MB_ICONQUESTION "${PRODUCT_NAME} já está instalado. Deseja desinstalar a versão anterior?" IDYES uninst
  Abort
  
  uninst:
    ExecWait '$R0 /S _?=$INSTDIR'
  
  done:
FunctionEnd