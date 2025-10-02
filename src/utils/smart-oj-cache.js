// Sistema de Cache Inteligente para OJs Já Vinculados
// Acelera significativamente a vinculação ao verificar OJs em lote

const { NormalizadorTexto } = require('./normalizacao');
const { Logger } = require('./Logger');
const fs = require('fs').promises;
const path = require('path');

class SmartOJCache {
  constructor() {
    this.cache = new Map(); // Map<nomeOJNormalizado, { original, jaVinculado, textoEncontrado }>
    this.cacheValido = false;
    this.ultimaAtualizacao = null;
    this.logger = new Logger('SmartOJCache');
    this.cacheFile = path.join(__dirname, '../../data/smart-oj-cache.json');
    this.serverCacheMap = new Map(); // Map<cpfServidor, cacheData>
  }

  /**
   * 🎯 NOVO: Verifica em lote quais OJs já estão vinculados considerando perfis
   * @param {Array} ojsParaVerificar - Lista de OJs para verificar
   * @param {Array} ojsVinculados - Lista de OJs já vinculados obtidos do sistema
   * @param {string} perfilDesejado - Perfil que se deseja para o servidor
   * @param {Function} progressCallback - Callback para feedback de progresso
   * @returns {Object} Resultado da verificação em lote com análise de perfis
   */
  verificarOJsComPerfilEmLote(ojsParaVerificar, ojsVinculados, perfilDesejado, progressCallback = null) {
    const startTime = Date.now();

    const resultado = {
      ojsJaVinculadosPerfilCorreto: [], // OJ + perfil correto (pular)
      ojsVinculadosPerfilDiferente: [], // OJ vinculado mas perfil diferente (atualizar)
      ojsVinculadosPerfilDesconhecido: [], // OJ vinculado mas perfil desconhecido (verificar)
      ojsParaVincular: [], // OJ não vinculado (vincular novo)

      estatisticas: {
        jaVinculadosPerfilCorreto: 0,
        vinculadosPerfilDiferente: 0,
        vinculadosPerfilDesconhecido: 0,
        paraVincular: 0,
        tempoProcessamento: 0,
        economiaEstimada: 0,
        totalOJs: ojsParaVerificar.length,
        totalParaProcessar: 0
      }
    };

    // Normalizar lista de OJs vinculados
    const ojsVinculadosNormalizados = new Map();
    ojsVinculados.forEach(oj => {
      const normalizado = this._normalizarTexto(oj);
      ojsVinculadosNormalizados.set(normalizado, oj);
    });

    this.logger.info(`🧠 Iniciando verificação INTELIGENTE de ${ojsParaVerificar.length} OJs com perfil: "${perfilDesejado}"`);

    for (let i = 0; i < ojsParaVerificar.length; i++) {
      const oj = ojsParaVerificar[i];

      if (progressCallback) {
        const progresso = Math.round(((i + 1) / ojsParaVerificar.length) * 100);
        const ojTexto = typeof oj === 'string' ? oj : String(oj);
        progressCallback(
          `🧠 Análise inteligente ${i + 1}/${ojsParaVerificar.length}: ${ojTexto.substring(0, 35)}${ojTexto.length > 35 ? '...' : ''}`,
          progresso
        );
      }

      const verificacao = this.verificarOJComPerfil(oj, ojsVinculadosNormalizados, perfilDesejado);

      switch (verificacao.acao) {
      case 'pular':
        resultado.ojsJaVinculadosPerfilCorreto.push({
          oj,
          textoEncontrado: verificacao.textoEncontrado,
          perfilEncontrado: verificacao.perfilEncontrado,
          tipoCorrespondencia: verificacao.tipoCorrespondencia
        });
        resultado.estatisticas.jaVinculadosPerfilCorreto++;
        this.logger.info(`✅ OJ + Perfil correto: "${oj}" → "${verificacao.textoEncontrado}" (${verificacao.perfilEncontrado})`);
        break;

      case 'atualizar_perfil':
        resultado.ojsVinculadosPerfilDiferente.push({
          oj,
          textoEncontrado: verificacao.textoEncontrado,
          perfilEncontrado: verificacao.perfilEncontrado,
          perfilDesejado: verificacao.perfilDesejado,
          tipoCorrespondencia: verificacao.tipoCorrespondencia
        });
        resultado.estatisticas.vinculadosPerfilDiferente++;
        this.logger.info(`🔄 Perfil diferente: "${oj}" → "${verificacao.perfilEncontrado}" ≠ "${verificacao.perfilDesejado}"`);
        break;

      case 'verificar_perfil':
        resultado.ojsVinculadosPerfilDesconhecido.push({
          oj,
          textoEncontrado: verificacao.textoEncontrado,
          perfilDesejado: verificacao.perfilDesejado,
          tipoCorrespondencia: verificacao.tipoCorrespondencia
        });
        resultado.estatisticas.vinculadosPerfilDesconhecido++;
        this.logger.info(`❓ Perfil desconhecido: "${oj}" → Verificar perfil atual`);
        break;

      case 'vincular_novo':
        resultado.ojsParaVincular.push(oj);
        resultado.estatisticas.paraVincular++;
        this.logger.info(`🆕 Novo para vincular: "${oj}" com perfil "${perfilDesejado}"`);
        break;
      }

      // Atualizar cache
      this.atualizarCache(oj, verificacao, perfilDesejado);

      if (progressCallback && i % 5 === 0) {
        const totalParaProcessar = resultado.estatisticas.vinculadosPerfilDiferente +
                                  resultado.estatisticas.vinculadosPerfilDesconhecido +
                                  resultado.estatisticas.paraVincular;
        progressCallback(
          `📊 ${resultado.estatisticas.jaVinculadosPerfilCorreto} corretos, ${totalParaProcessar} precisam automação`,
          Math.round(((i + 1) / ojsParaVerificar.length) * 100)
        );
      }
    }

    const tempoTotal = Date.now() - startTime;
    resultado.estatisticas.tempoProcessamento = tempoTotal;

    // Calcular estatísticas finais
    resultado.estatisticas.totalParaProcessar = resultado.estatisticas.vinculadosPerfilDiferente +
                                               resultado.estatisticas.vinculadosPerfilDesconhecido +
                                               resultado.estatisticas.paraVincular;

    const ojsParaPular = resultado.estatisticas.jaVinculadosPerfilCorreto;
    resultado.estatisticas.economiaEstimada = ojsParaPular * 15000; // ~15s por OJ

    this.logger.info(`🎯 Análise INTELIGENTE concluída em ${tempoTotal}ms:`);
    this.logger.info(`   - ✅ ${resultado.estatisticas.jaVinculadosPerfilCorreto} OJs com perfil correto (pularão automação)`);
    this.logger.info(`   - 🔄 ${resultado.estatisticas.vinculadosPerfilDiferente} OJs com perfil diferente (atualizar)`);
    this.logger.info(`   - ❓ ${resultado.estatisticas.vinculadosPerfilDesconhecido} OJs com perfil desconhecido (verificar)`);
    this.logger.info(`   - 🆕 ${resultado.estatisticas.paraVincular} OJs novos (vincular)`);
    this.logger.info(`   - 🎯 TOTAL para processar: ${resultado.estatisticas.totalParaProcessar} OJs`);
    this.logger.info(`   - 💰 Economia estimada: ${Math.round(resultado.estatisticas.economiaEstimada/1000)}s`);

    return resultado;
  }

