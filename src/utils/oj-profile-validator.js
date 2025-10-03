/**
 * 🔍 VALIDADOR INTELIGENTE DE PERFIS DE OJ
 * 
 * Sistema avançado para verificar OJs já cadastrados no perfil do servidor
 * e identificar quando é necessário adicionar novos papéis ao mesmo OJ.
 * 
 * Funcionalidades:
 * - Extração de OJs existentes do painel do servidor
 * - Comparação inteligente de papéis por OJ
 * - Detecção de necessidade de novos papéis
 * - Cache de perfis para otimização
 * - Relatórios detalhados de status
 */

class OJProfileValidator {
  constructor() {
    this.existingProfiles = new Map(); // Cache de perfis existentes
    this.ojPapelMap = new Map(); // Mapa OJ -> Papéis existentes
    this.lastScanTime = null;
    this.scanResults = {
      totalOJs: 0,
      uniqueOJs: 0,
      duplicateRoles: 0,
      missingRoles: []
    };
  }

  /**
     * 🔍 EXTRAI PERFIS EXISTENTES DO PAINEL DO SERVIDOR
     * Navega até a seção "Localizações/Visibilidades ATIVAS do Servidor"
     * e extrai todos os OJs com seus respectivos papéis
     */
  async extractExistingProfiles(page, servidorNome) {
    try {
      console.log(`🔍 [VALIDATOR] Extraindo perfis existentes para: ${servidorNome}`);
            
      // Navegar para a página de cadastro do servidor
      await this.navigateToServerProfile(page, servidorNome);
            
      // Aguardar carregamento da seção de localizações
      await page.waitForSelector('table', { timeout: 10000 });
            
      // Extrair dados da tabela de localizações
      const profiles = await page.evaluate(() => {
        const rows = document.querySelectorAll('table tr');
        const extractedProfiles = [];
                
        for (let i = 1; i < rows.length; i++) { // Pular cabeçalho
          const cells = rows[i].querySelectorAll('td');
          if (cells.length >= 6) {
            const profile = {
              orgaoJulgador: cells[0]?.textContent?.trim() || '',
              papel: cells[1]?.textContent?.trim() || '',
              localizacao: cells[2]?.textContent?.trim() || '',
              visibilidade: cells[3]?.textContent?.trim() || '',
              dataInicial: cells[4]?.textContent?.trim() || '',
              dataFinal: cells[5]?.textContent?.trim() || ''
            };
                        
            if (profile.orgaoJulgador && profile.papel) {
              extractedProfiles.push(profile);
            }
          }
        }
                
        return extractedProfiles;
      });
            
      // Processar e organizar os perfis extraídos
      this.processExtractedProfiles(profiles, servidorNome);
            
      console.log(`✅ [VALIDATOR] Extraídos ${profiles.length} perfis para ${servidorNome}`);
      return profiles;
            
    } catch (error) {
      console.error(`❌ [VALIDATOR] Erro ao extrair perfis: ${error.message}`);
      throw error;
    }
  }

  /**
     * 🧭 NAVEGA PARA O PERFIL DO SERVIDOR
     */
  async navigateToServerProfile(page, servidorNome) {
    try {
      // Buscar pelo servidor na lista
      await page.fill('input[type="text"]', servidorNome);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
            
      // Clicar no link do servidor
      const serverLink = await page.locator(`text=${servidorNome}`).first();
      if (await serverLink.isVisible()) {
        await serverLink.click();
        await page.waitForLoadState('networkidle');
      } else {
        throw new Error(`Servidor ${servidorNome} não encontrado`);
      }
            
    } catch (error) {
      console.error(`❌ [VALIDATOR] Erro ao navegar para perfil: ${error.message}`);
      throw error;
    }
  }

  /**
     * 📊 PROCESSA E ORGANIZA OS PERFIS EXTRAÍDOS
     */
  processExtractedProfiles(profiles, servidorNome) {
    this.existingProfiles.set(servidorNome, profiles);
    this.ojPapelMap.clear();
        
    // Organizar por OJ e papéis
    profiles.forEach(profile => {
      const oj = profile.orgaoJulgador;
      if (!this.ojPapelMap.has(oj)) {
        this.ojPapelMap.set(oj, new Set());
      }
      this.ojPapelMap.get(oj).add(profile.papel);
    });
        
    // Atualizar estatísticas
    this.scanResults = {
      totalOJs: profiles.length,
      uniqueOJs: this.ojPapelMap.size,
      duplicateRoles: profiles.length - this.ojPapelMap.size,
      lastScan: new Date().toISOString()
    };
        
    this.lastScanTime = Date.now();
  }

