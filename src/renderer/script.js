class PeritoApp {
  constructor() {
    this.peritos = [];
    this.servidores = [];
    this.selectedPeritos = [];
    this.selectedServidores = [];
    this.currentEditingIndex = -1;
    this.currentEditingServidorIndex = -1;
    this.isAutomationRunning = false;
    this.currentProgress = 0;
    this.totalSteps = 0;
    
    // Timer de automação
    this.automationStartTime = null;
    this.automationTimer = null;
    
    // Visual status tracking
    this.currentDetailedStatus = {
      servidor: '',
      orgaoJulgador: '',
      startTime: null,
      currentStep: '',
      isProcessing: false
    };
    
    // Sistema de memória/histórico
    this.cpfHistory = [];
    this.ojHistory = [];
    this.profileHistory = [];
    
    // Controle de pausa/retomada
    this.isPaused = false;
    this.isServidorPaused = false;
    this.pausedState = null;
    this.pausedServidorState = null;
    
    // Sistema de normalização de OJs
    this.normalizedOJs = new Map(); // Mapa para normalização de OJs
    this.ojsData = []; // Dados do arquivo ojs1g.json
    this.ojsSearchIndex = new Map(); // Índice para busca rápida
    
    // Controle de debounce para botões de automação
    this.automationDebounceTime = 2000; // 2 segundos
    this.lastAutomationClick = 0;
    this.lastServidorAutomationClick = 0;
    
    this.init();
  }

  /**
   * Função de debounce para evitar cliques múltiplos nos botões de automação
   * @param {string} type - Tipo de automação ('perito' ou 'servidor')
   * @returns {boolean} - true se pode executar, false se deve aguardar
   */
  canExecuteAutomation(type) {
    const now = Date.now();
    const lastClickProperty = type === 'perito' ? 'lastAutomationClick' : 'lastServidorAutomationClick';
    
    if (now - this[lastClickProperty] < this.automationDebounceTime) {
      const remainingTime = Math.ceil((this.automationDebounceTime - (now - this[lastClickProperty])) / 1000);
      this.showNotification(`Aguarde ${remainingTime} segundos antes de iniciar outra automação`, 'warning');
      return false;
    }
    
    this[lastClickProperty] = now;
    return true;
  }

  // Métodos de controle dos indicadores visuais de estado
  updateAutomationStatus(type, status, message) {
    const indicatorId = type === 'perito' ? 'perito-status-indicator' : 'servidor-status-indicator';
    const detailsId = type === 'perito' ? 'perito-status-details' : 'servidor-status-details';
    
    const indicator = document.getElementById(indicatorId);
    const details = document.getElementById(detailsId);
    
    if (!indicator || !details) return;
    
    const badge = indicator.querySelector('.status-badge');
    const statusText = badge.querySelector('.status-text');
    const statusMessage = details.querySelector('.status-message');
    
    // Remover classes de status anteriores
    badge.classList.remove('status-idle', 'status-running', 'status-paused', 'status-error', 'status-completed');
    
    // Adicionar nova classe de status
    badge.classList.add(`status-${status}`);
    
    // Atualizar textos
    const statusTexts = {
      idle: 'Inativo',
      running: 'Executando',
      paused: 'Pausado',
      error: 'Erro',
      completed: 'Concluído'
    };
    
    statusText.textContent = statusTexts[status] || status;
    statusMessage.textContent = message || 'Sistema pronto para automação';
    
    // Log do status
    const timestamp = new Date().toLocaleTimeString();
    console.log(`📊 [${timestamp}] STATUS ${type.toUpperCase()}: ${status} - ${message}`);
  }

  setAutomationRunning(type, message = 'Automação em execução...') {
    this.updateAutomationStatus(type, 'running', message);
  }

  setAutomationPaused(type, message = 'Automação pausada') {
    this.updateAutomationStatus(type, 'paused', message);
  }

  setAutomationError(type, message = 'Erro na automação') {
    this.updateAutomationStatus(type, 'error', message);
  }

  setAutomationCompleted(type, message = 'Automação concluída com sucesso') {
    this.updateAutomationStatus(type, 'completed', message);
  }

  setAutomationIdle(type, message = 'Sistema pronto para automação') {
    this.updateAutomationStatus(type, 'idle', message);
  }

  async init() {
    this.setupEventListeners();
    await this.loadPeritos();
    await this.loadServidores();
    await this.loadConfig();
    await this.loadDatabaseConfig(); // Carregar configurações do banco
    await this.loadOJs(); // Carregar lista de OJs
    await this.loadNormalizedOJs(); // Carregar dados de normalização de OJs
    this.loadHistory(); // Carregar histórico
    this.updateSelectedPeritosDisplay();
    this.updateSelectedServidoresDisplay();
    this.updateBulkDeleteButtons();
    this.initTabs();
    this.setupServidorAutomationListeners();
    this.setupServidorV2Listeners();
    this.setupAutocomplete(); // Configurar autocomplete
    this.loadServidorV2Config();
    this.updateV2StatusIndicator();

    // Garantir abas padrão visíveis ao iniciar
    this.switchTab('inicio');
    this.updateDashboardStats(); // Atualizar estatísticas do dashboard
    this.switchConfigTab('sistema');
    this.initializeConfigurationEnhancements(); // Melhorias na configuração

    // Toggle "Mostrar todas as seções"
    const toggleShowAll = document.getElementById('toggleShowAll');
    if (toggleShowAll) {
      const applyToggle = () => {
        if (toggleShowAll.checked) {
          document.body.classList.add('show-all-tabs');
        } else {
          document.body.classList.remove('show-all-tabs');
        }
      };
      toggleShowAll.addEventListener('change', applyToggle);
      // persiste estado em localStorage
      const saved = localStorage.getItem('showAllTabs') === 'true';
      toggleShowAll.checked = saved;
      applyToggle();
      toggleShowAll.addEventListener('change', () => {
        localStorage.setItem('showAllTabs', toggleShowAll.checked ? 'true' : 'false');
      });
    }
    
    // Log de inicialização do sistema de normalização
    if (this.ojsData.length > 0) {
      console.log('✅ Sistema de normalização de OJs carregado com sucesso!');
      console.log(`📊 ${this.ojsData.length} OJs disponíveis para normalização`);
      console.log('\n🧪 Funções disponíveis para teste:');
      console.log('  • testOJNormalization() - Executa testes automáticos');
      console.log('  • normalizeOJ("nome do oj") - Normaliza um OJ específico');
      console.log('  • checkExistingOJs("cpf", ["oj1", "oj2"]) - Verifica OJs já cadastrados');
      console.log('  • processServerWithCheck({cpf, ojs: []}) - Processa servidor com verificação');
      console.log('  • displayOJStatus(result) - Mostra status visual dos OJs');
    } else {
      console.warn('⚠️ Sistema de normalização não foi carregado corretamente');
    }
        
    // Listen for automation status updates
    window.electronAPI.onAutomationStatus((data) => {
      this.addStatusMessage(data.type, data.message);
      this.updateLoadingProgress(data);
    });

    // Listen for automation progress updates
    window.electronAPI.onAutomationProgress((data) => {
      this.updateLoadingProgress(data);
      this.updateDetailedStatus(data);
    });
    
    // Listen for automation reports
    window.electronAPI.onAutomationReport((data) => {
      // Comentado para evitar modal automático na inicialização
      // if (data.type === 'final-report') {
      //   this.showFinalReport(data.relatorio);
      // } else 
      if (data.type === 'error') {
        this.showAutomationError(data.error, data.context);
      }
    });
    
    // Listen for automation errors
    if (window.electronAPI.onAutomationError) {
      window.electronAPI.onAutomationError((error) => {
        this.showAutomationError(error.message, error.context);
      });
    }
  }

  initTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.getAttribute('data-tab');

        // Remove active class from all tabs and contents
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        // Add active class to clicked tab and corresponding content
        tab.classList.add('active');
        document.getElementById(targetTab).classList.add('active');
      });
    });

    // Tabs internas de Servidores
    this.initServidorTabs();

    // Tabs internas de Peritos
    this.initPeritoTabs();
  }

  initServidorTabs() {
    const servidorTabButtons = document.querySelectorAll('.servidor-tab-button');
    const servidorTabContents = document.querySelectorAll('.servidor-tab-content');

    servidorTabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = button.getAttribute('data-servidor-tab');

        // Remove active class from all tabs and contents
        servidorTabButtons.forEach(btn => btn.classList.remove('active'));
        servidorTabContents.forEach(content => content.classList.remove('active'));

        // Add active class to clicked tab and corresponding content
        button.classList.add('active');
        const targetContent = document.getElementById(`servidor-${targetTab}-tab`);
        if (targetContent) {
          targetContent.classList.add('active');
        }

        // Update botão flutuante
        this.updateQuickAutomationButton();
      });
    });

    // Botão flutuante de ação rápida
    const quickAutomationBtn = document.getElementById('quick-automation-btn');
    if (quickAutomationBtn) {
      quickAutomationBtn.addEventListener('click', () => {
        // Ativar tab de automação
        const automacaoTab = document.querySelector('[data-servidor-tab="automacao"]');
        if (automacaoTab) {
          automacaoTab.click();
        }
      });
    }
  }

  initPeritoTabs() {
    const peritoTabButtons = document.querySelectorAll('.perito-tab-button');
    const peritoTabContents = document.querySelectorAll('.perito-tab-content');

    peritoTabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = button.getAttribute('data-perito-tab');

        // Remove active class from all tabs and contents
        peritoTabButtons.forEach(btn => btn.classList.remove('active'));
        peritoTabContents.forEach(content => content.classList.remove('active'));

        // Add active class to clicked tab and corresponding content
        button.classList.add('active');
        const targetContent = document.getElementById(`perito-${targetTab}-tab`);
        if (targetContent) {
          targetContent.classList.add('active');
        }

        // Update botão flutuante
        this.updateQuickPeritoAutomationButton();
      });
    });

    // Botão flutuante de ação rápida para peritos
    const quickPeritoBtn = document.getElementById('quick-perito-automation-btn');
    if (quickPeritoBtn) {
      quickPeritoBtn.addEventListener('click', () => {
        // Ativar tab de automação
        const automacaoTab = document.querySelector('[data-perito-tab="automacao"]');
        if (automacaoTab) {
          automacaoTab.click();
        }
      });
    }
  }

  setupEventListeners() {
    // Tab navigation
    const tabButtons = document.querySelectorAll('.tab-button');
    console.log(`[DEBUG] Tabs encontrados: ${tabButtons.length}`);
    tabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const tab = e.currentTarget?.dataset?.tab || e.target?.dataset?.tab;
        console.log('[DEBUG] Clique na aba principal:', tab);
        this.switchTab(tab);
      });
    });

    // Event listeners para abas de configuração
    const configButtons = document.querySelectorAll('.config-tab-button');
    console.log(`[DEBUG] Sub-abas de configuração encontradas: ${configButtons.length}`);
    configButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const tab = e.currentTarget?.dataset?.configTab || e.target?.dataset?.configTab;
        console.log('[DEBUG] Clique na sub-aba de configuração:', tab);
        this.switchConfigTab(tab);
      });
    });

    // Event listener para o botão de buscar OJs da nova aba Busca OJs
    this.setupBuscaOJsListeners();

    // Perito management
    document.getElementById('add-perito')?.addEventListener('click', () => {
      this.openPeritoModal();
    });

    document.getElementById('import-peritos')?.addEventListener('click', () => {
      this.importPeritos();
    });



    document.getElementById('show-import-example')?.addEventListener('click', () => {
      this.showImportExample();
    });

    document.getElementById('bulk-delete-peritos')?.addEventListener('click', () => {
      this.bulkDeletePeritos();
    });

    // Servidor management
    document.getElementById('add-servidor')?.addEventListener('click', () => {
      this.openServidorModal();
    });

    document.getElementById('import-servidores-bulk')?.addEventListener('click', () => {
      this.importServidores();
    });

    document.getElementById('servidor-import-example')?.addEventListener('click', () => {
      this.showServidorImportExample();
    });

    document.getElementById('bulk-delete-servidores')?.addEventListener('click', () => {
      this.bulkDeleteServidores();
    });

    document.getElementById('verificar-banco')?.addEventListener('click', () => {
      this.verificarBancoDados();
    });

    // Event listeners para processamento paralelo
    this.setupParallelProcessingListeners();
    
    // Event listeners para Central de Configurações
    this.setupConfigurationListeners();

    // Controle de pausa/retomada removido

    // Modal events
    document.querySelectorAll('.close').forEach(closeBtn => {
      closeBtn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) {
          modal.style.display = 'none';
          this.currentEditingIndex = -1;
          this.currentEditingServidorIndex = -1;
        }
      });
    });

    document.getElementById('cancel-perito')?.addEventListener('click', () => {
      this.closePeritoModal();
    });

    document.getElementById('cancel-servidor')?.addEventListener('click', () => {
      this.closeServidorModal();
    });

    document.getElementById('perito-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.savePeito();
    });

    document.getElementById('servidor-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveServidor();
    });

    // Config form
    document.getElementById('config-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveConfig();
    });

    // Save database credentials button
    document.getElementById('saveDbCredentials')?.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Botão de salvar credenciais clicado');
      await this.saveDatabaseConfig();
    });

    // Database config form - backup handler
    document.getElementById('database-config-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Formulário de banco de dados submetido');
      await this.saveDatabaseConfig();
      return false;
    });

    // Test database connection
    document.getElementById('testDbConnection')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Botão de teste de conexão clicado');
      this.testDatabaseConnection();
    });

    // Event listeners para novas abas de configuração
    document.getElementById('carregarOjs1Grau')?.addEventListener('click', () => {
      this.buscarOJsDoBanco('1');
    });

    document.getElementById('buscarTodasOjs1Grau')?.addEventListener('click', () => {
      this.buscarTodasOJsDoBanco('1');
    });

    document.getElementById('carregarOjs2Grau')?.addEventListener('click', () => {
      this.buscarOJsDoBanco('2');
    });

    document.getElementById('buscarTodasOjs2Grau')?.addEventListener('click', () => {
      this.buscarTodasOJsDoBanco('2');
    });

    document.getElementById('testarConexao1Grau')?.addEventListener('click', () => {
      this.testarConectividadeBanco();
    });

    document.getElementById('testarConexao2Grau')?.addEventListener('click', () => {
      this.testarConectividadeBanco();
    });

    document.getElementById('exportarOjs1Grau')?.addEventListener('click', () => {
      this.exportarOJsJSON('1grau');
    });

    document.getElementById('exportarOjs2Grau')?.addEventListener('click', () => {
      this.exportarOJsJSON('2grau');
    });

    document.getElementById('exportarServidores')?.addEventListener('click', () => {
      this.exportarOJsJSON('servidores');
    });



    // Processos - buscar por número
    const buscarProcessoBtn = document.getElementById('buscarProcessoBtn');
    buscarProcessoBtn?.addEventListener('click', () => {
      this.buscarProcesso();
    });

    document.getElementById('buscarServidores')?.addEventListener('click', () => {
      this.buscarServidores();
    });

    document.getElementById('compararServidorLocal')?.addEventListener('click', () => {
      let filtroNome = document.getElementById('filtroNomeServidor').value.trim();
      if (filtroNome) {
        // Se for CPF formatado, remover formatação
        if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(filtroNome)) {
          filtroNome = filtroNome.replace(/\D/g, '');
        }
        
        // Se for CPF, usar diretamente, senão tentar buscar o CPF do primeiro servidor encontrado
        const isCPF = /^\d+$/.test(filtroNome);
        if (isCPF) {
          this.buscarECompararOJs(filtroNome);
        } else {
          // Se for nome, pegar o CPF do primeiro resultado da busca
          if (this.ultimoServidorBuscado) {
            this.buscarECompararOJs(this.ultimoServidorBuscado.cpf);
          } else {
            this.showNotification('Digite um CPF ou busque um servidor primeiro', 'warning');
          }
        }
      }
    });

    document.getElementById('limparFiltrosServidores')?.addEventListener('click', () => {
      this.limparFiltrosServidores();
      // Esconder botão de comparação ao limpar
      const btnComparar = document.getElementById('compararServidorLocal');
      if (btnComparar) btnComparar.style.display = 'none';
      this.ultimoServidorBuscado = null;
    });



    // Event listeners para comparação de OJs
    document.getElementById('compararOJs')?.addEventListener('click', () => {
      this.compararOJs();
    });

    document.getElementById('limparComparacao')?.addEventListener('click', () => {
      this.limparComparacao();
    });

    document.getElementById('gerarAutomacaoFaltantes')?.addEventListener('click', async () => {
      await this.gerarAutomacaoFaltantes();
    });

    // Event listeners para importação JSON de OJs
    document.getElementById('importOJsBtn')?.addEventListener('click', () => {
      document.getElementById('importOJsFile').click();
    });

    document.getElementById('importOJsFile')?.addEventListener('change', (e) => {
      this.importarOJsJSON(e.target.files[0]);
    });

    document.getElementById('downloadExampleBtn')?.addEventListener('click', () => {
      this.downloadExampleJSON();
    });

    document.getElementById('showJsonFormat')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.showJsonFormatHelp();
    });

    // Preview de servidor ao digitar CPF ou Nome
    this.setupServidorPreview();

    // Event listeners para filtros de servidores
    document.querySelectorAll('input[name="grauServidor"]').forEach(radio => {
      radio.addEventListener('change', () => {
        this.atualizarFiltroGrau();
      });
    });

    // Event listener para filtro de status
    document.querySelectorAll('input[name="statusVinculo"]').forEach(radio => {
      radio.addEventListener('change', () => {
        // Refazer a busca quando mudar o status
        const filtroNome = document.getElementById('filtroNomeServidor').value.trim();
        if (filtroNome) {
          this.buscarServidores();
        }
      });
    });

    // Event listeners para busca ao digitar (debounced)
    let searchTimeout;
    const setupSearchListener = (elementId, callback) => {
      document.getElementById(elementId).addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          callback(e.target.value);
        }, 500);
      });
    };

    setupSearchListener('filtroNomeServidor', () => this.buscarServidores(true));
    setupSearchListener('filtroCidadeServidor', () => this.buscarServidores(true));

    // Select all checkboxes
    document.getElementById('select-all')?.addEventListener('change', (e) => {
      this.selectAllPeritos(e.target.checked);
    });

    document.getElementById('select-all-servidores')?.addEventListener('change', (e) => {
      this.selectAllServidores(e.target.checked);
    });

    // Automation
    document.getElementById('start-automation')?.addEventListener('click', () => {
      this.startAutomation();
    });

    document.getElementById('start-servidor-automation')?.addEventListener('click', () => {
      this.startServidorAutomation();
    });

    // Novos botões de pausar/reiniciar
    document.getElementById('pause-resume-automation')?.addEventListener('click', () => {
      this.togglePauseAutomation();
    });

    document.getElementById('pause-resume-servidor-automation')?.addEventListener('click', () => {
      this.togglePauseServidorAutomation();
    });

    // Event listeners para abas do modal de verificação
    document.querySelectorAll('.verification-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.target.dataset.verificationTab;
        this.ativarAbaVerificacao(tabName);
      });
    });

    // Event listeners para botões do modal de verificação
    document.getElementById('corrigir-discrepancias')?.addEventListener('click', () => {
      this.corrigirTodasDiscrepancias();
    });

    document.getElementById('prosseguir-automacao')?.addEventListener('click', () => {
      this.prosseguirComAutomacao();
    });

    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
      const peritoModal = document.getElementById('perito-modal');
      const servidorModal = document.getElementById('servidor-modal');
      
      if (e.target === peritoModal) {
        this.closePeritoModal();
      }
      if (e.target === servidorModal) {
        this.closeServidorModal();
      }
    });

    // Password toggle functionality
    this.setupPasswordToggle();
    
    // Event listeners para verificação de múltiplos servidores
    this.setupMultiServidorEventListeners();
  }

  setupPasswordToggle() {
    // Função utilitária para alternar visibilidade
    const toggle = (buttonEl) => {
      // Prioriza seletor explícito quando disponível
      let passwordInput = null;
      const sel = buttonEl.getAttribute('data-target');
      if (sel) {
        try { passwordInput = document.querySelector(sel); } catch (_) { /* ignore */ }
      }
      // Fallback: encontra input dentro do wrapper
      if (!passwordInput) {
        const inputWrapper = buttonEl.closest('.input-wrapper');
        if (!inputWrapper) return;
        passwordInput = inputWrapper.querySelector('input[type="password"], input[type="text"]');
      }
      const icon = buttonEl.querySelector('i');
      if (!passwordInput || !icon) return;
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
        buttonEl.setAttribute('title', 'Ocultar senha');
      } else {
        passwordInput.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
        buttonEl.setAttribute('title', 'Mostrar senha');
      }
    };

    // Delegação para elementos existentes e futuros (robustez, evita dupla execução)
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.toggle-password');
      if (!btn) return;
      e.preventDefault();
      toggle(btn);
    });
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    const btn = document.querySelector(`[data-tab="${tabName}"]`);
    if (btn) btn.classList.add('active');

    // Update tab content (somente via classe, CSS controla visibilidade)
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    const content = document.getElementById(tabName);
    if (content) content.classList.add('active');

    // Update botões flutuantes quando mudar de aba
    this.updateQuickAutomationButton();
    this.updateQuickPeritoAutomationButton();
  }

  switchConfigTab(tabName) {
    // Update config tab buttons
    document.querySelectorAll('.config-tab-button').forEach(btn => btn.classList.remove('active'));
    const btn = document.querySelector(`[data-config-tab="${tabName}"]`);
    if (btn) btn.classList.add('active');

    // Update config tab content
    document.querySelectorAll('.config-section').forEach(section => section.classList.remove('active'));
    const section = document.getElementById(`${tabName}-config`);
    if (section) section.classList.add('active');

    if (tabName === 'auto-serv') {
      this.updateSelectedServidoresDisplay();
    } else if (tabName === 'auto-perito') {
      this.updateSelectedPeritosDisplay();
    } else if (tabName === 'sistema') {
      // Carregar configurações quando a seção de sistema (que inclui banco de dados) for aberta
      this.loadConfig();
      // Garantir que as configurações do banco sejam carregadas
      this.loadDatabaseConfig();
    }
  }

  // ===== PERITO METHODS =====

  async loadPeritos() {
    try {
      this.peritos = await window.electronAPI.loadData('perito.json') || [];
      this.renderPeritosTable();
      this.updateDashboardStats(); // Atualizar estatísticas
    } catch (error) {
      console.error('Erro ao carregar peritos:', error);
      this.showNotification('Erro ao carregar peritos', 'error');
    }
  }

  async savePeritos() {
    try {
      const result = await window.electronAPI.saveData('perito.json', this.peritos);
      if (result.success) {
        this.showNotification('Peritos salvos com sucesso!', 'success');
      } else {
        this.showNotification('Erro ao salvar peritos: ' + (result && result.error ? result.error : 'Erro desconhecido'), 'error');
      }
    } catch (error) {
      console.error('Erro ao salvar peritos:', error);
      this.showNotification('Erro ao salvar peritos', 'error');
    }
  }

  renderPeritosTable() {
    const tbody = document.getElementById('peritos-tbody');
    tbody.innerHTML = '';

    this.peritos.forEach((perito, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
                <td>
                    <input type="checkbox" class="perito-checkbox" data-index="${index}" 
                           ${Array.isArray(this.selectedPeritos) && this.selectedPeritos.includes(index) ? 'checked' : ''}>
                </td>
                <td>${perito.nome}</td>
                <td>${perito.cpf}</td>
                <td class="ojs-list">
                    ${perito.ojs.map(oj => `<span class="oj-tag">${oj}</span>`).join('')}
                </td>
                <td>
                    <button class="btn btn-secondary" onclick="app.editPerito(${index})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger" onclick="app.deletePerito(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
      tbody.appendChild(row);
    });

    // Add event listeners to checkboxes
    document.querySelectorAll('.perito-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.index);
        if (e.target.checked) {
          if (Array.isArray(this.selectedPeritos) && !this.selectedPeritos.includes(index)) {
            this.selectedPeritos.push(index);
          }
        } else {
          this.selectedPeritos = this.selectedPeritos.filter(i => i !== index);
        }
        this.updateAutomationButton();
        this.updateSelectedPeritosDisplay();
        this.updateBulkDeleteButtons();
      });
    });

    this.updateAutomationButton();
  }

  selectAllPeritos(checked) {
    const checkboxes = document.querySelectorAll('.perito-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.checked = checked;
      const index = parseInt(checkbox.dataset.index);
      if (checked) {
        if (Array.isArray(this.selectedPeritos) && !this.selectedPeritos.includes(index)) {
          this.selectedPeritos.push(index);
        }
      } else {
        this.selectedPeritos = this.selectedPeritos.filter(i => i !== index);
      }
    });
    this.updateAutomationButton();
    this.updateBulkDeleteButtons();
  }

  updateAutomationButton() {
    const startButton = document.getElementById('start-automation');
    startButton.disabled = this.selectedPeritos.length === 0 || this.isAutomationRunning;
  }

  updateBulkDeleteButtons() {
    const bulkDeletePeritoBtn = document.getElementById('bulk-delete-peritos');
    const bulkDeleteServidorBtn = document.getElementById('bulk-delete-servidores');
    
    if (bulkDeletePeritoBtn) {
      bulkDeletePeritoBtn.disabled = this.selectedPeritos.length === 0;
    }
    
    if (bulkDeleteServidorBtn) {
      bulkDeleteServidorBtn.disabled = this.selectedServidores.length === 0;
    }
  }

  updateServidorAutomationButton() {
    const startButton = document.getElementById('start-servidor-automation');
    if (startButton) {
      startButton.disabled = this.selectedServidores.length === 0 || this.isAutomationRunning;
    }
  }

  updateSelectAllServidoresCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-servidores');
    if (selectAllCheckbox) {
      const totalServidores = this.servidores.length;
      const selectedCount = this.selectedServidores.length;
      
      if (selectedCount === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
      } else if (selectedCount === totalServidores) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
      } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true; // Estado intermediário
      }
    }
  }

  updateSelectAllPeritosCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all');
    if (selectAllCheckbox) {
      const totalPeritos = this.peritos.length;
      const selectedCount = this.selectedPeritos.length;
      
      if (selectedCount === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
      } else if (selectedCount === totalPeritos) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
      } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true; // Estado intermediário
      }
    }
  }

  updateSelectedPeritosDisplay() {
    const container = document.getElementById('selected-peritos-list');

    if (this.selectedPeritos.length === 0) {
      container.innerHTML = `
        <p class="no-selection">
          <i class="fas fa-inbox"></i>
          <br>
          Nenhum perito selecionado
          <br>
          <small>Vá para a aba "Peritos" e marque os peritos que deseja processar</small>
        </p>
      `;

      // Update counters
      const selectedCount = document.getElementById('selected-peritos-count');
      const totalCount = document.getElementById('total-peritos-count');
      if (selectedCount) selectedCount.textContent = '0';
      if (totalCount) totalCount.textContent = this.peritos.length;

      return;
    }

    const selectedPeritosList = this.selectedPeritos.map(index => {
      const perito = this.peritos[index];
      const ojCount = perito.ojs ? perito.ojs.length : 0;
      const statusClass = perito._processingStatus || 'queued';
      const itemId = `perito-item-${index}`;

      return `
        <div class="selected-item ${statusClass}" id="${itemId}" data-index="${index}">
          <h4>
            ${perito.nome}
            ${statusClass === 'processing' ? '<span class="item-status-badge status-processing"><i class="fas fa-spinner fa-spin"></i> Processando</span>' : ''}
            ${statusClass === 'completed' ? '<span class="item-status-badge status-completed"><i class="fas fa-check"></i> Concluído</span>' : ''}
            ${statusClass === 'error' ? '<span class="item-status-badge status-error"><i class="fas fa-times"></i> Erro</span>' : ''}
            ${statusClass === 'queued' ? '<span class="item-status-badge status-queued"><i class="fas fa-clock"></i> Na Fila</span>' : ''}
          </h4>
          <p><i class="fas fa-id-card"></i> CPF: <strong>${perito.cpf}</strong></p>
          <p><i class="fas fa-gavel"></i> ${ojCount} órgão(s) julgador(es) para processar</p>
        </div>
      `;
    }).join('');

    container.innerHTML = selectedPeritosList;

    // Update counter display
    const selectedCount = document.getElementById('selected-peritos-count');
    const totalCount = document.getElementById('total-peritos-count');
    if (selectedCount) selectedCount.textContent = this.selectedPeritos.length;
    if (totalCount) totalCount.textContent = this.peritos.length;

    // Update select-all checkbox state
    this.updateSelectAllPeritosCheckbox();

    // Update badge da tab de automação
    this.updatePeritoAutomacaoTabBadge();

    // Update botão flutuante de ação rápida
    this.updateQuickPeritoAutomationButton();
  }

  updatePeritoAutomacaoTabBadge() {
    const badge = document.getElementById('perito-automacao-tab-badge');
    const count = this.selectedPeritos.length;

    if (badge) {
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  updateQuickPeritoAutomationButton() {
    const quickBtn = document.getElementById('quick-perito-automation-btn');
    const fabCount = document.getElementById('perito-fab-count');
    const count = this.selectedPeritos.length;

    // Verificar se estamos na tab "Lista" de peritos
    const peritosTab = document.getElementById('peritos');
    const isPeritosTabActive = peritosTab && peritosTab.classList.contains('active');
    const listaTab = document.getElementById('perito-lista-tab');
    const isListaTabActive = listaTab && listaTab.classList.contains('active');

    if (quickBtn && fabCount) {
      if (count > 0 && isPeritosTabActive && isListaTabActive) {
        fabCount.textContent = count;
        quickBtn.style.display = 'flex';
      } else {
        quickBtn.style.display = 'none';
      }
    }
  }

  // Atualizar status visual de um perito específico durante processamento
  updatePeritoItemStatus(peritoIndex, status) {
    const itemId = `perito-item-${peritoIndex}`;
    const item = document.getElementById(itemId);
    if (!item) return;

    // Remover classes anteriores
    item.classList.remove('queued', 'processing', 'completed', 'error');

    // Adicionar nova classe
    item.classList.add(status);

    // Atualizar badge de status
    const perito = this.peritos[peritoIndex];
    const ojCount = perito.ojs ? perito.ojs.length : 0;

    let statusBadge = '';
    switch(status) {
      case 'processing':
        statusBadge = '<span class="item-status-badge status-processing"><i class="fas fa-spinner fa-spin"></i> Processando</span>';
        break;
      case 'completed':
        statusBadge = '<span class="item-status-badge status-completed"><i class="fas fa-check"></i> Concluído</span>';
        break;
      case 'error':
        statusBadge = '<span class="item-status-badge status-error"><i class="fas fa-times"></i> Erro</span>';
        break;
      case 'queued':
        statusBadge = '<span class="item-status-badge status-queued"><i class="fas fa-clock"></i> Na Fila</span>';
        break;
    }

    item.innerHTML = `
      <h4>
        ${perito.nome}
        ${statusBadge}
      </h4>
      <p><i class="fas fa-id-card"></i> CPF: <strong>${perito.cpf}</strong></p>
      <p><i class="fas fa-gavel"></i> ${ojCount} órgão(s) julgador(es) para processar</p>
    `;

    // Scroll para o item sendo processado
    if (status === 'processing') {
      item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  openPeritoModal(editIndex = -1) {
    this.currentEditingIndex = editIndex;
    const modal = document.getElementById('perito-modal');
    const title = document.getElementById('modal-title');
        
    if (editIndex >= 0) {
      title.textContent = 'Editar Perito';
      const perito = this.peritos[editIndex];
      document.getElementById('perito-nome').value = perito.nome;
      document.getElementById('perito-cpf').value = perito.cpf;
      document.getElementById('perito-ojs').value = perito.ojs.join('\n');
    } else {
      title.textContent = 'Adicionar Perito';
      document.getElementById('perito-form').reset();
    }
        
    modal.style.display = 'block';
  }

  closePeritoModal() {
    document.getElementById('perito-modal').style.display = 'none';
    this.currentEditingIndex = -1;
  }

  async savePeito() {
    const nome = document.getElementById('perito-nome').value.trim();
    const cpf = document.getElementById('perito-cpf').value.trim();
    const ojsText = document.getElementById('perito-ojs').value.trim();
        
    if (!nome || !cpf) {
      this.showNotification('Nome e CPF são obrigatórios', 'error');
      return;
    }

    // Processar e normalizar OJs
    const ojs = ojsText ? 
      ojsText.split('\n')
        .map(oj => oj.trim())
        .filter(oj => oj)
        .map(oj => this.normalizeOJName(oj))
        .filter(oj => oj) // Remover nulls/vazios após normalização
      : [];
        
    const perito = { nome, cpf, ojs };
        
    if (this.currentEditingIndex >= 0) {
      this.peritos[this.currentEditingIndex] = perito;
    } else {
      this.peritos.push(perito);
    }
    
    // Salvar CPF no histórico para autocomplete
    this.saveCpfToHistory(cpf, 'perito');
    
    // Salvar OJs no histórico se existirem
    if (ojs.length > 0) {
      ojs.forEach(oj => this.saveOjToHistory(oj));
    }
        
    await this.savePeritos();
    this.renderPeritosTable();
    this.closePeritoModal();
  }

  editPerito(index) {
    this.openPeritoModal(index);
  }

  async deletePerito(index) {
    if (confirm('Tem certeza que deseja excluir este perito?')) {
      this.peritos.splice(index, 1);
            
      // Update selected peritos indices
      this.selectedPeritos = this.selectedPeritos
        .filter(i => i !== index)
        .map(i => i > index ? i - 1 : i);
            
      await this.savePeritos();
      this.renderPeritosTable();
    }
  }

  async bulkDeletePeritos() {
    if (this.selectedPeritos.length === 0) {
      this.showNotification('Nenhum perito selecionado para exclusão', 'warning');
      return;
    }

    const count = this.selectedPeritos.length;
    const message = `Tem certeza que deseja excluir ${count} perito${count > 1 ? 's' : ''}?`;
    
    if (confirm(message)) {
      // Sort indices in descending order to avoid index shifting issues
      const sortedIndices = this.selectedPeritos.sort((a, b) => b - a);
      
      // Remove peritos in reverse order
      sortedIndices.forEach(index => {
        this.peritos.splice(index, 1);
      });
      
      // Clear selected peritos
      this.selectedPeritos = [];
      
      await this.savePeritos();
      this.renderPeritosTable();
      this.updateSelectedPeritosDisplay();
      this.updateBulkDeleteButtons();
      
      this.showNotification(`${count} perito${count > 1 ? 's excluídos' : ' excluído'} com sucesso!`, 'success');
    }
  }

  async importPeritos() {
    try {
      const result = await window.electronAPI.importFile('peritos');
      
      if (result.success && result.data) {
        // Validar se os dados importados têm a estrutura correta
        if (!Array.isArray(result.data)) {
          this.showNotification('Arquivo inválido: deve conter um array de peritos', 'error');
          return;
        }

        const validPeritos = [];
        let invalidCount = 0;

        // Validar cada perito importado
        result.data.forEach((perito, index) => {
          if (this.validatePeritoData(perito)) {
            // Normalizar OJs se existirem
            if (perito.ojs && Array.isArray(perito.ojs)) {
              perito.ojs = perito.ojs
                .map(oj => this.normalizeOJName(oj))
                .filter(oj => oj); // Remover nulls/vazios após normalização
            }
            
            // Verificar se já existe um perito com o mesmo CPF
            const existingIndex = this.peritos.findIndex(p => p.cpf === perito.cpf);
            if (existingIndex >= 0) {
              // Atualizar perito existente
              this.peritos[existingIndex] = { ...this.peritos[existingIndex], ...perito };
            } else {
              // Adicionar novo perito
              validPeritos.push(perito);
            }
          } else {
            invalidCount++;
            console.warn(`Perito inválido na linha ${index + 1}:`, perito);
          }
        });

        // Adicionar peritos válidos
        if (validPeritos.length > 0) {
          this.peritos.push(...validPeritos);
          await this.savePeritos();
          this.renderPeritosTable();
          this.updateHistory(); // Atualizar histórico para autocomplete
        }

        // Mostrar resultado da importação
        let message = `Importação concluída: ${validPeritos.length} peritos adicionados`;
        if (invalidCount > 0) {
          message += `, ${invalidCount} registros inválidos ignorados`;
        }
        
        this.showNotification(message, validPeritos.length > 0 ? 'success' : 'warning');
        
      } else if (result.canceled) {
        // Usuário cancelou a operação
        return;
      } else {
        this.showNotification(`Erro ao importar arquivo: ${result.error || 'Formato inválido'}`, 'error');
      }
    } catch (error) {
      console.error('Erro na importação:', error);
      this.showNotification('Erro ao importar peritos: ' + error.message, 'error');
    }
  }

  // Função para validar dados do perito
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

  // Função para validar CPF com algoritmo completo (inclui dígitos verificadores)
  isValidCPF(cpf) {
    if (!cpf) return false;
    
    // Remove formatação
    const cleanCPF = cpf.replace(/[^\d]/g, '');
    
    // Verifica se tem 11 dígitos
    if (cleanCPF.length !== 11) return false;
    
    // Verifica se não é sequência repetida (111.111.111-11, etc)
    if (/^(\d)\1{10}$/.test(cleanCPF)) return false;
    
    // Validação dos dígitos verificadores
    let sum = 0;
    let remainder;
    
    // Valida primeiro dígito verificador
    for (let i = 1; i <= 9; i++) {
      sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.substring(9, 10))) return false;
    
    // Valida segundo dígito verificador
    sum = 0;
    for (let i = 1; i <= 10; i++) {
      sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.substring(10, 11))) return false;
    
    return true;
  }

  // Função para formatar CPF no padrão XXX.XXX.XXX-XX
  formatCpf(cpf) {
    if (!cpf) return '---.--.------';
    // Remove formatação existente
    const cleanCPF = cpf.replace(/[^\d]/g, '');
    // Aplica formatação se tiver 11 dígitos
    if (cleanCPF.length === 11) {
      return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return cpf; // Retorna original se não conseguir formatar
  }

  // Função para mostrar exemplo de importação
  showImportExample() {
    const modal = document.getElementById('import-example-modal');
    modal.style.display = 'block';

    // Fechar modal ao clicar no X
    const closeBtn = modal.querySelector('.close');
    closeBtn.onclick = () => {
      modal.style.display = 'none';
    };

    // Fechar modal ao clicar fora dele
    window.onclick = (event) => {
      if (event.target === modal) {
        modal.style.display = 'none';
      }
    };
  }



  // ===== SERVIDOR METHODS =====
  
  // ===== PROCESSOS METHODS =====
  async buscarProcesso() {
    try {
      const numero = (document.getElementById('nrProcessoInput').value || '').trim();
      const grau = document.getElementById('grauProcessoSelect').value || '1';

      if (!numero) {
        this.showNotification('Informe o número do processo', 'warning');
        return;
      }

      // Mostrar status carregando
      const statusEl = document.getElementById('statusProcessos');
      const resultadoEl = document.getElementById('resultadoProcessos');
      if (statusEl) statusEl.classList.remove('hidden');
      if (resultadoEl) resultadoEl.classList.add('hidden');

      // Buscar dados em paralelo
      const resp = await window.electronAPI.buscarProcessoInfo(numero, grau);
      if (!resp || !resp.success) {
        throw new Error(resp && resp.error ? resp.error : 'Falha na consulta');
      }

      const { tarefaAtual, historico, partes } = resp.data || { tarefaAtual: [], historico: [], partes: [] };
      this.renderProcessoResultados({ tarefaAtual, historico, partes });

      if (statusEl) statusEl.classList.add('hidden');
      if (resultadoEl) resultadoEl.classList.remove('hidden');
    } catch (error) {
      console.error('Erro ao buscar processo:', error);
      this.showNotification('Erro ao consultar processo: ' + (error.message || 'Erro desconhecido'), 'error');
      const statusEl = document.getElementById('statusProcessos');
      if (statusEl) statusEl.classList.add('hidden');
    }
  }

  renderProcessoResultados({ tarefaAtual = [], historico = [], partes = [] }) {
    // Tarefa Atual
    const tbodyTarefa = document.querySelector('#tabelaTarefaAtual tbody');
    const vazioTarefa = document.getElementById('tarefaAtualVazia');
    if (tbodyTarefa) {
      tbodyTarefa.innerHTML = '';
      if (!tarefaAtual || tarefaAtual.length === 0) {
        if (vazioTarefa) vazioTarefa.style.display = 'block';
      } else {
        if (vazioTarefa) vazioTarefa.style.display = 'none';
        tarefaAtual.forEach((t) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${t.nome_tarefa || ''}</td>
            <td>${t.login_usuario || ''}</td>
            <td>${t.ds_orgao_julgador || ''}</td>
            <td>${t.ds_orgao_julgador_colegiado || ''}</td>
          `;
          tbodyTarefa.appendChild(tr);
        });
      }
    }

    // Partes
    const tbodyPartes = document.querySelector('#tabelaPartes tbody');
    const vazioPartes = document.getElementById('partesVazia');
    if (tbodyPartes) {
      tbodyPartes.innerHTML = '';
      if (!partes || partes.length === 0) {
        if (vazioPartes) vazioPartes.style.display = 'block';
      } else {
        if (vazioPartes) vazioPartes.style.display = 'none';
        partes.forEach((p) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${p.ds_nome || ''}</td>
            <td>${p.ds_login || ''}</td>
            <td>${p.id_tipo_parte ?? ''}</td>
            <td>${p.in_parte_principal || ''}</td>
            <td>${p.in_participacao || ''}</td>
            <td>${p.in_situacao || ''}</td>
          `;
          tbodyPartes.appendChild(tr);
        });
      }
    }

    // Histórico
    const tbodyHist = document.querySelector('#tabelaHistorico tbody');
    const vazioHist = document.getElementById('historicoVazio');
    if (tbodyHist) {
      tbodyHist.innerHTML = '';
      if (!historico || historico.length === 0) {
        if (vazioHist) vazioHist.style.display = 'block';
      } else {
        if (vazioHist) vazioHist.style.display = 'none';
        historico.forEach((h) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${this.formatDateTime(h.data_criacao)}</td>
            <td>${this.formatDateTime(h.data_abertura)}</td>
            <td>${this.formatDateTime(h.data_saida)}</td>
            <td>${h.tarefa || ''}</td>
            <td>${h.fluxo || ''}</td>
            <td>${h.task_instance || ''}</td>
          `;
          tbodyHist.appendChild(tr);
        });
      }
    }
  }

  formatDateTime(value) {
    if (!value) return '';
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return String(value);
      return d.toLocaleString('pt-BR');
    } catch {
      return String(value);
    }
  }

  async loadServidores() {
    try {
      this.servidores = await window.electronAPI.loadData('servidores.json') || [];
      
      // Garantir compatibilidade: adicionar campo 'orgaos' se não existir
      let needsSave = false;
      this.servidores.forEach(servidor => {
        if (!servidor.orgaos && (servidor.ojs || servidor.localizacoes)) {
          servidor.orgaos = servidor.ojs || servidor.localizacoes || [];
          needsSave = true;
        }
      });
      
      // Salvar se houve correções
      if (needsSave) {
        await this.saveServidores();
      }
      
      this.renderServidoresTable();
      this.updateDashboardStats(); // Atualizar estatísticas
    } catch (error) {
      console.error('Erro ao carregar servidores:', error);
      this.showNotification('Erro ao carregar servidores', 'error');
    }
  }

  async saveServidores() {
    try {
      const result = await window.electronAPI.saveData('servidores.json', this.servidores);
      if (result.success) {
        this.showNotification('Servidores salvos com sucesso!', 'success');
      } else {
        this.showNotification(result.error, 'error');
      }
    } catch (error) {
      console.error('Erro ao salvar servidores:', error);
      this.showNotification('Erro ao salvar servidores', 'error');
    }
  }

  renderServidoresTable() {
    console.log('Renderizando tabela de servidores...');
    const tbody = document.getElementById('servidores-tbody');
    if (!tbody) {
      console.log('Elemento servidores-tbody não encontrado');
      return;
    }
        
    tbody.innerHTML = '';
    console.log('Servidores a renderizar:', this.servidores.length);
    console.log('Servidores selecionados:', this.selectedServidores);
        
    this.servidores.forEach((servidor, index) => {
      const isSelected = Array.isArray(this.selectedServidores) && this.selectedServidores.includes(index);
      console.log(`Servidor ${index} (${servidor.nome}): selecionado = ${isSelected}`);
      
      const row = document.createElement('tr');
      
      // Create all cells properly to avoid innerHTML issues
      const checkboxCell = document.createElement('td');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = isSelected;
      checkbox.addEventListener('change', () => this.toggleServidorSelection(index));
      checkboxCell.appendChild(checkbox);
      
      const nomeCell = document.createElement('td');
      nomeCell.textContent = servidor.nome;
      
      const cpfCell = document.createElement('td');
      cpfCell.textContent = servidor.cpf;
      
      const perfilCell = document.createElement('td');
      perfilCell.textContent = servidor.perfil;
      
      const ojsCell = document.createElement('td');
      // Aceitar tanto 'ojs' quanto 'localizacoes' para compatibilidade
      const listaOjs = servidor.ojs || servidor.localizacoes;
      if (listaOjs && Array.isArray(listaOjs)) {
        // Verificar se os OJs são objetos ou strings
        const ojsTexto = listaOjs.map(oj => {
          if (typeof oj === 'object' && oj.oj) {
            // Se for objeto, extrair a propriedade 'oj'
            return oj.oj;
          } else if (typeof oj === 'string') {
            // Se for string, usar diretamente
            return oj;
          } else {
            // Fallback para outros tipos
            return String(oj);
          }
        }).join(', ');
        ojsCell.textContent = ojsTexto;
      } else {
        ojsCell.textContent = 'Não definido';
      }
      
      const actionsCell = document.createElement('td');
      actionsCell.innerHTML = `
        <button onclick="app.editServidor(${index})" class="btn btn-sm btn-primary">
          <i class="fas fa-edit"></i> Editar
        </button>
        <button onclick="app.deleteServidor(${index})" class="btn btn-sm btn-danger">
          <i class="fas fa-trash"></i> Excluir
        </button>
      `;
      
      row.appendChild(checkboxCell);
      row.appendChild(nomeCell);
      row.appendChild(cpfCell);
      row.appendChild(perfilCell);
      row.appendChild(ojsCell);
      row.appendChild(actionsCell);
      tbody.appendChild(row);
    });
    console.log('Tabela renderizada com sucesso');
  }

  openServidorModal(editIndex = -1) {
    this.currentEditingServidorIndex = editIndex;
    const modal = document.getElementById('servidor-modal');
    const title = document.getElementById('servidor-modal-title');
        
    if (editIndex >= 0) {
      title.textContent = 'Editar Servidor';
      const servidor = this.servidores[editIndex];
      document.getElementById('servidor-nome').value = servidor.nome;
      document.getElementById('servidor-cpf').value = servidor.cpf;
      document.getElementById('servidor-perfil').value = servidor.perfil;
      // Aceitar tanto 'ojs' quanto 'localizacoes' para compatibilidade
      const ojsDoServidor = servidor.ojs || servidor.localizacoes || [];
      document.getElementById('servidor-ojs').value = ojsDoServidor.length > 0 ? ojsDoServidor.join('\n') : '';
    } else {
      title.textContent = 'Adicionar Servidor';
      document.getElementById('servidor-form').reset();
    }
        
    modal.style.display = 'block';
  }

  closeServidorModal() {
    document.getElementById('servidor-modal').style.display = 'none';
    this.currentEditingServidorIndex = -1;
  }

  async saveServidor() {
    const nome = document.getElementById('servidor-nome').value.trim();
    const cpf = document.getElementById('servidor-cpf').value.trim();
    const perfil = document.getElementById('servidor-perfil').value;
    const ojsText = document.getElementById('servidor-ojs').value.trim();

    if (!nome || !cpf || !perfil) {
      this.showNotification('Nome, CPF e Perfil são obrigatórios', 'error');
      return;
    }

    const cpfValidation = this.validarCPF(cpf);
    if (!cpfValidation.valido) {
      this.showNotification(`CPF inválido: ${cpfValidation.erro}`, 'error');
      return;
    }

    // VALIDAÇÃO ANTI-DUPLICAÇÃO: Verificar se CPF já existe
    const existingServerIndex = this.servidores.findIndex(servidor => servidor.cpf === cpf);

    if (this.currentEditingServidorIndex >= 0) {
      // Modo de edição: verificar se o CPF não pertence a outro servidor
      if (existingServerIndex >= 0 && existingServerIndex !== this.currentEditingServidorIndex) {
        this.showNotification('Já existe um servidor cadastrado com este CPF', 'error');
        return;
      }
    } else {
      // Modo de adição: verificar se CPF já existe
      if (existingServerIndex >= 0) {
        this.showNotification('Já existe um servidor cadastrado com este CPF', 'error');
        return;
      }
    }

    // Processar e normalizar OJs
    const ojs = ojsText ?
      ojsText.split('\n')
        .map(oj => oj.trim())
        .filter(oj => oj)
        .map(oj => this.normalizeOJName(oj))
        .filter(oj => oj) // Remover nulls/vazios após normalização
      : [];

    const servidor = { nome, cpf, perfil, ojs };

    if (this.currentEditingServidorIndex >= 0) {
      // Editando servidor existente
      this.servidores[this.currentEditingServidorIndex] = servidor;
    } else {
      // Adicionando novo servidor (já validado que não é duplicata)
      this.servidores.push(servidor);
    }
    
    // Salvar CPF no histórico para autocomplete
    this.saveCpfToHistory(cpf, 'servidor');
    
    // Salvar perfil no histórico
    this.saveProfileToHistory(perfil);
    
    // Salvar OJs no histórico se existirem
    if (ojs.length > 0) {
      ojs.forEach(oj => this.saveOjToHistory(oj));
    }
        
    await this.saveServidores();
    this.renderServidoresTable();
    this.closeServidorModal();
  }

  editServidor(index) {
    this.openServidorModal(index);
  }

  async deleteServidor(index) {
    if (confirm('Tem certeza que deseja excluir este servidor?')) {
      this.servidores.splice(index, 1);
      await this.saveServidores();
      this.renderServidoresTable();
      this.updateSelectedServidoresDisplay();
    }
  }

  async bulkDeleteServidores() {
    if (this.selectedServidores.length === 0) {
      this.showNotification('Nenhum servidor selecionado para exclusão', 'warning');
      return;
    }

    const count = this.selectedServidores.length;
    const message = `Tem certeza que deseja excluir ${count} servidor${count > 1 ? 'es' : ''}?`;
    
    if (confirm(message)) {
      // Sort indices in descending order to avoid index shifting issues
      const sortedIndices = this.selectedServidores.sort((a, b) => b - a);
      
      // Remove servidores in reverse order
      sortedIndices.forEach(index => {
        this.servidores.splice(index, 1);
      });
      
      // Clear selected servidores
      this.selectedServidores = [];
      
      await this.saveServidores();
      this.renderServidoresTable();
      this.updateSelectedServidoresDisplay();
      this.updateBulkDeleteButtons();
      
      this.showNotification(`${count} servidor${count > 1 ? 'es excluídos' : ' excluído'} com sucesso!`, 'success');
    }
  }

  async verificarBancoDados() {
    try {
      // Verificar se há servidores carregados
      if (!this.servidores || this.servidores.length === 0) {
        this.showNotification('Nenhum servidor carregado para verificação', 'warning');
        return;
      }

      // Verificar se as credenciais do banco estão configuradas
      const dbConfig = await window.electronAPI.loadDatabaseCredentials();
      if (!dbConfig.success || !dbConfig.credentials || !dbConfig.credentials.user || !dbConfig.credentials.password) {
        this.showNotification('Configure as credenciais do banco de dados primeiro', 'error');
        return;
      }

      // Abrir modal de verificação
      const modal = document.getElementById('verificacao-banco-modal');
      modal.style.display = 'block';

      // Mostrar loading
      this.showVerificationLoading(true);

      // Executar verificação do banco de dados
      this.addStatusMessage('info', '🔍 Verificando dados dos servidores no banco...');
      const resultado = await this.executarVerificacaoBanco();
      
      // Executar verificação prévia de OJs para servidores selecionados
      if (this.selectedServidores.length > 0) {
        this.addStatusMessage('info', '🧠 Analisando OJs cadastrados...');
        const resultadosOJs = await this.realizarVerificacaoPrevia();
        
        // Combinar resultados
        const resultadoCompleto = {
          ...resultado,
          verificacaoOJs: resultadosOJs
        };
        
        // Mostrar resultados
        this.showVerificationLoading(false);
        this.exibirResultadosVerificacao(resultadoCompleto);
      } else {
        // Mostrar resultados apenas do banco
        this.showVerificationLoading(false);
        this.exibirResultadosVerificacao(resultado);
      }

    } catch (error) {
      console.error('Erro na verificação do banco:', error);
      this.showNotification('Erro ao verificar banco de dados', 'error');
      this.showVerificationLoading(false);
    }
  }

  async executarVerificacaoBanco() {
    console.log('🔍 Iniciando verificação do banco de dados...');
    console.log(`📊 Total de servidores para verificar: ${this.servidores.length}`);
    
    const resultado = {
      total: this.servidores.length,
      compatíveis: [],
      discrepâncias: [],
      nãoEncontrados: []
    };

    for (let i = 0; i < this.servidores.length; i++) {
      const servidor = this.servidores[i];
      console.log(`🔄 Verificando servidor ${i + 1}/${this.servidores.length}: ${servidor.nome} (CPF: ${servidor.cpf})`);
      
      try {
        // Buscar servidor no banco por CPF
        console.log(`🔍 Buscando servidor no banco: ${servidor.cpf}`);
        const servidorBanco = await this.buscarServidorNoBanco(servidor.cpf);
        console.log('📋 Resultado da busca:', servidorBanco ? 'Encontrado' : 'Não encontrado');
        
        if (!servidorBanco) {
          console.log(`❌ Servidor não encontrado no banco: ${servidor.nome}`);
          resultado.nãoEncontrados.push({
            nome: servidor.nome,
            cpf: servidor.cpf,
            perfil: servidor.perfil,
            orgaosJulgadores: servidor.orgaosJulgadores
          });
        } else {
          // Comparar dados
          console.log(`🔍 Comparando dados do servidor: ${servidor.nome}`);
          const discrepancias = this.compararDadosServidor(servidor, servidorBanco);
          console.log(`📊 Discrepâncias encontradas: ${discrepancias.length}`);
          
          if (discrepancias.length > 0) {
            console.log(`⚠️ Discrepâncias encontradas para ${servidor.nome}:`, discrepancias);
            resultado.discrepâncias.push({
              servidor,
              servidorBanco,
              discrepancias
            });
          } else {
            console.log(`✅ Servidor compatível: ${servidor.nome}`);
            resultado.compatíveis.push({
              nome: servidor.nome,
              cpf: servidor.cpf,
              perfil: servidor.perfil
            });
          }
        }
      } catch (error) {
        console.error(`❌ Erro ao verificar servidor ${servidor.nome}:`, error);
        resultado.nãoEncontrados.push({
          nome: servidor.nome,
          cpf: servidor.cpf,
          perfil: servidor.perfil,
          orgaosJulgadores: servidor.orgaosJulgadores,
          erro: error.message
        });
      }
    }

    console.log('✅ Verificação concluída!');
    console.log(`📊 Resumo: ${resultado.compatíveis.length} compatíveis, ${resultado.discrepâncias.length} discrepâncias, ${resultado.nãoEncontrados.length} não encontrados`);
    return resultado;
  }

  async buscarServidorNoBanco(cpf) {
    try {
      const result = await window.electronAPI.buscarServidorPorCPF(cpf);
      
      // Verificar se a busca foi bem-sucedida e se o servidor existe
      if (result.success && result.servidor && result.servidor.existe) {
        return result.servidor.servidor;
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao buscar servidor no banco:', error);
      return null;
    }
  }

  compararDadosServidor(servidorLocal, servidorBanco) {
    const discrepancias = [];

    // Comparar CPF (principal verificação)
    const cpfLocal = servidorLocal.cpf.replace(/\D/g, '');
    const cpfBanco = servidorBanco.cpf.replace(/\D/g, '');
    
    if (cpfLocal !== cpfBanco) {
      discrepancias.push({
        campo: 'cpf',
        valorLocal: servidorLocal.cpf,
        valorBanco: servidorBanco.cpf,
        tipo: 'diferença_cpf'
      });
    }

    // Verificar se há informações sobre órgãos julgadores cadastrados
    if (servidorBanco.totalOjsCadastrados !== undefined) {
      const totalOjsLocal = servidorLocal.orgaosJulgadores ? servidorLocal.orgaosJulgadores.length : 0;
      
      if (totalOjsLocal !== servidorBanco.totalOjsCadastrados) {
        discrepancias.push({
          campo: 'totalOrgaosJulgadores',
          valorLocal: totalOjsLocal,
          valorBanco: servidorBanco.totalOjsCadastrados,
          tipo: 'diferença_quantidade_ojs'
        });
      }
    }

    // Nota: Comparações de nome e perfil não são possíveis com os dados atuais do banco
    // O banco retorna apenas: idUsuario, idUsuarioLocalizacao, cpf, totalOjsCadastrados

    return discrepancias;
  }

  normalizarTexto(texto) {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9\s]/g, '') // Remove caracteres especiais
      .replace(/\s+/g, ' ') // Normaliza espaços
      .trim();
  }

  showVerificationLoading(show) {
    const loadingDiv = document.querySelector('#verificacao-banco-modal .verification-loading');
    const contentDiv = document.querySelector('#verificacao-banco-modal .verification-content');
    
    if (show) {
      loadingDiv.style.display = 'block';
      contentDiv.style.display = 'none';
    } else {
      loadingDiv.style.display = 'none';
      contentDiv.style.display = 'block';
    }
  }

  exibirResultadosVerificacao(resultado) {
    // Atualizar resumos
    document.getElementById('total-servidores').textContent = resultado.total;
    document.getElementById('compativeis-count').textContent = resultado.compatíveis.length;
    document.getElementById('discrepancias-count').textContent = resultado.discrepâncias.length;
    document.getElementById('nao-encontrados-count').textContent = resultado.nãoEncontrados.length;

    // Renderizar abas
    this.renderizarAbaDiscrepancias(resultado.discrepâncias);
    this.renderizarAbaNaoEncontrados(resultado.nãoEncontrados);
    this.renderizarAbaCompativeis(resultado.compatíveis);

    // Ativar primeira aba com dados
    if (resultado.discrepâncias.length > 0) {
      this.ativarAbaVerificacao('discrepancias');
    } else if (resultado.nãoEncontrados.length > 0) {
      this.ativarAbaVerificacao('nao-encontrados');
    } else {
      this.ativarAbaVerificacao('compativeis');
    }
  }

  renderizarAbaDiscrepancias(discrepancias) {
    const container = document.getElementById('discrepancias-list');
    container.innerHTML = '';

    discrepancias.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'discrepancy-item';
      
      let discrepanciasHtml = '';
      item.discrepancias.forEach(disc => {
        discrepanciasHtml += `
          <div class="discrepancy-detail">
            <strong>${disc.campo}:</strong>
            <div class="value-comparison">
              <div class="local-value">Local: ${disc.valorLocal}</div>
              <div class="banco-value">Banco: ${disc.valorBanco}</div>
            </div>
            ${disc.campo === 'nome' ? `
              <div class="correction-input">
                <input type="text" 
                       id="correcao-${index}-nome" 
                       value="${disc.valorBanco}" 
                       placeholder="Correção sugerida">
                <button onclick="app.aplicarCorrecao(${index}, 'nome')" class="btn btn-sm btn-primary">
                  Aplicar
                </button>
              </div>
            ` : ''}
          </div>
        `;
      });

      div.innerHTML = `
        <h4>${item.servidor.nome} (${item.servidor.cpf})</h4>
        ${discrepanciasHtml}
      `;
      
      container.appendChild(div);
    });
  }

  renderizarAbaNaoEncontrados(naoEncontrados) {
    const container = document.getElementById('nao-encontrados-list');
    container.innerHTML = '';

    naoEncontrados.forEach(servidor => {
      const div = document.createElement('div');
      div.className = 'not-found-item';
      
      div.innerHTML = `
        <h4>${servidor.nome}</h4>
        <p><strong>CPF:</strong> ${servidor.cpf}</p>
        <p><strong>Perfil:</strong> ${servidor.perfil}</p>
        <p><strong>Órgãos:</strong> ${servidor.orgaosJulgadores.map(oj => typeof oj === 'object' ? (oj.oj || oj.nome || oj.orgaoJulgador || JSON.stringify(oj)) : oj).join(', ')}</p>
        ${servidor.erro ? `<p class="error-message">Erro: ${servidor.erro}</p>` : ''}
      `;
      
      container.appendChild(div);
    });
  }

  renderizarAbaCompativeis(compativeis) {
    const container = document.getElementById('compativeis-list');
    container.innerHTML = '';

    compativeis.forEach(servidor => {
      const div = document.createElement('div');
      div.className = 'compatible-item';
      
      div.innerHTML = `
        <h4>${servidor.nome}</h4>
        <p><strong>CPF:</strong> ${servidor.cpf}</p>
        <p><strong>Perfil:</strong> ${servidor.perfil}</p>
        <i class="fas fa-check-circle"></i>
      `;
      
      container.appendChild(div);
    });
  }

  ativarAbaVerificacao(aba) {
    // Remover classe ativa de todas as abas
    document.querySelectorAll('.verification-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    
    document.querySelectorAll('.verification-tab-content').forEach(content => {
      content.classList.remove('active');
    });

    // Ativar aba selecionada
    document.querySelector(`[data-verification-tab="${aba}"]`).classList.add('active');
    document.getElementById(`${aba}-tab`).classList.add('active');
  }

  aplicarCorrecao(index, campo) {
    const input = document.getElementById(`correcao-${index}-${campo}`);
    const novoValor = input.value.trim();
    
    if (novoValor) {
      // Aplicar correção ao servidor local
      this.servidores[index][campo] = novoValor;
      this.saveServidores();
      this.renderServidoresTable();
      this.showNotification(`Correção aplicada: ${campo} atualizado`, 'success');
    }
  }

  async corrigirTodasDiscrepancias() {
    const inputs = document.querySelectorAll('#discrepancias-list .correction-input input');
    let correcoes = 0;

    inputs.forEach(input => {
      const value = input.value.trim();
      if (value && value !== input.defaultValue) {
        // Extrair índice e campo do ID do input
        const match = input.id.match(/correcao-(\d+)-(\w+)/);
        if (match) {
          const index = parseInt(match[1]);
          const campo = match[2];
          this.servidores[index][campo] = value;
          correcoes++;
        }
      }
    });

    if (correcoes > 0) {
      await this.saveServidores();
      this.renderServidoresTable();
      this.showNotification(`${correcoes} correção${correcoes > 1 ? 'ões aplicadas' : ' aplicada'} com sucesso!`, 'success');
      
      // Fechar modal
      document.getElementById('verificacao-banco-modal').style.display = 'none';
    } else {
      this.showNotification('Nenhuma correção para aplicar', 'warning');
    }
  }

  async prosseguirComAutomacao() {
    // Fechar modal de verificação
    document.getElementById('verificacao-banco-modal').style.display = 'none';
    
    // Iniciar automação dos servidores
    this.showNotification('Iniciando automação com dados verificados...', 'info');
    
    // Aguardar um momento para o usuário ver a notificação
    setTimeout(() => {
      this.startServidorAutomation();
    }, 1000);
  }

  async importServidores() {
    try {
      const result = await window.electronAPI.importFile('servidores');
      
      if (result.success && result.data) {
        // Validar se os dados importados têm a estrutura correta
        if (!Array.isArray(result.data)) {
          this.showNotification('Arquivo inválido: deve conter um array de servidores', 'error');
          return;
        }

        const validServidores = [];
        const invalidServidores = [];
        const invalidCPFs = [];

        // Validar cada servidor importado
        result.data.forEach((servidor, index) => {
          // Primeiro verificar se tem estrutura básica
          if (!servidor || typeof servidor !== 'object') {
            invalidServidores.push({
              linha: index + 1,
              nome: 'Dados inválidos',
              cpf: 'N/A',
              erro: 'Estrutura de dados inválida'
            });
            return;
          }
          
          // Verificar CPF especificamente
          if (!this.isValidCPF(servidor.cpf)) {
            invalidCPFs.push({
              linha: index + 1,
              nome: servidor.nome || 'Nome não informado',
              cpf: servidor.cpf || 'CPF não informado',
              erro: 'CPF inválido'
            });
            return;
          }
          
          // Verificar outros dados
          if (this.validateServidorData(servidor)) {
            // Normalizar OJs se existirem
            if (servidor.ojs && Array.isArray(servidor.ojs)) {
              servidor.ojs = servidor.ojs
                .map(oj => this.normalizeOJName(oj))
                .filter(oj => oj); // Remover nulls/vazios após normalização
            }
            
            // Verificar se já existe um servidor com o mesmo CPF
            const existingIndex = this.servidores.findIndex(s => s.cpf === servidor.cpf);
            if (existingIndex >= 0) {
              // Atualizar servidor existente
              this.servidores[existingIndex] = { ...this.servidores[existingIndex], ...servidor };
            } else {
              // Adicionar novo servidor
              validServidores.push(servidor);
            }
          } else {
            // Outros problemas além do CPF
            let erro = 'Dados incompletos: ';
            if (!servidor.nome || servidor.nome.trim().length === 0) erro += 'nome inválido, ';
            if (!servidor.perfil || servidor.perfil.trim().length === 0) erro += 'perfil inválido, ';
            if (!Array.isArray(servidor.ojs)) erro += 'OJs inválidos, ';
            erro = erro.slice(0, -2); // Remove última vírgula
            
            invalidServidores.push({
              linha: index + 1,
              nome: servidor.nome || 'Nome não informado',
              cpf: servidor.cpf || 'CPF não informado',
              erro
            });
          }
        });

        // Se houver CPFs inválidos, mostrar modal para correção
        if (invalidCPFs.length > 0 || invalidServidores.length > 0) {
          const allInvalid = [...invalidCPFs, ...invalidServidores];
          this.showInvalidCPFsModal(allInvalid, validServidores, result.data);
          return;
        }

        // Adicionar servidores válidos com validação anti-duplicação
        if (validServidores.length > 0) {
          let adicionados = 0;
          let duplicatas = 0;

          validServidores.forEach(servidor => {
            const existingIndex = this.servidores.findIndex(s => s.cpf === servidor.cpf);
            if (existingIndex === -1) {
              this.servidores.push(servidor);
              adicionados++;
            } else {
              duplicatas++;
            }
          });

          await this.saveServidores();
          this.renderServidoresTable();

          // Mostrar resultado detalhado
          let message = `✅ Importação concluída!`;
          if (adicionados > 0) message += ` ${adicionados} servidores adicionados`;
          if (duplicatas > 0) message += ` (${duplicatas} duplicatas ignoradas)`;

          this.showNotification(message, 'success');
        }
        
      } else if (result.canceled) {
        // Usuário cancelou a operação
        return;
      } else {
        this.showNotification(`Erro ao importar arquivo: ${result.error || 'Formato inválido'}`, 'error');
      }
    } catch (error) {
      console.error('Erro na importação:', error);
      this.showNotification('Erro ao importar servidores: ' + error.message, 'error');
    }
  }

  // Função para validar dados do servidor
  validateServidorData(servidor) {
    return (
      servidor &&
      typeof servidor === 'object' &&
      typeof servidor.nome === 'string' &&
      servidor.nome.trim().length > 0 &&
      typeof servidor.cpf === 'string' &&
      this.isValidCPF(servidor.cpf) &&
      typeof servidor.perfil === 'string' &&
      servidor.perfil.trim().length > 0 &&
      Array.isArray(servidor.ojs)
    );
  }

  // Função para mostrar modal com CPFs inválidos
  showInvalidCPFsModal(invalidServidores, validServidores, allData) {
    // Criar modal dinamicamente
    const modal = document.createElement('div');
    modal.id = 'invalid-cpfs-modal';
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.style.zIndex = '9999';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.maxWidth = '800px';
    modalContent.style.maxHeight = '80vh';
    modalContent.style.overflow = 'auto';
    
    // Header do modal
    const header = document.createElement('div');
    header.innerHTML = `
      <h2 style="color: #dc3545; margin-bottom: 20px;">
        <i class="fas fa-exclamation-triangle"></i> Problemas na Importação
      </h2>
      <p style="margin-bottom: 20px;">
        Foram encontrados ${invalidServidores.length} servidor(es) com problemas. 
        ${validServidores.length} servidor(es) estão válidos e prontos para importação.
      </p>
    `;
    
    // Tabela de servidores inválidos
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.innerHTML = `
      <thead>
        <tr style="background-color: #f8f9fa;">
          <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">Linha</th>
          <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">Nome</th>
          <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">CPF</th>
          <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">Erro</th>
        </tr>
      </thead>
      <tbody>
        ${invalidServidores.map(servidor => `
          <tr>
            <td style="padding: 8px; border: 1px solid #dee2e6;">${servidor.linha}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6;">${servidor.nome}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; font-family: monospace;">
              ${servidor.cpf}
              ${servidor.erro === 'CPF inválido' ? 
    '<span style="color: #dc3545; font-size: 12px;"> (inválido)</span>' : ''}
            </td>
            <td style="padding: 8px; border: 1px solid #dee2e6; color: #dc3545;">
              ${servidor.erro}
            </td>
          </tr>
        `).join('')}
      </tbody>
    `;
    
    // Botões de ação
    const buttonsDiv = document.createElement('div');
    buttonsDiv.style.marginTop = '20px';
    buttonsDiv.style.display = 'flex';
    buttonsDiv.style.justifyContent = 'space-between';
    buttonsDiv.style.gap = '10px';
    
    // Botão para exportar lista de erros
    const exportButton = document.createElement('button');
    exportButton.className = 'btn btn-warning';
    exportButton.innerHTML = '<i class="fas fa-download"></i> Exportar Lista de Erros';
    exportButton.onclick = () => {
      this.exportInvalidCPFsList(invalidServidores);
    };
    
    // Container para botões da direita
    const rightButtons = document.createElement('div');
    rightButtons.style.display = 'flex';
    rightButtons.style.gap = '10px';
    
    // Botão para cancelar
    const cancelButton = document.createElement('button');
    cancelButton.className = 'btn btn-danger';
    cancelButton.innerHTML = '<i class="fas fa-times"></i> Cancelar Importação';
    cancelButton.onclick = () => {
      document.body.removeChild(modal);
      this.showNotification('Importação cancelada', 'warning');
    };
    
    // Botão para importar apenas válidos
    const importValidButton = document.createElement('button');
    importValidButton.className = 'btn btn-success';
    importValidButton.innerHTML = `<i class="fas fa-check"></i> Importar ${validServidores.length} Válidos`;
    importValidButton.disabled = validServidores.length === 0;
    importValidButton.onclick = async () => {
      document.body.removeChild(modal);
      if (validServidores.length > 0) {
        let adicionados = 0;
        let duplicatas = 0;

        validServidores.forEach(servidor => {
          const existingIndex = this.servidores.findIndex(s => s.cpf === servidor.cpf);
          if (existingIndex === -1) {
            this.servidores.push(servidor);
            adicionados++;
          } else {
            duplicatas++;
          }
        });

        await this.saveServidores();
        this.renderServidoresTable();

        let message = `✅ ${adicionados} servidor(es) válido(s) importado(s) com sucesso!`;
        if (invalidServidores.length > 0) {
          message += ` ${invalidServidores.length} ignorado(s) por problemas de validação.`;
        }
        if (duplicatas > 0) {
          message += ` ${duplicatas} duplicatas ignoradas.`;
        }

        this.showNotification(message, 'success');
      }
    };
    
    // Montar botões
    buttonsDiv.appendChild(exportButton);
    rightButtons.appendChild(cancelButton);
    rightButtons.appendChild(importValidButton);
    buttonsDiv.appendChild(rightButtons);
    
    // Montar modal
    modalContent.appendChild(header);
    modalContent.appendChild(table);
    modalContent.appendChild(buttonsDiv);
    modal.appendChild(modalContent);
    
    // Adicionar ao body
    document.body.appendChild(modal);
    
    // Fechar ao clicar fora do modal
    modal.onclick = (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
        this.showNotification('Importação cancelada', 'warning');
      }
    };
  }
  
  // Função para exportar lista de CPFs inválidos
  exportInvalidCPFsList(invalidServidores) {
    const csvContent = 'Linha,Nome,CPF,Erro\n' +
      invalidServidores.map(s => 
        `${s.linha},"${s.nome}","${s.cpf}","${s.erro}"`
      ).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `servidores_invalidos_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    this.showNotification('Lista de erros exportada como CSV', 'success');
  }

  // Função para mostrar exemplo de importação de servidores
  showServidorImportExample() {
    const modal = document.getElementById('servidor-import-example-modal');
    modal.style.display = 'block';

    // Fechar modal ao clicar no X
    const closeBtn = modal.querySelector('.close');
    closeBtn.onclick = () => {
      modal.style.display = 'none';
    };

    // Fechar modal ao clicar fora dele
    window.onclick = (event) => {
      if (event.target === modal) {
        modal.style.display = 'none';
      }
    };
  }



  toggleServidorSelection(index) {
    console.log(`toggleServidorSelection chamado para índice: ${index}`);
    const checkboxIndex = this.selectedServidores.indexOf(index);
    console.log('Estado anterior dos selecionados:', this.selectedServidores);
        
    if (checkboxIndex >= 0) {
      this.selectedServidores.splice(checkboxIndex, 1);
      console.log(`Removendo servidor ${index}`);
    } else {
      this.selectedServidores.push(index);
      console.log(`Adicionando servidor ${index}`);
    }
    
    console.log('Estado novo dos selecionados:', this.selectedServidores);
        
    this.updateSelectedServidoresDisplay();
    this.renderServidoresTable();
    this.updateBulkDeleteButtons();
  }

  selectAllServidores(selectAll) {
    console.log('selectAllServidores chamado com:', selectAll);
    console.log('Total de servidores:', this.servidores.length);
    
    if (selectAll) {
      this.selectedServidores = this.servidores.map((_, index) => index);
    } else {
      this.selectedServidores = [];
    }
    
    console.log('Servidores selecionados após mudança:', this.selectedServidores);
        
    this.updateSelectedServidoresDisplay();
    this.renderServidoresTable();
    this.updateBulkDeleteButtons();
  }

  selectAllPeritos(selectAll) {
    if (selectAll) {
      this.selectedPeritos = this.peritos.map((_, index) => index);
    } else {
      this.selectedPeritos = [];
    }
        
    this.updateSelectedPeritosDisplay();
    this.renderPeritosTable();
    this.updateAutomationButton();
    this.updateBulkDeleteButtons();
  }

  updateSelectedServidoresDisplay() {
    const container = document.getElementById('selected-servidores-list');
    if (!container) return;

    if (this.selectedServidores.length === 0) {
      container.innerHTML = `
        <p class="no-selection">
          <i class="fas fa-inbox"></i>
          <br>
          Nenhum servidor selecionado
          <br>
          <small>Vá para a aba "Servidores" e marque os servidores que deseja processar</small>
        </p>
      `;

      // Update counters
      const selectedCount = document.getElementById('selected-count');
      const totalCount = document.getElementById('total-count');
      if (selectedCount) selectedCount.textContent = '0';
      if (totalCount) totalCount.textContent = this.servidores.length;

      return;
    }

    const selectedServidoresList = this.selectedServidores.map((index, itemIndex) => {
      const servidor = this.servidores[index];
      const ojCount = servidor.ojs ? servidor.ojs.length : 0;
      const statusClass = servidor._processingStatus || 'queued';
      const itemId = `servidor-item-${index}`;

      return `
        <div class="selected-item ${statusClass}" id="${itemId}" data-index="${index}">
          <h4>
            ${servidor.nome}
            ${statusClass === 'processing' ? '<span class="item-status-badge status-processing"><i class="fas fa-spinner fa-spin"></i> Processando</span>' : ''}
            ${statusClass === 'completed' ? '<span class="item-status-badge status-completed"><i class="fas fa-check"></i> Concluído</span>' : ''}
            ${statusClass === 'error' ? '<span class="item-status-badge status-error"><i class="fas fa-times"></i> Erro</span>' : ''}
            ${statusClass === 'queued' ? '<span class="item-status-badge status-queued"><i class="fas fa-clock"></i> Na Fila</span>' : ''}
          </h4>
          <p><i class="fas fa-id-card"></i> CPF: <strong>${servidor.cpf}</strong></p>
          <p><i class="fas fa-user-tag"></i> Perfil: ${servidor.perfil}</p>
          <p><i class="fas fa-gavel"></i> ${ojCount} órgão(s) julgador(es) para processar</p>
        </div>
      `;
    }).join('');

    container.innerHTML = selectedServidoresList;

    // Update counter display
    const selectedCount = document.getElementById('selected-count');
    const totalCount = document.getElementById('total-count');
    if (selectedCount) selectedCount.textContent = this.selectedServidores.length;
    if (totalCount) totalCount.textContent = this.servidores.length;

    // Update automation button state
    this.updateServidorAutomationButton();

    // Update select-all checkbox state
    this.updateSelectAllServidoresCheckbox();

    // Update badge da tab de automação
    this.updateAutomacaoTabBadge();

    // Update botão flutuante de ação rápida
    this.updateQuickAutomationButton();
  }

  updateAutomacaoTabBadge() {
    const badge = document.getElementById('automacao-tab-badge');
    const count = this.selectedServidores.length;

    if (badge) {
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  updateQuickAutomationButton() {
    const quickBtn = document.getElementById('quick-automation-btn');
    const fabCount = document.getElementById('fab-count');
    const count = this.selectedServidores.length;

    // Verificar se estamos na tab "Lista" de servidores
    const servidoresTab = document.getElementById('servidores');
    const isServidoresTabActive = servidoresTab && servidoresTab.classList.contains('active');
    const listaTab = document.getElementById('servidor-lista-tab');
    const isListaTabActive = listaTab && listaTab.classList.contains('active');

    if (quickBtn && fabCount) {
      if (count > 0 && isServidoresTabActive && isListaTabActive) {
        fabCount.textContent = count;
        quickBtn.style.display = 'flex';
      } else {
        quickBtn.style.display = 'none';
      }
    }
  }

  // Atualizar status visual de um servidor específico durante processamento
  updateServidorItemStatus(servidorIndex, status) {
    const itemId = `servidor-item-${servidorIndex}`;
    const item = document.getElementById(itemId);
    if (!item) return;

    // Remover classes anteriores
    item.classList.remove('queued', 'processing', 'completed', 'error');

    // Adicionar nova classe
    item.classList.add(status);

    // Atualizar badge de status
    const servidor = this.servidores[servidorIndex];
    const ojCount = servidor.ojs ? servidor.ojs.length : 0;

    let statusBadge = '';
    switch(status) {
      case 'processing':
        statusBadge = '<span class="item-status-badge status-processing"><i class="fas fa-spinner fa-spin"></i> Processando</span>';
        break;
      case 'completed':
        statusBadge = '<span class="item-status-badge status-completed"><i class="fas fa-check"></i> Concluído</span>';
        break;
      case 'error':
        statusBadge = '<span class="item-status-badge status-error"><i class="fas fa-times"></i> Erro</span>';
        break;
      case 'queued':
        statusBadge = '<span class="item-status-badge status-queued"><i class="fas fa-clock"></i> Na Fila</span>';
        break;
    }

    item.innerHTML = `
      <h4>
        ${servidor.nome}
        ${statusBadge}
      </h4>
      <p><i class="fas fa-id-card"></i> CPF: <strong>${servidor.cpf}</strong></p>
      <p><i class="fas fa-user-tag"></i> Perfil: ${servidor.perfil}</p>
      <p><i class="fas fa-gavel"></i> ${ojCount} órgão(s) julgador(es) para processar</p>
    `;

    // Scroll para o item sendo processado
    if (status === 'processing') {
      item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // ===== AUTOMATION METHODS =====

  async startAutomation() {
    // Log detalhado do início da automação de peritos
    const timestamp = new Date().toLocaleTimeString();
    console.log(`👨‍⚖️ [${timestamp}] INÍCIO AUTOMAÇÃO PERITO - Estado atual:`, {
      selectedPeritos: this.selectedPeritos.length,
      isAutomationRunning: this.isAutomationRunning,
      totalPeritos: this.peritos.length
    });

    // Verificar debounce primeiro
    if (!this.canExecuteAutomation('perito')) {
      console.log(`⏸️ [${timestamp}] AUTOMAÇÃO PERITO BLOQUEADA - Debounce ativo`);
      return;
    }

    if (this.selectedPeritos.length === 0) {
      console.log(`❌ [${timestamp}] AUTOMAÇÃO PERITO CANCELADA - Nenhum perito selecionado`);
      this.showNotification('Selecione pelo menos um perito para iniciar a automação', 'warning');
      return;
    }

    // Log dos peritos selecionados
    const peritosSelecionados = this.selectedPeritos.map(index => {
      const perito = this.peritos[index];
      return `${perito.nome} (${perito.cpf}) - ${perito.ojs.length} OJs`;
    });
    console.log(`📋 [${timestamp}] PERITOS SELECIONADOS:`, peritosSelecionados);

    // Atualizar indicador visual para "executando"
    this.setAutomationRunning('perito', `Processando ${this.selectedPeritos.length} perito(s)`);

    this.isAutomationRunning = true;
    const startButton = document.getElementById('start-automation');
    startButton.disabled = true;
    startButton.classList.add('loading-pulse');
    this.updateAutomationButton();
        
    // Calcular total de passos para progress
    const selectedPeritosList = this.selectedPeritos.map(index => {
      const perito = this.peritos[index];

      // Marcar status inicial como "queued"
      this.updatePeritoItemStatus(index, 'queued');

      return {
        ...perito,
        _originalIndex: index // Guardar índice original para tracking
      };
    });

    this.totalSteps = selectedPeritosList.reduce((total, perito) => {
      return total + 3 + perito.ojs.length; // login + navegação + verificação + OJs
    }, 0);
    this.currentProgress = 0;

    // Iniciar timer
    this.startAutomationTimer();

    // Reset detailed status for new automation
    this.resetDetailedStatus();

    this.showLoading('Iniciando automação...', 'Preparando sistema e abrindo navegador');
    this.clearStatusLog();
    this.addStatusMessage('info', 'Iniciando automação...');

    try {
      const result = await window.electronAPI.startAutomation(selectedPeritosList);
            
      if (!result || !result.success) {
        const errorMsg = result && result.error ? result.error : 'Erro desconhecido';
        this.addStatusMessage('error', 'Erro na automação: ' + errorMsg);
        this.setAutomationError('perito', errorMsg);

        // Marcar peritos com erro
        selectedPeritosList.forEach(perito => {
          if (perito._originalIndex !== undefined) {
            this.updatePeritoItemStatus(perito._originalIndex, 'error');
          }
        });
      } else {
        this.setAutomationCompleted('perito', 'Automação de peritos concluída');

        // Marcar todos os peritos como concluídos visualmente
        selectedPeritosList.forEach(perito => {
          if (perito._originalIndex !== undefined) {
            this.updatePeritoItemStatus(perito._originalIndex, 'completed');
          }
        });
      }
    } catch (error) {
      this.addStatusMessage('error', 'Erro ao iniciar automação: ' + error.message);
      this.setAutomationError('perito', 'Erro ao iniciar: ' + error.message);
    } finally {
      this.hideLoading();
      startButton.classList.remove('loading');
      this.isAutomationRunning = false;
      startButton.disabled = false;
      // Manter o botão de parar habilitado para permitir fechar o navegador manualmente
      stopButton.disabled = false;
      this.updateAutomationButton();
      
      // Se não houve erro, definir como idle após um tempo
      if (!this.hasAutomationError) {
        setTimeout(() => {
          this.setAutomationIdle('perito');
        }, 3000);
      }
    }
  }

  /**
   * Configurar listeners para progresso em tempo real
   */
  setupRealtimeProgressListeners() {
    // Remover listeners anteriores se existirem
    this.removeRealtimeProgressListeners();

    // Adicionar novo listener para progresso
    this.progressListener = (data) => {
      this.handleAutomationProgress(data);
    };

    // Registrar listener
    if (window.electronAPI && window.electronAPI.onAutomationProgress) {
      window.electronAPI.onAutomationProgress(this.progressListener);
    }
  }

  /**
   * Remover listeners de progresso
   */
  removeRealtimeProgressListeners() {
    if (this.progressListener && window.electronAPI && window.electronAPI.removeAllListeners) {
      window.electronAPI.removeAllListeners('automation-progress');
      this.progressListener = null;
    }
  }

  /**
   * Processar evento de progresso da automação
   */
  handleAutomationProgress(data) {
    if (!data) return;

    const { type, message, progress, subtitle, servidor, orgaoJulgador, ojProcessed, totalOjs, servidorStatus, perito, peritoStatus } = data;

    // Atualizar status visual do servidor na lista
    if (servidor && servidorStatus) {
      // Encontrar índice do servidor pelo nome ou CPF
      const servidorIndex = this.selectedServidores.find(index => {
        const srv = this.servidores[index];
        return srv.nome === servidor || srv.cpf === servidor;
      });

      if (servidorIndex !== undefined) {
        // Mapear status do backend para status visual
        let visualStatus = 'queued';
        if (servidorStatus === 'processing' || servidorStatus === 'in_progress') {
          visualStatus = 'processing';
        } else if (servidorStatus === 'completed' || servidorStatus === 'success') {
          visualStatus = 'completed';
        } else if (servidorStatus === 'error' || servidorStatus === 'failed') {
          visualStatus = 'error';
        }

        this.updateServidorItemStatus(servidorIndex, visualStatus);
      }
    }

    // Atualizar status visual do perito na lista
    if (perito && peritoStatus) {
      // Encontrar índice do perito pelo nome ou CPF
      const peritoIndex = this.selectedPeritos.find(index => {
        const prt = this.peritos[index];
        return prt.nome === perito || prt.cpf === perito;
      });

      if (peritoIndex !== undefined) {
        // Mapear status do backend para status visual
        let visualStatus = 'queued';
        if (peritoStatus === 'processing' || peritoStatus === 'in_progress') {
          visualStatus = 'processing';
        } else if (peritoStatus === 'completed' || peritoStatus === 'success') {
          visualStatus = 'completed';
        } else if (peritoStatus === 'error' || peritoStatus === 'failed') {
          visualStatus = 'error';
        }

        this.updatePeritoItemStatus(peritoIndex, visualStatus);
      }
    }

    // Atualizar estatísticas em tempo real
    if (this.currentAutomationStats) {
      if (servidor && servidor !== this.currentAutomationStats.servidorAtual) {
        this.currentAutomationStats.servidorAtual = servidor;
        this.currentAutomationStats.servidoresProcessados++;
      }

      if (orgaoJulgador) {
        this.currentAutomationStats.ojAtual = orgaoJulgador;
      }

      if (ojProcessed !== undefined) {
        this.currentAutomationStats.ojsProcessados = ojProcessed;
      }

      if (totalOjs !== undefined) {
        this.currentAutomationStats.totalOjs = totalOjs;
      }

      // Atualizar tipo de evento para estatísticas
      if (type === 'success') {
        this.currentAutomationStats.sucessos++;
      } else if (type === 'error') {
        this.currentAutomationStats.erros++;
      }
    }

    // Atualizar mensagem de status com detalhes em tempo real
    let statusMessage = message;
    if (subtitle) {
      statusMessage += ` - ${subtitle}`;
    }

    // Adicionar informações contextuais
    const contextInfo = [];
    if (servidor) {
      contextInfo.push(`Servidor: ${servidor}`);
    }
    if (orgaoJulgador) {
      contextInfo.push(`OJ: ${orgaoJulgador}`);
    }
    if (ojProcessed !== undefined && totalOjs !== undefined) {
      contextInfo.push(`Progresso: ${ojProcessed}/${totalOjs} OJs`);
    }

    if (contextInfo.length > 0) {
      statusMessage += ` (${contextInfo.join(' | ')})`;
    }

    // Adicionar mensagem ao log
    this.addStatusMessage(type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'info', statusMessage);

    // Atualizar barra de progresso
    if (progress !== null && progress !== undefined) {
      this.updateProgressBar(progress);
    }

    // Atualizar painel de estatísticas em tempo real
    this.updateRealtimeStats();
  }

  /**
   * Atualizar barra de progresso visual
   */
  updateProgressBar(progress) {
    const progressBar = document.querySelector('.automation-progress-bar');
    if (!progressBar) {
      // Criar barra de progresso se não existir
      this.createProgressBar();
    }

    const progressFill = document.querySelector('.automation-progress-fill');
    const progressText = document.querySelector('.automation-progress-text');

    if (progressFill) {
      progressFill.style.width = `${progress}%`;
    }

    if (progressText) {
      progressText.textContent = `${Math.round(progress)}%`;
    }
  }

  /**
   * Criar barra de progresso visual
   */
  createProgressBar() {
    const statusContainer = document.querySelector('.status-log');
    if (!statusContainer) return;

    const progressBar = document.createElement('div');
    progressBar.className = 'automation-progress-bar';
    progressBar.innerHTML = `
      <div class="automation-progress-fill"></div>
      <div class="automation-progress-text">0%</div>
    `;

    // Adicionar estilos inline temporários
    progressBar.style.cssText = `
      position: relative;
      height: 30px;
      background: #f0f0f0;
      border-radius: 15px;
      margin: 10px 0;
      overflow: hidden;
    `;

    const fill = progressBar.querySelector('.automation-progress-fill');
    fill.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      background: linear-gradient(90deg, #4CAF50, #8BC34A);
      border-radius: 15px;
      transition: width 0.3s ease;
      width: 0%;
    `;

    const text = progressBar.querySelector('.automation-progress-text');
    text.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-weight: bold;
      color: #333;
      z-index: 1;
    `;

    statusContainer.insertBefore(progressBar, statusContainer.firstChild);
  }

  /**
   * Atualizar painel de estatísticas em tempo real
   */
  updateRealtimeStats() {
    if (!this.currentAutomationStats) return;

    const stats = this.currentAutomationStats;
    const tempoDecorrido = Math.floor((Date.now() - stats.tempoInicio) / 1000);
    const minutos = Math.floor(tempoDecorrido / 60);
    const segundos = tempoDecorrido % 60;

    // Criar ou atualizar painel de estatísticas
    let statsPanel = document.querySelector('.automation-stats-panel');
    if (!statsPanel) {
      const statusContainer = document.querySelector('.status-log');
      if (!statusContainer) return;

      statsPanel = document.createElement('div');
      statsPanel.className = 'automation-stats-panel';
      statsPanel.style.cssText = `
        background: #f5f5f5;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 15px;
        margin: 10px 0;
        font-family: monospace;
      `;
      statusContainer.insertBefore(statsPanel, statusContainer.firstChild);
    }

    // Calcular velocidade e tempo estimado
    const velocidade = stats.ojsProcessados > 0 ? (stats.ojsProcessados / tempoDecorrido * 60).toFixed(1) : 0;
    const tempoRestante = stats.totalOjs > 0 && stats.ojsProcessados > 0
      ? Math.ceil((stats.totalOjs - stats.ojsProcessados) / (stats.ojsProcessados / tempoDecorrido))
      : 0;
    const minutosRestantes = Math.floor(tempoRestante / 60);
    const segundosRestantes = tempoRestante % 60;

    statsPanel.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
        <div>
          <strong>Servidor Atual:</strong> ${stats.servidorAtual || 'Aguardando...'}<br>
          <strong>OJ Atual:</strong> ${stats.ojAtual || 'Aguardando...'}<br>
          <strong>Tempo Decorrido:</strong> ${minutos}min ${segundos}s
        </div>
        <div>
          <strong>Servidores:</strong> ${stats.servidoresProcessados}/${stats.totalServidores}<br>
          <strong>OJs Processados:</strong> ${stats.ojsProcessados}/${stats.totalOjs}<br>
          <strong>Tempo Restante:</strong> ${minutosRestantes}min ${segundosRestantes}s
        </div>
      </div>
      <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ccc;">
        <strong>Estatísticas:</strong>
        <span style="color: #4CAF50; margin-left: 10px;">✅ Sucessos: ${stats.sucessos}</span>
        <span style="color: #f44336; margin-left: 10px;">❌ Erros: ${stats.erros}</span>
        <span style="color: #2196F3; margin-left: 10px;">⚡ Velocidade: ${velocidade} OJs/min</span>
      </div>
    `;
  }

  /**
   * Gerar relatório final de estatísticas
   */
  generateFinalReport() {
    if (!this.currentAutomationStats) return;

    const stats = this.currentAutomationStats;
    const tempoTotal = Math.floor((Date.now() - stats.tempoInicio) / 1000);
    const minutos = Math.floor(tempoTotal / 60);
    const segundos = tempoTotal % 60;

    const taxaSucesso = stats.ojsProcessados > 0
      ? ((stats.sucessos / stats.ojsProcessados) * 100).toFixed(1)
      : 0;

    const report = `
      \n📊 RELATÓRIO FINAL DA AUTOMAÇÃO
      ================================
      ⏱ Tempo Total: ${minutos}min ${segundos}s
      👥 Servidores Processados: ${stats.servidoresProcessados}/${stats.totalServidores}
      📋 OJs Processados: ${stats.ojsProcessados}/${stats.totalOjs}
      ✅ Sucessos: ${stats.sucessos}
      ❌ Erros: ${stats.erros}
      📈 Taxa de Sucesso: ${taxaSucesso}%
      ⚡ Velocidade Média: ${(stats.ojsProcessados / tempoTotal * 60).toFixed(1)} OJs/min
      ================================
    `;

    // Adicionar ao log
    this.addStatusMessage('success', report.split('\n').filter(l => l.trim()).join(' | '));

    // Exibir em modal ou alerta
    console.log(report);

    // Limpar estatísticas
    this.currentAutomationStats = null;

    // Remover paineis temporários após 5 segundos
    setTimeout(() => {
      const elements = ['.automation-progress-bar', '.automation-stats-panel'];
      elements.forEach(selector => {
        const el = document.querySelector(selector);
        if (el) el.remove();
      });
    }, 5000);
  }

  stopAutomation() {
    this.addStatusMessage('warning', 'Parando automação...');
    window.electronAPI.stopAutomation().then((result) => {
      if (!result.success) {
        this.addStatusMessage('error', 'Falha ao parar automação: ' + (result && result.error ? result.error : 'Erro desconhecido'));
      }
    }).finally(() => {
      this.isAutomationRunning = false;
      const startButton = document.getElementById('start-automation');
      startButton.disabled = false;
      this.updateAutomationButton();
      this.stopAutomationTimer();

      // Reset detailed status when automation stops
      this.resetDetailedStatus();

      // Gerar relatório final se houver estatísticas
      if (this.currentAutomationStats) {
        this.generateFinalReport();
      }
    });
  }

  async startServidorAutomation() {
    // Log detalhado do início da automação
    const timestamp = new Date().toLocaleTimeString();
    console.log(`🚀 [${timestamp}] INÍCIO AUTOMAÇÃO SERVIDOR - Estado atual:`, {
      selectedServidores: this.selectedServidores.length,
      isAutomationRunning: this.isAutomationRunning,
      automationInProgress: window.electronAPI ? 'disponível' : 'indisponível'
    });

    // Verificar debounce primeiro
    if (!this.canExecuteAutomation('servidor')) {
      console.log(`⏸️ [${timestamp}] AUTOMAÇÃO BLOQUEADA - Debounce ativo`);
      return;
    }

    if (this.selectedServidores.length === 0) {
      console.log(`📋 [${timestamp}] NENHUM SERVIDOR SELECIONADO - Processando TODOS automaticamente`);
      // Selecionar todos os servidores automaticamente
      this.selectedServidores = this.servidores.map((_, index) => index);
      this.showNotification(`Processando todos os ${this.servidores.length} servidores automaticamente`, 'info');
      console.log(`✅ [${timestamp}] AUTO-SELEÇÃO - ${this.servidores.length} servidores selecionados`);
    }

    // Log dos servidores selecionados
    const servidoresSelecionados = this.selectedServidores.map(index => {
      const servidor = this.servidores[index];
      return `${servidor.nome} (${servidor.cpf})`;
    });
    console.log(`📋 [${timestamp}] SERVIDORES SELECIONADOS:`, servidoresSelecionados);

    // Atualizar indicador visual para "executando"
    const selectedMode = document.querySelector('input[name="automation-mode"]:checked');
    const isParallelMode = selectedMode && selectedMode.value === 'parallel';
    const modeText = isParallelMode ? 'paralela' : 'sequencial';
    this.setAutomationRunning('servidor', `Automação ${modeText} - ${this.selectedServidores.length} servidor(es)`);

    // Iniciar automação imediatamente sem verificação prévia
    this.addStatusMessage('info', '🚀 Iniciando automação imediatamente...');
    
    // Prosseguir com automação normal
    
    if (isParallelMode) {
      return this.startParallelAutomation();
    } else {
      return this.startSequentialAutomation();
    }
  }

  /**
   * Realiza verificação prévia de todos os servidores selecionados
   * @returns {Promise<Array>} Array com resultados da verificação para cada servidor
   */
  async realizarVerificacaoPrevia() {
    const resultados = [];
    
    // OTIMIZAÇÃO: Verificar se deve pular verificações desnecessárias
    const skipAutomationVerification = await window.electronAPI.getOptimizationConfig('skipAutomationVerification');
    
    if (skipAutomationVerification) {
      this.addStatusMessage('info', '⚡ Modo otimizado: Pulando verificação de banco desnecessária');
      this.addStatusMessage('info', '🚀 Iniciando automação diretamente com configuração existente');
      
      // Retornar resultados simulados para manter compatibilidade
      for (const serverIndex of this.selectedServidores) {
        const servidor = this.servidores[serverIndex];
        if (servidor) {
          const ojs = servidor.ojs || servidor.orgaos || [];
          resultados.push({
            servidor,
            verificacao: {
              ojsParaProcessar: ojs,
              ojsJaCadastrados: [],
              totalParaProcessar: ojs.length,
              totalJaCadastrados: 0,
              tempoEconomizado: 0,
              otimizado: true
            },
            sucesso: true
          });
        }
      }
      return resultados;
    }
    
    // Debug visível na interface
    this.addStatusMessage('info', `📋 Processando ${this.selectedServidores.length} servidor(es) selecionado(s)`);
    
    // Debug removido para produção
    console.log('🔍 [DEBUG] ESTRUTURA DADOS - servidores array:', this.servidores);
    
    if (this.selectedServidores.length === 0) {
      console.log('📋 [DEBUG] ESTRUTURA DADOS - Nenhum servidor selecionado, selecionando TODOS automaticamente');
      this.selectedServidores = this.servidores.map((_, index) => index);
      console.log(`✅ [DEBUG] AUTO-SELEÇÃO - ${this.servidores.length} servidores selecionados para verificação`);
    }
    
    for (const serverIndex of this.selectedServidores) {
      // Buscar o servidor real usando o índice
      const servidor = this.servidores[serverIndex];
      
      if (!servidor) {
        console.log(`❌ [DEBUG] ESTRUTURA DADOS - Servidor não encontrado no índice ${serverIndex}`);
        continue;
      }
      
      console.log('🔍 [DEBUG] ESTRUTURA DADOS - Processando servidor:', servidor);
      console.log('🔍 [DEBUG] ESTRUTURA DADOS - Chaves disponíveis:', Object.keys(servidor || {}));
      
      // Debug visível sobre os dados do servidor
      this.addStatusMessage('info', `🔍 Verificando servidor: ${servidor.nome || 'NOME_INDEFINIDO'} (${servidor.cpf || 'CPF_INDEFINIDO'})`);
      this.addStatusMessage('info', `👤 Servidor: ${servidor.nome || servidor.cpf} - Perfil: ${servidor.perfil || 'Não definido'}`);
      
      // CORRIGIR: usar servidor.ojs em vez de servidor.orgaos
      const ojs = servidor.ojs || servidor.orgaos || [];
      this.addStatusMessage('info', `🔍 DEBUG: OJs = ${JSON.stringify(ojs)}`);
      this.addStatusMessage('info', `🔍 DEBUG: Quantidade OJs = ${ojs.length}`);
      
      console.log('🔍 [DEBUG] BOTUCATU FRONTEND - ENVIANDO para verificação:');
      console.log(`   Servidor: ${servidor.nome}`);
      console.log(`   CPF: ${servidor.cpf}`);
      console.log(`   Perfil: ${servidor.perfil}`);
      console.log(`   OJs: ${JSON.stringify(ojs)}`);
      
      try {
        // Chamar verificação em tempo real para este servidor - CORRIGIDO para usar ojs
        const resultado = await window.electronAPI.verifyServidorOjsRealtime(
          servidor.cpf, 
          servidor.perfil, 
          ojs
        );
        
        console.log('🔍 [DEBUG] BOTUCATU FRONTEND - RESULTADO da verificação:', resultado);
        
        resultados.push({
          servidor,
          verificacao: resultado,
          sucesso: true
        });
        
        // Ajustar contadores com base nas propriedades reais retornadas pelo backend
        const totalParaProcessar = Array.isArray(resultado.ojsParaProcessar)
          ? resultado.ojsParaProcessar.length
          : (resultado.totalParaProcessar || 0);
        const totalJaCadastrados = Array.isArray(resultado.ojsJaCadastrados)
          ? resultado.ojsJaCadastrados.length
          : (resultado.totalJaCadastrados || 0);

        this.addStatusMessage('success', 
          `✅ ${servidor.nome}: ${totalParaProcessar} OJs para processar, ${totalJaCadastrados} já cadastrados`
        );
        
      } catch (error) {
        console.error(`Erro na verificação de ${servidor.nome}:`, error);
        resultados.push({
          servidor,
          erro: error.message,
          sucesso: false
        });
        
        this.addStatusMessage('error', `❌ Erro ao verificar ${servidor.nome}: ${error.message}`);
      }
    }
    
    return resultados;
  }

  /**
   * Mostra painel de confirmação com resultados da verificação
   * @param {Array} resultadosVerificacao - Resultados da verificação prévia
   * @returns {Promise<boolean>} True se o usuário confirmar, false caso contrário
   */
  async mostrarPainelConfirmacao(resultadosVerificacao) {
    return new Promise((resolve) => {
      // Criar HTML do modal de confirmação
      let htmlContent = `
        <div class="verification-summary">
          <h3>🧠 Verificação Inteligente Concluída</h3>
          <p>Análise prévia dos servidores selecionados:</p>
        </div>
      `;
      
      let totalParaProcessar = 0;
      let totalJaCadastrados = 0;
      let tempoEconomizado = 0;
      
      // Gerar detalhes para cada servidor
      resultadosVerificacao.forEach((resultado, index) => {
        if (resultado.sucesso && resultado.verificacao) {
          const verificacao = resultado.verificacao;
          const stats = verificacao.estatisticas || {};
          
          // Corrigir nomes das propriedades - o banco retorna 'paraProcessar' e 'jaCadastrados'
          const paraProcesarCount = stats.paraProcessar || verificacao.ojsParaProcessar?.length || 0;
          const jaCadastradosCount = stats.jaCadastrados || verificacao.ojsJaCadastrados?.length || 0;
          
          console.log(`🔍 [DEBUG] BOTUCATU FRONTEND - Servidor: ${resultado.servidor.nome}`);
          console.log('🔍 [DEBUG] BOTUCATU FRONTEND - Verificacao:', verificacao);
          console.log('🔍 [DEBUG] BOTUCATU FRONTEND - Stats:', stats);
          console.log(`🔍 [DEBUG] BOTUCATU FRONTEND - Para Processar: ${paraProcesarCount}`);
          console.log(`🔍 [DEBUG] BOTUCATU FRONTEND - Já Cadastrados: ${jaCadastradosCount}`);
          
          totalParaProcessar += paraProcesarCount;
          totalJaCadastrados += jaCadastradosCount;
          tempoEconomizado += stats.economiaEstimada || 0;
          
          htmlContent += `
            <div class="servidor-verification-result">
              <h4>👤 ${resultado.servidor.nome}</h4>
              <p><strong>CPF:</strong> ${resultado.servidor.cpf} | <strong>Perfil:</strong> ${resultado.servidor.perfil}</p>
              
              <div class="oj-status-summary">
                <div class="status-item success">
                  <i class="fas fa-check-circle"></i>
                  <span>Já Cadastrados: <strong>${jaCadastradosCount}</strong></span>
                </div>
                <div class="status-item warning">
                  <i class="fas fa-plus-circle"></i>
                  <span>Para Processar: <strong>${paraProcesarCount}</strong></span>
                </div>
                <div class="status-item info">
                  <i class="fas fa-clock"></i>
                  <span>Economia: <strong>${stats.economiaEstimada || 0}s</strong></span>
                </div>
              </div>
              
              ${jaCadastradosCount > 0 ? `
                <details class="oj-details">
                  <summary>OJs Já Cadastrados (${jaCadastradosCount})</summary>
                  <ul>
                    ${(verificacao.ojsJaCadastrados || []).map(oj => `<li>✅ ${oj.nome || oj}</li>`).join('')}
                  </ul>
                </details>
              ` : ''}
              
      ${paraProcesarCount > 0 ? `
        <details class="oj-details">
          <summary>OJs Para Processar (${paraProcesarCount})</summary>
          <ul>
            ${(verificacao.ojsParaProcessar || []).map(oj => `<li>${oj}</li>`).join('')}
          </ul>
        </details>
      ` : ''}
            </div>
          `;
        } else {
          htmlContent += `
            <div class="servidor-verification-result error">
              <h4>👤 ${resultado.servidor.nome}</h4>
              <p><strong>CPF:</strong> ${resultado.servidor.cpf}</p>
              <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <span>Erro: ${resultado.erro}</span>
              </div>
            </div>
          `;
        }
      });
      
      // Resumo geral
      htmlContent += `
        <div class="verification-total-summary">
          <h3>📊 Resumo Geral</h3>
          <div class="summary-stats">
            <div class="stat-item">
              <i class="fas fa-server"></i>
              <span>Servidores: <strong>${resultadosVerificacao.length}</strong></span>
            </div>
            <div class="stat-item">
              <i class="fas fa-plus-circle"></i>
              <span>Total Para Processar: <strong>${totalParaProcessar}</strong></span>
            </div>
            <div class="stat-item">
              <i class="fas fa-check-circle"></i>
              <span>Total Já Cadastrados: <strong>${totalJaCadastrados}</strong></span>
            </div>
            <div class="stat-item">
              <i class="fas fa-clock"></i>
              <span>Tempo Economizado: <strong>${Math.round(tempoEconomizado / 60)}min ${tempoEconomizado % 60}s</strong></span>
            </div>
          </div>
        </div>
      `;
      
      // Mostrar modal personalizado
      const modal = this.createCustomModal(
        '🎯 Confirmação de Automação', 
        htmlContent,
        [
          { text: 'Cancelar', class: 'btn-secondary', action: () => resolve(false) },
          { text: 'Continuar Automação', class: 'btn-success', action: () => resolve(true) }
        ]
      );
      
      document.body.appendChild(modal);
      modal.style.display = 'flex';
    });
  }

  /**
   * Atualiza servidores selecionados com dados da verificação
   * @param {Array} resultadosVerificacao - Resultados da verificação prévia
   */
  atualizarServidoresComVerificacao(resultadosVerificacao) {
    resultadosVerificacao.forEach(resultado => {
      if (resultado.sucesso && resultado.verificacao) {
        // Encontrar o servidor real no array usando CPF
        const serverIndex = this.servidores.findIndex(s => s.cpf === resultado.servidor.cpf);
        if (serverIndex !== -1) {
          const servidor = this.servidores[serverIndex];
          // Atualizar servidor com dados da verificação inteligente
          // Importante: não sobrescrever a lista original (servidor.ojs),
          // para que a verificação futura sempre considere todos os OJs originais.
          servidor.verificacaoInteligente = resultado.verificacao;
          servidor.ojsParaProcessar = resultado.verificacao.ojsParaProcessar || [];
          servidor.ojsJaCadastrados = resultado.verificacao.ojsJaCadastrados || [];
          servidor.tempoEconomizado = (resultado.verificacao.economiaEstimada?.tempo)
            || (resultado.verificacao.estatisticas?.economiaEstimada)
            || 0;
          
          console.log(`✅ [DEBUG] Servidor atualizado: ${servidor.nome}`, {
            ojsOriginais: resultado.servidor.ojs?.length || 0,
            ojsParaProcessar: servidor.ojs?.length || 0,
            ojsJaCadastrados: servidor.ojsJaCadastrados?.length || 0
          });
        }
      }
    });
    
    this.addStatusMessage('success', '✅ Servidores atualizados com verificação inteligente - Iniciando automação...');
  }

  /**
   * Cria modal customizado
   */
  createCustomModal(title, content, buttons) {
    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.innerHTML = `
      <div class="custom-modal-content verification-modal">
        <div class="custom-modal-header">
          <h2>${title}</h2>
        </div>
        <div class="custom-modal-body">
          ${content}
        </div>
        <div class="custom-modal-footer">
          ${buttons.map(btn => `<button class="btn ${btn.class}" data-action="${buttons.indexOf(btn)}">${btn.text}</button>`).join('')}
        </div>
      </div>
    `;
    
    // Adicionar event listeners
    buttons.forEach((btn, index) => {
      const button = modal.querySelector(`[data-action="${index}"]`);
      button.addEventListener('click', () => {
        modal.remove();
        btn.action();
      });
    });
    
    return modal;
  }

  async startSequentialAutomation() {
    this.isAutomationRunning = true;
    const startButton = document.getElementById('start-servidor-automation');
    const stopButton = document.getElementById('stop-servidor-automation');

    // Reset detailed status for new automation
    this.resetDetailedStatus();
    startButton.disabled = true;
    stopButton.disabled = false;
    startButton.classList.add('loading');

    // Configurar listeners para progresso em tempo real
    this.setupRealtimeProgressListeners();

    // Atualizar indicador visual
    this.setAutomationRunning('servidor', `Executando automação sequencial - ${this.selectedServidores.length} servidor(es)`);

    // Calcular total de passos para progress
    const selectedServidoresList = this.selectedServidores.map(index => this.servidores[index]);
    this.totalSteps = selectedServidoresList.reduce((total, servidor) => {
      const listaParaProcessar = servidor.ojsParaProcessar || servidor.ojs || [];
      return total + 3 + listaParaProcessar.length; // login + navegação + verificação + OJs
    }, 0);
    this.currentProgress = 0;

    // Inicializar estrutura de monitoramento em tempo real
    this.currentAutomationStats = {
      servidoresProcessados: 0,
      totalServidores: this.selectedServidores.length,
      ojsProcessados: 0,
      totalOjs: 0,
      servidorAtual: null,
      ojAtual: null,
      tempoInicio: Date.now(),
      sucessos: 0,
      erros: 0
    };
    
    // Iniciar timer
    this.startAutomationTimer();
        
    this.showLoading('Iniciando automação sequencial...', 'Preparando sistema e abrindo navegador');
    this.clearStatusLog();
    this.addStatusMessage('info', 'Iniciando automação sequencial de servidores...');
        
    try {
      // Preparar lista de servidores para processar em uma única sessão
      const servidoresParaProcessar = this.selectedServidores.map(index => {
        const servidor = this.servidores[index];

        // Marcar status inicial como "queued"
        this.updateServidorItemStatus(index, 'queued');

        return {
          nome: servidor.nome,
          cpf: servidor.cpf,
          perfil: servidor.perfil,
          orgaos: servidor.ojs || servidor.orgaos || servidor.ojsParaProcessar || servidor.localizacoes || [],
          _originalIndex: index // Guardar índice original para tracking
        };
      });
      
      this.addStatusMessage('info', `Processando ${servidoresParaProcessar.length} servidores sequencialmente`, 
        `Servidores: ${servidoresParaProcessar.map(s => s.nome).join(', ')}`);
      
      const config = {
        servidores: servidoresParaProcessar,
        production: true,
        detailedReport: true,
        useCache: true,
        timeout: 30,
        maxLoginAttempts: 3
      };
      
      // Limpar caches globais antes de iniciar
      try { await window.electronAPI.invoke('reset-automation-caches'); } catch (e) {}
      
      // Usar método específico para modo SEQUENCIAL (BatchOJProcessor apenas)
      config.mode = 'sequential'; // Adicionar flag de modo
      const result = await window.electronAPI.startServidorAutomationV2Sequential(config);

      if (!result) {
        // Se não houve resposta, provavelmente a automação foi concluída mas não retornou dados
        this.addStatusMessage('success', `✅ Automação de ${servidoresParaProcessar.length} servidor(es) concluída!`,
          `Tempo total: ${this.getElapsedTime()}`);
        this.setAutomationCompleted('servidor', `Automação sequencial concluída - ${servidoresParaProcessar.length} servidor(es)`);

        // Marcar todos os servidores como concluídos visualmente
        servidoresParaProcessar.forEach(srv => {
          if (srv._originalIndex !== undefined) {
            this.updateServidorItemStatus(srv._originalIndex, 'completed');
          }
        });

        // Limpar OJs faltantes
        servidoresParaProcessar.forEach(srv => {
          const idx = this.servidores.findIndex(x => x.cpf === srv.cpf);
          if (idx !== -1) {
            this.servidores[idx].ojsParaProcessar = [];
          }
        });

        // Atualizar display - renderizar tabela novamente
        this.renderServidoresTable();
      } else if (!result.success) {
        // Melhor tratamento de erros específicos
        let errorMessage = 'Ocorreu um problema durante a automação';

        if (result && result.error) {
          errorMessage = result.error;
        } else if (result && result.message) {
          errorMessage = result.message;
        }

        // Adicionar contexto específico baseado no tipo de erro
        if (errorMessage.includes('Automação já está em execução')) {
          errorMessage = '⚠️ Já existe uma automação em andamento. Aguarde finalizar ou use o botão de parar';
        } else if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
          errorMessage = '⏱️ O sistema demorou muito para responder. Verifique sua conexão com o PJE';
        } else if (errorMessage.includes('login') || errorMessage.includes('Login')) {
          errorMessage = '🔐 Não foi possível fazer login. Verifique suas credenciais nas configurações';
        } else if (errorMessage.includes('navegador') || errorMessage.includes('browser')) {
          errorMessage = '🌐 Problema ao inicializar o navegador. Tente novamente em alguns segundos';
        } else if (errorMessage.includes('CPF') || errorMessage.includes('não encontrado')) {
          errorMessage = '👤 Servidor não encontrado no PJE. Verifique se o CPF está correto';
        }

        this.addStatusMessage('error', errorMessage);
      } else if (result.nothingToDo) {
        // Caso especial: todos os OJs já foram cadastrados
        this.addStatusMessage('success', '🎉 Todos os órgãos julgadores já foram cadastrados!',
          'Não há necessidade de executar a automação');

        // Mostrar detalhes do que foi economizado
        if (result.relatorio) {
          this.addStatusMessage('info',
            `📊 Economia de tempo: ${Math.round(result.relatorio.tempoEconomizado / 60)} minutos`,
            `${result.relatorio.ojsJaCadastrados} OJs já cadastrados`);
        }

        // Limpar OJs faltantes pois todos já estão cadastrados
        servidoresParaProcessar.forEach(srv => {
          const idx = this.servidores.findIndex(x => x.cpf === srv.cpf);
          if (idx !== -1) {
            this.servidores[idx].ojsParaProcessar = [];
          }
        });

        // Atualizar display para refletir que tudo está completo
        this.updateServidorDisplay();

        return; // Não prosseguir com lógica de automação normal
      } else {
        // Automação concluída com sucesso
        this.addStatusMessage('success', '✅ Automação concluída com sucesso!',
          `${servidoresParaProcessar.length} servidor(es) processado(s) em ${this.getElapsedTime()}`);
        this.setAutomationCompleted('servidor', 'Automação sequencial concluída');

        // Processar relatório se disponível
        if (result.relatorio) {
          // Extrair estatísticas do relatório
          let totalSucessos = 0;
          let totalErros = 0;
          let totalProcessados = 0;

          if (result.relatorio.servidores && Array.isArray(result.relatorio.servidores)) {
            // Relatório por servidor
            totalSucessos = result.relatorio.servidores.reduce((sum, s) => sum + (s.sucessos || 0), 0);
            totalErros = result.relatorio.servidores.reduce((sum, s) => sum + (s.erros || 0), 0);
            totalProcessados = result.relatorio.servidores.length;

            this.addStatusMessage('info', `📊 Resumo Final: ${totalSucessos} OJs vinculados com sucesso, ${totalErros} erros`,
              `${totalProcessados} servidor(es) processado(s)`);

            // Mostrar detalhes por servidor
            result.relatorio.servidores.forEach(relatorioServidor => {
              const status = (relatorioServidor.erros || 0) > 0 ? 'warning' : 'success';
              const emoji = status === 'success' ? '✅' : '⚠️';
              this.addStatusMessage(status, `${emoji} ${relatorioServidor.nome}`,
                `${relatorioServidor.sucessos || 0} vinculações, ${relatorioServidor.erros || 0} erros`);
            });
          } else if (result.relatorio.resultados && Array.isArray(result.relatorio.resultados)) {
            // Relatório único
            totalSucessos = result.relatorio.resultados.filter(r => r.status === 'Incluído com Sucesso').length;
            totalErros = result.relatorio.resultados.filter(r => r.status === 'Erro').length;
            totalProcessados = result.relatorio.resultados.length;

            this.addStatusMessage('info', `📊 Resumo: ${totalSucessos} OJs vinculados, ${totalErros} erros`,
              `Total de ${totalProcessados} operações realizadas`);
          }

          // Mostrar tempo de processamento se disponível
          if (result.relatorio.tempoTotal) {
            const minutos = Math.floor(result.relatorio.tempoTotal / 60);
            const segundos = result.relatorio.tempoTotal % 60;
            this.addStatusMessage('info', `⏱️ Tempo total: ${minutos}min ${segundos}s`);
          }
        }

        // Limpar OJs faltantes e marcar como cadastrados
        servidoresParaProcessar.forEach(srv => {
          const idx = this.servidores.findIndex(x => x.cpf === srv.cpf);
          if (idx !== -1) {
            this.servidores[idx].ojsParaProcessar = [];
          }
        });

        // Atualizar display - renderizar tabela novamente
        this.renderServidoresTable();
      }
    } catch (error) {
      this.addStatusMessage('error', 'Erro ao executar automação de servidores: ' + error.message);
      this.setAutomationError('servidor', 'Erro na automação sequencial: ' + error.message);
    } finally {
      this.stopAutomationTimer();
      this.hideLoading();
      startButton.classList.remove('loading-pulse');
      this.isAutomationRunning = false;
      startButton.disabled = false;
      stopButton.disabled = true;

      // Remover listeners de progresso
      this.removeRealtimeProgressListeners();
      
      // Se não houve erro, definir como idle após um tempo
      setTimeout(() => {
        if (!document.querySelector('.status-error')) {
          this.setAutomationIdle('servidor');
        }
      }, 3000);
    }
  }

  async startParallelAutomation() {
    const parallelInstancesSelect = document.getElementById('max-instances');
    let numInstances = parseInt(parallelInstancesSelect.value) || 2;
    // Garantir máximo de 4 instâncias
    numInstances = Math.min(numInstances, 4);
    
    this.isAutomationRunning = true;
    const startButton = document.getElementById('start-servidor-automation');
    
    // Reset detailed status for new automation
    this.resetDetailedStatus();
    
    startButton.disabled = true;
    startButton.classList.add('loading');
    
    // Atualizar indicador visual
    this.setAutomationRunning('servidor', `Executando automação paralela - ${this.selectedServidores.length} servidor(es) em ${numInstances} instâncias`);
    
    // Calcular total de passos para progress
    const selectedServidoresList = this.selectedServidores.map(index => this.servidores[index]);
    this.totalSteps = selectedServidoresList.reduce((total, servidor) => {
      const listaParaProcessar = servidor.ojsParaProcessar || servidor.ojs || [];
      return total + 3 + listaParaProcessar.length;
    }, 0);
    this.currentProgress = 0;
    
    // Iniciar timer
    this.startAutomationTimer();
    
    this.showLoading('Iniciando automação paralela...', `Preparando ${numInstances} instâncias do navegador`);
    this.clearStatusLog();
    this.addStatusMessage('info', `Iniciando automação paralela com ${numInstances} instâncias...`);
    
    try {
      // Preparar lista de servidores para processamento paralelo
      const servidoresParaProcessar = this.selectedServidores.map(index => {
        const servidor = this.servidores[index];
        return {
          nome: servidor.nome,
          cpf: servidor.cpf,
          perfil: servidor.perfil,
          orgaos: servidor.ojs || servidor.orgaos || servidor.ojsParaProcessar || servidor.localizacoes || []
        };
      });
      
      this.addStatusMessage('info', `Processando ${servidoresParaProcessar.length} servidores em ${numInstances} instâncias paralelas`);
      
      const config = {
        servidores: servidoresParaProcessar,
        numInstances,
        production: true,
        detailedReport: true,
        useCache: true,
        timeout: 30,
        maxLoginAttempts: 3
      };
      
      const result = await window.electronAPI.startParallelAutomationV2(config);
      
      if (!result || !result.success) {
        // Melhor tratamento de erros específicos para automação paralela
        let errorMessage = 'Erro desconhecido';
        
        if (result && result.error) {
          errorMessage = result.error;
        } else if (result && result.message) {
          errorMessage = result.message;
        } else if (!result) {
          errorMessage = 'Falha na comunicação com o sistema de automação paralela';
        }
        
        // Adicionar contexto específico para automação paralela
        if (errorMessage.includes('instância') || errorMessage.includes('instance')) {
          errorMessage += ' - Reduza o número de instâncias paralelas';
        } else if (errorMessage.includes('memória') || errorMessage.includes('memory')) {
          errorMessage += ' - Sistema com pouca memória disponível';
        } else if (errorMessage.includes('recurso') || errorMessage.includes('resource')) {
          errorMessage += ' - Recursos do sistema insuficientes';
        }
        
        this.addStatusMessage('error', `Erro na automação paralela: ${errorMessage}`);
      } else {
        this.addStatusMessage('success', `Automação paralela de ${servidoresParaProcessar.length} servidores concluída com sucesso`);
        this.setAutomationCompleted('servidor', `Automação paralela concluída - ${servidoresParaProcessar.length} servidor(es)`);
        
        // Mostrar estatísticas de performance
        if (result.performance) {
          const efficiency = result.performance.efficiency || 0;
          const timeReduction = result.performance.timeReduction || 0;
          this.addStatusMessage('info', `Eficiência: ${efficiency.toFixed(1)}% | Redução de tempo: ${timeReduction.toFixed(1)}%`);
        }
        
        // Mostrar resultados individuais se disponíveis
        if (result.relatorio && result.relatorio.servidores) {
          result.relatorio.servidores.forEach(relatorioServidor => {
            this.addStatusMessage('info', `${relatorioServidor.nome}: ${relatorioServidor.sucessos || 0} sucessos, ${relatorioServidor.erros || 0} erros`);
          });
        }
      }
    } catch (error) {
      this.addStatusMessage('error', 'Erro ao executar automação paralela: ' + error.message);
      this.setAutomationError('servidor', 'Erro na automação paralela: ' + error.message);
    } finally {
      this.stopAutomationTimer();
      this.hideLoading();
      startButton.classList.remove('loading');
      this.isAutomationRunning = false;
      startButton.disabled = false;
      stopButton.disabled = false;
      
      // Se não houve erro, definir como idle após um tempo
      setTimeout(() => {
        if (!document.querySelector('.status-error')) {
          this.setAutomationIdle('servidor');
        }
      }, 3000);
    }
  }

  async stopServidorAutomation() {
    this.addStatusMessage('warning', 'Parando automação de servidores...');
    try {
      const result = await window.electronAPI.invoke('stop-servidor-automation-v2');
      if (!result.success) {
        this.addStatusMessage('error', 'Falha ao parar automação: ' + (result && result.error ? result.error : 'Erro desconhecido'));
      }
    } catch (error) {
      this.addStatusMessage('error', 'Erro ao parar automação: ' + error.message);
    } finally {
      this.isAutomationRunning = false;
      const startButton = document.getElementById('start-servidor-automation');
      const stopButton = document.getElementById('stop-servidor-automation');
      const resumeButton = document.getElementById('resume-servidor-automation');

      if (startButton) startButton.disabled = false;
      if (stopButton) stopButton.disabled = true;
      if (resumeButton) {
        resumeButton.style.display = 'inline-block';
        resumeButton.onclick = () => this.startSequentialAutomation();
      }

      // Reset detailed status when automation stops
      this.resetDetailedStatus();

      // Remover listeners de progresso
      this.removeRealtimeProgressListeners();

      // Gerar relatório final se houver estatísticas
      if (this.currentAutomationStats) {
        this.generateFinalReport();
      }

      // Parar timer
      this.stopAutomationTimer();
    }
  }

  // ===== MÉTODOS DE PAUSAR/REINICIAR =====

  // Métodos de pausar/reiniciar para peritos
  togglePauseAutomation() {
    if (this.isPaused) {
      this.resumeAutomation();
    } else {
      this.pauseAutomation();
    }
  }

  pauseAutomation() {
    if (!this.isAutomationRunning) {
      this.showNotification('Nenhuma automação em execução', 'warning');
      return;
    }

    this.isPaused = true;
    this.pausedState = {
      selectedPeritos: [...this.selectedPeritos],
      currentProgress: this.currentProgress,
      totalSteps: this.totalSteps,
      startTime: this.automationStartTime
    };

    // Parar a automação atual
    this.stopAutomation();
    
    // Atualizar interface
    this.updatePauseButton('pause-resume-automation', true);
    this.addStatusMessage('info', 'Automação pausada. Clique em "Reiniciar" para continuar de onde parou.');
  }

  resumeAutomation() {
    if (!this.pausedState) {
      this.showNotification('Nenhuma automação pausada para reiniciar', 'warning');
      return;
    }

    // Restaurar estado pausado
    this.selectedPeritos = [...this.pausedState.selectedPeritos];
    this.currentProgress = this.pausedState.currentProgress;
    this.totalSteps = this.pausedState.totalSteps;
    this.automationStartTime = this.pausedState.startTime;

    // Reiniciar automação
    this.isPaused = false;
    this.pausedState = null;
    this.startAutomation();
    
    // Atualizar interface
    this.updatePauseButton('pause-resume-automation', false);
    this.addStatusMessage('success', 'Automação reiniciada de onde parou.');
  }

  // Métodos de pausar/reiniciar para servidores
  togglePauseServidorAutomation() {
    if (this.isServidorPaused) {
      this.resumeServidorAutomation();
    } else {
      this.pauseServidorAutomation();
    }
  }

  pauseServidorAutomation() {
    if (!this.isAutomationRunning) {
      this.showNotification('Nenhuma automação em execução', 'warning');
      return;
    }

    this.isServidorPaused = true;
    this.pausedServidorState = {
      selectedServidores: [...this.selectedServidores],
      currentProgress: this.currentProgress,
      totalSteps: this.totalSteps,
      startTime: this.automationStartTime
    };

    // Parar a automação atual
    this.stopServidorAutomation();
    
    // Atualizar interface
    this.updatePauseButton('pause-resume-servidor-automation', true);
    this.addStatusMessage('info', 'Automação de servidores pausada. Clique em "Reiniciar" para continuar de onde parou.');
  }

  resumeServidorAutomation() {
    if (!this.pausedServidorState) {
      this.showNotification('Nenhuma automação pausada para reiniciar', 'warning');
      return;
    }

    // Restaurar estado pausado
    this.selectedServidores = [...this.pausedServidorState.selectedServidores];
    this.currentProgress = this.pausedServidorState.currentProgress;
    this.totalSteps = this.pausedServidorState.totalSteps;
    this.automationStartTime = this.pausedServidorState.startTime;

    // Reiniciar automação
    this.isServidorPaused = false;
    this.pausedServidorState = null;
    this.startServidorAutomation();
    
    // Atualizar interface
    this.updatePauseButton('pause-resume-servidor-automation', false);
    this.addStatusMessage('success', 'Automação de servidores reiniciada de onde parou.');
  }

  // Método auxiliar para atualizar botões de pausa
  updatePauseButton(buttonId, isPaused) {
    const button = document.getElementById(buttonId);
    if (button) {
      if (isPaused) {
        button.innerHTML = '<i class="fas fa-play"></i> Reiniciar';
        button.classList.add('paused');
      } else {
        button.innerHTML = '<i class="fas fa-pause"></i> Pausar';
        button.classList.remove('paused');
      }
    }
  }

  // ===== UTILITY METHODS =====

  addStatusMessage(type, message, details = null) {
    const statusLog = document.getElementById('status-log');
    const timestamp = new Date().toLocaleTimeString();
    
    const statusItem = document.createElement('div');
    statusItem.className = `status-item ${type}`;
    
    // Criar conteúdo principal
    const mainContent = document.createElement('div');
    mainContent.style.fontWeight = '600';
    mainContent.textContent = `[${timestamp}] ${message}`;
    statusItem.appendChild(mainContent);
    
    // Adicionar detalhes se fornecidos
    if (details) {
      const detailsContent = document.createElement('div');
      detailsContent.style.fontSize = '0.9em';
      detailsContent.style.marginTop = '4px';
      detailsContent.style.opacity = '0.8';
      detailsContent.textContent = details;
      statusItem.appendChild(detailsContent);
    }
    
    statusLog.appendChild(statusItem);
    statusLog.scrollTop = statusLog.scrollHeight;
    
    // Manter apenas os últimos 50 itens para performance
    const items = statusLog.children;
    if (items.length > 50) {
      statusLog.removeChild(items[0]);
    }
  }

  clearStatusLog() {
    document.getElementById('status-log').innerHTML = '';
  }

  // Detailed visual status management (removido - elementos não existem mais)
  updateDetailedStatus(data) {
    // Elementos de status detalhado foram removidos da interface
    return;
  }

  startDetailedTimer() {
    // Função removida - elementos não existem mais
    return;
  }

  stopDetailedTimer() {
    // Função removida - elementos não existem mais  
    return;
  }

  resetDetailedStatus() {
    // Função removida - elementos não existem mais
    return;
  }

  async loadConfig() {
    try {
      const config = await window.electronAPI.loadConfig();
            
      document.getElementById('pje-url').value = config.PJE_URL || '';
      document.getElementById('login').value = config.LOGIN || '';
      document.getElementById('password').value = config.PASSWORD || '';
      
      // Carregar configurações do banco
      await this.loadDatabaseConfig();
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  }

  async loadOJs() {
    try {
      console.log('Carregando lista de OJs...');
      
      // Inicializar window.ojList se não existir
      if (!window.ojList) {
        window.ojList = [];
      }
      
      // Inicializar window.ojSelectors se não existir
      if (!window.ojSelectors) {
        window.ojSelectors = {};
      }
      
      // Carregar OJs do arquivo JSON
      const response = await fetch('./orgaos_pje.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const ojData = await response.json();
      console.log('Dados de OJs carregados:', Object.keys(ojData).length, 'cidades');
      
      // Converter objeto em array plano de OJs
      const allOJs = [];
      for (const cidade in ojData) {
        if (ojData.hasOwnProperty(cidade)) {
          const ojs = ojData[cidade];
          if (Array.isArray(ojs)) {
            allOJs.push(...ojs);
          }
        }
      }
      
      // Ordenar alfabeticamente
      window.ojList = allOJs.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
      console.log('✅ Lista de OJs carregada com sucesso:', window.ojList.length, 'órgãos');
      console.log('Primeiros 5 OJs:', window.ojList.slice(0, 5));
      
      // Inicializar seletores de OJs
      this.initializeOJSelectors();
      
    } catch (error) {
      console.error('❌ Erro ao carregar OJs:', error);
      
      // Lista de fallback
      window.ojList = [
        'Vara do Trabalho de São Paulo',
        'Vara do Trabalho de Campinas',
        'Vara do Trabalho de Santos',
        'Vara do Trabalho de São Bernardo do Campo',
        'Vara do Trabalho de Ribeirão Preto'
      ];
      console.log('⚠️ Usando lista de fallback com', window.ojList.length, 'órgãos');
      
      // Inicializar seletores mesmo com fallback
      this.initializeOJSelectors();
    }
  }

  async loadNormalizedOJs() {
    try {
      console.log('Carregando dados de normalização de OJs...');
      
      // Carregar dados do arquivo ojs1g.json
      const response = await fetch('./ojs1g.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      this.ojsData = await response.json();
      console.log('Dados de OJs1G carregados:', this.ojsData.length, 'órgãos');
      
      // Criar índices para busca rápida
      this.createOJSearchIndex();
      
      console.log('✅ Sistema de normalização de OJs carregado com sucesso');
      
    } catch (error) {
      console.error('❌ Erro ao carregar dados de normalização de OJs:', error);
      this.ojsData = [];
    }
  }

  createOJSearchIndex() {
    // Limpar índices existentes
    this.ojsSearchIndex.clear();
    this.normalizedOJs.clear();
    
    // Criar índice para cada OJ no arquivo ojs1g.json
    this.ojsData.forEach(item => {
      const ojName = item.ds_orgao_julgador;
      
      // Criar variações do nome para busca
      const variations = this.generateOJVariations(ojName);
      
      // Adicionar todas as variações ao índice
      variations.forEach(variation => {
        this.ojsSearchIndex.set(variation.toLowerCase(), ojName);
      });
      
      // Mapear o nome original para ele mesmo (normalizado)
      this.normalizedOJs.set(ojName.toLowerCase(), ojName);
    });
    
    console.log('Índices de busca criados:', this.ojsSearchIndex.size, 'variações mapeadas');
  }

  generateOJVariations(ojName) {
    const variations = [ojName]; // Sempre incluir o nome original
    
    // Remover acentos e caracteres especiais
    const normalized = ojName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (normalized !== ojName) {
      variations.push(normalized);
    }
    
    // Criar variação sem prefixos comuns
    const withoutCommonPrefixes = ojName
      .replace(/^Vara do Trabalho de\s*/i, '')
      .replace(/^VT de\s*/i, '')
      .replace(/^Vara de\s*/i, '')
      .replace(/^CEJUSC\s*/i, '')
      .trim();
    
    if (withoutCommonPrefixes && withoutCommonPrefixes !== ojName) {
      variations.push(withoutCommonPrefixes);
    }
    
    // Criar variações específicas para CEJUSC
    if ((typeof ojName === 'string' && ojName.includes('CEJUSC')) || (typeof ojName === 'string' && ojName.includes('Centro Judiciário'))) {
      // Extrair a cidade do nome do CEJUSC
      const cityMatch = ojName.match(/CEJUSC\s+([A-Z\s]+)/i);
      if (cityMatch) {
        const city = cityMatch[1].trim();
        variations.push(`CEJUSC - ${city}`);
        variations.push(`CEJUSC ${city}`);
        variations.push(`CEJUS - ${city}`);
        variations.push(`CEJUS ${city}`);
      }
    }
    
    // Criar variações com abreviações comuns
    // IMPORTANTE: Não converter códigos específicos (CON1, CON2, EXE1, EXE2, EXE3, EXE4, LIQ1, LIQ2) para CCP
    const abbreviated = ojName
      .replace(/Vara do Trabalho/gi, 'VT')
      .replace(/Órgão Centralizador/gi, 'OC')
      // Só converter "Centro de Conciliação" para "CCP" se não for um código específico
      .replace(/^(?!.*(?:CON\d+|EXE\d+|LIQ\d+)).*Centro de Conciliação/gi, (match) => {
        return match.replace(/Centro de Conciliação/gi, 'CCP');
      })
      .replace(/Centro Judiciário/gi, 'CEJUSC')
      .trim();
    
    if (abbreviated !== ojName) {
      variations.push(abbreviated);
    }
    
    return [...new Set(variations)]; // Remover duplicatas
  }

  normalizeOJName(inputName) {
    if (!inputName || inputName.trim() === '') {
      return null;
    }
    
    const cleanInput = inputName.trim();
    
    // Buscar primeiro por correspondência exata (case-insensitive)
    const exactMatch = this.normalizedOJs.get(cleanInput.toLowerCase());
    if (exactMatch) {
      return exactMatch;
    }
    
    // Buscar por variações no índice
    const indexMatch = this.ojsSearchIndex.get(cleanInput.toLowerCase());
    if (indexMatch) {
      return indexMatch;
    }
    
    // Buscar por correspondência parcial
    const partialMatch = this.findPartialMatch(cleanInput);
    if (partialMatch) {
      return partialMatch;
    }
    
    // Se não encontrou correspondência, retornar o nome original
    console.warn('⚠️ OJ não encontrado para normalização:', cleanInput);
    return cleanInput;
  }

  findPartialMatch(inputName) {
    const cleanInput = inputName.toLowerCase();
    
    // Buscar por correspondência parcial no início do nome
    for (const [key, value] of this.normalizedOJs) {
      if ((typeof key === 'string' && key.includes(cleanInput)) || (typeof cleanInput === 'string' && cleanInput.includes(key))) {
        return value;
      }
    }
    
    // Buscar por palavras-chave importantes
    const keywords = cleanInput.split(/\s+/).filter(word => word.length > 2);
    if (keywords.length > 0) {
      for (const [key, value] of this.normalizedOJs) {
        const keyWords = key.split(/\s+/);
        let matches = 0;
        
        keywords.forEach(keyword => {
          if (keyWords.some(keyWord => (typeof keyWord === 'string' && keyWord.includes(keyword)) || (typeof keyword === 'string' && keyword.includes(keyWord)))) {
            matches++;
          }
        });
        
        // Se pelo menos 70% das palavras correspondem
        if (matches / keywords.length >= 0.7) {
          return value;
        }
      }
    }
    
    return null;
  }

  initializeOJSelectors() {
    try {
      // Inicializar seletor principal de OJs
      if (document.getElementById('oj-selector-main') && document.getElementById('oj-search')) {
        window.ojSelectors.main = new OJSelector('oj-selector-main', 'oj-search', {
          placeholder: 'Selecione um órgão julgador...',
          searchPlaceholder: 'Digite para buscar órgãos julgadores...'
        });
        
        // Event listener para quando um OJ for selecionado
        document.getElementById('oj-selector-main').addEventListener('oj-selected', (e) => {
          console.log('OJ selecionado:', e.detail.text);
          this.saveOjToHistory(e.detail.text);
        });
      }
      
      console.log('Seletores de OJs inicializados com sucesso');
    } catch (error) {
      console.error('Erro ao inicializar seletores de OJs:', error);
    }
  }

  async saveConfig() {
    try {
      const config = {
        PJE_URL: document.getElementById('pje-url').value,
        LOGIN: document.getElementById('login').value,
        PASSWORD: document.getElementById('password').value
      };

      const result = await window.electronAPI.saveConfig(config);
      if (result.success) {
        this.showNotification('Configurações salvas com sucesso!', 'success');
      } else {
        this.showNotification('Erro ao salvar configurações: ' + (result && result.error ? result.error : 'Erro desconhecido'), 'error');
      }
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      this.showNotification('Erro ao salvar configurações', 'error');
    }
  }

  async loadDatabaseConfig() {
    try {
      console.log('Carregando configurações do banco de dados...');
      const result = await window.electronAPI.loadDatabaseCredentials();
      console.log('Resultado do carregamento:', result);
      
      if (result.success && result.credentials) {
        const creds = result.credentials;
        console.log('Credenciais carregadas:', creds);
        
        // Verificar se os elementos existem antes de atribuir valores
        const dbHost = document.getElementById('dbHost');
        const dbPort = document.getElementById('dbPort');
        const dbUser = document.getElementById('dbUser');
        const dbPassword = document.getElementById('dbPassword');
        const dbDatabase1Grau = document.getElementById('dbDatabase1Grau');
        const dbDatabase2Grau = document.getElementById('dbDatabase2Grau');
        const dbHost1Grau = document.getElementById('dbHost1Grau');
        const dbHost2Grau = document.getElementById('dbHost2Grau');
        
        if (dbHost) dbHost.value = creds.host || 'pje-db-bugfix-a1';
        if (dbPort) dbPort.value = creds.port || 5432;
        if (dbUser) dbUser.value = creds.user || '';
        if (dbPassword) dbPassword.value = creds.password || '';
        if (dbDatabase1Grau) dbDatabase1Grau.value = creds.database1Grau || 'pje_1grau_bugfix';
        if (dbDatabase2Grau) dbDatabase2Grau.value = creds.database2Grau || 'pje_2grau_bugfix';
        if (dbHost1Grau) dbHost1Grau.value = creds.host1Grau || '172.21.1.21';
        if (dbHost2Grau) dbHost2Grau.value = creds.host2Grau || '172.21.1.22';
        
        console.log('Configurações do banco carregadas com sucesso');
      } else {
        console.log('Nenhuma configuração de banco encontrada');
      }
    } catch (error) {
      console.error('Erro ao carregar configurações do banco:', error);
    }
  }

  async saveDatabaseConfig() {
    try {
      // Coletar valores dos campos
      const host = document.getElementById('dbHost')?.value || 'localhost';
      const port = document.getElementById('dbPort')?.value || '5432';
      const user = document.getElementById('dbUser')?.value || '';
      const password = document.getElementById('dbPassword')?.value || '';
      const database1Grau = document.getElementById('dbDatabase1Grau')?.value || 'pje_1grau_bugfix';
      const database2Grau = document.getElementById('dbDatabase2Grau')?.value || 'pje_2grau_bugfix';
      const host1Grau = document.getElementById('dbHost1Grau')?.value || '172.21.1.21';
      const host2Grau = document.getElementById('dbHost2Grau')?.value || '172.21.1.22';

      const credentials = {
        host: host.trim(),
        port: parseInt(port),
        user: user.trim(),
        password,
        database1Grau: database1Grau.trim(),
        database2Grau: database2Grau.trim(),
        host1Grau: host1Grau.trim(),
        host2Grau: host2Grau.trim()
      };

      console.log('Salvando credenciais:', credentials);

      // Validar campos obrigatórios
      if (!credentials.user || !credentials.password) {
        this.showDatabaseStatus('Usuário e senha são obrigatórios', 'error');
        this.showNotification('Usuário e senha são obrigatórios', 'error');
        return;
      }

      const result = await window.electronAPI.saveDatabaseCredentials(credentials);
      console.log('Resultado do salvamento:', result);
      
      if (result.success) {
        this.showDatabaseStatus('✅ Credenciais salvas com sucesso!', 'success');
        this.showNotification('Configurações do banco salvas com sucesso!', 'success');
        
        // Aguardar um momento antes de recarregar
        setTimeout(async () => {
          await this.loadDatabaseConfig();
        }, 500);
        
        // Não mudar de aba
        return false;
      } else {
        this.showDatabaseStatus('❌ Erro: ' + result.error, 'error');
        this.showNotification('Erro ao salvar: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Erro ao salvar configurações do banco:', error);
      this.showDatabaseStatus('❌ Erro ao salvar configurações', 'error');
      this.showNotification('Erro ao salvar configurações', 'error');
    }
  }

  async testDatabaseConnection() {
    try {
      console.log('🔍 Iniciando teste de conexão com banco de dados...');
      
      const credentials = {
        host: document.getElementById('dbHost')?.value || 'localhost',
        port: parseInt(document.getElementById('dbPort')?.value) || 5432,
        user: document.getElementById('dbUser')?.value || 'postgres',
        password: document.getElementById('dbPassword')?.value,
        database1Grau: document.getElementById('dbDatabase1Grau')?.value || 'pje_1grau_bugfix',
        database2Grau: document.getElementById('dbDatabase2Grau')?.value || 'pje_2grau_bugfix',
        host1Grau: document.getElementById('dbHost1Grau')?.value || '172.21.1.21',
        host2Grau: document.getElementById('dbHost2Grau')?.value || '172.21.1.22'
      };

      console.log('Credenciais para teste:', credentials);

      // Validar campos obrigatórios
      if (!credentials.user || !credentials.password) {
        this.showDatabaseStatus('❌ Usuário e senha são obrigatórios', 'error');
        return;
      }

      // Validar formato do host
      if (!credentials.host.trim()) {
        this.showDatabaseStatus('❌ Host é obrigatório', 'error');
        return;
      }

      // Validar porta
      if (isNaN(credentials.port) || credentials.port < 1 || credentials.port > 65535) {
        this.showDatabaseStatus('❌ Porta deve ser um número entre 1 e 65535', 'error');
        return;
      }

      // Mostrar feedback de carregamento
      this.showDatabaseStatus('🔍 Testando conexão com o banco de dados...', 'info');
      
      // Desabilitar botão durante o teste
      const testButton = document.getElementById('testDbConnection');
      const originalText = testButton.innerHTML;
      testButton.disabled = true;
      testButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Testando...</span>';
      
      const result = await window.electronAPI.testDatabaseCredentials(credentials);
      
      // Reabilitar botão
      testButton.disabled = false;
      testButton.innerHTML = originalText;
      
      if (result.success) {
        let successMessage = '✅ ' + result.message;
        if (result.details) {
          successMessage += '\n\n📋 Detalhes da conexão:\n';
          successMessage += `• Host: ${result.details.host}:${result.details.port}\n`;
          successMessage += `• Usuário: ${result.details.user}\n`;
          successMessage += `• Base 1º Grau: ${result.details.database1Grau}\n`;
          successMessage += `• Base 2º Grau: ${result.details.database2Grau}`;
        }
        this.showDatabaseStatus(successMessage, 'success');
        
        // Atualizar indicador de status na interface
        this.updateConnectionIndicator(true);
        
        // Mostrar notificação de sucesso
        this.showNotification('Conexão com banco de dados estabelecida com sucesso!', 'success');
      } else {
        let errorMessage = '❌ Falha na conexão: ' + result.error;
        if (result.details) {
          errorMessage += `\n\n🔧 Código do erro: ${result.details}`;
        }
        errorMessage += '\n\n💡 Verifique:\n• Se o servidor está acessível\n• Se as credenciais estão corretas\n• Se as bases de dados existem';
        
        this.showDatabaseStatus(errorMessage, 'error');
        this.updateConnectionIndicator(false);
        this.showNotification('Erro ao conectar com banco de dados', 'error');
      }
    } catch (error) {
      console.error('Erro ao testar conexão:', error);
      
      // Reabilitar botão em caso de erro
      const testButton = document.getElementById('testDbConnection');
      testButton.disabled = false;
      testButton.innerHTML = '<i class="fas fa-plug"></i> <span>Testar Conexão</span>';
      
      this.showDatabaseStatus('❌ Erro inesperado ao testar conexão: ' + error.message, 'error');
      this.updateConnectionIndicator(false);
      this.showNotification('Erro inesperado ao testar conexão', 'error');
    }
  }

  showDatabaseStatus(message, type) {
    const statusDiv = document.getElementById('dbStatus');
    const statusText = document.getElementById('dbStatusText');
    const statusIcon = statusDiv.querySelector('i');
    
    statusText.textContent = message;
    statusDiv.className = `database-status ${type}`;
    statusDiv.classList.remove('hidden');
    
    // Atualizar ícone baseado no tipo
    if (type === 'success') {
      statusIcon.className = 'fas fa-check-circle';
    } else if (type === 'error') {
      statusIcon.className = 'fas fa-exclamation-circle';
    } else if (type === 'info') {
      statusIcon.className = 'fas fa-info-circle';
    }
    
    // Auto-hide após 5 segundos para mensagens de sucesso
    if (type === 'success') {
      setTimeout(() => {
        statusDiv.classList.add('hidden');
      }, 5000);
    }
  }

  showLoading(title, subtitle = '') {
    // Modal de loading removido - função desabilitada
    console.log(`Loading: ${title} - ${subtitle}`);
  }

  hideLoading() {
    // Modal de loading removido - função desabilitada
    console.log('Loading hidden');
  }

  updateLoadingProgress(data) {
    // Aguardar DOM estar pronto
    if (document.readyState !== 'complete') {
      setTimeout(() => this.updateLoadingProgress(data), 100);
      return;
    }
    
    if (data && data.progress !== undefined && data.progress !== null) {
      this.currentProgress = Math.max(0, parseInt(data.progress) || 0);
    }
    
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const currentCpf = document.getElementById('current-cpf');
    const currentPerfil = document.getElementById('current-perfil');
    const ojProgress = document.getElementById('oj-progress');
    
    // Atualizar CPF do servidor atual
    if (data && data.cpf && currentCpf) {
      const formattedCpf = this.formatCpf(data.cpf);
      currentCpf.textContent = formattedCpf;
    }
    
    // Atualizar perfil do servidor atual
    if (data && data.perfil && currentPerfil) {
      currentPerfil.textContent = data.perfil;
    }
    
    // Atualizar contador de OJs
    if (data && data.ojProcessed !== undefined && ojProgress) {
      this.currentOjCount = parseInt(data.ojProcessed) || 0;
      if (data.totalOjs !== undefined) {
        this.totalOjCount = parseInt(data.totalOjs) || 0;
      }
      ojProgress.textContent = `OJs processadas: ${this.currentOjCount}/${this.totalOjCount}`;
      
      // Modal de finalização removido conforme solicitação do usuário
      // Mantendo apenas o sistema de notificações na parte inferior
      
      // Se não há OJs para processar, apenas log silencioso
      if (this.totalOjCount === 0 && data.orgaoJulgador === 'Finalizado') {
        console.log('🔄 [AUTOMATION] Servidor finalizado - nenhum OJ para processar, partindo para o próximo');
      }
    }
    
    if (progressBar && progressText) {
      // Garantir que currentProgress e totalSteps sejam números válidos
      const current = Math.max(0, this.currentProgress || 0);
      const total = Math.max(1, this.totalSteps || 1);
      
      const percentage = (current / total) * 100;
      progressBar.style.width = `${Math.min(100, percentage)}%`;
      
      // Formatar contador como 01/90 com tempo decorrido
      const currentFormatted = String(current).padStart(2, '0');
      const totalFormatted = String(total).padStart(2, '0');
      const timeElapsed = this.getElapsedTime();
      progressText.textContent = `${currentFormatted}/${totalFormatted} passos concluídos ${timeElapsed ? '• ' + timeElapsed : ''}`;
    }
        
    if (data.subtitle) {
      const loadingSubtitle = document.getElementById('loading-subtitle');
      if (loadingSubtitle) {
        loadingSubtitle.textContent = data.subtitle;
      }
    }
    
    // Atualizar nome do servidor
    if (data.servidor) {
      const loadingServidor = document.getElementById('loading-servidor');
      if (loadingServidor) {
        loadingServidor.textContent = `Servidor: ${data.servidor}`;
        loadingServidor.style.display = 'block';
      }
    }
    
    // Atualizar OJ atual
    if (data.orgaoJulgador) {
      const loadingOj = document.getElementById('loading-oj');
      if (loadingOj) {
        loadingOj.textContent = `OJ: ${data.orgaoJulgador}`;
        loadingOj.style.display = 'block';
      }
    }
  }

  // Métodos de controle de pausa/retomada
  // Métodos de pausar removidos conforme solicitação do usuário

  startAutomationTimer() {
    this.automationStartTime = Date.now();
    // Atualizar o timer a cada segundo
    this.automationTimer = setInterval(() => {
      this.updateLoadingProgress({});
    }, 1000);
  }

  stopAutomationTimer() {
    if (this.automationTimer) {
      clearInterval(this.automationTimer);
      this.automationTimer = null;
    }
    this.automationStartTime = null;
  }

  getElapsedTime() {
    if (!this.automationStartTime) return '';
    
    const elapsed = Date.now() - this.automationStartTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  showNotification(message, type = 'info') {
    // Otimizada para resposta rápida
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
        
    // Estilos inline otimizados
    const colors = {
      success: '#27ae60',
      error: '#c07b73',
      warning: '#d4a574',
      info: '#8b7355'
    };
        
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            border-radius: 4px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            background: ${colors[type] || colors.info};
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            transform: translateX(100%);
            transition: transform 0.2s ease;
        `;
        
    document.body.appendChild(notification);
        
    // Animação de entrada rápida
    requestAnimationFrame(() => {
      notification.style.transform = 'translateX(0)';
    });
        
    // Remoção otimizada
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 200);
    }, 2000);
  }

  updateConnectionIndicator(isConnected) {
    // Atualizar indicador visual de conexão com banco
    const indicator = document.getElementById('dbConnectionIndicator');
    if (indicator) {
      indicator.className = isConnected ? 'connection-indicator connected' : 'connection-indicator disconnected';
      indicator.title = isConnected ? 'Conectado ao banco de dados' : 'Desconectado do banco de dados';
    }
    
    // Atualizar status no botão de teste
    const testButton = document.getElementById('testDbConnection');
    if (testButton && isConnected) {
      testButton.classList.add('connected');
    } else if (testButton) {
      testButton.classList.remove('connected');
    }
    
    // Atualizar texto de status se existir
    const statusText = document.getElementById('dbStatusText');
    if (statusText && isConnected) {
      statusText.textContent = 'Conectado';
    }
  }

  // ===== HISTORY AND AUTOCOMPLETE =====

  loadHistory() {
    try {
      // Carregar histórico do localStorage
      this.cpfHistory = JSON.parse(localStorage.getItem('pje-cpf-history') || '[]');
      this.ojHistory = JSON.parse(localStorage.getItem('pje-oj-history') || '[]');
      this.profileHistory = JSON.parse(localStorage.getItem('pje-profile-history') || '[]');
      
      console.log('📚 Histórico carregado:', {
        cpfs: this.cpfHistory.length,
        ojs: this.ojHistory.length,
        profiles: this.profileHistory.length
      });
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      this.cpfHistory = [];
      this.ojHistory = [];
      this.profileHistory = [];
    }
  }

  saveHistory() {
    try {
      // Salvar histórico no localStorage
      localStorage.setItem('pje-cpf-history', JSON.stringify(this.cpfHistory));
      localStorage.setItem('pje-oj-history', JSON.stringify(this.ojHistory));
      localStorage.setItem('pje-profile-history', JSON.stringify(this.profileHistory));
    } catch (error) {
      console.error('Erro ao salvar histórico:', error);
    }
  }

  addToHistory(type, data) {
    let history, key;
    
    switch (type) {
    case 'cpf':
      history = this.cpfHistory;
      key = 'cpf';
      break;
    case 'oj':
      history = this.ojHistory;
      key = 'name';
      break;
    case 'profile':
      history = this.profileHistory;
      key = 'profile';
      break;
    default:
      return;
    }
    
    // Verificar se já existe
    const existingIndex = history.findIndex(item => item[key] === data[key]);
    
    if (existingIndex !== -1) {
      // Atualizar data de uso se já existe
      history[existingIndex].lastUsed = new Date().toISOString();
      history[existingIndex].usageCount = (history[existingIndex].usageCount || 1) + 1;
    } else {
      // Adicionar novo item
      history.unshift({
        ...data,
        lastUsed: new Date().toISOString(),
        usageCount: 1
      });
    }
    
    // Manter apenas os 50 mais recentes
    if (history.length > 50) {
      history.splice(50);
    }
    
    // Ordenar por uso mais recente
    history.sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed));
    
    this.saveHistory();
  }

  saveCpfToHistory(cpf, type) {
    if (!cpf || cpf.length < 11) return;
    
    const cpfData = {
      cpf,
      type, // 'perito' ou 'servidor'
      lastUsed: new Date().toISOString()
    };
    
    this.addToHistory('cpf', cpfData);
  }

  saveOjToHistory(ojName) {
    if (!ojName || ojName.trim().length < 3) return;
    
    const ojData = {
      name: ojName.trim(),
      lastUsed: new Date().toISOString()
    };
    
    this.addToHistory('oj', ojData);
  }

  saveProfileToHistory(profileName) {
    if (!profileName || profileName.trim().length < 3) return;
    
    const profileData = {
      profile: profileName.trim(),
      lastUsed: new Date().toISOString()
    };
    
    this.addToHistory('profile', profileData);
  }

  setupAutocomplete() {
    // Configurar autocomplete para CPF do perito
    this.setupCpfAutocomplete('perito-cpf', 'perito-cpf-suggestions');
    
    // Configurar autocomplete para CPF do servidor
    this.setupCpfAutocomplete('servidor-cpf', 'servidor-cpf-suggestions');
    
    // Configurar autocomplete para OJs dos peritos
    this.setupOJAutocomplete('perito-ojs');
    
    // Configurar autocomplete para OJs dos servidores
    this.setupOJAutocomplete('servidor-ojs');
  }

  setupCpfAutocomplete(inputId, suggestionsId) {
    const input = document.getElementById(inputId);
    const suggestions = document.getElementById(suggestionsId);
    
    if (!input || !suggestions) return;
    
    let currentSuggestionIndex = -1;
    
    input.addEventListener('input', (e) => {
      const value = e.target.value.replace(/\D/g, ''); // Remover não dígitos
      
      if (value.length < 3) {
        suggestions.classList.remove('show');
        return;
      }
      
      this.showCpfSuggestions(value, suggestions, input);
    });
    
    input.addEventListener('focus', (e) => {
      if (e.target.value.length >= 3) {
        const value = e.target.value.replace(/\D/g, '');
        this.showCpfSuggestions(value, suggestions, input);
      }
    });
    
    input.addEventListener('blur', (e) => {
      // Delay para permitir clique nas sugestões
      setTimeout(() => {
        suggestions.classList.remove('show');
      }, 150);
    });
    
    input.addEventListener('keydown', (e) => {
      const items = suggestions.querySelectorAll('.autocomplete-item');
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        currentSuggestionIndex = Math.min(currentSuggestionIndex + 1, items.length - 1);
        this.updateSuggestionSelection(items, currentSuggestionIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        currentSuggestionIndex = Math.max(currentSuggestionIndex - 1, -1);
        this.updateSuggestionSelection(items, currentSuggestionIndex);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (currentSuggestionIndex >= 0 && items[currentSuggestionIndex]) {
          items[currentSuggestionIndex].click();
        }
      } else if (e.key === 'Escape') {
        suggestions.classList.remove('show');
        currentSuggestionIndex = -1;
      }
    });
  }

  showCpfSuggestions(searchValue, suggestionsContainer, input) {
    // Filtrar histórico por CPF
    const filtered = this.cpfHistory.filter(item => {
      const cpfNumbers = item.cpf.replace(/\D/g, '');
      return typeof cpfNumbers === 'string' && cpfNumbers.includes(searchValue);
    });
    
    if (filtered.length === 0) {
      suggestionsContainer.innerHTML = '<div class="autocomplete-empty">Nenhum CPF anterior encontrado</div>';
      suggestionsContainer.classList.add('show');
      return;
    }
    
    // Gerar HTML das sugestões
    const html = filtered.map(item => {
      const timeSince = this.getTimeSince(item.lastUsed);
      const isPerito = item.type === 'perito';
      
      return `
        <div class="autocomplete-item" data-cpf="${item.cpf}" data-type="${item.type}">
          <div class="autocomplete-cpf">${item.cpf}</div>
          <div class="autocomplete-details">
            <span class="autocomplete-tag">${isPerito ? 'Perito' : 'Servidor'}</span>
            <span class="autocomplete-date">Usado ${timeSince}</span>
            <span>•</span>
            <span>${item.usageCount}x usado</span>
          </div>
        </div>
      `;
    }).join('');
    
    suggestionsContainer.innerHTML = html;
    suggestionsContainer.classList.add('show');
    
    // Adicionar event listeners aos itens
    suggestionsContainer.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        const cpf = item.dataset.cpf;
        input.value = cpf;
        
        // Atualizar histórico de uso
        this.addToHistory('cpf', {
          cpf,
          type: item.dataset.type
        });
        
        suggestionsContainer.classList.remove('show');
        
        // Trigger input event para formatação
        input.dispatchEvent(new Event('input'));
      });
    });
  }

  getTimeSince(dateString) {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    
    const minutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) return 'agora';
    if (minutes < 60) return `há ${minutes}min`;
    if (hours < 24) return `há ${hours}h`;
    if (days === 1) return 'ontem';
    return `há ${days} dias`;
  }

  setupOJAutocomplete(textareaId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;

    // Criar container de sugestões se não existir
    let suggestionsContainer = document.getElementById(`${textareaId}-suggestions`);
    if (!suggestionsContainer) {
      suggestionsContainer = document.createElement('div');
      suggestionsContainer.id = `${textareaId}-suggestions`;
      suggestionsContainer.className = 'oj-autocomplete-suggestions';
      textarea.parentNode.appendChild(suggestionsContainer);
    }

    let currentSuggestionIndex = -1;

    // Função para obter sugestões baseadas no texto atual
    const getSuggestions = (searchText) => {
      if (!searchText || searchText.trim().length < 2) {
        return [];
      }

      const searchLower = searchText.toLowerCase().trim();
      const suggestions = [];

      // Buscar nos dados normalizados
      for (const item of this.ojsData) {
        const ojName = item.ds_orgao_julgador;
        const ojLower = ojName.toLowerCase();

        // Correspondência exata no início
        if (ojLower.startsWith(searchLower)) {
          suggestions.push({ name: ojName, score: 100 });
        }
        // Correspondência parcial com palavras
        else if (typeof ojLower === 'string' && ojLower.includes(searchLower)) {
          suggestions.push({ name: ojName, score: 80 });
        }
        // Correspondência por palavras individuais
        else {
          const searchWords = searchLower.split(/\s+/);
          const ojWords = ojLower.split(/\s+/);
          let matchScore = 0;
          
          for (const searchWord of searchWords) {
            for (const ojWord of ojWords) {
              if ((typeof ojWord === 'string' && ojWord.includes(searchWord)) || (typeof searchWord === 'string' && searchWord.includes(ojWord))) {
                matchScore += 20;
              }
            }
          }
          
          if (matchScore > 0) {
            suggestions.push({ name: ojName, score: matchScore });
          }
        }
      }

      // Ordenar por relevância e limitar a 10 resultados
      return suggestions
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(item => item.name);
    };

    // Função para mostrar sugestões
    const showSuggestions = (suggestions) => {
      if (!suggestions || suggestions.length === 0) {
        suggestionsContainer.innerHTML = '';
        suggestionsContainer.classList.remove('show');
        return;
      }

      const html = suggestions.map((suggestion, index) => `
        <div class="oj-suggestion-item ${index === currentSuggestionIndex ? 'active' : ''}" 
             data-suggestion="${suggestion}" data-index="${index}">
          ${suggestion}
        </div>
      `).join('');

      suggestionsContainer.innerHTML = html;
      suggestionsContainer.classList.add('show');

      // Adicionar listeners aos itens
      suggestionsContainer.querySelectorAll('.oj-suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
          insertSuggestion(item.dataset.suggestion);
        });

        item.addEventListener('mouseenter', () => {
          currentSuggestionIndex = parseInt(item.dataset.index);
          updateSelectedItem();
        });
      });
    };

    // Função para inserir sugestão no textarea
    const insertSuggestion = (suggestion) => {
      const cursorPos = textarea.selectionStart;
      const textBefore = textarea.value.substring(0, cursorPos);
      const textAfter = textarea.value.substring(cursorPos);
      
      // Encontrar o início da palavra atual
      const lines = textBefore.split('\n');
      const currentLine = lines[lines.length - 1];
      
      // Substituir a linha atual pela sugestão normalizada
      const normalizedSuggestion = this.normalizeOJName(suggestion);
      lines[lines.length - 1] = normalizedSuggestion;
      
      const newTextBefore = lines.join('\n');
      textarea.value = newTextBefore + textAfter;
      
      // Posicionar cursor no final da sugestão
      const newCursorPos = newTextBefore.length;
      textarea.selectionStart = textarea.selectionEnd = newCursorPos;
      
      // Esconder sugestões
      suggestionsContainer.classList.remove('show');
      currentSuggestionIndex = -1;
      
      // Focar no textarea
      textarea.focus();
    };

    // Função para atualizar item selecionado
    const updateSelectedItem = () => {
      suggestionsContainer.querySelectorAll('.oj-suggestion-item').forEach((item, index) => {
        item.classList.toggle('active', index === currentSuggestionIndex);
      });
    };

    // Event listener para input
    textarea.addEventListener('input', (e) => {
      const cursorPos = textarea.selectionStart;
      const textBefore = textarea.value.substring(0, cursorPos);
      
      // Obter a linha atual onde está o cursor
      const lines = textBefore.split('\n');
      const currentLine = lines[lines.length - 1].trim();
      
      if (currentLine.length >= 2) {
        const suggestions = getSuggestions(currentLine);
        showSuggestions(suggestions);
      } else {
        suggestionsContainer.classList.remove('show');
      }
    });

    // Event listener para teclas especiais
    textarea.addEventListener('keydown', (e) => {
      const suggestions = suggestionsContainer.querySelectorAll('.oj-suggestion-item');
      
      if (suggestions.length === 0) return;

      switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        currentSuggestionIndex = Math.min(currentSuggestionIndex + 1, suggestions.length - 1);
        updateSelectedItem();
        break;
          
      case 'ArrowUp':
        e.preventDefault();
        currentSuggestionIndex = Math.max(currentSuggestionIndex - 1, -1);
        updateSelectedItem();
        break;
          
      case 'Enter':
        if (currentSuggestionIndex >= 0 && suggestions[currentSuggestionIndex]) {
          e.preventDefault();
          insertSuggestion(suggestions[currentSuggestionIndex].dataset.suggestion);
        }
        break;
          
      case 'Escape':
        suggestionsContainer.classList.remove('show');
        currentSuggestionIndex = -1;
        break;
      }
    });

    // Event listener para blur
    textarea.addEventListener('blur', () => {
      // Aguardar um pouco para permitir clique nas sugestões
      setTimeout(() => {
        suggestionsContainer.classList.remove('show');
        currentSuggestionIndex = -1;
      }, 200);
    });

    // Event listener para focus
    textarea.addEventListener('focus', () => {
      const cursorPos = textarea.selectionStart;
      const textBefore = textarea.value.substring(0, cursorPos);
      const lines = textBefore.split('\n');
      const currentLine = lines[lines.length - 1].trim();
      
      if (currentLine.length >= 2) {
        const suggestions = getSuggestions(currentLine);
        showSuggestions(suggestions);
      }
    });
  }

  // Função de teste para a normalização de OJs
  // Função para verificar OJs já cadastrados no PJE
  async checkExistingOJs(cpf, ojsList) {
    console.log('🔍 Verificando OJs já cadastrados no PJE...');
    
    if (!cpf || !ojsList || ojsList.length === 0) {
      return { existing: [], missing: ojsList || [], error: 'Dados inválidos' };
    }

    try {
      // Normalizar lista de OJs
      const normalizedOJs = ojsList.map(oj => this.normalizeOJName(oj)).filter(oj => oj);
      
      console.log(`📋 Verificando ${normalizedOJs.length} OJs para CPF: ${cpf}`);
      
      // Esta função seria chamada pelo main process para verificar no PJE
      // Por enquanto, vou simular a verificação
      const result = {
        cpf,
        total: normalizedOJs.length,
        existing: [], // OJs já cadastrados
        missing: [],  // OJs que precisam ser cadastrados
        status: 'checked'
      };

      // Simular alguns já cadastrados (em produção, isso viria do PJE)
      const simulatedExisting = normalizedOJs.slice(0, Math.floor(normalizedOJs.length / 2));
      const simulatedMissing = normalizedOJs.slice(Math.floor(normalizedOJs.length / 2));
      
      result.existing = simulatedExisting;
      result.missing = simulatedMissing;
      
      console.log(`✅ ${result.existing.length} OJs já cadastrados`);
      console.log(`⏳ ${result.missing.length} OJs pendentes`);
      
      if (result.existing.length > 0) {
        console.log('📌 OJs já cadastrados:', result.existing);
      }
      
      if (result.missing.length > 0) {
        console.log('🔄 OJs para cadastrar:', result.missing);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Erro ao verificar OJs:', error);
      return { 
        existing: [], 
        missing: ojsList, 
        error: error.message 
      };
    }
  }

  // Função para processar servidor com verificação prévia
  async processServerWithCheck(servidor) {
    if (!servidor.ojs || servidor.ojs.length === 0) {
      return {
        status: 'no_ojs',
        message: 'Servidor não possui OJs para verificar',
        servidor
      };
    }

    // Verificar OJs existentes
    const checkResult = await this.checkExistingOJs(servidor.cpf, servidor.ojs);
    
    if (checkResult.error) {
      return {
        status: 'error',
        message: checkResult.error,
        servidor
      };
    }

    // Se todos já estão cadastrados
    if (checkResult.missing.length === 0) {
      return {
        status: 'all_existing',
        message: `Todos os ${checkResult.total} OJs já estão cadastrados`,
        servidor,
        checkResult
      };
    }

    // Se precisa cadastrar alguns
    return {
      status: 'partial_missing',
      message: `${checkResult.existing.length} já cadastrados, ${checkResult.missing.length} para cadastrar`,
      servidor: {
        ...servidor,
        ojs: checkResult.missing // Só os que faltam
      },
      checkResult
    };
  }

  // Função para mostrar status visual dos OJs
  displayOJStatus(checkResult) {
    if (!checkResult) return;

    console.group(`📊 Status dos OJs - CPF: ${checkResult.cpf}`);
    
    console.log(`📈 Total de OJs: ${checkResult.total}`);
    console.log(`✅ Já cadastrados: ${checkResult.existing.length}`);
    console.log(`⏳ Pendentes: ${checkResult.missing.length}`);
    
    if (checkResult.existing.length > 0) {
      console.group('✅ OJs já cadastrados:');
      checkResult.existing.forEach((oj, index) => {
        console.log(`${index + 1}. ${oj}`);
      });
      console.groupEnd();
    }
    
    if (checkResult.missing.length > 0) {
      console.group('⏳ OJs para cadastrar:');
      checkResult.missing.forEach((oj, index) => {
        console.log(`${index + 1}. ${oj}`);
      });
      console.groupEnd();
    }
    
    console.groupEnd();
  }

  testOJNormalization() {
    console.log('🧪 Iniciando testes de normalização de OJs...');
    
    // Casos de teste
    const testCases = [
      {
        input: '1ª Vara do Trabalho de Campinas',
        expected: '1ª Vara do Trabalho de Campinas'
      },
      {
        input: '1a vara do trabalho de campinas',
        expected: '1ª Vara do Trabalho de Campinas'
      },
      {
        input: 'Campinas',
        expected: null // Pode ser varios OJs de Campinas
      },
      {
        input: 'VT Campinas',
        expected: null // Precisa ser mais específico
      },
      {
        input: 'EXE1 - Campinas',
        expected: 'EXE1 - Campinas'
      },
      {
        input: 'LIQ2 - Jundiaí',
        expected: 'LIQ2 - Jundiaí'
      },
      {
        input: 'ccp campinas',
        expected: 'CCP CAMPINAS - Centro de Conciliação Pré Processual'
      },
      {
        input: 'CEJUSC - Sorocaba',
        expected: 'CEJUSC SOROCABA - JT Centro Judiciário de Métodos Consensuais de Solução de Disputas da Justiça do Trabalho'
      },
      {
        input: 'CEJUS - Sorocaba',
        expected: 'CEJUSC SOROCABA - JT Centro Judiciário de Métodos Consensuais de Solução de Disputas da Justiça do Trabalho'
      }
    ];

    let passedTests = 0;
    const totalTests = testCases.length;

    console.log(`Executando ${totalTests} casos de teste...`);

    testCases.forEach((testCase, index) => {
      const result = this.normalizeOJName(testCase.input);
      const passed = testCase.expected === null ? true : result === testCase.expected;
      
      console.log(`Teste ${index + 1}: ${passed ? '✅' : '❌'}`);
      console.log(`  Input: "${testCase.input}"`);
      console.log(`  Expected: ${testCase.expected || 'qualquer match válido'}`);
      console.log(`  Result: "${result}"`);
      
      if (passed) passedTests++;
    });

    console.log(`\n📊 Resultado dos testes: ${passedTests}/${totalTests} casos passaram`);
    
    // Teste de performance
    console.log('\n⚡ Testando performance...');
    const startTime = performance.now();
    
    for (let i = 0; i < 100; i++) {
      this.normalizeOJName('1ª Vara do Trabalho de Campinas');
    }
    
    const endTime = performance.now();
    console.log(`100 normalizações executadas em ${(endTime - startTime).toFixed(2)}ms`);
    
    // Teste de índice
    console.log('\n📚 Estatísticas do índice:');
    console.log(`  OJs carregados: ${this.ojsData.length}`);
    console.log(`  Entradas no índice de busca: ${this.ojsSearchIndex.size}`);
    console.log(`  Entradas normalizadas: ${this.normalizedOJs.size}`);
    
    return { passedTests, totalTests, passed: passedTests === totalTests };
  }

  updateSuggestionSelection(items, selectedIndex) {
    items.forEach((item, index) => {
      if (index === selectedIndex) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  // ===== V2 AUTOMATION PLACEHOLDER METHODS =====

  setupServidorAutomationListeners() {
    // Botão de parada para servidores
    const stopButton = document.getElementById('stop-servidor-automation');
    if (stopButton) {
      stopButton.addEventListener('click', () => {
        this.stopServidorAutomation();
      });
    }
  }

  setupParallelProcessingListeners() {
    // Event listener para mudança do modo de automação
    const modeRadios = document.querySelectorAll('input[name="automation-mode"]');
    const parallelConfig = document.getElementById('parallel-config');
    
    modeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.value === 'parallel') {
          parallelConfig.style.display = 'block';
        } else {
          parallelConfig.style.display = 'none';
        }
      });
    });

    // Event listener para mudança do número de instâncias paralelas
    const maxInstancesSelect = document.getElementById('max-instances');
    const configHelp = parallelConfig.querySelector('.config-help');
    
    maxInstancesSelect.addEventListener('change', (e) => {
      const instances = parseInt(e.target.value);
      const originalHelp = '💡 <strong>Recomendação:</strong> 2-4 instâncias são ideais para a maioria dos casos.';

      if (instances === 4) {
        configHelp.innerHTML = `<i class="fas fa-info-circle"></i>
          <strong>Máximo Suportado:</strong> 4 instâncias proporcionam bom desempenho sem sobrecarregar o sistema.`;
        configHelp.style.color = '';
      } else if (instances === 3) {
        configHelp.innerHTML = `<i class="fas fa-info-circle"></i>
          <strong>Bom Desempenho:</strong> 3 instâncias oferecem equilíbrio entre velocidade e estabilidade.`;
        configHelp.style.color = '';
      } else {
        configHelp.innerHTML = originalHelp;
        configHelp.style.color = '';
      }
    });

    // Inicializar estado baseado na seleção atual
    const selectedMode = document.querySelector('input[name="automation-mode"]:checked');
    if (selectedMode && selectedMode.value === 'parallel') {
      parallelConfig.style.display = 'block';
    } else {
      parallelConfig.style.display = 'none';
    }
  }

  setupServidorV2Listeners() {
    // Método removido - funcionalidade V2 descontinuada
  }

  setupBuscaOJsListeners() {
    // Event listeners já existentes para OJs - apenas garantir que funcionem com a nova estrutura
    const configButtons = document.querySelectorAll('#busca-ojs .config-tab-button');
    configButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const tab = e.currentTarget?.dataset?.configTab || e.target?.dataset?.configTab;
        this.switchConfigTab(tab);
      });
    });
  }

  setupServidorPreview() {
    const input = document.getElementById('filtroNomeServidor');
    const preview = document.getElementById('servidor-preview');
    if (!input || !preview) return;

    let searchTimeout;
    let lastSearch = '';

    // Função para buscar servidor
    const buscarPreview = async (valor) => {
      if (valor === lastSearch) return;
      lastSearch = valor;

      if (valor.length < 3) {
        preview.classList.add('hidden');
        return;
      }

      // Obter grau selecionado
      const grauRadio = document.querySelector('input[name="grauServidor"]:checked');
      const grau = grauRadio ? grauRadio.value : '1';

      // Mostrar loading
      preview.classList.remove('hidden');
      const loading = preview.querySelector('.preview-loading');
      const content = preview.querySelector('.preview-content');
      const suggestions = preview.querySelector('.preview-suggestions');
      
      loading?.classList.remove('hidden');
      content?.classList.add('hidden');
      suggestions?.classList.add('hidden');

      try {
        // Verificar se é CPF formatado e remover formatação para busca
        const isCPFFormatado = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(valor);
        const valorBusca = isCPFFormatado ? valor.replace(/[.\-]/g, '') : valor;
        
        // Buscar servidor
        const response = await window.electronAPI.buscarServidores(grau, valorBusca, '', 'ativos', '');
        
        if (response.success && response.data && response.data.length > 0) {
          loading?.classList.add('hidden');
          
          if (response.data.length === 1) {
            // Mostrar preview único
            const servidor = response.data[0];
            content?.classList.remove('hidden');
            
            const nameEl = preview.querySelector('.preview-name');
            const cpfEl = preview.querySelector('.preview-cpf');
            const detailsEl = preview.querySelector('.preview-details');
            
            // Determinar o que destacar baseado no que foi digitado
            const isCPF = /^\d+$/.test(valorBusca) || isCPFFormatado;
            
            if (nameEl) {
              nameEl.textContent = servidor.nome || 'Nome não disponível';
              nameEl.style.color = isCPF ? '#8b7355' : '#2c3e50';
              nameEl.style.fontWeight = isCPF ? 'bold' : 'normal';
            }
            
            if (cpfEl) {
              cpfEl.textContent = servidor.cpf || 'CPF não disponível';
              cpfEl.style.fontWeight = !isCPF ? 'bold' : 'normal';
            }
            
            if (detailsEl) {
              const totalOJs = servidor.ojs ? servidor.ojs.length : 0;
              detailsEl.textContent = `${totalOJs} órgão(s) julgador(es) vinculado(s) • ${grau}º Grau`;
            }
            
            // Ao clicar no preview, preenche o campo e faz a busca
            content.onclick = () => {
              input.value = isCPF ? servidor.nome : servidor.cpf;
              preview.classList.add('hidden');
              this.buscarServidores();
            };
            
          } else {
            // Mostrar múltiplas sugestões
            suggestions?.classList.remove('hidden');
            const listEl = preview.querySelector('.suggestions-list');
            
            if (listEl) {
              listEl.innerHTML = '';
              
              response.data.forEach(servidor => {
                const item = document.createElement('div');
                item.className = 'suggestion-item';
                item.innerHTML = `
                  <div>
                    <div class="suggestion-name">${servidor.nome}</div>
                    <div class="suggestion-cpf">CPF: ${servidor.cpf}</div>
                  </div>
                `;
                
                item.onclick = () => {
                  input.value = servidor.cpf;
                  preview.classList.add('hidden');
                  this.buscarServidores();
                };
                
                listEl.appendChild(item);
              });
            }
          }
        } else {
          // Nenhum resultado
          loading?.classList.add('hidden');
          content?.classList.remove('hidden');
          
          const nameEl = preview.querySelector('.preview-name');
          const cpfEl = preview.querySelector('.preview-cpf');
          const detailsEl = preview.querySelector('.preview-details');
          
          if (nameEl) nameEl.textContent = 'Nenhum servidor encontrado';
          if (cpfEl) cpfEl.textContent = '';
          if (detailsEl) detailsEl.textContent = 'Tente outro CPF ou nome';
        }
      } catch (error) {
        console.error('Erro no preview:', error);
        preview.classList.add('hidden');
      }
    };

    // Event listener com debounce
    input.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const valor = e.target.value.trim();
      
      if (valor.length < 3) {
        preview.classList.add('hidden');
        lastSearch = '';
        return;
      }
      
      searchTimeout = setTimeout(() => {
        buscarPreview(valor);
      }, 500); // Aguarda 500ms após parar de digitar
    });

    // Fechar preview ao clicar fora
    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !preview.contains(e.target)) {
        preview.classList.add('hidden');
      }
    });

    // Fechar preview ao pressionar Esc
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        preview.classList.add('hidden');
      }
    });
  }

  updateDashboardStats() {
    // Atualizar estatísticas do dashboard
    const totalServidoresEl = document.getElementById('total-servidores');
    const totalPeritosEl = document.getElementById('total-peritos');
    const totalAutomacoesEl = document.getElementById('total-automacoes');
    const statusSistemaEl = document.getElementById('status-sistema');

    if (totalServidoresEl) {
      totalServidoresEl.textContent = this.servidores?.length || 0;
    }
    
    if (totalPeritosEl) {
      totalPeritosEl.textContent = this.peritos?.length || 0;
    }
    
    if (totalAutomacoesEl) {
      // Pode ser incrementado durante automações
      const automacoes = localStorage.getItem('total-automacoes') || 0;
      totalAutomacoesEl.textContent = automacoes;
    }
    
    if (statusSistemaEl) {
      // Verificar status do sistema
      statusSistemaEl.textContent = '✓';
    }
  }
  
  updatePerfilInfo(perfilValue, selectedOption) {
    const perfilInfo = document.getElementById('perfil-description');
    const perfilCard = perfilInfo.querySelector('.perfil-card');
    const perfilIcon = perfilCard.querySelector('.perfil-icon');
    const perfilTitle = perfilCard.querySelector('h5');
    const perfilDescription = perfilCard.querySelector('p');
    const perfilPermissions = perfilCard.querySelector('.perfil-permissions');
    
    if (!perfilValue) {
      perfilInfo.classList.remove('show');
      return;
    }
    
    // Obter dados do perfil selecionado
    const description = selectedOption ? selectedOption.getAttribute('data-description') : '';
    const emoji = selectedOption ? selectedOption.textContent.split(' ')[0] : '👤';
    
    // Definir permissões baseadas no perfil
    const permissionsMap = {
      'Administrador': ['🔧 Sistema', '👥 Usuários', '⚙️ Configurações', '📊 Relatórios'],
      'Assessor': ['📄 Processos', '📝 Documentos', '👨‍⚖️ Apoio Magistrado'],
      'Diretor de Central de Atendimento': ['📞 Atendimento', '📋 Distribuição', '👥 Equipe'],
      'Diretor de Secretaria': ['📊 Administração', '👥 Secretaria', '📋 Supervisão'],
      'Estagiário Conhecimento': ['📚 Aprendizado', '📄 Consulta', '🎓 Formação'],
      'Estagiário de Central de Atendimento': ['📞 Atendimento', '📋 Apoio', '🎓 Formação'],
      'Secretário de Audiência': ['⚖️ Audiências', '📝 Atos', '📋 Processuais'],
      'Servidor': ['📄 Processos', '📝 Documentos', '👤 Padrão'],
      'Perito Judicial': ['🔬 Perícias', '📊 Laudos', '⚖️ Técnico']
    };
    
    const permissions = permissionsMap[perfilValue] || ['👤 Acesso Básico'];
    
    // Atualizar elementos
    perfilIcon.textContent = emoji;
    perfilTitle.textContent = perfilValue;
    perfilDescription.textContent = description || 'Perfil de acesso ao sistema';
    
    // Atualizar permissões
    perfilPermissions.innerHTML = '';
    permissions.forEach(permission => {
      const tag = document.createElement('span');
      tag.className = 'permission-tag';
      tag.textContent = permission;
      perfilPermissions.appendChild(tag);
    });
    
    // Mostrar o card com animação
    perfilInfo.classList.add('show');
  }
  
  openServidorV2Modal() {
    const modal = document.getElementById('servidor-v2-modal');
    if (modal) {
      modal.style.display = 'block';
      // Trigger da animação
      setTimeout(() => {
        modal.querySelector('.modern-modal').style.opacity = '1';
      }, 10);
    }
  }
  
  closeServidorV2Modal() {
    const modal = document.getElementById('servidor-v2-modal');
    if (modal) {
      modal.style.display = 'none';
      // Reset do formulário
      document.getElementById('servidor-v2-form').reset();
      // Reset da informação do perfil
      document.getElementById('perfil-description').classList.remove('show');
    }
  }
  
  saveServidorV2() {
    const cpf = document.getElementById('v2-cpf').value;
    const perfil = document.getElementById('v2-perfil').value;
    
    if (!cpf || !perfil) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    
    // Aqui você pode implementar a lógica de salvamento
    console.log('Salvando servidor V2:', { cpf, perfil });
    
    // Fechar modal após salvar
    this.closeServidorV2Modal();
    
    // Mostrar mensagem de sucesso
    this.showNotification('Servidor configurado com sucesso!', 'success');
  }

  loadServidorV2Config() {
    // Placeholder for V2 config loading
  }

  updateV2StatusIndicator() {
    // Placeholder for V2 status updates
  }

  showFinalReport(relatorio) {
    console.log('Final report:', relatorio);
    this.hideLoading();
    this.showReportModal(relatorio);
  }

  showReportModal(relatorio) {
    // Criar modal de relatório
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'report-modal';
    
    // Calcular estatísticas
    const totalOJs = relatorio.resultados ? relatorio.resultados.length : 0;
    const sucessos = relatorio.resultados ? relatorio.resultados.filter(r => r.status === 'Incluído com Sucesso' || r.status === 'Sucesso').length : 0;
    const jaIncluidos = relatorio.resultados ? relatorio.resultados.filter(r => r.status === 'Já Incluído' || r.status === 'Já Cadastrado').length : 0;
    const erros = relatorio.resultados ? relatorio.resultados.filter(r => r.status === 'Erro').length : 0;
    const percentualSucesso = totalOJs > 0 ? ((sucessos + jaIncluidos) / totalOJs * 100).toFixed(1) : 0;
    
    modal.innerHTML = `
      <div class="modal-content report-modal">
        <div class="modal-header">
          <h2>📊 Relatório de Automação</h2>
          <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</button>
        </div>
        
        <div class="modal-body">
          <!-- Resumo Geral -->
          <div class="report-summary">
            <div class="summary-card success">
              <div class="summary-number">${sucessos}</div>
              <div class="summary-label">Cadastrados com Sucesso</div>
            </div>
            <div class="summary-card info">
              <div class="summary-number">${jaIncluidos}</div>
              <div class="summary-label">Já Cadastrados</div>
            </div>
            <div class="summary-card error">
              <div class="summary-number">${erros}</div>
              <div class="summary-label">Erros</div>
            </div>
            <div class="summary-card total">
              <div class="summary-number">${totalOJs}</div>
              <div class="summary-label">Total de OJs</div>
            </div>
          </div>
          
          <!-- Barra de Progresso -->
          <div class="progress-section">
            <div class="progress-bar-container">
              <div class="progress-bar" style="width: ${percentualSucesso}%"></div>
            </div>
            <div class="progress-text">${percentualSucesso}% de sucesso</div>
          </div>
          
          <!-- Lista Detalhada de OJs -->
          <div class="report-details">
            <h3>Detalhes por Órgão Julgador</h3>
            <div class="oj-list">
              ${relatorio.resultados ? relatorio.resultados.map(oj => `
                <div class="oj-item ${this.getStatusClass(oj.status)}">
                  <div class="oj-name">${oj.orgao}</div>
                  <div class="oj-status">
                    <span class="status-badge ${this.getStatusClass(oj.status)}">
                      ${this.getStatusIcon(oj.status)} ${this.getStatusText(oj.status)}
                    </span>
                  </div>
                  ${oj.observacoes ? `<div class="oj-details">${oj.observacoes}</div>` : ''}
                </div>
              `).join('') : '<div class="no-data">Nenhum resultado disponível</div>'}
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
          <button class="btn btn-primary" onclick="app.exportReport()">Exportar Relatório</button>
          ${erros > 0 ? '<button class="btn btn-warning" onclick="app.showErrorRecovery()">Tentar Novamente</button>' : ''}
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Adicionar estilos se não existirem
    this.addReportModalStyles();
  }
  
  getStatusClass(status) {
    if (status === 'Incluído com Sucesso' || status === 'Sucesso') return 'success';
    if (status === 'Já Incluído' || status === 'Já Cadastrado') return 'info';
    if (status === 'Erro') return 'error';
    return 'default';
  }
  
  getStatusIcon(status) {
    if (status === 'Incluído com Sucesso' || status === 'Sucesso') return '✅';
    if (status === 'Já Incluído' || status === 'Já Cadastrado') return 'ℹ️';
    if (status === 'Erro') return '❌';
    return '⚪';
  }
  
  getStatusText(status) {
    if (status === 'Incluído com Sucesso' || status === 'Sucesso') return 'Cadastrado com Sucesso';
    if (status === 'Já Incluído' || status === 'Já Cadastrado') return 'Já Cadastrado';
    if (status === 'Erro') return 'Erro';
    return status;
  }
  
  addReportModalStyles() {
    if (document.getElementById('report-modal-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'report-modal-styles';
    styles.textContent = `
      .report-modal {
        max-width: 800px;
        max-height: 90vh;
        overflow-y: auto;
      }
      
      .report-summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 15px;
        margin-bottom: 20px;
      }
      
      .summary-card {
        background: #f8f9fa;
        border-radius: 8px;
        padding: 20px;
        text-align: center;
        border-left: 4px solid #ddd;
      }
      
      .summary-card.success { border-left-color: #6b8e58; }
      .summary-card.info { border-left-color: #17a2b8; }
      .summary-card.error { border-left-color: #dc3545; }
      .summary-card.total { border-left-color: #6c757d; }
      
      .summary-number {
        font-size: 2em;
        font-weight: bold;
        margin-bottom: 5px;
      }
      
      .summary-card.success .summary-number { color: #6b8e58; }
      .summary-card.info .summary-number { color: #17a2b8; }
      .summary-card.error .summary-number { color: #dc3545; }
      .summary-card.total .summary-number { color: #6c757d; }
      
      .summary-label {
        font-size: 0.9em;
        color: #666;
      }
      
      .progress-section {
        margin: 20px 0;
      }
      
      .progress-bar-container {
        background: #e9ecef;
        border-radius: 10px;
        height: 20px;
        overflow: hidden;
        margin-bottom: 10px;
      }
      
      .progress-bar {
        background: linear-gradient(90deg, #6b8e58, #b8956f);
        height: 100%;
        transition: width 0.3s ease;
      }
      
      .progress-text {
        text-align: center;
        font-weight: bold;
        color: #495057;
      }
      
      .report-details h3 {
        margin: 20px 0 15px 0;
        color: #495057;
      }
      
      .oj-list {
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid #dee2e6;
        border-radius: 8px;
      }
      
      .oj-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 15px;
        border-bottom: 1px solid #dee2e6;
        background: #fff;
      }
      
      .oj-item:last-child {
        border-bottom: none;
      }
      
      .oj-item:hover {
        background: #f8f9fa;
      }
      
      .oj-name {
        flex: 1;
        font-weight: 500;
      }
      
      .oj-status {
        margin-left: 15px;
      }
      
      .status-badge {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.85em;
        font-weight: 500;
      }
      
      .status-badge.success {
        background: #d4edda;
        color: #155724;
      }
      
      .status-badge.info {
        background: #d1ecf1;
        color: #0c5460;
      }
      
      .status-badge.error {
        background: #f8d7da;
        color: #721c24;
      }
      
      .oj-details {
        font-size: 0.85em;
        color: #666;
        margin-top: 5px;
      }
      
      .no-data {
        text-align: center;
        padding: 40px;
        color: #666;
        font-style: italic;
      }
      
      .modal-footer {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
      }
      
      .btn-warning {
        background: #ffc107;
        color: #212529;
        border: 1px solid #ffc107;
      }
      
      .btn-warning:hover {
        background: #e0a800;
        border-color: #d39e00;
      }
    `;
    
    document.head.appendChild(styles);
  }
  
  exportReport() {
    // Implementar exportação do relatório
    this.showNotification('Funcionalidade de exportação será implementada em breve', 'info');
  }
  
  showErrorRecovery() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>🔄 Recuperação de Erros</h2>
          <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</button>
        </div>
        
        <div class="modal-body">
          <p>Deseja tentar processar novamente os OJs que falharam?</p>
          <div class="alert alert-warning">
            <strong>Atenção:</strong> Esta ação irá reiniciar a automação apenas para os OJs que apresentaram erro.
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
          <button class="btn btn-primary" onclick="app.restartAutomationForErrors(); this.closest('.modal-overlay').remove();">Tentar Novamente</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }
  
  restartAutomationForErrors() {
    this.showNotification('Reiniciando automação para OJs com erro...', 'info');
    // Implementar lógica de restart para erros
    // Por enquanto, apenas mostrar mensagem
    setTimeout(() => {
      this.showNotification('Funcionalidade de recuperação será implementada em breve', 'warning');
    }, 1000);
  }
  
  showAutomationError(errorMessage, context = {}) {
    this.hideLoading();
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content error-modal">
        <div class="modal-header error">
          <h2>❌ Erro na Automação</h2>
          <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</button>
        </div>
        
        <div class="modal-body">
          <div class="error-message">
            <h3>Descrição do Erro:</h3>
            <p>${errorMessage}</p>
          </div>
          
          ${context.servidor ? `
            <div class="error-context">
              <h4>Contexto:</h4>
              <ul>
                <li><strong>Servidor:</strong> ${context.servidor}</li>
                ${context.oj ? `<li><strong>Órgão Julgador:</strong> ${context.oj}</li>` : ''}
                ${context.step ? `<li><strong>Etapa:</strong> ${context.step}</li>` : ''}
              </ul>
            </div>
          ` : ''}
          
          <div class="error-actions">
            <h4>O que você pode fazer:</h4>
            <ul>
              <li>Verificar a conexão com a internet</li>
              <li>Verificar se o servidor está acessível</li>
              <li>Tentar novamente a automação</li>
              <li>Verificar os logs para mais detalhes</li>
            </ul>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
          <button class="btn btn-primary" onclick="app.restartAutomation(); this.closest('.modal-overlay').remove();">Tentar Novamente</button>
          <button class="btn btn-info" onclick="app.showLogs()">Ver Logs</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    this.addErrorModalStyles();
  }
  
  addErrorModalStyles() {
    if (document.getElementById('error-modal-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'error-modal-styles';
    styles.textContent = `
      .error-modal {
        max-width: 600px;
      }
      
      .modal-header.error {
        background: #f8d7da;
        color: #721c24;
        border-bottom: 1px solid #f5c6cb;
      }
      
      .error-message {
        background: #f8d7da;
        border: 1px solid #f5c6cb;
        border-radius: 4px;
        padding: 15px;
        margin-bottom: 20px;
      }
      
      .error-message h3 {
        margin-top: 0;
        color: #721c24;
      }
      
      .error-message p {
        margin-bottom: 0;
        color: #721c24;
      }
      
      .error-context {
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        border-radius: 4px;
        padding: 15px;
        margin-bottom: 20px;
      }
      
      .error-context h4 {
        margin-top: 0;
        color: #856404;
      }
      
      .error-context ul {
        margin-bottom: 0;
        color: #856404;
      }
      
      .error-actions {
        background: #d1ecf1;
        border: 1px solid #bee5eb;
        border-radius: 4px;
        padding: 15px;
      }
      
      .error-actions h4 {
        margin-top: 0;
        color: #0c5460;
      }
      
      .error-actions ul {
        margin-bottom: 0;
        color: #0c5460;
      }
      
      .btn-info {
        background: #17a2b8;
        color: white;
        border: 1px solid #17a2b8;
      }
      
      .btn-info:hover {
        background: #138496;
        border-color: #117a8b;
      }
    `;
    
    document.head.appendChild(styles);
  }
  
  restartAutomation() {
    this.showNotification('Reiniciando automação...', 'info');
    // Implementar lógica de restart completo
    setTimeout(() => {
      this.showNotification('Funcionalidade de reinício será implementada em breve', 'warning');
    }, 1000);
  }
  
  showLogs() {
    this.showNotification('Abrindo logs do sistema...', 'info');
    // Implementar visualização de logs
    setTimeout(() => {
      this.showNotification('Funcionalidade de logs será implementada em breve', 'warning');
    }, 1000);
  }

  // Métodos para gerenciar o dashboard de processamento paralelo
  showParallelDashboard() {
    const dashboard = document.getElementById('parallel-dashboard');
    if (dashboard) {
      dashboard.classList.remove('hidden');
      this.setupParallelDashboardListeners();
    }
  }

  hideParallelDashboard() {
    const dashboard = document.getElementById('parallel-dashboard');
    if (dashboard) {
      dashboard.classList.add('hidden');
    }
  }

  setupParallelDashboardListeners() {
    const pauseBtn = document.getElementById('parallel-pause-btn');
    const stopBtn = document.getElementById('parallel-stop-btn');

    if (pauseBtn) {
      pauseBtn.onclick = () => this.pauseAllParallelInstances();
    }

    if (stopBtn) {
      stopBtn.onclick = () => this.stopAllParallelInstances();
    }
  }

  updateParallelDashboard(data) {
    // Atualizar contadores
    const instancesCount = document.getElementById('parallel-instances-count');
    const totalProgress = document.getElementById('parallel-total-progress');
    const overallProgressFill = document.getElementById('overall-progress-fill');
    const overallProgressText = document.getElementById('overall-progress-text');
    const elapsedTime = document.getElementById('parallel-elapsed-time');
    const estimatedTime = document.getElementById('parallel-estimated-time');
    const speed = document.getElementById('parallel-speed');

    if (data.instances && instancesCount) {
      instancesCount.textContent = data.instances.length;
    }

    if (data.totalServers && data.completedServers && totalProgress) {
      totalProgress.textContent = `${data.completedServers}/${data.totalServers}`;
    }

    // Atualizar progresso geral
    if (data.overallProgress !== undefined) {
      const percentage = Math.round(data.overallProgress);
      if (overallProgressFill) {
        overallProgressFill.style.width = `${percentage}%`;
      }
      if (overallProgressText) {
        overallProgressText.textContent = `${percentage}%`;
      }
    }

    // Atualizar estatísticas
    if (data.elapsedTime && elapsedTime) {
      elapsedTime.textContent = this.formatTime(data.elapsedTime);
    }

    if (data.estimatedTime && estimatedTime) {
      estimatedTime.textContent = this.formatTime(data.estimatedTime);
    }

    if (data.speed && speed) {
      speed.textContent = `${data.speed.toFixed(1)} serv/min`;
    }

    // Atualizar instâncias
    this.updateParallelInstances(data.instances || []);
  }

  updateParallelInstances(instances) {
    const container = document.getElementById('parallel-instances');
    if (!container) return;

    container.innerHTML = '';

    instances.forEach((instance, index) => {
      const instanceElement = this.createInstanceElement(instance, index);
      container.appendChild(instanceElement);
    });
  }

  createInstanceElement(instance, index) {
    const div = document.createElement('div');
    div.className = 'instance-item';
    div.innerHTML = `
      <div class="instance-header">
        <div class="instance-title">Instância ${index + 1}</div>
        <div class="instance-status ${instance.status}">${this.getInstanceStatusText(instance.status)}</div>
      </div>
      <div class="instance-progress">
        <div class="instance-progress-bar">
          <div class="instance-progress-fill" style="width: ${instance.progress || 0}%"></div>
        </div>
        <div class="instance-progress-text">${Math.round(instance.progress || 0)}%</div>
      </div>
      <div class="instance-details">
        <div>Servidor: ${instance.currentServer || 'Aguardando...'}</div>
        <div>Processados: ${instance.completed || 0}/${instance.total || 0}</div>
        <div>Tempo: ${this.formatTime(instance.elapsedTime || 0)}</div>
      </div>
    `;
    return div;
  }

  getInstanceStatusText(status) {
    const statusMap = {
      'running': 'Executando',
      'paused': 'Pausado',
      'error': 'Erro',
      'completed': 'Concluído',
      'waiting': 'Aguardando'
    };
    return statusMap[status] || status;
  }

  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  pauseAllParallelInstances() {
    // Implementar lógica para pausar todas as instâncias
    this.showNotification('Pausando todas as instâncias...', 'info');
    // Aqui seria chamada a função do backend para pausar
  }

  stopAllParallelInstances() {
    if (confirm('Tem certeza que deseja parar todo o processamento paralelo?')) {
      this.hideParallelDashboard();
      this.stopServidorAutomation();
      this.showNotification('Processamento paralelo interrompido', 'warning');
    }
  }

  // Métodos para o modal de servidores processados
  switchServerTab(tabName) {
    return switchServerTab(tabName);
  }

  closeProcessedServersModal() {
    return closeProcessedServersModal();
  }

  exportProcessedServers() {
    return exportProcessedServers();
  }

  /**
   * Busca órgãos julgadores diretamente do banco de dados
   */
  async buscarOJsDoBanco(grau) {
    const statusId = `statusOjs${grau}Grau`;
    const resultadoId = `resultadoOjs${grau}Grau`;
    const tabelaId = `tabelaOjs${grau}Grau`;
    const countId = `countOjs${grau}Grau`;
    const exportBtnId = `exportarOjs${grau}Grau`;

    // Obter filtros
    const filtro = document.getElementById(`filtroOjs${grau}Grau`).value.trim();
    const limite = parseInt(document.getElementById(`limiteOjs${grau}Grau`).value);

    // Mostrar status de carregamento
    document.getElementById(statusId).classList.remove('hidden');
    document.getElementById(resultadoId).classList.add('hidden');
    document.getElementById(exportBtnId).disabled = true;

    try {
      console.log(`🔍 Buscando OJs ${grau}º grau no banco de dados...`);

      const response = grau === '1'
        ? await window.electronAPI.buscarOJs1Grau(filtro, limite)
        : await window.electronAPI.buscarOJs2Grau(filtro, limite);

      if (response.success) {
        // Usar todos os registros retornados, sem exclusões
        const ojs = response.data;

        // Armazenar dados para exportação
        if (grau === '1') {
          this.ojsData1Grau = ojs;
        } else {
          this.ojsData2Grau = ojs;
        }

        // Atualizar contadores
        document.getElementById(countId).textContent = ojs.length;

        // Renderizar tabela com novo formato
        this.renderizarTabelaOJsBanco(tabelaId, ojs);

        // Mostrar resultados
        document.getElementById(statusId).classList.add('hidden');
        document.getElementById(resultadoId).classList.remove('hidden');
        document.getElementById(exportBtnId).disabled = false;

        console.log(`✅ ${ojs.length} OJs ${grau}º grau encontrados no banco`);

      } else {
        throw new Error(response.error || 'Erro desconhecido');
      }

    } catch (error) {
      console.error(`❌ Erro ao buscar OJs ${grau}º grau:`, error);

      // Esconder status de carregamento
      document.getElementById(statusId).classList.add('hidden');

      // Mostrar mensagem de erro
      this.showNotification(`Erro ao carregar OJs ${grau}º grau: ${error.message}`, 'error');
    }
  }

  /**
   * Renderiza tabela de OJs do banco de dados com ordenação e agrupamento por cidade
   */
  renderizarTabelaOJsBanco(tabelaId, ojs) {
    const tabela = document.getElementById(tabelaId);
    if (!tabela) {
      console.error(`❌ Tabela com ID "${tabelaId}" não encontrada`);
      return;
    }

    // Limpar tabela
    tabela.innerHTML = '';

    if (!ojs || ojs.length === 0) {
      tabela.innerHTML = '<tr><td colspan="1" class="text-center">Nenhum órgão julgador encontrado</td></tr>';
      return;
    }

    // Função para extrair cidade do nome do órgão julgador
    const extrairCidade = (nomeOrgao) => {
      if (!nomeOrgao) return 'Outros';
      
      const nome = nomeOrgao.trim();
      
      // Padrões otimizados para capturar cidades
      const padroes = [
        // Padrão principal: "de [Cidade]" - captura tudo após "de" até o final ou hífen/parênteses
        /\bde\s+([A-ZÀ-ÿ][A-Za-zÀ-ÿ\s''-]+?)(?:\s*$|\s*-|\s*\()/i,
        
        // Padrão: "em [Cidade]" - similar ao anterior mas com "em"
        /\bem\s+([A-ZÀ-ÿ][A-Za-zÀ-ÿ\s''-]+?)(?:\s*$|\s*-|\s*\()/i,
        
        // Padrão: "- [Cidade]" - captura cidade após hífen
        /\s-\s+([A-ZÀ-ÿ][A-Za-zÀ-ÿ\s''-]+?)(?:\s*$|\s*\()/i
      ];
      
      for (const padrao of padroes) {
        const match = nome.match(padrao);
        if (match) {
          let cidade = match[1].trim();
          
          // Limpeza da cidade extraída
          cidade = cidade
            .replace(/\s+/g, ' ')           // Normalizar espaços múltiplos
            .replace(/[,;].*$/, '')         // Remover vírgulas/ponto-vírgula e tudo após
            .replace(/^\d+[ªº]?\s*/, '')    // Remover números ordinais no início (1ª, 2º, etc.)
            .trim();
          
          // Validação da cidade extraída
          const cidadeValida = cidade.length >= 3 && 
                              // Não pode ser apenas preposições ou palavras comuns de órgãos
                              !/^(do|da|dos|das|de|em|no|na|nos|nas|vara|juizado|tribunal|trabalho|especial|cível|criminal|família|fazenda|execução|federal|estadual|regional|comarca|foro)$/i.test(cidade) &&
                              !/^\d+$/.test(cidade) &&  // Não pode ser só números
                              !/^[A-Z]{1,3}$/.test(cidade); // Não pode ser siglas curtas
          
          if (cidadeValida) {
            return cidade;
          }
        }
      }
      
      return 'Outros';
    };

    // Agrupar OJs por cidade
    const ojsPorCidade = {};
    ojs.forEach(oj => {
      const nomeOrgao = oj.ds_orgao_julgador || oj.nome || 'Nome não disponível';
      const cidade = extrairCidade(nomeOrgao);
      
      if (!ojsPorCidade[cidade]) {
        ojsPorCidade[cidade] = [];
      }
      
      ojsPorCidade[cidade].push({
        ...oj,
        nomeOrgao
      });
    });

    // Ordenar cidades alfabeticamente
    const cidadesOrdenadas = Object.keys(ojsPorCidade).sort((a, b) => {
      if (a === 'Outros') return 1;
      if (b === 'Outros') return -1;
      return a.localeCompare(b, 'pt-BR');
    });

    // Ordenar OJs dentro de cada cidade alfabeticamente e numericamente
    cidadesOrdenadas.forEach(cidade => {
      ojsPorCidade[cidade].sort((a, b) => {
        return a.nomeOrgao.localeCompare(b.nomeOrgao, 'pt-BR', { numeric: true });
      });
    });

    // Renderizar tabela agrupada por cidade
    let totalOjs = 0;

    // Adicionar ícone de cópia no cabeçalho do modal
    this.adicionarIconeCopiaModal(tabelaId, ojsPorCidade, cidadesOrdenadas, ojs.length);
    cidadesOrdenadas.forEach(cidade => {
      const ojsDaCidade = ojsPorCidade[cidade];
      
      // Cabeçalho da cidade
      const linhaCidade = document.createElement('tr');
      linhaCidade.className = 'city-header';
      linhaCidade.innerHTML = `
        <td>
          <div class="city-group">
            <h4 class="city-name">${cidade} (${ojsDaCidade.length} órgãos)</h4>
          </div>
        </td>
      `;
      tabela.appendChild(linhaCidade);

      // OJs da cidade
      ojsDaCidade.forEach((oj, index) => {
        const linha = document.createElement('tr');
        linha.className = 'oj-row';
        linha.innerHTML = `
          <td>
            <div class="oj-item">
              <div class="oj-name">${oj.nomeOrgao}</div>
              ${oj.sg_orgao_julgador ? `<div class="oj-sigla">${oj.sg_orgao_julgador}</div>` : ''}
              ${oj.id_orgao_julgador ? `<div class="oj-id">ID: ${oj.id_orgao_julgador}</div>` : ''}
            </div>
          </td>
        `;
        
        // Adicionar classe zebrada para melhor visualização
        if (index % 2 === 0) {
          linha.classList.add('even-row');
        }
        
        tabela.appendChild(linha);
        totalOjs++;
      });
    });

    console.log(`✅ Tabela renderizada com ${totalOjs} órgãos julgadores agrupados por ${cidadesOrdenadas.length} cidades`);
  }

  /**
   * Adiciona ícone de cópia no cabeçalho do modal
   */
  adicionarIconeCopiaModal(tabelaId, ojsPorCidade, cidadesOrdenadas, totalOjs) {
    // Determinar qual grau baseado no ID da tabela
    const grau = tabelaId.includes('1Grau') ? '1' : '2';
    const resultadoDiv = document.getElementById(`resultadoOjs${grau}Grau`);
    
    if (!resultadoDiv) {
      console.error(`❌ Container de resultado não encontrado para ${grau}º grau`);
      return;
    }

    const resultsHeader = resultadoDiv.querySelector('.results-header');
    if (!resultsHeader) {
      console.error(`❌ Cabeçalho de resultados não encontrado para ${grau}º grau`);
      return;
    }

    // Remover ícone existente se houver
    const iconeExistente = resultsHeader.querySelector('.copy-icon');
    if (iconeExistente) {
      iconeExistente.remove();
    }

    // Criar ícone de cópia
    const iconeCopia = document.createElement('div');
    iconeCopia.className = 'copy-icon';
    iconeCopia.innerHTML = `
      <button class="btn-copy-modal" title="Copiar resultados agrupados por cidade">
        <i class="fas fa-copy"></i>
      </button>
    `;

    // Adicionar ao cabeçalho
    resultsHeader.appendChild(iconeCopia);

    // Implementar funcionalidade de cópia
    const btnCopia = iconeCopia.querySelector('.btn-copy-modal');
    if (btnCopia) {
      btnCopia.addEventListener('click', () => {
        let textoCompleto = `ÓRGÃOS JULGADORES ${grau}º GRAU AGRUPADOS POR CIDADE - TOTAL: ${totalOjs}\n`;
        textoCompleto += '='.repeat(70) + '\n\n';
        
        cidadesOrdenadas.forEach(cidade => {
          const ojsDaCidade = ojsPorCidade[cidade];
          textoCompleto += `${cidade.toUpperCase()} (${ojsDaCidade.length} órgãos)\n`;
          textoCompleto += '-'.repeat(40) + '\n';
          
          ojsDaCidade.forEach(oj => {
            textoCompleto += `• ${oj.nomeOrgao}\n`;
          });
          
          textoCompleto += '\n';
        });
        
        this.copiarParaClipboard(textoCompleto, `Resultados ${grau}º grau copiados!`);
      });
    }

    console.log(`✅ Ícone de cópia adicionado ao cabeçalho ${grau}º grau`);
  }

  /**
   * Copia texto para o clipboard
   */
  copiarParaClipboard(texto, mensagemSucesso) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(texto).then(() => {
        this.showNotification(mensagemSucesso, 'success');
      }).catch(err => {
        console.error('Erro ao copiar:', err);
        this.showNotification('Erro ao copiar para clipboard', 'error');
      });
    } else {
      // Fallback para navegadores mais antigos
      const textArea = document.createElement('textarea');
      textArea.value = texto;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        this.showNotification(mensagemSucesso, 'success');
      } catch (err) {
        console.error('Erro ao copiar:', err);
        this.showNotification('Erro ao copiar para clipboard', 'error');
      }
      
      document.body.removeChild(textArea);
    }
  }

  /**
   * Exibe modal com comparação de OJs
   */
  exibirModalComparacaoOJs(resultado) {
    // Criar modal
    const modal = document.createElement('div');
    modal.id = 'modal-comparacao-ojs';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,0,0,0.5); z-index: 10000; display: flex; 
      align-items: center; justify-content: center;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
      background: white; padding: 30px; border-radius: 10px; 
      max-width: 900px; width: 90%; max-height: 90%; overflow-y: auto;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    
    const percentualCor = resultado.percentualSincronizado === 100 ? '#28a745' : 
      resultado.percentualSincronizado >= 50 ? '#ffc107' : '#dc3545';
    
    content.innerHTML = `
      <div style="border-bottom: 2px solid #e9ecef; margin-bottom: 20px; padding-bottom: 15px;">
        <h2 style="margin: 0 0 10px 0; color: #333;">
          <i class="fas fa-sync-alt"></i> Comparação de OJs - ${resultado.nome}
        </h2>
        <p style="color: #666; margin: 5px 0;">CPF: ${resultado.cpf}</p>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 15px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h3 style="margin: 0; color: ${percentualCor};">
                ${resultado.percentualSincronizado}% Sincronizado
              </h3>
              <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">
                ${resultado.ojsComuns.length} OJs em comum de ${new Set([...resultado.ojsLocais, ...resultado.ojsBanco]).size} total
              </p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; color: #666;"><strong>Local:</strong> ${resultado.ojsLocais.length} OJs</p>
              <p style="margin: 5px 0 0 0; color: #666;"><strong>Banco:</strong> ${resultado.ojsBanco.length} OJs</p>
            </div>
          </div>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
        <!-- OJs apenas Local -->
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px;">
          <h4 style="margin: 0 0 10px 0; color: #856404;">
            <i class="fas fa-desktop"></i> Apenas Local (${resultado.ojsApenasLocal.length})
          </h4>
          <div style="max-height: 250px; overflow-y: auto;">
            ${resultado.ojsApenasLocal.length > 0 ? 
    '<ul style="margin: 0; padding-left: 20px; color: #666;">' +
              resultado.ojsApenasLocal.map(oj => `<li style="margin: 5px 0;">${oj}</li>`).join('') +
              '</ul>' : 
    '<p style="color: #999; font-style: italic;">Nenhum OJ apenas local</p>'
}
          </div>
        </div>
        
        <!-- OJs em Comum -->
        <div style="background: #d4edda; padding: 15px; border-radius: 8px;">
          <h4 style="margin: 0 0 10px 0; color: #155724;">
            <i class="fas fa-check-double"></i> Em Comum (${resultado.ojsComuns.length})
          </h4>
          <div style="max-height: 250px; overflow-y: auto;">
            ${resultado.ojsComuns.length > 0 ? 
    '<ul style="margin: 0; padding-left: 20px; color: #666;">' +
              resultado.ojsComuns.map(oj => `<li style="margin: 5px 0;">${oj}</li>`).join('') +
              '</ul>' : 
    '<p style="color: #999; font-style: italic;">Nenhum OJ em comum</p>'
}
          </div>
        </div>
        
        <!-- OJs apenas Banco -->
        <div style="background: #cce5ff; padding: 15px; border-radius: 8px;">
          <h4 style="margin: 0 0 10px 0; color: #004085;">
            <i class="fas fa-database"></i> Apenas Banco (${resultado.ojsApenasBanco.length})
          </h4>
          <div style="max-height: 250px; overflow-y: auto;">
            ${resultado.ojsApenasBanco.length > 0 ? 
    '<ul style="margin: 0; padding-left: 20px; color: #666;">' +
              resultado.ojsApenasBanco.map(oj => `<li style="margin: 5px 0;">${oj}</li>`).join('') +
              '</ul>' : 
    '<p style="color: #999; font-style: italic;">Nenhum OJ apenas no banco</p>'
}
          </div>
        </div>
      </div>
      
      <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e9ecef;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            ${resultado.ojsApenasLocal.length > 0 ? 
    `<button onclick="app.sincronizarOJsParaBanco('${resultado.cpf}')" 
                style="padding: 10px 20px; background: #17a2b8; color: white; 
                       border: none; border-radius: 5px; cursor: pointer; margin-right: 10px;">
                <i class="fas fa-cloud-upload-alt"></i> Enviar OJs Locais para Banco
              </button>` : ''
}
            ${resultado.ojsApenasBanco.length > 0 ? 
    `<button onclick="app.sincronizarOJsDosBanco('${resultado.cpf}')" 
                style="padding: 10px 20px; background: #28a745; color: white; 
                       border: none; border-radius: 5px; cursor: pointer;">
                <i class="fas fa-cloud-download-alt"></i> Buscar OJs do Banco
              </button>` : ''
}
          </div>
          <button onclick="document.getElementById('modal-comparacao-ojs').remove()" 
                  style="padding: 10px 20px; background: #6c757d; color: white; 
                         border: none; border-radius: 5px; cursor: pointer;">
            Fechar
          </button>
        </div>
      </div>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // Fechar ao clicar fora
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  /**
   * Busca e compara OJs do servidor
   */
  async buscarECompararOJs(cpf) {
    try {
      // Buscar servidor local
      const servidoresLocais = await window.electronAPI.loadData('servidores.json') || [];
      const servidorLocal = servidoresLocais.find(s => 
        s.cpf.replace(/\D/g, '') === cpf.replace(/\D/g, '')
      );
      
      if (!servidorLocal) {
        this.showNotification('Servidor não encontrado nos dados locais', 'warning');
        return;
      }
      
      // Buscar servidor no banco
      const grauRadio = document.querySelector('input[name="grauServidor"]:checked');
      const grau = grauRadio ? grauRadio.value : '1';
      
      const response = await window.electronAPI.buscarServidores(grau, cpf, '', 'todos', '');
      
      if (!response.success || !response.data || response.data.length === 0) {
        this.showNotification('Servidor não encontrado no banco de dados', 'warning');
        return;
      }
      
      const servidorBanco = response.data[0];
      
      // Comparar OJs
      const resultado = await this.compararOJsServidorComBanco(servidorLocal, servidorBanco);
      
      // Exibir modal com resultado
      this.exibirModalComparacaoOJs(resultado);
      
    } catch (error) {
      console.error('Erro ao comparar OJs:', error);
      this.showNotification('Erro ao comparar OJs: ' + error.message, 'error');
    }
  }

  /**
   * Compara OJs do servidor local com os do banco de dados
   */
  async compararOJsServidorComBanco(servidorLocal, servidorBanco) {
    console.log('🔍 Comparando OJs:', {
      servidorLocal,
      servidorBanco,
      ojsLocais: servidorLocal.ojs || servidorLocal.localizacoes,
      ojsBanco: servidorBanco.ojs
    });
    
    // Extrair os nomes dos OJs do servidor do banco
    let ojsBancoNomes = [];
    if (servidorBanco.ojs && Array.isArray(servidorBanco.ojs)) {
      ojsBancoNomes = servidorBanco.ojs.map(oj => {
        // Se for objeto com propriedade orgaoJulgador
        if (typeof oj === 'object' && oj.orgaoJulgador) {
          return oj.orgaoJulgador;
        }
        // Se for string direta
        return oj;
      }).filter(oj => oj); // Remove valores vazios
    }
    
    console.log('📋 OJs extraídos do banco:', ojsBancoNomes);
    console.log('📋 OJs locais:', servidorLocal.ojs || servidorLocal.localizacoes || []);
    
    const resultado = {
      nome: servidorBanco.nome || servidorLocal.nome,
      cpf: servidorLocal.cpf,
      ojsLocais: servidorLocal.ojs || servidorLocal.localizacoes || [],
      ojsBanco: ojsBancoNomes,
      ojsApenasLocal: [],
      ojsApenasBanco: [],
      ojsComuns: [],
      percentualSincronizado: 0
    };

    // Normalizar nomes para comparação - melhorada para lidar com variações
    const normalizarNome = (nome) => {
      const normalizado = nome.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-z0-9\s]/g, '') // Remove caracteres especiais
        .trim();
      
      // Remover "1ª", "2ª", etc. quando houver apenas "Vara do Trabalho" sem numeração
      // para permitir match entre "Vara do Trabalho de X" e "1ª Vara do Trabalho de X"
      return normalizado;
    };
    
    // Função auxiliar para verificar se os OJs são equivalentes
    const ojsEquivalentes = (oj1, oj2) => {
      const norm1 = normalizarNome(oj1);
      const norm2 = normalizarNome(oj2);
      
      // Comparação exata primeiro
      if (norm1 === norm2) return true;
      
      // Verificar se um tem numeração e outro não (ex: "1ª Vara" vs "Vara")
      // Para casos onde há apenas uma vara na cidade
      const semNumero1 = norm1.replace(/^\d+[aª°]?\s*/, '');
      const semNumero2 = norm2.replace(/^\d+[aª°]?\s*/, '');
      
      // Se removendo números ficam iguais, verificar se é caso de vara única
      if (semNumero1 === semNumero2) {
        // Verificar se um não tem número (vara única) e outro tem "1ª"
        const temNumero1 = /^\d+[aª°]?\s+vara/.test(norm1);
        const temNumero2 = /^\d+[aª°]?\s+vara/.test(norm2);
        
        if (!temNumero1 && temNumero2 && norm2.startsWith('1')) {
          return true; // "Vara do Trabalho" equivale a "1ª Vara do Trabalho"
        }
        if (!temNumero2 && temNumero1 && norm1.startsWith('1')) {
          return true; // "1ª Vara do Trabalho" equivale a "Vara do Trabalho"
        }
      }
      
      return false;
    };

    // Identificar OJs apenas locais (não estão no banco)
    resultado.ojsApenasLocal = resultado.ojsLocais.filter(ojLocal => {
      const temNoBanco = resultado.ojsBanco.some(ojBanco => ojsEquivalentes(ojLocal, ojBanco));
      if (!temNoBanco) {
        console.log(`📍 OJ apenas local: "${ojLocal}"`);
      }
      return !temNoBanco;
    });

    // Identificar OJs apenas no banco (não estão localmente)
    resultado.ojsApenasBanco = resultado.ojsBanco.filter(ojBanco => {
      const temLocal = resultado.ojsLocais.some(ojLocal => ojsEquivalentes(ojLocal, ojBanco));
      if (!temLocal) {
        console.log(`🏛️ OJ apenas no banco: "${ojBanco}"`);
      }
      return !temLocal;
    });

    // Identificar OJs comuns
    resultado.ojsComuns = resultado.ojsLocais.filter(ojLocal => {
      const temNoBanco = resultado.ojsBanco.some(ojBanco => {
        if (ojsEquivalentes(ojLocal, ojBanco)) {
          console.log(`✅ OJ equivalente encontrado: "${ojLocal}" ≈ "${ojBanco}"`);
          return true;
        }
        return false;
      });
      return temNoBanco;
    });

    // Calcular percentual de sincronização
    const totalUnico = new Set([...resultado.ojsLocais, ...resultado.ojsBanco]).size;
    if (totalUnico > 0) {
      resultado.percentualSincronizado = Math.round((resultado.ojsComuns.length / totalUnico) * 100);
    }

    return resultado;
  }

  /**
   * Busca servidores do banco PJE com filtros por nome/CPF e perfil
   */
  async buscarServidores(autoSearch = false) {
    try {
      // Obter grau selecionado
      const grauRadio = document.querySelector('input[name="grauServidor"]:checked');
      const grau = grauRadio ? grauRadio.value : '1';
      
      // Obter status selecionado
      const statusRadio = document.querySelector('input[name="statusVinculo"]:checked');
      const filtroStatus = statusRadio ? statusRadio.value : 'ativos';
      
      // Obter filtros
      let filtroNome = document.getElementById('filtroNomeServidor').value.trim();
      const filtroPerfil = ''; // Campo perfil removido da interface
      const filtroCidade = document.getElementById('filtroCidadeServidor')?.value.trim() || '';
      
      // Se o filtroNome parece ser um CPF formatado, remover formatação para busca
      if (filtroNome && /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(filtroNome)) {
        filtroNome = filtroNome.replace(/\D/g, ''); // Remove pontos e hífen
      }
      
      // Log para debug
      console.log('🔍 [DEBUG] Radio grau selecionado:', grauRadio);
      console.log('🔍 [DEBUG] Valor do grau extraído:', grau);
      console.log('🔍 [DEBUG] Radio status selecionado:', statusRadio);
      console.log('🔍 [DEBUG] Status dos vínculos:', filtroStatus);
      console.log('🔍 [DEBUG] Filtro cidade:', filtroCidade);
      console.log('🔍 [DEBUG] Todos os radios grau:', document.querySelectorAll('input[name="grauServidor"]'));
      console.log('🔍 [DEBUG] Todos os radios status:', document.querySelectorAll('input[name="statusVinculo"]'));

      // Validação: deve ter pelo menos nome/CPF preenchido
      if (!filtroNome) {
        if (!autoSearch) {
          this.showNotification('Preencha o campo Nome/CPF para buscar', 'warning');
        }
        return;
      }

      // Desabilitar botão de exportar durante a busca
      const exportBtn = document.getElementById('exportarServidores');
      if (exportBtn) {
        exportBtn.disabled = true;
      }

      // Mostrar status de carregamento
      const statusDiv = document.getElementById('statusServidores');
      const resultadoDiv = document.getElementById('resultadoServidores');

      if (statusDiv) {
        statusDiv.classList.remove('hidden');
        const statusSpan = statusDiv.querySelector('span');
        if (statusSpan) {
          statusSpan.textContent = `Buscando servidores do ${grau}º grau...`;
        }
      }

      if (resultadoDiv) {
        resultadoDiv.classList.add('hidden');
      }

      console.log(`🔍 Buscando servidores ${grau}º grau - Nome/CPF: "${filtroNome}", Status: "${filtroStatus}", Cidade: "${filtroCidade}"`);
      console.log('🔍 [FRONTEND DEBUG] Parâmetros antes do envio:');
      console.log(`📋 [FRONTEND DEBUG] grau: "${grau}" (tipo: ${typeof grau})`);
      console.log(`📋 [FRONTEND DEBUG] filtroNome: "${filtroNome}" (tipo: ${typeof filtroNome})`);
      console.log(`📋 [FRONTEND DEBUG] filtroPerfil: "${filtroPerfil}" (tipo: ${typeof filtroPerfil})`);
      console.log(`📋 [FRONTEND DEBUG] filtroStatus: "${filtroStatus}" (tipo: ${typeof filtroStatus})`);
      console.log(`📋 [FRONTEND DEBUG] filtroCidade: "${filtroCidade}" (tipo: ${typeof filtroCidade})`);

      // Fazer busca no banco
      const response = await window.electronAPI.buscarServidores(grau, filtroNome, filtroPerfil, filtroStatus, filtroCidade);

      // Esconder status de carregamento
      if (statusDiv) {
        statusDiv.classList.add('hidden');
      }

      if (response.success) {
        const servidores = response.data || [];

        console.log(`✅ Encontrados ${servidores.length} servidores do ${grau}º grau`);

        // Armazenar dados para exportação e filtro local
        this.servidoresData = servidores;
        this.ultimoGrauBuscado = grau;
        
        // Verificar se há servidor único para comparação
        const btnComparar = document.getElementById('compararServidorLocal');
        if (btnComparar) {
          // Mostrar botão se houver resultado e for busca por CPF específico
          const isCPF = /^\d+$/.test(filtroNome);
          if (servidores.length > 0 && isCPF) {
            // Armazenar primeiro servidor para comparação
            this.ultimoServidorBuscado = servidores[0];
            
            // Verificar se existe servidor local com esse CPF
            try {
              const servidoresLocais = await window.electronAPI.loadData('servidores.json') || [];
              const servidorLocal = servidoresLocais.find(s => 
                s.cpf.replace(/\D/g, '') === filtroNome.replace(/\D/g, '')
              );
              
              if (servidorLocal) {
                btnComparar.style.display = 'inline-block';
                btnComparar.innerHTML = `<i class="fas fa-sync-alt"></i> Comparar com Local (${servidorLocal.ojs?.length || servidorLocal.localizacoes?.length || 0} OJs)`;
              } else {
                btnComparar.style.display = 'none';
              }
            } catch (error) {
              console.log('Erro ao verificar servidor local:', error);
              btnComparar.style.display = 'none';
            }
          } else if (servidores.length === 1) {
            // Se houver apenas um resultado, também permitir comparação
            this.ultimoServidorBuscado = servidores[0];
            
            try {
              const servidoresLocais = await window.electronAPI.loadData('servidores.json') || [];
              const servidorLocal = servidoresLocais.find(s => 
                s.cpf.replace(/\D/g, '') === servidores[0].cpf.replace(/\D/g, '')
              );
              
              if (servidorLocal) {
                btnComparar.style.display = 'inline-block';
                btnComparar.innerHTML = `<i class="fas fa-sync-alt"></i> Comparar com Local (${servidorLocal.ojs?.length || servidorLocal.localizacoes?.length || 0} OJs)`;
              } else {
                btnComparar.style.display = 'none';
              }
            } catch (error) {
              console.log('Erro ao verificar servidor local:', error);
              btnComparar.style.display = 'none';
            }
          } else {
            btnComparar.style.display = 'none';
          }
        }

        // Renderizar tabela de servidores
        this.renderizarTabelaServidores(servidores, grau);

        // Mostrar resultado e habilitar exportação
        if (resultadoDiv) {
          resultadoDiv.classList.remove('hidden');
        }
        if (exportBtn) {
          exportBtn.disabled = servidores.length === 0;
        }

        // Calcular contagem de OJs únicos para notificação
        const uniqueOJs = new Set();
        const uniqueUsers = new Set();
        
        servidores.forEach(servidor => {
          try {
            // Adicionar usuário único por CPF
            if (servidor.cpf) {
              uniqueUsers.add(servidor.cpf);
            }
            
            // Processar OJs do servidor (nova estrutura)
            if (servidor.ojs && Array.isArray(servidor.ojs)) {
              servidor.ojs.forEach(vincolo => {
                if (vincolo && vincolo.orgaoJulgador && vincolo.orgaoJulgador.trim()) {
                  uniqueOJs.add(vincolo.orgaoJulgador.trim());
                }
              });
            }
            
          } catch (error) {
            console.warn('Erro ao processar dados do servidor:', servidor.nome || servidor.cpf, error);
          }
        });
        
        const ojCount = uniqueOJs.size;
        const userCount = uniqueUsers.size;
        
        // Debug da contagem na busca principal
        console.log(`🔍 [BUSCA DEBUG] Total de servidores retornados: ${servidores.length}`);
        console.log(`🔍 [BUSCA DEBUG] Total de vínculos: ${servidores.reduce((total, s) => total + (s.ojs ? s.ojs.length : 0), 0)}`);
        console.log(`🔍 [BUSCA DEBUG] OJs únicos: ${ojCount}`);
        console.log(`🔍 [BUSCA DEBUG] Usuários únicos: ${userCount}`);
        
        if (userCount === 0) {
          this.showNotification('Nenhum usuário encontrado com os filtros especificados', 'info');
        } else {
          this.showNotification(`${ojCount} órgão(s) julgador(es) e ${userCount} usuário(s) encontrado(s)`, 'success');
        }

      } else {
        throw new Error(response.error || 'Erro na busca de servidores');
      }

    } catch (error) {
      console.error('❌ Erro ao buscar servidores:', error);

      // Esconder status de carregamento
      const statusServidores = document.getElementById('statusServidores');
      if (statusServidores) {
        statusServidores.classList.add('hidden');
      }

      this.showNotification(`Erro ao buscar servidores: ${error.message}`, 'error');
    }
  }

  /**
   * Renderiza tabela de servidores
   */
  renderizarTabelaServidores(servidores, grau) {
    const resultContainer = document.getElementById('resultadoServidores');
    if (!resultContainer) {
      console.error('Container de resultados não encontrado');
      return;
    }

    // Filtro por cidade agora é aplicado no backend (database level)
    const servidoresFiltrados = servidores;

    const headerInfo = resultContainer.querySelector('.results-header h3');
    const countSpan = resultContainer.querySelector('.results-count');

    // Atualizar cabeçalho com verificações de segurança
    if (headerInfo) {
      headerInfo.textContent = `Servidores - ${grau}º Grau`;
    }
    // Debug detalhado antes da contagem
    console.log('🔍 [DEBUG CONTAGEM] Total de registros:', servidoresFiltrados.length);
    if (servidoresFiltrados.length > 0) {
      console.log('🔍 [DEBUG CONTAGEM] Primeiro registro completo:', servidoresFiltrados[0]);
      console.log('🔍 [DEBUG CONTAGEM] Campos disponíveis:', Object.keys(servidoresFiltrados[0]));
    }
    
    // Calcular contagem de OJs únicos
    const uniqueOJs = new Set();
    const uniqueUsers = new Set();
    
    servidoresFiltrados.forEach((servidor, index) => {
      try {
        // Debug para cada servidor
        if (index < 5) {  // Mostrar apenas os primeiros 5 para não poluir console
          console.log(`🔍 [DEBUG] Servidor ${index}:`, {
            nome: servidor.nome,
            cpf: servidor.cpf,
            totalOJs: servidor.ojs ? servidor.ojs.length : 0
          });
        }
        
        // Adicionar usuário único por CPF
        if (servidor.cpf) {
          uniqueUsers.add(servidor.cpf);
        }
        
        // Processar OJs do servidor (nova estrutura)
        if (servidor.ojs && Array.isArray(servidor.ojs)) {
          servidor.ojs.forEach(vincolo => {
            if (vincolo && vincolo.orgaoJulgador && vincolo.orgaoJulgador.trim()) {
              uniqueOJs.add(vincolo.orgaoJulgador.trim());
            }
          });
        }
        
      } catch (error) {
        console.warn('Erro ao processar dados do servidor:', servidor.nome || servidor.cpf, error);
      }
    });
    
    const ojCount = uniqueOJs.size;
    const userCount = uniqueUsers.size;
    
    // Debug da contagem
    console.log(`🔍 [CONTAGEM DEBUG] Total de servidores processados: ${servidoresFiltrados.length}`);
    console.log(`🔍 [CONTAGEM DEBUG] Total de vínculos (rows do banco): ${servidoresFiltrados.reduce((total, s) => total + (s.ojs ? s.ojs.length : 0), 0)}`);
    console.log(`🔍 [CONTAGEM DEBUG] OJs únicos encontrados: ${ojCount}`);
    console.log(`🔍 [CONTAGEM DEBUG] Usuários únicos: ${userCount}`);
    console.log('🔍 [CONTAGEM DEBUG] Lista de OJs únicos:', Array.from(uniqueOJs).slice(0, 10));
    
    // Atualizar métricas na nova interface
    try {
      const countOjsElement = resultContainer.querySelector('#countOjsVinculados');
      const countServidoresElement = resultContainer.querySelector('#countServidores');
      
      if (countOjsElement) {
        countOjsElement.textContent = ojCount;
      }
      if (countServidoresElement) {
        countServidoresElement.textContent = userCount;
      }
      
      // Atualizar estatísticas do header
      const totalOjsDisplay = document.getElementById('totalOjsDisplay');
      const totalUsuariosDisplay = document.getElementById('totalUsuariosDisplay');
      
      if (totalOjsDisplay) {
        totalOjsDisplay.textContent = ojCount;
      }
      if (totalUsuariosDisplay) {
        totalUsuariosDisplay.textContent = userCount;
      }
    } catch (error) {
      console.warn('Erro ao atualizar elementos da interface:', error);
    }
    
    // Manter compatibilidade com elementos antigos (fallback)
    if (countSpan && !resultContainer.querySelector('.results-metrics')) {
      countSpan.textContent = `${ojCount} órgão(s) julgador(es) encontrado(s)`;
    } else if (countSpan) {
      countSpan.textContent = `${userCount} servidor(es) encontrado(s)`;
    }

    // Usar a tabela existente no HTML sem modificar o cabeçalho
    const tabelaExistente = resultContainer.querySelector('.data-table');
    if (tabelaExistente) {
      // Manter o cabeçalho original sem adicionar botão inline
      const thOrgao = tabelaExistente.querySelector('thead th:nth-child(4)');
      if (thOrgao && !thOrgao.querySelector('.copy-all-btn')) {
        // Adicionar botão de forma mais elegante ao lado do título
        thOrgao.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span>Órgão Julgador</span>
            <button class="copy-all-btn-small" onclick="window.app.copiarTodosOrgaos()" title="Copiar todos os órgãos julgadores">
              <i class="fas fa-copy"></i>
            </button>
          </div>`;
      }
    }

    const tbody = document.getElementById('tabelaServidores');
    if (tbody) {
      tbody.innerHTML = ''; // Limpar conteúdo existente
    }

    // Obter o filtro para destacar o campo pesquisado
    const filtroNome = document.getElementById('filtroNomeServidor').value.trim();
    const buscandoPorCPF = /^\d+$/.test(filtroNome);

    servidoresFiltrados.forEach((servidor, index) => {
      // Debug geral para os primeiros registros
      if (index < 3) {
        console.log(`🔍 [DEBUG] Servidor ${index}:`, {
          nome: servidor.nome,
          cpf: servidor.cpf,
          totalOJs: servidor.ojs ? servidor.ojs.length : 0,
          primeiroOJ: servidor.ojs && servidor.ojs[0] ? servidor.ojs[0] : null
        });
      }
      
      // Debug detalhado para verificar estrutura dos dados
      if (servidor.cpf && servidor.cpf === '53036140697') {
        console.log('🔍 [DEBUG] Dados completos do servidor Marcelo:', servidor);
        console.log('🔍 [DEBUG] OJs do Marcelo:', servidor.ojs);
        if (servidor.ojs && servidor.ojs[0]) {
          console.log('🔍 [DEBUG] Primeiro OJ:', servidor.ojs[0]);
          console.log('🔍 [DEBUG] Propriedades do OJ:', Object.keys(servidor.ojs[0]));
        }
      }
      
      // Renderizar cada vínculo (OJ) como uma linha separada
      if (servidor.ojs && servidor.ojs.length > 0) {
        servidor.ojs.forEach((vinculous, vincIndex) => {
          const row = tbody.insertRow();
          row.className = 'servidor-row';
          
          // Nome
          const cellNome = row.insertCell();
          cellNome.textContent = servidor.nome || '-';
          cellNome.className = buscandoPorCPF ? 'font-bold text-primary' : 'text-left';
          
          // CPF
          const cellCpf = row.insertCell();
          cellCpf.textContent = servidor.cpf || '-';
          cellCpf.className = !buscandoPorCPF ? 'font-bold text-primary' : 'text-left';

          // Perfil
          const cellPerfil = row.insertCell();
          cellPerfil.textContent = vinculous.perfil || 'Não informado';
          cellPerfil.className = 'text-left';
          
          // Órgão Julgador  
          const cellOrgao = row.insertCell();
          cellOrgao.textContent = vinculous.orgaoJulgador || 'Não informado';
          cellOrgao.className = 'text-left orgao-cell';
          
          // Cidade
          const cellCidade = row.insertCell();
          cellCidade.textContent = vinculous.cidade || 'Outros';
          cellCidade.className = 'text-left';
          
          // Data de Início
          const cellData = row.insertCell();
          cellData.textContent = vinculous.dataInicio || 'Não informado';
          cellData.className = 'text-center';
        });
      } else {
        // Caso não tenha OJs, mostrar linha com dados básicos
        const row = tbody.insertRow();
        row.className = 'servidor-row';
        
        // Nome
        const cellNome = row.insertCell();
        cellNome.textContent = servidor.nome || '-';
        cellNome.className = buscandoPorCPF ? 'font-bold text-primary' : 'text-left';
        
        // CPF
        const cellCpf = row.insertCell();
        cellCpf.textContent = servidor.cpf || '-';
        cellCpf.className = !buscandoPorCPF ? 'font-bold text-primary' : 'text-left';

        // Perfil
        const cellPerfil = row.insertCell();
        cellPerfil.textContent = 'Não informado';
        cellPerfil.className = 'text-left';
        
        // Órgão Julgador  
        const cellOrgao = row.insertCell();
        cellOrgao.textContent = 'Não informado';
        cellOrgao.className = 'text-left orgao-cell';
        
        // Cidade
        const cellCidade = row.insertCell();
        cellCidade.textContent = 'Não informado';
        cellCidade.className = 'text-left';
        
        // Data de Início
        const cellData = row.insertCell();
        cellData.textContent = 'Não informado';
        cellData.className = 'text-center';
      }
    });
  }


  /**
   * Função auxiliar para ordenação natural de órgãos julgadores
   */
  ordenarOrgaosNatural(a, b) {
    // Extrair números e texto para ordenação natural
    const extrairPartes = (str) => {
      // Regex para capturar número ordinal (1ª, 2º, etc) ou números simples
      const match = str.match(/^(\d+)[ªº]?\s+(.+)$/);
      if (match) {
        return {
          numero: parseInt(match[1]),
          texto: match[2]
        };
      }
      return {
        numero: 0,
        texto: str
      };
    };
    
    const parteA = extrairPartes(a);
    const parteB = extrairPartes(b);
    
    // Se ambos têm números no início, comparar numericamente primeiro
    if (parteA.numero > 0 && parteB.numero > 0) {
      // Se o texto depois do número é igual, ordenar por número
      if (parteA.texto === parteB.texto) {
        return parteA.numero - parteB.numero;
      }
    }
    
    // Caso contrário, usar ordenação alfabética natural com localização pt-BR
    return a.localeCompare(b, 'pt-BR', { 
      numeric: true, 
      sensitivity: 'base' 
    });
  }

  /**
   * Copia todos os órgãos julgadores únicos da tabela para a área de transferência
   */
  copiarTodosOrgaos() {
    try {
      // Coletar todos os OJs únicos da tabela atual
      const orgaoCells = document.querySelectorAll('#tabelaServidores .orgao-cell');
      const orgaosUnicos = new Set();
      
      orgaoCells.forEach(cell => {
        const texto = cell.textContent.trim();
        if (texto && texto !== 'Não informado') {
          orgaosUnicos.add(texto);
        }
      });
      
      if (orgaosUnicos.size === 0) {
        this.showNotification('Nenhum órgão julgador encontrado na tabela', 'warning');
        return;
      }
      
      // Converter para array e ordenar com ordenação natural
      const orgaosOrdenados = Array.from(orgaosUnicos).sort((a, b) => this.ordenarOrgaosNatural(a, b));
      
      // Criar texto para copiar (um OJ por linha)
      const textoParaCopiar = orgaosOrdenados.join('\n');
      
      // Copiar para clipboard
      if (navigator.clipboard && window.isSecureContext) {
        // Método moderno (async)
        navigator.clipboard.writeText(textoParaCopiar)
          .then(() => {
            this.showNotification(`${orgaosOrdenados.length} órgão(s) julgador(es) copiado(s) para a área de transferência`, 'success');
          })
          .catch(err => {
            console.error('Erro ao copiar:', err);
            this.fallbackCopyToClipboard(textoParaCopiar, orgaosOrdenados.length);
          });
      } else {
        // Fallback para browsers antigos
        this.fallbackCopyToClipboard(textoParaCopiar, orgaosOrdenados.length);
      }
      
    } catch (error) {
      console.error('Erro ao copiar órgãos:', error);
      this.showNotification('Erro ao copiar órgãos julgadores', 'error');
    }
  }

  /**
   * Método fallback para copiar texto quando clipboard API não está disponível
   */
  fallbackCopyToClipboard(text, count) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        this.showNotification(`${count} órgão(s) julgador(es) copiado(s) para a área de transferência`, 'success');
      } else {
        this.showNotification('Não foi possível copiar os órgãos', 'error');
      }
    } catch (err) {
      console.error('Erro no fallback de cópia:', err);
      this.showNotification('Erro ao copiar órgãos julgadores', 'error');
    }
    
    document.body.removeChild(textArea);
  }

  /**
   * Limpa filtros de servidores
   */
  limparFiltrosServidores() {
    const filtroNome = document.getElementById('filtroNomeServidor');
    if (filtroNome) {
      filtroNome.value = '';
    }

    const filtroCidade = document.getElementById('filtroCidadeServidor');
    if (filtroCidade) {
      filtroCidade.value = '';
    }

    // Limpar resultados
    const resultadoDiv = document.getElementById('resultadoServidores');
    if (resultadoDiv) {
      resultadoDiv.classList.add('hidden');
    }

    // Desabilitar botão de exportar
    const exportBtn = document.getElementById('exportarServidores');
    if (exportBtn) {
      exportBtn.disabled = true;
    }



    // Limpar dados armazenados
    this.servidoresData = [];

    this.showNotification('Filtros limpos', 'info');
  }

  /**
   * Atualiza filtros baseado no grau selecionado
   */
  atualizarFiltroGrau() {
    // Obter grau selecionado
    const grauSelecionado = document.querySelector('input[name="grauServidor"]:checked');
    
    if (!grauSelecionado) {
      console.warn('Nenhum grau selecionado');
      return;
    }

    const grau = grauSelecionado.value;
    console.log(`🔄 Atualizando filtros para ${grau}º grau`);

    // Limpar resultados anteriores
    this.limparResultadosOJs();
    this.limparResultadosServidores();

    // Atualizar interface baseado no grau
    this.atualizarInterfacePorGrau(grau);

    // Notificar mudança
    this.showNotification(`Filtros atualizados para ${grau}º grau`, 'info');
  }

  /**
   * Limpa resultados de OJs de ambos os graus
   */
  limparResultadosOJs() {
    ['1', '2'].forEach(grau => {
      const resultadoDiv = document.getElementById(`resultadoOjs${grau}Grau`);
      const statusDiv = document.getElementById(`statusOjs${grau}Grau`);
      const exportBtn = document.getElementById(`exportarOjs${grau}Grau`);
      const filtroInput = document.getElementById(`filtroOjs${grau}Grau`);

      if (resultadoDiv) resultadoDiv.classList.add('hidden');
      if (statusDiv) statusDiv.classList.add('hidden');
      if (exportBtn) exportBtn.disabled = true;
      if (filtroInput) filtroInput.value = '';
    });
  }

  /**
   * Limpa resultados de servidores
   */
  limparResultadosServidores() {
    const resultadoDiv = document.getElementById('resultadoServidores');
    const filtroInput = document.getElementById('filtroNomeServidor');

    if (resultadoDiv) resultadoDiv.classList.add('hidden');
    if (filtroInput) filtroInput.value = '';

    // Limpar dados armazenados
    this.servidoresData = [];

    // Desabilitar botão de exportar
    const exportBtn = document.getElementById('exportarServidores');
    if (exportBtn) {
      exportBtn.disabled = true;
    }
  }

  /**
   * Atualiza interface baseado no grau selecionado
   */
  atualizarInterfacePorGrau(grau) {
    // Aqui você pode adicionar lógica específica para cada grau
    // Por exemplo, mostrar/ocultar campos específicos, alterar placeholders, etc.
    
    console.log(`🎯 Interface atualizada para ${grau}º grau`);
    
    // Exemplo: atualizar placeholders dos filtros
    const filtroOJ = document.getElementById(`filtroOjs${grau}Grau`);
    if (filtroOJ) {
      filtroOJ.placeholder = `Digite parte do nome do órgão (${grau}º grau)...`;
    }

    const filtroServidor = document.getElementById('filtroNomeServidor');
    if (filtroServidor) {
      filtroServidor.placeholder = `Digite CPF ou nome do servidor (${grau}º grau)`;
    }
  }

  /**
   * Busca TODAS as OJs do banco de dados (sem limite)
   */
  async buscarTodasOJsDoBanco(grau) {
    const statusId = `statusOjs${grau}Grau`;
    const resultadoId = `resultadoOjs${grau}Grau`;
    const tabelaId = `tabelaOjs${grau}Grau`;
    const countId = `countOjs${grau}Grau`;
    const exportBtnId = `exportarOjs${grau}Grau`;

    // Obter apenas filtro (ignorar limite)
    const filtro = document.getElementById(`filtroOjs${grau}Grau`).value.trim();

    // Mostrar status de carregamento
    document.getElementById(statusId).classList.remove('hidden');
    document.getElementById(resultadoId).classList.add('hidden');
    document.getElementById(exportBtnId).disabled = true;

    try {
      console.log(`🔍 Buscando TODAS as OJs ${grau}º grau no banco de dados...`);

      // Usar limite 0 para buscar todas
      const response = grau === '1'
        ? await window.electronAPI.buscarOJs1Grau(filtro, 0)
        : await window.electronAPI.buscarOJs2Grau(filtro, 0);

      if (response.success) {
        // Usar todos os registros retornados, sem exclusões
        const ojs = response.data;

        // Armazenar dados para exportação
        if (grau === '1') {
          this.ojsData1Grau = ojs;
        } else {
          this.ojsData2Grau = ojs;
        }

        // Renderizar tabela
        this.renderizarTabelaOJsBanco(tabelaId, ojs);

        // Atualizar contador
        document.getElementById(countId).textContent = ojs.length;

        // Esconder status de carregamento e mostrar resultados
        document.getElementById(statusId).classList.add('hidden');
        document.getElementById(resultadoId).classList.remove('hidden');
        document.getElementById(exportBtnId).disabled = false;

        console.log(`✅ ${ojs.length} OJs ${grau}º grau encontrados no banco (TODAS)`);

        this.showNotification(`✅ ${ojs.length} OJs ${grau}º grau carregados com sucesso`, 'success');

      } else {
        throw new Error(response.error || 'Erro desconhecido');
      }

    } catch (error) {
      console.error(`❌ Erro ao buscar TODAS as OJs ${grau}º grau:`, error);

      // Esconder status de carregamento
      document.getElementById(statusId).classList.add('hidden');

      // Mostrar mensagem de erro
      this.showNotification(`Erro ao carregar TODAS as OJs ${grau}º grau: ${error.message}`, 'error');
    }
  }

  // Método para configurar os listeners das funcionalidades da Central de Configurações
  setupConfigurationListeners() {
    // Cache Management
    const clearCacheBtn = document.querySelector('#clearCacheButton, .control-card .btn-premium[onclick*="clearCache"]');
    if (clearCacheBtn) {
      clearCacheBtn.addEventListener('click', () => this.clearCache());
    }
    
    // Backup and Restore
    const exportBackupBtn = document.querySelector('#exportBackupButton, .control-card .btn-premium.secondary');
    if (exportBackupBtn) {
      exportBackupBtn.addEventListener('click', () => this.exportBackup());
    }
    
    const restoreBackupBtn = document.querySelector('#restoreBackupButton, .control-card .btn-premium.outline');
    if (restoreBackupBtn) {
      restoreBackupBtn.addEventListener('click', () => this.restoreBackup());
    }
    
    // System Logs
    const viewLogsBtn = document.querySelector('#viewLogsButton, .logs-preview .btn-premium');
    if (viewLogsBtn) {
      viewLogsBtn.addEventListener('click', () => this.viewSystemLogs());
    }
    
    // Performance monitoring
    this.startPerformanceMonitoring();
    
    // Update cache size
    this.updateCacheInfo();
  }
  
  // Cache Management Functions
  async clearCache() {
    try {
      const result = await window.electronAPI.clearCache();
      if (result.success) {
        this.addStatusMessage('success', 'Cache limpo com sucesso');
        this.updateCacheInfo();
      } else {
        this.addStatusMessage('error', `Erro ao limpar cache: ${result.message}`);
      }
    } catch (error) {
      this.addStatusMessage('error', `Erro ao limpar cache: ${error.message}`);
    }
  }

  async exportBackup() {
    try {
      const result = await window.electronAPI.exportBackup();
      if (result.success) {
        this.addStatusMessage('success', `Backup exportado: ${result.filePath}`);
      } else {
        this.addStatusMessage('error', `Erro ao exportar backup: ${result.message}`);
      }
    } catch (error) {
      this.addStatusMessage('error', `Erro ao exportar backup: ${error.message}`);
    }
  }

  async restoreBackup() {
    try {
      const result = await window.electronAPI.restoreBackup();
      if (result.success) {
        this.addStatusMessage('success', 'Backup restaurado com sucesso');
        // Recarregar dados
        await this.loadPeritos();
        await this.loadServidores();
      } else {
        this.addStatusMessage('error', `Erro ao restaurar backup: ${result.message}`);
      }
    } catch (error) {
      this.addStatusMessage('error', `Erro ao restaurar backup: ${error.message}`);
    }
  }

  async viewSystemLogs() {
    try {
      const result = await window.electronAPI.getSystemLogs();
      if (result.success) {
        this.displaySystemLogs(result.logs);
      } else {
        this.addStatusMessage('error', `Erro ao carregar logs: ${result.message}`);
      }
    } catch (error) {
      this.addStatusMessage('error', `Erro ao carregar logs: ${error.message}`);
    }
  }

  displaySystemLogs(logs) {
    // Implementar exibição de logs
    console.log('System logs:', logs);
  }

  startPerformanceMonitoring() {
    // Implementar monitoramento de performance
    console.log('Performance monitoring started');
  }

  updateCacheInfo() {
    // Implementar atualização de informações de cache
    console.log('Cache info updated');
  }

  // ===== MÉTODOS PARA VERIFICAÇÃO DE MÚLTIPLOS SERVIDORES =====
  
  setupMultiServidorEventListeners() {
    // Botão para verificar servidores
    document.getElementById('verificarServidores')?.addEventListener('click', () => {
      this.verificarMultiplosServidores();
    });

    // Botão para limpar dados
    document.getElementById('limparServidores')?.addEventListener('click', () => {
      this.limparDadosServidores();
    });

    // Botão para importar arquivo JSON
    document.getElementById('importarServidoresJSON')?.addEventListener('click', () => {
      this.importarServidoresJSON();
    });

    // Botão para mostrar formato JSON esperado
    document.getElementById('mostrarFormato')?.addEventListener('click', () => {
      this.mostrarFormatoJSON();
    });

    // Botão para exportar resultados
    document.getElementById('exportarResultados')?.addEventListener('click', () => {
      this.exportarResultadosParaServidores();
    });

    // Botão para exportar resultados de verificação (antigo)
    document.getElementById('exportarResultadosVerificacao')?.addEventListener('click', () => {
      this.exportarResultadosVerificacao();
    });

    // Botão para verificar vínculos de servidores
    document.getElementById('verificarVinculosServidores')?.addEventListener('click', () => {
      this.verificarVinculosServidores();
    });

    // Botão para mostrar formato JSON de servidores
    document.getElementById('showServidoresJsonFormat')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.showServidoresJsonFormatHelp();
    });
  }

  async verificarMultiplosServidores() {
    const textarea = document.getElementById('servidoresTextarea');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    try {
      // Validar entrada
      const jsonText = textarea.value.trim();
      if (!jsonText) {
        this.showNotification('Por favor, insira a lista de servidores em formato JSON.', 'warning');
        return;
      }

      let servidores;
      try {
        servidores = JSON.parse(jsonText);
      } catch (error) {
        this.showNotification('Formato JSON inválido. Verifique a sintaxe.', 'error');
        return;
      }

      if (!Array.isArray(servidores)) {
        this.showNotification('O JSON deve conter um array de servidores.', 'error');
        return;
      }

      if (servidores.length === 0) {
        this.showNotification('A lista de servidores está vazia.', 'warning');
        return;
      }

      // Validar campos obrigatórios do novo formato
      for (let i = 0; i < servidores.length; i++) {
        const servidor = servidores[i];
        
        // Validar campos obrigatórios: nome, cpf, perfil, ojs
        if (!servidor.nome || typeof servidor.nome !== 'string' || servidor.nome.trim() === '') {
          this.showNotification(`Servidor ${i + 1}: Campo 'nome' é obrigatório e deve ser uma string não vazia`, 'error');
          return;
        }
        
        if (!servidor.cpf || typeof servidor.cpf !== 'string' || servidor.cpf.trim() === '') {
          this.showNotification(`Servidor ${i + 1}: Campo 'cpf' é obrigatório e deve ser uma string não vazia`, 'error');
          return;
        }
        
        if (!servidor.perfil || typeof servidor.perfil !== 'string' || servidor.perfil.trim() === '') {
          this.showNotification(`Servidor ${i + 1}: Campo 'perfil' é obrigatório e deve ser uma string não vazia`, 'error');
          return;
        }
        
        // Aceitar tanto 'ojs' quanto 'localizacoes' para compatibilidade
        const ojs = servidor.ojs || servidor.localizacoes;
        if (!ojs || !Array.isArray(ojs) || ojs.length === 0) {
          this.showNotification(`Servidor ${i + 1}: Campo 'ojs' deve ser um array não vazio`, 'error');
          return;
        }
        
        // Validar que todos os OJs são strings não vazias
        for (let j = 0; j < ojs.length; j++) {
          if (!ojs[j] || typeof ojs[j] !== 'string' || ojs[j].trim() === '') {
            this.showNotification(`Servidor ${i + 1}, OJ ${j + 1}: Deve ser uma string não vazia`, 'error');
            return;
          }
        }
        
        // Normalizar para sempre usar 'ojs'
        if (!servidor.ojs && servidor.localizacoes) {
          servidor.ojs = servidor.localizacoes;
        }
        
        // Remover campos não necessários (email, cidade) se existirem
        if (servidor.email) {
          delete servidor.email;
        }
        if (servidor.cidade) {
          delete servidor.cidade;
        }
      }

      // Mostrar seção de progresso
      progressContainer.style.display = 'block';
      progressBar.style.width = '0%';
      progressText.textContent = 'Iniciando verificação...';

      const total = servidores.length;
      let processados = 0;
      const resultados = [];

      // Verificar TODOS os servidores (cadastrados e não cadastrados)
      progressText.textContent = 'Verificando OJs de todos os servidores...';
      const servidoresComOJsFaltantes = [];
      
      for (let i = 0; i < servidores.length; i++) {
        const servidor = servidores[i];
        try {
          progressText.textContent = `Verificando OJs ${i + 1}/${total}: ${servidor.nome}`;
          progressBar.style.width = `${(i / total) * 100}%`;

          const resultado = await this.verificarServidor(servidor);
          resultados.push(resultado);

          // Se o servidor tem OJs faltantes, adicionar à lista para automação
          if (resultado.status === 'incompleto' || resultado.status === 'nao_cadastrado') {
            // Para servidores não cadastrados, incluir todos os OJs
            // Para servidores cadastrados, incluir apenas os OJs faltantes
            const ojsParaAutomacao = resultado.status === 'nao_cadastrado' 
              ? servidor.ojs || servidor.localizacoes || []
              : resultado.detalhes?.ojsFaltantes || [];
            
            if (ojsParaAutomacao.length > 0) {
              servidoresComOJsFaltantes.push({
                nome: servidor.nome,
                cpf: servidor.cpf,
                perfil: servidor.perfil,
                ojs: ojsParaAutomacao,
                motivo: resultado.status === 'nao_cadastrado' ? 'Servidor não cadastrado' : 'OJs faltantes'
              });
            }
          }

          processados++;

          // Pequena pausa para não sobrecarregar
          await new Promise(resolve => setTimeout(resolve, 50));

        } catch (error) {
          console.error('Erro ao verificar servidor:', error);
          resultados.push({
            servidor,
            erro: error.message,
            status: 'erro'
          });
          processados++;
        }
      }
      
      // Gerar arquivo de servidores com OJs faltantes se houver algum
      if (servidoresComOJsFaltantes.length > 0) {
        await this.gerarArquivoServidoresFaltantes(servidoresComOJsFaltantes);
        this.showNotification(
          `${servidoresComOJsFaltantes.length} servidor(es) com OJs faltantes. Arquivo de automação gerado!`,
          'info'
        );
      }

      // Exibir resultados
      this.exibirResultadosVerificacao(resultados);
      progressText.textContent = 'Verificação concluída!';
      progressBar.style.width = '100%';
      
      // Mostrar notificação de conclusão
      const incompletos = resultados.filter(r => r.status === 'incompleto').length;
      const mensagens = [];
      
      if (servidoresFaltantes.length > 0) {
        mensagens.push(`${servidoresFaltantes.length} servidor(es) não cadastrado(s)`);
      }
      
      if (incompletos > 0) {
        mensagens.push(`${incompletos} servidor(es) com OJs faltantes`);
      }
      
      if (mensagens.length > 0) {
        this.showNotification(
          `Verificação concluída! ${mensagens.join(', ')}.`,
          'warning'
        );
      } else {
        this.showNotification('Verificação concluída! Todos os servidores cadastrados estão completos.', 'success');
      }

    } catch (error) {
      console.error('Erro na verificação:', error);
      this.showNotification('Erro durante a verificação: ' + error.message, 'error');
      if (progressContainer) progressContainer.style.display = 'none';
    }
  }

  /**
   * Gera arquivo JSON com servidores faltantes para automação
   * @param {Array} servidoresFaltantes - Lista de servidores não cadastrados
   */
  async gerarArquivoServidoresFaltantes(servidoresFaltantes) {
    try {
      // Preparar dados para automação (formato original)
      const dadosParaAutomacao = servidoresFaltantes.map(servidor => ({
        nome: servidor.nome,
        cpf: servidor.cpf,
        perfil: servidor.perfil,
        ojs: servidor.ojs
      }));

      // Criar conteúdo do arquivo
      const conteudoArquivo = JSON.stringify(dadosParaAutomacao, null, 2);
      
      // Gerar nome do arquivo com timestamp
      const agora = new Date();
      const timestamp = agora.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const nomeArquivo = `servidores-faltantes-${timestamp}.json`;
      
      // Criar e baixar arquivo
      const blob = new Blob([conteudoArquivo], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = nomeArquivo;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      console.log(`📁 Arquivo gerado: ${nomeArquivo} com ${servidoresFaltantes.length} servidor(es)`);
      
      // Mostrar informações no console para debug
      console.log('📋 Servidores faltantes:', dadosParaAutomacao);
      
    } catch (error) {
      console.error('❌ Erro ao gerar arquivo de servidores faltantes:', error);
      this.showNotification('Erro ao gerar arquivo de automação: ' + error.message, 'error');
    }
  }

  async verificarVinculosServidores() {
    console.log('verificarVinculosServidores chamada');
    const textarea = document.getElementById('servidoresVinculosTextarea');
    const progressSection = document.getElementById('progressoVerificacao');
    const resultsSection = document.getElementById('resultadoVerificacaoServidores');
    
    console.log('Elementos encontrados:', {
      textarea: !!textarea,
      progressSection: !!progressSection,
      resultsSection: !!resultsSection
    });
    
    try {
      // Validar entrada
      const jsonText = textarea.value.trim();
      console.log('JSON text:', jsonText);
      if (!jsonText) {
        this.showNotification('Por favor, insira a lista de servidores em formato JSON.', 'warning');
        return;
      }

      let servidores;
      try {
        servidores = JSON.parse(jsonText);
      } catch (error) {
        this.showNotification('Formato JSON inválido. Verifique a sintaxe.', 'error');
        return;
      }

      if (!Array.isArray(servidores)) {
        this.showNotification('O JSON deve conter um array de servidores.', 'error');
        return;
      }
      
      // Validar e normalizar dados antes de processar
      const validacao = await this.validarENormalizarServidores(servidores);
      
      if (!validacao.sucesso) {
        // Mostrar modal de correção
        await this.mostrarModalCorrecao(validacao);
        return;
      }
      
      // Usar servidores validados e normalizados
      servidores = validacao.servidoresCorrigidos;

      // Mostrar seção de progresso
      progressSection.style.display = 'block';
      resultsSection.innerHTML = '';

      const progressBar = document.getElementById('progressBar');
      const progressText = document.getElementById('progressText');
      
      progressText.textContent = 'Iniciando verificação de vínculos...';
      progressBar.style.width = '0%';

      // Processar servidores
      const resultados = [];
      const total = servidores.length;
      let processados = 0;

      for (const servidor of servidores) {
        try {
          progressText.textContent = `Verificando vínculos: ${servidor.nome || 'Servidor'} (${processados + 1}/${total})`;
          
          const resultado = await this.verificarServidor(servidor);
          resultados.push(resultado);
          processados++;

          // Atualizar barra de progresso
          progressBar.style.width = `${(processados / total) * 100}%`;

          // Pequena pausa para não sobrecarregar
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.error('Erro ao verificar servidor:', error);
          resultados.push({
            servidor,
            erro: error.message,
            status: 'erro'
          });
          processados++;
        }
      }

      // Exibir resultados
      this.exibirResultadosVerificacao(resultados);
      progressText.textContent = 'Verificação de vínculos concluída!';

    } catch (error) {
      console.error('Erro na verificação de vínculos:', error);
      this.showNotification('Erro durante a verificação de vínculos: ' + error.message, 'error');
    }
  }

  async carregarOrgaosPJE() {
    try {
      // Tentar carregar o arquivo orgaos_pje.json
      const response = await fetch('./orgaos_pje.json');
      if (response.ok) {
        const orgaosPorCidade = await response.json();
        // Converter o objeto em array de todos os órgãos
        const todosOrgaos = [];
        for (const cidade in orgaosPorCidade) {
          todosOrgaos.push(...orgaosPorCidade[cidade]);
        }
        return todosOrgaos;
      }
    } catch (error) {
      console.log('Não foi possível carregar orgaos_pje.json, usando lista vazia');
    }
    // Retornar array vazio se não conseguir carregar
    return [];
  }

  async verificarServidor(servidor) {
    try {
      // Carregar lista completa de órgãos julgadores do sistema
      const orgaosCompletos = await this.carregarOrgaosPJE();
      
      // OJs que o servidor deveria ter (vindos do JSON importado)
      // Aceitar tanto 'ojs' quanto 'localizacoes' para compatibilidade
      const ojsEsperados = servidor.ojs || servidor.localizacoes || [];
      
      console.log('🔍 Verificando servidor:', servidor.nome, 'CPF:', servidor.cpf);
      console.log('📋 OJs esperados (do JSON importado):', ojsEsperados);
      
      // Buscar servidor no banco de dados PJE real
      let ojsCadastrados = [];
      let servidorBanco = null;
      
      try {
        // Limpar CPF para busca
        const cpfLimpo = servidor.cpf.replace(/\D/g, '');
        
        console.log('🔍 Iniciando busca no banco PJE para CPF:', cpfLimpo);
        
        // Buscar OJs do servidor usando a nova API específica com a query SQL fornecida
        const response = await window.electronAPI.buscarOJsServidor(cpfLimpo, '1');
        
        console.log('🔍 Resposta completa da busca no banco:', JSON.stringify(response, null, 2));
        
        if (response.success && response.data && response.data.length > 0) {
          // Encontrou OJs do servidor no banco
          servidorBanco = { encontrado: true, nome: servidor.nome };
          
          // Extrair apenas os nomes dos OJs
          ojsCadastrados = response.data.map(oj => oj.orgaoJulgador);
          
          console.log('✅ Servidor encontrado no banco PJE');
          console.log('📋 OJs cadastrados no banco (apenas vínculos ativos):', ojsCadastrados);
          console.log('📊 Total de OJs ativos no banco:', ojsCadastrados.length);
        } else {
          console.log('❌ Servidor não possui OJs ativos cadastrados no banco PJE ou erro na conexão');
          console.log('📋 Detalhes da resposta:', JSON.stringify(response, null, 2));
          
          // Verificar se é erro de conexão
          if (!response.success) {
            console.log('🚨 ATENÇÃO: Erro na conexão com banco PJE - usando fallback local');
            console.log('🔧 Verifique as configurações do banco em database.config.js');
          }
        }
      } catch (error) {
        console.log('⚠️ Erro ao buscar OJs do servidor no banco:', error.message);
        console.log('🚨 ATENÇÃO: Falha na comunicação com banco PJE - usando fallback local');
        console.log('🔧 Verifique as configurações do banco em database.config.js');
        
        // Se der erro na busca do banco, tentar buscar no arquivo local como fallback
        const servidoresExistentes = await window.electronAPI.loadData('servidores.json') || [];
        const servidorExistente = servidoresExistentes.find(s => s.cpf === servidor.cpf);
        if (servidorExistente) {
          ojsCadastrados = servidorExistente.ojs || servidorExistente.localizacoes || [];
          console.log('📂 Usando dados locais como fallback');
        }
      }
      
      // Normalizar nomes dos OJs para comparação
      const normalizarNome = (nome) => {
        const normalizado = nome.toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remove acentos
          .replace(/[^a-z0-9\s]/g, '') // Remove caracteres especiais
          .trim();
        return normalizado;
      };
      
      // Função para converter números por extenso para numérico
      const converterNumeroExtenso = (texto) => {
        const mapeamento = {
          'primeira': '1',
          'segundo': '2', 'segunda': '2',
          'terceiro': '3', 'terceira': '3',
          'quarto': '4', 'quarta': '4',
          'quinto': '5', 'quinta': '5',
          'sexto': '6', 'sexta': '6',
          'setimo': '7', 'setima': '7',
          'oitavo': '8', 'oitava': '8',
          'nono': '9', 'nona': '9',
          'decimo': '10', 'decima': '10'
        };
        
        let resultado = texto;
        for (const [extenso, numerico] of Object.entries(mapeamento)) {
          const regex = new RegExp(`\\b${extenso}\\b`, 'gi');
          resultado = resultado.replace(regex, numerico);
        }
        
        return resultado;
      };

      // Função auxiliar para verificar se os OJs são equivalentes (VERSÃO CORRIGIDA)
      const ojsEquivalentes = (oj1, oj2) => {
        // Normalizar ambos os nomes
        let norm1 = normalizarNome(oj1);
        let norm2 = normalizarNome(oj2);
        
        // Converter números por extenso
        norm1 = converterNumeroExtenso(norm1);
        norm2 = converterNumeroExtenso(norm2);
        
        // Comparação exata primeiro
        if (norm1 === norm2) return true;
        
        // Padronizar variações comuns
        const padronizarVariacoes = (texto) => {
          return texto
            // Padronizar preposições
            .replace(/\bda\b/g, 'de')
            .replace(/\bdo\b/g, 'de')
            .replace(/\bdos\b/g, 'de')
            .replace(/\bdas\b/g, 'de')
            // Padronizar "e" vs "e da/de"
            .replace(/\be da\b/g, 'e')
            .replace(/\be de\b/g, 'e')
            // Remover hífens e espaços extras
            .replace(/\s*-\s*/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        };
        
        const norm1Padronizado = padronizarVariacoes(norm1);
        const norm2Padronizado = padronizarVariacoes(norm2);
        
        // Comparação após padronização
        if (norm1Padronizado === norm2Padronizado) return true;
        
        // Extrair componentes principais para comparação mais flexível
        const extrairComponentes = (texto) => {
          const componentes = {
            tipo: '', // vara, juizado, divisao, etc.
            numero: '', // 1, 2, 3, etc.
            especialidade: '', // trabalho, infancia, execucao, etc.
            cidade: '' // franca, sao jose dos campos, limeira, etc.
          };
          
          // Extrair número
          const matchNumero = texto.match(/\b(\d+)\b/);
          if (matchNumero) {
            componentes.numero = matchNumero[1];
          }
          
          // Extrair tipo
          if (texto.includes('vara')) componentes.tipo = 'vara';
          else if (texto.includes('juizado')) componentes.tipo = 'juizado';
          else if (texto.includes('divisao')) componentes.tipo = 'divisao';
          else if (texto.includes('tribunal')) componentes.tipo = 'tribunal';
          else if (texto.includes('foro')) componentes.tipo = 'foro';
          
          // Extrair especialidade
          if (texto.includes('trabalho')) componentes.especialidade = 'trabalho';
          else if (texto.includes('infancia')) componentes.especialidade = 'infancia';
          else if (texto.includes('execucao')) componentes.especialidade = 'execucao';
          else if (texto.includes('civel')) componentes.especialidade = 'civel';
          else if (texto.includes('criminal')) componentes.especialidade = 'criminal';
          
          // Extrair cidade (capturar após o último "de")
          // Para padrões como "vara de trabalho de sao jose de campos"
          // Precisamos pegar tudo após o "de" que vem depois da especialidade
          if (componentes.especialidade) {
            // Procurar por " de " após a especialidade
            const especialidadeIndex = texto.indexOf(componentes.especialidade);
            if (especialidadeIndex !== -1) {
              const textoAposEspecialidade = texto.substring(especialidadeIndex + componentes.especialidade.length);
              const deIndex = textoAposEspecialidade.indexOf(' de ');
              if (deIndex !== -1) {
                componentes.cidade = textoAposEspecialidade.substring(deIndex + 4).trim();
              } else {
                componentes.cidade = texto.trim();
              }
            } else {
              componentes.cidade = texto.trim();
            }
          } else {
            // Se não tem especialidade, usar a última ocorrência de " de "
            const ultimoDeIndex = texto.lastIndexOf(' de ');
            if (ultimoDeIndex !== -1) {
              componentes.cidade = texto.substring(ultimoDeIndex + 4).trim();
            } else {
              // Se não tem padrão específico, pode ser só a cidade
              componentes.cidade = texto.trim();
            }
          }
          
          return componentes;
        };
        
        const comp1 = extrairComponentes(norm1Padronizado);
        const comp2 = extrairComponentes(norm2Padronizado);
        
        // Comparar componentes
        const tipoMatch = comp1.tipo === comp2.tipo;
        const numeroMatch = !comp1.numero || !comp2.numero || comp1.numero === comp2.numero;
        const especialidadeMatch = !comp1.especialidade || !comp2.especialidade || comp1.especialidade === comp2.especialidade;
        const cidadeMatch = comp1.cidade === comp2.cidade || 
                           comp1.cidade.includes(comp2.cidade) || 
                           comp2.cidade.includes(comp1.cidade);
        
        // Se ambos têm cidade definida e são diferentes, não pode ser match
        if (comp1.cidade && comp2.cidade && !cidadeMatch) {
          return false;
        }
        
        // Considerar match se a maioria dos componentes coincidirem
        const matches = [tipoMatch, numeroMatch, especialidadeMatch, cidadeMatch];
        const matchCount = matches.filter(Boolean).length;
        
        // Exigir pelo menos 3 de 4 componentes para considerar match
        return matchCount >= 3;
      };
      
      // Identificar OJs faltantes (esperados mas não cadastrados)
      const ojsFaltantes = ojsEsperados.filter(ojEsperado => 
        !ojsCadastrados.some(ojCadastrado => ojsEquivalentes(ojEsperado, ojCadastrado))
      );
      
      // Identificar OJs extras (cadastrados mas não esperados)
      const ojsExtras = ojsCadastrados.filter(ojCadastrado => 
        !ojsEsperados.some(ojEsperado => ojsEquivalentes(ojCadastrado, ojEsperado))
      );
      
      // Identificar OJs corretos (esperados e cadastrados)
      const ojsCorretos = ojsCadastrados.filter(ojCadastrado => 
        ojsEsperados.some(ojEsperado => ojsEquivalentes(ojCadastrado, ojEsperado))
      );
      
      // Log detalhado da comparação
      console.log('📊 Resultado da comparação:');
      console.log('   ✅ OJs corretos (já cadastrados):', ojsCorretos);
      console.log('   ❌ OJs faltantes (precisam ser cadastrados):', ojsFaltantes);
      console.log('   ⚠️ OJs extras (cadastrados mas não esperados):', ojsExtras);
      
      // Determinar status baseado nos dados do banco
      let status = 'completo';
      if (ojsFaltantes.length > 0) {
        status = 'incompleto';
      }
      // Servidor é considerado não cadastrado apenas se não foi encontrado no banco
      if (!servidorBanco && ojsCadastrados.length === 0) {
        status = 'nao_cadastrado';
      }
      
      return {
        servidor,
        status,
        timestamp: new Date().toISOString(),
        detalhes: {
          cpf: servidor.cpf,
          nome: servidorBanco ? servidorBanco.nome : servidor.nome,
          perfil: servidor.perfil || servidorBanco?.perfil || 'Não informado',
          ojsEsperados,
          ojsCadastrados,
          ojsCorretos,
          ojsFaltantes,
          ojsExtras,
          totalEsperado: ojsEsperados.length,
          totalCadastrado: ojsCadastrados.length,
          totalCorreto: ojsCorretos.length,
          totalFaltante: ojsFaltantes.length,
          totalExtra: ojsExtras.length,
          percentualCompleto: ojsEsperados.length > 0 
            ? Math.round((ojsCorretos.length / ojsEsperados.length) * 100) 
            : 0,
          encontradoNoBanco: !!servidorBanco
        }
      };
    } catch (error) {
      console.error('Erro ao verificar servidor:', error);
      return {
        servidor,
        status: 'erro',
        erro: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  exibirResultadosVerificacao(resultados) {
    const resultsSection = document.getElementById('resultadosContainer');
    
    // Contar estatísticas
    const completos = resultados.filter(r => r.status === 'completo').length;
    const incompletos = resultados.filter(r => r.status === 'incompleto').length;
    const naoCadastrados = resultados.filter(r => r.status === 'nao_cadastrado').length;
    const erros = resultados.filter(r => r.status === 'erro').length;

    // Calcular totais de OJs
    const totalOjsFaltantes = resultados.reduce((sum, r) => 
      sum + (r.detalhes?.totalFaltante || 0), 0);
    const totalServidoresComPendencias = resultados.filter(r => r.detalhes?.totalFaltante > 0).length;

    let html = `
      <div class="resultado-resumo">
        <h3>📊 Resumo da Verificação de OJs Faltantes</h3>
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0; font-size: 18px;">
            <strong>Total de OJs que precisam ser cadastrados:</strong> 
            <span style="color: #dc3545; font-size: 24px; font-weight: bold;">${totalOjsFaltantes}</span>
          </p>
          <p style="margin: 5px 0;">
            <strong>Servidores com pendências:</strong> ${totalServidoresComPendencias} de ${resultados.length}
          </p>
        </div>
      </div>

      <div class="resultado-detalhes" style="margin-top: 30px;">
        <h3>📋 Detalhes por Servidor</h3>
        <div class="servidores-lista">
    `;

    // Processar e exibir cada resultado
    resultados.forEach((resultado) => {
      const servidor = resultado.servidor;
      const detalhes = resultado.detalhes || {};
      
      // Só mostrar servidores com OJs faltantes
      if (!detalhes.ojsFaltantes || detalhes.ojsFaltantes.length === 0) {
        return; // Pular servidores que estão completos
      }
      
      html += `
        <div class="servidor-item" style="border: 1px solid #dc3545; border-radius: 8px; padding: 15px; margin-bottom: 15px; background: #fff5f5;">
          <div class="servidor-header" style="margin-bottom: 10px;">
            <span class="servidor-nome" style="font-weight: bold; font-size: 16px; color: #333;">${servidor.nome || 'Nome não informado'}</span>
          </div>
          <div class="servidor-info" style="color: #666;">
            <p style="margin: 5px 0;"><strong>CPF:</strong> ${servidor.cpf || 'Não informado'}</p>
            <p style="margin: 5px 0;"><strong>Perfil:</strong> ${detalhes.perfil || 'Não informado'}</p>
            
            ${detalhes.ojsFaltantes && detalhes.ojsFaltantes.length > 0 ? `
              <div style="margin-top: 10px;">
                <strong style="color: #dc3545;">OJs Faltantes (${detalhes.ojsFaltantes.length}):</strong>
                <ul style="margin: 5px 0; padding-left: 20px; color: #dc3545;">
                  ${detalhes.ojsFaltantes.map(oj => `<li>${oj}</li>`).join('')}
                </ul>
              </div>
            ` : resultado.status === 'completo' ? `
              <div style="margin-top: 10px; color: #28a745;">
                <strong>✅ Todos os OJs do JSON já estão cadastrados no banco!</strong>
              </div>
            ` : ''}
            
            ${resultado.erro ? `<p style="color: #dc3545; margin-top: 10px;"><strong>Erro:</strong> ${resultado.erro}</p>` : ''}
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    // Adicionar botões de ação se houver pendências
    if (totalOjsFaltantes > 0) {
      html += `
        <div style="margin-top: 20px; text-align: center;">
          <button onclick="app.enviarParaSecaoServidores()" 
                  class="btn btn-success" 
                  style="padding: 10px 20px; font-size: 16px; margin-right: 10px;">
            <i class="fas fa-paper-plane"></i> Enviar para Seção Servidores
          </button>
          <button onclick="app.exportarServidoresComPendencias()" 
                  class="btn btn-warning" 
                  style="padding: 10px 20px; font-size: 16px;">
            <i class="fas fa-download"></i> Exportar JSON
          </button>
        </div>
        <div style="margin-top: 10px; text-align: center;">
          <label style="font-size: 14px;">
            <input type="checkbox" id="autoEnviarServidores" checked> 
            Enviar automaticamente para Seção Servidores após verificação
          </label>
        </div>
      `;
    }

    resultsSection.innerHTML = html;
    resultsSection.style.display = 'block';
    
    // Armazenar resultados para exportação posterior
    resultsSection.dataset.ultimaVerificacao = JSON.stringify({
      timestamp: new Date().toISOString(),
      servidores: resultados.map(r => ({
        nome: r.servidor.nome,
        cpf: r.servidor.cpf,
        perfil: r.detalhes?.perfil || r.servidor.perfil,
        status: r.status,
        ojsFaltantes: r.detalhes?.ojsFaltantes || []
      }))
    });
    
    // Habilitar botão de exportação
    const btnExportar = document.getElementById('exportarResultados');
    if (btnExportar) {
      btnExportar.disabled = false;
    }
    
    // Esconder barra de progresso
    const progressContainer = document.getElementById('progressContainer');
    if (progressContainer) {
      progressContainer.style.display = 'none';
    }
    
    // Envio automático se houver pendências e checkbox estiver marcada
    const totalFaltantesAuto = resultados.reduce((sum, r) => 
      sum + (r.detalhes?.totalFaltante || 0), 0);
      
    if (totalFaltantesAuto > 0) {
      // Pequeno delay para garantir que a interface foi renderizada
      setTimeout(() => {
        const autoEnviar = document.getElementById('autoEnviarServidores');
        if (autoEnviar && autoEnviar.checked) {
          console.log('📤 Enviando automaticamente para seção Servidores...');
          this.enviarParaSecaoServidores();
        }
      }, 500);
    }
  }

  async enviarParaSecaoServidores() {
    try {
      const resultsSection = document.getElementById('resultadosContainer');
      if (!resultsSection || !resultsSection.dataset.ultimaVerificacao) {
        this.showNotification('Nenhum resultado de verificação disponível', 'warning');
        return;
      }
      
      const verificacao = JSON.parse(resultsSection.dataset.ultimaVerificacao);
      
      // Filtrar apenas servidores com OJs faltantes
      const servidoresComPendencias = verificacao.servidores.filter(s => 
        s.ojsFaltantes && s.ojsFaltantes.length > 0
      );
      
      if (servidoresComPendencias.length === 0) {
        this.showNotification('Nenhum servidor com OJs faltantes para enviar', 'info');
        return;
      }
      
      // Carregar servidores atuais
      const servidoresAtuais = await window.electronAPI.loadData('servidores.json') || [];
      
      let servidoresAdicionados = 0;
      let servidoresAtualizados = 0;
      
      // Processar cada servidor com pendências
      servidoresComPendencias.forEach(servidorPendente => {
        // Procurar se o servidor já existe
        const indexExistente = servidoresAtuais.findIndex(s => 
          s.cpf.replace(/\D/g, '') === servidorPendente.cpf.replace(/\D/g, '')
        );
        
        if (indexExistente >= 0) {
          // Atualizar servidor existente - adicionar apenas OJs faltantes
          const servidorExistente = servidoresAtuais[indexExistente];
          const ojsExistentes = servidorExistente.localizacoes || servidorExistente.ojs || [];
          
          // Adicionar apenas OJs que ainda não estão na lista
          const novosOJs = servidorPendente.ojsFaltantes.filter(oj => 
            !ojsExistentes.includes(oj)
          );
          
          if (novosOJs.length > 0) {
            // Atualizar todos os campos para compatibilidade com automação
            servidorExistente.orgaos = [...ojsExistentes, ...novosOJs]; // Campo para automação
            servidorExistente.ojs = [...ojsExistentes, ...novosOJs];
            servidorExistente.localizacoes = [...ojsExistentes, ...novosOJs];
            servidoresAtualizados++;
          }
        } else {
          // Adicionar novo servidor com formato compatível com automação
          const novoServidor = {
            nome: servidorPendente.nome,
            cpf: servidorPendente.cpf,
            perfil: servidorPendente.perfil || 'Servidor',
            orgaos: servidorPendente.ojsFaltantes, // Campo esperado pelo backend de automação
            ojs: servidorPendente.ojsFaltantes, // Campo alternativo
            localizacoes: servidorPendente.ojsFaltantes // Campo para compatibilidade de exibição
          };
          servidoresAtuais.push(novoServidor);
          servidoresAdicionados++;
        }
      });
      
      // Salvar servidores atualizados
      await window.electronAPI.saveData('servidores.json', servidoresAtuais);
      
      // Mudar para a aba de Servidores
      this.switchTab('servidores');
      
      // Recarregar a lista de servidores
      await this.loadServidores();
      
      // Notificar resultado
      const mensagem = `✅ ${servidoresAdicionados} servidor(es) adicionado(s) e ${servidoresAtualizados} atualizado(s) na seção Servidores`;
      this.showNotification(mensagem, 'success');
      
    } catch (error) {
      console.error('Erro ao enviar para seção Servidores:', error);
      this.showNotification('Erro ao enviar dados: ' + error.message, 'error');
    }
  }

  exportarServidoresComPendencias() {
    try {
      const resultsSection = document.getElementById('resultadosContainer');
      if (!resultsSection || !resultsSection.dataset.ultimaVerificacao) {
        this.showNotification('Nenhum resultado de verificação disponível para exportar', 'warning');
        return;
      }
      
      const verificacao = JSON.parse(resultsSection.dataset.ultimaVerificacao);
      
      // Filtrar apenas servidores com OJs faltantes
      const servidoresComPendencias = verificacao.servidores.filter(s => 
        s.ojsFaltantes && s.ojsFaltantes.length > 0
      );
      
      if (servidoresComPendencias.length === 0) {
        this.showNotification('Nenhum servidor com OJs faltantes para exportar', 'info');
        return;
      }
      
      // Criar formato para exportação
      const exportData = servidoresComPendencias.map(s => ({
        nome: s.nome,
        cpf: s.cpf,
        perfil: s.perfil,
        ojs: s.ojsFaltantes // Apenas os OJs faltantes
      }));
      
      // Criar blob e download
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `servidores_ojs_faltantes_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showNotification(`${servidoresComPendencias.length} servidor(es) com OJs faltantes exportado(s)`, 'success');
    } catch (error) {
      console.error('Erro ao exportar:', error);
      this.showNotification('Erro ao exportar dados: ' + error.message, 'error');
    }
  }

  limparDadosServidores() {
    const textarea = document.getElementById('servidoresTextarea');
    const progressContainer = document.getElementById('progressContainer');
    const resultadosContainer = document.getElementById('resultadosContainer');
    const btnExportar = document.getElementById('exportarResultados');
    
    if (textarea) textarea.value = '';
    if (progressContainer) progressContainer.style.display = 'none';
    if (resultadosContainer) {
      resultadosContainer.innerHTML = '';
      resultadosContainer.style.display = 'none';
      delete resultadosContainer.dataset.ultimaVerificacao;
    }
    if (btnExportar) btnExportar.disabled = true;
    
    this.showNotification('Dados limpos com sucesso!', 'success');
  }

  importarServidoresJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (event) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            // Primeiro, tentar fazer o parse básico
            let jsonData;
            try {
              jsonData = JSON.parse(e.target.result);
            } catch (parseError) {
              // Se falhar, tentar sanitizar o conteúdo
              console.log('Erro no parse inicial, tentando sanitizar...', parseError.message);
              
              let conteudoSanitizado = e.target.result;
              
              // Remover valores undefined, null, false, números e objetos vazios dos arrays ojs
              conteudoSanitizado = conteudoSanitizado
                .replace(/,\s*undefined/g, '')
                .replace(/undefined\s*,/g, '')
                .replace(/,\s*null/g, '')
                .replace(/null\s*,/g, '')
                .replace(/,\s*false/g, '')
                .replace(/false\s*,/g, '')
                .replace(/,\s*true/g, '')
                .replace(/true\s*,/g, '')
                .replace(/,\s*\d+/g, '')
                .replace(/\d+\s*,/g, '')
                .replace(/,\s*\{\s*\}/g, '')
                .replace(/\{\s*\}\s*,/g, '')
                .replace(/,\s*\[\s*\]/g, '')
                .replace(/\[\s*\]\s*,/g, '')
                // Limpar arrays vazios resultantes
                .replace(/\[\s*,\s*\]/g, '[]')
                .replace(/\[\s*,/g, '[')
                .replace(/,\s*\]/g, ']')
                // Limpar vírgulas duplas
                .replace(/,\s*,/g, ',');
              
              try {
                jsonData = JSON.parse(conteudoSanitizado);
                console.log('Sanitização bem-sucedida!');
              } catch (sanitizeError) {
                throw new Error(`Arquivo JSON inválido. Verifique se contém apenas dados válidos. Erro: ${parseError.message}`);
              }
            }
            
            // Validar e limpar os dados após o parse
            if (!Array.isArray(jsonData)) {
              throw new Error('O arquivo deve conter um array de servidores');
            }
            
            // Sanitizar cada servidor
            const servidoresLimpos = jsonData.map((servidor, index) => {
              if (!servidor || typeof servidor !== 'object') {
                throw new Error(`Servidor ${index + 1}: Deve ser um objeto válido`);
              }
              
              // Garantir campos obrigatórios
              const servidorLimpo = {
                nome: servidor.nome || '',
                cpf: servidor.cpf || '',
                perfil: servidor.perfil || '',
                ojs: []
              };
              
              // Limpar array de OJs
              const ojsOriginais = servidor.ojs || servidor.localizacoes || [];
              if (Array.isArray(ojsOriginais)) {
                servidorLimpo.ojs = ojsOriginais
                  .filter(oj => oj && typeof oj === 'string' && oj.trim() !== '')
                  .map(oj => oj.trim());
              }
              
              return servidorLimpo;
            });
            
            // Verificar se há servidores válidos
            const servidoresValidos = servidoresLimpos.filter(s => s.nome && s.cpf && s.perfil);
            
            if (servidoresValidos.length === 0) {
              throw new Error('Nenhum servidor válido encontrado no arquivo');
            }
            
            // Mostrar estatísticas se houve limpeza
            const totalOriginal = jsonData.length;
            const totalLimpo = servidoresValidos.length;
            
            document.getElementById('servidoresTextarea').value = JSON.stringify(servidoresValidos, null, 2);
            
            let mensagem = 'Arquivo JSON importado com sucesso!';
            if (totalLimpo < totalOriginal) {
              mensagem += ` (${totalLimpo}/${totalOriginal} servidores válidos)`;
            }
            
            this.showNotification(mensagem, 'success');
            
          } catch (error) {
            console.error('Erro na importação:', error);
            this.showNotification('Erro ao importar arquivo JSON: ' + error.message, 'error');
          }
        };
        reader.readAsText(file);
      }
    };
    
    input.click();
  }

  exportarResultadosVerificacao(resultados) {
    if (!resultados || resultados.length === 0) {
      this.showNotification('Nenhum resultado para exportar.', 'warning');
      return;
    }

    const dataExportacao = {
      timestamp: new Date().toISOString(),
      total: resultados.length,
      resumo: {
        ativos: resultados.filter(r => r.status === 'ativo').length,
        inativos: resultados.filter(r => r.status === 'inativo').length,
        erros: resultados.filter(r => r.status === 'erro').length
      },
      resultados
    };

    const blob = new Blob([JSON.stringify(dataExportacao, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `verificacao-servidores-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showNotification('Resultados exportados com sucesso!', 'success');
  }
}

// Classe para gerenciar seletores de órgãos julgadores
class OJSelector {
  constructor(containerId, searchInputId, options = {}) {
    this.container = document.getElementById(containerId);
    this.searchInput = document.getElementById(searchInputId);
    this.options = {
      placeholder: 'Selecione um órgão julgador...',
      searchPlaceholder: 'Digite para buscar...',
      maxHeight: '300px',
      ...options
    };
    
    this.selectedValue = null;
    this.selectedText = null;
    this.isOpen = false;
    this.filteredOptions = [];
    this.highlightedIndex = -1;
    
    this.init();
  }
  
  init() {
    if (!this.container || !this.searchInput) {
      console.error('OJSelector: Container ou input de busca não encontrado');
      return;
    }
    
    this.createStructure();
    this.setupEventListeners();
    this.loadOptions();
  }
  
  createStructure() {
    this.container.innerHTML = `
      <div class="oj-selector-wrapper">
        <div class="oj-selector-display" tabindex="0">
          <span class="oj-selector-text">${this.options.placeholder}</span>
          <span class="oj-selector-arrow">▼</span>
        </div>
        <div class="oj-selector-dropdown" style="display: none; max-height: ${this.options.maxHeight}; overflow-y: auto;">
          <div class="oj-selector-search">
            <input type="text" placeholder="${this.options.searchPlaceholder}" class="oj-search-input">
          </div>
          <div class="oj-selector-options"></div>
        </div>
      </div>
    `;
    
    this.display = this.container.querySelector('.oj-selector-display');
    this.dropdown = this.container.querySelector('.oj-selector-dropdown');
    this.searchInputInternal = this.container.querySelector('.oj-search-input');
    this.optionsContainer = this.container.querySelector('.oj-selector-options');
    this.textElement = this.container.querySelector('.oj-selector-text');
    this.arrowElement = this.container.querySelector('.oj-selector-arrow');
  }
  
  setupEventListeners() {
    // Toggle dropdown
    this.display.addEventListener('click', () => this.toggle());
    this.display.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggle();
      }
    });
    
    // Search functionality
    this.searchInputInternal.addEventListener('input', (e) => {
      this.filterOptions(e.target.value);
    });
    
    this.searchInputInternal.addEventListener('keydown', (e) => {
      this.handleKeyNavigation(e);
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) {
        this.close();
      }
    });
    
    // Sync with external search input
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this.filterOptions(e.target.value);
        this.searchInputInternal.value = e.target.value;
      });
    }
  }
  
  loadOptions() {
    if (!window.ojList || !Array.isArray(window.ojList)) {
      console.warn('OJSelector: Lista de OJs não encontrada');
      return;
    }
    
    this.allOptions = window.ojList.map(oj => ({
      value: oj,
      text: oj,
      searchText: oj.toLowerCase()
    }));
    
    this.filteredOptions = [...this.allOptions];
    this.renderOptions();
  }
  
  filterOptions(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    
    if (!term) {
      this.filteredOptions = [...this.allOptions];
    } else {
      this.filteredOptions = this.allOptions.filter(option => 
        typeof option.searchText === 'string' && option.searchText.includes(term)
      );
    }
    
    this.highlightedIndex = -1;
    this.renderOptions();
  }
  
  renderOptions() {
    if (!this.optionsContainer) return;
    
    if (this.filteredOptions.length === 0) {
      this.optionsContainer.innerHTML = '<div class="oj-option oj-no-results">Nenhum resultado encontrado</div>';
      return;
    }
    
    this.optionsContainer.innerHTML = this.filteredOptions
      .map((option, index) => `
        <div class="oj-option" data-value="${option.value}" data-index="${index}">
          ${option.text}
        </div>
      `)
      .join('');
    
    // Add click listeners to options
    this.optionsContainer.querySelectorAll('.oj-option').forEach((optionEl, index) => {
      if (!optionEl.classList.contains('oj-no-results')) {
        optionEl.addEventListener('click', () => {
          this.selectOption(this.filteredOptions[index]);
        });
        
        optionEl.addEventListener('mouseenter', () => {
          this.highlightedIndex = index;
          this.updateHighlight();
        });
      }
    });
  }
  
  selectOption(option) {
    this.selectedValue = option.value;
    this.selectedText = option.text;
    this.textElement.textContent = option.text;
    this.textElement.title = option.text;
    
    // Update external search input
    if (this.searchInput) {
      this.searchInput.value = option.text;
      this.searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    this.close();
    
    // Dispatch custom event
    this.container.dispatchEvent(new CustomEvent('oj-selected', {
      detail: { value: option.value, text: option.text }
    }));
  }
  
  handleKeyNavigation(e) {
    switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      this.highlightedIndex = Math.min(this.highlightedIndex + 1, this.filteredOptions.length - 1);
      this.updateHighlight();
      break;
        
    case 'ArrowUp':
      e.preventDefault();
      this.highlightedIndex = Math.max(this.highlightedIndex - 1, -1);
      this.updateHighlight();
      break;
        
    case 'Enter':
      e.preventDefault();
      if (this.highlightedIndex >= 0 && this.filteredOptions[this.highlightedIndex]) {
        this.selectOption(this.filteredOptions[this.highlightedIndex]);
      }
      break;
        
    case 'Escape':
      this.close();
      break;
    }
  }
  
  updateHighlight() {
    const options = this.optionsContainer.querySelectorAll('.oj-option:not(.oj-no-results)');
    options.forEach((option, index) => {
      option.classList.toggle('highlighted', index === this.highlightedIndex);
    });
    
    // Scroll highlighted option into view
    if (this.highlightedIndex >= 0 && options[this.highlightedIndex]) {
      options[this.highlightedIndex].scrollIntoView({ block: 'nearest' });
    }
  }
  
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
  
  open() {
    this.isOpen = true;
    this.dropdown.style.display = 'block';
    this.arrowElement.textContent = '▲';
    this.searchInputInternal.focus();
    
    // Reset search
    this.searchInputInternal.value = '';
    this.filterOptions('');
  }
  
  close() {
    this.isOpen = false;
    this.dropdown.style.display = 'none';
    this.arrowElement.textContent = '▼';
    this.highlightedIndex = -1;
  }
  
  setValue(value) {
    const option = this.allOptions.find(opt => opt.value === value);
    if (option) {
      this.selectOption(option);
    }
  }
  
  getValue() {
    return this.selectedValue;
  }
  
  getText() {
    return this.selectedText;
  }
  
  clear() {
    this.selectedValue = null;
    this.selectedText = null;
    this.textElement.textContent = this.options.placeholder;
    this.textElement.title = '';
    
    if (this.searchInput) {
      this.searchInput.value = '';
    }
    
    this.close();
  }
  
  refresh() {
    this.loadOptions();
  }
}

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Iniciando aplicação PJE Automation...');

  try {
    // Criar instância da aplicação
    const app = new PeritoApp();
    // Disponibiliza referências globais esperadas por handlers inline
    window.app = app;
    
    // Tornar acessível globalmente para debugging
    window.peritoApp = app;
    
    // Inicializar a aplicação - IMPORTANTE!
    app.init();
    
    // Verificar banners que devem permanecer escondidos
    app.checkHiddenBanners();

    // Adicionar event listeners para os novos botões de busca
    const buscarTodasOjs1GrauBtn = document.getElementById('buscarTodasOjs1Grau');
    const buscarTodasOjs2GrauBtn = document.getElementById('buscarTodasOjs2Grau');

    if (buscarTodasOjs1GrauBtn) {
      buscarTodasOjs1GrauBtn.addEventListener('click', () => {
        console.log('🔍 Clicado em Buscar Todas OJs 1º Grau');
        app.buscarTodasOJsDoBanco('1');
      });
    }

    if (buscarTodasOjs2GrauBtn) {
      buscarTodasOjs2GrauBtn.addEventListener('click', () => {
        console.log('🔍 Clicado em Buscar Todas OJs 2º Grau');
        app.buscarTodasOJsDoBanco('2');
      });
    }

    // Event listener para limpeza de cache de verificação de OJs
    const limparCacheBtn = document.getElementById('limparCacheOJs');
    if (limparCacheBtn) {
      limparCacheBtn.addEventListener('click', async () => {
        console.log('🧹 Iniciando limpeza de cache de verificação de OJs...');

        // Confirmar ação com o usuário
        const confirmar = confirm(
          'Tem certeza que deseja limpar o cache de verificação de OJs?\n\n' +
          'Esta ação irá:\n' +
          '• Remover todas as verificações salvas de OJs já cadastrados\n' +
          '• Fazer com que o sistema verifique novamente todos os OJs na próxima automação\n\n' +
          'Clique em OK para confirmar ou Cancelar para abortar.'
        );

        if (!confirmar) {
          console.log('🔄 Limpeza de cache cancelada pelo usuário');
          return;
        }

        try {
          // Desabilitar botão durante operação
          limparCacheBtn.disabled = true;
          limparCacheBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Limpando...';

          // Chamar IPC para limpar cache
          const resultado = await window.electronAPI.invoke('limpar-cache-verificacao');

          if (resultado.success) {
            console.log('✅ Cache de verificação limpo com sucesso');
            alert('Cache de verificação limpo com sucesso!\n\nNa próxima automação, o sistema verificará novamente todos os OJs.');
          } else {
            throw new Error(resultado.error || 'Erro desconhecido ao limpar cache');
          }

        } catch (error) {
          console.error('❌ Erro ao limpar cache:', error);
          alert(`Erro ao limpar cache: ${error.message}`);
        } finally {
          // Reabilitar botão
          limparCacheBtn.disabled = false;
          limparCacheBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Limpar Cache de Verificação';
        }
      });
    }

    // Adicionar filtro em tempo real para os campos de busca
    const setupFiltroTempoReal = (grau) => {
      const filtroInput = document.getElementById(`filtroOjs${grau}Grau`);
      if (!filtroInput) return;

      let timeoutId = null;

      // Filtro enquanto digita (com debounce)
      filtroInput.addEventListener('input', function() {
        clearTimeout(timeoutId);
        const valor = this.value.trim();

        // Se campo vazio, não fazer nada
        if (valor === '') return;

        // Filtrar com delay de 500ms para evitar muitas consultas
        timeoutId = setTimeout(() => {
          console.log(`🔍 Filtro em tempo real ${grau}º grau:`, valor);
          app.buscarTodasOJsDoBanco(grau);
        }, 500);
      });

      // Filtro ao pressionar Enter
      filtroInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          clearTimeout(timeoutId);
          console.log(`⏎ Enter pressionado - filtro ${grau}º grau:`, this.value.trim());
          app.buscarTodasOJsDoBanco(grau);
        }
      });
    };

    // Configurar filtro em tempo real para 1º e 2º grau
    setupFiltroTempoReal('1');
    setupFiltroTempoReal('2');

    console.log('✅ Aplicação PJE Automation iniciada com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao inicializar aplicação:', error);
  }
});

/**
 * Função para esconder banner informativo BugFix
 * @param {string} bannerId - ID do banner a ser escondido
 */
PeritoApp.prototype.hideBugfixBanner = function(bannerId) {
  try {
    const banner = document.getElementById(bannerId);
    if (banner) {
      banner.classList.add('hidden');
      console.log(`🔇 Banner ${bannerId} foi fechado pelo usuário`);
      
      // Salvar preferência no localStorage para não mostrar novamente nesta sessão
      const hiddenBanners = JSON.parse(localStorage.getItem('hiddenBugfixBanners') || '[]');
      if (!hiddenBanners.includes(bannerId)) {
        hiddenBanners.push(bannerId);
        localStorage.setItem('hiddenBugfixBanners', JSON.stringify(hiddenBanners));
      }
    }
  } catch (error) {
    console.error('❌ Erro ao esconder banner:', error);
  }
};

/**
 * Função para verificar banners que devem permanecer escondidos
 * Executada no carregamento da página
 */
PeritoApp.prototype.checkHiddenBanners = function() {
  try {
    const hiddenBanners = JSON.parse(localStorage.getItem('hiddenBugfixBanners') || '[]');
    hiddenBanners.forEach(bannerId => {
      const banner = document.getElementById(bannerId);
      if (banner) {
        banner.classList.add('hidden');
        console.log(`🔇 Banner ${bannerId} permanece escondido (preferência salva)`);
      }
    });
  } catch (error) {
    console.error('❌ Erro ao verificar banners escondidos:', error);
  }
};

/**
 * Normaliza nome de OJ para comparação
 * Remove acentos, espaços extras, converte para minúsculas
 * Normaliza hífens e travessões, e trata casos onde o hífen pode estar ausente
 */
PeritoApp.prototype.normalizarNomeOJ = function(nome) {
  if (!nome || typeof nome !== 'string') return '';
  
  let normalizado = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[–—−]/g, '-') // Normaliza travessões para hífen comum
    .replace(/\s*-\s*/g, ' - ') // Normaliza espaços ao redor de hífens
    .replace(/\s+/g, ' ') // Normaliza espaços múltiplos
    .trim();
  
  // Padrão especial: se começa com código (LIQ1, EXE1, DAM, etc.) seguido de espaço e cidade
  // Garantir que sempre tenha hífen entre código e cidade
  const padraoCodigoCidade = /^(liq\d+|exe\d+|dam|con\d+|divex|ccp)\s+(.+)$/;
  if (padraoCodigoCidade.test(normalizado) && !normalizado.includes(' - ')) {
    normalizado = normalizado.replace(padraoCodigoCidade, '$1 - $2');
  }
  
  return normalizado;
};

/**
 * Compara OJs cadastrados com os do usuário consultado
 */
PeritoApp.prototype.compararOJs = function() {
  try {
    const linhasDigitadas = document.getElementById('ojsComparacaoTextarea').value
      .split('\n')
      .map(linha => linha.trim())
      .filter(linha => linha.length > 0);
    
    if (linhasDigitadas.length === 0) {
      this.showNotification('Digite os OJs cadastrados para comparar', 'warning');
      return;
    }
    
    // Obter OJs do usuário consultado da última busca
    if (!this.servidoresData || this.servidoresData.length === 0) {
      this.showNotification('Faça uma busca de usuário primeiro para ter dados para comparar', 'warning');
      return;
    }
    
    // Processar linhas digitadas para separar OJ e perfil
    const itensDigitados = linhasDigitadas.map(linha => {
      // Verificar se tem perfil especificado (após hífen)
      const partes = linha.split(' - ');
      return {
        oj: partes[0].trim(),
        perfil: partes[1] ? partes[1].trim() : null,
        textoCompleto: linha
      };
    });
    
    // Extrair OJs com perfis do usuário consultado
    const vinculosUsuario = [];
    this.servidoresData.forEach(servidor => {
      if (servidor.ojs && Array.isArray(servidor.ojs)) {
        servidor.ojs.forEach(vincolo => {
          if (vincolo && vincolo.orgaoJulgador && vincolo.orgaoJulgador.trim()) {
            vinculosUsuario.push({
              oj: vincolo.orgaoJulgador.trim(),
              perfil: vincolo.perfil ? vincolo.perfil.trim() : null,
              dataInicio: vincolo.dataInicio
            });
          }
        });
      }
    });
    
    console.log('🔍 [COMPARACAO] Itens Digitados:', itensDigitados);
    console.log('🔍 [COMPARACAO] Vínculos do Usuário:', vinculosUsuario);
    
    // Calcular diferenças considerando perfil
    const ojsFaltantes = [];
    const ojsJaVinculados = [];
    const ojsVinculadosComPerfilDiferente = [];
    
    itensDigitados.forEach(item => {
      // Buscar vínculos correspondentes usando normalização
      const nomeOJNormalizado = this.normalizarNomeOJ(item.oj);
      const vinculosCorrespondentes = vinculosUsuario.filter(v => 
        this.normalizarNomeOJ(v.oj) === nomeOJNormalizado
      );
      
      console.log(`🔍 [COMPARACAO] Buscando "${item.oj}" (normalizado: "${nomeOJNormalizado}")`);
      console.log('🔍 [COMPARACAO] Vínculos encontrados:', vinculosCorrespondentes.map(v => `"${v.oj}" (normalizado: "${this.normalizarNomeOJ(v.oj)}")`));
      
      if (vinculosCorrespondentes.length === 0) {
        // OJ não está vinculado de forma alguma
        ojsFaltantes.push(item);
      } else if (item.perfil) {
        // Foi especificado um perfil, verificar se existe
        const temPerfilEspecifico = vinculosCorrespondentes.some(v => 
          v.perfil && v.perfil.toLowerCase() === item.perfil.toLowerCase()
        );
        
        if (temPerfilEspecifico) {
          ojsJaVinculados.push(item);
        } else {
          // OJ está vinculado mas com perfil diferente
          ojsVinculadosComPerfilDiferente.push({
            ...item,
            perfisExistentes: vinculosCorrespondentes.map(v => v.perfil).filter(p => p)
          });
        }
      } else {
        // Não foi especificado perfil, apenas verificar se OJ está vinculado
        ojsJaVinculados.push({
          ...item,
          perfisExistentes: vinculosCorrespondentes.map(v => v.perfil).filter(p => p)
        });
      }
    });
    
    // OJs do Usuário não listados (usando normalização)
    const ojsUsuarioUnicos = [...new Set(vinculosUsuario.map(v => v.oj))];
    const ojsDigitadosNormalizados = [...new Set(itensDigitados.map(i => this.normalizarNomeOJ(i.oj)))];
    const ojsNaoListados = ojsUsuarioUnicos.filter(oj => 
      !ojsDigitadosNormalizados.includes(this.normalizarNomeOJ(oj))
    );
    
    console.log('✅ [COMPARACAO] OJs/Perfis que PRECISAM ser vinculados:', ojsFaltantes);
    console.log('⚠️ [COMPARACAO] OJs com PERFIL DIFERENTE:', ojsVinculadosComPerfilDiferente);
    console.log('🔗 [COMPARACAO] OJs/Perfis que JÁ estão vinculados:', ojsJaVinculados);
    console.log('📋 [COMPARACAO] OJs do usuário não listados:', ojsNaoListados);
    
    // Atualizar interface com os dados corretos
    this.exibirResultadoComparacao(ojsFaltantes, ojsJaVinculados, ojsVinculadosComPerfilDiferente, ojsNaoListados);
    
    // Armazenar para uso posterior
    this.dadosComparacao = {
      ojsFaltantes: [...ojsFaltantes, ...ojsVinculadosComPerfilDiferente], // Incluir perfis diferentes para automação
      ojsJaVinculados,
      ojsVinculadosComPerfilDiferente,
      ojsNaoListados,
      usuarioConsultado: this.servidoresData[0] // Assumir primeiro usuário
    };
    
  } catch (error) {
    console.error('❌ Erro ao comparar OJs:', error);
    this.showNotification('Erro ao comparar OJs: ' + error.message, 'error');
  }
};

/**
 * Exibe os resultados da comparação na interface
 */
PeritoApp.prototype.exibirResultadoComparacao = function(ojsFaltantes, ojsJaVinculados, ojsVinculadosComPerfilDiferente, ojsNaoListados) {
  const resultadoDiv = document.getElementById('resultadoComparacao');
  const listaFaltantes = document.getElementById('listaFaltantes');
  const listaExtras = document.getElementById('listaExtras');
  const countFaltantes = document.getElementById('countFaltantes');
  const countExtras = document.getElementById('countExtras');
  const btnGerarAutomacao = document.getElementById('gerarAutomacaoFaltantes');
  
  // Calcular total de faltantes (incluindo perfis diferentes)
  const totalFaltantes = ojsFaltantes.length + ojsVinculadosComPerfilDiferente.length;
  
  // Atualizar contadores
  countFaltantes.textContent = totalFaltantes;
  countExtras.textContent = ojsJaVinculados.length;
  
  // Atualizar cor dos badges
  countFaltantes.style.background = totalFaltantes > 0 ? '#e74c3c' : '#28a745';
  countExtras.style.background = ojsJaVinculados.length > 0 ? '#28a745' : '#6c757d';
  
  // Mostrar OJs faltantes (que precisam ser adicionados)
  let htmlFaltantes = '';
  
  // OJs completamente faltantes
  if (ojsFaltantes.length > 0) {
    htmlFaltantes += '<div style="margin-bottom: 10px;"><strong style="color: #e74c3c;">🚫 OJs não vinculados:</strong></div>';
    htmlFaltantes += ojsFaltantes
      .map(item => `<div class="oj-item" style="color: #e74c3c;">
        <i class="fas fa-plus-circle"></i> ${item.textoCompleto}
      </div>`)
      .join('');
  }
  
  // OJs com perfil diferente
  if (ojsVinculadosComPerfilDiferente.length > 0) {
    if (ojsFaltantes.length > 0) {
      htmlFaltantes += '<div style="margin-top: 15px; margin-bottom: 10px;"><strong style="color: #f39c12;">⚠️ OJs com perfil diferente:</strong></div>';
    } else {
      htmlFaltantes += '<div style="margin-bottom: 10px;"><strong style="color: #f39c12;">⚠️ OJs com perfil diferente:</strong></div>';
    }
    htmlFaltantes += ojsVinculadosComPerfilDiferente
      .map(item => `<div class="oj-item" style="color: #f39c12;">
        <i class="fas fa-exclamation-triangle"></i> ${item.textoCompleto}
        <div style="font-size: 11px; margin-left: 20px; color: #666;">
          Perfis atuais: ${item.perfisExistentes.join(', ') || 'Sem perfil definido'}
        </div>
      </div>`)
      .join('');
  }
  
  if (totalFaltantes > 0) {
    listaFaltantes.innerHTML = htmlFaltantes;
    btnGerarAutomacao.style.display = 'block';
  } else {
    listaFaltantes.innerHTML = '<div style="color: #28a745; text-align: center; padding: 20px;"><i class="fas fa-check-circle"></i> Todos os OJs e perfis da lista já estão vinculados corretamente!</div>';
    btnGerarAutomacao.style.display = 'none';
  }
  
  // Mostrar OJs já vinculados (da lista que o usuário já possui)
  if (ojsJaVinculados.length > 0) {
    listaExtras.innerHTML = `
      <div style="color: #28a745; margin-bottom: 10px;">
        <strong>✅ OJs da lista que já estão vinculados corretamente:</strong>
      </div>` + 
      ojsJaVinculados
        .map(item => {
          let html = `<div class="oj-item" style="color: #28a745;">
            <i class="fas fa-check"></i> ${item.textoCompleto}`;
          
          // Se foi especificado perfil, mostrar confirmação
          if (item.perfil) {
            html += `<div style="font-size: 11px; margin-left: 20px; color: #28a745;">
              ✓ Perfil confirmado: ${item.perfil}
            </div>`;
          } else if (item.perfisExistentes && item.perfisExistentes.length > 0) {
            // Se não foi especificado perfil mas existem, mostrar quais
            html += `<div style="font-size: 11px; margin-left: 20px; color: #666;">
              Perfis vinculados: ${item.perfisExistentes.join(', ')}
            </div>`;
          }
          
          html += '</div>';
          return html;
        })
        .join('');
  } else {
    listaExtras.innerHTML = '<div style="color: #6c757d; text-align: center; padding: 20px;"><i class="fas fa-info-circle"></i> Nenhum OJ da lista está vinculado ainda</div>';
  }
  
  // Adicionar info sobre OJs não listados se houver
  if (ojsNaoListados.length > 0) {
    listaExtras.innerHTML += `
      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;">
        <div style="color: #6c757d; margin-bottom: 5px; font-size: 12px;">
          <i class="fas fa-info-circle"></i> O usuário também possui ${ojsNaoListados.length} outro(s) OJ(s) não listado(s)
        </div>
      </div>`;
  }
  
  // Mostrar seção de resultados
  resultadoDiv.classList.remove('hidden');
  
  // Scroll suave para os resultados
  resultadoDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
  
  // Notificação resumo
  let mensagem = 'Comparação concluída: ';
  const partes = [];
  
  if (ojsFaltantes.length > 0) {
    partes.push(`${ojsFaltantes.length} OJ(s) não vinculado(s)`);
  }
  if (ojsVinculadosComPerfilDiferente.length > 0) {
    partes.push(`${ojsVinculadosComPerfilDiferente.length} com perfil diferente`);
  }
  if (ojsJaVinculados.length > 0) {
    partes.push(`${ojsJaVinculados.length} já vinculado(s) corretamente`);
  }
  
  mensagem += partes.join(', ');
  this.showNotification(mensagem, totalFaltantes > 0 ? 'warning' : 'success');
};

/**
 * Limpa a comparação de OJs
 */
PeritoApp.prototype.limparComparacao = function() {
  document.getElementById('ojsComparacaoTextarea').value = '';
  document.getElementById('resultadoComparacao').classList.add('hidden');
  this.dadosComparacao = null;
  this.showNotification('Comparação limpa', 'info');
};

/**
 * Gera automação para os OJs faltantes
 */
PeritoApp.prototype.gerarAutomacaoFaltantes = async function() {
  try {
    if (!this.dadosComparacao || !this.dadosComparacao.ojsFaltantes.length) {
      this.showNotification('Nenhum OJ faltante para gerar automação', 'warning');
      return;
    }
    
    const { ojsFaltantes, usuarioConsultado } = this.dadosComparacao;
    
    if (!usuarioConsultado || !usuarioConsultado.nome || !usuarioConsultado.cpf) {
      this.showNotification('Dados do usuário não encontrados para gerar automação', 'error');
      return;
    }
    
    // Criar estrutura de servidor para automação
    const servidorParaAutomacao = {
      nome: usuarioConsultado.nome,
      cpf: usuarioConsultado.cpf,
      perfil: 'Servidor',
      ojs: ojsFaltantes
    };
    
    console.log('🤖 [AUTOMACAO] Gerando para servidor:', servidorParaAutomacao);
    
    // Confirmar com usuário
    const confirmar = confirm(
      `Gerar automação para vincular ${ojsFaltantes.length} OJ(s) faltante(s) ao usuário?\n\n` +
      `Usuário: ${usuarioConsultado.nome}\n` +
      `CPF: ${usuarioConsultado.cpf}\n\n` +
      `OJs a serem vinculados:\n${ojsFaltantes.slice(0, 5).join('\n')}` +
      (ojsFaltantes.length > 5 ? `\n... e mais ${ojsFaltantes.length - 5} OJ(s)` : '')
    );
    
    if (!confirmar) {
      return;
    }
    
    // Carregar servidores atuais do sistema (não do localStorage)
    const servidoresAtuais = this.servidores || [];
    const servidorExistente = servidoresAtuais.find(s => s.cpf === servidorParaAutomacao.cpf);
    
    if (servidorExistente) {
      // Atualizar servidor existente com novos OJs
      const ojsExistentes = servidorExistente.ojs || [];
      
      // Função para comparar OJs (considerando que podem ser objetos ou strings)
      const ojJaExiste = (novoOj, ojsExistentes) => {
        return ojsExistentes.some(ojExistente => {
          // Se ambos são objetos, comparar pela propriedade 'oj'
          if (typeof novoOj === 'object' && typeof ojExistente === 'object') {
            return novoOj.oj === ojExistente.oj;
          }
          // Se ambos são strings, comparar diretamente
          if (typeof novoOj === 'string' && typeof ojExistente === 'string') {
            return novoOj === ojExistente;
          }
          // Se um é objeto e outro string, comparar oj do objeto com a string
          if (typeof novoOj === 'object' && typeof ojExistente === 'string') {
            return novoOj.oj === ojExistente;
          }
          if (typeof novoOj === 'string' && typeof ojExistente === 'object') {
            return novoOj === ojExistente.oj;
          }
          return false;
        });
      };
      
      // Filtrar apenas OJs que realmente não existem
      const novosOJs = ojsFaltantes.filter(oj => !ojJaExiste(oj, ojsExistentes));
      
      // Remover duplicatas dos OJs existentes também (caso já existam)
      const ojsLimpos = ojsExistentes.filter((oj, index, arr) => {
        return arr.findIndex(outroOj => {
          if (typeof oj === 'object' && typeof outroOj === 'object') {
            return oj.oj === outroOj.oj;
          }
          if (typeof oj === 'string' && typeof outroOj === 'string') {
            return oj === outroOj;
          }
          if (typeof oj === 'object' && typeof outroOj === 'string') {
            return oj.oj === outroOj;
          }
          if (typeof oj === 'string' && typeof outroOj === 'object') {
            return oj === outroOj.oj;
          }
          return false;
        }) === index;
      });
      
      servidorExistente.ojs = [...ojsLimpos, ...novosOJs];
      
      this.showNotification(`Servidor atualizado com ${novosOJs.length} novo(s) OJ(s) para automação`, 'success');
    } else {
      // Adicionar novo servidor
      servidoresAtuais.push(servidorParaAutomacao);
      this.servidores = servidoresAtuais;
      this.showNotification('Servidor adicionado para automação', 'success');
    }
    
    // Salvar os dados atualizados usando o sistema correto (electronAPI)
    await this.saveServidores();
    
    // Atualizar a interface da seção Gerenciar Servidores
    this.renderServidoresTable();
    this.updateDashboardStats();
    
    // Redirecionar para aba de servidores
    setTimeout(() => {
      const confirmarRedirect = confirm('Deseja ir para a aba Servidores para executar a automação?');
      if (confirmarRedirect) {
        this.switchTab('servidores');
      }
    }, 1000);
    
  } catch (error) {
    console.error('❌ Erro ao gerar automação:', error);
    this.showNotification('Erro ao gerar automação: ' + error.message, 'error');
  }
};

/**
 * Importa lista de OJs de um arquivo JSON
 */
PeritoApp.prototype.importarOJsJSON = function(file) {
  if (!file) {
    this.showNotification('Nenhum arquivo selecionado', 'warning');
    return;
  }

  if (!file.name.toLowerCase().endsWith('.json')) {
    this.showNotification('Por favor, selecione um arquivo JSON válido', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const jsonData = JSON.parse(e.target.result);
      
      // Validar estrutura do JSON
      if (!this.validarFormatoJSON(jsonData)) {
        return;
      }

      // Processar e inserir dados no textarea
      const linhasOJs = this.processarDadosJSON(jsonData);
      const textarea = document.getElementById('ojsComparacaoTextarea');
      
      if (textarea.value.trim()) {
        // Se já tem conteúdo, perguntar se quer substituir ou adicionar
        const opcao = confirm(
          'O campo já contém dados. Deseja:\n\n' +
          'OK = Substituir conteúdo existente\n' +
          'Cancelar = Adicionar ao conteúdo existente'
        );
        
        if (opcao) {
          textarea.value = linhasOJs.join('\n');
        } else {
          textarea.value += '\n' + linhasOJs.join('\n');
        }
      } else {
        textarea.value = linhasOJs.join('\n');
      }

      this.showNotification(
        `✅ Importados ${linhasOJs.length} OJ(s) do arquivo ${file.name}`, 
        'success'
      );

      // Limpar o input file para permitir reimportação do mesmo arquivo
      document.getElementById('importOJsFile').value = '';

    } catch (error) {
      console.error('❌ Erro ao processar arquivo JSON:', error);
      this.showNotification(
        'Erro ao processar arquivo JSON: ' + error.message, 
        'error'
      );
    }
  };

  reader.onerror = () => {
    this.showNotification('Erro ao ler o arquivo', 'error');
  };

  reader.readAsText(file);
};

/**
 * Valida o formato do JSON importado
 */
PeritoApp.prototype.validarFormatoJSON = function(data) {
  // Formato 1: Array simples de strings
  if (Array.isArray(data)) {
    if (data.every(item => typeof item === 'string')) {
      return true;
    }
    
    // Formato 2: Array de objetos com propriedades oj e perfil
    if (data.every(item => 
      typeof item === 'object' && 
      item !== null && 
      typeof item.oj === 'string'
    )) {
      return true;
    }
  }
  
  // Formato 3: Objeto com propriedade ojs
  if (typeof data === 'object' && data !== null && Array.isArray(data.ojs)) {
    return this.validarFormatoJSON(data.ojs);
  }

  this.showNotification(
    'Formato JSON inválido. Use um dos formatos suportados. Clique em \'Ver formato esperado\' para mais detalhes.',
    'error'
  );
  return false;
};

/**
 * Processa os dados JSON e converte para formato de linhas
 */
PeritoApp.prototype.processarDadosJSON = function(data) {
  let ojs = [];

  // Se é objeto com propriedade ojs, extrair array
  if (typeof data === 'object' && data !== null && Array.isArray(data.ojs)) {
    ojs = data.ojs;
  } else if (Array.isArray(data)) {
    ojs = data;
  }

  return ojs.map(item => {
    if (typeof item === 'string') {
      return item.trim();
    } else if (typeof item === 'object' && item !== null) {
      const oj = item.oj ? item.oj.trim() : '';
      const perfil = item.perfil ? item.perfil.trim() : '';
      
      if (perfil) {
        return `${oj} - ${perfil}`;
      } else {
        return oj;
      }
    }
    return '';
  }).filter(linha => linha.length > 0);
};

/**
 * Baixa um arquivo de exemplo JSON
 */
PeritoApp.prototype.downloadExampleJSON = function() {
  const exemploJSON = {
    'descricao': 'Exemplo de arquivo JSON para importação de OJs',
    'formato': 'Pode ser array simples ou objetos com oj e perfil',
    'ojs': [
      '1ª Vara do Trabalho de Campinas',
      '2ª Vara do Trabalho de Campinas - Diretor de Secretaria',
      'Vara do Trabalho de Botucatu - Assessor',
      '3ª Vara Cível de Limeira - Servidor'
    ]
  };

  const blob = new Blob([JSON.stringify(exemploJSON, null, 2)], {
    type: 'application/json'
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'exemplo-ojs.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  this.showNotification('📁 Arquivo de exemplo baixado', 'info');
};

/**
 * Mostra ajuda sobre o formato JSON esperado
 */
PeritoApp.prototype.showJsonFormatHelp = function() {
  const helpHTML = `
    <div style="text-align: left; max-width: 600px;">
      <h3>📋 Formatos JSON Suportados</h3>
      
      <h4>1. Array Simples de Strings:</h4>
      <pre style="background: #f8f9fa; padding: 10px; border-radius: 5px; font-size: 12px;">[
  "1ª Vara do Trabalho de Campinas",
  "2ª Vara do Trabalho de Campinas - Diretor",
  "Vara do Trabalho de Botucatu - Assessor"
]</pre>

      <h4>2. Array de Objetos:</h4>
      <pre style="background: #f8f9fa; padding: 10px; border-radius: 5px; font-size: 12px;">[
  {
    "oj": "1ª Vara do Trabalho de Campinas",
    "perfil": "Diretor de Secretaria"
  },
  {
    "oj": "2ª Vara do Trabalho de Campinas"
  }
]</pre>

      <h4>3. Objeto com Propriedade 'ojs':</h4>
      <pre style="background: #f8f9fa; padding: 10px; border-radius: 5px; font-size: 12px;">{
  "descricao": "Lista de OJs para importar",
  "ojs": [
    "1ª Vara do Trabalho de Campinas",
    "2ª Vara do Trabalho de Campinas - Diretor"
  ]
}</pre>

      <p><strong>💡 Dicas:</strong></p>
      <ul>
        <li>Use hífen (-) para separar OJ do perfil</li>
        <li>Perfil é opcional</li>
        <li>Linhas vazias são ignoradas</li>
        <li>Clique em "Exemplo" para baixar um arquivo modelo</li>
      </ul>
    </div>
  `;

  // Criar modal simples para mostrar a ajuda
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,0,0,0.5); z-index: 10000; display: flex; 
    align-items: center; justify-content: center;
  `;
  
  const content = document.createElement('div');
  content.style.cssText = `
    background: white; padding: 20px; border-radius: 10px; 
    max-width: 90%; max-height: 90%; overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  `;
  
  content.innerHTML = helpHTML + `
    <div style="text-align: center; margin-top: 20px;">
      <button onclick="this.closest('.modal').remove()" 
              style="padding: 10px 20px; background: #007bff; color: white; 
                     border: none; border-radius: 5px; cursor: pointer;">
        Fechar
      </button>
    </div>
  `;
  
  modal.className = 'modal';
  modal.appendChild(content);
  document.body.appendChild(modal);
  
  // Fechar ao clicar fora
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
};

/**
 * Mostra ajuda sobre o formato JSON esperado para servidores
 */
PeritoApp.prototype.showServidoresJsonFormatHelp = function() {
  const helpHTML = `
    <div style="text-align: left; max-width: 600px;">
      <h3>📋 Formato JSON para Servidores</h3>
      
      <h4>Array de Objetos com CPF e Nome:</h4>
      <pre style="background: #f8f9fa; padding: 10px; border-radius: 5px; font-size: 12px;">[
  {
    "cpf": "12345678901",
    "nome": "João Silva"
  },
  {
    "cpf": "98765432100", 
    "nome": "Maria Santos"
  }
]</pre>

      <h4>Exemplo com mais campos opcionais:</h4>
      <pre style="background: #f8f9fa; padding: 10px; border-radius: 5px; font-size: 12px;">[
  {
    "cpf": "12345678901",
    "nome": "João Silva",
    "cargo": "Analista Judiciário",
    "lotacao": "1ª Vara do Trabalho"
  }
]</pre>

      <p><strong>💡 Campos obrigatórios:</strong></p>
      <ul>
        <li><strong>cpf:</strong> CPF do servidor (apenas números)</li>
        <li><strong>nome:</strong> Nome completo do servidor</li>
      </ul>
      
      <p><strong>📝 Campos opcionais:</strong></p>
      <ul>
        <li><strong>cargo:</strong> Cargo do servidor</li>
        <li><strong>lotacao:</strong> Local de lotação</li>
      </ul>
    </div>
  `;

  // Criar modal simples para mostrar a ajuda
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,0,0,0.5); z-index: 10000; display: flex; 
    align-items: center; justify-content: center;
  `;
  
  const content = document.createElement('div');
  content.style.cssText = `
    background: white; padding: 20px; border-radius: 10px; 
    max-width: 90%; max-height: 90%; overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  `;
  
  content.innerHTML = helpHTML + `
    <div style="text-align: center; margin-top: 20px;">
      <button onclick="this.closest('.modal').remove()" 
              style="padding: 10px 20px; background: #007bff; color: white; 
                     border: none; border-radius: 5px; cursor: pointer;">
        Fechar
      </button>
    </div>
  `;
  
  modal.className = 'modal';
  modal.appendChild(content);
  document.body.appendChild(modal);
  
  // Fechar ao clicar fora
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
};

/**
 * Mostra o formato JSON esperado para importação
 */
PeritoApp.prototype.mostrarFormatoJSON = function() {
  const formatoExemplo = [
    {
      'nome': 'Aryelle Marcondes de Rezende',
      'cpf': '372.854.118-41',
      'perfil': 'Secretário de Audiência',
      'ojs': [
        'Vara do Trabalho de Bebedouro',
        '1ª Vara do Trabalho de Jaboticabal',
        '2ª Vara do Trabalho de Jaboticabal',
        'Vara do Trabalho de Mococa'
      ]
    },
    {
      'nome': 'Newton Trevisan Júnior',
      'cpf': '228.302.228-22',
      'perfil': 'Secretário de Audiência',
      'ojs': [
        '1ª Vara do Trabalho de São Carlos',
        '2ª Vara do Trabalho de São Carlos',
        'Vara do Trabalho de São José do Rio Pardo',
        'Vara do Trabalho de Taquaritinga'
      ]
    }
  ];

  const helpHTML = `
    <div style="text-align: left; max-width: 700px;">
      <h3>📋 Formato JSON Esperado para Importação</h3>
      
      <h4>Estrutura do JSON:</h4>
      <pre style="background: #f8f9fa; padding: 15px; border-radius: 5px; font-size: 13px; overflow-x: auto;">${JSON.stringify(formatoExemplo, null, 2)}</pre>

      <h4 style="margin-top: 20px;">📝 Campos Obrigatórios:</h4>
      <ul style="line-height: 1.8;">
        <li><strong>nome:</strong> Nome completo do servidor</li>
        <li><strong>cpf:</strong> CPF do servidor (formato: XXX.XXX.XXX-XX ou apenas números)</li>
        <li><strong>perfil:</strong> Perfil/cargo do servidor no sistema</li>
        <li><strong>ojs:</strong> Array com os nomes dos órgãos julgadores</li>
      </ul>
      
      <h4 style="margin-top: 20px;">🔧 Funcionalidades de Verificação:</h4>
      <ul style="line-height: 1.8;">
        <li><strong>Verificação de Cadastro:</strong> Identifica servidores já cadastrados no sistema</li>
        <li><strong>Arquivo de Automação:</strong> Gera arquivo JSON com servidores faltantes para automação</li>
        <li><strong>Verificação de OJs:</strong> Verifica vínculos apenas para servidores já cadastrados</li>
        <li><strong>Relatório Detalhado:</strong> Apresenta resultados completos da verificação</li>
      </ul>
      
      <h4 style="margin-top: 20px;">⚠️ Observações Importantes:</h4>
      <ul style="line-height: 1.8;">
        <li>Todos os campos são <strong>obrigatórios</strong> para o funcionamento correto</li>
        <li>Os nomes dos OJs devem corresponder aos nomes exatos dos órgãos julgadores no PJE</li>
        <li>O campo <strong>ojs</strong> é um array, mesmo que contenha apenas um item</li>
        <li>Campos como <strong>email</strong> e <strong>cidade</strong> são ignorados se presentes</li>
        <li>CPFs duplicados não são permitidos no mesmo arquivo</li>
      </ul>

      <h4 style="margin-top: 20px;">💡 Dica:</h4>
      <p>Você pode copiar o exemplo acima e modificar com seus dados. O sistema automaticamente separará servidores cadastrados dos não cadastrados.</p>
    </div>
  `;

  // Criar modal
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,0,0,0.5); z-index: 10000; display: flex; 
    align-items: center; justify-content: center;
  `;
  
  const content = document.createElement('div');
  content.style.cssText = `
    background: white; padding: 25px; border-radius: 10px; 
    max-width: 90%; max-height: 90%; overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  `;
  
  content.innerHTML = helpHTML + `
    <div style="text-align: center; margin-top: 25px;">
      <button onclick="navigator.clipboard.writeText('${JSON.stringify(formatoExemplo, null, 2).replace(/'/g, '\\\'')}').then(() => alert('Exemplo copiado!'))" 
              style="padding: 10px 20px; background: #28a745; color: white; 
                     border: none; border-radius: 5px; cursor: pointer; margin-right: 10px;">
        📋 Copiar Exemplo
      </button>
      <button onclick="this.closest('div[style]').parentElement.remove()" 
              style="padding: 10px 20px; background: #007bff; color: white; 
                     border: none; border-radius: 5px; cursor: pointer;">
        Fechar
      </button>
    </div>
  `;
  
  modal.appendChild(content);
  document.body.appendChild(modal);
  
  // Fechar ao clicar fora
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
};

/**
 * Exporta os resultados da verificação para a aba de Servidores
 */
PeritoApp.prototype.exportarResultadosParaServidores = async function() {
  const resultadosContainer = document.getElementById('resultadosContainer');
  
  if (!resultadosContainer || !resultadosContainer.dataset.ultimaVerificacao) {
    this.showNotification('Nenhum resultado de verificação disponível para exportar', 'warning');
    return;
  }

  try {
    const resultados = JSON.parse(resultadosContainer.dataset.ultimaVerificacao);
    
    if (!resultados || !resultados.servidores || resultados.servidores.length === 0) {
      this.showNotification('Nenhum servidor para exportar', 'warning');
      return;
    }

    // Filtrar apenas servidores com OJs faltantes
    const servidoresComFaltantes = resultados.servidores.filter(servidor => 
      servidor.ojsFaltantes && servidor.ojsFaltantes.length > 0
    );

    if (servidoresComFaltantes.length === 0) {
      this.showNotification('Todos os servidores já possuem todos os OJs vinculados', 'info');
      return;
    }

    // Preparar resumo para confirmação
    let resumo = '📊 Resumo da Exportação:\n';
    resumo += `• ${servidoresComFaltantes.length} servidor(es) com OJs faltantes\n`;
    resumo += `• Total de OJs faltantes: ${servidoresComFaltantes.reduce((total, s) => total + s.ojsFaltantes.length, 0)}\n\n`;
    resumo += '⚠️ IMPORTANTE: Serão exportadas APENAS as OJs faltantes.\n';
    resumo += 'As OJs já cadastradas NÃO serão incluídas.\n\n';
    resumo += 'Deseja continuar?';

    // Confirmar exportação
    const confirmacao = confirm(resumo);

    if (!confirmacao) return;

    // Carregar servidores existentes
    const servidoresExistentes = await window.electronAPI.loadData('servidores.json') || [];
    let adicionados = 0;
    let atualizados = 0;

    // Processar cada servidor
    for (const servidor of servidoresComFaltantes) {
      const servidorExistente = servidoresExistentes.find(s => s.cpf === servidor.cpf);
      
      // IMPORTANTE: Normalizar OJs faltantes antes de adicionar
      const ojsNormalizados = this.normalizarListaOJs(servidor.ojsFaltantes);
      console.log(`📝 Normalizando OJs para ${servidor.nome}:`, {
        originais: servidor.ojsFaltantes,
        normalizados: ojsNormalizados
      });
      
      if (servidorExistente) {
        // IMPORTANTE: Substituir completamente com apenas as OJs faltantes
        // Não adicionar às OJs existentes, pois queremos apenas as que faltam para automação
        console.log(`📝 Atualizando servidor ${servidor.nome} com APENAS as OJs faltantes`);
        
        // Substituir completamente com apenas as OJs faltantes normalizadas
        servidorExistente.ojs = ojsNormalizados;
        // Manter ambos os campos para compatibilidade
        servidorExistente.localizacoes = ojsNormalizados;
        // Adicionar campo 'orgaos' que a automação espera
        servidorExistente.orgaos = ojsNormalizados;
        atualizados++;
      } else {
        // Adicionar novo servidor com OJs normalizados (apenas as faltantes)
        servidoresExistentes.push({
          nome: servidor.nome,
          cpf: servidor.cpf,
          perfil: servidor.perfil || 'Servidor',
          ojs: ojsNormalizados,
          // Manter 'localizacoes' para compatibilidade
          localizacoes: ojsNormalizados,
          // Adicionar campo 'orgaos' que a automação espera
          orgaos: ojsNormalizados
        });
        adicionados++;
      }
    }

    // Salvar servidores
    await window.electronAPI.saveData('servidores.json', servidoresExistentes);
    
    // Recarregar a lista de servidores
    await this.loadServidores();

    // Mudar para aba de servidores
    document.querySelector('[data-tab="servidores"]').click();

    // Contar total de OJs exportadas
    const totalOJsExportadas = servidoresComFaltantes.reduce((total, s) => total + s.ojsFaltantes.length, 0);
    
    this.showNotification(
      '✅ Exportação concluída com sucesso!\n\n' +
      `• ${adicionados} servidor(es) novo(s) adicionado(s)\n` +
      `• ${atualizados} servidor(es) atualizado(s)\n` +
      `• ${totalOJsExportadas} OJ(s) faltante(s) exportada(s)\n\n` +
      '⚠️ Apenas as OJs faltantes foram exportadas para automação.',
      'success'
    );

    // Limpar resultados após exportação bem-sucedida
    this.limparDadosServidores();

  } catch (error) {
    console.error('Erro ao exportar resultados:', error);
    this.showNotification('Erro ao exportar resultados: ' + error.message, 'error');
  }
};

PeritoApp.prototype.validarENormalizarServidores = async function(servidores) {
  try {
    // Usar normalização através do IPC
    // Normalizer não é necessário já que temos os métodos
      
    // Carregar lista de OJs disponíveis no sistema
    const ojsDisponiveis = await this.carregarOrgaosPJE();
    if (!ojsDisponiveis || ojsDisponiveis.length === 0) {
      throw new Error('Não foi possível carregar lista de OJs disponíveis');
    }
      
    const servidoresCorrigidos = [];
    const problemas = [];
      
    for (const servidor of servidores) {
      const problemaServidor = {
        nome: servidor.nome,
        cpf: servidor.cpf,
        problemas: []
      };
        
      // Validar CPF
      const validacaoCPF = this.validarCPF(servidor.cpf || '');
      if (!validacaoCPF.valido) {
        problemaServidor.problemas.push({
          tipo: 'cpf',
          mensagem: validacaoCPF.erro,
          valor: servidor.cpf
        });
      } else {
        servidor.cpf = validacaoCPF.cpfFormatado;
      }
        
      // Validar e normalizar OJs
      if (servidor.ojs && Array.isArray(servidor.ojs)) {
        const validacaoOJs = this.validarECorrigirOJs(servidor.ojs, ojsDisponiveis);
          
        if (validacaoOJs.sucesso) {
          servidor.ojs = validacaoOJs.ojsCorrigidos;
          servidor.orgaos = validacaoOJs.ojsCorrigidos; // Para automação
          servidor.localizacoes = validacaoOJs.ojsCorrigidos; // Compatibilidade
        } else {
          // Adicionar OJs corrigidos e registrar problemas
          servidor.ojs = validacaoOJs.ojsCorrigidos;
          servidor.orgaos = validacaoOJs.ojsCorrigidos;
          servidor.localizacoes = validacaoOJs.ojsCorrigidos;
            
          // Registrar OJs problemáticos
          validacaoOJs.resultados.forEach(resultado => {
            if (resultado.status === 'sugestao') {
              problemaServidor.problemas.push({
                tipo: 'oj_sugestao',
                original: resultado.original,
                sugerido: resultado.sugerido,
                similaridade: resultado.similaridade
              });
            } else if (resultado.status === 'nao_encontrado') {
              problemaServidor.problemas.push({
                tipo: 'oj_nao_encontrado',
                valor: resultado.original,
                similaridade: resultado.similaridade
              });
            }
          });
        }
      }
        
      if (problemaServidor.problemas.length > 0) {
        problemas.push(problemaServidor);
      }
        
      servidoresCorrigidos.push(servidor);
    }
      
    return {
      sucesso: problemas.length === 0,
      servidoresCorrigidos,
      problemas,
      totalServidores: servidores.length,
      servidoresComProblemas: problemas.length
    };
      
  } catch (error) {
    console.error('Erro na validação:', error);
    return {
      sucesso: false,
      erro: error.message,
      servidoresCorrigidos: servidores
    };
  }
};

PeritoApp.prototype.validarCPF = function(cpf) {
  // Remove caracteres não numéricos
  cpf = cpf.replace(/\D/g, '');
    
  // Verifica se tem 11 dígitos
  if (cpf.length !== 11) {
    return { valido: false, erro: 'CPF deve ter 11 dígitos' };
  }
    
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cpf)) {
    return { valido: false, erro: 'CPF inválido (todos dígitos iguais)' };
  }
    
  // Validação dos dígitos verificadores
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i)) * (10 - i);
  }
    
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(9))) {
    return { valido: false, erro: 'CPF inválido (dígito verificador incorreto)' };
  }
    
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i)) * (11 - i);
  }
    
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(10))) {
    return { valido: false, erro: 'CPF inválido (dígito verificador incorreto)' };
  }
    
  return { valido: true, cpfFormatado: this.formatCpf(cpf) };
};

PeritoApp.prototype.validarECorrigirOJs = function(ojsOriginais, ojsDisponiveis) {
  const resultados = [];
  const ojsCorrigidos = [];
  const ojsProblematicos = [];
    
  for (const ojOriginal of ojsOriginais) {
    // PRIMEIRO: Tentar normalização inteligente
    const ojNormalizadoInteligente = this.normalizarOJInteligente(ojOriginal);
      
    // SEGUNDO: Normalizar com método padrão como fallback
    const ojNormalizado = this.normalizarNomeOJ(ojNormalizadoInteligente);
    let melhorCorrespondencia = null;
    let melhorSimilaridade = 0;
      
    // Buscar melhor correspondência na lista disponível
    for (const ojDisponivel of ojsDisponiveis) {
      const ojDisponivelNorm = this.normalizarNomeOJ(ojDisponivel);
        
      // Comparação exata após normalização
      if (ojNormalizado.toLowerCase() === ojDisponivelNorm.toLowerCase()) {
        melhorCorrespondencia = ojDisponivel;
        melhorSimilaridade = 1.0;
        break;
      }
        
      // Comparação parcial
      if (ojNormalizado.toLowerCase().includes(ojDisponivelNorm.toLowerCase()) || 
            ojDisponivelNorm.toLowerCase().includes(ojNormalizado.toLowerCase())) {
        const similaridade = 0.8;
        if (similaridade > melhorSimilaridade) {
          melhorSimilaridade = similaridade;
          melhorCorrespondencia = ojDisponivel;
        }
      }
    }
      
    if (melhorSimilaridade >= 0.8) {
      ojsCorrigidos.push(melhorCorrespondencia);
      resultados.push({
        original: ojOriginal,
        corrigido: melhorCorrespondencia,
        status: melhorSimilaridade === 1.0 ? 'corrigido' : 'sugestao',
        similaridade: melhorSimilaridade
      });
        
      // Log quando houver correção
      if (ojOriginal !== melhorCorrespondencia) {
        console.log(`✅ OJ corrigido: "${ojOriginal}" → "${melhorCorrespondencia}" (confiança: ${(melhorSimilaridade * 100).toFixed(0)}%)`);
      }
    } else {
      ojsProblematicos.push(ojOriginal);
      resultados.push({
        original: ojOriginal,
        status: 'nao_encontrado',
        similaridade: 0
      });
        
      console.log(`⚠️ OJ não encontrado: "${ojOriginal}" (tentou: "${ojNormalizadoInteligente}")`);
    }
  }
    
  return {
    sucesso: ojsProblematicos.length === 0,
    ojsCorrigidos,
    ojsProblematicos,
    resultados,
    estatisticas: {
      total: ojsOriginais.length,
      corrigidos: ojsCorrigidos.length,
      problematicos: ojsProblematicos.length
    }
  };
};

PeritoApp.prototype.normalizarListaOJs = function(listaOJs) {
  if (!listaOJs || !Array.isArray(listaOJs)) return [];
    
  return listaOJs.map(oj => this.normalizarOJInteligente(oj));
};

PeritoApp.prototype.normalizarOJInteligente = function(nomeOJ) {
  if (!nomeOJ) return '';
    
  const nome = nomeOJ.trim();
    
  // Padrões de correção para Varas do Trabalho
  const padroes = [
    // "1ª Vara Jaboticabal" → "1ª Vara do Trabalho de Jaboticabal"
    // Aceita qualquer letra maiúscula ou minúscula após "Vara "
    { pattern: /^(\d+)ª Vara ([A-Za-zÀ-ÿ\s]+)$/i, 
      replace: (_, num, cidade) => `${num}ª Vara do Trabalho de ${this.normalizarCidade(cidade)}` },
      
    // "Vara Pirassununga" → "Vara do Trabalho de Pirassununga"
    { pattern: /^Vara ([A-Za-zÀ-ÿ\s]+)$/i,
      replace: (_, cidade) => `Vara do Trabalho de ${this.normalizarCidade(cidade)}` },
      
    // "1 Vara Pirassununga" → "1ª Vara do Trabalho de Pirassununga"
    { pattern: /^(\d+) Vara ([A-Za-zÀ-ÿ\s]+)$/i,
      replace: (_, num, cidade) => `${num}ª Vara do Trabalho de ${this.normalizarCidade(cidade)}` },
      
    // "VT Pirassununga" → "Vara do Trabalho de Pirassununga"
    { pattern: /^VT ([A-Za-zÀ-ÿ\s]+)$/i,
      replace: (_, cidade) => `Vara do Trabalho de ${this.normalizarCidade(cidade)}` },
      
    // "1ª VT Pirassununga" → "1ª Vara do Trabalho de Pirassununga"
    { pattern: /^(\d+)ª VT ([A-Za-zÀ-ÿ\s]+)$/i,
      replace: (_, num, cidade) => `${num}ª Vara do Trabalho de ${this.normalizarCidade(cidade)}` }
  ];
    
  // Aplicar padrões de correção
  for (const { pattern, replace } of padroes) {
    if (pattern.test(nome)) {
      return nome.replace(pattern, replace);
    }
  }
    
  // Se já está no formato correto ou não é vara do trabalho, retornar normalizado
  return this.normalizarNomeOJ(nome);
};

PeritoApp.prototype.normalizarCidade = function(cidade) {
  if (!cidade) return '';
    
  // Correções específicas de cidades
  const correcoes = {
    'pirassununga': 'Pirassununga',
    'pirasununga': 'Pirassununga', 
    'bebedoro': 'Bebedouro',
    'bebedouro': 'Bebedouro',
    'jaboticaba': 'Jaboticabal',
    'jaboticabal': 'Jaboticabal',
    'mocóca': 'Mococa',
    'mococa': 'Mococa',
    'sao carlos': 'São Carlos',
    's. carlos': 'São Carlos',
    'são carlos': 'São Carlos',
    'sao jose rio pardo': 'São José do Rio Pardo',
    'são josé do rio pardo': 'São José do Rio Pardo',
    's. josé do rio pardo': 'São José do Rio Pardo',
    'ribeirao preto': 'Ribeirão Preto',
    'ribeirão preto': 'Ribeirão Preto',
    'rib. preto': 'Ribeirão Preto',
    'aracatuba': 'Araçatuba',
    'araçatuba': 'Araçatuba',
    'pres. prudente': 'Presidente Prudente',
    'presidente prudente': 'Presidente Prudente',
    'lencois paulista': 'Lençóis Paulista',
    'lençóis paulista': 'Lençóis Paulista',
    'mogi guacu': 'Mogi Guaçu',
    'mogi guaçu': 'Mogi Guaçu',
    'tatui': 'Tatuí',
    'tatuí': 'Tatuí',
    'jundiai': 'Jundiaí',
    'jundiaí': 'Jundiaí',
    'avare': 'Avaré',
    'avaré': 'Avaré',
    'taubate': 'Taubaté',
    'taubaté': 'Taubaté',
    'taquaritinga': 'Taquaritinga',
    'sertaozinho': 'Sertãozinho',
    'sertãozinho': 'Sertãozinho',
    'são josé dos campos': 'São José dos Campos',
    'sao jose dos campos': 'São José dos Campos',
    's. josé dos campos': 'São José dos Campos',
    'sao jose do rio preto': 'São José do Rio Preto',
    'são josé do rio preto': 'São José do Rio Preto',
    's. josé do rio preto': 'São José do Rio Preto',
    'catanduva': 'Catanduva',
    'franca': 'Franca',
    'jau': 'Jaú',
    'jaú': 'Jaú',
    'marilia': 'Marília',
    'marília': 'Marília',
    'piracicaba': 'Piracicaba',
    'sorocaba': 'Sorocaba',
    'americana': 'Americana',
    'araraquara': 'Araraquara',
    'bauru': 'Bauru',
    'campinas': 'Campinas'
  };
    
  const cidadeLower = cidade.toLowerCase().trim();
  if (correcoes[cidadeLower]) {
    return correcoes[cidadeLower];
  }
    
  // Capitalizar corretamente
  const preposicoes = ['de', 'do', 'da', 'dos', 'das'];
  return cidade
    .toLowerCase()
    .split(' ')
    .map((palavra, index) => {
      if (index > 0 && preposicoes.includes(palavra)) {
        return palavra;
      }
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    })
    .join(' ');
};

PeritoApp.prototype.normalizarNomeOJ = function(nomeOJ) {
  if (!nomeOJ) return '';
    
  let nome = nomeOJ.trim();
    
  // Mapeamentos comuns
  const mapeamentos = [
    { de: /divisao de execucao/gi, para: 'DIVEX' },
    { de: /divisão de execução/gi, para: 'DIVEX' },
    { de: /vara do trabalho/gi, para: 'VT' },
    { de: /centro judiciario/gi, para: 'CEJUSC' },
    { de: /centro judiciário/gi, para: 'CEJUSC' },
    { de: /\b1a\b/gi, para: '1ª' },
    { de: /\b2a\b/gi, para: '2ª' },
    { de: /\b3a\b/gi, para: '3ª' },
    { de: /\b4a\b/gi, para: '4ª' },
    { de: /\b5a\b/gi, para: '5ª' },
    { de: /pres\. prudente/gi, para: 'Presidente Prudente' },
    { de: /s\. jose do rio preto/gi, para: 'São José do Rio Preto' }
  ];
    
  // Aplicar mapeamentos
  for (const map of mapeamentos) {
    nome = nome.replace(map.de, map.para);
  }
    
  // Remover espaços extras
  nome = nome.replace(/\s+/g, ' ');
  nome = nome.replace(/\s*-\s*/g, ' - ');
    
  return nome.trim();
};

PeritoApp.prototype.mostrarModalCorrecao = async function(validacao) {
  const modal = document.createElement('div');
  modal.className = 'modal fade show';
  modal.style.display = 'block';
  modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    
  let htmlProblemas = '';
    
  for (const problema of validacao.problemas) {
    htmlProblemas += `
        <div class="card mb-3">
          <div class="card-header">
            <strong>${problema.nome}</strong> - CPF: ${problema.cpf}
          </div>
          <div class="card-body">
      `;
      
    for (const p of problema.problemas) {
      if (p.tipo === 'cpf') {
        htmlProblemas += `
            <div class="alert alert-danger">
              <i class="fas fa-exclamation-triangle"></i> CPF Inválido: ${p.mensagem}
              <br><small>Valor: ${p.valor}</small>
            </div>
          `;
      } else if (p.tipo === 'oj_sugestao') {
        htmlProblemas += `
            <div class="alert alert-warning">
              <i class="fas fa-lightbulb"></i> OJ com nome diferente
              <br>Original: <strong>${p.original}</strong>
              <br>Sugerido: <strong>${p.sugerido}</strong>
              <br>Similaridade: ${(p.similaridade * 100).toFixed(1)}%
              <br><label>
                <input type="checkbox" class="correcao-aceita" 
                       data-original="${p.original}" 
                       data-sugerido="${p.sugerido}" checked>
                Aceitar correção
              </label>
            </div>
          `;
      } else if (p.tipo === 'oj_nao_encontrado') {
        htmlProblemas += `
            <div class="alert alert-danger">
              <i class="fas fa-times-circle"></i> OJ não encontrado no sistema
              <br>Nome: <strong>${p.valor}</strong>
              <br><small>Este OJ será ignorado na automação</small>
            </div>
          `;
      }
    }
      
    htmlProblemas += `
          </div>
        </div>
      `;
  }
    
  modal.innerHTML = `
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="fas fa-exclamation-triangle text-warning"></i>
              Validação e Correção de Dados
            </h5>
          </div>
          <div class="modal-body" style="max-height: 500px; overflow-y: auto;">
            <div class="alert alert-info">
              <i class="fas fa-info-circle"></i>
              Foram encontrados <strong>${validacao.servidoresComProblemas}</strong> servidor(es) com dados que precisam de atenção.
              <br>Revise as correções sugeridas abaixo:
            </div>
            ${htmlProblemas}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">
              Cancelar
            </button>
            <button type="button" class="btn btn-warning" onclick="app.aplicarCorrecoesEContinuar(this)">
              <i class="fas fa-check"></i> Aplicar Correções e Continuar
            </button>
            <button type="button" class="btn btn-success" onclick="app.continuarSemCorrecao(this)">
              <i class="fas fa-arrow-right"></i> Continuar Sem Correções
            </button>
          </div>
        </div>
      </div>
    `;
    
  document.body.appendChild(modal);
};

PeritoApp.prototype.aplicarCorrecoesEContinuar = async function(button) {
  const modal = button.closest('.modal');
  const checkboxes = modal.querySelectorAll('.correcao-aceita:checked');
    
  // Aplicar correções aceitas
  const correcoes = {};
  checkboxes.forEach(cb => {
    correcoes[cb.dataset.original] = cb.dataset.sugerido;
  });
    
  // Reprocessar com correções
  const textarea = document.getElementById('servidoresVinculosTextarea');
  const servidores = JSON.parse(textarea.value);
    
  // Aplicar correções nos dados originais
  servidores.forEach(servidor => {
    if (servidor.ojs && Array.isArray(servidor.ojs)) {
      servidor.ojs = servidor.ojs.map(oj => correcoes[oj] || oj);
    }
  });
    
  // Atualizar textarea com dados corrigidos
  textarea.value = JSON.stringify(servidores, null, 2);
    
  // Fechar modal
  modal.remove();
    
  // Continuar processamento
  this.showNotification('Correções aplicadas! Continuando verificação...', 'success');
    
  // Reprocessar com dados corrigidos
  await this.verificarVinculosServidores();
};

PeritoApp.prototype.continuarSemCorrecao = function(button) {
  const modal = button.closest('.modal');
  modal.remove();
    
  this.showNotification('Continuando com dados originais. OJs não encontrados serão ignorados.', 'warning');
    
  // Forçar continuação marcando como sucesso
  const textarea = document.getElementById('servidoresVinculosTextarea');
  const servidores = JSON.parse(textarea.value);
    
  // Marcar validação como bem-sucedida para continuar
  const validacao = { 
    sucesso: true, 
    servidoresCorrigidos: servidores 
  };
    
  // Continuar processamento normalmente
  this.processarServidoresValidados(validacao);
};

PeritoApp.prototype.processarServidoresValidados = async function(validacao) {
  const progressSection = document.getElementById('progressoVerificacao');
  const resultsSection = document.getElementById('resultadoVerificacaoServidores');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
    
  const servidores = validacao.servidoresCorrigidos;
    
  // Mostrar seção de progresso
  progressSection.style.display = 'block';
  resultsSection.innerHTML = '';
    
  progressText.textContent = 'Iniciando verificação de vínculos...';
  progressBar.style.width = '0%';
    
  // Processar servidores
  const resultados = [];
  const total = servidores.length;
  let processados = 0;
    
  for (const servidor of servidores) {
    try {
      progressText.textContent = `Verificando vínculos: ${servidor.nome || 'Servidor'} (${processados + 1}/${total})`;
        
      const resultado = await this.verificarServidor(servidor);
      resultados.push(resultado);
      processados++;
        
      // Atualizar barra de progresso
      progressBar.style.width = `${(processados / total) * 100}%`;
        
      // Pequena pausa para não sobrecarregar
      await new Promise(resolve => setTimeout(resolve, 100));
        
    } catch (error) {
      console.error('Erro ao verificar servidor:', error);
      resultados.push({
        servidor,
        erro: error.message,
        status: 'erro'
      });
      processados++;
    }
  }
    
  // Exibir resultados
  this.exibirResultadosVerificacao(resultados);
  progressText.textContent = 'Verificação de vínculos concluída!';
};

// Função para formatar CPF automaticamente
function formatarCPF(valor) {
  // Remove todos os caracteres não numéricos
  const apenasNumeros = valor.replace(/\D/g, '');
  
  // Limita a 11 dígitos
  const limitado = apenasNumeros.substring(0, 11);
  
  // Aplica a formatação
  if (limitado.length <= 3) {
    return limitado;
  } else if (limitado.length <= 6) {
    return limitado.replace(/(\d{3})(\d+)/, '$1.$2');
  } else if (limitado.length <= 9) {
    return limitado.replace(/(\d{3})(\d{3})(\d+)/, '$1.$2.$3');
  } else {
    return limitado.replace(/(\d{3})(\d{3})(\d{3})(\d+)/, '$1.$2.$3-$4');
  }
}

// Função para extrair apenas números do CPF (para envio ao backend)
function extrairNumerosCPF(cpfFormatado) {
  return cpfFormatado.replace(/\D/g, '');
}

// Configurar formatação automática do CPF quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
  const campoCPF = document.getElementById('filtroNomeServidor');
  
  if (campoCPF) {
    campoCPF.addEventListener('input', (e) => {
      const valor = e.target.value;
      
      // Verifica se o valor contém apenas números (possível CPF)
      if (/^\d/.test(valor) && !/[a-zA-Z]/.test(valor)) {
        const valorFormatado = formatarCPF(valor);
        
        // Atualiza o valor apenas se mudou para evitar loop
        if (valorFormatado !== valor) {
          e.target.value = valorFormatado;
        }
      }
    });
  }
});
