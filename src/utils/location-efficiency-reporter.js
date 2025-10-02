/**
 * Gerador de Relatórios de Eficiência para Scanner de Localizações
 * 
 * Este módulo gera relatórios detalhados sobre a eficiência e performance
 * do sistema de escaneamento de localizações.
 */

const fs = require('fs').promises;
const path = require('path');
const Logger = require('./Logger');

class LocationEfficiencyReporter {
  constructor(options = {}) {
    this.logger = new Logger('LocationEfficiencyReporter');
        
    // Configurações
    this.config = {
      reportDir: options.reportDir || path.join(process.cwd(), 'reports'),
      enableHtmlReports: options.enableHtmlReports !== false,
      enableJsonReports: options.enableJsonReports !== false,
      enableCsvReports: options.enableCsvReports !== false,
      includeCharts: options.includeCharts !== false,
      maxHistoryDays: options.maxHistoryDays || 30,
      autoGenerateReports: options.autoGenerateReports !== false
    };
        
    // Dados coletados
    this.data = {
      sessions: [],
      aggregatedStats: {
        totalSessions: 0,
        totalServers: 0,
        totalLocations: 0,
        totalSkipped: 0,
        totalErrors: 0,
        totalTime: 0,
        averageEfficiency: 0,
        averageThroughput: 0
      },
      trends: {
        daily: [],
        weekly: [],
        monthly: []
      }
    };
  }
    
  /**
     * Inicializa o gerador de relatórios
     */
  async initialize() {
    try {
      // Criar diretório de relatórios
      await fs.mkdir(this.config.reportDir, { recursive: true });
            
      // Carregar dados históricos
      await this.loadHistoricalData();
            
      this.logger.info('Gerador de relatórios inicializado');
            
    } catch (error) {
      this.logger.error('Erro ao inicializar gerador de relatórios:', error);
      throw error;
    }
  }
    
  /**
     * Adiciona dados de uma sessão
     */
  addSessionData(sessionData) {
    const processedSession = this.processSessionData(sessionData);
    this.data.sessions.push(processedSession);
        
    // Atualizar estatísticas agregadas
    this.updateAggregatedStats();
        
    // Atualizar tendências
    this.updateTrends();
        
    this.logger.debug(`Dados da sessão ${sessionData.sessionId} adicionados`);
  }
    
  /**
     * Processa dados da sessão
     */
  processSessionData(sessionData) {
    const totalLocations = sessionData.locationsProcessed + sessionData.locationsSkipped + sessionData.locationsError;
    const efficiency = totalLocations > 0 ? (sessionData.locationsProcessed / totalLocations) * 100 : 0;
    const throughput = sessionData.totalTime > 0 ? (totalLocations / sessionData.totalTime) * 60000 : 0; // por minuto
        
    return {
      sessionId: sessionData.sessionId,
      timestamp: sessionData.startTime || Date.now(),
      duration: sessionData.totalTime || 0,
      servers: {
        total: sessionData.serversTotal || 0,
        processed: sessionData.serversProcessed || 0,
        failed: sessionData.failedServers?.length || 0
      },
      locations: {
        total: sessionData.locationsTotal || 0,
        processed: sessionData.locationsProcessed || 0,
        skipped: sessionData.locationsSkipped || 0,
        error: sessionData.locationsError || 0
      },
      performance: {
        efficiency,
        throughput,
        averageLocationTime: sessionData.averageLocationTime || 0,
        averageServerTime: sessionData.averageServerTime || 0,
        skipRate: totalLocations > 0 ? (sessionData.locationsSkipped / totalLocations) * 100 : 0,
        errorRate: totalLocations > 0 ? (sessionData.locationsError / totalLocations) * 100 : 0
      },
      cache: {
        hits: sessionData.cacheHits || 0,
        misses: sessionData.cacheMisses || 0,
        hitRate: (sessionData.cacheHits + sessionData.cacheMisses) > 0 
          ? (sessionData.cacheHits / (sessionData.cacheHits + sessionData.cacheMisses)) * 100 
          : 0
      },
      errors: {
        total: sessionData.totalErrors || 0,
        consecutive: sessionData.maxConsecutiveErrors || 0,
        types: sessionData.errorTypes || {}
      },
      recovery: {
        retries: sessionData.totalRetries || 0,
        recoveryRate: sessionData.totalRetries > 0 
          ? ((sessionData.totalRetries - sessionData.totalErrors) / sessionData.totalRetries) * 100 
          : 0
      }
    };
  }
    