  /**
     * ✅ VERIFICA SE UM OJ JÁ POSSUI UM PAPEL ESPECÍFICO
     */
  hasOJWithRole(orgaoJulgador, papel) {
    const normalizedOJ = this.normalizeOJName(orgaoJulgador);
        
    for (const [existingOJ, roles] of this.ojPapelMap.entries()) {
      if (this.normalizeOJName(existingOJ) === normalizedOJ) {
        return roles.has(papel);
      }
    }
        
    return false;
  }

  /**
     * 🔍 VERIFICA SE UM OJ EXISTE (INDEPENDENTE DO PAPEL)
     */
  hasOJ(orgaoJulgador) {
    const normalizedOJ = this.normalizeOJName(orgaoJulgador);
        
    for (const existingOJ of this.ojPapelMap.keys()) {
      if (this.normalizeOJName(existingOJ) === normalizedOJ) {
        return true;
      }
    }
        
    return false;
  }

  /**
     * 📋 OBTÉM TODOS OS PAPÉIS DE UM OJ
     */
  getOJRoles(orgaoJulgador) {
    const normalizedOJ = this.normalizeOJName(orgaoJulgador);
        
    for (const [existingOJ, roles] of this.ojPapelMap.entries()) {
      if (this.normalizeOJName(existingOJ) === normalizedOJ) {
        return Array.from(roles);
      }
    }
        
    return [];
  }

  /**
     * 🎯 DETERMINA A AÇÃO NECESSÁRIA PARA UM OJ/PAPEL
     */
  determineAction(orgaoJulgador, papelDesejado) {
    const hasOJ = this.hasOJ(orgaoJulgador);
    const hasRole = this.hasOJWithRole(orgaoJulgador, papelDesejado);
    const existingRoles = this.getOJRoles(orgaoJulgador);
        
    if (!hasOJ) {
      return {
        action: 'CREATE_NEW',
        reason: 'OJ não existe no perfil',
        needsProcessing: true,
        existingRoles: []
      };
    }
        
    if (hasRole) {
      return {
        action: 'SKIP_EXISTS',
        reason: `OJ já possui o papel '${papelDesejado}'`,
        needsProcessing: false,
        existingRoles
      };
    }
        
    return {
      action: 'ADD_ROLE',
      reason: `OJ existe mas precisa do papel '${papelDesejado}'`,
      needsProcessing: true,
      existingRoles
    };
  }

  /**
     * 📊 ANALISA UMA LISTA DE OJs PARA PROCESSAMENTO
     */
  analyzeOJList(ojList) {
    const analysis = {
      toCreate: [],
      toAddRole: [],
      toSkip: [],
      summary: {
        total: ojList.length,
        needsProcessing: 0,
        canSkip: 0
      }
    };
        
    ojList.forEach(oj => {
      const action = this.determineAction(oj.nome, oj.papel);
            
      const ojWithAction = {
        ...oj,
        action: action.action,
        reason: action.reason,
        existingRoles: action.existingRoles
      };
            
      switch (action.action) {
      case 'CREATE_NEW':
        analysis.toCreate.push(ojWithAction);
        analysis.summary.needsProcessing++;
        break;
      case 'ADD_ROLE':
        analysis.toAddRole.push(ojWithAction);
        analysis.summary.needsProcessing++;
        break;
      case 'SKIP_EXISTS':
        analysis.toSkip.push(ojWithAction);
        analysis.summary.canSkip++;
        break;
      }
    });
        
    return analysis;
  }

