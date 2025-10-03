/**
 * Monitor de Memória
 * Monitora uso de memória e força garbage collection quando necessário
 */

class MemoryMonitor {
  constructor(options = {}) {
    this.maxMemoryMB = options.maxMemoryMB || 2048; // 2GB
    this.checkInterval = options.checkInterval || 30000; // 30s
    this.gcThreshold = options.gcThreshold || 0.8; // 80% da memória máxima
    this.monitoring = false;
    this.intervalId = null;
  }

  start() {
    if (this.monitoring) return;
    
    this.monitoring = true;
    console.log('🔍 Iniciando monitoramento de memória...');
    
    this.intervalId = setInterval(() => {
      this.checkMemoryUsage();
    }, this.checkInterval);
  }

  stop() {
    if (!this.monitoring) return;
    
    this.monitoring = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('🛑 Monitoramento de memória parado');
  }

  checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(memUsage.rss / 1024 / 1024);
    
    const memoryPercentage = heapUsedMB / this.maxMemoryMB;
    
    if (memoryPercentage > this.gcThreshold) {
      console.log(`⚠️ Uso de memória alto: ${heapUsedMB}MB (${Math.round(memoryPercentage * 100)}%)`);
      this.forceGarbageCollection();
    }
    
    // Log periódico do uso de memória
    if (Date.now() % (5 * 60 * 1000) < this.checkInterval) { // A cada 5 minutos
      console.log(`📊 Memória: Heap ${heapUsedMB}/${heapTotalMB}MB, RSS ${rssMB}MB`);
    }
  }

  forceGarbageCollection() {
    if (global.gc) {
      console.log('🗑️ Forçando garbage collection...');
      global.gc();
      
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      console.log(`✅ Garbage collection concluído. Memória atual: ${heapUsedMB}MB`);
    } else {
      console.log('⚠️ Garbage collection não disponível (execute com --expose-gc)');
    }
  }

  getMemoryStats() {
    const memUsage = process.memoryUsage();
    return {
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMB: Math.round(memUsage.rss / 1024 / 1024),
      externalMB: Math.round(memUsage.external / 1024 / 1024)
    };
  }
}

module.exports = MemoryMonitor;
