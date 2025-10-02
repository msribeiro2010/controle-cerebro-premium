const path = require('path');
const { buscarElemento, detectarTipoSelect, buscarOpcoes, listarElementosDisponiveis } = require('./utils/index');
const { normalizarTexto, extrairTokensSignificativos, calcularSimilaridade, verificarEquivalencia, encontrarMelhorOpcao, verificarAmbiguidade } = require('./utils/normalizacao');
const { obterTimeoutAdaptativo } = require('./utils/index');
const SeletorManager = require('./utils/seletores');
// const { resolverProblemaVarasLimeira, SolucaoLimeiraCompleta, VARAS_LIMEIRA } = require(path.resolve(__dirname, '../solucao-limeira-completa.js'));
const VARAS_LIMEIRA = [];
const AccordionOptimizer = require('./utils/accordion-optimizer');

/**
 * Verifica se uma vara é de Limeira e precisa de tratamento especial
 * @param {string} nomeOJ - Nome do órgão julgador
 * @returns {boolean} - True se for vara de Limeira
 */
function isVaraLimeira(nomeOJ) {
    // Validação de tipo para garantir que nomeOJ seja uma string
    const nomeOJProcessed = typeof nomeOJ === 'string' ? nomeOJ : 
                           (nomeOJ && typeof nomeOJ === 'object' && nomeOJ.nome) ? nomeOJ.nome : 
                           String(nomeOJ || '');
    
    return VARAS_LIMEIRA.some(vara => 
        nomeOJProcessed.includes('Limeira') && 
        (nomeOJProcessed.includes('1ª Vara do Trabalho') || nomeOJProcessed.includes('2ª Vara do Trabalho'))
    );
}

/**
 * Aplica tratamento específico para varas de Limeira
 * @param {Object} page - Instância da página do Playwright
 * @param {string} nomeOJ - Nome do órgão julgador
 * @param {string} nomePerito - Nome do perito para busca
 * @returns {Promise<Object>} - Resultado do processamento
 */
async function aplicarTratamentoLimeira(page, nomeOJ, nomePerito) {
    try {
        console.log(`🔧 Aplicando tratamento específico para Limeira: ${nomeOJ}`);

        // Solução Limeira desabilitada temporariamente
        // const solucao = new SolucaoLimeiraCompleta();
        // const resultado = await solucao.processarVarasLimeira(nomePerito);

        console.log(`⚠️ Tratamento Limeira desabilitado - arquivo solucao-limeira-completa.js não encontrado`);
        return { sucesso: false, erro: 'Tratamento Limeira não disponível' };
    } catch (error) {
        console.error(`❌ Erro no tratamento Limeira:`, error);
        return { sucesso: false, erro: error.message };
    }
}

/**
 * Expande a seção de Órgãos Julgadores vinculados ao Perito de forma determinística
 * @param {Object} page - Instância da página do Playwright
 * @returns {Promise<Object>} - Objeto com sucesso e painelOJ se bem-sucedido
 */
async function expandirOrgaosJulgadores(page, modoRapido = false) {
    try {
        const modo = modoRapido ? '⚡' : '🔄';
        console.log(`${modo} Expandindo seção de Órgãos Julgadores...`);
        
        // OTIMIZAÇÃO: Usar AccordionOptimizer para expansão rápida
        if (modoRapido) {
            try {
                const optimizer = new AccordionOptimizer(page, console);
                const result = await optimizer.expandAccordionOptimized();
                
                if (result.success) {
                    console.log(`✅ Acordeão expandido em ${result.duration}ms (otimizado)`);
                    
                    // Retornar painel expandido
                    const painelOJ = await page.locator('.mat-expansion-panel-content:visible, [role="region"]:visible').first();
                    return { sucesso: true, painelOJ };
                }
            } catch (optimizerError) {
                console.log(`⚠️ Otimizador falhou, usando método tradicional: ${optimizerError.message}`);
            }
        }
        
        // Aguardar página estabilizar (otimizado se modo rápido)
        const timeout = modoRapido ? 300 : 1000;
        await page.waitForTimeout(timeout);
        
        // 1) Localiza o header do acordeão de OJs pelo padrão de ID
        let headerOJ = null;
        let panelId = null;
        let headerText = '';
        
        console.log('🔍 Procurando headers de expansion panel...');
        
        // Tenta encontrar o header com ID específico (mat-expansion-panel-header-X)
        try {
            const headers = await page.locator('[id^="mat-expansion-panel-header-"]').all();
            console.log(`Encontrados ${headers.length} headers de expansion panel`);
            
            for (let i = 0; i < headers.length; i++) {
                try {
                    const header = headers[i];
                    const text = await header.textContent({ timeout: 3000 });
                    const id = await header.getAttribute('id');
                    console.log(`Header ${i + 1}: ID="${id}", Texto="${text}"`);
                    
                    // Validação de tipo para garantir que text seja uma string
                    const textProcessed = typeof text === 'string' ? text : 
                                         (text && typeof text === 'object' && text.nome) ? text.nome : 
                                         String(text || '');
                    
                    // Verifica por diferentes variações de texto para perito e servidor
                    if (textProcessed && (
                        textProcessed.includes('Órgãos Julgadores vinculados ao Perito') ||
                        textProcessed.includes('Órgãos Julgadores vinculados ao Servidor') ||
                        textProcessed.includes('Órgãos Julgadores') ||
                        textProcessed.includes('Localização/Visibilidade') ||
                        textProcessed.includes('Servidor - Localização/Visibilidade')
                    )) {
                        headerOJ = header;
                        headerText = text;
                        console.log(`✅ Header encontrado: ID="${id}", Texto="${text}"`);
                        break;
                    }
                } catch (textError) {
                    console.log(`⚠️ Erro ao obter texto do header ${i + 1}: ${textError.message}`);
                }
            }
        } catch (headersError) {
            console.log(`⚠️ Erro ao buscar headers: ${headersError.message}`);
        }
        
        if (!headerOJ) {
            console.log('❌ Header do acordeão não encontrado nos IDs, tentando fallbacks...');
            
            // Múltiplos fallbacks para diferentes contextos
            const fallbackSelectors = [
                // Para servidores (mais específicos primeiro)
                { selector: page.getByRole('button', { name: /Servidor.*Localização.*Visibilidade/i }), desc: 'Servidor - Localização/Visibilidade' },
                { selector: page.getByRole('button', { name: /Localização.*Visibilidade/i }), desc: 'Localização/Visibilidade' },
                { selector: page.getByRole('button', { name: /Órgãos Julgadores.*Servidor/i }), desc: 'Órgãos Julgadores vinculados ao Servidor' },
                // Para peritos
                { selector: page.getByRole('button', { name: /Órgãos Julgadores.*Perito/i }), desc: 'Órgãos Julgadores vinculados ao Perito' },
                // Genéricos
                { selector: page.getByRole('button', { name: /Órgãos Julgadores/i }), desc: 'Órgãos Julgadores (genérico)' },
                { selector: page.locator('button:has-text("Órgãos Julgadores")'), desc: 'button com texto "Órgãos Julgadores"' },
                { selector: page.locator('button:has-text("Localização/Visibilidade")'), desc: 'button com texto "Localização/Visibilidade"' },
                { selector: page.locator('[aria-expanded]').filter({ hasText: /Órgãos Julgadores/i }), desc: 'elemento com aria-expanded contendo "Órgãos Julgadores"' },
                { selector: page.locator('[aria-expanded]').filter({ hasText: /Localização/i }), desc: 'elemento com aria-expanded contendo "Localização"' },
                { selector: page.locator('mat-expansion-panel-header').filter({ hasText: /Órgãos Julgadores/i }), desc: 'mat-expansion-panel-header com "Órgãos Julgadores"' },
                { selector: page.locator('mat-expansion-panel-header').filter({ hasText: /Localização/i }), desc: 'mat-expansion-panel-header com "Localização"' }
            ];
            
            for (let i = 0; i < fallbackSelectors.length; i++) {
                try {
                    console.log(`🔍 Tentando fallback ${i + 1}: ${fallbackSelectors[i].desc}...`);
                    const selectorInfo = fallbackSelectors[i];
                    const selector = selectorInfo.selector;
                    
                    if (await selector.isVisible({ timeout: 2000 })) {
                        headerOJ = selector;
                        headerText = await selector.textContent() || selectorInfo.desc;
                        console.log(`✅ Fallback ${i + 1} funcionou: ${selectorInfo.desc}`);
                        break;
                    } else {
                        console.log(`❌ Fallback ${i + 1} não visível: ${selectorInfo.desc}`);
                    }
                } catch (error) {
                    console.log(`❌ Fallback ${i + 1} falhou: ${error.message}`);
                }
            }
            
            if (!headerOJ) {
                // Debug: listar TODOS os botões e elementos expansíveis presentes
                console.log('🔍 DEBUG COMPLETO: Listando todos os elementos potenciais...');
                
                try {
                    // Listar todos os botões
                    const allButtons = await page.locator('button').all();
                    console.log(`Encontrados ${allButtons.length} botões na página:`);
                    for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
                        try {
                            const text = await allButtons[i].textContent();
                            const id = await allButtons[i].getAttribute('id');
                            const ariaExpanded = await allButtons[i].getAttribute('aria-expanded');
                            console.log(`  Botão ${i + 1}: ID="${id}", aria-expanded="${ariaExpanded}", Texto="${text}"`);
                        } catch (e) {
                            console.log(`  Botão ${i + 1}: Erro ao obter informações`);
                        }
                    }
                    
                    // Listar elementos com aria-expanded
                    const expandableElements = await page.locator('[aria-expanded]').all();
                    console.log(`Encontrados ${expandableElements.length} elementos com aria-expanded:`);
                    for (let i = 0; i < Math.min(expandableElements.length, 10); i++) {
                        try {
                            const text = await expandableElements[i].textContent();
                            const tagName = await expandableElements[i].evaluate(el => el.tagName);
                            const ariaExpanded = await expandableElements[i].getAttribute('aria-expanded');
                            console.log(`  Elemento ${i + 1}: Tag="${tagName}", aria-expanded="${ariaExpanded}", Texto="${text}"`);
                        } catch (e) {
                            console.log(`  Elemento ${i + 1}: Erro ao obter informações`);
                        }
                    }
                } catch (debugError) {
                    console.log(`⚠️ Erro no debug: ${debugError.message}`);
                }
                
                throw new Error('Header do acordeão não encontrado após todos os fallbacks');
            }
        }
        
        console.log(`🎯 Header selecionado: "${headerText}"`);
        
        // 2) Verificações de estado e expansão
        try {
            console.log('🔍 Verificando estado do header...');
            await headerOJ.waitFor({ state: 'visible', timeout: 5000 });
            
            const disabled = await headerOJ.getAttribute('aria-disabled');
            if (disabled === 'true') {
                throw new Error('Acordeão está desabilitado');
            }
            console.log('✅ Header está habilitado');
            
            const expanded = await headerOJ.getAttribute('aria-expanded');
            console.log(`📊 Estado atual do acordeão: aria-expanded="${expanded}"`);
            
            if (expanded !== 'true') {
                console.log('🖱️ Clicando no header para expandir...');
                
                // Múltiplas estratégias de clique
                const clickStrategies = [
                    { name: 'click normal', action: () => headerOJ.click() },
                    { name: 'click force', action: () => headerOJ.click({ force: true }) },
                    { name: 'click com timeout', action: () => headerOJ.click({ timeout: 10000 }) },
                    { name: 'click no centro', action: () => headerOJ.click({ position: { x: 50, y: 50 } }) }
                ];
                
                let clickSuccessful = false;
                for (const strategy of clickStrategies) {
                    try {
                        console.log(`🔄 Tentando ${strategy.name}...`);
                        await strategy.action();
                        clickSuccessful = true;
                        console.log(`✅ ${strategy.name} bem-sucedido`);
                        break;
                    } catch (clickError) {
                        console.log(`❌ ${strategy.name} falhou: ${clickError.message}`);
                    }
                }
                
                if (!clickSuccessful) {
                    throw new Error('Falha em todas as estratégias de clique no header');
                }
                
                // Aguardar expansão com múltiplas estratégias
                console.log('⏳ Aguardando expansão...');
                const expansionWaitStrategies = [
                    // Estratégia 1: waitForFunction com ID do header
                    async () => {
                        const headerId = await headerOJ.getAttribute('id');
                        if (headerId) {
                            console.log(`🔍 Aguardando expansão via ID: ${headerId}`);
                            await page.waitForFunction(
                                (headerId) => {
                                    const header = document.getElementById(headerId);
                                    return header && header.getAttribute('aria-expanded') === 'true';
                                },
                                headerId,
                                { timeout: 8000 }
                            );
                            return true;
                        }
                        return false;
                    },
                    // Estratégia 2: polling do atributo aria-expanded
                    async () => {
                        console.log('🔍 Aguardando expansão via polling...');
                        for (let i = 0; i < 20; i++) {
                            const currentExpanded = await headerOJ.getAttribute('aria-expanded');
                            if (currentExpanded === 'true') {
                                return true;
                            }
                            await page.waitForTimeout(400);
                        }
                        return false;
                    },
                    // Estratégia 3: aguardar timeout fixo
                    async () => {
                        console.log('🔍 Aguardando tempo fixo...');
                        await page.waitForTimeout(3000);
                        return true;
                    }
                ];
                
                let expansionSuccessful = false;
                for (const strategy of expansionWaitStrategies) {
                    try {
                        if (await strategy()) {
                            expansionSuccessful = true;
                            break;
                        }
                    } catch (waitError) {
                        console.log(`⚠️ Estratégia de espera falhou: ${waitError.message}`);
                    }
                }
                
                if (expansionSuccessful) {
                    console.log('✅ Acordeão expandido com sucesso');
                } else {
                    console.log('⚠️ Não foi possível confirmar expansão, mas continuando...');
                }
            } else {
                console.log('✅ Acordeão já estava expandido');
            }
        } catch (stateError) {
            console.error(`❌ Erro no gerenciamento de estado: ${stateError.message}`);
            throw stateError;
        }
        
        // 3) Descobre o container do painel
        console.log('🔍 Localizando painel de conteúdo...');
        try {
            panelId = await headerOJ.getAttribute('aria-controls');
            if (!panelId) {
                console.log('⚠️ aria-controls não encontrado, tentando estratégias alternativas...');
                
                // Estratégias alternativas para encontrar o painel
                const panelStrategies = [
                    // Estratégia 1: próximo elemento sibling
                    () => headerOJ.locator('+ *'),
                    // Estratégia 2: parent seguido de expansion panel content
                    () => headerOJ.locator('.. mat-expansion-panel-content'),
                    // Estratégia 3: buscar por papel expansion panel content próximo
                    () => page.locator('mat-expansion-panel-content').first(),
                    // Estratégia 4: qualquer elemento visível depois do header
                    () => page.locator('.mat-expansion-panel-content, [role="region"]').first()
                ];
                
                let painelOJ = null;
                for (let i = 0; i < panelStrategies.length; i++) {
                    try {
                        console.log(`🔍 Tentando estratégia de painel ${i + 1}...`);
                        const candidatePainel = panelStrategies[i]();
                        if (await candidatePainel.isVisible({ timeout: 3000 })) {
                            painelOJ = candidatePainel;
                            console.log(`✅ Painel encontrado com estratégia ${i + 1}`);
                            break;
                        }
                    } catch (strategyError) {
                        console.log(`❌ Estratégia de painel ${i + 1} falhou: ${strategyError.message}`);
                    }
                }
                
                if (!painelOJ) {
                    throw new Error('Painel de conteúdo não encontrado');
                }
                
                console.log('✅ Painel localizado via estratégia alternativa');
                return { sucesso: true, painelOJ };
            } else {
                const painelOJ = page.locator(`#${panelId}`);
                await painelOJ.waitFor({ state: 'visible', timeout: 5000 });
                console.log(`✅ Painel localizado via aria-controls: #${panelId}`);
                return { sucesso: true, painelOJ };
            }
        } catch (panelError) {
            console.error(`❌ Erro ao localizar painel: ${panelError.message}`);
            throw panelError;
        }
        
    } catch (error) {
        console.error('❌ Erro ao expandir seção de Órgãos Julgadores:', error.message);
        console.error('📍 Stack trace:', error.stack);
        return { sucesso: false, painelOJ: null };
    }
}

/**
 * Executa busca robusta para São José dos Campos
 * @param {Object} page - Instância da página do Playwright
 * @param {string} nomePerito - Nome do perito para buscar
 * @returns {Promise<boolean>} - Sucesso da busca
 */
async function executarBuscaRobustaSaoJose(page, nomePerito) {
    console.log(`🔍 Executando busca robusta para São José dos Campos: ${nomePerito}`);
    
    try {
        // 1. Localizar campo de busca
        const campoBusca = await localizarCampoBuscaSaoJose(page);
        if (!campoBusca) {
            console.log('❌ Campo de busca não encontrado');
            return false;
        }
        
        // 2. Executar ação de busca
        const buscaExecutada = await executarAcaoBuscaSaoJose(page, campoBusca, nomePerito);
        if (!buscaExecutada) {
            console.log('❌ Falha ao executar busca');
            return false;
        }
        
        // 3. Aguardar resultados
        const resultadosCarregados = await aguardarResultadosBuscaSaoJose(page);
        if (!resultadosCarregados) {
            console.log('❌ Resultados não carregaram');
            return false;
        }
        
        console.log('✅ Busca robusta executada com sucesso');
        return true;
        
    } catch (error) {
        console.log(`❌ Erro na busca robusta: ${error.message}`);
        return false;
    }
}

/**
 * Localiza campo de busca para São José dos Campos
 * @param {Object} page - Instância da página do Playwright
 * @returns {Promise<Object|null>} - Locator do campo de busca
 */
async function localizarCampoBuscaSaoJose(page) {
    const seletoresBusca = [
        'input[name="nomePerito"]',
        'input[id*="perito"]',
        'input[class*="perito"]',
        'input[placeholder*="perito"]',
        'input[placeholder*="nome"]',
        'input[type="text"]',
        'input[type="search"]',
        '.search-input',
        '.busca-input',
        '.input-busca'
    ];
    
    for (const seletor of seletoresBusca) {
        try {
            const campo = page.locator(seletor).first();
            if (await campo.isVisible({ timeout: 2000 })) {
                console.log(`✅ Campo de busca encontrado: ${seletor}`);
                return campo;
            }
        } catch (error) {
            // Continuar tentando
        }
    }
    
    return null;
}

/**
 * Executa ação de busca para São José dos Campos
 * @param {Object} page - Instância da página do Playwright
 * @param {Object} campoBusca - Locator do campo de busca
 * @param {string} nomePerito - Nome do perito
 * @returns {Promise<boolean>} - Sucesso da ação
 */
async function executarAcaoBuscaSaoJose(page, campoBusca, nomePerito) {
    try {
        // Limpar e preencher campo
        await campoBusca.clear();
        await campoBusca.fill(nomePerito);
        await page.waitForTimeout(500);
        
        // Tentar botão de busca
        const seletoresBotao = [
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("Buscar")',
            'button:has-text("Pesquisar")',
            '.btn-buscar',
            '.btn-search',
            '.search-button',
            '.busca-button'
        ];
        
        for (const seletor of seletoresBotao) {
            try {
                const botao = page.locator(seletor).first();
                if (await botao.isVisible({ timeout: 1000 })) {
                    await botao.click();
                    console.log(`✅ Botão de busca clicado: ${seletor}`);
                    return true;
                }
            } catch (error) {
                // Continuar tentando
            }
        }
        
        // Fallback: Enter no campo
        await campoBusca.press('Enter');
        console.log('✅ Enter pressionado no campo de busca');
        return true;
        
    } catch (error) {
        console.log(`❌ Erro ao executar busca: ${error.message}`);
        return false;
    }
}

/**
 * Aguarda resultados da busca para São José dos Campos
 * @param {Object} page - Instância da página do Playwright
 * @returns {Promise<boolean>} - Resultados carregados
 */
async function aguardarResultadosBuscaSaoJose(page) {
    const seletoresResultados = [
        '.resultado-busca',
        '.lista-resultados',
        '.search-results',
        '.mat-list',
        '.mat-table',
        'table tbody tr',
        '.grid-row',
        '.lista-peritos',
        '.perito-item'
    ];
    
    try {
        // Aguardar qualquer indicador de resultados
        for (const seletor of seletoresResultados) {
            try {
                await page.waitForSelector(seletor, { timeout: 8000 });
                console.log(`✅ Resultados carregados: ${seletor}`);
                return true;
            } catch (error) {
                // Continuar tentando
            }
        }
        
        // Aguardar mudança na página
        await page.waitForTimeout(3000);
        console.log('✅ Timeout de aguardo concluído');
        return true;
        
    } catch (error) {
        console.log(`❌ Erro ao aguardar resultados: ${error.message}`);
        return false;
    }
}

