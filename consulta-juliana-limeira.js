/**
 * Script para consultar registros da servidora Juliana Pires de Almeida Gonçalves
 * e comparar com as varas atribuídas para manter apenas as que ainda não constam no cadastro
 */

const ServidorDatabaseService = require('./src/utils/servidor-database-service');

// Dados da servidora fornecidos
const servidoraInfo = {
  nome: "Juliana Pires de Almeida Gonçalves",
  cpf: "275.392.168-75",
  cargo: "Assessor",
  varasAtribuidas: [
    "Vara do Trabalho de Sumaré",
    "Vara do Trabalho de Hortolândia", 
    "1ª Vara do Trabalho de Limeira",
    "2ª Vara do Trabalho de Limeira",
    "Vara do Trabalho de Santa Bárbara D'Oeste",
    "Vara do Trabalho de São João da Boa Vista"
  ]
};

async function consultarServidora() {
  try {
    console.log('🔍 Iniciando consulta para a servidora:', servidoraInfo.nome);
    console.log('📋 CPF:', servidoraInfo.cpf);
    console.log('💼 Cargo:', servidoraInfo.cargo);
    console.log('📍 Varas atribuídas:', servidoraInfo.varasAtribuidas.length);
    
    const servidorService = new ServidorDatabaseService();
    
    // Limpar CPF (remover formatação)
    const cpfLimpo = servidoraInfo.cpf.replace(/\D/g, '');
    console.log('🔢 CPF limpo:', cpfLimpo);
    
    // 1. Buscar OJs já cadastrados para a servidora no 1º grau
    console.log('\n📊 Buscando OJs já cadastrados no 1º grau...');
    const ojsCadastrados1Grau = await servidorService.buscarOJsDoServidor(cpfLimpo, '1');
    
    // 2. Buscar OJs já cadastrados para a servidora no 2º grau  
    console.log('📊 Buscando OJs já cadastrados no 2º grau...');
    const ojsCadastrados2Grau = await servidorService.buscarOJsDoServidor(cpfLimpo, '2');
    
    // Combinar todos os OJs cadastrados
    const todosOjsCadastrados = [
      ...ojsCadastrados1Grau.map(oj => ({ ...oj, grau: '1' })),
      ...ojsCadastrados2Grau.map(oj => ({ ...oj, grau: '2' }))
    ];
    
    console.log('\n✅ RESULTADO DA CONSULTA:');
    console.log('=' .repeat(60));
    console.log(`👤 Servidora: ${servidoraInfo.nome}`);
    console.log(`🆔 CPF: ${servidoraInfo.cpf}`);
    console.log(`📊 Total de OJs já cadastrados: ${todosOjsCadastrados.length}`);
    
    if (todosOjsCadastrados.length > 0) {
      console.log('\n📋 OJs já cadastrados no sistema:');
      todosOjsCadastrados.forEach((oj, index) => {
        console.log(`  ${index + 1}. ${oj.orgaoJulgador} (${oj.grau}º grau) - Perfil: ${oj.perfil}`);
      });
    } else {
      console.log('\n⚠️  Nenhum OJ encontrado no sistema para esta servidora.');
    }
    
    // 3. Comparar com as varas atribuídas
    console.log('\n🔍 ANÁLISE DAS VARAS ATRIBUÍDAS:');
    console.log('=' .repeat(60));
    
    const varasParaCadastrar = [];
    const varasJaCadastradas = [];
    
    servidoraInfo.varasAtribuidas.forEach(vara => {
      // Verificar se a vara já está cadastrada (busca flexível)
      const jaExiste = todosOjsCadastrados.some(oj => {
        const ojNormalizado = oj.orgaoJulgador.toLowerCase()
          .replace(/[^\w\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        const varaNormalizada = vara.toLowerCase()
          .replace(/[^\w\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        return ojNormalizado.includes(varaNormalizada) || varaNormalizada.includes(ojNormalizado);
      });
      
      if (jaExiste) {
        const ojExistente = todosOjsCadastrados.find(oj => {
          const ojNormalizado = oj.orgaoJulgador.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          const varaNormalizada = vara.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          
          return ojNormalizado.includes(varaNormalizada) || varaNormalizada.includes(ojNormalizado);
        });
        
        varasJaCadastradas.push({
          varaAtribuida: vara,
          ojCadastrado: ojExistente.orgaoJulgador,
          grau: ojExistente.grau,
          perfil: ojExistente.perfil
        });
      } else {
        varasParaCadastrar.push(vara);
      }
    });
    
    console.log(`\n✅ Varas já cadastradas (${varasJaCadastradas.length}):`);
    if (varasJaCadastradas.length > 0) {
      varasJaCadastradas.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.varaAtribuida}`);
        console.log(`     → Cadastrada como: ${item.ojCadastrado} (${item.grau}º grau)`);
        console.log(`     → Perfil: ${item.perfil}`);
      });
    } else {
      console.log('  Nenhuma vara já cadastrada encontrada.');
    }
    
    console.log(`\n🆕 Varas para cadastrar (${varasParaCadastrar.length}):`);
    if (varasParaCadastrar.length > 0) {
      varasParaCadastrar.forEach((vara, index) => {
        console.log(`  ${index + 1}. ${vara}`);
      });
      
      // Gerar arquivo JSON para automação
      const arquivoAutomacao = {
        servidor: {
          nome: servidoraInfo.nome,
          cpf: servidoraInfo.cpf,
          cargo: servidoraInfo.cargo,
          perfil: "Assessor"
        },
        ojs: varasParaCadastrar,
        observacoes: `Arquivo gerado automaticamente em ${new Date().toLocaleString('pt-BR')}. Contém apenas as varas que ainda não estão cadastradas no sistema.`
      };
      
      const fs = require('fs');
      const nomeArquivo = `juliana-limeira-varas-pendentes-${Date.now()}.json`;
      fs.writeFileSync(nomeArquivo, JSON.stringify(arquivoAutomacao, null, 2), 'utf8');
      
      console.log(`\n💾 Arquivo de automação gerado: ${nomeArquivo}`);
      console.log('   Este arquivo contém apenas as varas que precisam ser cadastradas.');
      
    } else {
      console.log('  Todas as varas já estão cadastradas no sistema! ✅');
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('🎯 RESUMO EXECUTIVO:');
    console.log(`   • Total de varas atribuídas: ${servidoraInfo.varasAtribuidas.length}`);
    console.log(`   • Varas já cadastradas: ${varasJaCadastradas.length}`);
    console.log(`   • Varas pendentes de cadastro: ${varasParaCadastrar.length}`);
    console.log(`   • Percentual já cadastrado: ${((varasJaCadastradas.length / servidoraInfo.varasAtribuidas.length) * 100).toFixed(1)}%`);
    
    return {
      servidora: servidoraInfo,
      ojsCadastrados: todosOjsCadastrados,
      varasJaCadastradas,
      varasParaCadastrar,
      arquivoGerado: varasParaCadastrar.length > 0 ? `juliana-limeira-varas-pendentes-${Date.now()}.json` : null
    };
    
  } catch (error) {
    console.error('❌ Erro durante a consulta:', error);
    throw error;
  }
}

// Executar a consulta
if (require.main === module) {
  consultarServidora()
    .then(resultado => {
      console.log('\n✅ Consulta concluída com sucesso!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Erro na consulta:', error.message);
      process.exit(1);
    });
}

module.exports = { consultarServidora, servidoraInfo };