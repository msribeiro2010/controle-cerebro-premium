#!/usr/bin/env node

/**
 * Script para definir ícone personalizado no atalho da área de trabalho (macOS)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const projectDir = __dirname;
const desktopPath = path.join(os.homedir(), 'Desktop');
const shortcutPath = path.join(desktopPath, 'PJE Automation.command');
const iconPath = path.join(projectDir, 'assets', 'pje-icon-modern.icns');

console.log('🎨 Configurando ícone personalizado no atalho da área de trabalho...\n');

function setMacOSIcon() {
    if (!fs.existsSync(iconPath)) {
        console.log('❌ Ícone ICNS não encontrado:', iconPath);
        return false;
    }

    if (!fs.existsSync(shortcutPath)) {
        console.log('❌ Atalho não encontrado:', shortcutPath);
        return false;
    }

    console.log('📍 Atalho encontrado:', shortcutPath);
    console.log('🎯 Ícone:', iconPath);

    // Usar AppleScript para definir o ícone personalizado
    const appleScript = `
        tell application "Finder"
            set theIcon to POSIX file "${iconPath}"
            set theFile to POSIX file "${shortcutPath}"
            
            -- Copiar ícone
            set the clipboard to (read file theIcon as «class icns»)
            
            -- Aplicar ao arquivo
            set info for theFile to (info for theFile)
            set the clipboard to ""
        end tell
    `;

    // Executar AppleScript
    exec(`osascript -e '${appleScript}'`, (error, stdout, stderr) => {
        if (error) {
            console.log('⚠️ Método AppleScript falhou, tentando método alternativo...');
            
            // Método alternativo usando sips e Resource Forks
            const commands = [
                `sips -i "${iconPath}"`, // Adicionar ícone ao arquivo ICNS
                `DeRez -only icns "${iconPath}" > /tmp/pje-icon.rsrc`, // Extrair resource
                `Rez -append /tmp/pje-icon.rsrc -o "${shortcutPath}"`, // Aplicar resource
                `SetFile -a C "${shortcutPath}"`, // Marcar como tendo ícone personalizado
                `rm -f /tmp/pje-icon.rsrc` // Limpar arquivo temporário
            ];

            let completed = 0;
            commands.forEach((cmd, index) => {
                exec(cmd, (cmdError, cmdStdout, cmdStderr) => {
                    completed++;
                    if (cmdError && index < 3) { // Só mostrar erro nos comandos críticos
                        console.log(`⚠️ Comando ${index + 1} falhou: ${cmd}`);
                    }
                    
                    if (completed === commands.length) {
                        console.log('✅ Métodos alternativos executados');
                        trySimpleMethod();
                    }
                });
            });
        } else {
            console.log('✅ AppleScript executado com sucesso');
            refreshFinder();
        }
    });
}

function trySimpleMethod() {
    console.log('🔄 Tentando método simples...');
    
    // Método mais direto: criar um app bundle
    const appBundlePath = path.join(desktopPath, 'PJE Automation.app');
    
    try {
        // Remover app bundle antigo se existir
        if (fs.existsSync(appBundlePath)) {
            exec(`rm -rf "${appBundlePath}"`);
        }
        
        // Criar estrutura do app bundle
        const contentsDir = path.join(appBundlePath, 'Contents');
        const macosDir = path.join(contentsDir, 'MacOS');
        const resourcesDir = path.join(contentsDir, 'Resources');
        
        fs.mkdirSync(appBundlePath, { recursive: true });
        fs.mkdirSync(contentsDir, { recursive: true });
        fs.mkdirSync(macosDir, { recursive: true });
        fs.mkdirSync(resourcesDir, { recursive: true });
        
        // Criar Info.plist
        const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>PJE Automation</string>
    <key>CFBundleIconFile</key>
    <string>pje-icon-modern</string>
    <key>CFBundleIdentifier</key>
    <string>com.pje.automation.desktop</string>
    <key>CFBundleName</key>
    <string>PJE Automation</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>LSUIElement</key>
    <false/>
</dict>
</plist>`;
        
        fs.writeFileSync(path.join(contentsDir, 'Info.plist'), infoPlist);
        
        // Criar executável
        const executable = `#!/bin/bash
cd "${projectDir}"
./start.sh`;
        
        const executablePath = path.join(macosDir, 'PJE Automation');
        fs.writeFileSync(executablePath, executable);
        fs.chmodSync(executablePath, '755');
        
        // Copiar ícone
        fs.copyFileSync(iconPath, path.join(resourcesDir, 'pje-icon-modern.icns'));
        
        // Remover atalho antigo
        if (fs.existsSync(shortcutPath)) {
            fs.unlinkSync(shortcutPath);
        }
        
        console.log('✅ App bundle criado:', appBundlePath);
        refreshFinder();
        
    } catch (error) {
        console.log('❌ Erro ao criar app bundle:', error.message);
        createFallbackShortcut();
    }
}

function createFallbackShortcut() {
    console.log('🔄 Criando atalho de fallback...');
    
    // Criar um atalho simples com nome diferente para forçar atualização
    const fallbackPath = path.join(desktopPath, 'PJE Automation ⚡.command');
    
    const content = `#!/bin/bash
echo "🚀 Iniciando PJE Automation..."
cd "${projectDir}"
./start.sh`;
    
    fs.writeFileSync(fallbackPath, content);
    fs.chmodSync(fallbackPath, '755');
    
    console.log('✅ Atalho de fallback criado:', fallbackPath);
    console.log('💡 Se o ícone não aparecer, tente:');
    console.log('   1. Reiniciar o Finder: Cmd+Option+Esc > Finder > Reabrir');
    console.log('   2. Limpar cache: sudo rm -rf /Library/Caches/com.apple.iconservices.store');
    console.log('   3. Usar o app bundle criado: PJE Automation.app');
}

function refreshFinder() {
    console.log('🔄 Atualizando Finder...');
    
    exec('killall Finder', (error) => {
        if (error) {
            exec('osascript -e "tell application \\"Finder\\" to quit" -e "delay 1" -e "tell application \\"Finder\\" to activate"');
        }
    });
    
    setTimeout(() => {
        console.log('✅ Ícone personalizado configurado!');
        console.log('📋 Se o ícone não aparecer imediatamente:');
        console.log('   1. Aguarde alguns segundos para o cache atualizar');
        console.log('   2. Pressione F5 na área de trabalho');
        console.log('   3. Reinicie o Finder se necessário');
    }, 2000);
}

// Executar apenas no macOS
if (os.platform() === 'darwin') {
    setMacOSIcon();
} else {
    console.log('❌ Este script é específico para macOS');
    console.log('💡 Para outros sistemas, use: npm run create-shortcut');
}