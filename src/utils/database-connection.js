// Módulo de conexão com banco de dados PostgreSQL
// Sistema de verificação inteligente de OJs já cadastrados

const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

// Tenta carregar o arquivo de configuração (opcional)
let config = { database1Grau: null, database2Grau: null };
try {
  config = require(path.resolve(__dirname, '../../database.config.js'));
} catch (error) {
  console.log('ℹ️ Arquivo database.config.js não encontrado. Usando credenciais dinâmicas.');
}

/**
 * Carrega credenciais salvas do arquivo database-credentials.json
 * @returns {Object|null} Credenciais salvas ou null se não existir
 */
function loadSavedCredentials() {
  try {
    const credentialsPath = path.resolve(__dirname, '../../database-credentials.json');
    if (fs.existsSync(credentialsPath)) {
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      console.log('✅ Credenciais do banco carregadas do arquivo database-credentials.json');

      // Forçar host como 127.0.0.1 para evitar problemas com IPv6
      if (credentials.host === 'localhost') {
        credentials.host = '127.0.0.1';
      }
      if (credentials.host1Grau === 'localhost') {
        credentials.host1Grau = '127.0.0.1';
      }
      if (credentials.host2Grau === 'localhost') {
        credentials.host2Grau = '127.0.0.1';
      }

      return credentials;
    }
  } catch (error) {
    console.warn('⚠️ Erro ao carregar credenciais salvas:', error.message);
  }
  return null;
}

class DatabaseConnection {
  constructor(credentials = null) {
    this.pool = null;
    this.isConnected = false;
    this.credentials = credentials;
    this.connectionConfig = credentials ? this.buildConnectionConfig(credentials, credentials.database1Grau || 'pje_1grau') : config.database1Grau;
    this.connectionConfig2Grau = credentials ? this.buildConnectionConfig(credentials, credentials.database2Grau || 'pje_2grau') : config.database2Grau;
  }

  /**
   * Normaliza nomes para comparação robusta (acento, espaços, traços, ordinais)
   */
  normalizeName(text) {
    if (!text) return '';
    const t = String(text)
      .normalize('NFD').replace(/\p{Diacritic}+/gu, '') // remover acentos
      .replace(/[–—−]/g, '-') // normalizar travessões para hífen
      .replace(/\b(\d+)ª\b/gi, '$1a') // 1ª -> 1a, 2ª -> 2a
      .replace(/\s+/g, ' ') // espaços múltiplos
      .trim()
      .toLowerCase();
    return t;
  }

  /**
   * Constrói configuração de conexão com credenciais fornecidas
   */
  buildConnectionConfig(credentials, database) {
    // Determinar o host baseado no banco de dados
    let host = credentials.host || 'localhost';
    
    // Se for banco de 1º grau e existe host específico
    if (database === (credentials.database1Grau || 'pje_1grau_bugfix') && credentials.host1Grau) {
      host = credentials.host1Grau;
    }
    // Se for banco de 2º grau e existe host específico
    else if (database === (credentials.database2Grau || 'pje_2grau_bugfix') && credentials.host2Grau) {
      host = credentials.host2Grau;
    }
    
    return {
      host,
      port: credentials.port || 5432,
      database,
      user: credentials.user,
      password: credentials.password,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      // Incluir múltiplos schemas no search_path para permitir acesso a trt15 e pje
      options: '-c search_path=trt15,pje,public',
    };
  }

  /**
   * Atualiza credenciais e reconecta
   */
  async updateCredentials(credentials) {
    this.credentials = credentials;
    this.connectionConfig = this.buildConnectionConfig(credentials, credentials.database1Grau || 'pje_1grau');
    this.connectionConfig2Grau = this.buildConnectionConfig(credentials, credentials.database2Grau || 'pje_2grau');
    
    // Fechar conexão atual se existir
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
    }
    
