/**
 * Módulo para leitura e análise de páginas do PJE
 * Extrai informações de OJs já cadastrados para otimizar a automação
 */

class PJEPageReader {
  constructor(page) {
    this.page = page;
    this.cache = new Map(); // Cache de OJs por CPF
  }

  /**
   * Extrai todos os OJs já cadastrados para um servidor na página atual
   * @returns {Promise<Object>} Lista de OJs encontrados e metadados
   */
  async extractExistingOJs() {
    console.log('🔍 Extraindo OJs já cadastrados da página...');
    
    try {
      // Aguardar a página carregar completamente
      await this.page.waitForLoadState('networkidle');
      
      // Múltiplos seletores para diferentes layouts do PJE
      const possibleSelectors = [
        // Tabela de vínculos de OJs
        'table[id*="vinculo"] tbody tr',
        'table[id*="orgao"] tbody tr',
        'table[id*="julgador"] tbody tr',
        
        // Divs com dados de vínculo
        'div[id*="vinculo"]',
        'div[id*="orgao"]',
        
        // Lista de perfis/cargos
        '.perfil-container',
        '.cargo-container',
        
        // Formulários de edição
        'form[id*="edit"] table tbody tr',
        
        // Seções de dados
        '[data-role="vinculo"]',
        '[data-type="orgao-julgador"]'
      ];

      const extractedData = await this.page.evaluate((selectors) => {
        const results = {
          ojs: [],
          perfis: [],
          metadata: {
            timestamp: new Date().toISOString(),
            url: window.location.href,
            pageTitle: document.title
          }
        };

        // Função auxiliar para normalizar texto
        const normalizeText = (text) => {
          return text ? text.trim().replace(/\s+/g, ' ') : '';
        };

        // Tentar cada seletor
        for (const selector of selectors) {
          try {
            const elements = document.querySelectorAll(selector);
            
            if (elements.length > 0) {
              console.log(`📋 Encontrado ${elements.length} elementos com seletor: ${selector}`);
              
              elements.forEach((element, index) => {
                const text = normalizeText(element.textContent);
                
                // Verificar se contém nome de OJ (heurísticas)
                if (this.isOJText(text)) {
                  results.ojs.push({
                    text,
                    selector,
                    index,
                    element: element.outerHTML.substring(0, 200) + '...'
                  });
                }
                
                // Verificar se contém perfil/cargo
                if (this.isPerfilText(text)) {
                  results.perfis.push({
                    text,
                    selector,
                    index
                  });
                }
              });
            }
          } catch (error) {
            console.warn(`⚠️ Erro ao processar seletor ${selector}:`, error.message);
          }
        }

        return results;
      }, possibleSelectors);

      // Processar e filtrar resultados
      const processedData = await this.processExtractedData(extractedData);
      
      console.log(`✅ Encontrados ${processedData.ojs.length} OJs já cadastrados`);
      console.log(`📊 Encontrados ${processedData.perfis.length} perfis/cargos`);
      
      return processedData;
      
    } catch (error) {
      console.error('❌ Erro ao extrair dados da página:', error);
      return {
        ojs: [],
        perfis: [],
        metadata: { error: error.message }
      };
    }
  }

  /**
   * Processa e filtra dados extraídos
   */
  async processExtractedData(rawData) {
    // Filtrar e normalizar OJs
    const uniqueOJs = [...new Set(rawData.ojs.map(oj => oj.text))]
      .filter(oj => oj.length > 10) // Filtrar textos muito curtos
      .map(oj => this.normalizeOJName(oj));

    // Filtrar perfis
    const uniquePerfis = [...new Set(rawData.perfis.map(p => p.text))]
      .filter(perfil => this.isValidPerfil(perfil));

    return {
      ...rawData,
      ojs: uniqueOJs,
      perfis: uniquePerfis,
      processedAt: new Date().toISOString()
    };
  }

  /**
   * Verifica se o texto parece ser um nome de OJ
   */
  isOJText(text) {
    const ojKeywords = [
      'vara', 'juizado', 'tribunal', 'cejusc', 'centro',
      'exe1', 'exe2', 'liq1', 'liq2', 'con1', 'con2',
      'dam', 'divex', 'centralizador'
    ];
    
    const lowerText = text.toLowerCase();
    
    // Deve conter pelo menos uma palavra-chave
    const hasKeyword = ojKeywords.some(keyword => lowerText.includes(keyword));
    
    // Deve ter tamanho mínimo
    const hasMinLength = text.length >= 10;
    
    // Não deve ser apenas números ou códigos
    const notOnlyCode = !/^\d+$/.test(text.trim());
    
    return hasKeyword && hasMinLength && notOnlyCode;
  }

