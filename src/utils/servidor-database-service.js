/**
 * Serviço para consulta de Servidores no banco de dados PJE
 * Implementa busca direta de servidores do 1º e 2º graus com filtros
 */

const DatabaseConnection = require('./database-connection');
const { loadSavedCredentials } = require('./database-connection');

class ServidorDatabaseService {
  constructor() {
    // Carregar credenciais salvas se existirem
    const savedCredentials = loadSavedCredentials();
    this.dbConnection = new DatabaseConnection(savedCredentials);
  }

  /**
     * Busca servidores por CPF/Nome e perfil
     * @param {string} grau - Grau do servidor (1 ou 2)
     * @param {string} filtroNome - Filtro por nome ou CPF
     * @param {string} filtroPerfil - Filtro por perfil
     * @param {number} limite - Limite de resultados (0 = sem limite)
     * @param {string} filtroStatus - 'ativos' (dt_final IS NULL), 'inativos' (dt_final IS NOT NULL), 'todos' (sem filtro)
     * @param {string} filtroCidade - Filtro por cidade/OJ (opcional)
     * @returns {Promise<Array>} Lista de servidores encontrados
     */
  async buscarServidores(grau = '1', filtroNome = '', perfil = '', limite = 0, filtroStatus = 'ativos', filtroCidade = '') {
    try {
      console.log('🔍 Iniciando busca de servidores...');
      console.log(`📋 Parâmetros: grau=${grau}, filtroNome=${filtroNome}, perfil=${perfil}, limite=${limite}, filtroStatus=${filtroStatus}, filtroCidade=${filtroCidade}`);
            
      // Verificar se o banco está habilitado
      const config = require('../../database.config.js');
      const dbConfig = grau === '2' ? config.database2Grau : config.database1Grau;
      
      if (!dbConfig.enabled) {
        console.log(`⚠️ Banco do ${grau}º grau está desabilitado. Retornando dados mockados.`);
        return this.getMockServidores(grau, filtroNome);
      }
      
      console.log(`📋 Conectando ao banco do ${grau}º grau: ${dbConfig.database}`);
            
      // Reutilizar a conexão existente do DatabaseConnection
      await this.dbConnection.initialize();
      
      // Usar o pool da conexão existente
      const pool = this.dbConnection.pool;
      if (!pool) {
        throw new Error('Pool de conexão não disponível');
      }
      
      console.log(`✅ Usando pool existente para banco do ${grau}º grau`);
            
      let query = `
                SELECT 
                    l.id_usuario,
                    l.ds_nome as nome,
                    l.ds_login as cpf,
                    p.ds_nome as perfil,
                    COALESCE(o.ds_orgao_julgador, 'Não informado') as orgao_julgador,
                    us.dt_inicio as data_inicio,
                    us.dt_final as data_final,
                    o.in_ativo as ativo_oj,
                    ul.id_usuario_localizacao,
                    CASE 
                        -- Padrão: "CON1 - Campinas", "EXE1 - São José dos Campos", etc
                        WHEN o.ds_orgao_julgador ~ '^(CON|EXE|LIQ|DIVEX)[0-9]* - ' THEN 
                            INITCAP(TRIM(SUBSTRING(o.ds_orgao_julgador FROM '^(?:CON|EXE|LIQ|DIVEX)[0-9]* - (.+)$')))
                        -- Padrão: "Vara do Trabalho de Ribeirão Preto"
                        WHEN o.ds_orgao_julgador LIKE '%de %' THEN 
                            INITCAP(TRIM(SUBSTRING(o.ds_orgao_julgador FROM '.*de ([^-]+?)(?:\\s*-|\\s+em\\s+|$)')))
                        -- Padrão: "CCP CAMPINAS - Centro..."
                        WHEN o.ds_orgao_julgador ~ '^CCP [A-Z]+ -' THEN
                            INITCAP(TRIM(SUBSTRING(o.ds_orgao_julgador FROM '^CCP ([A-Z]+) -')))
                        -- Padrão: "CEJUSC CAMPINAS - ..."
                        WHEN o.ds_orgao_julgador ~ '^CEJUSC [A-Z]+ -' THEN
                            INITCAP(TRIM(SUBSTRING(o.ds_orgao_julgador FROM '^CEJUSC ([A-Z]+) -')))
                        -- Padrão: "Assessoria de Execução I de Sertãozinho, Orlândia, Batatais e Franca"
                        WHEN o.ds_orgao_julgador LIKE 'Assessoria de Execução%de %' THEN
                            INITCAP(TRIM(SUBSTRING(o.ds_orgao_julgador FROM 'de ([^,]+)')))
                        ELSE 'Outros'
                    END as cidade
                FROM tb_usuario_login l
                JOIN pje.tb_usuario_localizacao ul ON l.id_usuario = ul.id_usuario
                JOIN tb_usu_local_mgtdo_servdor us ON ul.id_usuario_localizacao = us.id_usu_local_mgstrado_servidor
                JOIN tb_orgao_julgador o ON us.id_orgao_julgador = o.id_orgao_julgador
                JOIN tb_papel p ON p.id_papel = ul.id_papel
                WHERE 1=1
            `;
            
      const params = [];
      let paramIndex = 1;
            
      // Filtro por CPF ou Nome
      if (filtroNome && filtroNome.trim()) {
        const filtro = filtroNome.trim();
        // Se contém apenas números, buscar por CPF, senão buscar por nome
        if (/^\d+$/.test(filtro)) {
          query += ` AND l.ds_login = $${paramIndex}`;
          params.push(filtro);
        } else {
          query += ` AND UPPER(l.ds_nome) LIKE UPPER($${paramIndex})`;
          params.push(`%${filtro}%`);
        }
        paramIndex++;
      }
            
      // Filtro por perfil
      if (perfil && perfil.trim()) {
        query += ` AND UPPER(p.ds_nome) LIKE UPPER($${paramIndex})`;
        params.push(`%${perfil.trim()}%`);
        paramIndex++;
      }
            
      // Filtro por status do vínculo (dt_final)
      if (filtroStatus === 'ativos') {
        // Apenas vínculos ativos (sem data final)
        query += ' AND us.dt_final IS NULL';
      } else if (filtroStatus === 'inativos') {
        // Apenas vínculos inativos (com data final)
        query += ' AND us.dt_final IS NOT NULL';
      }
      // Se filtroStatus === 'todos', não adiciona filtro de data
      
      // Filtro por cidade (se especificado)
      if (filtroCidade && filtroCidade.trim()) {
        query += ` AND (
          CASE 
            -- Padrão: "CON1 - Campinas", "EXE1 - São José dos Campos", etc
            WHEN o.ds_orgao_julgador ~ '^(CON|EXE|LIQ|DIVEX)[0-9]* - ' THEN 
                INITCAP(TRIM(SUBSTRING(o.ds_orgao_julgador FROM '^(?:CON|EXE|LIQ|DIVEX)[0-9]* - (.+)$')))
            -- Padrão: "Vara do Trabalho de Ribeirão Preto"
            WHEN o.ds_orgao_julgador LIKE '%de %' THEN 
                INITCAP(TRIM(SUBSTRING(o.ds_orgao_julgador FROM '.*de ([^-]+?)(?:\\s*-|\\s+em\\s+|$)')))
            -- Padrão: "CCP CAMPINAS - Centro..."
            WHEN o.ds_orgao_julgador ~ '^CCP [A-Z]+ -' THEN
                INITCAP(TRIM(SUBSTRING(o.ds_orgao_julgador FROM '^CCP ([A-Z]+) -')))
            -- Padrão: "CEJUSC CAMPINAS - ..."
            WHEN o.ds_orgao_julgador ~ '^CEJUSC [A-Z]+ -' THEN
                INITCAP(TRIM(SUBSTRING(o.ds_orgao_julgador FROM '^CEJUSC ([A-Z]+) -')))
            -- Padrão: "Assessoria de Execução I de Sertãozinho, Orlândia, Batatais e Franca"
            WHEN o.ds_orgao_julgador LIKE 'Assessoria de Execução%de %' THEN
                INITCAP(TRIM(SUBSTRING(o.ds_orgao_julgador FROM 'de ([^,]+)')))
            ELSE 'Outros'
          END
        ) ILIKE $${paramIndex}`;
        params.push(`%${filtroCidade.trim()}%`);
        paramIndex++;
      }
            
      query += `
                ORDER BY 
                    cidade ASC,
                    -- Ordenação natural para OJs com números ordinais
                    CASE 
                        WHEN o.ds_orgao_julgador ~ '^[0-9]+[ªº]? ' THEN
                            LPAD(SUBSTRING(o.ds_orgao_julgador FROM '^([0-9]+)'), 3, '0') || SUBSTRING(o.ds_orgao_julgador FROM '^[0-9]+[ªº]? (.+)$')
                        ELSE o.ds_orgao_julgador
                    END ASC,
                    l.ds_nome ASC
            `;
            
      // Adicionar limite
      if (limite > 0) {
        query += ` LIMIT $${paramIndex}`;
        params.push(limite);
      }
            
      console.log('📋 Query de servidores: ', query);
      console.log('📋 Parâmetros:', params);
            
      const client = await pool.connect();
      const result = await client.query(query, params);
      client.release();
            
      // Agrupar dados por servidor
      const servidoresMap = new Map();
            
      result.rows.forEach(row => {
        const servidorKey = `${row.id_usuario}-${row.cpf}`;
                
        if (!servidoresMap.has(servidorKey)) {
          servidoresMap.set(servidorKey, {
            id: row.id_usuario,
            nome: row.nome,
            cpf: row.cpf,
            ojs: []
          });
        }
                
        // Adicionar OJ apenas se existir
        if (row.orgao_julgador) {
          // Determinar se o vínculo está ativo (sem data final)
          const isAtivo = !row.data_final;
          
          servidoresMap.get(servidorKey).ojs.push({
            orgaoJulgador: row.orgao_julgador,
            perfil: row.perfil || 'Não informado',
            dataInicio: row.data_inicio ? new Date(row.data_inicio).toLocaleDateString('pt-BR') : 'Não informado',
            dataFinal: row.data_final ? new Date(row.data_final).toLocaleDateString('pt-BR') : null,
            idUsuarioLocalizacao: row.id_usuario_localizacao,
            cidade: row.cidade || 'Outros',
            ativo: isAtivo,
            statusOJ: isAtivo ? 'Ativo' : 'Inativo',
            ojAtivo: row.ativo_oj === 'S'
          });
        }
      });
            
      const servidores = Array.from(servidoresMap.values());
            
      console.log(`✅ Encontrados ${servidores.length} servidores com ${result.rows.length} vínculos`);
            
      return servidores;
            
    } catch (error) {
      console.error(`❌ Erro ao buscar servidores ${grau}º grau:`, error);
      throw error;
    }
  }

