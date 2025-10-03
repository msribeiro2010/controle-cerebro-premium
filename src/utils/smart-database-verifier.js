// Sistema inteligente de verificação de banco de dados
// Integra verificação prévia de OJs já cadastrados para otimização

const DatabaseConnection = require('./database-connection');
const DatabaseCache = require('./database-cache');

class SmartDatabaseVerifier {
  constructor(credentials = null) {
    this.dbConnection = new DatabaseConnection(credentials);
    this.cache = new DatabaseCache();
    this.isInitialized = false;
    this.credentials = credentials;
    this.stats = {
      totalVerificacoes: 0,
      ojsPulados: 0,
      ojsProcessados: 0,
      tempoEconomizado: 0,
      errosConexao: 0
    };
  }

  /**
   * Atualiza credenciais do banco
   */
  async updateCredentials(credentials) {
    this.credentials = credentials;
    this.dbConnection = new DatabaseConnection(credentials);
    this.isInitialized = false;
    return await this.initialize();
  }

  /**
   * Inicializa o sistema de verificação
   */
  async initialize() {
    try {
      console.log('🔌 Inicializando sistema de verificação de banco...');
      
      const connected = await this.dbConnection.initialize();
      if (!connected) {
        console.warn('⚠️ Falha na conexão com banco - sistema funcionará sem verificação prévia');
        return false;
      }

      this.isInitialized = true;
      console.log('✅ Sistema de verificação de banco inicializado com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Erro ao inicializar verificação de banco:', error.message);
      this.stats.errosConexao++;
      return false;
    }
  }

  /**
   * Verifica OJs já cadastrados para um servidor
   * @param {number} idUsuario - ID do usuário/servidor
   * @param {Array} ojsParaVerificar - Lista de OJs para verificar
   * @returns {Object} Resultado da verificação
   */
  async verificarOJsServidor(idUsuario, ojsParaVerificar) {
    if (!this.isInitialized) {
      console.warn('⚠️ Sistema de banco não inicializado - retornando todos OJs para processamento');
      return {
        ojsParaProcessar: ojsParaVerificar,
        ojsJaCadastrados: [],
        ojsInativos: [],
        estatisticas: {
          totalVerificados: ojsParaVerificar.length,
          jaCadastrados: 0,
          paraProcessar: ojsParaVerificar.length,
          economiaEstimada: 0
        }
      };
    }

    try {
      // Verificar cache primeiro
      const cachedResult = this.cache.getOJsVerification(idUsuario, ojsParaVerificar);
      if (cachedResult) {
        console.log('📋 Resultado obtido do cache de banco');
        return cachedResult;
      }

      console.log(`🔍 Verificando ${ojsParaVerificar.length} OJs no banco para usuário ${idUsuario}...`);
      
      const result = await this.dbConnection.verificarOJsCadastrados(idUsuario, ojsParaVerificar);
      
      // Armazenar no cache
      this.cache.setOJsVerification(idUsuario, ojsParaVerificar, result);
      
      // Atualizar estatísticas
      this.stats.totalVerificacoes++;
      this.stats.ojsPulados += result.estatisticas.jaCadastrados;
      this.stats.ojsProcessados += result.estatisticas.paraProcessar;
      this.stats.tempoEconomizado += result.estatisticas.economiaEstimada;

      console.log(`✅ Verificação concluída: ${result.estatisticas.jaCadastrados} já cadastrados, ${result.estatisticas.paraProcessar} para processar`);
      console.log(`⏱️ Tempo economizado estimado: ${result.estatisticas.economiaEstimada}s`);

      return result;

    } catch (error) {
      console.error('❌ Erro na verificação de OJs:', error.message);
      this.stats.errosConexao++;
      
      // Em caso de erro, retornar todos OJs para processamento
      return {
        ojsParaProcessar: ojsParaVerificar,
        ojsJaCadastrados: [],
        ojsInativos: [],
        estatisticas: {
          totalVerificados: ojsParaVerificar.length,
          jaCadastrados: 0,
          paraProcessar: ojsParaVerificar.length,
          economiaEstimada: 0
        }
      };
    }
  }

