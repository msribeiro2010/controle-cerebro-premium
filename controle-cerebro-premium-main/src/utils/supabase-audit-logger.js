/**
 * Supabase Audit Logger
 *
 * Sistema de auditoria assíncrona para gravar logs de queries SQL
 * executadas no sistema. Não bloqueia operações principais.
 *
 * Features:
 * - Gravação assíncrona (fire-and-forget)
 * - Fallback silencioso se Supabase estiver offline
 * - Batch upload para otimização
 * - Estatísticas automáticas (tempo de execução, sucesso/erro)
 * - Filtragem de queries sensíveis (passwords, etc.)
 */

const { createClient } = require('@supabase/supabase-js');

class SupabaseAuditLogger {
  constructor() {
    // Configurações do Supabase - pode ser desabilitado configurando DISABLE_AUDIT_LOGS=true
    this.supabaseUrl = process.env.SUPABASE_URL || 'https://zpufcvesenbhtmizmjiz.supabase.co';
    this.supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwdWZjdmVzZW5iaHRtaXptaml6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MDY5ODMsImV4cCI6MjA2NTA4Mjk4M30.aD0E3fkuTjaYnHRdWpYjCk_hPK-sKhVT2VdIfXy3Hy8';

    this.client = null;
    // Desabilita auditoria se variável de ambiente estiver configurada
    this.isEnabled = process.env.DISABLE_AUDIT_LOGS !== 'true';
    this.buffer = [];
    this.maxBufferSize = 50; // Envia quando atingir 50 logs
    this.flushInterval = 30000; // Envia a cada 30 segundos
    this.lastFlush = Date.now();

    if (this.isEnabled) {
      this._initialize();
    } else {
      console.debug('📋 Audit Logging desabilitado via DISABLE_AUDIT_LOGS');
    }
  }