  /**
     * 🔧 NORMALIZA NOME DO OJ PARA COMPARAÇÃO
     */
  normalizeOJName(ojName) {
    // Validação de tipo para evitar erros
    let ojTexto;
    if (typeof ojName === 'string') {
      ojTexto = ojName;
    } else if (ojName && typeof ojName === 'object' && ojName.nome) {
      ojTexto = ojName.nome;
    } else {
      ojTexto = String(ojName || '');
    }
        
    return ojTexto
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9\s]/g, '');
  }

  /**
     * 📈 GERA RELATÓRIO DETALHADO
     */
  generateReport(analysis) {
    const report = {
      timestamp: new Date().toISOString(),
      scanResults: this.scanResults,
      analysis,
      recommendations: this.generateRecommendations(analysis),
      performance: {
        estimatedTimeReduction: this.calculateTimeReduction(analysis),
        processingEfficiency: this.calculateEfficiency(analysis)
      }
    };
        
    return report;
  }

  /**
     * 💡 GERA RECOMENDAÇÕES BASEADAS NA ANÁLISE
     */
  generateRecommendations(analysis) {
    const recommendations = [];
        
    if (analysis.toSkip.length > 0) {
      recommendations.push({
        type: 'OPTIMIZATION',
        message: `${analysis.toSkip.length} OJs podem ser pulados, economizando tempo significativo`,
        impact: 'HIGH'
      });
    }
        
    if (analysis.toAddRole.length > 0) {
      recommendations.push({
        type: 'ATTENTION',
        message: `${analysis.toAddRole.length} OJs precisam de papéis adicionais - verificar se é necessário`,
        impact: 'MEDIUM'
      });
    }
        
    if (analysis.summary.canSkip / analysis.summary.total > 0.5) {
      recommendations.push({
        type: 'SUCCESS',
        message: 'Mais de 50% dos OJs já estão configurados corretamente',
        impact: 'POSITIVE'
      });
    }
        
    return recommendations;
  }

  /**
     * ⏱️ CALCULA REDUÇÃO DE TEMPO ESTIMADA
     */
  calculateTimeReduction(analysis) {
    const avgTimePerOJ = 30; // segundos
    const savedTime = analysis.summary.canSkip * avgTimePerOJ;
    const totalTime = analysis.summary.total * avgTimePerOJ;
        
    return {
      savedSeconds: savedTime,
      totalSeconds: totalTime,
      reductionPercentage: Math.round((savedTime / totalTime) * 100)
    };
  }

  /**
     * 📊 CALCULA EFICIÊNCIA DO PROCESSAMENTO
     */
  calculateEfficiency(analysis) {
    return {
      skipRate: Math.round((analysis.summary.canSkip / analysis.summary.total) * 100),
      processRate: Math.round((analysis.summary.needsProcessing / analysis.summary.total) * 100),
      duplicateRoleRate: Math.round((analysis.toAddRole.length / analysis.summary.total) * 100)
    };
  }

  /**
     * 🧹 LIMPA CACHE E REINICIA
     */
  clearCache() {
    this.existingProfiles.clear();
    this.ojPapelMap.clear();
    this.lastScanTime = null;
    this.scanResults = {
      totalOJs: 0,
      uniqueOJs: 0,
      duplicateRoles: 0,
      missingRoles: []
    };
  }

  /**
     * 📊 OBTÉM ESTATÍSTICAS ATUAIS
     */
  getStats() {
    return {
      ...this.scanResults,
      cacheSize: this.existingProfiles.size,
      ojCount: this.ojPapelMap.size,
      lastScanAge: this.lastScanTime ? Date.now() - this.lastScanTime : null
    };
  }

  /**
     * Verifica se um OJ precisa de um perfil adicional
     * @param {Array} existingRoles - Perfis já existentes
     * @param {string} requiredRole - Perfil necessário
     * @returns {boolean} True se precisa adicionar o perfil
     */
  needsAdditionalRole(existingRoles, requiredRole) {
    if (!existingRoles || !Array.isArray(existingRoles)) {
      return true;
    }
        
    // Normalizar nomes dos perfis para comparação
    const normalizedExisting = existingRoles.map(role => this.normalizeRoleName(role));
    const normalizedRequired = this.normalizeRoleName(requiredRole);
        
    return !normalizedExisting.includes(normalizedRequired);
  }

  /**
     * 🔧 NORMALIZA NOME DO PAPEL PARA COMPARAÇÃO
     */
  normalizeRoleName(roleName) {
    // Validação de tipo para evitar erros
    let roleTexto;
    if (typeof roleName === 'string') {
      roleTexto = roleName;
    } else if (roleName && typeof roleName === 'object' && roleName.nome) {
      roleTexto = roleName.nome;
    } else {
      roleTexto = String(roleName || '');
    }
        
    return roleTexto
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9\s]/g, '');
  }
}

module.exports = OJProfileValidator;