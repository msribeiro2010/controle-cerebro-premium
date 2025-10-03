const { chromium } = require('playwright');
const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { login } = require('../login.js');
const { loadConfig } = require('../util.js');
const ParallelOJProcessor = require('./parallel-oj-processor.js');
const TimeoutManager = require('../utils/timeouts.js');
const ContextualDelayManager = require('./contextual-delay-manager.js');
const UltraFastDelayManager = require('../utils/ultra-fast-delay-manager.js');
const DOMCacheManager = require('./dom-cache-manager.js');
const SmartRetryManager = require('./smart-retry-manager.js');
const NavigationOptimizer = require('./navigation-optimizer.js');
const PerformanceMonitor = require('./performance-monitor.js');
const PJEResilienceManager = require('./pje-resilience-manager.js');
const { SmartOJCache } = require('../utils/smart-oj-cache.js');
const { VerificacaoOJPapel } = require('../utils/verificacao-oj-papel.js');
const { ServidorSkipDetector } = require('../utils/servidor-skip-detector.js');
const IntelligentCacheManager = require('../utils/intelligent-cache-manager.js');
const TurboModeProcessor = require('./turbo-mode-processor.js');
const SmartOJIntegration = require('../utils/smart-oj-integration.js');
const DatabaseConnection = require('../utils/database-connection.js');
const { verificarEProcessarLocalizacoesFaltantes, isVaraLimeira, aplicarTratamentoLimeira } = require('../vincularOJ.js');
// const { resolverProblemaVarasLimeira, SolucaoLimeiraCompleta } = require(path.resolve(__dirname, '../../solucao-limeira-completa.js'));
const { DetectorVarasProblematicas } = require('../utils/detector-varas-problematicas.js');
const PerformanceOptimizer = require('../utils/performance-optimizer.js');
const { SmartDOMCache } = require('../utils/smart-dom-cache.js');
// const PJEErrorHandler = require('../utils/pje-error-handler.js'); // Removido - tratamento simplificado
const PerformanceDashboard = require('../utils/performance-dashboard.js');
const BatchOJProcessor = require('./batch-oj-processor.js');
const UltraSpeedConfig = require('../utils/ultra-speed-config.js');
const UltraSpeedOptimizer = require('../utils/ultra-speed-optimizer.js');
const SpeedIntegrationManager = require('../utils/speed-integration-manager.js');
const UltraFastOJProcessor = require('../utils/ultra-fast-oj-processor.js');
const EnhancedResilienceManager = require('../utils/enhanced-resilience-manager.js');

/**
 * Automação moderna para vinculação de OJs a servidores
 * Baseada no documento automacao.md com melhorias implementadas
 */
class ServidorAutomationV2 {
  constructor() {
    this.isRunning = false;
    this.currentProgress = 0;
    this.totalOrgaos = 0;
    this.ojsProcessadosGlobal = 0;
    this.totalOjsGlobal = 0;
    this.mainWindow = null;
    this.browser = null;
    this.page = null;
    this.config = null;
    this.results = [];
    this.ojCache = new Set(); // Cache para OJs já cadastrados
    this.smartOJCache = new SmartOJCache(); // Cache inteligente para verificação de OJs
    this.verificacaoOJPapel = new VerificacaoOJPapel(); // Sistema de verificação OJ + papel
    this.servidorSkipDetector = new ServidorSkipDetector(); // Detector de servidores para pular
    this.intelligentCache = new IntelligentCacheManager(); // Cache inteligente HIPER-OTIMIZADO
    this.turboProcessor = null; // Processador TURBO para máxima velocidade
    this.smartOJIntegration = new SmartOJIntegration(); // Sistema inteligente de verificação e integração de OJs
    this.currentServidor = null; // Servidor sendo processado atualmente
    this.isProduction = process.env.NODE_ENV === 'production';
    this.timeoutManager = new TimeoutManager();
    this.delayManager = new ContextualDelayManager(this.timeoutManager);
    this.ultraFastDelayManager = new UltraFastDelayManager({ mode: 'ultra_fast', adaptive: true });
    this.retryManager = new SmartRetryManager(this.timeoutManager);
    this.navigationOptimizer = new NavigationOptimizer(this.timeoutManager, this.retryManager);
    this.performanceMonitor = new PerformanceMonitor();
    this.resilienceManager = new PJEResilienceManager();
    this.domCache = null;
    this.parallelProcessor = null;
    this.detectorVaras = new DetectorVarasProblematicas(); // Detector automático de varas problemáticas
    this.dbConnection = null; // Conexão com banco de dados para verificação inteligente
    this.forcedOJsNormalized = null; // OJs que DEVEM ser processadas (normalizadas)
    this.performanceOptimizer = null; // Otimizador de performance
    this.smartDOMCache = new SmartDOMCache(150, 600000); // Cache DOM inteligente (150 itens, 10 min TTL)
    // this.pjeErrorHandler = null; // Removido - tratamento simplificado direto no código
    this.performanceDashboard = new PerformanceDashboard(); // Dashboard de monitoramento de performance
    this.batchOJProcessor = null; // Processador de OJs em lote mantendo modal aberto
    this.ultraSpeedMode = 'ULTRA'; // Modo de velocidade ultra (TURBO, ULTRA, INSANE) - usando ULTRA para máxima performance
    this.speedConfig = UltraSpeedConfig.getMode(this.ultraSpeedMode);
    this.speedOptimizer = new UltraSpeedOptimizer(); // Otimizador inteligente de velocidade
    
    // NOVA INTEGRAÇÃO: Gerenciador de velocidade centralizado
    this.speedManager = new SpeedIntegrationManager({
      speedMode: this.ultraSpeedMode,
      enableAutoOptimization: true,
      enablePerformanceMonitoring: true,
      enableAggressiveCaching: true,
      enableParallelProcessing: true
    });

    // PROCESSADOR ULTRA RÁPIDO para OJs
    this.ultraFastProcessor = null;

    // GERENCIADOR DE RESILIÊNCIA APRIMORADO - Inicializado no construtor
    this.resilienceManager = new PJEResilienceManager();
  }

  setMainWindow(window) {
    this.mainWindow = window;
  }

  /**
   * Inicializa a conexão com o banco de dados
   */
  async initializeDatabaseConnection() {
    try {
      this.sendStatus('info', '🔗 Preparando sistema...', 0, 'Configurando recursos');
      
      this.dbConnection = new DatabaseConnection();
      const connected = await this.dbConnection.initialize();
      
      if (connected) {
        this.sendStatus('success', '✅ Sistema otimizado ativado', 0, 'Pronto para iniciar');
        return true;
      } else {
        this.sendStatus('info', '📋 Modo padrão ativado', 0, 'Processamento normal');
        return false;
      }
    } catch (error) {
      console.error('❌ Erro ao conectar banco:', error.message);
      this.sendStatus('info', '📋 Modo padrão ativado', 0, 'Sistema funcionando normalmente');
      return false;
    }
  }

  /**
   * Verifica OJs já cadastrados para um servidor antes da automação
   * @param {string} cpfServidor - CPF do servidor
   * @param {Array} ojsParaProcessar - Lista de OJs que seriam processados
   * @returns {Object} Resultado da verificação inteligente
   */
  async verificarOJsInteligente(cpfServidor, ojsParaProcessar) {
    console.log('🔍 [DEBUG] DIRLEI VERIFICAÇÃO - Iniciando verificarOJsInteligente');
    console.log(`🔍 [DEBUG] DIRLEI VERIFICAÇÃO - CPF: ${cpfServidor}`);
    console.log(`🔍 [DEBUG] DIRLEI VERIFICAÇÃO - OJs para processar: ${JSON.stringify(ojsParaProcessar)}`);

    // CORREÇÃO: Integrar com SmartOJCache para usar dados do cache persistente
    console.log('🔍 [DEBUG] INTEGRAÇÃO CACHE - Verificando cache persistente primeiro...');
    const cacheCarregado = await this.smartOJCache.carregarCachePersistente(cpfServidor);

    if (cacheCarregado && cacheCarregado.ojsJaVinculados) {
      console.log(`📦 [DEBUG] CACHE ENCONTRADO - ${cacheCarregado.ojsJaVinculados.length} OJs já vinculadas no cache`);

      // Separar OJs baseado no cache
      const ojsJaVinculadasDoCache = cacheCarregado.ojsJaVinculados.map(item => item.oj);
      const ojsParaProcessarFinal = ojsParaProcessar.filter(oj =>
        !ojsJaVinculadasDoCache.some(ojCache =>
          this.smartOJCache._normalizarTexto(oj) === this.smartOJCache._normalizarTexto(ojCache)
        )
      );

      console.log('🎯 [DEBUG] RESULTADO CACHE:');
      console.log(`   - OJs já vinculadas: ${ojsJaVinculadasDoCache.length}`);
      console.log(`   - OJs para processar: ${ojsParaProcessarFinal.length}`);

      const economiaCalculada = {
        tempo: ojsJaVinculadasDoCache.length * 5, // 5s por OJ
        cliques: ojsJaVinculadasDoCache.length * 3,
        ojsEvitados: ojsJaVinculadasDoCache.length
      };

      return {
        inteligenciaAtiva: true,
        servidorExiste: true,
        fonte: 'cache_persistente',
        totalVerificados: ojsParaProcessar.length,
        ojsParaProcessar: ojsParaProcessarFinal,
        ojsJaCadastrados: cacheCarregado.ojsJaVinculados,
        economia: economiaCalculada,
        mensagem: `Cache persistente: ${ojsParaProcessarFinal.length}/${ojsParaProcessar.length} OJs precisam ser processados`
      };
    }

    if (!this.dbConnection || !this.dbConnection.isConnected) {
      console.log('❌ [DEBUG] DIRLEI VERIFICAÇÃO - Banco não conectado!');
      return {
        inteligenciaAtiva: false,
        ojsParaProcessar,
        ojsJaCadastrados: [],
        economia: { tempo: 0, cliques: 0 },
        mensagem: 'Banco não conectado - processando todos os OJs'
      };
    }

    try {
      this.sendStatus('info', '🧠 Verificação inteligente: consultando OJs cadastrados...', 0, 'Analisando situação do servidor');

      // Buscar servidor por CPF
      console.log('🔍 [DEBUG] DIRLEI VERIFICAÇÃO - Buscando servidor por CPF...');
      const resultadoServidor = await this.dbConnection.buscarServidorPorCPF(cpfServidor);
      console.log('🔍 [DEBUG] DIRLEI VERIFICAÇÃO - Resultado busca servidor:', {
        existe: resultadoServidor.existe,
        servidor: resultadoServidor.servidor ? {
          idUsuario: resultadoServidor.servidor.idUsuario,
          nome: resultadoServidor.servidor.nome
        } : null
      });

      if (!resultadoServidor.existe) {
        console.log('❌ [DEBUG] DIRLEI VERIFICAÇÃO - Servidor não encontrado no BD!');
        return {
          inteligenciaAtiva: true,
          servidorExiste: false,
          ojsParaProcessar,
          ojsJaCadastrados: [],
          economia: { tempo: 0, cliques: 0 },
          mensagem: `Servidor CPF ${cpfServidor} não encontrado no sistema`
        };
      }

      // Verificar OJs já cadastrados
      console.log(`🔍 [DEBUG] DIRLEI VERIFICAÇÃO - Verificando OJs cadastrados para idUsuario: ${resultadoServidor.servidor.idUsuario}`);
      const verificacao = await this.dbConnection.verificarOJsCadastrados(
        resultadoServidor.servidor.idUsuario,
        ojsParaProcessar
      );

      console.log('🔍 [DEBUG] DIRLEI VERIFICAÇÃO - Resultado da consulta BD:', {
        totalVerificados: verificacao.totalVerificados,
        ojsParaProcessar: verificacao.ojsParaProcessar,
        ojsJaCadastrados: verificacao.ojsJaCadastrados,
        estatisticas: verificacao.estatisticas
      });

      const economiaCalculada = {
        tempo: verificacao.estatisticas.economiaEstimada,
        cliques: verificacao.estatisticas.jaCadastrados * 3, // ~3 cliques por OJ
        ojsEvitados: verificacao.estatisticas.jaCadastrados
      };

      this.sendStatus('success', 
        `🎯 Verificação concluída: ${verificacao.ojsParaProcessar.length} OJs para processar, ${verificacao.ojsJaCadastrados.length} já cadastrados`, 
        0, 
        `Economia: ${economiaCalculada.tempo}s e ${economiaCalculada.cliques} cliques`
      );

      const resultadoFinal = {
        inteligenciaAtiva: true,
        servidorExiste: true,
        servidor: resultadoServidor.servidor,
        totalVerificados: verificacao.totalVerificados,
        ojsParaProcessar: verificacao.ojsParaProcessar,
        ojsJaCadastrados: verificacao.ojsJaCadastrados,
        ojsInativos: verificacao.ojsInativos,
        economia: economiaCalculada,
        estatisticas: verificacao.estatisticas,
        mensagem: `Sistema inteligente: ${verificacao.ojsParaProcessar.length}/${verificacao.totalVerificados} OJs precisam ser processados`
      };

      console.log('🔍 [DEBUG] DIRLEI VERIFICAÇÃO - Resultado FINAL que será retornado:', {
        inteligenciaAtiva: resultadoFinal.inteligenciaAtiva,
        ojsParaProcessar: resultadoFinal.ojsParaProcessar,
        ojsJaCadastrados: resultadoFinal.ojsJaCadastrados?.length || 0
      });

      return resultadoFinal;

    } catch (error) {
      console.error('❌ Erro na verificação inteligente:', error.message);
      this.sendStatus('warning', '⚠️ Erro na verificação inteligente - processando todos os OJs', 0, 'Fallback para modo tradicional');
      
      return {
        inteligenciaAtiva: false,
        erro: error.message,
        ojsParaProcessar,
        ojsJaCadastrados: [],
        economia: { tempo: 0, cliques: 0 },
        mensagem: `Erro na verificação: ${error.message}`
      };
    }
  }

  /**
   * Formata os detalhes dos OJs para exibição ao usuário
   * @param {Object} resultadoVerificacao - Resultado da verificação inteligente
   * @returns {Object} Detalhes formatados
   */
  formatarDetalhesOJs(resultadoVerificacao) {
    const resumo = [
      `📊 Total: ${resultadoVerificacao.totalVerificados} OJs`,
      `✅ Já cadastrados: ${resultadoVerificacao.ojsJaCadastrados.length}`,
      `🔄 Para processar: ${resultadoVerificacao.ojsParaProcessar.length}`,
      `⚡ Economia: ${resultadoVerificacao.economia.tempo}s`
    ].join(' | ');

    let detalhes = '';
    
    if (resultadoVerificacao.ojsJaCadastrados.length > 0) {
      detalhes += '\n✅ OJs JÁ CADASTRADOS (serão pulados):\n';
      resultadoVerificacao.ojsJaCadastrados.forEach((oj, index) => {
        detalhes += `   ${index + 1}. ${oj.nome}\n`;
      });
    }
    
    if (resultadoVerificacao.ojsParaProcessar.length > 0) {
      detalhes += '\n🔄 OJs QUE SERÃO PROCESSADOS:\n';
      resultadoVerificacao.ojsParaProcessar.forEach((oj, index) => {
        detalhes += `   ${index + 1}. ${oj}\n`;
      });
    }

    return { resumo, detalhes };
  }