  /**
     * Atualiza estatísticas agregadas
     */
  updateAggregatedStats() {
    if (this.data.sessions.length === 0) return;
        
    const stats = this.data.aggregatedStats;
        
    stats.totalSessions = this.data.sessions.length;
    stats.totalServers = this.data.sessions.reduce((sum, s) => sum + s.servers.processed, 0);
    stats.totalLocations = this.data.sessions.reduce((sum, s) => sum + s.locations.processed, 0);
    stats.totalSkipped = this.data.sessions.reduce((sum, s) => sum + s.locations.skipped, 0);
    stats.totalErrors = this.data.sessions.reduce((sum, s) => sum + s.errors.total, 0);
    stats.totalTime = this.data.sessions.reduce((sum, s) => sum + s.duration, 0);
        
    // Médias
    stats.averageEfficiency = this.data.sessions.reduce((sum, s) => sum + s.performance.efficiency, 0) / stats.totalSessions;
    stats.averageThroughput = this.data.sessions.reduce((sum, s) => sum + s.performance.throughput, 0) / stats.totalSessions;
  }
    
  /**
     * Atualiza tendências
     */
  updateTrends() {
    const now = new Date();
        
    // Tendências diárias (últimos 30 dias)
    this.data.trends.daily = this.calculateTrends('daily', 30);
        
    // Tendências semanais (últimas 12 semanas)
    this.data.trends.weekly = this.calculateTrends('weekly', 12);
        
    // Tendências mensais (últimos 12 meses)
    this.data.trends.monthly = this.calculateTrends('monthly', 12);
  }
    
  /**
     * Calcula tendências por período
     */
  calculateTrends(period, count) {
    const trends = [];
    const now = new Date();
        
    for (let i = count - 1; i >= 0; i--) {
      let startDate, endDate;
            
      if (period === 'daily') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
      } else if (period === 'weekly') {
        const weekStart = new Date(now.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
        startDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() - weekStart.getDay());
        endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else if (period === 'monthly') {
        startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      }
            
      const sessionsInPeriod = this.data.sessions.filter(s => {
        const sessionDate = new Date(s.timestamp);
        return sessionDate >= startDate && sessionDate < endDate;
      });
            
      const trendData = this.calculatePeriodStats(sessionsInPeriod, startDate, endDate);
      trends.push(trendData);
    }
        
    return trends;
  }
    
  /**
     * Calcula estatísticas para um período
     */
  calculatePeriodStats(sessions, startDate, endDate) {
    if (sessions.length === 0) {
      return {
        period: startDate.toISOString().split('T')[0],
        sessions: 0,
        servers: 0,
        locations: 0,
        efficiency: 0,
        throughput: 0,
        errorRate: 0
      };
    }
        
    const totalLocations = sessions.reduce((sum, s) => sum + s.locations.processed + s.locations.skipped + s.locations.error, 0);
    const processedLocations = sessions.reduce((sum, s) => sum + s.locations.processed, 0);
    const totalErrors = sessions.reduce((sum, s) => sum + s.errors.total, 0);
        
    return {
      period: startDate.toISOString().split('T')[0],
      sessions: sessions.length,
      servers: sessions.reduce((sum, s) => sum + s.servers.processed, 0),
      locations: processedLocations,
      efficiency: totalLocations > 0 ? (processedLocations / totalLocations) * 100 : 0,
      throughput: sessions.reduce((sum, s) => sum + s.performance.throughput, 0) / sessions.length,
      errorRate: totalLocations > 0 ? (totalErrors / totalLocations) * 100 : 0
    };
  }
    
