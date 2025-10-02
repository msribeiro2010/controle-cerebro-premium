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

    // Configurações de timing otimizadas
    this.timings = {
      // Tempos base
      afterErrorWait: 2500,        // Aguardar 2.5s após erro PJE-281
      afterSuccessWait: 300,        // Apenas 300ms após sucesso
      betweenOJsNormal: 200,        // 200ms entre OJs normalmente
      betweenOJsAfterError: 1500,   // 1.5s entre OJs após erro

      // Tempos de verificação
      errorCheckTimeout: 300,       // 300ms para verificar erro
      modalCheckTimeout: 200,       // 200ms para verificar modal
      fieldClearTimeout: 100,       // 100ms para limpar campos

      // Tempos de recuperação
      errorDismissWait: 500,        // 500ms após fechar erro
      modalReopenWait: 800,         // 800ms após reabrir modal
      stateResetWait: 1000         // 1s para reset completo de estado
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

        // Estratégia 1: ESC key
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(200);

        // Estratégia 2: Clicar em botão de fechar se existir
        try {
          const closeButtons = [
            '.mat-snack-bar-action button',
            '.mat-simple-snackbar-action button',
            'button:has-text("Fechar")',
            'button:has-text("OK")',
            'button:has-text("X")'
          ];

          for (const selector of closeButtons) {
            const button = await this.page.locator(selector).first();
            if (await button.isVisible({ timeout: 100 })) {
              await button.click();
              this.logger.log(`✅ [ERROR-RECOVERY] Botão de fechar clicado: ${selector}`);
              break;
            }
          }
        } catch (e) {
          // Continuar mesmo se não encontrar botão
        }

        // Estratégia 3: Clicar fora do erro
        try {
          await this.page.locator('body').click({ position: { x: 10, y: 10 } });
        } catch (e) {
          // Ignorar se falhar
        }

        // Estratégia 4: ESC múltiplas vezes
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(100);
        await this.page.keyboard.press('Escape');

        // Aguardar limpeza
        await this.page.waitForTimeout(this.timings.errorDismissWait);

        // Verificar se erro foi limpo
        const stillHasError = await this.checkForPJE281Error();
        if (stillHasError) {
          this.logger.log('⚠️ [ERROR-RECOVERY] Erro ainda presente após limpeza - tentando força bruta');

          // Força bruta: recarregar modal
          await this.page.keyboard.press('Escape');
          await this.page.keyboard.press('Escape');
          await this.page.keyboard.press('Escape');
          await this.page.waitForTimeout(500);
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
   * Limpa campos do formulário
   */
  async clearFormFields() {
    try {
      // Limpar dropdown de OJ se estiver aberto
      const dropdownOpen = await this.page.locator('.mat-select-panel').isVisible({ timeout: 100 });
      if (dropdownOpen) {
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(100);
      }

      // Limpar seleções
      const matSelects = await this.page.locator('mat-select').all();
      for (const select of matSelects) {
        try {
          const hasValue = await select.locator('.mat-select-value-text').textContent();
          if (hasValue && hasValue.trim() && hasValue.trim() !== 'Selecione') {
            await select.click();
            await this.page.waitForTimeout(100);
            await this.page.keyboard.press('Escape');
          }
        } catch (e) {
          // Continuar se falhar
        }
      }

      return true;
    } catch (error) {
      this.logger.error('⚠️ [ERROR-RECOVERY] Erro ao limpar campos:', error);
      return false;
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