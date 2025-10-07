/**
 * Serviço de Consultas Avançadas para PJE
 * Fornece consultas pré-definidas úteis para 1º e 2º graus
 *
 * Categorias:
 * - 1º Grau: Audiências, Distribuição, Tarefas
 * - 2º Grau: Sessões, Processos, Relatoria
 */

const DatabaseConnection = require('./database-connection');
const { loadSavedCredentials } = require('./database-connection');

class AdvancedQueriesService {
  constructor() {
    const savedCredentials = loadSavedCredentials();
    this.dbConnection = new DatabaseConnection(savedCredentials);
    this.pg = require('pg');
  }

  /**
   * Lista todos os bancos de dados disponíveis no servidor
   */
  async listAvailableDatabases() {
    try {
      // Usa o banco do 1º grau para listar todos os bancos
      await this.dbConnection.initialize();
      const client = await this.dbConnection.pool.connect();

      try {
        const result = await client.query(`
          SELECT datname, pg_size_pretty(pg_database_size(datname)) as size
          FROM pg_database
          WHERE datistemplate = false
          ORDER BY datname
        `);
        return result.rows;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('❌ Erro ao listar bancos:', error);
      throw error;
    }
  }

  /**
   * Busca metadados do banco (schemas, tabelas e colunas) para autocomplete
   * @param {'1'|'2'} grau - Grau do banco (1 ou 2)
   * @param {string} schemaFilter - Filtro opcional para schema específico
   * @returns {Promise<{success: boolean, data: {schemas: Array, tables: Array, columns: Array}}>}
   */
  async buscarMetadadosBanco(grau, schemaFilter = null) {
    let client = null;
    try {
      client = await this.getClientForGrau(grau);

      // Buscar schemas
      const schemasQuery = schemaFilter
        ? `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1 ORDER BY schema_name`
        : `SELECT schema_name FROM information_schema.schemata
           WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
           ORDER BY schema_name`;

      const schemasResult = schemaFilter
        ? await client.query(schemasQuery, [schemaFilter])
        : await client.query(schemasQuery);

      const schemas = schemasResult.rows.map(r => r.schema_name);

      // Buscar tabelas e colunas
      const tablesQuery = schemaFilter
        ? `SELECT
             table_schema,
             table_name,
             table_type
           FROM information_schema.tables
           WHERE table_schema = $1
           ORDER BY table_schema, table_name`
        : `SELECT
             table_schema,
             table_name,
             table_type
           FROM information_schema.tables
           WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
           ORDER BY table_schema, table_name`;

      const tablesResult = schemaFilter
        ? await client.query(tablesQuery, [schemaFilter])
        : await client.query(tablesQuery);

      const tables = tablesResult.rows;

      // Buscar colunas (otimizado - só busca se houver tabelas)
      let columns = [];
      if (tables.length > 0) {
        const columnsQuery = schemaFilter
          ? `SELECT
               table_schema,
               table_name,
               column_name,
               data_type,
               is_nullable,
               column_default,
               ordinal_position
             FROM information_schema.columns
             WHERE table_schema = $1
             ORDER BY table_schema, table_name, ordinal_position`
          : `SELECT
               table_schema,
               table_name,
               column_name,
               data_type,
               is_nullable,
               column_default,
               ordinal_position
             FROM information_schema.columns
             WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
             ORDER BY table_schema, table_name, ordinal_position`;

        const columnsResult = schemaFilter
          ? await client.query(columnsQuery, [schemaFilter])
          : await client.query(columnsQuery);

        columns = columnsResult.rows;
      }

      return {
        success: true,
        data: {
          schemas,
          tables,
          columns
        }
      };
    } catch (error) {
      console.error('❌ Erro ao buscar metadados do banco:', error);
      return {
        success: false,
        error: error.message,
        data: { schemas: [], tables: [], columns: [] }
      };
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Retorna um client conectado para o grau selecionado
   * @param {'1'|'2'} grau
   */
  async getClientForGrau(grau) {
    if (grau === '1') {
      await this.dbConnection.initialize();
      return this.dbConnection.pool.connect();
    } else {
      let config = null;
      try {
        config = require('../../database.config.js').database2Grau;
      } catch (error) {
        throw new Error('Configuração de banco de dados do 2º grau não disponível');
      }

      // Debug: Mostrar configuração do 2º grau
      console.log('🔍 [DEBUG] Configuração 2º grau:', {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password ? '***' : 'VAZIO',
        options: config.options
      });

      // Validar credenciais antes de tentar conectar
      if (!config.password || config.password === '') {
        throw new Error('Credenciais do banco de dados do 2º grau não configuradas. Configure DB_2GRAU_PASSWORD no arquivo .env');
      }

      if (!config.host || config.host === '') {
        throw new Error('Host do banco de dados do 2º grau não configurado. Configure DB_2GRAU_HOST no arquivo .env');
      }

      if (!config.user || config.user === '') {
        throw new Error('Usuário do banco de dados do 2º grau não configurado. Configure DB_2GRAU_USER no arquivo .env');
      }

      console.log(`🔗 Tentando conectar no 2º grau: ${config.user}@${config.host}:${config.port}/${config.database}`);

      const pool2 = new this.pg.Pool(config);
      const client = await pool2.connect();
      client.__tmpPool = pool2;
      return client;
    }
  }

  /**
   * Retorna SELECT com campos básicos que geralmente existem
   * NOTA: Para adicionar mais campos, use diagnosticarEstruturTabela() primeiro
   * @private
   * @param {string} grau - '1' ou '2'
   */
  _getProcessoSelectWithDescriptions(grau = '1') {
    const schema = 'pje'; // Ambos os graus usam schema pje
    const tabelaOrgao = 'tb_orgao_julgador'; // Ambos os graus usam a mesma tabela

    return `
      SELECT
        p.id_processo,
        p.nr_processo,
        oj.ds_orgao_julgador as vara
      FROM ${schema}.tb_processo p
      LEFT JOIN ${schema}.tb_processo_trf pt ON pt.id_processo_trf = p.id_processo
      LEFT JOIN ${schema}.${tabelaOrgao} oj ON oj.id_orgao_julgador = pt.id_orgao_julgador
    `;
  }

  /**
   * Retorna SELECT dinâmico baseado nos campos disponíveis
   * @param {string} grau - '1' ou '2'
   * @returns {Promise<string>} Query SELECT otimizada
   */
  async _getProcessoSelectDinamico(grau = '1') {
    const schema = 'pje'; // Ambos os graus usam schema pje
    const tabelaOrgao = 'tb_orgao_julgador'; // Ambos os graus usam a mesma tabela

    // Listar campos disponíveis na tb_processo
    const camposDisponiveis = await this.diagnosticarEstruturTabela(grau, 'tb_processo');
    const nomesColuna = camposDisponiveis.map(c => c.column_name);

    // Campos opcionais que queremos incluir se existirem
    const camposDesejados = [
      'id_processo',
      'nr_processo',
      'in_segredo_justica',
      'in_prioridade',
      'dt_autuacao',
      'dt_cadastro',
      'dt_criacao',
      'id_fluxo',
      'id_usuario_bloqueio',
      'id_usuario_cadastro_processo',
      'id_caixa',
      'id_agrupamento_fase',
      'id_jbpm'
    ];

    // Selecionar apenas os campos que existem
    const camposSelecionados = camposDesejados
      .filter(campo => nomesColuna.includes(campo))
      .map(campo => `p.${campo}`)
      .join(',\n        ');

    return `
      SELECT
        ${camposSelecionados},
        oj.ds_orgao_julgador as vara
      FROM ${schema}.tb_processo p
      LEFT JOIN ${schema}.tb_processo_trf pt ON pt.id_processo_trf = p.id_processo
      LEFT JOIN ${schema}.${tabelaOrgao} oj ON oj.id_orgao_julgador = pt.id_orgao_julgador
    `;
  }

  /**
   * Executa query com tratamento de erro e limpeza de conexão
   * @param {string} grau
   * @param {string} query
   * @param {Array} params
   * @returns {Promise<Array>}
   */
  async executeQuery(grau, query, params = []) {
    const client = await this.getClientForGrau(grau);
    try {
      // Definir search_path antes de executar a query
      await client.query("SET search_path TO trt15, pje, public");

      const result = await client.query(query, params);
      return result.rows || [];
    } finally {
      client.release();
      if (client.__tmpPool) await client.__tmpPool.end();
    }
  }

  // =============================================================================
  // 1º GRAU - AUDIÊNCIAS
  // =============================================================================

  /**
   * Processos recentes com informações disponíveis
   * @param {string} grau - Padrão '1'
   * @param {number} limite
   * @returns {Promise<Array>}
   */
  async audienciasHoje(grau = '1', limite = 100) {
    const query = `
      ${this._getProcessoSelectWithDescriptions(grau)}
      ORDER BY p.id_processo DESC
      LIMIT $1;
    `;

    return this.executeQuery(grau, query, [limite]);
  }

  /**
   * Processos recentes
   * @param {string} grau
   * @param {number} limite
   * @returns {Promise<Array>}
   */
  async audienciasSemana(grau = '1', limite = 100) {
    const query = `
      ${this._getProcessoSelectWithDescriptions(grau)}
      ORDER BY p.id_processo DESC
      LIMIT $1;
    `;

    return this.executeQuery(grau, query, [limite]);
  }

  /**
   * Processos recentes
   * @param {string} grau
   * @param {number} limite
   * @returns {Promise<Array>}
   */
  async audienciasMes(grau = '1', limite = 200) {
    const query = `
      ${this._getProcessoSelectWithDescriptions(grau)}
      ORDER BY p.id_processo DESC
      LIMIT $1;
    `;

    return this.executeQuery(grau, query, [limite]);
  }

  // =============================================================================
  // 1º GRAU - DISTRIBUIÇÃO
  // =============================================================================

  /**
   * Processos recentes
   * @param {string} grau
   * @param {number} limite
   * @returns {Promise<Array>}
   */
  async distribuicaoHoje(grau = '1', limite = 100) {
    const query = `
      ${this._getProcessoSelectWithDescriptions(grau)}
      ORDER BY p.id_processo DESC
      LIMIT $1;
    `;

    return this.executeQuery(grau, query, [limite]);
  }

  /**
   * MÉTODO ORIGINAL (comentado - use após descobrir estrutura real com diagnosticarTabelas)
   */
  async _distribuicaoHojeCompleto(grau = '1') {
    const query = `
      SELECT
        p.nr_processo,
        p.dt_autuacao,
        tp.ds_tipo_processo_sigla as classe,
        tpa.ds_tipo_processo_area as assunto,
        oj.ds_orgao_julgador as vara_destino,
        p.dt_distribuicao,
        STRING_AGG(DISTINCT ul.ds_nome, ', ' ORDER BY ul.ds_nome) as partes
      FROM tb_processo p
      JOIN tb_tipo_processo tp ON tp.id_tipo_processo = p.id_tipo_processo
      LEFT JOIN tb_tipo_processo_area tpa ON tpa.id_tipo_processo_area = p.id_tipo_processo_area
      JOIN tb_processo_trf pt ON pt.id_processo_trf = p.id_processo
      JOIN tb_orgao_julgador oj ON oj.id_orgao_julgador = pt.id_orgao_julgador
      LEFT JOIN tb_processo_parte pp ON pp.id_processo = p.id_processo
      LEFT JOIN tb_usuario_login ul ON ul.id_usuario = pp.id_pessoa
      WHERE DATE(p.dt_distribuicao) = CURRENT_DATE
      GROUP BY p.nr_processo, p.dt_autuacao, tp.ds_tipo_processo_sigla,
               tpa.ds_tipo_processo_area, oj.ds_orgao_julgador, p.dt_distribuicao
      ORDER BY p.dt_distribuicao DESC;
    `;

    return this.executeQuery(grau, query);
  }

  /**
   * Processos recentes
   * @param {string} grau
   * @param {number} limite
   * @returns {Promise<Array>}
   */
  async distribuicaoSemana(grau = '1', limite = 100) {
    const query = `
      ${this._getProcessoSelectWithDescriptions(grau)}
      ORDER BY p.id_processo DESC
      LIMIT $1;
    `;

    return this.executeQuery(grau, query, [limite]);
  }

  /**
   * Processos recentes
   * @param {string} grau
   * @param {number} limite
   * @returns {Promise<Array>}
   */
  async distribuicaoMes(grau = '1', limite = 200) {
    const query = `
      ${this._getProcessoSelectWithDescriptions(grau)}
      ORDER BY p.id_processo DESC
      LIMIT $1;
    `;

    return this.executeQuery(grau, query, [limite]);
  }

  // =============================================================================
  // 1º GRAU - TAREFAS
  // =============================================================================

  /**
   * Processos em tarefa específica com filtros
   * @param {string} grau
   * @param {object} filtros - { numeroProcesso, nomeTarefa, dataTarefa }
   * @param {number} limite
   * @returns {Promise<Array>}
   */
  async processosEmTarefa(grau, filtros = {}, limite = 100) {
    const schema = grau === '1' ? 'pje' : 'pje';

    // Construir WHERE clause dinâmica
    const whereClauses = [];
    const params = [];
    let paramCount = 1;

    // Filtro por número do processo
    if (filtros.numeroProcesso) {
      whereClauses.push(`p.nr_processo LIKE $${paramCount}`);
      params.push(`%${filtros.numeroProcesso}%`);
      paramCount++;
    }

    // Filtro por nome da tarefa (precisa JOIN com tb_processo_tarefa se existir)
    if (filtros.nomeTarefa) {
      whereClauses.push(`EXISTS (
        SELECT 1 FROM ${schema}.tb_processo_tarefa pt
        WHERE pt.id_processo = p.id_processo
        AND pt.ds_nome_tarefa ILIKE $${paramCount}
      )`);
      params.push(`%${filtros.nomeTarefa}%`);
      paramCount++;
    }

    // Filtro por data da tarefa
    if (filtros.dataTarefa) {
      whereClauses.push(`EXISTS (
        SELECT 1 FROM ${schema}.tb_processo_tarefa pt
        WHERE pt.id_processo = p.id_processo
        AND DATE(pt.dt_inicio) = $${paramCount}
      )`);
      params.push(filtros.dataTarefa);
      paramCount++;
    }

    // Adicionar limite
    params.push(limite);

    const whereClause = whereClauses.length > 0
      ? `WHERE ${whereClauses.join(' AND ')}`
      : '';

    const query = `
      ${this._getProcessoSelectWithDescriptions(grau)}
      ${whereClause}
      ORDER BY p.id_processo DESC
      LIMIT $${paramCount};
    `;

    return this.executeQuery(grau, query, params);
  }

  /**
   * Processos recentes
   * @param {string} grau
   * @param {number} limite
   * @returns {Promise<Array>}
   */
  async tarefasPorVara(grau = '1', limite = 200) {
    const query = `
      ${this._getProcessoSelectWithDescriptions(grau)}
      ORDER BY p.id_processo DESC
      LIMIT $1;
    `;

    return this.executeQuery(grau, query, [limite]);
  }

  // =============================================================================
  // 2º GRAU - SESSÕES
  // =============================================================================

  /**
   * Diagnóstico: Listar todas as tabelas disponíveis
   */
  async diagnosticarTabelas(grau = '1') {
    const schema = grau === '1' ? 'pje' : 'pje';
    const query = `
      SELECT
        table_schema,
        table_name,
        table_type
      FROM information_schema.tables
      WHERE table_schema = $1
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    return this.executeQuery(grau, query, [schema]);
  }

  /**
   * Diagnóstico: Verificar estrutura de uma tabela específica
   */
  async diagnosticarEstruturTabela(grau = '1', nomeTabela = 'tb_processo') {
    const schema = grau === '1' ? 'pje' : 'pje';
    const query = `
      SELECT
        c.column_name,
        c.data_type,
        c.character_maximum_length,
        c.is_nullable,
        c.column_default,
        CASE
          WHEN pk.column_name IS NOT NULL THEN 'PK'
          WHEN fk.column_name IS NOT NULL THEN 'FK'
          ELSE ''
        END as key_type
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT ku.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku
          ON tc.constraint_name = ku.constraint_name
          AND tc.table_schema = ku.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = $1
          AND tc.table_name = $2
      ) pk ON pk.column_name = c.column_name
      LEFT JOIN (
        SELECT ku.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku
          ON tc.constraint_name = ku.constraint_name
          AND tc.table_schema = ku.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = $1
          AND tc.table_name = $2
      ) fk ON fk.column_name = c.column_name
      WHERE c.table_schema = $1
        AND c.table_name = $2
      ORDER BY c.ordinal_position;
    `;

    return this.executeQuery(grau, query, [schema, nomeTabela]);
  }

  /**
   * Diagnóstico: Verificar relacionamentos (FKs) de uma tabela
   */
  async diagnosticarRelacionamentos(grau = '1', nomeTabela = 'tb_processo') {
    const schema = grau === '1' ? 'pje' : 'pje';
    const query = `
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = $1
        AND tc.table_name = $2
      ORDER BY kcu.column_name;
    `;

    return this.executeQuery(grau, query, [schema, nomeTabela]);
  }

  /**
   * Diagnóstico: Verificar estrutura da tabela tb_sessao
   * @deprecated Use diagnosticarEstruturTabela('2', 'tb_sessao') instead
   */
  async diagnosticarEstruturaSessao(grau = '2') {
    return this.diagnosticarEstruturTabela(grau, 'tb_sessao');
  }

  /**
   * Sessões de julgamento do dia
   * NOTA: 2º grau usa schema pje e tabela tb_pauta_sessao
   * @param {string} grau - Padrão '2'
   * @param {number} limite
   * @returns {Promise<Array>}
   */
  async sessoesHoje(grau = '2', limite = 100) {
    const query = `
      SELECT *
      FROM pje.tb_pauta_sessao s
      ORDER BY s.id_pauta_sessao DESC
      LIMIT $1;
    `;

    return this.executeQuery(grau, query, [limite]);
  }

  /**
   * Sessões da semana (próximos 7 dias)
   * NOTA: 2º grau usa schema pje e tabela tb_pauta_sessao
   * @param {string} grau
   * @param {number} limite
   * @returns {Promise<Array>}
   */
  async sessoesSemana(grau = '2', limite = 100) {
    const query = `
      SELECT *
      FROM pje.tb_pauta_sessao s
      ORDER BY s.id_pauta_sessao DESC
      LIMIT $1;
    `;

    return this.executeQuery(grau, query, [limite]);
  }

  // =============================================================================
  // 2º GRAU - PROCESSOS
  // =============================================================================

  /**
   * Processos distribuídos ao relator (período customizado)
   * @param {string} grau
   * @param {string} dataInicio - Formato: YYYY-MM-DD
   * @param {string} dataFim - Formato: YYYY-MM-DD
   * @returns {Promise<Array>}
   */
  async processosDistribuidosRelator(grau = '2', dataInicio, dataFim) {
    const query = `
      SELECT
        p.nr_processo,
        p.dt_distribuicao,
        tp.ds_tipo_processo_sigla as classe,
        oj.ds_orgao_julgador as turma,
        ul.ds_nome as relator
      FROM tb_processo p
      JOIN tb_tipo_processo tp ON tp.id_tipo_processo = p.id_tipo_processo
      JOIN tb_processo_trf pt ON pt.id_processo_trf = p.id_processo
      JOIN tb_orgao_julgador oj ON oj.id_orgao_julgador = pt.id_orgao_julgador
      LEFT JOIN tb_processo_parte_polo ppp ON ppp.id_processo = p.id_processo AND ppp.in_polo = 'R'
      LEFT JOIN tb_usuario_login ul ON ul.id_usuario = ppp.id_pessoa
      WHERE p.dt_distribuicao BETWEEN $1 AND $2
      ORDER BY p.dt_distribuicao DESC;
    `;

    return this.executeQuery(grau, query, [dataInicio, dataFim]);
  }

  /**
   * Processos em tarefa específica (2º grau)
   * @param {string} grau
   * @param {string} nomeTarefa
   * @returns {Promise<Array>}
   */
  async processosEmTarefa2Grau(grau = '2', nomeTarefa) {
    return this.processosEmTarefa(grau, nomeTarefa);
  }

  /**
   * Busca processos com filtros avançados
   * @param {string} grau - '1' ou '2'
   * @param {Object} filtros - { dataInicio, dataFim, numeroProcesso, orgaoJulgador }
   * @param {number} limite
   * @returns {Promise<Array>}
   */
  async buscarProcessosComFiltros(grau = '1', filtros = {}, limite = 100) {
    const { numeroProcesso, orgaoJulgador } = filtros;

    let whereConditions = [];
    let params = [];
    let paramCounter = 1;

    // NOTA: Filtro por data removido até descobrirmos quais colunas de data existem
    // Use diagnosticarEstruturTabela(grau, 'tb_processo') para ver as colunas disponíveis

    // Filtro por número de processo
    if (numeroProcesso) {
      whereConditions.push(`p.nr_processo LIKE $${paramCounter}`);
      params.push(`%${numeroProcesso}%`);
      paramCounter++;
    }

    // Filtro por órgão julgador (busca exata quando vem do dropdown)
    if (orgaoJulgador) {
      whereConditions.push(`oj.ds_orgao_julgador = $${paramCounter}`);
      params.push(orgaoJulgador);
      paramCounter++;
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    params.push(limite);

    const query = `
      ${this._getProcessoSelectWithDescriptions(grau)}
      ${whereClause}
      ORDER BY p.id_processo DESC
      LIMIT $${paramCounter};
    `;

    return this.executeQuery(grau, query, params);
  }

  /**
   * Busca sessões com filtros (2º grau)
   * NOTA: 2º grau usa schema pje
   * @param {string} grau - Padrão '2'
   * @param {Object} filtros - { dataInicio, dataFim, orgaoJulgador }
   * @param {number} limite
   * @returns {Promise<Array>}
   */
  async buscarSessoesComFiltros(grau = '2', filtros = {}, limite = 100) {
    const { orgaoJulgador } = filtros;

    let whereConditions = [];
    let params = [];
    let paramCounter = 1;

    // NOTA: Filtro por data removido até descobrirmos quais colunas de data existem
    // Use diagnosticarEstruturTabela('2', 'tb_pauta_sessao') para ver as colunas disponíveis

    // Filtro por órgão julgador (busca exata quando vem do dropdown)
    if (orgaoJulgador) {
      whereConditions.push(`oj.ds_orgao_julgador = $${paramCounter}`);
      params.push(orgaoJulgador);
      paramCounter++;
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    params.push(limite);

    const query = `
      SELECT
        s.*,
        oj.ds_orgao_julgador as orgao_julgador
      FROM pje.tb_pauta_sessao s
      LEFT JOIN pje.tb_orgao_julgador oj ON oj.id_orgao_julgador = s.id_orgao_julgador
      ${whereClause}
      ORDER BY s.id_pauta_sessao DESC
      LIMIT $${paramCounter};
    `;

    return this.executeQuery(grau, query, params);
  }

  /**
   * Lista todos os órgãos julgadores disponíveis (apenas ativos)
   * @param {string} grau - '1' ou '2'
   * @returns {Promise<Array>}
   */
  async listarOrgaosJulgadores(grau = '1') {
    // Ambos os graus usam o mesmo schema e mesma tabela (singular)
    const schema = 'pje';
    const tabela = 'tb_orgao_julgador';

    const query = `
      SELECT DISTINCT
        oj.id_orgao_julgador,
        oj.ds_orgao_julgador
      FROM ${schema}.${tabela} oj
      WHERE oj.ds_orgao_julgador IS NOT NULL
        AND (oj.in_ativo IS NULL OR oj.in_ativo = 'S' OR oj.in_ativo::text = 'true')
      ORDER BY oj.ds_orgao_julgador;
    `;

    return this.executeQuery(grau, query);
  }

  /**
   * Verifica se uma data é dia útil
   * @param {string} data - Data no formato YYYY-MM-DD
   * @returns {boolean}
   */
  isDiaUtil(data) {
    const date = new Date(data + 'T12:00:00');
    const dayOfWeek = date.getDay();

    // 0 = Domingo, 6 = Sábado
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }

    // Lista de feriados nacionais 2024-2025 (expandir conforme necessário)
    const feriados = [
      '2024-01-01', '2024-02-12', '2024-02-13', '2024-03-29', '2024-04-21',
      '2024-05-01', '2024-05-30', '2024-09-07', '2024-10-12', '2024-11-02',
      '2024-11-15', '2024-11-20', '2024-12-25',
      '2025-01-01', '2025-03-03', '2025-03-04', '2025-04-18', '2025-04-21',
      '2025-05-01', '2025-06-19', '2025-09-07', '2025-10-12', '2025-11-02',
      '2025-11-15', '2025-11-20', '2025-12-25'
    ];

    return !feriados.includes(data);
  }

  /**
   * Verifica se há conexão ativa com o banco de dados
   * @param {string} grau - '1' ou '2'
   * @returns {Promise<Object>} - { conectado: boolean, mensagem: string, detalhes: object }
   */
  async verificarConexaoBanco(grau = '1') {
    const schema = grau === '1' ? 'pje' : 'pje';

    try {
      const startTime = Date.now();
      const query = `SELECT current_database() as database, current_schema() as schema, version() as version;`;
      const resultado = await this.executeQuery(grau, query);
      const responseTime = Date.now() - startTime;

      if (resultado && resultado.length > 0) {
        return {
          conectado: true,
          mensagem: `Conectado ao banco ${resultado[0].database} (${grau}º grau)`,
          detalhes: {
            database: resultado[0].database,
            schema: schema,
            version: resultado[0].version,
            responseTime: `${responseTime}ms`
          }
        };
      } else {
        return {
          conectado: false,
          mensagem: 'Banco não retornou dados',
          detalhes: {}
        };
      }
    } catch (error) {
      return {
        conectado: false,
        mensagem: error.message || 'Erro ao conectar com o banco de dados',
        detalhes: {
          error: error.message,
          code: error.code
        }
      };
    }
  }

  /**
   * Verifica quais tabelas relacionadas existem para melhorar as queries
   * @param {string} grau - '1' ou '2'
   * @returns {Promise<Object>} - Objeto com flags indicando quais tabelas existem
   */
  async verificarTabelasRelacionadas(grau = '1') {
    const schema = grau === '1' ? 'pje' : 'pje';
    const tabelasParaVerificar = [
      'tb_fluxo',
      'tb_usuario',
      'tb_caixa',
      'tb_agrupamento_fase',
      'tb_processo_parte',
      'tb_tipo_processo'
    ];

    const query = `
      SELECT
        table_name,
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = $1
          AND table_name = t.table_name
        ) as existe
      FROM (
        SELECT unnest($2::text[]) as table_name
      ) t;
    `;

    try {
      const resultado = await this.executeQuery(grau, query, [schema, tabelasParaVerificar]);
      const tabelasExistentes = {};
      resultado.forEach(row => {
        tabelasExistentes[row.table_name] = row.existe;
      });
      return tabelasExistentes;
    } catch (error) {
      console.error('Erro ao verificar tabelas:', error);
      return {};
    }
  }

  /**
   * Executa query SQL customizada
   * AVISO: Esta função executa SQL diretamente. Use com cuidado!
   * @param {string} grau - '1' ou '2'
   * @param {string} sqlQuery - Query SQL a ser executada
   * @returns {Promise<Object>} - { success: boolean, data: Array, error: string, info: object }
   */
  async executarQueryCustomizada(grau = '1', sqlQuery) {
    const startTime = Date.now();

    try {
      // Validações básicas de segurança
      const queryUpper = sqlQuery.trim().toUpperCase();

      // Detectar comandos perigosos
      const comandosPerigoosos = ['DROP', 'TRUNCATE', 'ALTER TABLE'];
      const temComandoPerigoso = comandosPerigoosos.some(cmd => queryUpper.includes(cmd));

      // Avisar sobre DELETE/UPDATE sem WHERE
      const ehDelete = queryUpper.startsWith('DELETE');
      const ehUpdate = queryUpper.startsWith('UPDATE');
      const temWhere = queryUpper.includes('WHERE');

      const avisos = [];

      if (temComandoPerigoso) {
        return {
          success: false,
          error: 'Query bloqueada: Comandos DROP, TRUNCATE e ALTER TABLE não são permitidos',
          data: [],
          info: { blocked: true, reason: 'dangerous_command' }
        };
      }

      if ((ehDelete || ehUpdate) && !temWhere) {
        avisos.push('ATENÇÃO: Query DELETE/UPDATE sem WHERE pode afetar todas as linhas!');
      }

      // Executar query
      const resultado = await this.executeQuery(grau, sqlQuery);
      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: resultado || [],
        error: null,
        info: {
          rowCount: resultado ? resultado.length : 0,
          executionTime: `${executionTime}ms`,
          warnings: avisos
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        error: error.message || 'Erro ao executar query',
        data: [],
        info: {
          executionTime: `${executionTime}ms`,
          errorCode: error.code,
          errorDetail: error.detail
        }
      };
    }
  }

  /**
   * Encerra conexões
   */
  async close() {
    if (this.dbConnection) {
      await this.dbConnection.close();
    }
  }
}

module.exports = AdvancedQueriesService;