  /**
   * Verifica se o texto parece ser um perfil/cargo
   */
  isPerfilText(text) {
    const perfilKeywords = [
      'assessor', 'secretário', 'servidor', 'auxiliar',
      'analista', 'técnico', 'perito', 'oficial'
    ];
    
    const lowerText = text.toLowerCase();
    return perfilKeywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Valida se é um perfil válido
   */
  isValidPerfil(perfil) {
    return perfil && perfil.length >= 5 && perfil.length <= 100;
  }

  /**
   * Normaliza nome de OJ usando o sistema existente
   */
  normalizeOJName(ojText) {
    // Esta função será integrada com o sistema de normalização existente
    return ojText.trim();
  }

  /**
   * Compara lista de OJs desejados com os já cadastrados
   */
  async compareOJs(desiredOJs, existingOJs = null) {
    if (!existingOJs) {
      const pageData = await this.extractExistingOJs();
      existingOJs = pageData.ojs;
    }

    const missing = [];
    const existing = [];
    
    for (const desiredOJ of desiredOJs) {
      const isFound = existingOJs.some(existingOJ => 
        this.areOJsSimilar(desiredOJ, existingOJ)
      );
      
      if (isFound) {
        existing.push(desiredOJ);
      } else {
        missing.push(desiredOJ);
      }
    }

    return {
      total: desiredOJs.length,
      existing,
      missing,
      existingCount: existing.length,
      missingCount: missing.length,
      completionPercentage: Math.round((existing.length / desiredOJs.length) * 100)
    };
  }

  /**
   * Verifica se dois OJs são similares (fuzzy matching)
   */
  areOJsSimilar(oj1, oj2, threshold = 0.8) {
    const clean1 = oj1.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const clean2 = oj2.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Correspondência exata
    if (clean1 === clean2) return true;
    
    // Correspondência por palavras-chave
    const words1 = clean1.split(' ').filter(w => w.length > 2);
    const words2 = clean2.split(' ').filter(w => w.length > 2);
    
    let matches = 0;
    for (const word1 of words1) {
      if (words2.some(word2 => 
        word1.includes(word2) || word2.includes(word1) || 
        this.levenshteinDistance(word1, word2) <= 2
      )) {
        matches++;
      }
    }
    
    const similarity = matches / Math.max(words1.length, words2.length);
    return similarity >= threshold;
  }

  /**
   * Calcula distância de Levenshtein para fuzzy matching
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Gera relatório detalhado de comparação
   */
  generateComparisonReport(comparisonResult, cpf) {
    const report = {
      cpf,
      timestamp: new Date().toISOString(),
      summary: {
        total: comparisonResult.total,
        existing: comparisonResult.existingCount,
        missing: comparisonResult.missingCount,
        completion: `${comparisonResult.completionPercentage}%`
      },
      details: {
        existingOJs: comparisonResult.existing,
        missingOJs: comparisonResult.missing
      },
      recommendations: this.generateRecommendations(comparisonResult)
    };

    return report;
  }

  /**
   * Gera recomendações baseadas na análise
   */
  generateRecommendations(comparisonResult) {
    const recommendations = [];
    
    if (comparisonResult.missingCount === 0) {
      recommendations.push({
        type: 'skip',
        message: 'Todos os OJs já estão cadastrados. Pular este servidor.',
        priority: 'high'
      });
    } else if (comparisonResult.missingCount < 3) {
      recommendations.push({
        type: 'optimize',
        message: `Apenas ${comparisonResult.missingCount} OJs faltando. Automação rápida.`,
        priority: 'medium'
      });
    } else {
      recommendations.push({
        type: 'process',
        message: `${comparisonResult.missingCount} OJs para cadastrar. Processamento normal.`,
        priority: 'low'
      });
    }

    return recommendations;
  }

  /**
   * Salva dados no cache para evitar re-verificações
   */
  setCacheData(cpf, data) {
    this.cache.set(cpf, {
      ...data,
      cachedAt: new Date().toISOString()
    });
  }

  /**
   * Recupera dados do cache
   */
  getCacheData(cpf, maxAgeMinutes = 30) {
    const cached = this.cache.get(cpf);
    if (!cached) return null;
    
    const cacheAge = (new Date() - new Date(cached.cachedAt)) / (1000 * 60);
    if (cacheAge > maxAgeMinutes) {
      this.cache.delete(cpf);
      return null;
    }
    
    return cached;
  }
}

module.exports = PJEPageReader;