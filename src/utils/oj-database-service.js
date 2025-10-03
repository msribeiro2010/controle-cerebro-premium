/**
 * Serviço para consulta de Órgãos Julgadores no banco de dados PJE
 * Implementa busca direta de OJs do 1º e 2º graus com filtros
 */

const DatabaseConnection = require('./database-connection');
const { loadSavedCredentials } = require('./database-connection');

class OJDatabaseService {
  constructor() {
    // Carregar credenciais salvas se existirem
    const savedCredentials = loadSavedCredentials();
    this.dbConnection = new DatabaseConnection(savedCredentials);
  }

  /**
     * Busca órgãos julgadores ativos do 1º grau
     * @param {string} filtro - Filtro opcional para nome do órgão
     * @param {number} limite - Limite de resultados (padrão: 1000, 0 = sem limite)
     * @returns {Promise<Array>} Lista de OJs do 1º grau
     */
  async buscarOJs1Grau(filtro = '', limite = 0) {
    try {
      // Inicializar conexão com 1º grau
      await this.dbConnection.initialize();

      let query = `
                SELECT
                    toj.id_orgao_julgador as id,
                    toj.ds_orgao_julgador as nome,
                    '' as sigla,
                    toj.in_ativo as ativo,
                    'Primeiro Grau' as grau
                FROM pje.tb_orgao_julgador toj
                WHERE toj.in_ativo = 'S'
            `;

      const params = [];
      let paramIndex = 1;

      // Adicionar filtro por nome se fornecido
      if (filtro && filtro.trim() !== '') {
        query += ` AND UPPER(toj.ds_orgao_julgador) LIKE UPPER($${paramIndex})`;
        params.push(`%${filtro.trim()}%`);
        paramIndex++;
      }

      query += ' ORDER BY toj.ds_orgao_julgador';
      if (limite && limite > 0) {
        query += ` LIMIT $${paramIndex}`;
        params.push(limite);
      }

      console.log(`🔍 Buscando OJs do 1º grau${filtro ? ` com filtro: "${filtro}"` : ''} ${limite === 0 ? '(TODAS)' : ''}`);

      const client = await this.dbConnection.pool.connect();
      const result = await client.query(query, params);
      client.release();

      console.log(`✅ Encontrados ${result.rows.length} órgãos julgadores do 1º grau`);
      return result.rows;

    } catch (error) {
      console.error('❌ Erro ao buscar OJs do 1º grau:', error.message);
      throw new Error(`Erro ao consultar banco do 1º grau: ${error.message}`);
    }
  }

  /**
     * Busca órgãos julgadores ativos do 2º grau
     * @param {string} filtro - Filtro opcional para nome do órgão
     * @param {number} limite - Limite de resultados (padrão: 1000, 0 = sem limite)
     * @returns {Promise<Array>} Lista de OJs do 2º grau
     */
  async buscarOJs2Grau(filtro = '', limite = 0) {
    try {
      // Usar configuração específica do 2º grau
      const dbCfg = require('../../database.config.js');
      const config = dbCfg.segundoGrau || dbCfg.database2Grau;
      const { Pool } = require('pg');
      const pool2Grau = new Pool(config);

      let query = `
                SELECT
                    toj.id_orgao_julgador as id,
                    toj.ds_orgao_julgador as nome,
                    '' as sigla,
                    toj.in_ativo as ativo,
                    'Segundo Grau' as grau
                FROM pje.tb_orgao_julgador toj
                WHERE toj.in_ativo = 'S'
            `;

      const params = [];
      let paramIndex = 1;

      // Adicionar filtro por nome se fornecido
      if (filtro && filtro.trim() !== '') {
        query += ` AND UPPER(toj.ds_orgao_julgador) LIKE UPPER($${paramIndex})`;
        params.push(`%${filtro.trim()}%`);
        paramIndex++;
      }

      query += ' ORDER BY toj.ds_orgao_julgador';
      if (limite && limite > 0) {
        query += ` LIMIT $${paramIndex}`;
        params.push(limite);
      }

      console.log(`🔍 Buscando OJs do 2º grau${filtro ? ` com filtro: "${filtro}"` : ''} ${limite === 0 ? '(TODAS)' : ''}`);

      const result = await pool2Grau.query(query, params);
      await pool2Grau.end();

      console.log(`✅ Encontrados ${result.rows.length} órgãos julgadores do 2º grau`);
      return result.rows;

    } catch (error) {
      console.error('❌ Erro ao buscar OJs do 2º grau:', error.message);
      throw new Error(`Erro ao consultar banco do 2º grau: ${error.message}`);
    }
  }

  /**
     * Busca órgãos julgadores de ambos os graus
     * @param {string} filtro - Filtro opcional para nome do órgão
     * @param {number} limite - Limite de resultados por grau (padrão: 500)
     * @returns {Promise<Object>} Objeto com OJs separados por grau
     */
  async buscarOJsAmbosGraus(filtro = '', limite = 0) {
    try {
      console.log(`🔍 Iniciando busca em ambos os graus${filtro ? ` com filtro: "${filtro}"` : ''}`);

      const [ojs1Grau, ojs2Grau] = await Promise.all([
        this.buscarOJs1Grau(filtro, limite).catch(error => {
          console.warn('⚠️ Erro ao buscar 1º grau:', error.message);
          return [];
        }),
        this.buscarOJs2Grau(filtro, limite).catch(error => {
          console.warn('⚠️ Erro ao buscar 2º grau:', error.message);
          return [];
        })
      ]);

      const resultado = {
        primeiroGrau: ojs1Grau,
        segundoGrau: ojs2Grau,
        total: ojs1Grau.length + ojs2Grau.length,
        estatisticas: {
          total1Grau: ojs1Grau.length,
          total2Grau: ojs2Grau.length,
          filtroAplicado: !!filtro,
          timestamp: new Date().toISOString()
        }
      };

      console.log(`✅ Busca concluída: ${resultado.total} órgãos encontrados`);
      console.log(`   📊 1º Grau: ${resultado.total1Grau} | 2º Grau: ${resultado.total2Grau}`);

      return resultado;

    } catch (error) {
      console.error('❌ Erro ao buscar OJs de ambos os graus:', error.message);
      throw error;
    }
  }

