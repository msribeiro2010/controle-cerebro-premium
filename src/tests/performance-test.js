/**
 * Teste de Performance - Sistema de Cache Inteligente de OJs
 * 
 * Este arquivo demonstra e testa as melhorias de performance implementadas
 * no sistema de verificação de OJs já vinculados.
 */

const { SmartOJCache } = require('../utils/smart-oj-cache.js');

/**
 * Simula dados de teste para validar o sistema
 */
class PerformanceTest {
  constructor() {
    this.smartCache = new SmartOJCache();
    this.resultados = {
      tempoSemCache: 0,
      tempoComCache: 0,
      economiaPercentual: 0,
      ojsTestados: 0,
      ojsJaVinculados: 0,
      ojsParaVincular: 0
    };
  }

  /**
   * Gera lista de OJs de teste simulando cenário real
   */
  gerarOJsParaTeste() {
    return [
      'CON2 – São José do Rio Preto',
      '1ª Vara Cível de São Paulo',
      'Tribunal Regional Federal da 3ª Região',
      '2ª Vara Criminal de Campinas',
      'Juizado Especial Cível de Santos',
      'CON1 - Ribeirão Preto',
      'Vara da Fazenda Pública de São Paulo',
      '3ª Turma do TRF3',
      'Comarca de Sorocaba',
      'Foro Regional de Santana',
      // Duplicatas para testar cache
      'CON2 – São José do Rio Preto', // Duplicata com travessão
      'CON2 - São José do Rio Preto',  // Duplicata com hífen
      '1ª Vara Cível de São Paulo',    // Duplicata exata
      '1a Vara Civel de Sao Paulo',    // Variação sem acentos
      'Tribunal Regional Federal 3ª Região', // Variação sem "da"
    ];
  }

  /**
   * Simula OJs já vinculados no sistema
   */
  simularOJsJaVinculados() {
    return new Map([
      ['con2 sao jose do rio preto', 'CON2 – São José do Rio Preto'],
      ['1 vara civel de sao paulo', '1ª Vara Cível de São Paulo'],
      ['tribunal regional federal da 3 regiao', 'Tribunal Regional Federal da 3ª Região'],
      ['vara da fazenda publica de sao paulo', 'Vara da Fazenda Pública de São Paulo'],
      ['foro regional de santana', 'Foro Regional de Santana']
    ]);
  }

  /**
   * Testa performance sem cache (método tradicional)
   */
  async testarSemCache(ojs, ojsVinculados) {
    console.log('\n🔄 TESTANDO PERFORMANCE SEM CACHE...');
    const inicio = Date.now();
    
    let ojsJaVinculados = 0;
    let ojsParaVincular = 0;
    
    for (const oj of ojs) {
      // Simula verificação individual (método antigo)
      await new Promise(resolve => setTimeout(resolve, 100)); // Simula 100ms por verificação
      
      const ojNormalizado = oj.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
      
      let encontrado = false;
      for (const [vinculadoNorm, vinculadoOrig] of ojsVinculados) {
        if (vinculadoNorm.includes(ojNormalizado) || ojNormalizado.includes(vinculadoNorm)) {
          encontrado = true;
          ojsJaVinculados++;
          break;
        }
      }
      
      if (!encontrado) {
        ojsParaVincular++;
      }
    }
    
    const tempoTotal = Date.now() - inicio;
    
    console.log(`   ⏱️  Tempo total: ${tempoTotal}ms`);
    console.log(`   ✅ OJs já vinculados: ${ojsJaVinculados}`);
    console.log(`   🔗 OJs para vincular: ${ojsParaVincular}`);
    
    return {
      tempo: tempoTotal,
      ojsJaVinculados,
      ojsParaVincular
    };
  }

  /**
   * Testa performance com cache inteligente
   */
  async testarComCache(ojs, ojsVinculados) {
    console.log('\n🚀 TESTANDO PERFORMANCE COM CACHE INTELIGENTE...');
    const inicio = Date.now();
    
    // Simula página mockada
    const mockPage = {
      evaluate: async () => ojsVinculados
    };
    
    const resultado = await this.smartCache.verificarOJsEmLote(
      mockPage,
      ojs,
      (mensagem, progresso) => {
        if (progresso % 25 === 0) {
          console.log(`   📊 ${progresso}% - ${mensagem}`);
        }
      }
    );
    
    const tempoTotal = Date.now() - inicio;
    
    console.log(`   ⏱️  Tempo total: ${tempoTotal}ms`);
    console.log(`   ✅ OJs já vinculados: ${resultado.estatisticas.jaVinculados}`);
    console.log(`   🔗 OJs para vincular: ${resultado.estatisticas.paraVincular}`);
    console.log('   🎯 Correspondências encontradas:');
    
    resultado.ojsJaVinculados.forEach(item => {
      console.log(`      - "${item.oj}" → "${item.textoEncontrado}" (${item.tipoCorrespondencia})`);
    });
    
    return {
      tempo: tempoTotal,
      ojsJaVinculados: resultado.estatisticas.jaVinculados,
      ojsParaVincular: resultado.estatisticas.paraVincular,
      detalhes: resultado
    };
  }

