/**
 * Sistema de Pulo Inteligente para Localizações
 * 
 * Este módulo integra o scanner Playwright com o sistema de verificação dupla
 * para pular automaticamente localizações já processadas.
 */

const PlaywrightLocationScanner = require('./playwright-location-scanner');
const LocationCacheManager = require('./location-cache-manager');
const { VerificacaoDuplaOJ } = require('./verificacao-dupla-oj');
const { SmartOJCache } = require('./smart-oj-cache');
const Logger = require('./Logger');

class SmartLocationSkipper {
  constructor(options = {}) {
    this.logger = new Logger('SmartLocationSkipper');
        
    // Componentes principais
    this.scanner = new PlaywrightLocationScanner({
      headless: options.headless !== false,
      timeout: options.timeout || 30000,
      delayBetweenActions: options.delayBetweenActions || 1000,
      onLocationFound: this.onLocationFound.bind(this),
      onLocationSkipped: this.onLocationSkipped.bind(this),
      onLocationError: this.onLocationError.bind(this),
      onProgress: this.onProgress.bind(this)
    });
        
    this.cacheManager = new LocationCacheManager({
      cacheDir: options.cacheDir,
      autoSave: options.autoSave !== false
    });
        
    this.verificacaoDupla = new VerificacaoDuplaOJ();
    this.smartOJCache = new SmartOJCache();
        
    // Configurações
    this.config = {
      enableDoubleVerification: options.enableDoubleVerification !== false,
      enableLocationCache: options.enableLocationCache !== false,
      enableOJCache: options.enableOJCache !== false,
      skipThreshold: options.skipThreshold || 0.8, // 80% de confiança para pular
      maxRetries: options.maxRetries || 3,
      progressCallback: options.progressCallback || null
    };
        
    // Estatísticas integradas
    this.stats = {
      totalLocations: 0,
      processedLocations: 0,
      skippedByCache: 0,
      skippedByOJ: 0,
      skippedByDoubleVerification: 0,
      errorLocations: 0,
      startTime: null,
      endTime: null,
      verificationStats: {
        cacheHits: 0,
        directVerifications: 0,
        inconsistencies: 0
      }
    };
        
    // Callbacks personalizados
    this.callbacks = {
      onLocationProcessed: options.onLocationProcessed || null,
      onLocationSkipped: options.onLocationSkipped || null,
      onError: options.onError || null,
      onComplete: options.onComplete || null
    };
  }
    
  /**
     * Inicializa todos os componentes
     */
  async initialize() {
    try {
      this.logger.info('Inicializando sistema de pulo inteligente...');
            
      // Inicializar componentes
      await this.scanner.initialize();
      await this.cacheManager.initialize();
            
      this.logger.info('Sistema de pulo inteligente inicializado com sucesso');
      return true;
            
    } catch (error) {
      this.logger.error('Erro ao inicializar sistema de pulo inteligente:', error);
      throw error;
    }
  }
    
