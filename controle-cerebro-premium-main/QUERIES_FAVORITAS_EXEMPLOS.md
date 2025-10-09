# Queries Favoritas - Exemplos

Este arquivo contém exemplos de queries SQL úteis para o sistema PJE que podem ser salvas como favoritas.

## 1º Grau (schema: pje)

### Listar Processos Recentes
```sql
SELECT
  p.id_processo,
  p.nr_processo,
  oj.ds_orgao_julgador as vara
FROM pje.tb_processo p
LEFT JOIN pje.tb_processo_trf pt ON pt.id_processo_trf = p.id_processo
LEFT JOIN pje.tb_orgao_julgador oj ON oj.id_orgao_julgador = pt.id_orgao_julgador
ORDER BY p.id_processo DESC
LIMIT 100;
```

### Buscar Processo por Número
```sql
SELECT
  p.id_processo,
  p.nr_processo,
  oj.ds_orgao_julgador as vara
FROM pje.tb_processo p
LEFT JOIN pje.tb_processo_trf pt ON pt.id_processo_trf = p.id_processo
LEFT JOIN pje.tb_orgao_julgador oj ON oj.id_orgao_julgador = pt.id_orgao_julgador
WHERE p.nr_processo LIKE '%0001234-56%'
LIMIT 50;
```

### Listar Órgãos Julgadores Ativos
```sql
SELECT
  id_orgao_julgador,
  ds_orgao_julgador,
  in_ativo
FROM pje.tb_orgao_julgador
WHERE (in_ativo IS NULL OR in_ativo = 'S' OR in_ativo::text = 'true')
ORDER BY ds_orgao_julgador
LIMIT 500;
```

### Processos em Tarefa Específica
```sql
SELECT
  p.id_processo,
  p.nr_processo,
  pt.ds_nome_tarefa,
  oj.ds_orgao_julgador as vara
FROM pje.tb_processo p
LEFT JOIN pje.tb_processo_trf ptrf ON ptrf.id_processo_trf = p.id_processo
LEFT JOIN pje.tb_orgao_julgador oj ON oj.id_orgao_julgador = ptrf.id_orgao_julgador
LEFT JOIN pje.tb_processo_tarefa pt ON pt.id_processo = p.id_processo
WHERE pt.ds_nome_tarefa ILIKE '%análise%'
ORDER BY p.id_processo DESC
LIMIT 100;
```

### Contar Processos por Vara
```sql
SELECT
  oj.ds_orgao_julgador as vara,
  COUNT(p.id_processo) as total_processos
FROM pje.tb_processo p
LEFT JOIN pje.tb_processo_trf pt ON pt.id_processo_trf = p.id_processo
LEFT JOIN pje.tb_orgao_julgador oj ON oj.id_orgao_julgador = pt.id_orgao_julgador
WHERE oj.ds_orgao_julgador IS NOT NULL
GROUP BY oj.ds_orgao_julgador
ORDER BY total_processos DESC
LIMIT 50;
```

## 2º Grau (schema: eg_pje)

### Listar Processos Recentes - 2º Grau
```sql
SELECT
  p.id_processo,
  p.nr_processo,
  oj.ds_orgao_julgador as orgao
FROM eg_pje.tb_processo p
LEFT JOIN eg_pje.tb_processo_trf pt ON pt.id_processo_trf = p.id_processo
LEFT JOIN eg_pje.tb_orgaos_julgadores oj ON oj.id_orgao_julgador = pt.id_orgao_julgador
ORDER BY p.id_processo DESC
LIMIT 100;
```

### Buscar Processo por Número - 2º Grau
```sql
SELECT
  p.id_processo,
  p.nr_processo,
  oj.ds_orgao_julgador as orgao
FROM eg_pje.tb_processo p
LEFT JOIN eg_pje.tb_processo_trf pt ON pt.id_processo_trf = p.id_processo
LEFT JOIN eg_pje.tb_orgaos_julgadores oj ON oj.id_orgao_julgador = pt.id_orgao_julgador
WHERE p.nr_processo LIKE '%0001234-56%'
LIMIT 50;
```

### Listar Órgãos Julgadores - 2º Grau
```sql
SELECT
  id_orgao_julgador,
  ds_orgao_julgador,
  in_ativo
FROM eg_pje.tb_orgaos_julgadores
WHERE (in_ativo IS NULL OR in_ativo = 'S' OR in_ativo::text = 'true')
ORDER BY ds_orgao_julgador
LIMIT 500;
```

## Queries de Diagnóstico

### Listar Todas as Tabelas - 1º Grau
```sql
SELECT
  table_schema,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'pje'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

### Verificar Estrutura de Tabela
```sql
SELECT
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'pje'
  AND table_name = 'tb_processo'
ORDER BY ordinal_position;
```

### Estatísticas de Processos
```sql
SELECT
  COUNT(*) as total_processos,
  COUNT(DISTINCT p.nr_processo) as processos_unicos,
  MIN(p.id_processo) as menor_id,
  MAX(p.id_processo) as maior_id
FROM pje.tb_processo p;
```

## Como Usar

1. **Copie a query desejada**
2. **Cole no Editor SQL** da aba "Pesquisa Livre"
3. **Dê um nome** para a query (ex: "Listar Processos Recentes")
4. **Clique em "Salvar"**
5. **Próxima vez**: Selecione no dropdown e a query será carregada automaticamente!

## Dicas de Uso

- Use `LIMIT` para evitar trazer muitos dados de uma vez
- Use `LIKE '%termo%'` para buscas parciais
- Use `ILIKE` para buscas case-insensitive
- Sempre teste queries com `LIMIT 10` primeiro
- Salve variações úteis com nomes descritivos
