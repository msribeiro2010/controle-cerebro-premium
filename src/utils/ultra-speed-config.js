/**
 * Configuração Ultra Velocidade para Automação
 * Otimizações agressivas para máxima performance
 */

class UltraSpeedConfig {
  
  // Configurações de otimização de banco de dados
  static DATABASE_OPTIMIZATION = {
    // Desabilitar verificações desnecessárias quando configuração já está definida
    SKIP_UNNECESSARY_CHECKS: true,
    
    // Usar apenas verificação local quando servidores já estão configurados
    USE_LOCAL_VERIFICATION_ONLY: false,
    
    // Pular verificação de OJs antes da automação (usar apenas na Multi-Servidor)
    SKIP_AUTOMATION_VERIFICATION: true,
    
    // Cache de verificações para evitar consultas repetidas
    ENABLE_VERIFICATION_CACHE: true,
    
    // Timeout para conexões de banco (ms)
    DATABASE_TIMEOUT: 5000,
    
    // Modo de fallback quando banco não está disponível
    FALLBACK_TO_LOCAL: true
  };
  static SPEED_MODES = {
    // Modo TURBO - Velocidade máxima com riscos calculados
    TURBO: {
      name: 'TURBO',
      multiplier: 0.3, // Reduz todos os delays para 30% do valor original
      parallelInstances: 5, // Até 5 instâncias paralelas
      batchSize: 10, // Processa 10 OJs por vez
      retryAttempts: 1, // Menos tentativas para ser mais rápido
      skipValidation: true, // Pula validações não críticas
      useCache: true, // Usa cache agressivamente
      preloadElements: true, // Pré-carrega elementos DOM
      settings: {
        navegacao: {
          carregarPagina: 1500,
          redirecionamento: 1000,
          aguardarElemento: 500,
          aguardarModal: 400,
          aguardarOverlay: 200,
          networkIdle: 800,
          domStable: 200
        },
        interacao: {
          clicar: 50,
          digitar: 20,
          aguardarResposta: 400,
          aguardarElemento: 1500,
          validarAcao: 200,
          estabilizar: 50,
          hover: 30,
          focus: 20
        },
        dropdown: {
          abrir: 600,
          carregarOpcoes: 1200,
          selecionar: 500,
          fechar: 300,
          buscarOpcao: 800
        }
      }
    },

    // Modo ULTRA - Ainda mais rápido, para ambientes controlados
    ULTRA: {
      name: 'ULTRA',
      multiplier: 0.2, // Reduz para 20% do valor original
      parallelInstances: 8, // Até 8 instâncias paralelas
      batchSize: 15, // Processa 15 OJs por vez
      retryAttempts: 0, // Sem retry - falhou, pula
      skipValidation: true,
      useCache: true,
      preloadElements: true,
      aggressiveCache: true, // Cache super agressivo
      settings: {
        navegacao: {
          carregarPagina: 1000,
          redirecionamento: 500,
          aguardarElemento: 300,
          aguardarModal: 200,
          aguardarOverlay: 100,
          networkIdle: 500,
          domStable: 100
        },
        interacao: {
          clicar: 20,
          digitar: 10,
          aguardarResposta: 200,
          aguardarElemento: 800,
          validarAcao: 100,
          estabilizar: 20,
          hover: 10,
          focus: 10
        },
        dropdown: {
          abrir: 300,
          carregarOpcoes: 600,
          selecionar: 200,
          fechar: 100,
          buscarOpcao: 400
        }
      }
    },

    // Modo INSANE - Para testes apenas, pode causar erros
    INSANE: {
      name: 'INSANE',
      multiplier: 0.1, // Reduz para 10% - extremamente arriscado
      parallelInstances: 12, // 12 instâncias paralelas
      batchSize: 20, // 20 OJs por vez
      retryAttempts: 0,
      skipValidation: true,
      useCache: true,
      preloadElements: true,
      aggressiveCache: true,
      skipWaits: true, // Pula a maioria das esperas
      settings: {
        navegacao: {
          carregarPagina: 500,
          redirecionamento: 200,
          aguardarElemento: 100,
          aguardarModal: 50,
          aguardarOverlay: 20,
          networkIdle: 200,
          domStable: 50
        },
        interacao: {
          clicar: 5,
          digitar: 5,
          aguardarResposta: 50,
          aguardarElemento: 200,
          validarAcao: 20,
          estabilizar: 10,
          hover: 5,
          focus: 5
        },
        dropdown: {
          abrir: 100,
          carregarOpcoes: 200,
          selecionar: 50,
          fechar: 20,
          buscarOpcao: 100
        }
      }
    }
  };

  /**
   * Retorna configuração para o modo especificado
   * @param {string} mode - TURBO, ULTRA ou INSANE
   * @returns {Object} Configuração do modo
   */
  static getMode(mode = 'TURBO') {
    return this.SPEED_MODES[mode] || this.SPEED_MODES.TURBO;
  }

  /**
   * Aplica multiplicador aos timeouts existentes
   * @param {Object} timeouts - Objeto com timeouts
   * @param {number} multiplier - Multiplicador (0.1 a 1.0)
   * @returns {Object} Timeouts modificados
   */
  static applyMultiplier(timeouts, multiplier) {
    const result = {};
    for (const [key, value] of Object.entries(timeouts)) {
      if (typeof value === 'object') {
        result[key] = this.applyMultiplier(value, multiplier);
      } else if (typeof value === 'number') {
        result[key] = Math.max(5, Math.round(value * multiplier)); // Mínimo 5ms
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Otimizações específicas para operações
   */
  static OPTIMIZATIONS = {
    // Estratégia de cache agressiva
    CACHE_STRATEGY: {
      domElements: true, // Cacheia elementos DOM
      selectors: true, // Cacheia seletores compilados
      ojData: true, // Cacheia dados de OJs
      navigation: true, // Cacheia caminhos de navegação
      ttl: 300000, // 5 minutos de cache
      maxSize: 500 // Máximo de 500 itens em cache
    },

    // Paralelização inteligente
    PARALLEL_STRATEGY: {
      autoScale: true, // Ajusta número de workers dinamicamente
      minWorkers: 2,
      maxWorkers: 10,
      queueSize: 100, // Tamanho da fila de processamento
      workerTimeout: 30000, // 30s timeout por worker
      loadBalance: true // Balanceamento de carga entre workers
    },

    // Otimização de rede
    NETWORK_OPTIMIZATION: {
      connectionPool: 10, // Pool de conexões
      keepAlive: true,
      compression: true,
      cacheRequests: true,
      retryOnTimeout: false, // Não retentar em timeout para ser mais rápido
      maxRedirects: 2
    },

    // Otimização de DOM
    DOM_OPTIMIZATION: {
      lazyLoad: true, // Carregamento preguiçoso
      virtualScroll: true, // Scroll virtual para listas grandes
      debounceEvents: true, // Debounce em eventos
      throttleQueries: true, // Throttle em queries DOM
      batchUpdates: true // Atualizações em lote
    }
  };

  /**
   * Retorna configuração otimizada baseada no ambiente
   */
  static getOptimizedConfig(environment = 'production') {
    if (environment === 'production') {
      return {
        mode: this.SPEED_MODES.TURBO,
        optimizations: this.OPTIMIZATIONS
      };
    } else if (environment === 'development') {
      return {
        mode: this.SPEED_MODES.ULTRA,
        optimizations: this.OPTIMIZATIONS
      };
    } else {
      // Testing
      return {
        mode: this.SPEED_MODES.INSANE,
        optimizations: this.OPTIMIZATIONS
      };
    }
  }
}

module.exports = UltraSpeedConfig;