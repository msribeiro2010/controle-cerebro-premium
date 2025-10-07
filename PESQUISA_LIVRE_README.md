# Pesquisa Livre SQL - Guia de Uso

## 📊 Visão Geral

A funcionalidade **Pesquisa Livre SQL** permite executar queries SQL customizadas diretamente nos bancos de dados PJE (1º e 2º grau), com suporte a queries favoritas para reutilização.

## 🎯 Recursos

### ✅ Funcionalidades Implementadas

1. **Editor SQL**
   - Syntax highlighting com tema escuro
   - Placeholder com exemplo de query
   - Auto-resize vertical
   - Suporte a queries multi-linha

2. **Seleção de Banco**
   - 1º Grau (schema: `pje`)
   - 2º Grau (schema: `eg_pje`)

3. **Queries Favoritas** ⭐ NOVO
   - Salvar queries mais usadas
   - Nomes descritivos personalizados
   - Carregar automaticamente no editor
   - Remover favoritas não utilizadas
   - Atualizar favoritas existentes

4. **Execução de Queries**
   - Validação de segurança (bloqueia DROP, TRUNCATE, ALTER)
   - Avisos para DELETE/UPDATE sem WHERE
   - Tempo de execução exibido
   - Contagem de resultados

5. **Visualização de Resultados**
   - Tabela formatada com cabeçalhos fixos
   - Scroll horizontal/vertical
   - Empty state quando sem dados
   - Valores NULL destacados

6. **Exportação**
   - Exportar resultados para CSV
   - Escape adequado de vírgulas e aspas
   - Nome de arquivo sugerido automaticamente

7. **Indicadores**
   - Status de conexão (Conectado/Desconectado)
   - Avisos de segurança
   - Feedback visual de operações

## 📖 Como Usar

### 1. Executar Query Simples

1. Navegue até a aba **"Pesquisa Livre"**
2. Selecione o banco (1º ou 2º grau)
3. Digite sua query SQL no editor
4. Clique em **"Executar Query"**
5. Veja os resultados na tabela abaixo

**Exemplo:**
```sql
SELECT * FROM pje.tb_processo LIMIT 10;
```

### 2. Salvar Query como Favorita

1. Digite ou carregue uma query no editor
2. Digite um **nome descritivo** no campo "Nome da Query"
   - Exemplo: "Listar Processos Recentes"
3. Clique em **"Salvar"** (botão verde)
4. A query será adicionada ao dropdown de favoritas

💡 **Dica**: Use nomes que descrevam o propósito da query!

### 3. Carregar Query Favorita

1. Abra o dropdown **"Selecionar Favorita"**
2. Escolha a query desejada
3. A query será automaticamente carregada no editor
4. O grau correto será selecionado automaticamente
5. Clique em **"Executar Query"** para rodar

### 4. Atualizar Query Favorita

1. Carregue a query favorita
2. Modifique a query no editor
3. **Mantenha o mesmo nome** no campo "Nome da Query"
4. Clique em **"Salvar"**
5. Confirme a atualização

### 5. Remover Query Favorita

1. Selecione a favorita no dropdown
2. Clique em **"Remover"** (botão vermelho)
3. Confirme a remoção
4. A query será deletada permanentemente

### 6. Exportar Resultados

1. Execute uma query
2. Clique em **"Exportar Resultados"**
3. Escolha local para salvar o arquivo CSV
4. Abra no Excel, Google Sheets, etc.

## 🔒 Segurança

### Comandos Bloqueados

Por segurança, os seguintes comandos são **bloqueados**:

- ❌ `DROP` - Deletar tabelas/bancos
- ❌ `TRUNCATE` - Limpar dados de tabelas
- ❌ `ALTER TABLE` - Modificar estrutura

### Comandos com Aviso

Os seguintes comandos exibem **avisos**:

- ⚠️ `DELETE` sem `WHERE` - Pode deletar todos os registros
- ⚠️ `UPDATE` sem `WHERE` - Pode atualizar todos os registros

### Recomendações

✅ Use `SELECT` para consultas
✅ Use `LIMIT` para queries exploratórias
✅ Teste em ambiente de desenvolvimento primeiro
✅ Faça backup antes de queries destrutivas

## 💾 Armazenamento

### Queries Favoritas

As queries favoritas são salvas em:
```
data/queries-favoritas.json
```

**Formato:**
```json
[
  {
    "nome": "Listar Processos Recentes",
    "query": "SELECT * FROM pje.tb_processo LIMIT 100;",
    "grau": "1",
    "dataCriacao": "2025-10-05T12:00:00.000Z"
  }
]
```