  /**
     * Gera relatório completo
     */
  async generateReport(options = {}) {
    try {
      const reportData = this.compileReportData();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            
      const reports = [];
            
      // Relatório JSON
      if (this.config.enableJsonReports) {
        const jsonPath = path.join(this.config.reportDir, `efficiency-report-${timestamp}.json`);
        await fs.writeFile(jsonPath, JSON.stringify(reportData, null, 2));
        reports.push({ type: 'json', path: jsonPath });
      }
            
      // Relatório HTML
      if (this.config.enableHtmlReports) {
        const htmlPath = path.join(this.config.reportDir, `efficiency-report-${timestamp}.html`);
        const htmlContent = this.generateHtmlReport(reportData);
        await fs.writeFile(htmlPath, htmlContent);
        reports.push({ type: 'html', path: htmlPath });
      }
            
      // Relatório CSV
      if (this.config.enableCsvReports) {
        const csvPath = path.join(this.config.reportDir, `efficiency-report-${timestamp}.csv`);
        const csvContent = this.generateCsvReport(reportData);
        await fs.writeFile(csvPath, csvContent);
        reports.push({ type: 'csv', path: csvPath });
      }
            
      this.logger.info(`Relatórios gerados: ${reports.map(r => r.type).join(', ')}`);
            
      return reports;
            
    } catch (error) {
      this.logger.error('Erro ao gerar relatório:', error);
      throw error;
    }
  }
    
  /**
     * Compila dados para o relatório
     */
  compileReportData() {
    const recentSessions = this.data.sessions.slice(-10); // Últimas 10 sessões
        
    return {
      metadata: {
        generatedAt: new Date().toISOString(),
        reportPeriod: {
          start: this.data.sessions.length > 0 ? new Date(Math.min(...this.data.sessions.map(s => s.timestamp))).toISOString() : null,
          end: new Date().toISOString()
        },
        totalSessions: this.data.sessions.length
      },
      summary: {
        ...this.data.aggregatedStats,
        averageSessionDuration: this.data.aggregatedStats.totalSessions > 0 
          ? this.data.aggregatedStats.totalTime / this.data.aggregatedStats.totalSessions 
          : 0,
        overallSuccessRate: (this.data.aggregatedStats.totalLocations + this.data.aggregatedStats.totalSkipped) > 0 
          ? (this.data.aggregatedStats.totalLocations / (this.data.aggregatedStats.totalLocations + this.data.aggregatedStats.totalSkipped + this.data.aggregatedStats.totalErrors)) * 100 
          : 0
      },
      performance: {
        bestSession: this.findBestSession(),
        worstSession: this.findWorstSession(),
        averageMetrics: this.calculateAverageMetrics(),
        performanceTrends: this.analyzePerformanceTrends()
      },
      efficiency: {
        cacheEfficiency: this.calculateCacheEfficiency(),
        skipEfficiency: this.calculateSkipEfficiency(),
        errorRecovery: this.calculateErrorRecoveryStats(),
        timeDistribution: this.calculateTimeDistribution()
      },
      trends: this.data.trends,
      recentSessions,
      recommendations: this.generateRecommendations()
    };
  }
    
  /**
     * Encontra melhor sessão
     */
  findBestSession() {
    if (this.data.sessions.length === 0) return null;
        
    return this.data.sessions.reduce((best, current) => {
      const bestScore = (best.performance.efficiency * 0.4) + (best.performance.throughput * 0.3) + ((100 - best.performance.errorRate) * 0.3);
      const currentScore = (current.performance.efficiency * 0.4) + (current.performance.throughput * 0.3) + ((100 - current.performance.errorRate) * 0.3);
            
      return currentScore > bestScore ? current : best;
    });
  }
    
  /**
     * Encontra pior sessão
     */
  findWorstSession() {
    if (this.data.sessions.length === 0) return null;
        
    return this.data.sessions.reduce((worst, current) => {
      const worstScore = (worst.performance.efficiency * 0.4) + (worst.performance.throughput * 0.3) + ((100 - worst.performance.errorRate) * 0.3);
      const currentScore = (current.performance.efficiency * 0.4) + (current.performance.throughput * 0.3) + ((100 - current.performance.errorRate) * 0.3);
            
      return currentScore < worstScore ? current : worst;
    });
  }
    
