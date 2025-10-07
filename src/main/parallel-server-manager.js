/**
 * Gerenciador de Processamento Paralelo de Servidores
 * 
 * Esta classe permite processar múltiplos servidores simultaneamente
 * usando instâncias separadas do navegador para melhorar a performance.
 * 
 * @author Sistema PJe Automação
 * @version 1.0.0
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ServidorAutomationV2 = require('./servidor-automation-v2');

class ParallelServerManager {
  constructor(maxInstances = 4, eventEmitter = null) {
    // Garantir limite máximo de 4 instâncias para estabilidade
    maxInstances = Math.min(Math.max(1, maxInstances), 4);

    // Verificar recursos do sistema e ajustar limite se necessário
    const recommendedMax = Math.min(this.getRecommendedMaxInstances(), 4);

    // Validar parâmetros de entrada
    if (!Number.isInteger(maxInstances) || maxInstances < 1 || maxInstances > 4) {
      throw new Error(`maxInstances deve ser um número inteiro entre 1 e 4, recebido: ${maxInstances}`);
    }

    // Avisar se o usuário está tentando usar mais instâncias do que o recomendado
    if (maxInstances > recommendedMax) {
      console.warn(`⚠️ AVISO: ${maxInstances} instâncias podem sobrecarregar o sistema. Recomendado: ${recommendedMax} instâncias baseado nos recursos disponíveis.`);
    }

    this.maxInstances = maxInstances;
    this.instances = [];
    this.serverQueue = [];
    this.results = new Map();
    this.isRunning = false;
    this.mainWindow = null;
    this.eventEmitter = eventEmitter;
    this.startTime = null;
    this.completedServers = 0;
    this.totalServers = 0;
    this.isInitialized = false;
    this.initializationErrors = [];
    
    console.log(`🔧 ParallelServerManager criado com ${maxInstances} instâncias máximas`);
  }

  /**
   * Calcula o número máximo recomendado de instâncias baseado nos recursos do sistema
   */
  getRecommendedMaxInstances() {
    try {
      const totalMemoryGB = Math.round(os.totalmem() / (1024 * 1024 * 1024));
      const cpuCores = os.cpus().length;
      const freeMemoryGB = Math.round(os.freemem() / (1024 * 1024 * 1024));
      
      // Cada instância do browser usa aproximadamente 200-500MB de RAM
      // Vamos assumir 300MB por instância como média
      const memoryBasedLimit = Math.floor(freeMemoryGB * 0.7 / 0.3); // 70% da memória livre
      
      // Baseado no número de CPUs (2 instâncias por core é razoável)
      const cpuBasedLimit = Math.floor(cpuCores * 1.5);
      
      // Usar o menor dos dois limites para segurança
      const recommendedMax = Math.min(memoryBasedLimit, cpuBasedLimit, 10);
      
      console.log(`💾 Sistema: ${totalMemoryGB}GB RAM total, ${freeMemoryGB}GB livres, ${cpuCores} CPUs`);
      console.log(`📊 Limite recomendado: ${recommendedMax} instâncias (Memória: ${memoryBasedLimit}, CPU: ${cpuBasedLimit})`);
      
      // Garantir um mínimo de 2 instâncias
      return Math.max(2, recommendedMax);
      
    } catch (error) {
      console.warn('⚠️ Erro ao calcular recursos do sistema, usando limite padrão de 4 instâncias');
      return 4;
    }
  }

  /**
   * Gera argumentos otimizados do browser baseado no número total de instâncias
   */
  getOptimizedBrowserArgs(instanceId) {
    const baseArgs = [
      `--window-position=${instanceId * 420},${instanceId * 120}`,
      '--disable-web-security',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--disable-plugins'
    ];

    // Para muitas instâncias, usar configurações mais restritivas
    if (this.maxInstances >= 10) {
      baseArgs.push(
        '--disable-gpu',
        '--disable-features=VizDisplayCompositor,TranslateUI',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-ipc-flooding-protection',
        '--memory-pressure-off',
        '--max_old_space_size=2048', // Reduzir memória para muitas instâncias
        '--disable-sync',
        '--disable-default-apps',
        '--disable-background-networking'
      );
    } else if (this.maxInstances >= 5) {
      baseArgs.push(
        '--disable-gpu',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--max_old_space_size=3072'
      );
    } else {
      baseArgs.push(
        '--max_old_space_size=4096'
      );
    }

    return baseArgs;
  }

  /**
   * Define viewport otimizado baseado no número de instâncias
   */
  getOptimizedViewport() {
    if (this.maxInstances >= 15) {
      // Para muitas instâncias, usar janelas menores
      return { width: 800, height: 600 };
    } else if (this.maxInstances >= 8) {
      return { width: 1000, height: 700 };
    } else {
      return { width: 1200, height: 800 };
    }
  }

  /**
   * Inicializa as instâncias paralelas do navegador
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('⚠️ ParallelServerManager já foi inicializado');
      return true;
    }
    
    console.log(`🚀 Inicializando ${this.maxInstances} instâncias paralelas...`);
    this.initializationErrors = [];
    
    try {
      // Limpar instâncias existentes se houver
      if (this.instances.length > 0) {
        console.log(`🧹 Limpando ${this.instances.length} instâncias existentes...`);
        await this.cleanup();
      }
      
      // Criar instâncias uma por vez com tratamento de erro individual
      for (let i = 0; i < this.maxInstances; i++) {
        try {
          console.log(`🔄 Criando instância ${i + 1}/${this.maxInstances}...`);
          const instance = await this.createInstance(i);
          
          // Validar instância criada
          if (!instance || !instance.context || !instance.page) {
            throw new Error(`Instância ${i + 1} criada com dados inválidos`);
          }
          
          // Verificar se a página está funcional
          if (instance.page.isClosed()) {
            throw new Error(`Página da instância ${i + 1} está fechada`);
          }
          
          this.instances.push(instance);
          console.log(`✅ Instância ${i + 1} criada com sucesso (ID: ${instance.id})`);
        } catch (instanceError) {
          const errorMsg = `Erro criando instância ${i + 1}: ${instanceError.message}`;
          console.error(`❌ ${errorMsg}`);
          this.initializationErrors.push(errorMsg);
          
          // Se falhar na primeira instância, é crítico
          if (i === 0) {
            throw new Error(`Falha crítica: não foi possível criar a primeira instância - ${instanceError.message}`);
          }
        }
      }
      
      // Verificar se pelo menos uma instância foi criada
      if (this.instances.length === 0) {
        throw new Error('Nenhuma instância foi criada com sucesso');
      }
      
      this.isInitialized = true;
      
      console.log(`🎉 ${this.instances.length}/${this.maxInstances} instâncias prontas para processamento`);
      
      if (this.initializationErrors.length > 0) {
        console.log('⚠️ Avisos durante inicialização:');
        this.initializationErrors.forEach((error, index) => {
          console.log(`   ${index + 1}. ${error}`);
        });
      }
      
      return true;
    } catch (error) {
      console.error('❌ Erro crítico ao inicializar instâncias:', error.message);
      this.isInitialized = false;
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Cria uma instância individual do navegador
   */
  async createInstance(id) {
    // Validar ID
    if (!Number.isInteger(id) || id < 0) {
      throw new Error(`ID da instância deve ser um número inteiro não negativo, recebido: ${id}`);
    }
    
    const timestamp = Date.now();
    const userDataDir = path.join(__dirname, '..', '..', 'temp', `pje-parallel-${id}-${timestamp}`);
    
    try {
      // Limpar diretório se existir e criar novo
      if (fs.existsSync(userDataDir)) {
        console.log(`🧹 Removendo diretório existente: ${userDataDir}`);
        fs.rmSync(userDataDir, { recursive: true, force: true });
      }
      
      console.log(`📁 Criando diretório: ${userDataDir}`);
      fs.mkdirSync(userDataDir, { recursive: true });
      
      // Verificar se o diretório foi criado
      if (!fs.existsSync(userDataDir)) {
        throw new Error(`Falha ao criar diretório: ${userDataDir}`);
      }
      
      console.log(`🌐 Iniciando contexto do navegador para instância ${id}...`);
      
      // Configurações otimizadas baseadas no número de instâncias
      const browserArgs = this.getOptimizedBrowserArgs(id);
      const viewportSize = this.getOptimizedViewport();
      
      const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        args: browserArgs,
        viewport: viewportSize,
        timeout: 60000 // Timeout de 60 segundos para criação do contexto
      });
      
      // Validar contexto criado
      if (!context) {
        throw new Error('Contexto do navegador não foi criado');
      }
      
      console.log(`📄 Criando página para instância ${id}...`);
      const page = await context.newPage();
      
      // Validar página criada
      if (!page) {
        throw new Error('Página do navegador não foi criada');
      }
      
      // Configurar timeouts aumentados para melhor estabilidade
      page.setDefaultTimeout(45000);
      page.setDefaultNavigationTimeout(60000);
      
      // Configurar tratamento de erros da página
      page.on('pageerror', (error) => {
        console.error(`❌ Erro na página da instância ${id}:`, error.message);
        // Marcar instância como problemática
        instance.isValid = false;
        instance.lastError = error.message;
      });
      
      page.on('crash', () => {
        console.error(`💥 Página da instância ${id} crashou`);
        // Marcar instância como problemática
        instance.isValid = false;
        instance.lastError = 'Página crashou';
      });
      
      page.on('close', () => {
        console.warn(`⚠️ Página da instância ${id} foi fechada`);
        instance.isValid = false;
        instance.lastError = 'Página foi fechada';
      });
      
      // Configurar handlers para erros de conexão
      page.on('error', (error) => {
        console.error(`❌ Erro de conexão na instância ${id}:`, error.message);
        instance.isValid = false;
        instance.lastError = error.message;
      });
      
      const instance = {
        id,
        context,
        page,
        browser: context, // Alias para compatibilidade
        userDataDir,
        busy: false,
        currentServer: null,
        automation: null, // Será criado quando necessário
        results: [], // Array para armazenar resultados de processamento
        errors: [], // Array para armazenar erros
        startTime: null,
        endTime: null,
        totalProcessed: 0, // Contador de servidores processados
        totalSuccesses: 0, // Contador de sucessos
        totalErrors: 0, // Contador de erros
        createdAt: timestamp,
        isValid: true,
        lastActivity: timestamp // Para rastreamento de atividade
      };
      
      console.log(`✅ Instância ${id} criada com sucesso`);
      return instance;
      
    } catch (error) {
      console.error(`❌ Erro criando instância ${id}:`, error.message);
      
      // Limpar recursos em caso de erro
      try {
        if (fs.existsSync(userDataDir)) {
          fs.rmSync(userDataDir, { recursive: true, force: true });
        }
      } catch (cleanupError) {
        console.error(`⚠️ Erro limpando recursos da instância ${id}:`, cleanupError.message);
      }
      
      throw new Error(`Falha ao criar instância ${id}: ${error.message}`);
    }
  }

  /**
   * Verifica a saúde de uma instância
   */
  async checkInstanceHealth(instance) {
    try {
      if (!instance || !instance.context || !instance.page) {
        return { healthy: false, reason: 'Instância ou componentes inválidos' };
      }
      
      if (instance.page.isClosed()) {
        return { healthy: false, reason: 'Página está fechada' };
      }
      
      if (instance.context.browser && instance.context.browser.isConnected && !instance.context.browser.isConnected()) {
        return { healthy: false, reason: 'Browser desconectado' };
      }
      
      // Teste simples de funcionalidade
      try {
        await instance.page.evaluate(() => document.title);
        instance.lastActivity = Date.now();
        return { healthy: true };
      } catch (evalError) {
        return { healthy: false, reason: `Erro ao avaliar página: ${evalError.message}` };
      }
      
    } catch (error) {
      return { healthy: false, reason: `Erro na verificação: ${error.message}` };
    }
  }

  /**
   * Recupera uma instância problemática
   */
  async recoverInstance(instance) {
    try {
      console.log(`🔧 Tentando recuperar instância ${instance.id}...`);
      
      // Verificar se a página está fechada e recriar se necessário
      if (!instance.page || instance.page.isClosed()) {
        console.log(`📄 Recriando página para instância ${instance.id}...`);
        instance.page = await instance.context.newPage();
        
        // Reconfigurar timeouts e handlers
        instance.page.setDefaultTimeout(45000);
        instance.page.setDefaultNavigationTimeout(60000);
        
        // Reconfigurar handlers de erro
        instance.page.on('pageerror', (error) => {
          console.error(`❌ Erro na página da instância ${instance.id}:`, error.message);
          instance.isValid = false;
          instance.lastError = error.message;
        });
        
        instance.page.on('crash', () => {
          console.error(`💥 Página da instância ${instance.id} crashou`);
          instance.isValid = false;
          instance.lastError = 'Página crashou';
        });
        
        instance.page.on('close', () => {
          console.warn(`⚠️ Página da instância ${instance.id} foi fechada`);
          instance.isValid = false;
          instance.lastError = 'Página foi fechada';
        });
        
        instance.page.on('error', (error) => {
          console.error(`❌ Erro de conexão na instância ${instance.id}:`, error.message);
          instance.isValid = false;
          instance.lastError = error.message;
        });
      }
      
      // Marcar como válida novamente
      instance.isValid = true;
      instance.lastError = null;
      instance.lastActivity = Date.now();
      
      console.log(`✅ Instância ${instance.id} recuperada com sucesso`);
      return true;
      
    } catch (error) {
      console.error(`❌ Falha ao recuperar instância ${instance.id}:`, error.message);
      instance.isValid = false;
      instance.lastError = error.message;
      return false;
    }
  }

  /**
   * Distribui servidores entre as instâncias disponíveis
   */
  distributeServers(servers) {
    if (!servers || servers.length === 0) {
      return [];
    }

    const distribution = [];
    const serversPerInstance = Math.ceil(servers.length / this.maxInstances);
    
    for (let i = 0; i < this.maxInstances && i * serversPerInstance < servers.length; i++) {
      const start = i * serversPerInstance;
      const end = Math.min(start + serversPerInstance, servers.length);
      distribution.push(servers.slice(start, end));
    }
    
    return distribution;
  }

  /**
   * Processa uma lista de servidores em paralelo
   */
  async processServersInParallel(servers, config = {}) {
    console.log(`[ParallelServerManager] Iniciando processamento paralelo de ${servers?.length || 0} servidores`);
    
    try {
      // Validações de entrada
      if (!Array.isArray(servers)) {
        const error = 'Lista de servidores deve ser um array';
        console.error(`[ParallelServerManager] Erro de validação: ${error}`);
        return { success: false, error };
      }
      
      if (servers.length === 0) {
        const error = 'Lista de servidores está vazia';
        console.warn(`[ParallelServerManager] Aviso: ${error}`);
        return { success: true, results: this.getEmptyResults(), message: 'Nenhum servidor para processar' };
      }
      
      // Verificar se já está em execução
      if (this.isRunning) {
        const error = 'Processamento paralelo já está em execução';
        console.warn(`[ParallelServerManager] ${error}`);
        return { success: false, error };
      }
      
      // Verificar se está inicializado
      if (!this.isInitialized) {
        const error = 'ParallelServerManager não foi inicializado';
        console.error(`[ParallelServerManager] ${error}`);
        return { success: false, error };
      }
      
      // Verificar se há instâncias disponíveis
      if (!this.instances || this.instances.length === 0) {
        const error = 'Nenhuma instância de navegador disponível';
        console.error(`[ParallelServerManager] ${error}`);
        return { success: false, error };
      }
      
      // Inicializar propriedades
      this.serverQueue = [...servers];
      this.totalServers = servers.length;
      this.completedServers = 0;
      this.isRunning = true;
      this.startTime = Date.now();
      this.keepBrowserOpen = config.keepBrowserOpen !== false; // Default: manter aberto
      
      // Limpar resultados anteriores
      this.results = [];
      this.instances.forEach(instance => {
        if (instance.errors) instance.errors = [];
        if (instance.results) instance.results = [];
      });
      
      console.log(`[ParallelServerManager] Configuração: ${this.instances.length} instâncias, keepBrowserOpen: ${this.keepBrowserOpen}`);
      
      this.sendStatusUpdate({
        type: 'parallel-start',
        totalServers: this.totalServers,
        instances: this.maxInstances,
        message: `Iniciando processamento paralelo de ${this.totalServers} servidores com ${this.instances.length} instâncias`
      });
      
      // Log inicial do processamento paralelo
      console.log(`🚀 ========== INICIANDO PROCESSAMENTO PARALELO ==========`);
      console.log(`📊 Configuração:`);
      console.log(`   - Servidores: ${this.totalServers}`);
      console.log(`   - Instâncias: ${this.instances.length}/${this.maxInstances}`);
      console.log(`   - Modo: ${this.keepBrowserOpen ? 'Manter navegador aberto' : 'Fechar ao fim'}`);
      console.log(`=======================================================`);

      // Iniciar processamento em todas as instâncias com isolamento total de erros
      const promises = this.instances.map((instance, index) => {
        console.log(`🔷 [Instância ${instance.id || index}] Iniciando thread de processamento...`);

        return this.processWithInstance(instance, config).catch(error => {
          console.error(`❌ [Instância ${instance.id || index}] Erro crítico no thread:`, error.message);
          console.error(`📋 [Instância ${instance.id || index}] Stack trace:`, error.stack);

          // Registrar erro na instância com informações detalhadas
          if (!instance.errors) instance.errors = [];
          instance.errors.push({
            type: 'instance_processing_error',
            message: error.message || 'Erro desconhecido no processamento da instância',
            stack: error.stack,
            timestamp: new Date().toISOString(),
            instanceId: instance.id,
            serversProcessedBeforeError: instance.totalProcessed || 0
          });

          console.log(`⚠️ [Instância ${instance.id || index}] Erro isolado - outras instâncias continuam funcionando`);
          return null; // Retorna null para não quebrar Promise.all
        });
      });
      
      console.log(`[ParallelServerManager] Aguardando conclusão de ${promises.length} instâncias...`);
      await Promise.all(promises);
      
      console.log('[ParallelServerManager] Processamento concluído. Consolidando resultados...');
      const results = this.consolidateResults();
      
      // Verificar se houve erros críticos
      const totalErrors = this.instances.reduce((total, instance) => total + (instance.errors?.length || 0), 0);
      const hasOnlyErrors = totalErrors > 0 && this.completedServers === 0;
      
      console.log(`[ParallelServerManager] Estatísticas: ${this.completedServers} servidores processados, ${totalErrors} erros`);
      
      if (hasOnlyErrors) {
        const error = `Processamento falhou: ${totalErrors} erros, 0 servidores processados com sucesso`;
        console.error(`[ParallelServerManager] ${error}`);
        return { success: false, error, results };
      }
      
      // Mostrar modal de resultados se configurado para manter navegador aberto
      // DESABILITADO: Modal de resultados removido conforme solicitação do usuário
      /*
      if (this.keepBrowserOpen) {
        console.log(`[ParallelServerManager] Exibindo modal de resultados...`);
        try {
          await this.showResultsModal(results);
        } catch (modalError) {
          console.error(`[ParallelServerManager] Erro ao exibir modal de resultados:`, modalError);
          // Não falha o processamento por causa do modal
        }
      }
      */
      
      const processingTime = ((Date.now() - this.startTime) / 1000).toFixed(1);
      console.log(`[ParallelServerManager] Processamento paralelo concluído com sucesso em ${processingTime}s`);
      
      this.sendStatusUpdate({
        type: 'parallel-complete',
        results,
        message: `Processamento paralelo concluído em ${processingTime}s`
      });
      
      return {
        success: true,
        results,
        processingTime: parseFloat(processingTime),
        serversProcessed: this.completedServers,
        totalErrors
      };
      
    } catch (error) {
      const processingTime = this.startTime ? ((Date.now() - this.startTime) / 1000).toFixed(1) : 0;
      console.error(`[ParallelServerManager] ❌ Erro crítico no processamento paralelo após ${processingTime}s:`, error);
      
      // Tentar consolidar resultados parciais
      let partialResults = null;
      try {
        partialResults = this.consolidateResults();
        console.log(`[ParallelServerManager] Resultados parciais consolidados: ${this.completedServers} servidores processados`);
      } catch (consolidateError) {
        console.error('[ParallelServerManager] Erro ao consolidar resultados parciais:', consolidateError);
      }
      
      this.sendStatusUpdate({
        type: 'parallel-error',
        error: error.message,
        partialResults,
        serversProcessed: this.completedServers || 0,
        processingTime: parseFloat(processingTime)
      });
      
      return {
        success: false,
        error: error.message,
        errorType: error.name || 'UnknownError',
        partialResults,
        serversProcessed: this.completedServers || 0,
        processingTime: parseFloat(processingTime)
      };
    } finally {
      // Limpeza e reset de estado
      this.isRunning = false;
      
      // Log de finalização
      const finalTime = this.startTime ? ((Date.now() - this.startTime) / 1000).toFixed(1) : 0;
      console.log(`[ParallelServerManager] Finalizando processamento paralelo após ${finalTime}s`);
      
      // Reset de propriedades se necessário
      if (this.serverQueue) {
        this.serverQueue = [];
      }
    }
  }

  /**
   * Processa servidores com uma instância específica
   */
  async processWithInstance(instance, config) {
    console.log(`[ParallelServerManager] Iniciando processamento na instância ${instance.id}`);
    
    // Validações de entrada
    if (!instance) {
      console.error('[ParallelServerManager] Instância inválida fornecida');
      return;
    }
    
    if (!instance.id) {
      console.warn('[ParallelServerManager] Instância sem ID definido');
    }
    
    // Inicializar contadores se não existirem
    if (!instance.results) instance.results = [];
    if (typeof instance.totalProcessed !== 'number') instance.totalProcessed = 0;
    if (typeof instance.totalSuccesses !== 'number') instance.totalSuccesses = 0;
    if (!instance.errors) instance.errors = [];
    
    let serversProcessedByInstance = 0;
    
    try {
      while (this.serverQueue.length > 0 && this.isRunning) {
        const server = this.serverQueue.shift();
        if (!server) {
          console.log('[ParallelServerManager] Servidor vazio encontrado na fila, continuando...');
          break;
        }
        
        // Validar dados do servidor
        if (!server.nome && !server.cpf) {
          console.warn('[ParallelServerManager] Servidor sem nome ou CPF:', server);
          const errorResult = {
            servidor: server,
            instancia: instance.id,
            erro: 'Servidor sem nome ou CPF válido',
            timestamp: new Date().toISOString(),
            tipo: 'validation_error'
          };
          instance.errors.push(errorResult);
          continue;
        }
        
        const serverIdentifier = server.nome || server.cpf;
        console.log(`[ParallelServerManager] Instância ${instance.id} processando servidor: ${serverIdentifier}`);
        
        // Verificar saúde da instância antes do processamento
        const healthCheck = await this.checkInstanceHealth(instance);
        if (!healthCheck.healthy) {
          console.warn(`[ParallelServerManager] Instância ${instance.id} não está saudável: ${healthCheck.reason}`);
          
          // Tentar recuperar a instância
          const recovered = await this.recoverInstance(instance);
          if (!recovered) {
            console.error(`[ParallelServerManager] Falha ao recuperar instância ${instance.id}`);
            const errorResult = {
              servidor: server,
              instancia: instance.id,
              erro: `Instância não saudável e não foi possível recuperar: ${healthCheck.reason}`,
              timestamp: new Date().toISOString(),
              tipo: 'instance_recovery_failed'
            };
            instance.errors.push(errorResult);
            continue;
          }
          
          console.log(`[ParallelServerManager] ✅ Instância ${instance.id} recuperada com sucesso`);
        }
        
        instance.busy = true;
        instance.currentServer = server;
        instance.startTime = Date.now();
        
        this.sendStatusUpdate({
          type: 'instance-start',
          instanceId: instance.id,
          server: serverIdentifier,
          remaining: this.serverQueue.length
        });
        
        try {
          const result = await this.processServerWithInstance(instance, server, config);
          
          // Validar e processar resultado
          if (result && typeof result === 'object') {
            // Adicionar metadados ao resultado
            result.instanceId = instance.id;
            result.processedAt = new Date().toISOString();
            result.processingTime = Date.now() - instance.startTime;
            
            instance.results.push(result);
            instance.totalProcessed++;
            instance.totalSuccesses += (result.sucessos || 0);
            serversProcessedByInstance++;
            
            console.log(`[ParallelServerManager] Instância ${instance.id} processou ${serverIdentifier} com sucesso (${result.sucessos || 0} sucessos)`);
          } else {
            console.warn(`[ParallelServerManager] ⚠️ Resultado inválido para servidor ${serverIdentifier}:`, result);
            const errorResult = {
              servidor: server,
              instancia: instance.id,
              erro: 'Resultado inválido retornado',
              timestamp: new Date().toISOString(),
              tipo: 'invalid_result',
              result
            };
            instance.errors.push(errorResult);
          }
          
          this.completedServers++;
          
          this.sendStatusUpdate({
            type: 'instance-success',
            instanceId: instance.id,
            server: serverIdentifier,
            result,
            completed: this.completedServers,
            total: this.totalServers
          });
          
          // Emitir evento de progresso
          this.sendProgressUpdate();
          
        } catch (error) {
          console.error(`[ParallelServerManager] ❌ Erro na instância ${instance.id} processando ${serverIdentifier}:`, error);
          
          const errorResult = {
            servidor: server,
            instancia: instance.id,
            erro: error.message || 'Erro desconhecido',
            errorType: error.name || 'UnknownError',
            timestamp: new Date().toISOString(),
            processingTime: Date.now() - instance.startTime,
            stack: error.stack,
            tipo: 'processing_error'
          };
           
          instance.errors.push(errorResult);
          instance.totalProcessed++;
          if (typeof instance.totalErrors !== 'number') instance.totalErrors = 0;
          instance.totalErrors++;
          this.completedServers++;
           
          this.sendStatusUpdate({
            type: 'instance-error',
            instanceId: instance.id,
            server: serverIdentifier,
            error: error.message,
            completed: this.completedServers,
            total: this.totalServers
          });
        } finally {
          instance.busy = false;
          instance.currentServer = null;
          instance.endTime = Date.now();
        }
      }
    } catch (instanceError) {
      console.error(`[ParallelServerManager] Erro crítico na instância ${instance.id}:`, instanceError);
      if (!instance.errors) instance.errors = [];
      instance.errors.push({
        tipo: 'instance_critical_error',
        erro: instanceError.message || 'Erro crítico na instância',
        timestamp: new Date().toISOString(),
        stack: instanceError.stack
      });
    } finally {
      console.log(`[ParallelServerManager] Instância ${instance.id} finalizou processamento. Servidores processados: ${serversProcessedByInstance}`);
      instance.busy = false;
      instance.currentServer = null;
    }
  }

  /**
   * Processa um servidor específico com uma instância
   */
  async processServerWithInstance(instance, server, config) {
    console.log('🔧 [DEBUG] processServerWithInstance iniciado');
    console.log(`🔧 [DEBUG] instance.id: ${instance.id}`);
    console.log(`🔧 [DEBUG] server: ${JSON.stringify(server)}`);
    console.log(`🔧 [DEBUG] config: ${JSON.stringify(config)}`);
    
    // Usar automação externa se fornecida (para testes) ou criar nova
    let automation = config.automationInstance;
    
    if (!automation) {
      // Criar nova automação se não existir ou se a existente estiver inválida
      if (!instance.automation || !instance.automation.page) {
        instance.automation = new ServidorAutomationV2();
        instance.automation.page = instance.page;
        instance.automation.mainWindow = this.mainWindow;
        console.log(`[ParallelServerManager] Nova automação criada para instância ${instance.id}`);
      }
      automation = instance.automation;
    }
    
    const startTime = Date.now();
    
    try {
      if (config.automationInstance) {
        // Usar automação externa (para testes)
        const result = await config.automationInstance.processServers([server]);
        
        return {
          servidor: server,
          instancia: instance.id,
          tempoProcessamento: Date.now() - startTime,
          sucessos: result.resultados ? result.resultados.filter(r => r.sucessos > 0).length : 1,
          erros: result.errors ? result.errors.length : 0,
          detalhes: result.resultados || [],
          timestamp: new Date().toISOString()
        };
      } else {
        // Usar automação real
        const realAutomation = automation;
        
        // Validar e recriar página se necessário
        if (!realAutomation.page || realAutomation.page.isClosed()) {
          console.log(`🔄 Recriando página para instância ${instance.id}...`);
          try {
            // Recriar página na instância
            realAutomation.page = await instance.context.newPage();
            
            // Configurar timeouts e handlers da nova página
            await realAutomation.page.setDefaultTimeout(30000);
            await realAutomation.page.setDefaultNavigationTimeout(45000);
            
            // Configurar handlers de erro para a nova página
            realAutomation.page.on('error', (error) => {
              console.error(`❌ Erro na página da instância ${instance.id}:`, error);
            });
            
            realAutomation.page.on('pageerror', (error) => {
              console.error(`❌ Erro de página na instância ${instance.id}:`, error);
            });
            
            console.log(`✅ Página recriada com sucesso para instância ${instance.id}`);
          } catch (pageError) {
            console.error(`❌ Erro ao recriar página para instância ${instance.id}:`, pageError);
            throw new Error(`Falha ao recriar página: ${pageError.message}`);
          }
        }
        
        // Realizar login se necessário
        await realAutomation.performLogin();
        
        // Navegar para o servidor
        await realAutomation.navigateDirectlyToPerson(server.cpf);
        
        // Navegar para a aba de servidores
        await realAutomation.navigateToServerTab();
        
        // Configurar OJs para este servidor
        console.log(`🔧 [DEBUG] Configurando OJs para servidor ${server.nome || server.cpf}`);
        console.log(`🔧 [DEBUG] server.orgaos: ${JSON.stringify(server.orgaos)}`);
        console.log(`🔧 [DEBUG] config.orgaos: ${JSON.stringify(config.orgaos)}`);
        console.log(`🔧 [DEBUG] server.perfil: ${server.perfil}`);
        console.log(`🔧 [DEBUG] config.perfil: ${config.perfil}`);
        
        realAutomation.config = { 
          orgaos: server.orgaos || config.orgaos || [],
          perfil: server.perfil || config.perfil || 'Servidor'
        };
        
        console.log(`🔧 [DEBUG] Configuração final: ${JSON.stringify(realAutomation.config)}`);
        console.log(`🔧 [DEBUG] Número de órgãos a processar: ${realAutomation.config.orgaos.length}`);
        
        // Configurar servidor atual na automação
        realAutomation.currentServidor = server;
        console.log(`🔧 [DEBUG] currentServidor configurado: ${JSON.stringify(realAutomation.currentServidor)}`);
        
        // Processar órgãos julgadores
        console.log(`🚀 [DEBUG] Iniciando processOrgaosJulgadores para ${server.nome || server.cpf}`);
        const processResult = await realAutomation.processOrgaosJulgadores();
        console.log(`✅ [DEBUG] processOrgaosJulgadores concluído. Resultado: ${JSON.stringify(processResult)}`);
        
        const endTime = Date.now();
        
        // Validar resultados da automação
        const results = realAutomation.results || [];
        const sucessos = results.filter(r => r && r.status === 'Incluído com Sucesso').length;
        const erros = results.filter(r => r && r.status !== 'Incluído com Sucesso').length;
        
        return {
          servidor: server,
          instancia: instance.id,
          tempoProcessamento: endTime - startTime,
          sucessos,
          erros,
          detalhes: results,
          timestamp: new Date().toISOString()
        };
      }
      
    } catch (error) {
      console.error(`❌ Erro processando servidor ${server.nome || server.cpf || 'DESCONHECIDO'} na instância ${instance.id}:`, error);
      
      // Retornar resultado estruturado mesmo em caso de erro
      return {
        servidor: server,
        instancia: instance.id,
        tempoProcessamento: Date.now() - startTime,
        sucessos: 0,
        erros: 1,
        detalhes: [{
          status: 'Erro no processamento',
          erro: error.message,
          timestamp: new Date().toISOString()
        }],
        timestamp: new Date().toISOString(),
        erro: true,
        mensagemErro: error.message
      };
    }
  }

  /**
   * Consolida os resultados de todas as instâncias
   */
  consolidateResults() {
    const allResults = [];
    const allErrors = [];
    let totalProcessingTime = 0;
    
    // Garantir que instances existe e tem dados válidos
    if (!this.instances || this.instances.length === 0) {
      console.warn('⚠️ Nenhuma instância encontrada para consolidar resultados');
      return this.getEmptyResults();
    }
    
    for (const instance of this.instances) {
      // Verificar se instance tem as propriedades necessárias
      if (instance.results && Array.isArray(instance.results)) {
        // Validar cada resultado antes de adicionar
        const validResults = instance.results.filter(r => {
          return r && 
                 typeof r === 'object' && 
                 r.servidor && 
                 typeof r.sucessos === 'number' && 
                 typeof r.erros === 'number' && 
                 typeof r.tempoProcessamento === 'number';
        });
        
        const invalidResults = instance.results.filter(r => {
          return !r || 
                 typeof r !== 'object' || 
                 !r.servidor || 
                 typeof r.sucessos !== 'number' || 
                 typeof r.erros !== 'number' || 
                 typeof r.tempoProcessamento !== 'number';
        });
        
        if (invalidResults.length > 0) {
          console.warn(`⚠️ Instância ${instance.id}: ${invalidResults.length} resultados inválidos encontrados`);
          invalidResults.forEach((r, index) => {
            console.warn(`   ${index + 1}. Tipo: ${typeof r}, Conteúdo:`, r);
          });
        }
        
        allResults.push(...validResults);
      }
      
      if (instance.errors && Array.isArray(instance.errors)) {
        allErrors.push(...instance.errors);
      }
      
      if (instance.startTime && instance.endTime) {
        totalProcessingTime += (instance.endTime - instance.startTime);
      }
    }
    
    // Garantir que startTime existe
    const totalTime = this.startTime ? (Date.now() - this.startTime) : 0;
    const averageTimePerServer = allResults.length > 0 ? totalTime / allResults.length : 0;
    
    // Garantir que totalServers e completedServers têm valores válidos
    const totalServidores = this.totalServers || 0;
    const servidoresProcessados = this.completedServers || allResults.length;
    const sucessos = allResults.reduce((total, r) => total + (r.sucessos || 0), 0);
    const erros = allErrors.length;
    
    console.log(`📊 Consolidando resultados: ${servidoresProcessados}/${totalServidores} servidores, ${sucessos} sucessos, ${erros} erros`);
    console.log(`📊 Resultados válidos: ${allResults.length}, Taxa de validação: ${totalServidores > 0 ? ((allResults.length / totalServidores) * 100).toFixed(1) : 0}%`);
    
    return {
      totalServidores,
      servidoresProcessados,
      sucessos,
      erros,
      tempoTotal: totalTime,
      tempoMedioServidor: averageTimePerServer,
      instanciasUtilizadas: this.maxInstances,
      eficienciaParalela: this.calculateParallelEfficiency(totalTime, totalProcessingTime),
      resultados: allResults,
      errosDetalhados: allErrors,
      estatisticas: this.generateStatistics(allResults),
      validacao: {
        resultadosValidos: allResults.length,
        percentualValidos: totalServidores > 0 ? ((allResults.length / totalServidores) * 100) : 0,
        taxaSucesso: (sucessos + erros) > 0 ? ((sucessos / (sucessos + erros)) * 100) : 0
      }
    };
  }

  /**
   * Retorna estrutura de resultados vazia para casos de erro
   */
  getEmptyResults() {
    return {
      totalServidores: this.totalServers || 0,
      servidoresProcessados: 0,
      sucessos: 0,
      erros: 0,
      tempoTotal: 0,
      tempoMedioServidor: 0,
      instanciasUtilizadas: this.maxInstances || 0,
      eficienciaParalela: { speedup: 0, efficiency: 0, timeReduction: 0 },
      resultados: [],
      errosDetalhados: [],
      estatisticas: {}
    };
  }

  /**
   * Calcula a eficiência do processamento paralelo
   */
  calculateParallelEfficiency(totalTime, totalProcessingTime) {
    if (totalProcessingTime === 0) return 0;
    
    const theoreticalSequentialTime = totalProcessingTime;
    const actualParallelTime = totalTime;
    
    return {
      speedup: theoreticalSequentialTime / actualParallelTime,
      efficiency: (theoreticalSequentialTime / actualParallelTime) / this.maxInstances,
      timeReduction: ((theoreticalSequentialTime - actualParallelTime) / theoreticalSequentialTime) * 100
    };
  }

  /**
   * Gera estatísticas detalhadas
   */
  generateStatistics(results) {
    if (results.length === 0) return {};
    
    const processingTimes = results.map(r => r.tempoProcessamento);
    const successCounts = results.map(r => r.sucessos);
    
    return {
      tempoProcessamento: {
        minimo: Math.min(...processingTimes),
        maximo: Math.max(...processingTimes),
        media: processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
      },
      sucessosPorServidor: {
        minimo: Math.min(...successCounts),
        maximo: Math.max(...successCounts),
        media: successCounts.reduce((a, b) => a + b, 0) / successCounts.length,
        total: successCounts.reduce((a, b) => a + b, 0)
      }
    };
  }

  /**
   * Envia atualizações de status para a interface
   */
  sendStatusUpdate(status) {
    const statusWithTimestamp = {
      ...status,
      timestamp: new Date().toISOString()
    };
    
    if (this.mainWindow && this.mainWindow.webContents) {
      this.mainWindow.webContents.send('parallel-status-update', statusWithTimestamp);
    }
    
    if (this.eventEmitter) {
      this.eventEmitter.emit('parallel-status-update', statusWithTimestamp);
    }
    
    // Corrigir serialização para evitar '[object Object]'
    let logMessage;
    if (status.message) {
      logMessage = status.message;
    } else if (typeof status === 'object') {
      try {
        logMessage = JSON.stringify(status, null, 2);
      } catch (error) {
        logMessage = `[Erro na serialização: ${error.message}]`;
      }
    } else {
      logMessage = String(status);
    }
    
    console.log(`📊 [Parallel] ${status.type}:`, logMessage);
  }
  
  /**
   * Envia eventos de progresso durante o processamento
   */
  sendProgressUpdate() {
    const progressData = {
      instances: this.instances.map(instance => ({
        id: instance.id,
        busy: instance.busy,
        currentServer: instance.currentServer ? instance.currentServer.nome || instance.currentServer.cpf : null,
        results: instance.results.length,
        errors: instance.errors.length
      })),
      overallProgress: {
        completed: this.completedServers,
        total: this.totalServers,
        percentage: this.totalServers > 0 ? (this.completedServers / this.totalServers) * 100 : 0
      },
      timestamp: new Date().toISOString()
    };
    
    if (this.mainWindow && this.mainWindow.webContents) {
      this.mainWindow.webContents.send('parallel-progress', progressData);
    }
    
    if (this.eventEmitter) {
      this.eventEmitter.emit('parallel-progress', progressData);
    }
  }

  /**
   * Para o processamento paralelo
   */
  async stop() {
    console.log('⏹️ Parando processamento paralelo...');
    this.isRunning = false;
    
    // Parar todas as automações em execução
    for (const instance of this.instances) {
      if (instance.automation && instance.automation.isRunning) {
        try {
          await instance.automation.stop();
        } catch (error) {
          console.error(`Erro ao parar automação da instância ${instance.id}:`, error);
        }
      }
      
      // Call stop method on instance if it exists (for testing)
      if (typeof instance.stop === 'function') {
        try {
          await instance.stop();
        } catch (error) {
          console.error(`Erro ao parar instância ${instance.id}:`, error);
        }
      }
    }
    
    // Clear instances array
    this.instances = [];
    
    // Emitir evento de parada
    if (this.mainWindow) {
      this.mainWindow.webContents.send('parallel-stopped');
    }
    if (this.eventEmitter) {
      this.eventEmitter.emit('parallel-stopped');
    }
  }

  /**
   * Pausa todas as instâncias em execução
   */
  pauseAll() {
    for (const instance of this.instances) {
      if (instance.status === 'running' && typeof instance.pause === 'function') {
        try {
          instance.pause();
        } catch (error) {
          console.error(`Erro ao pausar instância ${instance.id}:`, error);
        }
      }
    }
    
    // Emitir evento de pausa
    if (this.eventEmitter) {
      this.eventEmitter.emit('parallel-paused');
    }
  }

  /**
   * Resume todas as instâncias pausadas
   */
  resumeAll() {
    for (const instance of this.instances) {
      if (instance.status === 'paused' && typeof instance.resume === 'function') {
        try {
          instance.resume();
        } catch (error) {
          console.error(`Erro ao resumir instância ${instance.id}:`, error);
        }
      }
    }
    
    // Emitir evento de resumo
    if (this.eventEmitter) {
      this.eventEmitter.emit('parallel-resumed');
    }
  }

  /**
   * Mostra modal de resultados no navegador
   */
  async showResultsModal(results) {
    console.log('📊 Exibindo modal de resultados...');
    
    // Encontrar uma instância ativa para mostrar o modal
    const activeInstance = this.instances.find(instance => {
      try {
        return instance.context && instance.page && instance.context.browser().isConnected();
      } catch (error) {
        return false;
      }
    });
    
    if (!activeInstance || !activeInstance.page) {
      console.log('⚠️ Nenhuma instância ativa encontrada para mostrar modal');
      return;
    }
    
    try {
      const modalHTML = this.generateResultsModalHTML(results);
      
      // Injetar modal na página
      await activeInstance.page.evaluate((html) => {
        // Remover modal existente se houver
        const existingModal = document.getElementById('pje-automation-results-modal');
        if (existingModal) {
          existingModal.remove();
        }
        
        // Criar e inserir novo modal
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = html;
        document.body.appendChild(modalContainer.firstElementChild);
      }, modalHTML);
      
      console.log('✅ Modal de resultados exibido com sucesso');
      
    } catch (error) {
      console.error('❌ Erro ao exibir modal de resultados:', error);
    }
  }
  
  /**
   * Gera HTML do modal de resultados
   */
  generateResultsModalHTML(results) {
    const sucessos = results.sucessos || 0;
    const erros = results.erros || 0;
    const total = results.servidoresProcessados || 0;
    const tempo = ((results.tempoTotal || 0) / 1000).toFixed(1);
    
    const successDetails = results.resultados?.filter(r => r.sucessos > 0) || [];
    const errorDetails = results.errosDetalhados || [];
    
    return `
      <div id="pje-automation-results-modal" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: Arial, sans-serif;
      ">
        <div style="
          background: white;
          border-radius: 12px;
          padding: 30px;
          max-width: 800px;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          position: relative;
        ">
          <button onclick="document.getElementById('pje-automation-results-modal').remove()" style="
            position: absolute;
            top: 15px;
            right: 20px;
            background: #dc3545;
            color: white;
            border: none;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
          ">×</button>
          
          <h2 style="color: #2c3e50; margin-bottom: 20px; text-align: center;">
            🎉 Processamento Paralelo Concluído!
          </h2>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
            <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; text-align: center;">
              <h3 style="color: #28a745; margin: 0 0 10px 0;">✅ Sucessos</h3>
              <div style="font-size: 24px; font-weight: bold; color: #28a745;">${sucessos}</div>
            </div>
            
            <div style="background: #ffeaea; padding: 20px; border-radius: 8px; text-align: center;">
              <h3 style="color: #dc3545; margin: 0 0 10px 0;">❌ Erros</h3>
              <div style="font-size: 24px; font-weight: bold; color: #dc3545;">${erros}</div>
            </div>
            
            <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; text-align: center;">
              <h3 style="color: #1976d2; margin: 0 0 10px 0;">📊 Total</h3>
              <div style="font-size: 24px; font-weight: bold; color: #1976d2;">${total}</div>
            </div>
            
            <div style="background: #fff3e0; padding: 20px; border-radius: 8px; text-align: center;">
              <h3 style="color: #f57c00; margin: 0 0 10px 0;">⏱️ Tempo</h3>
              <div style="font-size: 24px; font-weight: bold; color: #f57c00;">${tempo}s</div>
            </div>
          </div>
          
          ${successDetails.length > 0 ? `
            <div style="margin-bottom: 20px;">
              <h3 style="color: #28a745; margin-bottom: 15px;">✅ Servidores Processados com Sucesso:</h3>
              <div style="max-height: 200px; overflow-y: auto; background: #f8f9fa; padding: 15px; border-radius: 8px;">
                ${successDetails.map(s => `
                  <div style="margin-bottom: 10px; padding: 10px; background: white; border-radius: 6px; border-left: 4px solid #28a745;">
                    <strong>${s.servidor?.nome || 'Servidor'}</strong> - ${s.sucessos} OJ(s) vinculado(s) em ${(s.tempoProcessamento / 1000).toFixed(1)}s
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
          
          ${errorDetails.length > 0 ? `
            <div style="margin-bottom: 20px;">
              <h3 style="color: #dc3545; margin-bottom: 15px;">❌ Erros Encontrados:</h3>
              <div style="max-height: 200px; overflow-y: auto; background: #f8f9fa; padding: 15px; border-radius: 8px;">
                ${errorDetails.map(e => `
                  <div style="margin-bottom: 10px; padding: 10px; background: white; border-radius: 6px; border-left: 4px solid #dc3545;">
                    <strong>Erro:</strong> ${e.message || e.error || 'Erro desconhecido'}
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
          
          <div style="text-align: center; margin-top: 30px;">
            <button onclick="document.getElementById('pje-automation-results-modal').remove()" style="
              background: #8b7355;
              color: white;
              border: none;
              padding: 12px 30px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 16px;
              font-weight: bold;
            ">Fechar</button>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Limpa todas as instâncias e recursos
   */
  async cleanup(forceClose = false) {
    console.log('🧹 Limpando instâncias paralelas...');
    
    // Se configurado para manter navegador aberto e não forçar fechamento, manter uma instância
    if (this.keepBrowserOpen && !forceClose && this.instances.length > 0) {
      console.log('🔄 Mantendo uma instância do navegador aberta para visualização dos resultados...');
      
      // Manter apenas a primeira instância ativa
      const instanceToKeep = this.instances[0];
      
      // Fechar outras instâncias
      for (let i = 1; i < this.instances.length; i++) {
        const instance = this.instances[i];
        try {
          if (instance.context) {
            await instance.context.close();
          }
        } catch (error) {
          console.error(`Erro ao fechar instância ${instance.id}:`, error);
        }
      }
      
      // Manter apenas a instância principal
      this.instances = [instanceToKeep];
      
    } else {
      // Fechar todas as instâncias
      for (const instance of this.instances) {
        try {
          if (instance.context) {
            await instance.context.close();
          }
        } catch (error) {
          console.error(`Erro ao fechar instância ${instance.id}:`, error);
        }
      }
      
      this.instances = [];
    }
    
    this.isRunning = false;
    
    // Limpar diretórios temporários
    try {
      const tempDir = path.join(__dirname, '..', '..', 'temp');
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error('Erro ao limpar diretórios temporários:', error);
    }
    
    console.log('✅ Limpeza concluída');
  }

  /**
   * Retorna o status atual do processamento
   */
  getStatus() {
    // Use servidores length if available, otherwise use totalServers
    const totalServers = this.servidores?.length || this.totalServers || 0;
    
    // Calculate completed servers from instances if available
    const completedFromInstances = this.instances.reduce((total, instance) => {
      return total + (instance.results?.length || 0);
    }, 0);
    
    const completedServers = completedFromInstances || this.completedServers || 0;
    
    const overallProgress = totalServers > 0 ? (completedServers / totalServers) * 100 : 0;
    const elapsedTime = this.startTime ? Date.now() - this.startTime : 0;
    const speed = elapsedTime > 0 ? (completedServers / (elapsedTime / 1000)) : 0;
    const estimatedTime = speed > 0 ? ((totalServers - completedServers) / speed) : 0;
    
    return {
      isRunning: this.isRunning,
      totalServers,
      completedServers,
      overallProgress,
      speed: parseFloat(speed.toFixed(2)),
      elapsedTime: Math.floor(elapsedTime / 1000),
      estimatedTime: Math.floor(estimatedTime),
      instances: this.instances.map(instance => {
        const resultsCount = instance.results?.length || 0;
        const errorsCount = instance.errors?.length || 0;
        const totalProcessed = resultsCount + errorsCount;
        
        return {
          id: instance.id,
          busy: instance.busy || false,
          currentServer: instance.currentServer?.nome || instance.currentServer?.cpf || null,
          resultsCount,
          errorsCount,
          progress: totalProcessed > 0 ? (resultsCount / totalProcessed) * 100 : 0
        };
      }),
      progress: overallProgress
    };
  }
}

module.exports = ParallelServerManager;