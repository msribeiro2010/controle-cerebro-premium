/**
 * 🚀 INTEGRAÇÃO INTELIGENTE DE OJs
 * 
 * Sistema avançado que integra o validador de perfis com o processo
 * de vinculação para otimizar o cadastro de OJs, evitando duplicações
 * e identificando necessidades de novos papéis.
 */

const OJProfileValidator = require('./oj-profile-validator');
const fs = require('fs').promises;
const path = require('path');

class SmartOJIntegration {
  constructor() {
    this.validator = new OJProfileValidator();
    this.processedServers = new Map();
    this.integrationStats = {
      totalServers: 0,
      totalOJs: 0,
      skippedOJs: 0,
      newOJs: 0,
      addedRoles: 0,
      errors: 0,
      timesSaved: 0
    };
    this.reportPath = path.join(__dirname, '../../reports');
  }

  /**
     * 🎯 PROCESSA UM SERVIDOR COM VALIDAÇÃO INTELIGENTE
     */
  async processServerWithValidation(page, servidor, ojsToProcess) {
    try {
      console.log(`\n🔍 [SMART-OJ] Iniciando processamento inteligente para: ${servidor.nome}`);
            
      // 1. Extrair perfis existentes do servidor
      const startTime = Date.now();
      await this.validator.extractExistingProfiles(page, servidor.nome);
            
      // 2. Analisar lista de OJs a processar
      const analysis = this.validator.analyzeOJList(ojsToProcess);
            
      // 3. Gerar relatório de análise
      const report = this.validator.generateReport(analysis);
            
      // 4. Exibir resumo da análise
      this.displayAnalysisSummary(servidor.nome, analysis, report);
            
      // 5. Processar apenas OJs que precisam de ação
      const processedResults = await this.processFilteredOJs(page, servidor, analysis);
            
      // 6. Atualizar estatísticas
      this.updateIntegrationStats(analysis, processedResults, Date.now() - startTime);
            
      // 7. Salvar relatório detalhado
      await this.saveDetailedReport(servidor.nome, report, processedResults);
            
      return {
        success: true,
        analysis,
        processedResults,
        report,
        timeSaved: report.performance.estimatedTimeReduction.savedSeconds
      };
            
    } catch (error) {
      console.error(`❌ [SMART-OJ] Erro no processamento inteligente: ${error.message}`);
      this.integrationStats.errors++;
      return {
        success: false,
        error: error.message,
        analysis: null
      };
    }
  }

  /**
     * 📊 EXIBE RESUMO DA ANÁLISE
     */
  displayAnalysisSummary(servidorNome, analysis, report) {
    console.log(`\n📊 [ANÁLISE] Resumo para ${servidorNome}:`);
    console.log(`   📈 Total de OJs: ${analysis.summary.total}`);
    console.log(`   ✅ Podem ser pulados: ${analysis.summary.canSkip} (${Math.round((analysis.summary.canSkip/analysis.summary.total)*100)}%)`);
    console.log(`   🆕 Novos OJs: ${analysis.toCreate.length}`);
    console.log(`   ➕ Adicionar papéis: ${analysis.toAddRole.length}`);
    console.log(`   ⏱️  Tempo economizado: ${report.performance.estimatedTimeReduction.savedSeconds}s (${report.performance.estimatedTimeReduction.reductionPercentage}%)`);
        
    // Exibir OJs que serão pulados
    if (analysis.toSkip.length > 0) {
      console.log('\n⏭️  [PULAR] OJs já configurados:');
      analysis.toSkip.forEach((oj, index) => {
        if (index < 5) { // Mostrar apenas os primeiros 5
          console.log(`   • ${oj.nome} (${oj.papel}) - ${oj.reason}`);
        }
      });
      if (analysis.toSkip.length > 5) {
        console.log(`   ... e mais ${analysis.toSkip.length - 5} OJs`);
      }
    }
        
    // Exibir OJs que precisam de novos papéis
    if (analysis.toAddRole.length > 0) {
      console.log('\n➕ [ADICIONAR PAPEL] OJs que precisam de novos papéis:');
      analysis.toAddRole.forEach(oj => {
        console.log(`   • ${oj.nome} - Adicionar '${oj.papel}' (já tem: ${oj.existingRoles.join(', ')})`);
      });
    }
  }

