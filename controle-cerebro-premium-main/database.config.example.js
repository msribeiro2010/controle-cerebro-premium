// Configuração do banco de dados - EXEMPLO
// Copie para database.config.js e configure com suas credenciais

module.exports = {
  // Configuração principal do banco
  database: {
    host: 'seu-host-aqui',
    port: 5432,
    user: 'seu-usuario',
    password: 'sua-senha',
    max: 10, // Máximo de conexões no pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
  
  // Configuração para banco de 1º grau
  database1Grau: {
    host: 'seu-host-aqui',
    port: 5432,
    database: 'nome-banco-1grau',
    user: 'seu-usuario',
    password: 'sua-senha',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
  
  // Configuração para banco de 2º grau
  database2Grau: {
    host: 'seu-host-aqui',
    port: 5432,
    database: 'nome-banco-2grau',
    user: 'seu-usuario',
    password: 'sua-senha',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
  
  // Configurações de cache
  cache: {
    expiration: 5 * 60 * 1000, // 5 minutos
    maxSize: 1000,
  },
  
  // Configurações de otimização
  optimization: {
    enableDatabaseVerification: true,
    enableCache: true,
    enableNormalization: true,
    skipAlreadyProcessed: true,
  }
};