  /**
     * Busca OJs vinculados a um servidor específico
     * @param {number} idUsuarioLocalizacao - ID da localização do usuário
     * @returns {Promise<Array>} Lista de OJs vinculados
     */
  async buscarOJsDoServidor(idUsuarioLocalizacao) {
    try {
      console.log(`🔍 Buscando OJs do servidor (ID: ${idUsuarioLocalizacao})`);
            
      // Inicializar conexão
      await this.dbConnection.initialize();
            
      const query = `
                SELECT DISTINCT
                    oj.id_orgao_julgador as id,
                    oj.ds_orgao_julgador as nome,
                    oj.in_ativo as ativo,
                    'Primeiro Grau' as grau
                FROM pje.tb_orgao_julgador oj
                JOIN pje.tb_usuario_localizacao_movimento ulm ON oj.id_orgao_julgador = ulm.id_orgao_julgador
                WHERE ulm.id_usuario_localizacao = $1
                    AND oj.in_ativo = 'S'
                ORDER BY oj.ds_orgao_julgador
            `;
            
      const client = await this.dbConnection.pool.connect();
      const result = await client.query(query, [idUsuarioLocalizacao]);
      client.release();
            
      console.log(`✅ Encontrados ${result.rows.length} OJs vinculados`);
            
      return result.rows.map(row => ({
        id: row.id,
        nome: row.nome,
        ativo: row.ativo === 'S',
        grau: row.grau,
        status: row.ativo === 'S' ? 'Ativo' : 'Inativo'
      }));
            
    } catch (error) {
      console.error('❌ Erro ao buscar OJs do servidor:', error);
      throw error;
    }
  }

