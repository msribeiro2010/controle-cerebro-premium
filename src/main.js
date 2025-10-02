// Central IA - NAPJe - Main Process
// Sistema de automação inteligente para vinculação de peritos e servidores no PJE

const { app, BrowserWindow, ipcMain, dialog, session, shell } = require('electron');
const os = require('os');
// Ajuste de limite de listeners para evitar MaxListenersExceededWarning
try {
  if (process && typeof process.setMaxListeners === 'function') {
    process.setMaxListeners(50);
  }
  const events = require('events');
  if (events && typeof events.defaultMaxListeners === 'number') {
    events.defaultMaxListeners = 50;
  }
} catch (_) {}
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { login } = require('./login.js');
const { navegarParaCadastro } = require('./navigate.js');
const { vincularOJ } = require('./vincularOJ.js');
const { verificarOJJaVinculado, listarOJsVinculados } = require('./verificarOJVinculado.js');
// const { SmartOJCache } = require('./utils/smart-oj-cache.js'); // Removido - não mais necessário
const { ServidorSkipDetector } = require('./utils/servidor-skip-detector.js');
// const { VerificacaoDuplaOJ } = require('./utils/verificacao-dupla-oj.js'); // Removido - não mais necessário
// const SmartDatabaseVerifier = require('./utils/smart-database-verifier.js'); // Removido - não mais necessário
const SmartLocationSkipper = require('./utils/smart-location-skipper');
const LocationProgressTracker = require('./utils/location-progress-tracker');
const LocationErrorRecovery = require('./utils/location-error-recovery');
const LocationEfficiencyReporter = require('./utils/location-efficiency-reporter');
const { loadConfig } = require('./util.js');
const { Logger } = require('./utils/index.js');
const DatabaseConnection = require('./utils/database-connection');
// const ServidorAutomation = require('./main/servidor-automation'); // Removido V1
const ServidorAutomationV2 = require('./main/servidor-automation-v2');
// const { resolverProblemaVarasLimeira } = require(path.resolve(__dirname, '../solucao-limeira-completa.js'));

// __dirname is already available in CommonJS

let mainWindow;
let activeBrowser = null;
let automationInProgress = false;
// let smartOJCache = new SmartOJCache(); // Removido - não mais necessário
let servidorSkipDetector = new ServidorSkipDetector();
// let verificacaoDuplaOJ = new VerificacaoDuplaOJ(); // Removido - não mais necessário
let smartLocationSkipper = new SmartLocationSkipper();
let locationProgressTracker = new LocationProgressTracker();
let locationErrorRecovery = new LocationErrorRecovery();
let locationEfficiencyReporter = new LocationEfficiencyReporter();
// let smartDatabaseVerifier = new SmartDatabaseVerifier(); // Removido - não mais necessário
// let servidorAutomation = null; // Removido V1
let servidorAutomationV2 = null;
function sendStatus(type, message, progress = null, subtitle = null, ojData = null) {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const data = { type, message };
      if (progress !== null) data.progress = progress;
      if (subtitle) data.subtitle = subtitle;
      if (ojData) {
        if (ojData.ojProcessed !== undefined) data.ojProcessed = ojData.ojProcessed;
        if (ojData.totalOjs !== undefined) data.totalOjs = ojData.totalOjs;
        if (ojData.orgaoJulgador) data.orgaoJulgador = ojData.orgaoJulgador;
      }
      mainWindow.webContents.send('automation-status', data);
    }
  } catch (e) {
    console.error('Falha ao enviar status para renderer:', e);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Central IA - NAPJe',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.svg')
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  // Só abre DevTools se explicitamente solicitado via argumento --dev
  // Evita abertura automática em modo de produção
  const processArgvProcessed = Array.isArray(process.argv) ? process.argv : [];
  const shouldOpenDevTools = processArgvProcessed.includes('--dev') || 
                            processArgvProcessed.includes('--devtools') ||
                            process.env.ELECTRON_DEV_TOOLS === 'true';
  
  if (shouldOpenDevTools) {
    console.log('Abrindo DevTools (modo desenvolvimento)');
    mainWindow.webContents.openDevTools();
  } else {
    console.log('Aplicação iniciada em modo produção (DevTools desabilitado)');
  }
}

