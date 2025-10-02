/**
 * Processador Ultra Rápido para OJs - Focado em máxima velocidade
 * Elimina gargalos e otimiza operações críticas para vinculação de servidores
 */

class UltraFastOJProcessor {
  constructor(page, config) {
    this.page = page;
    this.config = config;

    // Cache ultra otimizado para seletores que funcionaram
    this.workingSelectors = {
      ojDropdown: null,
      modalContainer: 'mat-dialog-container',
      gravarButton: null,
      lastUpdateTime: 0
    };

    // Estatísticas de performance
    this.stats = {
      totalOJs: 0,
      processedOJs: 0,
      averageTimePerOJ: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    // Configurações ultra otimizadas
    this.ultraSettings = {
      maxWaitMs: 800,        // Timeout máximo para qualquer operação
      checkIntervalMs: 25,   // Intervalo ultra rápido de verificação
      betweenOJsDelayMs: 30, // Delay mínimo entre OJs
      modalStabilizeMs: 50,  // Tempo para modal estabilizar
      clickDelayMs: 20       // Delay após cliques
    };
  }

  /**
   * Processa lista de OJs com máxima velocidade
   */
  async processOJsUltraFast(ojsList) {
    console.log(`🚀 [ULTRA-FAST] Iniciando processamento ultra rápido de ${ojsList.length} OJs`);

    this.stats.totalOJs = ojsList.length;
    const startTime = Date.now();

    try {
      // Garantir que modal está aberto
      await this.ensureModalOpen();

      // Processar cada OJ com otimizações máximas
      for (let i = 0; i < ojsList.length; i++) {
        const ojStartTime = Date.now();
        const orgao = ojsList[i];

        console.log(`⚡ [ULTRA-FAST] OJ ${i + 1}/${ojsList.length}: ${this.extractOJText(orgao)}`);

        try {
          await this.processOJUltraFast(orgao);
          this.stats.processedOJs++;

          // Delay mínimo entre OJs
          if (i < ojsList.length - 1) {
            await this.page.waitForTimeout(this.ultraSettings.betweenOJsDelayMs);
          }

        } catch (error) {
          console.error(`❌ [ULTRA-FAST] Erro processando OJ ${orgao}:`, error.message);
        }

        // Atualizar estatísticas
        const ojTime = Date.now() - ojStartTime;
        this.stats.averageTimePerOJ = ((this.stats.averageTimePerOJ * (i)) + ojTime) / (i + 1);
      }

      const totalTime = Date.now() - startTime;
      console.log(`✅ [ULTRA-FAST] Processamento concluído em ${totalTime}ms`);
      console.log(`📊 [ULTRA-FAST] Média: ${this.stats.averageTimePerOJ.toFixed(0)}ms/OJ`);
      console.log(`📊 [ULTRA-FAST] Cache: ${this.stats.cacheHits} hits, ${this.stats.cacheMisses} misses`);

      return {
        success: true,
        totalTime,
        averageTimePerOJ: this.stats.averageTimePerOJ,
        processedOJs: this.stats.processedOJs,
        totalOJs: this.stats.totalOJs,
        cacheEfficiency: this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)
      };

    } catch (error) {
      console.error('❌ [ULTRA-FAST] Erro crítico no processamento:', error);
      throw error;
    }
  }

  /**
   * Processa um único OJ com máxima velocidade
   */
  async processOJUltraFast(orgao) {
    const orgaoTexto = this.extractOJText(orgao);

    // Passo 1: Localizar campo OJ usando cache inteligente
    const ojField = await this.getOJFieldUltraFast();

    // Passo 2: Abrir dropdown e aguardar opções (otimizado)
    await ojField.click();
    await this.page.waitForTimeout(this.ultraSettings.clickDelayMs);

    // Aguardar opções com timeout mínimo
    await this.waitForConditionUltraFast(
      async () => (await this.page.locator('mat-option').count()) > 0,
      this.ultraSettings.maxWaitMs
    );

    // Passo 3: Localizar e selecionar OJ (otimizado)
    const selected = await this.selectOJOptionUltraFast(orgaoTexto);

    if (!selected) {
      throw new Error(`OJ não encontrado: ${orgaoTexto}`);
    }

    // Passo 4: Configurar papel se necessário (ultra rápido)
    await this.configurePapelUltraFast();

    // Passo 5: Salvar configuração (cache de botão)
    await this.saveConfigurationUltraFast();

    console.log(`✅ [ULTRA-FAST] OJ processado: ${orgaoTexto}`);
  }