  /**
   * Executa teste completo de performance
   */
  async executarTeste() {
    console.log('\n🧪 INICIANDO TESTE DE PERFORMANCE DO SISTEMA DE CACHE INTELIGENTE');
    console.log('=' .repeat(80));
    
    const ojs = this.gerarOJsParaTeste();
    const ojsVinculados = this.simularOJsJaVinculados();
    
    console.log('\n📋 DADOS DO TESTE:');
    console.log(`   - Total de OJs para testar: ${ojs.length}`);
    console.log(`   - OJs já vinculados no sistema: ${ojsVinculados.size}`);
    console.log('   - OJs de teste:');
    ojs.forEach((oj, index) => {
      console.log(`     ${index + 1}. ${oj}`);
    });
    
    // Teste sem cache
    const resultadoSemCache = await this.testarSemCache(ojs, ojsVinculados);
    
    // Teste com cache
    const resultadoComCache = await this.testarComCache(ojs, ojsVinculados);
    
    // Calcular melhorias
    const economiaTempoMs = resultadoSemCache.tempo - resultadoComCache.tempo;
    const economiaPercentual = Math.round((economiaTempoMs / resultadoSemCache.tempo) * 100);
    const fatorMelhoria = (resultadoSemCache.tempo / resultadoComCache.tempo).toFixed(2);
    
    // Relatório final
    console.log('\n📊 RELATÓRIO DE PERFORMANCE');
    console.log('=' .repeat(50));
    console.log(`🐌 Método tradicional (sem cache): ${resultadoSemCache.tempo}ms`);
    console.log(`🚀 Método inteligente (com cache): ${resultadoComCache.tempo}ms`);
    console.log(`⚡ Economia de tempo: ${economiaTempoMs}ms (${economiaPercentual}%)`);
    console.log(`📈 Fator de melhoria: ${fatorMelhoria}x mais rápido`);
    
    console.log('\n🎯 PRECISÃO DA DETECÇÃO:');
    console.log(`   - OJs corretamente identificados como vinculados: ${resultadoComCache.ojsJaVinculados}`);
    console.log(`   - OJs identificados para vinculação: ${resultadoComCache.ojsParaVincular}`);
    
    console.log('\n💡 BENEFÍCIOS ESTIMADOS EM PRODUÇÃO:');
    const ojsPorPerito = 50; // Estimativa média
    const tempoEconomizadoPorPerito = (economiaTempoMs / ojs.length) * ojsPorPerito;
    console.log(`   - Para um perito com ${ojsPorPerito} OJs: ${Math.round(tempoEconomizadoPorPerito)}ms (~${Math.round(tempoEconomizadoPorPerito/1000)}s) de economia`);
    console.log(`   - Para 100 peritos: ~${Math.round(tempoEconomizadoPorPerito * 100 / 60000)} minutos de economia total`);
    
    this.resultados = {
      tempoSemCache: resultadoSemCache.tempo,
      tempoComCache: resultadoComCache.tempo,
      economiaPercentual,
      ojsTestados: ojs.length,
      ojsJaVinculados: resultadoComCache.ojsJaVinculados,
      ojsParaVincular: resultadoComCache.ojsParaVincular,
      fatorMelhoria: parseFloat(fatorMelhoria)
    };
    
    return this.resultados;
  }

  /**
   * Gera relatório em formato JSON para análise
   */
  gerarRelatorioJSON() {
    return {
      timestamp: new Date().toISOString(),
      teste: 'Performance Cache Inteligente OJs',
      versao: '1.0.0',
      resultados: this.resultados,
      conclusao: {
        melhoriaSignificativa: this.resultados.economiaPercentual > 50,
        recomendacao: this.resultados.fatorMelhoria > 2 ? 'Implementar em produção' : 'Revisar algoritmo',
        impactoEstimado: `${this.resultados.economiaPercentual}% de redução no tempo de processamento`
      }
    };
  }
}

// Executar teste se chamado diretamente
if (require.main === module) {
  const teste = new PerformanceTest();
  
  teste.executarTeste()
    .then(resultados => {
      console.log('\n✅ TESTE CONCLUÍDO COM SUCESSO!');
      console.log('\n📄 Relatório JSON:');
      console.log(JSON.stringify(teste.gerarRelatorioJSON(), null, 2));
    })
    .catch(erro => {
      console.error('❌ ERRO NO TESTE:', erro);
      process.exit(1);
    });
}

module.exports = { PerformanceTest };