    // Reconectar com novas credenciais
    return await this.initialize();
  }

  /**
   * Inicializa a conexão com o banco de dados
   */
  async initialize() {
    try {
      // Se já temos um pool conectado, testar antes de recriar
      if (this.pool && this.isConnected) {
        try {
          const client = await this.pool.connect();
          await client.query('SELECT 1');
          client.release();
          return; // Pool está funcionando, não precisa recriar
        } catch (error) {
          console.log('Pool existente com problema, recriando...');
          await this.pool.end();
        }
      }

      this.pool = new Pool(this.connectionConfig);

      // Testar conexão e configurar search_path
      const client = await this.pool.connect();
      await client.query('SELECT 1');

      // Definir search_path explicitamente na sessão
      await client.query("SET search_path TO trt15, pje, public");

      // Verificar search_path configurado
      const searchPathResult = await client.query('SHOW search_path');
      console.log('🔍 Search path configurado:', searchPathResult.rows[0].search_path);

      client.release();

      this.isConnected = true;
      console.log('✅ Conexão com banco de dados estabelecida com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Erro ao conectar com banco de dados:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Verifica OJs já cadastrados para um servidor específico
   * @param {number} idUsuario - ID do usuário/servidor
   * @param {Array} ojsParaVerificar - Lista de OJs para verificar
   * @returns {Object} Resultado da verificação
   */
  async verificarOJsCadastrados(idUsuario, ojsParaVerificar = []) {
    if (!this.isConnected || !this.pool) {
      throw new Error('Banco de dados não conectado');
    }

    try {
      const client = await this.pool.connect();
      
      // Query otimizada para verificar OJs já cadastrados
      const query = `
        SELECT DISTINCT 
          ulm.id_orgao_julgador, 
          oj.ds_orgao_julgador, 
          ulv.dt_inicio, 
          ulv.dt_final,
          CASE 
            WHEN ulv.dt_final IS NULL OR ulv.dt_final > NOW() THEN true 
            ELSE false 
          END as ativo
        FROM pje.tb_usu_local_visibilidade ulv 
        JOIN pje.tb_usu_local_mgtdo_servdor ulm 
          ON ulv.id_usu_local_mgstrado_servidor = ulm.id_usu_local_mgstrado_servidor 
        JOIN pje.tb_orgao_julgador oj 
          ON ulm.id_orgao_julgador = oj.id_orgao_julgador 
        WHERE ulm.id_usu_local_mgstrado_servidor IN (
          SELECT id_usuario_localizacao 
          FROM pje.tb_usuario_localizacao 
          WHERE id_usuario = $1
        )
        ORDER BY ulv.dt_inicio DESC
      `;

      const result = await client.query(query, [idUsuario]);
      client.release();

      const ojsCadastrados = result.rows;
      const ojsAtivos = ojsCadastrados.filter(oj => oj.ativo);
      const ojsInativos = ojsCadastrados.filter(oj => !oj.ativo);

      // Mapear OJs para verificação
      const ojsParaProcessar = [];
      const ojsJaCadastrados = [];
      const ojsInativosEncontrados = [];

      console.log(`🔍 [DEBUG] BOTUCATU CASO - Verificando ${ojsParaVerificar.length} OJs:`);
      console.log('🔍 [DEBUG] BOTUCATU CASO - OJs para verificar:', ojsParaVerificar);
      console.log('🔍 [DEBUG] BOTUCATU CASO - OJs encontradas no BD:', ojsCadastrados.map(oj => oj.ds_orgao_julgador));

      for (const ojVerificar of ojsParaVerificar) {
        console.log(`🔍 [DEBUG] BOTUCATU CASO - Verificando: "${ojVerificar}"`);
        
        const ojEncontrado = ojsCadastrados.find(oj => {
          const nomeNormalizado = this.normalizeName(oj.ds_orgao_julgador);
          const ojVerificarNormalizado = this.normalizeName(ojVerificar);
          const match = nomeNormalizado === ojVerificarNormalizado;
          
          console.log('🔍 [DEBUG] BOTUCATU CASO - Comparando:');
          console.log(`   BD: "${nomeNormalizado}"`);
          console.log(`   Verificar: "${ojVerificarNormalizado}"`);
          console.log(`   Match: ${match}`);
          
          return match;
        });

        if (ojEncontrado) {
          console.log(`✅ [DEBUG] BOTUCATU CASO - OJ "${ojVerificar}" ENCONTRADA no BD`);
          if (ojEncontrado.ativo) {
            ojsJaCadastrados.push({
              nome: ojEncontrado.ds_orgao_julgador,
              idOrgaoJulgador: ojEncontrado.id_orgao_julgador,
              dataInicio: ojEncontrado.dt_inicio,
              status: 'ativo'
            });
            console.log('✅ [DEBUG] BOTUCATU CASO - Adicionada a JÁ CADASTRADOS (ativa)');
          } else {
            ojsInativosEncontrados.push({
              nome: ojEncontrado.ds_orgao_julgador,
              idOrgaoJulgador: ojEncontrado.id_orgao_julgador,
              dataInicio: ojEncontrado.dt_inicio,
              dataFinal: ojEncontrado.dt_final,
              status: 'inativo'
            });
            console.log('⚠️ [DEBUG] BOTUCATU CASO - Adicionada a INATIVOS');
          }
        } else {
          console.log(`🔄 [DEBUG] BOTUCATU CASO - OJ "${ojVerificar}" NÃO ENCONTRADA no BD`);
          ojsParaProcessar.push(ojVerificar);
          console.log('🔄 [DEBUG] BOTUCATU CASO - Adicionada a PARA PROCESSAR');
        }
      }

      console.log('🔍 [DEBUG] BOTUCATU CASO - RESULTADO FINAL:');
      console.log(`   JÁ CADASTRADOS: ${ojsJaCadastrados.length}`, ojsJaCadastrados.map(oj => oj.nome));
      console.log(`   PARA PROCESSAR: ${ojsParaProcessar.length}`, ojsParaProcessar);
      console.log(`   INATIVOS: ${ojsInativosEncontrados.length}`, ojsInativosEncontrados.map(oj => oj.nome));

      return {
        totalVerificados: ojsParaVerificar.length,
        ojsJaCadastrados,
        ojsInativos: ojsInativosEncontrados,
        ojsParaProcessar,
        estatisticas: {
          totalCadastrados: ojsCadastrados.length,
          totalAtivos: ojsAtivos.length,
          totalInativos: ojsInativos.length,
          paraProcessar: ojsParaProcessar.length,
          jaCadastrados: ojsJaCadastrados.length,
          economiaEstimada: ojsJaCadastrados.length * 5 // 5 segundos por OJ economizado
        }
      };

    } catch (error) {
      console.error('❌ Erro ao verificar OJs cadastrados:', error.message);
      throw error;
    }
  }

  /**
   * Busca servidor por CPF
   * @param {string} cpf - CPF do servidor (com ou sem formatação)
   * @returns {Object} Informações do servidor
   */
  async buscarServidorPorCPF(cpf) {
    if (!this.isConnected || !this.pool) {
      throw new Error('Banco de dados não conectado');
    }

    try {
      const client = await this.pool.connect();
      
      // Limpar CPF (remover formatação) para comparar com ds_login (pode conter máscara)
      const cpfLimpo = cpf.replace(/\D/g, '');
      
      const query = `
        SELECT 
          ulz.id_usuario,
          ulz.id_usuario_localizacao,
          log.ds_login,
          COUNT(ulm.id_orgao_julgador) as total_ojs_cadastrados
        FROM pje.tb_usuario_localizacao ulz
        JOIN pje.tb_usuario u ON ulz.id_usuario = u.id_usuario
        JOIN pje.tb_usuario_login log ON log.id_usuario = u.id_usuario
        LEFT JOIN pje.tb_usu_local_mgtdo_servdor ulm 
          ON ulz.id_usuario_localizacao = ulm.id_usu_local_mgstrado_servidor
        WHERE regexp_replace(log.ds_login, '[^0-9]', '', 'g') = $1
        GROUP BY ulz.id_usuario, ulz.id_usuario_localizacao, log.ds_login
      `;

      const result = await client.query(query, [cpfLimpo]);
      client.release();

      if (result.rows.length === 0) {
        return {
          existe: false,
          servidor: null
        };
      }

      const dsLogin = result.rows[0].ds_login || '';
      const cpfLimpoRetornado = dsLogin.replace(/\D/g, '');
      return {
        existe: true,
        servidor: {
          idUsuario: result.rows[0].id_usuario,
          idUsuarioLocalizacao: result.rows[0].id_usuario_localizacao,
          cpf: cpfLimpoRetornado || dsLogin,
          totalOjsCadastrados: parseInt(result.rows[0].total_ojs_cadastrados)
        }
      };

    } catch (error) {
      console.error('❌ Erro ao buscar servidor por CPF:', error.message);
      throw error;
    }
  }

  /**
   * Verifica se um servidor específico existe no sistema
   * @param {number} idUsuario - ID do usuário/servidor
   * @returns {Object} Informações do servidor
   */
  async verificarServidor(idUsuario) {
    if (!this.isConnected || !this.pool) {
      throw new Error('Banco de dados não conectado');
    }

    try {
      const client = await this.pool.connect();
      
      const query = `
        SELECT 
          ulz.id_usuario,
          ulz.id_usuario_localizacao,
          log.ds_login,
          COUNT(ulm.id_orgao_julgador) as total_ojs_cadastrados
        FROM pje.tb_usuario_localizacao ulz
        JOIN pje.tb_usuario u ON ulz.id_usuario = u.id_usuario
        JOIN pje.tb_usuario_login log ON log.id_usuario = u.id_usuario
        LEFT JOIN pje.tb_usu_local_mgtdo_servdor ulm 
          ON ulz.id_usuario_localizacao = ulm.id_usu_local_mgstrado_servidor
        WHERE ulz.id_usuario = $1
        GROUP BY ulz.id_usuario, ulz.id_usuario_localizacao, log.ds_login
      `;

      const result = await client.query(query, [idUsuario]);
      client.release();

      if (result.rows.length === 0) {
        return {
          existe: false,
          servidor: null
        };
      }

      const dsLogin = result.rows[0].ds_login || '';
      const cpfLimpoRetornado = dsLogin.replace(/\D/g, '');
      return {
        existe: true,
        servidor: {
          idUsuario: result.rows[0].id_usuario,
          idUsuarioLocalizacao: result.rows[0].id_usuario_localizacao,
          cpf: cpfLimpoRetornado || dsLogin,
          totalOjsCadastrados: parseInt(result.rows[0].total_ojs_cadastrados)
        }
      };

    } catch (error) {
      console.error('❌ Erro ao verificar servidor:', error.message);
      throw error;
    }
  }

  /**
   * Busca OJs por nome (para normalização)
   * @param {string} nomeOJ - Nome do órgão julgador
   * @returns {Array} Lista de OJs encontrados
   */
  async buscarOJsPorNome(nomeOJ) {
    if (!this.isConnected || !this.pool) {
      throw new Error('Banco de dados não conectado');
    }

    try {
      const client = await this.pool.connect();
      
      const query = `
        SELECT 
          id_orgao_julgador,
          ds_orgao_julgador,
          sg_orgao_julgador
        FROM pje.tb_orgao_julgador 
        WHERE LOWER(ds_orgao_julgador) LIKE LOWER($1)
        ORDER BY ds_orgao_julgador
        LIMIT 10
      `;

      const result = await client.query(query, [`%${nomeOJ}%`]);
      client.release();

      return result.rows;

    } catch (error) {
      console.error('❌ Erro ao buscar OJs por nome:', error.message);
      throw error;
    }
  }

  /**
   * Buscar órgãos julgadores por grau
   * @param {string} grau - '1' para 1º grau, '2' para 2º grau
   * @returns {Array} Lista de órgãos julgadores com nome e código
   */
  async buscarOrgaosJulgadores(grau) {
    try {
      let dbConfig;
      try {
        const loadedConfig = require('../../database.config.js');
        dbConfig = grau === '1' ? loadedConfig.database1Grau : loadedConfig.database2Grau;
      } catch (error) {
        throw new Error('Configuração de banco de dados não disponível');
      }

      const { Pool } = require('pg');
      const specificPool = new Pool(dbConfig);
      
      const query = `
        SELECT DISTINCT 
          oj.nom_orgao_julgador as nome,
          oj.cod_orgao_julgador as codigo
        FROM tb_orgao_julgador oj
        WHERE oj.nom_orgao_julgador IS NOT NULL 
          AND oj.cod_orgao_julgador IS NOT NULL
        ORDER BY oj.nom_orgao_julgador
      `;

      console.log(`🔍 Executando query para OJs ${grau}º grau`);
      
      const result = await specificPool.query(query);
      await specificPool.end();
      
      console.log(`✅ Encontrados ${result.rows.length} órgãos julgadores ${grau}º grau`);
      return result.rows;
      
    } catch (error) {
      console.error(`❌ Erro ao buscar órgãos julgadores ${grau}º grau:`, error);
      return [];
    }
  }

  /**
   * Buscar servidores por grau com filtros
   * @param {string} grau - '1' para 1º grau, '2' para 2º grau
   * @param {string} filtroNome - Filtro opcional por nome
   * @param {string} filtroPerfil - Filtro opcional por perfil/papel
   * @returns {Array} Lista de servidores
   */
  async buscarServidores(grau, filtroNome = '', filtroPerfil = '') {
    try {
      let dbConfig;
      try {
        const loadedConfig = require('../../database.config.js');
        dbConfig = grau === '1' ? loadedConfig.database1Grau : loadedConfig.database2Grau;
      } catch (error) {
        throw new Error('Configuração de banco de dados não disponível');
      }

      const { Pool } = require('pg');
      const specificPool = new Pool(dbConfig);

      let query = `
        SELECT DISTINCT
          COALESCE(ul.ds_nome, ul.ds_login) as nome,
          COALESCE(ul.ds_login, '') as cpf,
          CASE
            WHEN ps.id IS NOT NULL THEN 'Servidor'
            WHEN pm.id IS NOT NULL THEN 'Magistrado'
            WHEN pa.id IS NOT NULL THEN 'Advogado'
            WHEN pp.id IS NOT NULL THEN 'Procurador'
            WHEN po.id IS NOT NULL THEN 'Oficial de Justiça'
            WHEN pt.id IS NOT NULL THEN 'Perito'
            ELSE 'Usuário'
          END as perfil,
          COALESCE(oj.ds_orgao_julgador, 'Não informado') as orgao,
          COALESCE(p.ds_nome, 'Não informado') as papel_orgao,
          ulv.dt_inicio,
          ulv.dt_final,
          u.id_usuario
        FROM pje.tb_usuario u
        LEFT JOIN pje.tb_usuario_login ul ON u.id_usuario = ul.id_usuario
        LEFT JOIN pje.tb_pessoa_servidor ps ON ul.id_usuario = ps.id
        LEFT JOIN pje.tb_pessoa_magistrado pm ON ul.id_usuario = pm.id
        LEFT JOIN pje.tb_pessoa_advogado pa ON ul.id_usuario = pa.id
        LEFT JOIN pje.tb_pessoa_procurador pp ON ul.id_usuario = pp.id
        LEFT JOIN pje.tb_pessoa_oficial_justica po ON ul.id_usuario = po.id
        LEFT JOIN pje.tb_pessoa_perito pt ON ul.id_usuario = pt.id
        LEFT JOIN pje.tb_usuario_localizacao ulz ON u.id_usuario = ulz.id_usuario
        LEFT JOIN pje.tb_usu_local_mgtdo_servdor ulm ON ulz.id_usuario_localizacao = ulm.id_usu_local_mgstrado_servidor
        LEFT JOIN pje.tb_usu_local_visibilidade ulv ON ulm.id_usu_local_mgstrado_servidor = ulv.id_usu_local_mgstrado_servidor
        LEFT JOIN pje.tb_orgao_julgador oj ON ulm.id_orgao_julgador = oj.id_orgao_julgador
        LEFT JOIN pje.tb_papel p ON ulz.id_papel = p.id_papel
        WHERE u.id_usuario IS NOT NULL
          AND ul.ds_nome IS NOT NULL
          AND ul.ds_nome != ''
          AND ulm.id_usu_local_mgstrado_servidor IS NOT NULL
      `;

      const params = [];
      let paramIndex = 1;

      // Filtro por nome/CPF
      if (filtroNome && filtroNome.trim() !== '') {
        const filtroLimpo = filtroNome.trim();
        // Se contém apenas números, busca no CPF/login
        if (/^\d+$/.test(filtroLimpo.replace(/\D/g, '')) && filtroLimpo.replace(/\D/g, '').length >= 3) {
          query += ` AND regexp_replace(COALESCE(ul.ds_login, ''), '[^0-9]', '', 'g') LIKE $${paramIndex}`;
          params.push(`%${filtroLimpo.replace(/\D/g, '')}%`);
        } else {
          // Se não for só números, busca no nome
          query += ` AND UPPER(ul.ds_nome) LIKE UPPER($${paramIndex})`;
          params.push(`%${filtroLimpo}%`);
        }
        paramIndex++;
      }

      // Filtro por perfil (mantido para compatibilidade)
      if (filtroPerfil && filtroPerfil.trim() !== '') {
        query += ` AND (
          (UPPER($${paramIndex}) LIKE UPPER('%servidor%') AND ps.id IS NOT NULL) OR
          (UPPER($${paramIndex}) LIKE UPPER('%magistrado%') AND pm.id IS NOT NULL) OR
          (UPPER($${paramIndex}) LIKE UPPER('%advogado%') AND pa.id IS NOT NULL) OR
          (UPPER($${paramIndex}) LIKE UPPER('%procurador%') AND pp.id IS NOT NULL) OR
          (UPPER($${paramIndex}) LIKE UPPER('%oficial%') AND po.id IS NOT NULL) OR
          (UPPER($${paramIndex}) LIKE UPPER('%perito%') AND pt.id IS NOT NULL)
        )`;
        params.push(filtroPerfil.trim());
        paramIndex++;
      }

      query += ' ORDER BY ulv.dt_inicio DESC, nome';

      console.log(`🔍 Executando query para servidores ${grau}º grau`);
      console.log('Query:', query);
      console.log('Params:', params);

      const result = await specificPool.query(query, params);
      await specificPool.end();

      console.log(`✅ Encontrados ${result.rows.length} servidores ${grau}º grau`);
      return result.rows;

    } catch (error) {
      console.error(`❌ Erro ao buscar servidores ${grau}º grau:`, error);
      return [];
    }
  }

  /**
   * Fecha a conexão com o banco
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
      console.log('🔌 Conexão com banco de dados fechada');
    }
  }

  /**
   * Verifica se a conexão está ativa
   */
  async isHealthy() {
    if (!this.pool || !this.isConnected) {
      return false;
    }

    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      this.isConnected = false;
      return false;
    }
  }
}

module.exports = DatabaseConnection;
module.exports.loadSavedCredentials = loadSavedCredentials;
