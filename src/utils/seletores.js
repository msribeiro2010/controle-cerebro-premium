/**
 * Sistema hierárquico de seletores para o PJE Perito Automation
 * Implementa uma abordagem estruturada para localização de elementos
 */

class SeletorManager {
  /**
   * Seletores organizados hierarquicamente por especificidade
   */
  static SELETORES_HIERARQUICOS = {
    // Seletores mais específicos - maior probabilidade de sucesso
    especificos: {
      orgaoJulgador: [
        // Seletores mais específicos por placeholder
        'mat-select[placeholder="Órgão Julgador"]',
        'mat-select[placeholder="Orgao Julgador"]',
        'select[name="idOrgaoJulgadorSelecionado"]',
        
        // Seletores por context de modal/dialog
        'mat-dialog-container mat-select[placeholder="Órgão Julgador"]',
        'mat-dialog-container mat-select[placeholder="Orgao Julgador"]',
        '[role="dialog"] mat-select[placeholder="Órgão Julgador"]',
        '[role="dialog"] mat-select[placeholder="Orgao Julgador"]',
        '.mat-dialog-container mat-select[placeholder="Órgão Julgador"]',
        
        // Seletores por ID específicos
        '#mat-dialog-2 mat-select[placeholder="Órgão Julgador"]',
        '#mat-dialog-3 mat-select[placeholder="Órgão Julgador"]',
        '#mat-dialog-4 mat-select[placeholder="Órgão Julgador"]',
        
        // Seletores por componente específico
        'pje-modal-localizacao-visibilidade mat-select[placeholder="Órgão Julgador"]',
        'pje-modal-localizacao-visibilidade mat-select[placeholder="Orgao Julgador"]',
        
        // Seletores por name/formControlName
        'mat-select[name="idOrgaoJulgadorSelecionado"]',
        'mat-select[formcontrolname="idOrgaoJulgadorSelecionado"]',
        'mat-select[formcontrolname="orgaoJulgador"]',
        'mat-select[formcontrolname="orgao"]',
        
        // Seletores por aria-label
        'mat-select[aria-label="Órgão Julgador"]',
        'mat-select[aria-label="Orgao Julgador"]',
        'mat-select[aria-labelledby*="orgao"]',
        'mat-select[aria-labelledby*="julgador"]',
        
        // Seletores por ID do próprio elemento
        '#orgaoJulgador',
        '#orgao-julgador',
        '#mat-select-orgao',
        '#select-orgao-julgador'
      ],
      botaoAdicionar: [
        'button:has-text("Adicionar Órgão Julgador ao Perito")',
        'button:has-text("Adicionar Órgão Julgador")',
        'button:has-text("Adicionar")',
        'button[title*="Adicionar"]'
      ],
      acordeonHeader: [
        'mat-expansion-panel-header:has-text("Órgãos Julgadores vinculados ao Perito")',
        'mat-expansion-panel-header:has-text("Órgãos Julgadores")',
        '.mat-expansion-panel-header:has-text("Órgãos Julgadores")'
      ]
    },
    
    // Seletores contextuais - baseados no contexto da página
    contextuais: {
      orgaoJulgador: [
        '.campo-orgao-julgador mat-select',
        '.mat-form-field.campo-orgao-julgador mat-select',
        'mat-expansion-panel:has-text("Órgão") mat-select',
        '.mat-expansion-panel-content mat-select',
        'label:has-text("Órgão Julgador") + * mat-select',
        'label:has-text("Órgão Julgador") ~ * mat-select'
      ],
      botaoAdicionar: [
        '#cdk-accordion-child-8 > div > div > button',
        'button[aria-expanded]',
        'button.mat-button-wrapper',
        'a:has-text("Adicionar")',
        '.btn:has-text("Adicionar")'
      ],
      acordeonHeader: [
        'text=Órgãos Julgadores vinculados ao Perito',
        'text=Órgãos Julgadores',
        'text=Orgãos Julgadores',
        '[data-toggle="collapse"]',
        '.panel-heading'
      ],
      acordeonHeaderByRole: [
        'button[name="Órgãos Julgadores vinculados ao Perito"]',
        'button[aria-label="Órgãos Julgadores vinculados ao Perito"]'
      ]
    },
    
    // Seletores genéricos - menor especificidade, maior cobertura
    genericos: {
      orgaoJulgador: [
        // Seletores por placeholder parcial
        'mat-select[placeholder*="Órgão"]',
        'mat-select[placeholder*="Orgao"]',
        'mat-select[placeholder*="Julgador"]',
        'mat-select[placeholder*="órgão"]',
        'mat-select[placeholder*="orgao"]',
        'mat-select[placeholder*="julgador"]',
        
        // Seletores por ID parcial
        '[id*="orgao"] mat-select',
        '[id*="julgador"] mat-select',
        '[id*="Orgao"] mat-select',
        '[id*="Julgador"] mat-select',
        
        // Seletores por class parcial
        '[class*="orgao"] mat-select',
        '[class*="julgador"] mat-select',
        '[class*="Orgao"] mat-select',
        '[class*="Julgador"] mat-select',
        
        // Seletores de contexto modal
        'mat-dialog-container mat-select',
        '[role="dialog"] mat-select',
        '.mat-dialog-container mat-select',
        
        // Seletores genéricos ordenados por especificidade
        '.mat-form-field mat-select',
        'mat-form-field mat-select',
        '.campo-select mat-select',
        'select[name*="orgao"]',
        'select[name*="julgador"]',
        'mat-select',
        'input[role="combobox"]',
        '[role="combobox"]',
        '.ng-select',
        '.select2-container',
        'select[formcontrolname="orgaoJulgadorId"]',
        'select[name="orgaoJulgadorId"]',
        '#orgaoJulgadorId',
        'select[id*="orgao"]',
        'select[id*="julgador"]',
        'select.form-control',
        'select'
      ],
      botaoAdicionar: [
        'button',
        'a.btn',
        '.btn'
      ],
      acordeonHeader: [
        'h4:has-text("Órgão")',
        'h3:has-text("Órgão")',
        'span:has-text("Órgão")',
        '[role="button"][aria-expanded="false"]:has-text("Órgão")',
        'button[aria-expanded="false"]:has-text("Órgão")'
      ]
    }
  };

