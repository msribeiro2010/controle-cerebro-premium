/**
 * Serviço de consultas de Processo (Histórico, Tarefa Atual e Partes)
 * Usa conexões dos bancos do 1º e 2º graus conforme seleção
 */

const DatabaseConnection = require('./database-connection');
const { loadSavedCredentials } = require('./database-connection');

class ProcessDatabaseService {
  constructor() {
    // Carregar credenciais salvas se existirem
    const savedCredentials = loadSavedCredentials();
    this.dbConnection = new DatabaseConnection(savedCredentials); // 1º grau por padrão
    this.pg = require('pg');
  }

  /**
   * Retorna um client conectado para o grau selecionado
   * @param {'1'|'2'} grau
   */
  async getClientForGrau(grau) {
    if (grau === '1') {
      // Garantir conexão inicializada
      await this.dbConnection.initialize();
      return this.dbConnection.pool.connect();
    } else {
      // Criar pool específico do 2º grau on-demand
      let config = null;
      try {
        config = require('../../database.config.js').database2Grau;
      } catch (error) {
        throw new Error('Configuração de banco de dados não disponível');
      }

      const pool2 = new this.pg.Pool(config);
      // Atenção: chamador deve liberar client e encerrar pool
      const client = await pool2.connect();
      // Acoplar referência do pool ao client para encerramento após uso
      client.__tmpPool = pool2;
      return client;
    }
  }

  /**
   * Retorna nome qualificado da primeira tabela existente dentre candidatos
   */
  async getFirstExistingTable(client, candidates = []) {
    for (const fqName of candidates) {
      const [schema, table] = fqName.split('.');
      try {
        const res = await client.query(
          'SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2 LIMIT 1',
          [schema, table]
        );
        if (res.rowCount > 0) return fqName;
      } catch (_) {}
    }
    return null;
  }

  /**
   * Consulta o histórico (trilha de tarefas) do processo
   * @param {string} numeroProcesso
   * @param {'1'|'2'} grau
   */
  async buscarHistoricoProcesso(numeroProcesso, grau = '1') {
    const client = await this.getClientForGrau(grau);
    try {
      // Verificar se as tabelas jbpm existem
      const checkTablesQuery = `
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_name IN ('jbpm_token', 'jbpm_processinstance', 'jbpm_taskinstance')
      `;

      const checkResult = await client.query(checkTablesQuery);
      const tablesExist = parseInt(checkResult.rows[0].count) >= 3;

      if (!tablesExist) {
        console.log('⚠️ Tabelas JBPM não encontradas no banco. Retornando histórico vazio.');
        return [];
      }

      const query = `
        SELECT
          tb_processo.nr_processo AS "numero_processo",
          jbpm_processdefinition.name_ AS "fluxo",
          jbpm_task.name_ AS "tarefa",
          taskinstance.id_ AS "task_instance",
          token.id_ AS "token",
          processinstance.id_ AS "process_instance",
          taskinstance.create_ AS "data_criacao",
          taskinstance.start_ AS "data_abertura",
          taskinstance.end_ AS "data_saida"
        FROM
          jbpm_token token,
          jbpm_processinstance processinstance,
          jbpm_taskinstance taskinstance,
          jbpm_task,
          jbpm_processdefinition,
          tb_processo,
          tb_processo_instance
        WHERE
          token.processinstance_ = processinstance.id_
          AND processinstance.processdefinition_ = jbpm_processdefinition.id_
          AND taskinstance.token_ = token.id_
          AND jbpm_task.id_ = taskinstance.task_
          AND tb_processo_instance.id_processo = tb_processo.id_processo
          AND tb_processo_instance.id_proc_inst = processinstance.id_
          AND tb_processo.nr_processo ILIKE $1
        ORDER BY taskinstance.id_ ASC
      `;

      const params = [numeroProcesso];
      const result = await client.query(query, params);
      return result.rows || [];
    } catch (error) {
      console.error('❌ Erro ao buscar histórico do processo:', error.message);
      // Retornar array vazio em vez de lançar erro
      console.log('⚠️ Retornando histórico vazio devido a erro');
      return [];
    } finally {
      client.release();
      if (client.__tmpPool) await client.__tmpPool.end();
    }
  }