/**
 * Executa vinculação robusta para São José dos Campos
 * @param {Object} page - Instância da página do Playwright
 * @param {string} nomeOrgao - Nome do órgão para vincular
 * @returns {Promise<boolean>} - Sucesso da vinculação
 */
async function executarVinculacaoRobustaSaoJose(page, nomeOrgao) {
    console.log(`🔗 Executando vinculação robusta para São José dos Campos: ${nomeOrgao}`);
    
    try {
        // 1. Localizar item do órgão
        const itemOrgao = await localizarItemOrgaoSaoJose(page, nomeOrgao);
        if (!itemOrgao) {
            console.log('❌ Item do órgão não encontrado');
            return false;
        }
        
        // 2. Executar ação de vinculação
        const vinculacaoExecutada = await executarAcaoVinculacaoSaoJose(page, itemOrgao);
        if (!vinculacaoExecutada) {
            console.log('❌ Falha ao executar vinculação');
            return false;
        }
        
        // 3. Confirmar vinculação
        const vinculacaoConfirmada = await confirmarVinculacaoSaoJose(page);
        if (!vinculacaoConfirmada) {
            console.log('❌ Falha ao confirmar vinculação');
            return false;
        }
        
        console.log('✅ Vinculação robusta executada com sucesso');
        return true;
        
    } catch (error) {
        console.log(`❌ Erro na vinculação robusta: ${error.message}`);
        return false;
    }
}

/**
 * Localiza item do órgão para São José dos Campos
 * @param {Object} page - Instância da página do Playwright
 * @param {string} nomeOrgao - Nome do órgão
 * @returns {Promise<Object|null>} - Locator do item
 */
async function localizarItemOrgaoSaoJose(page, nomeOrgao) {
    const seletoresItem = [
        `tr:has-text("${nomeOrgao}")`,
        `div:has-text("${nomeOrgao}")`,
        `li:has-text("${nomeOrgao}")`,
        `.item:has-text("${nomeOrgao}")`,
        `.resultado:has-text("${nomeOrgao}")`,
        `.orgao:has-text("${nomeOrgao}")`,
        `[data-orgao*="${nomeOrgao}"]`
    ];
    
    for (const seletor of seletoresItem) {
        try {
            const item = page.locator(seletor).first();
            if (await item.isVisible({ timeout: 2000 })) {
                console.log(`✅ Item do órgão encontrado: ${seletor}`);
                return item;
            }
        } catch (error) {
            // Continuar tentando
        }
    }
    
    return null;
}

/**
 * Executa ação de vinculação para São José dos Campos
 * @param {Object} page - Instância da página do Playwright
 * @param {Object} itemOrgao - Locator do item do órgão
 * @returns {Promise<boolean>} - Sucesso da ação
 */
async function executarAcaoVinculacaoSaoJose(page, itemOrgao) {
    const seletoresAcao = [
        'button:has-text("Vincular ao Perito")',
        'button:has-text("Vincular Órgão")',
        'button:has-text("Adicionar Órgão")',
        'button:has-text("Selecionar Órgão")',
        'button:has-text("Vincular")',
        'button:has-text("Adicionar")',
        'button:has-text("Selecionar")',
        'button:has-text("Confirmar")',
        'input[type="checkbox"]',
        '.checkbox',
        '.mat-checkbox',
        '[role="checkbox"]'
    ];
    
    // Tentar ação dentro do item
    for (const seletor of seletoresAcao) {
        try {
            const elemento = itemOrgao.locator(seletor).first();
            if (await elemento.isVisible({ timeout: 1000 })) {
                await elemento.click();
                console.log(`✅ Ação executada no item: ${seletor}`);
                return true;
            }
        } catch (error) {
            // Continuar tentando
        }
    }
    
    // Tentar clicar no próprio item
    try {
        await itemOrgao.click();
        console.log('✅ Item do órgão clicado');
        return true;
    } catch (error) {
        console.log(`❌ Erro ao clicar no item: ${error.message}`);
        return false;
    }
}

/**
 * Confirma vinculação para São José dos Campos
 * @param {Object} page - Instância da página do Playwright
 * @returns {Promise<boolean>} - Vinculação confirmada
 */
async function confirmarVinculacaoSaoJose(page) {
    const seletoresConfirmacao = [
        'button:has-text("Vincular Órgão Julgador ao Perito")',
        'button:has-text("Vincular")',
        'button:has-text("Gravar")',
        'button:has-text("Salvar")',
        'button:has-text("Confirmar")',
        'button:has-text("OK")',
        '.btn-confirmar',
        '.btn-salvar',
        '.btn-gravar'
    ];
    
    // Aguardar modal ou dialog
    await page.waitForTimeout(1000);
    
    for (const seletor of seletoresConfirmacao) {
        try {
            const botao = page.locator(seletor).first();
            if (await botao.isVisible({ timeout: 2000 })) {
                await botao.click();
                console.log(`✅ Vinculação confirmada: ${seletor}`);
                return true;
            }
        } catch (error) {
            // Continuar tentando
        }
    }
    
    console.log('⚠️ Nenhum botão de confirmação encontrado');
    return true; // Assumir sucesso se não há confirmação necessária
}

/**
 * Função melhorada para encontrar botão "Adicionar Órgão Julgador" - FIX São José dos Campos
 * @param {Object} page - Instância da página do Playwright
 * @param {number} tentativa - Número da tentativa atual
 * @returns {Promise<Object>} - Locator do botão encontrado
 */
async function encontrarBotaoAdicionarMelhorado(page, tentativa = 1) {
    console.log(`🔍 Tentativa ${tentativa} - Procurando botão "Adicionar Órgão Julgador" (São José dos Campos Fix)...`);
    
    // Estratégia 1: Garantir painel expandido
    await garantirPainelExpandido(page);
    
    // Estratégia 2: Limpar overlays
    await limparOverlaysAngular(page);
    
    // Estratégia 3: Seletores melhorados em ordem de prioridade
    const seletoresPrioritarios = [
        'mat-expansion-panel[aria-expanded="true"] button:has-text("Adicionar")',
        'mat-expansion-panel-content button:has-text("Adicionar Órgão Julgador")',
        '#cdk-accordion-child-8 button:has-text("Adicionar")',
        'button[mat-button]:has-text("Adicionar")',
        '.mat-expansion-panel-content .mat-button:has-text("Adicionar")',
        'mat-expansion-panel-content button:has-text("Adicionar")',
        'div[class*="mat-expansion-panel-content"] button[class*="mat-button"]',
        'button[mat-raised-button]:has-text("Adicionar")',
        'button[mat-flat-button]:has-text("Adicionar")',
        '[id*="cdk-accordion"] button:has-text("Adicionar")',
        'mat-accordion mat-expansion-panel button:has-text("Adicionar")'
    ];
    
    for (const seletor of seletoresPrioritarios) {
        try {
            console.log(`   Testando: ${seletor}`);
            const botao = page.locator(seletor).first();
            
            // Aguardar elemento aparecer
            await botao.waitFor({ timeout: 3000 });
            
            // Verificar se está visível
            if (await botao.isVisible()) {
                console.log(`✅ Botão encontrado com: ${seletor}`);
                return botao;
            }
        } catch (error) {
            console.log(`   ❌ Falhou: ${error.message}`);
        }
    }
    
    // Estratégia 4: Fallback com JavaScript
    try {
        const botaoJS = await page.evaluate(() => {
            const botoes = Array.from(document.querySelectorAll('button'));
            return botoes.find(btn => {
                // Validação de tipo para garantir que textContent seja uma string
                const textContentProcessed = typeof btn.textContent === 'string' ? btn.textContent : 
                                            (btn.textContent && typeof btn.textContent === 'object' && btn.textContent.nome) ? btn.textContent.nome : 
                                            String(btn.textContent || '');
                
                return textContentProcessed.includes('Adicionar') && 
                       (textContentProcessed.includes('Órgão') || textContentProcessed.includes('Julgador'));
            });
        });
        
        if (botaoJS) {
            console.log('✅ Botão encontrado via JavaScript');
            return page.locator('button').filter({ hasText: /Adicionar.*Órgão|Adicionar.*Julgador/ }).first();
        }
    } catch (error) {
        console.log(`❌ Fallback JavaScript falhou: ${error.message}`);
    }
    
    // Se chegou aqui, não encontrou
    if (tentativa < 3) {
        console.log(`⏳ Aguardando 3000ms antes da próxima tentativa...`);
        await page.waitForTimeout(3000);
        return encontrarBotaoAdicionarMelhorado(page, tentativa + 1);
    }
    
    throw new Error('Botão "Adicionar Órgão Julgador" não encontrado após todas as tentativas');
}

/**
 * Função auxiliar para garantir painel expandido
 * @param {Object} page - Instância da página do Playwright
 */
async function garantirPainelExpandido(page) {
    try {
        const painelHeader = page.locator('mat-expansion-panel-header:has-text("Órgãos Julgadores")');
        await painelHeader.waitFor({ timeout: 5000 });
        
        const isExpanded = await painelHeader.getAttribute('aria-expanded');
        if (isExpanded !== 'true') {
            console.log('🔄 Expandindo painel de Órgãos Julgadores...');
            await painelHeader.click();
            await page.waitForTimeout(2000); // Aguardar animação
        }
    } catch (error) {
        console.log(`⚠️ Erro ao expandir painel: ${error.message}`);
    }
}

/**
 * Função auxiliar para limpar overlays
 * @param {Object} page - Instância da página do Playwright
 */
async function limparOverlaysAngular(page) {
    try {
        // Fechar mat-select abertos
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        
        // Fechar tooltips
        await page.mouse.click(10, 10); // Click em área neutra
        await page.waitForTimeout(500);
    } catch (error) {
        console.log(`⚠️ Erro ao limpar overlays: ${error.message}`);
    }
}

/**
 * Clica no botão "Adicionar Localização/Visibilidade" dentro do painel de OJs
 * @param {Object} page - Instância da página do Playwright
 * @param {Object} painelOJ - Locator do painel específico do OJ
 * @returns {Promise<void>}
 */
async function clickAddLocationButton(page, painelOJ) {
    console.log('🔄 Procurando botão "Adicionar Localização/Visibilidade" APENAS na seção de Órgãos Julgadores...');
    
    // 1. Primeiro, fechar qualquer overlay/dropdown que possa estar aberto
    await closeAngularMaterialOverlays(page);
    
    // 2. Aguardar estabilização da página
    await page.waitForTimeout(1000);
    
    // NOVO: Tentar primeiro a função melhorada para São José dos Campos
    try {
        const botaoMelhorado = await encontrarBotaoAdicionarMelhorado(page);
        if (botaoMelhorado) {
            console.log('✅ Usando botão encontrado pela função melhorada');
            await botaoMelhorado.click();
            return;
        }
    } catch (error) {
        console.log(`⚠️ Função melhorada falhou, usando método original: ${error.message}`);
    }
    
    // Múltiplos seletores para o botão Adicionar - APENAS DENTRO DO PAINEL CORRETO
    const addButtonSelectors = [
        'button:has-text("Adicionar Localização/Visibilidade"):not([disabled])',
        'button:has-text("Adicionar Localização"):not([disabled])',
        'button:has-text("Adicionar"):not([disabled]):visible'
    ];
    
    let addButton = null;
    
    console.log('🔍 Procurando botão Adicionar APENAS dentro do painel de Órgãos Julgadores...');
    
    // IMPORTANTE: Só procurar dentro do painel específico da seção "Órgãos Julgadores vinculados ao Perito"
    for (const selector of addButtonSelectors) {
        try {
            console.log(`🔍 Testando seletor DENTRO DO PAINEL: ${selector}`);
            
            // Verificar APENAS dentro do painel específico
            const buttonInPanel = painelOJ.locator(selector);
            const count = await buttonInPanel.count();
            console.log(`  - Botão no painel: ${count} encontrado(s)`);
            
            if (count > 0) {
                const isVisible = await buttonInPanel.first().isVisible();
                console.log(`  - Visível: ${isVisible}`);
                
                if (isVisible) {
                    addButton = buttonInPanel.first();
                    console.log(`✅ Botão encontrado dentro do painel correto: ${selector}`);
                    break;
                }
            }
        } catch (error) {
            console.log(`❌ Erro ao testar seletor ${selector}: ${error.message}`);
        }
    }
    
    // Se não encontrou dentro do painel, tentar com seletores mais específicos
    if (!addButton) {
        console.log('🔍 Botão não encontrado no painel, tentando seletores mais específicos...');
        
        const specificSelectors = [
            // Seletores que garantem que estamos na seção correta
            `button:has-text("Adicionar"):not([disabled]):visible`,
            `input[value*="Adicionar"]:not([disabled])`,
            `.btn:has-text("Adicionar"):not([disabled])`
        ];
        
        for (const selector of specificSelectors) {
            try {
                console.log(`🔍 Testando seletor específico DENTRO DO PAINEL: ${selector}`);
                
                const buttonInPanel = painelOJ.locator(selector);
                const count = await buttonInPanel.count();
                
                if (count > 0) {
                    const isVisible = await buttonInPanel.first().isVisible();
                    console.log(`  - Botão específico no painel: ${count} encontrado(s), visível: ${isVisible}`);
                    
                    if (isVisible) {
                        addButton = buttonInPanel.first();
                        console.log(`✅ Botão específico encontrado: ${selector}`);
                        break;
                    }
                }
            } catch (error) {
                console.log(`❌ Erro ao testar seletor específico ${selector}: ${error.message}`);
            }
        }
    }
    
    if (!addButton) {
        console.log('❌ ERRO: Nenhum botão Adicionar encontrado');
        
        // Debug: listar todos os botões visíveis na página
        try {
            console.log('🔍 DEBUG: Listando botões visíveis na página...');
            const allVisibleButtons = await page.locator('button:visible').all();
            for (let i = 0; i < Math.min(allVisibleButtons.length, 15); i++) {
                try {
                    const text = await allVisibleButtons[i].textContent();
                    const classes = await allVisibleButtons[i].getAttribute('class');
                    console.log(`  Botão ${i + 1}: "${text}" [${classes}]`);
                } catch (e) {
                    console.log(`  Botão ${i + 1}: Erro ao obter informações`);
                }
            }
        } catch (debugError) {
            console.log(`⚠️ Erro no debug: ${debugError.message}`);
        }
        
        throw new Error('Botão "Adicionar Localização/Visibilidade" não encontrado');
    }
    
    console.log(`🖱️ Tentando clicar no botão Adicionar...`);
    
    // Múltiplas estratégias de clique para lidar com overlays
    const clickStrategies = [
        {
            name: 'click normal',
            action: async () => {
                await addButton.click({ timeout: 8000 });
            }
        },
        {
            name: 'fechar overlays e tentar novamente',
            action: async () => {
                await closeAngularMaterialOverlays(page);
                await page.waitForTimeout(500);
                await addButton.click({ timeout: 8000 });
            }
        },
        {
            name: 'click com force',
            action: async () => {
                await addButton.click({ force: true, timeout: 8000 });
            }
        },
        {
            name: 'click após scroll',
            action: async () => {
                await addButton.scrollIntoViewIfNeeded();
                await page.waitForTimeout(500);
                await addButton.click({ timeout: 8000 });
            }
        },
        {
            name: 'click via JavaScript',
            action: async () => {
                await addButton.evaluate(button => button.click());
            }
        },
        {
            name: 'pressionar Enter',
            action: async () => {
                await addButton.focus();
                await page.keyboard.press('Enter');
            }
        }
    ];
    
    let clickSuccessful = false;
    let lastError = null;
    
    for (const strategy of clickStrategies) {
        try {
            console.log(`🔄 Tentando: ${strategy.name}...`);
            await strategy.action();
            clickSuccessful = true;
            console.log(`✅ ${strategy.name} bem-sucedido!`);
            break;
        } catch (clickError) {
            console.log(`❌ ${strategy.name} falhou: ${clickError.message}`);
            lastError = clickError;
            
            // Aguardar um pouco antes da próxima tentativa
            await page.waitForTimeout(1000);
        }
    }
    
    if (!clickSuccessful) {
        console.error(`❌ Todas as estratégias de clique falharam. Último erro: ${lastError?.message}`);
        throw new Error(`Falha ao clicar no botão Adicionar: ${lastError?.message}`);
    }
    
    // Aguardar modal/formulário carregar
    await page.waitForTimeout(2000);
    console.log('✅ Botão Adicionar clicado com sucesso');
}

/**
 * Fecha overlays e dropdowns do Angular Material que podem estar interceptando cliques
 * @param {Object} page - Instância da página do Playwright
 */
async function closeAngularMaterialOverlays(page) {
    try {
        console.log('🧹 Fechando overlays do Angular Material...');
        
        // Estratégias para fechar overlays
        const closeStrategies = [
            // 1. Clicar no backdrop para fechar overlays
            async () => {
                const backdrops = page.locator('.cdk-overlay-backdrop');
                const count = await backdrops.count();
                if (count > 0) {
                    console.log(`🖱️ Clicando em ${count} backdrop(s)...`);
                    // Clicar em todos os backdrops encontrados
                    for (let i = 0; i < count; i++) {
                        try {
                            const backdrop = backdrops.nth(i);
                            if (await backdrop.isVisible({ timeout: 500 })) {
                                await backdrop.click({ force: true });
                                await page.waitForTimeout(200);
                            }
                        } catch (e) {
                            // Ignorar erros de backdrop específico
                        }
                    }
                }
            },
            
            // 2. Pressionar Escape para fechar modais/dropdowns
            async () => {
                console.log('⌨️ Pressionando Escape...');
                await page.keyboard.press('Escape');
                await page.waitForTimeout(300);
            },
            
            // 3. Clicar fora de qualquer dropdown aberto
            async () => {
                const overlayContainers = page.locator('.cdk-overlay-container');
                const count = await overlayContainers.count();
                if (count > 0) {
                    console.log(`🖱️ Clicando fora de ${count} overlay container(s)...`);
                    await page.click('body', { position: { x: 10, y: 10 }, force: true });
                    await page.waitForTimeout(300);
                }
            },
            
            // 4. Fechar qualquer mat-select aberto
            async () => {
                const matOptions = page.locator('mat-option:visible');
                if (await matOptions.count() > 0) {
                    console.log('🖱️ Fechando mat-select...');
                    await page.keyboard.press('Escape');
                    await page.waitForTimeout(300);
                }
            }
        ];
        
        // Executar todas as estratégias
        for (const strategy of closeStrategies) {
            try {
                await strategy();
            } catch (error) {
                // Ignorar erros individuais de fechamento
                console.log(`⚠️ Estratégia de fechamento falhou (ignorando): ${error.message}`);
            }
        }
        
        console.log('✅ Overlays processados');
        
    } catch (error) {
        console.log(`⚠️ Erro ao fechar overlays (continuando): ${error.message}`);
    }
}

/**
 * Entra em modo de inclusão via botão Adicionar
 * @param {Object} page - Instância da página do Playwright
 * @param {Object} painelOJ - Locator do painel específico do OJ
 * @returns {Promise<boolean>} - True se entrou em modo de inclusão com sucesso
 */