  /**
   * Verifica todos os OJs de uma lista em lote
   * @param {Object} page - Página do Playwright
   * @param {Array<string>} ojsParaVerificar - Lista de OJs para verificar
   * @param {Function} progressCallback - Callback para reportar progresso
   * @param {string} cpfServidor - CPF do servidor para cache persistente
   * @returns {Object} Resultado da verificação em lote
   */
  async verificarOJsEmLote(page, ojsParaVerificar, progressCallback = null, cpfServidor = null) {
    this.logger.info(`🚀 Iniciando verificação em lote de ${ojsParaVerificar.length} OJs...`);
    const startTime = Date.now();

    try {
      // 0. Tentar carregar cache persistente primeiro
      if (cpfServidor) {
        const cacheExistente = await this.carregarCachePersistente(cpfServidor);
        if (cacheExistente) {
          this.logger.info(`🎯 Usando cache persistente para ${cpfServidor} - evitando verificação desnecessária`);

          // Reconstruir o cache em memória preservando perfis
          if (cacheExistente.ojsJaVinculados) {
            const confiaveis = [];
            const duvidosos = [];

            cacheExistente.ojsJaVinculados.forEach(item => {
              if (item && item.tipoCorrespondencia === 'palavras_chave') {
                duvidosos.push(item);
              } else {
                confiaveis.push(item);
              }
            });

            confiaveis.forEach(item => {
              const perfilExistente = item?.perfil || null;
              this.atualizarCache(item.oj, {
                jaVinculado: true,
                textoEncontrado: item.textoEncontrado,
                tipoCorrespondencia: item.tipoCorrespondencia
              }, perfilExistente);
            });

            // Itens duvidosos permanecem no cache como não vinculados para forçar revalidação
            duvidosos.forEach(item => {
              this.atualizarCache(item.oj, {
                jaVinculado: false,
                textoEncontrado: item?.textoEncontrado || null,
                tipoCorrespondencia: item?.tipoCorrespondencia || null
              }, item?.perfil || null);
            });

            if (duvidosos.length > 0) {
              this.logger.warn(`⚠️ Cache possivelmente desatualizado para ${cpfServidor}: ${duvidosos.length} entradas fracas (palavras-chave) serão reprocessadas`);
            }

            cacheExistente.ojsJaVinculados = confiaveis;
            if (!Array.isArray(cacheExistente.ojsParaVincular)) {
              cacheExistente.ojsParaVincular = [];
            }
            cacheExistente.ojsParaVincular = [
              ...cacheExistente.ojsParaVincular.filter(item => item && duvidosos.every(duv => duv.oj !== item.oj)),
              ...duvidosos.map(item => ({
                oj: item.oj,
                textoEncontrado: item?.textoEncontrado || null,
                motivo: 'palavras_chave_inseguro'
              }))
            ];

            if (cacheExistente.estatisticas) {
              const stats = cacheExistente.estatisticas;
              stats.jaVinculados = Math.max(0, (stats.jaVinculados || 0) - duvidosos.length);
              stats.paraVincular = (stats.paraVincular || 0) + duvidosos.length;
              stats.totalVerificados = stats.totalVerificados || (confiaveis.length + duvidosos.length);
            }
          }

          this.cacheValido = true;
          this.ultimaAtualizacao = new Date(cacheExistente.timestamp);

          if (progressCallback) {
            progressCallback(`Cache carregado: ${cacheExistente.estatisticas?.jaVinculados || 0} OJs já cadastrados`, 100);
          }

          return cacheExistente;
        }
      }

      // 1. Carregar todos os OJs já vinculados da página
      if (progressCallback) {
        progressCallback('Carregando OJs já vinculados...', 0);
      }

      const ojsJaVinculados = await this.carregarOJsVinculadosDaPagina(page);
      this.logger.info(`📋 Encontrados ${ojsJaVinculados.length} OJs já vinculados na página`);
      
      if (ojsJaVinculados.length > 0) {
        this.logger.info(`📋 Primeiros 5 OJs vinculados: ${ojsJaVinculados.slice(0, 5).join(', ')}`);
        this.logger.info('📋 TODOS os OJs vinculados encontrados:');
        ojsJaVinculados.forEach((oj, index) => {
          this.logger.info(`   ${index + 1}. "${oj}"`);
        });
      } else {
        this.logger.warn('⚠️ NENHUM OJ vinculado encontrado na página! Isso pode indicar um problema.');
      }

      // 2. Normalizar todos os OJs vinculados para comparação rápida
      const ojsVinculadosNormalizados = new Map();
      ojsJaVinculados.forEach(oj => {
        const normalizado = NormalizadorTexto.normalizar(oj);
        ojsVinculadosNormalizados.set(normalizado, oj);
      });

      // 3. Verificar cada OJ da lista contra os já vinculados
      const resultado = {
        ojsJaVinculados: [],
        ojsParaVincular: [],
        estatisticas: {
          totalVerificados: ojsParaVerificar.length,
          jaVinculados: 0,
          paraVincular: 0,
          tempoProcessamento: 0
        }
      };

      for (let i = 0; i < ojsParaVerificar.length; i++) {
        const oj = ojsParaVerificar[i];
        
        if (progressCallback) {
          const progresso = Math.round(((i + 1) / ojsParaVerificar.length) * 100);
          const ojTexto = typeof oj === 'string' ? oj : String(oj);
          progressCallback(
            `🔍 Analisando OJ ${i + 1}/${ojsParaVerificar.length}: ${ojTexto.substring(0, 50)}${ojTexto.length > 50 ? '...' : ''}`, 
            progresso
          );
        }

        const verificacao = this.verificarOJContraCache(oj, ojsVinculadosNormalizados);
        
        if (verificacao.jaVinculado) {
          resultado.ojsJaVinculados.push({
            oj,
            textoEncontrado: verificacao.textoEncontrado,
            tipoCorrespondencia: verificacao.tipoCorrespondencia
          });
          resultado.estatisticas.jaVinculados++;
          
          this.logger.info(`✅ OJ já vinculado: "${oj}" → "${verificacao.textoEncontrado}"`);
          
          if (progressCallback && i % 5 === 0) { // Feedback a cada 5 OJs
            progressCallback(
              `✅ ${resultado.estatisticas.jaVinculados} já vinculados, ${resultado.estatisticas.paraVincular} para processar`, 
              Math.round(((i + 1) / ojsParaVerificar.length) * 100)
            );
          }
        } else {
          resultado.ojsParaVincular.push(oj);
          resultado.estatisticas.paraVincular++;
          
          this.logger.info(`🔄 OJ para vincular: "${oj}"`);
          
          if (progressCallback && i % 10 === 0) { // Feedback a cada 10 OJs
            progressCallback(
              `⏳ ${resultado.estatisticas.paraVincular} OJs precisarão ser vinculados`, 
              Math.round(((i + 1) / ojsParaVerificar.length) * 100)
            );
          }
        }

        // Atualizar cache
        this.atualizarCache(oj, verificacao);
      }

      const tempoTotal = Date.now() - startTime;
      resultado.estatisticas.tempoProcessamento = tempoTotal;

      this.logger.info(`🎯 Verificação em lote concluída em ${tempoTotal}ms:`);
      this.logger.info(`   - ${resultado.estatisticas.jaVinculados} OJs já vinculados (pularão processamento)`);
      this.logger.info(`   - ${resultado.estatisticas.paraVincular} OJs para vincular`);
      this.logger.info(`   - Economia estimada: ${resultado.estatisticas.jaVinculados * 5}s de processamento`);

      this.cacheValido = true;
      this.ultimaAtualizacao = new Date();

      // Salvar cache persistente para este servidor
      await this.salvarCachePersistente(cpfServidor, resultado);

      return resultado;

    } catch (error) {
      this.logger.error(`❌ Erro na verificação em lote: ${error.message}`);
      throw error;
    }
  }

