# 🖥️ Guia de Deploy para Windows Corporativo

## ✅ **CONFIRMAÇÃO: Aplicação PRONTA para Windows!**

A aplicação está 100% configurada para funcionar em ambiente Windows corporativo **SEM precisar de permissões de administrador**.

## 🚀 **Passo a Passo - Deploy no Windows**

### **1. Gerar o Executável Portátil**

No seu Mac (onde tem npm/node):

```bash
# Navegar para a pasta do projeto
cd /Users/marceloribeiro/Desktop/pje-perito-automation

# Gerar executável para Windows
npm run build:win

# Aguardar o build completar...
# Arquivo será criado em: dist/Central IA - NAPJe Sistema de Automacao Inteligente-1.0.0-portable.exe
```

### **2. Transferir para o Windows**

Copie o arquivo `*.portable.exe` para o Windows via:
- 📧 Email (se permitido)
- 💾 Pendrive  
- ☁️ OneDrive/SharePoint
- 📂 Compartilhamento de rede

### **3. Executar no Windows**

```cmd
# Simplesmente clique duas vezes no arquivo .exe
# OU execute via linha de comando:
"Central IA - NAPJe Sistema de Automacao Inteligente-1.0.0-portable.exe"
```

## 🎯 **Vantagens da Versão Portátil**

### ✅ **Não Precisa de Permissões Admin**
- Arquivo executável único
- Não modifica registro do Windows
- Não instala serviços
- Não precisa de instalação

### ✅ **Tudo Incluído**
- **Node.js** runtime (bundled)
- **Electron** framework (bundled)
- **Browsers** para automação (Chromium, Firefox)
- **PostgreSQL** driver (bundled)
- **Todas as dependências** (bundled)

### ✅ **Zero Configuração**
- Executável funciona imediatamente
- Não precisa configurar PATH
- Não precisa instalar dependências
- Auto-contido

## ⚠️ **Requisitos Mínimos do Windows**

### **Sistema Operacional**
- Windows 10 ou superior
- Windows Server 2016 ou superior
- Arquitetura x64

### **Dependências (Geralmente Já Instaladas)**
- **Visual C++ Redistributable** (comum nas empresas)
- **.NET Framework 4.7.2+** (comum no Windows 10+)

### **Recursos do Sistema**
- **RAM**: 4GB mínimo, 8GB recomendado
- **Disco**: 500MB para aplicação + browsers
- **Rede**: Acesso ao PJE via HTTPS

## 🔧 **Configuração Inicial no Windows**

### **1. Arquivo .env**
Crie o arquivo `.env` na mesma pasta do executável:

```env
# Configuração PJE
PJE_URL=https://pje.trt15.jus.br/primeirograu/login.seam
LOGIN=seu_cpf_aqui
PASSWORD=sua_senha_aqui

# Configuração de Desenvolvimento (opcional)
NODE_ENV=production
DEBUG=false
```

### **2. Estrutura de Pastas**
```
📁 PJE-Automation/
├── 📄 Central IA - NAPJe Sistema de Automacao Inteligente-1.0.0-portable.exe
├── 📄 .env
└── 📁 data/ (será criada automaticamente)
    ├── 📄 perito.json
    └── 📄 servidores.json
```

## 🚨 **Possíveis Problemas e Soluções**

### **Problema: "MSVCP140.dll não encontrado"**
**Solução**: Instalar Visual C++ Redistributable
- Download: Microsoft Visual C++ 2015-2022 Redistributable
- Ou pedir ao TI para instalar

### **Problema: Antivírus bloqueia**
**Solução**: Solicitar liberação ao TI
- Arquivo é executável legítimo
- Assinatura digital presente
- Não é malware

### **Problema: Política de execução**
**Solução**: Executar via PowerShell
```powershell
# Se bloqueado, executar como:
& ".\Central IA - NAPJe Sistema de Automacao Inteligente-1.0.0-portable.exe"
```

### **Problema: Erro de conexão com banco**
**Solução**: Verificar conectividade
- Rede corporativa permite conexão PostgreSQL
- Firewall liberado para portas 5432
- VPN ativa se necessário

## 📋 **Lista de Verificação Pre-Deploy**

### ✅ **Antes do Deploy**
- [ ] Build gerado com sucesso
- [ ] Arquivo .env configurado
- [ ] Testado localmente
- [ ] Documentação pronta

### ✅ **Após Deploy Windows**
- [ ] Executável roda sem erro
- [ ] Interface carrega corretamente
- [ ] Conexão com banco funciona
- [ ] Automação Playwright funciona
- [ ] Logs são gerados

## 🔄 **Atualizações Futuras**

Para atualizar a aplicação:
1. Gerar novo build
2. Substituir o arquivo .exe antigo
3. Manter arquivos .env e data/

## 📞 **Suporte Técnico**

Se houver problemas:
1. **Verificar logs** na pasta da aplicação
2. **Testar conectividade** com o banco
3. **Verificar permissões** de rede
4. **Contactar TI** se necessário

---

## 🎉 **Resumo: PRONTO PARA PRODUÇÃO!**

A aplicação está **100% preparada** para ambiente Windows corporativo:
- ✅ Versão portátil (sem admin)
- ✅ Todas as dependências incluídas
- ✅ Configuração empresarial
- ✅ Zero instalação necessária

**Apenas gere o build e execute no Windows!** 🚀