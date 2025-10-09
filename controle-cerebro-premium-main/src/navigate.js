// Importar utilitários otimizados
const { 
  buscarElemento, 
  obterTimeoutAdaptativo, 
  obterTimeoutProgressivo,
  aguardarElemento, 
  clicarElemento,
  aguardarTempo,
  Logger 
} = require('./utils/index.js');
const { NormalizadorTexto } = require('./utils/normalizacao.js');

async function navegarParaCadastro(page, cpf, logger) {
  try {
    logger.info(`Iniciando navegação para cadastro do CPF: ${NormalizadorTexto.formatarCPF(cpf)}`);
    
    // Carregar configuração para obter a URL base
    const { loadConfig } = require('./util.js');
    const cfg = loadConfig();
    const baseUrl = (cfg.PJE_URL || 'https://pje.trt15.jus.br/primeirograu');
    const origin = (() => { 
      try { 
        return new URL(baseUrl).origin; 
      } catch (error) { 
        return 'https://pje.trt15.jus.br'; 
      } 
    })();
    
    // Navegação direta para página de pessoa física do TRT15 com CPF preenchido
    const urlComCpf = `${origin}/pjekz/pessoa-fisica?pagina=1&tamanhoPagina=10&cpf=${cpf}&situacao=1`;
    
    logger.info(`Navegando diretamente para: ${urlComCpf}`);
    await page.goto(urlComCpf, { 
      waitUntil: 'domcontentloaded',
      timeout: obterTimeoutAdaptativo('navegacao', 'normal')
    });
    
    // Aguardar carregamento da página
    await aguardarTempo(page, 'aguardarProcessamento');
    
    // Verificar se chegou na página correta
    const urlAtual = page.url();
    logger.debug(`URL atual após navegação: ${urlAtual}`);
    
    // Verificar se a página carregou corretamente
    const paginaCarregada = await page.evaluate(() => {
      return document.readyState === 'complete' && document.body && document.body.textContent.length > 0;
    });
    
    if (!paginaCarregada) {
      logger.warn('Página não carregou completamente, aguardando mais tempo...');
      await aguardarTempo(page, 'aguardarProcessamento');
    }
    
    logger.success('Navegação direta concluída, processando página...');
    await processarPaginaPessoaFisica(page, cpf, logger);
    
  } catch (error) {
    logger.error(`Erro na navegação para cadastro: ${error.message}`);
    throw new Error(`Falha na navegação para página de pessoa física: ${error.message}`);
  }
}

