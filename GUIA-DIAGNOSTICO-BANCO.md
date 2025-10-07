# 🔍 Guia de Diagnóstico e Criação de Queries Profissionais

## 📋 Situação Atual

As consultas estão simplificadas usando `SELECT * FROM pje.tb_processo` porque a estrutura exata das tabelas varia entre diferentes instalações do PJE.

**Status das Consultas:**
- ✅ **Funcionam imediatamente** - Retornam dados de processos
- ⚠️ **Genéricas** - Mostram apenas tabela tb_processo
- 🎯 **Customizáveis** - Você pode melhorá-las após descobrir a estrutura

## 🛠️ Passo a Passo: Descobrir Estrutura do Banco

### Passo 1: Executar Diagnóstico Completo

```bash
# 1. Inicie o aplicativo com DevTools
npm run dev

# 2. No console do DevTools, execute:
await diagnosticarBancoDados()
```

Este comando irá:
- Listar TODAS as tabelas dos bancos 1º e 2º graus
- Mostrar estrutura (colunas, PKs, FKs) das tabelas principais
- Exibir relacionamentos entre tabelas

### Passo 2: Identificar Tabelas de Audiências

```javascript
// No console do DevTools:
const tabelas = await window.electronAPI.diagnosticarTabelas('1');

// Filtrar tabelas relacionadas a audiências
const tabelasAudiencia = tabelas.data.filter(t =>
  t.table_name.includes('audiencia') ||
  t.table_name.includes('evento') ||
  t.table_name.includes('agendamento')
);

console.table(tabelasAudiencia);
```

**Tabelas Comuns para Audiências:**
- `tb_audiencia` (mais comum)
- `tb_evento_audiencia`
- `tb_agendamento`
- `tb_pauta_audiencia`

### Passo 3: Analisar Estrutura da Tabela

```javascript
// Escolha a tabela que encontrou (ex: tb_audiencia)
await analisarTabela('1', 'tb_audiencia')
```

Você verá:
- ✅ Todas as colunas disponíveis
- ✅ Tipos de dados (DATE, TIMESTAMP, VARCHAR, etc)
- ✅ Chaves primárias (PK)
- ✅ Chaves estrangeiras (FK)

### Passo 4: Verificar Relacionamentos

```javascript
// Ver com quais tabelas tb_audiencia se relaciona
const rels = await window.electronAPI.diagnosticarRelacionamentos('1', 'tb_audiencia');
console.table(rels.data);
```

**Relacionamentos Comuns:**
```
id_processo → tb_processo.id_processo
id_sala → tb_sala.id_sala
id_magistrado → tb_usuario_login.id_usuario
```

## 📝 Criando Queries Profissionais

### Exemplo: Query de Audiências Correta

Depois de descobrir a estrutura, você pode criar:

```javascript
// Em /src/utils/advanced-queries-service.js

async audienciasHoje(grau = '1') {
  const query = `
    SELECT
      p.nr_processo,
      au.dt_audiencia,
      au.hr_inicio,                    -- ✅ Descoberta no diagnóstico
      au.ds_tipo_audiencia,
      s.ds_sala,
      oj.ds_orgao_julgador,
      STRING_AGG(ul.ds_nome, ', ') as partes
    FROM pje.tb_audiencia au           -- ✅ Tabela confirmada
    INNER JOIN pje.tb_processo p
      ON p.id_processo = au.id_processo -- ✅ FK confirmada
    LEFT JOIN pje.tb_sala s
      ON s.id_sala = au.id_sala         -- ✅ FK confirmada
    INNER JOIN pje.tb_processo_trf pt
      ON pt.id_processo_trf = p.id_processo
    INNER JOIN pje.tb_orgao_julgador oj
      ON oj.id_orgao_julgador = pt.id_orgao_julgador
    LEFT JOIN pje.tb_processo_parte pp
      ON pp.id_processo = p.id_processo
    LEFT JOIN pje.tb_usuario_login ul
      ON ul.id_usuario = pp.id_pessoa
    WHERE DATE(au.dt_audiencia) = CURRENT_DATE
      AND au.in_ativo = 'S'             -- ✅ Coluna confirmada
    GROUP BY p.nr_processo, au.dt_audiencia, au.hr_inicio,
             au.ds_tipo_audiencia, s.ds_sala, oj.ds_orgao_julgador
    ORDER BY au.hr_inicio;
  `;

  return this.executeQuery(grau, query);
}
```

## 🎯 Checklist de Validação de Query

Antes de criar uma query complexa, verifique:

### ✅ Tabelas
- [ ] A tabela existe? (`diagnosticarTabelas`)
- [ ] Está no schema correto? (geralmente `pje`)
- [ ] Tem os dados que preciso?

### ✅ Colunas
- [ ] A coluna existe? (`diagnosticarEstruturTabela`)
- [ ] Tipo de dado está correto? (DATE, TIME, VARCHAR, etc)
- [ ] Coluna está ativa/povoada? (verificar se tem dados)

### ✅ Relacionamentos (JOINs)
- [ ] FK existe? (`diagnosticarRelacionamentos`)
- [ ] Tipo de JOIN correto? (INNER, LEFT, RIGHT)
- [ ] Evitar produtos cartesianos? (sempre ter ON clauses)