  /**
   * Seletores para opções de dropdown organizados por tipo de componente
   */
  static SELETORES_OPCOES = {
    matSelect: [
      '.cdk-overlay-pane mat-option',
      'div[role="listbox"] mat-option',
      'mat-option'
    ],
    ngSelect: [
      '.ng-dropdown-panel .ng-option',
      '.ng-option'
    ],
    select2: [
      'li.select2-results__option',
      '.select2-results__option'
    ],
    generic: [
      '[role="option"]',
      'li[role="option"]',
      'div[role="option"]',
      '[id^="cdk-overlay-"] [role="option"]'
    ]
  };

  /**
   * Busca um elemento usando seletores hierárquicos
   * @param {Object} page - Instância da página Playwright
   * @param {string} tipo - Tipo do elemento (orgaoJulgador, botaoAdicionar, acordeonHeader)
   * @param {number} timeout - Timeout para cada tentativa
   * @returns {Promise<{elemento: string, seletor: string, nivel: string}>}
   */
  static async buscarElemento(page, tipo, timeout = 2000) {
    console.log(`[SeletorManager] Iniciando busca para elemento tipo: ${tipo} com timeout: ${timeout}ms`);
    
    // Para órgão julgador, primeiro tentar expandir o acordeão se necessário
    if (tipo === 'orgaoJulgador') {
      console.log('[SeletorManager] Verificando se acordeão precisa ser expandido...');
      try {
        // Tentar expandir o acordeão primeiro
        const expandido = await this.clicarBotaoOrgaosJulgadoresByRole(page, 3000);
        if (expandido) {
          console.log('[SeletorManager] Acordeão expandido, aguardando campo ser habilitado...');
          // Aguardar um pouco para o campo aparecer
          await page.waitForTimeout(1000);
          // Tentar aguardar que o mat-select seja habilitado
          await this.aguardarMatSelectHabilitado(page, 5000);
        }
      } catch (error) {
        console.log(`[SeletorManager] ⚠️ Erro ao expandir acordeão: ${error.message}`);
      }
    }
    
    const niveis = ['especificos', 'contextuais', 'genericos'];
    
    for (const nivel of niveis) {
      const seletores = this.SELETORES_HIERARQUICOS[nivel][tipo] || [];
      console.log(`[SeletorManager] Testando nível ${nivel} com ${seletores.length} seletores`);
      
      for (const seletor of seletores) {
        try {
          console.log(`[SeletorManager] Testando ${nivel}: ${seletor}`);
          
          // Verificar se a página ainda está válida
          if (page.isClosed()) {
            throw new Error('Página foi fechada durante a busca');
          }
          
          await page.waitForSelector(seletor, { timeout });
          
          // Para órgão julgador, validar contexto
          if (tipo === 'orgaoJulgador') {
            const isValid = await this.validarContextoOrgaoJulgador(page, seletor);
            if (!isValid && nivel !== 'genericos') {
              console.log(`[SeletorManager] Contexto inválido para: ${seletor}`);
              continue;
            }
          }
          
          console.log(`[SeletorManager] ✓ Elemento encontrado: ${seletor} (${nivel})`);
          return {
            elemento: seletor,
            seletor,
            nivel
          };
        } catch (error) {
          console.log(`[SeletorManager] ✗ Falhou: ${seletor} - ${error.message}`);
          
          // Se a página foi fechada, parar imediatamente
          if (error.message.includes('Target page, context or browser has been closed')) {
            throw new Error('Página foi fechada durante a busca do elemento');
          }
        }
      }
    }
    
    // Se chegou aqui e é orgaoJulgador, tentar uma última vez expandindo o acordeão
    if (tipo === 'orgaoJulgador') {
      console.log('[SeletorManager] ⚠️ Campo não encontrado, tentando expandir acordeão novamente...');
      try {
        await this.clicarBotaoOrgaosJulgadoresByRole(page, 3000);
        await page.waitForTimeout(2000);
        await this.aguardarMatSelectHabilitado(page, 5000);
        
        // Tentar buscar novamente apenas os seletores específicos
        const seletoresEspecificos = this.SELETORES_HIERARQUICOS.especificos[tipo] || [];
        for (const seletor of seletoresEspecificos) {
          try {
            await page.waitForSelector(seletor, { timeout: 3000 });
            console.log(`[SeletorManager] ✓ Elemento encontrado após expansão: ${seletor}`);
            return {
              elemento: seletor,
              seletor,
              nivel: 'especificos-retry'
            };
          } catch (error) {
            console.log(`[SeletorManager] ✗ Retry falhou: ${seletor} - ${error.message}`);
          }
        }
      } catch (error) {
        console.log(`[SeletorManager] ✗ Erro no retry de expansão: ${error.message}`);
      }
    }
    
    throw new Error(`Elemento do tipo '${tipo}' não encontrado com nenhum seletor após ${timeout}ms por tentativa`);
  }