  /**
   * Consulta a(s) tarefa(s) atual(is) do processo (abertas)
   * @param {string} numeroProcesso
   * @param {'1'|'2'} grau
   */
  async buscarTarefaAtual(numeroProcesso, grau = '1') {
    const client = await this.getClientForGrau(grau);
    try {
      // Descobrir tabela de colegiado disponível (ou nenhuma)
      const colegiadoQualified = await this.getFirstExistingTable(client, [
        'pje.tb_orgao_julgador_colegiado',
        'public.tb_orgao_julgador_colegiado',
        'pje.tb_orgao_julgador_colgiado',
        'public.tb_orgao_julgador_colgiado'
      ]);

      const selectColeg = colegiadoQualified
        ? 'ojc.ds_orgao_julgador_colegiado'
        : 'NULL::text as ds_orgao_julgador_colegiado';
      const joinColeg = colegiadoQualified
        ? `LEFT JOIN ${colegiadoQualified} ojc ON ojc.id_orgao_julgador_colegiado = ptrf.id_orgao_julgador_colegiado`
        : '';
      const groupByColeg = colegiadoQualified ? ', ojc.ds_orgao_julgador_colegiado' : '';

      const query = `
        SELECT
          ti.name_ AS nome_tarefa,
          ti.actorid_ AS login_usuario,
          oj.ds_orgao_julgador,
          ${selectColeg},
          MAX(pr.nr_processo) AS nr_processo,
          COUNT(*)
        FROM jbpm_variableinstance vi
        JOIN jbpm_taskinstance ti ON ti.procinst_ = vi.processinstance_
        JOIN tb_processo_instance procxins ON procxins.id_proc_inst = ti.procinst_
        JOIN tb_processo pr ON pr.id_processo = procxins.id_processo
        JOIN tb_processo_trf ptrf ON ptrf.id_processo_trf = pr.id_processo
        JOIN tb_orgao_julgador oj ON oj.id_orgao_julgador = ptrf.id_orgao_julgador
        ${joinColeg}
        WHERE ti.end_ IS NULL AND ti.isopen_ = 'true'
          AND vi.name_ = 'processo'
          AND pr.nr_processo ILIKE $1
        GROUP BY ti.name_, ti.actorid_, oj.ds_orgao_julgador${groupByColeg}
        ORDER BY COUNT(*)
      `;
      const params = [numeroProcesso];
      const result = await client.query(query, params);
      return result.rows || [];
    } finally {
      client.release();
      if (client.__tmpPool) await client.__tmpPool.end();
    }
  }

  /**
   * Lista as partes do processo
   * @param {string} numeroProcesso
   * @param {'1'|'2'} grau
   */
  async buscarPartesProcesso(numeroProcesso, grau = '1') {
    const client = await this.getClientForGrau(grau);
    try {
      const query = `
        SELECT 
          pp.id_processo_parte,
          pp.id_pessoa,
          pp.id_tipo_parte,
          pp.in_participacao,
          pp.in_parte_principal,
          pp.in_situacao,
          ul.ds_nome,
          ul.ds_login
        FROM tb_processo_parte AS pp
        INNER JOIN tb_usuario_login AS ul 
          ON pp.id_pessoa = ul.id_usuario
        WHERE pp.id_processo_trf = (
          SELECT id_processo
          FROM tb_processo
          WHERE nr_processo ILIKE $1
        )
        ORDER BY pp.in_participacao, pp.in_situacao
      `;
      const params = [`%${numeroProcesso}%`];
      const result = await client.query(query, params);
      return result.rows || [];
    } finally {
      client.release();
      if (client.__tmpPool) await client.__tmpPool.end();
    }
  }
}

module.exports = ProcessDatabaseService;