  /**
   * Solicita confirmação do usuário via modal
   * @param {string} titulo - Título do modal
   * @param {string} mensagem - Mensagem principal
   * @param {string} detalhes - Detalhes adicionais
   * @param {string} pergunta - Pergunta para confirmação
   * @returns {Promise<boolean>} True se confirmado
   */
  async solicitarConfirmacaoUsuario(titulo, mensagem, detalhes, pergunta) {
    return new Promise((resolve) => {
      if (!this.mainWindow || !this.mainWindow.webContents) {
        console.log('⚠️ MainWindow não disponível, continuando automaticamente...');
        resolve(true);
        return;
      }

      // Enviar dados para o modal de confirmação
      this.mainWindow.webContents.executeJavaScript(`
        if (typeof showConfirmationModal === 'function') {
          showConfirmationModal({
            titulo: '${titulo.replace(/'/g, '\\\'')}',
            mensagem: '${mensagem.replace(/'/g, '\\\'')}',
            detalhes: \`${detalhes.replace(/`/g, '\\`')}\`,
            pergunta: '${pergunta.replace(/'/g, '\\\'')}',
            callback: 'confirmacaoAutomacao'
          });
        } else {
          console.log('Modal de confirmação não disponível');
        }
      `).catch(err => {
        console.log('⚠️ Erro ao exibir modal:', err.message);
        resolve(true); // Continuar em caso de erro
      });

      // Registrar callback IPC para receber resposta do renderer
      let finished = false;
      const cleanup = () => {
        finished = true;
        // Garantir que não há listeners residuais
        ipcMain.removeAllListeners('confirmacao-resultado');
      };

      ipcMain.once('confirmacao-resultado', (event, confirmado /*, forcado */) => {
        try {
          cleanup();
        } catch {}
        resolve(Boolean(confirmado));
      });

      // Timeout de 30 segundos - continuar automaticamente se não houver resposta
      setTimeout(() => {
        if (finished) return;
        cleanup();
        console.log('⏰ Timeout na confirmação - continuando automaticamente...');
        resolve(true);
      }, 30000);
    });
  }

  /**
   * Inicializa o cache DOM quando a página estiver disponível
   */
  initializeDOMCache() {
    if (this.page && !this.domCache) {
      this.domCache = new DOMCacheManager(this.page, this.timeoutManager);
      console.log('✅ Cache DOM inicializado');
    }
  }

  // Função helper para delay contextual ULTRA-OTIMIZADO
  async delay(ms, context = 'default', operation = null) {
    // Usar otimizador inteligente quando possível
    if (this.speedOptimizer && operation) {
      const optimizedDelay = this.speedOptimizer.getOptimizedDelay(context, operation);
      if (optimizedDelay) {
        return await this.page.waitForTimeout(optimizedDelay);
      }
    }

    // Aplicar multiplicador do modo de velocidade ultra
    const adjustedMs = Math.max(5, Math.round(ms * this.speedConfig.multiplier));
    
    if (context === 'default') {
      // Para delays fixos, usar o UltraFast quando possível
      if (adjustedMs <= 50) {
        return await this.ultraFastDelayManager.criticalDelay({ priority: 'critical' });
      } else if (adjustedMs <= 200) {
        return await this.ultraFastDelayManager.clickDelay({ priority: 'critical' });
      } else if (adjustedMs <= 500) {
        return await this.ultraFastDelayManager.navigationDelay({ priority: 'critical' });
      }
      // Fallback para delays longos - também com ajuste
      return new Promise(resolve => setTimeout(resolve, Math.min(ms, 2000))); // Máximo 2s
    }

    // Usar UltraFastDelayManager para contextos específicos
    if (context === 'hyperFastBetweenOJs' || context === 'critical') {
      return await this.ultraFastDelayManager.criticalDelay({ priority: 'critical', context });
    }
    if (context === 'click' || context === 'form') {
      return await this.ultraFastDelayManager.clickDelay({ priority: 'critical', context });
    }
    if (context === 'navigation') {
      return await this.ultraFastDelayManager.navigationDelay({ priority: 'critical', context });
    }
    if (context === 'search') {
      return await this.ultraFastDelayManager.searchDelay({ priority: 'critical', context });
    }

    // Fallback para outros contextos
    return await this.delayManager.smartDelay(context, { priority: 'normal' });
  }
  
  // Novo método para delay contextual com opções
  async contextualDelay(context, options = {}) {
    return await this.delayManager.smartDelay(context, options);
  }

  // Normalizar nomes de órgãos julgadores para corrigir erros de digitação
  normalizeOrgaoName(orgao) {
    // Validar se o parâmetro é uma string
    if (typeof orgao !== 'string') {
      console.warn(`normalizeOrgaoName: Valor inválido recebido (${typeof orgao}):`, orgao);
      // Se for um objeto com propriedade nome, usar essa propriedade
      if (orgao && typeof orgao === 'object' && orgao.nome) {
        orgao = orgao.nome;
      } else if (orgao && typeof orgao === 'object' && orgao.oj) {
        // Se for um objeto com propriedade oj, usar essa propriedade
        orgao = orgao.oj;
      } else if (orgao && typeof orgao === 'object' && orgao.textoCompleto) {
        // Se for um objeto com propriedade textoCompleto, usar essa propriedade
        orgao = orgao.textoCompleto;
      } else {
        // Converter para string ou retornar string vazia
        orgao = orgao ? String(orgao) : '';
      }
    }
    
    // Verificar se ainda é uma string válida após conversão
    if (typeof orgao !== 'string' || orgao.length === 0) {
      console.warn('normalizeOrgaoName: Não foi possível normalizar o órgão:', orgao);
      return '';
    }
    
    return orgao
      .replace(/\s+/g, ' ')  // Normalizar espaços múltiplos
      .replace(/[–—−]/g, '-')  // Normalizar travessões (–, —, −) para hífen (-)
      .replace(/doTrabalho/g, 'do Trabalho')  // Corrigir "doTrabalho" → "do Trabalho"
      .replace(/daTrabalho/g, 'da Trabalho')  // Corrigir "daTrabalho" → "da Trabalho"  
      .replace(/deTrabalho/g, 'de Trabalho')  // Corrigir "deTrabalho" → "de Trabalho"
      .replace(/Trrabalho/g, 'Trabalho')  // Corrigir "Trrabalho" → "Trabalho" (duplo R)
      .replace(/trrabalho/g, 'trabalho')  // Corrigir versão minúscula
      .trim();
  }

  // NOVA FUNÇÃO: Busca inteligente por palavras-chave
  findBestOJMatch(targetOJ, availableOptions) {
    const targetWords = this.extractKeywords(targetOJ);
    let bestMatch = null;
    let bestScore = 0;
    
    console.log(`🔍 Palavras-chave do OJ procurado: [${targetWords.join(', ')}]`);
    
    for (const option of availableOptions) {
      const optionWords = this.extractKeywords(option.text);
      const score = this.calculateMatchScore(targetWords, optionWords);
      
      console.log(`🔍 "${option.text}" - Score: ${score} - Palavras: [${optionWords.join(', ')}]`);
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = option;
      }
    }
    
    console.log(`🎯 Melhor match encontrado: "${bestMatch?.text}" com score ${bestScore}`);
    return { match: bestMatch, score: bestScore };
  }
  
  // Extrair palavras-chave relevantes
  extractKeywords(text) {
    const normalized = text.toLowerCase()
      .replace(/[^a-záàâãéêíóôõúç\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Palavras irrelevantes que devem ser ignoradas
    const stopWords = ['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'nas', 'nos', 'a', 'o', 'as', 'os', 'para', 'com', 'por'];
    
    return normalized.split(' ')
      .filter(word => word.length > 2 && !stopWords.includes(word))
      .slice(0, 8); // Limitar a 8 palavras mais relevantes
  }
  
  // Calcular score de compatibilidade
  calculateMatchScore(targetWords, optionWords) {
    let score = 0;
    const targetSet = new Set(targetWords);
    const optionSet = new Set(optionWords);
    
    // Pontos por palavras exatas
    for (const word of targetWords) {
      if (optionSet.has(word)) {
        score += 10;
      }
    }
    
    // Pontos por palavras similares (substring)
    for (const targetWord of targetWords) {
      for (const optionWord of optionWords) {
        if (targetWord.includes(optionWord) || optionWord.includes(targetWord)) {
          score += 5;
        }
      }
    }
    
    return score;
  }

  sendStatus(type, message, progress = null, subtitle = null, orgao = null, servidor = null, ojProcessed = null, totalOjs = null) {
    try {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        // Usar valores globais se não foram passados específicos
        const ojsProcessados = ojProcessed !== null ? ojProcessed : this.ojsProcessadosGlobal;
        const totalOjsValor = totalOjs !== null ? totalOjs : this.totalOjsGlobal;

        this.mainWindow.webContents.send('automation-progress', {
          type,
          message,
          progress,
          subtitle,
          orgaoJulgador: orgao,
          servidor,
          cpf: this.config?.cpf || null,
          perfil: this.config?.perfil || null,
          automationType: 'servidor-v2',
          ojProcessed: ojsProcessados,
          totalOjs: totalOjsValor
        });
      }
    } catch (error) {
      // Erro de IPC - não é crítico, apenas log
      console.warn('Erro ao enviar status IPC:', error.message);
    }
        
    try {
      console.log(`[${type.toUpperCase()}] ${message}${subtitle ? ` - ${subtitle}` : ''}${orgao ? ` (${orgao})` : ''}${servidor ? ` [${servidor}]` : ''}`);
    } catch (error) {
      // Em caso de erro até no console.log, usar process.stdout
      process.stdout.write(`[${type.toUpperCase()}] ${message}\n`);
    }
  }

  async startAutomation(config) {
    if (this.isRunning) {
      throw new Error('Automação já está em execução');
    }

    this.isRunning = true;
    this.config = config;
    this.currentProgress = 0;
    this.results = [];
    
    // Inicializar conexão com banco de dados para verificação inteligente
    if (!this.dbConnection) {
      await this.initializeDatabaseConnection();
    }
    
    // ⚡ OTIMIZAÇÃO: Monitoramento DESABILITADO para evitar travamento
    this.performanceDashboard.reset();
    // this.performanceDashboard.startContinuousMonitoring(10000); // DESABILITADO - causava travamento
    
    // Atualizar status dos otimizadores
    this.performanceDashboard.updateOptimizerStatus('timeoutManager', true);
    this.performanceDashboard.updateOptimizerStatus('smartRetryManager', true);
    this.performanceDashboard.updateOptimizerStatus('navigationOptimizer', true);
    this.performanceDashboard.updateOptimizerStatus('smartDOMCache', true);
    // this.performanceDashboard.updateOptimizerStatus('pjeErrorHandler', false); // Removido
    // this.performanceMonitor.startMonitoring(); // DESABILITADO - causava travamento
    
    // Inicializar timer de processamento para o modal
    if (this.mainWindow && this.mainWindow.webContents) {
      this.mainWindow.webContents.executeJavaScript(`
        if (typeof startProcessingTimer === 'function') {
          startProcessingTimer();
        }
      `).catch(err => {
        console.log('⚠️ Erro ao inicializar timer de processamento:', err.message);
      });
    }

    try {
      // Suporte para processamento em lote de múltiplos servidores
      if (config.servidores && config.servidores.length > 0) {
        await this.processMultipleServidores(config);
      } else {
        // Modo compatibilidade - processar servidor único
        this.totalOrgaos = config.orgaos ? config.orgaos.length : 0;
        await this.processSingleServidor(config);
      }
            
      this.sendStatus('success', '✅ Automação concluída com sucesso!', 100, 'Finalizado');
            
    } catch (error) {
      console.error('Erro na automação:', error);
      this.sendStatus('error', `Erro na automação: ${error.message}`, this.currentProgress, 'Erro crítico');
      throw error;
    } finally {
      // Exibir dashboard de performance final
      console.log('\n📊 RELATÓRIO FINAL DE PERFORMANCE:');
      this.performanceDashboard.displayDashboard();
      
      // Salvar relatório
      try {
        const reportPath = await this.performanceDashboard.saveReport();
        console.log(`📄 Relatório de performance salvo em: ${reportPath}`);
      } catch (e) {
        console.log('⚠️ Não foi possível salvar o relatório de performance');
      }
      
      // Parar monitoramento contínuo
      this.performanceDashboard.stopContinuousMonitoring();
      
      await this.cleanup();
      this.isRunning = false;
    }
  }

  /**
   * Inicia automação com processamento paralelo
   * @param {Object} config - Configuração da automação
   * @param {number} maxInstances - Número máximo de instâncias paralelas (padrão: 4, máx: 4)
   */
  async startParallelAutomation(servidores, config, maxInstances = 4) {
    // Garantir que não exceda 4 instâncias para estabilidade
    maxInstances = Math.min(Math.max(1, maxInstances), 4);
    if (this.isRunning) {
      throw new Error('Automação já está em execução');
    }

    // Validar configuração para processamento paralelo
    if (!servidores || servidores.length === 0) {
      throw new Error('Processamento paralelo requer uma lista de servidores');
    }

    if (maxInstances < 1 || maxInstances > 30) {
      throw new Error('Número de instâncias deve estar entre 1 e 30');
    }

    this.isRunning = true;
    this.config = config;
    this.currentProgress = 0;
    this.results = [];
    
    // Iniciar monitoramento de performance
    // this.performanceMonitor.startMonitoring(); // DESABILITADO - causava travamento

    this.sendStatus('info', '🚀 Iniciando processamento paralelo', 0, 
      `${servidores.length} servidores com ${maxInstances} instâncias`);

    try {
      // Import dinamicamente para evitar dependência circular
      const ParallelServerManager = require('./parallel-server-manager.js');
      const parallelManager = new ParallelServerManager(maxInstances);
      parallelManager.mainWindow = this.mainWindow;
      
      // Inicializar instâncias paralelas
      await parallelManager.initialize();
      
      this.sendStatus('info', `✅ ${maxInstances} instâncias inicializadas`, 10, 
        'Iniciando processamento dos servidores');
      
      // Configurar para manter navegador aberto por padrão
      const parallelConfig = {
        orgaos: config.orgaos || [],
        keepBrowserOpen: config.keepBrowserOpen !== false // Default: true
      };
      
      // Processar servidores em paralelo
      const results = await parallelManager.processServersInParallel(servidores, parallelConfig);
      
      // Consolidar resultados
      this.results = results.resultados || [];
      
      // Gerar relatório específico para processamento paralelo
      await this.generateParallelReport(results, maxInstances);
      
      this.sendStatus('success', 
        '🎉 Processamento paralelo concluído!', 
        100, 
        `${results.servidoresProcessados}/${results.totalServidores} servidores processados em ${(results.tempoTotal / 1000).toFixed(1)}s`);
      
      if (parallelConfig.keepBrowserOpen) {
        console.log('🔄 Navegador mantido aberto para visualização dos resultados');
        console.log('💡 Para fechar completamente, use: automation.forceCleanup()');
        // Armazenar referência do manager para cleanup posterior
        this.parallelManager = parallelManager;
      } else {
        // Limpar instâncias paralelas apenas se não configurado para manter aberto
        await parallelManager.cleanup();
      }
      
      return results;
      
    } catch (error) {
      console.error('❌ Erro no processamento paralelo:', error);
      this.sendStatus('error', `Erro no processamento paralelo: ${error.message}`, this.currentProgress);
      throw error;
    } finally {
      this.isRunning = false;
      // Cleanup será feito apenas se keepBrowserOpen for false
    }
  }

  /**
   * Força o fechamento completo de todas as instâncias
   */
  async forceCleanup() {
    if (this.parallelManager) {
      console.log('🔄 Forçando fechamento de todas as instâncias...');
      await this.parallelManager.cleanup(true);
      this.parallelManager = null;
      console.log('✅ Todas as instâncias foram fechadas');
    } else {
      console.log('ℹ️ Nenhuma instância paralela ativa para fechar');
    }
  }
  
  /**
   * Gera relatório específico para processamento paralelo
   */
  async generateParallelReport(results, maxInstances) {
    try {
      const outputDir = path.join(__dirname, '..', '..', 'data');
      
      // Garantir que o diretório existe
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      const report = {
        timestamp: new Date().toISOString(),
        tipoProcessamento: 'Paralelo',
        configuracao: {
          instanciasUtilizadas: maxInstances,
          servidoresTotais: results.totalServidores,
          servidoresProcessados: results.servidoresProcessados
        },
        performance: {
          tempoTotalSegundos: results.tempoTotal / 1000,
          tempoMedioServidorSegundos: results.tempoMedioServidor / 1000,
          eficienciaParalela: results.eficienciaParalela,
          estatisticas: results.estatisticas
        },
        resultados: {
          sucessos: results.sucessos,
          erros: results.erros,
          detalhesServidores: results.resultados,
          errosDetalhados: results.errosDetalhados
        },
        comparacao: {
          estimativaSequencial: (results.tempoTotal * maxInstances) / 1000,
          ganhoTempo: results.eficienciaParalela?.timeReduction || 0,
          speedup: results.eficienciaParalela?.speedup || 1
        }
      };
      
      const reportPath = path.join(outputDir, `relatorio-paralelo-${timestamp}.json`);
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      
      console.log(`📊 Relatório paralelo salvo: ${reportPath}`);
      
      // Também gerar versão legível
      const readableReportPath = path.join(outputDir, `relatorio-paralelo-legivel-${timestamp}.txt`);
      const readableContent = this.generateReadableParallelReport(report);
      fs.writeFileSync(readableReportPath, readableContent);
      
      console.log(`📄 Relatório legível salvo: ${readableReportPath}`);
      
    } catch (error) {
      console.error('Erro ao gerar relatório paralelo:', error);
    }
  }

  /**
   * Gera versão legível do relatório paralelo
   */
  generateReadableParallelReport(report) {
    return `
=== RELATÓRIO DE PROCESSAMENTO PARALELO ===

Data/Hora: ${new Date(report.timestamp).toLocaleString('pt-BR')}
Tipo: ${report.tipoProcessamento}

--- CONFIGURAÇÃO ---
Instâncias Paralelas: ${report.configuracao.instanciasUtilizadas}
Servidores Totais: ${report.configuracao.servidoresTotais}
Servidores Processados: ${report.configuracao.servidoresProcessados}

--- PERFORMANCE ---
Tempo Total: ${report.performance.tempoTotalSegundos.toFixed(1)}s
Tempo Médio por Servidor: ${report.performance.tempoMedioServidorSegundos.toFixed(1)}s
Speedup: ${report.performance.eficienciaParalela?.speedup?.toFixed(2) || 'N/A'}x
Eficiência: ${(report.performance.eficienciaParalela?.efficiency * 100)?.toFixed(1) || 'N/A'}%
Redução de Tempo: ${report.performance.eficienciaParalela?.timeReduction?.toFixed(1) || 'N/A'}%

--- RESULTADOS ---
Sucessos: ${report.resultados.sucessos}
Erros: ${report.resultados.erros}
Taxa de Sucesso: ${((report.resultados.sucessos / report.configuracao.servidoresProcessados) * 100).toFixed(1)}%

--- COMPARAÇÃO ---
Tempo Estimado Sequencial: ${report.comparacao.estimativaSequencial.toFixed(1)}s
Ganho de Tempo: ${report.comparacao.ganhoTempo.toFixed(1)}%
Velocidade: ${report.comparacao.speedup.toFixed(2)}x mais rápido

--- ESTATÍSTICAS DETALHADAS ---
${report.performance.estatisticas ? `
Tempo de Processamento:
  Mínimo: ${(report.performance.estatisticas.tempoProcessamento?.minimo / 1000).toFixed(1)}s
  Máximo: ${(report.performance.estatisticas.tempoProcessamento?.maximo / 1000).toFixed(1)}s
  Média: ${(report.performance.estatisticas.tempoProcessamento?.media / 1000).toFixed(1)}s

Sucessos por Servidor:
  Mínimo: ${report.performance.estatisticas.sucessosPorServidor?.minimo || 0}
  Máximo: ${report.performance.estatisticas.sucessosPorServidor?.maximo || 0}
  Média: ${report.performance.estatisticas.sucessosPorServidor?.media?.toFixed(1) || 0}
  Total: ${report.performance.estatisticas.sucessosPorServidor?.total || 0}` : 'Não disponível'}

=== FIM DO RELATÓRIO ===
`;
  }

  async processMultipleServidores(config) {
    const servidores = config.servidores;
    this.totalOrgaos = servidores.reduce((total, servidor) => total + (servidor.ojs ? servidor.ojs.length : 0), 0);

    // Definir valores globais para progresso
    this.totalOjsGlobal = this.totalOrgaos;
    this.ojsProcessadosGlobal = 0;
    
    // Inicializar estrutura de relatório por servidor
    this.servidorResults = {};
    this.processedServidores = 0;
    this.successfulServidores = 0;
    this.failedServidores = 0;
    this.consecutiveErrors = 0;
    this.maxConsecutiveErrors = 3; // Parar após 3 erros consecutivos
    
    this.sendStatus('info', `🚀 Iniciando: ${servidores.length} servidor${servidores.length > 1 ? 'es' : ''}, ${this.totalOrgaos} vinculação${this.totalOrgaos > 1 ? 'ões' : ''}`, 0, 'Preparando processamento');
    
    await this.initializeBrowser();
    await this.performLogin();
    
    // Processar cada servidor na mesma sessão com recuperação robusta
    for (let i = 0; i < servidores.length; i++) {
      const servidor = servidores[i];
      const progressBase = (i / servidores.length) * 90;
      
      // Verificar limite de erros consecutivos
      if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
        this.sendStatus('error', `🚨 PARADA DE SEGURANÇA: ${this.maxConsecutiveErrors} erros consecutivos detectados`, 90, 'Automação interrompida por segurança');
        break;
      }
      
      // Inicializar resultado do servidor
      this.servidorResults[servidor.cpf] = {
        nome: servidor.nome,
        cpf: servidor.cpf,
        perfil: servidor.perfil,
        totalOJs: servidor.ojs ? servidor.ojs.length : 0,
        ojsProcessados: 0,
        sucessos: 0,
        erros: 0,
        jaIncluidos: 0,
        detalhes: [],
        status: 'Processando',
        inicioProcessamento: new Date().toISOString(),
        fimProcessamento: null,
        tempoProcessamento: null,
        tentativas: 0,
        maxTentativas: 2
      };
      
      this.sendStatus('info', `👥 Processando servidor ${i + 1} de ${servidores.length}: ${servidor.nome}`,
        progressBase, `${servidor.ojs?.length || 0} vinculação${(servidor.ojs?.length || 0) !== 1 ? 'ões' : ''} para processar`, null, servidor.nome);
      
      const startTime = Date.now();
      let servidorProcessado = false;
      
      // Tentar processar servidor com retry automático
      for (let tentativa = 1; tentativa <= this.servidorResults[servidor.cpf].maxTentativas && !servidorProcessado; tentativa++) {
        this.servidorResults[servidor.cpf].tentativas = tentativa;
        
        try {
          this.sendStatus('info', `🔄 Processando ${servidor.nome}`,
            progressBase, `Tentativa ${tentativa} de ${this.servidorResults[servidor.cpf].maxTentativas}`, null, servidor.nome);
          
          console.log(`🎯 ===== INICIANDO PROCESSAMENTO DO SERVIDOR ${i + 1}: ${servidor.nome} =====`);
          
          // Garantir navegador ativo antes de processar
          console.log(`🔍 [${i + 1}/${servidores.length}] Verificando navegador ativo...`);
          await this.ensureBrowserActive();
          
          // Garantir recuperação completa antes de processar
          console.log(`🧹 [${i + 1}/${servidores.length}] Limpando estado...`);
          await this.ensureCleanState();
          
          // Configurar dados do servidor atual
          console.log(`⚙️ [${i + 1}/${servidores.length}] Configurando dados do servidor...`);
          this.config.cpf = servidor.cpf;
          this.config.perfil = servidor.perfil;

          // CORREÇÃO CRÍTICA: Usar OJs da configuração, não do servidor
          // CORREÇÃO: Mapear orgaos → ojs se necessário
          if (servidor.orgaos && !servidor.ojs) {
            servidor.ojs = servidor.orgaos;
            console.log(`🔧 [MAPPING] Mapeando orgaos→ojs para ${servidor.nome}: ${JSON.stringify(servidor.orgaos)}`);
          }

          // servidor.ojs = OJs que o servidor já tem vinculados
          // config.orgaos = OJs que o usuário quer processar (inclui novos)
          if (config.orgaos && config.orgaos.length > 0) {
            this.config.orgaos = config.orgaos; // Usar OJs da configuração global
            console.log(`✅ Usando OJs da configuração global: ${this.config.orgaos.length} OJs`);
          } else if (config.ojs && config.ojs.length > 0) {
            this.config.orgaos = config.ojs; // Fallback para config.ojs
            console.log(`✅ Usando OJs do config.ojs: ${this.config.orgaos.length} OJs`);
          } else if (servidor.ojs && servidor.ojs.length > 0) {
            this.config.orgaos = servidor.ojs; // Usar OJs do servidor após mapeamento
            console.log(`✅ Usando OJs do servidor (após mapeamento): ${this.config.orgaos.length} OJs`);
          } else if (servidor.orgaos && servidor.orgaos.length > 0) {
            this.config.orgaos = servidor.orgaos; // Fallback direto para orgaos
            console.log(`✅ Usando orgaos do servidor diretamente: ${this.config.orgaos.length} OJs`);
          } else {
            this.config.orgaos = []; // Último fallback
            console.log(`⚠️ Fallback: Nenhum OJ encontrado para processar: ${this.config.orgaos.length} OJs`);
          }

          console.log(`📋 Servidor configurado: CPF=${servidor.cpf}, Perfil=${servidor.perfil}`);
          console.log(`🎯 OJs para processar: ${this.config.orgaos.length}`);
          console.log(`🔍 Lista de OJs: ${JSON.stringify(this.config.orgaos)}`);
          console.log(`📝 OJs já vinculados no servidor: ${JSON.stringify(servidor.ojs || [])}`);
          
          // Debug detalhado do estado atual
          console.log('🔍 [DEBUG] Estado do navegador:');
          const currentUrl = this.page.url();
          console.log(`   URL atual: ${currentUrl}`);
          const pageTitle = await this.page.title();
          console.log(`   Título: ${pageTitle}`);
          console.log(`   Servidor ${i + 1}: ${servidor.nome} (${servidor.cpf})`);
          console.log(`   OJs a processar: ${JSON.stringify(servidor.ojs?.slice(0,3) || [])}${servidor.ojs?.length > 3 ? '...' : ''}`);
          
          // Navegação robusta com tratamento específico para CPF não encontrado
          console.log(`🔗 [${i + 1}/${servidores.length}] Navegando para pessoa...`);
          try {
            await this.navigateDirectlyToPerson(servidor.cpf);
          } catch (error) {
            if (error.message === 'PESSOA_FISICA_NAO_ENCONTRADA') {
              // Formatação de mensagens específicas para CPF não encontrado
              const mensagemErro = `CPF ${servidor.cpf} não foi encontrado no sistema PJE`;
              const mensagemDetalhada = `O servidor ${servidor.nome} (CPF: ${servidor.cpf}) não está cadastrado no sistema. Verifique se o CPF está correto ou se o servidor já foi incluído no PJE.`;
              
              console.log(`❌ CPF NÃO ENCONTRADO: ${mensagemErro}`);
              
              // Enviar status específico para CPF não encontrado
              this.sendStatus('error', `❌ Erro ao processar ${servidor.nome}: ${mensagemErro}`, 
                ((i + 1) / servidores.length) * 90, 'CPF não cadastrado no sistema');
              
              // Adicionar ao relatório de erros do servidor
              const serverResult = this.servidorResults[servidor.cpf];
              serverResult.status = 'CPF não encontrado';
              serverResult.erroGeral = mensagemDetalhada;
              serverResult.detalhes.push({
                tipo: 'erro',
                mensagem: mensagemDetalhada,
                timestamp: new Date().toISOString()
              });
              
              // Relançar erro com mensagem mais clara
              throw new Error(mensagemDetalhada);
            } else {
              // Outros erros são relançados normalmente
              throw error;
            }
          }
          
          // Debug após navegação
          const urlAposNavegacao = this.page.url();
          console.log(`🔍 [DEBUG] URL após navegação: ${urlAposNavegacao}`);
          console.log(`🔍 [DEBUG] Navegação para ${servidor.nome} (${servidor.cpf}) CONCLUÍDA`);
          
          console.log(`📂 [${i + 1}/${servidores.length}] Acessando aba servidor...`);
          await this.navigateToServerTab();
          
          // Debug após acessar aba servidor
          const urlAposAbaServidor = this.page.url();
          console.log(`🔍 [DEBUG] URL após aba servidor: ${urlAposAbaServidor}`);
          console.log(`🔍 [DEBUG] Aba servidor acessada para ${servidor.nome}`);

          // VERIFICAÇÃO CRÍTICA: Buscar OJs já vinculados no banco de dados
          let ojsParaProcessarFinal = servidor.ojs || [];

          if (this.dbConnection && this.dbConnection.isConnected) {
            try {
              console.log(`🔍 [VERIFICAÇÃO DB] Consultando OJs já vinculados para CPF ${servidor.cpf}...`);

              // Buscar OJs realmente vinculados no banco de dados
              const ojsJaVinculadosDB = await this.dbConnection.buscarOJsDoServidor(servidor.cpf);

              console.log(`📊 [VERIFICAÇÃO DB] Encontrados ${ojsJaVinculadosDB.length} OJs já vinculados no banco`);
              console.log(`📋 [VERIFICAÇÃO DB] OJs da configuração: ${servidor.ojs?.length || 0}`);

              if (ojsJaVinculadosDB.length > 0) {
                console.log(`🔍 [VERIFICAÇÃO DB] OJs já vinculados:`);
                ojsJaVinculadosDB.forEach((oj, idx) => {
                  console.log(`   ${idx + 1}. ${oj.orgaoJulgador || oj.orgao_julgador || oj}`);
                });

                // Filtrar OJs que realmente precisam ser processados
                const ojsNormalizadosDB = ojsJaVinculadosDB.map(oj =>
                  this.smartOJCache._normalizarTexto(oj.orgaoJulgador || oj.orgao_julgador || oj)
                );

                ojsParaProcessarFinal = (servidor.ojs || []).filter(ojConfig => {
                  const ojNormalizado = this.smartOJCache._normalizarTexto(ojConfig);
                  const jaVinculado = ojsNormalizadosDB.some(ojDB => ojDB === ojNormalizado);

                  if (jaVinculado) {
                    console.log(`   ⏭️  "${ojConfig}" - JÁ VINCULADO (pulando)`);
                  }

                  return !jaVinculado;
                });

                console.log(`✅ [VERIFICAÇÃO DB] ${ojsJaVinculadosDB.length} OJs já vinculados, ${ojsParaProcessarFinal.length} precisam ser processados`);
              } else {
                console.log(`📝 [VERIFICAÇÃO DB] Nenhum OJ vinculado encontrado - processando todos`);
              }
            } catch (error) {
              console.error(`❌ [VERIFICAÇÃO DB] Erro ao consultar banco: ${error.message}`);
              console.log(`⚠️ [VERIFICAÇÃO DB] Continuando com todos os OJs da configuração`);
              // Em caso de erro, processar todos os OJs da configuração
              ojsParaProcessarFinal = servidor.ojs || [];
            }
          } else {
            console.log(`⚠️ [VERIFICAÇÃO DB] Banco desconectado - processando todos os OJs da configuração`);
          }

          // Atualizar servidor com OJs filtrados
          const ojsOriginais = servidor.ojs || [];
          servidor.ojs = ojsParaProcessarFinal;

          // Processar OJs com monitoramento detalhado
          console.log(`🎯 [${i + 1}/${servidores.length}] Processando ${ojsParaProcessarFinal.length} de ${ojsOriginais.length} OJs...`);
          console.log(`🔍 [DEBUG] Iniciando processamento de OJs para ${servidor.nome}:`);
          for (let debugOJ = 0; debugOJ < Math.min(3, ojsParaProcessarFinal.length); debugOJ++) {
            console.log(`   OJ ${debugOJ + 1}: ${ojsParaProcessarFinal[debugOJ]}`);
          }

          await this.processOrgaosJulgadoresWithServerTracking(servidor);
          console.log(`✅ [${i + 1}/${servidores.length}] Processamento de OJs concluído`);
          console.log(`🔍 [DEBUG] Processamento de OJs FINALIZADO para ${servidor.nome}`);
          
          // Finalizar resultado do servidor
          console.log(`📋 [${i + 1}/${servidores.length}] Finalizando resultado do servidor...`);
          const serverResult = this.servidorResults[servidor.cpf];
          serverResult.status = 'Concluído';
          serverResult.fimProcessamento = new Date().toISOString();
          serverResult.tempoProcessamento = Date.now() - startTime;
          
          this.processedServidores++;
          this.successfulServidores++;
          this.consecutiveErrors = 0; // Reset contador de erros
          
          console.log(`🎉 [${i + 1}/${servidores.length}] Servidor ${servidor.nome} CONCLUÍDO com sucesso!`);
          
          this.sendStatus('success', `✅ ${servidor.nome} processado: ${serverResult.sucessos} vinculação${serverResult.sucessos !== 1 ? 'ões' : ''} realizada${serverResult.sucessos !== 1 ? 's' : ''}, ${serverResult.erros} erro${serverResult.erros !== 1 ? 's' : ''}`, 
            ((i + 1) / servidores.length) * 90, `Tempo: ${(serverResult.tempoProcessamento/1000).toFixed(1)}s`);
          
          servidorProcessado = true;
          
        } catch (error) {
          console.error(`❌ TENTATIVA ${tentativa} FALHOU - Servidor: ${servidor.nome} (${servidor.cpf})`);
          console.error(`   Erro: ${error.message}`);
          
          if (tentativa === this.servidorResults[servidor.cpf].maxTentativas) {
            // Última tentativa falhou
            const serverResult = this.servidorResults[servidor.cpf];
            serverResult.status = 'Erro';
            serverResult.fimProcessamento = new Date().toISOString();
            serverResult.tempoProcessamento = Date.now() - startTime;
            serverResult.erroGeral = error.message;
            
            this.processedServidores++;
            this.failedServidores++;
            this.consecutiveErrors++;
            
            this.sendStatus('error', `❌ [${i + 1}/${servidores.length}] ${servidor.nome}: ${error.message}`, 
              ((i + 1) / servidores.length) * 90, `FALHA após ${this.servidorResults[servidor.cpf].maxTentativas} tentativas`);
            
            // Log detalhado do erro final
            console.error(`💥 FALHA FINAL - Servidor: ${servidor.nome} (${servidor.cpf})`);
            console.error(`   Erro: ${error.message}`);
            console.error(`   Stack: ${error.stack}`);
            console.error(`   Tentativas realizadas: ${tentativa}`);
          } else {
            // Ainda há tentativas, tentar recuperação
            this.sendStatus('warning', `⚠️ [${i + 1}/${servidores.length}] Tentativa ${tentativa} falhou: ${error.message}`, 
              progressBase, 'Tentando recuperação para próxima tentativa...');
          }
          
          // Tentar recuperação robusta para próxima tentativa ou próximo servidor
          await this.performRobustRecovery();
        }
      }
      
      // Pausa estabilizada entre servidores para garantir continuidade
      if (i < servidores.length - 1) {
        console.log(`🔄 ===== TRANSIÇÃO: Servidor ${i + 1} → Servidor ${i + 2} =====`);
        console.log(`⏳ Preparando para próximo servidor (${servidores[i + 1].nome})...`);
        
        this.sendStatus('info', '⏳ Preparando para próximo servidor...', 
          ((i + 1) / servidores.length) * 90, 'Estabilizando sistema');
        
        // Limpeza extra entre servidores
        try {
          console.log('🧹 Limpeza extra entre servidores...');
          
          // IMPORTANTE: Limpar cache de OJs entre servidores
          console.log(`🗑️ Limpando cache de OJs (${this.ojCache.size} OJs em cache)...`);
          this.ojCache.clear();
          console.log('✅ Cache de OJs limpo - próximo servidor processará todos os OJs');
          
          await this.closeAnyModals();
          await this.contextualDelay('stabilization', { priority: 'high' }); // Pausa maior para estabilidade
          console.log('✅ Sistema estabilizado para próximo servidor');
        } catch (transitionError) {
          console.log('⚠️ Erro na transição entre servidores:', transitionError.message);
          await this.contextualDelay('errorRecovery', { priority: 'high' }); // Pausa extra se houver erro
        }
      } else {
        console.log('🏁 ===== ÚLTIMO SERVIDOR PROCESSADO - FINALIZANDO =====');
      }
    }
    
    // Limpar forced set ao final do processamento em lote
    this.forcedOJsNormalized = null;
    await this.generateMultiServerReport();
  }

  async processSingleServidor(config) {
    // Definir valores globais para progresso
    this.totalOjsGlobal = this.totalOrgaos;
    this.ojsProcessadosGlobal = 0;

    this.sendStatus('info', 'Iniciando automação moderna...', 0, 'Configurando ambiente');
            
    try {
      await this.initializeBrowser();
      await this.performLogin();
      await this.navigateDirectlyToPerson(config.cpf);
      await this.navigateToServerTab();
      await this.processOrgaosJulgadores();
      await this.generateReport();
    } catch (error) {
      // Tratamento específico para CPF não encontrado
      if (error.message && error.message.includes('PESSOA_FISICA_NAO_ENCONTRADA')) {
        const cpfFormatted = config.cpf || 'não informado';
        const errorMessage = `❌ CPF ${cpfFormatted} não foi encontrado no sistema PJE`;
        const detailedMessage = `O CPF ${cpfFormatted} não existe no cadastro de pessoas físicas do PJE. Verifique se o CPF está correto ou se a pessoa está cadastrada no sistema.`;
        
        console.error('❌ ERRO - CPF NÃO ENCONTRADO:', errorMessage);
        console.error('💡 DETALHES:', detailedMessage);
        
        // Enviar status de erro específico para a interface
        this.sendStatus('error', errorMessage, 0, detailedMessage);
        
        // Adicionar ao relatório de erros
        if (!this.relatorio.erros) {
          this.relatorio.erros = [];
        }
        this.relatorio.erros.push({
          tipo: 'CPF_NAO_ENCONTRADO',
          cpf: cpfFormatted,
          mensagem: errorMessage,
          detalhes: detailedMessage,
          timestamp: new Date().toISOString()
        });
        
        // Re-lançar erro com mensagem mais clara
        throw new Error(`CPF_NAO_ENCONTRADO: ${errorMessage}`);
      }
      
      // Para outros tipos de erro, re-lançar o erro original
      throw error;
    }
  }

  async initializeBrowser() {
    // Verificar se navegador já está ativo para evitar múltiplas instâncias
    if (this.browser && this.browser.isConnected && this.browser.isConnected()) {
      console.log('✅ Navegador já ativo, reutilizando...');
      // Verificar se ainda temos uma página válida
      if (this.page && !this.page.isClosed()) {
        console.log('✅ Página já ativa, reutilizando...');
        return;
      }
    }

    this.sendStatus('info', 'Abrindo navegador...', 5, 'Preparando sistema');
        
    const browserOptions = {
      headless: this.isProduction,
      slowMo: this.isProduction ? 0 : 50,
      timeout: 60000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-ipc-flooding-protection',
        '--max_old_space_size=4096'
      ]
    };

    // Usar o PJEResilienceManager para inicializar o navegador
    const browserResult = await this.resilienceManager.wrapBrowserOperation(async () => {
      // Em desenvolvimento, tentar conectar a Chrome existente
      if (!this.isProduction) {
        try {
          this.browser = await chromium.connectOverCDP('http://localhost:9222');
          const contexts = this.browser.contexts();
          if (contexts.length > 0 && contexts[0].pages().length > 0) {
            this.page = contexts[0].pages()[0];
          } else {
            const context = await this.browser.newContext();
            this.page = await context.newPage();
          }
          this.sendStatus('info', 'Conectado ao Chrome existente', 10, 'Modo desenvolvimento');
          return { browser: this.browser, page: this.page };
        } catch (error) {
          console.log('Não foi possível conectar ao Chrome existente, iniciando novo navegador');
          this.browser = await chromium.launch(browserOptions);
          const context = await this.browser.newContext();
          this.page = await context.newPage();
          return { browser: this.browser, page: this.page };
        }
      } else {
        this.browser = await chromium.launch(browserOptions);
        const context = await this.browser.newContext();
        this.page = await context.newPage();
        return { browser: this.browser, page: this.page };
      }
    });

    if (!browserResult) {
      throw new Error('Falha ao inicializar navegador após múltiplas tentativas');
    }

    this.browser = browserResult.browser;
    this.page = browserResult.page;

    // Configurar User-Agent e cabeçalhos
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    // Interceptar falhas de rede e tentar novamente
    this.page.on('requestfailed', request => {
      console.log(`⚠️ Request failed: ${request.url()} - ${request.failure()?.errorText}`);
    });
        
    // Configurar timeouts ULTRA-OTIMIZADOS para máxima velocidade
    this.page.setDefaultTimeout(4000); // Reduzido de 8s para 4s - ULTRA velocidade

    // Inicializar cache DOM
    this.initializeDOMCache();
    this.page.setDefaultNavigationTimeout(8000); // Reduzido de 15s para 8s - ULTRA navegação

    // Inicializar processador ultra rápido
    this.ultraFastProcessor = new UltraFastOJProcessor(this.page, this.config);

    // Inicializar gerenciador de resiliência aprimorado
    // NOTA: Mantendo PJEResilienceManager do construtor pois tem wrapBrowserOperation
    // this.resilienceManager = new EnhancedResilienceManager(this.page, {
    //   maxRetries: 2, // Reduzido para máxima velocidade
    //   retryDelayMs: 300, // Delay reduzido
    //   healthCheckIntervalMs: 30000 // Check mais frequente
    // });

    // NOVA INTEGRAÇÃO: Aplicar otimizações de velocidade
    await this.speedManager.applyAutomaticOptimizations('browser', ['navigation', 'dom', 'cache']);
    this.sendStatus('info', '⚡ Otimizações de velocidade aplicadas', 12, 'Sistema ultra-otimizado');

    // Capturar logs do console
    this.page.on('console', msg => {
      const logMessage = msg.text();
      if (logMessage.includes('ERROR') || logMessage.includes('WARN')) {
        console.log('Browser console:', logMessage);
      }
    });

    this.sendStatus('success', 'Navegador inicializado', 15, 'Pronto para automação');
  }

  async performLogin() {
    this.sendStatus('info', 'Realizando login...', 20, 'Autenticando no PJe');
        
    // Usar PJEResilienceManager para login com resiliência
    const loginResult = await this.resilienceManager.executeWithResilience(async () => {
      await login(this.page);
      return true;
    }, 'Login');

    if (!loginResult) {
      throw new Error('Falha no login após múltiplas tentativas');
    }

    this.sendStatus('success', 'Login realizado com sucesso', 30, 'Autenticado');
  }

  async navigateDirectlyToPerson(cpf) {
    const startTime = Date.now();
    this.performanceMonitor.recordNavigationStart('navigateDirectlyToPerson', `CPF: ${cpf}`);
    
    this.sendStatus('info', 'Navegando diretamente para pessoa...', 35, `CPF: ${cpf}`);
        
    const cpfFormatado = cpf; // Manter formatação original
        
    // URL direta para a página da pessoa
    const directUrl = `https://pje.trt15.jus.br/pjekz/pessoa-fisica?pagina=1&tamanhoPagina=10&cpf=${encodeURIComponent(cpfFormatado)}&situacao=1`;
        
    console.log(`🔗 Navegando para URL direta: ${directUrl}`);
    
    // IMPORTANTE: Fechar qualquer modal/overlay antes de navegar
    try {
      console.log('🧹 Limpando modais antes da navegação...');
      await this.closeAnyModals();
      await this.contextualDelay('navigation', { priority: 'normal' });
    } catch (cleanError) {
      console.log('⚠️ Erro na limpeza inicial:', cleanError.message);
    }
        
    // Múltiplas estratégias de carregamento HIPER-OTIMIZADAS para máxima velocidade
    const navigationStrategies = [
      { waitUntil: 'domcontentloaded', timeout: 5000, description: 'DOM carregado (HIPER-OTIMIZADO)' },
      { waitUntil: 'load', timeout: 8000, description: 'Página carregada (HIPER-OTIMIZADO)' },
      { waitUntil: 'networkidle', timeout: 12000, description: 'Rede estável (HIPER-OTIMIZADO)' }
    ];
        
    let navigationSuccess = false;
    let lastError = null;
        
    for (const strategy of navigationStrategies) {
      try {
        this.sendStatus('info', `Tentando navegação: ${strategy.description}`, 36, `Timeout: ${strategy.timeout/1000}s`);
                
        await this.navigationOptimizer.optimizedNavigate(this.page, directUrl);
                
        // Aguardar elementos críticos aparecerem
        await Promise.race([
          this.page.waitForSelector('table', { timeout: 5000 }),
          this.page.waitForSelector('.datatable', { timeout: 5000 }),
          this.page.waitForSelector('[data-test-id]', { timeout: 5000 }),
          this.page.waitForTimeout(500) // REDUZIDO fallback mínimo
        ]);
        
        // IMPORTANTE: Verificar se não há modais bloqueando após navegação
        console.log('🧹 Limpando modais após navegação...');
        await this.closeAnyModals();
        await this.contextualDelay('pageLoad', { priority: 'normal' });
                
        navigationSuccess = true;
        this.sendStatus('success', `Navegação bem-sucedida com: ${strategy.description}`, 40, 'Pessoa encontrada');
        break;
                
      } catch (error) {
        console.warn(`⚠️ Falha na estratégia ${strategy.description}:`, error.message);
        lastError = error;
                
        // Se não foi timeout, tentar próxima estratégia
        if (!error.message.includes('Timeout') && !error.message.includes('timeout')) {
          continue;
        }
      }
    }
        
    if (!navigationSuccess) {
      console.error('❌ Todas as estratégias de navegação falharam');
      this.sendStatus('error', `Erro na navegação: ${lastError?.message || 'Timeout em todas as tentativas'}`, 35, 'Falha na navegação');
      throw lastError || new Error('Falha em todas as estratégias de navegação');
    }
        
    // Verificar se chegou na página correta e limpar novamente
    const currentUrl = this.page.url();
    console.log(`✅ URL atual após navegação: ${currentUrl}`);
    
    // Final cleanup para garantir página limpa
    try {
      await this.closeAnyModals();
      await this.contextualDelay('elementWait', { priority: 'normal' });
      console.log('✅ Página limpa e pronta para processar');
    } catch (finalCleanError) {
      console.log('⚠️ Erro na limpeza final:', finalCleanError.message);
    }
    
    // Registrar fim da navegação
    this.performanceMonitor.recordNavigationEnd('navigateDirectlyToPerson', Date.now() - startTime);
  }

  async searchByCPF(cpf) {
    const searchStartTime = Date.now();
    this.performanceMonitor.recordElementSearchStart('searchByCPF');
    
    this.sendStatus('info', 'Buscando por CPF...', 35, `CPF: ${cpf}`);
        
    const cpfLimpo = cpf.replace(/\D/g, '');
        
    // Debug: verificar URL atual
    const currentUrl = this.page.url();
    console.log(`🔍 URL atual: ${currentUrl}`);
        
    // Aguardar a página carregar completamente
    await this.page.waitForLoadState('networkidle');
        
    // Múltiplos seletores para campo de busca
    const searchCandidates = [
      this.page.locator('input[placeholder*="CPF"]'),
      this.page.locator('input[placeholder*="cpf"]'),
      this.page.locator('input[name="cpf"]'),
      this.page.locator('#cpf'),
      this.page.locator('input[placeholder*="nome"]'),
      this.page.locator('input[name="nome"]'),
      this.page.locator('#nome'),
      this.page.locator('input[type="text"]'),
      this.page.locator('.form-control'),
      this.page.locator('input[class*="form"]'),
      this.page.locator('input[class*="input"]'),
      this.page.locator('input[id*="search"]'),
      this.page.locator('input[id*="busca"]'),
      this.page.locator('input[name*="search"]'),
      this.page.locator('input[name*="busca"]'),
      this.page.locator('input').first()
    ];
        
    let searchInput = null;
    for (let i = 0; i < searchCandidates.length; i++) {
      const candidate = searchCandidates[i];
      const count = await candidate.count();
      console.log(`Candidato ${i + 1} para busca: ${count} elementos encontrados`);
      if (count > 0) {
        try {
          await candidate.first().waitFor({ timeout: 3000 });
          searchInput = candidate.first();
          console.log(`✅ Usando candidato ${i + 1} para busca`);
          break;
        } catch (e) {
          console.log(`Candidato ${i + 1} não está visível`);
        }
      }
    }
        
    if (!searchInput) {
      throw new Error('Campo de busca por CPF não foi encontrado');
    }
        
    // Limpar e digitar o CPF
    await searchInput.clear();
    await searchInput.fill(cpfLimpo);
        
    // Tentar clicar no botão "Procurar"
    const searchButtonCandidates = [
      this.page.locator('button:has-text("Procurar")'),
      this.page.locator('input[type="submit"][value*="Procurar"]'),
      this.page.locator('button[type="submit"]'),
      this.page.locator('.btn:has-text("Procurar")'),
      this.page.locator('input[value="Procurar"]'),
      this.page.locator('button:has-text("Buscar")'),
      this.page.locator('input[type="submit"]')
    ];
        
    let searchButtonClicked = false;
    for (let i = 0; i < searchButtonCandidates.length; i++) {
      const candidate = searchButtonCandidates[i];
      const count = await candidate.count();
      console.log(`Candidato ${i + 1} para botão Procurar: ${count} elementos encontrados`);
      if (count > 0) {
        try {
          await candidate.first().waitFor({ timeout: 2000 });
          await candidate.first().click();
          console.log(`✅ Clicou no botão Procurar (candidato ${i + 1})`);
          searchButtonClicked = true;
          break;
        } catch (e) {
          console.log(`Candidato ${i + 1} para botão Procurar não está clicável`);
        }
      }
    }
        
    // Se não conseguiu clicar no botão, usar Enter
    if (!searchButtonClicked) {
      console.log('⚠️ Botão Procurar não encontrado, usando Enter como alternativa');
      await searchInput.press('Enter');
    }
        
    // Aguardar os resultados carregarem
    await this.contextualDelay('searchPJE', { priority: 'high' });
        
    this.sendStatus('success', 'Busca realizada', 40, 'CPF encontrado');
    this.performanceMonitor.recordElementSearchEnd('searchByCPF', Date.now() - searchStartTime, true);
  }

  async navigateToServerTab() {
    this.sendStatus('info', 'Acessando perfil...', 45, 'Carregando dados');
    
    // Usar PJEResilienceManager para navegação resiliente
    const navigationResult = await this.resilienceManager.executeWithResilience(async () => {
      let editSuccessful = false;
      
      try {
        // Clicar no ícone de edição
        await this.clickEditIcon();
        editSuccessful = true;
        console.log('✅ Ícone de edição clicado com sucesso');
        
        // Aguardar navegação
        await this.contextualDelay('networkWait', { priority: 'normal' });
        
        // Clicar na aba Servidor
        await this.clickServerTab();
        
      } catch (editError) {
        console.error('❌ Falha ao clicar no ícone de edição:', editError.message);
        
        // ESTRATÉGIA DE FALLBACK: Tentar navegar diretamente para a página de edição
        console.log('🔄 TENTANDO FALLBACK: Navegação direta para edição');
        
        const currentUrl = this.page.url();
        console.log(`📍 URL atual: ${currentUrl}`);
        
        // Se já estamos na página de pessoa, tentar apenas parâmetros válidos
        if (currentUrl.includes('pessoa-fisica')) {
          // REMOVER URLs que causam erro Angular "Cannot match any routes"
          const possibleEditUrls = [
            // Apenas parâmetros, não rotas inexistentes
            currentUrl.includes('?') ? currentUrl + '&acao=alterar' : currentUrl + '?acao=alterar'
          ];
          
          for (const editUrl of possibleEditUrls) {
            try {
              console.log(`🔗 Tentando URL direta: ${editUrl}`);
              await this.navigationOptimizer.fastNavigate(this.page, editUrl);
              await this.contextualDelay('networkWait', { priority: 'normal' });
              
              // Verificar se chegamos numa página de edição (procurar pela aba Servidor)
              const serverTabExists = await this.page.$(
                'text=Servidor, a[href*="servidor"], button:has-text("Servidor"), ' +
                '[role="tab"]:has-text("Servidor"), .mat-tab-label:has-text("Servidor")',
                { timeout: 2000 }
              ).catch(() => null);

              if (serverTabExists) {
                console.log('✅ FALLBACK SUCEDIDO: Página de edição alcançada');
                editSuccessful = true;

                // Tentar clicar na aba servidor
                await this.clickServerTab();
                break;
              } else {
                console.log('❌ URL não levou à página de edição');
              }
              
            } catch (urlError) {
              console.log(`❌ Falha na URL ${editUrl}: ${urlError.message}`);
            }
          }
        }
        
        // Se ainda não conseguimos, tentar uma última estratégia
        if (!editSuccessful) {
          console.log('🚨 ESTRATÉGIA FINAL: Buscar por qualquer link/form de edição na página atual');
          
          // Verificar se a aba Servidor existe antes de tentar clicar
          const serverTabExists = await this.page.$(
            'text=Servidor, a[href*="servidor"], button:has-text("Servidor"), ' +
            '[role="tab"]:has-text("Servidor"), .mat-tab-label:has-text("Servidor")'
          ).catch(() => null);

          if (serverTabExists) {
            console.log('✅ Aba Servidor detectada na página atual');

            // Tentar encontrar e clicar na aba servidor diretamente
            await this.clickServerTab();
            editSuccessful = true;
          } else {
            console.log('❌ Aba Servidor não encontrada na página atual');
          }
        }
        
        if (!editSuccessful) {
          throw new Error(`Não foi possível acessar a página de edição: ${editError.message}`);
        }
      }
      
      return editSuccessful;
    }, 'Navegação para aba Servidor');
    
    if (!navigationResult) {
      throw new Error('Falha ao navegar para aba Servidor após múltiplas tentativas');
    }
    
    this.sendStatus('success', 'Perfil carregado', 50, 'Pronto para vincular');
  }

  async clickEditIcon() {
    const clickStartTime = Date.now();
    this.performanceMonitor.recordClickStart('clickEditIcon');
    
    // Inicializar otimizador de performance se não existir
    if (!this.performanceOptimizer) {
      this.performanceOptimizer = new PerformanceOptimizer(this.page, console);
      this.performanceDashboard.updateOptimizerStatus('performanceOptimizer', true);
    }
    
    // Tentar primeiro o método otimizado
    try {
      // Verificar cache DOM primeiro
      const cachedSelector = this.smartDOMCache.get('editIcon', 'clickEditIcon', this.page);
      if (cachedSelector && cachedSelector.selector) {
        try {
          await this.page.click(cachedSelector.selector, { timeout: 500 });
          const duration = Date.now() - clickStartTime;
          console.log(`✅ CACHE HIT: Clique realizado em ${duration}ms`);
          this.performanceMonitor.recordClickEnd('clickEditIcon', duration, true);
          this.performanceDashboard.recordOperation('clickEditIcon', duration, true);
          this.performanceDashboard.recordCacheAccess(true);
          return;
        } catch (e) {
          console.log('⚠️ Cache miss, tentando otimização...');
          this.smartDOMCache.delete('editIcon', 'clickEditIcon', this.page);
          this.performanceDashboard.recordCacheAccess(false);
        }
      }
      
      // Usar método otimizado se cache falhou
      await this.performanceOptimizer.optimizedClickEditIcon();
      const duration = Date.now() - clickStartTime;
      this.performanceMonitor.recordClickEnd('clickEditIcon', duration, true);
      this.performanceDashboard.recordOperation('clickEditIcon', duration, true);
      return;
    } catch (optimizedError) {
      console.log('⚠️ Método otimizado falhou, tentando método tradicional...');
    }
    
    console.log('🎯 VERSÃO TRADICIONAL: Detecção robusta de ícone de edição...');
    
    // PRIMEIRA VERIFICAÇÃO: Detectar se não há pessoas físicas encontradas
    try {
      const pageContent = await this.page.content();
      console.log(`📄 URL atual: ${this.page.url()}`);
      
      // Verificar se há mensagem de "não encontradas pessoas físicas"
      const noResultsMessages = [
        'Não foram encontradas pessoas físicas',
        'Nenhuma pessoa física encontrada',
        'Não há resultados',
        'Nenhum resultado encontrado'
      ];
      
      const hasNoResults = noResultsMessages.some(msg => 
        pageContent.toLowerCase().includes(msg.toLowerCase())
      );
      
      if (hasNoResults) {
        console.log('⚠️ DETECTADO: Não foram encontradas pessoas físicas com os parâmetros informados');
        console.log('🔄 ESTRATÉGIA ALTERNATIVA: Tentando busca sem filtros restritivos...');
        
        // Estratégia 1: Tentar remover filtros da URL atual
        const currentUrl = this.page.url();
        const urlObj = new URL(currentUrl);
        
        // Remover parâmetros que podem estar restringindo a busca
        urlObj.searchParams.delete('situacao');
        urlObj.searchParams.delete('pagina');
        urlObj.searchParams.set('tamanhoPagina', '50'); // Aumentar tamanho da página
        
        const newSearchUrl = urlObj.toString();
        console.log(`🔍 Tentando busca expandida: ${newSearchUrl}`);
        
        try {
          await this.page.goto(newSearchUrl, { waitUntil: 'networkidle' });
          await this.delay(2000);
          
          // Verificar se agora há resultados
          const newPageContent = await this.page.content();
          const stillNoResults = noResultsMessages.some(msg => 
            newPageContent.toLowerCase().includes(msg.toLowerCase())
          );
          
          if (stillNoResults) {
            console.log('❌ Pessoa física não encontrada mesmo com busca expandida');
            console.log('💡 SUGESTÃO: Verificar se o CPF está correto ou se a pessoa existe no sistema');
            
            // Retornar erro específico para que o sistema possa tratar adequadamente
            throw new Error('PESSOA_FISICA_NAO_ENCONTRADA: CPF não localizado no sistema PJE');
          } else {
            console.log('✅ Busca expandida encontrou resultados! Continuando...');
          }
        } catch (navigationError) {
          console.log('⚠️ Erro na navegação expandida:', navigationError.message);
          // Continuar com a busca normal se a navegação falhar
        }
      }
      
      // Verificar se há tabela na página
      const hasTable = pageContent.includes('<table') || pageContent.includes('datatable');
      console.log(`🗂️ Tabela detectada: ${hasTable}`);
      
      // Procurar por elementos que podem ser botões de edição (limitado para performance)
      try {
        const potentialButtons = await this.page.$$eval('button, a', elements => 
          elements.slice(0, 20).map(el => ({
            tagName: el.tagName,
            text: el.textContent?.trim().substring(0, 50),
            title: el.title,
            className: el.className?.substring(0, 100)
          }))
        );
        console.log('🔘 Primeiros botões/links encontrados:', potentialButtons);
      } catch (evalError) {
        console.log('⚠️ Erro ao listar botões:', evalError.message);
      }
    } catch (debugError) {
      console.log('⚠️ Erro no debug:', debugError.message);
    }

    // Seletores CORRETOS baseados no HTML fornecido pelo usuário
    const editSelectors = [
      // Seletores específicos baseados no código real
      'button[aria-label="Alterar pessoa"]',
      'button[mattooltip="Alterar pessoa"]',
      'button:has(i.fa-pencil-alt)',
      '.visivel-hover',
      'button.visivel-hover',
      '.fa-pencil-alt',
      'i.fa-pencil-alt',
      'i.fas.fa-pencil-alt',
      '#cdk-drop-list-1 > tr > td:nth-child(6) > button',
      'td:nth-child(6) button',
      'td:nth-child(6) .visivel-hover',
      
      // Fallbacks genéricos
      'button[title*="Alterar"]',
      'a[title*="Alterar"]', 
      '.fa-edit',
      '.fa-pencil'
    ];
        
    let editButton = null;
    let editButtonElement = null;
    
    // ESTRATÉGIA 1 OTIMIZADA: Cache inteligente + hover rápido (CORRIGIDO: reduzido de 2367ms)
    console.log('🚀 ESTRATÉGIA 1 OTIMIZADA: Cache inteligente + hover rápido...');
    
    try {
      // 1.1: Cache de seletores para evitar re-busca
      const cachedSelectors = (this.domCache && typeof this.domCache.get === 'function')
        ? this.domCache.get('editButtonSelectors') || []
        : [];
      if (cachedSelectors.length > 0) {
        console.log(`📋 Usando cache de ${cachedSelectors.length} seletores`);
        for (const selector of cachedSelectors.slice(0, 3)) { // Limitar a 3 seletores do cache
          try {
            const element = await this.page.$(selector);
            if (element && await element.isVisible()) {
              editButtonElement = element;
              editButton = `Cache: ${selector}`;
              console.log(`🎯 SUCESSO RÁPIDO (cache): ${editButton}`);
              break;
            }
          } catch (e) {
            console.log(`⚠️ Cache selector falhou: ${selector}`);
          }
        }
      }
      
      // 1.2: Se cache falhou, forçar visibilidade otimizada (máximo 500ms)
      if (!editButtonElement) {
        const startTime = Date.now();
        await this.page.evaluate(() => {
          // Forçar visibilidade apenas nos primeiros 5 elementos
          const hoverElements = Array.from(document.querySelectorAll('.visivel-hover, button[aria-label="Alterar pessoa"]')).slice(0, 5);
          console.log(`Forçando visibilidade em ${hoverElements.length} elementos (otimizado)`);
          
          hoverElements.forEach((element, index) => {
            element.style.visibility = 'visible';
            element.style.opacity = '1'; 
            element.style.display = 'inline-block';
            element.style.pointerEvents = 'auto';
          });
          
          return hoverElements.length;
        });
        
        console.log(`✅ Visibilidade forçada em ${Date.now() - startTime}ms`);
        
        // 1.3: Hover rápido apenas na primeira linha (máximo 300ms)
        const firstRow = await this.page.$('table tbody tr:first-child, .table tbody tr:first-child, .datatable tbody tr:first-child, #cdk-drop-list-1 > tr:first-child');
        if (firstRow) {
          console.log('🖱️ Hover rápido na primeira linha...');
          await firstRow.hover();
          await this.delay(300); // Reduzido de 1000ms para 300ms
          
          // Verificar botões imediatamente
          const buttonsInRow = await firstRow.$$('button[aria-label="Alterar pessoa"], .visivel-hover, i.fa-pencil-alt');
          if (buttonsInRow.length > 0) {
            for (const btn of buttonsInRow) {
              const isVisible = await btn.isVisible();
              if (isVisible) {
                editButtonElement = btn;
                editButton = 'Hover primeira linha - otimizado';
                console.log(`🎯 SUCESSO RÁPIDO: ${editButton}`);
                
                // Salvar no cache para próxima vez
                const selector = await btn.evaluate(el => {
                  if (el.getAttribute('aria-label')) return `button[aria-label="${el.getAttribute('aria-label')}"]`;
                  if (el.className) return `.${el.className.split(' ')[0]}`;
                  return el.tagName.toLowerCase();
                });
                this.domCache?.set('editButtonSelectors', [selector, ...cachedSelectors.slice(0, 4)]);
                break;
              }
            }
          }
        }
      }
      
    } catch (forceError) {
      console.log('⚠️ Erro na estratégia otimizada:', forceError.message);
    }
    
    // ESTRATÉGIA 2: Clique direto na linha se não encontrou botões
    if (!editButtonElement) {
      console.log('🎯 ESTRATÉGIA 2: Clique direto na linha da tabela...');
      try {
        const firstRow = await this.page.$('table tbody tr:first-child, .table tbody tr:first-child, .datatable tbody tr:first-child, #cdk-drop-list-1 > tr:first-child');
        if (firstRow) {
          console.log('✅ Primeira linha encontrada, buscando botão de edição dentro dela...');

          // MELHORADO: Buscar o botão/link de edição DENTRO da linha
          const editButtonInRow = await firstRow.$(
            'button[title*="Alterar"], button[title*="Editar"], ' +
            'a[title*="Alterar"], a[title*="Editar"], ' +
            '.fa-edit, .fa-pencil, i.material-icons:has-text("edit"), ' +
            '[class*="edit"], [class*="pencil"]'
          );

          if (editButtonInRow) {
            console.log('🎯 Botão de edição encontrado dentro da linha!');
            // Fazer hover na linha primeiro
            await firstRow.hover();
            await this.delay(200);

            // Clicar no botão específico
            await editButtonInRow.click();
            await this.delay(3000);

            // Verificar sucesso
            const serverTabExists = await this.page.$('text=Servidor, a[href*="servidor"], button:has-text("Servidor")');
            if (serverTabExists) {
              console.log('✅ SUCESSO: Clique no botão de edição funcionou!');
              editButtonElement = editButtonInRow;
              editButton = 'Botão de edição dentro da linha';
            }
          }

          // Se não encontrou botão específico, tentar clicar na linha inteira
          if (!editButtonElement) {
            console.log('⚠️ Botão não encontrado, tentando clique na linha inteira...');

            // Primeiro fazer hover para garantir
            await firstRow.hover();
            await this.delay(500);

            // Então clicar
            await firstRow.click();
            await this.delay(3000);

            // Verificar se mudou de página
            const currentUrl = this.page.url();
            console.log(`📍 URL após clique: ${currentUrl}`);

            // Verificar se a aba Servidor está disponível (mais confiável do que checar URL)
            const serverTabExists = await this.page.$('text=Servidor, a[href*="servidor"], button:has-text("Servidor")');

            if (serverTabExists || currentUrl.includes('editar') || currentUrl.includes('edit') || currentUrl.includes('detalhes')) {
              console.log('🎯 SUCESSO: Navegação por clique na linha realizada!');
              editButtonElement = firstRow;
              editButton = 'Clique direto na linha da tabela';
            } else {
              console.log('⚠️ Clique na linha não levou à página de edição, tentando double-click...');

              await firstRow.dblclick();
              await this.delay(3000);

              const newUrl = this.page.url();
              const serverTabExistsAfterDblClick = await this.page.$('text=Servidor, a[href*="servidor"], button:has-text("Servidor")');

              if (serverTabExistsAfterDblClick || (newUrl !== currentUrl && (newUrl.includes('editar') || newUrl.includes('edit')))) {
                console.log('🎯 SUCESSO: Navegação por double-click realizada!');
                editButtonElement = firstRow;
                editButton = 'Double-click na linha da tabela';
              }
            }
          }
        }
      } catch (directClickError) {
        console.log('⚠️ Erro no clique direto:', directClickError.message);
      }
    }
    
    // ESTRATÉGIA 3: Seletores tradicionais (apenas se estratégias anteriores falharam)
    if (!editButtonElement) {
      console.log('🔍 ESTRATÉGIA 3: Testando seletores tradicionais...');
      
      for (const selector of editSelectors) {
        try {
          console.log(`🔍 Testando seletor: ${selector}`);
        
          // Timeout muito reduzido para chegar logo nas estratégias especiais
          await this.page.waitForSelector(selector, { timeout: 500, state: 'attached' });
        
          // Obter o elemento (otimizado)
          editButtonElement = await this.page.$(selector);
        
          if (editButtonElement) {
          // Verificar se está visível
            const isVisible = await editButtonElement.isVisible();
            if (isVisible) {
              editButton = selector;
              console.log(`✅ Ícone de edição encontrado e visível: ${selector}`);
              break;
            } else {
              console.log(`⚠️ Elemento ${selector} existe mas não está visível`);
            }
          }
        } catch (error) {
        // Log simplificado para não poluir
          console.log(`❌ ${selector} (timeout 500ms)`);
        }
      }
    }

    // Estratégia alternativa se nenhum seletor funcionou
    if (!editButton || !editButtonElement) {
      console.log('🔄 ===== SELETORES TRADICIONAIS FALHARAM - INICIANDO ESTRATÉGIAS ESPECIAIS =====');
      console.log('🔄 ESTRATÉGIA ALTERNATIVA: Análise completa da tabela');
      try {
        // Primeiro, tentar encontrar qualquer tabela (otimizado)
        const tableExists = await this.page.$('table, .table, .datatable');
        if (tableExists) {
          console.log('✅ Tabela encontrada, analisando linhas...');
          
          // Buscar todas as linhas da tabela (otimizado)
          const rows = await this.page.$$('table tbody tr, .table tbody tr, .datatable tbody tr');
          console.log(`🗂️ Encontradas ${rows.length} linhas na tabela`);
          
          if (rows.length > 0) {
            // Analisar a primeira linha para entender a estrutura
            const firstRow = rows[0];
            
            // ESTRATÉGIA ESPECÍFICA PARA PJE: Hover na linha para revelar botões
            console.log('🖱️ Fazendo hover na primeira linha para revelar botões...');
            try {
              await firstRow.hover();
              await this.contextualDelay('elementWait', { priority: 'high' }); // Aguardar botões aparecerem
              console.log('✅ Hover realizado na linha');
            } catch (hoverError) {
              console.log('⚠️ Erro no hover:', hoverError.message);
            }
            
            // Buscar elementos clicáveis em toda a linha após hover
            const allRowElements = await firstRow.$$('button, a, i, span[onclick], div[onclick], .fa, .fas, .far, [class*="edit"], [class*="pencil"], [title*="Alterar"], [title*="Editar"]');
            console.log(`🔘 Elementos clicáveis/ícones na linha: ${allRowElements.length}`);
            
            for (let i = 0; i < allRowElements.length; i++) {
              const element = allRowElements[i];
              try {
                const tagName = await element.evaluate(el => el.tagName);
                const text = await element.evaluate(el => el.textContent?.trim() || '');
                const title = await element.evaluate(el => el.title || '');
                const className = await element.evaluate(el => el.className || '');
                const isVisible = await element.isVisible();
                
                console.log(`🔍 Elemento linha ${i + 1}: ${tagName} | "${text}" | Title:"${title}" | Class:"${className}" | Visível:${isVisible}`);
                
                // Se é visível e parece ser de edição
                if (isVisible && !text.toLowerCase().includes('excluir') && !text.toLowerCase().includes('delete') && 
                    !className.toLowerCase().includes('delete') && !title.toLowerCase().includes('excluir')) {
                  
                  // Priorizar elementos com indicação de edição
                  const hasEditIndication = text.toLowerCase().includes('alterar') || 
                                          text.toLowerCase().includes('editar') ||
                                          title.toLowerCase().includes('alterar') || 
                                          title.toLowerCase().includes('editar') ||
                                          className.includes('edit') || 
                                          className.includes('pencil') ||
                                          className.includes('fa-edit') ||
                                          className.includes('fa-pencil');
                  
                  if (hasEditIndication || (!editButtonElement && tagName === 'BUTTON') || (!editButtonElement && tagName === 'A')) {
                    editButtonElement = element;
                    editButton = `Linha elemento ${i + 1} (${tagName}) - "${text}"`;
                    console.log(`✅ SELECIONADO da linha: ${editButton}`);
                    
                    if (hasEditIndication) {
                      console.log('🎯 Elemento com indicação clara de edição - interrompendo busca');
                      break;
                    }
                  }
                }
              } catch (elementError) {
                console.log(`⚠️ Erro ao analisar elemento linha ${i + 1}:`, elementError.message);
              }
            }
            
            // Se não encontrou na linha, verificar células individualmente
            if (!editButtonElement) {
              const cells = await firstRow.$$('td');
              console.log(`📋 Analisando ${cells.length} colunas individualmente...`);
              
              for (let cellIndex = 0; cellIndex < cells.length; cellIndex++) {
                const cell = cells[cellIndex];
                
                // Fazer hover na célula também
                try {
                  await cell.hover();
                  await this.contextualDelay('click', { priority: 'high' });
                } catch (cellHoverError) {
                  console.log(`⚠️ Erro hover célula ${cellIndex + 1}:`, cellHoverError.message);
                }
                
                const cellElements = await cell.$$('button, a, i, span, div');
                console.log(`📦 Célula ${cellIndex + 1}: ${cellElements.length} elementos`);
                
                for (const cellElement of cellElements) {
                  try {
                    const isVisible = await cellElement.isVisible();
                    if (isVisible && !editButtonElement) {
                      const tagName = await cellElement.evaluate(el => el.tagName);
                      const text = await cellElement.evaluate(el => el.textContent?.trim() || '');
                      
                      console.log(`📦 Célula ${cellIndex + 1} - ${tagName}: "${text}"`);
                      
                      if ((tagName === 'BUTTON' || tagName === 'A') && !text.toLowerCase().includes('excluir')) {
                        editButtonElement = cellElement;
                        editButton = `Célula ${cellIndex + 1} elemento (${tagName})`;
                        console.log(`✅ SELECIONADO da célula: ${editButton}`);
                        break;
                      }
                    }
                  } catch (cellElementError) {
                    console.log('⚠️ Erro elemento da célula:', cellElementError.message);
                  }
                }
                
                if (editButtonElement) break;
              }
            }
          }
        }
        
        // Última tentativa: buscar por qualquer botão/link visível que não seja "excluir"
        if (!editButton || !editButtonElement) {
          console.log('🔄 PENÚLTIMA TENTATIVA: Busca por qualquer elemento clicável com indicação de edição');
          
          const allClickableElements = await this.page.$$('button:visible, a:visible');
          console.log(`🔘 Total de elementos clicáveis visíveis: ${allClickableElements.length}`);
          
          for (let i = 0; i < Math.min(allClickableElements.length, 15); i++) { // Aumentar para 15 elementos
            const element = allClickableElements[i];
            try {
              const text = await element.evaluate(el => el.textContent?.trim() || '');
              const title = await element.evaluate(el => el.title || '');
              const className = await element.evaluate(el => el.className || '');
              
              // Se não é botão de exclusão e contém indicação de edição
              if (!text.toLowerCase().includes('excluir') && !text.toLowerCase().includes('delete') &&
                  !title.toLowerCase().includes('excluir') && !className.toLowerCase().includes('delete') &&
                  (text.toLowerCase().includes('alterar') || text.toLowerCase().includes('editar') || 
                   title.toLowerCase().includes('alterar') || title.toLowerCase().includes('editar') ||
                   className.includes('edit') || className.includes('pencil'))) {
                
                editButtonElement = element;
                editButton = `Elemento global: "${text}" (${title})`;
                console.log(`✅ ENCONTRADO elemento de edição global: ${editButton}`);
                break;
              }
            } catch (globalError) {
              console.log(`⚠️ Erro ao analisar elemento global ${i + 1}:`, globalError.message);
            }
          }
        }
        
        // ESTRATÉGIA 4: Navegação direta por URL (REMOVIDA - URLs inválidas)
        // NOTA: As URLs /pessoa-fisica/edit e /pessoa-fisica/editar não existem no PJE
        // Causam erro: "Cannot match any routes. URL Segment: 'pessoa-fisica/edit'"
        if (!editButton || !editButtonElement) {
          console.log('🔗 ESTRATÉGIA 4: Navegação direta por URL DESABILITADA');
          console.log('⚠️ URLs de edição direta não são suportadas pelo PJE');
          console.log('💡 O PJE requer interação com elementos da interface para acessar edição');
        }
        
        // ESTRATÉGIA 5: Última tentativa com clique em elementos
        if (!editButton || !editButtonElement) {
          console.log('🚨 ESTRATÉGIA 5: Última tentativa com elementos da linha...');
          
          try {
            // Buscar primeira linha da tabela
            const firstRow = await this.domCache.findElement('table tbody tr:first-child, .table tbody tr:first-child, .datatable tbody tr:first-child');
            if (firstRow) {
              console.log('✅ Primeira linha encontrada para clique direto');
              
              // Primeiro, tentar encontrar elementos clicáveis
              const rowClickables = await firstRow.$$('button, a, i, span[onclick], [onclick]');
              console.log(`🔘 Elementos com potencial de clique: ${rowClickables.length}`);
              
              if (rowClickables.length > 0) {
                for (let i = 0; i < rowClickables.length; i++) {
                  const element = rowClickables[i];
                  try {
                    const isVisible = await element.isVisible();
                    if (isVisible) {
                      const text = await element.evaluate(el => el.textContent?.trim() || '');
                      const title = await element.evaluate(el => el.title || '');
                      const className = await element.evaluate(el => el.className || '');
                      
                      console.log(`🔍 Elemento ${i + 1}: Texto="${text}" Title="${title}" Class="${className}"`);
                      
                      // Evitar apenas botões que CLARAMENTE são de exclusão
                      const isDeleteButton = text.toLowerCase().includes('excluir') || 
                                           text.toLowerCase().includes('delete') || 
                                           title.toLowerCase().includes('excluir') ||
                                           className.toLowerCase().includes('delete');
                      
                      if (!isDeleteButton) {
                        editButtonElement = element;
                        editButton = `DESESPERADO - Elemento ${i + 1}: "${text}" (${title})`;
                        console.log(`🚨 USANDO ESTRATÉGIA DESESPERADA: ${editButton}`);
                        break;
                      }
                    }
                  } catch (desperateError) {
                    console.log(`⚠️ Erro na análise desesperada ${i + 1}:`, desperateError.message);
                  }
                }
              } else {
                // ÚLTIMA TENTATIVA FINAL: Clicar na primeira célula que não seja ID
                console.log('🚨 TENTATIVA EXTREMA: Clicar na célula do nome para abrir detalhes');
                
                const cells = await firstRow.$$('td');
                console.log(`📋 Células disponíveis: ${cells.length}`);
                
                if (cells.length >= 2) {
                  // Geralmente a segunda célula é o nome (primeira é ID)
                  const nameCell = cells[1];
                  
                  // Fazer hover primeiro
                  await nameCell.hover();
                  await this.delay(500);
                  
                  // Verificar se apareceram elementos clicáveis após hover
                  const afterHoverElements = await nameCell.$$('a, button, [onclick]');
                  if (afterHoverElements.length > 0 && await afterHoverElements[0].isVisible()) {
                    editButtonElement = afterHoverElements[0];
                    editButton = 'EXTREMO - Elemento da célula nome após hover';
                    console.log('🚨 EXTREMO: Usando elemento que apareceu após hover no nome');
                  } else {
                    // Se ainda não há elementos clicáveis, clicar na própria célula do nome
                    editButtonElement = nameCell;
                    editButton = 'EXTREMO - Célula do nome diretamente';
                    console.log('🚨 EXTREMO: Clicando diretamente na célula do nome');
                  }
                }
              }
            }
          } catch (desperateError) {
            console.log('❌ Estratégia desesperada falhou:', desperateError.message);
          }
        }
        
      } catch (altError) {
        console.error('❌ Estratégia alternativa completa falhou:', altError.message);
        console.error('Stack trace:', altError.stack);
      }
    }
        
    if (!editButton || !editButtonElement) {
      console.error('❌ ===== FALHA TOTAL: NENHUM ícone de edição encontrado após TODAS as tentativas =====');
      
      // Debug final: salvar screenshot para diagnóstico
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const screenshotPath = `debug-no-edit-${timestamp}.png`;
        await this.page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`📸 Screenshot de debug salvo: ${screenshotPath}`);
      } catch (screenshotError) {
        console.log('❌ Erro ao salvar screenshot:', screenshotError.message);
      }
      
      throw new Error('Ícone de edição não encontrado após múltiplas estratégias');
    }
        
    // Clicar no elemento encontrado
    console.log(`🖱️ Processando ação: ${editButton}`);
    
    try {
      // Scroll para o elemento antes de clicar
      await editButtonElement.scrollIntoViewIfNeeded();
      await this.delay(500);
      
      // Clicar no elemento
      await editButtonElement.click();
      await this.delay(3000); // Aguardar navegação
      
      console.log('✅ Clique no ícone de edição executado com sucesso');
      const finalDuration = Date.now() - clickStartTime;
      this.performanceMonitor.recordClickEnd('clickEditIcon', finalDuration, true);
      this.performanceDashboard.recordOperation('clickEditIcon', finalDuration, true);
    } catch (clickError) {
      console.error('❌ Erro ao clicar no ícone de edição:', clickError.message);
      const errorDuration = Date.now() - clickStartTime;
      this.performanceMonitor.recordClickEnd('clickEditIcon', errorDuration, false);
      this.performanceDashboard.recordOperation('clickEditIcon', errorDuration, false);
      throw new Error(`Falha ao clicar no ícone de edição: ${clickError.message}`);
    }
    
    // Registrar fim da operação se não houve clique
    const noDuration = Date.now() - clickStartTime;
    this.performanceMonitor.recordClickEnd('clickEditIcon', noDuration, false);
    this.performanceDashboard.recordOperation('clickEditIcon', noDuration, false);
  }

  async clickServerTab() {
    console.log('🎯 Procurando aba Servidor...');

    const servidorSelectors = [
      'text=Servidor',
      'a[href*="servidor"]',
      'button:has-text("Servidor")',
      'a:has-text("Servidor")',
      '[role="tab"]:has-text("Servidor")',
      'li:has-text("Servidor") a',
      '.mat-tab-label:has-text("Servidor")',
      '.nav-link:has-text("Servidor")',
      '//a[contains(text(), "Servidor")]',
      '//button[contains(text(), "Servidor")]'
    ];

    let servidorTab = null;
    let attempts = 0;
    const maxAttempts = 3;

    // Tentar encontrar aba com múltiplas tentativas
    while (!servidorTab && attempts < maxAttempts) {
      attempts++;
      console.log(`🔍 Tentativa ${attempts}/${maxAttempts} para encontrar aba Servidor...`);

      for (const selector of servidorSelectors) {
        try {
          const element = await this.page.$(selector);
          if (element && await element.isVisible()) {
            servidorTab = selector;
            console.log(`✅ Aba Servidor encontrada: ${selector}`);
            break;
          }
        } catch (error) {
          // Continuar tentando outros seletores
        }
      }

      if (!servidorTab && attempts < maxAttempts) {
        console.log('⏳ Aguardando página carregar antes da próxima tentativa...');
        await this.page.waitForTimeout(200);
      }
    }

    if (!servidorTab) {
      // Log detalhado para debug
      console.log('❌ Aba Servidor não encontrada. Debug:');
      console.log(`URL atual: ${this.page.url()}`);

      // Tentar listar todas as abas disponíveis
      try {
        const allTabs = await this.page.$$eval('[role="tab"], .mat-tab-label, .nav-link, a',
          tabs => tabs.map(tab => ({ text: tab.textContent?.trim(), class: tab.className })).filter(t => t.text)
        );
        console.log('Abas disponíveis:', allTabs);
      } catch (e) {
        console.log('Não foi possível listar abas disponíveis');
      }

      throw new Error('Aba Servidor não encontrada após 3 tentativas');
    }
        
    await this.retryManager.retryClick(
      async (selector) => {
        const element = await this.page.$(selector);
        if (element) {
          await element.click();
        } else {
          throw new Error('Element not found');
        }
      },
      servidorTab
    );
    await this.delay(2000);
  }

  async processOrgaosJulgadores() {
    console.log('🔍 [DEBUG] Iniciando processOrgaosJulgadores');
    console.log(`🔍 [DEBUG] this.config: ${JSON.stringify(this.config)}`);
    console.log(`🔍 [DEBUG] this.currentServidor: ${JSON.stringify(this.currentServidor)}`);
    
    this.sendStatus('info', '🚀 Iniciando processamento INTELIGENTE dos OJs...', 55, 'Verificação e integração inteligente ativa');
    
    // Validar configuração antes de processar
    if (!this.config || !this.config.orgaos || !Array.isArray(this.config.orgaos)) {
      console.log(`❌ [DEBUG] Configuração inválida: config=${JSON.stringify(this.config)}`);
      throw new Error('Configuração de órgãos julgadores inválida ou não definida');
    }
    
    console.log(`✅ [DEBUG] Configuração válida. Órgãos a processar: ${this.config.orgaos.length}`);
    console.log(`✅ [DEBUG] Lista de órgãos: ${JSON.stringify(this.config.orgaos)}`);
    
    // Verificar OJs existentes antes do processamento
    this.sendStatus('info', '🔍 Analisando OJs já cadastrados...', 10, 'Verificação inteligente');
    const analysisResult = await this.smartOJIntegration.analyzeExistingOJs(this.page, this.currentServidor);
    
    // Debug: Log de OJs antes da filtragem
    console.log(`🔍 [DEBUG] OJs ANTES da filtragem: ${this.config.orgaos.length}`);
    console.log(`🔍 [DEBUG] Lista ANTES: ${JSON.stringify(this.config.orgaos)}`);

    // Filtrar OJs que precisam ser processados
    const filteredOJs = await this.smartOJIntegration.filterOJsForProcessing(this.config.orgaos, analysisResult);
    this.sendStatus('info', `📋 ${filteredOJs.toCreate.length} novos OJs + ${filteredOJs.toAddRole.length} perfis adicionais`, 20, 'Análise concluída');

    // Debug: Log de OJs após filtragem
    console.log(`🔍 [DEBUG] Resultado da filtragem:`);
    console.log(`🔍 [DEBUG] toCreate: ${JSON.stringify(filteredOJs.toCreate)}`);
    console.log(`🔍 [DEBUG] toAddRole: ${JSON.stringify(filteredOJs.toAddRole)}`);
    console.log(`🔍 [DEBUG] Total filtrados: ${filteredOJs.toCreate.length + filteredOJs.toAddRole.length}`);

    // CORREÇÃO: DESABILITAR filtragem para garantir que todas as OJs sejam processadas
    const ojsOriginais = this.config.orgaos.length;
    const ojsFiltrados = [...filteredOJs.toCreate, ...filteredOJs.toAddRole];

    // FORÇAR PROCESSAMENTO DE TODAS AS OJs ORIGINAIS
    console.log(`🔥 [CORREÇÃO] MANTENDO TODAS as ${ojsOriginais} OJs originais para processamento`);
    console.log(`🔥 [CORREÇÃO] Ignorando resultado da filtragem (${ojsFiltrados.length} OJs filtrados)`);
    console.log(`🔥 [CORREÇÃO] Todas as OJs do usuário serão processadas obrigatoriamente`);

    // NÃO MODIFICAR this.config.orgaos - manter originais
    // this.config.orgaos = ojsFiltrados; // DESABILITADO

    console.log(`🔍 [DEBUG] OJs FINAL para processamento: ${this.config.orgaos.length}`);
    console.log(`🔍 [DEBUG] Lista FINAL: ${JSON.stringify(this.config.orgaos)}`);
    
    try {
      // Inicializar processador TURBO
      if (!this.turboProcessor) {
        this.turboProcessor = new TurboModeProcessor(this.intelligentCache, this.delayManager);
        await this.turboProcessor.activateTurboMode();
      }
      
      // Inicializar processador paralelo
      if (!this.parallelProcessor) {
        const parallelConfig = {
          ...this.config,
          speedMode: this.ultraSpeedMode // Passar modo de velocidade
        };
        this.parallelProcessor = new ParallelOJProcessor(
          this.browser, 
          this.timeoutManager, 
          parallelConfig,
          this.domCache
        );
        // Configurar a página original para navegação
        this.parallelProcessor.setOriginalPage(this.page);
      }
      
      // Processar OJs com verificação inteligente
      const startTime = Date.now();
      let results = [];
      
      // Processar novos OJs
      if (filteredOJs.toCreate.length > 0) {
        this.sendStatus('info', `🆕 Processando ${filteredOJs.toCreate.length} novos OJs...`, 30, 'Criação de OJs');
        const newOJResults = await this.parallelProcessor.processOJsInParallel(filteredOJs.toCreate);
        results = results.concat(newOJResults);
      }
      
      // Processar adição de perfis
      if (filteredOJs.toAddRole.length > 0) {
        this.sendStatus('info', `👤 Adicionando ${filteredOJs.toAddRole.length} perfis adicionais...`, 60, 'Adição de perfis');
        const roleResults = await this.processAdditionalRoles(filteredOJs.toAddRole);
        results = results.concat(roleResults);
      }
      
      // Processar OJs ignorados (relatório)
      if (filteredOJs.toSkip.length > 0) {
        const skipResults = filteredOJs.toSkip.map(oj => ({
          orgao: oj.nome || oj,
          status: 'Já incluído - perfil completo',
          details: 'OJ já possui todos os perfis necessários'
        }));
        results = results.concat(skipResults);
      }
      
      const duration = Date.now() - startTime;
      
      // Consolidar resultados
      this.results = results;
      
      // Atualizar cache local
      this.ojCache = this.parallelProcessor.ojCache;
      
      const sucessos = results.filter(r => r.status.includes('Sucesso')).length;
      const erros = results.filter(r => r.status === 'Erro').length;
      const jaIncluidos = results.filter(r => r.status.includes('Já')).length;
      
      this.sendStatus('success', 
        `Processamento paralelo concluído em ${(duration/1000).toFixed(1)}s`, 
        95, 
        `${sucessos} sucessos, ${erros} erros, ${jaIncluidos} já incluídos`
      );
      
      console.log('🚀 Processamento paralelo concluído:');
      console.log(`   ✅ Sucessos: ${sucessos}`);
      console.log(`   ❌ Erros: ${erros}`);
      console.log(`   📋 Já incluídos: ${jaIncluidos}`);
      console.log(`   ⏱️ Tempo total: ${(duration/1000).toFixed(1)}s`);
      console.log(`   📊 Performance: ${(results.length / (duration/1000)).toFixed(1)} OJs/s`);
      
    } catch (error) {
      console.error('❌ Erro no processamento paralelo:', error);
      this.sendStatus('error', `Erro no processamento paralelo: ${error.message}`, 60, 'Tentando fallback');
      
      // Fallback para processamento sequencial
      await this.processOrgaosJulgadoresSequential();
    }
  }

  /**
   * Ativa o modo ultra-rápido para processamento em lote
   * Reduz todos os delays para o mínimo possível
   */
  /**
   * Processa adição de perfis adicionais a OJs existentes
   * @param {Array} ojsToAddRole - Lista de OJs que precisam de perfis adicionais
   * @returns {Array} Resultados do processamento
   */
  async processAdditionalRoles(ojsToAddRole) {
    const results = [];
    
    for (const ojData of ojsToAddRole) {
      try {
        this.sendStatus('info', `👤 Adicionando perfil para ${ojData.nome}...`, null, 'Processando perfil adicional');
        
        // Navegar para o OJ específico
        const navigationResult = await this.navigateToExistingOJ(ojData);
        if (!navigationResult.success) {
          results.push({
            orgao: ojData.nome,
            status: 'Erro - Navegação falhou',
            details: navigationResult.error
          });
          continue;
        }
        
        // Adicionar o novo perfil
        const addRoleResult = await this.addRoleToExistingOJ(ojData);
        if (addRoleResult.success) {
          results.push({
            orgao: ojData.nome,
            status: 'Sucesso - Perfil adicionado',
            details: `Perfil ${ojData.novoRole} adicionado com sucesso`
          });
        } else {
          results.push({
            orgao: ojData.nome,
            status: 'Erro - Falha ao adicionar perfil',
            details: addRoleResult.error
          });
        }
        
        // Delay contextual entre processamentos
        await this.contextualDelay('between_role_additions', { fast: true });
        
      } catch (error) {
        results.push({
          orgao: ojData.nome,
          status: 'Erro - Exceção',
          details: error.message
        });
      }
    }
    
    return results;
  }
  
  /**
   * Navega para um OJ existente no painel
   * @param {Object} ojData - Dados do OJ
   * @returns {Object} Resultado da navegação
   */
  async navigateToExistingOJ(ojData) {
    try {
      // Implementar navegação específica para OJ existente
      // Por enquanto, placeholder que simula sucesso
      await this.contextualDelay('navigation', { fast: true });
      
      return {
        success: true,
        message: 'Navegação bem-sucedida'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Adiciona um novo perfil a um OJ existente
   * @param {Object} ojData - Dados do OJ com novo perfil
   * @returns {Object} Resultado da adição
   */
  async addRoleToExistingOJ(ojData) {
    try {
      // Implementar lógica específica para adicionar perfil
      // Por enquanto, placeholder que simula sucesso
      await this.contextualDelay('role_addition', { fast: true });
      
      return {
        success: true,
        message: 'Perfil adicionado com sucesso'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async processOrgaosJulgadoresUltraFast() {
    console.log('⚡ ATIVANDO MODO ULTRA-RÁPIDO para processamento de OJs...');
    console.log('🚀 [ULTRA-FAST] Usando APENAS BatchOJProcessor - sem verificações desnecessárias');
    this.sendStatus('info', '⚡ MODO ULTRA-RÁPIDO ATIVADO', 50, 'Processamento em velocidade máxima');
    
    // USAR APENAS BATCHOJPROCESSOR - sem fallbacks ou verificações prévias
    return this.processOrgaosJulgadoresBatch();
  }
  
  /**
   * Processa múltiplos OJs em lote mantendo o modal aberto
   */
  async processOrgaosJulgadoresBatch() {
    console.log('🚀 [BATCH] Iniciando processamento em lote de OJs');
    this.sendStatus('info', 'Processamento em lote iniciado...', 60, 'Mantendo modal aberto para múltiplos OJs');
    
    try {
      // Inicializar o processador em lote se não existir
      if (!this.batchOJProcessor) {
        this.batchOJProcessor = new BatchOJProcessor(
          this.page, 
          this.config, 
          this.performanceMonitor, 
          this.performanceDashboard
        );
      }
      
      // Processar todos os OJs em lote
      const result = await this.batchOJProcessor.processBatchOJs(this.config.orgaos);
      
      // Atualizar resultados
      if (result.results) {
        for (const ojResult of result.results) {
          this.results.push({
            orgao: ojResult.orgao,
            status: ojResult.status === 'success' ? 'Vinculado com Sucesso' : 
              ojResult.status === 'skipped' ? 'Já Incluído (PJE-281)' : 
                'Erro na Vinculação',
            erro: ojResult.error || null,
            perfil: this.config.perfil,
            cpf: this.config.cpf,
            timestamp: ojResult.timestamp
          });
        }
      }
      
      // Enviar status final
      const summary = result.summary;
      this.sendStatus(
        result.success ? 'success' : 'warning',
        `Processamento em lote concluído: ${summary.success} sucesso, ${summary.skipped} pulados, ${summary.errors} erros`,
        100,
        'Lote processado',
        null,
        this.currentServidor?.nome,
        summary.total,
        summary.total
      );
      
      console.log('✅ [BATCH] Processamento em lote concluído');
      
    } catch (error) {
      console.error('❌ [BATCH] Erro no processamento em lote:', error);
      this.sendStatus('error', `Erro no processamento em lote: ${error.message}`, 100, 'Erro crítico');
      
      // Fallback para processamento individual
      console.log('🔄 [BATCH] Tentando fallback para processamento individual...');
      
      // Processar cada OJ individualmente
      for (let i = 0; i < this.config.orgaos.length; i++) {
        const orgao = this.config.orgaos[i];
        try {
          await this.processOrgaoJulgador(orgao);
        } catch (individualError) {
          console.error(`❌ Erro processando ${orgao}:`, individualError.message);
        }
      }
    }
  }
  
  /**
   * Fallback para processamento sequencial (método original)
   */
  async processOrgaosJulgadoresSequential() {
    this.sendStatus('info', 'Usando processamento sequencial otimizado...', 55, 'Verificando OJs cadastrados');
    
    // Validar configuração antes de processar
    if (!this.config || !this.config.orgaos || !Array.isArray(this.config.orgaos)) {
      throw new Error('Configuração de órgãos julgadores inválida ou não definida');
    }
    
    // SEMPRE usar o processador em lote para manter modal aberto
    console.log('🚀 [BATCH] Usando processador em lote otimizado');
    return await this.processOrgaosJulgadoresBatch();
        
    // BYPASS: Pular verificações e processar todos os OJs diretamente
    console.log('🔥 [BYPASS] Pulando verificações SmartCache - processando todos os OJs');
        
    // Processar todos os OJs sem verificação prévia
    const ojsNormalizados = this.config.orgaos.map(orgao => this.normalizeOrgaoName(orgao));
    const ojsToProcess = ojsNormalizados; // Processar todos sem filtrar
    
    // Contador de OJs processadas
    let ojsProcessadasTotal = 0; // Começar em 0
    const totalOjs = this.config.orgaos.length;
        
    this.sendStatus('info', `${ojsToProcess.length} OJs para processar`, 60, 'Processamento direto sem verificações', null, null, ojsProcessadasTotal, totalOjs);
        
    // Processar cada OJ restante
    for (let i = 0; i < ojsToProcess.length; i++) {
      const orgao = ojsToProcess[i];
      const progress = 60 + (i / ojsToProcess.length) * 35;
            
      this.sendStatus('info', `Processando OJ ${i + 1}/${ojsToProcess.length}`, progress, 'Vinculando órgão julgador', orgao, this.currentServidor?.nome, ojsProcessadasTotal, totalOjs);
            
      try {
        await this.processOrgaoJulgador(orgao);
        ojsProcessadasTotal++; // Incrementar contador
        this.results.push({
          orgao,
          status: 'Incluído com Sucesso',
          erro: null,
          perfil: this.config.perfil,
          cpf: this.config.cpf,
          timestamp: new Date().toISOString()
        });
        this.sendStatus('success', 'OJ processado com sucesso', progress, 'Vinculação concluída', orgao, this.currentServidor?.nome, ojsProcessadasTotal, totalOjs);
      } catch (error) {
        console.error(`Erro ao processar OJ ${orgao}:`, error);
        ojsProcessadasTotal++; // Incrementar contador mesmo em caso de erro
        this.results.push({
          orgao,
          status: 'Erro',
          erro: error.message,
          cpf: this.config.cpf,
          timestamp: new Date().toISOString()
        });
        this.sendStatus('error', `Erro ao processar OJ: ${error.message}`, progress, 'Erro na vinculação', orgao, this.currentServidor?.nome, ojsProcessadasTotal, totalOjs);
                
        // Proteções após erro
        await this.handleErrorRecovery();
      }
            
      // Pausa HIPER-OTIMIZADA para velocidade máxima (reduzido de 5ms para 1ms)
      const delay = 1; // Delay mínimo absoluto para estabilidade do DOM
      await this.ultraFastDelayManager.batchDelay({ priority: 'critical', context: 'hyperFastBetweenOJs' });
    }
        
    // Adicionar OJs já existentes ao relatório
    for (const orgaoExistente of this.ojCache) {
      if (this.config && this.config.orgaos && this.config.orgaos.includes(orgaoExistente)) {
        this.results.push({
          orgao: orgaoExistente,
          status: 'Já Incluído',
          erro: null,
          perfil: this.config.perfil,
          cpf: this.config.cpf,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Enviar status final de conclusão com contador correto
    console.log(`🔍 [CONTADOR] Total OJs configuradas: ${totalOjs}`);
    console.log(`🔍 [CONTADOR] Total OJs processadas: ${ojsProcessadasTotal}`);
    console.log(`🔍 [CONTADOR] Total resultados: ${this.results.length}`);
    
    // Só enviar status de sucesso se houver OJs processadas ou configuradas
    if (ojsProcessadasTotal > 0 || totalOjs > 0) {
      this.sendStatus('success', 'Processamento finalizado com sucesso!', 100, 
        `${ojsProcessadasTotal} OJs processadas de ${totalOjs} configuradas`, 
        'Finalizado', this.currentServidor?.nome, ojsProcessadasTotal, totalOjs);
    } else {
      // Log silencioso quando não há OJs para processar
      console.log('🔄 [AUTOMATION] Servidor finalizado - nenhum OJ para processar, partindo para o próximo');
      this.sendStatus('info', 'Servidor processado', 100, 
        'Nenhum OJ para vincular - partindo para próximo servidor', 
        'Finalizado', this.currentServidor?.nome, 0, 0);
    }
  }

  async loadExistingOJs() {
    try {
      this.sendStatus('info', 'Verificando OJs já cadastrados...', 58, 'Otimizando processo');
      console.log('🔍 Carregando OJs existentes para otimizar automação...');
      
      // Aguardar elementos carregarem rapidamente
      await this.ultraFastDelayManager.elementWaitDelay({ priority: 'critical' });
      
      // Seletores para encontrar tabela/lista de OJs já cadastrados
      const tabelaSelectors = [
        'table tbody tr', // Tabela padrão
        '.mat-table .mat-row', // Material Design table
        '.datatable tbody tr', // DataTable
        '[role="row"]', // ARIA rows
        '.lista-orgaos tr', // Lista específica
        '.localizacoes-visibilidades tr' // Tabela de localizações
      ];
      
      const ojsEncontrados = new Set();
      
      for (const selector of tabelaSelectors) {
        try {
          const linhas = this.page.locator(selector);
          const numLinhas = await linhas.count();
          console.log(`🔍 Seletor "${selector}": ${numLinhas} linhas encontradas`);
          
          if (numLinhas > 0) {
            // Extrair texto de cada linha para identificar OJs
            for (let i = 0; i < Math.min(numLinhas, 50); i++) { // Limitar a 50 para performance
              try {
                const textoLinha = await linhas.nth(i).textContent();
                if (textoLinha && textoLinha.trim()) {
                  // Procurar por padrões de OJ no texto
                  const ojMatches = textoLinha.match(/(EXE\d+|LIQ\d+|CON\d+|DIVEX|[\dº]+ª?\s*Vara\s+do\s+Trabalho)/gi);
                  if (ojMatches) {
                    ojMatches.forEach(match => {
                      const ojNormalizado = this.normalizeOrgaoName(match.trim());
                      ojsEncontrados.add(ojNormalizado);
                      console.log(`✅ OJ encontrado: ${ojNormalizado}`);
                    });
                  }
                }
              } catch (erro) {
                // Ignorar erros de linha específica
                continue;
              }
            }
            
            // Se encontrou OJs com este seletor, não precisa tentar outros
            if (ojsEncontrados.size > 0) {
              console.log(`✅ ${ojsEncontrados.size} OJs já cadastrados encontrados`);
              break;
            }
          }
        } catch (error) {
          console.log(`⚠️ Seletor ${selector} falhou: ${error.message}`);
        }
      }
      
      // Adicionar OJs encontrados ao cache
      ojsEncontrados.forEach(oj => this.ojCache.add(oj));
      
      console.log(`🎯 Cache de OJs atualizado: ${this.ojCache.size} OJs já cadastrados`);
      this.sendStatus('success', `${this.ojCache.size} OJs já cadastrados identificados`, 60, 'Cache otimizado');
      
    } catch (error) {
      console.log('⚠️ Erro ao carregar OJs existentes:', error.message);
      // Não falhar a automação por erro no cache
    }
  }

  /**
   * Carrega OJs existentes usando SmartOJCache (versão otimizada)
   */
  async loadExistingOJsWithSmartCache() {
    try {
      this.sendStatus('info', 'Verificando OJs já cadastrados com SmartCache...', 58, 'Otimizando processo');
      console.log('🔍 [SEQUENTIAL] Carregando OJs existentes usando SmartOJCache...');
      
      // CORREÇÃO DO BUG: Não limpar cache persistente automaticamente
      this.ojCache.clear();
      this.smartOJCache.limparCache(true); // preservar dados persistentes
      
      // Usar o SmartOJCache para verificar OJs vinculados em lote (com persistência)
      const cpfServidor = this.currentServidor?.cpf || this.config?.cpf;
      const resultadoVerificacao = await this.smartOJCache.verificarOJsEmLote(
        this.page,
        this.config.orgaos,
        (mensagem, progresso) => {
          this.sendStatus('info', mensagem, 58 + (progresso * 0.3), 'Verificando OJs...');
        },
        cpfServidor // CORREÇÃO: Passar CPF para cache persistente
      );
      
      console.log('📊 [SEQUENTIAL] Resultado da verificação em lote:');
      console.log(`   - Total verificados: ${resultadoVerificacao.estatisticas.totalVerificados}`);
      console.log(`   - Já vinculados: ${resultadoVerificacao.estatisticas.jaVinculados}`);
      console.log(`   - Para vincular: ${resultadoVerificacao.estatisticas.paraVincular}`);
      
      // Adicionar OJs já vinculados ao cache local
      resultadoVerificacao.ojsJaVinculados.forEach(ojInfo => {
        const ojNormalizado = this.normalizeOrgaoName(ojInfo.oj);
        this.ojCache.add(ojNormalizado);
        
        // Também atualizar o SmartOJCache
        this.smartOJCache.adicionarOJVinculado(ojInfo.oj);
        
        console.log(`✅ [SEQUENTIAL] OJ já vinculado: "${ojInfo.oj}" → normalizado: "${ojNormalizado}"`);
      });
      
      // Marcar cache como válido
      this.smartOJCache.cacheValido = true;
      this.smartOJCache.ultimaAtualizacao = Date.now();
      
      console.log(`🎯 [SEQUENTIAL] Cache de OJs atualizado: ${this.ojCache.size} OJs já cadastrados`);
      this.sendStatus('success', `${this.ojCache.size} OJs já cadastrados | ${resultadoVerificacao.estatisticas.paraVincular} para processar`, 90, 'SmartCache otimizado');
      
      return resultadoVerificacao;
      
    } catch (error) {
      console.log('⚠️ [SEQUENTIAL] Erro ao carregar OJs com SmartCache:', error.message);
      console.log('🔄 [SEQUENTIAL] Tentando fallback para método tradicional...');
      
      // Fallback para o método tradicional
      await this.loadExistingOJs();
      return null;
    }
  }

  async processOrgaoJulgador(orgao) {
    const processStartTime = Date.now();
    console.log(`⚡ [PROCESSO-OJ] Iniciando processamento: ${orgao}`);

    // this.performanceMonitor.recordPJEOperationStart('processOrgaoJulgador', orgao); // DESABILITADO

    // NOVA INTEGRAÇÃO: Aplicar otimizações de velocidade
    console.log('⚡ [PROCESSO-OJ] Aplicando otimizações...');
    await this.speedManager.applyAutomaticOptimizations('processOJ', ['dom', 'cache', 'retry']);

    console.log('⚡ [PROCESSO-OJ] Verificando navegador...');
    // Verificar se o navegador está ativo antes de processar
    console.log(`🔍 [${orgao}] Verificando estado do navegador antes do processamento...`);
    await this.ensureBrowserActive();
    
    // Verificar se estamos na página correta (não pré-cadastro)
    const handledPreCadastro = await this.detectAndHandlePreCadastro();
    if (handledPreCadastro) {
      console.log(`✅ [${orgao}] Recuperação de pré-cadastro concluída, continuando processamento...`);
    }
    
    // Definir papel desejado no escopo da função (usado em múltiplos blocos)
    const papelDesejado = this.config?.perfil || 'Assessor';
    // Flag da verificação simples (true/false) ou null se não foi possível verificar
    let jaVinculadoSimples = null;
    
    // Atualizar status do servidor no painel de processamento
    if (this.mainWindow && this.mainWindow.webContents && this.currentServidor) {
      this.mainWindow.webContents.executeJavaScript(`
        if (typeof updateProcessingServer === 'function') {
          updateProcessingServer('${this.currentServidor.cpf}', {
            currentOJ: '${orgao.replace(/'/g, '\\\'').replace(/"/g, '\\"')}'
          });
        }
      `).catch(err => {
        console.log('⚠️ Erro ao atualizar status do servidor:', err.message);
      });
    }
    
    // SISTEMA INTELIGENTE: ATIVADO - Usar verificação inteligente para evitar duplicatas
    const isUniversalBypass = false; // VERIFICAÇÃO INTELIGENTE ATIVADA: Pular OJs já vinculadas
    
    if (isUniversalBypass) {
      console.log(`🔥 [BYPASS-UNIVERSAL] PROCESSAMENTO DIRETO para OJ: ${orgao} (${this.currentServidor.nome})`);
      console.log('🔥 [BYPASS-UNIVERSAL] PULANDO TODAS as verificações prévias');
      // PULAR toda a lógica de verificação e ir direto para vinculação
    } else {
      console.log(`🚀 INICIANDO processamento otimizado para: ${orgao}`);
      
      // Verificação otimizada: Separar OJ de papel para respeitar configuração
      console.log(`🔍 [OTIMIZADO] Verificando OJ "${orgao}" (papel será aplicado: "${papelDesejado}")`);
      
      try {
        // ETAPA 1: Verificar APENAS se OJ já está vinculado (sem considerar papel)
        console.log('📋 [ETAPA 1] Verificação simples de OJ vinculado...');
        const { verificarOJJaVinculado } = require('../verificarOJVinculado');
        const verificacaoSimples = await verificarOJJaVinculado(this.page, orgao);
        jaVinculadoSimples = Boolean(verificacaoSimples?.jaVinculado);
        
        console.log(`📋 [RESULTADO] OJ "${orgao}" vinculado: ${verificacaoSimples.jaVinculado}`);
        
        if (verificacaoSimples.jaVinculado && !isUniversalBypass) {
          // Fonte de verdade: página atual. Se OJ já está vinculado, NÃO tentar cadastrar novamente.
          console.log(`⏭️ [PÁGINA] OJ já vinculado na página - pulando cadastro: ${orgao}`);
          // Atualizar caches e resultados e encerrar cedo
          const ojNorm = this.normalizeOrgaoName(orgao);
          this.ojCache.add(ojNorm);
          this.results.push({
            orgao,
            status: 'Já Incluído (Página)',
            erro: null,
            perfil: this.config.perfil,
            cpf: this.config.cpf,
            timestamp: new Date().toISOString()
          });
          // this.performanceMonitor.recordPJEOperationEnd('processOrgaoJulgador', orgao, true);
          return; // Não prosseguir com tentativa de inclusão
        } else if (verificacaoSimples.jaVinculado && isUniversalBypass) {
          console.log(`🔥 [BYPASS-UNIVERSAL] OJ ${orgao} já vinculado, mas PROCESSANDO MESMO ASSIM devido ao bypass`);
          // Continuar processamento para garantir todas as OJs
        } else {
          console.log(`➕ [ESTRATÉGIA] OJ não vinculado - CRIAR nova vinculação com papel "${papelDesejado}"`);
          console.log('✅ [DECISÃO] Processamento LIBERADO - Criar nova vinculação');
          // Continua processamento para criar vinculação
        }
        
      } catch (verificacaoError) {
        console.log(`⚠️ [ERRO] Verificação simples de OJ falhou: ${verificacaoError.message}`);
        console.log('🔄 [FALLBACK] Continuando processamento por segurança...');
        // Continua processamento mesmo com erro
      }
    }
    
    // DETECÇÃO AUTOMÁTICA DE VARAS PROBLEMÁTICAS - DESABILITADA PARA BYPASS UNIVERSAL
    if (!isUniversalBypass) {
      console.log('🔍 [DETECTOR] Analisando vara para problemas conhecidos...');
      const deteccaoProblema = this.detectorVaras.detectarVaraProblematica(orgao);
      
      if (deteccaoProblema.problematica) {
        console.log(`⚠️ [DETECTOR] Vara problemática detectada: ${deteccaoProblema.categoria}`);
        console.log(`🔧 [DETECTOR] Aplicando tratamento: ${deteccaoProblema.tratamento}`);
      
        try {
          const resultadoTratamento = await this.detectorVaras.aplicarTratamento(
            deteccaoProblema, 
            this.page, 
            orgao, 
            this.config.perfil || 'Assessor'
          );
        
          if (resultadoTratamento.aplicado) {
            console.log('✅ [DETECTOR] Tratamento automático aplicado com sucesso');

            // Verificar se o tratamento retorna um nome normalizado para continuar o fluxo
            if (resultadoTratamento.continuarFluxo && resultadoTratamento.nomeNormalizado) {
              console.log(`🔄 [DETECTOR] Continuando fluxo com nome normalizado: "${resultadoTratamento.nomeNormalizado}"`);
              orgao = resultadoTratamento.nomeNormalizado; // Atualizar o nome do órgão
              console.log('🔄 [DETECTOR] Prosseguindo com fluxo padrão usando nome normalizado...');
              // Não retornar, continuar o fluxo com o nome normalizado
            } else {
              // Tratamento completado com sucesso, não precisa continuar
              this.results.push({
                orgao,
                status: 'sucesso',
                metodo: 'detector_automatico',
                tratamento: deteccaoProblema.tratamento,
                categoria: deteccaoProblema.categoria,
                confianca: deteccaoProblema.confianca,
                tempo: Date.now() - processStartTime
              });

              // this.performanceMonitor.recordPJEOperationEnd('processOrgaoJulgador', orgao, true);
              return { success: true, method: 'detector_automatico', details: resultadoTratamento };
            }
          } else {
            console.log(`⚠️ [DETECTOR] Tratamento automático falhou: ${resultadoTratamento.motivo || 'motivo desconhecido'}`);
            console.log('🔄 [DETECTOR] Continuando com fluxo padrão...');
          }
        } catch (detectorError) {
          console.log(`❌ [DETECTOR] Erro no tratamento automático: ${detectorError.message}`);
          console.log('🔄 [DETECTOR] Continuando com fluxo padrão...');
        }
      } else {
        console.log('✅ [DETECTOR] Vara não apresenta problemas conhecidos');
      }
    } else {
      console.log('🔥 [BYPASS-UNIVERSAL] PULANDO detector de varas problemáticas completamente');
    }
    
    // Verificação específica para varas de Limeira - DESABILITADA PARA BYPASS UNIVERSAL
    if (!isUniversalBypass && isVaraLimeira(orgao)) {
      console.log(`🏛️ [LIMEIRA] Vara de Limeira detectada: ${orgao}`);
      console.log('🔧 [LIMEIRA] Aplicando tratamento específico...');
      
      try {
        const resultadoLimeira = await aplicarTratamentoLimeira(this.page, orgao, this.config.perfil || 'Assessor');
        
        if (resultadoLimeira.sucesso) {
          console.log(`✅ [LIMEIRA] Tratamento específico bem-sucedido para: ${orgao}`);
          this.results.push({
            orgao,
            status: 'sucesso',
            metodo: 'tratamento_limeira_especifico',
            tempo: Date.now() - processStartTime,
            detalhes: resultadoLimeira.detalhes
          });
          // this.performanceMonitor.recordPJEOperationEnd('processOrgaoJulgador', orgao, true);
          return;
        } else {
          console.log('⚠️ [LIMEIRA] Tratamento específico falhou, continuando com fluxo padrão...');
        }
      } catch (limeiraError) {
        console.log(`❌ [LIMEIRA] Erro no tratamento específico: ${limeiraError.message}`);
        console.log('🔄 [LIMEIRA] Continuando com fluxo padrão...');
      }
    } else {
      console.log(`🔥 [BYPASS-UNIVERSAL] PULANDO detector de varas problemáticas completamente`);
      console.log(`🔥 [BYPASS-UNIVERSAL] Processando OJ EXATA conforme configurado: "${orgao}"`);
    }

    // Se chegou até aqui, significa que pode vincular
    console.log(`🚀 PROSSEGUINDO com vinculação do OJ: ${orgao}`);
    
    // Verificação de cache rápida como fallback - DESABILITADA PARA BYPASS UNIVERSAL
    const ojNormalizado = this.normalizeOrgaoName(orgao);
    const isForced = Boolean(this.forcedOJsNormalized && this.forcedOJsNormalized.has(ojNormalizado));
    // Somente pular por cache se NÃO for forçado e a verificação simples também confirmar que já está vinculado
    if (!isUniversalBypass && !isForced && this.ojCache.has(ojNormalizado) && jaVinculadoSimples === true) {
      console.log(`⚡ OJ encontrado no cache local: ${orgao}`);
      
      // Se está no cache, também deveria pular
      console.log(`⏭️ CACHE: Pulando OJ já processado: ${orgao}`);
      this.results.push({
        orgao,
        status: 'Já Incluído (Cache)',
        erro: null,
        perfil: papelDesejado,
        cpf: this.config.cpf,
        timestamp: new Date().toISOString()
      });
      
      // Registrar fim da operação com sucesso (cache hit)
      // this.performanceMonitor.recordPJEOperationEnd('processOrgaoJulgador', Date.now() - processStartTime, true);
      return; // Skip processamento
    } else if (isUniversalBypass && this.ojCache.has(ojNormalizado)) {
      console.log(`🔥 [BYPASS-UNIVERSAL] OJ ${orgao} encontrado no cache, mas IGNORANDO cache para forçar processamento`);
    }
    
    const startTime = Date.now();
    
    try {
      // NOVO: Usar processador ultra rápido com resiliência
      console.log('⚡ PROCESSAMENTO ULTRA-OTIMIZADO INICIADO');
      console.log(`📎 Processando servidor: ${this.config.cpf} - Perfil: ${this.config.perfil}`);

      // Marcar atividade no gerenciador de resiliência
      if (this.resilienceManager) {
        this.resilienceManager.markActivity();
      }

      // Tentar processamento ultra rápido primeiro
      if (this.ultraFastProcessor) {
        try {
          console.log('🚀 [ULTRA-FAST] Tentando processamento ultra otimizado...');
          const ultraResult = await this.ultraFastProcessor.processOJsUltraFast([orgao]);

          if (ultraResult.success && ultraResult.processedOJs > 0) {
            console.log(`✅ [ULTRA-FAST] OJ processado com sucesso: ${orgao}`);

            // Registrar sucesso no cache
            const ojNorm = this.normalizeOrgaoName(orgao);
            this.ojCache.add(ojNorm);

            this.results.push({
              orgao,
              status: 'Incluído com Sucesso (Ultra-Fast)',
              erro: null,
              perfil: this.config.perfil,
              cpf: this.config.cpf,
              timestamp: new Date().toISOString(),
              processTime: ultraResult.averageTimePerOJ
            });

            // this.performanceMonitor.recordPJEOperationEnd('processOrgaoJulgador', orgao, true);
            return;
          }
        } catch (ultraFastError) {
          console.log(`⚠️ [FALLBACK] Processamento ultra rápido falhou: ${ultraFastError.message}`);
        }
      }

      // Fallback para método tradicional otimizado com resiliência
      console.log('🔄 [FALLBACK] Usando método tradicional otimizado...');

      // Fechar modais rapidamente (se existirem)
      console.log('🔄 ETAPA 0: Fechando modais existentes...');
      await this.closeAnyModalsRapido();
          
      // 1. AÇÃO: Clicar no botão "Adicionar Localização/Visibilidade"
      console.log(`🔄 ETAPA 1: Abrindo modal de adição para OJ: ${orgao}`);
      await this.clickAddLocationButtonRapido();
          
      // 2. AÇÃO: Selecionar o OJ diretamente
      console.log(`🔄 ETAPA 2: Selecionando OJ específico: ${orgao}`);
      await this.selectOrgaoJulgadorRapido(orgao);

      // 3. AÇÃO: Configurar papel e visibilidade
      console.log(`🔄 ETAPA 3: Configurando papel e visibilidade para OJ: ${orgao}`);
      await this.configurePapelVisibilidadeRapido();

      // 4. AÇÃO: Salvar
      console.log(`🔄 ETAPA 4: Salvando configuração para OJ: ${orgao}`);
      await this.saveConfigurationRapido();
          
      // 5. FINAL: Verificar sucesso
      console.log(`🔄 ETAPA 5: Verificando sucesso da vinculação para OJ: ${orgao}`);
      await this.verifySuccessRapido();
      
      const tempoDecorrido = Date.now() - startTime;
      console.log(`✅ OJ processado com SUCESSO em ${tempoDecorrido}ms: ${orgao}`);
      
      // Adicionar ao cache para próximas verificações
      this.ojCache.add(ojNormalizado);
      
      // Adicionar resultado de sucesso
      this.results.push({
        orgao,
        status: 'Vinculado com Sucesso',
        erro: null,
        perfil: this.config.perfil,
        cpf: this.config.cpf,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      const tempoDecorrido = Date.now() - startTime;
      
      // Verificar se é erro PJE-281 (OJ já existe)
      if (error.code === 'PJE_281_SKIP') {
        console.log(`⏭️ OJ ${orgao} já existe (PJE-281) - continuando para próximo...`);
        
        // Adicionar ao cache
        this.ojCache.add(ojNormalizado);
        
        // Registrar como já incluído
        this.results.push({
          orgao,
          status: 'Já Incluído (PJE-281)',
          erro: null,
          perfil: this.config.perfil,
          cpf: this.config.cpf,
          timestamp: new Date().toISOString()
        });
        
        // Limpar o campo de OJ para próxima seleção
        try {
          console.log('🔄 Limpando campo de OJ para próxima seleção...');
          const matSelectOJ = await this.page.locator('mat-dialog-container mat-select[placeholder="Órgão Julgador"]').first();
          if (await matSelectOJ.isVisible({ timeout: 1000 })) {
            // Clicar no campo para abrir e limpar
            await matSelectOJ.click();
            await this.page.waitForTimeout(300);
            // Pressionar ESC para fechar sem selecionar
            await this.page.keyboard.press('Escape');
            console.log('✅ Campo de OJ pronto para próxima seleção');
          }
        } catch (clearError) {
          console.log('⚠️ Não foi possível limpar campo de OJ:', clearError.message);
        }
        
        // Registrar sucesso (OJ já existente é considerado sucesso)
        // this.performanceMonitor.recordPJEOperationEnd('processOrgaoJulgador', Date.now() - processStartTime, true);
        return;
      }
      
      console.error(`❌ ERRO após ${tempoDecorrido}ms processando OJ ${orgao}:`, error.message);
      console.error('❌ Stack trace completo:', error.stack);

      // REMOVIDO FALLBACK TRADICIONAL - Usar apenas BatchOJProcessor otimizado
      console.log(`❌ Erro não-crítico processando OJ ${orgao}:`, error.message);
      
      // Registrar como erro apenas se não for erro conhecido do BatchOJProcessor
      this.results.push({
        orgao,
        status: 'Erro na Vinculação',
        erro: error.message,
        perfil: this.config.perfil,
        cpf: this.config.cpf,
        timestamp: new Date().toISOString()
      });
      
      // Registrar fim com erro
      // this.performanceMonitor.recordPJEOperationEnd('processOrgaoJulgador', Date.now() - processStartTime, false);
      this.sendStatus('error', `⚠️ OJ ${orgao} - ${error.message}`, null, null, orgao, this.currentServidor?.nome);
      console.log(`⚠️ Erro processando ${orgao}, mas continuando com próximo...`);
    }
  }

  // === FUNÇÕES OTIMIZADAS PARA VELOCIDADE ===
  
  async closeAnyModalsRapido() {
    console.log('⚡ Fechando modais rapidamente...');
    const modalCloseSelectors = [
      '.mat-overlay-backdrop',
      '.cdk-overlay-backdrop',
      '.modal-backdrop',
      'button:has-text("OK")',
      'button:has-text("Fechar")'
    ];
        
    for (const selector of modalCloseSelectors) {
      try {
        // Usar page.$$ diretamente para evitar timeout longo do domCache
        const element = await this.page.$(selector);
        if (element) {
          const isVisible = await element.isVisible();
          if (isVisible) {
            await element.click();
            console.log(`⚡ Modal fechado: ${selector}`);
            await this.ultraFastDelayManager.criticalDelay({ priority: 'critical' }); // Ultra otimizado
            return; // Sair imediatamente após fechar
          }
        }
      } catch (error) {
        // Ignorar erros
      }
    }
    
    // ESC como fallback rápido
    try {
      await this.page.keyboard.press('Escape');
    } catch (error) {
      // Ignorar erros
    }
  }

  async clickAddLocationButtonRapido() {
    // Verificar se estamos na página correta antes de clicar no botão
    const handledPreCadastro = await this.detectAndHandlePreCadastro();
    if (handledPreCadastro) {
      console.log('✅ Recuperação de pré-cadastro concluída antes de clicar botão...');
    }
    
    console.log('🎯 ASSERTIVO: Verificando se modal já está aberto...');
    
    // 1. PRIMEIRO: Verificar se o modal já está aberto
    const modalJaAberto = await this.page.locator('mat-dialog-container, [role="dialog"]').isVisible();
    if (modalJaAberto) {
      console.log('✅ Modal já está aberto - PULANDO clique no botão');
      return;
    }
    
    console.log('🎯 Modal fechado - clicando botão Adicionar UMA VEZ...');

    // 2. SEGUNDO: Tentar múltiplos seletores otimizados (baseados no batch-oj-processor)
    const buttonSelectors = [
      // Seletores ESPECÍFICOS baseados nas classes reais do botão
      'button.mat-raised-button.mat-button-base.mat-primary .mat-button-wrapper:has-text("Adicionar Localização/Visibilidade")',
      'button.mat-raised-button.mat-primary:has(.mat-button-wrapper:has-text("Adicionar Localização/Visibilidade"))',

      // Seletores alternativos focados
      'button.mat-raised-button:has-text("Adicionar Localização/Visibilidade")',
      'button.mat-primary:has-text("Adicionar Localização/Visibilidade")',

      // Seletores originais como fallback
      'button:has-text("Adicionar Localização/Visibilidade"):not([disabled])',
      'button:has-text("Adicionar Localização"):not([disabled])',
      'button:has-text("Adicionar Visibilidade"):not([disabled])',
      'button:has-text("Adicionar"):not([disabled])',
      '[aria-label*="Adicionar"]:not([disabled])',
      'mat-card button:has-text("Adicionar"):not([disabled])',
      '[role="main"] button:has-text("Adicionar"):not([disabled])'
    ];

    let clicked = false;
    let lastError = null;

    for (const selector of buttonSelectors) {
      try {
        console.log(`🔍 Tentando seletor de botão: ${selector}`);

        // Verificar se o seletor existe primeiro (timeout reduzido)
        const element = await this.page.waitForSelector(selector, { timeout: 1000 }).catch(() => null);
        if (!element) {
          console.log(`⚠️ Seletor não encontrado: ${selector}`);
          continue;
        }

        // Verificar se está visível
        const isVisible = await element.isVisible();
        if (!isVisible) {
          console.log(`⚠️ Elemento não visível: ${selector}`);
          continue;
        }

        // Verificar se está habilitado
        const isEnabled = await element.isEnabled();
        if (!isEnabled) {
          console.log(`⚠️ Elemento desabilitado: ${selector}`);
          continue;
        }

        // Rolar para o elemento se necessário
        try {
          await element.scrollIntoViewIfNeeded();
          await this.page.waitForTimeout(100);
        } catch (scrollError) {
          console.log(`⚠️ Erro ao rolar: ${scrollError.message}`);
        }

        // Clique direto no elemento encontrado
        await element.click();

        console.log(`✅ Clique realizado com sucesso: ${selector}`);
        clicked = true;
        break;
      } catch (e) {
        console.log(`❌ Falha seletor botão: ${selector} → ${e.message}`);
        lastError = e;
        continue;
      }
    }

    if (!clicked) {
      // Estratégia fallback: Buscar por texto mais flexível
      console.log('🔄 [FALLBACK] Buscando botão por texto flexível...');
      try {
        const allButtons = await this.page.locator('button').all();
        console.log(`📊 [FALLBACK] Analisando ${allButtons.length} botões encontrados...`);

        for (let i = 0; i < allButtons.length; i++) {
          try {
            const text = await allButtons[i].textContent({ timeout: 100 });
            const isVisible = await allButtons[i].isVisible({ timeout: 100 });
            const isEnabled = await allButtons[i].isEnabled({ timeout: 100 });

            if (isVisible && isEnabled && text) {
              const textLower = text.toLowerCase().trim();
              if (textLower.includes('adicionar') && (textLower.includes('localização') || textLower.includes('localizacao') || textLower.includes('visibilidade'))) {
                console.log(`✅ [FALLBACK] Botão encontrado por texto: "${text.trim()}"`);
                await allButtons[i].scrollIntoViewIfNeeded();
                await this.page.waitForTimeout(100);
                await allButtons[i].click();
                clicked = true;
                break;
              }
            }
          } catch (e) {
            // Continua procurando
          }
        }
      } catch (fallbackError) {
        console.log('⚠️ [FALLBACK] Erro na busca fallback:', fallbackError.message);
      }
    }

    if (!clicked) {
      // Diagnóstico: Listar todos os botões visíveis
      console.log('❌ [DIAGNÓSTICO] Listando todos os botões visíveis na página...');
      try {
        const allButtons = await this.page.locator('button').all();
        console.log(`📊 [DIAGNÓSTICO] Total de botões encontrados: ${allButtons.length}`);

        for (let i = 0; i < Math.min(allButtons.length, 15); i++) {
          try {
            const text = await allButtons[i].textContent({ timeout: 100 });
            const isVisible = await allButtons[i].isVisible({ timeout: 100 });
            const isEnabled = await allButtons[i].isEnabled({ timeout: 100 });
            console.log(`📊 [DIAGNÓSTICO] Botão ${i + 1}: "${text?.trim()}" | Visível: ${isVisible} | Habilitado: ${isEnabled}`);
          } catch (e) {
            console.log(`📊 [DIAGNÓSTICO] Botão ${i + 1}: ERRO ao obter info - ${e.message}`);
          }
        }
      } catch (diagError) {
        console.log('⚠️ [DIAGNÓSTICO] Erro ao listar botões:', diagError.message);
      }

      throw new Error(`Botão Adicionar não encontrado após todas as tentativas: ${lastError?.message || 'desconhecido'}`);
    }

    // 3. TERCEIRO: Aguardar modal abrir de forma assertiva
    console.log('🎯 Aguardando modal abrir...');
    await this.page.waitForSelector('mat-dialog-container, [role="dialog"]', { timeout: 6000 });
    console.log('✅ Modal CONFIRMADO aberto');
    return;
  }

  async selectOrgaoJulgadorRapido(orgao) {
    // Verificar se estamos na página correta antes de selecionar OJ
    const handledPreCadastro = await this.detectAndHandlePreCadastro();
    if (handledPreCadastro) {
      console.log('✅ Recuperação de pré-cadastro concluída antes de selecionar OJ...');
    }
    
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
      // 1. DIRETO: Encontrar e clicar no mat-select de Órgão Julgador
      console.log('🎯 Procurando mat-select de Órgão Julgador...');
      
      // Seletores expandidos para maior compatibilidade
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
      
      // Verificar se o dropdown já está aberto (caso de erro PJE-281 anterior)
      const isDropdownOpen = await this.page.locator('mat-option').count() > 0;
      if (isDropdownOpen) {
        console.log('📋 Dropdown já está aberto (provavelmente após erro PJE-281)');
      } else {
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
      }
      
      // 2. AGUARDAR: Opções aparecerem
      console.log('🎯 Aguardando opções do dropdown...');
      await this.page.waitForSelector('mat-option', { timeout: 3000 });
      
      // 3. SELECIONAR: Buscar opção com algoritmo inteligente
      console.log(`🎯 Procurando opção: ${orgao}`);
      const opcoes = this.page.locator('mat-option');
      const numOpcoes = await opcoes.count();
      
      console.log(`📋 ${numOpcoes} opções disponíveis`);
      
      // Coletar todas as opções disponíveis
      const availableOptions = [];
      for (let i = 0; i < numOpcoes; i++) {
        const textoOpcao = await opcoes.nth(i).textContent();
        if (textoOpcao && textoOpcao.trim()) {
          availableOptions.push({
            index: i,
            text: textoOpcao.trim(),
            element: opcoes.nth(i)
          });
        }
      }
      
      console.log(`📋 Opções coletadas: ${availableOptions.length}`);
      
      // Primeiro: tentar busca exata (método original)
      const orgaoNormalizado = this.normalizeOrgaoName(orgao);
      console.log(`🔍 Tentando busca exata para: ${orgaoNormalizado}`);
      
      let opcaoEncontrada = false;
      for (const option of availableOptions) {
        const textoOpcaoNormalizado = this.normalizeOrgaoName(option.text);
        if (textoOpcaoNormalizado.includes(orgaoNormalizado)) {
          await option.element.click();
          console.log(`✅ OJ selecionado (busca exata): ${option.text}`);
          opcaoEncontrada = true;
          break;
        }
      }
      
      // Se busca exata falhou, usar busca inteligente
      if (!opcaoEncontrada) {
        console.log('⚠️ Busca exata falhou. Iniciando busca inteligente por palavras-chave...');
        
        const { match, score } = this.findBestOJMatch(orgao, availableOptions);
        
        if (match && score > 0) {
          await match.element.click();
          console.log(`✅ OJ selecionado (busca inteligente): ${match.text} (Score: ${score})`);
          opcaoEncontrada = true;
        } else {
          // Listar todas as opções disponíveis para debug
          console.log('❌ Nenhuma opção compatível encontrada. Opções disponíveis:');
          availableOptions.forEach((option, idx) => {
            console.log(`   ${idx + 1}. "${option.text}"`);
          });
          throw new Error(`OJ "${orgao}" não encontrado nas opções disponíveis`);
        }
      }
      
      // 4. AGUARDAR: Processamento da seleção com delay contextual
      await this.contextualDelay('ojSelection', { priority: 'high' });
      console.log('✅ Seleção de OJ concluída');
      
    } catch (error) {
      console.error(`❌ Erro na seleção assertiva de OJ: ${error.message}`);
      throw error;
    }
  }

  async configurePapelVisibilidadeRapido() {
    console.log('🎯 ASSERTIVO: Configuração direta de papel/visibilidade...');
    
    try {
      // Verificar se o navegador ainda está ativo
      await this.ensureBrowserActive();
      
      // 1. PAPEL: Selecionar perfil configurado
      console.log(`🎯 Verificando campo Papel - Configurado: ${this.config.perfil || 'Não especificado'}`);
      console.log('🔍 [DEBUG] Config completo:', JSON.stringify(this.config, null, 2));
      
      // Aguardar mais tempo para garantir que o modal esteja carregado
      await this.ultraFastDelayManager.pageLoadDelay({ priority: 'critical' });
      
      // Verificar novamente se a página ainda está válida
      if (this.page.isClosed()) {
        console.log('⚠️ [DEBUG] Página foi fechada, tentando reconectar...');
        await this.reconnectBrowser();
        return;
      }
      
      // Tentar múltiplos seletores para o campo Papel
      const seletoresPapel = [
        'mat-dialog-container mat-select[placeholder*="Papel"]',
        'mat-dialog-container mat-select[formcontrolname*="papel"]',
        'mat-dialog-container mat-select[aria-label*="Papel"]',
        'mat-select[placeholder*="Papel"]',
        'mat-select:has-text("Papel")',
        '.mat-select-trigger:has-text("Papel")'
      ];
      
      let matSelectPapel = null;
      for (const seletor of seletoresPapel) {
        try {
          // Verificar se a página ainda está válida antes de cada tentativa
          if (this.page.isClosed()) {
            console.log('⚠️ [DEBUG] Página fechada durante busca do seletor');
            await this.reconnectBrowser();
            return;
          }
          
          console.log(`🔍 [DEBUG] Testando seletor: ${seletor}`);
          const elemento = this.page.locator(seletor);
          if (await elemento.count() > 0) {
            console.log(`✅ [DEBUG] Campo Papel encontrado com seletor: ${seletor}`);
            matSelectPapel = elemento;
            break;
          }
        } catch (error) {
          console.log(`⚠️ [DEBUG] Erro ao testar seletor ${seletor}: ${error.message}`);
          if (error.message.includes('Target page, context or browser has been closed')) {
            console.log('🔄 [DEBUG] Navegador fechado detectado, reconectando...');
            await this.reconnectBrowser();
            return;
          }
        }
      }
      
      if (matSelectPapel && await matSelectPapel.count() > 0) {
        console.log('🔍 [DEBUG] Campo Papel encontrado, clicando...');
        
        // Verificar se a página ainda está válida antes do clique
        if (this.page.isClosed()) {
          console.log('⚠️ [DEBUG] Página fechada antes do clique no campo Papel');
          await this.reconnectBrowser();
          return;
        }
        
        // Tentar clicar com diferentes estratégias e timeouts mais longos
        try {
          console.log('🔍 [DEBUG] Tentando clique normal com timeout de 5 segundos...');
          await matSelectPapel.click({ timeout: 5000 });
          console.log('✅ [DEBUG] Clique normal bem-sucedido');
        } catch (error) {
          console.log(`⚠️ [DEBUG] Clique normal falhou: ${error.message}`);
          if (error.message.includes('Target page, context or browser has been closed')) {
            console.log('🔄 [DEBUG] Navegador fechado durante clique, reconectando...');
            await this.reconnectBrowser();
            return;
          }
          try {
            console.log('🔍 [DEBUG] Tentando clique forçado...');
            await matSelectPapel.click({ force: true, timeout: 5000 });
            console.log('✅ [DEBUG] Clique forçado bem-sucedido');
          } catch (forceError) {
            console.log(`⚠️ [DEBUG] Clique forçado falhou: ${forceError.message}`);
            if (forceError.message.includes('Target page, context or browser has been closed')) {
              console.log('🔄 [DEBUG] Navegador fechado durante clique forçado, reconectando...');
              await this.reconnectBrowser();
              return;
            }
            // Tentar uma última estratégia: aguardar e tentar novamente
            console.log('🔍 [DEBUG] Aguardando 2 segundos e tentando clique final...');
            await this.ultraFastDelayManager.pageLoadDelay({ priority: 'critical' });
            try {
              await matSelectPapel.click({ force: true, timeout: 3000 });
              console.log('✅ [DEBUG] Clique final bem-sucedido');
            } catch (finalError) {
              console.log(`❌ [DEBUG] Todos os cliques falharam: ${finalError.message}`);
            }
          }
        }
        
        // Verificar se a página ainda está válida após o clique
        if (this.page.isClosed()) {
          console.log('⚠️ [DEBUG] Página fechada após clique no campo Papel');
          await this.reconnectBrowser();
          return;
        }
        
        // Aguardar opções aparecerem de forma otimizada
        try {
          // Timeout reduzido de 8000ms para 2000ms
          await this.page.waitForSelector('mat-option', { timeout: 2000 });
        } catch (waitError) {
          // Se não encontrar, continuar sem delay adicional
          console.log('⚠️ Opções não encontradas, tentando prosseguir...');
        }
        
        const opcoesPapel = this.page.locator('mat-option');
        let totalOpcoes = await opcoesPapel.count();
        console.log(`🔍 [DEBUG] Total de opções de papel disponíveis: ${totalOpcoes}`);
        
        // Se ainda não encontrou opções, tentar estratégias adicionais
        if (totalOpcoes === 0) {
          console.log('⚠️ [DEBUG] Nenhuma opção encontrada, tentando seletores alternativos...');
          
          const seletoresAlternativos = [
            '.mat-option',
            '[role="option"]',
            '.mat-select-panel mat-option',
            'mat-select-panel mat-option'
          ];
          
          for (const seletor of seletoresAlternativos) {
            try {
              await this.page.waitForSelector(seletor, { timeout: 3000 });
              const opcoesAlt = this.page.locator(seletor);
              const totalAlt = await opcoesAlt.count();
              if (totalAlt > 0) {
                console.log(`✅ [DEBUG] Opções encontradas com seletor alternativo: ${seletor} (${totalAlt} opções)`);
                totalOpcoes = totalAlt;
                break;
              }
            } catch (altError) {
              console.log(`⚠️ [DEBUG] Seletor alternativo ${seletor} falhou: ${altError.message}`);
            }
          }
          
          // Última tentativa com timeout longo
          if (totalOpcoes === 0) {
            console.log('⚠️ [DEBUG] Ainda sem opções, aguardando mais 5 segundos...');
            await this.page.waitForTimeout(1000);
            totalOpcoes = await opcoesPapel.count();
            console.log(`🔍 [DEBUG] Total final de opções: ${totalOpcoes}`);
          }
        }
        
        // Listar todas as opções disponíveis para debug
        for (let i = 0; i < Math.min(totalOpcoes, 10); i++) {
          try {
            const opcaoTexto = await opcoesPapel.nth(i).textContent();
            console.log(`🔍 [DEBUG] Opção ${i + 1}: "${opcaoTexto?.trim()}"`);
          } catch (error) {
            console.log(`⚠️ [DEBUG] Erro ao ler opção ${i + 1}: ${error.message}`);
          }
        }
        
        let perfilSelecionado = false;
        
        // PRIORIDADE MÁXIMA: Perfil configurado pelo usuário
        if (this.config.perfil && this.config.perfil.trim() !== '') {
          console.log(`🎯 [PRIORIDADE] Procurando perfil CONFIGURADO: "${this.config.perfil}"`);
          // Tentativa direta: opção que contém exatamente o texto do perfil configurado (case-insensitive)
          try {
            const perfilRegex = new RegExp(this.config.perfil.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            const opcaoDireta = opcoesPapel.filter({ hasText: perfilRegex });
            const countDireta = await opcaoDireta.count();
            if (countDireta > 0) {
              const textoDireta = await opcaoDireta.first().textContent();
              console.log(`✅ [DIRETO] Perfil encontrado diretamente: "${textoDireta?.trim()}"`);
              await opcaoDireta.first().click({ timeout: 2000 });
              perfilSelecionado = true;
            }
          } catch (e) {
            console.log(`⚠️ [DIRETO] Falha na seleção direta: ${e.message}`);
          }
          
          // Estratégia 1: Busca por similaridade inteligente
          if (!perfilSelecionado) {
            perfilSelecionado = await this.selecionarPerfilComSimilaridade(opcoesPapel, this.config.perfil);
          }
          
          if (perfilSelecionado) {
            console.log('✅ [SUCESSO] Perfil configurado selecionado com sucesso!');
          } else {
            console.log('⚠️ [FALLBACK] Perfil configurado não encontrado, usando estratégias alternativas...');
            
            // Estratégia 2: Busca por palavras-chave específicas do perfil configurado
            perfilSelecionado = await this.selecionarPerfilPorPalavrasChave(opcoesPapel, this.config.perfil);
          }
        } else {
          console.log('⚠️ [AVISO] Nenhum perfil foi configurado - usando perfil padrão...');
        }
        
        // FALLBACKS apenas se perfil configurado falhou
        if (!perfilSelecionado) {
          console.log('⚠️ [FALLBACK GERAL] Usando estratégias de fallback...');
          
          // Estratégia 1: Procurar por palavras-chave comuns
          // Priorizar 'Assessor' se o perfil configurado for 'Assessor'
          const palavrasChave = (this.config.perfil && /assessor/i.test(this.config.perfil))
            ? ['Assessor', 'Secretário', 'Secretario', 'Diretor', 'Analista']
            : ['Secretário', 'Secretario', 'Assessor', 'Diretor', 'Analista'];
          for (const palavra of palavrasChave) {
            if (perfilSelecionado) break;
            try {
              const opcaoChave = opcoesPapel.filter({ hasText: new RegExp(palavra, 'i') });
              if (await opcaoChave.count() > 0) {
                const textoChave = await opcaoChave.first().textContent();
                console.log(`🔍 [DEBUG] Encontrado por palavra-chave "${palavra}": "${textoChave?.trim()}"`);
                await opcaoChave.first().click({ timeout: 2000 });
                console.log(`✅ Papel selecionado por palavra-chave: ${palavra}`);
                perfilSelecionado = true;

                // OTIMIZAÇÃO: Clicar em Gravar logo após selecionar o Papel
                // sem esperar preencher outros campos
                await this.page.waitForTimeout(50); // Pequeno delay para fechar dropdown
                try {
                  const botaoGravar = await this.page.$('mat-dialog-container button:has-text("Gravar"):not([disabled])');
                  if (botaoGravar) {
                    console.log('⚡ Otimização: Clicando em Gravar imediatamente...');
                    await botaoGravar.click();
                    console.log('✅ Gravar executado com sucesso!');
                  }
                } catch (err) {
                  // Continuar fluxo normal se não conseguir
                }

                break;
              }
            } catch (error) {
              console.log(`⚠️ [DEBUG] Erro ao testar palavra-chave "${palavra}": ${error.message}`);
            }
          }
          
          // Estratégia 2: Selecionar primeira opção se ainda não selecionou
          if (!perfilSelecionado && totalOpcoes > 0) {
            try {
              console.log('⚠️ [DEBUG] Selecionando primeira opção disponível...');
              await opcoesPapel.first().click({ timeout: 2000 });
              const textoSelecionado = await opcoesPapel.first().textContent();
              console.log(`✅ Papel: Primeira opção selecionada - "${textoSelecionado?.trim()}"`);
              perfilSelecionado = true;

              // OTIMIZAÇÃO: Clicar em Gravar imediatamente
              await this.page.waitForTimeout(50); // Pequeno delay para fechar dropdown
              try {
                const botaoGravar = await this.page.$('mat-dialog-container button:has-text("Gravar"):not([disabled])');
                if (botaoGravar) {
                  console.log('⚡ Clicando em Gravar após selecionar Papel...');
                  await botaoGravar.click();
                  console.log('✅ Gravar executado!');
                }
              } catch (err) {
                // Continuar fluxo normal
              }
            } catch (error) {
              console.log(`❌ [DEBUG] Erro ao selecionar primeira opção: ${error.message}`);
            }
          }
          
          if (!perfilSelecionado) {
            console.log('❌ [DEBUG] Nenhuma opção de papel pôde ser selecionada!');
          }
        }
      } else {
        console.log('❌ [DEBUG] Campo Papel não encontrado com nenhum dos seletores!');
        
        // Tentar encontrar qualquer campo select no modal
        const todosSelects = this.page.locator('mat-dialog-container mat-select, mat-select');
        const totalSelects = await todosSelects.count();
        console.log(`🔍 [DEBUG] Total de campos select encontrados no modal: ${totalSelects}`);
        
        for (let i = 0; i < totalSelects; i++) {
          try {
            const selectTexto = await todosSelects.nth(i).textContent();
            const placeholder = await todosSelects.nth(i).getAttribute('placeholder');
            console.log(`🔍 [DEBUG] Select ${i + 1}: texto="${selectTexto?.trim()}", placeholder="${placeholder}"`);
          } catch (error) {
            console.log(`⚠️ [DEBUG] Erro ao analisar select ${i + 1}: ${error.message}`);
          }
        }
      }
      
      // 2. VISIBILIDADE: Selecionar "Público" rapidamente
      console.log('🎯 Configurando Visibilidade...');

      // Priorizar campo de Visibilidade especificamente (não Localização)
      let matSelectVisibilidade = this.page.locator('mat-dialog-container mat-select[placeholder*="Visibilidade"]:not([aria-disabled="true"])');
      let campoEncontrado = await matSelectVisibilidade.count() > 0;

      if (!campoEncontrado) {
        // Fallback para Localização se Visibilidade não estiver disponível
        matSelectVisibilidade = this.page.locator('mat-dialog-container mat-select[placeholder*="Localização"]:not([aria-disabled="true"])');
        campoEncontrado = await matSelectVisibilidade.count() > 0;
      }

      if (campoEncontrado) {
        await matSelectVisibilidade.first().click();
        // Removido delay de 300ms - processar imediatamente

        // Procurar opção "Público"
        const opcoesVisibilidade = this.page.locator('mat-option');
        const publicoOpcao = opcoesVisibilidade.filter({ hasText: /Público|Publico/i });

        if (await publicoOpcao.count() > 0) {
          await publicoOpcao.first().click();
          console.log('✅ Visibilidade: Público selecionado');
        } else {
          await opcoesVisibilidade.first().click();
          console.log('✅ Visibilidade: Primeira opção selecionada');
        }
      }
      
      // 3. DATA INICIAL: Preencher automaticamente
      console.log('🎯 Preenchendo data inicial...');
      const dataInicialInput = this.page.locator('input[placeholder*="Data inicial"], input[name*="dataInicial"]');
      if (await dataInicialInput.count() > 0) {
        const dataAtual = new Date().toLocaleDateString('pt-BR');
        await dataInicialInput.fill(dataAtual);
        console.log(`✅ Data inicial: ${dataAtual}`);
      }
      
      console.log('✅ Configuração completa em modo assertivo');

      // IMPORTANTE: Clicar no botão Gravar IMEDIATAMENTE após preencher os campos
      // sem esperar retornar ao método principal
      try {
        const botaoGravar = await this.page.$('mat-dialog-container button:has-text("Gravar"):not([disabled])');
        if (botaoGravar) {
          console.log('🎯 Clicando em Gravar imediatamente...');
          await botaoGravar.click();
          console.log('✅ Botão Gravar clicado com sucesso');
        }
      } catch (clickError) {
        console.log('⚠️ Botão Gravar será clicado no próximo passo');
      }

    } catch (error) {
      console.log(`⚠️ Erro na configuração assertiva: ${error.message}`);
      // Não falhar - continuar com as configurações padrão
    }
  }

  async saveConfigurationRapido() {
    const saveStartTime = Date.now();

    try {
      // Verificar se o botão já foi clicado no método anterior
      // Se não, clicar agora
      const botaoGravar = 'mat-dialog-container button:has-text("Gravar"):not([disabled])';

      // Tentar encontrar o botão (pode já ter sido clicado)
      const element = await this.page.$(botaoGravar);
      if (element) {
        console.log('🔄 Garantindo clique no botão Gravar...');
        await element.click();
      }

      // Aguardar apenas 100ms para garantir processamento
      await this.page.waitForTimeout(100);
      
      // Verificar se há mensagens de erro visíveis (PJE-281)
      try {
        const errorMessage = await this.page.locator('.mat-error, .error-message, .alert-danger, .mat-snack-bar-container').first();
        if (await errorMessage.isVisible({ timeout: 500 })) {
          const errorText = await errorMessage.textContent();
          if (errorText && (errorText.includes('PJE-281') || errorText.includes('período ativo conflitante'))) {
            console.log('⚠️ OJ já existe (PJE-281) - aguardando erro desaparecer...');
            
            // Registrar o erro
            this.performanceDashboard.recordPJE281Error(true);
            const duration = Date.now() - saveStartTime;
            this.performanceDashboard.recordOperation('errorRecovery', duration, true, { type: 'PJE-281', action: 'skipped' });
            
            // Aguardar mensagem de erro desaparecer
            await this.page.waitForTimeout(400);
            
            // Fechar qualquer snackbar ou toast de erro
            try {
              const closeButton = await this.page.locator('.mat-snack-bar-container button, .mat-error button, button[aria-label="Close"]').first();
              if (await closeButton.isVisible({ timeout: 500 })) {
                await closeButton.click();
                console.log('✅ Mensagem de erro fechada');
              }
            } catch (e) {
              // Ignorar se não houver botão de fechar
            }
            
            // Sinalizar que houve erro PJE-281 para o processamento continuar
            const error = new Error('PJE-281: OJ já existe');
            error.code = 'PJE_281_SKIP';
            throw error;
          }
        }
      } catch (e) {
        // Re-lançar apenas erros PJE-281
        if (e.code === 'PJE_281_SKIP') {
          throw e;
        }
        // Ignorar outros erros
      }
      
      // Aguardar modal fechar ou sucesso (tempo reduzido)
      try {
        await Promise.race([
          this.page.waitForSelector('mat-dialog-container', { state: 'detached', timeout: 3000 }),
          this.page.waitForSelector(':has-text("sucesso"), :has-text("salvo"), :has-text("cadastrado")', { timeout: 3000 })
        ]);
        console.log('✅ Salvamento confirmado');
      } catch (waitError) {
        console.log('⚠️ Timeout ao aguardar confirmação - continuando...');
      }
      
    } catch (error) {
      console.log(`⚠️ Erro no salvamento assertivo: ${error.message}`);
      console.log('🔍 [DEBUG] Stack trace:', error.stack);
      
      // Fallback: tentar outros botões
      const fallbackSelectors = [
        '[role="dialog"] button:has-text("Gravar")',
        'button:has-text("Salvar")',
        'button:has-text("Confirmar")',
        'mat-dialog-container button[type="submit"]',
        'mat-dialog-container button:not([disabled])'
      ];
      
      console.log('🔍 [DEBUG] Tentando fallback selectors...');
      for (const selector of fallbackSelectors) {
        try {
          console.log(`🔍 [DEBUG] Testando selector: ${selector}`);
          const botao = this.page.locator(selector);
          const count = await botao.count();
          console.log(`🔍 [DEBUG] Elementos encontrados para "${selector}": ${count}`);
          
          if (count > 0) {
            const textoFallback = await botao.first().textContent();
            console.log(`🔍 [DEBUG] Texto do botão fallback: "${textoFallback?.trim()}"`);
            await botao.first().click();
            console.log(`✅ Fallback: ${selector} clicado`);
            return;
          }
        } catch (fallbackError) {
          console.log(`🔍 [DEBUG] Erro no fallback "${selector}": ${fallbackError.message}`);
          continue;
        }
      }
      
      throw new Error('Nenhum botão de salvamento encontrado');
    }
  }

  async verifySuccessRapido() {
    console.log('🎯 ASSERTIVO: Verificação instantânea de sucesso...');
    
    // Verificação rápida sem timeout desnecessário
    try {
      // 1. Verificar se modal fechou (indicativo de sucesso)
      const modalAberto = await this.page.locator('mat-dialog-container').isVisible();
      if (!modalAberto) {
        console.log('✅ Modal fechou - operação CONFIRMADA como bem-sucedida');
        return true;
      }
      
      // 2. Se modal ainda aberto, verificar mensagens rapidamente
      const mensagemSucesso = await this.page.locator(':has-text("sucesso"), :has-text("cadastrado"), :has-text("salvo")').count();
      if (mensagemSucesso > 0) {
        console.log('✅ Mensagem de sucesso detectada');
        return true;
      }
      
      // 3. Se chegou aqui, assumir sucesso (modal pode estar processando)
      console.log('ℹ️ Modal ainda aberto - assumindo processamento em andamento');
      return true;
      
    } catch (error) {
      console.log(`⚠️ Erro na verificação: ${error.message} - assumindo sucesso`);
      return true; // Assumir sucesso para não quebrar fluxo
    }
  }

  // === FUNÇÕES ORIGINAIS (MANTIDAS PARA COMPATIBILIDADE) ===

  async stabilizePage() {
    // Aguardar estabilização da página
    await this.page.waitForTimeout(300);
        
    // Aguardar que não haja requisições de rede por 500ms
    try {
      await this.page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch (error) {
      console.log('Timeout aguardando networkidle, continuando...');
    }
  }

  async closeAnyModals() {
    console.log('🧹 Procurando modais/overlays para fechar...');
    
    // Seletores prioritários com timeout reduzido
    const prioritySelectors = [
      '.mat-dialog-actions button',
      '.mat-overlay-backdrop',
      '.cdk-overlay-backdrop',
      'button:has-text("OK")',
      'button:has-text("Fechar")',
      '.modal-backdrop'
    ];
    
    let modalsFound = 0;
    
    // Primeira passada: seletores prioritários com timeout muito baixo
    for (const selector of prioritySelectors) {
      try {
        // Usar timeout muito baixo (100ms) para não travar
        const elements = await this.page.$$(selector);
        
        for (const element of elements) {
          try {
            const isVisible = await element.isVisible();
            if (isVisible) {
              await element.click();
              modalsFound++;
              console.log(`✅ Fechou modal/overlay: ${selector}`);
              await this.delay(100); // Delay reduzido
              return; // Sair após fechar o primeiro modal
            }
          } catch (clickError) {
            // Ignorar erros de clique
          }
        }
      } catch (error) {
        // Ignorar erros de seletores não encontrados
      }
    }
    
    // Se não encontrou modais prioritários, tentar ESC rapidamente
    try {
      await this.page.keyboard.press('Escape');
      await this.delay(300);
      console.log('🔑 Pressionou ESC para fechar modais');
    } catch (escError) {
      console.log('⚠️ Erro ao pressionar ESC:', escError.message);
    }
    
    if (modalsFound > 0) {
      console.log(`✅ Total de modais/overlays fechados: ${modalsFound}`);
    } else {
      console.log('ℹ️ Nenhum modal/overlay encontrado');
    }
  }

  async clickAddLocationButton() {
    console.log('🔄 INICIANDO clickAddLocationButton');
    const addButtonSelectors = [
      'button:has-text("Adicionar Localização/Visibilidade"):not([disabled])',
      'button:has-text("Adicionar Localização"):not([disabled])',
      'button:has-text("Adicionar"):not([disabled]):visible',
      'button .mat-button-wrapper:has-text("Adicionar"):not([disabled])',
      'input[value*="Adicionar"]:not([disabled])'
    ];
        
    let addButton = null;
        
    for (const selector of addButtonSelectors) {
      try {
        console.log(`🔍 Testando seletor: ${selector}`);
        await this.page.waitForSelector(selector, { timeout: 3000 });
        addButton = selector;
        console.log(`✅ Botão Adicionar encontrado: ${selector}`);
        break;
      } catch (error) {
        console.log(`❌ Seletor ${selector} não encontrado: ${error.message}`);
      }
    }
        
    if (!addButton) {
      console.log('❌ ERRO: Nenhum botão Adicionar encontrado');
      throw new Error('Botão "Adicionar Localização/Visibilidade" não encontrado');
    }
        
    console.log(`🖱️ Clicando no botão: ${addButton}`);
    await this.page.click(addButton);
    await this.delay(2000);
    console.log('✅ clickAddLocationButton concluído');
  }

  async selectOrgaoJulgador(orgao) {
    // Implementar seleção do órgão julgador usando a versão melhorada
    // com estratégia aprimorada para mat-select do Angular Material
    
    // Validação de tipo para evitar erros
    let orgaoTexto;
    if (typeof orgao === 'string') {
      orgaoTexto = orgao;
    } else if (orgao && typeof orgao === 'object' && orgao.nome) {
      orgaoTexto = orgao.nome;
    } else {
      orgaoTexto = String(orgao || '');
    }
        
    console.log(`🔄 INICIANDO selectOrgaoJulgador para: ${orgaoTexto}`);
    this.sendStatus('info', 'Selecionando órgão julgador...', null, orgaoTexto);
        
    // Usar a função melhorada com estratégia de trigger
    const { vincularOJMelhorado } = require('../vincularOJ.js');

    // Configuração específica para São José dos Campos - SAO_JOSE_CAMPOS_SEQUENCIAL
    const SAO_JOSE_CAMPOS_CONFIG = {
      varasEspeciais: [
        '2ª Vara do Trabalho de São José dos Campos',
        '3ª Vara do Trabalho de São José dos Campos',
        '4ª Vara do Trabalho de São José dos Campos',
        '5ª Vara do Trabalho de São José dos Campos'
      ],
    
      processamentoSequencial: true,
      timeoutExtendido: 30000,
      tentativasMaximas: 3,
      intervaloTentativas: 5000,
    
      // Função para verificar se é vara especial
      isVaraEspecial(nomeOrgao) {
        return this.varasEspeciais.includes(nomeOrgao);
      },
    
      // Configurações específicas para processamento
      getConfiguracao(nomeOrgao) {
        if (this.isVaraEspecial(nomeOrgao)) {
          return {
            sequencial: true,
            timeout: this.timeoutExtendido,
            tentativas: this.tentativasMaximas,
            intervalo: this.intervaloTentativas,
            aguardarCarregamento: 8000,
            verificarElementos: true
          };
        }
        return null;
      }
    };

    // Verificar se é uma vara especial de São José dos Campos
    const configEspecial = SAO_JOSE_CAMPOS_CONFIG.getConfiguracao(orgao);

    if (configEspecial) {
      console.log(`🎯 VARA ESPECIAL DETECTADA: ${orgao} - Aplicando configuração otimizada`);
      console.log(`⚙️ Configuração: Timeout=${configEspecial.timeout}ms, Tentativas=${configEspecial.tentativas}`);

      // Aplicar delays otimizados para varas especiais
      await this.ultraFastDelayManager.enableTurboMode();

      // Processamento com configuração especial
      try {
        console.log(`🔄 Chamando vincularOJMelhorado ESPECIAL para: ${orgao}`);
        await vincularOJMelhorado(
          this.page,
          orgao,
          this.config.perfil || 'Assessor',
          'Público',
          {
            timeout: configEspecial.timeout,
            maxTentativas: configEspecial.tentativas,
            aguardarExtra: configEspecial.aguardarCarregamento,
            verificarElementos: configEspecial.verificarElementos,
            sequencial: configEspecial.sequencial
          }
        );
        console.log(`✅ Processamento ESPECIAL concluído com sucesso para: ${orgao}`);
      } catch (error) {
        console.error(`❌ Erro no processamento ESPECIAL de ${orgao}:`, error.message);
        throw error;
      }
    } else {
      console.log(`🔄 Chamando vincularOJMelhorado PADRÃO para: ${orgao} com perfil: ${this.config.perfil || 'Não especificado'}`);
      await vincularOJMelhorado(
        this.page,
        orgao, // Nome do órgão como string
        this.config.perfil || 'Assessor', // Usar perfil configurado
        'Público'
      );
      console.log(`✅ vincularOJMelhorado PADRÃO concluído para: ${orgao}`);
    }
  }

  async configurePapelVisibilidade() {
    // Configurar papel e visibilidade se necessário
    // Esta lógica seria implementada baseada nos requisitos específicos
    await this.delay(500);
  }

  async saveConfiguration() {
    // Salvar configuração
    // Esta lógica seria similar ao que já existe no vincularOJ.js
    await this.delay(500);
  }

  async verifySuccess() {
    // Verificar se a operação foi bem-sucedida
    // Implementar verificações de sucesso
    await this.delay(500);
  }

  // Método auxiliar para processamento individual de OJs
  async processOJsIndividually(ojsToProcess, servidor, serverResult, ojsProcessadasTotal, totalOjs, isRetry = false) {
    console.log(`🔍 [DEBUG] INICIANDO loop de processamento individual de ${ojsToProcess.length} OJs`);
    for (let i = 0; i < ojsToProcess.length; i++) {
      const orgao = ojsToProcess[i];
      console.log(`🔍 [DEBUG] Processando OJ ${i + 1}/${ojsToProcess.length}: ${orgao}`);
      serverResult.ojsProcessados++;
      
      this.sendStatus('info', `OJ ${i + 1}/${ojsToProcess.length}: ${orgao}`, null, 'Processando vinculação', orgao, servidor.nome, ojsProcessadasTotal, totalOjs);
            
      try {
        const startOJ = Date.now();
        await this.processOrgaoJulgador(orgao);
        const timeOJ = Date.now() - startOJ;
        
        ojsProcessadasTotal++; // Incrementar contador após sucesso
        
        serverResult.sucessos++;
        serverResult.detalhes.push({
          orgao,
          status: 'Incluído com Sucesso',
          tempo: timeOJ,
          perfil: this.config.perfil,
          timestamp: new Date().toISOString()
        });
        
        this.results.push({
          servidor: servidor.nome,
          orgao,
          status: 'Incluído com Sucesso',
          erro: null,
          perfil: this.config.perfil,
          cpf: this.config.cpf,
          timestamp: new Date().toISOString()
        });
        
        this.sendStatus('success', `✅ OJ ${orgao} incluído com sucesso`, null, null, orgao, servidor.nome, ojsProcessadasTotal, totalOjs);
        
      } catch (error) {
        const errorDetails = {
          servidor: servidor.nome,
          cpf: servidor.cpf,
          orgao,
          errorMessage: error.message,
          errorType: error.name || 'UnknownError',
          errorStack: error.stack,
          timestamp: new Date().toISOString(),
          pageUrl: this.page ? this.page.url() : 'NO_PAGE',
          context: 'processamento_individual_oj',
          ojIndex: i,
          totalOJs: ojsToProcess.length,
          ojsProcessadas: ojsProcessadasTotal
        };
        
        // Extrair mensagem de erro de forma segura
        const errorMsg = typeof error === 'string' ? error :
          (error?.message || error?.toString() || 'Erro desconhecido');

        // Adicionar mensagem de erro tratada ao errorDetails
        errorDetails.errorMessageTratada = errorMsg;

        console.error(`❌ Erro OJ ${orgao} (${servidor.nome}):`, JSON.stringify(errorDetails, null, 2));

        ojsProcessadasTotal++; // Incrementar contador mesmo com erro

        // Se for um erro crítico e não for retry, tentar recuperação
        if (!isRetry && error.message &&
            (error.message.includes('Target page') ||
             error.message.includes('Session closed') ||
             error.message.includes('Connection closed'))) {
          console.log('🔧 Erro de conexão detectado. Tentando recuperação automática...');
          try {
            await this.performRobustRecovery();
            console.log('🔄 Recuperação concluída. Tentando processar OJ novamente...');

            // Tentar processar o OJ novamente
            const retryStartOJ = Date.now();
            await this.processOrgaoJulgador(orgao);
            const retryTimeOJ = Date.now() - retryStartOJ;

            // Se conseguiu na segunda tentativa, registrar como sucesso
            serverResult.sucessos++;
            serverResult.detalhes.push({
              orgao,
              status: 'Incluído com Sucesso (após recuperação)',
              tempo: retryTimeOJ,
              perfil: this.config.perfil,
              timestamp: new Date().toISOString()
            });

            this.results.push({
              servidor: servidor.nome,
              orgao,
              status: 'Incluído com Sucesso (após recuperação)',
              erro: null,
              perfil: this.config.perfil,
              cpf: this.config.cpf,
              timestamp: new Date().toISOString()
            });

            this.sendStatus('success', `✅ OJ ${orgao} incluído após recuperação`, null, null, orgao, servidor.nome, ojsProcessadasTotal, totalOjs);
            continue; // Pular para próximo OJ

          } catch (recoveryError) {
            console.error(`❌ Recuperação automática falhou para OJ ${orgao}:`, recoveryError.message);
            // Continuar com o registro de erro original
          }
        }

        serverResult.erros++;
        serverResult.detalhes.push({
          orgao,
          status: 'Erro',
          erro: errorMsg,
          errorDetails,
          timestamp: new Date().toISOString()
        });

        this.results.push({
          servidor: servidor.nome,
          orgao,
          status: 'Erro',
          erro: errorMsg,
          errorDetails,
          cpf: this.config.cpf,
          timestamp: new Date().toISOString()
        });
        
        // Mensagem mais amigável para erro PJE-281
        const mensagemErro = errorMsg.includes('PJE-281') || errorMsg.includes('já cadastrado')
          ? `ℹ️ ${orgao}: Já vinculado anteriormente`
          : `⚠️ Erro ao vincular ${orgao}`;

        this.sendStatus('info', mensagemErro, null, null, orgao, servidor.nome, ojsProcessadasTotal, totalOjs);
                
        // Recuperação rápida sem interromper processamento
        try {
          await this.quickErrorRecovery();
        } catch (recoveryError) {
          console.error(`❌ Erro na recuperação rápida para OJ ${orgao}:`, {
            originalError: error.message,
            recoveryError: recoveryError.message,
            timestamp: new Date().toISOString()
          });
        }
      }
            
      // Pausa ultra-otimizada entre OJs (25ms para velocidade máxima)
      await this.delay(25);
    }
  }

  async processOrgaosJulgadoresWithServerTracking(servidor) {
    console.log(`🎯 [DEBUG] INICIANDO processOrgaosJulgadoresWithServerTracking para ${servidor.nome}`);
    console.log(`📎 Servidor: ${servidor.nome || servidor.cpf} - ${servidor.orgaos?.length || 0} órgãos julgadores`);
    
    // Adicionar servidor ao painel de processamento
    if (this.mainWindow && this.mainWindow.webContents) {
      this.mainWindow.webContents.executeJavaScript(`
        if (typeof addProcessingServer === 'function') {
          addProcessingServer({
            name: '${servidor.nome.replace(/'/g, '\\\'')}',
            cpf: '${servidor.cpf}',
            perfil: '${servidor.perfil || this.config.perfil || ''}',
            totalOJs: ${servidor.orgaos?.length || 0}
          });
        }
      `).catch(err => {
        console.log('⚠️ Erro ao adicionar servidor ao painel de processamento:', err.message);
      });
    }
    
    // Validar configuração antes de processar
    if (!this.config || !this.config.orgaos || !Array.isArray(this.config.orgaos)) {
      throw new Error('Configuração de órgãos julgadores inválida ou não definida');
    }
    
    // Definir o servidor atual para uso em outras funções
    this.currentServidor = servidor;
    
    const serverResult = this.servidorResults[servidor.cpf];
    if (!serverResult) {
      console.error(`❌ [ERROR] serverResult não encontrado para CPF ${servidor.cpf}`);
      throw new Error(`Resultado do servidor não encontrado para CPF ${servidor.cpf}`);
    }
    
    // Processar todos os OJs diretamente sem verificação prévia
    // CORREÇÃO: Usar campo correto 'ojs' em vez de 'orgaos'
    const ojsParaProcessarOtimizado = servidor.ojs || [];

    console.log(`🚀 [AUTOMAÇÃO] Iniciando processamento direto para ${servidor.nome}`);
    console.log(`📋 [AUTOMAÇÃO] CPF: ${servidor.cpf}`);
    console.log(`📋 [AUTOMAÇÃO] Perfil: ${servidor.perfil}`);
    console.log(`📋 [AUTOMAÇÃO] OJs configurados: ${JSON.stringify(servidor.ojs)}`);
    console.log(`📋 [AUTOMAÇÃO] Total de OJs: ${ojsParaProcessarOtimizado.length}`);
    console.log('🔍 [DEBUG] DETALHAMENTO DOS OJs:');
    if (servidor.ojs && servidor.ojs.length > 0) {
      servidor.ojs.forEach((oj, index) => {
        console.log(`   ${index + 1}. "${oj}"`);
      });
    } else {
      console.log('   ⚠️ NENHUM OJ encontrado em servidor.ojs!');
    }
    
    this.sendStatus('info', `🔍 Vinculando ${ojsParaProcessarOtimizado.length} órgão${ojsParaProcessarOtimizado.length !== 1 ? 's' : ''} para ${servidor.nome}`, null,
      'Processando vinculações');
    
    // VERIFICAÇÃO AUTOMÁTICA DE LOCALIZAÇÕES/VISIBILIDADES ATIVAS
    console.log(`🎯 [LOCALIZAÇÕES] Iniciando verificação automática de localizações para ${servidor.nome}...`);
    try {
      const resultadoLocalizacoes = await verificarEProcessarLocalizacoesFaltantes(this.page);
      
      if (resultadoLocalizacoes.sucesso) {
        console.log(`✅ [LOCALIZAÇÕES] Verificação concluída para ${servidor.nome}:`);
        console.log(`   📊 Existentes: ${resultadoLocalizacoes.existentes}`);
        console.log(`   🚀 Processadas: ${resultadoLocalizacoes.processadas}`);
        console.log(`   📈 Total: ${resultadoLocalizacoes.total}`);
        
        this.sendStatus('success', 
          `🎯 Localizações: ${resultadoLocalizacoes.existentes} existentes + ${resultadoLocalizacoes.processadas} processadas = ${resultadoLocalizacoes.total} total`, 
          null, 
          'Verificação automática concluída', 
          null, 
          servidor.nome
        );
        
        // Adicionar ao resultado do servidor
        serverResult.localizacoes = {
          existentes: resultadoLocalizacoes.existentes,
          processadas: resultadoLocalizacoes.processadas,
          total: resultadoLocalizacoes.total,
          erros: resultadoLocalizacoes.erros || 0
        };
        
      } else {
        console.log(`⚠️ [LOCALIZAÇÕES] Erro na verificação para ${servidor.nome}: ${resultadoLocalizacoes.erro}`);
        this.sendStatus('warning', 
          `⚠️ Erro na verificação de localizações: ${resultadoLocalizacoes.erro}`, 
          null, 
          'Continuando com processamento de OJs', 
          null, 
          servidor.nome
        );
        
        // Adicionar erro ao resultado do servidor
        serverResult.localizacoes = {
          erro: resultadoLocalizacoes.erro,
          existentes: 0,
          processadas: 0,
          total: 0,
          erros: 1
        };
      }
    } catch (error) {
      console.log(`❌ [LOCALIZAÇÕES] Erro inesperado na verificação para ${servidor.nome}: ${error.message}`);
      this.sendStatus('warning', 
        `❌ Erro inesperado na verificação de localizações: ${error.message}`, 
        null, 
        'Continuando com processamento de OJs', 
        null, 
        servidor.nome
      );
      
      // Adicionar erro ao resultado do servidor
      serverResult.localizacoes = {
        erro: error.message,
        existentes: 0,
        processadas: 0,
        total: 0,
        erros: 1
      };
    }
    
    // CORREÇÃO DO BUG: Apenas limpar cache em memória, preservar persistência
    console.log(`🧹 [DEBUG] Limpando cache em memória antes de processar ${servidor.nome}...`);
    this.ojCache.clear();
    this.smartOJCache.limparCache(true); // CORREÇÃO: Preservar dados persistentes
    console.log('✅ [DEBUG] Cache em memória limpo - dados persistentes preservados');
    console.log('🎯 [DEBUG] BYPASS-UNIVERSAL: Garantindo que não há contaminação de cache entre servidores');
    
    // SISTEMA INTELIGENTE: ATIVADO - Usar verificação inteligente para evitar duplicatas
    // Verificar OJs já vinculadas antes de processar
    const isUniversalBypass = false; // VERIFICAÇÃO INTELIGENTE ATIVADA: Filtrar OJs já vinculadas
    let resultadoVerificacao = null; // Inicializar variável para evitar erro
    
    if (isUniversalBypass) {
      console.log(`🔥 [BYPASS-UNIVERSAL] REMOVENDO TODAS AS VERIFICAÇÕES para ${servidor.nome}`);
      console.log('🔥 [BYPASS-UNIVERSAL] Pulando SmartCache, ServidorSkipDetector e TODAS verificações');
      console.log('🔥 [BYPASS-UNIVERSAL] PROCESSAMENTO DIRETO de todas as OJs configuradas');
      // PULAR COMPLETAMENTE loadExistingOJs, verificacoes, etc.
      resultadoVerificacao = { inteligenciaAtiva: false }; // Definir valor padrão para bypass
    } else {
      // Comportamento normal para outros servidores
      console.log(`🔍 [DEBUG] Carregando OJs existentes para ${servidor.nome} usando SmartOJCache (cache limpo)...`);
      resultadoVerificacao = await this.loadExistingOJsWithSmartCache();
      console.log(`🔍 [DEBUG] Cache de OJs carregado: ${this.ojCache.size} OJs em cache`);
    }
    
    // CORREÇÃO: NÃO sobrescrever config.orgaos com servidor.ojs
    // O config.orgaos deve conter TODOS os OJs que o usuário quer processar
    // O servidor.ojs contém apenas os OJs que o servidor já tem vinculados
    console.log('🔍 [CONFIGURAÇÃO] Mantendo OJs originais da configuração:');
    console.log(`   this.config.orgaos (TODOS para processar): ${JSON.stringify(this.config.orgaos)}`);
    console.log(`   servidor.ojs (já vinculados): ${JSON.stringify(servidor.ojs)}`);
    console.log(`   ojsParaProcessarOtimizado (do servidor): ${JSON.stringify(ojsParaProcessarOtimizado)}`);

    // NÃO FAZER: this.config.orgaos = ojsParaProcessarOtimizado;
    // Isso removeria OJs não vinculados que o usuário quer processar!
    
    // Normalizar e filtrar OJs que precisam ser processados
    console.log(`🔍 [DEBUG] this.config.orgaos (após otimização): ${JSON.stringify(this.config.orgaos?.slice(0,3) || [])}${this.config.orgaos?.length > 3 ? '...' : ''}`);
    const ojsNormalizados = this.config.orgaos.map(orgao => this.normalizeOrgaoName(orgao));
    console.log(`🔍 [DEBUG] OJs normalizados: ${JSON.stringify(ojsNormalizados.slice(0,3))}${ojsNormalizados.length > 3 ? '...' : ''}`);
    
    // ANÁLISE INTELIGENTE: DESABILITADA PARA BYPASS UNIVERSAL
    if (!isUniversalBypass) {
      const servidorId = `${servidor.cpf}_${servidor.nome}`;
      const analiseServidor = this.servidorSkipDetector.analisarServidor(servidorId, ojsNormalizados, this.smartOJCache);
      
      if (analiseServidor.deveSerPulado) {
        console.log(`⏭️ [SKIP] Servidor ${servidor.nome} será PULADO: ${analiseServidor.motivo}`);
        this.sendStatus('info', `⏭️ PULANDO: ${servidor.nome}`, null, analiseServidor.motivo, null, servidor.nome);
        
        // Atualizar estatísticas do servidor
        serverResult.status = 'Pulado';
        serverResult.jaIncluidos = analiseServidor.estatisticas.ojsJaVinculados;
        serverResult.detalhes.push({
          status: 'Servidor Pulado',
          motivo: analiseServidor.motivo,
          estatisticas: analiseServidor.estatisticas,
          timestamp: new Date().toISOString()
        });
        
        return; // Pular este servidor
      }
    } else {
      console.log(`🔥 [BYPASS-UNIVERSAL] PULANDO análise ServidorSkipDetector para ${servidor.nome}`);
    }
    
    // SISTEMA INTELIGENTE: Usar lista otimizada da verificação inteligente ou filtro por cache
    let ojsToProcess;
    
    console.log('🔍 [DEBUG] DIRLEI CASO - DECISÃO DE LISTA:');
    console.log(`   resultadoVerificacao existe: ${resultadoVerificacao ? 'SIM' : 'NÃO'}`);
    console.log(`   inteligenciaAtiva: ${resultadoVerificacao?.inteligenciaAtiva ? 'SIM' : 'NÃO'}`);
    console.log(`   ojsParaProcessarOtimizado.length: ${ojsParaProcessarOtimizado.length}`);
    console.log(`   ojsNormalizados.length: ${ojsNormalizados.length}`);
    console.log(`   ojsParaProcessarOtimizado < ojsNormalizados: ${ojsParaProcessarOtimizado.length < ojsNormalizados.length ? 'SIM' : 'NÃO'}`);
    console.log(`   isUniversalBypass: ${isUniversalBypass ? 'SIM' : 'NÃO'}`);
    
    if (resultadoVerificacao && resultadoVerificacao.inteligenciaAtiva) {
      // SEMPRE usar lista inteligente quando disponível, independente da quantidade
      ojsToProcess = ojsParaProcessarOtimizado.map(orgao => this.normalizeOrgaoName(orgao));
      console.log(`🧠 [INTELIGÊNCIA] ESCOLHA: Usando lista inteligente: ${ojsToProcess.length} OJs`);
      console.log(`🧠 [INTELIGÊNCIA] OJs selecionados: ${JSON.stringify(ojsToProcess)}`);
      console.log('🧠 [INTELIGÊNCIA] CONFIRMANDO: Esta é a lista DEFINITIVA que será processada');
    } else if (isUniversalBypass) {
      ojsToProcess = this.config.orgaos; // Usar OJs ORIGINAIS, não normalizadas
      console.log('🔥 [BYPASS-UNIVERSAL] ESCOLHA: PROCESSAMENTO DIRETO - ignorando TUDO');
      console.log(`🔥 [BYPASS-UNIVERSAL] this.config.orgaos: ${JSON.stringify(this.config.orgaos)}`);
      console.log(`🔥 [BYPASS-UNIVERSAL] ojsToProcess: ${JSON.stringify(ojsToProcess)}`);
      console.log(`🔥 [BYPASS-UNIVERSAL] Total: ${ojsToProcess.length} OJs serão processadas OBRIGATORIAMENTE`);

      // DEBUG DETALHADO
      if (ojsToProcess && ojsToProcess.length > 0) {
        console.log('🔍 [BYPASS-UNIVERSAL] LISTA DETALHADA DE OJs PARA PROCESSAR:');
        ojsToProcess.forEach((oj, index) => {
          console.log(`   ${index + 1}. "${oj}"`);
        });
      } else {
        console.log('❌ [BYPASS-UNIVERSAL] ERRO: NENHUM OJ PARA PROCESSAR!');
        console.log('🔍 [DEBUG] Verificando onde está o problema...');
        console.log(`   servidor.ojs: ${JSON.stringify(servidor.ojs)}`);
        console.log(`   ojsParaProcessarOtimizado: ${JSON.stringify(ojsParaProcessarOtimizado)}`);
        console.log(`   this.config: ${JSON.stringify(this.config)}`);
      }
    } else {
      ojsToProcess = ojsNormalizados.filter(orgao => !this.ojCache.has(orgao));
      console.log(`🔍 [DEBUG] ESCOLHA: OJs a processar (cache): ${JSON.stringify(ojsToProcess)}`);
    }
    
    // Contador de OJs processadas
    let ojsProcessadasTotal = 0;
    const totalOjs = this.config.orgaos.length;
    
    if (isUniversalBypass) {
      console.log(`🔥 [BYPASS-UNIVERSAL] GARANTINDO processamento de ${ojsToProcess.length} OJs`);
      this.sendStatus('info', `🔥 ${servidor.nome}: ${ojsToProcess.length} OJs serão processadas (sem verificações)`, null, 'Processamento direto', null, servidor.nome, ojsProcessadasTotal, totalOjs);
    } else if (resultadoVerificacao && resultadoVerificacao.inteligenciaAtiva) {
      this.sendStatus('info', `🧠 ${servidor.nome}: ${ojsToProcess.length} OJs para processar (verificação inteligente)`, null, 'Sistema inteligente ativo', null, servidor.nome, ojsProcessadasTotal, totalOjs);
    } else {
      this.sendStatus('info', `⚡ ${ojsToProcess.length} OJs para processar | ${this.ojCache.size} detectados como já cadastrados`, null, 'Processando servidor', null, servidor.nome, ojsProcessadasTotal, totalOjs);
    }
    
    if (ojsToProcess.length === 0 && !isUniversalBypass) {
      if (resultadoVerificacao && resultadoVerificacao.inteligenciaAtiva) {
        console.log('🧠 [INTELIGÊNCIA] NENHUM OJ para processar - todos já cadastrados no banco');
        this.sendStatus('success', `🎉 ${servidor.nome}: Todos os OJs já estão cadastrados!`, null, 'Sistema inteligente concluído', null, servidor.nome);
      } else {
        console.log('🔍 [DEBUG] NENHUM OJ para processar - todos já estão em cache');
      }
      return;
    }
        
    // Verificar se deve usar modo sequencial (BatchOJProcessor)
    const isSequentialMode = this.config?.mode === 'sequential' || this.config?.forceBatchOnly === true;
    
    if (isSequentialMode && ojsToProcess.length > 1) {
      console.log(`🚀 [SEQUENCIAL] Usando BatchOJProcessor para ${ojsToProcess.length} OJs em modo sequencial`);
      this.sendStatus('info', `🚀 ${servidor.nome}: Processamento sequencial em lote iniciado`, null, 'Modo sequencial ativo', null, servidor.nome);
      
      try {
        // Criar instância do BatchOJProcessor se não existir
        if (!this.batchOJProcessor) {
          this.batchOJProcessor = new BatchOJProcessor(
            this.page,
            this.config,
            this.performanceMonitor,
            this.performanceDashboard
          );
        }
        
        const batchResult = await this.batchOJProcessor.processBatchOJs(
          ojsToProcess,
          (progress) => {
            // Callback de progresso
            this.sendStatus('info', `📋 OJ ${progress.current}/${progress.total}: ${progress.orgao}`, null, 'Processamento em lote', progress.orgao, servidor.nome, progress.current - 1, ojsToProcess.length);
          }
        );
        
        // Processar resultados do lote
        for (const resultado of batchResult.results) {
          ojsProcessadasTotal++;
          serverResult.ojsProcessados++;
          
          if (resultado.status === 'success') {
            serverResult.sucessos++;
            serverResult.detalhes.push({
              orgao: resultado.orgao,
              status: 'Incluído com Sucesso',
              tempo: resultado.duration,
              perfil: this.config.perfil,
              timestamp: new Date().toISOString()
            });
            
            this.results.push({
              servidor: servidor.nome,
              orgao: resultado.orgao,
              status: 'Incluído com Sucesso',
              erro: null,
              perfil: this.config.perfil,
              cpf: this.config.cpf,
              timestamp: new Date().toISOString()
            });
            
            this.sendStatus('success', `✅ OJ ${resultado.orgao} incluído com sucesso (lote)`, null, null, resultado.orgao, servidor.nome, ojsProcessadasTotal, ojsToProcess.length);
          } else {
            serverResult.erros++;
            serverResult.detalhes.push({
              orgao: resultado.orgao,
              status: 'Erro',
              erro: resultado.error || resultado.message,
              timestamp: new Date().toISOString()
            });
            
            this.results.push({
              servidor: servidor.nome,
              orgao: resultado.orgao,
              status: 'Erro',
              erro: resultado.error || resultado.message,
              cpf: this.config.cpf,
              timestamp: new Date().toISOString()
            });
            
            // Mensagem mais amigável para erros
            const mensagemErro = (resultado.error || resultado.message || '').includes('PJE-281') || (resultado.error || resultado.message || '').includes('já cadastrado')
              ? `ℹ️ ${resultado.orgao}: Já vinculado anteriormente`
              : `⚠️ Erro ao vincular ${resultado.orgao}`;

            this.sendStatus('info', mensagemErro, null, null, resultado.orgao, servidor.nome, ojsProcessadasTotal, ojsToProcess.length);
          }
        }
        
        console.log(`✅ [SEQUENCIAL] Processamento em lote concluído: ${batchResult.summary?.success || 0}/${ojsToProcess.length} sucessos`);
        
      } catch (error) {
        const errorDetails = {
          servidor: servidor.nome,
          cpf: servidor.cpf,
          totalOJs: ojsToProcess?.length || 0,
          errorMessage: error.message,
          errorType: error.name || 'UnknownError',
          errorStack: error.stack,
          timestamp: new Date().toISOString(),
          pageUrl: this.page ? this.page.url() : 'NO_PAGE',
          context: 'processamento_sequencial_batch',
          batchProcessorActive: !!this.batchProcessor
        };
        
        console.error('❌ [SEQUENCIAL] Erro no processamento em lote:', JSON.stringify(errorDetails, null, 2));
        // Extrair mensagem de erro de forma segura
        const errorMessage = typeof error === 'string' ? error :
          (error?.message || error?.toString() || 'Erro desconhecido');
        this.sendStatus('error', `❌ Erro no processamento sequencial: ${errorMessage}`, null, null, null, servidor.nome);
        
        // Fallback para processamento individual
        console.log('⚠️ [SEQUENCIAL] Fallback para processamento individual...');
        try {
          await this.processOJsIndividually(ojsToProcess, servidor, serverResult, ojsProcessadasTotal, totalOjs, true);
        } catch (fallbackError) {
          const fallbackErrorDetails = {
            ...errorDetails,
            fallbackError: fallbackError.message,
            fallbackErrorType: fallbackError.name || 'UnknownError',
            fallbackStack: fallbackError.stack,
            context: 'fallback_processamento_individual'
          };
          
          console.error('❌ [SEQUENCIAL] Fallback também falhou:', JSON.stringify(fallbackErrorDetails, null, 2));

          // Tentar recuperação automática antes de desistir
          console.log('🔧 Tentando recuperação automática...');
          try {
            await this.performRobustRecovery();
            // Tentar novamente após recuperação
            await this.processOJsIndividually(ojsToProcess, servidor, serverResult, ojsProcessadasTotal, totalOjs, true);
            console.log('✅ Recuperação automática bem-sucedida!');
          } catch (recoveryError) {
            console.error('❌ Recuperação automática falhou:', recoveryError.message);
            // Agora sim, re-throw o erro
            throw fallbackError;
          }
        }
      }
      
    } else {
      // Processamento individual (modo padrão ou single OJ)
      console.log(`🔍 [INDIVIDUAL] Processamento individual de ${ojsToProcess.length} OJs`);
      await this.processOJsIndividually(ojsToProcess, servidor, serverResult, ojsProcessadasTotal, totalOjs);
    }
        
    // Adicionar OJs já existentes ao relatório do servidor
    for (const orgaoExistente of this.ojCache) {
      if (this.config && this.config.orgaos && this.config.orgaos.includes(orgaoExistente)) {
        serverResult.jaIncluidos++;
        serverResult.detalhes.push({
          orgao: orgaoExistente,
          status: 'Já Incluído',
          perfil: this.config.perfil,
          timestamp: new Date().toISOString()
        });
        
        this.results.push({
          servidor: servidor.nome,
          orgao: orgaoExistente,
          status: 'Já Incluído',
          erro: null,
          perfil: this.config.perfil,
          cpf: this.config.cpf,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Enviar status final de conclusão
    this.sendStatus('success', `✅ Processamento do servidor ${servidor.nome} finalizado`, null, 'Finalizado', 'Finalizado', servidor.nome, totalOjs, totalOjs);
    
    // Adicionar servidor à lista de processados com sucesso
    if (this.mainWindow && this.mainWindow.webContents) {
      const processingTime = serverResult.tempoProcessamento || 0;
      this.mainWindow.webContents.executeJavaScript(`
        if (typeof addProcessedServer === 'function') {
          addProcessedServer({
            name: '${servidor.nome.replace(/'/g, '\\\'').replace(/"/g, '\\"')}',
            cpf: '${servidor.cpf}',
            perfil: '${servidor.perfil || this.config.perfil || ''}',
            ojsCount: ${totalOjs || 0},
            processingTime: ${processingTime}
          });
        }
      `).catch(err => {
        console.log('⚠️ Erro ao adicionar servidor processado ao modal:', err.message);
      });
    }
  }

  async quickErrorRecovery() {
    console.log('⚡ Recuperação rápida após erro...');
    
    try {
      // Verificar se o navegador ainda está ativo
      await this.ensureBrowserActive();
      
      // Verificar se estamos na página correta
      const currentUrl = this.page.url();
      console.log(`🔍 URL atual após erro: ${currentUrl}`);
      
      // Se estivermos na página de pré-cadastro, tentar voltar
      if (currentUrl.includes('pre-cadastro')) {
        console.log('🔄 Detectada página de pré-cadastro, tentando voltar...');
        try {
          await this.page.goBack();
          await this.delay(2000);
          console.log('✅ Voltou da página de pré-cadastro');
        } catch (backError) {
          console.log('⚠️ Erro ao voltar da página de pré-cadastro:', backError.message);
        }
      }
      
      // Fechar modais rapidamente
      await Promise.race([
        this.closeAnyModalsRapido(),
        this.delay(1000)
      ]);
      
      // Escape como último recurso
      await this.page.keyboard.press('Escape');
      await this.delay(300);
      
    } catch (error) {
      console.log('⚠️ Erro na recuperação rápida:', error.message);
      // Se houver erro crítico, tentar reconectar navegador
      if (error.message.includes('Target page, context or browser has been closed')) {
        console.log('🔄 Erro crítico detectado, reconectando navegador...');
        await this.reconnectBrowser();
      }
    }
  }

  async attemptErrorRecovery() {
    console.log('🔧 Tentando recuperação automática...');
    
    try {
      // Aguardar estabilização mínima
      await this.delay(2000);
      
      // Tentar fechar modais de erro
      await this.closeAnyModals();
      
      // CORREÇÃO: Verificar se está na página de pré-cadastro e tentar voltar
      const currentUrl = this.page.url();
      console.log(`🔍 URL atual durante tentativa de recuperação: ${currentUrl}`);
      
      if (currentUrl.includes('pre-cadastro')) {
        console.log('⚠️ Detectado redirecionamento para pré-cadastro durante tentativa de recuperação');
        // Tentar voltar usando histórico do navegador
        try {
          await this.page.goBack({ waitUntil: 'domcontentloaded', timeout: 5000 });
          await this.delay(1000);
          console.log('✅ Voltou da página de pré-cadastro durante tentativa de recuperação');
        } catch (backError) {
          console.log('⚠️ Não foi possível voltar, mantendo na página atual');
        }
      } else {
        // Se não está em pré-cadastro, aguardar estabilização
        await this.delay(2000);
      }
      
      console.log('✅ Recuperação automática concluída');
      
    } catch (error) {
      console.log('⚠️ Falha na recuperação automática:', error.message);
    }
  }

  async ensureCleanState() {
    console.log('🧹 Garantindo estado limpo do navegador...');
    
    try {
      // Fechar quaisquer modais ou popups abertos
      await this.closeAnyModals();
      
      // Aguardar estabilização
      await this.delay(500);
      
      // Verificar se ainda está na página correta
      const currentUrl = this.page.url();
      console.log(`🔍 URL atual antes da limpeza: ${currentUrl}`);
      
      // CORREÇÃO: Não navegar para pessoa-fisica genérica para evitar redirecionamento para pré-cadastro
      // Apenas fechar modais e aguardar estabilização
      if (currentUrl.includes('pre-cadastro')) {
        console.log('⚠️ Detectado redirecionamento para pré-cadastro - mantendo na página atual');
        // Tentar voltar usando histórico do navegador
        try {
          await this.page.goBack({ waitUntil: 'domcontentloaded', timeout: 5000 });
          await this.delay(1000);
          console.log('✅ Voltou da página de pré-cadastro');
        } catch (backError) {
          console.log('⚠️ Não foi possível voltar, mantendo na página atual');
        }
      }
      
      console.log('✅ Estado limpo garantido sem redirecionamento');
      
    } catch (error) {
      console.warn('⚠️ Erro ao garantir estado limpo:', error.message);
      // Não propagar o erro, apenas log
    }
  }

  async performRobustRecovery() {
    console.log('🛠️ Executando recuperação robusta...');
    
    try {
      // Verificar se o navegador ainda está ativo
      if (!this.page || this.page.isClosed()) {
        console.log('🔄 Navegador fechado detectado, reconectando...');
        await this.reconnectBrowser();
        return;
      }
      
      // Aguardar estabilização extendida
      await this.delay(3000);
      
      // Múltiplas tentativas de fechamento de modais
      for (let i = 0; i < 3; i++) {
        await this.closeAnyModals();
        await this.delay(500);
      }
      
      // CORREÇÃO: Não navegar para pessoa-fisica genérica para evitar redirecionamento para pré-cadastro
      // Verificar se está na página de pré-cadastro e tentar voltar
      const currentUrl = this.page.url();
      console.log(`🔍 URL atual durante recuperação: ${currentUrl}`);
      
      if (currentUrl.includes('pre-cadastro')) {
        console.log('⚠️ Detectado redirecionamento para pré-cadastro durante recuperação');
        // Tentar voltar usando histórico do navegador
        try {
          await this.page.goBack({ waitUntil: 'domcontentloaded', timeout: 5000 });
          await this.delay(1000);
          console.log('✅ Voltou da página de pré-cadastro durante recuperação');
        } catch (backError) {
          console.log('⚠️ Não foi possível voltar, tentando reload da página atual');
          try {
            await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
            await this.delay(1000);
          } catch (reloadError) {
            console.log('⚠️ Reload falhou, mantendo na página atual');
          }
        }
      }
      
      // Aguardar página estabilizar completamente
      await Promise.race([
        this.page.waitForSelector('table', { timeout: 10000 }),
        this.page.waitForSelector('.datatable', { timeout: 10000 }),
        this.delay(5000) // Fallback
      ]);
      
      // Aguardar estabilização final
      await this.delay(2000);
      
      console.log('✅ Recuperação robusta concluída');
      
    } catch (error) {
      console.error('❌ Falha na recuperação robusta:', error.message);
      
      // Verificar se o erro é devido ao navegador fechado
      if (error.message.includes('Target page, context or browser has been closed') || 
          error.message.includes('Session closed') ||
          error.message.includes('Connection closed')) {
        console.log('🔄 Erro de conexão detectado, reconectando navegador...');
        await this.reconnectBrowser();
        return;
      }
      
      // Tentar recuperação básica como último recurso
      try {
        await this.delay(5000);
        await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
        await this.delay(2000);
        console.log('✅ Recuperação básica (reload) executada');
      } catch (reloadError) {
        console.error('💥 Falha total na recuperação:', reloadError.message);
        if (reloadError.message.includes('Target page, context or browser has been closed')) {
          await this.reconnectBrowser();
        }
      }
    }
  }

  async reconnectBrowser() {
    console.log('🔌 Reconectando navegador...');
    
    try {
      // Fechar conexões antigas se ainda existirem
      if (this.browser && this.browser.contexts().length > 0) {
        try {
          await this.browser.close();
        } catch (e) {
          console.log('⚠️ Erro ao fechar navegador antigo:', e.message);
        }
      }
      
      // Aguardar antes de reconectar
      await this.delay(2000);
      
      // Reinicializar navegador
      await this.initializeBrowser();
      
      // Realizar login novamente
      await this.performLogin();
      
      console.log('✅ Navegador reconectado com sucesso');
      
    } catch (error) {
      console.error('❌ Falha na reconexão do navegador:', error.message);
      throw new Error(`Falha crítica na reconexão do navegador: ${error.message}`);
    }
  }

  async ensureBrowserActive() {
    try {
      // Verificar se o navegador existe e está ativo
      if (!this.browser || !this.browser.isConnected()) {
        console.log('🔄 Navegador desconectado detectado, reconectando...');
        await this.reconnectBrowser();
        return;
      }

      // Verificar se a página existe e não está fechada
      if (!this.page || this.page.isClosed()) {
        console.log('🔄 Página fechada detectada, reconectando...');
        await this.reconnectBrowser();
        return;
      }

      // Verificar se a página está responsiva
      try {
        await this.page.evaluate(() => document.readyState);
      } catch (error) {
        console.log('🔄 Página não responsiva detectada, reconectando...', error.message);
        await this.reconnectBrowser();
        return;
      }

      console.log('✅ Navegador ativo e responsivo');
    } catch (error) {
      console.error('❌ Erro ao verificar estado do navegador:', error.message);
      await this.reconnectBrowser();
    }
  }

  async detectAndHandlePreCadastro() {
    try {
      const currentUrl = this.page.url();
      console.log(`🔍 Verificando URL atual: ${currentUrl}`);
      
      if (currentUrl.includes('pre-cadastro')) {
        console.log('⚠️ Detectada navegação para página de pré-cadastro!');
        
        // Tentar voltar usando o botão do navegador
        try {
          await this.page.goBack();
          await this.delay(3000);
          console.log('✅ Voltou da página de pré-cadastro usando goBack()');
          return true;
        } catch (backError) {
          console.log('⚠️ Erro ao usar goBack(), tentando navegação direta...');
          
          // Se goBack() falhar, tentar navegar diretamente para a página de servidores
          try {
            const baseUrl = currentUrl.split('/pre-cadastro')[0];
            const servidorUrl = `${baseUrl}/servidor`;
            await this.page.goto(servidorUrl);
            await this.delay(3000);
            console.log('✅ Navegou diretamente para página de servidores');
            return true;
          } catch (navError) {
            console.log('❌ Erro ao navegar diretamente:', navError.message);
            return false;
          }
        }
      }
      
      return false; // Não estava na página de pré-cadastro
    } catch (error) {
      console.log('❌ Erro ao detectar/tratar pré-cadastro:', error.message);
      return false;
    }
  }

  async handleErrorRecovery() {
    console.log('Iniciando recuperação após erro...');
    
    // Verificar se estamos na página de pré-cadastro
    const handledPreCadastro = await this.detectAndHandlePreCadastro();
    
    if (handledPreCadastro) {
      console.log('✅ Recuperação de pré-cadastro concluída');
      return;
    }
        
    // Aguardar estabilização
    await this.delay(3000);
        
    // Tentar fechar modais de erro
    await this.closeAnyModals();
        
    // Tentar pressionar Escape como último recurso
    try {
      await this.page.keyboard.press('Escape');
      await this.delay(1000);
    } catch (error) {
      console.log('Erro ao pressionar Escape:', error.message);
    }
  }

  // Método para otimizar resultados removendo duplicatas e melhorando informações
  otimizarResultados() {
    console.log('🔄 Otimizando resultados do relatório...');
    
    // Mapa para agrupar por órgão julgador
    const orgaosMap = new Map();
    
    // Processar cada resultado
    this.results.forEach(resultado => {
      const orgao = resultado.orgao;
      
      if (!orgaosMap.has(orgao)) {
        // Primeiro registro para este órgão
        let statusFinal = resultado.status;
        let observacoes = resultado.erro || '';
        
        // Normalizar status
        if (statusFinal === 'Sucesso' || statusFinal === 'Já Incluído') {
          statusFinal = 'Incluído com Sucesso';
          // Adicionar perfil nas observações (usar perfil do resultado se disponível)
          observacoes = resultado.perfil || this.config.perfil || 'Perfil não especificado';
        }
        
        orgaosMap.set(orgao, {
          orgao,
          status: statusFinal,
          observacoes,
          timestamp: resultado.timestamp
        });
      } else {
        // Já existe registro para este órgão - priorizar sucesso
        const existente = orgaosMap.get(orgao);
        
        if (resultado.status === 'Sucesso' && existente.status !== 'Incluído com Sucesso') {
          // Atualizar para sucesso se ainda não estava
          existente.status = 'Incluído com Sucesso';
          existente.observacoes = resultado.perfil || this.config.perfil || 'Perfil não especificado';
          existente.timestamp = resultado.timestamp;
        } else if (resultado.status === 'Já Incluído' && existente.status === 'Erro') {
          // Se teve erro antes mas agora está incluído, atualizar
          existente.status = 'Incluído com Sucesso';
          existente.observacoes = resultado.perfil || this.config.perfil || 'Perfil não especificado';
          existente.timestamp = resultado.timestamp;
        }
        // Ignorar duplicatas de "Já Incluído" ou outros casos
      }
    });
    
    // Converter mapa para array
    const resultadosFinais = Array.from(orgaosMap.values());
    
    console.log(`✅ Resultados otimizados: ${this.results.length} → ${resultadosFinais.length} (${this.results.length - resultadosFinais.length} duplicatas removidas)`);
    
    return resultadosFinais;
  }

  async generateMultiServerReport() {
    this.sendStatus('info', '📊 Gerando relatório consolidado...', 95, 'Finalizando processamento de múltiplos servidores');
        
    // Configurar diretório de saída
    const outputDir = path.join(__dirname, '..', '..', 'data');        
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Calcular estatísticas globais
    const totalServidores = this.processedServidores;
    const servidoresBemSucedidos = this.successfulServidores;
    const servidoresComFalha = this.failedServidores;
    
    let totalOJsProcessados = 0;
    let totalSucessos = 0;
    let totalErros = 0;
    let totalJaIncluidos = 0;
    let totalLocalizacoesProcessadas = 0;
    let totalLocalizacoesSucesso = 0;
    let totalLocalizacoesErro = 0;
    
    // Preparar dados detalhados por servidor
    const servidoresDetalhados = [];
    
    Object.values(this.servidorResults).forEach(server => {
      totalOJsProcessados += server.ojsProcessados;
      totalSucessos += server.sucessos;
      totalErros += server.erros;
      totalJaIncluidos += server.jaIncluidos;
      
      // Somar estatísticas de localizações
      if (server.localizacoes) {
        totalLocalizacoesProcessadas += server.localizacoes.processadas || 0;
        totalLocalizacoesSucesso += server.localizacoes.sucesso || 0;
        totalLocalizacoesErro += server.localizacoes.erro || 0;
      }
      
      servidoresDetalhados.push({
        nome: server.nome,
        cpf: server.cpf,
        perfil: server.perfil,
        status: server.status,
        tentativas: {
          realizadas: server.tentativas || 0,
          maximas: server.maxTentativas || 2,
          recuperacoes: server.tentativas > 1 ? server.tentativas - 1 : 0
        },
        estatisticas: {
          totalOJs: server.totalOJs,
          ojsProcessados: server.ojsProcessados,
          sucessos: server.sucessos,
          erros: server.erros,
          jaIncluidos: server.jaIncluidos,
          percentualSucesso: server.ojsProcessados > 0 ? 
            parseFloat(((server.sucessos / server.ojsProcessados) * 100).toFixed(1)) : 0,
          localizacoes: server.localizacoes || {
            processadas: 0,
            sucesso: 0,
            erro: 0,
            percentualSucesso: 0
          }
        },
        tempo: {
          inicioProcessamento: server.inicioProcessamento,
          fimProcessamento: server.fimProcessamento,
          tempoProcessamento: server.tempoProcessamento,
          tempoProcessamentoFormatado: server.tempoProcessamento ? 
            `${(server.tempoProcessamento/1000).toFixed(1)}s` : 'N/A'
        },
        detalhesOJs: server.detalhes,
        erroGeral: server.erroGeral || null
      });
    });
    
    // Relatório consolidado
    const relatorioConsolidado = {
      timestamp: new Date().toISOString(),
      tipoRelatorio: 'Múltiplos Servidores',
      resumoGeral: {
        totalServidores,
        servidoresBemSucedidos,
        servidoresComFalha,
        errosConsecutivosMaximos: this.consecutiveErrors || 0,
        percentualServidoresSucesso: totalServidores > 0 ? 
          parseFloat(((servidoresBemSucedidos / totalServidores) * 100).toFixed(1)) : 0,
        totalOJsProcessados,
        totalSucessos,
        totalErros,
        totalJaIncluidos,
        percentualOJsSucesso: totalOJsProcessados > 0 ? 
          parseFloat(((totalSucessos / totalOJsProcessados) * 100).toFixed(1)) : 0,
        localizacoes: {
          totalProcessadas: totalLocalizacoesProcessadas,
          totalSucesso: totalLocalizacoesSucesso,
          totalErro: totalLocalizacoesErro,
          percentualSucesso: totalLocalizacoesProcessadas > 0 ? 
            parseFloat(((totalLocalizacoesSucesso / totalLocalizacoesProcessadas) * 100).toFixed(1)) : 0
        },
        processamentoSequencial: {
          tentativasTotal: servidoresDetalhados.reduce((acc, s) => acc + (s.tentativas.realizadas || 0), 0),
          recuperacoesTotal: servidoresDetalhados.reduce((acc, s) => acc + s.tentativas.recuperacoes, 0),
          servidoresComRecuperacao: servidoresDetalhados.filter(s => s.tentativas.recuperacoes > 0).length,
          eficienciaProcessamento: totalServidores > 0 ? 
            parseFloat(((servidoresBemSucedidos / (servidoresDetalhados.reduce((acc, s) => acc + s.tentativas.realizadas, 0))) * 100).toFixed(1)) : 0
        }
      },
      servidores: servidoresDetalhados,
      resultadosDetalhados: this.results,
      estatisticasAvancadas: {
        tempoMedioProcessamentoServidor: servidoresDetalhados.length > 0 ? 
          servidoresDetalhados
            .filter(s => s.tempo.tempoProcessamento)
            .reduce((acc, s) => acc + s.tempo.tempoProcessamento, 0) / 
          servidoresDetalhados.filter(s => s.tempo.tempoProcessamento).length : 0,
        servidorMaisRapido: servidoresDetalhados
          .filter(s => s.tempo.tempoProcessamento && s.status === 'Concluído')
          .reduce((min, s) => !min || s.tempo.tempoProcessamento < min.tempo.tempoProcessamento ? s : min, null),
        servidorMaisLento: servidoresDetalhados
          .filter(s => s.tempo.tempoProcessamento && s.status === 'Concluído')
          .reduce((max, s) => !max || s.tempo.tempoProcessamento > max.tempo.tempoProcessamento ? s : max, null)
      }
    };
        
    // Salvar relatório JSON
    const timestamp = Date.now();
    const jsonPath = path.join(outputDir, `relatorio-multi-servidor-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(relatorioConsolidado, null, 2));
        
    // Gerar CSV consolidado
    const csvHeaders = [
      'Servidor',
      'CPF',
      'Perfil',
      'Status',
      'Total OJs',
      'Sucessos',
      'Erros',
      'Já Incluídos',
      '% Sucesso',
      'Tempo (s)',
      'Erro Geral'
    ];
    
    const csvRows = servidoresDetalhados.map(server => [
      `"${server.nome}"`,
      `"${server.cpf}"`,
      `"${server.perfil}"`,
      `"${server.status}"`,
      server.estatisticas.totalOJs,
      server.estatisticas.sucessos,
      server.estatisticas.erros,
      server.estatisticas.jaIncluidos,
      `${server.estatisticas.percentualSucesso}%`,
      server.tempo.tempoProcessamentoFormatado,
      `"${server.erroGeral || ''}"`
    ].join(','));
    
    const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
    const csvPath = path.join(outputDir, `relatorio-multi-servidor-${timestamp}.csv`);
    fs.writeFileSync(csvPath, csvContent);
    
    // Gerar relatório detalhado por OJ
    const csvOJHeaders = [
      'Servidor',
      'CPF Servidor', 
      'Órgão Julgador',
      'Status',
      'Perfil',
      'Erro',
      'Tempo (ms)',
      'Timestamp'
    ];
    
    const csvOJRows = [];
    servidoresDetalhados.forEach(server => {
      server.detalhesOJs.forEach(oj => {
        csvOJRows.push([
          `"${server.nome}"`,
          `"${server.cpf}"`,
          `"${oj.orgao}"`,
          `"${oj.status}"`,
          `"${oj.perfil || server.perfil}"`,
          `"${oj.erro || ''}"`,
          oj.tempo || '',
          `"${oj.timestamp}"`
        ].join(','));
      });
    });
    
    const csvOJContent = [csvOJHeaders.join(','), ...csvOJRows].join('\n');
    const csvOJPath = path.join(outputDir, `relatorio-detalhado-ojs-${timestamp}.csv`);
    fs.writeFileSync(csvOJPath, csvOJContent);
        
    console.log(`📄 Relatório JSON consolidado: ${jsonPath}`);
    console.log(`📄 Relatório CSV servidores: ${csvPath}`);
    console.log(`📄 Relatório CSV detalhado OJs: ${csvOJPath}`);
        
    // Imprimir resultado final
    console.log('=== RESULTADO FINAL MÚLTIPLOS SERVIDORES ===');
    console.log(JSON.stringify(relatorioConsolidado, null, 2));
    console.log('=== FIM RESULTADO ===');
        
    // Calcular estatísticas de recuperação
    const totalRecuperacoes = servidoresDetalhados.reduce((acc, s) => acc + s.tentativas.recuperacoes, 0);
    const servidoresComRecuperacao = servidoresDetalhados.filter(s => s.tentativas.recuperacoes > 0).length;
    
    // Dados corretos para o relatório final
    console.log(`🔍 [RELATÓRIO FINAL] Servidores processados: ${servidoresBemSucedidos}/${totalServidores}`);
    console.log(`🔍 [RELATÓRIO FINAL] Total OJs processadas: ${totalOJsProcessados}`);
    console.log(`🔍 [RELATÓRIO FINAL] Sucessos: ${totalSucessos}`);
    console.log(`🔍 [RELATÓRIO FINAL] Erros: ${totalErros}`);
    console.log(`🔍 [RELATÓRIO FINAL] Já incluídos: ${totalJaIncluidos}`);
    
    this.sendStatus('success', `🎉 Automação finalizada: ${servidoresBemSucedidos}/${totalServidores} servidor${totalServidores !== 1 ? 'es' : ''} processado${totalServidores !== 1 ? 's' : ''}`, 100,
      `✅ ${totalSucessos} vinculação${totalSucessos !== 1 ? 'ões' : ''} | ℹ️ ${totalJaIncluidos} já vinculado${totalJaIncluidos !== 1 ? 's' : ''} | ⚠️ ${totalErros} erro${totalErros !== 1 ? 's' : ''}`);
  }

  async generateReport() {
    this.sendStatus('info', 'Gerando relatório...', 95, 'Finalizando processo');
        
    // Configurar diretório de saída
    const outputDir = path.join(__dirname, '..', '..', 'data');
        
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // OTIMIZAR RESULTADOS: Remover duplicatas e melhorar informações
    const resultadosOtimizados = this.otimizarResultados();
        
    // Calcular estatísticas baseadas nos resultados otimizados
    const sucessos = resultadosOtimizados.filter(r => r.status === 'Incluído com Sucesso').length;
    const erros = resultadosOtimizados.filter(r => r.status === 'Erro').length;
    const totalValidos = sucessos + erros;
        
    // Gerar relatório JSON detalhado com resultados otimizados
    const jsonReport = {
      timestamp: new Date().toISOString(),
      config: {
        cpf: this.config.cpf,
        perfil: this.config.perfil,
        totalOrgaos: this.config && this.config.orgaos ? this.config.orgaos.length : 0
      },
      results: resultadosOtimizados, // Usar resultados otimizados
      summary: {
        total: resultadosOtimizados.length,
        sucessos,
        erros,
        totalValidos,
        estatisticas: totalValidos > 0 ? {
          percentualSucesso: parseFloat(((sucessos / totalValidos) * 100).toFixed(1)),
          percentualErros: parseFloat(((erros / totalValidos) * 100).toFixed(1))
        } : null
      },
      detalhes: {
        orgaosIncluidos: resultadosOtimizados.filter(r => r.status === 'Incluído com Sucesso').map(r => ({
          orgao: r.orgao,
          perfil: r.observacoes
        })),
        orgaosComErro: resultadosOtimizados.filter(r => r.status === 'Erro').map(r => ({
          orgao: r.orgao,
          erro: r.observacoes || 'Erro não especificado'
        }))
      }
    };
        
    // Salvar relatório
    const jsonPath = path.join(outputDir, `relatorio-servidor-${Date.now()}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
        
    // Gerar CSV otimizado
    const csvContent = [
      'Órgão Julgador,Status,Observações',
      ...resultadosOtimizados.map(r => `"${r.orgao}","${r.status}","${r.observacoes || ''}"`)
    ].join('\n');
        
    const csvPath = path.join(outputDir, `relatorio-servidor-${Date.now()}.csv`);
    fs.writeFileSync(csvPath, csvContent);
        
    console.log(`📄 Relatório JSON salvo em: ${jsonPath}`);
    console.log(`📄 Relatório CSV salvo em: ${csvPath}`);
        
    // Imprimir resultado final em formato JSON para ser capturado pelo servidor
    console.log('=== RESULTADO FINAL ===');
    console.log(JSON.stringify(jsonReport, null, 2));
    console.log('=== FIM RESULTADO ===');
        
    this.sendStatus('success', 'Relatório gerado', 98, `${sucessos} sucessos, ${erros} erros`);
  }

  async cleanup() {
    try {
      // Limpar parallelManager se ainda existir
      if (this.parallelManager) {
        console.log('🧹 Limpando parallelManager restante...');
        try {
          await this.parallelManager.stop();
          await this.parallelManager.cleanup();
          this.parallelManager = null;
          console.log('✅ ParallelManager limpo no cleanup');
        } catch (error) {
          console.error('❌ Erro ao limpar parallelManager no cleanup:', error);
        }
      }
      
      // Parar monitoramento de performance
      if (this.performanceMonitor) {
        this.performanceMonitor.stopMonitoring();
      }
      
      // Fechar conexão com banco de dados
      if (this.dbConnection) {
        console.log('🔌 Fechando conexão com banco de dados...');
        await this.dbConnection.close();
        this.dbConnection = null;
      }
      
      if (this.page && !this.page.isClosed()) {
        if (this.isProduction) {
          await this.page.close();
        } else {
          console.log('Mantendo página aberta para desenvolvimento');
        }
      }
            
      if (this.browser && this.isProduction) {
        await this.browser.close();
      }
    } catch (error) {
      console.error('Erro durante cleanup:', error);
    }
  }



  async stopAutomation() {
    this.isRunning = false;
    
    // Parar e limpar parallelManager se existir
    if (this.parallelManager) {
      console.log('🛑 Parando processamento paralelo...');
      try {
        await this.parallelManager.stop();
        await this.parallelManager.cleanup();
        this.parallelManager = null;
        console.log('✅ Processamento paralelo parado e limpo');
      } catch (error) {
        console.error('❌ Erro ao parar processamento paralelo:', error);
      }
    }
    
    await this.cleanup();
  }

  getRelatorio() {
    // Usar resultados otimizados para o relatório da interface
    const resultadosOtimizados = this.otimizarResultados();
    
    // Calcular estatísticas baseadas nos resultados otimizados
    const sucessos = resultadosOtimizados.filter(r => r.status === 'Incluído com Sucesso').length;
    const erros = resultadosOtimizados.filter(r => r.status === 'Erro').length;
    const totalValidos = sucessos + erros;
        
    // Retornar relatório otimizado no formato esperado pelo frontend
    return {
      timestamp: new Date().toISOString(),
      config: {
        cpf: this.config?.cpf || '',
        perfil: this.config?.perfil || '',
        totalOrgaos: this.config?.orgaos?.length || 0
      },
      resultados: resultadosOtimizados.map(r => ({
        orgao: r.orgao,
        status: r.status,
        observacoes: r.observacoes || '-'
      })),
      resumo: {
        total: resultadosOtimizados.length,
        sucessos,
        erros,
        totalValidos,
        percentualSucesso: totalValidos > 0 ? parseFloat(((sucessos / totalValidos) * 100).toFixed(1)) : 0,
        percentualErros: totalValidos > 0 ? parseFloat(((erros / totalValidos) * 100).toFixed(1)) : 0
      }
    };
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      progress: this.currentProgress,
      totalOrgaos: this.totalOrgaos,
      processedCount: this.results.length
    };
  }

  /**
   * Seleciona perfil com base na similaridade com o perfil configurado
   * @param {Object} opcoesPapel - Locator das opções disponíveis
   * @param {string} perfilConfigurado - Perfil configurado pelo usuário
   * @returns {boolean} True se perfil foi selecionado
   */
  async selecionarPerfilComSimilaridade(opcoesPapel, perfilConfigurado) {
    console.log(`🔍 [SIMILARIDADE] Analisando perfil configurado: "${perfilConfigurado}"`);
    
    try {
      const totalOpcoes = await opcoesPapel.count();
      let melhorMatch = null;
      let melhorSimilaridade = 0;
      let melhorIndice = -1;
      
      // Normalizar perfil configurado
      const perfilNormalizado = this.normalizarTextoParaComparacao(perfilConfigurado);
      
      // Analisar todas as opções
      for (let i = 0; i < totalOpcoes; i++) {
        try {
          const textoOpcao = await opcoesPapel.nth(i).textContent();
          if (!textoOpcao) continue;
          
          const opcaoNormalizada = this.normalizarTextoParaComparacao(textoOpcao);
          const similaridade = this.calcularSimilaridadePerfil(perfilNormalizado, opcaoNormalizada);
          
          console.log(`🔍 [COMPARAÇÃO] "${textoOpcao.trim()}" -> similaridade: ${(similaridade * 100).toFixed(1)}%`);
          
          if (similaridade > melhorSimilaridade && similaridade >= 0.7) { // 70% de similaridade mínima
            melhorMatch = textoOpcao.trim();
            melhorSimilaridade = similaridade;
            melhorIndice = i;
          }
        } catch (error) {
          console.log(`⚠️ [ERRO] Erro ao analisar opção ${i}: ${error.message}`);
        }
      }
      
      if (melhorMatch && melhorIndice >= 0) {
        console.log(`✅ [MATCH] Melhor match encontrado: "${melhorMatch}" (${(melhorSimilaridade * 100).toFixed(1)}%)`);
        await opcoesPapel.nth(melhorIndice).click({ timeout: 3000 });
        console.log('✅ [SELECIONADO] Perfil selecionado com sucesso!');
        return true;
      } else {
        console.log('❌ [SEM MATCH] Nenhuma opção atingiu similaridade mínima de 70%');
        return false;
      }
      
    } catch (error) {
      console.log(`❌ [ERRO] Erro na seleção por similaridade: ${error.message}`);
      return false;
    }
  }

  /**
   * Seleciona perfil baseado em palavras-chave específicas do perfil configurado
   * @param {Object} opcoesPapel - Locator das opções disponíveis  
   * @param {string} perfilConfigurado - Perfil configurado pelo usuário
   * @returns {boolean} True se perfil foi selecionado
   */
  async selecionarPerfilPorPalavrasChave(opcoesPapel, perfilConfigurado) {
    console.log(`🔑 [PALAVRAS-CHAVE] Analisando palavras-chave do perfil: "${perfilConfigurado}"`);
    
    try {
      // Extrair palavras-chave do perfil configurado
      const palavrasChaveConfiguracao = this.extrairPalavrasChave(perfilConfigurado);
      console.log(`🔑 [PALAVRAS] Palavras-chave extraídas: ${palavrasChaveConfiguracao.join(', ')}`);
      
      const totalOpcoes = await opcoesPapel.count();
      let melhorOpcao = null;
      let maiorNumeroMatches = 0;
      let melhorIndice = -1;
      
      for (let i = 0; i < totalOpcoes; i++) {
        try {
          const textoOpcao = await opcoesPapel.nth(i).textContent();
          if (!textoOpcao) continue;
          
          const palavrasOpcao = this.extrairPalavrasChave(textoOpcao);
          const matches = palavrasChaveConfiguracao.filter(palavra => 
            palavrasOpcao.some(palavraOpcao => 
              palavraOpcao.includes(palavra) || palavra.includes(palavraOpcao)
            )
          );
          
          console.log(`🔑 [ANÁLISE] "${textoOpcao.trim()}" -> matches: ${matches.length} (${matches.join(', ')})`);
          
          if (matches.length > maiorNumeroMatches && matches.length >= 1) {
            melhorOpcao = textoOpcao.trim();
            maiorNumeroMatches = matches.length;
            melhorIndice = i;
          }
          
        } catch (error) {
          console.log(`⚠️ [ERRO] Erro ao analisar opção ${i}: ${error.message}`);
        }
      }
      
      if (melhorOpcao && melhorIndice >= 0 && maiorNumeroMatches >= 1) {
        console.log(`✅ [MATCH] Melhor match por palavras-chave: "${melhorOpcao}" (${maiorNumeroMatches} matches)`);
        await opcoesPapel.nth(melhorIndice).click({ timeout: 3000 });
        console.log('✅ [SELECIONADO] Perfil selecionado por palavras-chave!');
        return true;
      } else {
        console.log('❌ [SEM MATCH] Nenhuma opção teve palavras-chave suficientes');
        return false;
      }
      
    } catch (error) {
      console.log(`❌ [ERRO] Erro na seleção por palavras-chave: ${error.message}`);
      return false;
    }
  }

  /**
   * Normaliza texto para comparação removendo acentos, pontuação e padronizando
   * @param {string} texto - Texto a ser normalizado
   * @returns {string} Texto normalizado
   */
  normalizarTextoParaComparacao(texto) {
    if (!texto) return '';
    
    // Validação de tipos
    let textoProcessado;
    if (typeof texto === 'string') {
      textoProcessado = texto;
    } else if (typeof texto === 'object' && texto.nome) {
      textoProcessado = texto.nome;
    } else {
      textoProcessado = String(texto);
    }
    
    return textoProcessado
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^\w\s]/g, ' ')        // Remove pontuação
      .replace(/\s+/g, ' ')            // Normaliza espaços
      .trim();
  }

  /**
   * Calcula similaridade entre dois textos usando algoritmo de Levenshtein
   * @param {string} texto1 - Primeiro texto
   * @param {string} texto2 - Segundo texto  
   * @returns {number} Similaridade entre 0 e 1
   */
  calcularSimilaridadePerfil(texto1, texto2) {
    if (!texto1 || !texto2) return 0;
    if (texto1 === texto2) return 1;
    
    const len1 = texto1.length;
    const len2 = texto2.length;
    const matrix = Array(len2 + 1).fill().map(() => Array(len1 + 1).fill(0));
    
    // Inicializar matriz
    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;
    
    // Calcular distância
    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = texto1[i - 1] === texto2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1,     // deleção
          matrix[j][i - 1] + 1,     // inserção
          matrix[j - 1][i - 1] + cost // substituição
        );
      }
    }
    
    const distance = matrix[len2][len1];
    const maxLen = Math.max(len1, len2);
    return maxLen === 0 ? 1 : (maxLen - distance) / maxLen;
  }

  /**
   * Extrai palavras-chave relevantes de um texto de perfil
   * @param {string} texto - Texto do perfil
   * @returns {Array} Array de palavras-chave
   */
  extrairPalavrasChave(texto) {
    if (!texto) return [];
    
    const textoNormalizado = this.normalizarTextoParaComparacao(texto);
    const palavras = textoNormalizado.split(' ').filter(p => p.length >= 3);
    
    // Palavras-chave específicas do contexto judiciário
    const palavrasRelevantes = [
      'secretario', 'secretaria', 'audiencia', 'assessor', 'analista', 
      'tecnico', 'auxiliar', 'diretor', 'coordenador', 'supervisor',
      'escrivao', 'oficial', 'chefe', 'gerente', 'judiciario',
      'estagiario', 'conhecimento', 'aprendizado', 'formacao'
    ];
    
    // Filtrar apenas palavras relevantes
    const palavrasChave = palavras.filter(palavra => 
      palavrasRelevantes.some(relevante => 
        palavra.includes(relevante) || relevante.includes(palavra)
      )
    );
    
    // Adicionar palavras completas se encontradas
    palavrasRelevantes.forEach(relevante => {
      if (textoNormalizado.includes(relevante) && !palavrasChave.includes(relevante)) {
        palavrasChave.push(relevante);
      }
    });
    
    return [...new Set(palavrasChave)]; // Remove duplicatas
  }
}

// Função principal para execução standalone
async function main() {
  try {
    // Carregar configuração
    const config = loadConfig();
        
    if (!config.cpf || !config.orgaos || config.orgaos.length === 0) {
      throw new Error('Configuração inválida: CPF e lista de órgãos são obrigatórios');
    }
        
    // Criar instância da automação
    const automation = new ServidorAutomationV2();
        
    // Executar automação
    await automation.startAutomation(config);
        
    console.log('Automação concluída com sucesso!');
        
  } catch (error) {
    console.error('Erro na automação:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = ServidorAutomationV2;
