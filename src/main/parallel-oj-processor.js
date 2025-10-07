/**
 * Processador Paralelo de Órgãos Julgadores (OJs)
 * Implementa estratégias de busca e processamento paralelo para otimizar performance
 */

const ContextualDelayManager = require('./contextual-delay-manager');
const UltraFastDelayManager = require('../utils/ultra-fast-delay-manager');
const SmartRetryManager = require('./smart-retry-manager');
const TimeoutManager = require('../utils/timeouts.js');
const { SmartOJCache } = require('../utils/smart-oj-cache.js');
const { vincularOJ, isVaraLimeira, aplicarTratamentoLimeira } = require('../vincularOJ.js');
const CejuscMapper = require('../utils/cejusc-mapper');

class ParallelOJProcessor {
  constructor(browser, timeoutManager, config, domCache = null) {
    this.browser = browser;
    this.timeoutManager = timeoutManager;
    this.config = config;
    this.delayManager = new ContextualDelayManager(timeoutManager);
    this.ultraFastDelayManager = new UltraFastDelayManager({ mode: 'ultra_fast', adaptive: true });
    this.retryManager = new SmartRetryManager(timeoutManager);
    this.domCache = domCache;
    this.ojCache = new Set();
    this.smartOJCache = new SmartOJCache();
    this.results = [];
    this.maxConcurrency = config?.speedMode === 'ULTRA' ? 8 : 5; // Mais instâncias em modo ULTRA
    this.batchSize = config?.speedMode === 'ULTRA' ? 15 : 10; // Lotes maiores em modo ULTRA
    this.activeTabs = new Map(); // Mapa de abas ativas
    this.originalPage = null; // Página principal para navegação
    this.cejuscMapper = new CejuscMapper(); // Mapeador de CEJUSC/CCP
  }

  /**
   * Define a página original para navegação
   */
  setOriginalPage(page) {
    this.originalPage = page;
  }

  /**
   * Processa OJs em paralelo com múltiplas janelas
   */
  async processOJsInParallel(orgaos) {
    console.log(`🚀 Iniciando processamento paralelo com múltiplas janelas de ${orgaos.length} OJs`);
    
    try {
      // Normalizar e filtrar OJs
      const ojsNormalizados = orgaos.map(orgao => ({
        original: orgao,
        normalized: this.normalizeOrgaoName(orgao)
      }));
      
      // Verificar OJs já cadastrados
      await this.loadExistingOJsParallel();
      
      // Filtrar OJs que precisam ser processados
      const ojsToProcess = ojsNormalizados.filter(oj => !this.ojCache.has(oj.normalized));
      
      console.log(`📊 ${ojsToProcess.length} OJs para processar, ${this.ojCache.size} já cadastrados`);
      
      if (ojsToProcess.length === 0) {
        console.log('✅ Todos os OJs já estão cadastrados');
        return this.results;
      }
      
      // Processar em lotes com múltiplas janelas
      const batches = this.createBatches(ojsToProcess, this.batchSize);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`🔄 Processando lote ${i + 1}/${batches.length} (${batch.length} OJs) com múltiplas janelas`);
        
        await this.processBatchWithMultipleTabs(batch);
        
        // Pausa entre lotes para não sobrecarregar o sistema
        if (i < batches.length - 1) {
          await this.ultraFastDelayManager.batchDelay({ priority: 'critical' });
        }
      }
      
