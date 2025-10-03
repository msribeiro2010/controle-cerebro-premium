/**
 * Utilitários centralizados para o PJE Perito Automation
 * Fornece funções otimizadas e timeouts adaptativos
 */

const TimeoutManager = require('./timeouts');
const SeletorManager = require('./seletores');
const { NormalizadorTexto } = require('./normalizacao');
const Logger = require('./Logger');

// Criar instância do logger para este módulo
const logger = new Logger('UtilsIndex');

/**
 * Função otimizada para buscar elementos com timeout adaptativo
 * @param {Object} page - Instância da página Playwright
 * @param {string} tipo - Tipo do elemento (orgaoJulgador, botaoAdicionar, acordeonHeader)
 * @param {Object} opcoes - Opções de configuração
 * @returns {Promise<{elemento: string, seletor: string, nivel: string}>}
 */
async function buscarElemento(page, tipo, opcoes = {}) {
  const {
    maxTentativas = 3,
    categoria = 'interacao',
    operacao = 'aguardarElemento'
  } = opcoes;

  return await TimeoutManager.executarComTimeout(
    async () => {
      const timeout = TimeoutManager.obterTimeout(categoria, operacao);
      return await SeletorManager.buscarElemento(page, tipo, timeout);
    },
    categoria,
    `buscarElemento.${tipo}`,
    {
      maxTentativas,
      delayEntreTentativas: 1000,
      onTentativa: (tentativa, max) => {
        logger.info(`Buscando elemento '${tipo}' - tentativa ${tentativa}/${max}`);
      },
      onFalha: (error, tentativa, max) => {
        logger.warn(`Falha ao buscar elemento '${tipo}' - tentativa ${tentativa}/${max}: ${error.message}`);
      }
    }
  );
}

/**
 * Obtém timeout adaptativo para uma categoria específica
 * @param {string} categoria - Categoria da operação
 * @param {string} contexto - Contexto da operação (critico, normal, background, validacao)
 * @returns {number} Timeout em milissegundos
 */
function obterTimeoutAdaptativo(categoria, contexto = 'normal') {
  // Mapear categorias simplificadas para as categorias do TimeoutManager
  const mapeamento = {
    'navegacao': 'navegacao.carregarPagina',
    'interacao': 'interacao.clicar',
    'dropdown': 'dropdown.abrir',
    'busca': 'interacao.aguardarElemento',
    'validacao': 'interacao.validarAcao',
    'modal': 'navegacao.aguardarModal',
    'pje': 'pje.confirmarAcao'
  };
  
  const categoriaCompleta = mapeamento[categoria] || categoria;
  const timeoutBase = TimeoutManager.obterTimeout(categoriaCompleta);
  
  // Aplicar ajuste por contexto se necessário
  if (contexto !== 'normal') {
    return TimeoutManager.timeoutPorContexto(contexto, timeoutBase);
  }
  
  return timeoutBase;
}

/**
 * Obtém timeout progressivo para operações com retry
 * @param {string} categoria - Categoria da operação
 * @param {string} contexto - Contexto da operação
 * @param {number} tentativa - Número da tentativa atual
 * @returns {number} Timeout progressivo em milissegundos
 */
function obterTimeoutProgressivo(categoria, contexto = 'normal', tentativa = 1) {
  const timeoutBase = obterTimeoutAdaptativo(categoria, contexto);
  return TimeoutManager.timeoutProgressivo(timeoutBase, tentativa);
}

/**
 * Função otimizada para listar elementos disponíveis
 * @param {Object} page - Instância da página Playwright
 * @param {string} tipo - Tipo de elemento para listar
 * @returns {Promise<Array>} Lista de elementos encontrados
 */
async function listarElementosDisponiveis(page, tipo = 'select') {
  return await TimeoutManager.executarComTimeout(
    async () => {
      return await SeletorManager.listarElementosDisponiveis(page, tipo);
    },
    'interacao',
    'listarElementos',
    {
      maxTentativas: 2,
      delayEntreTentativas: 500
    }
  );
}

/**
 * Função otimizada para aguardar elemento com retry inteligente
 * @param {Object} page - Instância da página Playwright
 * @param {string} seletor - Seletor CSS do elemento
 * @param {Object} opcoes - Opções de configuração
 * @returns {Promise<ElementHandle>}
 */
async function aguardarElemento(page, seletor, opcoes = {}) {
  const {
    maxTentativas = 3,
    categoria = 'interacao',
    operacao = 'aguardarElemento',
    validarVisibilidade = true
  } = opcoes;

  return await TimeoutManager.executarComTimeout(
    async () => {
      const timeoutValue = TimeoutManager.obterTimeout(categoria, operacao);
      
      // Aguardar elemento aparecer
      await page.waitForSelector(seletor, { timeout: timeoutValue });
      
      // Validar visibilidade se solicitado
      if (validarVisibilidade) {
        const elemento = await page.$(seletor);
        const isVisible = await elemento.isVisible();
        if (!isVisible) {
          throw new Error(`Elemento '${seletor}' encontrado mas não está visível`);
        }
      }
      
      return await page.$(seletor);
    },
    categoria,
    'aguardarElemento',
    {
      maxTentativas,
      delayEntreTentativas: 1000,
      onTentativa: (tentativa, max) => {
        logger.info(`Aguardando elemento '${seletor}' - tentativa ${tentativa}/${max}`);
      }
    }
  );
}

