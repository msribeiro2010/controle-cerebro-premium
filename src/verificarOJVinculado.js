// Função para verificar se um Órgão Julgador já está vinculado ao perito

const { NormalizadorTexto } = require('./utils/normalizacao');

/**
 * Verificação conservadora que busca por OJs exatamente vinculados
 * para evitar falsos positivos
 */
async function verificacaoConservadoraOJ(page, nomeOJ) {
  console.log(`🛡️ Verificação conservadora para: "${nomeOJ}"`);
  
  try {
    // Procurar por tabelas com OJs vinculados de forma mais específica
    const seletoresTabela = [
      'table tbody tr',
      '.mat-table .mat-row',
      '.table tbody tr'
    ];
    
    const nomeOJNormalizado = NormalizadorTexto.normalizar(nomeOJ);
    
    for (const seletor of seletoresTabela) {
      try {
        console.log(`🔎 Testando seletor: ${seletor}`);
        const linhas = await page.locator(seletor).all();
        console.log(`📊 Encontradas ${linhas.length} linhas com seletor "${seletor}"`);
        
        for (const linha of linhas) {
          try {
            const textoLinha = await linha.textContent();
            if (textoLinha && textoLinha.trim()) {
              const textoLinhaLimpo = textoLinha.trim();
              const textoLinhaNormalizado = NormalizadorTexto.normalizar(textoLinhaLimpo);
              
              // Verificação ultra-restritiva: 
              // 1. Deve ter similaridade exata normalizada
              // 2. OU ser exatamente igual após normalização
              if (textoLinhaNormalizado === nomeOJNormalizado || 
                  NormalizadorTexto.saoEquivalentes(nomeOJ, textoLinhaLimpo, 0.98)) {
                
                console.log(`🎯 MATCH CONSERVADOR encontrado!`);
                console.log(`📄 Texto da linha: "${textoLinhaLimpo}"`);
                console.log(`🔬 Normalizado: "${textoLinhaNormalizado}"`);
                console.log(`🎯 Alvo normalizado: "${nomeOJNormalizado}"`);
                
                return {
                  jaVinculado: true,
                  textoEncontrado: textoLinhaLimpo,
                  elemento: linha,
                  tipoCorrespondencia: 'conservadora'
                };
              }
            }
          } catch (error) {
            // Continuar para próxima linha
          }
        }
      } catch (error) {
        // Continuar para próximo seletor
      }
    }
    
    console.log(`🛡️ Verificação conservadora: OJ "${nomeOJ}" NÃO encontrado`);
    return {
      jaVinculado: false,
      textoEncontrado: null,
      elemento: null
    };
    
  } catch (error) {
    console.log(`❌ Erro na verificação conservadora: ${error.message}`);
    return {
      jaVinculado: false,
      textoEncontrado: null,
      elemento: null,
      erro: error.message
    };
  }
}

async function verificarOJJaVinculado(page, nomeOJ) {
  console.log(`🔍 Verificando se OJ "${nomeOJ}" já está vinculado...`);
  
  // Usar APENAS verificação conservadora para evitar falsos positivos
  const verificacaoConservadora = await verificacaoConservadoraOJ(page, nomeOJ);
  return verificacaoConservadora;
}

