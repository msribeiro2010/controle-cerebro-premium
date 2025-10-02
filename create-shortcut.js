#!/usr/bin/env node

/**
 * Script para criar atalho do PJE Automation no desktop
 * Funciona em Windows, macOS e Linux
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const projectDir = __dirname;
const projectName = 'Central IA - NAPJe Sistema de Automacao Inteligente';
const description = 'Sistema de automação inteligente para vinculação de peritos e servidores no PJE';

function createWindowsShortcut() {
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const shortcutPath = path.join(desktopPath, 'PJE Automation.bat');
    
    const shortcutContent = `@echo off
cd /d "${projectDir}"
call start.bat`;

    try {
        fs.writeFileSync(shortcutPath, shortcutContent);
        console.log('✅ Atalho criado no desktop do Windows:', shortcutPath);
        return true;
    } catch (error) {
        console.error('❌ Erro ao criar atalho no Windows:', error.message);
        return false;
    }
}

function createMacShortcut() {
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const appPath = path.join(desktopPath, 'PJE Automation.command');
    
    const shortcutContent = `#!/bin/bash
cd "${projectDir}"
./start.sh`;

    try {
        fs.writeFileSync(appPath, shortcutContent);
        fs.chmodSync(appPath, '755'); // Tornar executável
        console.log('✅ Atalho criado no desktop do macOS:', appPath);
        return true;
    } catch (error) {
        console.error('❌ Erro ao criar atalho no macOS:', error.message);
        return false;
    }
}

function createLinuxShortcut() {
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const shortcutPath = path.join(desktopPath, 'PJE-Automation.desktop');
    
    const shortcutContent = `[Desktop Entry]
Version=1.0
Type=Application
Name=${projectName}
Comment=${description}
Exec=bash -c "cd '${projectDir}' && ./start.sh"
Icon=${path.join(projectDir, 'assets', 'pje-icon.svg')}
Terminal=true
Categories=Office;Development;
StartupNotify=true`;

    try {
        fs.writeFileSync(shortcutPath, shortcutContent);
        fs.chmodSync(shortcutPath, '755'); // Tornar executável
        console.log('✅ Atalho criado no desktop do Linux:', shortcutPath);
        return true;
    } catch (error) {
        console.error('❌ Erro ao criar atalho no Linux:', error.message);
        return false;
    }
}

function createShortcut() {
    console.log('🔗 Criando atalho para PJE Automation...');
    console.log('📍 Diretório do projeto:', projectDir);
    console.log('💻 Sistema operacional:', os.platform());
    console.log('');

    const platform = os.platform();
    let success = false;

    switch (platform) {
        case 'win32':
            success = createWindowsShortcut();
            break;
        case 'darwin':
            success = createMacShortcut();
            break;
        case 'linux':
            success = createLinuxShortcut();
            break;
        default:
            console.log('❌ Sistema operacional não suportado:', platform);
            console.log('💡 Você pode executar manualmente:');
            console.log('   - Windows: Clique duas vezes em start.bat');
            console.log('   - macOS/Linux: Execute ./start.sh no terminal');
            return;
    }

    if (success) {
        console.log('');
        console.log('🎉 Atalho criado com sucesso!');
        console.log('📋 Instruções:');
        console.log('   1. Vá para o desktop');
        console.log('   2. Clique duas vezes no atalho "PJE Automation"');
        console.log('   3. O sistema será iniciado automaticamente');
        console.log('');
        console.log('💡 Dica: Você também pode executar diretamente:');
        console.log(`   npm start (no diretório: ${projectDir})`);
    }
}

// Verificar se está sendo executado diretamente
if (require.main === module) {
    createShortcut();
}

module.exports = { createShortcut };