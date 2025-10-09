/**
 * Processador de OJs em lote mantendo o modal aberto
 * Otimizado para processar múltiplos OJs sem sair do modal de Localização/Visibilidade
 */

const CejuscMapper = require('../utils/cejusc-mapper');
const OJIntelligentNormalizer = require('../utils/oj-intelligent-normalizer');
const { OJHighlightManager } = require('../oj-highlight-manager');
const EnhancedErrorRecovery = require('../utils/enhanced-error-recovery');
const OJVisualHighlighter = require('../utils/oj-visual-highlighter');

class BatchOJProcessor {
  constructor(page, config, performanceMonitor, performanceDashboard) {
    this.page = page;
    this.config = config;
    this.performanceMonitor = performanceMonitor;
    this.performanceDashboard = performanceDashboard;
    
    // Sistema de logs otimizado
    this.logLevel = config.logLevel || 'normal'; // 'minimal', 'normal', 'verbose'
    this.processedCount = 0;
    this.modalOpen = false;
    this.processedOJs = new Set();
    this.logger = console;
    this.cejuscMapper = new CejuscMapper();
    this.ojNormalizer = new OJIntelligentNormalizer();
    this.highlightManager = new OJHighlightManager();

    // Sistema de recuperação de erro avançado
    this.errorRecovery = new EnhancedErrorRecovery(page, this.logger);

    // Sistema de organização cronológica para OJs processados
    this.visualHighlighter = new OJVisualHighlighter(page, this.logger);
    
    // Cache inteligente de seletores para otimização máxima
    this.selectorCache = {
      // Cache de seletores que funcionaram
      workingSelector: null,
      workingGravarButton: null, // Cache do botão Gravar que funcionou
      workingPapelSelector: null, // Cache do campo Papel que funcionou
      workingVisibilidadeSelector: null, // Cache do campo Visibilidade que funcionou
      addLocationButton: null, // Cache do botão de adicionar localização/visibilidade
      
      // Contadores de uso para priorização
      selectorUsageCount: new Map(),
      buttonUsageCount: new Map(),
      
      // Cache de elementos encontrados
      modalContainer: 'mat-dialog-container',
      lastSuccessfulElements: new Map(),
      
      // Seletores priorizados por frequência de uso
      orgaoJulgadorSelectors: [
        'mat-dialog-container mat-select[placeholder="Órgão Julgador"]',
        'mat-dialog-container mat-select[formcontrolname="orgaoJulgador"]',
        'mat-dialog-container .mat-select[placeholder="Órgão Julgador"]',
        'mat-dialog-container .mat-form-field:has(.mat-select-placeholder:contains("Órgão Julgador")) .mat-select',
        'mat-dialog-container mat-select:has(.mat-select-placeholder:contains("Órgão Julgador"))'
      ],
      
      // Cache de botões Gravar priorizados
      gravarButtonSelectors: [
        'mat-dialog-container button:has-text("Gravar")',
        'mat-dialog-container button:has-text("Vincular")',
        '[role="dialog"] button:has-text("Gravar")',
        '[role="dialog"] button:has-text("Vincular")',
        'mat-dialog-container button:has-text("Vincular Órgão Julgador ao Perito")',
        'mat-dialog-container button:has-text("Salvar")',
        'button:has-text("Gravar")',
        'button:has-text("Vincular")'
      ],

      // Cache de campos Papel priorizados
      papelSelectors: [
        'mat-dialog-container mat-select[placeholder="Papel"]',
        'mat-dialog-container mat-select[placeholder*="Papel"]',
        'mat-dialog-container mat-select[placeholder*="papel" i]',
        '[role="dialog"] mat-select[placeholder="Papel"]',
        '.mat-dialog-container mat-select[placeholder="Papel"]',
        'mat-select[formcontrolname="papel"]',
        'mat-select[ng-reflect-name="papel"]',
        'select[name="papel"]',
        '.mat-select:has(.mat-select-placeholder:contains("Papel"))',
        '.mat-form-field:has(mat-label:contains("Papel")) mat-select',
        'mat-select[aria-label*="papel"]'
      ]
    };
  }

  /**
   * Extrai o texto do OJ de forma segura
   */
  extractOJText(orgao) {
    if (!orgao) return 'N/A';
    if (typeof orgao === 'string') return orgao;
    if (typeof orgao === 'object') {
      return orgao.nome || orgao.descricao || orgao.text || orgao.toString() || 'N/A';
    }
    return String(orgao);
  }

  /**
   * Sistema de logs otimizado
   */
  logInfo(message, force = false) {
    if (force || this.logLevel === 'verbose' || (this.logLevel === 'normal' && !message.includes('🔍'))) {
      console.log(message);
    }
  }

  logSuccess(message) {
    if (this.logLevel !== 'minimal') {
      console.log(message);
    }
  }

  logError(message) {
    console.log(message); // Sempre mostrar erros
  }

  logProgress(message) {
    if (this.logLevel === 'verbose' || (this.logLevel === 'normal' && this.processedCount % 5 === 0)) {
      console.log(message);
    }
  }