  /**
   * Localiza campo OJ usando cache inteligente
   */
  async getOJFieldUltraFast() {
    // Tentar cache primeiro
    if (this.workingSelectors.ojDropdown) {
      try {
        const element = this.page.locator(this.workingSelectors.ojDropdown).first();
        if (await element.isVisible({ timeout: 100 })) {
          this.stats.cacheHits++;
          return element;
        }
      } catch (e) {
        // Cache miss - limpar seletor
        this.workingSelectors.ojDropdown = null;
      }
    }

    this.stats.cacheMisses++;

    // Seletores otimizados priorizados por frequência
    const selectors = [
      'mat-dialog-container mat-select[placeholder*="Órgão"]',
      'mat-dialog-container mat-select[formcontrolname="orgaoJulgador"]',
      '[role="dialog"] mat-select[placeholder*="Órgão"]',
      'mat-dialog-container .mat-select-trigger',
      'mat-select:has(.mat-select-placeholder:contains("Órgão"))'
    ];

    for (const selector of selectors) {
      try {
        const element = this.page.locator(selector).first();
        if (await element.isVisible({ timeout: 150 })) {
          // Cachear seletor que funcionou
          this.workingSelectors.ojDropdown = selector;
          this.workingSelectors.lastUpdateTime = Date.now();
          return element;
        }
      } catch (e) {
        continue;
      }
    }

    throw new Error('Campo OJ não encontrado');
  }

  /**
   * Seleciona opção do OJ com otimização máxima
   */
  async selectOJOptionUltraFast(orgaoTexto) {
    const opcoes = await this.page.locator('mat-option').all();

    // Primeira passada: busca exata (mais rápida)
    for (const opcao of opcoes) {
      try {
        const texto = await opcao.textContent({ timeout: 50 });
        if (texto && this.isExactMatch(orgaoTexto, texto)) {
          await opcao.click();
          await this.page.waitForTimeout(this.ultraSettings.clickDelayMs);
          return true;
        }
      } catch (e) {
        continue;
      }
    }

    // Segunda passada: busca por similaridade (se exata falhou)
    for (const opcao of opcoes) {
      try {
        const texto = await opcao.textContent({ timeout: 50 });
        if (texto && this.isSimilarMatch(orgaoTexto, texto)) {
          await opcao.click();
          await this.page.waitForTimeout(this.ultraSettings.clickDelayMs);
          return true;
        }
      } catch (e) {
        continue;
      }
    }

    return false;
  }

  /**
   * Configura papel se necessário (ultra otimizado)
   */
  async configurePapelUltraFast() {
    const papelDesejado = this.config.perfil || this.config.papel;
    if (!papelDesejado) return;

    try {
      // Buscar campo papel com timeout mínimo
      const papelField = await this.page.locator(
        'mat-dialog-container mat-select[placeholder*="Papel"], ' +
        'mat-dialog-container mat-select[formcontrolname="papel"]'
      ).first();

      if (await papelField.isVisible({ timeout: 200 })) {
        // Verificar se já está configurado
        const currentValue = await papelField.locator('.mat-select-value-text').textContent({ timeout: 100 }).catch(() => '');

        if (!currentValue || currentValue.trim() === '' || currentValue.includes('Selecione')) {
          await papelField.click();
          await this.page.waitForTimeout(this.ultraSettings.clickDelayMs);

          const papelOption = this.page.locator(`mat-option:has-text("${papelDesejado}")`).first();
          if (await papelOption.isVisible({ timeout: 300 })) {
            await papelOption.click();
            await this.page.waitForTimeout(this.ultraSettings.clickDelayMs);
          }
        }
      }
    } catch (e) {
      // Ignorar erro de papel - não crítico
      console.log(`⚠️ [ULTRA-FAST] Papel não configurado: ${e.message}`);
    }
  }