  /**
   * Verifica OJs já cadastrados para um servidor por CPF
   * @param {string} cpf - CPF do servidor
   * @param {Array} ojsParaVerificar - Lista de OJs para verificar
   * @returns {Object} Resultado da verificação
   */
  async verificarOJsServidorPorCPF(cpf, ojsParaVerificar = []) {
    if (!this.isInitialized) {
      console.warn('⚠️ Sistema de banco não inicializado - retornando todos OJs para processamento');
      return {
        ojsParaProcessar: ojsParaVerificar,
        ojsJaCadastrados: [],
        ojsInativos: [],
        estatisticas: {
          totalVerificados: ojsParaVerificar.length,
          jaCadastrados: 0,
          paraProcessar: ojsParaVerificar.length,
          economiaEstimada: 0
        }
      };
    }

    try {
      // Verificar cache primeiro
      const cachedResult = this.cache.getOJsVerification(cpf, ojsParaVerificar);
      if (cachedResult) {
        console.log('📋 Resultado obtido do cache de banco');
        return cachedResult;
      }

      console.log(`🔍 Verificando ${ojsParaVerificar.length} OJs no banco para CPF ${cpf}...`);
      
      // 1. Buscar servidor por CPF
      const servidorInfo = await this.dbConnection.buscarServidorPorCPF(cpf);
      
      if (!servidorInfo.existe) {
        console.log(`⚠️ Servidor com CPF ${cpf} não encontrado no banco`);
        return {
          ojsParaProcessar: ojsParaVerificar,
          ojsJaCadastrados: [],
          ojsInativos: [],
          estatisticas: {
            totalVerificados: ojsParaVerificar.length,
            jaCadastrados: 0,
            paraProcessar: ojsParaVerificar.length,
            economiaEstimada: 0
          }
        };
      }

      console.log(`✅ Servidor encontrado: ID ${servidorInfo.servidor.idUsuario}, CPF ${servidorInfo.servidor.cpf}`);
      
      // 2. Verificar OJs já cadastrados
      const result = await this.dbConnection.verificarOJsCadastrados(servidorInfo.servidor.idUsuario, ojsParaVerificar);
      
      // Armazenar no cache
      this.cache.setOJsVerification(cpf, ojsParaVerificar, result);
      
      // Atualizar estatísticas
      this.stats.totalVerificacoes++;
      this.stats.ojsPulados += result.estatisticas.jaCadastrados;
      this.stats.ojsProcessados += result.estatisticas.paraProcessar;
      this.stats.tempoEconomizado += result.estatisticas.economiaEstimada;

      console.log(`✅ Verificação concluída: ${result.estatisticas.jaCadastrados} já cadastrados, ${result.estatisticas.paraProcessar} para processar`);
      console.log(`⏱️ Tempo economizado estimado: ${result.estatisticas.economiaEstimada}s`);

      return result;

    } catch (error) {
      console.error('❌ Erro na verificação de OJs:', error.message);
      this.stats.errosConexao++;
      
      // Em caso de erro, retornar todos OJs para processamento
      return {
        ojsParaProcessar: ojsParaVerificar,
        ojsJaCadastrados: [],
        ojsInativos: [],
        estatisticas: {
          totalVerificados: ojsParaVerificar.length,
          jaCadastrados: 0,
          paraProcessar: ojsParaVerificar.length,
          economiaEstimada: 0
        }
      };
    }
  }

  /**
   * Verifica se um servidor existe no sistema
   * @param {number} idUsuario - ID do usuário/servidor
   * @returns {Object} Informações do servidor
   */
  async verificarServidor(idUsuario) {
    if (!this.isInitialized) {
      return { existe: false, servidor: null };
    }

    try {
      // Verificar cache primeiro
      const cachedResult = this.cache.getServidorVerification(idUsuario);
      if (cachedResult) {
        return cachedResult;
      }

      const result = await this.dbConnection.verificarServidor(idUsuario);
      
      // Armazenar no cache
      this.cache.setServidorVerification(idUsuario, result);
      
      return result;

    } catch (error) {
      console.error('❌ Erro ao verificar servidor:', error.message);
      this.stats.errosConexao++;
      return { existe: false, servidor: null };
    }
  }

  /**
   * Normaliza nome de OJ para busca no banco
   * @param {string} nomeOJ - Nome do órgão julgador
   * @returns {Array} OJs encontrados
   */
  async normalizarOJ(nomeOJ) {
    if (!this.isInitialized) {
      return [];
    }

    try {
      const ojsEncontrados = await this.dbConnection.buscarOJsPorNome(nomeOJ);
      return ojsEncontrados;
    } catch (error) {
      console.error('❌ Erro ao normalizar OJ:', error.message);
      return [];
    }
  }

