const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Automação de Peritos
  startAutomation: (data) => ipcRenderer.invoke('start-automation', data),
  stopAutomation: () => ipcRenderer.invoke('stop-automation'),
  pauseAutomation: () => ipcRenderer.invoke('pause-automation'),
  resumeAutomation: () => ipcRenderer.invoke('resume-automation'),
  
  // Automação de Servidores
  startServidorAutomation: (data) => ipcRenderer.invoke('start-servidor-automation', data),
  stopServidorAutomation: () => ipcRenderer.invoke('stop-servidor-automation'),
  getServidorAutomationStatus: () => ipcRenderer.invoke('get-servidor-automation-status'),
  
  // Automação de Servidores V2
  startServidorAutomationV2: (config) => ipcRenderer.invoke('start-servidor-automation-v2', config),
  startServidorAutomationV2Sequential: (config) => ipcRenderer.invoke('start-servidor-automation-v2-sequential', config),
  startParallelAutomationV2: (config) => ipcRenderer.invoke('start-parallel-automation-v2', config),
  stopServidorAutomationV2: () => ipcRenderer.invoke('stop-servidor-automation-v2'),
  getServidorAutomationV2Status: () => ipcRenderer.invoke('get-servidor-automation-v2-status'),
  getServidorAutomationV2Report: () => ipcRenderer.invoke('get-servidor-automation-v2-report'),
  validateServidorConfigV2: (config) => ipcRenderer.invoke('validate-servidor-config-v2', config),
  resetAutomationLock: () => ipcRenderer.invoke('reset-automation-lock'),
  
  // Dados
  saveData: (key, data) => ipcRenderer.invoke('save-data', key, data),
  loadData: (key) => ipcRenderer.invoke('load-data', key),
  
  // Configuração
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  loadConfig: () => ipcRenderer.invoke('load-config'),
  
  // Arquivos
  importFile: (type) => ipcRenderer.invoke('import-file', type),
  exportFile: (data, filename) => ipcRenderer.invoke('export-file', data, filename),
  
  // Órgãos PJE
  loadOrgaosPje: () => ipcRenderer.invoke('load-orgaos-pje'),
  
  // Banco de Dados
  testDatabaseConnection: () => ipcRenderer.invoke('test-database-connection'),
  getDatabaseOptimizationReport: () => ipcRenderer.invoke('get-database-optimization-report'),
  checkServidorOjs: (idUsuario, ojs) => ipcRenderer.invoke('check-servidor-ojs', idUsuario, ojs),
  normalizeOjName: (nomeOJ) => ipcRenderer.invoke('normalize-oj-name', nomeOJ),
  saveDatabaseCredentials: (credentials) => ipcRenderer.invoke('save-database-credentials', credentials),
  loadDatabaseCredentials: () => ipcRenderer.invoke('load-database-credentials'),
  testDatabaseCredentials: (credentials) => ipcRenderer.invoke('test-database-credentials', credentials),
  
  // Sistema de Confirmação
  sendConfirmationResult: (confirmado, forcado) => ipcRenderer.send('confirmacao-resultado', confirmado, forcado),
  
  // Sistema de Verificação em Tempo Real
  getDatabaseStatus: () => ipcRenderer.invoke('get-database-status'),
  verifyServidorOjsRealtime: (cpf, perfil, ojsDesejados) => ipcRenderer.invoke('verify-servidor-ojs-realtime', cpf, perfil, ojsDesejados),
  
  // Consultas de Configuração
  buscarOrgaosJulgadores: (grau) => ipcRenderer.invoke('buscar-orgaos-julgadores', grau),
  buscarServidores: (grau, filtroNome, filtroPerfil, filtroStatus, filtroCidade) => ipcRenderer.invoke('buscar-servidores', grau, filtroNome, filtroPerfil, filtroStatus, filtroCidade),
  buscarServidorPorCPF: (cpf) => ipcRenderer.invoke('buscarServidorPorCPF', cpf),
  buscarOJsServidor: (cpf, grau) => ipcRenderer.invoke('buscar-ojs-servidor', cpf, grau),

  // Consulta de OJs do Banco de Dados PJE
  buscarOJs1Grau: (filtro, limite) => ipcRenderer.invoke('buscar-ojs-1grau', filtro, limite),
  buscarOJs2Grau: (filtro, limite) => ipcRenderer.invoke('buscar-ojs-2grau', filtro, limite),
  buscarOJsAmbosGraus: (filtro, limite) => ipcRenderer.invoke('buscar-ojs-ambos-graus', filtro, limite),
  testarConectividadePJE: () => ipcRenderer.invoke('testar-conectividade-pje'),
  obterEstatisticasOJs: () => ipcRenderer.invoke('obter-estatisticas-ojs'),
  exportarOJsJSON: (dados) => ipcRenderer.invoke('exportar-ojs-json', dados),
  
  // Processos
  buscarProcessoHistorico: (numero, grau) => ipcRenderer.invoke('buscar-processo-historico', numero, grau),
  buscarProcessoTarefaAtual: (numero, grau) => ipcRenderer.invoke('buscar-processo-tarefa-atual', numero, grau),
  buscarProcessoPartes: (numero, grau) => ipcRenderer.invoke('buscar-processo-partes', numero, grau),
  buscarProcessoInfo: (numero, grau) => ipcRenderer.invoke('buscar-processo-info', numero, grau),
  
  // Central de Configurações - Cache Management
  clearCache: () => ipcRenderer.invoke('clear-cache'),
  getCacheSize: () => ipcRenderer.invoke('get-cache-size'),
  
  // Central de Configurações - Backup e Restore
  exportBackup: () => ipcRenderer.invoke('export-backup'),
  restoreBackup: (backupData) => ipcRenderer.invoke('restore-backup', backupData),
  
  // Central de Configurações - System Logs
  getSystemLogs: (options) => ipcRenderer.invoke('get-system-logs', options),
  clearLogs: () => ipcRenderer.invoke('clear-logs'),
  
  // Central de Configurações - Performance Monitoring
  getPerformanceMetrics: () => ipcRenderer.invoke('get-performance-metrics'),
  
  // Configurações de Otimização
  getOptimizationConfig: (key) => ipcRenderer.invoke('get-optimization-config', key),
  setOptimizationConfig: (key, value) => ipcRenderer.invoke('set-optimization-config', key, value),
  getAllOptimizationConfigs: () => ipcRenderer.invoke('get-all-optimization-configs'),
  
  // Eventos
  onAutomationStatus: (callback) => {
    ipcRenderer.on('automation-status', (event, data) => callback(data));
  },
  
  onAutomationProgress: (callback) => {
    ipcRenderer.on('automation-progress', (event, data) => callback(data));
  },
  
  onAutomationReport: (callback) => {
    ipcRenderer.on('automation-report', (event, data) => callback(data));
  },
  
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
  
  // Função genérica invoke para compatibilidade
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args)
});
