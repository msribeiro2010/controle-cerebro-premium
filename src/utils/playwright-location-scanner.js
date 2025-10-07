/**
 * Scanner de Localizações/Visibilidades usando Playwright
 * 
 * Este módulo implementa um sistema inteligente para percorrer listas de
 * localizações/visibilidades de servidores, pulando automaticamente
 * entradas já existentes usando verificação dupla.
 */

const { chromium } = require('playwright');
const Logger = require('./Logger');

class PlaywrightLocationScanner {
  constructor(options = {}) {
    this.logger = new Logger('PlaywrightLocationScanner');
    this.browser = null;
    this.page = null;
    this.context = null;
        
    // Configurações
    this.config = {
      headless: options.headless !== false, // Default: true
      timeout: options.timeout || 30000,
      retryAttempts: options.retryAttempts || 3,
      delayBetweenActions: options.delayBetweenActions || 1000,
      viewport: options.viewport || { width: 1280, height: 720 },
      userAgent: options.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    };
        
    // Estatísticas
    this.stats = {
      totalLocations: 0,
      processedLocations: 0,
      skippedLocations: 0,
      errorLocations: 0,
      startTime: null,
      endTime: null,
      averageProcessingTime: 0
    };
        
    // Cache de localizações processadas
    this.processedCache = new Set();
        
    // Callbacks para eventos
    this.callbacks = {
      onLocationFound: options.onLocationFound || null,
      onLocationSkipped: options.onLocationSkipped || null,
      onLocationError: options.onLocationError || null,
      onProgress: options.onProgress || null
    };
  }
    
  /**
     * Inicializa o navegador Playwright
     */
  async initialize() {
    try {
      this.logger.info('Inicializando navegador Playwright...');
            
      this.browser = await chromium.launch({
        headless: this.config.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });
            
      this.context = await this.browser.newContext({
        viewport: this.config.viewport,
        userAgent: this.config.userAgent,
        ignoreHTTPSErrors: true
      });
            
      this.page = await this.context.newPage();
            
      // Configurar timeouts
      this.page.setDefaultTimeout(this.config.timeout);
      this.page.setDefaultNavigationTimeout(this.config.timeout);
            
      // Interceptar console logs para debugging
      this.page.on('console', msg => {
        if (msg.type() === 'error') {
          this.logger.warn(`Console Error: ${msg.text()}`);
        }
      });
            
      this.logger.info('Navegador Playwright inicializado com sucesso');
      return true;
            
    } catch (error) {
      this.logger.error('Erro ao inicializar navegador:', error);
      throw error;
    }
  }
    
  /**
     * Navega para uma URL específica
     */
  async navigateToUrl(url) {
    try {
      this.logger.info(`Navegando para: ${url}`);
            
      await this.page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeout
      });
            
      // Aguardar carregamento completo
      await this.page.waitForLoadState('networkidle', { timeout: 10000 });
            
