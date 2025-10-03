/**
 * Sistema de Destaque Visual para OJs Cadastrados
 * Gerencia o rastreamento e destaque visual dos OJs recém-cadastrados
 */

class OJHighlightManager {
  constructor() {
    this.registeredOJs = [];
    this.highlightStyles = {
      border: '3px solid #4CAF50',
      backgroundColor: 'rgba(76, 175, 80, 0.1)',
      boxShadow: '0 0 10px rgba(76, 175, 80, 0.5)',
      position: 'relative'
    };
    this.badgeStyles = {
      position: 'absolute',
      top: '-8px',
      right: '-8px',
      backgroundColor: '#4CAF50',
      color: 'white',
      borderRadius: '50%',
      width: '20px',
      height: '20px',
      fontSize: '12px',
      fontWeight: 'bold',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '1000',
      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
    };
  }

  /**
   * Adiciona um OJ à lista de cadastrados
   * @param {string} ojName - Nome do OJ cadastrado
   */
  addRegisteredOJ(ojName) {
    const timestamp = new Date();
    const normalizedName = this.normalizeOJName(ojName);
    
    const ojData = {
      name: ojName,
      normalizedName: normalizedName,
      timestamp: timestamp,
      order: this.registeredOJs.length + 1
    };
    
    this.registeredOJs.push(ojData);
    console.log(`✅ OJ adicionado ao rastreamento: ${ojName}`);
    
    return ojData;
  }

