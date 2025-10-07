/**
 * Enhanced Error Recovery Manager
 * Sistema avançado de recuperação de erros PJE-281 para prevenir contaminação entre OJs
 */

class EnhancedErrorRecovery {
  constructor(page, logger = console) {
    this.page = page;
    this.logger = logger;

    // Estado de erro para tracking
    this.errorState = {
      lastError: null,
      lastErrorTime: null,
      errorCount: 0,
      consecutiveErrors: 0,
      recoveryAttempts: 0
    };

    // Configurações de timing otimizadas (REDUZIDO para PJE-281)
    this.timings = {
      // Tempos base - OTIMIZADO para erro PJE-281 (já existente)
      afterErrorWait: 800,          // Aguardar 800ms após erro PJE-281 (era 2500ms)
      afterSuccessWait: 200,        // Apenas 200ms após sucesso (era 300ms)
      betweenOJsNormal: 150,        // 150ms entre OJs normalmente (era 200ms)
      betweenOJsAfterError: 400,    // 400ms entre OJs após erro (era 1500ms)

      // Tempos de verificação - MANTIDO (já são rápidos)
      errorCheckTimeout: 300,       // 300ms para verificar erro
      modalCheckTimeout: 200,       // 200ms para verificar modal
      fieldClearTimeout: 100,       // 100ms para limpar campos

      // Tempos de recuperação - OTIMIZADO
      errorDismissWait: 200,        // 200ms após fechar erro (era 500ms)
      modalReopenWait: 500,         // 500ms após reabrir modal (era 800ms)
      stateResetWait: 400           // 400ms para reset completo de estado (era 1000ms)
    };

    // Seletores de erro
    this.errorSelectors = [
      'text=/PJE-281/i',
      'text=/já.*cadastrad/i',
      'text=/duplicad/i',
      '.mat-snack-bar-container',
      '.mat-error',
      '[role="alert"]'
    ];
  }