// Função auxiliar para navegação via menu (método original)
async function navegarViaMenu(page, cpf, logger) {
  logger.info('Procurando menu completo...');
  
  // Seletores otimizados para o menu completo
  const menuSelectors = [
    // Seletores específicos e mais prováveis
    'button:has-text("Menu completo")',
    'a:has-text("Menu completo")',
    'button[title*="Menu completo"]',
    'a[title*="Menu completo"]',
    
    // Seletores por classe/ID
    '.menu-completo',
    '#menu-completo',
    '.btn-menu-completo',
    
    // Seletores genéricos de menu
    'button:has-text("Menu")',
    'a:has-text("Menu")',
    '.btn:has-text("Menu")',
    'button[aria-label*="Menu"]',
    '[onclick*="menu"]',
    
    // Fallbacks case-insensitive
    'button:has-text("menu completo")',
    'a:has-text("menu completo")',
    'button[title*="menu completo"]',
    'a[title*="menu completo"]'
  ];
  
  // Usar utilitário otimizado para buscar e clicar no menu
  try {
    const menuButton = await buscarElemento(page, menuSelectors, {
      timeout: obterTimeoutAdaptativo('interacao', 'normal'),
      retries: 2,
      categoria: 'navegacao'
    });
    
    if (!menuButton) {
      logger.warn('Menu completo não encontrado. Listando elementos disponíveis...');
      const availableElements = await page.evaluate(() => {
        const elements = [];
        document.querySelectorAll('button, a').forEach(el => {
          const textContentProcessed = typeof el.textContent === 'string' 
            ? el.textContent 
            : (el.textContent && typeof el.textContent === 'object' && el.textContent.nome) 
                ? el.textContent.nome 
                : String(el.textContent || '');
          
          if (textContentProcessed.toLowerCase().includes('menu')) {
            elements.push({
              tag: el.tagName,
              text: textContentProcessed.trim(),
              id: el.id,
              className: el.className,
              title: el.title
            });
          }
        });
        return elements;
      });
      logger.debug('Elementos com "menu" encontrados:', availableElements);
      throw new Error('Menu completo não encontrado');
    }

    await clicarElemento(page, menuButton, {
      aguardarNavegacao: false,
      timeout: obterTimeoutAdaptativo('interacao', 'normal')
    });
    logger.success('Menu completo clicado');
    await aguardarTempo(page, 'aguardarModal');
    
  } catch (error) {
    logger.error(`Erro ao clicar no menu: ${error.message}`);
    throw error;
  }
  
  logger.info('Procurando opção "Pessoa Física" no menu...');
  
  // Seletores otimizados para "Pessoa Física"
  const pessoaFisicaSelectors = [
    // Seletores específicos e mais prováveis
    'a:has-text("Pessoa Física")',
    'button:has-text("Pessoa Física")',
    'a[title*="Pessoa Física"]',
    'button[title*="Pessoa Física"]',
    'a[href*="pessoa-fisica"]',
    
    // Seletores por classe/ID
    '.pessoa-fisica',
    '#pessoa-fisica',
    '.btn-pessoa-fisica',
    
    // Seletores genéricos
    'a:has-text("Pessoa")',
    'button:has-text("Pessoa")',
    'button[onclick*="pessoa-fisica"]',
    '[onclick*="pessoa"]',
    '.menu-item:has-text("Pessoa Física")',
    'li:has-text("Pessoa Física") a',
    'li:has-text("Pessoa Física") button',
    
    // Fallbacks case-insensitive
    'a:has-text("pessoa física")',
    'button:has-text("pessoa física")',
    'a[title*="pessoa física"]',
    'button[title*="pessoa física"]'
  ];

  try {
    const pessoaFisicaButton = await buscarElemento(page, pessoaFisicaSelectors, {
      timeout: obterTimeoutAdaptativo('interacao', 'normal'),
      retries: 2,
      categoria: 'navegacao'
    });
    
    if (!pessoaFisicaButton) {
      logger.warn('Opção "Pessoa Física" não encontrada. Listando elementos disponíveis...');
      const availableElements = await page.evaluate(() => {
        const elements = [];
        document.querySelectorAll('a, button, .menu-item, li').forEach(el => {
          const textContentProcessed = typeof el.textContent === 'string' 
            ? el.textContent 
            : (el.textContent && typeof el.textContent === 'object' && el.textContent.nome) 
                ? el.textContent.nome 
                : String(el.textContent || '');
          
          if (textContentProcessed && textContentProcessed.toLowerCase().includes('pessoa')) {
            elements.push({
              tagName: el.tagName,
              textContent: textContentProcessed?.trim().substring(0, 50),
              href: el.href,
              title: el.title,
              className: el.className
            });
          }
        });
        return elements;
      });
      logger.debug('Elementos com "pessoa" encontrados:', availableElements);
      throw new Error('Opção "Pessoa Física" não encontrada no menu');
    }

    await clicarElemento(page, pessoaFisicaButton, {
      aguardarNavegacao: true,
      timeout: obterTimeoutAdaptativo('navegacao', 'normal')
    });
    logger.success('Clicou na opção "Pessoa Física"');
    
    // Aguardar a página carregar completamente
    await aguardarTempo(page, 'aguardarProcessamento');
    
  } catch (error) {
    logger.error(`Erro ao clicar em Pessoa Física: ${error.message}`);
    throw error;
  }
  
  try {
    await page.waitForLoadState('networkidle', { timeout: 5000 });
  } catch (error) {
    await page.waitForLoadState('domcontentloaded', { timeout: 2000 });
  }
  
  // Processar a página atual sem navegação adicional
  await processarPaginaPessoaFisica(page, cpf, logger);
}