  /**
   * Salva configuração usando cache de botão
   */
  async saveConfigurationUltraFast() {
    // Tentar cache do botão primeiro
    if (this.workingSelectors.gravarButton) {
      try {
        const button = this.page.locator(this.workingSelectors.gravarButton).first();
        if (await button.isVisible({ timeout: 100 })) {
          await button.click();
          await this.page.waitForTimeout(this.ultraSettings.modalStabilizeMs);
          return;
        }
      } catch (e) {
        this.workingSelectors.gravarButton = null;
      }
    }

    // Buscar botão com seletores otimizados
    const buttonSelectors = [
      'mat-dialog-container button:has-text("Gravar")',
      'mat-dialog-container button:has-text("Salvar")',
      '[role="dialog"] button:has-text("Gravar")',
      'button:has-text("Gravar")'
    ];

    for (const selector of buttonSelectors) {
      try {
        const button = this.page.locator(selector).first();
        if (await button.isVisible({ timeout: 150 })) {
          this.workingSelectors.gravarButton = selector;
          await button.click();
          await this.page.waitForTimeout(this.ultraSettings.modalStabilizeMs);
          return;
        }
      } catch (e) {
        continue;
      }
    }

    throw new Error('Botão Gravar não encontrado');
  }

  /**
   * Garante que modal está aberto
   */
  async ensureModalOpen() {
    const modalExists = await this.page.locator(this.workingSelectors.modalContainer).isVisible().catch(() => false);

    if (!modalExists) {
      // Tentar abrir modal clicando em botão de adicionar (seletores otimizados)
      const addButtons = [
        // Seletores específicos que funcionam (do servidor-automation-v2.js)
        'button.mat-raised-button.mat-button-base.mat-primary .mat-button-wrapper:has-text("Adicionar Localização/Visibilidade")',
        'button.mat-raised-button.mat-primary:has(.mat-button-wrapper:has-text("Adicionar Localização/Visibilidade"))',
        'button.mat-raised-button:has-text("Adicionar Localização/Visibilidade")',
        'button.mat-primary:has-text("Adicionar Localização/Visibilidade")',
        'button:has-text("Adicionar Localização/Visibilidade"):not([disabled])',
        'button:has-text("Adicionar Localização"):not([disabled])',
        // Fallbacks genéricos
        'button:has-text("Adicionar")',
        'button:has-text("Nova")',
        'button[title*="Adicionar"]',
        '.mat-fab, .mat-mini-fab'
      ];

      for (const selector of addButtons) {
        try {
          const button = this.page.locator(selector).first();
          if (await button.isVisible({ timeout: 100 })) {
            await button.click();
            await this.page.waitForTimeout(50); // REDUZIDO de modalStabilizeMs

            // Verificar se modal abriu
            if (await this.page.locator(this.workingSelectors.modalContainer).isVisible({ timeout: 300 })) {
              return;
            }
          }
        } catch (e) {
          continue;
        }
      }

      throw new Error('Não foi possível abrir modal');
    }
  }

  /**
   * Condição ultra rápida com timeout otimizado
   */
  async waitForConditionUltraFast(conditionFn, maxWaitMs = 800) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      try {
        if (await conditionFn()) return true;
      } catch (e) {
        // Continuar tentando
      }

      await this.page.waitForTimeout(this.ultraSettings.checkIntervalMs);
    }

    return false;
  }

  /**
   * Extrai texto do OJ de forma segura
   */
  extractOJText(orgao) {
    if (!orgao) return 'N/A';
    if (typeof orgao === 'string') return orgao;
    if (typeof orgao === 'object') {
      return orgao.nome || orgao.descricao || orgao.text || String(orgao);
    }
    return String(orgao);
  }

  /**
   * Verifica match exato entre textos
   */
  isExactMatch(text1, text2) {
    const normalize = (text) => text.trim().toLowerCase().replace(/\s+/g, ' ');
    return normalize(text1) === normalize(text2);
  }

  /**
   * Verifica match por similaridade
   */
  isSimilarMatch(text1, text2) {
    const normalize = (text) => text.trim().toLowerCase().replace(/\s+/g, ' ');
    const normalized1 = normalize(text1);
    const normalized2 = normalize(text2);

    // Verificar se um contém o outro
    return normalized1.includes(normalized2) || normalized2.includes(normalized1);
  }

  /**
   * Limpa cache se muito antigo
   */
  clearCacheIfOld() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutos

    if (now - this.workingSelectors.lastUpdateTime > maxAge) {
      this.workingSelectors.ojDropdown = null;
      this.workingSelectors.gravarButton = null;
      this.workingSelectors.lastUpdateTime = now;
      console.log('🔄 [ULTRA-FAST] Cache limpo por idade');
    }
  }

  /**
   * Obtém estatísticas de performance
   */
  getStats() {
    return { ...this.stats };
  }
}

module.exports = UltraFastOJProcessor;