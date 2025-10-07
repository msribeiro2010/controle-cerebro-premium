/**
 * Tratamento Inteligente de Erros do PJE
 * Especializado em resolver conflitos de período e outros erros comuns
 */

class PJEErrorHandler {
  constructor(page, logger = console) {
    this.page = page;
    this.logger = logger;
    
    // Mapeamento de erros conhecidos e suas soluções
    this.errorPatterns = {
      'PJE-281': {
        pattern: /Existe período ativo conflitante|PJE-281/i,
        description: 'Período ativo conflitante',
        severity: 'warning',
        autoRecover: true,
        solution: 'skipAndContinue'
      },
      'PJE-280': {
        pattern: /localização.*já.*cadastrada|PJE-280/i,
        description: 'Localização já cadastrada',
        severity: 'info',
        autoRecover: true,
        solution: 'skipAndContinue'
      },
      'PJE-282': {
        pattern: /Data.*fim.*menor.*data.*início|PJE-282/i,
        description: 'Data inválida',
        severity: 'error',
        autoRecover: false,
        solution: 'fixDates'
      },
      'OJ_JA_EXISTE': {
        pattern: /já.*está.*cadastrado|already.*exists/i,
        description: 'OJ já cadastrado',
        severity: 'info',
        autoRecover: true,
        solution: 'skipAndContinue'
      }
    };

    // Cache de erros já tratados
    this.handledErrors = new Map();
    
    // Estatísticas de erros
    this.errorStats = {
      total: 0,
      recovered: 0,
      skipped: 0,
      failed: 0
    };
  }

  /**
   * Detecta e trata erros do PJE automaticamente
   */
  async handlePJEError() {
    const startTime = Date.now();
    this.logger.log('🔍 [PJE-ERROR-HANDLER] Verificando erros do PJE...');

    try {
      // 1. Detectar mensagem de erro na página
      const errorMessage = await this.detectErrorMessage();
      
      if (!errorMessage) {
        return { hasError: false };
      }

      this.logger.log(`⚠️ [PJE-ERROR-HANDLER] Erro detectado: ${errorMessage}`);
      
      // 2. Identificar tipo de erro
      const errorType = this.identifyErrorType(errorMessage);
      
      if (!errorType) {
        this.logger.log('❓ [PJE-ERROR-HANDLER] Erro desconhecido, tentando recuperação genérica...');
        return await this.genericRecovery();
      }

      this.logger.log(`📋 [PJE-ERROR-HANDLER] Tipo de erro: ${errorType.description}`);
      
      // 3. Aplicar solução específica
      const result = await this.applySolution(errorType, errorMessage);
      
      const duration = Date.now() - startTime;
      this.logger.log(`✅ [PJE-ERROR-HANDLER] Erro tratado em ${duration}ms`);
      
      return result;

    } catch (error) {
      this.logger.log(`❌ [PJE-ERROR-HANDLER] Falha no tratamento: ${error.message}`);
      return { hasError: true, recovered: false, error: error.message };
    }
  }

  /**
   * Detecta mensagem de erro na página
   */
  async detectErrorMessage() {
    try {
      // Seletores de mensagens de erro do PJE
      const errorSelectors = [
        '.mat-error',
        '.error-message',
        '.alert-danger',
        '.mat-snack-bar-container',
        '[role="alert"]',
        '.mensagem-erro',
        'mat-error',
        '.toast-error',
        '.notification-error'
      ];

      for (const selector of errorSelectors) {
        try {
          const element = await this.page.locator(selector).first();
          if (await element.isVisible({ timeout: 500 })) {
            const text = await element.textContent();
            if (text && text.trim()) {
              return text.trim();
            }
          }
        } catch (e) {
          // Continua para próximo seletor
        }
      }

      // Verificar também por texto específico de erro PJE-281
      const specificErrors = [
        'text=Existe período ativo conflitante',
        'text=PJE-281',
        'text=localização/visibilidade selecionada',
        'text=já está cadastrado'
      ];

      for (const errorText of specificErrors) {
        try {
          const element = await this.page.locator(errorText).first();
          if (await element.isVisible({ timeout: 500 })) {
            const parent = await element.locator('..').first();
            const fullText = await parent.textContent();
            return fullText.trim();
          }
        } catch (e) {
          // Continua
        }
      }

      return null;

    } catch (error) {
      this.logger.log(`⚠️ Erro ao detectar mensagem: ${error.message}`);
      return null;
    }
  }

  /**
   * Identifica o tipo de erro baseado na mensagem
   */
  identifyErrorType(message) {
    for (const [key, errorConfig] of Object.entries(this.errorPatterns)) {
      if (errorConfig.pattern.test(message)) {
        return { ...errorConfig, key };
      }
    }
    return null;
  }

  /**
   * Aplica solução específica para o erro
   */
  async applySolution(errorType, errorMessage) {
    this.errorStats.total++;

    switch (errorType.solution) {
    case 'skipAndContinue':
      return await this.skipAndContinue(errorType, errorMessage);
      
    case 'fixDates':
      return await this.fixDateIssue();
      
    case 'retry':
      return await this.retryOperation();
      
    default:
      return await this.genericRecovery();
    }
  }