  /**
   * Processa lista de servidores com verificação inteligente
   * @param {Array} servidores - Lista de servidores para processar
   * @returns {Object} Resultado do processamento
   */
  async processarServidoresComVerificacao(servidores) {
    const resultado = {
      servidoresProcessados: 0,
      servidoresPulados: 0,
      totalOjsVerificados: 0,
      totalOjsPulados: 0,
      totalOjsParaProcessar: 0,
      tempoEconomizadoTotal: 0,
      detalhes: []
    };

    for (const servidor of servidores) {
      try {
        console.log(`\n🔍 Processando servidor: ${servidor.nome || servidor.cpf}`);
        
        // Verificar se servidor existe no banco
        // Preferir CPF quando idUsuario não estiver informado
        let servidorInfo;
        if (servidor && servidor.idUsuario) {
          servidorInfo = await this.verificarServidor(servidor.idUsuario);
        } else if (servidor && servidor.cpf) {
          const byCpf = await this.dbConnection.buscarServidorPorCPF(servidor.cpf);
          servidorInfo = {
            existe: byCpf.existe,
            servidor: byCpf.servidor ? {
              idUsuario: byCpf.servidor.idUsuario,
              idUsuarioLocalizacao: byCpf.servidor.idUsuarioLocalizacao,
              cpf: byCpf.servidor.cpf,
              totalOjsCadastrados: byCpf.servidor.totalOjsCadastrados
            } : null
          };
        } else {
          servidorInfo = { existe: false, servidor: null };
        }
        
        if (!servidorInfo.existe) {
          console.log(`⚠️ Servidor ${servidor.nome || servidor.cpf} não encontrado no banco - processando normalmente`);
          resultado.servidoresProcessados++;
          resultado.detalhes.push({
            servidor: servidor.nome || servidor.cpf,
            status: 'nao_encontrado_banco',
            ojsParaProcessar: servidor.orgaos || [],
            ojsPulados: 0
          });
          continue;
        }

        // Verificar OJs já cadastrados
        const usuarioIdParaVerificar = servidorInfo?.servidor?.idUsuario || servidor.idUsuario;
        const verificacaoOJs = await this.verificarOJsServidor(
          usuarioIdParaVerificar,
          servidor.orgaos || []
        );

        resultado.totalOjsVerificados += verificacaoOJs.estatisticas.totalVerificados;
        resultado.totalOjsPulados += verificacaoOJs.estatisticas.jaCadastrados;
        resultado.totalOjsParaProcessar += verificacaoOJs.estatisticas.paraProcessar;
        resultado.tempoEconomizadoTotal += verificacaoOJs.estatisticas.economiaEstimada;

        // Determinar status do servidor
        let status = 'processar';
        if (verificacaoOJs.estatisticas.paraProcessar === 0) {
          status = 'completo';
          resultado.servidoresPulados++;
        } else {
          resultado.servidoresProcessados++;
        }

        resultado.detalhes.push({
          servidor: servidor.nome || servidor.cpf,
          idUsuario: servidor.idUsuario,
          status,
          ojsParaProcessar: verificacaoOJs.ojsParaProcessar,
          ojsJaCadastrados: verificacaoOJs.ojsJaCadastrados,
          ojsInativos: verificacaoOJs.ojsInativos,
          tempoEconomizado: verificacaoOJs.estatisticas.economiaEstimada
        });

        console.log(`📊 Servidor ${servidor.nome || servidor.cpf}: ${verificacaoOJs.estatisticas.paraProcessar} OJs para processar, ${verificacaoOJs.estatisticas.jaCadastrados} já cadastrados`);

      } catch (error) {
        console.error(`❌ Erro ao processar servidor ${servidor.nome || servidor.cpf}:`, error.message);
        resultado.servidoresProcessados++;
        resultado.detalhes.push({
          servidor: servidor.nome || servidor.cpf,
          status: 'erro',
          erro: error.message,
          ojsParaProcessar: servidor.orgaos || [],
          ojsPulados: 0
        });
      }
    }

    return resultado;
  }

  /**
   * Gera relatório de otimização
   * @returns {Object} Relatório detalhado
   */
  gerarRelatorioOtimizacao() {
    const cacheStats = this.cache.getStats();
    
    return {
      sistema: {
        inicializado: this.isInitialized,
        totalVerificacoes: this.stats.totalVerificacoes,
        ojsPulados: this.stats.ojsPulados,
        ojsProcessados: this.stats.ojsProcessados,
        tempoEconomizado: this.stats.tempoEconomizado,
        errosConexao: this.stats.errosConexao
      },
      cache: cacheStats,
      eficiencia: {
        taxaPulados: this.stats.totalVerificacoes > 0 
          ? (this.stats.ojsPulados / (this.stats.ojsPulados + this.stats.ojsProcessados) * 100).toFixed(2) + '%'
          : '0%',
        tempoEconomizadoMinutos: Math.round(this.stats.tempoEconomizado / 60),
        economiaPorVerificacao: this.stats.totalVerificacoes > 0 
          ? Math.round(this.stats.tempoEconomizado / this.stats.totalVerificacoes)
          : 0
      }
    };
  }

  /**
   * Limpa cache de um usuário específico
   * @param {number} idUsuario - ID do usuário
   */
  invalidarCacheUsuario(idUsuario) {
    this.cache.invalidateUserCache(idUsuario);
    console.log(`🗑️ Cache invalidado para usuário ${idUsuario}`);
  }

  /**
   * Fecha conexões e limpa recursos
   */
  async cleanup() {
    try {
      if (this.dbConnection) {
        await this.dbConnection.close();
      }
      this.cache.clear();
      console.log('🧹 Recursos de verificação de banco limpos');
    } catch (error) {
      console.error('❌ Erro ao limpar recursos:', error.message);
    }
  }
}

module.exports = SmartDatabaseVerifier;