  /**
     * Função de verificação inteligente para pular localizações
     */
  async createSkipChecker(serverUrl) {
    return async (location, page) => {
      try {
        // Log detalhado para CEJUSCs
        const isCejusc = location.text.toLowerCase().includes('cejusc');
        if (isCejusc) {
          this.logger.info(`🏛️ [CEJUSC DEBUG] Verificando: "${location.text}" (value: ${location.value})`);
        }
                
        // 1. Verificar cache de localizações
        if (this.config.enableLocationCache) {
          const isProcessed = this.cacheManager.isLocationProcessed(
            serverUrl, 
            location.value, 
            location.text
          );
                    
          if (isProcessed) {
            if (isCejusc) {
              this.logger.info(`🏛️ [CEJUSC DEBUG] Cache de localização encontrado: ${location.text} -> PULAR`);
            }
            this.stats.skippedByCache++;
            return {
              skip: true,
              reason: 'Localização já processada (cache)',
              method: 'location-cache',
              confidence: 1.0
            };
          }
        }
                
        // 2. Verificar cache de OJs
        if (this.config.enableOJCache) {
          const ojKey = this.generateOJKey(location);
          const isOJVinculado = await this.smartOJCache.isOJVinculado(ojKey);
                    
          if (isOJVinculado.vinculado) {
            if (isCejusc) {
              this.logger.info(`🏛️ [CEJUSC DEBUG] Cache de OJ detectou correspondência: ${location.text} -> PULAR`);
              this.logger.info(`🏛️ [CEJUSC DEBUG] Motivo: ${isOJVinculado.metodo}`);
              this.logger.info(`🏛️ [CEJUSC DEBUG] Confiabilidade: ${isOJVinculado.confiabilidade}`);
            }
            this.stats.skippedByOJ++;
            return {
              skip: true,
              reason: `OJ já vinculado (${isOJVinculado.metodo})`,
              method: 'oj-cache',
              confidence: isOJVinculado.confiabilidade
            };
          }
        }
                
        // 3. Verificação dupla de OJs
        if (this.config.enableDoubleVerification) {
          const verificacao = await this.verificacaoDupla.verificarOJDupla(
            page,
            { value: location.value, text: location.text },
            this.smartOJCache
          );
                    
          // Atualizar estatísticas de verificação
          this.stats.verificationStats.cacheHits += verificacao.metodo === 'cache' ? 1 : 0;
          this.stats.verificationStats.directVerifications += verificacao.metodo === 'direto' ? 1 : 0;
                    
          if (verificacao.vinculado && verificacao.confiabilidade >= this.config.skipThreshold) {
            if (isCejusc) {
              this.logger.info(`🏛️ [CEJUSC DEBUG] Verificação dupla detectou vinculação: ${location.text} -> PULAR`);
              this.logger.info(`🏛️ [CEJUSC DEBUG] Motivo: ${verificacao.metodo}`);
              this.logger.info(`🏛️ [CEJUSC DEBUG] Confiabilidade: ${verificacao.confiabilidade}`);
              this.logger.info(`🏛️ [CEJUSC DEBUG] Detalhes: ${JSON.stringify(verificacao.detalhes || {})}`);
            }
            this.stats.skippedByDoubleVerification++;
            return {
              skip: true,
              reason: `OJ vinculado detectado (${verificacao.metodo})`,
              method: 'double-verification',
              confidence: verificacao.confiabilidade
            };
          }
        }
                
        // Não pular - processar localização
        if (isCejusc) {
          this.logger.info(`🏛️ [CEJUSC DEBUG] Todas as verificações passaram: ${location.text} -> PROCESSAR`);
        }
        return {
          skip: false,
          reason: 'Localização não processada anteriormente',
          method: 'new-location',
          confidence: 1.0
        };
                
      } catch (error) {
        this.logger.error(`Erro na verificação de pulo para ${location.text}:`, error);
        if (location.text.toLowerCase().includes('cejusc')) {
          this.logger.info(`🏛️ [CEJUSC DEBUG] ERRO durante verificação: ${location.text} -> PROCESSAR (por segurança)`);
        }
                
        // Em caso de erro, não pular (processar)
        return {
          skip: false,
          reason: `Erro na verificação: ${error.message}`,
          method: 'error-fallback',
          confidence: 0.0
        };
      }
    };
  }
    