/**
 * Função otimizada para clicar em elemento com retry
 * @param {Object} page - Instância da página Playwright
 * @param {string} seletor - Seletor CSS do elemento
 * @param {Object} opcoes - Opções de configuração
 * @returns {Promise<void>}
 */
async function clicarElemento(page, seletor, opcoes = {}) {
  const {
    maxTentativas = 3,
    aguardarNavegacao = false,
    validarClique = false
  } = opcoes;

  return await TimeoutManager.executarComTimeout(
    async () => {
      // Aguardar elemento estar disponível
      await aguardarElemento(page, seletor, { validarVisibilidade: true });
      
      // Executar clique
      if (aguardarNavegacao) {
        const navigationTimeout = TimeoutManager.obterTimeout('navegacao', 'redirecionamento');
        await Promise.all([
          page.waitForNavigation({ timeout: navigationTimeout }),
          page.click(seletor)
        ]);
      } else {
        await page.click(seletor);
      }
      
      // Validar se o clique teve efeito (opcional)
      if (validarClique && typeof validarClique === 'function') {
        await page.waitForTimeout(500); // Pequena pausa para o DOM atualizar
        
        const clickeValido = await validarClique(page);
        if (!clickeValido) {
          throw new Error(`Clique em '${seletor}' não teve o efeito esperado`);
        }
      }
    },
    'interacao',
    'clicar',
    {
      maxTentativas,
      delayEntreTentativas: 1000,
      onTentativa: (tentativa, max) => {
        logger.info(`Clicando em '${seletor}' - tentativa ${tentativa}/${max}`);
      }
    }
  );
}

/**
 * Função otimizada para preencher campo de texto
 * @param {Object} page - Instância da página Playwright
 * @param {string} seletor - Seletor CSS do campo
 * @param {string} texto - Texto a ser preenchido
 * @param {Object} opcoes - Opções de configuração
 * @returns {Promise<void>}
 */
async function preencherCampo(page, seletor, texto, opcoes = {}) {
  const {
    maxTentativas = 3,
    limparAntes = true,
    validarPreenchimento = true
  } = opcoes;

  return await TimeoutManager.executarComTimeout(
    async () => {
      // Aguardar campo estar disponível
      await aguardarElemento(page, seletor, { validarVisibilidade: true });
      
      // Focar no campo
      await page.focus(seletor);
      
      // Limpar campo se solicitado
      if (limparAntes) {
        await page.fill(seletor, '');
      }
      
      // Preencher texto
      await page.type(seletor, texto, { delay: 50 });
      
      // Validar preenchimento
      if (validarPreenchimento) {
        const valor = await page.inputValue(seletor);
        if (valor !== texto) {
          throw new Error(`Campo '${seletor}' não foi preenchido corretamente. Esperado: '${texto}', Atual: '${valor}'`);
        }
      }
    },
    'interacao',
    'digitar',
    {
      maxTentativas,
      delayEntreTentativas: 1000,
      onTentativa: (tentativa, max) => {
        logger.info(`Preenchendo campo '${seletor}' - tentativa ${tentativa}/${max}`);
      }
    }
  );
}

/**
 * Função para aguardar com timeout adaptativo
 * @param {number} tempoBase - Tempo base em milissegundos
 * @param {string} contexto - Contexto da operação para logs
 * @returns {Promise<void>}
 */
async function aguardarTempo(tempoBase, contexto = 'operacao') {
  const multiplicador = TimeoutManager.configuracaoAtual.multiplicador;
  const tempoFinal = Math.round(tempoBase * multiplicador);
  
  logger.info(`Aguardando ${tempoFinal}ms (${contexto})`);
  await new Promise(resolve => setTimeout(resolve, tempoFinal));
}

/**
 * Obtém estatísticas de performance do sistema
 * @returns {Object} Estatísticas detalhadas
 */
function obterEstatisticasPerformance() {
  return TimeoutManager.obterEstatisticas();
}

/**
 * Configura o modo de performance do sistema
 * @param {string} modo - Modo de operação (rapido, normal, lento, muitoLento)
 */
function configurarModoPerformance(modo) {
  TimeoutManager.configurarModo(modo);
  logger.info(`Modo de performance configurado: ${modo}`);
}

/**
 * Reseta o histórico de performance
 */
function resetarHistoricoPerformance() {
  TimeoutManager.resetarHistorico();
  logger.info('Histórico de performance resetado');
}

// Exportar todas as funções usando CommonJS
module.exports = {
  buscarElemento,
  obterTimeoutAdaptativo,
  obterTimeoutProgressivo,
  listarElementosDisponiveis,
  aguardarElemento,
  clicarElemento,
  preencherCampo,
  aguardarTempo,
  obterEstatisticasPerformance,
  configurarModoPerformance,
  resetarHistoricoPerformance,
  TimeoutManager,
  SeletorManager,
  NormalizadorTexto,
  Logger
};