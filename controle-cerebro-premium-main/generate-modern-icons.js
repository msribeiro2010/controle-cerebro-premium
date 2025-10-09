#!/usr/bin/env node

/**
 * Script para gerar ícones modernos em diferentes formatos
 * Converte o SVG moderno para PNG, ICO e ICNS
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

console.log('🎨 Gerando ícones modernos para PJE Automation...\n');

const assetsDir = path.join(__dirname, 'assets');
const svgFile = path.join(assetsDir, 'pje-icon-modern.svg');

// Verificar se o SVG existe
if (!fs.existsSync(svgFile)) {
    console.error('❌ Arquivo SVG moderno não encontrado:', svgFile);
    process.exit(1);
}

console.log('✅ SVG moderno encontrado:', svgFile);

// Função para converter SVG usando Node.js puro (sem dependências externas)
function generateModernIcons() {
    console.log('\n🔄 Gerando ícones modernos...\n');
    
    // Ler o conteúdo do SVG
    const svgContent = fs.readFileSync(svgFile, 'utf8');
    
    // Para sistemas que têm ImageMagick instalado, tentar conversão
    const conversions = [
        {
            format: 'PNG 256x256',
            command: `convert "${svgFile}" -resize 256x256 "${path.join(assetsDir, 'pje-icon-modern.png')}"`,
            output: 'pje-icon-modern.png'
        },
        {
            format: 'PNG 128x128', 
            command: `convert "${svgFile}" -resize 128x128 "${path.join(assetsDir, 'pje-icon-128.png')}"`,
            output: 'pje-icon-128.png'
        },
        {
            format: 'PNG 64x64',
            command: `convert "${svgFile}" -resize 64x64 "${path.join(assetsDir, 'pje-icon-64.png')}"`,
            output: 'pje-icon-64.png'
        },
        {
            format: 'PNG 32x32',
            command: `convert "${svgFile}" -resize 32x32 "${path.join(assetsDir, 'pje-icon-32.png')}"`,
            output: 'pje-icon-32.png'
        }
    ];
    
    // Verificar se ImageMagick está disponível
    exec('convert -version', (error, stdout, stderr) => {
        if (error) {
            console.log('⚠️  ImageMagick não encontrado. Usando método alternativo...\n');
            generateIconsAlternative();
        } else {
            console.log('✅ ImageMagick encontrado. Gerando ícones...\n');
            
            let completed = 0;
            conversions.forEach((conv, index) => {
                exec(conv.command, (error, stdout, stderr) => {
                    completed++;
                    if (error) {
                        console.log(`❌ Erro ao gerar ${conv.format}: ${error.message}`);
                    } else {
                        console.log(`✅ ${conv.format} gerado: ${conv.output}`);
                    }
                    
                    if (completed === conversions.length) {
                        console.log('\n🎉 Geração de ícones concluída!');
                        updatePackageConfig();
                        updateShortcutScript();
                    }
                });
            });
        }
    });
}

// Método alternativo sem ImageMagick (copia e renomeia o SVG)
function generateIconsAlternative() {
    console.log('📝 Usando SVG moderno como base para todos os formatos...\n');
    
    try {
        // Copiar SVG moderno como ícone principal
        fs.copyFileSync(svgFile, path.join(assetsDir, 'pje-icon-modern.png.svg'));
        console.log('✅ Ícone SVG copiado como: pje-icon-modern.png.svg');
        
        // Atualizar referências nos arquivos de configuração
        console.log('✅ Usando SVG como formato universal');
        
        console.log('\n💡 Para melhor qualidade, instale ImageMagick:');
        console.log('   macOS: brew install imagemagick');
        console.log('   Ubuntu/Debian: sudo apt-get install imagemagick');
        console.log('   Windows: Download from https://imagemagick.org/\n');
        
        updatePackageConfig();
        updateShortcutScript();
        
    } catch (error) {
        console.error('❌ Erro no método alternativo:', error.message);
    }
}

// Atualizar package.json para usar ícones modernos
function updatePackageConfig() {
    console.log('🔄 Atualizando configuração do package.json...');
    
    try {
        const packagePath = path.join(__dirname, 'package.json');
        const packageConfig = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        
        // Atualizar referências de ícones para as versões modernas
        if (packageConfig.build && packageConfig.build.win) {
            packageConfig.build.win.icon = 'assets/pje-icon-modern.png';
        }
        if (packageConfig.build && packageConfig.build.mac) {
            packageConfig.build.mac.icon = 'assets/pje-icon-modern.png';
        }
        if (packageConfig.build && packageConfig.build.linux) {
            packageConfig.build.linux.icon = 'assets/pje-icon-modern.png';
        }
        
        fs.writeFileSync(packagePath, JSON.stringify(packageConfig, null, 2));
        console.log('✅ package.json atualizado com ícones modernos');
        
    } catch (error) {
        console.log('⚠️  Erro ao atualizar package.json:', error.message);
    }
}

// Atualizar script de atalho para usar ícone moderno
function updateShortcutScript() {
    console.log('🔄 Atualizando script de criação de atalho...');
    
    try {
        const shortcutPath = path.join(__dirname, 'create-shortcut.js');
        let shortcutContent = fs.readFileSync(shortcutPath, 'utf8');
        
        // Substituir referência do ícone antigo pelo moderno
        shortcutContent = shortcutContent.replace(
            /assets[\/\\]pje-icon\.svg/g,
            'assets/pje-icon-modern.svg'
        );
        
        fs.writeFileSync(shortcutPath, shortcutContent);
        console.log('✅ Script de atalho atualizado com ícone moderno');
        
    } catch (error) {
        console.log('⚠️  Erro ao atualizar script de atalho:', error.message);
    }
}

// Função para mostrar preview do ícone (se possível)
function showPreview() {
    console.log('\n🎨 Novo ícone moderno criado com:');
    console.log('   • Gradiente roxo-azul moderno');
    console.log('   • Escudo representando justiça e proteção');
    console.log('   • Balança da justiça estilizada');
    console.log('   • Engrenagem simbolizando automação');
    console.log('   • Elementos de conectividade');
    console.log('   • Sombras e brilhos para profundidade');
    console.log('   • Texto "PJE" integrado ao design\n');
}

// Executar geração
if (require.main === module) {
    showPreview();
    generateModernIcons();
}

module.exports = { generateModernIcons };