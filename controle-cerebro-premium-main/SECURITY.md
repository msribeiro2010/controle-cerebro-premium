# Política de Segurança - PJE Perito Automation

## 🔒 Informações de Segurança

### Configuração Segura

1. **Credenciais**:
   - NUNCA commite o arquivo `.env` com credenciais reais
   - Use apenas o `.env.example` como template
   - Configure suas credenciais localmente após o clone

2. **Dados Sensíveis**:
   - Arquivos `data/perito.json` e `data/servidores.json` são ignorados pelo Git
   - Use os arquivos `example-*.json` como referência de estrutura
   - Dados reais permanecem apenas no seu ambiente local

### Práticas de Segurança Implementadas

#### ✅ Configurações Seguras
- Context isolation habilitado (`contextIsolation: true`)
- Node integration desabilitado (`nodeIntegration: false`)
- Credenciais carregadas via variáveis de ambiente
- Preload script com IPC seguro

#### ✅ Proteção de Dados
- Arquivos de dados pessoais excluídos do Git
- Logs não expõem senhas ou CPFs completos
- Relatórios temporários são limpos automaticamente

#### ✅ Browser Automation
- Execução em modo não-headless para transparência
- Timeouts configurados para evitar travamentos
- Logs detalhados para auditoria de ações

### Configuração Inicial Segura

1. **Clone o repositório:**
   ```bash
   git clone <repository-url>
   cd pje-perito-automation
   ```

2. **Configure suas credenciais:**
   ```bash
   cp .env.example .env
   # Edite o arquivo .env com suas credenciais reais
   ```

3. **Configure seus dados:**
   ```bash
   cp data/example-perito.json data/perito.json
   cp data/example-servidores.json data/servidores.json
   # Edite os arquivos com seus dados reais
   ```

### Uso Responsável

#### ⚠️ Avisos Importantes
- Esta ferramenta automatiza interações com o sistema PJE
- Use apenas com suas próprias credenciais autorizadas
- Respeite os termos de uso do sistema PJE
- Monitore as ações realizadas pela automação

#### 🔐 Boas Práticas
- Mantenha suas credenciais seguras e privadas
- Execute em ambiente confiável
- Faça backup regular dos seus dados
- Monitore logs para detectar comportamentos inesperados

### Relatório de Vulnerabilidades

Se você encontrar uma vulnerabilidade de segurança:

1. **NÃO** crie uma issue pública
2. Entre em contato diretamente via email privado
3. Forneça detalhes técnicos da vulnerabilidade
4. Aguarde confirmação antes de divulgar publicamente

### Dependências de Segurança

As principais dependências são auditadas regularmente:
- Electron (framework seguro para apps desktop)
- Playwright (automação de browser com sandboxing)
- Winston (logging seguro)

### Compliance

Esta aplicação:
- ✅ Não armazena credenciais em texto plano
- ✅ Não transmite dados para servidores externos
- ✅ Mantém logs locais apenas
- ✅ Respeita contexto de segurança do Electron
- ✅ Utiliza HTTPS para comunicação com PJE

### Atualizações de Segurança

- Monitore atualizações das dependências regularmente
- Execute `npm audit` periodicamente
- Mantenha o Electron atualizado
- Acompanhe advisories de segurança

---

**Última atualização:** Agosto 2024
**Versão da Política:** 1.0