// Função auxiliar para processar a página de pessoa física
async function processarPaginaPessoaFisica(page, cpf, logger) {
  logger.info(`Processando página de pessoa física para CPF: ${NormalizadorTexto.formatarCPF(cpf)}`);
  // Função auxiliar para tentar múltiplos seletores
  const tentarMultiplosSeletores = async (seletores, opcoes = {}) => {
    const { timeout = 5000 } = opcoes;
    
    for (const seletor of seletores) {
      try {
        console.log(`Tentando seletor: ${seletor}`);
        await page.waitForSelector(seletor, { timeout: timeout / seletores.length });
        const elemento = await page.$(seletor);
        if (elemento) {
          const isVisible = await elemento.isVisible();
          if (isVisible) {
            console.log(`✓ Elemento encontrado e visível: ${seletor}`);
            return elemento;
          }
        }
      } catch (error) {
        console.log(`✗ Seletor falhou: ${seletor} - ${error.message}`);
      }
    }
    return null;
  };
  
  // Extrair apenas números do CPF
  const cpfNumerico = NormalizadorTexto.extrairNumeros(cpf);
  logger.info(`Procurando CPF ${cpfNumerico} na página...`);
  
  // Aguardar a página carregar completamente
  await aguardarTempo(page, 'aguardarProcessamento');
  
  // Aguardar tabela aparecer com timeout otimizado
  await page.waitForSelector('table', { timeout: 8000 });
  
  // Verificar se há resultados na tabela
  console.log('Verificando se há resultados na tabela...');
  const tableRows = await page.$$('table tbody tr');
  console.log(`DEBUG: Encontradas ${tableRows.length} linhas na tabela`);
  
  if (tableRows.length === 0) {
    throw new Error(`Nenhum resultado encontrado para o CPF: ${cpf}`);
  }
  
  // Verificar se há uma mensagem de "nenhum resultado"
  const noResultsMessage = await page.$('text=Nenhum resultado encontrado');
  if (noResultsMessage) {
    throw new Error(`Perito com CPF ${cpf} não encontrado no sistema`);
  }
  
  // Procurar e clicar no ícone do lápis (editar)
  console.log('Procurando ícone de edição (lápis)...');
  
  // Lista abrangente e melhorada de seletores para o ícone de edição (lápis)
  const editIconSelectors = [
    // Seletores específicos para PJE
    'a[href*="editar"]',
    'a[href*="edit"]',
    'button[onclick*="editar"]',
    'button[onclick*="edit"]',
    
    // Seletores por título/tooltip
    '[title="Editar"]',
    '[title="Editar dados"]', 
    '[title="Editar cadastro"]',
    '[title="Alterar"]',
    '[title="Modificar"]',
    '[alt="Editar"]',
    
    // Seletores por ícones FontAwesome e outros ícones
    '.fa-edit',
    '.fa-pencil',
    '.fa-pencil-alt', 
    '.fas.fa-edit',
    '.fas.fa-pencil-alt',
    '.far.fa-edit',
    'i.fa-edit',
    'i.fa-pencil',
    'i.fa-pencil-alt',
    
    // Seletores por posição na tabela
    'tr td:last-child button',
    'tr td:last-child a',
    'tr td:last-child .btn',
    'tbody tr td:last-child button',
    'tbody tr td:last-child a',
    'tr td:nth-last-child(1) button',
    'tr td:nth-last-child(1) a',
    'tr td:nth-last-child(2) button',
    'tr td:nth-last-child(2) a',
    
    // Seletores por classes comuns de botões de edição
    '.btn-edit',
    '.btn-editar', 
    '.edit-btn',
    '.editar-btn',
    '.action-edit',
    '.acao-editar',
    '.btn-primary',
    '.btn-secondary',
    
    // Seletores por atributos onclick
    '[onclick*="edit"]',
    '[onclick*="editar"]',
    '[onclick*="alterar"]',
    '[onclick*="modificar"]',
    '[onclick*="form"]',
    
    // Seletores genéricos para botões em tabelas
    'table button',
    'table a.btn',
    '.table button',
    '.table a.btn',
    'table a[href]',
    '.table a[href]',
    
    // Seletores por texto do botão (usando contains para maior compatibilidade)
    'button:contains("Editar")',
    'a:contains("Editar")',
    'button:contains("Alterar")',
    'a:contains("Alterar")',
    'button:contains("✏")',
    'a:contains("✏")',
    
    // Seletores por data attributes
    '[data-action="edit"]',
    '[data-action="editar"]',
    '[data-toggle="edit"]',
    '[data-function="edit"]',
    
    // Seletores mais específicos para sistemas PJE
    '.rich-table-cell button',
    '.rich-table-cell a',
    '.rf-dt-c button',
    '.rf-dt-c a',
    '.rich-table button',
    '.rich-table a',
    
    // Seletores por imagem de ícone
    'img[src*="edit"]',
    'img[src*="pencil"]',
    'img[src*="lapis"]',
    'img[alt*="Editar"]',
    
    // Seletores genéricos como último recurso
    'button',
    'a[href]:not([href="#"]):not([href="javascript:void(0)"])',
    'input[type="button"]',
    'input[type="submit"]'
  ];
  
  try {
    
    const editButton = await tentarMultiplosSeletores(editIconSelectors, {
      timeout: obterTimeoutAdaptativo('interacao', 'normal')
    });
    
    if (!editButton) {
      logger.warn('Ícone de edição não encontrado. Verificando se o CPF existe na página...');
      
      // Verificar se o CPF está presente na página
      const cpfFormatado = NormalizadorTexto.formatarCPF(cpfNumerico);
      
      const cpfEncontrado = await page.evaluate((cpfNum, cpfForm) => {
        const pageText = document.body.textContent || document.body.innerText || '';
        return pageText.includes(cpfNum) || pageText.includes(cpfForm);
      }, cpfNumerico, cpfFormatado);
      
      if (!cpfEncontrado) {
        throw new Error(`CPF ${cpf} não encontrado na página. Verifique se o CPF está correto ou se já está cadastrado.`);
      }
      
      // Debug: listar elementos clicáveis disponíveis
      logger.debug('Listando elementos clicáveis disponíveis...');
      const clickableElements = await page.evaluate(() => {
        const elements = [];
        document.querySelectorAll('button, a, i[class*="fa-"], [onclick]').forEach(el => {
          if (el.title || el.className.includes('fa-') || el.onclick) {
            elements.push({
              tagName: el.tagName,
              textContent: el.textContent?.trim().substring(0, 30),
              title: el.title,
              className: el.className,
              onclick: el.onclick?.toString().substring(0, 50)
            });
          }
        });
        return elements;
      });
      logger.debug('Elementos clicáveis encontrados:', clickableElements);
      
      throw new Error('Ícone de edição (lápis) não encontrado na página');
    }
    
    // Clicar no ícone de edição
    await editButton.click();
    
    // Aguardar navegação se necessário
    try {
      await page.waitForNavigation({ 
        timeout: obterTimeoutAdaptativo('interacao', 'normal'),
        waitUntil: 'domcontentloaded'
      });
    } catch (error) {
      // Navegação pode não ocorrer, continuar
      logger.debug('Navegação não detectada após clique no ícone de edição');
    }
    logger.success('Clicou no ícone de edição');
    
    // Aguardar a página de edição carregar
    await aguardarTempo(page, 'aguardarProcessamento');
    
  } catch (error) {
    logger.error(`Erro ao clicar no ícone de edição: ${error.message}`);
    throw error;
  }
  
  // Verificar se é um Perito ou Servidor
  logger.info('Verificando tipo de usuário (Perito vs Servidor)...');
  
  try {
    // Aguardar a página carregar completamente
    await aguardarTempo(page, 'aguardarProcessamento');
    
    // Seletores otimizados para abas
    const seletoresAbaPerito = [
      'text=Perito',
      'a[href*="perito"]',
      'button:has-text("Perito")',
      '.tab:has-text("Perito")',
      '[role="tab"]:has-text("Perito")',
      '.nav-link:has-text("Perito")',
      '[data-tab="perito"]'
    ];
    
    const seletoresAbaServidor = [
      'text=Servidor',
      'a[href*="servidor"]',
      'button:has-text("Servidor")',
      '.tab:has-text("Servidor")',
      '[role="tab"]:has-text("Servidor")',
      '.nav-link:has-text("Servidor")',
      '[data-tab="servidor"]'
    ];
    
    // Verificar se existem abas usando utilitários
    const abaPeritoExists = await tentarMultiplosSeletores(seletoresAbaPerito, {
      timeout: obterTimeoutAdaptativo('interacao', 'validacao')
    }) !== null;
    
    const abaServidorExists = await tentarMultiplosSeletores(seletoresAbaServidor, {
      timeout: obterTimeoutAdaptativo('interacao', 'validacao')
    }) !== null;
    
    // Verificar outros indicadores de servidor
    const indicadoresServidor = [
      'Dados do Servidor',
      'Informações do Servidor', 
      'Cadastro de Servidor',
      'Servidor Público',
      'Matrícula',
      'Cargo',
      'Lotação'
    ];
    
    let isServidor = abaServidorExists;
    
    if (!isServidor) {
      const pageText = await page.evaluate(() => document.body.textContent || '');
      const pageTextNormalizado = NormalizadorTexto.normalizar(pageText);
      
      for (const indicador of indicadoresServidor) {
        const indicadorNormalizado = NormalizadorTexto.normalizar(indicador);
        if (pageTextNormalizado.includes(indicadorNormalizado)) {
          isServidor = true;
          logger.debug(`Indicador de servidor encontrado: ${indicador}`);
          break;
        }
      }
    }
    
    if (isServidor) {
      logger.info(`Detectado que o CPF ${cpf} pertence a um SERVIDOR.`);
      
      // Primeiro, tentar clicar na aba "Servidor" se ela existir
      if (abaServidorExists) {
        logger.info('Clicando na aba "Servidor"...');
        
        try {
          const abaServidor = await tentarMultiplosSeletores(seletoresAbaServidor, {
            timeout: obterTimeoutAdaptativo('interacao', 'normal')
          });
          
          if (abaServidor) {
            await abaServidor.click();
            logger.success('Clicou na aba "Servidor"');
            await aguardarTempo(page, 'aguardarModal');
            
            // Aguardar carregamento da aba Servidor
            await aguardarTempo(page, 'aguardarProcessamento');
            
            logger.success('Aba "Servidor" carregada com sucesso');
            return; // Sair da função pois já estamos na aba correta
          }
        } catch (error) {
          logger.warn(`Erro ao clicar na aba "Servidor": ${error.message}`);
        }
      }
      
      // Se não conseguiu clicar na aba Servidor, tentar cadastrar como perito
      logger.info('Tentando cadastrar como perito... Procurando botão "Validar na Receita"...');
      
      const validarReceitaSelectors = [
        'button:has-text("Validar na Receita")',
        'input[value="Validar na Receita"]',
        'button[value="Validar na Receita"]',
        'a:has-text("Validar na Receita")',
        'text=Validar na Receita',
        '[title="Validar na Receita"]',
        'button:contains("Validar")',
        'input[type="button"]:contains("Validar")',
        '.btn:contains("Validar")',
        'button[onclick*="validar"]',
        'input[onclick*="validar"]'
      ];
      
      try {
        const validarButton = await tentarMultiplosSeletores(validarReceitaSelectors, {
          timeout: obterTimeoutAdaptativo('interacao', 'normal')
        });
        
        if (validarButton) {
          logger.info('Clicando no botão "Validar na Receita"...');
          await validarButton.click();
          
          // Aguardar navegação se necessário
          try {
            await page.waitForNavigation({ 
              timeout: obterTimeoutAdaptativo('interacao', 'normal'),
              waitUntil: 'domcontentloaded'
            });
          } catch (error) {
            // Navegação pode não ocorrer, continuar
            logger.debug('Navegação não detectada após clique no botão Validar na Receita');
          }
          logger.success('Clicou no botão "Validar na Receita"');
          
          // Aguardar processamento
          await aguardarTempo(page, 'aguardarProcessamento');
          
          // Verificar se agora apareceu a aba Perito
          const abaPeritoAposValidacao = await tentarMultiplosSeletores(seletoresAbaPerito, {
            timeout: obterTimeoutAdaptativo('interacao', 'validacao')
          }) !== null;
          
          if (abaPeritoAposValidacao) {
            logger.success('Aba "Perito" apareceu após validação na Receita');
          } else {
            logger.warn('Aba "Perito" ainda não apareceu após validação. Continuando...');
          }
        } else {
          logger.warn('Botão "Validar na Receita" não encontrado. Tentando continuar...');
        }
      } catch (error) {
        logger.warn(`Erro ao validar na Receita: ${error.message}`);
      }
    }
    
    if (!abaPeritoExists) {
      // Se não é servidor mas também não tem aba Perito, pode ser outro tipo de usuário
      logger.warn('Aba "Perito" não encontrada. Verificando se é outro tipo de usuário...');
      
      // Capturar todas as abas disponíveis para debug
      try {
        const abasDisponiveis = await page.evaluate(() => {
          const abas = Array.from(document.querySelectorAll('a, button, .tab, [role="tab"]'));
          return abas.map(aba => aba.textContent?.trim()).filter(texto => texto && texto.length > 0);
        });
        
        if (abasDisponiveis.length > 0) {
          logger.debug('Abas disponíveis encontradas:', abasDisponiveis);
          throw new Error(`ERRO: O CPF ${cpf} não parece ser de um PERITO. Abas disponíveis: ${abasDisponiveis.join(', ')}. Verifique se o CPF está correto.`);
        }
      } catch (debugError) {
        logger.debug('Debug de abas falhou:', debugError.message);
      }
      
      throw new Error(`ERRO: O CPF ${cpf} não possui aba "Perito" disponível. Verifique se o CPF pertence a um perito cadastrado no sistema.`);
    }
    
    logger.success('Confirmado: Usuário é um PERITO');
    
  } catch (error) {
    if (error.message.includes('ERRO:')) {
      throw error; // Re-lançar erros específicos de validação
    }
    logger.warn(`Erro na verificação de tipo de usuário: ${error.message}`);
    // Continuar mesmo com erro na verificação, assumindo que é perito
  }
  
  // Aguardar aba Perito aparecer e clicar
  const seletoresAbaPerito = [
    'text=Perito',
    'a[href*="perito"]',
    'button:has-text("Perito")',
    '.tab:has-text("Perito")',
    '[role="tab"]:has-text("Perito")',
    '.nav-link:has-text("Perito")',
    '[data-tab="perito"]'
  ];
  
  const abaPerito = await tentarMultiplosSeletores(seletoresAbaPerito, {
    timeout: obterTimeoutAdaptativo('interacao', 'critico')
  });
  
  if (!abaPerito) {
    throw new Error('Aba Perito não encontrada após verificações');
  }
  
  await abaPerito.click();
  logger.success('Clicou na aba Perito');
  
  // Aguardar carregamento da aba
  await aguardarTempo(page, 'aguardarModal');
  
  // Aguardar página carregar completamente
  await aguardarTempo(page, 'aguardarProcessamento');
  
  logger.success(`Navegação para página do perito CPF ${NormalizadorTexto.formatarCPF(cpf)} concluída com sucesso`);
}

module.exports = { navegarParaCadastro };