  /**
     * ⚡ PROCESSA APENAS OJs FILTRADOS
     */
  async processFilteredOJs(page, servidor, analysis) {
    const results = {
      created: [],
      rolesAdded: [],
      skipped: analysis.toSkip.length,
      errors: []
    };
        
    try {
      // Processar novos OJs
      if (analysis.toCreate.length > 0) {
        console.log(`\n🆕 [CRIAR] Processando ${analysis.toCreate.length} novos OJs...`);
        for (const oj of analysis.toCreate) {
          try {
            const result = await this.createNewOJ(page, servidor, oj);
            if (result.success) {
              results.created.push(oj);
              console.log(`   ✅ Criado: ${oj.nome} (${oj.papel})`);
            } else {
              results.errors.push({ oj, error: result.error });
              console.log(`   ❌ Erro: ${oj.nome} - ${result.error}`);
            }
          } catch (error) {
            results.errors.push({ oj, error: error.message });
            console.log(`   ❌ Erro: ${oj.nome} - ${error.message}`);
          }
        }
      }
            
      // Processar adição de papéis
      if (analysis.toAddRole.length > 0) {
        console.log(`\n➕ [ADICIONAR] Processando ${analysis.toAddRole.length} papéis adicionais...`);
        for (const oj of analysis.toAddRole) {
          try {
            const result = await this.addRoleToExistingOJ(page, servidor, oj);
            if (result.success) {
              results.rolesAdded.push(oj);
              console.log(`   ✅ Papel adicionado: ${oj.nome} (${oj.papel})`);
            } else {
              results.errors.push({ oj, error: result.error });
              console.log(`   ❌ Erro: ${oj.nome} - ${result.error}`);
            }
          } catch (error) {
            results.errors.push({ oj, error: error.message });
            console.log(`   ❌ Erro: ${oj.nome} - ${error.message}`);
          }
        }
      }
            
    } catch (error) {
      console.error(`❌ [SMART-OJ] Erro no processamento filtrado: ${error.message}`);
    }
        
    return results;
  }