  /**
     * Testa conectividade com o banco de dados
     * @returns {Promise<boolean>} True se conectado com sucesso
     */
  async testarConectividade() {
    try {
      console.log('🔌 Testando conectividade com banco de dados...');
            
      // Inicializar conexão
      await this.dbConnection.initialize();
            
      const client = await this.dbConnection.pool.connect();
      const result = await client.query('SELECT 1 as teste');
      client.release();
      return {
        conectado: true,
        timestamp: new Date().toISOString(),
        detalhes: 'Conexão estabelecida com sucesso'
      };
            
    } catch (error) {
      console.error('❌ Erro ao testar conectividade:', error);
      return false;
    }
  }

  /**
   * Função de debug para testar query exata do usuário
   */
  async testarQueryExata(grau = '1', cpf = '53036140697', cidade = 'campinas') {
    try {
      const config = require('../../database.config.js');
      const { Pool } = require('pg');
      
      const dbConfig = grau === '2' ? config.database2Grau : config.database1Grau;
      const pool = new Pool(dbConfig);
      
      const query = `
        SELECT count(*)
        FROM tb_usuario_login l
        JOIN pje.tb_usuario_localizacao ul ON l.id_usuario = ul.id_usuario
        JOIN tb_usu_local_mgtdo_servdor us ON ul.id_usuario_localizacao = us.id_usu_local_mgstrado_servidor
        JOIN tb_orgao_julgador o ON us.id_orgao_julgador = o.id_orgao_julgador
        JOIN tb_papel p ON p.id_papel = ul.id_papel
        WHERE l.ds_login = $1
        AND us.dt_final IS NULL
        AND o.ds_orgao_julgador ILIKE $2
      `;
      
      const client = await pool.connect();
      const result = await client.query(query, [cpf, `%${cidade}%`]);
      client.release();
      await pool.end();
      
      console.log(`🧪 Query teste retornou: ${result.rows[0].count} registros`);
      return parseInt(result.rows[0].count);
      
    } catch (error) {
      console.error('❌ Erro na query de teste:', error);
      throw error;
    }
  }

