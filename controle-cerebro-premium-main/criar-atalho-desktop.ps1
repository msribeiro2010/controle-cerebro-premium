# Script PowerShell para criar atalho na área de trabalho
# Executa: powershell -ExecutionPolicy Bypass -File criar-atalho-desktop.ps1

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Criando Atalho PJE Automation" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Obter caminho da área de trabalho
$desktopPath = [Environment]::GetFolderPath("Desktop")
Write-Host "Area de trabalho: $desktopPath" -ForegroundColor Yellow

# Caminho do projeto atual
$projectPath = $PSScriptRoot
Write-Host "Diretorio do projeto: $projectPath" -ForegroundColor Yellow
Write-Host ""

# Caminho do arquivo start.bat
$startBatPath = Join-Path $projectPath "start.bat"

# Verificar se start.bat existe
if (-not (Test-Path $startBatPath)) {
    Write-Host "ERRO: Arquivo start.bat nao encontrado!" -ForegroundColor Red
    Write-Host "Procurado em: $startBatPath" -ForegroundColor Red
    pause
    exit 1
}

# Nome do atalho na área de trabalho
$shortcutName = "Central IA - NAPJe.lnk"
$shortcutPath = Join-Path $desktopPath $shortcutName

# Criar objeto WScript.Shell
$WScriptShell = New-Object -ComObject WScript.Shell

# Criar atalho
$shortcut = $WScriptShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $startBatPath
$shortcut.WorkingDirectory = $projectPath
$shortcut.Description = "Sistema de Automacao Inteligente para PJE - Peritos e Servidores"
$shortcut.IconLocation = "shell32.dll,277"  # Ícone de robô/automação
$shortcut.Save()

Write-Host "SUCESSO! Atalho criado:" -ForegroundColor Green
Write-Host "  -> $shortcutPath" -ForegroundColor Green
Write-Host ""
Write-Host "Instrucoes:" -ForegroundColor Cyan
Write-Host "  1. Va para a area de trabalho" -ForegroundColor White
Write-Host "  2. Clique duas vezes em '$shortcutName'" -ForegroundColor White
Write-Host "  3. O sistema sera iniciado automaticamente" -ForegroundColor White
Write-Host ""
Write-Host "Pressione qualquer tecla para fechar..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