  /**
     * 🆕 CRIA NOVO OJ
     */
  async createNewOJ(page, servidor, oj) {
    try {
      console.log(`🆕 [CRIAR] Criando novo OJ: ${oj.nome} com papel ${oj.papel}`);
            
      if (!page || !page.evaluate) {
        // Modo de teste - simular criação
        await new Promise(resolve => setTimeout(resolve, 1000));
        return {
          success: true,
          message: `OJ ${oj.nome} criado com sucesso (modo teste)`
        };
      }
            
      // Navegar para página de criação de OJ
      await page.click('[data-action="create-oj"], .btn-create-oj, #create-oj');
      await page.waitForSelector('.oj-form, #oj-form', { timeout: 5000 });
            
      // Preencher dados do OJ
      await page.fill('input[name="nome"], #oj-nome', oj.nome);
            
      if (oj.cpf) {
        await page.fill('input[name="cpf"], #oj-cpf', oj.cpf);
      }
            
      // Selecionar papel/perfil
      if (oj.papel) {
        await page.selectOption('select[name="papel"], #oj-papel', oj.papel);
      }
            
      // Submeter formulário
      await page.click('button[type="submit"], .btn-submit, #submit-oj');
            
      // Aguardar confirmação
      await page.waitForSelector('.success-message, .alert-success', { timeout: 10000 });
            
      return {
        success: true,
        message: `OJ ${oj.nome} criado com sucesso`
      };
            
    } catch (error) {
      console.error(`❌ [CRIAR] Erro ao criar OJ ${oj.nome}: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
     * ➕ ADICIONA PAPEL A OJ EXISTENTE
     */
  async addRoleToExistingOJ(page, servidor, oj) {
    try {
      console.log(`➕ [ADICIONAR] Adicionando papel ${oj.papel} ao OJ existente: ${oj.nome}`);
            
      if (!page || !page.evaluate) {
        // Modo de teste - simular adição
        await new Promise(resolve => setTimeout(resolve, 800));
        return {
          success: true,
          message: `Papel ${oj.papel} adicionado ao OJ ${oj.nome} (modo teste)`
        };
      }
            
      // Localizar OJ existente na lista
      const ojSelector = `[data-oj-nome="${oj.nome}"], .oj-item:has-text("${oj.nome}")`;
      await page.waitForSelector(ojSelector, { timeout: 5000 });
            
      // Clicar em editar/adicionar papel
      await page.click(`${ojSelector} .btn-edit, ${ojSelector} .edit-roles`);
            
      // Aguardar modal ou formulário de edição
      await page.waitForSelector('.role-form, .edit-oj-modal', { timeout: 5000 });
            
      // Adicionar novo papel
      await page.click('.add-role-btn, #add-role');
      await page.selectOption('select[name="new-role"], #new-role-select', oj.papel);
            
      // Salvar alterações
      await page.click('.save-roles, .btn-save-roles');
            
      // Aguardar confirmação
      await page.waitForSelector('.success-message, .alert-success', { timeout: 10000 });
            
      return {
        success: true,
        message: `Papel ${oj.papel} adicionado ao OJ ${oj.nome}`
      };
            
    } catch (error) {
      console.error(`❌ [ADICIONAR] Erro ao adicionar papel para ${oj.nome}: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
     * 📊 ATUALIZA ESTATÍSTICAS DE INTEGRAÇÃO
     */
  updateIntegrationStats(analysis, results, processingTime) {
    this.integrationStats.totalServers++;
    this.integrationStats.totalOJs += analysis.summary.total;
    this.integrationStats.skippedOJs += analysis.summary.canSkip;
    this.integrationStats.newOJs += results.created.length;
    this.integrationStats.addedRoles += results.rolesAdded.length;
    this.integrationStats.errors += results.errors.length;
    this.integrationStats.timesSaved += processingTime;
  }

  /**
     * 💾 SALVA RELATÓRIO DETALHADO
     */
  async saveDetailedReport(servidorNome, report, processedResults) {
    try {
      // Criar diretório de relatórios se não existir
      await fs.mkdir(this.reportPath, { recursive: true });
            
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `smart-oj-report-${servidorNome.replace(/\s+/g, '-')}-${timestamp}.json`;
      const filepath = path.join(this.reportPath, filename);
            
      const detailedReport = {
        servidor: servidorNome,
        timestamp: new Date().toISOString(),
        validationReport: report,
        processedResults,
        integrationStats: { ...this.integrationStats }
      };
            
      await fs.writeFile(filepath, JSON.stringify(detailedReport, null, 2));
      console.log(`📄 [RELATÓRIO] Salvo em: ${filepath}`);
            
    } catch (error) {
      console.error(`❌ [RELATÓRIO] Erro ao salvar: ${error.message}`);
    }
  }

  /**
     * 🔄 PROCESSA MÚLTIPLOS SERVIDORES
     */
  async processMultipleServers(page, servidores, ojsPerServer) {
    const results = [];
        
    console.log(`\n🚀 [SMART-OJ] Iniciando processamento de ${servidores.length} servidores...`);
        
    for (let i = 0; i < servidores.length; i++) {
      const servidor = servidores[i];
      const ojs = ojsPerServer[servidor.nome] || [];
            
      console.log(`\n📋 [${i + 1}/${servidores.length}] Processando: ${servidor.nome}`);
            
      const result = await this.processServerWithValidation(page, servidor, ojs);
      results.push({
        servidor: servidor.nome,
        ...result
      });
            
      // Pequena pausa entre servidores
      if (i < servidores.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
        
    // Gerar relatório final
    await this.generateFinalReport(results);
        
    return results;
  }

  /**
     * 📈 GERA RELATÓRIO FINAL CONSOLIDADO
     */
  async generateFinalReport(results) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `smart-oj-final-report-${timestamp}.json`;
      const filepath = path.join(this.reportPath, filename);
            
      const finalReport = {
        timestamp: new Date().toISOString(),
        summary: {
          totalServers: results.length,
          successfulServers: results.filter(r => r.success).length,
          failedServers: results.filter(r => !r.success).length,
          totalTimeSaved: results.reduce((sum, r) => sum + (r.timeSaved || 0), 0)
        },
        integrationStats: { ...this.integrationStats },
        detailedResults: results,
        recommendations: this.generateFinalRecommendations(results)
      };
            
      await fs.writeFile(filepath, JSON.stringify(finalReport, null, 2));
            
      // Exibir resumo no console
      this.displayFinalSummary(finalReport);
            
      console.log(`\n📄 [RELATÓRIO FINAL] Salvo em: ${filepath}`);
            
    } catch (error) {
      console.error(`❌ [RELATÓRIO FINAL] Erro ao gerar: ${error.message}`);
    }
  }

  /**
     * 📊 EXIBE RESUMO FINAL
     */
  displayFinalSummary(report) {
    console.log('\n🎉 [RESUMO FINAL] Processamento Inteligente Concluído!');
    console.log(`   📈 Servidores processados: ${report.summary.totalServers}`);
    console.log(`   ✅ Sucessos: ${report.summary.successfulServers}`);
    console.log(`   ❌ Falhas: ${report.summary.failedServers}`);
    console.log(`   📊 Total de OJs: ${this.integrationStats.totalOJs}`);
    console.log(`   ⏭️  OJs pulados: ${this.integrationStats.skippedOJs}`);
    console.log(`   🆕 Novos OJs: ${this.integrationStats.newOJs}`);
    console.log(`   ➕ Papéis adicionados: ${this.integrationStats.addedRoles}`);
    console.log(`   ⏱️  Tempo total economizado: ${Math.round(report.summary.totalTimeSaved/1000)}s`);
    console.log(`   📈 Eficiência: ${Math.round((this.integrationStats.skippedOJs/this.integrationStats.totalOJs)*100)}% de otimização`);
  }

  /**
     * 💡 GERA RECOMENDAÇÕES FINAIS
     */
  generateFinalRecommendations(results) {
    const recommendations = [];
        
    const successRate = results.filter(r => r.success).length / results.length;
    const avgTimeSaved = results.reduce((sum, r) => sum + (r.timeSaved || 0), 0) / results.length;
        
    if (successRate > 0.9) {
      recommendations.push({
        type: 'SUCCESS',
        message: 'Excelente taxa de sucesso! O sistema está funcionando perfeitamente.',
        impact: 'POSITIVE'
      });
    }
        
    if (avgTimeSaved > 300) { // 5 minutos
      recommendations.push({
        type: 'OPTIMIZATION',
        message: 'Significativa economia de tempo detectada. Continue usando a validação inteligente.',
        impact: 'HIGH'
      });
    }
        
    if (this.integrationStats.addedRoles > 0) {
      recommendations.push({
        type: 'ATTENTION',
        message: `${this.integrationStats.addedRoles} papéis foram adicionados a OJs existentes. Verifique se estão corretos.`,
        impact: 'MEDIUM'
      });
    }
        
    return recommendations;
  }

  /**
     * 📊 OBTÉM ESTATÍSTICAS ATUAIS
     */
  getStats() {
    return {
      ...this.integrationStats,
      validatorStats: this.validator.getStats()
    };
  }

  /**
     * 🔍 ANALISA OJS EXISTENTES NO SERVIDOR
     */
  async analyzeExistingOJs(page, servidor) {
    try {
      console.log(`🔍 [ANÁLISE] Analisando OJs existentes para: ${servidor.nome}`);
            
      if (!page || !page.evaluate) {
        // Modo de teste - retornar dados simulados
        return [];
      }
            
      // Extrair OJs existentes do DOM
      const existingOJs = await page.evaluate(() => {
        const ojElements = document.querySelectorAll('[data-oj], .oj-item, .orgao-julgador');
        const ojs = [];
                
        ojElements.forEach(element => {
          const nome = element.textContent?.trim() || element.getAttribute('data-nome');
          const perfisElements = element.querySelectorAll('.perfil, .role, [data-perfil]');
          const perfis = Array.from(perfisElements).map(p => p.textContent?.trim()).filter(Boolean);
                    
          if (nome) {
            ojs.push({ nome, perfis });
          }
        });
                
        return ojs;
      });
            
      console.log(`📊 [ANÁLISE] Encontrados ${existingOJs.length} OJs existentes`);
      return existingOJs;
            
    } catch (error) {
      console.error(`❌ [ANÁLISE] Erro ao analisar OJs existentes: ${error.message}`);
      return [];
    }
  }

  /**
      * 🔄 FILTRA OJS PARA PROCESSAMENTO
      */
  async filterOJsForProcessing(ojsToProcess, existingOJs) {
    try {
      console.log(`🔄 [FILTRO] Filtrando ${ojsToProcess.length} OJs para processamento`);
             
      const result = {
        toCreate: [],
        toAddRole: [],
        toSkip: []
      };
             
      for (const oj of ojsToProcess) {
        const ojName = oj.nome || oj;
        const requiredRole = oj.perfil || oj.papel || 'Assessor';
                 
        // Procurar OJ existente
        const existingOJ = existingOJs.find(existing => 
          this.normalizeOJName(existing.nome) === this.normalizeOJName(ojName)
        );
                 
        if (!existingOJ) {
          // OJ não existe - precisa criar
          result.toCreate.push({
            nome: ojName,
            perfil: requiredRole,
            action: 'create'
          });
        } else {
          // OJ existe - verificar se precisa adicionar papel
          const needsRole = this.validator.needsAdditionalRole(existingOJ.perfis, requiredRole);
                     
          if (needsRole) {
            result.toAddRole.push({
              nome: ojName,
              perfil: requiredRole,
              novoRole: requiredRole,
              existingRoles: existingOJ.perfis,
              action: 'add_role'
            });
          } else {
            result.toSkip.push({
              nome: ojName,
              perfil: requiredRole,
              existingRoles: existingOJ.perfis,
              action: 'skip',
              reason: 'Já possui o perfil necessário'
            });
          }
        }
      }
             
      console.log(`📊 [FILTRO] Resultado: ${result.toCreate.length} criar, ${result.toAddRole.length} adicionar papel, ${result.toSkip.length} pular`);
      return result;
             
    } catch (error) {
      console.error(`❌ [FILTRO] Erro ao filtrar OJs: ${error.message}`);
      return {
        toCreate: ojsToProcess,
        toAddRole: [],
        toSkip: []
      };
    }
  }
     
  /**
      * 🔧 NORMALIZA NOME DO OJ PARA COMPARAÇÃO
      */
  normalizeOJName(name) {
    // Validação de tipo para evitar erros
    let nameTexto;
    if (typeof name === 'string') {
      nameTexto = name;
    } else if (name && typeof name === 'object' && name.nome) {
      nameTexto = name.nome;
    } else {
      nameTexto = String(name || '');
    }
         
    return nameTexto
      .toLowerCase()
      .trim()
    // Normalizar acentos e caracteres especiais
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    // Normalizar espaços
      .replace(/\s+/g, ' ')
    // Remover preposições e artigos variáveis
      .replace(/\b(da|de|do|das|dos)\s+/g, '')
    // Remover "circunscricao" que aparece em alguns nomes
      .replace(/\bcircunscricao\s+/g, '')
    // Normalizar termos comuns
      .replace(/\binfancia\s+e\s+adolescencia\b/g, 'infancia adolescencia')
      .replace(/\bjuizado\s+especial\b/g, 'juizado especial')
    // Remover caracteres não alfanuméricos (exceto espaços)
      .replace(/[^a-z0-9\s]/g, '')
    // Normalizar espaços novamente
      .replace(/\s+/g, ' ')
      .trim();
  }
     
  /**
      * 📊 GERA RELATÓRIO DE PROCESSAMENTO
      */
  generateProcessingReport(filteredOJs, servidor) {
    const report = {
      servidor: servidor.nome || 'Não informado',
      cpf: servidor.cpf || 'Não informado',
      timestamp: new Date().toISOString(),
      summary: {
        toCreate: filteredOJs.toCreate.length,
        toAddRole: filteredOJs.toAddRole.length,
        toSkip: filteredOJs.toSkip.length,
        total: filteredOJs.toCreate.length + filteredOJs.toAddRole.length + filteredOJs.toSkip.length
      },
      details: filteredOJs
    };
         
    return report;
  }

  /**
      * 🧹 LIMPA CACHE E REINICIA
      */
  reset() {
    this.validator.clearCache();
    this.processedServers.clear();
    this.integrationStats = {
      totalServers: 0,
      totalOJs: 0,
      skippedOJs: 0,
      newOJs: 0,
      addedRoles: 0,
      errors: 0,
      timesSaved: 0
    };
  }
}

module.exports = SmartOJIntegration;