  /**
   * Verifica se um campo já está preenchido para evitar reprocessamento
   */
  async isFieldAlreadyFilled(selector, expectedValue = null) {
    try {
      const element = await this.page.locator(selector).first();
      if (!await element.isVisible({ timeout: 500 })) {
        return false;
      }

      const tagName = await element.evaluate(el => el.tagName.toLowerCase());
      
      if (tagName === 'mat-select' || tagName === 'select') {
        // Para selects, verificar se há valor selecionado
        const selectedText = await element.textContent();
        const hasSelection = selectedText && selectedText.trim() !== '' && !selectedText.includes('Selecione');
        
        if (expectedValue) {
          return hasSelection && selectedText.toLowerCase().includes(expectedValue.toLowerCase());
        }
        return hasSelection;
      } else if (tagName === 'input') {
        // Para inputs, verificar se há valor
        const value = await element.inputValue();
        if (expectedValue) {
          return value === expectedValue;
        }
        return value && value.trim() !== '';
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Processa múltiplos OJs mantendo o modal aberto
   */
  async processBatchOJs(ojsList) {
    console.log('🚀 [BATCH-OJ] Iniciando processamento em lote de OJs...');
    console.log(`📊 [BATCH-OJ] Total de OJs para processar: ${ojsList.length}`);
    
    const results = [];
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    try {
      // OTIMIZAÇÃO: Reorganizar seletores por frequência de uso
      this.optimizeSelectorOrder();
      
      // Abrir modal apenas uma vez
      if (!this.modalOpen) {
        console.log('📂 [BATCH-OJ] Abrindo modal de Localização/Visibilidade...');
        await this.openLocationModal();
        this.modalOpen = true;
      }
      
      // Processar cada OJ mantendo o modal aberto
      for (let i = 0; i < ojsList.length; i++) {
        const orgao = ojsList[i];
        const orgaoTexto = this.extractOJText(orgao);
        console.log(`\n🔄 [BATCH-OJ] Processando OJ ${i + 1}/${ojsList.length}: ${orgaoTexto}`);
        
        try {
          // Processar OJ individual
          const result = await this.processSingleOJ(orgao);
          
          if (result.status === 'success') {
            successCount++;
            this.processedOJs.add(orgaoTexto);
            console.log(`✅ [BATCH-OJ] OJ processado com sucesso: ${orgaoTexto}`);

            // Registrar OJ para organização cronológica
            if (this.visualHighlighter) {
              this.visualHighlighter.addProcessedOJ(orgaoTexto);
            }
          } else if (result.status === 'skipped') {
            skipCount++;
            this.processedOJs.add(orgaoTexto);
            console.log(`⏭️ [BATCH-OJ] OJ já existe, pulado: ${orgaoTexto}`);
          } else {
            errorCount++;
            console.log(`❌ [BATCH-OJ] Erro ao processar OJ: ${orgaoTexto}`);
          }

          results.push({
            orgao,
            ...result,
            timestamp: new Date().toISOString()
          });

          // ⚡ OTIMIZAÇÃO: Limpar campos apenas se NÃO foi pulado por PJE-281
          // Quando skipped, o erro já está na tela e clearFields pode clicar novamente no mesmo OJ
          if (i < ojsList.length - 1 && result.status !== 'skipped') {
            await this.clearFieldsForNextOJ();
          } else if (result.status === 'skipped') {
            console.log('⏭️ [BATCH-OJ] OJ pulado - aguardando apenas transição sem limpar campos');
          }
          
        } catch (error) {
          // Verificar se é um OJ que já existe (deve ser pulado, não é erro)
          if (error.code === 'OJ_JA_CADASTRADO' && error.skipOJ) {
            console.log(`⏭️ [BATCH-OJ] OJ já existente, pulado: ${orgao}`);
            skipCount++;
            this.processedOJs.add(orgao);
            results.push({
              orgao,
              status: 'skipped',
              message: 'OJ já cadastrado (verificação prévia)',
              ojEncontrado: error.ojEncontrado,
              timestamp: new Date().toISOString()
            });
            
            // Apenas limpar campos, não recuperar de erro
            await this.clearFieldsForNextOJ();
          } else {
            // Erro real - registrar como erro com detalhes
            const errorMessage = this.getDetailedErrorMessage(error, orgao);
            console.error(`❌ [BATCH-OJ] Erro processando ${orgao}:`, errorMessage);
            errorCount++;
            results.push({
              orgao,
              status: 'error',
              error: errorMessage,
              originalError: error.message,
              stack: error.stack,
              timestamp: new Date().toISOString()
            });
            
            // Tentar recuperar do erro
            await this.recoverFromError();
          }
        }
        
        // ⏱️ TRANSIÇÃO ENTRE OJs: Pausa para interface estabilizar
        // O tempo de processamento do PJe já é aguardado DENTRO do modal após clicar Gravar
        // Aqui aguardamos a interface limpar e estabilizar para o próximo OJ
        if (i < ojsList.length - 1) {
          console.log('⏳ [BATCH-OJ] Aguardando transição para próximo OJ...');
          await this.page.waitForTimeout(1000); // 1000ms: tempo para interface limpar e estabilizar entre OJs
        }
      }
      
    } catch (error) {
      const criticalErrorMessage = this.getDetailedErrorMessage(error, null, 'CRÍTICO');
      console.error('❌ [BATCH-OJ] Erro crítico no processamento em lote:', criticalErrorMessage);
      // Garantir que o erro lançado seja uma string
      const errorString = typeof criticalErrorMessage === 'string' ? criticalErrorMessage :
        (criticalErrorMessage?.error || criticalErrorMessage?.message || 'Erro crítico no processamento');
      throw new Error(errorString);
    } finally {
      // Fechar modal ao final (opcional)
      if (this.modalOpen && this.config.closeModalAfterBatch !== false) {
        await this.closeModal();
        this.modalOpen = false;
      }
    }
    
    // Relatório final
    console.log('\n📊 [BATCH-OJ] Processamento concluído!');
    console.log(`   ✅ Sucesso: ${successCount}`);
    console.log(`   ⏭️ Pulados: ${skipCount}`);
    console.log(`   ❌ Erros: ${errorCount}`);
    console.log(`   📊 Total: ${results.length}`);
    
    // Aplicar destaque visual aos OJs cadastrados
    if (successCount > 0) {
      console.log('\n🎨 [BATCH-OJ] Aplicando destaque visual aos OJs cadastrados...');
      try {
        // Usar o sistema de organização cronológica
        if (this.visualHighlighter && this.visualHighlighter.processedOJs.size > 0) {
          await this.visualHighlighter.applyVisualHighlights();
          // Sem destaque amarelo, apenas organização cronológica
        } else {
          // Fallback para o sistema antigo se necessário
          await this.highlightManager.highlightRegisteredOJs(this.page);
        }
        console.log('✨ [BATCH-OJ] Destaque visual aplicado com sucesso!');
      } catch (error) {
        console.warn('⚠️ [BATCH-OJ] Erro ao aplicar destaque visual:', error.message);
      }
    }
    
    return {
      success: errorCount === 0,
      results,
      summary: {
        total: results.length,
        success: successCount,
        skipped: skipCount,
        errors: errorCount
      }
    };
  }

  /**
   * Processa um único OJ no modal aberto
   */
  async processSingleOJ(orgao) {
    const startTime = Date.now();
    const orgaoTexto = this.extractOJText(orgao);

    try {
      this.processedCount++;
      this.logInfo(`🔄 [BATCH-OJ] Processando (${this.processedCount}): ${orgaoTexto}`, true);

      // Abrir modal apenas se estiver fechado
      if (!this.modalOpen || !await this.isModalOpen()) {
        this.logInfo('🔄 [BATCH-OJ] Abrindo modal de localização...');
        await this.openLocationModal();
        this.modalOpen = true;
        await this.page.waitForTimeout(50); // ULTRA REDUZIDO para 50ms
      }

      // Limpar campos antes de processar novo OJ
      await this.clearModalFields();

      // Selecionar OJ
      this.logInfo(`🔍 [BATCH-OJ] Selecionando OJ: ${orgaoTexto}`);
      const ojSelected = await this.selectOrgaoJulgador(orgao);
      if (!ojSelected) {
        throw new Error(`Não foi possível selecionar OJ: ${orgaoTexto}`);
      }

      // 🚀 OTIMIZAÇÃO: Ir direto para configuração do papel
      // A verificação de OJs já vinculados é feita ANTES do processamento (verificação inteligente)
      // Não há necessidade de verificar novamente aqui, pois isso causa lentidão

      // Configurar papel e visibilidade
      this.logProgress('🔄 [BATCH-OJ] Configurando Papel e Visibilidade...');
      await this.configurePapelVisibilidade();
      this.logProgress('✅ [BATCH-OJ] Papel e Visibilidade configurados');

      // Configurar data inicial se necessário
      this.logProgress('🔄 [BATCH-OJ] Configurando dados iniciais...');
      await this.configureDataInicial();
      this.logProgress('✅ [BATCH-OJ] Dados iniciais configurados');

      // Salvar configuração
      this.logProgress('🔄 [BATCH-OJ] Salvando configuração...');
      const saveResult = await this.saveConfiguration();
      
      // 🚀 OTIMIZAÇÃO: Usar sistema avançado de recuperação para PJE-281
      if (saveResult && saveResult.pje281Error) {
        console.log(`⚠️ [BATCH-OJ] OJ ${orgaoTexto} já cadastrado - aplicando recuperação avançada`);

        // Aplicar recuperação avançada se disponível
        if (this.errorRecovery) {
          const recovered = await this.errorRecovery.recoverFromPJE281();
          if (!recovered) {
            console.log('⚠️ [BATCH-OJ] Recuperação falhou - modal pode estar fechado');
          }
        }

        return {
          status: 'skipped',
          message: 'OJ já cadastrado anteriormente (PJE-281)',
          duration: Date.now() - startTime
        };
      }
      
      // Se chegou até aqui e saveConfiguration foi bem-sucedido
      if (saveResult && saveResult.success) {
        this.logProgress('✅ [BATCH-OJ] Configuração salva');
        // Registrar sucesso para otimizar próximos tempos
        if (this.errorRecovery) {
          this.errorRecovery.recordSuccess();
        }
      } else {
        // Se não conseguiu salvar e não há erro PJE-281, pode ser outro problema
        console.log(`⚠️ [BATCH-OJ] Problema ao salvar configuração para ${orgaoTexto}:`, saveResult?.reason || 'motivo desconhecido');
        return {
          status: 'error',
          message: `Erro ao salvar: ${saveResult?.reason || 'motivo desconhecido'}`,
          duration: Date.now() - startTime
        };
      }

      // Sucesso - adiciona ao rastreamento para destaque visual
      console.log(`✅ [BATCH-OJ] OJ ${orgaoTexto} processado com sucesso`);
      this.highlightManager.addRegisteredOJ(orgaoTexto);

      return {
        status: 'success',
        message: 'Vinculado com sucesso',
        duration: Date.now() - startTime
      };

    } catch (error) {
      console.error(`❌ [BATCH-OJ] Erro ao processar OJ ${orgaoTexto}:`, error.message);
      return {
        status: 'error',
        message: error.message,
        error: error.message,
        stack: error.stack,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Seleciona um órgão julgador no dropdown
   */
  async selectOrgaoJulgador(orgao) {
    const orgaoTexto = this.extractOJText(orgao);

    try {
      // Encontrar campo de OJ usando cache inteligente
      const ojFieldResult = await this.findElementWithCache('orgao');
      if (!ojFieldResult) {
        throw new Error('Campo de Órgão Julgador não encontrado');
      }

      const ojField = ojFieldResult.element;
      
      // Detecção prévia - verificar se já está preenchido com o valor correto
      try {
        const currentText = await ojField.textContent();
        if (currentText && currentText.trim()) {
          const currentLower = currentText.toLowerCase().trim();
          const orgaoLower = orgaoTexto.toLowerCase().trim();
          
          if (currentLower.includes(orgaoLower) || orgaoLower.includes(currentLower)) {
            this.logSuccess(`✅ Órgão Julgador já preenchido: "${currentText}"`);
            return true;
          }
        }
      } catch (e) {
        // Continuar com o processo normal se não conseguir verificar
      }

      // Garantir que elemento está visível
      try {
        await ojField.scrollIntoViewIfNeeded({ timeout: 200 });
      } catch (e) {
        // Ignora se não precisar de scroll
      }

      // Clicar no campo para abrir dropdown
      let dropdownOpened = false;

      try {
        // ESTRATÉGIA 1: Clique direto
        await ojField.click({ timeout: 5000 });
        await this.page.waitForSelector('mat-option', { timeout: 1000 });
        dropdownOpened = true;
      } catch (clickError) {
        // ESTRATÉGIA 2: JavaScript click
        try {
          await ojField.evaluate(el => el.click());
          await this.page.waitForTimeout(200);
          if (await this.page.locator('mat-option').count() > 0) dropdownOpened = true;
        } catch (e) {}

        // ESTRATÉGIA 3: Focus + Enter
        if (!dropdownOpened) {
          try {
            await ojField.focus();
            await this.page.keyboard.press('Enter');
            await this.page.waitForTimeout(200);
            if (await this.page.locator('mat-option').count() > 0) dropdownOpened = true;
          } catch (e) {}
        }

        if (!dropdownOpened) {
          throw new Error('Não foi possível abrir o dropdown');
        }
      }

      // Busca pela opção correta
      const opcoes = await this.page.locator('mat-option').all();
      let opcaoEncontrada = false;
      let melhorOpcao = null;
      let melhorScore = -1;
      let melhorTexto = '';
      const orgaoLower = orgaoTexto.toLowerCase().trim();

      for (const opcao of opcoes) {
        try {
          const texto = await opcao.textContent({ timeout: 2000 });
          if (!texto) continue;

          const textoLower = texto.toLowerCase().trim();

          // Match exato - PARAR IMEDIATAMENTE
          if (textoLower === orgaoLower || texto.trim() === orgaoTexto.trim()) {
            melhorOpcao = opcao;
            melhorScore = 100;
            melhorTexto = texto;
            break;
          }

          // 2. Contém o texto completo
          if (textoLower.includes(orgaoLower)) {
            // Se já é melhor que o atual, atualizar
            if (90 > melhorScore) {
              melhorScore = 90;
              melhorOpcao = opcao;
              melhorTexto = texto;
              console.log(`📊 [BATCH-OJ] Melhor match até agora: "${texto}" (score: 90)`);
            }
          }
        } catch (textError) {
          console.log(`⚠️ [BATCH-OJ] Erro ao ler texto da opção ${i + 1}/${opcoes.length}: ${textError.message}`);
          // Continuar com próxima opção
          continue;
        }
      }

      // Selecionar a melhor opção encontrada (mínimo 70 pontos)
      if (melhorOpcao && melhorScore >= 70) {
        await melhorOpcao.click();
        // Usar delay dinâmico baseado no histórico
      const dropdownDelay = this.errorRecovery ? this.errorRecovery.getWaitTime(150) : 200;
      await this.page.waitForTimeout(50); // ULTRA REDUZIDO para máxima velocidade
        console.log(`✅ [BATCH-OJ] OJ selecionado: "${orgaoTexto}" → "${melhorTexto}" (Score: ${melhorScore})`);
        opcaoEncontrada = true;
      } else {
        console.log(`⚠️ [BATCH-OJ] Nenhuma opção boa encontrada. Melhor score: ${melhorScore}`);
      }

      if (!opcaoEncontrada) {
        // Tentar digitar para filtrar com timeout ultra otimizado
        console.log(`🔍 [BATCH-OJ] Tentando filtrar digitando: ${orgaoTexto}`);
        await ojField.type(orgaoTexto.substring(0, 15)); // Aumentado para 15 caracteres para maior precisão
        await this.page.waitForTimeout(300); // Aguardar filtro aplicar

        // Tentar novamente após filtrar
        const opcoesFiltradas = await this.page.locator('mat-option').all();
        console.log(`🔍 [BATCH-OJ] ${opcoesFiltradas.length} opções após filtro`);

        for (let i = 0; i < opcoesFiltradas.length; i++) {
          const opcao = opcoesFiltradas[i];

          try {
            const texto = await opcao.textContent({ timeout: 3000 });

            if (!texto) continue;

            if (texto.includes(orgaoTexto.substring(0, 10))) {
              await opcao.click({ timeout: 3000 });
              console.log(`✅ [BATCH-OJ] OJ selecionado após filtro: ${orgaoTexto}`);
              opcaoEncontrada = true;
              break;
            }
          } catch (filterError) {
            console.log(`⚠️ [BATCH-OJ] Erro ao processar opção filtrada ${i + 1}: ${filterError.message}`);
            continue;
          }
        }
      }

      return opcaoEncontrada;

    } catch (error) {
      console.error(`❌ [BATCH-OJ] Erro ao selecionar OJ: ${error.message}`);
      // Tentar fechar dropdown se ainda estiver aberto
      try {
        await this.page.keyboard.press('Escape');
      } catch (e) {
        // Ignorar
      }
      return false;
    }
  }

  /**
   * Limpa os campos do modal para novo processamento
   */
  async clearModalFields() {
    try {
      // Limpeza ultra-rápida de mensagens de erro (sem verificações desnecessárias)
      try {
        const errorMessages = await this.page.locator('.mat-error, .mat-snack-bar-container').all();
        for (const error of errorMessages) {
          try {
            const closeBtn = await error.locator('button').first();
            await closeBtn.click({ timeout: 100 });
          } catch (e) {
            // Ignora
          }
        }
      } catch (e) {
        // Ignora se não houver mensagens de erro
      }

    } catch (error) {
      // Não lançar erro, continuar processamento
    }
  }

  /**
   * Normalização básica como fallback
   */
  normalizeTextBasic(texto) {
    if (!texto) return '';
    return texto
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^\w\s]/g, ' ')        // Remove pontuação
      .replace(/\s+/g, ' ')            // Normaliza espaços
      .trim();
  }

  /**
   * Verifica se o texto contém as palavras-chave principais do OJ
   */
  containsKeyWords(orgaoTexto, textoOpcao) {
    if (!orgaoTexto || !textoOpcao) return false;

    // Extrair palavras-chave importantes (ignorar artigos e preposições)
    const palavrasIgnorar = ['da', 'do', 'de', 'a', 'o', 'e', 'em', 'para', 'com', 'por'];
    const palavrasOrgao = orgaoTexto.toLowerCase()
      .split(/\s+/)
      .filter(palavra => palavra.length > 2 && !palavrasIgnorar.includes(palavra));

    const textoOpcaoLower = textoOpcao.toLowerCase();

    // Verificar se pelo menos 80% das palavras-chave estão presentes
    let palavrasEncontradas = 0;
    for (const palavra of palavrasOrgao) {
      if (textoOpcaoLower.includes(palavra)) {
        palavrasEncontradas++;
      }
    }

    const percentualEncontrado = palavrasOrgao.length > 0 ? palavrasEncontradas / palavrasOrgao.length : 0;
    return percentualEncontrado >= 0.8;
  }

  /**
   * Calcula similaridade entre dois textos usando Levenshtein
   */
  calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;

    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = Array(len2 + 1).fill().map(() => Array(len1 + 1).fill(0));

    // Inicializar matriz
    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;

    // Calcular distância
    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
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
   * OTIMIZAÇÃO: Espera inteligente com verificação ativa ULTRA OTIMIZADA
   */
  async waitForCondition(conditionFn, maxWaitMs = 1000, checkIntervalMs = 50) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const result = await conditionFn();
        if (result) {
          return true;
        }
      } catch (e) {
        // Continuar tentando
      }

      await this.page.waitForTimeout(checkIntervalMs);
    }

    return false;
  }

  /**
   * Detecção e tratamento otimizado do erro PJE-281
   * @returns {Promise<Object>} - Resultado da verificação
   */
  /**
   * 🚀 OTIMIZAÇÃO: Verificação precoce de erro PJE-281
   * Verifica se a OJ já existe logo após selecioná-la, antes de preencher campos
   */
  /**
   * MÉTODO DESABILITADO - Verificação precoce PJE-281 removida
   * Motivo: A verificação inteligente pré-processamento já identifica OJs vinculados
   * Manter esse método causava lentidão desnecessária e verificação duplicada
   */
  async checkForEarlyPJE281() {
    // Retornar sucesso direto sem verificar - economia de 300-500ms por OJ
    return { success: true };
  }

  /**
   * Resolve erro rapidamente sem muito processamento
   */
  async quickResolveError() {
    try {
      // Tentar fechar erro rapidamente
      await this.page.keyboard.press('Escape');
      await this.page.waitForTimeout(100);
      
      // Verificar se há botão de fechar visível
      const closeButtons = await this.page.locator('button:has-text("Fechar"), button:has-text("OK"), button[aria-label*="close"]').all();
      for (const button of closeButtons) {
        if (await button.isVisible({ timeout: 100 })) {
          await button.click();
          break;
        }
      }
    } catch (e) {
      // Ignora erros na resolução rápida
    }
  }

  async handlePJE281Error() {
    console.log('🔍 [BATCH-OJ] Verificando erro PJE-281 ou OJ já existente...');
    
    try {
      // Aguardar um pouco mais para o erro aparecer, especialmente quando botão não foi encontrado
      const errorDetected = await this.waitForCondition(async () => {
        // Verificar múltiplos tipos de mensagens de erro
        const errorSelectors = [
          '.mat-error', 
          '.mat-snack-bar-container', 
          '.mat-simple-snackbar',
          '.mat-dialog-content .mat-error',
          '[role="alert"]',
          '.error-message',
          '.alert-danger'
        ];
        
        for (const selector of errorSelectors) {
          const errorMessages = await this.page.locator(selector).all();
          
          for (const errorMessage of errorMessages) {
            if (await errorMessage.isVisible().catch(() => false)) {
              const errorText = await errorMessage.textContent().catch(() => '');
              if (errorText && (
                errorText.includes('PJE-281') || 
                errorText.includes('período ativo conflitante') ||
                errorText.includes('já existe') ||
                errorText.includes('já vinculado') ||
                errorText.includes('duplicado') ||
                errorText.includes('conflito')
              )) {
                console.log(`🔍 [BATCH-OJ] Erro detectado: "${errorText.trim()}"`);
                return { found: true, element: errorMessage, text: errorText };
              }
            }
          }
        }
        return false;
      }, 3000, 100); // Aumentado para 3000ms para dar mais tempo ao erro aparecer (desacelerado)

      if (!errorDetected) {
        console.log('✅ [BATCH-OJ] Nenhum erro PJE-281 detectado');
        return { success: true };
      }

      console.log('⚠️ [BATCH-OJ] Erro PJE-281 detectado - iniciando tratamento otimizado...');
      
      // OTIMIZAÇÃO: Múltiplas estratégias de fechamento do erro com timeouts reduzidos
      const errorResolved = await this.waitForCondition(async () => {
        // Estratégia 1: Aguardar desaparecimento natural
        const errorMessages = await this.page.locator('.mat-error, .mat-snack-bar-container, .mat-simple-snackbar').all();
        let hasVisibleError = false;
        
        for (const errorMessage of errorMessages) {
          if (await errorMessage.isVisible().catch(() => false)) {
            const errorText = await errorMessage.textContent().catch(() => '');
            if (errorText && (errorText.includes('PJE-281') || errorText.includes('período ativo conflitante'))) {
              hasVisibleError = true;
              
              // Estratégia 2: Tentar clicar em botão de fechar
              try {
                const closeButton = await errorMessage.locator('button, .mat-button, [aria-label*="close"], [aria-label*="fechar"]').first();
                if (await closeButton.isVisible({ timeout: 50 })) { // Reduzido de 100ms para 50ms
                  await closeButton.click();
                  console.log('🔄 [BATCH-OJ] Clicou no botão fechar do erro');
                  await this.page.waitForTimeout(10); // MÁXIMO REDUZIDO
                }
              } catch (e) {
                // Estratégia 3: Pressionar Escape
                try {
                  await this.page.keyboard.press('Escape');
                  console.log('🔄 [BATCH-OJ] Pressionou Escape para fechar erro');
                  await this.page.waitForTimeout(10); // MÁXIMO REDUZIDO
                } catch (e2) {
                  // Continua tentando
                }
              }
              break;
            }
          }
        }
        
        return !hasVisibleError;
      }, 2500, 100); // Aumentado para 2500ms para dar mais tempo ao PJe processar o erro

      if (errorResolved) {
        console.log('✅ [BATCH-OJ] Erro PJE-281 resolvido com sucesso');
        return { pje281Error: true, resolved: true };
      } else {
        console.log('⚠️ [BATCH-OJ] Erro PJE-281 persistente - continuando mesmo assim');
        return { pje281Error: true, resolved: false };
      }
      
    } catch (error) {
      console.log(`⚠️ [BATCH-OJ] Erro na verificação PJE-281: ${error.message}`);
      return { success: true }; // Continua processamento em caso de erro
    }
  }

  /**
   * CACHE INTELIGENTE: Atualiza o cache com seletor que funcionou
   */
  updateSelectorCache(type, selector) {
    const currentCount = this.selectorCache.selectorUsageCount.get(selector) || 0;
    this.selectorCache.selectorUsageCount.set(selector, currentCount + 1);
    
    // Atualizar cache específico
    switch (type) {
    case 'gravar':
      this.selectorCache.workingGravarButton = selector;
      break;
    case 'papel':
      this.selectorCache.workingPapelSelector = selector;
      break;
    case 'visibilidade':
      this.selectorCache.workingVisibilidadeSelector = selector;
      break;
    case 'orgao':
      this.selectorCache.workingSelector = selector;
      break;
    }
    
    console.log(`🎯 [CACHE] Seletor ${type} atualizado: ${selector} (uso: ${currentCount + 1}x)`);
  }

  /**
   * CACHE INTELIGENTE: Busca elemento usando cache primeiro
   */
  async findElementWithCache(type, fallbackSelectors = []) {
    let cachedSelector = null;
    
    // Verificar cache específico primeiro
    switch (type) {
    case 'gravar':
      cachedSelector = this.selectorCache.workingGravarButton;
      fallbackSelectors = this.selectorCache.gravarButtonSelectors;
      break;
    case 'papel':
      cachedSelector = this.selectorCache.workingPapelSelector;
      fallbackSelectors = this.selectorCache.papelSelectors;
      break;
    case 'visibilidade':
      cachedSelector = this.selectorCache.workingVisibilidadeSelector;
      break;
    case 'orgao':
      cachedSelector = this.selectorCache.workingSelector;
      fallbackSelectors = this.selectorCache.orgaoJulgadorSelectors;
      break;
    }
    
    // Tentar cache primeiro (mais rápido)
    if (cachedSelector) {
      try {
        const element = this.page.locator(cachedSelector);
        const isVisible = await element.first().isVisible({ timeout: 500 });
        if (isVisible) {
          console.log(`⚡ [CACHE] Elemento ${type} encontrado via cache: ${cachedSelector}`);
          return { element: element.first(), selector: cachedSelector };
        }
      } catch (e) {
        console.log(`⚠️ [CACHE] Cache ${type} falhou, tentando fallbacks...`);
      }
    }
    
    // Fallback para lista de seletores
    for (const selector of fallbackSelectors) {
      try {
        const element = this.page.locator(selector);
        const isVisible = await element.first().isVisible({ timeout: 400 });
        if (isVisible) {
          console.log(`✅ [CACHE] Elemento ${type} encontrado: ${selector}`);
          this.updateSelectorCache(type, selector);
          return { element: element.first(), selector };
        }
      } catch (e) {
        continue;
      }
    }
    
    return null;
  }

  /**
   * CACHE INTELIGENTE: Reorganiza seletores por frequência de uso
   */
  optimizeSelectorOrder() {
    // Reorganizar botões Gravar por frequência
    this.selectorCache.gravarButtonSelectors.sort((a, b) => {
      const countA = this.selectorCache.selectorUsageCount.get(a) || 0;
      const countB = this.selectorCache.selectorUsageCount.get(b) || 0;
      return countB - countA; // Ordem decrescente
    });
    
    // Reorganizar seletores de órgão por frequência
    this.selectorCache.orgaoJulgadorSelectors.sort((a, b) => {
      const countA = this.selectorCache.selectorUsageCount.get(a) || 0;
      const countB = this.selectorCache.selectorUsageCount.get(b) || 0;
      return countB - countA; // Ordem decrescente
    });
    
    console.log('🔄 [CACHE] Seletores reorganizados por frequência de uso');
  }

  /**
   * Abre o modal de Localização/Visibilidade
   */
  async openLocationModal() {
    console.log('🔄 [BATCH-OJ] Abrindo modal de localização...');
    
    try {
      // Verificar se modal já está aberto
      if (await this.isModalOpen()) {
        console.log('✅ [BATCH-OJ] Modal já está aberto');
        return;
      }
      
      let buttonClicked = false;
      
      // Tentar usar botão em cache primeiro
      if (this.selectorCache.addLocationButton) {
        try {
          const cachedButton = await this.page.locator(this.selectorCache.addLocationButton);
          if (await cachedButton.isVisible({ timeout: 300 })) {
            await this.retryWithBackoff(async () => {
              await cachedButton.click();
            }, 2, 100, 'clique no botão de adicionar localização via cache');
            console.log('⚡ [BATCH-OJ] Botão clicado usando cache');
            buttonClicked = true;
          }
        } catch (e) {
          console.log('⚠️ [BATCH-OJ] Cache do botão inválido, tentando outros seletores...');
          this.selectorCache.addLocationButton = null; // Limpar cache inválido
        }
      }
      
      // Se cache falhou, tentar seletores conhecidos rapidamente
      if (!buttonClicked) {
        // 🚀 BUSCA OTIMIZADA - Tentar primeiro o mais rápido (getByRole)
        try {
          const addButton = this.page.getByRole('button', { name: /adicionar.*localiza.*visibilidade/i });
          if (await addButton.isVisible({ timeout: 150 })) {
            await addButton.click();
            console.log('✅ [BATCH-OJ] Botão clicado via getByRole!');
            buttonClicked = true;
          }
        } catch (e) {
          // Fallback para seletores específicos
          const buttonSelectors = [
            'button:has-text("Adicionar Localização/Visibilidade")',
            'button.mat-raised-button:has-text("Adicionar")',
            'button.mat-primary:has-text("Adicionar")'
          ];

          for (const selector of buttonSelectors) {
            try {
              const button = await this.page.locator(selector).first();
              if (await button.isVisible({ timeout: 30 })) {
                await button.click();
                this.selectorCache.addLocationButton = selector;
                buttonClicked = true;
                console.log('✅ [BATCH-OJ] Botão clicado!');
                break;
              }
            } catch (e2) {
              continue;
            }
          }
        }
      }
      
      if (!buttonClicked) {
        // Última tentativa: busca ampla por qualquer botão "Adicionar"
        try {
          const visibleButtons = await this.page.locator('button:visible').all();
          for (const button of visibleButtons.slice(0, 20)) {
            const text = await button.textContent({ timeout: 30 });
            if (text?.toLowerCase().includes('adicionar')) {
              console.log(`✅ [BATCH-OJ] Botão encontrado: "${text.trim()}"`);
              await button.click();
              buttonClicked = true;
              break;
            }
          }
        } catch (e) {
          // Falhou completamente
        }
      }
      
      if (!buttonClicked) {
        // Diagnóstico rápido apenas com contagem
        console.log('❌ [BATCH-OJ] Botão "Adicionar" não encontrado');
        const totalButtons = await this.page.locator('button').count();
        console.log(`📊 [BATCH-OJ] Total de botões na página: ${totalButtons}`);

        throw new Error('Nenhum botão "Adicionar Localização/Visibilidade" encontrado após todas as tentativas');
      }
      
      // 🚀 OTIMIZAÇÃO: Aguardar modal com timeout ULTRA REDUZIDO
      try {
        await this.waitForCondition(
          async () => await this.isModalOpen(),
          300,  // ULTRA REDUZIDO de 600ms para 300ms
          30    // Verificar a cada 30ms para detecção ainda mais rápida
        );
        console.log('✅ [BATCH-OJ] Modal aberto');
      } catch (e) {
        // Não falhar, continuar processamento
      }
      
    } catch (error) {
      console.log('❌ [BATCH-OJ] Erro ao abrir modal de localização:', error.message);
      throw error;
    }
  }

  /**
   * Configura papel e visibilidade
   */
  async configurePapelVisibilidade() {
    // Configurar papel (se campo existir e estiver vazio)
    try {
      const papel = this.config.perfil || 'Assessor';
      this.logProgress(`🔄 [BATCH-OJ] Configurando papel: ${papel}`);

      // 🚀 USAR CACHE INTELIGENTE para campo Papel
      const papelFieldResult = await this.findElementWithCache('papel');

      if (!papelFieldResult) {
        console.log(`⚠️ [BATCH-OJ] Campo de papel não encontrado após tentativas de cache`);
        return; // Não bloquear o processamento se papel não for encontrado
      }

      const papelSelect = papelFieldResult.element;
      console.log(`⚡ [CACHE] Campo Papel encontrado via cache: ${papelFieldResult.selector}`);

      // Verificação prévia otimizada - verificar se já está preenchido
      let papelJaPreenchido = false;
      try {
        const currentValue = await papelSelect.locator('.mat-select-value-text').textContent({ timeout: 300 });
        if (currentValue && currentValue.trim() && currentValue.trim() !== 'Selecione' && currentValue.trim() !== 'Papel*') {
          papelJaPreenchido = true;
          console.log(`⚡ [BATCH-OJ] Papel já configurado: ${currentValue.trim()}`);
        }
      } catch (e) {
        // Continuar para configuração se não conseguir ler o valor
      }

      if (papelJaPreenchido) {
        return; // Pular configuração se já estiver preenchido
      }

      // Configurar papel com cache system
      try {
        // Clicar para abrir as opções
        await papelSelect.click();
        console.log('✅ [BATCH-OJ] Dropdown papel aberto via cache');
        await this.page.waitForTimeout(100); // REDUZIDO

        // Aguardar opções aparecerem
        await this.waitForCondition(async () => {
          const options = await this.page.locator('mat-option').count();
          return options > 0;
        }, 1000, 50);

        // Encontrar e clicar na opção
        const papelOption = await this.page.locator(`mat-option:has-text("${papel}")`);
        const optionCount = await papelOption.count();

        if (optionCount > 0) {
          const isVisible = await papelOption.first().isVisible();
          if (isVisible) {
            await papelOption.first().click();
            console.log(`✅ [BATCH-OJ] Papel configurado via cache: ${papel}`);
          } else {
            console.log(`⚠️ [BATCH-OJ] Opção de papel não visível: ${papel}`);
          }
        } else {
          console.log(`⚠️ [BATCH-OJ] Papel não encontrado nas opções: ${papel}`);
        }
      } catch (clickError) {
        console.log(`⚠️ [BATCH-OJ] Erro ao configurar papel: ${clickError.message}`);
        // Tentar fechar dropdown se aberto
        try {
          await this.page.keyboard.press('Escape');
          await this.page.waitForTimeout(200);
        } catch (e) {
          // Ignorar erro ao fechar
        }
      }
    } catch (e) {
      console.log(`⚠️ [BATCH-OJ] Erro ao configurar papel: ${e.message}`);
    }
    
    // Configurar visibilidade (geralmente já vem com padrão "Público")
    try {
      const visibilidadeSelect = await this.page.locator('mat-dialog-container mat-select[placeholder*="Visibilidade"]').first();
      const visibilidadeValue = await visibilidadeSelect.locator('.mat-select-value-text').textContent();
      
      if (!visibilidadeValue || visibilidadeValue.trim() === '') {
        await visibilidadeSelect.click();
        await this.page.waitForTimeout(300);
        
        const publicOption = await this.page.locator('mat-option:has-text("Público")').first();
        if (await publicOption.count() > 0) {
          await publicOption.click();
          console.log('✅ [BATCH-OJ] Visibilidade configurada: Público');
        }
      }
    } catch (e) {
      // Campo pode já estar preenchido
    }

    // ⚠️ VERIFICAÇÃO FINAL OBRIGATÓRIA - GARANTIR QUE O PAPEL FOI PREENCHIDO
    console.log('🔍 [BATCH-OJ] Verificação final obrigatória do campo Papel...');
    let papelPreenchido = false;

    try {
      // Aguardar um pouco para garantir que qualquer preenchimento foi processado
      await this.page.waitForTimeout(300); // REDUZIDO

      // 🚀 USAR CACHE para verificação final também
      const papelFieldResult = await this.findElementWithCache('papel');

      if (papelFieldResult) {
        const papelValue = await papelFieldResult.element.locator('.mat-select-value-text').textContent();
        const papelValueTrimmed = papelValue ? papelValue.trim() : '';

        if (papelValueTrimmed && papelValueTrimmed !== '' && papelValueTrimmed !== 'Papel*' && papelValueTrimmed !== 'Selecione') {
          papelPreenchido = true;
          console.log(`✅ [BATCH-OJ] VERIFICAÇÃO FINAL: Campo Papel preenchido com: "${papelValueTrimmed}"`);
        } else {
          console.log(`❌ [BATCH-OJ] VERIFICAÇÃO FINAL: Campo Papel VAZIO ou com placeholder: "${papelValueTrimmed}"`);
        }
      } else {
        console.log('❌ [BATCH-OJ] VERIFICAÇÃO FINAL: Campo Papel não encontrado via cache');
      }
    } catch (e) {
      console.log(`❌ [BATCH-OJ] VERIFICAÇÃO FINAL: Erro ao verificar campo Papel: ${e.message}`);
    }

    // Se o papel não foi preenchido, apenas avisar mas não bloquear processamento
    if (!papelPreenchido) {
      console.log('⚠️ [BATCH-OJ] AVISO: Campo Papel pode não estar preenchido, mas continuando processamento...');
      // Não lançar erro para não bloquear o processamento - deixar o PJE validar
    } else {
      console.log('✅ [BATCH-OJ] Verificação final concluída: Campo Papel está preenchido, prosseguindo...');
    }
  }

  /**
   * Configura data inicial se necessário
   */
  async configureDataInicial() {
    this.logProgress('📅 Configurando data inicial...');
    
    const selectors = [
      'input[placeholder*="Data inicial"]',
      'input[name*="inicial"]', 
      'input[id*="inicial"]',
      'input[placeholder*="inicial"]',
      'input[name*="dataInicial"]'
    ];
    
    // Detecção prévia - verifica se já está preenchido
    for (const selector of selectors.slice(0, 3)) {
      if (await this.isFieldAlreadyFilled(selector)) {
        this.logSuccess('✅ Data inicial já preenchida');
        return;
      }
    }
    
    try {
      const dataInput = await this.page.locator(selectors.join(', ')).first();
      const currentValue = await dataInput.inputValue();
      
      if (!currentValue) {
        const hoje = new Date().toLocaleDateString('pt-BR');
        await dataInput.fill(hoje);
        this.logSuccess(`✅ Data inicial configurada: ${hoje}`);
      } else {
        this.logSuccess(`✅ Data inicial já preenchida: ${currentValue}`);
      }
    } catch (e) {
      this.logInfo('ℹ️ Campo de data inicial não encontrado ou já preenchido');
    }
    this.logProgress('✅ Configuração de data inicial concluída');
  }

  /**
   * Salva a configuração (ULTRA-OTIMIZADO PARA VELOCIDADE)
   */
  async saveConfiguration() {
    console.log('💾 [BATCH-OJ] Salvando configuração...');

    // ESTRATÉGIA OTIMIZADA - PRIORIZA O QUE MAIS FUNCIONA
    let botaoEncontrado = false;
    let tentativas = 0;
    const maxTentativas = 3; // Reduzido de 5 para 3

    while (!botaoEncontrado && tentativas < maxTentativas) {
      tentativas++;
      console.log(`🔄 [BATCH-OJ] Tentativa ${tentativas}/${maxTentativas} de encontrar botão Gravar...`);

      try {
        // ESTRATÉGIA 1: Cache inteligente primeiro
        console.log('🔍 [BATCH-OJ] Estratégia 1: Tentando cache inteligente...');
        const cachedResult = await this.findElementWithCache('gravar');
        
        if (cachedResult) {
          const isEnabled = await cachedResult.element.isEnabled();
          if (isEnabled) {
            await this.retryWithBackoff(async () => {
              await cachedResult.element.click({ force: true });
            }, 2, 100, 'clique no botão Gravar via cache');
            botaoEncontrado = true;
            console.log('✅ [BATCH-OJ] Botão Gravar clicado via cache (Estratégia 1)');
            break;
          }
        }
        
        // Fallback: Busca direta no modal
        console.log('🔍 [BATCH-OJ] Cache falhou, tentando busca direta...');
        const modalContainer = this.page.locator('mat-dialog-container').first();
        const botaoGravar = modalContainer.locator('button:has-text("Gravar"), button:has-text("Vincular"), button:has-text("Salvar")').first();

        const isVisible = await botaoGravar.isVisible({ timeout: 1000 }); // Aumentado para dar tempo ao PJe
        if (isVisible) {
          const isEnabled = await botaoGravar.isEnabled();
          if (isEnabled) {
            await this.retryWithBackoff(async () => {
              await botaoGravar.click({ force: true });
            }, 2, 100, 'clique no botão Gravar via busca direta');
            botaoEncontrado = true;
            // Atualizar cache com seletor que funcionou
            this.updateSelectorCache('gravar', 'mat-dialog-container button:has-text("Gravar"), mat-dialog-container button:has-text("Vincular"), mat-dialog-container button:has-text("Salvar")');
            console.log('✅ [BATCH-OJ] Botão Gravar clicado com sucesso (Estratégia 1)');
            break;
          } else {
            console.log('⚠️ [BATCH-OJ] Botão encontrado mas desabilitado, aguardando...');
            await this.page.waitForTimeout(200); // REDUZIDO // Aumentado para dar tempo ao PJe habilitar o botão
            continue;
          }
        }
      } catch (e) {
        console.log(`⚠️ [BATCH-OJ] Estratégia 1 falhou: ${e.message}`);
      }

      try {
        // ESTRATÉGIA 2: Busca otimizada por filtro
        console.log('🔍 [BATCH-OJ] Estratégia 2: Busca otimizada por filtro...');
        const modalContainer = this.page.locator('mat-dialog-container').first();
        const botaoGravar = modalContainer.locator('button').filter({ hasText: /Gravar|Vincular|Salvar/i }).first();
        
        const isVisible = await botaoGravar.isVisible({ timeout: 1000 });
        if (isVisible) {
          const isEnabled = await botaoGravar.isEnabled();
          if (isEnabled) {
            await botaoGravar.click({ force: true });
            botaoEncontrado = true;
            console.log('✅ [BATCH-OJ] Botão Gravar clicado com sucesso (Estratégia 2)');
            break;
          }
        }
      } catch (fallbackError) {
        console.log(`⚠️ [BATCH-OJ] Estratégia 2 falhou: ${fallbackError.message}`);
      }

      // ESTRATÉGIA 3: Busca global rápida (apenas na última tentativa)
      if (!botaoEncontrado && tentativas === maxTentativas) {
        try {
          console.log('🔍 [BATCH-OJ] Estratégia 3: Busca global final...');
          const botaoGlobal = this.page.locator('button').filter({ hasText: /Gravar|Vincular|Salvar/i }).first();
          
          const isVisible = await botaoGlobal.isVisible({ timeout: 1000 });
          if (isVisible) {
            const isEnabled = await botaoGlobal.isEnabled();
            if (isEnabled) {
              await botaoGlobal.click({ force: true });
              botaoEncontrado = true;
              console.log('✅ [BATCH-OJ] Botão Gravar clicado com sucesso (Estratégia 3)');
            }
          }
        } catch (globalError) {
          console.log(`⚠️ [BATCH-OJ] Estratégia 3 falhou: ${globalError.message}`);
        }
      }

      // Se não encontrou, aguardar antes da próxima tentativa
      if (!botaoEncontrado && tentativas < maxTentativas) {
        console.log(`⏳ [BATCH-OJ] Aguardando 800ms antes da próxima tentativa...`);
        await this.page.waitForTimeout(200); // REDUZIDO para acelerar
      }
    }
    
    if (!botaoEncontrado) {
      console.log('⚠️ [BATCH-OJ] Botão Gravar/Salvar/Vincular não encontrado - pode ser erro PJE-281');

      // Log de debug: mostrar todos os elementos visíveis
      try {
        const allVisibleButtons = await this.page.locator('button:visible').all();
        console.log(`🔍 [BATCH-OJ] DEBUG: ${allVisibleButtons.length} botões visíveis na página:`);
        for (let i = 0; i < Math.min(allVisibleButtons.length, 10); i++) {
          const text = await allVisibleButtons[i].textContent({ timeout: 100 }).catch(() => 'N/A');
          console.log(`   ${i+1}. "${text?.trim()}"`);
        }
      } catch (debugError) {
        console.log(`⚠️ [BATCH-OJ] Erro no debug: ${debugError.message}`);
      }

      // Em vez de lançar exceção, retornar status para permitir verificação de PJE-281
      console.log('🔍 [BATCH-OJ] Continuando para verificar se há erro PJE-281...');

      // Aguardar mais tempo quando botão não foi encontrado (pode ser erro PJE-281)
      console.log('⏳ [BATCH-OJ] Aguardando possível erro PJE-281 (tempo estendido)...');
      await this.page.waitForTimeout(500);
      return { success: false, reason: 'button_not_found' };
    }

    // ⏱️ TEMPO CRÍTICO: Aguardar PJe processar a requisição no backend
    // Após clicar em Gravar, o PJe precisa de tempo para:
    // 1. Enviar dados ao servidor
    // 2. Validar no backend
    // 3. Persistir no banco de dados
    // 4. Retornar resposta (sucesso ou erro PJE-281)
    // 5. Atualizar interface com resultado
    console.log('⏱️ [BATCH-OJ] Aguardando PJe processar salvamento no backend...');
    await this.page.waitForTimeout(2500); // 2500ms: tempo estendido para PJe processar completamente

    // Verificação de PJE-281 após tempo de processamento
    console.log('🔍 [BATCH-OJ] Verificando resultado do salvamento...');

    // Verificação rápida inicial (300ms) com múltiplos seletores
    const errorSelectors = [
      '.mat-snack-bar-container:has-text("PJE-281")',
      '.mat-simple-snackbar:has-text("PJE-281")',
      '.mat-error:has-text("PJE-281")',
      'text=/PJE-281/i',
      '.mat-snack-bar-container:has-text("já cadastrado")'
    ];

    for (const selector of errorSelectors) {
      try {
        const quickCheck = await this.page.locator(selector).isVisible({ timeout: 100 });
        if (quickCheck) {
          console.log(`⚡ [BATCH-OJ] PJE-281 detectado imediatamente com seletor: ${selector}`);
          return { success: false, pje281Error: true, reason: 'immediate_pje281_detection' };
        }
      } catch (e) {
        // Continuar com próximo seletor
      }
    }

    // ⏱️ TEMPO ADICIONAL: Aguardar interface estabilizar após processamento
    await this.page.waitForTimeout(300); // 300ms: tempo para interface atualizar resultado
    
    // Verificação instantânea do modal
    const modalStillOpen = await this.page.locator('mat-dialog-container').isVisible({ timeout: 200 });
    if (!modalStillOpen) {
      this.modalOpen = false;
    }

    // Verificar se há erro PJE-281 ou OJ já cadastrado
    let hasError281 = false;

    // Verificar com múltiplos seletores e métodos
    for (const selector of errorSelectors) {
      try {
        hasError281 = await this.page.locator(selector).isVisible({ timeout: 500 });
        if (hasError281) {
          console.log(`⚠️ [BATCH-OJ] Erro PJE-281 detectado com: ${selector}`);
          break;
        }
      } catch (e) {
        // Continuar verificando
      }
    }

    if (hasError281) {
      console.log('⚠️ [BATCH-OJ] OJ já cadastrado (PJE-281) - iniciando limpeza completa de erro!');

      // Usar sistema de recuperação avançado se disponível
      if (this.errorRecovery) {
        await this.errorRecovery.clearErrorState();
        // Aguardar tempo dinâmico baseado no histórico
        const errorWait = this.errorRecovery.getWaitTime(2000);
        console.log(`⏳ [BATCH-OJ] Aguardando ${errorWait}ms para garantir limpeza completa...`);
        await this.page.waitForTimeout(errorWait);
      } else {
        // Fallback para método tradicional
        try {
          await this.page.keyboard.press('Escape');
          await this.page.waitForTimeout(200);
          await this.page.keyboard.press('Escape');

          // Tentar clicar em botão de fechar se existir
          const closeBtn = await this.page.locator('.mat-snack-bar-action button, button:has-text("OK"), button:has-text("Fechar")').first();
          if (await closeBtn.isVisible({ timeout: 100 })) {
            await closeBtn.click();
          }
        } catch (e) {
          // Ignorar erro ao tentar fechar
        }

        // Aguardar tempo fixo quando não tem errorRecovery
        console.log('⏳ [BATCH-OJ] Aguardando 2.5s para limpar estado de erro...');
        await this.page.waitForTimeout(300); // ULTRA REDUZIDO
      }

      return { success: false, pje281Error: true, reason: 'oj_already_exists' };
    }

    // Se NÃO há erro, aguardar tempo dinâmico
    console.log('✅ [BATCH-OJ] Salvamento realizado com sucesso');

    // Usar tempo dinâmico baseado no histórico
    const successWait = this.errorRecovery ? this.errorRecovery.getWaitTime(300) : 500;
    await this.page.waitForTimeout(successWait);

    // Verificação final para garantir que não apareceu erro tardio
    for (const selector of errorSelectors.slice(0, 2)) { // Verificar apenas 2 principais
      try {
        const lateError = await this.page.locator(selector).isVisible({ timeout: 100 });
        if (lateError) {
          console.log(`⚠️ [BATCH-OJ] Erro tardio detectado após salvamento: ${selector}`);
          if (this.errorRecovery) {
            this.errorRecovery.recordError('PJE-281-late');
          }
          return { success: false, pje281Error: true, reason: 'late_error_detection' };
        }
      } catch (e) {
        // Continuar
      }
    }

    return { success: true };
  }

  /**
   * Limpa os campos para processar o próximo OJ
   */
  async clearFieldsForNextOJ() {
    console.log('🧹 [BATCH-OJ] Limpando campos para próximo OJ...');
    
    try {
      // Verificação otimizada de modal
      const modalExists = await this.isModalOpen();
      if (!modalExists) {
        await this.openLocationModal();
      }
      
      // Limpeza de mensagens de erro (equilibrado)
      try {
        const closeButtons = await this.page.locator('.mat-snack-bar-action button, .mat-simple-snackbar-action button').all();
        if (closeButtons.length > 0) {
          for (const button of closeButtons) {
            try {
              if (await button.isVisible({ timeout: 100 })) {
                await button.click({ timeout: 200 });
              }
            } catch (e) {
              // Ignora erros individuais de botões
            }
          }
        }
      } catch (e) {
        // Ignora completamente se não houver mensagens de erro
      }
      
      // Garantir que o mat-select do OJ está limpo/pronto usando cache
      try {
        let matSelect = null;

        // Usar seletor em cache primeiro
        if (this.selectorCache.workingSelector) {
          try {
            const element = await this.page.locator(this.selectorCache.workingSelector).first();
            if (await element.isVisible({ timeout: 200 })) {
              matSelect = element;
            }
          } catch (e) {
            // Cache inválido, tentar outros seletores
          }
        }

        // Se cache falhou, tentar apenas 1 seletor principal
        if (!matSelect) {
          const selector = this.selectorCache.orgaoJulgadorSelectors[0];
          try {
            matSelect = await this.page.locator(selector).first();
            await matSelect.waitFor({ state: 'visible', timeout: 200 });
          } catch (e) {
            // Ignora se não encontrar
          }
        }

        if (matSelect) {
          // Verificar e limpar seleção se necessário
          try {
            const selectedValue = await matSelect.locator('.mat-select-value-text').textContent({ timeout: 100 });
            if (selectedValue && selectedValue.trim() !== '' && selectedValue.trim() !== 'Selecione') {
              // Clicar no mat-select para abrir/resetar
              await matSelect.click();
              await this.page.waitForTimeout(50);

              // Pressionar ESC para fechar sem selecionar
              await this.page.keyboard.press('Escape');
              await this.page.waitForTimeout(50);
            }
          } catch (e) {
            // Ignora erro ao verificar valor
          }
        }

      } catch (e) {
        // Ignora erros ao limpar campo OJ
      }

      // Verificação final do modal
      if (!(await this.isModalOpen())) {
        await this.openLocationModal();
      }

      // Estabilização equilibrada
      await this.page.waitForTimeout(100);
      
    } catch (error) {
      console.log('❌ [BATCH-OJ] Erro crítico ao limpar campos:', error.message);
      throw error; // Re-throw para que o erro seja tratado no nível superior
    }
  }

  /**
   * Tenta recuperar de um erro mantendo o modal aberto
   */
  async recoverFromError() {
    console.log('🔧 [BATCH-OJ] Tentando recuperar do erro...');
    
    try {
      // Fechar mensagens de erro
      const errorMessages = await this.page.locator('.mat-error, .mat-snack-bar-container').all();
      for (const error of errorMessages) {
        try {
          const closeBtn = await error.locator('button').first();
          if (await closeBtn.isVisible({ timeout: 500 })) {
            await closeBtn.click();
          }
        } catch (e) {
          // Continuar
        }
      }
      
      // OTIMIZAÇÃO: Aguardar estabilização reduzido
      await this.page.waitForTimeout(75); // ULTRA REDUZIDO
      
      // Verificar se modal ainda está aberto
      const modalVisible = await this.page.locator('mat-dialog-container').isVisible();
      if (!modalVisible) {
        console.log('⚠️ [BATCH-OJ] Modal foi fechou, reabrindo...');
        this.modalOpen = false;
        await this.openLocationModal();
        this.modalOpen = true;
      }
      
      console.log('✅ [BATCH-OJ] Recuperação concluída');
      
    } catch (error) {
      console.log('❌ [BATCH-OJ] Falha na recuperação:', error.message);
    }
  }

  /**
   * Fecha o modal
   */
  async closeModal() {
    try {
      // OTIMIZAÇÃO: Tentar fechar por ESC primeiro com delay reduzido
      await this.page.keyboard.press('Escape');
      await this.page.waitForTimeout(50); // ULTRA REDUZIDO
      
      // Se ainda estiver aberto, tentar botão Fechar/Cancelar
      const modalVisible = await this.page.locator('mat-dialog-container').isVisible();
      if (modalVisible) {
        const closeButtons = [
          'mat-dialog-container button:has-text("Fechar")',
          'mat-dialog-container button:has-text("Cancelar")',
          'mat-dialog-container button[aria-label="Close"]',
          'mat-dialog-container .close-button'
        ];
        
        for (const selector of closeButtons) {
          try {
            const button = await this.page.locator(selector).first();
            if (await button.isVisible({ timeout: 500 })) {
              await button.click();
              break;
            }
          } catch (e) {
            // Continuar tentando
          }
        }
      }
      
      console.log('✅ [BATCH-OJ] Modal fechado');
      
    } catch (error) {
      console.log('⚠️ [BATCH-OJ] Erro ao fechar modal:', error.message);
    }
  }

  /**
   * Gera mensagem de erro detalhada para melhor diagnóstico
   */
  getDetailedErrorMessage(error, oj = null, type = 'PROCESSAMENTO') {
    const timestamp = new Date().toISOString();
    const ojInfo = oj ? `OJ: ${oj.nome || oj || 'N/A'}` : 'OJ: N/A';

    // Extrair mensagem de erro de forma segura
    let errorMessage = 'Erro desconhecido';
    if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error.message === 'string') {
      errorMessage = error.message;
    } else if (error && typeof error.toString === 'function') {
      errorMessage = error.toString();
    }

    // Para uso interno, retornar objeto detalhado
    if (type === 'OBJETO') {
      return {
        timestamp,
        type: 'PROCESSAMENTO',
        oj: ojInfo,
        error: errorMessage,
        stack: error?.stack || 'Stack não disponível',
        url: this.page ? this.page.url() : 'URL não disponível'
      };
    }

    // Para mensagens de erro, retornar string formatada
    return `[${type}] ${ojInfo} - ${errorMessage}`;
  }