// Função para listar todos os OJs já vinculados
async function listarOJsVinculados(page) {
  console.log('📋 Listando todos os OJs já vinculados...');
  
  try {
    const ojsVinculados = [];
    const ojsNormalizados = new Set(); // Para evitar duplicatas
    
    // Seletores otimizados para encontrar OJs vinculados
    const seletoresOJs = [
      'table tbody tr td',
      '.mat-table .mat-cell',
      '.table tbody tr td',
      'ul li',
      '.list-group-item',
      '.mat-list-item .mat-line',
      '.card-body p',
      '.panel-body p',
      '.mat-expansion-panel-content div',
      // Seletores mais específicos para OJs
      '[class*="orgao"]',
      '[class*="julgador"]',
      'div:has-text("Vara")',
      'div:has-text("Tribunal")',
      'span:has-text("Vara")',
      'span:has-text("Tribunal")'
    ];
    
    // Palavras-chave que indicam um órgão julgador
    const palavrasChaveOJ = [
      'vara', 'tribunal', 'juizado', 'turma', 'câmara', 'seção',
      'comarca', 'foro', 'instância', 'supremo', 'superior',
      'regional', 'federal', 'estadual', 'militar', 'eleitoral',
      'trabalho', 'justiça'
    ];
    
    for (const seletor of seletoresOJs) {
      try {
        const elementos = await page.locator(seletor).all();
        
        for (const elemento of elementos) {
          try {
            const texto = await elemento.textContent();
            if (texto && texto.trim()) {
              const textoLimpo = texto.trim();
              const textoNormalizado = NormalizadorTexto.normalizar(textoLimpo);
              
              // Verificar se parece ser um nome de órgão julgador usando critérios mais robustos
              const textoNormalizadoProcessed = typeof textoNormalizado === 'string' ? textoNormalizado : (textoNormalizado?.nome || String(textoNormalizado || ''));
              const contemPalavraChave = palavrasChaveOJ.some(palavra => {
                const palavraProcessed = typeof palavra === 'string' ? palavra : (palavra?.nome || String(palavra || ''));
                return textoNormalizadoProcessed.includes(palavraProcessed);
              });
              
              if (contemPalavraChave && 
                  textoLimpo.length > 10 && 
                  textoLimpo.length < 200 && // Evitar textos muito longos
                  !ojsNormalizados.has(textoNormalizado)) {
                
                // Verificar se não é duplicata usando similaridade
                const ehDuplicata = ojsVinculados.some(ojExistente => 
                  NormalizadorTexto.saoEquivalentes(textoLimpo, ojExistente, 0.90)
                );
                
                if (!ehDuplicata) {
                  ojsVinculados.push(textoLimpo);
                  ojsNormalizados.add(textoNormalizado);
                }
              }
            }
          } catch (error) {
            // Continuar se houver erro
          }
        }
      } catch (error) {
        // Continuar tentando outros seletores
      }
    }
    
    // Filtrar e validar os OJs encontrados
    const ojsValidados = ojsVinculados.filter(oj => validarOrgaoJulgador(oj));
    
    if (ojsValidados.length > 0) {
      console.log('📋 OJs vinculados encontrados:');
      ojsValidados.forEach((oj, index) => {
        console.log(`   ${index + 1}. ${oj}`);
      });
    } else {
      console.log('❌ Nenhum OJ vinculado encontrado');
    }
    
    return ojsValidados;
    
  } catch (error) {
    console.log(`❌ Erro ao listar OJs vinculados: ${error.message}`);
    return [];
  }
}

// Função auxiliar para validar se um texto representa um órgão julgador válido
function validarOrgaoJulgador(texto) {
  if (!texto || typeof texto !== 'string') return false;
  
  const textoLimpo = texto.trim();
  const textoNormalizado = NormalizadorTexto.normalizar(textoLimpo);
  
  // Critérios de validação
  const criterios = {
    // Tamanho adequado
    tamanhoValido: textoLimpo.length >= 15 && textoLimpo.length <= 150,
    
    // Contém palavras-chave de órgão julgador
    contemPalavraChave: /\b(vara|tribunal|juizado|turma|camara|secao|comarca|foro|instancia|supremo|superior|regional|federal|estadual|militar|eleitoral|trabalho|justica)\b/i.test(textoLimpo),
    
    // Não contém palavras que indicam que não é um OJ
    naoContemExclusoes: !/\b(adicionar|vincular|selecionar|escolher|buscar|pesquisar|filtrar|ordenar|classificar|salvar|cancelar|confirmar|voltar|proximo|anterior|pagina|total|resultado|encontrado|nenhum|vazio|carregando|aguarde)\b/i.test(textoLimpo),
    
    // Não é apenas números ou caracteres especiais
    naoEhApenasNumeros: !/^[\d\s\-\.\,\(\)]+$/.test(textoLimpo),
    
    // Contém pelo menos uma letra
    contemLetras: /[a-zA-ZÀ-ÿ]/.test(textoLimpo)
  };
  
  // Verificar se atende a todos os critérios
  const valido = Object.values(criterios).every(criterio => criterio === true);
  
  if (!valido) {
    console.log(`🚫 Texto rejeitado como OJ: "${textoLimpo}"`);
    console.log(`📊 Critérios: ${JSON.stringify(criterios, null, 2)}`);
  }
  
  return valido;
}

module.exports = {
  verificarOJJaVinculado,
  listarOJsVinculados,
  verificacaoConservadoraOJ
};