  /**
   * Carrega cache persistente para um servidor específico
   * @param {string} cpfServidor - CPF do servidor
   * @returns {Object|null} Cache salvo ou null se não encontrado
   */
  /**
   * Normaliza CPF para uso consistente como chave do cache
   * @param {string} cpf - CPF formatado ou não
   * @returns {string} - CPF normalizado (apenas números)
   */
  _normalizarCPF(cpf) {
    if (!cpf) return '';
    return cpf.replace(/\D/g, ''); // Remove tudo que não for dígito
  }

  async carregarCachePersistente(cpfServidor) {
    try {
      const data = await fs.readFile(this.cacheFile, 'utf8');
      const cacheData = JSON.parse(data);

      // Normalizar CPF para busca
      const cpfNormalizado = this._normalizarCPF(cpfServidor);

      // Procurar por CPF normalizado ou formatado
      let servidorCache = null;

      // Primeiro, tentar com CPF exato como fornecido
      if (cacheData[cpfServidor]) {
        servidorCache = cacheData[cpfServidor];
      }
      // Se não encontrar, procurar por chaves que sejam o mesmo CPF normalizado
      else {
        for (const [chaveCPF, dados] of Object.entries(cacheData)) {
          if (this._normalizarCPF(chaveCPF) === cpfNormalizado) {
            servidorCache = dados;
            break;
          }
        }
      }

      if (servidorCache) {
        const ageSince = Date.now() - servidorCache.timestamp;
        const maxAge = 24 * 60 * 60 * 1000; // 24 horas

        if (ageSince < maxAge) {
          if (Array.isArray(servidorCache.ojsJaVinculados)) {
            const confiaveis = [];
            const duvidosos = [];

            servidorCache.ojsJaVinculados.forEach(item => {
              if (item && item.tipoCorrespondencia === 'palavras_chave') {
                duvidosos.push(item);
              } else {
                confiaveis.push(item);
              }
            });

            servidorCache.ojsJaVinculados = confiaveis;
            if (!Array.isArray(servidorCache.ojsParaVincular)) {
              servidorCache.ojsParaVincular = [];
            }
            servidorCache.ojsParaVincular = [
              ...servidorCache.ojsParaVincular.filter(item => item && duvidosos.every(duv => duv.oj !== item.oj)),
              ...duvidosos.map(item => ({
                oj: item.oj,
                textoEncontrado: item?.textoEncontrado || null,
                motivo: 'palavras_chave_inseguro'
              }))
            ];

            if (servidorCache.estatisticas) {
              const stats = servidorCache.estatisticas;
              stats.jaVinculados = Math.max(0, (stats.jaVinculados || 0) - duvidosos.length);
              stats.paraVincular = (stats.paraVincular || 0) + duvidosos.length;
              stats.totalVerificados = stats.totalVerificados || (confiaveis.length + duvidosos.length);
            }

            if (duvidosos.length > 0) {
              this.logger.warn(`⚠️ Cache persistente contém ${duvidosos.length} entradas fracas (palavras-chave) para ${cpfServidor} - serão reprocessadas`);
            }
          }

          this.logger.info(`📦 Cache persistente carregado para ${cpfServidor}: ${servidorCache.ojsJaVinculados?.length || 0} OJs confiáveis`);
          return servidorCache;
        } else {
          this.logger.info(`⏰ Cache persistente expirado para ${cpfServidor} (${Math.round(ageSince / 1000 / 60 / 60)}h)`);
        }
      }

      return null;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.warn(`⚠️ Erro ao carregar cache persistente: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Salva cache persistente para um servidor específico
   * @param {string} cpfServidor - CPF do servidor
   * @param {Object} dadosVerificacao - Dados da verificação a serem salvos
   */
  async salvarCachePersistente(cpfServidor, dadosVerificacao) {
    try {
      // Garantir que o diretório existe
      const dir = path.dirname(this.cacheFile);
      await fs.mkdir(dir, { recursive: true });

      let cacheData = {};
      try {
        const data = await fs.readFile(this.cacheFile, 'utf8');
        cacheData = JSON.parse(data);
      } catch (error) {
        // Arquivo não existe, começar com objeto vazio
      }

      // Normalizar CPF para chave consistente
      const cpfNormalizado = this._normalizarCPF(cpfServidor);

      // Salvar dados do servidor usando CPF normalizado
      cacheData[cpfNormalizado] = {
        ...dadosVerificacao,
        timestamp: Date.now(),
        version: '1.0'
      };

      await fs.writeFile(this.cacheFile, JSON.stringify(cacheData, null, 2));
      this.logger.info(`💾 Cache persistente salvo para ${cpfNormalizado}: ${dadosVerificacao.estatisticas?.jaVinculados || 0} OJs já cadastrados`);

    } catch (error) {
      this.logger.error(`❌ Erro ao salvar cache persistente: ${error.message}`);
    }
  }

  /**
   * Carrega todos os OJs já vinculados da página atual
   * @param {Object} page - Página do Playwright
   * @returns {Array<string>} Lista de OJs já vinculados
   */
  async carregarOJsVinculadosDaPagina(page) {
    try {
      const ojsVinculados = [];
      const ojsNormalizados = new Set(); // Para evitar duplicatas

      this.logger.info('🔍 [DEBUG] Iniciando busca por OJs vinculados na página...');

      // Seletores específicos para a interface do PJE
      const seletoresOJs = [
        // Tabelas principais do PJE
        'table tbody tr td:first-child', // Primeira coluna das tabelas (geralmente contém o nome do OJ)
        'table tbody tr td[data-label="Órgão Julgador"]',
        'table tbody tr td[data-label="Orgao Julgador"]', 
        '.mat-table .mat-cell:first-child',
        '.mat-table .mat-cell[data-label*="rgao"]',
        // Listas e cards
        '.mat-list-item .mat-line',
        '.mat-card-content',
        '.card-body',
        // Seletores genéricos
        'table tbody tr td',
        '.mat-table .mat-cell',
        '.table tbody tr td',
        'ul li',
        '.list-group-item',
        '.panel-body p',
        '.mat-expansion-panel-content div',
        // Seletores mais específicos para OJs
        '[class*="orgao"]',
        '[class*="julgador"]',
        // Seletores para elementos que podem conter nomes de varas
        'td:contains("Vara")',
        'td:contains("Tribunal")',
        'span:contains("Vara")',
        'div:contains("Vara")'
      ];

      this.logger.info(`🔍 [DEBUG] Testando ${seletoresOJs.length} seletores diferentes...`);

      // Palavras-chave que indicam um órgão julgador
      const palavrasChaveOJ = [
        'vara', 'tribunal', 'juizado', 'turma', 'câmara', 'seção',
        'comarca', 'foro', 'instância', 'supremo', 'superior',
        'regional', 'federal', 'estadual', 'militar', 'eleitoral',
        'trabalho', 'justiça'
      ];

      for (let i = 0; i < seletoresOJs.length; i++) {
        const seletor = seletoresOJs[i];
        try {
          const elementos = await page.locator(seletor).all();
          this.logger.info(`🔍 [DEBUG] Seletor ${i+1}/${seletoresOJs.length} "${seletor}": ${elementos.length} elementos encontrados`);

          for (const elemento of elementos) {
            try {
              const texto = await elemento.textContent();
              if (texto && texto.trim()) {
                const textoLimpo = texto.trim();
                const textoNormalizado = NormalizadorTexto.normalizar(textoLimpo);

                // Log de debug MELHORADO para textos encontrados
                if (textoLimpo.length > 10 && textoLimpo.length < 200) {
                  // Debug específico para OJs da DEISE
                  const ojsDeise = [
                    '1ª Vara do Trabalho de Limeira',
                    '2ª Vara do Trabalho de Limeira', 
                    'Vara do Trabalho de Hortolândia',
                    'Vara do Trabalho de Sumaré',
                    'Vara do Trabalho de Santa Bárbara D\'Oeste',
                    'Vara do Trabalho de São João da Boa Vista'
                  ];
                  
                  const deiseMatch = ojsDeise.find(oj => 
                    textoLimpo.includes(oj) || oj.includes(textoLimpo) || 
                    NormalizadorTexto.saoEquivalentes(textoLimpo, oj, 0.8)
                  );
                  
                  if (deiseMatch) {
                    this.logger.info(`🎯 [DEISE-DEBUG] TEXTO RELEVANTE ENCONTRADO: "${textoLimpo}" match com "${deiseMatch}"`);
                    this.logger.info(`🔍 [DEBUG] Texto encontrado: "${textoLimpo}"`);
                  } else {
                    // Log normal apenas se não for debug da Deise
                    this.logger.info(`🔍 [DEBUG] Texto encontrado: "${textoLimpo}"`);
                  }
                }

                // Verificar se parece ser um nome de órgão julgador
                const contemPalavraChave = palavrasChaveOJ.some(palavra => 
                  textoNormalizado.includes(palavra)
                );

                if (contemPalavraChave && 
                    textoLimpo.length > 10 && 
                    textoLimpo.length < 200 && // Evitar textos muito longos
                    !ojsNormalizados.has(textoNormalizado) &&
                    this.validarOrgaoJulgador(textoLimpo)) {

                  // Verificar se não é duplicata usando similaridade
                  const ehDuplicata = ojsVinculados.some(ojExistente => 
                    NormalizadorTexto.saoEquivalentes(textoLimpo, ojExistente, 0.90)
                  );

                  if (!ehDuplicata) {
                    this.logger.info(`✅ [DEBUG] OJ vinculado detectado: "${textoLimpo}"`);
                    ojsVinculados.push(textoLimpo);
                    ojsNormalizados.add(textoNormalizado);
                    
                    // Debug específico para OJs da DEISE
                    const ojsDeise = [
                      '1ª Vara do Trabalho de Limeira',
                      '2ª Vara do Trabalho de Limeira', 
                      'Vara do Trabalho de Hortolândia',
                      'Vara do Trabalho de Sumaré',
                      'Vara do Trabalho de Santa Bárbara D\'Oeste',
                      'Vara do Trabalho de São João da Boa Vista'
                    ];
                    
                    const deiseMatch = ojsDeise.find(oj => 
                      NormalizadorTexto.saoEquivalentes(textoLimpo, oj, 0.8)
                    );
                    
                    if (deiseMatch) {
                      this.logger.info(`🎯 [DEISE-DEBUG] OJ DA DEISE ENCONTRADO: "${textoLimpo}" ≈ "${deiseMatch}"`);
                    }
                  } else {
                    this.logger.info(`🔄 [DEBUG] OJ duplicado ignorado: "${textoLimpo}"`);
                  }
                }
              }
            } catch (error) {
              // Continuar se houver erro
            }
          }
        } catch (error) {
          this.logger.warn(`⚠️ [DEBUG] Erro no seletor "${seletor}": ${error.message}`);
        }
      }

      return ojsVinculados;

    } catch (error) {
      this.logger.error(`❌ Erro ao carregar OJs da página: ${error.message}`);
      return [];
    }
  }

  /**
   * 🎯 NOVO: Verifica um OJ específico considerando também o perfil
   * @param {string} oj - Nome do OJ para verificar
   * @param {Map} ojsVinculadosNormalizados - Map de OJs já vinculados normalizados
   * @param {string} perfilDesejado - Perfil que se deseja verificar
   * @returns {Object} Resultado da verificação inteligente
   */
  verificarOJComPerfil(oj, ojsVinculadosNormalizados, perfilDesejado) {
    const ojNormalizado = this._normalizarTexto(oj);

    // 1. Verificação exata normalizada COM perfil
    for (const [ojVinculadoNormalizado, ojVinculadoOriginal] of ojsVinculadosNormalizados) {
      if (ojVinculadoNormalizado === ojNormalizado) {
        // OJ encontrado! Agora verificar perfil
        const cacheEntry = this.cache.get(ojNormalizado);

        if (cacheEntry && cacheEntry.perfil) {
          if (cacheEntry.perfil === perfilDesejado) {
            // Perfil IGUAL: OJ já vinculado com o perfil correto
            return {
              jaVinculado: true,
              perfilCorreto: true,
              textoEncontrado: ojVinculadoOriginal,
              tipoCorrespondencia: 'exata',
              perfilEncontrado: cacheEntry.perfil,
              perfilDesejado,
              acao: 'pular' // Não precisa processar
            };
          } else {
            // Perfil DIFERENTE: OJ vinculado mas com perfil errado
            return {
              jaVinculado: true,
              perfilCorreto: false,
              textoEncontrado: ojVinculadoOriginal,
              tipoCorrespondencia: 'exata',
              perfilEncontrado: cacheEntry.perfil,
              perfilDesejado,
              acao: 'atualizar_perfil' // Precisa atualizar o perfil
            };
          }
        } else {
          // OJ vinculado mas sem informação de perfil
          return {
            jaVinculado: true,
            perfilCorreto: false,
            textoEncontrado: ojVinculadoOriginal,
            tipoCorrespondencia: 'exata',
            perfilEncontrado: 'desconhecido',
            perfilDesejado,
            acao: 'verificar_perfil' // Precisa verificar o perfil atual
          };
        }
      }
    }

    // 2. Verificações de similaridade (existentes)
    const resultadoSimilaridade = this.verificarOJContraCache(oj, ojsVinculadosNormalizados);

    if (resultadoSimilaridade.jaVinculado) {
      return {
        ...resultadoSimilaridade,
        perfilCorreto: false,
        perfilEncontrado: 'desconhecido',
        perfilDesejado,
        acao: 'verificar_perfil'
      };
    }

    // 3. OJ não encontrado - precisa vincular
    return {
      jaVinculado: false,
      perfilCorreto: false,
      textoEncontrado: null,
      tipoCorrespondencia: null,
      perfilEncontrado: null,
      perfilDesejado,
      acao: 'vincular_novo' // Precisa vincular OJ + perfil
    };
  }

  /**
   * Verifica um OJ específico contra o cache de OJs vinculados (método original)
   * @param {string} oj - Nome do OJ para verificar
   * @param {Map} ojsVinculadosNormalizados - Map de OJs já vinculados normalizados
   * @returns {Object} Resultado da verificação
   */
  verificarOJContraCache(oj, ojsVinculadosNormalizados) {
    const ojNormalizado = this._normalizarTexto(oj);

    // 1. Verificação exata normalizada
    for (const [ojVinculadoNormalizado, ojVinculadoOriginal] of ojsVinculadosNormalizados) {
      if (ojVinculadoNormalizado === ojNormalizado) {
        return {
          jaVinculado: true,
          textoEncontrado: ojVinculadoOriginal,
          tipoCorrespondencia: 'exata_normalizada'
        };
      }
    }

    // 2. Verificação por similaridade alta usando algoritmo otimizado
    for (const [ojVinculadoNormalizado, ojVinculadoOriginal] of ojsVinculadosNormalizados) {
      const similaridade = this._calcularSimilaridade(ojNormalizado, ojVinculadoNormalizado);
      if (similaridade >= 0.95) {
        return {
          jaVinculado: true,
          textoEncontrado: ojVinculadoOriginal,
          tipoCorrespondencia: 'similaridade_alta'
        };
      }
    }

    // 3. Verificação por inclusão inteligente (para casos como "Vara" vs "1ª Vara")
    for (const [ojVinculadoNormalizado, ojVinculadoOriginal] of ojsVinculadosNormalizados) {
      if (this._verificarInclusaoInteligente(ojNormalizado, ojVinculadoNormalizado)) {
        return {
          jaVinculado: true,
          textoEncontrado: ojVinculadoOriginal,
          tipoCorrespondencia: 'inclusao_inteligente'
        };
      }
    }

    // 4. Verificação por palavras-chave principais
    for (const [ojVinculadoNormalizado, ojVinculadoOriginal] of ojsVinculadosNormalizados) {
      if (this._verificarPalavrasChave(ojNormalizado, ojVinculadoNormalizado)) {
        return {
          jaVinculado: true,
          textoEncontrado: ojVinculadoOriginal,
          tipoCorrespondencia: 'palavras_chave'
        };
      }
    }

    return {
      jaVinculado: false,
      textoEncontrado: null,
      tipoCorrespondencia: null
    };
  }

  /**
   * Atualiza o cache com o resultado de uma verificação
   * @param {string} oj - Nome do OJ
   * @param {Object} verificacao - Resultado da verificação
   */
  atualizarCache(oj, verificacao, perfilAtual = null) {
    const ojNormalizado = NormalizadorTexto.normalizar(oj);
    this.cache.set(ojNormalizado, {
      original: oj,
      jaVinculado: verificacao.jaVinculado,
      textoEncontrado: verificacao.textoEncontrado,
      tipoCorrespondencia: verificacao.tipoCorrespondencia,
      perfil: perfilAtual, // NOVO: Armazenar o perfil associado
      timestamp: Date.now()
    });
  }

  /**
   * Verifica se um OJ específico já está no cache
   * @param {string} oj - Nome do OJ
   * @returns {Object|null} Resultado do cache ou null se não encontrado
   */
  verificarCache(oj) {
    if (!this.cacheValido) return null;
    
    const ojNormalizado = NormalizadorTexto.normalizar(oj);
    return this.cache.get(ojNormalizado) || null;
  }

  /**
   * Verifica se um OJ já está vinculado (método principal para verificação individual)
   * @param {string} oj - Nome do OJ para verificar
   * @returns {boolean} True se já vinculado, false caso contrário
   */
  isOJVinculado(oj) {
    try {
      // Validar entrada
      if (!oj || typeof oj !== 'string') {
        this.logger.warn(`⚠️ OJ inválido fornecido para verificação: ${oj}`);
        return false;
      }
      
      const ojTrimmed = oj.trim();
      if (ojTrimmed.length === 0) {
        this.logger.warn('⚠️ OJ vazio fornecido para verificação');
        return false;
      }
      
      const resultado = this.verificarCache(ojTrimmed);
      return resultado ? resultado.jaVinculado : false;
    } catch (error) {
      this.logger.error(`❌ Erro verificando OJ "${oj}": ${error.message}`);
      return false;
    }
  }

  /**
   * Adiciona um OJ como vinculado ao cache
   * @param {string} oj - Nome do OJ vinculado
   */
  adicionarOJVinculado(oj) {
    const ojNormalizado = this._normalizarTexto(oj);
    this.cache.set(ojNormalizado, {
      original: oj,
      jaVinculado: true,
      textoEncontrado: oj,
      tipoCorrespondencia: 'vinculacao_manual'
    });
    this.ultimaAtualizacao = Date.now();
    this.logger.info(`✅ OJ "${oj}" adicionado ao cache como vinculado`);
  }

  /**
   * Limpa o cache (usado entre diferentes servidores)
   * @param {boolean} preservarPersistente - Se true, não limpa dados persistentes
   */
  limparCache(preservarPersistente = true) {
    // Apenas limpar cache em memória, preservando persistente por padrão
    this.cache.clear();
    this.cacheValido = false;
    this.ultimaAtualizacao = null;

    if (preservarPersistente) {
      this.logger.info('🧹 Cache em memória limpo (dados persistentes preservados)');
    } else {
      this.logger.info('🧹 Cache de OJs limpo completamente');
      // Debug específico para DEISE - garantir limpeza total
      this.logger.info('🎯 [DEISE-DEBUG] Cache SmartOJ completamente resetado - pronto para novo servidor');
    }
  }

  /**
   * Força limpeza completa incluindo cache persistente
   * @param {string} cpfServidor - Se fornecido, limpa apenas este servidor
   */
  async limparCacheCompleto(cpfServidor = null) {
    this.limparCache(false);

    if (cpfServidor) {
      // Limpar apenas um servidor específico
      try {
        const data = await fs.readFile(this.cacheFile, 'utf8');
        const cacheData = JSON.parse(data);
        delete cacheData[cpfServidor];
        await fs.writeFile(this.cacheFile, JSON.stringify(cacheData, null, 2));
        this.logger.info(`🗑️ Cache persistente removido para ${cpfServidor}`);
      } catch (error) {
        // Arquivo não existe, tudo bem
      }
    } else {
      // Limpar tudo
      try {
        await fs.unlink(this.cacheFile);
        this.logger.info('🗑️ Arquivo de cache persistente removido completamente');
      } catch (error) {
        // Arquivo não existe, tudo bem
      }
    }
  }

  /**
   * Valida se um texto representa um órgão julgador válido
   * @param {string} texto - Texto para validar
   * @returns {boolean} True se válido
   */
  validarOrgaoJulgador(texto) {
    if (!texto || typeof texto !== 'string') return false;
    
    const textoLimpo = texto.trim();
    
    // Debug específico para OJs da DEISE - ACEITAR SEMPRE
    const ojsDeise = [
      '1ª Vara do Trabalho de Limeira',
      '2ª Vara do Trabalho de Limeira', 
      'Vara do Trabalho de Hortolândia',
      'Vara do Trabalho de Sumaré',
      'Vara do Trabalho de Santa Bárbara D\'Oeste',
      'Vara do Trabalho de São João da Boa Vista',
      'Posto Avançado da Justiça do Trabalho de São João da Boa Vista em Espírito Santo Do Pinhal',
      'CEJUSC LIMEIRA - JT Centro Judiciário de Métodos Consensuais de Solução de Disputas da Justiça do Trabalho',
      // Varas de Araraquara - Correção para problema reportado
      '1ª Vara do Trabalho de Araraquara',
      '2ª Vara do Trabalho de Araraquara',
      '3ª Vara do Trabalho de Araraquara',
      // Apenas OJs que estão realmente disponíveis no perfil dos servidores (PJe produção)
      'DIVEX - Araraquara',
      'CEJUSC ARARAQUARA - JT Centro Judiciário de Métodos Consensuais de Solução de Disputas da Justiça do Trabalho'
    ];
    
    const deiseMatch = ojsDeise.find(oj => 
      NormalizadorTexto.saoEquivalentes(textoLimpo, oj, 0.7)
    );
    
    if (deiseMatch) {
      this.logger.info(`🎯 [DEISE-DEBUG] VALIDACAO FORCADA PARA: "${textoLimpo}" ≈ "${deiseMatch}"`);
      return true; // Forçar validação para OJs da DEISE
    }
    
    // Critérios de validação normais
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
    
    const valido = Object.values(criterios).every(criterio => criterio === true);
    
    // Debug para OJs que falharam na validação
    if (!valido && textoLimpo.includes('Vara')) {
      this.logger.warn(`⚠️ [DEBUG] OJ com 'Vara' rejeitado na validação: "${textoLimpo}"`);
      this.logger.warn(`⚠️ [DEBUG] Critérios: ${JSON.stringify(criterios)}`);
    }
    
    return valido;
  }

  /**
   * Normaliza texto para comparação (versão otimizada)
   * @param {string} texto 
   * @returns {string}
   */
  _normalizarTexto(texto) {
    // Usar a mesma normalização do sistema principal para consistência
    return NormalizadorTexto.normalizar(texto);
  }

  /**
   * Calcula similaridade entre dois textos usando algoritmo otimizado
   * @param {string} texto1 
   * @param {string} texto2 
   * @returns {number} Valor entre 0 e 1
   */
  _calcularSimilaridade(texto1, texto2) {
    if (texto1 === texto2) return 1;
    if (!texto1 || !texto2) return 0;

    // Algoritmo de distância de Levenshtein otimizado
    const len1 = texto1.length;
    const len2 = texto2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const matrix = Array(len2 + 1).fill().map(() => Array(len1 + 1).fill(0));
    
    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = texto1[i - 1] === texto2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1,     // deletion
          matrix[j][i - 1] + 1,     // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }
    
    const maxLen = Math.max(len1, len2);
    return (maxLen - matrix[len2][len1]) / maxLen;
  }

  /**
   * Verifica inclusão inteligente entre textos
   * @param {string} texto1 
   * @param {string} texto2 
   * @returns {boolean}
   */
  _verificarInclusaoInteligente(texto1, texto2) {
    const minLength = 15; // Tamanho mínimo para evitar correspondências muito genéricas
    
    if (Math.min(texto1.length, texto2.length) < minLength) {
      return false;
    }

    // Verificação especial para CEJUSCs - devem ser idênticos
    const isCejusc1 = texto1.toLowerCase().includes('cejusc');
    const isCejusc2 = texto2.toLowerCase().includes('cejusc');
    
    if (isCejusc1 || isCejusc2) {
      // Para CEJUSCs, exige correspondência exata após normalização
      const texto1Norm = texto1.replace(/\s+/g, ' ').trim();
      const texto2Norm = texto2.replace(/\s+/g, ' ').trim();
      return texto1Norm === texto2Norm;
    }

    // Verificar se um contém o outro
    const contemCompleto = texto1.includes(texto2) || texto2.includes(texto1);
    if (contemCompleto) return true;

    // Verificar inclusão de palavras principais
    const palavras1 = texto1.split(' ').filter(p => p.length > 3);
    const palavras2 = texto2.split(' ').filter(p => p.length > 3);
    
    if (palavras1.length === 0 || palavras2.length === 0) return false;

    const palavrasComuns = palavras1.filter(p1 => 
      palavras2.some(p2 => p1.includes(p2) || p2.includes(p1))
    );

    // Se mais de 80% das palavras principais coincidem (aumentado de 70%)
    const percentualComum = palavrasComuns.length / Math.min(palavras1.length, palavras2.length);
    return percentualComum >= 0.8;
  }

  /**
   * Verifica correspondência entre palavras-chave
   */
  _verificarPalavrasChave(texto1, texto2) {
    const palavrasChave1 = this._extrairPalavrasChave(texto1);
    const palavrasChave2 = this._extrairPalavrasChave(texto2);
    
    if (palavrasChave1.length === 0 || palavrasChave2.length === 0) return false;
    
    const palavrasComuns = palavrasChave1.filter(p1 => 
      palavrasChave2.some(p2 => p1 === p2)
    );
    
    const percentualComum = palavrasComuns.length / Math.min(palavrasChave1.length, palavrasChave2.length);
    return percentualComum >= 0.6;
  }

  /**
   * Extrai palavras-chave relevantes do texto
   */
  _extrairPalavrasChave(texto) {
    const palavrasRelevantes = texto.toLowerCase()
      .split(/\s+/)
      .filter(palavra => palavra.length > 3)
      .filter(palavra => !/^(da|de|do|das|dos|para|com|por|em|na|no|nas|nos|uma|um|uns|umas|que|qual|quais|onde|quando|como|porque|pela|pelo|pelas|pelos)$/.test(palavra));
    
    return [...new Set(palavrasRelevantes)];
  }

  /**
   * Obtém estatísticas do cache
   */
  obterEstatisticas() {
    return {
      totalOJs: this.cache.size,
      ojsVinculados: Array.from(this.cache.values()).filter(item => item.jaVinculado).length,
      cacheValido: this.cacheValido,
      ultimaAtualizacao: this.ultimaAtualizacao
    };
  }
}

module.exports = { SmartOJCache };