      return this.results;
      
    } finally {
      // Fechar todas as abas extras
      await this.closeAllExtraTabs();
    }
  }

  /**
   * Carrega OJs existentes usando SmartOJCache para verificação inteligente
   */
  async loadExistingOJsParallel() {
    console.log('🔍 [PARALLEL] Carregando OJs existentes usando SmartOJCache...');
    
    try {
      // Usar SmartOJCache para carregar OJs vinculados da página
      const ojsVinculados = await this.smartOJCache.carregarOJsVinculadosDaPagina(this.originalPage);
      
      console.log(`🎯 [PARALLEL] SmartOJCache encontrou ${ojsVinculados.length} OJs já vinculados`);
      
      if (ojsVinculados.length > 0) {
        console.log(`📋 [PARALLEL] Primeiros 5 OJs vinculados: ${ojsVinculados.slice(0, 5).join(', ')}`);
        console.log('📋 [PARALLEL] TODOS os OJs vinculados encontrados:');
        ojsVinculados.forEach((oj, index) => {
          console.log(`   ${index + 1}. "${oj}"`);
        });
      } else {
        console.log('⚠️ [PARALLEL] NENHUM OJ vinculado encontrado na página!');
      }
      
      // Normalizar e adicionar ao cache local
      ojsVinculados.forEach(oj => {
        const ojNormalizado = this.normalizeOrgaoName(oj);
        this.ojCache.add(ojNormalizado);
      });
      
      console.log(`🎯 [PARALLEL] Cache local atualizado: ${this.ojCache.size} OJs já cadastrados`);
      
    } catch (error) {
      console.error('❌ [PARALLEL] Erro ao carregar OJs existentes:', error.message);
      // Fallback para estratégias antigas se SmartOJCache falhar
      await this.loadExistingOJsParallelFallback();
    }
  }

  /**
   * Fallback para carregamento de OJs usando estratégias antigas
   */
  async loadExistingOJsParallelFallback() {
    console.log('🔄 [PARALLEL] Usando fallback para carregamento de OJs...');
    
    const strategies = [
      this.loadFromTable.bind(this),
      this.loadFromMaterialTable.bind(this),
      this.loadFromDataTable.bind(this),
      this.loadFromAriaRows.bind(this)
    ];
    
    // Executar estratégias em paralelo
    const results = await Promise.allSettled(
      strategies.map(strategy => this.executeWithTimeout(strategy, 8000))
    );
    
    // Consolidar resultados
    const allOJs = new Set();
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        result.value.forEach(oj => allOJs.add(oj));
        console.log(`✅ [PARALLEL] Estratégia ${index + 1}: ${result.value.size} OJs encontrados`);
      } else {
        console.log(`⚠️ [PARALLEL] Estratégia ${index + 1} falhou: ${result.reason?.message || 'Timeout'}`);
      }
    });
    
    // Atualizar cache
    allOJs.forEach(oj => this.ojCache.add(oj));
    console.log(`🎯 [PARALLEL] Total de OJs já cadastrados (fallback): ${this.ojCache.size}`);
  }

  /**
   * Processa um lote de OJs com múltiplas abas do navegador
   */
  async processBatchWithMultipleTabs(batch) {
    const semaphore = new Semaphore(this.maxConcurrency);
    const batchTimeout = 300000; // 5 minutos por lote
    
    console.log(`🔄 Processando lote com ${batch.length} OJs usando múltiplas abas (timeout: ${batchTimeout/1000}s)`);
    
    const promises = batch.map(async (oj, index) => {
      console.log(`🔄 [LOTE] Aguardando semáforo para OJ ${index + 1}/${batch.length}: ${oj.original}`);
      await semaphore.acquire();
      console.log(`🚀 [LOTE] Iniciando processamento do OJ ${index + 1}/${batch.length}: ${oj.original}`);
      
      let newPage = null;
      try {
        // Criar nova aba para este OJ
        newPage = await this.createNewTab();
        
        // Timeout individual por OJ
        const result = await Promise.race([
          this.processOJWithRetryInNewTab(oj, newPage),
          new Promise((_, reject) => 
            setTimeout(() => {
              console.log(`⏰ [LOTE] Timeout de 60s atingido para OJ: ${oj.original}`);
              reject(new Error(`Timeout no OJ ${oj.original} após 60s`));
            }, 60000)
          )
        ]);
        
        console.log(`✅ [LOTE] OJ ${index + 1}/${batch.length} concluído: ${oj.original}`);
        return result;
        
      } catch (error) {
        console.log(`❌ [LOTE] Erro no OJ ${index + 1}/${batch.length} (${oj.original}): ${error.message}`);
        return {
          orgao: oj.original,
          status: 'Erro',
          erro: error.message,
          timestamp: new Date().toISOString()
        };
      } finally {
        // Fechar a aba específica
        if (newPage && !newPage.isClosed()) {
          try {
            await newPage.close();
            console.log(`🗂️ Aba fechada para OJ: ${oj.original}`);
          } catch (closeError) {
            console.log(`⚠️ Erro ao fechar aba: ${closeError.message}`);
          }
        }
        
        console.log(`🔓 [LOTE] Liberando semáforo para OJ: ${oj.original}`);
        semaphore.release();
      }
    });
    
    // Timeout para o lote inteiro
    const batchPromise = Promise.allSettled(promises);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Timeout no lote após ${batchTimeout/1000}s`)), batchTimeout)
    );
    
    let results;
    try {
      results = await Promise.race([batchPromise, timeoutPromise]);
    } catch (timeoutError) {
      console.log(`⏰ ${timeoutError.message} - forçando conclusão`);
      // Aguardar mais 10s para conclusões pendentes
      await this.ultraFastDelayManager.networkDelay({ priority: 'critical' });
      results = await Promise.allSettled(promises);
    }
    
    // Processar resultados
    let sucessos = 0;
    let erros = 0;
    
    results.forEach((result, index) => {
      const oj = batch[index];
      if (result.status === 'fulfilled' && result.value?.status !== 'Erro') {
        this.results.push(result.value);
        this.ojCache.add(oj.normalized);
        console.log(`✅ OJ processado: ${oj.original}`);
        sucessos++;
      } else {
        const errorMsg = result.status === 'rejected' ? result.reason?.message : result.value?.erro;
        console.error(`❌ Erro ao processar OJ ${oj.original}:`, errorMsg);
        this.results.push({
          orgao: oj.original,
          status: 'Erro',
          erro: errorMsg || 'Erro desconhecido',
          timestamp: new Date().toISOString()
        });
        erros++;
      }
    });
    
    console.log(`📊 Lote concluído: ${sucessos} sucessos, ${erros} erros`);
  }

  /**
   * Cria uma nova aba do navegador para processamento paralelo
   */
  async createNewTab() {
    if (!this.browser) {
      throw new Error('Navegador não disponível para criar nova aba');
    }
    
    const newPage = await this.browser.newPage();
    
    // Configurar a nova página similar ao original
    await newPage.setViewportSize({ width: 1366, height: 768 });
    
    // Navegar para a página de edição se temos a URL original
    if (this.originalPage && !this.originalPage.isClosed()) {
      const currentUrl = this.originalPage.url();
      if (currentUrl.includes('/pje/')) {
        await newPage.goto(currentUrl, { waitUntil: 'networkidle' });
      }
    }
    
    this.activeTabs.set(newPage, Date.now());
    console.log(`🆕 Nova aba criada. Total de abas ativas: ${this.activeTabs.size}`);
    
    return newPage;
  }

  /**
   * Fecha todas as abas extras criadas para processamento paralelo
   */
  async closeAllExtraTabs() {
    console.log(`🗂️ Fechando ${this.activeTabs.size} abas extras...`);
    
    for (const [page, createdAt] of this.activeTabs.entries()) {
      try {
        if (!page.isClosed()) {
          await page.close();
          console.log(`✅ Aba fechada (criada há ${Date.now() - createdAt}ms)`);
        }
      } catch (error) {
        console.log(`⚠️ Erro ao fechar aba: ${error.message}`);
      }
    }
    
    this.activeTabs.clear();
    console.log('✅ Todas as abas extras foram fechadas');
  }

  /**
   * Processa um OJ individual com retry inteligente usando nova aba
   */
  async processOJWithRetryInNewTab(oj, page, maxRetries = 2) {
    let lastError;
    const startTime = Date.now();
    
    console.log(`🎯 [RETRY-TAB] Iniciando processamento com retry para OJ: ${oj.original}`);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const attemptStartTime = Date.now();
      try {
        console.log(`🔄 [RETRY-TAB] Tentativa ${attempt}/${maxRetries} para OJ ${oj.original}`);
        
        // Verificar se já passou muito tempo
        const totalElapsed = Date.now() - startTime;
        if (totalElapsed > 45000) { // 45s limite por OJ
          console.log(`⏰ [RETRY-TAB] Timeout geral para OJ ${oj.original} após ${totalElapsed/1000}s`);
          throw new Error(`Timeout geral após ${totalElapsed/1000}s`);
        }
        
        console.log(`🚀 [RETRY-TAB] Chamando processOJInTab para ${oj.original}...`);
        const result = await this.processOJInTab(oj, page);
        
        const attemptDuration = Date.now() - attemptStartTime;
        const totalDuration = Date.now() - startTime;
        
        if (attempt > 1) {
          console.log(`✅ [RETRY-TAB] OJ ${oj.original} processado com sucesso na tentativa ${attempt} (tentativa: ${attemptDuration}ms, total: ${totalDuration}ms)`);
        } else {
          console.log(`✅ [RETRY-TAB] OJ ${oj.original} processado com sucesso na primeira tentativa (${attemptDuration}ms)`);
        }
        
        return result;
        
      } catch (error) {
        lastError = error;
        const attemptDuration = Date.now() - attemptStartTime;
        const totalElapsed = Date.now() - startTime;
        
        console.log(`⚠️ [RETRY-TAB] Tentativa ${attempt}/${maxRetries} falhou para OJ ${oj.original} após ${attemptDuration}ms: ${error.message}`);
        console.log(`📊 [RETRY-TAB] Tempo total decorrido: ${totalElapsed/1000}s`);
        
        // Se é erro crítico, não tentar novamente
        if (error.message.includes('closed') || 
            error.message.includes('Navigation') ||
            error.message.includes('Timeout geral') ||
            totalElapsed > 40000) {
          console.log(`🚫 [RETRY-TAB] Erro crítico detectado para ${oj.original}, parando tentativas`);
          break;
        }
        
        if (attempt < maxRetries) {
          // Backoff exponencial reduzido
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 3000); // Max 3s
          console.log(`⏳ [RETRY-TAB] Aguardando ${delay}ms antes da próxima tentativa para ${oj.original}...`);
          await this.delay(delay);
          
          // Tentar recuperação rápida na aba
          console.log(`🔄 [RETRY-TAB] Executando recuperação rápida para ${oj.original}...`);
          await this.quickRecoveryInTab(page);
          console.log(`✅ [RETRY-TAB] Recuperação rápida concluída para ${oj.original}`);
        }
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`❌ [RETRY-TAB] OJ ${oj.original} falhou definitivamente após ${duration}ms e ${maxRetries} tentativas`);
    throw lastError;
  }

  /**
   * Processa um OJ individual em uma aba específica (equivale ao sequencial)
   */
  async processOJInTab(oj, page) {
    const startTime = Date.now();
    
    try {
      // Verificar se página ainda está ativa
      if (page && page.isClosed()) {
        throw new Error('Página fechada antes do processamento');
      }
      
      console.log(`⚡ Processando OJ ${oj.original} em aba específica...`);
      
      // Verificar se é vara de Limeira e aplicar tratamento específico
      if (isVaraLimeira(oj.original)) {
        console.log(`🔧 Aplicando tratamento específico para vara de Limeira: ${oj.original}`);
        const resultadoLimeira = await aplicarTratamentoLimeira(page, oj.original, this.config.nome);
        
        if (resultadoLimeira.sucesso) {
          console.log(`✅ Tratamento Limeira bem-sucedido para ${oj.original}`);
          return {
            orgao: oj.original,
            status: 'Vinculado com Sucesso (Limeira)',
            erro: null,
            perfil: this.config.perfil,
            cpf: this.config.cpf,
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
            metodo: 'limeira_especifico'
          };
        } else {
          console.log(`⚠️ Tratamento Limeira falhou, usando método padrão para ${oj.original}`);
        }
      }
      
      // Usar o método padrão do vincularOJ.js (igual ao sequencial)
      await vincularOJ(page, oj.original, this.config.perfil || 'Servidor', 'Público');
      
      const duration = Date.now() - startTime;
      
      // Registrar performance para timeouts adaptativos
      TimeoutManager.registrarPerformance('vincularOJ', startTime, true);
      
      console.log(`📊 OJ ${oj.original} processado em ${duration}ms`);
      
      return {
        orgao: oj.original,
        status: 'Vinculado com Sucesso',
        erro: null,
        perfil: this.config.perfil || 'Servidor',
        cpf: this.config.cpf,
        timestamp: new Date().toISOString(),
        duration
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      TimeoutManager.registrarPerformance('vincularOJ', startTime, false);
      
      console.log(`❌ Erro no processamento do OJ ${oj.original} após ${duration}ms: ${error.message}`);
      
      throw error;
    }
  }

  /**
   * Processamento otimizado de OJ individual
   */
  async processOJOptimized(oj) {
    const startTime = Date.now();
    
    try {
      // Verificar se página ainda está ativa
      if (this.page && this.page.isClosed()) {
        throw new Error('Página fechada antes do processamento');
      }
      
      // Timeout ULTRA-OTIMIZADO para máxima velocidade
      const baseTimeout = TimeoutManager.obterTimeout('pje', 'vincularOJ');
      const timeout = Math.min(baseTimeout, 10000); // Máximo 10s (reduzido de 25s)
      
      console.log(`⚡ Iniciando processamento otimizado do OJ ${oj.original} (timeout: ${timeout/1000}s)`);
      
      // Executar ações em sequência otimizada com logs detalhados
      await this.executeWithTimeout(async () => {
        console.log(`🔄 [${oj.original}] Etapa 1/5: Clicando no botão adicionar...`);
        await this.clickAddLocationButtonOptimized();
        
        console.log(`🔄 [${oj.original}] Etapa 2/5: Selecionando órgão julgador...`);
        await this.selectOrgaoJulgadorOptimized(oj.original);
        
        console.log(`🔄 [${oj.original}] Etapa 3/5: Configurando papel e visibilidade...`);
        await this.configurePapelVisibilidadeOptimized();
        
        console.log(`🔄 [${oj.original}] Etapa 4/5: Salvando configuração...`);
        await this.saveConfigurationOptimized();
        
        console.log(`🔄 [${oj.original}] Etapa 5/5: Verificando sucesso...`);
        await this.verifySuccessOptimized();
        
        console.log(`✅ [${oj.original}] Todas as etapas concluídas com sucesso`);
      }, timeout);
      
      const duration = Date.now() - startTime;
      
      // Registrar performance para timeouts adaptativos
      TimeoutManager.registrarPerformance('vincularOJ', startTime, true);
      
      console.log(`📊 OJ ${oj.original} processado em ${duration}ms`);
      
      return {
        orgao: oj.original,
        status: 'Vinculado com Sucesso',
        erro: null,
        perfil: this.config.perfil,
        cpf: this.config.cpf,
        timestamp: new Date().toISOString(),
        duration
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      TimeoutManager.registrarPerformance('vincularOJ', startTime, false);
      
      console.log(`❌ Erro no processamento otimizado do OJ ${oj.original} após ${duration}ms: ${error.message}`);
      
      // Tentar limpeza rápida em caso de erro
      try {
        if (this.page && !this.page.isClosed()) {
          await this.page.evaluate(() => {
            // Fechar qualquer modal aberto
            const modals = document.querySelectorAll('mat-dialog-container, .cdk-overlay-container');
            modals.forEach(modal => {
              const closeBtn = modal.querySelector('[mat-dialog-close], .mat-dialog-close, .close');
              if (closeBtn) closeBtn.click();
            });
          });
        }
      } catch (cleanupError) {
        console.log(`⚠️ Erro na limpeza: ${cleanupError.message}`);
      }
      
      throw error;
    }
  }

  // === ESTRATÉGIAS DE CARREGAMENTO DE OJs ===
  
  async loadFromTable() {
    const ojs = new Set();
    try {
      const rows = await this.page.$$('table tbody tr');
      for (const row of rows.slice(0, 20)) { // Limitar para performance
        const text = await row.textContent();
        this.extractOJsFromText(text, ojs);
      }
    } catch (error) {
      console.log('⚠️ Erro ao carregar da tabela padrão:', error.message);
    }
    return ojs;
  }
  
  async loadFromMaterialTable() {
    const ojs = new Set();
    try {
      const rows = await this.page.$$('.mat-table .mat-row');
      for (const row of rows.slice(0, 20)) {
        const text = await row.textContent();
        this.extractOJsFromText(text, ojs);
      }
    } catch (error) {
      console.log('⚠️ Erro ao carregar da tabela Material:', error.message);
    }
    return ojs;
  }
  
  async loadFromDataTable() {
    const ojs = new Set();
    try {
      const rows = await this.page.$$('.datatable tbody tr');
      for (const row of rows.slice(0, 20)) {
        const text = await row.textContent();
        this.extractOJsFromText(text, ojs);
      }
    } catch (error) {
      console.log('⚠️ Erro ao carregar da DataTable:', error.message);
    }
    return ojs;
  }
  
  async loadFromAriaRows() {
    const ojs = new Set();
    try {
      const rows = await this.page.$$('[role="row"]');
      for (const row of rows.slice(0, 20)) {
        const text = await row.textContent();
        this.extractOJsFromText(text, ojs);
      }
    } catch (error) {
      console.log('⚠️ Erro ao carregar das ARIA rows:', error.message);
    }
    return ojs;
  }

  // === AÇÕES OTIMIZADAS ===
  
  async clickAddLocationButtonOptimized() {
    console.log('🎯 ASSERTIVO: Verificando se modal já está aberto...');
    
    // 1. PRIMEIRO: Verificar se o modal já está aberto
    const modalJaAberto = await this.page.locator('mat-dialog-container, [role="dialog"]').isVisible();
    if (modalJaAberto) {
      console.log('✅ Modal já está aberto - PULANDO clique no botão');
      return;
    }
    
    console.log('🎯 Modal fechado - clicando botão Adicionar UMA VEZ...');
    
    // 2. SEGUNDO: Clicar UMA ÚNICA VEZ no botão mais específico
    const seletorEspecifico = 'button:has-text("Adicionar Localização/Visibilidade"):not([disabled])';
    
    try {
      // Aguardar elemento específico aparecer
      await this.page.waitForSelector(seletorEspecifico, { timeout: 3000 });
      
      // Clicar UMA vez apenas usando retry manager
      await this.retryManager.retryClick(
        async (selector) => {
          const element = await this.page.$(selector);
          if (element) {
            await element.click();
          } else {
            throw new Error('Element not found');
          }
        },
        seletorEspecifico
      );
      console.log('✅ CLIQUE ÚNICO realizado no botão Adicionar');
      
      // 3. TERCEIRO: Aguardar modal abrir de forma assertiva
      console.log('🎯 Aguardando modal abrir...');
      await this.page.waitForSelector('mat-dialog-container, [role="dialog"]', { timeout: 5000 });
      console.log('✅ Modal CONFIRMADO aberto');
      
      return;
      
    } catch (error) {
      console.log(`❌ Falha no clique assertivo: ${error.message}`);
      throw new Error(`Botão Adicionar não encontrado: ${error.message}`);
    }
  }
  
  async clickAddLocationButtonOptimizedFallback() {
    // Verificar se a página foi fechada
    if (this.page.isClosed()) {
      throw new Error('Página foi fechada antes de clicar no botão Adicionar');
    }
    
    console.log('🔄 Procurando botão "Adicionar Localização/Visibilidade"...');
    
    // Aguardar estabilização da página
    await this.delayManager.smartDelay('pageStabilization', { priority: 'medium' });
    
    const selectors = [
      'button:has-text("Adicionar Localização/Visibilidade"):not([disabled])',
      'button:has-text("Adicionar Localização"):not([disabled])',
      'button:has-text("Adicionar"):not([disabled]):visible',
      '.btn-adicionar:not([disabled])',
      '[data-action="add"]:not([disabled])',
      '.mat-button:has-text("Adicionar"):not([disabled])',
      'button[title*="Adicionar"]:not([disabled])',
      'input[value*="Adicionar"]:not([disabled])',
      // Seletores mais específicos para o PJE
      'button.btn.btn-primary:has-text("Adicionar"):not([disabled])',
      'button.mat-raised-button:has-text("Adicionar"):not([disabled])',
      'button[type="button"]:has-text("Adicionar"):not([disabled])',
      // Seletores por posição e contexto
      'fieldset:has-text("Órgãos Julgadores") button:has-text("Adicionar"):not([disabled])',
      'div:has-text("Órgãos Julgadores") button:has-text("Adicionar"):not([disabled])',
      // Seletores alternativos
      'button:contains("Adicionar"):not([disabled])',
      '[role="button"]:has-text("Adicionar"):not([disabled])'
    ];
    
    let addButton = null;
    
    for (const selector of selectors) {
      try {
        // Verificar se a página ainda está aberta
        if (this.page.isClosed()) {
          throw new Error('Página foi fechada durante a busca do botão');
        }
        
        console.log(`🔍 Testando seletor: ${selector}`);
        
        const element = await this.retryManager.retryElementSearch(
          async (sel) => {
            // Verificar novamente se a página está aberta
            if (this.page.isClosed()) {
              throw new Error('Página fechada durante waitForSelector');
            }
            return await this.page.waitForSelector(sel, { 
              timeout: TimeoutManager.obterTimeout('interacao', 'aguardarElemento'),
              state: 'visible'
            });
          },
          selector
        );
        
        if (element && await element.isVisible()) {
          addButton = element;
          console.log(`✅ Botão encontrado: ${selector}`);
          break;
        }
      } catch (error) {
        console.log(`❌ Seletor ${selector} falhou: ${error.message}`);
        continue;
      }
    }
    
    if (!addButton) {
      console.log('🔍 Botão não encontrado com seletores padrão, tentando estratégias de fallback...');
      
      // Estratégia de fallback 1: Buscar por qualquer botão com texto "Adicionar"
      try {
        const fallbackButtons = await this.page.$$('button');
        for (const button of fallbackButtons) {
          const text = await button.textContent();
          const isVisible = await button.isVisible();
          const isEnabled = await button.isEnabled();
          
          if (text && text.toLowerCase().includes('adicionar') && isVisible && isEnabled) {
            console.log(`✅ Botão encontrado via fallback: "${text}"`);
            addButton = button;
            break;
          }
        }
      } catch (fallbackError) {
        console.log(`❌ Fallback 1 falhou: ${fallbackError.message}`);
      }
      
      // Estratégia de fallback 2: Buscar por inputs com value "Adicionar"
      if (!addButton) {
        try {
          const fallbackInputs = await this.page.$$('input[type="button"], input[type="submit"]');
          for (const input of fallbackInputs) {
            const value = await input.getAttribute('value');
            const isVisible = await input.isVisible();
            const isEnabled = await input.isEnabled();
            
            if (value && value.toLowerCase().includes('adicionar') && isVisible && isEnabled) {
              console.log(`✅ Input encontrado via fallback: "${value}"`);
              addButton = input;
              break;
            }
          }
        } catch (fallbackError) {
          console.log(`❌ Fallback 2 falhou: ${fallbackError.message}`);
        }
      }
      
      if (!addButton) {
        // Debug: listar todos os botões visíveis
        try {
          console.log('🔍 DEBUG: Listando todos os botões visíveis na página...');
          const allButtons = await this.page.$$('button:visible, input[type="button"]:visible, input[type="submit"]:visible');
          for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
            try {
              const text = await allButtons[i].textContent() || await allButtons[i].getAttribute('value');
              const classes = await allButtons[i].getAttribute('class');
              console.log(`  Botão ${i + 1}: "${text}" [${classes}]`);
            } catch (e) {
              console.log(`  Botão ${i + 1}: Erro ao obter informações`);
            }
          }
        } catch (debugError) {
          console.log(`⚠️ Erro no debug: ${debugError.message}`);
        }
        
        throw new Error('Botão "Adicionar Localização/Visibilidade" não encontrado após todas as tentativas');
      }
    }
    
    // Verificar se a página ainda está aberta antes de clicar
    if (this.page.isClosed()) {
      throw new Error('Página foi fechada antes do clique no botão');
    }
    
    console.log('🖱️ Tentando clicar no botão Adicionar...');
    
    // Múltiplas estratégias de clique
    const clickStrategies = [
      {
        name: 'click normal',
        action: async () => {
          await addButton.click({ timeout: 8000 });
        }
      },
      {
        name: 'click com force',
        action: async () => {
          await addButton.click({ force: true, timeout: 8000 });
        }
      },
      {
        name: 'click após scroll',
        action: async () => {
          await addButton.scrollIntoViewIfNeeded();
          await this.delayManager.smartDelay('scroll', { priority: 'low' });
          await addButton.click({ timeout: 8000 });
        }
      },
      {
        name: 'click via JavaScript',
        action: async () => {
          await addButton.evaluate(button => button.click());
        }
      }
    ];
    
    let clickSuccessful = false;
    let lastError = null;
    
    for (const strategy of clickStrategies) {
      try {
        // Verificar se a página ainda está aberta
        if (this.page.isClosed()) {
          throw new Error('Página foi fechada antes da estratégia de clique');
        }
        
        console.log(`🔄 Tentando: ${strategy.name}...`);
        await strategy.action();
        clickSuccessful = true;
        console.log(`✅ ${strategy.name} bem-sucedido!`);
        break;
      } catch (clickError) {
        console.log(`❌ ${strategy.name} falhou: ${clickError.message}`);
        lastError = clickError;
        
        // Aguardar um pouco antes da próxima tentativa
        await this.delayManager.smartDelay('retryClick', { priority: 'low' });
      }
    }
    
    if (!clickSuccessful) {
      throw new Error(`Falha ao clicar no botão Adicionar: ${lastError?.message}`);
    }
    
    // Aguardar modal/formulário carregar
    await this.delayManager.smartDelay('modalLoad', { priority: 'medium' });
    console.log('✅ Botão Adicionar clicado com sucesso');
  }
  
  async selectOrgaoJulgadorOptimized(orgao) {
    // Validação de tipo para evitar erros
    let orgaoTexto;
    if (typeof orgao === 'string') {
      orgaoTexto = orgao;
    } else if (orgao && typeof orgao === 'object' && orgao.nome) {
      orgaoTexto = orgao.nome;
    } else {
      orgaoTexto = String(orgao || '');
    }
    
    console.log(`🎯 ASSERTIVO: Seleção direta de OJ: ${orgaoTexto}`);
    
    try {
      // Verificar se a página foi fechada
      if (this.page.isClosed()) {
        throw new Error('Página foi fechada antes de selecionar o Órgão Julgador');
      }
      
      // 1. DIRETO: Encontrar e clicar no mat-select de Órgão Julgador
      console.log('🎯 Procurando mat-select de Órgão Julgador...');
      
      // Seletores expandidos para maior compatibilidade (copiado da versão sequencial)
      const matSelectSelectors = [
        'mat-dialog-container mat-select[placeholder="Órgão Julgador"]',
        'mat-dialog-container mat-select[placeholder="Orgao Julgador"]',
        '[role="dialog"] mat-select[placeholder="Órgão Julgador"]',
        'mat-dialog-container mat-select[name="idOrgaoJulgadorSelecionado"]',
        'mat-dialog-container mat-select[placeholder*="Órgão"]',
        '[role="dialog"] mat-select[placeholder*="Órgão"]',
        'mat-dialog-container mat-select',
        '[role="dialog"] mat-select'
      ];
      
      let matSelectElement = null;
      for (const selector of matSelectSelectors) {
        try {
          console.log(`🔍 Testando seletor: ${selector}`);
          await this.page.waitForSelector(selector, { timeout: 2000 });
          matSelectElement = selector;
          console.log(`✅ Mat-select encontrado: ${selector}`);
          break;
        } catch (e) {
          console.log(`❌ Seletor falhou: ${selector}`);
        }
      }
      
      if (!matSelectElement) {
        throw new Error('Mat-select de Órgão Julgador não encontrado no modal');
      }
      
      // Verificar se a página ainda está aberta antes de clicar
      if (this.page.isClosed()) {
        throw new Error('Página foi fechada antes de clicar no mat-select');
      }
      
      // Clicar no mat-select usando retry manager
      await this.retryManager.retryClick(
        async (selector) => {
          const element = await this.page.$(selector);
          if (element) {
            await element.click();
          } else {
            throw new Error('Element not found');
          }
        },
        matSelectElement
      );
      console.log('✅ Mat-select de OJ clicado');
      
      // 2. AGUARDAR: Opções aparecerem
      console.log('🎯 Aguardando opções do dropdown...');
      await this.page.waitForSelector('mat-option', { timeout: 3000 });
      
      // Verificar se a página ainda está aberta
      if (this.page.isClosed()) {
        throw new Error('Página foi fechada após aguardar opções');
      }
      
      // 3. SELECIONAR: Buscar opção exata
      console.log(`🎯 Procurando opção: ${orgao}`);
      const opcoes = this.page.locator('mat-option');
      const numOpcoes = await opcoes.count();
      
      console.log(`📋 ${numOpcoes} opções disponíveis`);
      
      let opcaoEncontrada = false;
      for (let i = 0; i < numOpcoes; i++) {
        // Verificar se a página ainda está aberta a cada iteração
        if (this.page.isClosed()) {
          throw new Error('Página foi fechada durante busca de opções');
        }
        
        const textoOpcao = await opcoes.nth(i).textContent();
        if (textoOpcao && textoOpcao.includes(orgao)) {
          await opcoes.nth(i).click();
          console.log(`✅ OJ selecionado: ${textoOpcao.trim()}`);
          opcaoEncontrada = true;
          break;
        }
      }
      
      if (!opcaoEncontrada) {
        throw new Error(`OJ "${orgao}" não encontrado nas opções disponíveis`);
      }
      
      // 4. AGUARDAR: Processamento da seleção com delay contextual
      await this.ultraFastDelayManager.formFillDelay({ priority: 'critical' }); // Otimizado
      console.log('✅ Seleção de OJ concluída');
      
    } catch (error) {
      console.error(`❌ Erro na seleção assertiva de OJ: ${error.message}`);
      throw error;
    }
  }
  
  async configurePapelVisibilidadeOptimized() {
    // Verificar se a página foi fechada
    if (this.page.isClosed()) {
      throw new Error('Página foi fechada antes de configurar papel e visibilidade');
    }
    
    console.log('🔧 Configurando papel e visibilidade...');
    
    try {
      // Aguardar modal carregar
      await this.ultraFastDelayManager.pageLoadDelay({ priority: 'critical' });
      
      // 1. CONFIGURAR PAPEL - USAR O PERFIL CONFIGURADO
      const papelConfigurado = this.config.perfil || 'Servidor'; // Usar o perfil do config ou 'Servidor' como fallback
      console.log(`📋 Configurando papel: ${papelConfigurado}`);
      if (this.config.perfil) {
        console.log(`✅ Usando perfil configurado: ${this.config.perfil}`);
      } else {
        console.log(`⚠️ Perfil não configurado, usando fallback: Servidor`);
      }
      const seletoresPapel = [
        'mat-dialog-container mat-select[placeholder*="Papel"]',
        'mat-dialog-container mat-select[formcontrolname*="papel"]',
        'mat-dialog-container mat-select[aria-label*="Papel"]',
        'mat-select[placeholder*="Papel"]',
        'mat-select:has-text("Papel")',
        '.mat-select-trigger:has-text("Papel")',
        // Seletores adicionais da versão sequencial
        'mat-select[formcontrolname="papel"]',
        'mat-select[ng-reflect-name="papel"]',
        'select[name="papel"]',
        `mat-select:has(mat-option:has-text("${papelConfigurado}"))`,
        '[placeholder*="Papel"]',
        'mat-select[aria-label*="papel"]',
        'mat-select[placeholder*="papel" i]',
        '.mat-select:has(.mat-select-placeholder:contains("Papel"))',
        '.mat-form-field:has(mat-label:contains("Papel")) mat-select'
      ];
      
      let matSelectPapel = null;
      let tentativasPapel = 0;
      const maxTentativasPapel = 3;
      
      while (!matSelectPapel && tentativasPapel < maxTentativasPapel) {
        tentativasPapel++;
        console.log(`🔄 Tentativa ${tentativasPapel} de encontrar campo de papel...`);
        
        for (const seletor of seletoresPapel) {
          try {
            if (this.page.isClosed()) {
              throw new Error('Página fechada durante busca do papel');
            }
            
            const elemento = await this.page.waitForSelector(seletor, { timeout: 3000 });
            if (elemento && await elemento.isVisible() && await elemento.isEnabled()) {
              matSelectPapel = elemento;
              console.log(`✅ Campo Papel encontrado: ${seletor}`);
              break;
            }
          } catch (error) {
            console.log(`⚠️ Seletor papel não encontrado: ${seletor}`);
          }
        }
        
        if (!matSelectPapel) {
          console.log(`⚠️ Tentativa ${tentativasPapel} falhou, aguardando antes da próxima...`);
          await this.delayManager.smartDelay('retryPapel', { priority: 'medium' });
        }
      }
      
      if (matSelectPapel) {
        // Clicar no mat-select usando retry manager
        await this.retryManager.retryClick(
          async () => {
            await matSelectPapel.click();
          },
          'campo de papel'
        );
        await this.ultraFastDelayManager.elementWaitDelay({ priority: 'critical' });
        
        // Procurar opção do papel configurado com múltiplas estratégias
        const opcoesPapel = this.page.locator('mat-option');
        const totalOpcoes = await opcoesPapel.count();
        console.log(`📋 ${totalOpcoes} opções de papel disponíveis`);
        
        let perfilSelecionado = false;
        
        // Estratégia 1: Busca exata pelo papel configurado
        for (let i = 0; i < totalOpcoes; i++) {
          if (this.page.isClosed()) {
            throw new Error('Página fechada durante seleção do papel');
          }
          
          const opcao = opcoesPapel.nth(i);
          const texto = await opcao.textContent();
          
          if (texto && texto.trim().toLowerCase() === papelConfigurado.toLowerCase()) {
            await opcao.click();
            console.log(`✅ Papel selecionado (busca exata): ${texto.trim()}`);
            perfilSelecionado = true;
            break;
          }
        }
        
        // Estratégia 2: Busca por inclusão do papel configurado
        if (!perfilSelecionado) {
          for (let i = 0; i < totalOpcoes; i++) {
            const opcao = opcoesPapel.nth(i);
            const texto = await opcao.textContent();
            
            if (texto && texto.toLowerCase().includes(papelConfigurado.toLowerCase())) {
              await opcao.click();
              console.log(`✅ Papel selecionado (busca por inclusão): ${texto.trim()}`);
              perfilSelecionado = true;
              break;
            }
          }
        }
        
        // Estratégia 3: APENAS SERVIDOR (SEGURANÇA CRÍTICA)
        if (!perfilSelecionado) {
          // BUSCAR APENAS POR 'SERVIDOR' - NUNCA ADMINISTRADOR OU OUTROS
          for (let i = 0; i < totalOpcoes; i++) {
            const opcao = opcoesPapel.nth(i);
            const texto = await opcao.textContent();
            if (texto && texto.trim().toLowerCase().includes('servidor')) {
              await opcao.click();
              console.log(`🔒 SEGURANÇA: Papel SERVIDOR selecionado: ${texto.trim()}`);
              perfilSelecionado = true;
              break;
            }
          }
        }
        
        // Estratégia 4: BLOQUEAR se não encontrar SERVIDOR
        if (!perfilSelecionado) {
          console.log('🚨 ERRO CRÍTICO: Papel \'Servidor\' não encontrado! Listando opções disponíveis:');
          for (let i = 0; i < totalOpcoes; i++) {
            const opcao = opcoesPapel.nth(i);
            const texto = await opcao.textContent();
            console.log(`   - Opção ${i + 1}: "${texto?.trim()}"`);
          }
          throw new Error('SEGURANÇA: Papel \'Servidor\' não encontrado. Processo interrompido para evitar seleção de papel inadequado.');
        }
      } else {
        console.log('⚠️ Campo Papel não encontrado após múltiplas tentativas');
      }
      
      await this.ultraFastDelayManager.elementWaitDelay({ priority: 'critical' });
      
      // 2. VERIFICAR VISIBILIDADE ATUAL ANTES DE CLICAR (OTIMIZAÇÃO)
      console.log('🔍 Verificando estado atual da visibilidade...');
      const visibilidadeAtual = await this.verificarVisibilidadeAtual();
      
      if (visibilidadeAtual === 'TODOS' || visibilidadeAtual === 'Público') {
        console.log(`✅ Visibilidade já está correta: ${visibilidadeAtual}. Pulando configuração desnecessária.`);
      } else {
        console.log(`🎯 Configurando visibilidade de '${visibilidadeAtual}' para 'Público'...`);
        await this.configurarVisibilidade('Público');
      }
      
      await this.ultraFastDelayManager.elementWaitDelay({ priority: 'critical' });
      console.log('✅ Configuração de papel e visibilidade concluída');
      
    } catch (error) {
      throw new Error(`Erro ao configurar papel/visibilidade: ${error.message}`);
    }
  }
  
  async verificarVisibilidadeAtual() {
    const seletoresVisibilidade = [
      '#mat-dialog-2 mat-select[placeholder="Localização"]',
      'pje-modal-localizacao-visibilidade mat-select[placeholder="Localização"]',
      '#mat-select-44',
      'mat-select[aria-labelledby*="mat-form-field-label-99"]',
      'mat-select[id="mat-select-44"]',
      'mat-dialog-container mat-select[placeholder="Localização"]',
      '[role="dialog"] mat-select[placeholder="Localização"]',
      '.mat-dialog-container mat-select[placeholder="Localização"]',
      '.campo-localizacao mat-select',
      'mat-select[placeholder="Localização"]',
      '.mat-form-field.campo-localizacao mat-select',
      'mat-select[placeholder*="Visibilidade"]',
      'mat-select[placeholder*="Localização"]'
    ];
    
    try {
      for (const seletor of seletoresVisibilidade) {
        try {
          const elemento = await this.page.locator(seletor).first();
          if (await elemento.isVisible({ timeout: 1000 })) {
            const textoAtual = await elemento.textContent();
            if (textoAtual && textoAtual.trim()) {
              console.log(`🔍 Visibilidade atual detectada: "${textoAtual.trim()}"`);
              return textoAtual.trim();
            }
          }
        } catch (e) {
          // Continua para próximo seletor
        }
      }
      console.log('⚠️ Não foi possível detectar visibilidade atual');
      return 'DESCONHECIDO';
    } catch (error) {
      console.log(`❌ Erro ao verificar visibilidade atual: ${error.message}`);
      return 'ERRO';
    }
  }

  async configurarVisibilidade(visibilidade) {
    console.log(`DEBUG: Iniciando configuração da visibilidade: ${visibilidade}`);
    
    // Aguardar um pouco para garantir que a modal carregou
    await this.ultraFastDelayManager.elementWaitDelay({ priority: 'critical' });
    
    // Timeout geral para evitar loop infinito
    const startTime = Date.now();
    const maxTimeout = 30000; // 30 segundos
    
    const seletoresVisibilidade = [
      // Seletores específicos para modal de Localização/Visibilidade
      '#mat-dialog-2 mat-select[placeholder="Localização"]',
      'pje-modal-localizacao-visibilidade mat-select[placeholder="Localização"]',
      '#mat-select-44',
      'mat-select[aria-labelledby*="mat-form-field-label-99"]',
      'mat-select[id="mat-select-44"]',
      // Seletores genéricos mais amplos
      'mat-dialog-container mat-select[placeholder="Localização"]',
      '[role="dialog"] mat-select[placeholder="Localização"]',
      '.mat-dialog-container mat-select[placeholder="Localização"]',
      '.campo-localizacao mat-select',
      'mat-select[placeholder="Localização"]',
      '.mat-form-field.campo-localizacao mat-select',
      'mat-select[placeholder*="Visibilidade"]',
      'mat-select[placeholder*="Localização"]',
      'select[name*="visibilidade"]',
      'select[name*="localizacao"]',
      'label:has-text("Visibilidade") + * mat-select',
      'label:has-text("Localização") + * mat-select',
      'label:has-text("Visibilidade") ~ * mat-select',
      'label:has-text("Localização") ~ * mat-select',
      '.mat-form-field:has(label:has-text("Visibilidade")) mat-select',
      '.mat-form-field:has(label:has-text("Localização")) mat-select'
    ];
    
    for (const seletor of seletoresVisibilidade) {
      // Verificar timeout
      if (Date.now() - startTime > maxTimeout) {
        console.log(`DEBUG: Timeout atingido (${maxTimeout}ms), interrompendo configuração de visibilidade`);
        break;
      }
      
      try {
        console.log(`DEBUG: Tentando configurar visibilidade com seletor: ${seletor}`);
        
        // Verificar se o elemento existe antes de tentar clicar
        const elemento = await this.page.$(seletor);
        if (!elemento) {
          console.log(`DEBUG: Elemento não encontrado para seletor: ${seletor}`);
          continue;
        }
        
        console.log('DEBUG: Elemento encontrado, tentando clicar...');
        
        // Verificar se é um mat-select
        if (seletor.includes('mat-select')) {
          // Tentar diferentes estratégias de clique
          try {
            // Estratégia 1: Clique direto
            await this.page.click(seletor, { force: true });
            console.log('DEBUG: Clique direto realizado');
          } catch (e1) {
            try {
              // Estratégia 2: Clique no trigger
              await this.page.click(`${seletor} .mat-select-trigger`, { force: true });
              console.log('DEBUG: Clique no trigger realizado');
            } catch (e2) {
              console.log(`DEBUG: Falha ao clicar no mat-select: ${e2.message}`);
              continue;
            }
          }
        } else {
          // Para selects normais
          await this.page.click(seletor);
        }
        
        // Aguardar as opções aparecerem
        await this.ultraFastDelayManager.clickDelay({ priority: 'critical' });
        
        // Buscar pelas opções
        const opcoes = await this.page.$$('mat-option');
        console.log(`DEBUG: ${opcoes.length} opções encontradas`);
        
        if (opcoes.length === 0) {
          console.log('DEBUG: Nenhuma opção encontrada, tentando próximo seletor');
          continue;
        }
        
        // Procurar pela opção desejada
        let opcaoEncontrada = false;
        for (const opcao of opcoes) {
          try {
            const texto = await opcao.textContent();
            console.log(`DEBUG: Verificando opção: "${texto}"`);
            
            if (texto && texto.trim().toLowerCase().includes(visibilidade.toLowerCase())) {
              console.log(`DEBUG: Opção encontrada: "${texto}", clicando...`);
              await opcao.click();
              opcaoEncontrada = true;
              break;
            }
          } catch (e) {
            console.log(`DEBUG: Erro ao verificar opção: ${e.message}`);
            continue;
          }
        }
        
        if (opcaoEncontrada) {
          console.log(`DEBUG: Visibilidade configurada com sucesso: ${visibilidade}`);
          return true;
        } else {
          console.log(`DEBUG: Opção "${visibilidade}" não encontrada, tentando próximo seletor`);
        }
        
      } catch (error) {
        console.log(`DEBUG: Erro ao tentar seletor ${seletor}: ${error.message}`);
        continue;
      }
    }
    
    console.log(`DEBUG: Não foi possível configurar a visibilidade: ${visibilidade}`);
    return false;
  }

  async saveConfigurationOptimized() {
    console.log('🎯 ASSERTIVO: Salvamento direto...');
    
    try {
      if (this.page.isClosed()) {
        throw new Error('Página fechada durante salvamento');
      }
      
      // Usar a mesma estratégia da versão sequencial
      const seletoresBotaoGravar = [
        // PRIMEIRO: Botão específico para peritos (PRIORIDADE MÁXIMA)
        'mat-dialog-container button:has-text("Vincular Órgão Julgador ao Perito")',
        '[role="dialog"] button:has-text("Vincular Órgão Julgador ao Perito")',
        '.mat-dialog-container button:has-text("Vincular Órgão Julgador ao Perito")',
        
        // SEGUNDO: Botões de vincular genéricos
        'mat-dialog-container button:has-text("Vincular")',
        '[role="dialog"] button:has-text("Vincular")',
        
        // TERCEIRO: Botões de gravar/salvar para servidores  
        'mat-dialog-container button:has-text("Gravar")',
        '[role="dialog"] button:has-text("Gravar")',
        '.mat-dialog-container button:has-text("Gravar")',
        'mat-dialog-container button:has-text("Salvar")',
        '[role="dialog"] button:has-text("Salvar")',
        'mat-dialog-container button:has-text("Confirmar")',
        
        // Fallbacks globais (última opção)
        'button:has-text("Vincular Órgão Julgador ao Perito")',
        'button:has-text("Vincular")',
        'button:has-text("Gravar")',
        'button:has-text("Salvar")',
        'button:has-text("Confirmar")',
        'input[type="submit"]',
        'input[type="button"][value*="Gravar"]',
        'input[type="button"][value*="Salvar"]'
      ];
      
      let botaoEncontrado = false;
      for (const seletor of seletoresBotaoGravar) {
        try {
          console.log(`🔍 Testando botão: ${seletor}`);
          const botao = this.page.locator(seletor);
          if (await botao.count() > 0 && await botao.first().isVisible({ timeout: 2000 })) {
            console.log(`✅ Botão encontrado: ${seletor}`);
            await botao.first().click({ force: true });
            botaoEncontrado = true;
            console.log('✅ Clique no botão Gravar realizado');
            break;
          } else {
            console.log(`❌ Botão ${seletor} não visível ou não encontrado`);
          }
        } catch (e) {
          console.log(`❌ Seletor ${seletor} falhou: ${e.message}`);
        }
      }
      
      if (!botaoEncontrado) {
        // Tentar buscar por role no modal
        try {
          console.log('🔍 Tentando buscar botão por role no modal...');
          const botaoRole = this.page.getByRole('button', { name: /Gravar|Salvar|Confirmar|Vincular/i });
          if (await botaoRole.count() > 0 && await botaoRole.first().isVisible({ timeout: 2000 })) {
            await botaoRole.first().click({ force: true });
            botaoEncontrado = true;
            console.log('✅ Botão encontrado por role e clicado');
          }
        } catch (e) {
          console.log('❌ Busca por role também falhou:', e.message);
        }
      }
      
      if (!botaoEncontrado) {
        // Debug: listar botões no modal com seletores otimizados (CORRIGIDO: strict mode violation)
        try {
          console.log('🔍 DEBUG: Listando botões no modal com seletores otimizados...');
          
          // Seletores específicos para evitar violação de strict mode (505 elementos)
          const seletoresOtimizados = [
            'mat-dialog-container .mat-dialog-actions button',
            '[role="dialog"][aria-modal="true"] button[type="submit"]',
            'mat-dialog-container button:has-text("Gravar")',
            'mat-dialog-container button:has-text("Salvar")',
            'mat-dialog-container button:has-text("Confirmar")'
          ];
          
          let totalBotoes = 0;
          for (const seletor of seletoresOtimizados) {
            try {
              const botoesModal = await this.page.locator(seletor).all();
              if (botoesModal.length > 0 && botoesModal.length < 20) { // Evitar seletores que retornam muitos elementos
                console.log(`📋 Seletor "${seletor}": ${botoesModal.length} botões encontrados`);
                
                for (let i = 0; i < Math.min(botoesModal.length, 5); i++) { // Limitar a 5 botões por seletor
                  try {
                    const texto = await botoesModal[i].textContent();
                    const isVisible = await botoesModal[i].isVisible();
                    console.log(`  Botão ${totalBotoes + i + 1}: "${texto}" (visível: ${isVisible})`);
                  } catch (e) {
                    console.log(`  Botão ${totalBotoes + i + 1}: Erro ao obter informações`);
                  }
                }
                totalBotoes += botoesModal.length;
                
                // Se encontrou botões válidos, parar busca
                if (botoesModal.length > 0) break;
              }
            } catch (e) {
              console.log(`⚠️ Seletor "${seletor}" falhou: ${e.message}`);
            }
          }
          
          console.log(`✅ Total de botões encontrados: ${totalBotoes} (otimizado)`);
        } catch (debugError) {
          console.log(`⚠️ Erro no debug de botões otimizado: ${debugError.message}`);
        }
        
        throw new Error('Botão Gravar/Salvar não encontrado no modal');
      }
      
      // 🎯 TIMING MELHORADO: Aguardar processamento completo após clique no Gravar
      console.log('⏳ Aguardando processamento completo da vinculação após clique no Gravar...');
      
      // Aguardar tempo inicial para o PJe processar a ação
      await this.page.waitForTimeout(1500); // Reduzido de 2500ms para 1500ms para acelerar próximo OJ
      
      // Verificar se o modal foi fechado (indicativo de sucesso)
      const modalStillOpen = await this.page.locator('mat-dialog-container').isVisible({ timeout: 1000 });
      
      if (modalStillOpen) {
        console.log('⚠️ Modal ainda aberto, aguardando mais tempo...');
        // Aguardar mais tempo se modal ainda estiver aberto
        await this.page.waitForTimeout(1000); // Reduzido de 1500ms para 1000ms
      } else {
        console.log('✅ Modal fechado - processamento bem-sucedido');
      }
      
      // Verificar se apareceu modal de confirmação
      try {
        const modalConfirmacao = await this.page.locator('text=/certeza.*vincular.*Órgão Julgador.*Perito/i').first().isVisible({ timeout: 3000 });
        if (modalConfirmacao) {
          console.log('✓ Modal de confirmação detectado, clicando em "Sim"...');
          
          // Procurar botão "Sim"
          const seletoresSim = [
            'button:has-text("Sim")',
            'button:has-text("OK")',
            'button:has-text("Confirmar")',
            'button[class*="confirm"]',
            '.btn-success:has-text("Sim")',
            '.btn-primary:has-text("Sim")'
          ];
          
          let simClicado = false;
          for (const seletor of seletoresSim) {
            try {
              const botaoSim = this.page.locator(seletor);
              if (await botaoSim.first().isVisible({ timeout: 2000 })) {
                await botaoSim.first().click({ force: true });
                simClicado = true;
                console.log('✓ Confirmação realizada');
                break;
              }
            } catch (e) {
              continue;
            }
          }
          
          if (!simClicado) {
            console.log('⚠️ Botão Sim não encontrado no modal de confirmação');
          }
        }
      } catch (error) {
        console.log('Modal de confirmação não detectado ou erro:', error.message);
      }
      
      // 🔄 TIMING BALANCEADO: Aguardar estabilização adequada antes do próximo OJ
      console.log('🔄 Aguardando estabilização para próximo OJ...');
      await this.page.waitForTimeout(1500); // Aumentado para 1500ms para dar tempo adequado ao PJe
      
      console.log('✅ Salvamento confirmado - sistema pronto para próximo OJ');
      
    } catch (error) {
      console.log(`⚠️ Erro no salvamento: ${error.message}`);
      throw error;
    }
  }
  
  async verifySuccessOptimized() {
    const timeout = TimeoutManager.obterTimeout('pje', 'aguardarProcessamento');
    
    try {
      // Aguardar indicadores de sucesso
      const successSelectors = [
        '.success-message',
        '.alert-success',
        '.mat-snack-bar-container',
        '[role="alert"]:has-text("sucesso")',
        '.notification-success'
      ];
      
      const successPromise = Promise.race(
        successSelectors.map(selector => 
          this.page.waitForSelector(selector, { timeout })
        )
      );
      
      await successPromise;
      await this.delayManager.smartDelay('verification', { priority: 'medium' });
      
    } catch (error) {
      // Se não encontrar mensagem de sucesso, verificar se não há erro
      const errorSelectors = [
        '.error-message',
        '.alert-danger',
        '.mat-error',
        '[role="alert"]:has-text("erro")'
      ];
      
      for (const selector of errorSelectors) {
        const errorElement = await this.page.$(selector);
        if (errorElement && await errorElement.isVisible()) {
          const errorText = await errorElement.textContent();
          throw new Error(`Erro na operação: ${errorText}`);
        }
      }
      
      // Se não há erro visível, assumir sucesso
      console.log('⚠️ Mensagem de sucesso não encontrada, mas sem erros detectados');
    }
  }

  // === UTILITÁRIOS ===
  
  extractOJsFromText(text, ojSet) {
    if (!text) return;
    
    const patterns = [
      /EXE\d+/gi,
      /LIQ\d+/gi,
      /CON\d+/gi,
      /DIVEX/gi,
      /[\dº]+ª?\s*Vara\s+do\s+Trabalho/gi
    ];
    
    patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const normalized = this.normalizeOrgaoName(match.trim());
          ojSet.add(normalized);
        });
      }
    });
  }
  
  normalizeOrgaoName(orgao) {
    // Validação de tipo para evitar erros
    let orgaoTexto;
    if (typeof orgao === 'string') {
      orgaoTexto = orgao;
    } else if (orgao && typeof orgao === 'object' && orgao.nome) {
      orgaoTexto = orgao.nome;
    } else if (orgao && typeof orgao === 'object' && orgao.oj) {
      // Se for um objeto com propriedade oj, usar essa propriedade
      orgaoTexto = orgao.oj;
    } else if (orgao && typeof orgao === 'object' && orgao.textoCompleto) {
      // Se for um objeto com propriedade textoCompleto, usar essa propriedade
      orgaoTexto = orgao.textoCompleto;
    } else {
      orgaoTexto = String(orgao || '');
    }
    
    return orgaoTexto
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .replace(/[^A-Z0-9\s]/g, '');
  }
  
  createBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }
  
  async executeWithTimeout(fn, timeout) {
    return new Promise((resolve, reject) => {
      let completed = false;
      const startTime = Date.now();
      
      const timer = setTimeout(() => {
        if (!completed) {
          completed = true;
          const elapsed = Date.now() - startTime;
          console.log(`⏰ Timeout de ${timeout}ms atingido após ${elapsed}ms - operação cancelada`);
          reject(new Error(`Operação excedeu timeout de ${timeout}ms`));
        }
      }, timeout);
      
      fn().then(result => {
        if (!completed) {
          completed = true;
          clearTimeout(timer);
          const elapsed = Date.now() - startTime;
          console.log(`✅ Operação concluída em ${elapsed}ms (timeout: ${timeout}ms)`);
          resolve(result);
        }
      }).catch(error => {
        if (!completed) {
          completed = true;
          clearTimeout(timer);
          const elapsed = Date.now() - startTime;
          console.log(`❌ Operação falhou após ${elapsed}ms: ${error.message}`);
          reject(error);
        }
      });
    });
  }
  
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async quickRecoveryInTab(page) {
    try {
      if (page && !page.isClosed()) {
        console.log('🔄 Iniciando recuperação rápida na aba...');
        
        // Fechar qualquer modal aberto
        await page.evaluate(() => {
          const modals = document.querySelectorAll('mat-dialog-container, .cdk-overlay-container, .modal-backdrop');
          modals.forEach(modal => {
            const closeBtn = modal.querySelector('[mat-dialog-close], .mat-dialog-close, .close, .btn-close');
            if (closeBtn) {
              closeBtn.click();
            }
          });
          
          // Limpar qualquer overlay ou backdrop
          const overlays = document.querySelectorAll('.cdk-overlay-backdrop, .mat-dialog-backdrop, .modal-backdrop');
          overlays.forEach(overlay => overlay.remove());
        });
        
        // Pressionar ESC para fechar modais
        await page.keyboard.press('Escape');
        
        // Aguardar um pouco para a página se estabilizar
        await this.ultraFastDelayManager.criticalDelay({ priority: 'critical' });
        
        // Verificar se ainda há elementos de loading com timeout reduzido
        await page.waitForFunction(
          () => {
            const loadingElements = document.querySelectorAll('.loading, .spinner, [class*="loading"]');
            return loadingElements.length === 0;
          },
          { timeout: 1500 }
        ).catch(() => {
          console.log('⚠️ Elementos de loading ainda presentes após recovery na aba');
        });
        
        console.log('✅ Recuperação rápida na aba concluída');
      }
    } catch (error) {
      console.log(`⚠️ Erro durante quick recovery na aba: ${error.message}`);
    }
  }

  // Manter compatibilidade com quick recovery original
  async quickRecovery() {
    if (this.originalPage) {
      return await this.quickRecoveryInTab(this.originalPage);
    }
  }
  
  // Métodos de seleção de OJ (mantidos para compatibilidade)
  async selectByValue(orgao) {
    // Para mat-select do Angular Material
    try {
      // Aguardar mat-select ficar habilitado
      await this.waitForMatSelectEnabled();
      
      // Primeiro clicar no mat-select para abrir
      await this.page.click('mat-select');
      await this.ultraFastDelayManager.elementWaitDelay({ priority: 'critical' });
      
      // Procurar pela opção com o valor
      const option = this.page.locator(`mat-option:has-text("${orgao}")`);
      await option.click();
    } catch (error) {
      throw new Error(`Erro ao selecionar por valor: ${error.message}`);
    }
  }
  
  async selectByText(orgao) {
    // Para mat-select do Angular Material
    try {
      // Aguardar mat-select ficar habilitado
      await this.waitForMatSelectEnabled();
      
      // Primeiro clicar no mat-select para abrir
      const matSelect = this.page.locator('mat-select').first();
      await matSelect.click();
      await this.ultraFastDelayManager.elementWaitDelay({ priority: 'critical' });
      
      // Procurar pela opção com o texto exato
      const option = this.page.locator(`mat-option:has-text("${orgao}")`);
      await option.click();
    } catch (error) {
      throw new Error(`Erro ao selecionar por texto: ${error.message}`);
    }
  }
  
  async selectByPartialMatch(orgao) {
    try {
      // Aguardar mat-select ficar habilitado
      await this.waitForMatSelectEnabled();
      
      // Primeiro clicar no mat-select para abrir
      const matSelect = this.page.locator('mat-select').first();
      await matSelect.click();
      await this.ultraFastDelayManager.elementWaitDelay({ priority: 'critical' });
      
      // Procurar por todas as opções
      const options = await this.page.locator('mat-option').all();
      for (const option of options) {
        const text = await option.textContent();
        if (text && text.includes(orgao)) {
          await option.click();
          return;
        }
      }
      throw new Error('Opção não encontrada');
    } catch (error) {
      throw new Error(`Erro ao selecionar por correspondência parcial: ${error.message}`);
    }
  }
  
  async waitForMatSelectEnabled() {
    console.log('🔄 Aguardando mat-select ficar habilitado...');
    
    try {
      // Aguardar até 15 segundos para o mat-select ficar habilitado
      await this.page.waitForFunction(
        () => {
          const matSelect = document.querySelector('mat-select');
          if (!matSelect) return false;
          
          // Verificações mais rigorosas compatíveis com Playwright
          const isAriaDisabled = matSelect.getAttribute('aria-disabled') === 'true';
          const isDisabledAttr = matSelect.hasAttribute('disabled');
          const isVisible = matSelect.offsetParent !== null;
          const computedStyle = window.getComputedStyle(matSelect);
          const isDisplayed = computedStyle.display !== 'none';
          const isVisibilityHidden = computedStyle.visibility === 'hidden';
          const isPointerEventsNone = computedStyle.pointerEvents === 'none';
          const tabIndex = matSelect.getAttribute('tabindex');
          const isTabIndexNegative = tabIndex && parseInt(tabIndex) < 0;
          
          // Verificar se o elemento está realmente interativo
          const isInteractive = !isAriaDisabled && 
                               !isDisabledAttr && 
                               isVisible && 
                               isDisplayed && 
                               !isVisibilityHidden && 
                               !isPointerEventsNone && 
                               !isTabIndexNegative;
          
          console.log('Mat-select estado detalhado:', {
            ariaDisabled: isAriaDisabled,
            disabledAttr: isDisabledAttr,
            visible: isVisible,
            displayed: isDisplayed,
            visibilityHidden: isVisibilityHidden,
            pointerEvents: computedStyle.pointerEvents,
            tabIndex,
            isInteractive,
            id: matSelect.id,
            classes: matSelect.className
          });
          
          return isInteractive;
        },
        { timeout: 15000 }
      );
      
      console.log('✅ Mat-select está habilitado e pronto para interação');
      
      // Aguardar um pouco mais para garantir estabilidade
      await this.ultraFastDelayManager.elementWaitDelay({ priority: 'critical' });
      
    } catch (error) {
      console.log('⚠️ Timeout aguardando mat-select ficar habilitado, verificando estado atual...');
      
      // Verificar estado atual do mat-select
      const currentState = await this.page.evaluate(() => {
        const matSelect = document.querySelector('mat-select');
        if (!matSelect) return { found: false };
        
        const computedStyle = window.getComputedStyle(matSelect);
        return {
          found: true,
          ariaDisabled: matSelect.getAttribute('aria-disabled'),
          disabled: matSelect.hasAttribute('disabled'),
          display: computedStyle.display,
          visibility: computedStyle.visibility,
          pointerEvents: computedStyle.pointerEvents,
          tabIndex: matSelect.getAttribute('tabindex'),
          classes: matSelect.className
        };
      });
      
      console.log('Estado atual do mat-select:', currentState);
      
      // Aguardar um pouco mais e tentar prosseguir
      await this.ultraFastDelayManager.pageLoadDelay({ priority: 'critical' });
    }
  }
}

/**
 * Semáforo para controle de concorrência
 */
class Semaphore {
  constructor(maxConcurrency) {
    this.maxConcurrency = maxConcurrency;
    this.currentConcurrency = 0;
    this.queue = [];
  }
  
  async acquire() {
    return new Promise((resolve) => {
      if (this.currentConcurrency < this.maxConcurrency) {
        this.currentConcurrency++;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }
  
  release() {
    this.currentConcurrency--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      this.currentConcurrency++;
      next();
    }
  }
}

module.exports = ParallelOJProcessor;