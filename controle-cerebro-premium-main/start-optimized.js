#!/usr/bin/env node
/**
 * Script de Inicialização Otimizado
 * Inicia o processamento com configurações otimizadas para estabilidade
 */

const ServidorAutomationV2 = require('./src/main/servidor-automation-v2');
const MemoryMonitor = require('./src/utils/memory-monitor');
const { loadConfig } = require('./src/util');

// Configurações otimizadas para estabilidade
process.env.NODE_OPTIONS = '--max-old-space-size=4096 --expose-gc';

async function startOptimized() {
  console.log('🚀 Iniciando processamento otimizado...');
  
  // Iniciar monitor de memória
  const memoryMonitor = new MemoryMonitor({
    maxMemoryMB: 3072, // 3GB
    checkInterval: 30000, // 30s
    gcThreshold: 0.75 // 75%
  });
  memoryMonitor.start();
  
  // Configurar tratamento de sinais
  const gracefulShutdown = async (signal) => {
    console.log(`🛑 Recebido sinal ${signal}, iniciando shutdown graceful...`);
    memoryMonitor.stop();
    process.exit(0);
  };
  
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
  
  try {
    const config = await loadConfig();
    const automation = new ServidorAutomationV2();
    
    // Configurações otimizadas
    config.maxInstances = Math.min(config.maxInstances || 2, 2); // Máximo 2 instâncias
    config.batchSize = 3; // Lotes menores
    config.delayBetweenBatches = 2000; // 2s entre lotes
    
    console.log('📋 Configurações otimizadas aplicadas');
    console.log(`   - Máximo de instâncias: ${config.maxInstances}`);
    console.log(`   - Tamanho do lote: ${config.batchSize}`);
    console.log(`   - Delay entre lotes: ${config.delayBetweenBatches}ms`);
    
    await automation.startAutomation(config);
    
  } catch (error) {
    console.error('❌ Erro durante execução:', error);
    memoryMonitor.stop();
    process.exit(1);
  }
}

if (require.main === module) {
  startOptimized().catch(console.error);
}

module.exports = { startOptimized };