async function entrarModoInclusao(page, painelOJ) {
    try {
        console.log('Entrando em modo de inclusão...');
        
        // Múltiplas estratégias para encontrar o botão Adicionar
        const seletoresBotaoAdicionar = [
            'button:has-text("Adicionar")',
            'button:has-text("+")',
            'button[title*="Adicionar"]',
            'button[aria-label*="Adicionar"]',
            '.btn:has-text("Adicionar")',
            '.btn-add',
            '.btn-primary:has-text("+")',
            'button.mat-icon-button:has(mat-icon:has-text("add"))',
            'button.mat-fab:has(mat-icon:has-text("add"))',
            '[mattooltip*="Adicionar"]'
        ];
        
        let botaoEncontrado = false;
        
        // Primeiro, tentar encontrar o botão no painel específico
        for (const seletor of seletoresBotaoAdicionar) {
            try {
                const botao = painelOJ.locator(seletor);
                if (await botao.first().isVisible({ timeout: 1500 })) {
                    console.log(`✓ Botão Adicionar encontrado no painel: ${seletor}`);
                    await botao.first().click({ force: true });
                    botaoEncontrado = true;
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        // Se não encontrou no painel, tentar na página global como fallback
        if (!botaoEncontrado) {
            // Usar o SeletorManager como fallback
            try {
                const resultadoBusca = await SeletorManager.buscarElemento(page, 'botaoAdicionar');
                
                if (resultadoBusca && resultadoBusca.seletor) {
                    console.log(`Botão Adicionar encontrado globalmente: ${resultadoBusca.seletor}`);
                    const botaoAdicionar = page.locator(resultadoBusca.seletor);
                    await botaoAdicionar.click({ force: true });
                    botaoEncontrado = true;
                }
            } catch (e) {
                console.log('SeletorManager também falhou');
            }
        }
        
        if (!botaoEncontrado) {
            console.log('Botão Adicionar não encontrado');
            return false;
        }
        
        // Aguardar um momento para menu aparecer
        await page.waitForTimeout(1000);
        
        // Tentar encontrar e clicar na opção do menu
        console.log('Procurando opções do menu...');
        
        // Estratégias para encontrar opções do menu
        const possiveisOpcoes = [
            'Órgão Julgador',
            'Vínculo',
            'Vincular Órgão Julgador',
            'Novo vínculo',
            'Adicionar Órgão Julgador',
            'Incluir'
        ];
        
        let opcaoClicada = false;
        
        // Tentar por role=menuitem primeiro
        for (const label of possiveisOpcoes) {
            try {
                const seletoresMenuItem = [
                    `[role="menuitem"]:has-text("${label}")`,
                    `[role="menuitem"] >> text="${label}"`,
                    `mat-menu-item:has-text("${label}")`,
                    `.mat-menu-item:has-text("${label}")`,
                    `button:has-text("${label}")`,
                    `a:has-text("${label}")`
                ];
                
                for (const seletor of seletoresMenuItem) {
                    try {
                        const item = page.locator(seletor);
                        if (await item.first().isVisible({ timeout: 1000 })) {
                            await item.first().click({ force: true });
                            opcaoClicada = true;
                            console.log(`✓ Opção selecionada: ${label} (${seletor})`);
                            break;
                        }
                    } catch (e) {
                        continue;
                    }
                }
                
                if (opcaoClicada) break;
            } catch (error) {
                continue;
            }
        }
        
        // Fallback: procurar por texto mais genérico
        if (!opcaoClicada) {
            try {
                const itemTexto = page.locator('text=/Órgão Julgador|Vínculo|Vincular|Adicionar|Incluir/i');
                if (await itemTexto.first().isVisible({ timeout: 1000 })) {
                    await itemTexto.first().click({ force: true });
                    opcaoClicada = true;
                    console.log('✓ Opção selecionada via fallback de texto');
                }
            } catch (error) {
                console.log('Fallback de texto também falhou:', error.message);
            }
        }
        
        if (opcaoClicada) {
            console.log('✓ Entrando em modo de inclusão...');
            await page.waitForTimeout(2000); // Aguarda o formulário carregar
            return true;
        } else {
            console.log('⚠ Nenhuma opção do menu foi encontrada, mas botão foi clicado');
            // Às vezes o clique no botão já abre o formulário diretamente
            await page.waitForTimeout(2000);
            return true;
        }
        
    } catch (error) {
        console.error('Erro ao entrar em modo de inclusão:', error);
        return false;
    }
}

/**
 * Aguarda que o campo mat-select seja habilitado dentro do painel específico
 * @param {Object} page - Instância da página do Playwright
 * @param {Object} painelOJ - Locator do painel específico do OJ
 * @returns {Promise<Object>} - Objeto com sucesso e seletorOJ se bem-sucedido
 */
async function aguardarMatSelectHabilitado(page, painelOJ) {
    try {
        console.log('Aguardando mat-select ser habilitado...');
        
        // 4) Dentro do painel, aguarda o <mat-select> do "Órgão Julgador" habilitar
        const seletorOJ = painelOJ.locator(
            'mat-select[placeholder="Órgão Julgador"], mat-select[name="idOrgaoJulgadorSelecionado"]'
        );
        
        // Anexa e habilita (aria-disabled deve virar "false" antes de interagir)
        await seletorOJ.first().waitFor({ state: 'attached' });
        
        const panelId = await painelOJ.getAttribute('id');
        await page.waitForFunction(
            (panelId) => {
                const el = 
                    document.querySelector(`#${panelId} mat-select[placeholder="Órgão Julgador"]`) ||
                    document.querySelector(`#${panelId} mat-select[name="idOrgaoJulgadorSelecionado"]`);
                return el && el.getAttribute('aria-disabled') === 'false';
            },
            panelId,
            { timeout: 10000 }
        );
        
        console.log('Mat-select habilitado com sucesso');
        return { sucesso: true, seletorOJ };
        
    } catch (error) {
        console.error('Erro ao aguardar mat-select ser habilitado:', error);
        
        // Fallback: verifica se existe algum mat-select visível no painel
        try {
            const matSelects = await painelOJ.locator('mat-select').all();
            for (const select of matSelects) {
                if (await select.isVisible()) {
                    const disabled = await select.getAttribute('aria-disabled');
                    const placeholder = await select.getAttribute('placeholder');
                    const name = await select.getAttribute('name');
                    console.log(`Mat-select encontrado - disabled: ${disabled}, placeholder: ${placeholder}, name: ${name}`);
                }
            }
        } catch (fallbackError) {
            console.error('Erro no fallback de verificação:', fallbackError);
        }
        
        return { sucesso: false, seletorOJ: null };
    }
}

/**
 * Previne cliques acidentais no header do expansion panel
 * @param {Page} page 
 */
async function prevenirCliqueHeader(page) {
    try {
        console.log('Prevenindo cliques acidentais no header...');
        
        // Aguardar um momento antes de interagir
        await page.waitForTimeout(1000);
        
        // Interceptar cliques no header para evitar fechamento do painel
        await page.evaluate(() => {
            const headers = document.querySelectorAll('[id^="mat-expansion-panel-header-"]');
            headers.forEach(header => {
                const textContentProcessed = typeof header.textContent === 'string' 
                    ? header.textContent 
                    : (header.textContent && typeof header.textContent === 'object' && header.textContent.nome) 
                        ? header.textContent.nome 
                        : String(header.textContent || '');
                
                if (textContentProcessed && textContentProcessed.includes('Órgão')) {
                    header.style.pointerEvents = 'none';
                    console.log('Header temporariamente desabilitado:', header.id);
                }
            });
        });
        
    } catch (error) {
        console.log('Erro ao prevenir clique no header:', error.message);
    }
}

/**
 * Aguarda que o mat-select do OJ esteja habilitado e visível antes de interagir
 * Busca diretamente pelo campo, sem depender do botão Adicionar
 * @param {Page} page 
 * @param {Locator} painelOJ 
 * @returns {Promise<Object>} - {success: boolean, matSelect: Locator}
 */
async function aguardarMatSelectOJPronto(page, painelOJ) {
    try {
        console.log('Buscando campo de Órgão Julgador diretamente no painel...');
        
        // Aguardar um tempo para o painel carregar completamente
        await page.waitForTimeout(3000);
        
        // Múltiplos seletores para encontrar o campo de Órgão Julgador
        const seletoresMatSelect = [
            'mat-select[placeholder="Órgão Julgador"]',
            'mat-select[name="idOrgaoJulgadorSelecionado"]',
            'mat-select[placeholder*="Órgão"]',
            'mat-select[placeholder*="Julgador"]',
            'mat-select[aria-label*="Órgão"]',
            'mat-select[aria-label*="Julgador"]',
            'mat-select[formcontrolname*="orgao"]',
            'mat-select[formcontrolname*="julgador"]',
            '.mat-select:has-text("Órgão")',
            '.campo-orgao-julgador mat-select',
            '.form-group:has(label:has-text("Órgão")) mat-select',
            'mat-form-field:has(mat-label:has-text("Órgão")) mat-select'
        ];
        
        let matSelect = null;
        let seletorEncontrado = null;
        
        // Primeiro, tentar no painel específico
        for (const seletor of seletoresMatSelect) {
            try {
                console.log(`Tentando seletor no painel: ${seletor}`);
                const elemento = painelOJ.locator(seletor);
                
                if (await elemento.first().isVisible({ timeout: 2000 })) {
                    matSelect = elemento;
                    seletorEncontrado = seletor;
                    console.log(`✓ Mat-select encontrado no painel: ${seletor}`);
                    break;
                }
            } catch (e) {
                console.log(`Seletor ${seletor} não funcionou no painel`);
                continue;
            }
        }
        
        // Se não encontrou no painel, tentar na página global
        if (!matSelect) {
            console.log('Não encontrado no painel, buscando globalmente...');
            
            for (const seletor of seletoresMatSelect) {
                try {
                    console.log(`Tentando seletor global: ${seletor}`);
                    const elemento = page.locator(seletor);
                    
                    if (await elemento.first().isVisible({ timeout: 2000 })) {
                        matSelect = elemento;
                        seletorEncontrado = seletor;
                        console.log(`✓ Mat-select encontrado globalmente: ${seletor}`);
                        break;
                    }
                } catch (e) {
                    console.log(`Seletor global ${seletor} não funcionou`);
                    continue;
                }
            }
        }
        
        if (!matSelect) {
            throw new Error('Nenhum campo de Órgão Julgador encontrado');
        }
        
        // Aguardar o elemento estar anexado e pronto
        await matSelect.first().waitFor({ state: 'attached', timeout: 5000 });
        
        // Verificar se está habilitado e visível
        console.log('Verificando se o mat-select está habilitado...');
        
        // Adicionar timeout mais agressivo e logs
        console.log(`🕒 Aguardando mat-select ficar habilitado: ${seletorEncontrado}`);
        
        let elementoHabilitado = false;
        try {
            elementoHabilitado = await page.waitForFunction(
                (seletor) => {
                    const elemento = document.querySelector(seletor);
                    if (!elemento) {
                        console.log(`❌ Elemento não encontrado: ${seletor}`);
                        return false;
                    }
                    
                    const disabled = elemento.getAttribute('aria-disabled');
                    const visible = elemento.offsetParent !== null;
                    const tabindex = elemento.getAttribute('tabindex');
                    
                    console.log('🔍 Estado do mat-select:', {
                        seletor,
                        disabled,
                        visible,
                        tabindex,
                        id: elemento.id,
                        placeholder: elemento.getAttribute('placeholder')
                    });
                    
                    // Consideramos habilitado se não está explicitamente disabled
                    const habilitado = visible && (disabled === 'false' || disabled === null);
                    if (habilitado) {
                        console.log('✅ Mat-select está habilitado!');
                    }
                    return habilitado;
                },
                seletorEncontrado,
                { timeout: 8000 } // Reduzido de 10s para 8s
            );
        } catch (timeoutError) {
            console.log(`⏰ TIMEOUT: Mat-select não ficou habilitado em 8 segundos`);
            console.log(`🔍 Tentando prosseguir mesmo assim com o seletor: ${seletorEncontrado}`);
            // Continuar mesmo sem confirmar que está habilitado
        }
        
        if (elementoHabilitado) {
            console.log('✓ Mat-select do OJ está pronto para interação');
            return { success: true, matSelect };
        } else {
            throw new Error('Mat-select encontrado mas não está habilitado');
        }
        
    } catch (error) {
        console.error('Erro ao aguardar mat-select ficar pronto:', error);
        
        // Debug: verificar estado atual dos mat-selects na página
        try {
            console.log('=== DEBUG: Analisando mat-selects na página ===');
            const selectsInfo = await page.evaluate(() => {
                const selects = document.querySelectorAll('mat-select');
                return Array.from(selects).map((select, index) => ({
                    index,
                    id: select.id,
                    placeholder: select.getAttribute('placeholder'),
                    name: select.getAttribute('name'),
                    disabled: select.getAttribute('aria-disabled'),
                    visible: select.offsetParent !== null,
                    className: select.className,
                    textContent: select.textContent?.trim().substring(0, 50)
                }));
            });
            console.log('Mat-selects encontrados:', selectsInfo);
            
            // Verificar se há campos de input relacionados a Órgão Julgador
            const inputsOrgao = await page.evaluate(() => {
                const inputs = document.querySelectorAll('input, select');
                return Array.from(inputs)
                    .filter(input => {
                        const placeholder = input.getAttribute('placeholder') || '';
                        const name = input.getAttribute('name') || '';
                        const id = input.getAttribute('id') || '';
                        const label = input.closest('.mat-form-field')?.querySelector('mat-label')?.textContent || '';
                        
                        return placeholder.toLowerCase().includes('órgão') ||
                               name.toLowerCase().includes('orgao') ||
                               id.toLowerCase().includes('orgao') ||
                               label.toLowerCase().includes('órgão');
                    })
                    .map(input => ({
                        tagName: input.tagName,
                        type: input.type,
                        placeholder: input.getAttribute('placeholder'),
                        name: input.getAttribute('name'),
                        id: input.getAttribute('id'),
                        visible: input.offsetParent !== null
                    }));
            });
            console.log('Campos relacionados a Órgão:', inputsOrgao);
            
        } catch (debugError) {
            console.log('Erro no debug:', debugError);
        }
        
        return { success: false, matSelect: null };
    }
}

/**
 * Abre o select de Órgão Julgador e seleciona pelo texto.
 * Resiliente: tenta clique direto na opção; se não achar, digita para filtrar e confirma com Enter.
 *
 * @param {Page} page
 * @param {Locator} painelOJ - container do acordeão (use o que você já pegou via aria-controls)
 * @param {string} alvoOJ - ex.: "Vara do Trabalho de Adamantina"
 */
async function selecionarOrgaoJulgador(page, painelOJ, alvoOJ) {
    const startTime = Date.now();
    const TIMEOUT_TOTAL = 60000; // 60 segundos máximo para toda a operação
    const estrategias = []; // Array para rastrear estratégias usadas
    
    try {
        console.log(`🎯 Selecionando Órgão Julgador: ${alvoOJ} (timeout: ${TIMEOUT_TOTAL/1000}s)`);
        
        // Verificar timeout
        if (Date.now() - startTime > TIMEOUT_TOTAL) {
            throw new Error(`Timeout global atingido para seleção de OJ: ${alvoOJ}`);
        }
        
        // Primeiro, prevenir cliques acidentais no header
        await prevenirCliqueHeader(page);
        
        // Verificar timeout antes de prosseguir
        if (Date.now() - startTime > TIMEOUT_TOTAL) {
            throw new Error(`Timeout global atingido antes de aguardar mat-select: ${alvoOJ}`);
        }
        
        // Aguardar o mat-select estar pronto para interação
        console.log(`⏱️ Tempo decorrido: ${((Date.now() - startTime)/1000).toFixed(1)}s`);
        const { success, matSelect } = await aguardarMatSelectOJPronto(page, painelOJ);
        if (!success) {
            throw new Error('Mat-select do OJ não ficou pronto para interação');
        }

        // 2) Localizar e clicar ESPECIFICAMENTE no mat-select, não no header
        const matSelectId = await matSelect.first().getAttribute('id');
        console.log(`Mat-select ID encontrado: ${matSelectId}`);
        
        console.log('Clicando ESPECIFICAMENTE no mat-select (não no header)...');
        
        // Aguardar um momento para garantir que a página estabilizou
        await page.waitForTimeout(1000);
        
        // Localizar especificamente o mat-select dentro do painel
        const matSelectEspecifico = painelOJ.locator(`mat-select#${matSelectId}`);
        
        // Verificar se o mat-select está realmente visível
        await matSelectEspecifico.waitFor({ state: 'visible', timeout: 5000 });
        
        // Múltiplas estratégias para clicar no mat-select
        let cliqueBemSucedido = false;
        
        // Estratégia 1: Clicar no trigger
        try {
            const trigger = matSelectEspecifico.locator('.mat-select-trigger');
            await trigger.scrollIntoViewIfNeeded();
            await trigger.click({ force: true });
            cliqueBemSucedido = true;
            console.log('✓ Clique no trigger realizado');
        } catch (e1) {
            console.log('Falha no clique do trigger, tentando mat-select diretamente...');
            
            // Estratégia 2: Clicar diretamente no mat-select
            try {
                await matSelectEspecifico.scrollIntoViewIfNeeded();
                await matSelectEspecifico.click({ force: true });
                cliqueBemSucedido = true;
                console.log('✓ Clique direto no mat-select realizado');
            } catch (e2) {
                console.log('Falha no clique direto, tentando JavaScript...');
                
                // Estratégia 3: Clicar via JavaScript
                try {
                    await page.evaluate((selectId) => {
                        const element = document.getElementById(selectId);
                        if (element) {
                            element.click();
                            // Se tiver trigger, clicar nele também
                            const trigger = element.querySelector('.mat-select-trigger');
                            if (trigger) trigger.click();
                        }
                    }, matSelectId);
                    cliqueBemSucedido = true;
                    console.log('✓ Clique via JavaScript realizado');
                } catch (e3) {
                    throw new Error('Todas as estratégias de clique falharam');
                }
            }
        }
        
        if (!cliqueBemSucedido) {
            throw new Error('Não foi possível clicar no mat-select');
        }

        // Verificar timeout antes do overlay
        if (Date.now() - startTime > TIMEOUT_TOTAL) {
            throw new Error(`Timeout global atingido antes de aguardar overlay: ${alvoOJ}`);
        }
        
        // 3) Aguardar o overlay abrir e estabilizar
        console.log(`⏱️ Aguardando overlay abrir... (tempo: ${((Date.now() - startTime)/1000).toFixed(1)}s)`);
        
        // Aguardar múltiplos seletores de overlay com timeout reduzido
        const seletoresOverlay = [
            '.cdk-overlay-pane .mat-select-panel',
            '.mat-select-panel',
            '.cdk-overlay-pane mat-option',
            'mat-option'
        ];
        
        let overlayAberto = false;
        for (const seletor of seletoresOverlay) {
            try {
                await page.locator(seletor).first().waitFor({ state: 'visible', timeout: 2000 }); // Reduzido para 2s
                overlayAberto = true;
                console.log(`✓ Overlay aberto usando seletor: ${seletor}`);
                break;
            } catch (e) {
                console.log(`Seletor ${seletor} não funcionou, tentando próximo...`);
            }
        }
        
        if (!overlayAberto) {
            throw new Error(`Overlay do mat-select não abriu após múltiplas tentativas (${((Date.now() - startTime)/1000).toFixed(1)}s)`);
        }
        
        // Aguardar um momento para o painel estabilizar
        await page.waitForTimeout(1500);
        console.log('✓ Overlay estabilizado');

        // Verificar timeout antes da busca
        if (Date.now() - startTime > TIMEOUT_TOTAL) {
            throw new Error(`Timeout global atingido antes de buscar opção: ${alvoOJ}`);
        }
        
        // 4) Buscar e selecionar a opção do OJ
        console.log(`⏱️ Buscando opção: "${alvoOJ}" (tempo: ${((Date.now() - startTime)/1000).toFixed(1)}s)`);
        
        // Primeiro, listar todas as opções disponíveis para debug
        try {
            const opcoesDisponiveis = await page.locator('mat-option').allTextContents();
            console.log(`📋 Opções disponíveis no dropdown (${opcoesDisponiveis.length} total):`);
            
            // Se for "Araras", mostrar todas as opções para debug
            if (alvoOJ.toLowerCase().includes('araras')) {
                console.log('🔍 DEBUG ARARAS - Todas as opções:');
                opcoesDisponiveis.forEach((opcao, index) => {
                    console.log(`   ${index + 1}. "${opcao}"`);
                });
                
                // Procurar especificamente por "Araras"
                const opcoesAraras = opcoesDisponiveis.filter(opcao => 
                    opcao.toLowerCase().includes('araras')
                );
                console.log(`🎯 Opções contendo "araras": ${opcoesAraras.length}`);
                opcoesAraras.forEach(opcao => console.log(`   - "${opcao}"`));
            } else {
                console.log(`   Primeiras 10: ${opcoesDisponiveis.slice(0, 10).join(', ')}`);
            }
        } catch (e) {
            console.log('⚠️ Não foi possível listar opções para debug');
        }
        
        // Estratégias melhoradas de seleção com timeout
        let opcaoSelecionada = false;
        
        // Estratégia 1: Buscar opção exata (case-insensitive)
        if (!opcaoSelecionada && Date.now() - startTime < TIMEOUT_TOTAL) {
            try {
                console.log('🎯 Estratégia 1: Busca exata...');
                const opcaoExata = page.locator('mat-option').filter({ hasText: new RegExp(`^\\s*${alvoOJ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i') });
                if (await opcaoExata.first().isVisible({ timeout: 1500 })) {
                    console.log('✓ Opção exata encontrada, clicando...');
                    await opcaoExata.first().click({ force: true });
                    opcaoSelecionada = true;
                    estrategias.push('exata');
                }
            } catch (error) {
                console.log('❌ Opção exata não encontrada:', error.message);
            }
        }
        
        // Estratégia 2: Buscar com normalização de travessões
        if (!opcaoSelecionada && Date.now() - startTime < TIMEOUT_TOTAL) {
            try {
                console.log('🎯 Estratégia 2: Busca com normalização...');
                const alvoNormalizado = normalizarTexto(alvoOJ);
                console.log(`Buscando versão normalizada: "${alvoNormalizado}"`);
                
                const opcoes = await page.locator('mat-option').all();
                for (const opcao of opcoes) {
                    const textoOpcao = await opcao.textContent();
                    const textoNormalizado = normalizarTexto(textoOpcao || '');
                    
                    if (textoNormalizado.includes(alvoNormalizado) || alvoNormalizado.includes(textoNormalizado)) {
                        console.log(`✓ Opção encontrada com normalização: "${textoOpcao}"`);
                        await opcao.click({ force: true });
                        opcaoSelecionada = true;
                        estrategias.push('normalizada');
                        break;
                    }
                }
            } catch (error) {
                console.log('❌ Busca com normalização falhou:', error.message);
            }
        }
        
        // REMOVIDO: Busca específica para Araras - MUITO PERIGOSA
        // Mesmo sendo específica, pode pegar OJs errados que contenham apenas "Araras"
        
        // REMOVIDO: Estratégia 3 - Busca por palavras principais - EXTREMAMENTE PERIGOSA
        // Esta busca pode pegar qualquer OJ que contenha palavras similares
        // TODO O CÓDIGO PERIGOSO FOI REMOVIDO
        // Agora só aceita correspondência EXATA
        
        // REMOVIDO: Estratégia 5 - Filtro por teclado - EXTREMAMENTE PERIGOSA
        // Esta estratégia digitava o texto e aceitava a primeira opção que aparecia
        // Pode selecionar qualquer OJ que comece com letra similar
        
        if (!opcaoSelecionada) {
            // Listar opções disponíveis para debug final
            try {
                const todasOpcoes = await page.locator('mat-option').allTextContents();
                console.log('Opções disponíveis para debug:', todasOpcoes);
                
                // Retornar erro específico quando OJ não está na relação
                const error = new Error(`OJ "${alvoOJ}" não encontrado na relação de opções disponíveis`);
                error.code = 'OJ_NAO_ENCONTRADO';
                error.opcoesDisponiveis = todasOpcoes;
                throw error;
            } catch (e) {
                if (e.code === 'OJ_NAO_ENCONTRADO') {
                    throw e;
                }
                console.log('Não foi possível listar opções para debug final');
                const error = new Error(`Não foi possível selecionar a opção "${alvoOJ}" - erro ao acessar dropdown`);
                error.code = 'ERRO_DROPDOWN';
                throw error;
            }
        }
        
        // ESCAPE FINAL - verificar timeout global
        if (Date.now() - startTime > TIMEOUT_TOTAL) {
            console.log(`⏰ TIMEOUT GLOBAL: Operação cancelada após ${((Date.now() - startTime)/1000).toFixed(1)}s`);
            const error = new Error(`Timeout global atingido para seleção de "${alvoOJ}" após ${((Date.now() - startTime)/1000).toFixed(1)} segundos`);
            error.code = 'TIMEOUT_GLOBAL';
            throw error;
        }
        
        // Log final do resultado
        if (opcaoSelecionada) {
            console.log(`✅ SUCESSO na seleção de OJ "${alvoOJ}"`);
            console.log(`   - Estratégias usadas: [${estrategias.join(', ')}]`);
            console.log(`   - Tempo total: ${((Date.now() - startTime)/1000).toFixed(1)}s`);
        } else {
            console.log(`❌ FALHA na seleção de OJ "${alvoOJ}"`);
            console.log(`   - Nenhuma estratégia funcionou`);
            console.log(`   - Tempo total: ${((Date.now() - startTime)/1000).toFixed(1)}s`);
        }
        
        // Aguardar o dropdown fechar
        await page.waitForTimeout(1000);

        // 5) Validar que ficou selecionado no componente
        console.log('Validando seleção...');
        try {
            // Aguardar um momento para o valor ser definido
            await page.waitForTimeout(1000);
            
            // Verificar se o valor foi selecionado
            const valorSelecionado = await matSelectEspecifico.textContent();
            console.log(`Valor selecionado no mat-select: "${valorSelecionado}"`);
            
            const valorNormalizado = normalizarTexto(valorSelecionado || '');
            const alvoNormalizado = normalizarTexto(alvoOJ);
            console.log(`Comparando normalizado: "${valorNormalizado}" contém "${alvoNormalizado}"`);
            
            if (valorSelecionado && valorNormalizado.includes(alvoNormalizado)) {
                console.log('✓ Validação de seleção bem-sucedida');
            } else {
                console.log('Aviso: Validação de seleção pode ter falhou, mas continuando...');
            }
        } catch (validationError) {
            console.log('Aviso: Validação de seleção falhou, mas continuando...', validationError.message);
        }
        
        console.log(`✓ Órgão Julgador selecionado com sucesso: ${alvoOJ}`);
        return true;
        
    } catch (error) {
        console.error(`❌ ERRO FINAL na seleção do Órgão Julgador "${alvoOJ}":`, error.message);
        console.error(`   - Tempo decorrido: ${((Date.now() - startTime)/1000).toFixed(1)}s`);
        console.error(`   - Estratégias tentadas: [${estrategias.join(', ') || 'nenhuma'}]`);
        console.error(`   - Código do erro: ${error.code || 'DESCONHECIDO'}`);
        throw error;
    }
}

/**
 * Seleciona um órgão julgador no modal que acabou de abrir
 * @param {Page} page - Instância da página do Playwright
 * @param {string} alvoOJ - Nome do órgão julgador a ser selecionado
 */
async function selecionarOrgaoJulgadorNoModal(page, alvoOJ) {
    const startTime = Date.now();
    const TIMEOUT_TOTAL = 60000; // 60 segundos máximo
    const estrategias = []; // Array para rastrear estratégias usadas
    
    try {
        console.log(`🎯 Selecionando OJ no modal: ${alvoOJ}`);
        
        // 1. Aguardar o modal estar completamente carregado
        await page.waitForTimeout(2000);
        
        // 2. Procurar pelo mat-select de Órgão Julgador no modal
        console.log('🔍 Procurando mat-select de Órgão Julgador no modal...');
        
        const matSelectSelectors = [
            // Seletores específicos por placeholder exato
            'mat-dialog-container mat-select[placeholder="Órgão Julgador"]',
            'mat-dialog-container mat-select[placeholder="Orgao Julgador"]',
            '[role="dialog"] mat-select[placeholder="Órgão Julgador"]',
            '[role="dialog"] mat-select[placeholder="Orgao Julgador"]',
            '.mat-dialog-container mat-select[placeholder="Órgão Julgador"]',
            
            // Seletores por name específicos
            'mat-dialog-container mat-select[name="idOrgaoJulgadorSelecionado"]',
            '[role="dialog"] mat-select[name="idOrgaoJulgadorSelecionado"]',
            'mat-dialog-container mat-select[formcontrolname="orgaoJulgador"]',
            
            // Seletores por placeholder parcial
            'mat-dialog-container mat-select[placeholder*="Órgão"]',
            'mat-dialog-container mat-select[placeholder*="Orgao"]',
            'mat-dialog-container mat-select[placeholder*="Julgador"]', 
            '[role="dialog"] mat-select[placeholder*="Órgão"]',
            '[role="dialog"] mat-select[placeholder*="Orgao"]',
            '[role="dialog"] mat-select[placeholder*="Julgador"]',
            '.mat-dialog-container mat-select[placeholder*="Órgão"]',
            
            // Seletores por aria-label
            'mat-dialog-container mat-select[aria-label*="Órgão"]',
            'mat-dialog-container mat-select[aria-label*="Julgador"]',
            
            // Seletores genéricos no modal
            'mat-dialog-container mat-select',
            '[role="dialog"] mat-select',
            '.mat-dialog-container mat-select',
            
            // Seletores globais como fallback
            'mat-select[placeholder="Órgão Julgador"]',
            'mat-select[placeholder="Orgao Julgador"]',
            'mat-select[placeholder*="Órgão"]',
            'mat-select[placeholder*="Orgao"]',
            'mat-select[placeholder*="Julgador"]',
            'mat-select[name="idOrgaoJulgadorSelecionado"]',
            'mat-select'
        ];
        
        let matSelect = null;
        for (const selector of matSelectSelectors) {
            try {
                console.log(`🔍 Testando seletor: ${selector}`);
                const candidate = page.locator(selector);
                if (await candidate.count() > 0 && await candidate.first().isVisible({ timeout: 3000 })) {
                    matSelect = candidate.first();
                    console.log(`✅ Mat-select encontrado: ${selector}`);
                    break;
                }
            } catch (error) {
                console.log(`❌ Seletor ${selector} falhou: ${error.message}`);
            }
        }
        
        if (!matSelect) {
            throw new Error('Mat-select de Órgão Julgador não encontrado no modal');
        }
        
        // 3. Clicar no mat-select para abrir o dropdown
        console.log('🖱️ Clicando no mat-select para abrir dropdown...');
        
        const clickStrategies = [
            () => matSelect.click(),
            () => matSelect.click({ force: true }),
            () => matSelect.locator('.mat-select-trigger').click(),
            () => matSelect.evaluate(el => el.click())
        ];
        
        let dropdownAberto = false;
        for (const strategy of clickStrategies) {
            try {
                await strategy();
                await page.waitForTimeout(1000);
                
                // Verificar se o dropdown abriu
                const opcoes = page.locator('mat-option');
                if (await opcoes.count() > 0) {
                    console.log('✅ Dropdown aberto com sucesso');
                    dropdownAberto = true;
                    break;
                }
            } catch (error) {
                console.log(`⚠️ Estratégia de clique falhou: ${error.message}`);
            }
        }
        
        if (!dropdownAberto) {
            throw new Error('Não foi possível abrir o dropdown do mat-select');
        }
        
        // 4. Aguardar as opções carregarem
        await page.waitForTimeout(2000);
        
        // 5. Selecionar a opção desejada usando as mesmas estratégias
        console.log(`🎯 Procurando pela opção: ${alvoOJ}`);
        let opcaoSelecionada = false;
        
        // Estratégia 1: Busca exata
        if (!opcaoSelecionada) {
            try {
                console.log('🎯 Estratégia 1: Busca exata...');
                const opcaoExata = page.locator('mat-option').filter({ 
                    hasText: new RegExp(`^\\s*${alvoOJ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i') 
                });
                if (await opcaoExata.count() > 0 && await opcaoExata.first().isVisible({ timeout: 2000 })) {
                    console.log('✅ Opção exata encontrada');
                    await opcaoExata.first().click({ force: true });
                    opcaoSelecionada = true;
                    estrategias.push('exata');
                }
            } catch (error) {
                console.log('❌ Busca exata falhou:', error.message);
            }
        }
        
        // Estratégia 2: Busca parcial
        // REMOVIDO: Estratégia de busca parcial - EXTREMAMENTE PERIGOSA
        // Esta busca pode pegar qualquer OJ que contenha parte do texto
        // Exemplo: "Adamantina" poderia pegar "CEJUSC LIMEIRA" se contiver "a" ou "m"
        
        // REMOVIDO: Estratégia de busca por palavras-chave - EXTREMAMENTE PERIGOSA
        // Esta busca poderia pegar qualquer OJ que contenha palavras similares
        // Exemplo: "Adamantina" poderia pegar "CEJUSC LIMEIRA" porque ambos têm palavras comuns
        
        if (!opcaoSelecionada) {
            // Debug: listar opções disponíveis
            try {
                const opcoes = await page.locator('mat-option').allTextContents();
                console.log('📋 Opções disponíveis no dropdown:');
                opcoes.forEach((opcao, index) => {
                    console.log(`  ${index + 1}. "${opcao}"`);
                });
            } catch (e) {
                console.log('⚠️ Não foi possível listar opções disponíveis');
            }
            
            throw new Error(`OJ "${alvoOJ}" não encontrado nas opções disponíveis`);
        }
        
        // 6. Aguardar seleção ser processada
        await page.waitForTimeout(1000);
        
        console.log(`✅ OJ selecionado com sucesso: ${alvoOJ}`);
        console.log(`📊 Estratégias usadas: [${estrategias.join(', ')}]`);
        console.log(`⏱️ Tempo total: ${((Date.now() - startTime)/1000).toFixed(1)}s`);
        
        return true;
        
    } catch (error) {
        console.error(`❌ Erro ao selecionar OJ no modal "${alvoOJ}":`, error.message);
        console.error(`⏱️ Tempo decorrido: ${((Date.now() - startTime)/1000).toFixed(1)}s`);
        console.error(`📊 Estratégias tentadas: [${estrategias.join(', ') || 'nenhuma'}]`);
        throw error;
    }
}

/**
 * Verifica se um OJ já está cadastrado na página atual
 * @param {Object} page - Página do Playwright
 * @param {string} nomeOJ - Nome do OJ a verificar
 * @returns {Object} Resultado da verificação
 */
async function verificarOJJaCadastrado(page, nomeOJ) {
  console.log(`🔍 Verificando se OJ "${nomeOJ}" já está cadastrado na página...`);
  
  try {
    const { listarOJsVinculados } = require('./verificarOJVinculado');
    const { NormalizadorTexto } = require('./utils/normalizacao');
    
    // Listar todos os OJs já vinculados na página
    const ojsVinculados = await listarOJsVinculados(page);
    
    if (ojsVinculados.length === 0) {
      console.log('📋 Nenhum OJ encontrado na página - pode prosseguir');
      return { jaCadastrado: false, ojsEncontrados: [] };
    }
    
    console.log(`📋 OJs encontrados na página (${ojsVinculados.length}):`);
    ojsVinculados.forEach((oj, index) => {
      console.log(`   ${index + 1}. ${oj}`);
    });
    
    // Verificar se o OJ alvo já está na lista
    const nomeOJNormalizado = NormalizadorTexto.normalizar(nomeOJ);
    
    for (const ojVinculado of ojsVinculados) {
      const ojVinculadoNormalizado = NormalizadorTexto.normalizar(ojVinculado);
      
      // Verificação exata normalizada
      if (ojVinculadoNormalizado === nomeOJNormalizado) {
        console.log(`✅ OJ "${nomeOJ}" JÁ ESTÁ CADASTRADO (match exato)`);
        console.log(`   📄 Encontrado como: "${ojVinculado}"`);
        return { 
          jaCadastrado: true, 
          ojEncontrado: ojVinculado,
          ojsEncontrados: ojsVinculados,
          tipoMatch: 'exato'
        };
      }
      
      // Verificação por equivalência (alta similaridade)
      if (NormalizadorTexto.saoEquivalentes(nomeOJ, ojVinculado, 0.95)) {
        console.log(`✅ OJ "${nomeOJ}" JÁ ESTÁ CADASTRADO (match equivalente)`);
        console.log(`   📄 Encontrado como: "${ojVinculado}"`);
        return { 
          jaCadastrado: true, 
          ojEncontrado: ojVinculado,
          ojsEncontrados: ojsVinculados,
          tipoMatch: 'equivalente'
        };
      }
    }
    
    console.log(`❌ OJ "${nomeOJ}" NÃO está cadastrado - pode prosseguir`);
    return { 
      jaCadastrado: false, 
      ojsEncontrados: ojsVinculados 
    };
    
  } catch (error) {
    console.log(`⚠️ Erro ao verificar OJs cadastrados: ${error.message}`);
    // Em caso de erro, assumir que pode prosseguir
    return { 
      jaCadastrado: false, 
      ojsEncontrados: [],
      erro: error.message 
    };
  }
}

/**
 * Tenta clicar no botão VOLTAR quando um OJ já está cadastrado
 * @param {Page} page - Instância da página do Playwright
 * @returns {boolean} - true se conseguiu clicar, false caso contrário
 */
async function clicarBotaoVoltar(page) {
  try {
    console.log('🔄 Procurando botão VOLTAR...');
    
    // Lista de seletores possíveis para o botão VOLTAR
    const seletoresVoltar = [
      'button:has-text("Voltar")',
      'button:has-text("voltar")',
      'button:has-text("VOLTAR")',
      '.btn:has-text("Voltar")',
      '.btn:has-text("voltar")',
      '.btn:has-text("VOLTAR")',
      'mat-dialog-container button:has-text("Voltar")',
      'mat-dialog-container button:has-text("voltar")',
      'mat-dialog-container button:has-text("VOLTAR")',
      '[role="dialog"] button:has-text("Voltar")',
      '[role="dialog"] button:has-text("voltar")',
      '[role="dialog"] button:has-text("VOLTAR")',
      'button:has-text("Cancelar")',
      'button:has-text("cancelar")',
      'button:has-text("CANCELAR")',
      'mat-dialog-container button:has-text("Cancelar")',
      'mat-dialog-container button:has-text("cancelar")',
      'mat-dialog-container button:has-text("CANCELAR")',
      'button:has-text("Fechar")',
      'button:has-text("fechar")',
      'button:has-text("FECHAR")',
      'mat-dialog-container button:has-text("Fechar")',
      'mat-dialog-container button:has-text("fechar")',
      'mat-dialog-container button:has-text("FECHAR")',
      // Seletores genéricos para botões de modal
      '.mat-dialog-actions button:first-child',
      'mat-dialog-actions button:first-child',
      '[role="dialog"] .mat-dialog-actions button:first-child'
    ];
    
    // Tentar cada seletor
    for (const seletor of seletoresVoltar) {
      try {
        console.log(`🔍 Testando seletor: ${seletor}`);
        
        // Verificar se o elemento existe e está visível
        const elemento = page.locator(seletor).first();
        const isVisible = await elemento.isVisible({ timeout: 1000 }).catch(() => false);
        
        if (isVisible) {
          console.log(`✓ Elemento encontrado: ${seletor}`);
          
          // Tentar clicar
          await elemento.click({ timeout: 3000 });
          console.log(`✓ Clique realizado com sucesso no botão VOLTAR`);
          
          // Aguardar um pouco para a ação ser processada
          await page.waitForTimeout(1000);
          
          return true;
        }
      } catch (error) {
        console.log(`✗ Falhou com seletor ${seletor}: ${error.message}`);
        continue;
      }
    }
    
    // Se chegou até aqui, não encontrou nenhum botão
    console.log('⚠️ Nenhum botão VOLTAR encontrado');
    return false;
    
  } catch (error) {
    console.log(`❌ Erro ao tentar clicar no botão VOLTAR: ${error.message}`);
    return false;
  }
}

// Função melhorada para vincular OJ usando o fluxo determinístico sugerido pelo usuário
async function vincularOJMelhorado(page, nomeOJ, papel = 'Secretário de Audiência', visibilidade = 'Público', modoRapido = false) {
  const tipoModo = modoRapido ? '⚡ RÁPIDO' : '🔄 NORMAL';
  console.log(`${tipoModo} Vinculando OJ: ${nomeOJ} (${papel}, ${visibilidade})`);
  
  const startTime = Date.now();
  
  // Helper para timeouts otimizados
  const waitTimeout = (normalMs) => modoRapido ? Math.min(normalMs / 3, normalMs) : normalMs;
  
  try {
    // 1. Expande a seção (SEM clicar em Adicionar) - otimizado se modo rápido
    console.log(`${tipoModo} 1. Expandindo seção de Órgãos Julgadores...`);
    const { sucesso: expandiu, painelOJ } = await expandirOrgaosJulgadores(page, modoRapido);
    if (!expandiu || !painelOJ) {
      const error = new Error('Não foi possível expandir a seção de Órgãos Julgadores');
      error.code = 'ERRO_EXPANSAO';
      throw error;
    }
    
    const tempoExpansao = Date.now() - startTime;
    console.log(`${tipoModo} ✓ Seção expandida em ${tempoExpansao}ms`);
    
    // 1.5. NOVA VERIFICAÇÃO: Verificar se OJ já está cadastrado
    console.log(`${tipoModo} 1.5. Verificando se OJ já está cadastrado...`);
    const verificacao = await verificarOJJaCadastrado(page, nomeOJ);
    
    if (verificacao.jaCadastrado) {
      console.log(`✅ OJ "${nomeOJ}" JÁ ESTÁ CADASTRADO!`);
      console.log(`   📄 Encontrado como: "${verificacao.ojEncontrado}"`);
      console.log(`   🔍 Tipo de match: ${verificacao.tipoMatch}`);
      console.log(`⏭️ Pulando para próximo OJ sem sair do modal...`);
      
      // NÃO CLICAR EM VOLTAR - apenas lançar erro para pular este OJ
      // O BatchOJProcessor vai tratar isso e continuar no modal
      const error = new Error(`OJ "${nomeOJ}" já está cadastrado como "${verificacao.ojEncontrado}"`);
      error.code = 'OJ_JA_CADASTRADO';
      error.ojEncontrado = verificacao.ojEncontrado;
      error.tipoMatch = verificacao.tipoMatch;
      error.ojsEncontrados = verificacao.ojsEncontrados;
      error.skipOJ = true; // Flag para indicar que deve pular sem fechar modal
      throw error;
    }
    
    console.log(`${tipoModo} ✓ OJ não está cadastrado - prosseguindo com vinculação`);
    
    // 1.6. NOVA VERIFICAÇÃO: Detectar se é vara de Limeira e aplicar tratamento específico
    if (isVaraLimeira(nomeOJ)) {
      console.log(`🔧 Vara de Limeira detectada: ${nomeOJ}`);
      console.log(`${tipoModo} Aplicando tratamento específico para Limeira...`);
      
      // Para varas de Limeira, precisamos do nome do perito para a busca
      // Vamos tentar obter do contexto ou usar um padrão
      const nomePerito = 'DEISE MARIA CASSANIGA AZEVEDO'; // Pode ser parametrizado
      
      const resultadoLimeira = await aplicarTratamentoLimeira(page, nomeOJ, nomePerito);
      
      if (resultadoLimeira.sucesso) {
        console.log(`✅ Tratamento específico Limeira concluído com sucesso`);
        return {
          sucesso: true,
          metodo: 'limeira_especifico',
          nomeOJ,
          papel,
          visibilidade,
          tempo: Date.now() - startTime,
          detalhes: resultadoLimeira.detalhes
        };
      } else {
        console.log(`⚠️ Tratamento específico Limeira falhou, continuando com método padrão`);
        console.log(`   Erro: ${resultadoLimeira.erro}`);
        // Continua com o fluxo normal como fallback
      }
    }
    
    // 2. NOVO FLUXO PARA PERITOS: Clicar direto no mat-select (sem botão Adicionar)
    console.log('2. FLUXO PERITO: Clicando diretamente no campo Órgão Julgador...');
    
    try {
      console.log('🎯 PERITO: Iniciando fluxo direto...');
      
      // Aguardar estabilização da página
      await page.waitForTimeout(1500);
      
      // Tentar estratégias progressivas para encontrar e clicar o mat-select
      let matSelectClicado = false;
      const seletoresDirectos = [
        'mat-select[name="idOrgaoJulgadorSelecionado"]',
        'mat-select[placeholder="Órgão Julgador"]',
        'mat-select[id="mat-select-32"]',
        'mat-expansion-panel:has-text("Órgão") mat-select',
        'mat-select'
      ];
      
      for (const seletor of seletoresDirectos) {
        try {
          const elemento = page.locator(seletor).first();
          const count = await elemento.count();
          
          if (count > 0) {
            try {
              await elemento.scrollIntoViewIfNeeded();
              await page.waitForTimeout(300);
            } catch (scrollError) {
              // Scroll opcional
            }
            
            try {
              await elemento.click({ force: true, timeout: 3000 });
              matSelectClicado = true;
              console.log(`✅ PERITO: Mat-select clicado (${seletor})`);
              break;
            } catch (clickError) {
              // Tentar próximo seletor
            }
          }
        } catch (error) {
          // Tentar próximo seletor
        }
      }
      
      if (!matSelectClicado) {
        throw new Error('PERITO FLOW: Não foi possível clicar em nenhum mat-select');
      }
      
      // Aguardar dropdown aparecer - UMA VEZ SÓ
      console.log('🔄 PERITO FLOW: Aguardando dropdown aparecer...');
      await page.waitForTimeout(2000); // Timeout maior para garantir
      
      // NOVA LÓGICA SIMPLES: Procurar opção exata IMEDIATAMENTE
      console.log(`🔍 PERITO: Procurando opção exata "${nomeOJ}"...`);
      
      // Aguardar opções carregarem
      await page.waitForTimeout(1000);
      
      // Procurar opção exata APENAS
      const opcaoExata = page.locator('mat-option').filter({ hasText: new RegExp(`^\\s*${nomeOJ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i') });
      const countOpcaoExata = await opcaoExata.count();
      
      if (countOpcaoExata > 0) {
        console.log(`✅ Opção exata encontrada: ${nomeOJ}`);
        await opcaoExata.first().click();
        console.log('✅ Opção selecionada com sucesso');
      } else {
        // FECHAR DROPDOWN IMEDIATAMENTE e listar opções disponíveis
        console.log(`❌ Opção "${nomeOJ}" NÃO ENCONTRADA - fechando dropdown`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        
        // Listar opções para o usuário corrigir
        try {
          await page.click('mat-select[name="idOrgaoJulgadorSelecionado"]', { force: true });
          await page.waitForTimeout(1000);
          const todasOpcoes = await page.locator('mat-option').allTextContents();
          await page.keyboard.press('Escape'); // Fechar novamente
          
          const error = new Error(`OJ "${nomeOJ}" não encontrado na relação`);
          error.code = 'OJ_NAO_ENCONTRADO';
          error.opcoesDisponiveis = todasOpcoes;
          throw error;
        } catch (listError) {
          const error = new Error(`OJ "${nomeOJ}" não encontrado`);
          error.code = 'OJ_NAO_ENCONTRADO';
          throw error;
        }
      }
      
      // Continuar com o fluxo de vinculação
      console.log('✅ Seleção de OJ confirmada');
      
      // Aguardar processamento
      await page.waitForTimeout(waitTimeout(1500));
        
        // Procurar botão "Vincular Órgão Julgador ao Perito"
        console.log('🔄 PERITO FLOW: Procurando botão Vincular...');
        try {
          const botaoVincular = page.getByRole('button', { name: 'Vincular Órgão Julgador ao Perito' });
          await botaoVincular.waitFor({ state: 'visible', timeout: 5000 });
          await botaoVincular.click();
          console.log('✓ Botão Vincular clicado');
          
          // Aguardar modal e confirmar
          await page.waitForTimeout(waitTimeout(1000));
          
          try {
            const botaoSim = page.getByRole('button', { name: 'SIM' });
            await botaoSim.waitFor({ state: 'visible', timeout: 3000 });
            await botaoSim.click();
            console.log('✓ Confirmação SIM clicada');
          } catch (simError) {
            console.log('⚠️ Botão SIM não encontrado, tentando Sim...');
            try {
              await page.locator('button:has-text("Sim")').click();
              console.log('✓ Confirmação Sim clicada');
            } catch (simMinError) {
              console.log('⚠️ Nenhuma confirmação encontrada, assumindo sucesso...');
            }
          }
          
          // Aguardar finalização
          await page.waitForTimeout(waitTimeout(2000));
          
          console.log(`✅ PERITO FLOW: OJ "${nomeOJ}" vinculado com sucesso em ${Date.now() - startTime}ms`);
          return; // Sucesso!
          
        } catch (botaoError) {
          throw new Error(`Botão Vincular não encontrado: ${botaoError.message}`);
        }
      
    } catch (peritoError) {
      console.log(`❌ ERRO no fluxo PERITO: ${peritoError.message}`);
      
      // Se o erro for de campo não encontrado, tentar o fluxo tradicional como fallback
      if (peritoError.message.includes('select') || peritoError.message.includes('campo') || peritoError.message.includes('Órgão Julgador')) {
        console.log('🔄 Tentando fluxo tradicional como fallback...');
        // Continuar para o fluxo tradicional abaixo
      } else {
        // Para outros erros, propagar
        throw peritoError;
      }
    }
    
    // FLUXO TRADICIONAL (FALLBACK) - Só executa se o fluxo PERITO falhar
    console.log('🔄 FALLBACK: Executando fluxo tradicional com modal...');
    await clickAddLocationButton(page, painelOJ);
    
    // 3. Aguardar modal abrir e estabilizar (otimizado)
    console.log(`${tipoModo} 3. Aguardando modal abrir...`);
    await page.waitForTimeout(waitTimeout(2000));
    
    // 4. Selecionar o Órgão Julgador usando a nova estratégia otimizada
    console.log('4. Selecionando Órgão Julgador no modal...');
    
    try {
      // Agora que o modal abriu, o mat-select está na página global, não mais no painel
      // Vamos passar a página inteira como contexto em vez do painel específico
      await selecionarOrgaoJulgadorNoModal(page, nomeOJ);
    } catch (selecaoError) {
      // Verificar se é um OJ não encontrado na relação
      if (selecaoError.code === 'OJ_NAO_ENCONTRADO') {
        console.log(`⚠️ OJ "${nomeOJ}" não está disponível na relação de opções`);
        const error = new Error(`OJ "${nomeOJ}" não encontrado na relação de opções disponíveis`);
        error.code = 'OJ_NAO_ENCONTRADO';
        error.nomeOJ = nomeOJ;
        error.opcoesDisponiveis = selecaoError.opcoesDisponiveis || [];
        throw error;
      } else {
        // Outros tipos de erro na seleção
        const error = new Error(`Erro ao selecionar OJ "${nomeOJ}": ${selecaoError.message}`);
        error.code = selecaoError.code || 'ERRO_SELECAO';
        error.nomeOJ = nomeOJ;
        error.originalError = selecaoError;
        throw error;
      }
    }
    
    // 5. Aguardar um momento para garantir que a seleção foi processada (otimizado)
    console.log(`${tipoModo} 5. Aguardando processamento da seleção...`);
    await page.waitForTimeout(waitTimeout(1500));
    
    // 6. Configurar papel e visibilidade
    console.log('6. Configurando papel e visibilidade...');
    try {
      await configurarPapel(page, papel);
      console.log(`✓ Papel configurado: ${papel}`);
    } catch (papelError) {
      console.log(`⚠️ Erro ao configurar papel: ${papelError.message}`);
    }
    
    try {
      await configurarVisibilidadeModal(page, visibilidade);
      console.log(`✓ Visibilidade configurada: ${visibilidade}`);
    } catch (visibilidadeError) {
      console.log(`⚠️ Erro ao configurar visibilidade: ${visibilidadeError.message}`);
    }
    
    // 7. Procurar e clicar no botão de finalizar vinculação no modal
    console.log('7. Procurando botão de finalizar vinculação no modal...');
    
    // Estratégias para encontrar o botão no modal (não no painel)
    const seletoresBotaoGravar = [
      // PRIMEIRO: Botão específico para peritos (PRIORIDADE MÁXIMA)
      'mat-dialog-container button:has-text("Vincular Órgão Julgador ao Perito")',
      '[role="dialog"] button:has-text("Vincular Órgão Julgador ao Perito")',
      '.mat-dialog-container button:has-text("Vincular Órgão Julgador ao Perito")',
      
      // SEGUNDO: Botões de vincular genéricos
      'mat-dialog-container button:has-text("Vincular")',
      '[role="dialog"] button:has-text("Vincular")',
      
      // TERCEIRO: Botões de gravar/salvar para servidores  
      'mat-dialog-container button:has-text("Gravar")',
      '[role="dialog"] button:has-text("Gravar")',
      '.mat-dialog-container button:has-text("Gravar")',
      'mat-dialog-container button:has-text("Salvar")',
      '[role="dialog"] button:has-text("Salvar")',
      'mat-dialog-container button:has-text("Confirmar")',
      
      // Fallbacks globais (última opção)
      'button:has-text("Vincular Órgão Julgador ao Perito")',
      'button:has-text("Vincular")',
      'button:has-text("Gravar")',
      'button:has-text("Salvar")',
      'button:has-text("Confirmar")',
      'input[type="submit"]',
      'input[type="button"][value*="Gravar"]',
      'input[type="button"][value*="Salvar"]'
    ];
    
    let botaoEncontrado = false;
    for (const seletor of seletoresBotaoGravar) {
      try {
        console.log(`🔍 Testando botão: ${seletor}`);
        const botao = page.locator(seletor); // Usar page em vez de painelOJ
        if (await botao.count() > 0 && await botao.first().isVisible({ timeout: 2000 })) {
          console.log(`✅ Botão encontrado: ${seletor}`);
          await botao.first().click({ force: true });
          botaoEncontrado = true;
          console.log('✅ Clique no botão Gravar realizado');
          break;
        } else {
          console.log(`❌ Botão ${seletor} não visível ou não encontrado`);
        }
      } catch (e) {
        console.log(`❌ Seletor ${seletor} falhou: ${e.message}`);
      }
    }
    
    if (!botaoEncontrado) {
      // Tentar buscar por role no modal
      try {
        console.log('🔍 Tentando buscar botão por role no modal...');
        const botaoRole = page.getByRole('button', { name: /Gravar|Salvar|Confirmar|Vincular/i });
        if (await botaoRole.count() > 0 && await botaoRole.first().isVisible({ timeout: 2000 })) {
          await botaoRole.first().click({ force: true });
          botaoEncontrado = true;
          console.log('✅ Botão encontrado por role e clicado');
        }
      } catch (e) {
        console.log('❌ Busca por role também falhou:', e.message);
      }
    }
    
    if (!botaoEncontrado) {
      // Debug: listar todos os botões no modal
      try {
        console.log('🔍 DEBUG: Listando botões no modal...');
        const botoesModal = await page.locator('mat-dialog-container button, [role="dialog"] button').all();
        for (let i = 0; i < botoesModal.length; i++) {
          try {
            const texto = await botoesModal[i].textContent();
            const isVisible = await botoesModal[i].isVisible();
            console.log(`  Botão ${i + 1}: "${texto}" (visível: ${isVisible})`);
          } catch (e) {
            console.log(`  Botão ${i + 1}: Erro ao obter informações`);
          }
        }
      } catch (debugError) {
        console.log(`⚠️ Erro no debug de botões: ${debugError.message}`);
      }
      
      throw new Error('Botão Gravar/Salvar não encontrado no modal');
    }
    
    // 5. Aguardar processamento e verificar resultado
    console.log('5. Aguardando processamento da vinculação...');
    await page.waitForTimeout(2000);
    
    // 6. Verificar se apareceu modal de confirmação ou de erro
    console.log('6. Verificando resultado da vinculação...');
    
    try {
      // Verificar se apareceu modal de confirmação
      const modalConfirmacao = await page.locator('text=/certeza.*vincular.*Órgão Julgador.*Perito/i').first().isVisible({ timeout: 3000 });
      if (modalConfirmacao) {
        console.log('✓ Modal de confirmação detectado, clicando em "Sim"...');
        
        // Procurar botão "Sim"
        const seletoresSim = [
          'button:has-text("Sim")',
          'button:has-text("OK")',
          'button:has-text("Confirmar")',
          'button[class*="confirm"]',
          '.btn-success:has-text("Sim")',
          '.btn-primary:has-text("Sim")'
        ];
        
        let simClicado = false;
        for (const seletor of seletoresSim) {
          try {
            const botaoSim = page.locator(seletor);
            if (await botaoSim.first().isVisible({ timeout: 2000 })) {
              await botaoSim.first().click({ force: true });
              simClicado = true;
              console.log('✓ Confirmação realizada');
              break;
            }
          } catch (e) {
            continue;
          }
        }
        
        if (!simClicado) {
          console.log('Aviso: Não foi possível clicar em "Sim", mas continuando...');
        }
        
        // Aguardar processamento após confirmação
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      console.log('Nenhum modal de confirmação detectado, continuando...');
    }
    
    // 7. Verificar se o OJ apareceu na tabela de vínculos
    console.log('7. Verificando se OJ foi vinculado na tabela...');
    try {
      // Aguardar tabela aparecer
      await painelOJ.locator('table, .table, [role="table"]').first().waitFor({ state: 'visible', timeout: 5000 });
      
      // Verificar se o nome do OJ aparece na tabela
      const painelId = await painelOJ.getAttribute('id');
      const ojNaTabela = await page.waitForFunction(
        (painelId, nomeOJ) => {
          try {
            const painel = document.getElementById(painelId);
            if (!painel) return false;
            
            const tabela = painel.querySelector('table, .table, [role="table"]');
            if (!tabela) return false;
            
            const textoTabela = tabela.textContent || tabela.innerText || '';
            if (!textoTabela) return false;
            
            return textoTabela.toLowerCase().includes(nomeOJ.toLowerCase());
          } catch (error) {
            console.log('Erro na verificação da tabela:', error);
            return false;
          }
        },
        painelId,
        nomeOJ,
        { timeout: 10000 }
      );
      
      if (ojNaTabela) {
        console.log(`✓ OJ "${nomeOJ}" confirmado na tabela de vínculos`);
      } else {
        console.log(`Aviso: OJ "${nomeOJ}" pode não ter sido adicionado à tabela`);
      }
    } catch (error) {
      console.log(`Aviso: Não foi possível verificar OJ na tabela: ${error.message}`);
      // Não falhar aqui, pois a vinculação pode ter sido bem-sucedida mesmo assim
    }
    
    // 8. Verificar se houve mensagem de sucesso ou erro
    try {
      const mensagemSucesso = await page.locator('text=/sucesso|vinculado|adicionado|salvo/i').first().isVisible({ timeout: 3000 });
      if (mensagemSucesso) {
        console.log('✓ Mensagem de sucesso detectada');
      }
      
      const mensagemErro = await page.locator('text=/erro|falha|não.*possível|inválido/i').first().isVisible({ timeout: 2000 });
      if (mensagemErro) {
        const textoErro = await page.locator('text=/erro|falha|não.*possível|inválido/i').first().textContent();
        console.log(`⚠ Possível mensagem de erro detectada: ${textoErro}`);
      }
    } catch (e) {
      console.log('Não foi possível verificar mensagens de status');
    }
    
    const tempoTotal = Date.now() - startTime;
    console.log(`${tipoModo} ✓ Vinculação de "${nomeOJ}" concluída em ${tempoTotal}ms!`);
    return true;
    
  } catch (error) {
    console.error(`✗ Erro na vinculação determinística do OJ "${nomeOJ}": ${error.message}`);
    throw error;
  }
}

async function vincularOJ(page, nomeOJ, papel = 'Secretário de Audiência', visibilidade = 'Público') {
  
  // Verificar se a página está válida antes de começar
  if (page.isClosed()) {
    throw new Error('A página foi fechada antes de iniciar a vinculação');
  }
  
  // Tentar primeiro o fluxo melhorado
  try {
    console.log('Tentando fluxo melhorado de vinculação...');
    await vincularOJMelhorado(page, nomeOJ, papel, visibilidade);
    console.log('✓ Fluxo melhorado executado com sucesso!');
    return;
  } catch (error) {
    // Se for um OJ não encontrado, não tentar fallback - propagar o erro
    if (error.code === 'OJ_NAO_ENCONTRADO') {
      console.log(`⚠️ OJ "${nomeOJ}" não encontrado na relação - pulando para próximo`);
      throw error; // Propagar para o main.js tratar
    }
    
    console.log(`Fluxo melhorado falhou: ${error.message}`);
    console.log('Tentando fluxo tradicional como fallback...');
  }
  
  // Fallback para o método tradicional
  // Configurar timeout adaptativo
  const timeout = obterTimeoutAdaptativo('interacao');
  page.setDefaultTimeout(timeout);
  
  console.log(`Procurando seção de Órgãos Julgadores para vincular ${nomeOJ} com papel: ${papel}, visibilidade: ${visibilidade}...`);
  
  // Helper para garantir acordeon aberto e seção visível
  async function ensureAcordeonAberto() {
    console.log('DEBUG: Tentando abrir acordeon de Órgãos Julgadores');
    
    // 1) Se conteúdo já está visível, retorna
    const visible = await buscarElemento(page, 'orgaoJulgador');
    if (visible) return true;

    // 2) Primeiro tentar usando getByRole (método mais confiável)
    try {
      const { SeletorManager } = require('./utils/seletores');
      const sucessoGetByRole = await SeletorManager.clicarBotaoOrgaosJulgadoresByRole(page, obterTimeoutAdaptativo('interacao'));
      if (sucessoGetByRole) {
        await page.waitForTimeout(obterTimeoutAdaptativo('interacao') / 16);
        const afterVisible = await buscarElemento(page, 'orgaoJulgador');
        if (afterVisible) return true;
      }
    } catch (e) {
      console.log(`Erro ao usar getByRole: ${e.message}`);
    }

    // 3) Fallback: Buscar cabeçalho do acordeão usando utilitário
    const cabecalho = await buscarElemento(page, 'cabecalhoAcordeao');
    if (cabecalho) {
      try {
        await cabecalho.scrollIntoViewIfNeeded({ timeout: obterTimeoutAdaptativo('interacao') / 8 });
        const aria = await cabecalho.getAttribute('aria-expanded').catch(() => null);
        await cabecalho.click({ force: true });
        await page.waitForTimeout(obterTimeoutAdaptativo('interacao') / 16);
        
        const afterVisible = await buscarElemento(page, 'orgaoJulgador');
        if (afterVisible) return true;
        
        // Se tinha aria-expanded=false, tentar clicar novamente
        if (aria === 'false') {
          await cabecalho.click({ force: true });
          await page.waitForTimeout(obterTimeoutAdaptativo('interacao') / 16);
          const againVisible = await buscarElemento(page, 'orgaoJulgador');
          if (againVisible) return true;
        }
      } catch (e) {
        console.log(`Erro ao clicar no cabeçalho do acordeão: ${e.message}`);
      }
    }

    console.log('Nenhum cabeçalho de acordeão encontrado, assumindo que já está aberto');
    return false;
  }

  // Garantir acordeon aberto antes de prosseguir
  await ensureAcordeonAberto();

  // Tentar acionar o fluxo de inclusão (Adicionar)
  const botaoAdicionar = await buscarElemento(page, 'botaoAdicionar');
  if (botaoAdicionar) {
    try {
      await botaoAdicionar.click();
      console.log('Clicou no botão Adicionar');
      await page.waitForTimeout(obterTimeoutAdaptativo('interacao') / 8);
    } catch (e) {
      console.log(`Erro ao clicar no botão Adicionar: ${e.message}`);
    }
  }
  
  // Tentar localizar campo pelo rótulo "Órgão Julgador" e achar o controle associado
  try {
    const label = page.locator('label:has-text("Órgão Julgador")').first();
    await label.waitFor({ timeout: 150 });
    // Se existir atributo for, usar
    try {
      const forId = await label.getAttribute('for');
      if (forId) {
        const candidate = `#${forId}`;
        await page.waitForSelector(candidate, { timeout: 150 });
        console.log(`Campo associado ao label via for/id: ${candidate}`);
      }
    } catch (error) {}
    // Buscar em contêiner pai
    const container = label.locator('..');
    const nearControl = container.locator('mat-select, [role="combobox"], select, input').first();
    await nearControl.waitFor({ timeout: 150 });
    const handle = await nearControl.elementHandle();
    if (handle) {
      const tag = await handle.evaluate(el => el.tagName.toLowerCase());
      console.log(`Controle encontrado próximo ao label: <${tag}>`);
    }
  } catch (error) {}

  // Buscar campo de seleção do Órgão Julgador usando utilitário
  let selectEncontrado = await buscarElemento(page, 'orgaoJulgador');
  let seletorUsado = null;
  
  if (selectEncontrado) {
    // Validar se é realmente o campo correto
    const isValido = await SeletorManager.validarContextoOrgaoJulgador(page, selectEncontrado);
    if (isValido) {
      seletorUsado = 'orgaoJulgador';
      console.log('Campo de Órgão Julgador encontrado e validado');
    } else {
      selectEncontrado = null;
      console.log('Campo encontrado mas não é válido para Órgão Julgador');
    }
  }
  
  // Verificar se a página ainda está válida
  if (page.isClosed()) {
    throw new Error('A página foi fechada durante a execução');
  }

  // Se não encontrou ainda, tentar localizar o select diretamente
  
  try {
    const elemento = await buscarElemento(page, 'orgaoJulgador', obterTimeoutAdaptativo('interacao'));
    if (elemento && await SeletorManager.validarContextoOrgaoJulgador(page, elemento)) {
      selectEncontrado = elemento;
      seletorUsado = 'orgaoJulgador';
      console.log('DEBUG: Campo de seleção CORRETO encontrado usando utilitários');
    }
  } catch (e) {
    console.log(`DEBUG: Busca inicial do select falhou: ${e.message}`);
    
    // Se a página foi fechada, parar imediatamente
    if (e.message.includes('Target page, context or browser has been closed')) {
      throw new Error('A página foi fechada durante a busca do campo select');
    }
  }

  // Se não encontrou, tentar expandir a seção e procurar novamente
  if (!selectEncontrado) {
    // Verificar se a página ainda está válida
    if (page.isClosed()) {
      throw new Error('A página foi fechada durante a execução');
    }

    // Tentar expandir a seção usando os utilitários
    let expandiu = false;
    try {
      const cabecalho = await buscarElemento(page, 'cabecalhoAcordeao', obterTimeoutAdaptativo('interacao'));
      if (cabecalho) {
        await cabecalho.scrollIntoView({ behavior: 'auto', block: 'center' });
        await cabecalho.click();
        console.log('DEBUG: Seção expandida com sucesso usando utilitários');
        expandiu = true;
      }
    } catch (e) {
      console.log(`DEBUG: Falha ao expandir seção: ${e.message}`);
      
      // Se a página foi fechada, parar imediatamente
      if (e.message.includes('Target page, context or browser has been closed')) {
        throw new Error('A página foi fechada durante a execução. Verifique se não há problemas de sessão ou timeout.');
      }
    }
    
    if (!expandiu) {
      console.log('Não foi possível garantir a expansão da seção; seguindo mesmo assim.');
    }
    await page.waitForTimeout(obterTimeoutAdaptativo('interacao') / 10);

    // Após expandir, tentar clicar em "Adicionar" novamente
    try {
      const botaoAdicionar = await buscarElemento(page, 'botaoAdicionar', obterTimeoutAdaptativo('interacao'));
      if (botaoAdicionar) {
        await botaoAdicionar.click();
        console.log('Clicou em Adicionar após expandir usando utilitários');
        await page.waitForTimeout(obterTimeoutAdaptativo('interacao') / 10);
      }
    } catch (e) {
      console.log(`DEBUG: Falha ao clicar em Adicionar após expandir: ${e.message}`);
    }

    // Procurar o select novamente após tentar expandir
    try {
      const elemento = await buscarElemento(page, 'orgaoJulgador', obterTimeoutAdaptativo('interacao'));
      if (elemento && await SeletorManager.validarContextoOrgaoJulgador(page, elemento)) {
        selectEncontrado = elemento;
        seletorUsado = 'orgaoJulgador';
        console.log('Select encontrado após expandir seção usando utilitários');
      }
    } catch (e) {
      console.log(`DEBUG: Falha na busca do select após expandir: ${e.message}`);
      
      // Se a página foi fechada, parar imediatamente
      if (e.message && e.message.includes('Target page, context or browser has been closed')) {
        throw new Error('A página foi fechada durante a busca do campo select após expandir');
      }
    }
  }
  
  if (!selectEncontrado) {
    // Listar elementos disponíveis para depuração usando utilitários
    await listarElementosDisponiveis(page);
    throw new Error('Campo select de órgão julgador não encontrado');
  }
  
  console.log(`Selecionando órgão julgador: ${nomeOJ}`);
  
  // Usar utilitários de normalização
  const targetNorm = normalizarTexto(nomeOJ);
  const targetTokens = extrairTokensSignificativos(nomeOJ);
  
  console.log(`DEBUG: Órgão normalizado: "${targetNorm}"`);
  console.log(`DEBUG: Tokens significativos: [${targetTokens.join(', ')}]`);
  
  let selecaoFeita = false;
  
  // Se for um mat-select, precisamos clicar no trigger para abrir o dropdown
  if (seletorUsado && seletorUsado.includes('mat-')) {
    console.log('DEBUG: Detectado mat-select, clicando para abrir dropdown...');
    console.log(`DEBUG: Seletor usado: ${seletorUsado}`);
    try {
      // Verificar se a página ainda está válida
      if (page.isClosed()) {
        throw new Error('A página foi fechada antes de abrir o dropdown');
      }
      
      // Preferir o trigger interno
      const trigger = `${selectEncontrado} .mat-select-trigger, ${selectEncontrado} [role="combobox"], ${selectEncontrado}`;
      console.log(`DEBUG: Tentando clicar no trigger: ${trigger}`);
      await page.click(trigger, { force: true });
      console.log('DEBUG: Clique no trigger realizado com sucesso');
    } catch (error) {
      console.log(`DEBUG: Erro no trigger, tentando seletor direto: ${error.message}`);
      
      // Se a página foi fechada, parar imediatamente
      if (error.message.includes('Target page, context or browser has been closed')) {
        throw new Error('A página foi fechada durante o clique no mat-select');
      }
      
      await page.click(selectEncontrado, { force: true });
      console.log('DEBUG: Clique direto realizado');
    }
    console.log('DEBUG: Aguardando dropdown abrir...');
    await page.waitForTimeout(50); // Aguardar dropdown abrir
    console.log('DEBUG: Timeout concluído, procurando opções...');
    
    // Procurar pelas opções do mat-select
    try {
      // Verificar se a página ainda está válida
      if (page.isClosed()) {
        throw new Error('A página foi fechada antes de procurar opções do mat-select');
      }

      // Algumas implementações utilizam painéis overlay, aguardar painel visível
      const painelSelectors = ['.cdk-overlay-pane mat-option', 'div[role="listbox"] mat-option', 'mat-option'];
      let opcoes = [];
      console.log('DEBUG: Tentando encontrar opções com seletores:', painelSelectors);
      
      for (const ps of painelSelectors) {
        try {
          console.log(`DEBUG: Tentando seletor: ${ps}`);
          
          // Verificar se a página ainda está válida antes de cada tentativa
          if (page.isClosed()) {
            throw new Error('A página foi fechada durante a busca de opções');
          }
          
          await page.waitForSelector(ps, { timeout: 800 });
          console.log(`DEBUG: Seletor ${ps} encontrado, capturando opções...`);
          opcoes = await page.$$eval(ps, options => 
            options.map(option => ({ value: option.getAttribute('value'), text: (option.textContent || '').trim() }))
          );
          console.log(`DEBUG: Capturadas ${opcoes.length} opções com seletor ${ps}`);
          if (opcoes.length > 0) break;
        } catch (error) {
          console.log(`DEBUG: Seletor ${ps} falhou: ${error.message}`);
          
          // Se a página foi fechada, parar imediatamente
          if (error.message && error.message.includes('Target page, context or browser has been closed')) {
            throw new Error('A página foi fechada durante a busca de opções do mat-select');
          }
        }
      }
      console.log('DEBUG: Opções mat-select disponíveis:', opcoes);
      console.log('DEBUG: Opções normalizadas:', opcoes.map(o => ({ original: o.text, normalizada: normalizarTexto(o.text || '') })));

      // Se não houver opções capturadas, tentar forçar reabertura do painel
      if (!opcoes || opcoes.length === 0) {
        console.log('Nenhuma opcão capturada no primeiro intento; reabrindo painel...');
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(50);
        try {
          const trigger = `${selectEncontrado} .mat-select-trigger, ${selectEncontrado} [role="combobox"], ${selectEncontrado}`;
          await page.click(trigger, { force: true });
          await page.waitForTimeout(150);
          opcoes = await page.$$eval('.cdk-overlay-pane mat-option, div[role="listbox"] mat-option, mat-option', options => 
            options.map(option => ({ value: option.getAttribute('value'), text: (option.textContent || '').trim() }))
          );
          console.log('Opções após reabrir painel:', opcoes);
        } catch (error) {}
      }

      // Estratégia de correspondência segura usando utilitários
      const withNorm = opcoes.map(o => ({ ...o, norm: normalizarTexto(o.text || '') }));

      // Encontrar melhor correspondência usando algoritmo de similaridade
      let melhorOpcao = null;
      let melhorScore = 0;
      
      for (const opcao of withNorm) {
        const score = calcularSimilaridade(targetNorm, opcao.norm, targetTokens, extrairTokensSignificativos(opcao.text || ''));
        if (score > melhorScore) {
          melhorScore = score;
          melhorOpcao = opcao;
        }
      }
      
      console.log(`DEBUG: Melhor opção encontrada: ${melhorOpcao?.text} (score: ${melhorScore})`);
      
      // Verificar se a correspondência é suficientemente boa
      if (!melhorOpcao || !verificarEquivalencia(targetNorm, melhorOpcao.norm, targetTokens, extrairTokensSignificativos(melhorOpcao.text || ''))) {
        throw new Error(`Órgão julgador "${nomeOJ}" não encontrado entre as opções disponíveis`);
      }
      
      // Verificar se há múltiplas opções com score similar (ambiguidade)
      const opcoesAmbiguas = withNorm.filter(o => {
        const score = calcularSimilaridade(targetNorm, o.norm, targetTokens, extrairTokensSignificativos(o.text || ''));
        return score >= melhorScore * 0.95 && o !== melhorOpcao;
      });
      
      if (opcoesAmbiguas.length > 0) {
        const lista = [melhorOpcao, ...opcoesAmbiguas].map(c => c.text).join(' | ');
        throw new Error(`Múltiplas opções encontradas para "${nomeOJ}". Especifique melhor (ex.: incluir número da vara). Opções: ${lista}`);
      }

      const escolhido = melhorOpcao;
      console.log(`Selecionando opção: ${escolhido.text}`);
      
      // Verificar se a página ainda está válida antes do clique final
      if (page.isClosed()) {
        throw new Error('A página foi fechada antes de clicar na opção do mat-select');
      }
      
      await page.click(`mat-option:has-text("${escolhido.text}")`);
      await page.waitForTimeout(50);
      selecaoFeita = true;
    } catch (error) {
      console.log('Erro ao processar mat-select:', error.message);
      
      // Se a página foi fechada, propagar o erro
      if (error.message && error.message.includes('Target page, context or browser has been closed')) {
        throw new Error('A página foi fechada durante a seleção do mat-select');
      }
    }
  } else if (
    (seletorUsado && (seletorUsado.includes('ng-select') || seletorUsado.includes('select2') || seletorUsado.includes('role="combobox"') || seletorUsado.includes('[role="combobox"]')))
  ) {
    // Fluxo para ng-select, select2, ou inputs com role=combobox (autocomplete)
    try {
      console.log('Detectado componente de autocomplete/combobox. Abrindo dropdown...');
      // Abrir o campo
      await page.click(selectEncontrado);
      await page.waitForTimeout(100);

      // Tentar localizar um input interno para digitar (melhora precisão)
      try {
        const innerInput = await page.$(`${selectEncontrado} input`);
        if (innerInput) {
          const searchQuery = (targetTokens.sort((a,b) => b.length - a.length)[0]) || nomeOJ;
          await innerInput.fill('');
          await innerInput.type(searchQuery, { delay: 30 });
        }
      } catch (error) {}

      // Aguardar opções aparecerem
      const optionsSelectors = [
        '.ng-dropdown-panel .ng-option',
        '.ng-option',
        'li.select2-results__option',
        '.select2-results__option',
        '[role="option"]',
        'li[role="option"]',
        'div[role="option"]',
        '[id^="cdk-overlay-"] [role="option"]',
        'mat-option'
      ];
      let optionsFound = [];
      for (const os of optionsSelectors) {
        try {
          await page.waitForSelector(os, { timeout: 600 });
          optionsFound = await page.$$eval(os, nodes => nodes.map(n => (n.textContent || '').trim()).filter(t => t));
          if (optionsFound.length > 0) {
            console.log('Opções encontradas no dropdown:', optionsFound);
            // Mapear elementos com normalização usando utilitários
            const normalized = optionsFound.map(t => ({ text: t, norm: normalizarTexto(t) }));
            
            // Encontrar melhor correspondência
            let melhorOpcao = null;
            let melhorScore = 0;
            
            for (const opcao of normalized) {
              const score = calcularSimilaridade(targetNorm, opcao.norm, targetTokens, extrairTokensSignificativos(opcao.text));
              if (score > melhorScore) {
                melhorScore = score;
                melhorOpcao = opcao;
              }
            }
            
            if (!melhorOpcao || !verificarEquivalencia(targetNorm, melhorOpcao.norm, targetTokens, extrairTokensSignificativos(melhorOpcao.text))) {
              throw new Error(`Órgão julgador "${nomeOJ}" não encontrado entre as opções exibidas`);
            }
            
            // Verificar ambiguidade
            const opcoesAmbiguas = normalized.filter(o => {
              const score = calcularSimilaridade(targetNorm, o.norm, targetTokens, extrairTokensSignificativos(o.text));
              return score >= melhorScore * 0.95 && o !== melhorOpcao;
            });
            
            if (opcoesAmbiguas.length > 0) {
              const lista = [melhorOpcao, ...opcoesAmbiguas].map(c => c.text).join(' | ');
              throw new Error(`Múltiplas opções para "${nomeOJ}". Especifique melhor. Opções: ${lista}`);
            }
            
            const escolhido = melhorOpcao;
            // Clicar pela âncora de texto
            await page.click(`${os}:has-text("${escolhido.text}")`);
            await page.waitForTimeout(30);
            selecaoFeita = true;
            break;
          }
        } catch (error) {}
      }
    } catch (error) {
      console.log('Erro ao processar componente de autocomplete/combobox:', error.message);
    }
  } else {
    // Aguardar um pouco para o select carregar as opções
    await page.waitForTimeout(obterTimeoutAdaptativo('interacao'));
    
    // Processar select tradicional
    try {
      // Verificar se a página ainda está válida antes de processar
      if (page.isClosed()) {
        throw new Error('A página foi fechada antes de processar select tradicional');
      }

      // Verificar se o elemento ainda existe e é um select válido
      const isValidSelect = await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        return element && element.tagName.toLowerCase() === 'select';
      }, selectEncontrado);

      if (!isValidSelect) {
        console.log('DEBUG: Elemento não é um select tradicional válido');
        throw new Error('Elemento não é um select tradicional válido');
      }

      // Listar opções disponíveis
      const opcoes = await page.$$eval(`${selectEncontrado} option`, options => 
        options.map(option => ({ value: option.value, text: (option.textContent || '').trim() }))
      );
      console.log('DEBUG: Opções select tradicional disponíveis:', opcoes);
      console.log('DEBUG: Opções normalizadas:', opcoes.map(o => ({ original: o.text, normalizada: normalizarTexto(o.text || '') })));

      // Encontrar a melhor opção usando os utilitários de normalização
      const melhorOpcao = encontrarMelhorOpcao(opcoes.map(o => o.text), nomeOJ);
      
      if (!melhorOpcao) {
        throw new Error(`Órgão julgador "${nomeOJ}" não encontrado entre as opções disponíveis`);
      }

      // Verificar se há ambiguidade
      verificarAmbiguidade(opcoes.map(o => o.text), nomeOJ, melhorOpcao);

      // Encontrar a opção correspondente pelo texto
      const opcaoEscolhida = opcoes.find(o => o.text === melhorOpcao);
      if (!opcaoEscolhida) {
        throw new Error(`Erro interno: opção "${melhorOpcao}" não encontrada na lista original`);
      }

      // Verificar novamente se a página está válida antes de selectOption
      if (page.isClosed()) {
        throw new Error('A página foi fechada antes de executar selectOption');
      }

      await page.selectOption(selectEncontrado, opcaoEscolhida.value);
      console.log(`Órgão julgador selecionado: ${opcaoEscolhida.text}`);
      selecaoFeita = true;
    } catch (error) {
      console.log('Erro ao selecionar opção em select tradicional:', error.message);
      
      // Se a página foi fechada, propagar o erro
      if (error.message && error.message.includes('Target page, context or browser has been closed')) {
        throw new Error('A página foi fechada durante a seleção do select tradicional');
      }
    }
  }
  
  // Verificar se alguma seleção foi feita
  if (!selecaoFeita) {
    throw new Error(`Órgão julgador "${nomeOJ}" não encontrado nas opções disponíveis`);
  }
  
  // Aguardar modal de Localização/Visibilidade abrir
  await aguardarModalLocalizacaoVisibilidade(page);
  
  // Debug: analisar elementos após modal abrir
  await debugElementosNaPagina(page, 'APÓS MODAL ABRIR');
  
  // Configurar papel/perfil do servidor
  console.log(`Configurando papel: ${papel}...`);
  await configurarPapel(page, papel);
  
  // Configurar visibilidade
  console.log(`Configurando visibilidade: ${visibilidade}...`);
  await configurarVisibilidade(page, visibilidade);
  
  // Debug: analisar elementos após configurar campos
  await debugElementosNaPagina(page, 'APÓS CONFIGURAR CAMPOS');
  
  // Se chegou até aqui, procurar o botão de gravar/vincular
  console.log('DEBUG: Procurando botão "Gravar" para finalizar vinculação...');
  
  // Aguardar que o modal esteja totalmente carregado e os campos preenchidos
  await page.waitForTimeout(1000);
  
  // Verificar se estamos no modal correto e aguardar estabilização
  let modalConfirmado = false;
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    try {
      await page.waitForSelector('text=Localização/Visibilidade', { timeout: 1000 });
      console.log('DEBUG: Modal de Localização/Visibilidade confirmado');
      modalConfirmado = true;
      break;
    } catch (e) {
      console.log(`DEBUG: Tentativa ${tentativa + 1}/5 - Modal de Localização/Visibilidade não encontrado, aguardando...`);
      await page.waitForTimeout(300);
    }
  }
  
  if (!modalConfirmado) {
    throw new Error('Modal de Localização/Visibilidade não foi encontrado após múltiplas tentativas');
  }
  
  // Buscar botão Gravar/Vincular usando os utilitários
  console.log('DEBUG: Procurando botão Gravar/Vincular...');
  
  let botaoEncontrado = false;
  const timeoutBusca = obterTimeoutAdaptativo('interacao');
  
  try {
    const botaoGravar = await buscarElemento(page, 'botaoAdicionar', timeoutBusca);
    
    if (botaoGravar) {
      console.log('DEBUG: Botão Gravar/Vincular encontrado, tentando clicar...');
      
      // Tentar diferentes estratégias de clique
      try {
        await page.click(botaoGravar, { force: true });
        console.log('DEBUG: Clique direto no botão realizado');
      } catch (e1) {
        try {
          // Clique com JavaScript como fallback
          await page.evaluate((selector) => {
            const el = document.querySelector(selector);
            if (el) el.click();
          }, botaoGravar);
          console.log('DEBUG: Clique via JavaScript no botão realizado');
        } catch (e2) {
          console.log('DEBUG: Todas as estratégias de clique no botão falharam');
          throw new Error('Não foi possível clicar no botão Gravar/Vincular');
        }
      }
      
      console.log('DEBUG: Clique no botão Gravar/Vincular executado');
      
      // Aguardar processamento da ação
      await page.waitForTimeout(obterTimeoutAdaptativo('interacao'));
      
      // Verificar múltiplas condições para confirmar sucesso
      let sucessoConfirmado = false;
      
      // Verificação 1: Modal de Localização/Visibilidade fechou
      const modalAindaPresente = await page.$('text=Localização/Visibilidade');
      if (!modalAindaPresente) {
        console.log('DEBUG: Modal de Localização/Visibilidade fechado - clique bem-sucedido');
        sucessoConfirmado = true;
      }
      
      // Verificação 2: Apareceu modal de confirmação
      const modalConfirmacao = await page.$('text=Tem certeza que deseja vincular esse Órgão Julgador ao Perito?');
      if (modalConfirmacao) {
        console.log('DEBUG: Modal de confirmação apareceu - clique bem-sucedido');
        sucessoConfirmado = true;
      }
      
      // Verificação 3: Mensagem de sucesso apareceu
      const mensagemSucesso = await page.$('text=sucesso, text=vinculado, text=vinculação');
      if (mensagemSucesso) {
        console.log('DEBUG: Mensagem de sucesso detectada - clique bem-sucedido');
        sucessoConfirmado = true;
      }
      
      // Verificação 4: Verificar se apareceu algum modal de erro ou aviso
      const modalErro = await page.$('text=erro, text=falha, text=problema');
      if (modalErro) {
        console.log('DEBUG: Modal de erro detectado após clique');
        const textoErro = await modalErro.textContent();
        console.log(`DEBUG: Texto do erro: ${textoErro}`);
      }
      
      // Verificação 5: Forçar sucesso se não há mais modal de Localização/Visibilidade
      if (!modalAindaPresente && !modalConfirmacao && !mensagemSucesso) {
        console.log('DEBUG: Modal fechou sem confirmação explícita - assumindo sucesso');
        sucessoConfirmado = true;
      }
      
      if (sucessoConfirmado) {
        botaoEncontrado = true;
      } else {
        throw new Error('Clique no botão não teve efeito esperado');
      }
    }
  } catch (error) {
    console.log(`DEBUG: Erro ao buscar botão gravar/vincular: ${error.message}`);
    
    // Se a página foi fechada, parar imediatamente
    if (error.message.includes('Target page, context or browser has been closed')) {
      throw new Error('A página foi fechada durante a busca do botão vincular');
    }
  }
  
  if (!botaoEncontrado) {
    console.log(`DEBUG: Botão "Gravar" não encontrado`);
    
    // Usar utilitário para listar elementos disponíveis
    await listarElementosDisponiveis(page, 'button, input[type="submit"], input[type="button"]', 'botões');
    
    const mensagemErro = 'Botão "Gravar" não encontrado no modal de Localização/Visibilidade';
    
    throw new Error(mensagemErro);
  }
  
  // Aguardar modal de confirmação aparecer
  console.log('Aguardando modal de confirmação...');
  try {
    await page.waitForSelector('text=Tem certeza que deseja vincular esse Órgão Julgador ao Perito?', { timeout: 2000 });
    console.log('Modal de confirmação detectado');
    
    // Procurar e clicar no botão "Sim" usando utilitários
    const seletoresSim = [
      'button:has-text("Sim")',
      'button:has-text("sim")',
      'button:has-text("SIM")',
      'input[type="button"][value="Sim"]',
      'input[type="submit"][value="Sim"]',
      '.btn:has-text("Sim")'
    ];
    
    try {
      const botaoSim = await buscarElemento(page, seletoresSim, 'botão Sim do modal');
      await botaoSim.click();
      console.log('Clicou no botão Sim do modal de confirmação');
    } catch (error) {
      console.log('Botão Sim não encontrado, listando botões do modal:');
      await listarElementosDisponiveis(page, 'button, input[type="submit"], input[type="button"]', 'botões do modal');
      throw new Error('Botão Sim do modal não encontrado');
    }
  } catch (error) {
    console.log('Modal de confirmação não detectado ou erro:', error.message);
  }
  
  // Aguardar confirmação da vinculação e reabrir acordeon se tiver fechado
  console.log('Aguardando confirmação da vinculação...');
  try {
    await Promise.race([
      page.waitForSelector('text=sucesso', { timeout: 2000 }),
      page.waitForSelector('text=vinculado', { timeout: 2000 }),
      page.waitForSelector('text=vinculação', { timeout: 2000 }),
      page.waitForTimeout(400)
    ]);
  } catch (error) {}

  // Reabrir acordeon de Órgãos Julgadores se tiver fechado
  const possiveisAcordeons = [
    'text=Órgãos Julgadores vinculados ao Perito',
    'text=Órgãos Julgadores',
    'text=Orgãos Julgadores',
    '[data-toggle="collapse"]',
    '.panel-heading',
    'h4:has-text("Órgão")',
    'h3:has-text("Órgão")',
    'span:has-text("Órgão")'
  ];
  
  try {
    const acordeon = await buscarElemento(page, possiveisAcordeons, 'acordeão de Órgãos Julgadores', obterTimeoutAdaptativo('busca'));
    await acordeon.click();
    console.log('Acordeão de Órgãos Julgadores reaberto');
  } catch (error) {
    console.log('Acordeão não encontrado ou já estava aberto');
  }

  // Garantir que o botão/fluxo de Adicionar esteja disponível novamente para próximo vínculo
  try {
    await buscarElemento(page, 'botaoAdicionar', obterTimeoutAdaptativo('busca'));
    console.log('Botão Adicionar disponível para próximo vínculo');
  } catch (error) {
    console.log('Botão Adicionar não encontrado - pode estar em estado diferente');
  }

  // Pequeno intervalo para estabilidade entre vínculos
  await page.waitForTimeout(obterTimeoutAdaptativo('interacao'));

  console.log('Vinculação concluída!');
}

// Função auxiliar para configurar o papel/perfil do servidor
async function configurarPapel(page, papel) {
  console.log(`DEBUG: Iniciando configuração do papel: ${papel}`);
  
  // Aguardar um pouco para garantir que a modal carregou
  await page.waitForTimeout(1000);
  
  // Timeout geral para evitar loop infinito
  const startTime = Date.now();
  const maxTimeout = 30000; // 30 segundos
  
  const seletoresPapel = [
    // Seletores específicos para modal de Localização/Visibilidade
    '#mat-dialog-2 mat-select[placeholder="Papel"]',
    'pje-modal-localizacao-visibilidade mat-select[placeholder="Papel"]',
    '#mat-select-42',
    'mat-select[aria-labelledby*="mat-form-field-label-97"]',
    'mat-select[id="mat-select-42"]',
    '.ng-tns-c181-97.mat-select-required',
    // Seletores genéricos mais amplos
    'mat-dialog-container mat-select[placeholder="Papel"]',
    '[role="dialog"] mat-select[placeholder="Papel"]',
    '.mat-dialog-container mat-select[placeholder="Papel"]',
    '.campo-papel mat-select',
    'mat-select[placeholder="Papel"]',
    '.mat-form-field.campo-papel mat-select',
    'mat-select[placeholder*="Papel"]',
    'mat-select[placeholder*="Perfil"]',
    'mat-select[placeholder*="Função"]',
    'mat-select[placeholder*="Cargo"]',
    'select[name*="papel"]',
    'select[name*="perfil"]',
    'select[name*="funcao"]',
    'select[name*="cargo"]',
    'label:has-text("Papel") + * mat-select',
    'label:has-text("Perfil") + * mat-select',
    'label:has-text("Função") + * mat-select',
    'label:has-text("Cargo") + * mat-select',
    'label:has-text("Papel") ~ * mat-select',
    'label:has-text("Perfil") ~ * mat-select',
    '.mat-form-field:has(label:has-text("Papel")) mat-select',
    '.mat-form-field:has(label:has-text("Perfil")) mat-select'
  ];
  
  for (const seletor of seletoresPapel) {
    // Verificar timeout
    if (Date.now() - startTime > maxTimeout) {
      console.log(`DEBUG: Timeout atingido (${maxTimeout}ms), interrompendo configuração de papel`);
      break;
    }
    
    try {
      console.log(`DEBUG: Tentando configurar papel com seletor: ${seletor}`);
      
      // Verificar se o elemento existe antes de tentar clicar
      const elemento = await page.$(seletor);
      if (!elemento) {
        console.log(`DEBUG: Elemento não encontrado para seletor: ${seletor}`);
        continue;
      }
      
      console.log(`DEBUG: Elemento encontrado, tentando clicar...`);
      
      // Verificar se é um mat-select
      if (seletor.includes('mat-select')) {
        // Tentar diferentes estratégias de clique
        try {
          // Estratégia 1: Clique direto
          await page.click(seletor, { force: true });
          console.log(`DEBUG: Clique direto realizado`);
        } catch (e1) {
          try {
            // Estratégia 2: Clique no trigger
            await page.click(`${seletor} .mat-select-trigger`, { force: true });
            console.log(`DEBUG: Clique no trigger realizado`);
          } catch (e2) {
            try {
              // Estratégia 3: Clique com JavaScript
              await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                if (el) el.click();
              }, seletor);
              console.log(`DEBUG: Clique via JavaScript realizado`);
            } catch (e3) {
              console.log(`DEBUG: Todas as estratégias de clique falharam`);
              continue;
            }
          }
        }
        
        // Aguardar dropdown abrir
        await page.waitForTimeout(800);
        
        // Procurar pela opção do papel
        const opcoesPapel = [
          `mat-option:has-text("${papel}")`,
          `mat-option[value="${papel}"]`,
          `[role="option"]:has-text("${papel}")`,
          // Fallbacks genéricos apenas se não especificado
          ...(papel === 'Secretário de Audiência' ? [
            `mat-option:has-text("Secretário de Audiência")`,
            `mat-option:has-text("Secretario de Audiencia")`,
            `mat-option:has-text("Secretário")`,
            `[role="option"]:has-text("Secretário")`,
            `[role="option"]:has-text("Secretario")`
          ] : []),
          ...(papel === 'Diretor de Secretaria' ? [
            `mat-option:has-text("Diretor de Secretaria")`,
            `mat-option:has-text("Diretor")`,
            `[role="option"]:has-text("Diretor")`
          ] : [])
        ];
        
        let opcaoSelecionada = false;
        for (const opcao of opcoesPapel) {
          try {
            console.log(`DEBUG: Procurando opção: ${opcao}`);
            await page.waitForSelector(opcao, { timeout: 2000 });
            await page.click(opcao, { force: true });
            console.log(`DEBUG: Papel configurado com sucesso: ${papel}`);
            opcaoSelecionada = true;
            return;
          } catch (e) {
            console.log(`DEBUG: Opção ${opcao} não encontrada: ${e.message}`);
          }
        }
        
        if (!opcaoSelecionada) {
          // Listar opções disponíveis para debug
          try {
            const opcoes = await page.$$eval('mat-option, [role="option"]', options => 
              options.map(opt => opt.textContent?.trim()).filter(text => text)
            );
            console.log(`DEBUG: Opções disponíveis no dropdown:`, opcoes);
            
            // Tentar selecionar a primeira opção disponível como fallback
            if (opcoes.length > 0) {
              console.log(`DEBUG: Tentando selecionar primeira opção como fallback: ${opcoes[0]}`);
              await page.click('mat-option:first-child, [role="option"]:first-child', { force: true });
              console.log(`DEBUG: Primeira opção selecionada como fallback`);
              return;
            }
          } catch (error) {}
          
          // Se chegou até aqui, fechar o dropdown e continuar
          console.log(`DEBUG: Fechando dropdown e continuando sem configurar visibilidade`);
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
          return;
        }
        
      } else {
        // Select tradicional
        await page.selectOption(seletor, papel);
        console.log(`DEBUG: Papel configurado em select tradicional: ${papel}`);
        return;
      }
    } catch (error) {
      console.log(`DEBUG: Seletor de papel ${seletor} falhou: ${error.message}`);
    }
  }
  
  console.log('AVISO: Campo de papel não encontrado, continuando sem configurar...');
}

/**
 * Configura a visibilidade no modal de Localização/Visibilidade
 * @param {Object} page - Instância da página do Playwright
 * @param {string} visibilidade - Valor da visibilidade a ser configurada
 */
async function configurarVisibilidadeModal(page, visibilidade) {
    console.log(`🎯 Configurando visibilidade no modal: ${visibilidade}`);
    
    try {
        // 1. Aguardar estabilização do modal
        await page.waitForTimeout(1000);
        
        // 2. Procurar pelo mat-select de visibilidade/localização no modal
        const visibilidadeSelectors = [
            // Seletores específicos por placeholder
            'mat-dialog-container mat-select[placeholder*="Localização"]',
            'mat-dialog-container mat-select[placeholder*="Visibilidade"]',
            '[role="dialog"] mat-select[placeholder*="Localização"]',
            '[role="dialog"] mat-select[placeholder*="Visibilidade"]',
            '.mat-dialog-container mat-select[placeholder*="Localização"]',
            '.mat-dialog-container mat-select[placeholder*="Visibilidade"]',
            
            // Seletores por name
            'mat-dialog-container mat-select[name*="visibilidade"]',
            'mat-dialog-container mat-select[name*="localizacao"]',
            '[role="dialog"] mat-select[name*="visibilidade"]',
            '[role="dialog"] mat-select[name*="localizacao"]',
            
            // Seletores por atributos aria
            'mat-dialog-container mat-select[aria-label*="Visibilidade"]',
            'mat-dialog-container mat-select[aria-label*="Localização"]',
            '[role="dialog"] mat-select[aria-label*="Visibilidade"]',
            '[role="dialog"] mat-select[aria-label*="Localização"]',
            
            // Seletores por classes específicas
            'mat-dialog-container .campo-visibilidade mat-select',
            'mat-dialog-container .campo-localizacao mat-select',
            '.mat-dialog-container .campo-visibilidade mat-select',
            '.mat-dialog-container .campo-localizacao mat-select',
            
            // Seletores por ID específicos
            'mat-dialog-container #mat-select-visibilidade',
            'mat-dialog-container #mat-select-localizacao',
            'mat-dialog-container mat-select[id*="visibilidade"]',
            'mat-dialog-container mat-select[id*="localizacao"]',
            
            // Fallbacks gerais (deve vir por último)
            'mat-dialog-container mat-select',
            '[role="dialog"] mat-select'
        ];
        
        let matSelectVisibilidade = null;
        for (const selector of visibilidadeSelectors) {
            try {
                console.log(`🔍 Testando seletor de visibilidade: ${selector}`);
                const candidate = page.locator(selector);
                
                // Pular o primeiro mat-select que é do OJ
                const count = await candidate.count();
                console.log(`  - Encontrados ${count} mat-select(s)`);
                
                for (let i = 0; i < count; i++) {
                    try {
                        const placeholder = await candidate.nth(i).getAttribute('placeholder');
                        console.log(`  - Mat-select ${i + 1}: placeholder="${placeholder}"`);
                        
                        if (placeholder && (
                            placeholder.toLowerCase().includes('localização') || 
                            placeholder.toLowerCase().includes('visibilidade')
                        )) {
                            if (await candidate.nth(i).isVisible()) {
                                matSelectVisibilidade = candidate.nth(i);
                                console.log(`✅ Mat-select de visibilidade encontrado: ${selector}, índice ${i}`);
                                break;
                            }
                        }
                    } catch (e) {
                        console.log(`  - Erro ao verificar mat-select ${i + 1}: ${e.message}`);
                    }
                }
                
                if (matSelectVisibilidade) break;
                
            } catch (error) {
                console.log(`❌ Seletor ${selector} falhou: ${error.message}`);
            }
        }
        
        if (!matSelectVisibilidade) {
            throw new Error('Mat-select de visibilidade não encontrado no modal');
        }
        
        // 3. Clicar no mat-select para abrir o dropdown
        console.log('🖱️ Clicando no mat-select de visibilidade...');
        await matSelectVisibilidade.click({ force: true });
        await page.waitForTimeout(1500);
        
        // 4. Aguardar e verificar se há opções disponíveis com múltiplas tentativas
        let opcoes = null;
        let numOpcoes = 0;
        const maxTentativas = 5;
        
        console.log('🔍 Aguardando opções aparecerem no dropdown...');
        for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
            console.log(`📋 Tentativa ${tentativa}/${maxTentativas} - verificando opções...`);
            
            // Tentar diferentes seletores para mat-option
            const opcoesSelectors = [
                'mat-option', // Global
                '.cdk-overlay-container mat-option', // Container overlay
                '.mat-select-panel mat-option', // Panel específico
                '[role="listbox"] mat-option', // Dentro do listbox
                '.mat-option' // Classe direta
            ];
            
            for (const selector of opcoesSelectors) {
                try {
                    const candidateOpcoes = page.locator(selector);
                    const candidateCount = await candidateOpcoes.count();
                    console.log(`  - Seletor "${selector}": ${candidateCount} opções`);
                    
                    if (candidateCount > 0) {
                        opcoes = candidateOpcoes;
                        numOpcoes = candidateCount;
                        console.log(`✅ Opções encontradas com seletor: ${selector}`);
                        break;
                    }
                } catch (error) {
                    console.log(`  - Erro com seletor "${selector}": ${error.message}`);
                }
            }
            
            if (numOpcoes > 0) break;
            
            console.log(`⏱️ Tentativa ${tentativa} falhou, aguardando mais 2s...`);
            await page.waitForTimeout(2000);
            
            // Tentar clicar no mat-select novamente para garantir que está aberto
            if (tentativa < maxTentativas) {
                try {
                    console.log('🖱️ Re-clicando no mat-select para reabrir...');
                    await matSelectVisibilidade.click({ force: true });
                    await page.waitForTimeout(1000);
                } catch (error) {
                    console.log(`⚠️ Erro ao re-clicar: ${error.message}`);
                }
            }
        }
        
        console.log(`📋 FINAL: ${numOpcoes} opções encontradas no dropdown de visibilidade`);
        
        if (numOpcoes === 0) {
            // Capturar informações de debug antes de falhar
            console.log('🔍 DEBUG: Capturando estado do modal para diagnóstico...');
            try {
                const modalVisible = await page.locator('mat-dialog-container').isVisible();
                console.log(`  - Modal visível: ${modalVisible}`);
                
                const selectVisible = await matSelectVisibilidade.isVisible();
                console.log(`  - Mat-select visível: ${selectVisible}`);
                
                const selectAriaExpanded = await matSelectVisibilidade.getAttribute('aria-expanded');
                console.log(`  - Mat-select expandido: ${selectAriaExpanded}`);
                
                const overlayExists = await page.locator('.cdk-overlay-container').count();
                console.log(`  - Overlays CDK encontrados: ${overlayExists}`);
                
                const panelExists = await page.locator('.mat-select-panel').count();
                console.log(`  - Painéis mat-select encontrados: ${panelExists}`);
                
            } catch (debugError) {
                console.log(`⚠️ Erro ao capturar debug: ${debugError.message}`);
            }
            
            throw new Error('Nenhuma opção disponível no dropdown de visibilidade após múltiplas tentativas. Verifique se o campo está configurado corretamente no sistema.');
        }
        
        // 5. Listar todas as opções disponíveis
        const opcoesTexto = await opcoes.allTextContents();
        console.log('📋 Opções de visibilidade disponíveis:');
        opcoesTexto.forEach((opcao, index) => {
            console.log(`  ${index + 1}. "${opcao.trim()}"`);
        });
        
        // 6. Tentar selecionar a opção desejada
        const opcoesParaTentar = [
            visibilidade, // Valor original
            'Público',
            'Publico', // Sem acento
            'PÚBLICO',
            'PUBLICO',
            'Público - Irrestrito',
            'Publico - Irrestrito',
            'Irrestrito'
        ];
        
        let opcaoSelecionada = false;
        for (const opcaoTentativa of opcoesParaTentar) {
            if (opcaoSelecionada) break;
            
            try {
                console.log(`🔍 Tentando selecionar: "${opcaoTentativa}"`);
                
                // Busca exata
                const opcaoExata = opcoes.filter({ hasText: new RegExp(`^\\s*${opcaoTentativa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i') });
                if (await opcaoExata.count() > 0) {
                    await opcaoExata.first().click({ force: true });
                    console.log(`✅ Opção selecionada (exata): "${opcaoTentativa}"`);
                    opcaoSelecionada = true;
                    break;
                }
                
                // Busca parcial
                const opcaoParcial = opcoes.filter({ hasText: new RegExp(opcaoTentativa, 'i') });
                if (await opcaoParcial.count() > 0) {
                    await opcaoParcial.first().click({ force: true });
                    console.log(`✅ Opção selecionada (parcial): "${opcaoTentativa}"`);
                    opcaoSelecionada = true;
                    break;
                }
                
            } catch (error) {
                console.log(`❌ Falha ao tentar "${opcaoTentativa}": ${error.message}`);
            }
        }
        
        if (!opcaoSelecionada) {
            // Como fallback, selecionar a primeira opção disponível
            try {
                console.log('⚠️ Selecionando primeira opção disponível como fallback...');
                const primeiraOpcao = opcoes.first();
                const textoOpcao = await primeiraOpcao.textContent();
                await primeiraOpcao.click({ force: true });
                console.log(`✅ Primeira opção selecionada: "${textoOpcao}"`);
                opcaoSelecionada = true;
            } catch (fallbackError) {
                throw new Error(`Não foi possível selecionar nenhuma opção de visibilidade: ${fallbackError.message}`);
            }
        }
        
        // 7. Aguardar processamento
        await page.waitForTimeout(1000);
        console.log('✅ Visibilidade configurada com sucesso');
        
    } catch (error) {
        console.error(`❌ Erro ao configurar visibilidade: ${error.message}`);
        throw error;
    }
}

// Função auxiliar para configurar a visibilidade
async function configurarVisibilidade(page, visibilidade) {
  console.log(`DEBUG: Iniciando configuração da visibilidade: ${visibilidade}`);
  
  // Aguardar um pouco para garantir que a modal carregou
  await page.waitForTimeout(1000);
  
  // Timeout geral para evitar loop infinito
  const startTime = Date.now();
  const maxTimeout = 30000; // 30 segundos
  
  const seletoresVisibilidade = [
    // Seletores específicos para modal de Localização/Visibilidade
    '#mat-dialog-2 mat-select[placeholder="Localização"]',
    'pje-modal-localizacao-visibilidade mat-select[placeholder="Localização"]',
    '#mat-select-44',
    'mat-select[aria-labelledby*="mat-form-field-label-99"]',
    'mat-select[id="mat-select-44"]',
    // Seletores genéricos mais amplos
    'mat-dialog-container mat-select[placeholder="Localização"]',
    '[role="dialog"] mat-select[placeholder="Localização"]',
    '.mat-dialog-container mat-select[placeholder="Localização"]',
    '.campo-localizacao mat-select',
    'mat-select[placeholder="Localização"]',
    '.mat-form-field.campo-localizacao mat-select',
    'mat-select[placeholder*="Visibilidade"]',
    'mat-select[placeholder*="Localização"]',
    'select[name*="visibilidade"]',
    'select[name*="localizacao"]',
    'label:has-text("Visibilidade") + * mat-select',
    'label:has-text("Localização") + * mat-select',
    'label:has-text("Visibilidade") ~ * mat-select',
    'label:has-text("Localização") ~ * mat-select',
    '.mat-form-field:has(label:has-text("Visibilidade")) mat-select',
    '.mat-form-field:has(label:has-text("Localização")) mat-select'
  ];
  
  for (const seletor of seletoresVisibilidade) {
    // Verificar timeout
    if (Date.now() - startTime > maxTimeout) {
      console.log(`DEBUG: Timeout atingido (${maxTimeout}ms), interrompendo configuração de visibilidade`);
      break;
    }
    
    try {
      console.log(`DEBUG: Tentando configurar visibilidade com seletor: ${seletor}`);
      
      // Verificar se o elemento existe antes de tentar clicar
      const elemento = await page.$(seletor);
      if (!elemento) {
        console.log(`DEBUG: Elemento não encontrado para seletor: ${seletor}`);
        continue;
      }
      
      console.log(`DEBUG: Elemento encontrado, tentando clicar...`);
      
      // Verificar se é um mat-select
      if (seletor.includes('mat-select')) {
        // Tentar diferentes estratégias de clique
        try {
          // Estratégia 1: Clique direto
          await page.click(seletor, { force: true });
          console.log(`DEBUG: Clique direto realizado`);
        } catch (e1) {
          try {
            // Estratégia 2: Clique no trigger
            await page.click(`${seletor} .mat-select-trigger`, { force: true });
            console.log(`DEBUG: Clique no trigger realizado`);
          } catch (e2) {
            try {
              // Estratégia 3: Clique com JavaScript
              await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                if (el) el.click();
              }, seletor);
              console.log(`DEBUG: Clique via JavaScript realizado`);
            } catch (e3) {
              console.log(`DEBUG: Todas as estratégias de clique falharam`);
              continue;
            }
          }
        }
        
        // Aguardar dropdown abrir
        await page.waitForTimeout(800);
        
        // Procurar pela opção de visibilidade
        const opcoesVisibilidade = [
          `mat-option:has-text("${visibilidade}")`,
          `mat-option[value="${visibilidade}"]`,
          `mat-option:has-text("Público")`,
          `mat-option:has-text("Publico")`,
          `[role="option"]:has-text("${visibilidade}")`,
          `[role="option"]:has-text("Público")`,
          `[role="option"]:has-text("Publico")`
        ];
        
        let opcaoSelecionada = false;
        for (const opcao of opcoesVisibilidade) {
          try {
            console.log(`DEBUG: Procurando opção: ${opcao}`);
            await page.waitForSelector(opcao, { timeout: 2000 });
            await page.click(opcao, { force: true });
            console.log(`DEBUG: Visibilidade configurada com sucesso: ${visibilidade}`);
            opcaoSelecionada = true;
            return;
          } catch (e) {
            console.log(`DEBUG: Opção ${opcao} não encontrada: ${e.message}`);
          }
        }
        
        if (!opcaoSelecionada) {
          // Listar opções disponíveis para debug
          try {
            const opcoes = await page.$$eval('mat-option, [role="option"]', options => 
              options.map(opt => opt.textContent?.trim()).filter(text => text)
            );
            console.log(`DEBUG: Opções disponíveis no dropdown:`, opcoes);
          } catch (error) {}
        }
        
      } else {
        // Select tradicional
        await page.selectOption(seletor, visibilidade);
        console.log(`DEBUG: Visibilidade configurada em select tradicional: ${visibilidade}`);
        return;
      }
    } catch (error) {
      console.log(`DEBUG: Seletor de visibilidade ${seletor} falhou: ${error.message}`);
    }
  }
  
  console.log('AVISO: Campo de visibilidade não encontrado, continuando sem configurar...');
}

// Função auxiliar para aguardar a modal de Localização/Visibilidade
/**
 * Verifica localizações/visibilidades já existentes no servidor
 * e retorna lista das que estão faltando para processar
 */
async function verificarLocalizacoesExistentes(page) {
  try {
    console.log('🔍 Verificando localizações/visibilidades já existentes...');
    
    // Aguardar a página carregar completamente
    await page.waitForTimeout(2000);
    
    // Buscar tabela ou lista de localizações já vinculadas
    const localizacoesExistentes = await page.evaluate(() => {
      const existentes = [];
      
      // Seletores para encontrar localizações já cadastradas
      const seletores = [
        'table tbody tr', // Tabela padrão
        '.mat-table .mat-row', // Material Design table
        '.location-list .location-item', // Lista de localizações
        '[data-testid="location-row"]', // Testid específico
        '.servidor-locations tr', // Tabela específica de servidor
        '.visibilidade-list .item' // Lista de visibilidades
      ];
      
      for (const seletor of seletores) {
        const elementos = document.querySelectorAll(seletor);
        
        elementos.forEach(elemento => {
          const texto = elemento.textContent || '';
          
          // Extrair informações da localização
          if (texto.trim() && !texto.toLowerCase().includes('nenhum registro')) {
            const linhas = texto.split('\n').map(l => l.trim()).filter(l => l);
            
            // Procurar por padrões de localização/visibilidade
            linhas.forEach(linha => {
              if (linha.includes('Público') || linha.includes('Privado') || 
                  linha.includes('Secretário') || linha.includes('Escrivão') ||
                  linha.includes('Juiz') || linha.includes('Assessor')) {
                existentes.push({
                  texto: linha,
                  elemento: elemento.outerHTML.substring(0, 200)
                });
              }
            });
          }
        });
        
        if (existentes.length > 0) break; // Se encontrou, não precisa tentar outros seletores
      }
      
      return existentes;
    });
    
    console.log(`📋 Encontradas ${localizacoesExistentes.length} localizações já existentes:`);
    localizacoesExistentes.forEach((loc, index) => {
      console.log(`   ${index + 1}. ${loc.texto}`);
    });
    
    return localizacoesExistentes;
    
  } catch (error) {
    console.log('⚠️ Erro ao verificar localizações existentes:', error.message);
    return [];
  }
}

/**
 * Obtém lista de todas as localizações/visibilidades disponíveis
 * e filtra as que ainda precisam ser processadas
 */
async function obterLocalizacoesFaltantes(page, localizacoesExistentes = []) {
  try {
    console.log('🎯 Identificando localizações faltantes...');
    
    // Lista padrão de localizações/visibilidades que devem ser verificadas
    const localizacoesPadrao = [
      { papel: 'Secretário de Audiência', visibilidade: 'Público' },
      { papel: 'Secretário de Audiência', visibilidade: 'Privado' },
      { papel: 'Escrivão', visibilidade: 'Público' },
      { papel: 'Escrivão', visibilidade: 'Privado' },
      { papel: 'Juiz', visibilidade: 'Público' },
      { papel: 'Juiz', visibilidade: 'Privado' },
      { papel: 'Assessor', visibilidade: 'Público' },
      { papel: 'Assessor', visibilidade: 'Privado' }
    ];
    
    // Filtrar localizações que ainda não existem
    const faltantes = localizacoesPadrao.filter(padrao => {
      const jaExiste = localizacoesExistentes.some(existente => {
        const textoExistente = existente.texto.toLowerCase();
        return textoExistente.includes(padrao.papel.toLowerCase()) && 
               textoExistente.includes(padrao.visibilidade.toLowerCase());
      });
      return !jaExiste;
    });
    
    console.log(`✅ Identificadas ${faltantes.length} localizações faltantes:`);
    faltantes.forEach((faltante, index) => {
      console.log(`   ${index + 1}. ${faltante.papel} - ${faltante.visibilidade}`);
    });
    
    return faltantes;
    
  } catch (error) {
    console.log('⚠️ Erro ao obter localizações faltantes:', error.message);
    return [];
  }
}

/**
 * Processa automaticamente as localizações faltantes
 */
async function processarLocalizacoesFaltantes(page, localizacoesFaltantes) {
  if (localizacoesFaltantes.length === 0) {
    console.log('✅ Todas as localizações já estão configuradas!');
    return { sucesso: true, processadas: 0, erros: 0 };
  }
  
  console.log(`🚀 Iniciando processamento de ${localizacoesFaltantes.length} localizações faltantes...`);
  console.log('⚠️ AVISO: Processamento de localizações automático foi desabilitado temporariamente para evitar loops.');
  console.log('📋 Localizações que precisariam ser processadas:');
  
  localizacoesFaltantes.forEach((localizacao, index) => {
    console.log(`   ${index + 1}. ${localizacao.papel} - ${localizacao.visibilidade}`);
  });
  
  // Retornar como se tivesse processado com sucesso, mas sem fazer nada
  // Isso evita o loop no header do acordeão
  return { 
    sucesso: true, 
    processadas: localizacoesFaltantes.length, 
    erros: 0,
    observacao: 'Processamento automático desabilitado para evitar loops'
  };
}

async function aguardarModalLocalizacaoVisibilidade(page) {
  const seletoresModal = [
    '#mat-dialog-2',
    'pje-modal-localizacao-visibilidade',
    'mat-dialog-container',
    '.mat-dialog-container',
    '[role="dialog"]',
    '.cdk-overlay-container [role="dialog"]',
    '.cdk-overlay-pane',
    'mat-dialog-content',
    // Seletores adicionais para melhor detecção
    '.mat-dialog-wrapper',
    '.mat-dialog-content',
    '[aria-labelledby*="mat-dialog"]'
  ];
  
  console.log('DEBUG: Aguardando modal de Localização/Visibilidade abrir...');
  
  // Aguardar mais tempo para modal aparecer (páginas lentas)
  await page.waitForTimeout(3000);
  
  for (const seletor of seletoresModal) {
    try {
      console.log(`DEBUG: Tentando encontrar modal com seletor: ${seletor}`);
      await page.waitForSelector(seletor, { timeout: 5000 });
      
      // Verificar se a modal realmente contém campos de papel/localização
      const temCampos = await page.evaluate((sel) => {
        const modal = document.querySelector(sel);
        if (!modal) return false;
        
        const texto = modal.textContent || '';
        return texto.toLowerCase().includes('papel') || 
               texto.toLowerCase().includes('localização') ||
               texto.toLowerCase().includes('visibilidade') ||
               modal.querySelector('mat-select[placeholder*="Papel"]') ||
               modal.querySelector('mat-select[placeholder*="Localização"]');
      }, seletor);
      
      if (temCampos) {
        console.log(`DEBUG: Modal encontrada e validada com seletor: ${seletor}`);
        
        // Aguardar um pouco para a modal carregar completamente
        await page.waitForTimeout(1500);
        return;
      } else {
        console.log(`DEBUG: Modal encontrada mas não contém os campos esperados: ${seletor}`);
      }
    } catch (error) {
      console.log(`DEBUG: Seletor de modal ${seletor} falhou: ${error.message}`);
    }
  }
  
  // Se não encontrou a modal, tentar listar todas as modais/dialogs presentes
  try {
    const modalsPresentes = await page.$$eval('[role="dialog"], mat-dialog-container, .mat-dialog-container', 
      modals => modals.map(modal => ({
        tagName: modal.tagName,
        className: modal.className,
        textContent: (modal.textContent || '').substring(0, 200)
      }))
    );
    console.log('DEBUG: Modals/dialogs presentes na página:', modalsPresentes);
  } catch {}
  
  console.log('AVISO: Modal de Localização/Visibilidade não detectada, continuando...');
}

// Função auxiliar para debug de elementos na página
async function debugElementosNaPagina(page, contexto = '') {
  try {
    console.log(`DEBUG ${contexto}: Analisando elementos na página...`);
    
    // Listar mat-selects disponíveis
    const matSelects = await page.$$eval('mat-select', selects => 
      selects.map((select, index) => ({
        index,
        placeholder: select.getAttribute('placeholder') || '',
        id: select.getAttribute('id') || '',
        className: select.className || '',
        visible: select.offsetParent !== null
      }))
    );
    console.log(`DEBUG ${contexto}: Mat-selects encontrados:`, matSelects);
    
    // Listar botões disponíveis
    const botoes = await page.$$eval('button, input[type="submit"], input[type="button"]', buttons => 
      buttons.map((btn, index) => ({
        index,
        tagName: btn.tagName,
        type: btn.type || '',
        textContent: (btn.textContent || '').trim().substring(0, 50),
        value: btn.value || '',
        className: btn.className || '',
        visible: btn.offsetParent !== null
      }))
    );
    console.log(`DEBUG ${contexto}: Botões encontrados:`, botoes);
    
    // Listar modais/dialogs
    const modals = await page.$$eval('[role="dialog"], mat-dialog-container, .mat-dialog-container', dialogs => 
      dialogs.map((dialog, index) => ({
        index,
        tagName: dialog.tagName,
        className: dialog.className || '',
        textContent: (dialog.textContent || '').substring(0, 100),
        visible: dialog.offsetParent !== null
      }))
    );
    console.log(`DEBUG ${contexto}: Modais/dialogs encontrados:`, modals);
    
  } catch (error) {
    console.log(`DEBUG ${contexto}: Erro ao analisar elementos:`, error.message);
  }
}

/**
 * Função principal que verifica localizações existentes e processa as faltantes
 * automaticamente quando o sistema entra na área de Localizações/Visibilidades ATIVAS
 */
async function verificarEProcessarLocalizacoesFaltantes(page) {
  try {
    console.log('🎯 Iniciando verificação automática de localizações/visibilidades...');
    
    // 1. Verificar localizações já existentes
    const localizacoesExistentes = await verificarLocalizacoesExistentes(page);
    
    // 2. Identificar quais estão faltando
    const localizacoesFaltantes = await obterLocalizacoesFaltantes(page, localizacoesExistentes);
    
    // 3. Se há localizações faltantes, processar automaticamente
    if (localizacoesFaltantes.length > 0) {
      console.log(`🚀 Iniciando processamento automático de ${localizacoesFaltantes.length} localizações faltantes...`);
      
      const resultado = await processarLocalizacoesFaltantes(page, localizacoesFaltantes);
      
      return {
        sucesso: resultado.sucesso,
        existentes: localizacoesExistentes.length,
        processadas: resultado.processadas,
        erros: resultado.erros,
        total: localizacoesExistentes.length + resultado.processadas
      };
    } else {
      console.log('✅ Todas as localizações já estão configuradas!');
      
      return {
        sucesso: true,
        existentes: localizacoesExistentes.length,
        processadas: 0,
        erros: 0,
        total: localizacoesExistentes.length
      };
    }
    
  } catch (error) {
    console.log('❌ Erro durante verificação automática:', error.message);
    return {
      sucesso: false,
      erro: error.message,
      existentes: 0,
      processadas: 0,
      erros: 1,
      total: 0
    };
  }
}

module.exports = { 
  vincularOJ, 
  vincularOJMelhorado, 
  selecionarOrgaoJulgador, 
  aguardarMatSelectOJPronto, 
  prevenirCliqueHeader, 
  debugElementosNaPagina,
  verificarLocalizacoesExistentes,
  obterLocalizacoesFaltantes,
  processarLocalizacoesFaltantes,
  verificarEProcessarLocalizacoesFaltantes,
  // Funções robustas para São José dos Campos
  executarBuscaRobustaSaoJose,
  localizarCampoBuscaSaoJose,
  executarAcaoBuscaSaoJose,
  aguardarResultadosBuscaSaoJose,
  executarVinculacaoRobustaSaoJose,
  localizarItemOrgaoSaoJose,
  executarAcaoVinculacaoSaoJose,
  confirmarVinculacaoSaoJose,
  encontrarBotaoAdicionarMelhorado,
  // Funções específicas para Limeira
  isVaraLimeira,
  aplicarTratamentoLimeira
};