  /**
     * Calcula métricas médias
     */
  calculateAverageMetrics() {
    if (this.data.sessions.length === 0) return {};
        
    const sessions = this.data.sessions;
        
    return {
      efficiency: sessions.reduce((sum, s) => sum + s.performance.efficiency, 0) / sessions.length,
      throughput: sessions.reduce((sum, s) => sum + s.performance.throughput, 0) / sessions.length,
      errorRate: sessions.reduce((sum, s) => sum + s.performance.errorRate, 0) / sessions.length,
      skipRate: sessions.reduce((sum, s) => sum + s.performance.skipRate, 0) / sessions.length,
      cacheHitRate: sessions.reduce((sum, s) => sum + s.cache.hitRate, 0) / sessions.length,
      recoveryRate: sessions.reduce((sum, s) => sum + s.recovery.recoveryRate, 0) / sessions.length
    };
  }
    
  /**
     * Analisa tendências de performance
     */
  analyzePerformanceTrends() {
    const recent = this.data.sessions.slice(-5);
    const older = this.data.sessions.slice(-10, -5);
        
    if (recent.length === 0 || older.length === 0) {
      return { trend: 'insufficient_data' };
    }
        
    const recentAvg = recent.reduce((sum, s) => sum + s.performance.efficiency, 0) / recent.length;
    const olderAvg = older.reduce((sum, s) => sum + s.performance.efficiency, 0) / older.length;
        
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
        
    return {
      trend: change > 5 ? 'improving' : change < -5 ? 'declining' : 'stable',
      change,
      recentAverage: recentAvg,
      previousAverage: olderAvg
    };
  }
    
  /**
     * Calcula eficiência do cache
     */
  calculateCacheEfficiency() {
    const sessions = this.data.sessions;
    if (sessions.length === 0) return {};
        
    const totalHits = sessions.reduce((sum, s) => sum + s.cache.hits, 0);
    const totalMisses = sessions.reduce((sum, s) => sum + s.cache.misses, 0);
    const total = totalHits + totalMisses;
        
    return {
      totalHits,
      totalMisses,
      hitRate: total > 0 ? (totalHits / total) * 100 : 0,
      efficiency: total > 0 ? 'high' : 'unknown'
    };
  }
    
  /**
     * Calcula eficiência de pulo
     */
  calculateSkipEfficiency() {
    const sessions = this.data.sessions;
    if (sessions.length === 0) return {};
        
    const totalSkipped = sessions.reduce((sum, s) => sum + s.locations.skipped, 0);
    const totalProcessed = sessions.reduce((sum, s) => sum + s.locations.processed, 0);
    const total = totalSkipped + totalProcessed;
        
    return {
      totalSkipped,
      skipRate: total > 0 ? (totalSkipped / total) * 100 : 0,
      timeSaved: totalSkipped * 2000 // Estimativa de 2s por localização
    };
  }
    
  /**
     * Calcula estatísticas de recuperação de erro
     */
  calculateErrorRecoveryStats() {
    const sessions = this.data.sessions;
    if (sessions.length === 0) return {};
        
    const totalRetries = sessions.reduce((sum, s) => sum + s.recovery.retries, 0);
    const totalErrors = sessions.reduce((sum, s) => sum + s.errors.total, 0);
        
    return {
      totalRetries,
      totalErrors,
      recoveryRate: totalRetries > 0 ? ((totalRetries - totalErrors) / totalRetries) * 100 : 0,
      averageRetriesPerError: totalErrors > 0 ? totalRetries / totalErrors : 0
    };
  }
    
  /**
     * Calcula distribuição de tempo
     */
  calculateTimeDistribution() {
    const sessions = this.data.sessions;
    if (sessions.length === 0) return {};
        
    const durations = sessions.map(s => s.duration);
    durations.sort((a, b) => a - b);
        
    return {
      min: durations[0] || 0,
      max: durations[durations.length - 1] || 0,
      median: durations[Math.floor(durations.length / 2)] || 0,
      average: durations.reduce((sum, d) => sum + d, 0) / durations.length || 0
    };
  }
    