  /**
     * Gera chave única para OJ baseada na localização
     */
  generateOJKey(location) {
    return `${location.value}_${location.text.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
  }
    
  /**
     * Executa o escaneamento inteligente completo
     */
  async scanWithSmartSkipping(serverUrl, options = {}) {
    this.stats.startTime = Date.now();
        
    try {
      this.logger.info(`Iniciando escaneamento inteligente para: ${serverUrl}`);
            
      // Verificar se servidor já foi analisado
      if (this.config.enableLocationCache) {
        const serverData = this.cacheManager.getServerData(serverUrl);
        if (serverData && options.skipAnalyzedServers) {
          this.logger.info(`Servidor já analisado anteriormente: ${serverUrl}`);
                    
          return {
            success: true,
            skipped: true,
            reason: 'Servidor já analisado',
            serverData,
            stats: { ...this.stats }
          };
        }
      }
            
      // Criar função de verificação de pulo
      const skipChecker = await this.createSkipChecker(serverUrl);
            
      // Executar escaneamento com pulo inteligente
      const result = await this.scanner.scanAllLocations(serverUrl, {
        ...options,
        skipChecker
      });
            
      if (result.success) {
        // Marcar servidor como analisado
        if (this.config.enableLocationCache) {
          this.cacheManager.markServerAsAnalyzed(serverUrl, {
            totalLocations: result.stats.totalLocations,
            processedLocations: result.stats.processedLocations,
            skippedLocations: result.stats.skippedLocations,
            scanTime: Date.now() - this.stats.startTime
          });
        }
                
        // Marcar localizações processadas no cache
        for (const locationResult of result.results) {
          if (locationResult.success && !locationResult.skipped) {
            this.cacheManager.markLocationAsProcessed(
              serverUrl,
              locationResult.location.value,
              locationResult.location.text,
              {
                processingTime: locationResult.processingTime,
                scanTime: this.stats.startTime
              }
            );
          }
        }
                
        // Consolidar estatísticas
        this.consolidateStats(result.stats);
                
        this.logger.info('Escaneamento inteligente concluído com sucesso');
                
        if (this.callbacks.onComplete) {
          await this.callbacks.onComplete(result, this.generateFinalReport());
        }
      }
            
      return {
        ...result,
        smartStats: { ...this.stats },
        report: this.generateFinalReport()
      };
            
    } catch (error) {
      this.logger.error('Erro durante escaneamento inteligente:', error);
      this.stats.endTime = Date.now();
            
      if (this.callbacks.onError) {
        await this.callbacks.onError(error);
      }
            
      return {
        success: false,
        error: error.message,
        smartStats: { ...this.stats }
      };
    }
  }
    
  /**
     * Consolida estatísticas do scanner com estatísticas inteligentes
     */
  consolidateStats(scannerStats) {
    this.stats.totalLocations = scannerStats.totalLocations;
    this.stats.processedLocations = scannerStats.processedLocations;
    this.stats.errorLocations = scannerStats.errorLocations;
    this.stats.endTime = Date.now();
  }
    
  /**
     * Callback quando localização é encontrada
     */
  async onLocationFound(location, page) {
    this.logger.debug(`Localização processada: ${location.text}`);
        
    if (this.callbacks.onLocationProcessed) {
      await this.callbacks.onLocationProcessed(location, page);
    }
  }
    
  /**
     * Callback quando localização é pulada
     */
  async onLocationSkipped(location, reason) {
    this.logger.debug(`Localização pulada: ${location.text} - ${reason}`);
        
    if (this.callbacks.onLocationSkipped) {
      await this.callbacks.onLocationSkipped(location, reason);
    }
  }
    
  /**
     * Callback quando ocorre erro na localização
     */
  async onLocationError(location, error) {
    this.logger.warn(`Erro na localização ${location.text}: ${error.message}`);
        
    if (this.callbacks.onError) {
      await this.callbacks.onError(location, error);
    }
  }
    
  /**
     * Callback de progresso
     */
  async onProgress(progressData) {
    if (this.config.progressCallback) {
      await this.config.progressCallback({
        ...progressData,
        smartStats: { ...this.stats }
      });
    }
  }
    
  /**
     * Gera relatório final consolidado
     */
  generateFinalReport() {
    const totalTime = this.stats.endTime - this.stats.startTime;
    const totalSkipped = this.stats.skippedByCache + this.stats.skippedByOJ + this.stats.skippedByDoubleVerification;
        
    return {
      summary: {
        totalLocations: this.stats.totalLocations,
        processedLocations: this.stats.processedLocations,
        totalSkipped,
        errorLocations: this.stats.errorLocations,
        totalTime: `${(totalTime / 1000).toFixed(2)}s`,
        efficiency: this.stats.totalLocations > 0 
          ? `${((totalSkipped / this.stats.totalLocations) * 100).toFixed(2)}%`
          : '0%'
      },
      skipBreakdown: {
        skippedByCache: this.stats.skippedByCache,
        skippedByOJ: this.stats.skippedByOJ,
        skippedByDoubleVerification: this.stats.skippedByDoubleVerification,
        cacheEfficiency: totalSkipped > 0 
          ? `${((this.stats.skippedByCache / totalSkipped) * 100).toFixed(2)}%`
          : '0%',
        ojEfficiency: totalSkipped > 0 
          ? `${((this.stats.skippedByOJ / totalSkipped) * 100).toFixed(2)}%`
          : '0%',
        verificationEfficiency: totalSkipped > 0 
          ? `${((this.stats.skippedByDoubleVerification / totalSkipped) * 100).toFixed(2)}%`
          : '0%'
      },
      verification: {
        cacheHits: this.stats.verificationStats.cacheHits,
        directVerifications: this.stats.verificationStats.directVerifications,
        inconsistencies: this.stats.verificationStats.inconsistencies,
        cacheHitRate: this.stats.verificationStats.cacheHits + this.stats.verificationStats.directVerifications > 0
          ? `${((this.stats.verificationStats.cacheHits / (this.stats.verificationStats.cacheHits + this.stats.verificationStats.directVerifications)) * 100).toFixed(2)}%`
          : '0%'
      },
      performance: {
        locationsPerSecond: totalTime > 0 ? ((this.stats.totalLocations / totalTime) * 1000).toFixed(2) : 0,
        averageSkipTime: '< 100ms', // Estimativa baseada em cache
        timeSaved: totalSkipped > 0 ? `${(totalSkipped * 2).toFixed(0)}s` : '0s' // Estimativa
      }
    };
  }
    
  /**
     * Limpa todos os recursos
     */
  async cleanup() {
    try {
      await this.scanner.cleanup();
      await this.cacheManager.cleanup();
            
      this.logger.info('Sistema de pulo inteligente finalizado');
            
    } catch (error) {
      this.logger.error('Erro ao finalizar sistema de pulo inteligente:', error);
    }
  }
}

module.exports = SmartLocationSkipper;