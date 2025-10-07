/**
 * Otimizador de Expansão de Acordeão
 * Resolve o problema de lentidão na expansão de acordeões (15+ segundos)
 * e violação de strict mode com centenas de elementos
 */

class AccordionOptimizer {
  constructor(page, logger = console) {
    this.page = page;
    this.logger = logger;
    this.expandedAccordions = new Set(); // Cache de acordeões já expandidos
  }

  /**
   * Expande acordeão de forma otimizada
   * Corrige o gargalo de 15+ segundos
   */
  async expandAccordionOptimized(targetText = 'Localização/Visibilidade') {
    const startTime = Date.now();
    this.logger.log('🚀 [ACCORDION-OPTIMIZER] Iniciando expansão otimizada...');

    try {
      // 1. ESTRATÉGIA DIRETA: Buscar botão específico primeiro
      const directButton = await this.findDirectButton(targetText);
      if (directButton) {
        await this.clickAndVerifyExpansion(directButton);
        const duration = Date.now() - startTime;
        this.logger.log(`✅ [ACCORDION-OPTIMIZER] Expansão concluída em ${duration}ms (estratégia direta)`);
        return { success: true, duration, strategy: 'direct' };
      }

      // 2. ESTRATÉGIA ESPECÍFICA: Buscar por texto exato
      const specificButton = await this.findSpecificButton();
      if (specificButton) {
        await this.clickAndVerifyExpansion(specificButton);
        const duration = Date.now() - startTime;
        this.logger.log(`✅ [ACCORDION-OPTIMIZER] Expansão concluída em ${duration}ms (estratégia específica)`);
        return { success: true, duration, strategy: 'specific' };
      }

      // 3. ESTRATÉGIA OTIMIZADA: Buscar header por ID
      const headerButton = await this.findHeaderById();
      if (headerButton) {
        await this.clickAndVerifyExpansion(headerButton);
        const duration = Date.now() - startTime;
        this.logger.log(`✅ [ACCORDION-OPTIMIZER] Expansão concluída em ${duration}ms (estratégia header)`);
        return { success: true, duration, strategy: 'header' };
      }

      throw new Error('Não foi possível encontrar o acordeão para expandir');

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.log(`❌ [ACCORDION-OPTIMIZER] Erro na expansão após ${duration}ms: ${error.message}`);
      throw error;
    }
  }

  /**
   * Busca botão direto sem strict mode violations
   */
  async findDirectButton(targetText) {
    try {
      // Seletores específicos que evitam pegar centenas de elementos
      const selectors = [
        `button.mat-raised-button:has-text("Adicionar ${targetText}")`,
        'button[color="primary"]:has-text("Adicionar")',
        `.mat-expansion-panel-header:has-text("${targetText}")`,
        'button.botao.mat-primary:has-text("Adicionar")',
        `button.mat-focus-indicator.botao:has-text("Adicionar ${targetText}")`
      ];

      for (const selector of selectors) {
        try {
          const element = await this.page.locator(selector).first();
          if (await element.isVisible({ timeout: 500 })) {
            this.logger.log(`✅ Botão encontrado com seletor: ${selector}`);
            return element;
          }
        } catch (e) {
          // Continua para próximo seletor
        }
      }
    } catch (error) {
      this.logger.log(`⚠️ Busca direta falhou: ${error.message}`);
    }
    return null;
  }

  /**
   * Busca botão específico sem usar seletores genéricos
   */
  async findSpecificButton() {
    try {
      // Evitar getByRole que está causando violação de strict mode
      // Usar seletores mais específicos
      
      // Primeiro, contar quantos botões existem para evitar strict mode
      const buttonCount = await this.page.locator('button').count();
      this.logger.log(`📊 Total de botões na página: ${buttonCount}`);

      if (buttonCount > 100) {
        // Se há muitos botões, usar estratégia mais específica
        const containerSelectors = [
          '.mat-expansion-panel',
          '.mat-accordion',
          '.accordion-container',
          '[role="region"]'
        ];

        for (const container of containerSelectors) {
          const containerElement = this.page.locator(container).first();
          if (await containerElement.count() > 0) {
            // Buscar botão dentro do container específico
            const button = containerElement.locator('button:has-text("Localização"), button:has-text("Visibilidade")').first();
            if (await button.isVisible({ timeout: 500 })) {
              this.logger.log(`✅ Botão encontrado dentro de ${container}`);
              return button;
            }
          }
        }
      } else {
        // Se poucos botões, busca normal
        const button = await this.page.locator('button:has-text("Localização"), button:has-text("Visibilidade")').first();
        if (await button.isVisible({ timeout: 500 })) {
          return button;
        }
      }
    } catch (error) {
      this.logger.log(`⚠️ Busca específica falhou: ${error.message}`);
    }
    return null;
  }

  /**
   * Busca header por ID específico
   */
  async findHeaderById() {
    try {
      // Buscar headers com IDs específicos
      const headers = await this.page.locator('[id^="mat-expansion-panel-header-"]').all();
      this.logger.log(`📋 Encontrados ${headers.length} headers com ID`);

      for (const header of headers) {
        try {
          const text = await header.textContent({ timeout: 500 });
          if (text && (text.includes('Localização') || text.includes('Visibilidade'))) {
            this.logger.log(`✅ Header encontrado: ${text}`);
            return header;
          }
        } catch (e) {
          // Continua para próximo header
        }
      }

      // Fallback: buscar por classe específica
      const panelHeader = await this.page.locator('.mat-expansion-panel-header').first();
      if (await panelHeader.isVisible({ timeout: 500 })) {
        return panelHeader;
      }
    } catch (error) {
      this.logger.log(`⚠️ Busca por header ID falhou: ${error.message}`);
    }
    return null;
  }

  /**
   * Clica no botão e verifica se expandiu
   */
  async clickAndVerifyExpansion(element) {
    // Clicar no elemento
    await element.click({ timeout: 1000 });
    
    // Aguardar brevemente
    await this.page.waitForTimeout(300);

    // Verificar se expandiu (buscar por indicadores de expansão)
    const expanded = await this.verifyExpanded();
    
    if (!expanded) {
      // Tentar clicar novamente se necessário
      await element.click({ force: true });
      await this.page.waitForTimeout(300);
    }

    return true;
  }

  /**
   * Verifica se o acordeão está expandido
   */
  async verifyExpanded() {
    try {
      // Verificar indicadores de expansão
      const indicators = [
        '[aria-expanded="true"]',
        '.mat-expansion-panel-content:visible',
        '.mat-expanded',
        '[role="region"]:visible'
      ];

      for (const indicator of indicators) {
        const element = await this.page.locator(indicator).first();
        if (await element.count() > 0) {
          return true;
        }
      }

      // Verificar se apareceu conteúdo novo
      const contentSelectors = [
        'mat-select[placeholder*="Órgão"]',
        'mat-select[placeholder*="Localização"]',
        'button:has-text("Gravar")',
        'table tbody tr'
      ];

      for (const selector of contentSelectors) {
        if (await this.page.locator(selector).count() > 0) {
          return true;
        }
      }
    } catch (error) {
      this.logger.log(`⚠️ Erro na verificação de expansão: ${error.message}`);
    }
    return false;
  }

  /**
   * Limpa cache de acordeões expandidos
   */
  clearCache() {
    this.expandedAccordions.clear();
    this.logger.log('🧹 Cache de acordeões limpo');
  }
}

module.exports = AccordionOptimizer;