  /**
   * Valida se o elemento encontrado é realmente para órgão julgador
   * @param {Object} page - Instância da página
   * @param {string} seletor - Seletor do elemento
   * @returns {Promise<boolean>}
   */
  static async validarContextoOrgaoJulgador(page, seletor) {
    try {
      const contexto = await page.$eval(seletor, el => {
        const placeholder = el.getAttribute('placeholder') || '';
        const name = el.getAttribute('name') || '';
        const id = el.getAttribute('id') || '';
        const parentText = el.closest('mat-expansion-panel, .panel, .card, .form-group')?.textContent || '';
        
        return {
          placeholder: placeholder.toLowerCase(),
          name: name.toLowerCase(),
          id: id.toLowerCase(),
          parentText: parentText.toLowerCase().substring(0, 200)
        };
      });
      
      // Verificar se é realmente o campo de órgão julgador
      const placeholderProcessed = typeof contexto.placeholder === 'string' ? contexto.placeholder : (contexto.placeholder?.nome || String(contexto.placeholder || ''));
      const nameProcessed = typeof contexto.name === 'string' ? contexto.name : (contexto.name?.nome || String(contexto.name || ''));
      const idProcessed = typeof contexto.id === 'string' ? contexto.id : (contexto.id?.nome || String(contexto.id || ''));
      const parentTextProcessed = typeof contexto.parentText === 'string' ? contexto.parentText : (contexto.parentText?.nome || String(contexto.parentText || ''));
      const seletorProcessed = typeof seletor === 'string' ? seletor : (seletor?.nome || String(seletor || ''));
      
      const isOrgaoJulgador = 
        placeholderProcessed.includes('órgão') ||
        placeholderProcessed.includes('julgador') ||
        nameProcessed.includes('orgao') ||
        nameProcessed.includes('julgador') ||
        idProcessed.includes('orgao') ||
        idProcessed.includes('julgador') ||
        parentTextProcessed.includes('órgão') ||
        parentTextProcessed.includes('julgador') ||
        seletorProcessed.toLowerCase().includes('orgao') ||
        seletorProcessed.toLowerCase().includes('órgão');
      
      console.log(`[SeletorManager] Validação contexto: ${isOrgaoJulgador}`, contexto);
      return isOrgaoJulgador;
    } catch (error) {
      console.log(`[SeletorManager] Erro na validação de contexto: ${error.message}`);
      return false;
    }
  }

  /**
   * Detecta o tipo de componente select
   * @param {string} seletor - Seletor do elemento
   * @returns {string} Tipo do componente
   */
  static detectarTipoComponente(seletor) {
    if (seletor.includes('mat-select')) return 'matSelect';
    if (seletor.includes('ng-select')) return 'ngSelect';
    if (seletor.includes('select2')) return 'select2';
    if (seletor.includes('role="combobox"') || seletor.includes('[role="combobox"]')) return 'combobox';
    if (seletor.includes('select')) return 'select';
    return 'generic';
  }

  /**
   * Clica no botão 'Órgãos Julgadores vinculados ao Perito' usando getByRole
   * @param {Object} page - Instância da página Playwright
   * @param {number} timeout - Timeout para a operação
   * @returns {Promise<boolean>} True se conseguiu clicar, false caso contrário
   */
  static async clicarBotaoOrgaosJulgadoresByRole(page, timeout = 3000) {
    try {
      console.log('[SeletorManager] Tentando clicar no botão usando getByRole...');
      
      // Tentar usando getByRole com o nome exato
      const botao = page.getByRole('button', { name: 'Órgãos Julgadores vinculados ao Perito' });
      
      // Aguardar o botão estar visível
      await botao.waitFor({ timeout });
      
      // Verificar se está visível
      if (await botao.isVisible()) {
        await botao.click();
        console.log('[SeletorManager] ✓ Clicou no botão usando getByRole');
        return true;
      }
      
      console.log('[SeletorManager] Botão não está visível');
      return false;
    } catch (error) {
      console.log(`[SeletorManager] ✗ Erro ao clicar usando getByRole: ${error.message}`);
      return false;
    }
  }