  /**
   * Solução: Pular e continuar (para OJs já cadastrados)
   */
  async skipAndContinue(errorType, errorMessage) {
    this.logger.log('🔄 [SKIP-AND-CONTINUE] OJ já existe, pulando...');
    
    try {
      // 1. Fechar modal de erro se existir
      await this.closeErrorModal();
      
      // 2. Clicar em botão Voltar ou Cancelar
      const dismissed = await this.dismissCurrentOperation();
      
      if (dismissed) {
        this.errorStats.skipped++;
        this.logger.log('✅ [SKIP-AND-CONTINUE] Operação cancelada com sucesso');
        
        // Registrar no cache para evitar reprocessamento
        this.handledErrors.set(errorMessage, {
          type: errorType.key,
          timestamp: Date.now(),
          action: 'skipped'
        });
        
        return {
          hasError: true,
          recovered: true,
          action: 'skipped',
          message: 'OJ já cadastrado - pulado com sucesso'
        };
      }

      return {
        hasError: true,
        recovered: false,
        message: 'Não foi possível cancelar a operação'
      };

    } catch (error) {
      this.logger.log(`❌ [SKIP-AND-CONTINUE] Erro: ${error.message}`);
      return {
        hasError: true,
        recovered: false,
        error: error.message
      };
    }
  }

  /**
   * Fecha modal de erro
   */
  async closeErrorModal() {
    try {
      // Tentar fechar por diferentes métodos
      const closeStrategies = [
        // ESC
        async () => {
          await this.page.keyboard.press('Escape');
          await this.page.waitForTimeout(200);
        },
        // Botão X
        async () => {
          const closeButton = await this.page.locator('button[aria-label="Close"], .close-button, .mat-dialog-close').first();
          if (await closeButton.isVisible({ timeout: 500 })) {
            await closeButton.click();
          }
        },
        // Clicar fora do modal
        async () => {
          await this.page.locator('.cdk-overlay-backdrop').click({ force: true });
        }
      ];

      for (const strategy of closeStrategies) {
        try {
          await strategy();
          
          // Verificar se modal fechou
          const modalVisible = await this.page.locator('mat-dialog-container, .modal-dialog').isVisible({ timeout: 500 }).catch(() => false);
          if (!modalVisible) {
            this.logger.log('✅ Modal de erro fechado');
            return true;
          }
        } catch (e) {
          // Continua com próxima estratégia
        }
      }

    } catch (error) {
      this.logger.log(`⚠️ Erro ao fechar modal: ${error.message}`);
    }
    return false;
  }

  /**
   * Cancela operação atual
   */
  async dismissCurrentOperation() {
    try {
      // Botões para cancelar operação
      const cancelButtons = [
        'button:has-text("Voltar")',
        'button:has-text("Cancelar")',
        'button:has-text("Fechar")',
        'button.mat-button:has-text("Voltar")',
        'button.mat-raised-button:has-text("Cancelar")',
        '[aria-label="Voltar"]',
        '[aria-label="Cancelar"]'
      ];

      for (const selector of cancelButtons) {
        try {
          const button = await this.page.locator(selector).first();
          if (await button.isVisible({ timeout: 500 })) {
            await button.click();
            await this.page.waitForTimeout(500);
            this.logger.log(`✅ Clicado em: ${selector}`);
            return true;
          }
        } catch (e) {
          // Continua
        }
      }

      // Se não encontrou botão, tentar ESC
      await this.page.keyboard.press('Escape');
      await this.page.waitForTimeout(300);
      
      return true;

    } catch (error) {
      this.logger.log(`⚠️ Erro ao cancelar operação: ${error.message}`);
      return false;
    }
  }

  /**
   * Recuperação genérica
   */
  async genericRecovery() {
    this.logger.log('🔧 [GENERIC-RECOVERY] Tentando recuperação genérica...');
    
    try {
      // 1. Fechar modais
      await this.closeErrorModal();
      
      // 2. Limpar formulário se necessário
      await this.clearForm();
      
      // 3. Voltar ao estado anterior
      await this.dismissCurrentOperation();
      
      this.errorStats.recovered++;
      
      return {
        hasError: true,
        recovered: true,
        action: 'generic_recovery'
      };
      
    } catch (error) {
      this.errorStats.failed++;
      return {
        hasError: true,
        recovered: false,
        error: error.message
      };
    }
  }

  /**
   * Limpa formulário atual
   */
  async clearForm() {
    try {
      // Buscar botão Limpar
      const clearButton = await this.page.locator('button:has-text("Limpar"), button:has-text("Clear")').first();
      if (await clearButton.isVisible({ timeout: 500 })) {
        await clearButton.click();
        this.logger.log('✅ Formulário limpo');
        return true;
      }
    } catch (error) {
      this.logger.log(`⚠️ Erro ao limpar formulário: ${error.message}`);
    }
    return false;
  }

  /**
   * Verifica se erro já foi tratado recentemente
   */
  isErrorRecentlyHandled(errorMessage) {
    const handled = this.handledErrors.get(errorMessage);
    if (!handled) return false;
    
    // Considerar como recente se foi tratado nos últimos 5 minutos
    const fiveMinutes = 5 * 60 * 1000;
    return (Date.now() - handled.timestamp) < fiveMinutes;
  }

  /**
   * Retorna estatísticas de erros
   */
  getStats() {
    return {
      ...this.errorStats,
      successRate: this.errorStats.total > 0 
        ? ((this.errorStats.recovered + this.errorStats.skipped) / this.errorStats.total * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Limpa cache de erros tratados
   */
  clearCache() {
    this.handledErrors.clear();
    this.logger.log('🧹 [PJE-ERROR-HANDLER] Cache de erros limpo');
  }
}

module.exports = PJEErrorHandler;