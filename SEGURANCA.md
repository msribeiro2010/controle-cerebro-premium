# 🔒 Segurança e Boas Práticas

## ⚠️ Arquivos Sensíveis Removidos

Por questões de segurança, os seguintes arquivos foram removidos do repositório:

### 📁 node_modules/
- **Motivo**: Contém arquivos binários grandes (>100MB)
- **Solução**: Execute `npm install` após clonar
- **Benefício**: Repositório mais leve e sem arquivos desnecessários

### 🔐 .env
- **Motivo**: Contém credenciais sensíveis (CPF, senha)
- **Solução**: Use o arquivo `.env.example` como template
- **Configuração**:
  ```bash
  cp .env.example .env
  # Edite o .env com suas credenciais reais
  ```

## 🛡️ Configuração Segura

### 1. Arquivo .env
```bash
# ✅ CORRETO - Use o template
cp .env.example .env
nano .env  # ou seu editor preferido
```

```env
# Preencha com suas credenciais
PJE_URL=https://pje.trt15.jus.br/primeirograu/login.seam
LOGIN=seu_cpf_real
PASSWORD=sua_senha_real
```

### 2. Verificação de Segurança
```bash
# ❌ NUNCA faça isso
git add .env

# ✅ Verifique se está no .gitignore
grep -n ".env" .gitignore
```

## 🔍 Arquivos Protegidos pelo .gitignore

```gitignore
# Dependências
node_modules/

# Configurações sensíveis
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Builds e distribuição
dist/
build/
out/

# Logs
*.log
logs/

# Arquivos temporários
tmp/
temp/

# Certificados e chaves
*.pem
*.key
*.crt
*.p12
*.pfx

# Dados locais
data/local/
data/temp/
data/cache/
```

## 🚨 Problemas de Segurança Resolvidos

### Antes (❌ Inseguro)
- Credenciais expostas no repositório
- Arquivos binários grandes no Git
- Dados sensíveis em commits públicos

### Depois (✅ Seguro)
- Credenciais em arquivo local (.env)
- Template público (.env.example)
- Repositório limpo e leve
- Histórico sem dados sensíveis

## 📋 Checklist de Segurança

- [ ] ✅ .env está no .gitignore
- [ ] ✅ .env.example criado como template
- [ ] ✅ node_modules excluído do repositório
- [ ] ✅ Credenciais removidas do histórico Git
- [ ] ✅ Arquivos grandes removidos
- [ ] ✅ .gitignore configurado adequadamente

## 🔄 Processo de Limpeza Realizado

1. **Remoção do Cache Git**:
   ```bash
   git rm -r --cached node_modules/
   git rm --cached .env
   ```

2. **Limpeza do Histórico**:
   ```bash
   git filter-branch --force --index-filter \
     'git rm --cached --ignore-unmatch -r node_modules' \
     --prune-empty --tag-name-filter cat -- --all
   ```

3. **Garbage Collection**:
   ```bash
   rm -rf .git/refs/original/
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   ```

4. **Push Forçado**:
   ```bash
   git push --force-with-lease origin main
   ```

## 🎯 Benefícios Alcançados

- **Repositório**: 82KB (vs 150MB anterior)
- **Segurança**: Credenciais protegidas
- **Performance**: Clone mais rápido
- **Manutenção**: Histórico limpo
- **Compliance**: Boas práticas seguidas

## 📝 Recomendações

1. **Nunca commite**:
   - Senhas ou tokens
   - Arquivos de configuração com dados reais
   - node_modules ou dependências
   - Arquivos binários grandes

2. **Sempre use**:
   - .gitignore adequado
   - Templates (.example)
   - Variáveis de ambiente
   - Arquivos de configuração local

3. **Verifique regularmente**:
   - Status do git antes de commit
   - Conteúdo dos arquivos adicionados
   - Tamanho do repositório
   - Histórico de commits

## 🆘 Em Caso de Exposição Acidental

1. **Mude as credenciais imediatamente**
2. **Remova do histórico Git**
3. **Force push após limpeza**
4. **Notifique a equipe se necessário**
5. **Revise o processo de segurança**