  /**
   * Aguarda que o mat-select seja habilitado (aria-disabled='false')
   * @param {Object} page - Instância da página Playwright
   * @param {number} timeout - Timeout para a operação
   * @returns {Promise<boolean>} True se o campo foi habilitado, false caso contrário
   */
  static async aguardarMatSelectHabilitado(page, timeout = 20000) {
    try {
      console.log('[SeletorManager] Aguardando mat-select ser habilitado...');
      
      // Aguardar um pouco para a página carregar completamente
      await page.waitForTimeout(2000);
      
      // Primeiro tentar com name="idOrgaoJulgadorSelecionado"
      try {
        console.log('[SeletorManager] Tentativa 1: Aguardando mat-select com name...');
        await page.waitForFunction(() => {
          const el = document.querySelector('mat-select[name="idOrgaoJulgadorSelecionado"]');
          return el && el.getAttribute('aria-disabled') === 'false';
        }, { timeout: timeout / 3 });
        
        console.log('[SeletorManager] ✓ mat-select habilitado (usando name)');
        return true;
      } catch (error) {
        console.log('[SeletorManager] Tentativa com name falhou, tentando com placeholder...');
      }
      
      // Fallback para placeholder="Órgão Julgador"
      try {
        console.log('[SeletorManager] Tentativa 2: Aguardando mat-select com placeholder...');
        await page.waitForFunction(() => {
          const el = document.querySelector('mat-select[placeholder="Órgão Julgador"]');
          return el && el.getAttribute('aria-disabled') === 'false';
        }, { timeout: timeout / 3 });
        
        console.log('[SeletorManager] ✓ mat-select habilitado (usando placeholder)');
        return true;
      } catch (error) {
        console.log('[SeletorManager] Tentativa com placeholder falhou, tentando estratégia genérica...');
      }
      
      // Fallback final: qualquer mat-select habilitado
      try {
        console.log('[SeletorManager] Tentativa 3: Aguardando qualquer mat-select habilitado...');
        await page.waitForFunction(() => {
          const elements = document.querySelectorAll('mat-select');
          for (const el of elements) {
            if (el.getAttribute('aria-disabled') === 'false') {
              return true;
            }
          }
          return false;
        }, { timeout: timeout / 3 });
        
        console.log('[SeletorManager] ✓ mat-select genérico habilitado');
        return true;
      } catch (error) {
        console.log('[SeletorManager] Todas as tentativas falharam, verificando se existe algum mat-select...');
        
        // Debug: verificar se existe algum mat-select na página
        try {
          const matSelects = await page.$$eval('mat-select', els => 
            els.map(el => ({
              placeholder: el.getAttribute('placeholder'),
              name: el.getAttribute('name'),
              ariaDisabled: el.getAttribute('aria-disabled'),
              visible: el.offsetParent !== null
            }))
          );
          
          console.log('[SeletorManager] Mat-selects encontrados na página:', matSelects);
          
          if (matSelects.length > 0) {
            console.log('[SeletorManager] ⚠️ Mat-selects existem mas não estão habilitados, continuando mesmo assim...');
            return true; // Continuar mesmo se não estiver habilitado
          }
        } catch (debugError) {
          console.log('[SeletorManager] Erro no debug de mat-selects:', debugError.message);
        }
      }
      
      console.log('[SeletorManager] ✗ Nenhum mat-select encontrado ou habilitado');
      return false;
    } catch (error) {
      console.log(`[SeletorManager] ✗ Erro ao aguardar mat-select ser habilitado: ${error.message}`);
      return false;
    }
  }

