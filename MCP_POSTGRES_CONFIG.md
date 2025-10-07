# Configuração MCP PostgreSQL - PJE

## 🔌 MCP Servers Configurados

O Claude Code agora tem acesso direto aos bancos de dados PJE através de MCP (Model Context Protocol).

### Servidores Ativos

#### 1. **pje-1grau** - Banco de Dados do 1º Grau
```json
{
  "command": "npx",
  "args": [
    "-y",
    "@modelcontextprotocol/server-postgres",
    "postgresql://msribeiro:msrq1w2e3@pje-dbpr-a1-replica:5432/pje_1grau"
  ]
}
```

- **Host**: pje-dbpr-a1-replica
- **Database**: pje_1grau
- **Schema**: pje
- **Usuário**: msribeiro
- **Porta**: 5432

#### 2. **pje-2grau** - Banco de Dados do 2º Grau
```json
{
  "command": "npx",
  "args": [
    "-y",
    "@modelcontextprotocol/server-postgres",
    "postgresql://msribeiro:msrq1w2e3@pje-dbpr-a2-replica:5432/pje_2grau"
  ]
}
```

- **Host**: pje-dbpr-a2-replica
- **Database**: pje_2grau
- **Schema**: eg_pje
- **Usuário**: msribeiro
- **Porta**: 5432

## 🚀 Como Usar

### 1. Reiniciar Claude Code
**IMPORTANTE**: Reinicie o Claude Code para carregar as novas configurações MCP:
- Feche completamente a aplicação
- Abra novamente

### 2. Verificar MCP Servers
Execute o comando:
```bash
/mcp
```

Você deverá ver:
- ✅ neon
- ✅ pje-1grau
- ✅ pje-2grau

### 3. Usar MCP em Comandos

Agora você pode fazer perguntas diretas sobre o banco de dados, como:

- "Liste todas as tabelas do 1º grau"
- "Mostre os órgãos julgadores do 2º grau"
- "Quantos processos existem no pje_1grau?"
- "Execute SELECT * FROM pje.tb_processo LIMIT 10"

## 📊 Vantagens do MCP

### Acesso Direto ao Banco
- ✅ Consultas SQL diretas via MCP
- ✅ Exploração automática de schemas e tabelas
- ✅ Validação de queries antes de executar
- ✅ Resultados formatados automaticamente

### Integração com a Aplicação
- ✅ MCP para consultas ad-hoc
- ✅ API Electron para funcionalidades da aplicação
- ✅ Melhor performance com cache do MCP

### Desenvolvimento Facilitado
- ✅ Debugging direto no banco
- ✅ Testes de queries antes de implementar
- ✅ Documentação automática de schemas
- ✅ Análise de dados em tempo real

## 🔧 Configuração Técnica

### Arquivo de Configuração
Localização: `~/Library/Application Support/Claude/claude_desktop_config.json`

### MCP Server PostgreSQL
Pacote NPM: `@modelcontextprotocol/server-postgres`

Instalação automática via `npx -y` - não precisa instalar manualmente.

### Connection String Format
```
postgresql://[user]:[password]@[host]:[port]/[database]
```

## 🔒 Segurança

### Credenciais
- Armazenadas no arquivo de configuração do Claude Code
- Nunca commitadas no Git (.gitignore configurado)
- Acesso local apenas

### Recomendações
1. Use usuário com permissões read-only quando possível
2. Evite queries destrutivas (DROP, DELETE, UPDATE)
3. Use LIMIT em queries exploratórias
4. Monitore logs de acesso ao banco

## 🐛 Troubleshooting

### MCP Server não aparece
1. Reinicie Claude Code completamente
2. Verifique `/mcp` para ver status
3. Execute `/doctor` para diagnóstico

### Erro de conexão
1. Verifique se o host está acessível
2. Confirme credenciais no .env
3. Teste conexão direta com `psql`:
   ```bash
   psql postgresql://msribeiro:msrq1w2e3@pje-dbpr-a1-replica:5432/pje_1grau
   ```

### Performance lenta
1. Use LIMIT em queries grandes
2. Considere índices no banco
3. Cache resultados quando possível

## 📚 Recursos

- [MCP Documentation](https://docs.claude.com/en/docs/claude-code/mcp)
- [PostgreSQL MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/postgres)
- [Claude Code Docs](https://docs.claude.com/en/docs/claude-code)
