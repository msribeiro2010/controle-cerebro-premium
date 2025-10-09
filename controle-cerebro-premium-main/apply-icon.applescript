tell application "Finder"
    try
        set shortcutFile to POSIX file "/Users/marceloribeiro/Desktop/Auto-PJe.command" as alias
        set iconFile to POSIX file "/Users/marceloribeiro/Desktop/pje-perito-automation/auto-pje-icon.icns" as alias
        
        -- Ler os dados do ícone
        set iconData to read iconFile
        
        -- Aplicar o ícone ao arquivo
        set icon of shortcutFile to iconData
        
        display notification "Ícone aplicado com sucesso!" with title "Auto-PJe"
        
    on error errMsg
        display notification "Erro ao aplicar ícone: " & errMsg with title "Auto-PJe"
    end try
end tell