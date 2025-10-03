#!/bin/bash

# Script para forçar a janela do PJE Automation a aparecer em primeiro plano
# Use este script se a aplicação estiver executando mas a janela não aparecer

echo "🔍 Procurando janela do PJE Automation..."

# Tentar diferentes métodos para trazer a janela para frente
echo "📱 Método 1: Ativando processo Electron..."
osascript -e 'tell application "System Events" to set frontmost of first process whose name contains "Electron" to true' 2>/dev/null

echo "📱 Método 2: Ativando por nome da aplicação..."
osascript -e 'tell application "System Events" to set frontmost of first process whose name contains "PJE" to true' 2>/dev/null

echo "📱 Método 3: Forçando todas as janelas Electron..."
osascript -e '
tell application "System Events"
    repeat with theProcess in (every process whose name contains "Electron")
        set frontmost of theProcess to true
        delay 0.5
    end repeat
end tell
' 2>/dev/null

echo "📱 Método 4: Usando Dock..."
osascript -e 'tell application "System Events" to click UI element "Electron" of list 1 of application process "Dock"' 2>/dev/null

echo "✅ Tentativas concluídas!"
echo "💡 Se ainda não aparecer:"
echo "   1. Verifique o Dock (ícone do Electron)"
echo "   2. Use Cmd+Tab para alternar entre aplicações"
echo "   3. Verifique se há janelas minimizadas"
echo "   4. Tente Mission Control (F3) para ver todas as janelas"