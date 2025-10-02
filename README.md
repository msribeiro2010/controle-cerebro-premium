# Central IA - NAPJe

Sistema de automação inteligente para vinculação de peritos e servidores no PJE (Processo Judicial Eletrônico) com interface gráfica moderna e intuitiva construída em Electron.

## ⭐ Principais Melhorias (v2.0)

- **🎯 Fluxo PERITO Otimizado**: Nova estratégia que clica diretamente no mat-select, sem necessidade de botão "Adicionar"
- **🧠 Seleção Inteligente de OJ**: Sistema de scoring que encontra exatamente o órgão julgador correto (ex: distingue entre 1ª e 2ª Vara da mesma cidade)
- **💪 Elementos Hidden**: Suporte completo a elementos mat-select marcados como "hidden" com force click e scroll automático
- **🔄 Fallbacks Robustos**: Múltiplas estratégias de detecção e interação com elementos Angular Material
- **📊 Logs Otimizados**: Sistema de debug inteligente com informações essenciais

## 🚀 Funcionalidades

- **Interface Gráfica Moderna**: Interface desenvolvida com Electron para uma experiência de usuário profissional
- **Gerenciamento de Peritos**: Adicione, edite e remova peritos com facilidade
- **Gerenciamento de Servidores**: Configure e gerencie dados de servidores do sistema
- **Seleção Múltipla de OJs**: Interface intuitiva para seleção de múltiplos órgãos julgadores
- **Configuração Segura**: Configure credenciais e URL do PJE de forma segura
- **Automação Inteligente**: Execute a vinculação de órgãos julgadores automaticamente
- **Monitoramento em Tempo Real**: Acompanhe o progresso da automação com logs detalhados
- **Seleção Flexível**: Escolha quais peritos ou servidores processar em cada execução
- **Relatórios Detalhados**: Gere relatórios completos das operações realizadas

## 📋 Pré-requisitos

- Node.js (versão 18 ou superior)
- npm ou yarn
- Sistema operacional: Windows, macOS ou Linux

## 🛠️ Instalação

1. Clone o repositório:
```bash
git clone <url-do-repositorio>
cd pje-perito-automation
```

2. Instale as dependências:
```bash
npm install
```

3. Configure o arquivo `.env` com suas credenciais:
```env
PJE_URL=https://pje.exemplo.com.br
LOGIN=seu_login
PASSWORD=sua_senha
```

## 🚀 Como Usar

### Executar a Aplicação

```bash
npm start
```

### Modo Desenvolvimento

```bash
npm run dev
```

### Construir para Distribuição

```bash
npm run build
```

## 📱 Interface do Usuário

### Aba Peritos
- **Adicionar Perito**: Clique no botão "+" para adicionar um novo perito
- **Editar Perito**: Use o ícone de edição na tabela
- **Excluir Perito**: Use o ícone de lixeira (com confirmação)
- **Seleção**: Use as caixas de seleção para escolher peritos para automação
- **Importar/Exportar**: Funcionalidades para backup e restauração de dados

### Aba Configurações
- **URL do PJE**: Configure o endereço do sistema PJE
- **Credenciais**: Defina login e senha de acesso
- **Salvamento Automático**: As configurações são salvas automaticamente

### Aba Automação
- **Peritos Selecionados**: Visualize quais peritos serão processados
- **Controles**: Inicie ou pare a automação
- **Log de Status**: Acompanhe o progresso em tempo real
- **Notificações**: Receba feedback sobre o status da operação

## 📁 Estrutura do Projeto

```
pje-perito-automation/
├── src/
│   ├── main.js              # Processo principal do Electron
│   ├── preload.js           # Script de ponte segura
│   ├── index.js             # Script original de automação
│   ├── login.js             # Módulo de login
│   ├── navigate.js          # Módulo de navegação
│   ├── util.js              # Utilitários e configurações
│   ├── vincularOJ.js        # Módulo de vinculação
│   └── renderer/
│       ├── index.html       # Interface principal
│       ├── styles.css       # Estilos da aplicação
│       └── script.js        # Lógica da interface
├── data/
│   └── perito.json          # Dados dos peritos
├── assets/
│   └── icon.svg             # Ícone da aplicação
├── .env                     # Configurações (não versionado)
├── package.json             # Dependências e scripts
└── README.md               # Este arquivo
```

## 🔧 Tecnologias Utilizadas

- **Electron**: Framework para aplicações desktop
- **Playwright**: Automação de navegador
- **HTML5/CSS3**: Interface moderna e responsiva
- **JavaScript ES6+**: Lógica da aplicação
- **Node.js**: Runtime JavaScript

## 🛡️ Segurança

- As credenciais são armazenadas localmente no arquivo `.env`
- Comunicação segura entre processos usando `contextIsolation`
- Validação de entrada em todos os formulários
- Logs detalhados para auditoria

## 📝 Formato dos Dados

Os peritos são armazenados no formato JSON:

```json
[
  {
    "cpf": "000.000.000-00",
    "nome": "Nome do Perito",
    "ojs": [
      "Vara do Trabalho de Cidade",
      "Outro Órgão Julgador"
    ]
  }
]
```

## 🐛 Solução de Problemas

### Erro de Login
- Verifique as credenciais na aba Configurações
- Confirme se a URL do PJE está correta
- Teste o acesso manual ao sistema

### Erro de Automação
- Verifique se o navegador está sendo aberto
- Confirme se os seletores CSS ainda são válidos
- Verifique os logs na aba Automação

### Problemas de Performance
- Reduza o número de peritos processados simultaneamente
- Verifique a conexão com a internet
- Feche outras aplicações que consomem recursos

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 📞 Suporte

Para suporte técnico ou dúvidas:
- Abra uma issue no GitHub
- Entre em contato com a equipe de desenvolvimento

---

**Nota**: Este sistema foi desenvolvido para automatizar tarefas repetitivas no PJE. Use com responsabilidade e de acordo com as políticas da sua organização.