  /**
   * Verifica se há erro PJE-281 presente
   */
  async checkForPJE281Error() {
    try {
      for (const selector of this.errorSelectors.slice(0, 3)) { // Verificar apenas os 3 principais
        const isVisible = await this.page.locator(selector).isVisible({ timeout: this.timings.errorCheckTimeout });
        if (isVisible) {
          this.logger.log(`⚠️ [ERROR-RECOVERY] Erro PJE-281 detectado com seletor: ${selector}`);
          return true;
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Limpa completamente o estado de erro
   */
  async clearErrorState() {
    this.logger.log('🧹 [ERROR-RECOVERY] Iniciando limpeza completa de estado de erro...');

    try {
      // 1. Tentar múltiplos métodos de fechamento
      const errorPresent = await this.checkForPJE281Error();
      if (errorPresent) {
        this.logger.log('🔄 [ERROR-RECOVERY] Erro detectado - aplicando múltiplas estratégias de limpeza');

        // Estratégia 1: Clicar no botão de fechar (mais rápido que ESC)
        try {
          const closeButtons = [
            '.mat-simple-snackbar-action button',
            '.mat-snack-bar-action button',
            'button:has-text("Fechar")',
            'button:has-text("OK")'
          ];

          let closed = false;
          for (const selector of closeButtons) {
            const button = await this.page.locator(selector).first();
            if (await button.isVisible({ timeout: 50 })) {
              await button.click();
              this.logger.log(`✅ [ERROR-RECOVERY] Botão de fechar clicado: ${selector}`);
              closed = true;
              break;
            }
          }

          // Se não encontrou botão, usar ESC
          if (!closed) {
            await this.page.keyboard.press('Escape');
            await this.page.waitForTimeout(100);
          }

        } catch (e) {
          // Fallback: ESC se botão falhar
          await this.page.keyboard.press('Escape');
          await this.page.waitForTimeout(100);
        }

        // Aguardar limpeza rápida
        await this.page.waitForTimeout(this.timings.errorDismissWait);

        // Verificar se erro foi limpo (timeout curto)
        const stillHasError = await this.checkForPJE281Error();
        if (stillHasError) {
          this.logger.log('⚠️ [ERROR-RECOVERY] Erro ainda presente - aplicando ESC final');
          // Apenas um ESC extra se ainda houver erro
          await this.page.keyboard.press('Escape');
          await this.page.waitForTimeout(150);
        }
      }

      // 2. Limpar campos do formulário
      await this.clearFormFields();

      // 3. Aguardar estabilização
      await this.page.waitForTimeout(this.timings.stateResetWait);

      this.logger.log('✅ [ERROR-RECOVERY] Estado de erro limpo com sucesso');
      return true;

    } catch (error) {
      this.logger.error('❌ [ERROR-RECOVERY] Erro ao limpar estado:', error);
      return false;
    }
  }

  /**
   * Limpa campos do formulário (OTIMIZADO)
   */
  async clearFormFields() {
    try {
      // Limpar dropdown de OJ se estiver aberto (sem delay)
      const dropdownOpen = await this.page.locator('.mat-select-panel').isVisible({ timeout: 50 });
      if (dropdownOpen) {
        await this.page.keyboard.press('Escape');
        // Sem timeout - deixa o sistema prosseguir imediatamente
      }

      // Não precisa limpar mat-selects manualmente
      // O sistema vai resetar o campo quando for selecionar o próximo OJ
      // Isso economiza tempo significativo

      return true;
    } catch (error) {
      // Falha silenciosa - não é crítico
      return true; // Retorna true mesmo com erro para não bloquear fluxo
    }
  }

  /**
   * Registra ocorrência de erro
   */
  recordError(errorType = 'PJE-281') {
    this.errorState.lastError = errorType;
    this.errorState.lastErrorTime = Date.now();
    this.errorState.errorCount++;
    this.errorState.consecutiveErrors++;

    this.logger.log(`📊 [ERROR-RECOVERY] Erro registrado: ${errorType} (Total: ${this.errorState.errorCount}, Consecutivos: ${this.errorState.consecutiveErrors})`);
  }

  /**
   * Registra sucesso (reseta contador de erros consecutivos)
   */
  recordSuccess() {
    this.errorState.consecutiveErrors = 0;
    this.errorState.recoveryAttempts = 0;
    this.logger.log('✅ [ERROR-RECOVERY] Sucesso registrado - contadores resetados');
  }

  /**
   * Calcula tempo de espera baseado no estado de erro
   */
  getWaitTime(baseTime = null) {
    // Se teve erro recente (últimos 5 segundos), usar tempo maior
    if (this.errorState.lastErrorTime && (Date.now() - this.errorState.lastErrorTime) < 5000) {
      const waitTime = baseTime || this.timings.afterErrorWait;
      this.logger.log(`⏱️ [ERROR-RECOVERY] Usando tempo de espera estendido: ${waitTime}ms (erro recente)`);
      return waitTime;
    }

    // Se teve muitos erros consecutivos, aumentar tempo progressivamente
    if (this.errorState.consecutiveErrors > 2) {
      const multiplier = Math.min(this.errorState.consecutiveErrors, 5);
      const waitTime = (baseTime || this.timings.betweenOJsNormal) * multiplier;
      this.logger.log(`⏱️ [ERROR-RECOVERY] Usando tempo de espera progressivo: ${waitTime}ms (${this.errorState.consecutiveErrors} erros consecutivos)`);
      return waitTime;
    }

    // Caso normal
    const waitTime = baseTime || this.timings.afterSuccessWait;
    return waitTime;
  }

  /**
   * Recuperação completa de erro PJE-281
   */
  async recoverFromPJE281() {
    this.logger.log('🚨 [ERROR-RECOVERY] Iniciando recuperação de erro PJE-281...');

    try {
      // Registrar erro
      this.recordError('PJE-281');

      // Limpar estado de erro
      const cleared = await this.clearErrorState();
      if (!cleared) {
        this.logger.error('❌ [ERROR-RECOVERY] Falha ao limpar estado de erro');
        return false;
      }

      // Verificar se modal ainda está aberto
      const modalOpen = await this.page.locator('mat-dialog-container').isVisible({ timeout: this.timings.modalCheckTimeout });
      if (!modalOpen) {
        this.logger.log('⚠️ [ERROR-RECOVERY] Modal foi fechado - necessário reabrir');
        return false;
      }

      // Aguardar tempo apropriado baseado no histórico
      const waitTime = this.getWaitTime();
      this.logger.log(`⏳ [ERROR-RECOVERY] Aguardando ${waitTime}ms para estabilização completa...`);
      await this.page.waitForTimeout(waitTime);

      this.logger.log('✅ [ERROR-RECOVERY] Recuperação de PJE-281 concluída');
      return true;

    } catch (error) {
      this.logger.error('❌ [ERROR-RECOVERY] Erro durante recuperação:', error);
      return false;
    }
  }

  /**
   * Prepara para próximo OJ após erro
   */
  async prepareForNextOJ() {
    try {
      // Calcular tempo de espera baseado no estado
      const waitTime = this.getWaitTime(this.timings.betweenOJsNormal);

      this.logger.log(`🔄 [ERROR-RECOVERY] Preparando para próximo OJ (aguardando ${waitTime}ms)...`);

      // Limpar qualquer erro residual
      const hasError = await this.checkForPJE281Error();
      if (hasError) {
        await this.clearErrorState();
      }

      // Aguardar tempo apropriado
      await this.page.waitForTimeout(waitTime);

      // Verificar estado do modal
      const modalOpen = await this.page.locator('mat-dialog-container').isVisible({ timeout: this.timings.modalCheckTimeout });

      this.logger.log(`✅ [ERROR-RECOVERY] Pronto para próximo OJ (Modal: ${modalOpen ? 'Aberto' : 'Fechado'})`);

      return { ready: true, modalOpen };

    } catch (error) {
      this.logger.error('❌ [ERROR-RECOVERY] Erro ao preparar para próximo OJ:', error);
      return { ready: false, modalOpen: false };
    }
  }
}

module.exports = EnhancedErrorRecovery;