/**
 * Mapeamento de nomes de CEJUSC/CCP para compatibilidade
 * Resolve problemas de variações de nomenclatura entre sistemas
 */

class CejuscMapper {
  constructor() {
    // Mapeamento de variações conhecidas
    // Padrão correto: CEJUSC [CIDADE] - JT Centro Judiciário de Métodos Consensuais de Solução de Disputas da Justiça do Trabalho
    this.mapeamentos = new Map([
      // CEJUSCs - mapeamento de variações para o padrão correto
      ['cejusc piracicaba', 'CEJUSC PIRACICABA'],
      ['cejusc campinas', 'CEJUSC CAMPINAS'],
      ['cejusc bauru', 'CEJUSC BAURU'],
      ['cejusc franca', 'CEJUSC FRANCA'],
      ['cejusc jundiaí', 'CEJUSC JUNDIAÍ'],
      ['cejusc limeira', 'CEJUSC LIMEIRA'],
      ['cejusc araraquara', 'CEJUSC ARARAQUARA'],
      ['cejusc araçatuba', 'CEJUSC ARAÇATUBA'],
      ['cejusc ribeirão preto', 'CEJUSC RIBEIRÃO PRETO'],
      ['cejusc presidente prudente', 'CEJUSC PRESIDENTE PRUDENTE'],
      ['cejusc sorocaba', 'CEJUSC SOROCABA'],
      ['cejusc são josé do rio preto', 'CEJUSC SÃO JOSÉ DO RIO PRETO'],
      ['cejusc são josé dos campos', 'CEJUSC SÃO JOSÉ DOS CAMPOS'],
      ['cejusc santos', 'CEJUSC SANTOS'],
      ['cejusc de 2º grau', 'CEJUSC DE 2º GRAU'],
      
      // Mapeamento de CCP (formato antigo) para CEJUSC (formato correto)
      ['ccp piracicaba', 'CEJUSC PIRACICABA'],
      ['ccp campinas', 'CEJUSC CAMPINAS'],
      ['ccp bauru', 'CEJUSC BAURU'],
      ['ccp franca', 'CEJUSC FRANCA'],
      ['ccp jundiaí', 'CEJUSC JUNDIAÍ'],
      ['ccp limeira', 'CEJUSC LIMEIRA'],
      ['ccp araraquara', 'CEJUSC ARARAQUARA'],
      ['ccp araçatuba', 'CEJUSC ARAÇATUBA'],
      ['ccp ribeirão preto', 'CEJUSC RIBEIRÃO PRETO'],
      ['ccp presidente prudente', 'CEJUSC PRESIDENTE PRUDENTE'],
      ['ccp sorocaba', 'CEJUSC SOROCABA'],
      ['ccp são josé do rio preto', 'CEJUSC SÃO JOSÉ DO RIO PRETO'],
      ['ccp são josé dos campos', 'CEJUSC SÃO JOSÉ DOS CAMPOS'],
      ['ccp santos', 'CEJUSC SANTOS'],
      
      // Variações de escrita
      ['centro de conciliação piracicaba', 'CEJUSC PIRACICABA'],
      ['centro conciliação piracicaba', 'CEJUSC PIRACICABA'],
      ['centro judiciário piracicaba', 'CEJUSC PIRACICABA'],
      
      // DIVEX variations
      ['divex presidente prudente', 'DIVEX - Presidente Prudente'],
      ['divisão de execução presidente prudente', 'DIVEX - Presidente Prudente'],
      ['divisão de execução de presidente prudente', 'DIVEX - Presidente Prudente'],
    ]);
  }

  /**
   * Normaliza um nome de OJ para busca
   * @param {string} nome - Nome do OJ
   * @returns {string} Nome normalizado
   */
  normalizar(nome) {
    if (!nome) return '';

    // Converter para minúsculas e remover hífens para comparação
    const nomeLower = nome.toLowerCase()
      .trim()
      .replace(/[-–—−]/g, ' ') // Remove hífens e travessões
      .replace(/\s+/g, ' '); // Normaliza espaços múltiplos

    // Verificar mapeamento direto
    if (this.mapeamentos.has(nomeLower)) {
      return this.mapeamentos.get(nomeLower);
    }

    // Tentar encontrar correspondência parcial
    for (const [chave, valor] of this.mapeamentos) {
      const chaveNorm = chave.replace(/[-–—−]/g, ' ').replace(/\s+/g, ' ');
      if (nomeLower.includes(chaveNorm) || chaveNorm.includes(nomeLower)) {
        return valor;
      }
    }

    // Se contém CEJUSC ou CCP, normalizar para CEJUSC
    if (nomeLower.includes('cejusc') || nomeLower.includes('ccp')) {
      // Extrair cidade
      const cidade = nomeLower
        .replace('cejusc', '')
        .replace('ccp', '')
        .replace('centro de conciliação', '')
        .replace('centro de conciliacao', '')
        .replace('centro judiciário', '')
        .replace('centro judiciario', '')
        .trim();

      if (cidade) {
        return `CEJUSC ${cidade.toUpperCase()}`;
      }
    }

    // Retornar original se não houver mapeamento
    return nome;
  }