### Backup

Para fazer backup das suas favoritas:
1. Copie o arquivo `data/queries-favoritas.json`
2. Guarde em local seguro
3. Para restaurar, substitua o arquivo

## 🎨 Interface

### Cores e Tema

- **Editor**: Tema escuro (#1e1e1e)
- **Texto**: Cinza claro (#d4d4d4)
- **Placeholder**: Verde comentário (#6a9955)
- **Bordas**: Tom papiro (#d4c4a8)

### Ícones

- 📊 **Database**: Seleção de banco
- 💻 **Code**: Query SQL
- ▶️ **Play**: Executar
- 🧹 **Eraser**: Limpar
- 📤 **Export**: Exportar
- ⭐ **Star**: Favoritas
- 🔖 **Bookmark**: Selecionar favorita
- 🏷️ **Tag**: Nome da query
- 💾 **Save**: Salvar favorita
- 🗑️ **Trash**: Remover favorita

## 📚 Exemplos de Queries

Veja o arquivo **`QUERIES_FAVORITAS_EXEMPLOS.md`** para exemplos práticos de queries úteis.

## ❓ Troubleshooting

### Campo de Query não aparece

1. Verifique se está na aba "Pesquisa Livre"
2. Recarregue a página (F5)
3. Verifique o console do navegador (F12)

### Erro ao executar query

1. Verifique a sintaxe SQL
2. Confirme o schema correto (pje vs eg_pje)
3. Verifique se a tabela existe
4. Use LIMIT para queries grandes

### Favorita não carrega

1. Verifique se está selecionada no dropdown
2. Recarregue a lista de favoritas (F5)
3. Verifique o arquivo `data/queries-favoritas.json`

### Erro de conexão

1. Verifique status de conexão (canto superior direito)
2. Confirme credenciais no `.env`
3. Teste conexão com `psql` no terminal

## 🔧 Configuração Técnica

### Variáveis de Ambiente (.env)

```env
# 1º Grau
DB_1GRAU_HOST=pje-dbpr-a1-replica
DB_1GRAU_PORT=5432
DB_1GRAU_NAME=pje_1grau
DB_1GRAU_USER=seu_usuario
DB_1GRAU_PASSWORD=sua_senha

# 2º Grau
DB_2GRAU_HOST=pje-dbpr-a2-replica
DB_2GRAU_PORT=5432
DB_2GRAU_NAME=pje_2grau
DB_2GRAU_USER=seu_usuario
DB_2GRAU_PASSWORD=sua_senha
```

### Schemas

- **1º Grau**: `pje`
- **2º Grau**: `eg_pje`

### Tabelas Principais

**1º Grau:**
- `pje.tb_processo`
- `pje.tb_processo_trf`
- `pje.tb_orgao_julgador`
- `pje.tb_processo_tarefa`

**2º Grau:**
- `eg_pje.tb_processo`
- `eg_pje.tb_processo_trf`
- `eg_pje.tb_orgaos_julgadores`

## 🚀 Dicas Avançadas

### 1. Use Aliases Descritivos

```sql
SELECT
  p.nr_processo as numero_processo,
  oj.ds_orgao_julgador as vara
FROM pje.tb_processo p
LEFT JOIN pje.tb_orgao_julgador oj ON ...
```

### 2. Combine com CASE

```sql
SELECT
  nr_processo,
  CASE
    WHEN in_ativo = 'S' THEN 'Ativo'
    WHEN in_ativo = 'N' THEN 'Inativo'
    ELSE 'Desconhecido'
  END as status
FROM pje.tb_processo
```

### 3. Agregações Úteis

```sql
SELECT
  oj.ds_orgao_julgador as vara,
  COUNT(*) as total,
  COUNT(DISTINCT p.nr_processo) as unicos
FROM pje.tb_processo p
JOIN pje.tb_orgao_julgador oj ON ...
GROUP BY oj.ds_orgao_julgador
HAVING COUNT(*) > 10
ORDER BY total DESC
```

### 4. Subqueries

```sql
SELECT *
FROM pje.tb_processo
WHERE id_orgao_julgador IN (
  SELECT id_orgao_julgador
  FROM pje.tb_orgao_julgador
  WHERE ds_orgao_julgador LIKE '%Vara%'
)
```

## 📞 Suporte

Para dúvidas ou problemas:
1. Consulte este README
2. Veja exemplos em `QUERIES_FAVORITAS_EXEMPLOS.md`
3. Verifique logs do console (F12)
4. Contate o administrador do sistema