  /**
   * Verificação rápida se o modal está aberto (sem timeouts)
   */
  async isModalOpen() {
    try {
      const modalCount = await this.page.locator(this.selectorCache.modalContainer).count();
      return modalCount > 0;
    } catch (e) {
      return false;
    }
  }

  /**
   * Verificação rápida de elemento sem timeout
   */
  async isElementVisible(selector) {
    try {
      const element = await this.page.locator(selector).first();
      return await element.isVisible({ timeout: 100 });
    } catch (e) {
      return false;
    }
  }

  /**
   * Sistema de retry inteligente com backoff exponencial
   */
  async retryWithBackoff(operation, maxRetries = 3, baseDelay = 100, operationName = 'operação') {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        if (attempt > 1) {
          this.logSuccess(`✅ ${operationName} bem-sucedida na tentativa ${attempt}`);
        }
        return result;
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          this.logError(`❌ ${operationName} falhou após ${maxRetries} tentativas: ${error.message}`);
          throw error;
        }
        
        // Backoff exponencial: 100ms, 200ms, 400ms, etc.
        const delay = baseDelay * Math.pow(2, attempt - 1);
        this.logInfo(`⚠️ ${operationName} falhou (tentativa ${attempt}/${maxRetries}), tentando novamente em ${delay}ms...`);
        
