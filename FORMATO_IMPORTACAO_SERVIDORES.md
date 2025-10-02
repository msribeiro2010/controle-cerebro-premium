# Formato de Importação em Lote - Servidores

## Estrutura do Arquivo JSON

Para importar servidores em lote, utilize um arquivo JSON com a seguinte estrutura:

```json
[
  {
    "nome": "Aryelle Marcondes de Rezende",
    "cpf": "372.854.118-41",
    "perfil": "Secretário de Audiência",
    "ojs": [
      "Vara do Trabalho de Bebedouro",
      "1ª Vara do Trabalho de Jaboticabal",
      "2ª Vara do Trabalho de Jaboticabal",
      "Vara do Trabalho de Mococa"
    ]
  }
]
```

## Campos Obrigatórios

- **nome**: Nome completo do servidor (obrigatório)
- **cpf**: CPF no formato 000.000.000-00 (obrigatório)
- **perfil**: Perfil do servidor no sistema PJe (obrigatório)
- **ojs**: Array com os nomes dos órgãos julgadores (obrigatório)

## Perfis Disponíveis

- "Assessor"
- "Secretário de Audiência"
- "Administrador"
- "Servidor"
- "Analista Judiciário"
- "Técnico Judiciário"

## Exemplo Completo

Veja o arquivo `exemplo_importacao_servidores.json` para um exemplo prático com múltiplos servidores.

## Como Importar

1. Prepare seu arquivo JSON seguindo o formato acima
2. Na aba "Servidores" da aplicação
3. Clique no botão "Importar Servidores"
4. Selecione seu arquivo JSON
5. Os servidores serão importados automaticamente

## Observações Importantes

- O arquivo deve ser um JSON válido
- Todos os campos obrigatórios devem estar presentes (nome, cpf, perfil, ojs)
- Os nomes dos órgãos julgadores devem corresponder exatamente aos cadastrados no sistema
- CPFs duplicados não são permitidos
- O campo **perfil** é obrigatório e deve corresponder a um dos perfis disponíveis
- Campos **email** e **cidade** não são necessários e serão ignorados se presentes

## Funcionalidades da Verificação

- **Verificação de Cadastro**: O sistema verifica automaticamente quais servidores já estão cadastrados no banco de dados
- **Arquivo de Automação**: Gera automaticamente um arquivo JSON com os servidores não cadastrados para facilitar a automação
- **Verificação de OJs**: Para servidores já cadastrados, verifica quais OJs estão faltantes
- **Relatório Detalhado**: Apresenta relatório completo com status de cada servidor