  /**
   * Normaliza o nome do OJ para comparação
   * @param {string} name - Nome do OJ
   * @returns {string} Nome normalizado
   */
  normalizeOJName(name) {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^\w\s]/g, '') // Remove caracteres especiais
      .replace(/\s+/g, ' ') // Normaliza espaços
      .trim();
  }

  /**
   * Obtém lista ordenada dos OJs cadastrados
   * @param {string} orderBy - 'alphabetical' ou 'chronological'
   * @returns {Array} Lista ordenada de OJs
   */
  getOrderedOJs(orderBy = 'chronological') {
    const sortedOJs = [...this.registeredOJs];
    
    if (orderBy === 'alphabetical') {
      sortedOJs.sort((a, b) => a.normalizedName.localeCompare(b.normalizedName));
    } else {
      sortedOJs.sort((a, b) => a.timestamp - b.timestamp);
    }
    
    return sortedOJs;
  }

  /**
   * Aplica destaque visual aos OJs na página
   * @param {Object} page - Instância do Playwright page
   */
  async highlightRegisteredOJs(page) {
    console.log('🎨 Aplicando destaque visual aos OJs cadastrados...');
    
    if (this.registeredOJs.length === 0) {
      console.log('ℹ️ Nenhum OJ cadastrado para destacar');
      return;
    }

    try {
      // Injeta CSS para os estilos de destaque
      await this.injectHighlightStyles(page);
      
      // Busca e destaca cada OJ cadastrado
      for (const ojData of this.registeredOJs) {
        await this.highlightOJInDOM(page, ojData);
      }
      
      // Adiciona legenda explicativa
      await this.addHighlightLegend(page);
      
      console.log(`✨ ${this.registeredOJs.length} OJs destacados com sucesso!`);
      
    } catch (error) {
      console.error('❌ Erro ao aplicar destaque visual:', error);
    }
  }

  /**
   * Injeta estilos CSS na página
   * @param {Object} page - Instância do Playwright page
   */
  async injectHighlightStyles(page) {
    await page.addStyleTag({
      content: `
        .oj-highlight {
          border: ${this.highlightStyles.border} !important;
          background-color: ${this.highlightStyles.backgroundColor} !important;
          box-shadow: ${this.highlightStyles.boxShadow} !important;
          position: ${this.highlightStyles.position} !important;
          transition: all 0.3s ease !important;
        }
        
        .oj-highlight:hover {
          box-shadow: 0 0 15px rgba(76, 175, 80, 0.8) !important;
          transform: scale(1.02) !important;
        }
        
        .oj-badge {
          position: ${this.badgeStyles.position} !important;
          top: ${this.badgeStyles.top} !important;
          right: ${this.badgeStyles.right} !important;
          background-color: ${this.badgeStyles.backgroundColor} !important;
          color: ${this.badgeStyles.color} !important;
          border-radius: ${this.badgeStyles.borderRadius} !important;
          width: ${this.badgeStyles.width} !important;
          height: ${this.badgeStyles.height} !important;
          font-size: ${this.badgeStyles.fontSize} !important;
          font-weight: ${this.badgeStyles.fontWeight} !important;
          display: ${this.badgeStyles.display} !important;
          align-items: ${this.badgeStyles.alignItems} !important;
          justify-content: ${this.badgeStyles.justifyContent} !important;
          z-index: ${this.badgeStyles.zIndex} !important;
          box-shadow: ${this.badgeStyles.boxShadow} !important;
        }
        
        .oj-highlight-legend {
          position: fixed !important;
          top: 20px !important;
          right: 20px !important;
          background: linear-gradient(135deg, #4CAF50, #45a049) !important;
          color: white !important;
          padding: 15px 20px !important;
          border-radius: 10px !important;
          box-shadow: 0 4px 15px rgba(0,0,0,0.3) !important;
          z-index: 10000 !important;
          font-family: Arial, sans-serif !important;
          font-size: 14px !important;
          max-width: 300px !important;
          animation: slideInRight 0.5s ease-out !important;
        }
        
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .oj-highlight-legend h4 {
          margin: 0 0 10px 0 !important;
          font-size: 16px !important;
          font-weight: bold !important;
        }
        
        .oj-highlight-legend ul {
          margin: 0 !important;
          padding-left: 20px !important;
          list-style-type: disc !important;
        }
        
        .oj-highlight-legend li {
          margin: 5px 0 !important;
          font-size: 12px !important;
        }
      `
    });
  }

  /**
   * Destaca um OJ específico no DOM
   * @param {Object} page - Instância do Playwright page
   * @param {Object} ojData - Dados do OJ a ser destacado
   */
  async highlightOJInDOM(page, ojData) {
    const searchTerms = [
      ojData.name,
      ojData.normalizedName,
      ...ojData.name.split(' ').filter(word => word.length > 3)
    ];

    // Seletores onde os OJs podem aparecer
    const selectors = [
      'table tbody tr',
      '.mat-table .mat-row',
      '.mat-list-item',
      '.list-group-item',
      'ul li',
      'div[class*="orgao"]',
      'div[class*="julgador"]',
      'span[class*="orgao"]',
      'span[class*="julgador"]'
    ];

    for (const selector of selectors) {
      try {
        await page.evaluate(({ selector, searchTerms, ojData, highlightClass, badgeClass }) => {
          const elements = document.querySelectorAll(selector);
          
          elements.forEach((element, index) => {
            const text = element.textContent || element.innerText || '';
            const normalizedText = text.toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^\w\s]/g, '')
              .replace(/\s+/g, ' ')
              .trim();
            
            // Verifica se algum termo de busca está presente
            const found = searchTerms.some(term => {
              const normalizedTerm = term.toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^\w\s]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
              return normalizedText.includes(normalizedTerm);
            });
            
            if (found) {
              // Aplica classe de destaque
              element.classList.add(highlightClass);
              
              // Adiciona badge com número de ordem
              if (!element.querySelector(`.${badgeClass}`)) {
                const badge = document.createElement('div');
                badge.className = badgeClass;
                badge.textContent = ojData.order;
                badge.title = `OJ cadastrado em: ${ojData.timestamp.toLocaleString()}`;
                
                // Garante que o elemento pai tenha position relative
                const computedStyle = window.getComputedStyle(element);
                if (computedStyle.position === 'static') {
                  element.style.position = 'relative';
                }
                
                element.appendChild(badge);
              }
              
              console.log(`✨ OJ destacado: ${ojData.name}`);
            }
          });
        }, { 
          selector, 
          searchTerms, 
          ojData, 
          highlightClass: 'oj-highlight',
          badgeClass: 'oj-badge'
        });
        
      } catch (error) {
        console.warn(`⚠️ Erro ao processar seletor ${selector}:`, error.message);
      }
    }
  }

  /**
   * Adiciona legenda explicativa na página
   * @param {Object} page - Instância do Playwright page
   */
  async addHighlightLegend(page) {
    const chronologicalOrder = this.getOrderedOJs('chronological');
    const alphabeticalOrder = this.getOrderedOJs('alphabetical');
    
    await page.evaluate(({ chronologicalOrder, alphabeticalOrder }) => {
      // Remove legenda existente se houver
      const existingLegend = document.querySelector('.oj-highlight-legend');
      if (existingLegend) {
        existingLegend.remove();
      }
      
      // Cria nova legenda
      const legend = document.createElement('div');
      legend.className = 'oj-highlight-legend';
      
      legend.innerHTML = `
        <h4>🎯 OJs Recém-Cadastrados</h4>
        <p><strong>Total:</strong> ${chronologicalOrder.length} OJ(s)</p>
        
        <div style="margin-top: 10px;">
          <strong>📅 Ordem Cronológica:</strong>
          <ul>
            ${chronologicalOrder.map((oj, index) => 
              `<li>${index + 1}. ${oj.name}</li>`
            ).join('')}
          </ul>
        </div>
        
        <div style="margin-top: 10px;">
          <strong>🔤 Ordem Alfabética:</strong>
          <ul>
            ${alphabeticalOrder.map((oj, index) => 
              `<li>${String.fromCharCode(65 + index)}. ${oj.name}</li>`
            ).join('')}
          </ul>
        </div>
        
        <div style="margin-top: 10px; font-size: 11px; opacity: 0.8;">
          💡 Os números nos badges indicam a ordem de cadastro
        </div>
      `;
      
      document.body.appendChild(legend);
      
      // Auto-remove após 30 segundos
      setTimeout(() => {
        if (legend && legend.parentNode) {
          legend.style.animation = 'slideInRight 0.5s ease-out reverse';
          setTimeout(() => legend.remove(), 500);
        }
      }, 30000);
      
    }, { chronologicalOrder, alphabeticalOrder });
  }

  /**
   * Limpa todos os destaques da página
   * @param {Object} page - Instância do Playwright page
   */
  async clearHighlights(page) {
    await page.evaluate(() => {
      // Remove classes de destaque
      document.querySelectorAll('.oj-highlight').forEach(el => {
        el.classList.remove('oj-highlight');
      });
      
      // Remove badges
      document.querySelectorAll('.oj-badge').forEach(badge => {
        badge.remove();
      });
      
      // Remove legenda
      const legend = document.querySelector('.oj-highlight-legend');
      if (legend) {
        legend.remove();
      }
    });
    
    console.log('🧹 Destaques visuais removidos');
  }

  /**
   * Reseta o rastreamento de OJs
   */
  reset() {
    this.registeredOJs = [];
    console.log('🔄 Sistema de rastreamento resetado');
  }

  /**
   * Obtém estatísticas dos OJs cadastrados
   * @returns {Object} Estatísticas
   */
  getStats() {
    return {
      total: this.registeredOJs.length,
      firstRegistered: this.registeredOJs[0]?.timestamp || null,
      lastRegistered: this.registeredOJs[this.registeredOJs.length - 1]?.timestamp || null,
      ojs: this.registeredOJs.map(oj => ({
        name: oj.name,
        timestamp: oj.timestamp,
        order: oj.order
      }))
    };
  }
}

module.exports = { OJHighlightManager };