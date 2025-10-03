# 📋 Importação em Lote de Peritos - Guia Completo

## ✨ Funcionalidades Implementadas

### 🔧 Importação em Lote
- ✅ **Importar via arquivo JSON**: Suporte completo para arquivos JSON com validação automática
- ✅ **Validação de dados**: Verificação automática de CPF, nome e órgãos julgadores
- ✅ **Detecção de duplicatas**: CPFs duplicados atualizam dados existentes automaticamente
- ✅ **Relatório de importação**: Feedback detalhado sobre sucessos e falhas
- ✅ **Exemplo interativo**: Modal com exemplo do formato de arquivo

### 🎯 Vinculação em Lote
- ✅ **Seleção múltipla**: Checkbox para selecionar múltiplos peritos
- ✅ **Seleção total**: Botão "Selecionar Todos" para facilitar operações em massa
- ✅ **Automação robusta**: Sistema de automação com retry e recuperação de erros
- ✅ **Progresso em tempo real**: Acompanhamento detalhado do progresso da vinculação
- ✅ **Relatórios detalhados**: Logs completos de sucessos e falhas

## 📋 Como Usar

### 1. Preparar Arquivo de Importação

Crie um arquivo JSON seguindo o exemplo fornecido no botão "Exemplo de Importação":

```json
[
  {
    "nome": "João Silva Santos",
    "cpf": "123.456.789-00",
    "ojs": [
      "1ª Vara do Trabalho de Campinas",
      "2ª Vara do Trabalho de Campinas",
      "Vara do Trabalho de Jundiaí"
    ]
  },
  {
    "nome": "Maria Oliveira Costa",
    "cpf": "987.654.321-11",
    "ojs": [
      "Vara do Trabalho de Atibaia",
      "LIQ2 - Jundiaí",
      "EXE1 - Campinas"
    ]
  }
]
```

### 2. Importar Peritos

1. **Acesse a aba "Peritos"**
2. **Clique em "Importar em Lote"**
3. **Selecione seu arquivo JSON**
4. **Aguarde a validação automática**
5. **Confira o relatório de importação**

### 3. Vinculação em Lote

1. **Selecione os peritos desejados** usando os checkboxes
   - Use "Selecionar Todos" para operações em massa
   - Ou selecione individualmente conforme necessário

2. **Vá para a aba "Automação"**

3. **Inicie a vinculação automática**
   - Clique em "Iniciar Automação de Peritos"
   - Acompanhe o progresso em tempo real
   - Monitore os logs de status

## 🔍 Validações Automáticas

### Validação de Dados
- **Nome**: Deve ser uma string não vazia
- **CPF**: Deve ter 11 dígitos e não ser sequência repetida (111.111.111-11)
- **Órgãos Julgadores**: Deve ser um array com pelo menos um item

### Tratamento de Duplicatas
- **CPFs existentes**: Dados são atualizados automaticamente
- **Novos CPFs**: Peritos são adicionados à lista
- **Registros inválidos**: São ignorados com relatório detalhado

## 📊 Recursos Avançados

### Sistema de Histórico
- **Autocomplete inteligente**: CPFs previamente usados aparecem como sugestões
- **Histórico de órgãos**: Órgãos julgadores utilizados ficam disponíveis para reutilização
- **Persistência**: Histórico é salvo automaticamente entre sessões

### Monitoramento em Tempo Real
- **Progresso visual**: Barra de progresso durante a importação
- **Status detalhado**: Logs de cada etapa da automação
- **Relatórios finais**: Resumo completo de sucessos e falhas

## 🛠️ Resolução de Problemas

### Erros Comuns

**"Arquivo inválido: deve conter um array de peritos"**
- Verifique se o arquivo JSON está formatado corretamente
- Certifique-se de que o conteúdo é um array (inicia com `[` e termina com `]`)

**"X registros inválidos ignorados"**
- Verifique se todos os peritos têm nome, CPF e órgãos julgadores
- Confirme se os CPFs estão no formato correto (11 dígitos)

**Problemas na vinculação**
- Verifique se as credenciais estão configuradas na aba "Configurações"
- Confirme se os nomes dos órgãos julgadores estão corretos
- Monitore os logs para identificar problemas específicos

### Dicas de Performance

1. **Importações grandes**: Para listas com muitos peritos, considere dividir em lotes menores
2. **Vinculação em lote**: O sistema processa um perito por vez para maior estabilidade
3. **Backup**: Sempre exporte seus dados antes de grandes operações

## 📁 Arquivos de Exemplo

Um arquivo de exemplo está disponível em: `exemplo_importacao_peritos.json`

## 🔧 Estrutura Técnica

### Validação Implementada
```javascript
validatePeritoData(perito) {
  return (
    perito &&
    typeof perito === 'object' &&
    typeof perito.nome === 'string' &&
    perito.nome.trim().length > 0 &&
    typeof perito.cpf === 'string' &&
    this.isValidCPF(perito.cpf) &&
    Array.isArray(perito.ojs)
  );
}
```

### Fluxo de Importação
1. **Seleção de arquivo** → Diálogo nativo do sistema
2. **Validação JSON** → Parse e verificação de estrutura
3. **Validação de dados** → Cada perito é validado individualmente
4. **Processamento** → Adição/atualização na lista existente
5. **Persistência** → Salvamento automático dos dados
6. **Relatório** → Feedback detalhado para o usuário

## 📈 Benefícios

- **⚡ Eficiência**: Processe centenas de peritos em minutos
- **🔒 Segurança**: Validação robusta previne dados corrompidos
- **📊 Transparência**: Relatórios detalhados de todas as operações
- **🔄 Flexibilidade**: Suporte a atualizações e adições simultâneas
- **💾 Backup**: Funcionalidade de exportação para backup dos dados