        await this.page.waitForTimeout(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Verifica rapidamente se o salvamento foi bem-sucedido
   */
  async verifySaveSuccess() {
    console.log('🔍 [BATCH-OJ] Verificando sucesso do salvamento...');
    
    try {
      // Verificação rápida de indicadores de sucesso
      const successIndicators = await this.waitForCondition(async () => {
        // 1. Modal fechou (indicador de sucesso)
        const modalClosed = !(await this.page.locator('.mat-dialog-container').isVisible().catch(() => false));
        
        // 2. Mensagem de sucesso apareceu
        const successMessage = await this.page.locator('.mat-snack-bar-container:has-text("sucesso"), .mat-snack-bar-container:has-text("salvo"), .mat-snack-bar-container:has-text("gravado")').isVisible().catch(() => false);
        
        // 3. Não há mensagens de erro visíveis
        const hasError = await this.page.locator('.mat-error:visible, .mat-snack-bar-container:has-text("erro")').count() > 0;
        
        return modalClosed || successMessage || !hasError;
      }, 800, 40); // Verificação rápida em 800ms
      
      if (successIndicators) {
        console.log('✅ [BATCH-OJ] Salvamento verificado com sucesso');
        return { success: true };
      } else {
        console.log('⚠️ [BATCH-OJ] Não foi possível verificar sucesso do salvamento');
        return { success: false, timeout: true };
      }
      
    } catch (error) {
      console.log(`⚠️ [BATCH-OJ] Erro na verificação de salvamento: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

module.exports = BatchOJProcessor;