      return true;
            
    } catch (error) {
      this.logger.error(`Erro ao navegar para ${url}:`, error);
      throw error;
    }
  }
    
  /**
     * Escaneia localizações em uma página
     */
  async scanLocationsOnPage(selectors = {}) {
    try {
      const defaultSelectors = {
        locationList: 'select[name*="localiza"], select[name*="visibilidade"], .location-select',
        locationOptions: 'option',
        locationText: 'option',
        skipButton: '.skip-btn, .pular-btn, [data-action="skip"]'
      };
            
      const finalSelectors = { ...defaultSelectors, ...selectors };
            
      this.logger.info('Iniciando escaneamento de localizações...');
            
      // Aguardar elemento de lista aparecer
      await this.page.waitForSelector(finalSelectors.locationList, { timeout: 15000 });
            
      // Obter todas as opções de localização
      const locations = await this.page.evaluate((selectors) => {
        const selectElement = document.querySelector(selectors.locationList);
        if (!selectElement) return [];
                
        const options = Array.from(selectElement.querySelectorAll(selectors.locationOptions));
        return options.map((option, index) => ({
          value: option.value,
          text: option.textContent.trim(),
          index,
          selected: option.selected
        })).filter(loc => loc.value && loc.text && loc.text !== 'Selecione...');
      }, finalSelectors);
            
      this.logger.info(`Encontradas ${locations.length} localizações`);
      this.stats.totalLocations = locations.length;
            
      return locations;
            
    } catch (error) {
      this.logger.error('Erro ao escanear localizações:', error);
      throw error;
    }
  }
    
  /**
     * Processa uma localização específica
     */
  async processLocation(location, skipChecker = null) {
    const startTime = Date.now();
        
    try {
      this.logger.info(`Processando localização: ${location.text} (${location.value})`);
            
      // Verificar se deve pular esta localização
      if (skipChecker && typeof skipChecker === 'function') {
        const shouldSkip = await skipChecker(location, this.page);
                
        if (shouldSkip.skip) {
          this.logger.info(`Pulando localização: ${location.text} - Motivo: ${shouldSkip.reason}`);
          this.stats.skippedLocations++;
                    
          if (this.callbacks.onLocationSkipped) {
            await this.callbacks.onLocationSkipped(location, shouldSkip.reason);
          }
                    
          return {
            success: true,
            skipped: true,
            reason: shouldSkip.reason,
            processingTime: Date.now() - startTime
          };
        }
      }
            
      // Selecionar a localização
      await this.page.selectOption('select[name*="localiza"], select[name*="visibilidade"]', location.value);
            
      // Aguardar um pouco para a página processar
      await this.page.waitForTimeout(this.config.delayBetweenActions);
            
      // Verificar se a seleção foi bem-sucedida
      const selectedValue = await this.page.evaluate(() => {
        const select = document.querySelector('select[name*="localiza"], select[name*="visibilidade"]');
        return select ? select.value : null;
      });
            
      if (selectedValue === location.value) {
        this.logger.info(`Localização processada com sucesso: ${location.text}`);
        this.stats.processedLocations++;
                
        // Adicionar ao cache
        this.processedCache.add(location.value);
                
        if (this.callbacks.onLocationFound) {
          await this.callbacks.onLocationFound(location, this.page);
        }
                
        return {
          success: true,
          skipped: false,
          location,
          processingTime: Date.now() - startTime
        };
      } else {
        throw new Error(`Falha ao selecionar localização: esperado ${location.value}, obtido ${selectedValue}`);
      }
            
    } catch (error) {
      this.logger.error(`Erro ao processar localização ${location.text}:`, error);
      this.stats.errorLocations++;
            
      if (this.callbacks.onLocationError) {
        await this.callbacks.onLocationError(location, error);
      }
            
      return {
        success: false,
        skipped: false,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }
    
  /**
     * Executa o escaneamento completo
     */
  async scanAllLocations(url, options = {}) {
    this.stats.startTime = Date.now();
        
    try {
      // Inicializar se necessário
      if (!this.browser) {
        await this.initialize();
      }
            
      // Navegar para a URL
      await this.navigateToUrl(url);
            
      // Escanear localizações
      const locations = await this.scanLocationsOnPage(options.selectors);
            
      const results = [];
      const processingTimes = [];
            
      // Processar cada localização
      for (let i = 0; i < locations.length; i++) {
        const location = locations[i];
                
        // Callback de progresso
        if (this.callbacks.onProgress) {
          await this.callbacks.onProgress({
            current: i + 1,
            total: locations.length,
            location,
            stats: { ...this.stats }
          });
        }
                
        const result = await this.processLocation(location, options.skipChecker);
        results.push(result);
                
        if (result.processingTime) {
          processingTimes.push(result.processingTime);
        }
                
        // Delay entre processamentos
        if (i < locations.length - 1) {
          await this.page.waitForTimeout(this.config.delayBetweenActions);
        }
      }
            
      // Calcular estatísticas finais
      this.stats.endTime = Date.now();
      this.stats.averageProcessingTime = processingTimes.length > 0 
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length 
        : 0;
            
      this.logger.info('Escaneamento completo finalizado');
            
      return {
        success: true,
        locations,
        results,
        stats: { ...this.stats }
      };
            
    } catch (error) {
      this.logger.error('Erro durante escaneamento completo:', error);
      this.stats.endTime = Date.now();
            
      return {
        success: false,
        error: error.message,
        stats: { ...this.stats }
      };
    }
  }
    
  /**
     * Gera relatório de estatísticas
     */
  generateReport() {
    const totalTime = this.stats.endTime - this.stats.startTime;
    const successRate = this.stats.totalLocations > 0 
      ? ((this.stats.processedLocations / this.stats.totalLocations) * 100).toFixed(2)
      : 0;
        
    return {
      summary: {
        totalLocations: this.stats.totalLocations,
        processedLocations: this.stats.processedLocations,
        skippedLocations: this.stats.skippedLocations,
        errorLocations: this.stats.errorLocations,
        successRate: `${successRate}%`,
        totalTime: `${(totalTime / 1000).toFixed(2)}s`,
        averageProcessingTime: `${this.stats.averageProcessingTime.toFixed(0)}ms`
      },
      efficiency: {
        locationsPerSecond: totalTime > 0 ? ((this.stats.totalLocations / totalTime) * 1000).toFixed(2) : 0,
        skipEfficiency: this.stats.totalLocations > 0 
          ? `${((this.stats.skippedLocations / this.stats.totalLocations) * 100).toFixed(2)}%`
          : '0%',
        errorRate: this.stats.totalLocations > 0 
          ? `${((this.stats.errorLocations / this.stats.totalLocations) * 100).toFixed(2)}%`
          : '0%'
      },
      cache: {
        processedCacheSize: this.processedCache.size,
        cacheHitRate: 'N/A' // Será implementado com integração do cache manager
      }
    };
  }
    
  /**
     * Limpa recursos e fecha o navegador
     */
  async cleanup() {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
            
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
            
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
            
      this.logger.info('Recursos do Playwright limpos com sucesso');
            
    } catch (error) {
      this.logger.error('Erro ao limpar recursos:', error);
    }
  }
    
  /**
     * Verifica se uma localização já foi processada
     */
  isLocationProcessed(locationValue) {
    return this.processedCache.has(locationValue);
  }
    
  /**
     * Adiciona uma localização ao cache de processadas
     */
  markLocationAsProcessed(locationValue) {
    this.processedCache.add(locationValue);
  }
    
  /**
     * Limpa o cache de localizações processadas
     */
  clearProcessedCache() {
    this.processedCache.clear();
    this.logger.info('Cache de localizações processadas limpo');
  }
}

module.exports = PlaywrightLocationScanner;