### ✅ Performance
- [ ] Usar LIMIT para testes?
- [ ] WHERE com índices? (geralmente PKs e FKs)
- [ ] GROUP BY necessário?

## 🔧 Ferramentas de Diagnóstico Disponíveis

### Via Console (DevTools)

```javascript
// 1. Diagnóstico completo
await diagnosticarBancoDados()

// 2. Listar tabelas por padrão
const tabelas = await window.electronAPI.diagnosticarTabelas('1');
const tabelasProc = tabelas.data.filter(t => t.table_name.includes('processo'));
console.table(tabelasProc);

// 3. Analisar tabela específica
await analisarTabela('1', 'tb_audiencia')
await analisarTabela('2', 'tb_sessao')

// 4. Ver relacionamentos
const rels = await window.electronAPI.diagnosticarRelacionamentos('1', 'tb_audiencia');
console.table(rels.data);

// 5. Testar consulta
const resultado = await window.electronAPI.queryAudienciasHoje('1');
console.table(resultado.data);
```

### Via Interface (após implementar)

1. Vá para aba **Processos/Tarefa**
2. Clique em qualquer consulta
3. Veja os dados retornados
4. Use **Exportar JSON** para salvar

## 📊 Estruturas Comuns do PJE

### 1º Grau

**Tabelas Core:**
- `tb_processo` - Processos principais
- `tb_audiencia` - Audiências agendadas
- `tb_processo_trf` - Relação processo com tribunal
- `tb_orgao_julgador` - Varas/Juízos
- `tb_usuario_login` - Usuários do sistema
- `tb_processo_parte` - Partes do processo
- `jbpm_taskinstance` - Tarefas JBPM
- `jbpm_variableinstance` - Variáveis JBPM

**Relacionamentos Típicos:**
```
tb_processo.id_processo ←→ tb_audiencia.id_processo
tb_processo.id_processo ←→ tb_processo_trf.id_processo_trf
tb_processo_trf.id_orgao_julgador ←→ tb_orgao_julgador.id_orgao_julgador
tb_processo.id_processo ←→ tb_processo_parte.id_processo
tb_processo_parte.id_pessoa ←→ tb_usuario_login.id_usuario
```

### 2º Grau

**Tabelas Core:**
- `tb_processo` - Processos principais
- `tb_sessao` - Sessões de julgamento
- `tb_orgao_julgador` - Câmaras/Turmas
- `tb_processo_trf` - Relação processo com tribunal

**Relacionamentos Típicos:**
```
tb_processo.id_processo ←→ tb_processo_trf.id_processo_trf
tb_processo_trf.id_orgao_julgador ←→ tb_orgao_julgador.id_orgao_julgador
tb_sessao.id_sessao ←→ ??? (descobrir com diagnóstico)
```

## 🎓 Boas Práticas para Queries PJE

### 1. Use Schema Explícito
```sql
✅ SELECT * FROM pje.tb_processo
❌ SELECT * FROM tb_processo
```

### 2. Sempre Use Alias
```sql
✅ FROM pje.tb_processo p
   JOIN pje.tb_audiencia au ON au.id_processo = p.id_processo

❌ FROM pje.tb_processo
   JOIN pje.tb_audiencia ON tb_audiencia.id_processo = tb_processo.id_processo
```

### 3. Especifique Colunas (após validação)
```sql
✅ SELECT p.nr_processo, p.dt_autuacao, au.dt_audiencia
❌ SELECT *  -- OK para testes, mas evite em produção
```

### 4. Use LIMIT em Desenvolvimento
```sql
✅ ORDER BY au.dt_audiencia DESC LIMIT 100
❌ ORDER BY au.dt_audiencia DESC  -- Pode retornar milhares de linhas
```

### 5. Filtros com Índices
```sql
✅ WHERE DATE(au.dt_audiencia) = CURRENT_DATE
   AND au.in_ativo = 'S'

❌ WHERE UPPER(au.ds_tipo_audiencia) LIKE '%INICIAL%'  -- Sem índice
```

## 🚀 Próximos Passos

1. ✅ Execute `await diagnosticarBancoDados()` no console
2. ✅ Anote as tabelas encontradas
3. ✅ Analise estrutura das tabelas principais
4. ✅ Verifique relacionamentos (FKs)
5. ✅ Crie queries específicas baseadas na estrutura real
6. ✅ Teste com LIMIT pequeno primeiro
7. ✅ Valide resultados
8. ✅ Remova LIMIT e ajuste colunas exibidas

## 📞 Suporte

Se encontrar erro:

1. **Copie a mensagem de erro completa**
2. **Execute o diagnóstico da tabela**: `await analisarTabela('1', 'nome_tabela')`
3. **Verifique se a tabela existe**: `await diagnosticarTabelas('1')`
4. **Compartilhe os resultados** para análise

---

**Lembre-se:** Este sistema foi projetado para ser **adaptável**. A detecção automática de colunas garante que você sempre veja os dados, mesmo que a estrutura seja diferente do esperado!
