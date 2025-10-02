/**
 * Performance Dashboard - Sistema de Monitoramento em Tempo Real
 * Valida e exibe todas as otimizações implementadas
 */

const fs = require('fs').promises;
const path = require('path');

class PerformanceDashboard {
  constructor(logger = console) {
    this.logger = logger;
    
    // Métricas de performance antes das otimizações
    this.baselineMetrics = {
      clickEditIcon: 2381,
      accordionExpansion: 15816,
      navigationTimeout: 10800,
      ojVerification: 5000,
      errorRecovery: 8000,
      saveConfiguration: 3000
    };
    
    // Métricas alvo após otimizações
    this.targetMetrics = {
      clickEditIcon: 500,       // 79% de melhoria
      accordionExpansion: 1000,  // 94% de melhoria
      navigationTimeout: 3000,   // 72% de melhoria
      ojVerification: 1000,      // 80% de melhoria
      errorRecovery: 500,        // 94% de melhoria
      saveConfiguration: 1000    // 67% de melhoria
    };
    
    // Métricas coletadas em tempo real
    this.currentMetrics = {};
    
    // Estatísticas de execução
    this.stats = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      totalTime: 0,
      averageTime: 0,
      peakTime: 0,
      bestTime: Infinity,
      errorsRecovered: 0,
      cacheHits: 0,
      cacheMisses: 0,
      pje281Errors: 0,
      pje281Recovered: 0
    };
    
    // Histórico de operações
    this.operationHistory = [];
    
    // Alertas de performance
    this.performanceAlerts = [];
    
