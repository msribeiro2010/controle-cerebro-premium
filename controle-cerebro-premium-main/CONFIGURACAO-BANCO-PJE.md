# Configuração do Banco de Dados PJE

## ⚠️ IMPORTANTE: Configuração Necessária

O sistema está atualmente usando configurações padrão de banco de dados que **NÃO** se conectam ao banco real do PJE. Por isso, a funcionalidade de verificação de servidores não está comparando corretamente com os dados existentes.

## 🔧 Como Configurar

### 1. Edite o arquivo `database.config.js`

Abra o arquivo `database.config.js` na raiz do projeto e configure com as credenciais reais do seu banco PJE:

```javascript
module.exports = {
  // Configuração para banco de 1º grau
  database1Grau: {
    host: 'SEU_HOST_PJE_1GRAU',        // Ex: 'pje1g.tjsp.jus.br'
    port: 5432,                        // Porta do PostgreSQL
    database: 'NOME_DO_BANCO_1GRAU',   // Ex: 'pje_1grau'
    user: 'SEU_USUARIO',               // Usuário do banco
    password: 'SUA_SENHA',             // Senha do banco
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
  
  // Configuração para banco de 2º grau
  database2Grau: {
    host: 'SEU_HOST_PJE_2GRAU',        // Ex: 'pje2g.tjsp.jus.br'
    port: 5432,
    database: 'NOME_DO_BANCO_2GRAU',   // Ex: 'pje_2grau'
    user: 'SEU_USUARIO',
    password: 'SUA_SENHA',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
  
  // ... resto da configuração
};
```

### 2. Informações Necessárias

Você precisará obter do seu departamento de TI:

- **Host do banco PJE** (1º e 2º grau)
- **Nome dos bancos de dados**
- **Usuário e senha** com permissão de leitura
- **Porta** (geralmente 5432 para PostgreSQL)

### 3. Testando a Conexão

Após configurar, reinicie a aplicação e teste a funcionalidade "Verificar Servidores". 

Os logs no console do navegador (F12) mostrarão:
- ✅ **Sucesso**: "Servidor encontrado no banco PJE"
- ❌ **Erro**: "Erro na conexão com banco PJE - usando fallback local"

## 🚨 Problema Atual

**Sintoma**: Todos os OJs do JSON são considerados "faltantes" mesmo quando já estão cadastrados.

**Causa**: O sistema não consegue se conectar ao banco PJE real e está usando dados locais vazios.

**Solução**: Configure as credenciais corretas do banco PJE conforme instruções acima.

## 📋 Verificação

Para confirmar que a configuração está funcionando:

1. Abra o console do navegador (F12)
2. Carregue um JSON com servidores
3. Clique em "Verificar Servidores"
4. Observe os logs:
   - Se aparecer "🔍 Iniciando busca no banco PJE" seguido de dados reais = ✅ Funcionando
   - Se aparecer "🚨 ATENÇÃO: Erro na conexão" = ❌ Precisa configurar

## 🔒 Segurança

- **NUNCA** commite o arquivo `database.config.js` com credenciais reais
- Use variáveis de ambiente em produção
- Mantenha as credenciais seguras