  /**
   * Busca apenas os OJs de um servidor específico pelo CPF
   * Usa a query específica fornecida para buscar os órgãos julgadores
   * @param {string} cpf - CPF do servidor (apenas números)
   * @param {string} grau - Grau do servidor (1 ou 2)
   * @returns {Promise<Array>} Lista de OJs vinculados ao servidor
   */
  async buscarOJsDoServidor(cpf, grau = '1') {
    let pool = null;
    try {
      console.log(`🔍 Buscando OJs do servidor CPF: ${cpf} no ${grau}º grau`);

      // Carregar credenciais salvas
      const fs = require('fs');
      const path = require('path');
      const credentialsPath = path.resolve(__dirname, '../../database-credentials.json');
      let credentials = null;

      if (fs.existsSync(credentialsPath)) {
        credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
        console.log('✅ Credenciais carregadas de database-credentials.json');
      }

      // Determinar host e database baseado no grau
      const database = grau === '2'
        ? (credentials?.database2Grau || 'pje_2grau')
        : (credentials?.database1Grau || 'pje_1grau');

      const host = grau === '2'
        ? (credentials?.host2Grau || credentials?.host || 'localhost')
        : (credentials?.host1Grau || credentials?.host || 'localhost');

      console.log(`🔗 Conectando ao banco: ${database}@${host}...`);

      // Criar pool específico para este grau
      const { Pool } = require('pg');
      pool = new Pool({
        host: host,
        port: credentials?.port || 5432,
        database: database,
        user: credentials?.user,
        password: credentials?.password,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
      
      // Query específica para buscar OJs do servidor (apenas vínculos ativos)
      const query = `
        SELECT DISTINCT
          o.ds_orgao_julgador as orgao_julgador,
          o.id_orgao_julgador,
          p.ds_nome as perfil,
          us.dt_final
        FROM
          pje.tb_usuario_login l
        JOIN 
          pje.tb_usuario_localizacao ul 
            ON l.id_usuario = ul.id_usuario
        JOIN 
          pje.tb_usu_local_mgtdo_servdor us 
            ON ul.id_usuario_localizacao = us.id_usu_local_mgstrado_servidor
        JOIN 
          pje.tb_orgao_julgador o 
            ON us.id_orgao_julgador = o.id_orgao_julgador
        JOIN 
          pje.tb_papel p 
            ON p.id_papel = ul.id_papel
        WHERE 
          l.ds_login = $1
          AND us.dt_final IS NULL  -- Apenas vínculos ativos (sem data de fim)
          AND o.in_ativo = 'S'     -- Apenas OJs ativos no sistema
        ORDER BY 
          o.ds_orgao_julgador
      `;
      
      const client = await pool.connect();
      const result = await client.query(query, [cpf]);
      client.release();

      console.log(`✅ Encontrados ${result.rows.length} OJs para o servidor ${cpf}`);

      // Fechar pool
      await pool.end();

      // Retornar array de OJs
      return result.rows.map(row => ({
        orgaoJulgador: row.orgao_julgador,
        id: row.id_orgao_julgador,
        perfil: row.perfil
      }));

    } catch (error) {
      console.error('❌ Erro ao buscar OJs do servidor:', error);
      // Fechar pool em caso de erro
      if (pool) {
        try {
          await pool.end();
        } catch (poolError) {
          console.error('❌ Erro ao fechar pool:', poolError);
        }
      }
      throw error;
    }
  }

  /**
     * Retorna dados mockados de servidores quando o banco está desabilitado
     */
  getMockServidores(grau, filtroNome) {
    console.log(`📋 Retornando dados mockados para ${grau}º grau`);
    return [
      {
        id: 1,
        nome: 'Servidor Mock',
        cpf: '12345678901',
        perfil: 'Magistrado',
        ojs: [
          {
            orgaoJulgador: 'Vara Mock de Teste',
            perfil: 'Magistrado',
            dataInicio: '01/01/2023',
            dataFinal: null,
            idUsuarioLocalizacao: 1,
            cidade: 'Cidade Mock',
            ativo: true,
            statusOJ: 'Ativo',
            ojAtivo: true
          }
        ]
      }
    ];
  }

  /**
     * Retorna dados mockados de OJs quando o banco está desabilitado
     */
  getMockOJs(cpf, grau) {
    console.log(`📋 Retornando OJs mockados para CPF ${cpf} no ${grau}º grau`);
    return [
      {
        orgaoJulgador: 'Vara Mock de Teste',
        id: 1,
        perfil: 'Magistrado'
      }
    ];
  }

  /**
     * Fecha a conexão com o banco
     */
  async close() {
    if (this.dbConnection) {
      await this.dbConnection.close();
    }
  }
}

module.exports = ServidorDatabaseService;