  /**
   * Clica no campo "Órgão Julgador" usando múltiplas estratégias robustas
   * @param {Object} page - Instância da página Playwright
   * @param {number} timeout - Timeout para a operação
   * @returns {Promise<boolean>} True se conseguiu clicar, false caso contrário
   */
  static async clicarCampoOrgaoJulgador(page, timeout = 5000) {
    try {
      console.log('[SeletorManager] Tentando clicar no campo "Órgão Julgador"...');
      
      // Aguardar que a página carregue completamente
      await page.waitForTimeout(3000);
      
      // Primeiro aguardar que o mat-select seja habilitado
      const habilitado = await this.aguardarMatSelectHabilitado(page, timeout);
      if (!habilitado) {
        console.log('[SeletorManager] ⚠️ mat-select não foi habilitado, tentando clicar mesmo assim...');
      }
      
      // Aguardar mais um pouco após verificar se está habilitado
      await page.waitForTimeout(1000);
      
      // Estratégia 1: Tentar clicar no mat-select usando name primeiro
      try {
        console.log('[SeletorManager] Estratégia 1: Clicando por name...');
        const matSelectName = page.locator('mat-select[name="idOrgaoJulgadorSelecionado"]');
        
        // Aguardar o elemento estar presente
        await matSelectName.waitFor({ timeout: 8000 });
        
        // Verificar se existe e está hidden
        const count = await matSelectName.count();
        if (count > 0) {
          const isVisible = await matSelectName.isVisible();
          console.log(`[SeletorManager] mat-select encontrado (name), visível: ${isVisible}`);
          
          if (!isVisible) {
            console.log('[SeletorManager] Elemento hidden, fazendo scroll e usando force click...');
            try {
              await matSelectName.scrollIntoViewIfNeeded();
              await page.waitForTimeout(500);
            } catch (scrollError) {
              console.log('[SeletorManager] Scroll falhou, tentando force click direto...');
            }
            await matSelectName.click({ force: true });
          } else {
            await matSelectName.click();
          }
          
          console.log('[SeletorManager] ✓ Clique no mat-select realizado com sucesso (usando name)');
          return true;
        }
      } catch (error) {
        console.log('[SeletorManager] Estratégia 1 falhou, tentando com placeholder...', error.message);
      }
      
      // Estratégia 2: Fallback para placeholder
      try {
        console.log('[SeletorManager] Estratégia 2: Clicando por placeholder...');
        const matSelectPlaceholder = page.locator('mat-select[placeholder="Órgão Julgador"]');
        
        // Aguardar o elemento estar presente
        await matSelectPlaceholder.waitFor({ timeout: 8000 });
        
        const count = await matSelectPlaceholder.count();
        if (count > 0) {
          const isVisible = await matSelectPlaceholder.isVisible();
          console.log(`[SeletorManager] mat-select encontrado (placeholder), visível: ${isVisible}`);
          
          if (!isVisible) {
            console.log('[SeletorManager] Elemento hidden, fazendo scroll e usando force click...');
            try {
              await matSelectPlaceholder.scrollIntoViewIfNeeded();
              await page.waitForTimeout(500);
            } catch (scrollError) {
              console.log('[SeletorManager] Scroll falhou, tentando force click direto...');
            }
            await matSelectPlaceholder.click({ force: true });
          } else {
            await matSelectPlaceholder.click();
          }
          
          console.log('[SeletorManager] ✓ Clique no mat-select realizado com sucesso (usando placeholder)');
          return true;
        }
      } catch (error) {
        console.log('[SeletorManager] Estratégia 2 falhou, tentando com contexto modal...', error.message);
      }
      
      // Estratégia 3: Fallback para mat-select em contexto modal
      try {
        console.log('[SeletorManager] Estratégia 3: Clicando por contexto modal...');
        const matSelectModal = page.locator('mat-dialog-container mat-select');
        
        // Aguardar o elemento estar presente
        await matSelectModal.waitFor({ timeout: 8000 });
        
        const count = await matSelectModal.count();
        if (count > 0) {
          console.log('[SeletorManager] Encontrado mat-select em modal, tentando clicar...');
          
          const isVisible = await matSelectModal.isVisible();
          console.log(`[SeletorManager] mat-select modal visível: ${isVisible}`);
          
          if (!isVisible) {
            console.log('[SeletorManager] Usando force click no mat-select modal...');
            try {
              await matSelectModal.scrollIntoViewIfNeeded();
              await page.waitForTimeout(500);
            } catch (scrollError) {
              console.log('[SeletorManager] Scroll falhou, force click direto...');
            }
            await matSelectModal.click({ force: true });
          } else {
            await matSelectModal.click();
          }
          
          console.log('[SeletorManager] ✓ Clique no mat-select modal realizado com sucesso');
          return true;
        }
      } catch (error) {
        console.log('[SeletorManager] Estratégia 3 falhou, tentando genérico...', error.message);
      }
      
      // Estratégia 4: Fallback para qualquer mat-select
      try {
        console.log('[SeletorManager] Estratégia 4: Clicando por seletor genérico...');
        const anyMatSelect = page.locator('mat-select').first();
        
        // Aguardar o elemento estar presente
        await anyMatSelect.waitFor({ timeout: 8000 });
        
        const count = await anyMatSelect.count();
        if (count > 0) {
          console.log('[SeletorManager] Encontrado mat-select genérico, tentando clicar...');
          
          const isVisible = await anyMatSelect.isVisible();
          console.log(`[SeletorManager] mat-select genérico visível: ${isVisible}`);
          
          if (!isVisible) {
            console.log('[SeletorManager] Usando force click no mat-select genérico...');
            try {
              await anyMatSelect.scrollIntoViewIfNeeded();
              await page.waitForTimeout(500);
            } catch (scrollError) {
              console.log('[SeletorManager] Scroll falhou, force click direto...');
            }
            await anyMatSelect.click({ force: true });
          } else {
            await anyMatSelect.click();
          }
          
          console.log('[SeletorManager] ✓ Clique no mat-select genérico realizado com sucesso');
          return true;
        }
      } catch (error) {
        console.log('[SeletorManager] Estratégia 4 falhou, tentando com label...', error.message);
      }
      
      // Estratégia 5: Fallback para label
      try {
        console.log('[SeletorManager] Estratégia 5: Clicando por label...');
        const labelElement = page.locator('label:has-text("Órgão Julgador")');
        await labelElement.waitFor({ state: 'visible', timeout: 8000 });
        await labelElement.click();
        console.log('[SeletorManager] ✓ Clique no campo "Órgão Julgador" realizado com sucesso (usando label)');
        return true;
      } catch (error) {
        console.log('[SeletorManager] Estratégia 5 falhou, tentando JavaScript...', error.message);
      }
      
      // Estratégia 6: Forçar clique com JavaScript
      try {
        console.log('[SeletorManager] Estratégia 6: Forçando clique com JavaScript...');
        const clickResult = await page.evaluate(() => {
          const selectors = [
            'mat-select[name="idOrgaoJulgadorSelecionado"]',
            'mat-select[placeholder="Órgão Julgador"]',
            'mat-dialog-container mat-select',
            'mat-select'
          ];
          
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
              element.click();
              console.log(`Clique forçado em: ${selector}`);
              return true;
            }
          }
          return false;
        });
        
        if (clickResult) {
          console.log('[SeletorManager] ✓ Clique forçado realizado com JavaScript');
          return true;
        }
      } catch (error) {
        console.log('[SeletorManager] Estratégia 6 falhou:', error.message);
      }
      