  /**
   * Inicializa conexão com Supabase
   * @private
   */
  _initialize() {
    try {
      // Verifica se as credenciais estão configuradas
      if (!this.supabaseUrl || !this.supabaseKey) {
        console.debug('📋 Supabase não configurado - Audit Logging desabilitado');
        this.isEnabled = false;
        return;
      }

      this.client = createClient(this.supabaseUrl, this.supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });

      console.debug('✅ Supabase Audit Logger inicializado');

      // Auto-flush periódico
      this._startAutoFlush();
    } catch (error) {
      console.debug('⚠️ Supabase Audit Logger não disponível - continuando sem auditoria');
      this.isEnabled = false;
    }
  }

  /**
   * Inicia flush automático do buffer
   * @private
   */
  _startAutoFlush() {
    setInterval(() => {
      if (this.buffer.length > 0) {
        const timeSinceLastFlush = Date.now() - this.lastFlush;
        if (timeSinceLastFlush >= this.flushInterval) {
          this._flushBuffer();
        }
      }
    }, 10000); // Verifica a cada 10 segundos
  }

  /**
   * Sanitiza query removendo informações sensíveis
   * @private
   */
  _sanitizeQuery(query) {
    if (!query) return query;

    // Remove senhas, tokens, etc.
    let sanitized = query
      .replace(/password\s*=\s*['"][^'"]*['"]/gi, "password='***'")
      .replace(/senha\s*=\s*['"][^'"]*['"]/gi, "senha='***'")
      .replace(/token\s*=\s*['"][^'"]*['"]/gi, "token='***'");

    return sanitized;
  }

  /**
   * Grava log de query no buffer (assíncrono)
   * @param {Object} logData - Dados do log
   * @param {string} logData.query - Query SQL executada
   * @param {Array} logData.params - Parâmetros da query
   * @param {string} logData.grau - '1' ou '2'
   * @param {boolean} logData.success - Se a query foi bem-sucedida
   * @param {number} logData.executionTime - Tempo de execução em ms
   * @param {string} logData.error - Mensagem de erro (se houver)
   * @param {number} logData.rowCount - Número de linhas retornadas
   */
  async logQuery({
    query,
    params = [],
    grau = '1',
    success = true,
    executionTime = 0,
    error = null,
    rowCount = 0,
    metadata = {}
  }) {
    if (!this.isEnabled || !this.client) {
      return; // Silenciosamente ignora se não estiver habilitado
    }

    try {
      const logEntry = {
        query_text: this._sanitizeQuery(query),
        query_params: JSON.stringify(params),
        grau: grau,
        success: success,
        execution_time_ms: executionTime,
        error_message: error,
        row_count: rowCount,
        metadata: JSON.stringify(metadata),
        timestamp: new Date().toISOString(),
        hostname: require('os').hostname(),
        user_agent: 'Central IA - NAPJe v1.0.0'
      };

      // Adiciona ao buffer
      this.buffer.push(logEntry);

      // Flush se buffer estiver cheio
      if (this.buffer.length >= this.maxBufferSize) {
        await this._flushBuffer();
      }
    } catch (error) {
      // Silenciosamente ignora erros de logging
      console.debug('Erro ao adicionar log ao buffer:', error.message);
    }
  }

  /**
   * Envia buffer de logs para Supabase
   * @private
   */
  async _flushBuffer() {
    if (this.buffer.length === 0) return;

    const logsToSend = [...this.buffer];
    this.buffer = []; // Limpa buffer imediatamente
    this.lastFlush = Date.now();

    try {
      const { data, error } = await this.client
        .from('query_audit_logs')
        .insert(logsToSend);

      if (error) {
        // Log silencioso apenas em modo debug
        console.debug('⚠️ Erro ao enviar logs para Supabase:', error?.message || error);
        // Não re-adiciona ao buffer para evitar loop infinito
      } else {
        console.debug(`✅ ${logsToSend.length} logs enviados para Supabase`);
      }
    } catch (error) {
      // Log silencioso apenas em modo debug
      console.debug('⚠️ Erro ao fazer flush de logs:', error?.message || error);
    }
  }

  /**
   * Força envio imediato do buffer
   */
  async flush() {
    await this._flushBuffer();
  }

  /**
   * Habilita/desabilita logging
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    console.log(`Supabase Audit Logger ${enabled ? 'habilitado' : 'desabilitado'}`);
  }

  /**
   * Busca estatísticas de queries (últimas 24h)
   */
  async getQueryStats(hours = 24) {
    if (!this.isEnabled || !this.client) {
      return null;
    }

    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      const { data, error } = await this.client
        .from('query_audit_logs')
        .select('*')
        .gte('timestamp', since)
        .order('timestamp', { ascending: false });

      if (error) {
        console.warn('Erro ao buscar estatísticas:', error.message);
        return null;
      }

      // Processar estatísticas
      const stats = {
        totalQueries: data.length,
        successRate: (data.filter(q => q.success).length / data.length * 100).toFixed(2),
        avgExecutionTime: (data.reduce((acc, q) => acc + q.execution_time_ms, 0) / data.length).toFixed(2),
        slowestQueries: data
          .sort((a, b) => b.execution_time_ms - a.execution_time_ms)
          .slice(0, 10)
          .map(q => ({
            query: q.query_text.substring(0, 100) + '...',
            time: q.execution_time_ms,
            timestamp: q.timestamp
          })),
        errorRate: (data.filter(q => !q.success).length / data.length * 100).toFixed(2),
        byGrau: {
          '1': data.filter(q => q.grau === '1').length,
          '2': data.filter(q => q.grau === '2').length
        }
      };

      return stats;
    } catch (error) {
      console.warn('Erro ao calcular estatísticas:', error.message);
      return null;
    }
  }
}

// Singleton global
let auditLoggerInstance = null;

function getAuditLogger() {
  if (!auditLoggerInstance) {
    auditLoggerInstance = new SupabaseAuditLogger();
  }
  return auditLoggerInstance;
}

module.exports = {
  SupabaseAuditLogger,
  getAuditLogger
};
