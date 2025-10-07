#!/usr/bin/env node

/**
 * Script para build cross-platform do PJE Automation
 * Funciona no macOS para gerar builds para Windows, macOS e Linux
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectDir = __dirname;
const distDir = path.join(projectDir, 'dist');

function log(message) {
    console.log(`🔧 ${message}`);
}

function error(message) {
    console.error(`❌ ${message}`);
}

function success(message) {
    console.log(`✅ ${message}`);
}

function cleanDist() {
    log('Limpando diretório dist...');
    try {
        if (fs.existsSync(distDir)) {
            execSync('rm -rf dist/*', { cwd: projectDir });
        }
        success('Diretório dist limpo');
    } catch (err) {
        error(`Erro ao limpar dist: ${err.message}`);
    }
}

function buildMac() {
    log('Construindo para macOS...');
    try {
        execSync('npm run build:mac', { cwd: projectDir, stdio: 'inherit' });
        success('Build para macOS concluído');
        return true;
    } catch (err) {
        error(`Erro no build para macOS: ${err.message}`);
        return false;
    }
}

function buildWindows() {
    log('Construindo para Windows...');
    try {
        // Tenta apenas o empacotamento sem o instalador NSIS
        execSync('npx electron-builder --win --dir', { cwd: projectDir, stdio: 'inherit' });
        success('Build para Windows (portable) concluído');
        return true;
    } catch (err) {
        error(`Erro no build para Windows: ${err.message}`);
        log('Tentando build alternativo para Windows...');
        try {
            // Tenta com configuração mais simples
            execSync('npx electron-builder --win portable', { cwd: projectDir, stdio: 'inherit' });
            success('Build alternativo para Windows concluído');
            return true;
        } catch (err2) {
            error(`Erro no build alternativo para Windows: ${err2.message}`);
            return false;
        }
    }
}

function buildLinux() {
    log('Construindo para Linux...');
    try {
        // Tenta apenas AppImage que é mais compatível
        execSync('npx electron-builder --linux appimage', { cwd: projectDir, stdio: 'inherit' });
        success('Build para Linux (AppImage) concluído');
        return true;
    } catch (err) {
        error(`Erro no build para Linux: ${err.message}`);
        log('Tentando build apenas empacotamento para Linux...');
        try {
            execSync('npx electron-builder --linux --dir', { cwd: projectDir, stdio: 'inherit' });
            success('Build para Linux (portable) concluído');
            return true;
        } catch (err2) {
            error(`Erro no build alternativo para Linux: ${err2.message}`);
            return false;
        }
    }
}

function listResults() {
    log('Listando arquivos gerados...');
    try {
        if (fs.existsSync(distDir)) {
            const files = fs.readdirSync(distDir);
            const installers = files.filter(file => 
                file.endsWith('.dmg') || 
                file.endsWith('.exe') || 
                file.endsWith('.AppImage') || 
                file.endsWith('.deb')
            );
            
            if (installers.length > 0) {
                success('Arquivos de instalação gerados:');
                installers.forEach(file => {
                    const filePath = path.join(distDir, file);
                    const stats = fs.statSync(filePath);
                    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
                    console.log(`  📦 ${file} (${sizeMB} MB)`);
                });
            }
            
            const directories = files.filter(file => {
                const filePath = path.join(distDir, file);
                return fs.statSync(filePath).isDirectory() && 
                       (file.includes('unpacked') || file.includes('mac') || file.includes('linux'));
            });
            
            if (directories.length > 0) {
                success('Diretórios portáveis gerados:');
                directories.forEach(dir => {
                    console.log(`  📁 ${dir}/`);
                });
            }
        }
    } catch (err) {
        error(`Erro ao listar resultados: ${err.message}`);
    }
}

function main() {
    console.log('🚀 Iniciando build cross-platform do PJE Automation');
    console.log('💻 Sistema operacional:', process.platform);
    console.log('');
    
    const platform = process.argv[2];
    
    if (platform) {
        switch (platform.toLowerCase()) {
            case 'mac':
            case 'macos':
                buildMac();
                break;
            case 'win':
            case 'windows':
                buildWindows();
                break;
            case 'linux':
                buildLinux();
                break;
            case 'clean':
                cleanDist();
                return;
            default:
                error(`Plataforma não reconhecida: ${platform}`);
                console.log('Uso: node build-cross-platform.js [mac|windows|linux|clean|all]');
                return;
        }
    } else {
        // Build para todas as plataformas
        cleanDist();
        
        const results = {
            mac: buildMac(),
            windows: buildWindows(),
            linux: buildLinux()
        };
        
        console.log('');
        console.log('📊 Resumo dos builds:');
        console.log(`  macOS: ${results.mac ? '✅' : '❌'}`);
        console.log(`  Windows: ${results.windows ? '✅' : '❌'}`);
        console.log(`  Linux: ${results.linux ? '✅' : '❌'}`);
        console.log('');
    }
    
    listResults();
    
    console.log('');
    console.log('🎉 Build cross-platform concluído!');
    console.log('💡 Dica: Os arquivos estão no diretório dist/');
}

if (require.main === module) {
    main();
}

module.exports = { buildMac, buildWindows, buildLinux, cleanDist };