      console.log('[SeletorManager] ❌ Todas as tentativas de clique falharam');
      return false;
    } catch (error) {
      console.log(`[SeletorManager] ✗ Erro ao clicar no campo "Órgão Julgador": ${error.message}`);
      return false;
    }
  }

  /**
   * Digita/seleciona OJ no campo com tratamento para autocomplete e select padrão
   * @param {Object} page - Instância da página Playwright
   * @param {string} nomeOJ - Nome do órgão julgador
   * @returns {Promise<boolean>} True se conseguiu digitar, false caso contrário
   */
  static async digitarSelecionarOJ(page, nomeOJ) {
    try {
      // Validação de tipos
      let nomeProcessado;
      if (typeof nomeOJ === 'string') {
        nomeProcessado = nomeOJ;
      } else if (nomeOJ && typeof nomeOJ === 'object' && nomeOJ.nome) {
        nomeProcessado = String(nomeOJ.nome);
      } else {
        nomeProcessado = String(nomeOJ || '');
      }
      
      if (!nomeProcessado) {
        console.log('[SeletorManager] Nome do OJ vazio ou inválido');
        return false;
      }
      
      console.log(`[SeletorManager] Tentando digitar/selecionar OJ: ${nomeProcessado}`);
      
      // Aguardar um pouco para o campo estar pronto
      await page.waitForTimeout(500);
      
      // Estratégia 1: Tentar digitar usando keyboard.type (para autocomplete)
      try {
        console.log('[SeletorManager] Estratégia 1: Digitando com keyboard.type...');
        await page.keyboard.type(nomeProcessado, { delay: 50 });
        
        // Aguardar um pouco para as opções aparecerem
        await page.waitForTimeout(800);
        
        console.log('[SeletorManager] ✓ Texto digitado com sucesso (keyboard.type)');
        return true;
      } catch (typeError) {
        console.log('[SeletorManager] Estratégia 1 falhou, tentando fill...');
      }
      
      // Estratégia 2: Tentar usar fill diretamente no input
      try {
        console.log('[SeletorManager] Estratégia 2: Usando fill no input...');
        
        // Procurar input associado ao mat-select
        const inputSelectors = [
          'input[aria-owns*="mat-autocomplete"]',
          'input[role="combobox"]',
          'mat-select input',
          'input[placeholder*="Órgão"]',
          'input[placeholder*="Julgador"]'
        ];
        
        for (const selector of inputSelectors) {
          try {
            const input = page.locator(selector);
            const count = await input.count();
            
            if (count > 0) {
              console.log(`[SeletorManager] Input encontrado: ${selector}`);
              await input.fill(nomeProcessado);
              
              // Aguardar um pouco para as opções aparecerem
              await page.waitForTimeout(800);
              
              console.log('[SeletorManager] ✓ Texto preenchido com sucesso (fill)');
              return true;
            }
          } catch (inputError) {
            console.log(`[SeletorManager] Input ${selector} falhou: ${inputError.message}`);
          }
        }
      } catch (fillError) {
        console.log('[SeletorManager] Estratégia 2 falhou, tentando focus + type...');
      }
      
      // Estratégia 3: Focus + type mais lento
      try {
        console.log('[SeletorManager] Estratégia 3: Focus no mat-select + type lento...');
        
        // Focar no mat-select primeiro
        const matSelect = page.locator('mat-select').first();
        await matSelect.focus();
        await page.waitForTimeout(300);
        
        // Digitar caractere por caractere
        for (const char of nomeProcessado) {
          await page.keyboard.type(char);
          await page.waitForTimeout(100);
        }
        
        await page.waitForTimeout(800);
        
        console.log('[SeletorManager] ✓ Texto digitado com sucesso (focus + type lento)');
        return true;
      } catch (focusError) {
        console.log('[SeletorManager] Estratégia 3 falhou...');
      }
      
      console.log('[SeletorManager] ❌ Todas as estratégias de digitação falharam');
      return false;
    } catch (error) {
      console.log(`[SeletorManager] ✗ Erro ao digitar/selecionar OJ: ${error.message}`);
      return false;
    }
  }

  /**
   * Confirma seleção com Enter
   * @param {Object} page - Instância da página Playwright
   * @returns {Promise<boolean>} True se conseguiu confirmar, false caso contrário
   */
  static async confirmarSelecaoComEnter(page) {
    try {
      console.log('[SeletorManager] Tentando confirmar seleção com Enter...');
      
      // Aguardar um pouco para a lista suspensa aparecer
      await page.waitForTimeout(500);
      
      // Estratégia 1: Verificar se há opções visíveis para selecionar
      try {
        console.log('[SeletorManager] Verificando se opções estão disponíveis...');
        
        // Procurar por opções mat-option visíveis
        const opcoes = page.locator('mat-option');
        const countOpcoes = await opcoes.count();
        
        if (countOpcoes > 0) {
          console.log(`[SeletorManager] ${countOpcoes} opções encontradas, usando Arrow Down + Enter...`);
          
          // Usar Arrow Down para selecionar a primeira opção
          await page.keyboard.press('ArrowDown');
          await page.waitForTimeout(200);
          await page.keyboard.press('Enter');
          
          console.log('[SeletorManager] ✓ Seleção confirmada com Arrow Down + Enter');
          return true;
        }
      } catch (optionError) {
        console.log('[SeletorManager] Não encontrou opções visíveis, tentando Enter direto...');
      }
      
      // Estratégia 2: Pressionar Enter direto
      try {
        await page.keyboard.press('Enter');
        console.log('[SeletorManager] ✓ Enter pressionado diretamente');
        
        // Aguardar um pouco para ver se funcionou
        await page.waitForTimeout(500);
        return true;
      } catch (enterError) {
        console.log('[SeletorManager] Enter direto falhou, tentando Tab...');
      }
      
      // Estratégia 3: Usar Tab para sair do campo (aceita valor atual)
      try {
        await page.keyboard.press('Tab');
        console.log('[SeletorManager] ✓ Tab pressionado para aceitar valor');
        await page.waitForTimeout(300);
        return true;
      } catch (tabError) {
        console.log('[SeletorManager] Tab também falhou, tentando Escape + nova tentativa...');
      }
      
      // Estratégia 4: Escape para fechar dropdown + tentar novamente
      try {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        await page.keyboard.press('Enter');
        console.log('[SeletorManager] ✓ Escape + Enter executado');
        return true;
      } catch (escapeError) {
        console.log('[SeletorManager] Escape + Enter falhou...');
      }
      
      console.log('[SeletorManager] ❌ Todas as estratégias de confirmação falharam');
      return false;
    } catch (error) {
      console.log(`[SeletorManager] ✗ Erro ao confirmar seleção: ${error.message}`);
      return false;
    }
  }

  /**
   * Clica no botão "Vincular Órgão Julgador ao Perito" usando getByRole
   * @param {Object} page - Instância da página Playwright
   * @param {number} timeout - Timeout para a operação
   * @returns {Promise<boolean>} True se conseguiu clicar, false caso contrário
   */
  static async clicarBotaoVincularOJ(page, timeout = 5000) {
    try {
      console.log('[SeletorManager] Tentando clicar no botão "Vincular Órgão Julgador ao Perito" usando getByRole...');
      
      // Aguardar o botão ficar visível
      await page.getByRole('button', { name: 'Vincular Órgão Julgador ao Perito' }).waitFor({ state: 'visible', timeout });
      
      // Clicar no botão
      await page.getByRole('button', { name: 'Vincular Órgão Julgador ao Perito' }).click();
      
      console.log('[SeletorManager] ✓ Clique no botão "Vincular Órgão Julgador ao Perito" realizado com sucesso');
      return true;
    } catch (error) {
      console.log(`[SeletorManager] ✗ Erro ao clicar no botão "Vincular Órgão Julgador ao Perito": ${error.message}`);
      return false;
    }
  }

  /**
   * Busca opções de dropdown baseado no tipo de componente
   * @param {Object} page - Instância da página
   * @param {string} tipoComponente - Tipo do componente
   * @param {number} timeout - Timeout para busca
   * @returns {Promise<Array>} Lista de opções encontradas
   */
  static async buscarOpcoes(page, tipoComponente, timeout = 800) {
    const seletoresOpcoes = this.SELETORES_OPCOES[tipoComponente] || this.SELETORES_OPCOES.generic;
    
    for (const seletor of seletoresOpcoes) {
      try {
        console.log(`[SeletorManager] Buscando opções com: ${seletor}`);
        await page.waitForSelector(seletor, { timeout });
        
        const opcoes = await page.$$eval(seletor, options => 
          options.map(option => ({
            value: option.getAttribute('value') || option.textContent?.trim(),
            text: option.textContent?.trim() || ''
          })).filter(opt => opt.text)
        );
        
        if (opcoes.length > 0) {
          console.log(`[SeletorManager] ✓ Encontradas ${opcoes.length} opções`);
          return opcoes;
        }
      } catch (error) {
        console.log(`[SeletorManager] ✗ Falhou buscar opções: ${seletor} - ${error.message}`);
      }
    }
    
    return [];
  }

  /**
   * Lista todos os elementos disponíveis para debug
   * @param {Object} page - Instância da página
   * @param {string} tipo - Tipo de elemento para listar
   */
  static async listarElementosDisponiveis(page, tipo = 'select') {
    try {
      const seletorGenerico = tipo === 'select' ? 'select, mat-select, [role="combobox"]' : tipo;
      const elementos = await page.$$eval(seletorGenerico, els => 
        els.map((el, index) => ({
          index,
          tagName: el.tagName,
          id: el.id || '',
          className: el.className || '',
          placeholder: el.getAttribute('placeholder') || '',
          name: el.getAttribute('name') || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          ariaLabelledBy: el.getAttribute('aria-labelledby') || '',
          formControlName: el.getAttribute('formcontrolname') || '',
          role: el.getAttribute('role') || '',
          disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
          visible: el.offsetParent !== null,
          parentContext: el.closest('mat-dialog-container, [role="dialog"], .mat-dialog-container') ? 'modal' : 'page',
          textContent: (el.textContent || '').substring(0, 100)
        }))
      );
      
      console.log(`[SeletorManager] 🔍 DEBUG: Elementos ${tipo} disponíveis na página:`);
      elementos.forEach((el, i) => {
        console.log(`  ${i + 1}. ${el.tagName}${el.id ? `#${el.id}` : ''}${el.className ? `.${el.className.split(' ').join('.')}` : ''}`);
        if (el.placeholder) console.log(`     placeholder="${el.placeholder}"`);
        if (el.name) console.log(`     name="${el.name}"`);
        if (el.ariaLabel) console.log(`     aria-label="${el.ariaLabel}"`);
        if (el.formControlName) console.log(`     formcontrolname="${el.formControlName}"`);
        console.log(`     visível: ${el.visible}, habilitado: ${!el.disabled}, contexto: ${el.parentContext}`);
        if (el.textContent.trim()) console.log(`     texto: "${el.textContent.trim()}"`);
        console.log(''); // linha em branco para separar
      });
      
      // Debug adicional específico para mat-select
      if (tipo === 'select') {
        try {
          const matSelects = await page.$$eval('mat-select', els => 
            els.map(el => ({
              selector: `mat-select${el.id ? `#${el.id}` : ''}${el.className ? `.${el.className.split(' ').slice(0, 2).join('.')}` : ''}`,
              placeholder: el.getAttribute('placeholder'),
              name: el.getAttribute('name'),
              ariaDisabled: el.getAttribute('aria-disabled'),
              visible: el.offsetParent !== null,
              inModal: !!el.closest('mat-dialog-container, [role="dialog"]')
            }))
          );
          
          console.log('[SeletorManager] 🎯 Mat-select específicos encontrados:');
          matSelects.forEach((ms, i) => {
            console.log(`  ${i + 1}. ${ms.selector} - placeholder: "${ms.placeholder}" - visível: ${ms.visible} - habilitado: ${ms.ariaDisabled !== 'true'} - modal: ${ms.inModal}`);
          });
        } catch (e) {
          console.log('[SeletorManager] Erro ao analisar mat-select específicos:', e.message);
        }
      }
      
      return elementos;
    } catch (error) {
      console.log(`[SeletorManager] Erro ao listar elementos: ${error.message}`);
      return [];
    }
  }
}