  /**
     * Gera recomendações
     */
  generateRecommendations() {
    const recommendations = [];
    const metrics = this.calculateAverageMetrics();
        
    if (metrics.efficiency < 70) {
      recommendations.push({
        type: 'efficiency',
        priority: 'high',
        message: 'Eficiência baixa detectada. Considere otimizar o sistema de pulo inteligente.',
        suggestion: 'Revisar critérios de pulo e melhorar cache de localizações.'
      });
    }
        
    if (metrics.errorRate > 10) {
      recommendations.push({
        type: 'errors',
        priority: 'high',
        message: 'Taxa de erro elevada. Implementar melhorias na recuperação de erros.',
        suggestion: 'Aumentar timeouts e melhorar detecção de elementos.'
      });
    }
        
    if (metrics.cacheHitRate < 50) {
      recommendations.push({
        type: 'cache',
        priority: 'medium',
        message: 'Taxa de acerto do cache baixa. Otimizar estratégia de cache.',
        suggestion: 'Revisar algoritmo de cache e aumentar tamanho do cache.'
      });
    }
        
    if (metrics.throughput < 10) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: 'Throughput baixo detectado. Considere otimizações de performance.',
        suggestion: 'Implementar processamento paralelo ou otimizar timeouts.'
      });
    }
        
    return recommendations;
  }
    
  /**
     * Gera relatório HTML
     */
  generateHtmlReport(data) {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Relatório de Eficiência - Scanner de Localizações</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff; }
        .metric-value { font-size: 2em; font-weight: bold; color: #007bff; }
        .metric-label { color: #666; margin-top: 5px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        .recommendations { background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; }
        .recommendation { margin-bottom: 10px; }
        .priority-high { color: #dc3545; font-weight: bold; }
        .priority-medium { color: #fd7e14; font-weight: bold; }
        .priority-low { color: #28a745; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: bold; }
        .trend-improving { color: #28a745; }
        .trend-declining { color: #dc3545; }
        .trend-stable { color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Relatório de Eficiência - Scanner de Localizações</h1>
            <p>Gerado em: ${new Date(data.metadata.generatedAt).toLocaleString('pt-BR')}</p>
            <p>Período: ${data.metadata.reportPeriod.start ? new Date(data.metadata.reportPeriod.start).toLocaleDateString('pt-BR') : 'N/A'} - ${new Date(data.metadata.reportPeriod.end).toLocaleDateString('pt-BR')}</p>
        </div>
        
        <div class="section">
            <h2>Resumo Geral</h2>
            <div class="metric-grid">
                <div class="metric-card">
                    <div class="metric-value">${data.summary.totalSessions}</div>
                    <div class="metric-label">Total de Sessões</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${data.summary.totalServers}</div>
                    <div class="metric-label">Servidores Processados</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${data.summary.totalLocations}</div>
                    <div class="metric-label">Localizações Processadas</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${data.summary.averageEfficiency.toFixed(1)}%</div>
                    <div class="metric-label">Eficiência Média</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${data.summary.averageThroughput.toFixed(1)}</div>
                    <div class="metric-label">Throughput Médio (loc/min)</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${data.summary.overallSuccessRate.toFixed(1)}%</div>
                    <div class="metric-label">Taxa de Sucesso Geral</div>
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2>Performance</h2>
            <div class="metric-grid">
                <div class="metric-card">
                    <div class="metric-value trend-${data.performance.performanceTrends.trend}">
                        ${data.performance.performanceTrends.trend === 'improving' ? '↗' : data.performance.performanceTrends.trend === 'declining' ? '↘' : '→'}
                    </div>
                    <div class="metric-label">Tendência de Performance</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${data.efficiency.cacheEfficiency.hitRate.toFixed(1)}%</div>
                    <div class="metric-label">Taxa de Acerto do Cache</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${data.efficiency.skipEfficiency.skipRate.toFixed(1)}%</div>
                    <div class="metric-label">Taxa de Pulo</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${data.efficiency.errorRecovery.recoveryRate.toFixed(1)}%</div>
                    <div class="metric-label">Taxa de Recuperação</div>
                </div>
            </div>
        </div>
        
        ${data.recommendations.length > 0 ? `
        <div class="section">
            <h2>Recomendações</h2>
            <div class="recommendations">
                ${data.recommendations.map(rec => `
                <div class="recommendation">
                    <span class="priority-${rec.priority}">[${rec.priority.toUpperCase()}]</span>
                    <strong>${rec.message}</strong><br>
                    <em>${rec.suggestion}</em>
                </div>
                `).join('')}
            </div>
        </div>
        ` : ''}
        
        <div class="section">
            <h2>Sessões Recentes</h2>
            <table>
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Duração</th>
                        <th>Servidores</th>
                        <th>Localizações</th>
                        <th>Eficiência</th>
                        <th>Throughput</th>
                        <th>Erros</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.recentSessions.map(session => `
                    <tr>
                        <td>${new Date(session.timestamp).toLocaleDateString('pt-BR')}</td>
                        <td>${(session.duration / 1000 / 60).toFixed(1)}min</td>
                        <td>${session.servers.processed}</td>
                        <td>${session.locations.processed}</td>
                        <td>${session.performance.efficiency.toFixed(1)}%</td>
                        <td>${session.performance.throughput.toFixed(1)}</td>
                        <td>${session.errors.total}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>
</body>
</html>
        `;
  }
    
  /**
     * Gera relatório CSV
     */
  generateCsvReport(data) {
    const headers = [
      'Data',
      'Sessão ID',
      'Duração (min)',
      'Servidores Processados',
      'Localizações Processadas',
      'Localizações Puladas',
      'Erros',
      'Eficiência (%)',
      'Throughput (loc/min)',
      'Taxa de Erro (%)',
      'Taxa de Cache (%)'
    ];
        
    const rows = data.recentSessions.map(session => [
      new Date(session.timestamp).toLocaleDateString('pt-BR'),
      session.sessionId,
      (session.duration / 1000 / 60).toFixed(1),
      session.servers.processed,
      session.locations.processed,
      session.locations.skipped,
      session.errors.total,
      session.performance.efficiency.toFixed(1),
      session.performance.throughput.toFixed(1),
      session.performance.errorRate.toFixed(1),
      session.cache.hitRate.toFixed(1)
    ]);
        
    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }
    
  /**
     * Carrega dados históricos
     */
  async loadHistoricalData() {
    try {
      const files = await fs.readdir(this.config.reportDir);
      const jsonFiles = files.filter(f => f.endsWith('.json') && f.includes('efficiency-report'));
            
      for (const file of jsonFiles.slice(-5)) { // Últimos 5 relatórios
        try {
          const data = await fs.readFile(path.join(this.config.reportDir, file), 'utf8');
          const reportData = JSON.parse(data);
                    
          if (reportData.recentSessions) {
            this.data.sessions.push(...reportData.recentSessions);
          }
        } catch (error) {
          this.logger.warn(`Erro ao carregar arquivo ${file}:`, error);
        }
      }
            
      // Remover duplicatas e ordenar
      this.data.sessions = this.data.sessions
        .filter((session, index, self) => 
          index === self.findIndex(s => s.sessionId === session.sessionId)
        )
        .sort((a, b) => a.timestamp - b.timestamp);
            
      // Manter apenas dados recentes
      const cutoffDate = Date.now() - (this.config.maxHistoryDays * 24 * 60 * 60 * 1000);
      this.data.sessions = this.data.sessions.filter(s => s.timestamp > cutoffDate);
            
      this.logger.info(`Dados históricos carregados: ${this.data.sessions.length} sessões`);
            
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.warn('Erro ao carregar dados históricos:', error);
      }
    }
  }
    
  /**
     * Limpa recursos
     */
  async cleanup() {
    // Salvar dados finais se necessário
    if (this.config.autoGenerateReports && this.data.sessions.length > 0) {
      await this.generateReport();
    }
        
    this.logger.info('Gerador de relatórios finalizado');
  }
}

module.exports = LocationEfficiencyReporter;