    // Status dos otimizadores
    this.optimizerStatus = {
      performanceOptimizer: false,
      smartDOMCache: false,
      accordionOptimizer: false,
      pjeErrorHandler: false,
      timeoutManager: false,
      smartRetryManager: false,
      navigationOptimizer: false
    };
  }

  /**
   * Registra uma operação e calcula métricas
   */
  recordOperation(operation, duration, success = true, details = {}) {
    const timestamp = new Date().toISOString();
    
    // Atualizar métricas atuais
    this.currentMetrics[operation] = duration;
    
    // Atualizar estatísticas
    this.stats.totalOperations++;
    this.stats.totalTime += duration;
    this.stats.averageTime = this.stats.totalTime / this.stats.totalOperations;
    
    if (success) {
      this.stats.successfulOperations++;
    } else {
      this.stats.failedOperations++;
    }
    
    if (duration > this.stats.peakTime) {
      this.stats.peakTime = duration;
    }
    
    if (duration < this.stats.bestTime) {
      this.stats.bestTime = duration;
    }
    
    // Verificar se atingiu meta de performance
    const target = this.targetMetrics[operation];
    const baseline = this.baselineMetrics[operation];
    let performanceStatus = 'normal';
    
    if (target && baseline) {
      if (duration <= target) {
        performanceStatus = 'excellent';
      } else if (duration <= target * 1.5) {
        performanceStatus = 'good';
      } else if (duration <= baseline * 0.5) {
        performanceStatus = 'improved';
      } else if (duration >= baseline) {
        performanceStatus = 'degraded';
        this.addPerformanceAlert(operation, duration, target, baseline);
      }
    }
    
    // Adicionar ao histórico
    this.operationHistory.push({
      timestamp,
      operation,
      duration,
      success,
      performanceStatus,
      details
    });
    
    // Manter apenas últimas 100 operações
    if (this.operationHistory.length > 100) {
      this.operationHistory.shift();
    }
    
    return performanceStatus;
  }

  /**
   * Registra hit/miss de cache
   */
  recordCacheAccess(hit) {
    if (hit) {
      this.stats.cacheHits++;
    } else {
      this.stats.cacheMisses++;
    }
  }

  /**
   * Registra erro PJE-281
   */
  recordPJE281Error(recovered) {
    this.stats.pje281Errors++;
    if (recovered) {
      this.stats.pje281Recovered++;
      this.stats.errorsRecovered++;
    }
  }

  /**
   * Atualiza status de otimizador
   */
  updateOptimizerStatus(optimizer, active) {
    this.optimizerStatus[optimizer] = active;
  }

  /**
   * Adiciona alerta de performance
   */
  addPerformanceAlert(operation, actual, target, baseline) {
    const alert = {
      timestamp: new Date().toISOString(),
      operation,
      actual,
      target,
      baseline,
      degradation: ((actual - target) / target * 100).toFixed(1) + '%',
      message: `⚠️ ${operation} está ${actual}ms (alvo: ${target}ms)`
    };
    
    this.performanceAlerts.push(alert);
    this.logger.log('🚨 [PERFORMANCE-ALERT]', alert.message);
    
    // Manter apenas últimos 10 alertas
    if (this.performanceAlerts.length > 10) {
      this.performanceAlerts.shift();
    }
  }

  /**
   * Gera relatório de performance
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalOperations: this.stats.totalOperations,
        successRate: ((this.stats.successfulOperations / this.stats.totalOperations) * 100).toFixed(2) + '%',
        averageTime: Math.round(this.stats.averageTime) + 'ms',
        peakTime: this.stats.peakTime + 'ms',
        bestTime: this.stats.bestTime === Infinity ? 'N/A' : this.stats.bestTime + 'ms',
        cacheHitRate: this.stats.cacheHits > 0 ? 
          ((this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100).toFixed(2) + '%' : 
          '0%',
        errorRecoveryRate: this.stats.pje281Errors > 0 ?
          ((this.stats.pje281Recovered / this.stats.pje281Errors) * 100).toFixed(2) + '%' :
          'N/A'
      },
      improvements: {},
      optimizers: this.optimizerStatus,
      alerts: this.performanceAlerts
    };
    
    // Calcular melhorias
    for (const [operation, baseline] of Object.entries(this.baselineMetrics)) {
      const current = this.currentMetrics[operation];
      if (current !== undefined) {
        const improvement = ((1 - current / baseline) * 100).toFixed(1);
        const status = current <= this.targetMetrics[operation] ? '✅' : '⚠️';
        
        report.improvements[operation] = {
          baseline: baseline + 'ms',
          current: current + 'ms',
          target: this.targetMetrics[operation] + 'ms',
          improvement: improvement + '%',
          status
        };
      }
    }
    
    return report;
  }

  /**
   * Exibe dashboard no console
   */
  displayDashboard() {
    const report = this.generateReport();
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 PERFORMANCE DASHBOARD - AUTOMAÇÃO PJE');
    console.log('='.repeat(70));
    
    console.log('\n✨ RESUMO GERAL:');
    console.log(`  Total de Operações: ${report.summary.totalOperations}`);
    console.log(`  Taxa de Sucesso: ${report.summary.successRate}`);
    console.log(`  Tempo Médio: ${report.summary.averageTime}`);
    console.log(`  Taxa de Cache: ${report.summary.cacheHitRate}`);
    console.log(`  Recuperação de Erros: ${report.summary.errorRecoveryRate}`);
    
    console.log('\n📈 MELHORIAS DE PERFORMANCE:');
    for (const [op, data] of Object.entries(report.improvements)) {
      console.log(`  ${data.status} ${op}:`);
      console.log(`     Antes: ${data.baseline} → Agora: ${data.current} (${data.improvement} melhor)`);
      console.log(`     Meta: ${data.target}`);
    }
    
    console.log('\n⚙️ STATUS DOS OTIMIZADORES:');
    for (const [optimizer, active] of Object.entries(report.optimizers)) {
      const status = active ? '✅ Ativo' : '⚠️ Inativo';
      console.log(`  ${status} - ${optimizer}`);
    }
    
    if (report.alerts.length > 0) {
      console.log('\n⚠️ ALERTAS DE PERFORMANCE:');
      for (const alert of report.alerts.slice(-3)) {
        console.log(`  ${alert.timestamp}: ${alert.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(70));
  }

  /**
   * Salva relatório em arquivo
   */
  async saveReport(filePath = null) {
    const report = this.generateReport();
    const defaultPath = path.join(process.cwd(), 'performance-report.json');
    const targetPath = filePath || defaultPath;
    
    try {
      await fs.writeFile(targetPath, JSON.stringify(report, null, 2));
      this.logger.log(`✅ Relatório salvo em: ${targetPath}`);
      return targetPath;
    } catch (error) {
      this.logger.error(`❌ Erro ao salvar relatório: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calcula score geral de performance
   */
  calculatePerformanceScore() {
    let score = 0;
    let weights = 0;
    
    // Calcular score baseado nas melhorias
    for (const [operation, baseline] of Object.entries(this.baselineMetrics)) {
      const current = this.currentMetrics[operation];
      const target = this.targetMetrics[operation];
      
      if (current !== undefined) {
        const weight = 1;
        weights += weight;
        
        // Score baseado em quão próximo está da meta
        if (current <= target) {
          score += weight * 100; // Meta atingida = 100%
        } else if (current <= baseline) {
          // Melhorou mas não atingiu meta
          const improvement = (baseline - current) / (baseline - target);
          score += weight * (50 + improvement * 50);
        } else {
          // Piorou
          score += 0;
        }
      }
    }
    
    // Adicionar bonus por otimizadores ativos
    const activeOptimizers = Object.values(this.optimizerStatus).filter(v => v).length;
    const optimizerBonus = (activeOptimizers / Object.keys(this.optimizerStatus).length) * 10;
    
    // Calcular score final
    const finalScore = weights > 0 ? (score / weights + optimizerBonus) : optimizerBonus;
    
    return {
      score: Math.min(100, Math.round(finalScore)),
      grade: this.getPerformanceGrade(finalScore)
    };
  }

  /**
   * Retorna grade de performance
   */
  getPerformanceGrade(score) {
    if (score >= 90) return 'A+ (Excelente)';
    if (score >= 80) return 'A (Ótimo)';
    if (score >= 70) return 'B (Bom)';
    if (score >= 60) return 'C (Satisfatório)';
    if (score >= 50) return 'D (Precisa Melhorar)';
    return 'F (Crítico)';
  }

  /**
   * Monitora performance continuamente
   */
  startContinuousMonitoring(interval = 5000) {
    this.monitoringInterval = setInterval(() => {
      const score = this.calculatePerformanceScore();
      
      // Exibir mini-dashboard
      const totalCacheAccess = this.stats.cacheHits + this.stats.cacheMisses;
      const cacheHitRate = totalCacheAccess > 0 ?
        ((this.stats.cacheHits / totalCacheAccess) * 100).toFixed(1) :
        '0';
      const successRate = this.stats.totalOperations > 0 ?
        ((this.stats.successfulOperations / this.stats.totalOperations) * 100).toFixed(1) :
        '0';

      console.log(`\n📊 [MONITOR] Score: ${score.score}/100 (${score.grade}) | ` +
                  `Ops: ${this.stats.totalOperations} | ` +
                  `Sucesso: ${successRate}% | ` +
                  `Cache: ${cacheHitRate}%`);
                  
      // Alertar se performance está degradando
      if (score.score < 60) {
        console.log('🚨 [ALERTA] Performance abaixo do esperado! Verifique o dashboard completo.');
      }
    }, interval);
    
    console.log('✅ Monitoramento contínuo iniciado');
  }

  /**
   * Para monitoramento contínuo
   */
  stopContinuousMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('⏹️ Monitoramento contínuo parado');
    }
  }

  /**
   * Reseta todas as métricas
   */
  reset() {
    this.currentMetrics = {};
    this.stats = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      totalTime: 0,
      averageTime: 0,
      peakTime: 0,
      bestTime: Infinity,
      errorsRecovered: 0,
      cacheHits: 0,
      cacheMisses: 0,
      pje281Errors: 0,
      pje281Recovered: 0
    };
    this.operationHistory = [];
    this.performanceAlerts = [];
    
    console.log('🔄 Dashboard resetado');
  }
}

module.exports = PerformanceDashboard;