// Seletores específicos para São José dos Campos - ATUALIZADO COM FIX BOTÃO ADICIONAR
const SAO_JOSE_CAMPOS_ESPECIFICOS = {
  // Seletores para busca de perito
  buscaPerito: {
    inputBusca: 'input[name="nomePerito"], input[id*="perito"], input[class*="perito"]',
    botaoBuscar: 'button[type="submit"], input[type="submit"], button:contains("Buscar")',
    resultados: '.resultado-busca, .lista-peritos, [class*="resultado"]',
    itemPerito: '.item-perito, .perito-item, tr[class*="perito"]'
  },
    
  // Seletores para vinculação - MELHORADOS
  vinculacao: {
    // Botão "Adicionar Órgão Julgador" - Seletores específicos para São José dos Campos
    botaoAdicionarOrgao: [
      'mat-expansion-panel[aria-expanded="true"] button:has-text("Adicionar")',
      'mat-expansion-panel-content button:has-text("Adicionar Órgão Julgador")',
      '#cdk-accordion-child-8 button:has-text("Adicionar")',
      'button[mat-button]:has-text("Adicionar")',
      '.mat-expansion-panel-content .mat-button:has-text("Adicionar")',
      'mat-expansion-panel-content button:has-text("Adicionar")',
      'div[class*="mat-expansion-panel-content"] button[class*="mat-button"]',
      'button[mat-raised-button]:has-text("Adicionar")',
      'button[mat-flat-button]:has-text("Adicionar")',
      '[id*="cdk-accordion"] button:has-text("Adicionar")',
      'mat-accordion mat-expansion-panel button:has-text("Adicionar")'
    ],
        
    // Painel de Órgãos Julgadores
    painelOrgaosJulgadores: [
      'mat-expansion-panel-header:has-text("Órgãos Julgadores")',
      'mat-expansion-panel:has(mat-expansion-panel-header:has-text("Órgãos Julgadores"))'
    ],
        
    // Outros seletores de vinculação
    botaoVincular: 'button:contains("Vincular"), input[value*="Vincular"], a:contains("Vincular")',
    botaoConfirmar: 'button:contains("Confirmar"), input[value*="Confirmar"], button[id*="confirmar"]',
    modalConfirmacao: '.modal, .dialog, [class*="confirmacao"]',
    mensagemSucesso: '.sucesso, .success, [class*="sucesso"]'
  },
    
  // Seletores para navegação
  navegacao: {
    menuPeritos: 'a:contains("Perito"), [href*="perito"], .menu-perito',
    submenuVincular: 'a:contains("Vincular"), [href*="vincular"]',
    breadcrumb: '.breadcrumb, .caminho, [class*="breadcrumb"]'
  },
    
  // Timeouts específicos (em ms) - AUMENTADOS
  timeouts: {
    buscaPerito: 15000,
    vinculacao: 20000,
    confirmacao: 10000,
    navegacao: 8000,
    botaoAdicionar: 10000,  // Novo timeout específico
    expansaoPainel: 5000     // Novo timeout para expansão
  },
    
  // Configurações específicas - MELHORADAS
  configuracao: {
    tentativasMaximas: 5,
    intervaloTentativas: 3000,
    aguardarCarregamento: 5000,
    processamentoSequencial: true,
        
    // Novas estratégias específicas
    estrategiasFallback: [
      'garantir_painel_expandido',
      'limpar_overlays_angular',
      'busca_javascript_avancada',
      'tentativas_multiplas'
    ],
        
    // Configuração específica para botão Adicionar
    botaoAdicionar: {
      tentativasMaximas: 3,
      timeoutPorTentativa: 3000,
      aguardarEntreTenatativas: 2000,
      verificarVisibilidade: true,
      expandirPainelAntes: true,
      limparOverlaysAntes: true
    }
  }
};


module.exports = SeletorManager;