  /**
   * Encontra melhor correspondência em uma lista de opções
   * @param {string} busca - Texto buscado
   * @param {Array<string>} opcoes - Lista de opções disponíveis
   * @returns {Object} Melhor correspondência encontrada
   */
  encontrarMelhorCorrespondencia(busca, opcoes) {
    if (!busca || !opcoes || opcoes.length === 0) {
      return { encontrado: false, opcao: null, indice: -1 };
    }

    // Normalizar busca removendo hífens
    const buscaNormalizada = this.normalizar(busca);
    const buscaLower = busca.toLowerCase()
      .trim()
      .replace(/[-–—−]/g, ' ')
      .replace(/\s+/g, ' ');
    
    // 1. Buscar correspondência exata após normalização
    for (let i = 0; i < opcoes.length; i++) {
      const opcao = opcoes[i];
      const opcaoLower = opcao.toLowerCase()
        .trim()
        .replace(/[-–—−]/g, ' ')
        .replace(/\s+/g, ' ');
      
      // Correspondência exata com normalização
      if (opcao.includes(buscaNormalizada)) {
        return { encontrado: true, opcao, indice: i, tipo: 'normalizada' };
      }
      
      // Correspondência exata sem normalização
      if (opcaoLower === buscaLower) {
        return { encontrado: true, opcao, indice: i, tipo: 'exata' };
      }
    }
    
    // 2. Buscar correspondência parcial
    for (let i = 0; i < opcoes.length; i++) {
      const opcao = opcoes[i];
      const opcaoLower = opcao.toLowerCase()
        .trim()
        .replace(/[-–—−]/g, ' ')
        .replace(/\s+/g, ' ');
      
      // Se a busca contém a opção ou vice-versa
      if (opcaoLower.includes(buscaLower) || buscaLower.includes(opcaoLower)) {
        return { encontrado: true, opcao, indice: i, tipo: 'parcial' };
      }
      
      // Tratamento especial para CEJUSC/CCP
      if (buscaLower.includes('cejusc') || buscaLower.includes('ccp')) {
        // Extrair cidade da busca
        const cidadeBusca = buscaLower
          .replace('cejusc', '')
          .replace('ccp', '')
          .replace('centro de conciliação', '')
          .replace('centro judiciário', '')
          .trim();
        
        // Verificar se a opção contém CEJUSC com a mesma cidade
        if (cidadeBusca && opcaoLower.includes('cejusc') && opcaoLower.includes(cidadeBusca)) {
          return { encontrado: true, opcao, indice: i, tipo: 'cejusc_match' };
        }
        
        // Verificar se a opção contém CCP com a mesma cidade (compatibilidade)
        if (cidadeBusca && opcaoLower.includes('ccp') && opcaoLower.includes(cidadeBusca)) {
          return { encontrado: true, opcao, indice: i, tipo: 'ccp_compatibility' };
        }
      }
    }
    
    // 3. Se não encontrou, retornar negativo
    return { 
      encontrado: false, 
      opcao: null, 
      indice: -1,
      sugestao: buscaNormalizada,
      busca
    };
  }

  /**
   * Verifica se um nome é CEJUSC/CCP
   * @param {string} nome - Nome para verificar
   * @returns {boolean} True se for CEJUSC/CCP
   */
  isCejusc(nome) {
    if (!nome) return false;
    const nomeLower = nome.toLowerCase();
    return nomeLower.includes('cejusc') || 
           nomeLower.includes('ccp') || 
           nomeLower.includes('centro de conciliação') ||
           nomeLower.includes('centro judiciário') ||
           nomeLower.includes('métodos consensuais');
  }
}

module.exports = CejuscMapper;