# Sistema de Verificação Inteligente de Banco de Dados

Este sistema implementa uma verificação prévia no banco de dados PostgreSQL para otimizar o processamento de vinculação de OJs (Órgãos Julgadores) no PJE.

## 🎯 Funcionalidades

### 1. Verificação Prévia de OJs
- Consulta o banco `pje_1grau_bugfix` para verificar OJs já cadastrados
- Utiliza a query otimizada fornecida para verificar `tb_usu_local_visibilidade` e `tb_papel`
- Pula automaticamente OJs que já estão vinculados ao servidor

### 2. Cache Inteligente
- Sistema de cache com expiração de 5 minutos
- Reduz consultas repetitivas ao banco
- Estatísticas de hit rate e performance

### 3. Normalização de OJs
- Busca OJs por nome para normalização
- Encontra correspondências parciais no banco
- Ajuda na padronização de nomes

### 4. Relatórios de Otimização
- Estatísticas detalhadas de economia de tempo
- Relatório de OJs pulados vs processados
- Métricas de performance do cache

## 🔧 Configuração

### Banco de Dados
```javascript
// database.config.js
{
  database1Grau: {
    host: 'pje-db-bugfix-a1',
    port: 5432,
    database: 'pje_1grau_bugfix',
    user: 'msribeiro',
    password: 'WR4*N*d008Eb'
  }
}
```

### Query Utilizada
```sql
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
```

## 🚀 Como Usar

### 1. Teste de Conexão
```bash
node test-database-connection.js
```

### 2. Exemplo de Uso
```bash
node exemplo-verificacao-banco.js
```

### 3. Integração no Código
```javascript
const SmartDatabaseVerifier = require('./src/utils/smart-database-verifier');

const verifier = new SmartDatabaseVerifier();
await verifier.initialize();

// Verificar OJs de um servidor
const resultado = await verifier.verificarOJsServidor(idUsuario, listaOJs);

// Processar múltiplos servidores
const resultado = await verifier.processarServidoresComVerificacao(servidores);
```

## 📊 Benefícios

### Economia de Tempo
- **5 segundos por OJ economizado** (tempo estimado de processamento)
- Exemplo: 100 OJs já cadastrados = 500 segundos (8+ minutos) economizados

### Redução de Carga
- Menos requisições ao sistema PJE
- Processamento mais eficiente
- Menor chance de timeouts

### Relatórios Detalhados
- OJs já cadastrados (ativos e inativos)
- OJs que precisam ser processados
- Tempo total economizado
- Estatísticas de cache

## 🔍 Estrutura dos Arquivos

```
src/utils/
├── database-connection.js      # Conexão com PostgreSQL
├── database-cache.js          # Sistema de cache
└── smart-database-verifier.js # Verificador inteligente

database.config.js             # Configurações centralizadas
test-database-connection.js    # Script de teste
exemplo-verificacao-banco.js   # Exemplo de uso
```

## 🛠️ Handlers IPC Disponíveis

### `test-database-connection`
Testa a conexão com o banco de dados.

### `get-database-optimization-report`
Retorna relatório de otimização do sistema.

### `check-servidor-ojs`
Verifica OJs de um servidor específico.

### `normalize-oj-name`
Normaliza nome de OJ buscando no banco.

## 📈 Exemplo de Resultado

```
📊 RESULTADO DO PROCESSAMENTO:
   - Servidores processados: 2
   - Servidores pulados: 0
   - Total OJs verificados: 7
   - OJs pulados: 3
   - OJs para processar: 4
   - Tempo economizado: 15min

📋 DETALHES POR SERVIDOR:
1. João Silva (Status: processar)
   ✅ OJs já cadastrados:
      - 1ª Vara do Trabalho de Campinas (ID: 123)
      - 2ª Vara do Trabalho de Campinas (ID: 124)
   🔄 OJs para processar:
      - Vara do Trabalho de Limeira
      - Vara do Trabalho de São José dos Campos
   ⏱️ Tempo economizado: 10s
```

## ⚠️ Tratamento de Erros

O sistema é resiliente a falhas:
- Se o banco não estiver disponível, processa normalmente
- Cache com expiração automática
- Logs detalhados de erros
- Fallback para processamento tradicional

## 🔄 Integração com Automação

O sistema se integra automaticamente com:
- Automação de peritos
- Automação de servidores V2
- Processamento paralelo
- Sistema de cache existente

## 📝 Logs e Monitoramento

- Logs de conexão com banco
- Estatísticas de cache
- Relatórios de otimização
- Métricas de performance