  /**
     * Testa conectividade com os bancos de dados
     * @returns {Promise<Object>} Status da conectividade
     */
  async testarConectividade() {
    const resultado = {
      primeiroGrau: false,
      segundoGrau: false,
      detalhes: {},
      timestamp: new Date().toISOString()
    };

    // Testar 1º grau
    try {
      await this.dbConnection.initialize();
      const client = await this.dbConnection.pool.connect();
      await client.query('SELECT 1');
      client.release();
      resultado.primeiroGrau = true;
      resultado.detalhes.primeiroGrau = 'Conexão estabelecida com sucesso';
      console.log('✅ Conectividade 1º grau: OK');
    } catch (error) {
      resultado.detalhes.primeiroGrau = error.message;
      console.error('❌ Conectividade 1º grau: FALHA -', error.message);
    }

    // Testar 2º grau
    try {
      const dbCfg = require('../../database.config.js');
      const config = dbCfg.segundoGrau || dbCfg.database2Grau;
      const { Pool } = require('pg');
      const pool2Grau = new Pool(config);
      const client = await pool2Grau.connect();
      await client.query('SELECT 1');
      client.release();
      await pool2Grau.end();
      resultado.segundoGrau = true;
      resultado.detalhes.segundoGrau = 'Conexão estabelecida com sucesso';
      console.log('✅ Conectividade 2º grau: OK');
    } catch (error) {
      resultado.detalhes.segundoGrau = error.message;
      console.error('❌ Conectividade 2º grau: FALHA -', error.message);
    }

    return resultado;
  }

  /**
     * Exporta lista de OJs para JSON
     * @param {Array} ojs - Lista de OJs para exportar
     * @param {string} grau - Identificação do grau ('1grau', '2grau', 'ambos')
     * @returns {Object} Objeto formatado para exportação
     */
  exportarParaJSON(ojs, grau = 'ambos') {
    const timestamp = new Date().toISOString();
    const exportData = {
      metadata: {
        exportadoEm: timestamp,
        grau,
        totalRegistros: Array.isArray(ojs) ? ojs.length : (ojs.total || 0),
        versao: '1.0'
      },
      dados: ojs
    };

    console.log(`📄 Exportação preparada: ${exportData.metadata.totalRegistros} registros`);
    return exportData;
  }

  /**
     * Busca estatísticas gerais dos órgãos julgadores
     * @returns {Promise<Object>} Estatísticas dos bancos
     */
  async obterEstatisticas() {
    try {
      const stats = {
        primeiroGrau: { total: 0, ativos: 0, inativos: 0 },
        segundoGrau: { total: 0, ativos: 0, inativos: 0 },
        timestamp: new Date().toISOString()
      };

      // Estatísticas 1º grau
      try {
        await this.dbConnection.initialize();
        const client = await this.dbConnection.pool.connect();

        const query1Grau = `
                    SELECT
                        COUNT(*) as total,
                        SUM(CASE WHEN in_ativo = 'S' THEN 1 ELSE 0 END) as ativos,
                        SUM(CASE WHEN in_ativo = 'N' THEN 1 ELSE 0 END) as inativos
                    FROM pje.tb_orgao_julgador
                `;

        const result1 = await client.query(query1Grau);
        client.release();

        if (result1.rows.length > 0) {
          stats.primeiroGrau = {
            total: parseInt(result1.rows[0].total),
            ativos: parseInt(result1.rows[0].ativos),
            inativos: parseInt(result1.rows[0].inativos)
          };
        }
      } catch (error) {
        console.error('⚠️ Erro ao obter estatísticas 1º grau:', error.message);
      }

      // Estatísticas 2º grau
      try {
        const dbCfg = require('../../database.config.js');
      const config = dbCfg.segundoGrau || dbCfg.database2Grau;
        const { Pool } = require('pg');
        const pool2Grau = new Pool(config);

        const query2Grau = `
                    SELECT
                        COUNT(*) as total,
                        SUM(CASE WHEN in_ativo = 'S' THEN 1 ELSE 0 END) as ativos,
                        SUM(CASE WHEN in_ativo = 'N' THEN 1 ELSE 0 END) as inativos
                    FROM pje.tb_orgao_julgador
                `;

        const result2 = await pool2Grau.query(query2Grau);
        await pool2Grau.end();

        if (result2.rows.length > 0) {
          stats.segundoGrau = {
            total: parseInt(result2.rows[0].total),
            ativos: parseInt(result2.rows[0].ativos),
            inativos: parseInt(result2.rows[0].inativos)
          };
        }
      } catch (error) {
        console.error('⚠️ Erro ao obter estatísticas 2º grau:', error.message);
      }

      console.log('📊 Estatísticas obtidas:', stats);
      return stats;

    } catch (error) {
      console.error('❌ Erro ao obter estatísticas:', error.message);
      throw error;
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

module.exports = OJDatabaseService;