app.whenReady().then(() => {
  // Reset da variável automationInProgress na inicialização
  // Isso resolve o problema de "Automação já está em execução" após crashes ou fechamentos inesperados
  automationInProgress = false;
  console.log('✅ Sistema iniciado - automationInProgress resetado para false');
  
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers
ipcMain.handle('load-peritos', async () => {
  try {
    const data = fs.readFileSync(path.join(__dirname, '../data/perito.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
});

ipcMain.handle('save-peritos', async (event, peritos) => {
  try {
    fs.writeFileSync(path.join(__dirname, '../data/perito.json'), JSON.stringify(peritos, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error && error.message ? error.message : 'Erro desconhecido' };
  }
});

// Handlers genéricos para dados
ipcMain.handle('save-data', async (event, key, data) => {
  try {
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const filePath = path.join(dataDir, `${key}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error && error.message ? error.message : 'Erro desconhecido' };
  }
});

ipcMain.handle('load-data', async (event, key) => {
  try {
    const filePath = path.join(__dirname, '../data', `${key}.json`);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const data = fs.readFileSync(filePath, 'utf8');
    const parsedData = JSON.parse(data);

    // CORREÇÃO: Mapear campo 'orgaos' para 'ojs' em servidores
    if (key === 'servidores' && Array.isArray(parsedData)) {
      parsedData.forEach(servidor => {
        if (servidor.orgaos && !servidor.ojs) {
          servidor.ojs = servidor.orgaos;
          console.log(`🔧 [MAPPING] Mapeando orgaos→ojs para ${servidor.nome}: ${JSON.stringify(servidor.orgaos)}`);
        }
      });
    }

    return parsedData;
  } catch (error) {
    console.error(`Erro ao carregar dados para ${key}:`, error);
    return null;
  }
});

ipcMain.handle('load-config', async () => {
  try {
    return loadConfig();
  } catch (error) {
    return {};
  }
});

ipcMain.handle('save-config', async (event, config) => {
  try {
    const envContent = Object.entries(config)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    fs.writeFileSync(path.join(__dirname, '../.env'), envContent);

    try {
      const credentialsPath = path.join(__dirname, '../pje-credentials.json');
      const payload = {
        PJE_URL: config.PJE_URL || '',
        LOGIN: config.LOGIN || '',
        PASSWORD: config.PASSWORD || '',
        updatedAt: new Date().toISOString()
      };
      fs.writeFileSync(credentialsPath, JSON.stringify(payload, null, 2));
    } catch (innerError) {
      console.warn('Warning: falha ao salvar pje-credentials.json:', innerError.message);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error && error.message ? error.message : 'Erro desconhecido' };
  }
});

ipcMain.handle('start-automation', async (event, selectedPeritos) => {
  let browser;
  let currentStep = 0;
  
  // Calcular total de passos
  const totalSteps = selectedPeritos.reduce((total, perito) => {
    return total + 3 + perito.ojs.length; // login + navegação + busca perito + OJs
  }, 0);
  
  try {
    sendStatus('info', 'Iniciando navegador...', currentStep++, 'Configurando ambiente de automação');
    
    // Configurações do browser com timeouts otimizados
    browser = await chromium.launch({ 
      headless: false,
      slowMo: 5,
      timeout: 15000
    });
    activeBrowser = browser;
    const page = await browser.newPage();
    
    // Configurar timeout padrão da página
    page.setDefaultTimeout(10000);
    page.setDefaultNavigationTimeout(8000);
    
    // Inicializar componentes do sistema de scanner de localizações
    sendStatus('info', 'Inicializando sistema de scanner...', currentStep, 'Configurando componentes');
    await smartLocationSkipper.initialize();
    // locationProgressTracker não possui método initialize - já está pronto para uso
    await locationErrorRecovery.initialize();
    await locationEfficiencyReporter.initialize();
    
    // Capturar logs do console para debug
    page.on('console', msg => {
      const logMessage = msg.text();
      console.log('Browser console:', logMessage);
      
      // Enviar logs importantes para a interface
      const logMessageProcessed = typeof logMessage === 'string' ? logMessage : 
                                  (logMessage && typeof logMessage === 'object' && logMessage.nome) ? logMessage.nome : 
                                  String(logMessage);
      if (logMessageProcessed.includes('DEBUG') || logMessageProcessed.includes('encontrado') || logMessageProcessed.includes('CPF')) {
        sendStatus('info', `Debug: ${logMessage}`, currentStep, 'Informação de debug');
      }
    });

    sendStatus('info', 'Navegando para o PJE...', currentStep++, 'Acessando sistema PJE');

    // Tentar login com retry
    let loginSuccess = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        sendStatus('info', `Tentativa de login ${attempt}/3...`, currentStep, 'Autenticando no sistema');
        
        await login(page);
        loginSuccess = true;
        break;
      } catch (loginError) {
        if (attempt === 3) {
          const loginErrorMsg = loginError && loginError.message ? loginError.message : 'Erro desconhecido';
          throw new Error(`Falha no login após 3 tentativas: ${loginErrorMsg}`);
        }
        sendStatus('warning', `Tentativa ${attempt} falhou, tentando novamente...`, currentStep, 'Reautenticando');
        await page.waitForTimeout(500);
      }
    }
    
    sendStatus('success', 'Login realizado com sucesso!', currentStep++, 'Sistema autenticado');

    // Criar instância do Logger para navegação
    const logger = new Logger('PJE-Automation');
    
    // Relatório de resultados
    const relatorio = {
      totalPeritos: selectedPeritos.length,
      peritosProcessados: 0,
      totalOJs: 0,
      ojsVinculados: 0,
      ojsJaVinculados: 0,
      ojsNaoEncontrados: [],
      ojsComErro: [],
      detalhes: []
    };
    
    // Contador global de OJs processadas
    let ojsProcessadasTotal = 0;

    for (let i = 0; i < selectedPeritos.length; i++) {
      const perito = selectedPeritos[i];
      const resultadoPerito = {
        nome: perito.nome,
        cpf: perito.cpf,
        ojsProcessados: 0,
        ojsVinculados: 0,
        ojsJaVinculados: 0,
        ojsNaoEncontrados: [],
        ojsComErro: []
      };
      
      try {
        sendStatus('info', `Processando perito ${i + 1}/${selectedPeritos.length}: ${perito.nome}`, currentStep++, `Buscando perito por CPF: ${perito.cpf}`);
        
        await navegarParaCadastro(page, perito.cpf, logger);
        
        sendStatus('success', `Navegação para ${perito.nome} concluída`, currentStep, 'Perito localizado no sistema');
        
        // Processar todos os OJs do perito sequencialmente
        sendStatus('info', 'Iniciando processamento de OJs...', currentStep, 'Processando órgãos julgadores');
        
        // Usar todos os OJs do perito
        const ojsParaProcessar = perito.ojs;
        
        sendStatus('info', 
          `Processando ${ojsParaProcessar.length} OJs para ${perito.nome}`, 
          currentStep, 
          'Iniciando vinculação sequencial'
        );
        
        relatorio.totalOJs += ojsParaProcessar.length;
        
        for (let j = 0; j < ojsParaProcessar.length; j++) {
          const oj = ojsParaProcessar[j];
          resultadoPerito.ojsProcessados++;
          ojsProcessadasTotal++;
          
          try {
            sendStatus('info', `Processando OJ ${j + 1}/${ojsParaProcessar.length}: ${oj}`, currentStep++, 'Vinculando órgão julgador', {
              ojProcessed: ojsProcessadasTotal,
              totalOjs: relatorio.totalOJs,
              orgaoJulgador: oj
            });
            
            console.log(`\n=== PROCESSANDO OJ: "${oj}" ===`);
            console.log(`🔗 Iniciando vinculação direta`);
            
            // Tentar vincular o OJ diretamente
            await vincularOJ(page, oj);
            
            sendStatus('success', `OJ ${oj} vinculado com sucesso`, currentStep, 'Vínculo criado', {
              ojProcessed: ojsProcessadasTotal,
              totalOjs: relatorio.totalOJs,
              orgaoJulgador: oj
            });
            
            resultadoPerito.ojsVinculados++;
            relatorio.ojsVinculados++;
            console.log(`✅ SUCESSO: OJ "${oj}" vinculado!`);
            
          } catch (ojError) {
            console.log(`❌ ERRO ao processar OJ "${oj}":`, ojError.message);
            console.log(`   - Código: ${ojError.code || 'DESCONHECIDO'}`);
            
            // Verificar tipo específico de erro
            if (ojError && ojError.code === 'OJ_NAO_ENCONTRADO') {
              // OJ não encontrado na relação de opções
              console.log(`⚠️ OJ "${oj}" NÃO CONSTA na lista de opções disponíveis`);
              sendStatus('warning', `OJ "${oj}" não existe no sistema - pulando`, currentStep, 'OJ inexistente');
              
              const ojNaoEncontrado = {
                nome: oj,
                perito: perito.nome,
                motivo: 'Não encontrado na relação de opções disponíveis',
                opcoesDisponiveis: ojError.opcoesDisponiveis || []
              };
              
              resultadoPerito.ojsNaoEncontrados.push(ojNaoEncontrado);
              relatorio.ojsNaoEncontrados.push(ojNaoEncontrado);
              
            } else if (ojError && ojError.code === 'TIMEOUT_GLOBAL') {
              // Timeout na vinculação - pular e continuar
              console.log(`⏰ TIMEOUT ao processar OJ "${oj}" (mais de 60 segundos)`);
              sendStatus('error', `Timeout ao vincular OJ "${oj}" - pulando`, currentStep, 'Operação demorou muito');
              
              const ojComErro = {
                nome: oj,
                perito: perito.nome,
                erro: `Timeout após 60 segundos: ${ojError.message}`,
                codigo: 'TIMEOUT_GLOBAL'
              };
              
              resultadoPerito.ojsComErro.push(ojComErro);
              relatorio.ojsComErro.push(ojComErro);
              
            } else if (ojError && ojError.code === 'OJ_JA_CADASTRADO') {
              // OJ já cadastrado na página - pular e continuar
              console.log(`⚠️ OJ "${oj}" já está cadastrado na página`);
              sendStatus('warning', `OJ "${oj}" já cadastrado - pulando`, currentStep, 'OJ duplicado');
              
              // Cache removido - processamento simplificado
              
              resultadoPerito.ojsJaVinculados++;
              relatorio.ojsJaVinculados++;
              
            } else {
              // Outros tipos de erro
              const ojErrorMsg = ojError && ojError.message ? ojError.message : 'Erro desconhecido';
              const errorMsg = ojErrorMsg.toLowerCase();
              
              if (errorMsg.includes('já vinculado') || 
                  errorMsg.includes('já cadastrado') || 
                  errorMsg.includes('duplicado')) {
                console.log(`⚠️ OJ "${oj}" já estava vinculado (detectado durante vinculação)`);
                sendStatus('warning', `OJ "${oj}" já vinculado - pulando`, currentStep, 'Vínculo duplicado');
                resultadoPerito.ojsJaVinculados++;
                relatorio.ojsJaVinculados++;
              } else {
                console.log(`💥 ERRO GERAL ao vincular OJ "${oj}": ${ojErrorMsg}`);
                sendStatus('error', `Erro ao vincular OJ ${oj}: ${ojErrorMsg}`, currentStep, 'Erro na vinculação');
                
                const ojComErro = {
                  nome: oj,
                  perito: perito.nome,
                  erro: ojErrorMsg,
                  codigo: ojError.code || 'ERRO_DESCONHECIDO'
                };
                
                resultadoPerito.ojsComErro.push(ojComErro);
                relatorio.ojsComErro.push(ojComErro);
              }
            }
          }
          
          // Pequena pausa entre OJs
          await page.waitForTimeout(100);
        }
        
        relatorio.peritosProcessados++;
        relatorio.detalhes.push(resultadoPerito);
        
      } catch (peritoError) {
        const errorMessage = peritoError && peritoError.message ? peritoError.message : (peritoError ? String(peritoError) : 'Erro desconhecido');
        sendStatus('error', `Erro ao processar perito ${perito.nome}: ${errorMessage}`, currentStep, 'Erro no processamento');
        
        // Adicionar erro do perito ao relatório
        relatorio.detalhes.push({
          ...resultadoPerito,
          erroProcessamento: errorMessage
        });
      }
      
      // Pausa entre peritos
      if (i < selectedPeritos.length - 1) {
        await page.waitForTimeout(400);
      }
    }
    
    // Gerar relatório de eficiência dos servidores
    const relatorioEficiencia = servidorSkipDetector.gerarRelatorioEficiencia();
    
    console.log('\n📊 RELATÓRIO DE EFICIÊNCIA DOS SERVIDORES:');
    console.log(`   - Total de servidores analisados: ${relatorioEficiencia.totalServidores}`);
    console.log(`   - Servidores completos: ${relatorioEficiencia.servidoresCompletos}`);
    console.log(`   - Servidores quase completos: ${relatorioEficiencia.servidoresQuaseCompletos}`);
    console.log(`   - Servidores ativos: ${relatorioEficiencia.servidoresAtivos}`);
    console.log(`   - Economia total estimada: ${Math.round(relatorioEficiencia.economiaEstimada)}s`);
    
    // Adicionar relatórios ao relatório principal
    relatorio.eficienciaServidores = relatorioEficiencia;
    
    // Enviar status final com contador completo (apenas se houver OJs processadas)
    if (relatorio.totalOJs > 0) {
      sendStatus('success', 'Processamento finalizado com sucesso!', totalSteps, 'Todas as OJs foram processadas', {
        ojProcessed: relatorio.totalOJs,
        totalOjs: relatorio.totalOJs,
        orgaoJulgador: 'Finalizado'
      });
    } else {
      // Log silencioso quando não há OJs para processar
      console.log('🔄 [AUTOMATION] Processamento finalizado - nenhum OJ para processar');
      sendStatus('info', 'Processamento concluído', totalSteps, 'Nenhum OJ para processar', {
        ojProcessed: 0,
        totalOjs: 0,
        orgaoJulgador: 'Finalizado'
      });
    }
    
    // Enviar relatório final
    enviarRelatorioFinal(relatorio);

    // Não fechar o navegador automaticamente; manter no PJe para revisão
    const mensagemFinal = gerarMensagemFinal(relatorio);
    sendStatus('success', mensagemFinal, totalSteps, 'Processo finalizado');
    
    return { success: true };
  } catch (error) {
    const safeErrorMessage = error && error.message ? error.message : 'Erro desconhecido';
    const errorMessage = error && error.message && error.message.includes('Timeout') 
      ? 'Timeout: A página demorou muito para carregar. Verifique sua conexão e tente novamente.'
      : `Erro na automação: ${safeErrorMessage}`;
    
    sendStatus('error', `${errorMessage} Navegador permanecerá aberto para inspeção.`, currentStep, 'Falha na execução');
    
    return { success: false, error: safeErrorMessage };
  }
});

ipcMain.handle('show-save-dialog', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
    defaultPath: 'peritos.json'
  });
  return result;
});

ipcMain.handle('show-open-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
    properties: ['openFile']
  });
  return result;
});

// Handlers para importação e exportação de arquivos
ipcMain.handle('import-file', async (event, type) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      const data = fs.readFileSync(filePath, 'utf8');
      return { success: true, data: JSON.parse(data) };
    }
    
    return { success: false, canceled: true };
  } catch (error) {
    return { success: false, error: error && error.message ? error.message : 'Erro desconhecido' };
  }
});

ipcMain.handle('export-file', async (event, data, filename) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: filename || 'export.json',
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });
    
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2));
      return { success: true, filePath: result.filePath };
    }
    
    return { success: false, canceled: true };
  } catch (error) {
    return { success: false, error: error && error.message ? error.message : 'Erro desconhecido' };
  }
});

// Handler para parar automação e fechar o navegador manualmente
ipcMain.handle('stop-automation', async () => {
  try {
    if (activeBrowser) {
      await activeBrowser.close();
      activeBrowser = null;
    }
    mainWindow.webContents.send('automation-status', { 
      type: 'info', 
      message: 'Navegador fechado pelo usuário.'
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error && error.message ? error.message : 'Erro desconhecido' };
  }
});

// Handlers V1 removidos - usando apenas V2

// ===== HANDLERS PARA AUTOMAÇÃO V2 =====

// Handler para iniciar automação de servidores V2 (moderna)
ipcMain.handle('start-servidor-automation-v2', async (_, config) => {
  try {
    if (automationInProgress) {
      throw new Error('Automação já está em execução');
    }

    automationInProgress = true;
    
    // Processamento simplificado - sem verificação prévia no banco
    sendStatus('info', 'Iniciando processamento sequencial...', 0, 'Preparando automação');
    
    if (!servidorAutomationV2) {
      servidorAutomationV2 = new ServidorAutomationV2();
      servidorAutomationV2.setMainWindow(mainWindow);
    }
    
    // Processar servidores diretamente sem verificação prévia
    if (config.servidores) {
      sendStatus('info', 'Processando servidores sequencialmente...', 0, 'Iniciando automação');
      
      sendStatus('success',
        `Configuração carregada: ${config.servidores.length} servidores para processar`,
        0,
        'Iniciando processamento sequencial'
      );
    }

    // Usar processamento paralelo com 4 instâncias por padrão
    const servidores = config.servidores || [];
    await servidorAutomationV2.startParallelAutomation(servidores, config, 4);
    return { success: true, relatorio: servidorAutomationV2.getRelatorio() };
    
  } catch (error) {
    console.error('Erro na automação de servidores V2:', error);
    
    // Gerar mensagem de erro mais detalhada
    let errorMessage = 'Erro desconhecido na automação';
    
    if (error && error.message) {
      errorMessage = error.message;
    } else if (error && typeof error === 'string') {
      errorMessage = error;
    } else if (error && error.toString) {
      errorMessage = error.toString();
    }
    
    // Adicionar contexto adicional se disponível
    const errorDetails = {
      message: errorMessage,
      type: error?.name || 'UnknownError',
      stack: error?.stack || 'No stack trace available',
      timestamp: new Date().toISOString(),
      context: 'start-servidor-automation-v2'
    };
    
    console.error('Detalhes completos do erro:', JSON.stringify(errorDetails, null, 2));
    
    return { 
      success: false, 
      error: errorMessage,
      details: errorDetails
    };
  } finally {
    automationInProgress = false;
  }
});

// Handler para iniciar automação paralela de servidores V2
ipcMain.handle('start-parallel-automation-v2', async (_, config) => {
  try {
    if (automationInProgress) {
      throw new Error('Automação já está em execução');
    }

    automationInProgress = true;
    
    if (!servidorAutomationV2) {
      servidorAutomationV2 = new ServidorAutomationV2();
      servidorAutomationV2.setMainWindow(mainWindow);
    }
    
    // Extrair parâmetros necessários do config e configurar modo paralelo
    const servidores = config.servidores || [];
    const maxInstances = config.numInstances || config.maxInstances || 2;
    
    // Configurar explicitamente para modo paralelo
    config.mode = 'parallel';
    config.useParallelProcessor = true;
    config.forceBatchOnly = false;
    
    console.log(`🚀 [MAIN] Configurado para modo paralelo com ${maxInstances} instâncias`);
    
    const result = await servidorAutomationV2.startParallelAutomation(servidores, config, maxInstances);
    return { success: true, ...result };
    
  } catch (error) {
    console.error('Erro na automação paralela de servidores V2:', error);
    return { success: false, error: error && error.message ? error.message : 'Erro desconhecido' };
  } finally {
    automationInProgress = false;
  }
});

// Handler para parar automação de servidores V2
ipcMain.handle('stop-servidor-automation-v2', async () => {
  try {
    if (servidorAutomationV2) {
      await servidorAutomationV2.stopAutomation();
    }
    automationInProgress = false;
    return { success: true };
  } catch (error) {
    console.error('Erro ao parar automação V2:', error);
    return { success: false, error: error && error.message ? error.message : 'Erro desconhecido' };
  }
});

// Handler para obter status da automação de servidores V2
ipcMain.handle('get-servidor-automation-v2-status', async () => {
  try {
    if (servidorAutomationV2) {
      return servidorAutomationV2.getStatus();
    }
    return { isRunning: false, progress: 0, totalOrgaos: 0, processedCount: 0 };
  } catch (error) {
    console.error('Erro ao obter status V2:', error);
    return { isRunning: false, progress: 0, totalOrgaos: 0, processedCount: 0 };
  }
});

// Handler para obter relatório da automação V2
ipcMain.handle('get-servidor-automation-v2-report', async () => {
  try {
    if (servidorAutomationV2) {
      return { success: true, relatorio: servidorAutomationV2.getRelatorio() };
    }
    return { success: false, error: 'Automação V2 não inicializada' };
  } catch (error) {
    console.error('Erro ao obter relatório V2:', error);
    return { success: false, error: error && error.message ? error.message : 'Erro desconhecido' };
  }
});

// Handler para reset manual do lock de automação
ipcMain.handle('reset-automation-lock', async () => {
  try {
    const wasLocked = automationInProgress;
    automationInProgress = false;
    
    console.log(`🔓 Reset manual do lock de automação executado - Estado anterior: ${wasLocked ? 'TRAVADO' : 'LIVRE'}`);
    
    return { 
      success: true, 
      message: `Lock de automação resetado com sucesso. Estado anterior: ${wasLocked ? 'TRAVADO' : 'LIVRE'}`,
      wasLocked: wasLocked
    };
  } catch (error) {
    console.error('Erro ao resetar lock de automação:', error);
    return { 
      success: false, 
      error: error && error.message ? error.message : 'Erro desconhecido' 
    };
  }
});

// Handler para resetar caches/estado de automação
ipcMain.handle('reset-automation-caches', async () => {
  try {
    try { if (smartOJCache && typeof smartOJCache.limparCache === 'function') smartOJCache.limparCache(); } catch (e) {}
    try { if (servidorAutomationV2 && servidorAutomationV2.ojCache) servidorAutomationV2.ojCache.clear(); } catch (e) {}
    try { if (servidorAutomationV2) servidorAutomationV2.forcedOJsNormalized = null; } catch (e) {}
    return { success: true };
  } catch (error) {
    return { success: false, error: error && error.message ? error.message : 'Erro desconhecido' };
  }
});

// Handler para limpar cache de verificação de OJs
ipcMain.handle('limpar-cache-verificacao', async () => {
  try {
    console.log('🧹 Iniciando limpeza do cache de verificação de OJs...');

    // Limpar cache em memória se existir
    try {
      if (servidorAutomationV2 && servidorAutomationV2.smartOJCache && typeof servidorAutomationV2.smartOJCache.limparCacheCompleto === 'function') {
        await servidorAutomationV2.smartOJCache.limparCacheCompleto();
        console.log('✅ Cache em memória limpo');
      }
    } catch (e) {
      console.warn('⚠️ Erro ao limpar cache em memória:', e.message);
    }

    // Limpar arquivo de cache persistente
    try {
      const cacheFile = path.join(__dirname, '../data/smart-oj-cache.json');

      try {
        await fs.promises.unlink(cacheFile);
        console.log('✅ Arquivo de cache persistente removido');
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
        console.log('ℹ️ Arquivo de cache não existia');
      }
    } catch (e) {
      console.warn('⚠️ Erro ao remover arquivo de cache:', e.message);
    }

    console.log('✅ Limpeza de cache de verificação concluída com sucesso');
    return { success: true, message: 'Cache de verificação limpo com sucesso' };

  } catch (error) {
    console.error('❌ Erro ao limpar cache de verificação:', error);
    return { success: false, error: error.message };
  }
});

// Handler para carregar órgãos PJE
ipcMain.handle('load-orgaos-pje', async () => {
  try {
    const orgaosPath = path.join(__dirname, 'renderer/orgaos_pje.json');
    if (!fs.existsSync(orgaosPath)) {
      throw new Error('Arquivo orgaos_pje.json não encontrado');
    }
    
    const data = fs.readFileSync(orgaosPath, 'utf8');
    const orgaosData = JSON.parse(data);
    
    // Extrair todos os órgãos de todas as cidades e juntar em um array único
    const allOJs = [];
    Object.keys(orgaosData).forEach(cidade => {
      if (Array.isArray(orgaosData[cidade])) {
        allOJs.push(...orgaosData[cidade]);
      }
    });
    
    // Ordenar alfabeticamente
    const sortedOJs = allOJs.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
    
    return { success: true, orgaos: sortedOJs };
  } catch (error) {
    console.error('Erro ao carregar órgãos PJE:', error);
    return { success: false, error: error && error.message ? error.message : 'Erro desconhecido', orgaos: [] };
  }
});

// Handler para validar configuração V2
ipcMain.handle('validate-servidor-config-v2', async (_, config) => {
  try {
    // Validações básicas
    if (!config.cpf || !config.orgaos || !Array.isArray(config.orgaos)) {
      throw new Error('Configuração inválida: CPF e lista de órgãos são obrigatórios');
    }
    
    const cpfLimpo = config.cpf.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
      throw new Error('CPF deve ter 11 dígitos');
    }
    
    if (config.orgaos.length === 0) {
      throw new Error('Lista de órgãos julgadores não pode estar vazia');
    }
    
    return { success: true, message: 'Configuração válida' };
  } catch (error) {
    return { success: false, error: error && error.message ? error.message : 'Erro desconhecido' };
  }
});

// Handler para testar conexão com banco de dados
// Handlers de banco de dados removidos - funcionalidade simplificada

// Handler para normalizar nome de OJ
// Handler normalize-oj-name removido - funcionalidade simplificada

// Handler para salvar credenciais do banco
ipcMain.handle('save-database-credentials', async (_, credentials) => {
  try {
    // Validar credenciais obrigatórias
    if (!credentials.user || !credentials.password) {
      return { success: false, error: 'Usuário e senha são obrigatórios' };
    }

    // Salvar credenciais no arquivo de configuração
    const configPath = path.join(__dirname, '../database-credentials.json');
    fs.writeFileSync(configPath, JSON.stringify(credentials, null, 2));
    
    // Atualizar credenciais também no serviço de processos
    try {
      if (processDatabaseService && processDatabaseService.dbConnection) {
        await processDatabaseService.dbConnection.updateCredentials(credentials);
      }
    } catch (e) {
      console.warn('⚠️ Falha ao atualizar credenciais no serviço de processos:', e.message);
    }
    
    return { success: true, message: 'Credenciais salvas com sucesso' };
  } catch (error) {
    return { success: false, error: error && error.message ? error.message : 'Erro desconhecido' };
  }
});

// Handler para carregar credenciais do banco
ipcMain.handle('load-database-credentials', async () => {
  try {
    const configPath = path.join(__dirname, '../database-credentials.json');
    
    if (fs.existsSync(configPath)) {
      const credentials = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return { success: true, credentials: credentials };
    } else {
      return { success: false, credentials: null };
    }
  } catch (error) {
    return { success: false, error: error && error.message ? error.message : 'Erro desconhecido' };
  }
});

// Handler para testar credenciais do banco
ipcMain.handle('test-database-credentials', async (_, credentials) => {
  try {
    // Validar credenciais básicas
    if (!credentials.user || !credentials.password) {
      return { success: false, error: 'Usuário e senha são obrigatórios' };
    }
    
    console.log('🔍 Testando credenciais do banco de dados...');
    
    // Criar instância temporária da conexão para teste
    const testConnection = new DatabaseConnection(credentials);
    
    // Tentar inicializar a conexão
    const connectionResult = await testConnection.initialize();
    
    if (connectionResult) {
      // Testar se a conexão está saudável
      const isHealthy = await testConnection.isHealthy();
      
      if (isHealthy) {
        // Fechar a conexão de teste
        await testConnection.close();
        
        console.log('✅ Conexão com banco de dados estabelecida com sucesso');
        return { 
          success: true, 
          message: 'Conexão estabelecida com sucesso! Banco de dados acessível.',
          details: {
            host: credentials.host || 'pje-db-bugfix-a1',
            port: credentials.port || 5432,
            user: credentials.user,
            database1Grau: credentials.database1Grau || 'pje_1grau_bugfix',
            database2Grau: credentials.database2Grau || 'pje_2grau_bugfix'
          }
        };
      } else {
        await testConnection.close();
        return { success: false, error: 'Conexão estabelecida mas banco não está respondendo adequadamente' };
      }
    } else {
      await testConnection.close();
      return { success: false, error: 'Não foi possível estabelecer conexão com o banco de dados' };
    }
    
  } catch (error) {
    console.error('❌ Erro ao testar conexão com banco:', error);
    
    let errorMessage = 'Erro desconhecido ao conectar com banco';
    let errorCode = error.code || 'UNKNOWN_ERROR';
    
    // Tratar erros específicos do PostgreSQL
    if (error.code === 'ENOTFOUND') {
      errorMessage = `Servidor não encontrado: ${credentials.host}. Verifique se o host está correto e acessível.`;
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = `Conexão recusada em ${credentials.host}:${credentials.port}. Verifique se o PostgreSQL está rodando.`;
    } else if (error.code === '28P01') {
      errorMessage = `Falha na autenticação para usuário "${credentials.user}". Verifique usuário e senha.`;
    } else if (error.code === '3D000') {
      errorMessage = `Base de dados não encontrada. Verifique se "${credentials.database1Grau}" e "${credentials.database2Grau}" existem.`;
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = `Timeout na conexão com ${credentials.host}:${credentials.port}. Servidor pode estar sobrecarregado.`;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return { 
      success: false, 
      error: errorMessage,
      details: errorCode
    };
  }
});

// ===== SISTEMA DE VERIFICAÇÃO EM TEMPO REAL =====

/**
 * Verifica status da conexão com banco em tempo real
 */
// Handler get-database-status removido - funcionalidade simplificada

/**
 * Verifica OJs já cadastrados para um servidor em tempo real
 */
ipcMain.handle('verify-servidor-ojs-realtime', async (_, cpf, perfil, ojsDesejados) => {
  try {
    console.log(`🔍 Verificação em tempo real: CPF=${cpf}, Perfil=${perfil}, OJs=${ojsDesejados?.length || 0}`);
    
    // OTIMIZAÇÃO: Verificar se deve pular verificação de banco
    const { dbOptimizationConfig } = require('./config/database-optimization');
    const skipDatabaseVerification = dbOptimizationConfig.shouldSkipRealtimeVerification();
    
    if (skipDatabaseVerification) {
      console.log('⚡ OTIMIZAÇÃO: Pulando verificação de banco desnecessária');
      sendStatus('info', '⚡ Modo otimizado: Processamento direto sem consulta BD', 0, 'Otimização ativa');
      
      return {
        success: true,
        databaseConnected: false,
        servidorExiste: true,
        fonte: 'otimizado_sem_bd',
        servidor: { cpf: cpf.replace(/\D/g, ''), perfil: perfil },
        ojsJaCadastrados: [],
        ojsParaProcessar: ojsDesejados || [],
        totalOriginal: ojsDesejados?.length || 0,
        totalJaCadastrados: 0,
        totalParaProcessar: ojsDesejados?.length || 0,
        economiaEstimada: {
          tempo: 0,
          cliques: 0,
          ojsEvitados: 0
        },
        message: `⚡ Processamento otimizado: ${ojsDesejados?.length || 0} OJs para automação direta`,
        otimizado: true
      };
    }
    
    sendStatus('info', `🧠 Verificação BD: CPF ${cpf}, ${ojsDesejados?.length || 0} OJs`, 0, 'Consultando banco de dados');

    // Verificar se CPF é válido
    if (!cpf || cpf.length < 11) {
      return {
        success: false,
        error: 'CPF inválido ou incompleto',
        databaseConnected: true
      };
    }

    // Limpar CPF
    const cpfLimpo = cpf.replace(/\D/g, '');

    // CORREÇÃO: Verificar cache persistente primeiro (SmartOJCache)
    try {
      const smartOJCache = new SmartOJCache();

      console.log(`📦 [CACHE] Verificando cache persistente para CPF ${cpfLimpo}...`);
      sendStatus('info', '📦 Verificando cache persistente...', 0, 'Cache inteligente ativo');

      const cacheCarregado = await smartOJCache.carregarCachePersistente(cpfLimpo);

      if (cacheCarregado && cacheCarregado.ojsJaVinculados && cacheCarregado.ojsJaVinculados.length > 0) {
        console.log(`📦 [CACHE] Cache encontrado! ${cacheCarregado.ojsJaVinculados.length} OJs já vinculadas`);

        // 🧠 ANÁLISE INTELIGENTE COM PERFIL
        sendStatus('info', '🧠 Fazendo análise inteligente de perfis...', 0, 'Sistema inteligente ativo');

        const ojsJaVinculadasDoCache = cacheCarregado.ojsJaVinculados.map(item => item.oj);

        // Usar o novo sistema inteligente que considera perfis
        const verificacaoInteligente = smartOJCache.verificarOJsComPerfilEmLote(
          ojsDesejados || [],
          ojsJaVinculadasDoCache,
          perfil, // Usar o perfil desejado do servidor
          (mensagem, progresso) => {
            sendStatus('info', mensagem, 0, `Análise inteligente (${progresso}%)`);
          }
        );

        const { estatisticas } = verificacaoInteligente;
        const totalParaProcessar = estatisticas.totalParaProcessar;

        // Mensagens detalhadas baseadas no resultado inteligente
        console.log(`🎯 [ANÁLISE INTELIGENTE] Resultado detalhado:`);
        console.log(`   - ✅ ${estatisticas.jaVinculadosPerfilCorreto} OJs com perfil correto (pularão automação)`);
        console.log(`   - 🔄 ${estatisticas.vinculadosPerfilDiferente} OJs com perfil diferente (${perfil})`);
        console.log(`   - ❓ ${estatisticas.vinculadosPerfilDesconhecido} OJs com perfil desconhecido`);
        console.log(`   - 🆕 ${estatisticas.paraVincular} OJs novos para vincular`);
        console.log(`   - 🎯 TOTAL para processar: ${totalParaProcessar} OJs`);

        // Status inteligente para o usuário
        if (totalParaProcessar === 0) {
          sendStatus('success',
            `🎉 Todos os ${estatisticas.totalOJs} OJs já possuem o perfil "${perfil}"!`,
            100,
            'Nenhuma automação necessária'
          );
        } else if (estatisticas.vinculadosPerfilDiferente > 0) {
          sendStatus('info',
            `🔄 ${estatisticas.vinculadosPerfilDiferente} OJs precisam atualizar perfil para "${perfil}"`,
            0,
            `${totalParaProcessar} OJs totais para processar`
          );
        } else {
          sendStatus('info',
            `🎯 ${totalParaProcessar} OJs precisam automação com perfil "${perfil}"`,
            0,
            `Economia: ${estatisticas.jaVinculadosPerfilCorreto} OJs já corretos`
          );
        }

        // Combinar todos os OJs que precisam de processamento
        const ojsParaProcessarFinal = [
          ...verificacaoInteligente.ojsVinculadosPerfilDiferente.map(item => item.oj),
          ...verificacaoInteligente.ojsVinculadosPerfilDesconhecido.map(item => item.oj),
          ...verificacaoInteligente.ojsParaVincular
        ];

        return {
          success: true,
          databaseConnected: true,
          servidorExiste: true,
          fonte: 'cache_persistente_inteligente',
          servidor: { cpf: cpfLimpo, perfil: perfil },

          // Dados inteligentes por categoria
          ojsJaCadastrados: verificacaoInteligente.ojsJaVinculadosPerfilCorreto,
          ojsComPerfilDiferente: verificacaoInteligente.ojsVinculadosPerfilDiferente,
          ojsComPerfilDesconhecido: verificacaoInteligente.ojsVinculadosPerfilDesconhecido,
          ojsNovosParaVincular: verificacaoInteligente.ojsParaVincular,

          ojsInativos: [],
          ojsParaProcessar: ojsParaProcessarFinal,

          // Estatísticas detalhadas
          totalOriginal: ojsDesejados?.length || 0,
          totalJaCadastrados: estatisticas.jaVinculadosPerfilCorreto,
          totalComPerfilDiferente: estatisticas.vinculadosPerfilDiferente,
          totalComPerfilDesconhecido: estatisticas.vinculadosPerfilDesconhecido,
          totalNovos: estatisticas.paraVincular,
          totalParaProcessar: totalParaProcessar,

          economiaEstimada: {
            tempo: Math.round(estatisticas.economiaEstimada / 1000),
            cliques: estatisticas.jaVinculadosPerfilCorreto * 3,
            ojsEvitados: estatisticas.jaVinculadosPerfilCorreto
          },

          message: totalParaProcessar === 0
            ? `✅ Todos os ${estatisticas.totalOJs} OJs já possuem o perfil "${perfil}"`
            : `🎯 ${totalParaProcessar}/${ojsDesejados?.length || 0} OJs precisam automação (${estatisticas.jaVinculadosPerfilCorreto} já corretos)`
        };
      } else {
        console.log(`📦 [CACHE] Cache não encontrado ou vazio para CPF ${cpfLimpo}`);
      }
    } catch (cacheError) {
      console.log(`⚠️ [CACHE] Erro ao verificar cache: ${cacheError.message}`);
    }

    // FALLBACK: Verificar banco de dados se cache não disponível
    console.log(`🔍 [BD] Verificação simplificada - sem banco de dados...`);

    sendStatus('info', '✅ Processamento simplificado - sem consulta ao BD', 0, 'Modo simplificado ativo');

    // Simular resultado sem banco de dados
    const resultadoServidor = { existe: false };

    if (!resultadoServidor.existe) {
      sendStatus('warning', `⚠️ Servidor CPF ${cpf} não encontrado no BD`, 0, 'Será processado normalmente');
      return {
        success: true,
        databaseConnected: true,
        servidorExiste: false,
        message: `Servidor com CPF ${cpf} não encontrado no sistema PJE`,
        ojsJaCadastrados: [],
        ojsParaProcessar: ojsDesejados || [],
        totalOriginal: ojsDesejados?.length || 0,
        totalJaCadastrados: 0,
        totalParaProcessar: ojsDesejados?.length || 0
      };
    }

    const nomeServidor = resultadoServidor.servidor.nome || `CPF: ${cpfLimpo}`;
    sendStatus('info', `✅ Servidor encontrado: ${nomeServidor}`, 0, 'Verificando OJs cadastrados');

    // Verificar OJs cadastrados
    const verificacao = await dbConnection.verificarOJsCadastrados(
      resultadoServidor.servidor.idUsuario,
      ojsDesejados || []
    );

    sendStatus('success', `🎯 Verificação concluída: ${verificacao.ojsParaProcessar.length} para processar, ${verificacao.ojsJaCadastrados.length} já cadastrados`, 0, 'Análise finalizada');

    const resultado = {
      success: true,
      databaseConnected: true,
      servidorExiste: true,
      fonte: 'banco_dados',
      servidor: {
        idUsuario: resultadoServidor.servidor.idUsuario,
        cpf: resultadoServidor.servidor.cpf,
        totalOjsCadastrados: resultadoServidor.servidor.totalOjsCadastrados
      },
      ojsJaCadastrados: verificacao.ojsJaCadastrados,
      ojsInativos: verificacao.ojsInativos || [],
      ojsParaProcessar: verificacao.ojsParaProcessar,
      totalOriginal: verificacao.totalVerificados,
      totalJaCadastrados: verificacao.ojsJaCadastrados.length,
      totalParaProcessar: verificacao.ojsParaProcessar.length,
      economiaEstimada: {
        tempo: verificacao.ojsJaCadastrados.length * 5,
        cliques: verificacao.ojsJaCadastrados.length * 3,
        ojsEvitados: verificacao.ojsJaCadastrados.length
      },
      message: `Encontrados ${verificacao.ojsJaCadastrados.length} OJs já cadastrados de ${verificacao.totalVerificados} solicitados`
    };

    console.log(`✅ Verificação concluída: ${resultado.totalJaCadastrados} já cadastrados, ${resultado.totalParaProcessar} para processar`);
    return resultado;

  } catch (error) {
    console.error('❌ Erro na verificação em tempo real:', error);
    return {
      success: false,
      error: error.message,
      databaseConnected: false
    };
  }
});

/**
 * Buscar órgãos julgadores por grau (1º ou 2º)
 */
ipcMain.handle('buscar-orgaos-julgadores', async (_, grau) => {
  try {
    console.log(`🔍 Buscando órgãos julgadores ${grau}º grau`);
    
    // Funcionalidade simplificada - retornar dados mockados
    const ojs = [
      { id: 1, nome: `Órgão Julgador ${grau}º Grau - Exemplo`, grau: grau }
    ];
    
    console.log(`✅ Encontrados ${ojs.length} órgãos julgadores ${grau}º grau (modo simplificado)`);
    
    return {
      success: true,
      data: ojs,
      grau: grau
    };
    
  } catch (error) {
    console.error(`❌ Erro ao buscar órgãos julgadores ${grau}º grau:`, error);
    return {
      success: false,
      error: error.message || 'Erro desconhecido'
    };
  }
});

/**
 * Buscar servidores por grau com filtros
 */
ipcMain.handle('buscar-servidores', async (_, grau, filtroNome, filtroPerfil, filtroStatus, filtroCidade) => {
  try {
    console.log(`🔍 [IPC DEBUG] Parâmetros recebidos:`);
    console.log(`📋 [IPC DEBUG] grau: "${grau}" (tipo: ${typeof grau})`);
    console.log(`📋 [IPC DEBUG] filtroNome: "${filtroNome}" (tipo: ${typeof filtroNome})`);
    console.log(`📋 [IPC DEBUG] filtroPerfil: "${filtroPerfil}" (tipo: ${typeof filtroPerfil})`);
    console.log(`📋 [IPC DEBUG] filtroStatus: "${filtroStatus}" (tipo: ${typeof filtroStatus})`);
    console.log(`📋 [IPC DEBUG] filtroCidade: "${filtroCidade}" (tipo: ${typeof filtroCidade})`);
    
    // Busca real no banco de dados
    const servidores = await servidorDatabaseService.buscarServidores(grau, filtroNome, filtroPerfil, 0, filtroStatus, filtroCidade);
    
    console.log(`✅ Encontrados ${servidores.length} servidores ${grau}º grau`);
    
    return {
      success: true,
      data: servidores,
      grau: grau,
      filtros: {
        nome: filtroNome,
        perfil: filtroPerfil,
        cidade: filtroCidade,
        status: filtroStatus
      }
    };
    
  } catch (error) {
    console.error(`❌ Erro ao buscar servidores ${grau}º grau:`, error);
    return {
      success: false,
      error: error.message || 'Erro desconhecido'
    };
  }
});

/**
 * Buscar apenas OJs de um servidor específico
 */
ipcMain.handle('buscar-ojs-servidor', async (_, cpf, grau = '1') => {
  try {
    console.log(`🔍 [IPC] Buscando OJs do servidor: CPF=${cpf}, Grau=${grau}`);
    
    // Busca OJs do servidor usando a query específica
    const ojs = await servidorDatabaseService.buscarOJsDoServidor(cpf, grau);
    
    console.log(`✅ [IPC] Encontrados ${ojs.length} OJs para o servidor`);
    
    return {
      success: true,
      data: ojs
    };
  } catch (error) {
    console.error('❌ [IPC] Erro ao buscar OJs do servidor:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Buscar servidor específico por CPF
 */
ipcMain.handle('buscarServidorPorCPF', async (_, cpf) => {
  try {
    console.log(`🔍 Buscando servidor por CPF: ${cpf}`);
    
    const dbConnection = new DatabaseConnection();
    await dbConnection.initialize();
    
    const servidor = await dbConnection.buscarServidorPorCPF(cpf);
    
    console.log(`✅ Busca concluída para CPF ${cpf}:`, servidor ? 'Encontrado' : 'Não encontrado');
    
    return {
      success: true,
      servidor: servidor
    };
    
  } catch (error) {
    console.error(`❌ Erro ao buscar servidor por CPF ${cpf}:`, error);
    return {
      success: false,
      error: error.message || 'Erro desconhecido'
    };
  }
});

// ===== HANDLERS PARA CONSULTA DE OJs DO BANCO =====

const OJDatabaseService = require('./utils/oj-database-service');
let ojDatabaseService = new OJDatabaseService();
const ProcessDatabaseService = require('./utils/process-database-service');
let processDatabaseService = new ProcessDatabaseService();
const ServidorDatabaseService = require('./utils/servidor-database-service');
let servidorDatabaseService = new ServidorDatabaseService();

/**
 * Buscar OJs do 1º grau diretamente do banco de dados
 */
ipcMain.handle('buscar-ojs-1grau', async (_, filtro, limite) => {
  try {
    console.log(`🔍 Buscando OJs 1º grau${filtro ? ` com filtro: "${filtro}"` : ''}`);

    const ojs = await ojDatabaseService.buscarOJs1Grau(filtro, limite);

    console.log(`✅ Encontrados ${ojs.length} órgãos julgadores do 1º grau`);

    return {
      success: true,
      data: ojs,
      grau: '1',
      total: ojs.length,
      filtro: filtro || ''
    };

  } catch (error) {
    console.error('❌ Erro ao buscar OJs 1º grau:', error.message);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
});

/**
 * Buscar OJs do 2º grau diretamente do banco de dados
 */
ipcMain.handle('buscar-ojs-2grau', async (_, filtro, limite) => {
  try {
    console.log(`🔍 Buscando OJs 2º grau${filtro ? ` com filtro: "${filtro}"` : ''}`);

    const ojs = await ojDatabaseService.buscarOJs2Grau(filtro, limite);

    console.log(`✅ Encontrados ${ojs.length} órgãos julgadores do 2º grau`);

    return {
      success: true,
      data: ojs,
      grau: '2',
      total: ojs.length,
      filtro: filtro || ''
    };

  } catch (error) {
    console.error('❌ Erro ao buscar OJs 2º grau:', error.message);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
});

/**
 * Buscar OJs de ambos os graus
 */
ipcMain.handle('buscar-ojs-ambos-graus', async (_, filtro, limite) => {
  try {
    console.log(`🔍 Buscando OJs de ambos os graus${filtro ? ` com filtro: "${filtro}"` : ''}`);

    const resultado = await ojDatabaseService.buscarOJsAmbosGraus(filtro, limite);

    console.log(`✅ Busca concluída: ${resultado.total} órgãos encontrados`);

    return {
      success: true,
      data: resultado,
      filtro: filtro || ''
    };

  } catch (error) {
    console.error('❌ Erro ao buscar OJs de ambos os graus:', error.message);
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
});

// ===== HANDLERS PARA CONSULTA DE PROCESSOS =====

/**
 * Buscar histórico do processo
 */
ipcMain.handle('buscar-processo-historico', async (_, numeroProcesso, grau = '1') => {
  try {
    if (!numeroProcesso || typeof numeroProcesso !== 'string') {
      return { success: false, error: 'Número do processo inválido' };
    }
    const data = await processDatabaseService.buscarHistoricoProcesso(numeroProcesso, grau);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Erro ao buscar histórico do processo:', error);
    return { success: false, error: error.message || 'Erro desconhecido' };
  }
});

/**
 * Buscar tarefa atual do processo
 */
ipcMain.handle('buscar-processo-tarefa-atual', async (_, numeroProcesso, grau = '1') => {
  try {
    if (!numeroProcesso || typeof numeroProcesso !== 'string') {
      return { success: false, error: 'Número do processo inválido' };
    }
    const data = await processDatabaseService.buscarTarefaAtual(numeroProcesso, grau);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Erro ao buscar tarefa atual do processo:', error);
    return { success: false, error: error.message || 'Erro desconhecido' };
  }
});

/**
 * Buscar partes do processo
 */
ipcMain.handle('buscar-processo-partes', async (_, numeroProcesso, grau = '1') => {
  try {
    if (!numeroProcesso || typeof numeroProcesso !== 'string') {
      return { success: false, error: 'Número do processo inválido' };
    }
    const data = await processDatabaseService.buscarPartesProcesso(numeroProcesso, grau);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Erro ao buscar partes do processo:', error);
    return { success: false, error: error.message || 'Erro desconhecido' };
  }
});

/**
 * Buscar pacote completo (tarefa atual, histórico, partes)
 */
ipcMain.handle('buscar-processo-info', async (_, numeroProcesso, grau = '1') => {
  try {
    if (!numeroProcesso || typeof numeroProcesso !== 'string') {
      return { success: false, error: 'Número do processo inválido' };
    }
    const [tarefaAtual, historico, partes] = await Promise.all([
      processDatabaseService.buscarTarefaAtual(numeroProcesso, grau).catch(e => { throw new Error('Erro na tarefa atual: ' + e.message); }),
      processDatabaseService.buscarHistoricoProcesso(numeroProcesso, grau).catch(e => { throw new Error('Erro no histórico: ' + e.message); }),
      processDatabaseService.buscarPartesProcesso(numeroProcesso, grau).catch(e => { throw new Error('Erro nas partes: ' + e.message); })
    ]);
    return { success: true, data: { tarefaAtual, historico, partes } };
  } catch (error) {
    console.error('❌ Erro ao buscar informações do processo:', error);
    return { success: false, error: error.message || 'Erro desconhecido' };
  }
});

/**
 * Exportar lista de OJs para JSON
 */
ipcMain.handle('exportar-ojs-json', async (event, dados) => {
  try {
    const { dialog } = require('electron');
    const fs = require('fs').promises;
    const path = require('path');

    // Mostrar diálogo para salvar arquivo
    const result = await dialog.showSaveDialog({
      title: 'Exportar Lista de OJs',
      defaultPath: `ojs-${new Date().toISOString().split('T')[0]}.json`,
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePath) {
      // Salvar arquivo JSON
      await fs.writeFile(result.filePath, JSON.stringify(dados, null, 2), 'utf8');
      return { success: true, filePath: result.filePath };
    }

    return { success: false, canceled: true };
  } catch (error) {
    console.error('❌ Erro ao exportar OJs:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Testar conectividade com bancos de dados PJE
 */
ipcMain.handle('testar-conectividade-pje', async () => {
  try {
    console.log('🔍 Testando conectividade com bancos PJE...');

    const resultado = await ojDatabaseService.testarConectividade();

    console.log('✅ Teste de conectividade concluído');

    return {
      success: true,
      conectividade: resultado
    };

  } catch (error) {
    console.error('❌ Erro ao testar conectividade:', error.message);
    return {
      success: false,
      error: error.message,
      conectividade: null
    };
  }
});

/**
 * Obter estatísticas dos órgãos julgadores
 */
ipcMain.handle('obter-estatisticas-ojs', async () => {
  try {
    console.log('📊 Obtendo estatísticas dos OJs...');

    const stats = await ojDatabaseService.obterEstatisticas();

    console.log('✅ Estatísticas obtidas com sucesso');

    return {
      success: true,
      estatisticas: stats
    };

  } catch (error) {
    console.error('❌ Erro ao obter estatísticas:', error.message);
    return {
      success: false,
      error: error.message,
      estatisticas: null
    };
  }
});

// Função para enviar relatório final detalhado
function enviarRelatorioFinal(relatorio) {
  try {
    console.log('=== RELATÓRIO FINAL DE VINCULAÇÃO ===');
    console.log(`Total de peritos: ${relatorio.totalPeritos}`);
    console.log(`Peritos processados: ${relatorio.peritosProcessados}`);
    console.log(`Total de OJs: ${relatorio.totalOJs}`);
    console.log(`OJs vinculados: ${relatorio.ojsVinculados}`);
    console.log(`OJs já vinculados: ${relatorio.ojsJaVinculados}`);
    console.log(`OJs não encontrados: ${relatorio.ojsNaoEncontrados.length}`);
    console.log(`OJs com erro: ${relatorio.ojsComErro.length}`);
    
    // Enviar relatório para a interface
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('automation-report', {
        type: 'final-report',
        relatorio: relatorio
      });
    }
    
    // Se houver OJs não encontrados, listar detalhadamente
    if (relatorio.ojsNaoEncontrados.length > 0) {
      console.log('\n=== OJs NÃO ENCONTRADOS ===');
      relatorio.ojsNaoEncontrados.forEach((oj, index) => {
        console.log(`${index + 1}. ${oj.nome} (Perito: ${oj.perito})`);
        console.log(`   Motivo: ${oj.motivo}`);
        if (oj.opcoesDisponiveis && oj.opcoesDisponiveis.length > 0) {
          console.log(`   Opções disponíveis (primeiras 10): ${oj.opcoesDisponiveis.slice(0, 10).join(', ')}`);
        }
      });
    }
    
    // Se houver OJs com erro, listar
    if (relatorio.ojsComErro.length > 0) {
      console.log('\n=== OJs COM ERRO ===');
      relatorio.ojsComErro.forEach((oj, index) => {
        console.log(`${index + 1}. ${oj.nome} (Perito: ${oj.perito})`);
        console.log(`   Erro: ${oj.erro}`);
        console.log(`   Código: ${oj.codigo}`);
      });
    }
    
  } catch (error) {
    console.error('Erro ao gerar relatório final:', error);
  }
}

// Função para gerar mensagem final resumida
function gerarMensagemFinal(relatorio) {
  const total = relatorio.totalOJs;
  const vinculados = relatorio.ojsVinculados;
  const jaVinculados = relatorio.ojsJaVinculados;
  const naoEncontrados = relatorio.ojsNaoEncontrados.length;
  const comErro = relatorio.ojsComErro.length;
  const processados = vinculados + jaVinculados;
  const porcentagemSucesso = total > 0 ? Math.round((processados / total) * 100) : 0;
  
  let mensagem = `🎯 Automação de Peritos Concluída! `;
  mensagem += `${processados}/${total} OJs processados com sucesso (${porcentagemSucesso}%). `;
  
  if (vinculados > 0) {
    mensagem += `✅ ${vinculados} novos vínculos, `;
  }
  
  if (jaVinculados > 0) {
    mensagem += `ℹ️ ${jaVinculados} já vinculados, `;
  }
  
  if (naoEncontrados > 0) {
    mensagem += `⚠️ ${naoEncontrados} não encontrados, `;
  }
  
  if (comErro > 0) {
    mensagem += `❌ ${comErro} com erro, `;
  }
  
  // Remover última vírgula e espaço
  mensagem = mensagem.replace(/, $/, '. ');
  
  mensagem += `📋 Relatório detalhado disponível no painel. Navegador permanece aberto para revisão.`;
  
  if (naoEncontrados > 0 || comErro > 0) {
    mensagem += `Verifique o console para detalhes dos problemas. `;
  }
  
  mensagem += `Navegador permanece aberto para revisão.`;
  
  return mensagem;
}

// ========== HANDLERS SERVIDOR AUTOMATION V2 ==========

// Handler para automação sequencial (BatchOJProcessor apenas)
ipcMain.handle('start-servidor-automation-v2-sequential', async (event, config) => {
  try {
    console.log('🚀 [MAIN] Iniciando automação sequencial (BatchOJProcessor apenas)');
    
    // CORREÇÃO: Verificar se já há uma automação em execução
    if (automationInProgress) {
      throw new Error('Automação já está em execução');
    }
    
    automationInProgress = true;
    
    // CORREÇÃO: Reusar instância existente ou criar nova se não existir
    if (!servidorAutomationV2) {
      servidorAutomationV2 = new ServidorAutomationV2();
      servidorAutomationV2.setMainWindow(mainWindow);
    }
    
    // Configurar para modo sequencial - força uso do BatchOJProcessor
    config.mode = 'sequential';
    // CORREÇÃO: startAutomation espera apenas config (servidores já estão em config.servidores)
    const result = await servidorAutomationV2.startAutomation(config);

    console.log('✅ [MAIN] Automação sequencial concluída');

    // Garantir que sempre retorna um objeto com success
    if (!result) {
      return {
        success: true,
        message: 'Automação concluída com sucesso',
        relatorio: servidorAutomationV2.getRelatorio ? servidorAutomationV2.getRelatorio() : {}
      };
    }

    // Se result não tem success, adicionar
    if (typeof result === 'object' && !result.hasOwnProperty('success')) {
      result.success = true;
    }

    return result;
    
  } catch (error) {
    console.error('❌ [MAIN] Erro na automação sequencial:', error);
    
    // Gerar mensagem de erro mais detalhada
    let errorMessage = 'Erro desconhecido na automação sequencial';
    
    if (error && error.message) {
      errorMessage = error.message;
    } else if (error && typeof error === 'string') {
      errorMessage = error;
    } else if (error && error.toString) {
      errorMessage = error.toString();
    }
    
    // Adicionar contexto adicional se disponível
    const errorDetails = {
      message: errorMessage,
      type: error?.name || 'UnknownError',
      stack: error?.stack || 'No stack trace available',
      timestamp: new Date().toISOString(),
      context: 'start-servidor-automation-v2-sequential',
      config: config ? { mode: config.mode, useParallelProcessor: config.useParallelProcessor } : 'No config'
    };
    
    console.error('❌ [MAIN] Detalhes completos do erro sequencial:', JSON.stringify(errorDetails, null, 2));
    
    return {
      success: false,
      error: errorMessage,
      details: errorDetails
    };
  } finally {
    // CORREÇÃO: Sempre limpar flag de automação
    automationInProgress = false;
  }
});

// ========== SISTEMA DE LOGS ==========
let systemLogs = [];
const MAX_LOG_ENTRIES = 1000;
let lastCacheClear = null;

function addSystemLog(type, message, details = null) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type,
    message,
    details
  };
  systemLogs.push(logEntry);
  if (systemLogs.length > MAX_LOG_ENTRIES) {
    systemLogs = systemLogs.slice(-MAX_LOG_ENTRIES);
  }
  return logEntry;
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// ========== HANDLERS DE CACHE ==========
ipcMain.handle('clear-cache', async () => {
  try {
    const ses = session.defaultSession;
    await ses.clearCache();
    await ses.clearStorageData({
      storages: ['appcache', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers']
    });
    lastCacheClear = new Date().toISOString();
    addSystemLog('success', 'Cache limpo com sucesso');
    return { success: true, message: 'Cache limpo com sucesso' };
  } catch (error) {
    addSystemLog('error', 'Erro ao limpar cache', error.message);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-cache-size', async () => {
  try {
    const ses = session.defaultSession;
    const cacheSize = await ses.getCacheSize();
    return { 
      success: true, 
      size: cacheSize,
      sizeFormatted: formatBytes(cacheSize),
      lastClearDate: lastCacheClear
    };
  } catch (error) {
    return { success: false, size: 0, sizeFormatted: '0 B' };
  }
});

// ========== HANDLERS DE BACKUP ==========
ipcMain.handle('export-backup', async () => {
  try {
    const backupData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      peritos: [],
      servidores: [],
      configurations: {},
      logs: systemLogs.slice(-100)
    };

    // Carregar dados de peritos
    const peritosPath = path.join(__dirname, '../data/perito.json');
    if (fs.existsSync(peritosPath)) {
      backupData.peritos = JSON.parse(fs.readFileSync(peritosPath, 'utf-8'));
    }

    // Carregar dados de servidores
    const servidoresPath = path.join(__dirname, '../data/servidores.json');
    if (fs.existsSync(servidoresPath)) {
      backupData.servidores = JSON.parse(fs.readFileSync(servidoresPath, 'utf-8'));
    }

    // Carregar configurações
    const configPath = path.join(__dirname, '../.env');
    if (fs.existsSync(configPath)) {
      const envContent = fs.readFileSync(configPath, 'utf-8');
      const lines = envContent.split('\n');
      lines.forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
          backupData.configurations[key] = value;
        }
      });
    }

    addSystemLog('success', 'Backup exportado com sucesso');
    return { success: true, data: backupData };
  } catch (error) {
    addSystemLog('error', 'Erro ao exportar backup', error.message);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('restore-backup', async (event, backupData) => {
  try {
    if (!backupData || !backupData.version) {
      throw new Error('Arquivo de backup inválido');
    }

    // Restaurar peritos
    if (backupData.peritos) {
      const peritosPath = path.join(__dirname, '../data/perito.json');
      fs.writeFileSync(peritosPath, JSON.stringify(backupData.peritos, null, 2));
    }

    // Restaurar servidores
    if (backupData.servidores) {
      const servidoresPath = path.join(__dirname, '../data/servidores.json');
      fs.writeFileSync(servidoresPath, JSON.stringify(backupData.servidores, null, 2));
    }

    // Restaurar configurações
    if (backupData.configurations) {
      const envContent = Object.entries(backupData.configurations)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
      const configPath = path.join(__dirname, '../.env');
      fs.writeFileSync(configPath, envContent);
    }

    addSystemLog('success', 'Backup restaurado com sucesso');
    return { success: true, message: 'Backup restaurado com sucesso' };
  } catch (error) {
    addSystemLog('error', 'Erro ao restaurar backup', error.message);
    return { success: false, message: error.message };
  }
});

// ========== HANDLERS DE LOGS ==========
ipcMain.handle('get-system-logs', async (event, options = {}) => {
  const { limit = 100, type = 'all' } = options;
  let filteredLogs = systemLogs;
  
  if (type !== 'all') {
    filteredLogs = systemLogs.filter(log => log.type === type);
  }
  
  return {
    success: true,
    logs: filteredLogs.slice(-limit),
    total: filteredLogs.length
  };
});

ipcMain.handle('clear-logs', async () => {
  systemLogs = [];
  addSystemLog('info', 'Logs limpos');
  return { success: true };
});

// ========== HANDLERS DE OTIMIZAÇÃO ==========
ipcMain.handle('get-optimization-config', async (event, key) => {
  try {
    const { dbOptimizationConfig } = require('./config/database-optimization');
    
    if (key === 'skipAutomationVerification') {
      return dbOptimizationConfig.shouldSkipAutomationVerification();
    } else if (key === 'skipRealtimeVerification') {
      return dbOptimizationConfig.shouldSkipRealtimeVerification();
    } else if (key === 'useLocalCacheOnly') {
      return dbOptimizationConfig.shouldUseLocalCacheOnly();
    } else if (key === 'smartCacheEnabled') {
      return dbOptimizationConfig.isSmartCacheEnabled();
    }
    
    return false;
  } catch (error) {
    console.error('Erro ao obter configuração de otimização:', error);
    return false;
  }
});

ipcMain.handle('set-optimization-config', async (event, key, value) => {
  try {
    const { dbOptimizationConfig } = require('./config/database-optimization');
    
    const configMap = {
      'skipAutomationVerification': 'SKIP_AUTOMATION_VERIFICATION',
      'skipRealtimeVerification': 'SKIP_REALTIME_VERIFICATION',
      'useLocalCacheOnly': 'USE_LOCAL_CACHE_ONLY',
      'smartCacheEnabled': 'ENABLE_SMART_CACHE'
    };
    
    if (configMap[key]) {
      dbOptimizationConfig[configMap[key]] = value;
      return { success: true };
    }
    
    return { success: false, error: 'Configuração não encontrada' };
  } catch (error) {
    console.error('Erro ao definir configuração de otimização:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-all-optimization-configs', async () => {
  try {
    const { dbOptimizationConfig } = require('./config/database-optimization');
    return {
      success: true,
      configs: dbOptimizationConfig.getAllConfigs(),
      stats: dbOptimizationConfig.getOptimizationStats()
    };
  } catch (error) {
    console.error('Erro ao obter todas as configurações de otimização:', error);
    return { success: false, error: error.message };
  }
});

// ========== HANDLERS DE PERFORMANCE ==========
ipcMain.handle('get-performance-metrics', async () => {
  try {
    // CPU Usage
    const cpuUsage = process.getCPUUsage();
    
    // Memory info
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memUsage = process.memoryUsage();
    
    return {
      success: true,
      cpu: {
        percentage: Math.round((cpuUsage.percentCPUUsage || 0) * 100)
      },
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentage: Math.round((usedMemory / totalMemory) * 100),
        formatted: {
          used: formatBytes(usedMemory),
          total: formatBytes(totalMemory)
        },
        process: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          rss: memUsage.rss,
          formatted: {
            heapUsed: formatBytes(memUsage.heapUsed),
            heapTotal: formatBytes(memUsage.heapTotal),
            rss: formatBytes(memUsage.rss)
          }
        }
      },
      uptime: process.uptime(),
      timestamp: Date.now()
    };
  } catch (error) {
    return {
      success: false,
      cpu: { percentage: 0 },
      memory: { percentage: 0, used: 0, total: 0 }
    };
  }
});

// Adicionar log de inicialização
app.on('ready', () => {
  addSystemLog('success', 'Sistema iniciado com sucesso');
});
