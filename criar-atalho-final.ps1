# Script para criar atalho definitivo do Central IA - NAPJe

$desktopPath = [Environment]::GetFolderPath("Desktop")
$projectPath = $PSScriptRoot
$batFile = Join-Path $projectPath "Iniciar-Central-IA.bat"
$shortcutPath = Join-Path $desktopPath "Central IA - NAPJe.lnk"

# Verificar se o .bat existe
if (-not (Test-Path $batFile)) {
    Write-Host "ERRO: Arquivo Iniciar-Central-IA.bat nao encontrado!" -ForegroundColor Red
    exit 1
}

# Criar atalho
$WScriptShell = New-Object -ComObject WScript.Shell
$shortcut = $WScriptShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $batFile
$shortcut.WorkingDirectory = $projectPath
$shortcut.Description = "Central IA - NAPJe - Sistema de Automacao Inteligente para PJE"
$shortcut.WindowStyle = 1  # Janela normal
$shortcut.IconLocation = "shell32.dll,277"
$shortcut.Save()

Write-Host ""
Write-Host "====================================" -ForegroundColor Green
Write-Host "  ATALHO CRIADO COM SUCESSO!" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Localizacao: $shortcutPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "Duplo clique no atalho 'Central IA - NAPJe' na area de trabalho para iniciar!" -ForegroundColor Yellow
Write-Host ""
