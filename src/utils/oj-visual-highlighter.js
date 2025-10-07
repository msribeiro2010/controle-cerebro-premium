/**
 * Sistema de Destaque Visual para OJs Recém-Cadastrados
 * Marca e reorganiza OJs processados na interface do PJE
 */

class OJVisualHighlighter {
  constructor(page, logger = console) {
    this.page = page;
    this.logger = logger;
    this.processedOJs = new Set();
    // Cores removidas - sem destaque amarelo
    // this.highlightColor = '#FFEB3B'; // DESATIVADO
    // this.recentHighlightColor = '#FFF59D'; // DESATIVADO
  }

  /**
   * Registra um OJ como processado
   */
  addProcessedOJ(ojName) {
    this.processedOJs.add(ojName);
    this.logger.log(`🎨 [VISUAL] OJ registrado para destaque: ${ojName}`);
  }

  /**
   * Reorganiza OJs por ordem cronológica (sem destaque amarelo)
   */
  async applyVisualHighlights() {
    try {
      this.logger.log('📋 [VISUAL] Organizando OJs por ordem cronológica...');

      // Apenas reorganizar lista por ordem de cadastro
      await this.organizeByChronologicalOrder();

      this.logger.log('✅ [VISUAL] OJs organizados cronologicamente');
      return true;

    } catch (error) {
      this.logger.error('❌ [VISUAL] Erro ao organizar OJs:', error);
      return false;
    }
  }

  /**
   * Injeta estilos CSS mínimos (sem cores de destaque)
   */
  async injectMinimalStyles() {
    try {
      await this.page.addStyleTag({
        content: `
          /* Estilo mínimo para organização */
          .oj-chronological-order {
            transition: all 0.3s ease;
          }

          /* Indicador de posição */
          .oj-order-indicator {
            font-size: 11px;
            color: #666;
            margin-left: 10px;
          }

          /* Separador visual sutil */
          .oj-separator {
            height: 1px;
            background: #e0e0e0;
            margin: 10px 0;
          }
        `
      });

      this.logger.log('✅ [VISUAL] Estilos mínimos aplicados');
    } catch (error) {
      this.logger.error('❌ [VISUAL] Erro ao injetar estilos:', error);
    }
  }

  // Método removido - não há mais destaque visual com cores

  /**
   * Organiza OJs por ordem cronológica de cadastro
   */
  async organizeByChronologicalOrder() {
    try {
      this.logger.log('📍 [VISUAL] Organizando OJs por ordem de cadastro...');

      // Executar script no contexto da página
      await this.page.evaluate((processedOJsList) => {
        // Função auxiliar para encontrar elementos contendo texto
        const findElementsWithText = (text) => {
          const xpath = `//*[contains(text(), "${text}")]`;
          const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          const elements = [];

          for (let i = 0; i < result.snapshotLength; i++) {
            elements.push(result.snapshotItem(i));
          }

          return elements;
        };

        // Procurar containers de lista
        const listContainers = [
          ...document.querySelectorAll('mat-list'),
          ...document.querySelectorAll('mat-selection-list'),
          ...document.querySelectorAll('.mat-list'),
          ...document.querySelectorAll('ul'),
          ...document.querySelectorAll('tbody'),
          ...document.querySelectorAll('[role="list"]')
        ];

        for (const container of listContainers) {
          const recentItems = [];
          const otherItems = [];

          // Separar itens recentes dos outros
          const items = container.children;
          for (let item of items) {
            let isRecent = false;

            // Verificar se item contém um OJ processado
            for (const ojName of processedOJsList) {
              if (item.textContent && item.textContent.includes(ojName)) {
                isRecent = true;
                // Apenas adicionar transição suave, sem cores
                item.style.transition = 'all 0.3s ease';

                // Adicionar indicador de ordem cronológica
                if (!item.querySelector('.order-indicator')) {
                  const orderIndicator = document.createElement('span');
                  orderIndicator.className = 'order-indicator';
                  const index = processedOJsList.indexOf(ojName) + 1;
                  orderIndicator.textContent = `(${index}º cadastrado)`;
                  orderIndicator.style.cssText = `
                    color: #666;
                    font-size: 11px;
                    margin-left: 10px;
                    font-style: italic;
                  `;
                  item.appendChild(orderIndicator);
                }
                break;
              }
            }

            if (isRecent) {
              recentItems.push(item.cloneNode(true));
            } else {
              otherItems.push(item.cloneNode(true));
            }
          }

          // Reorganizar se houver itens recentes
          if (recentItems.length > 0) {
            // Limpar container
            while (container.firstChild) {
              container.removeChild(container.firstChild);
            }

            // Adicionar itens recentes primeiro
            for (const item of recentItems) {
              container.appendChild(item);
            }

            // Adicionar separador visual sutil
            const separator = document.createElement('div');
            separator.className = 'oj-separator';
            separator.style.cssText = `
              height: 1px;
              background: #e0e0e0;
              margin: 10px 0;
            `;
            container.appendChild(separator);

            // Adicionar outros itens
            for (const item of otherItems) {
              container.appendChild(item);
            }

            console.log(`✅ Organizados: ${recentItems.length} OJs em ordem cronológica`);
          }
        }

        // Scroll suave opcional para o primeiro OJ da lista
        if (processedOJsList.length > 0) {
          const firstItem = document.querySelector('.order-indicator');
          if (firstItem && firstItem.parentElement) {
            firstItem.parentElement.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
              inline: 'nearest'
            });
          }
        }

      }, Array.from(this.processedOJs));

      this.logger.log('✅ [VISUAL] OJs organizados cronologicamente');
    } catch (error) {
      this.logger.error('❌ [VISUAL] Erro ao reorganizar OJs:', error);
    }
  }

  // Método removido - não há mais necessidade de remover destaques

  /**
   * Limpa indicadores de ordem
   */
  async clearOrderIndicators() {
    try {
      await this.page.evaluate(() => {
        // Remover indicadores de ordem
        const indicators = document.querySelectorAll('.order-indicator');
        indicators.forEach(indicator => indicator.remove());

        // Remover separadores
        const separators = document.querySelectorAll('.oj-separator');
        separators.forEach(separator => separator.remove());
      });

      this.processedOJs.clear();
      this.logger.log('🧹 [VISUAL] Indicadores de ordem removidos');
    } catch (error) {
      this.logger.error('❌ [VISUAL] Erro ao limpar indicadores:', error);
    }
  }
}

module.exports = OJVisualHighlighter;