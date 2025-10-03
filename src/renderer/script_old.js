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
    
    // Sistema de memória/histórico
    this.cpfHistory = [];
    this.ojHistory = [];
    this.profileHistory = [];
    
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadPeritos();
    await this.loadServidores();
    await this.loadConfig();
    this.loadHistory(); // Carregar histórico
    this.updateSelectedPeritosDisplay();
    this.updateSelectedServidoresDisplay();
    this.initTabs();
    this.setupServidorAutomationListeners();
    this.setupServidorV2Listeners();
    this.setupAutocomplete(); // Configurar autocomplete
    this.loadServidorV2Config();
    this.updateV2StatusIndicator();
        
    // Listen for automation status updates
    window.electronAPI.onAutomationStatus((data) => {
      this.addStatusMessage(data.type, data.message);
      this.updateLoadingProgress(data);
    });
    
    // Listen for automation reports
    window.electronAPI.onAutomationReport((data) => {
      if (data.type === 'final-report') {
        this.showFinalReport(data.relatorio);
      }
    });
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
  }

  setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Perito management
    document.getElementById('add-perito').addEventListener('click', () => {
      this.openPeritoModal();
    });

    document.getElementById('import-peritos').addEventListener('click', () => {
      this.importPeritos();
    });

    document.getElementById('export-peritos').addEventListener('click', () => {
      this.exportPeritos();
    });

    // Servidor management
    document.getElementById('add-servidor').addEventListener('click', () => {
      this.openServidorModal();
    });

    document.getElementById('import-servidores').addEventListener('click', () => {
      this.importServidores();
    });

    document.getElementById('export-servidores').addEventListener('click', () => {
      this.exportServidores();
    });

    // Modal events
    document.querySelector('.close').addEventListener('click', () => {
      this.closePeritoModal();
    });

    document.getElementById('cancel-perito').addEventListener('click', () => {
      this.closePeritoModal();
    });

    document.getElementById('cancel-servidor').addEventListener('click', () => {
      this.closeServidorModal();
    });

    document.getElementById('perito-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.savePeito();
    });

    document.getElementById('servidor-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveServidor();
    });

    // Config form
    document.getElementById('config-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveConfig();
    });

    // Select all checkboxes
    document.getElementById('select-all').addEventListener('change', (e) => {
      this.selectAllPeritos(e.target.checked);
    });

    document.getElementById('select-all-servidores').addEventListener('change', (e) => {
      this.selectAllServidores(e.target.checked);
    });

    // Automation
    document.getElementById('start-automation').addEventListener('click', () => {
      this.startAutomation();
    });

    document.getElementById('stop-automation').addEventListener('click', () => {
      this.stopAutomation();
    });

    document.getElementById('start-servidor-automation').addEventListener('click', () => {
      this.startServidorAutomation();
    });

    document.getElementById('stop-servidor-automation').addEventListener('click', () => {
      this.stopServidorAutomation();
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
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');

    // Update selected displays when switching to automation tab
    if (tabName === 'automation') {
      this.updateSelectedPeritosDisplay();
      this.updateSelectedServidoresDisplay();
    }
  }

  async loadPeritos() {
    try {
      this.peritos = await window.electronAPI.loadPeritos();
      this.renderPeritosTable();
    } catch (error) {
      console.error('Erro ao carregar peritos:', error);
      this.showNotification('Erro ao carregar peritos', 'error');
    }
  }

  async savePeritos() {
    try {
      const result = await window.electronAPI.savePeritos(this.peritos);
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

  async loadServidores() {
    try {
      this.servidores = await window.electronAPI.loadData('servidores.json') || [];
      this.renderServidoresTable();
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
    const tbody = document.getElementById('servidores-tbody');
    if (!tbody) {
      console.log('Elemento servidores-tbody não encontrado');
      return;
    }
        
    tbody.innerHTML = '';
        
    this.servidores.forEach((servidor, index) => {
      const isSelected = this.selectedServidores && this.selectedServidores.includes(index);
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><input type="checkbox" ${isSelected ? 'checked' : ''} onchange="app.toggleServidorSelection(${index})"></td>
        <td>${servidor.nome}</td>
        <td>${servidor.cpf}</td>
        <td>${servidor.perfil}</td>
        <td>${servidor.ojs ? servidor.ojs.map(oj => typeof oj === 'object' ? (oj.oj || oj.nome || oj.orgaoJulgador || JSON.stringify(oj)) : oj).join(', ') : 'Não definido'}</td>
        <td>
          <button onclick="app.editServidor(${index})" class="btn btn-sm btn-primary">
            <i class="fas fa-edit"></i> Editar
          </button>
          <button onclick="app.deleteServidor(${index})" class="btn btn-sm btn-danger">
            <i class="fas fa-trash"></i> Excluir
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });
  }

  async deleteServidor(index) {
    if (confirm('Tem certeza que deseja excluir este servidor?')) {
      this.servidores.splice(index, 1);
      await this.saveServidores();
      this.renderServidoresTable();
      this.updateSelectedServidoresDisplay();
    }
  }

  updateServidorControls() {
    // Verificar se há configuração
    const hasConfig = this.hasServidorV2Config();
        
    // Atualizar display de status
    const selectionDisplay = document.getElementById('selected-servidores-display');
    if (selectionDisplay) {
      selectionDisplay.innerHTML = hasConfig 
        ? '<small>✅ Configuração ativa</small>'
        : '<small>⚙️ Configure a automação</small>';
    }
        
    // Atualizar lista de configuração
    this.updateSelectedServidoresDisplay();
        
    // Atualizar botão de automação
    const automationBtn = document.getElementById('startServidorAutomation');
    if (automationBtn) {
      automationBtn.disabled = !hasConfig;
    }
  }


  updateSelectedServidoresDisplay() {
    const container = document.getElementById('selected-servidores-list');
    if (!container) return;
        
    // Verificar se há configuração V2
    const hasConfig = this.hasServidorV2Config();
    if (!hasConfig) {
      container.innerHTML = '<p class="no-selection">Configure a automação para começar</p>';
      return;
    }

    // Carregar configuração V2 e mostrar os detalhes
    try {
      const saved = localStorage.getItem('configServidorV2');
      if (saved) {
        const config = JSON.parse(saved);
        container.innerHTML = `
                    <div class="selected-item">
                        <h4>Configuração Ativa</h4>
                        <p><strong>CPF:</strong> ${config.cpf}</p>
                        <p><strong>Perfil:</strong> ${config.perfil || 'Assessor'}</p>
                        <p><strong>OJs:</strong> ${config.orgaos ? config.orgaos.length : 0} órgão(s) julgador(es)</p>
                        ${config.orgaos && config.orgaos.length > 0 ? `<small class="oj-preview">${config.orgaos.slice(0, 2).map(oj => typeof oj === 'object' ? (oj.oj || oj.nome || oj.orgaoJulgador || JSON.stringify(oj)) : oj).join(', ')}${config.orgaos.length > 2 ? '...' : ''}</small>` : ''}
                    </div>
                `;
      } else {
        container.innerHTML = '<p class="no-selection">Configure a automação para começar</p>';
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
      container.innerHTML = '<p class="no-selection">Erro na configuração</p>';
    }
  }

  // Métodos de automação de servidores (apenas V2)

  setupServidorAutomationListeners() {
    const startBtn = document.getElementById('startServidorAutomation');
    const stopBtn = document.getElementById('stopServidorAutomation');
        
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        this.startServidorAutomationV2();
      });
    }
        
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        this.stopServidorAutomationV2();
      });
    }
        
    // Configurar listener para progresso da automação
    if (window.electronAPI && window.electronAPI.onAutomationProgress) {
      window.electronAPI.onAutomationProgress((data) => {
        if (data.type === 'servidor-progress') {
          this.updateProgress(data.current, data.total);
          this.showNotification(data.message, data.status || 'info');
        }
      });
    }
  }

  setupServidorV2Listeners() {
    // Configurar V2 button
    const configBtn = document.getElementById('configServidorV2');
    if (configBtn) {
      configBtn.addEventListener('click', async () => {
        await this.openServidorV2Modal();
      });
    }

    // Modal close buttons
    const closeBtn = document.querySelector('#servidor-v2-modal .close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.closeServidorV2Modal();
      });
    }

    // Save config button
    const saveConfigBtn = document.getElementById('save-v2-config');
    if (saveConfigBtn) {
      saveConfigBtn.addEventListener('click', (e) => {
        e.preventDefault();
                
        // Feedback imediato
        const originalText = saveConfigBtn.innerHTML;
        saveConfigBtn.disabled = true;
        saveConfigBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
                
        // Executar salvamento de forma assíncrona
        setTimeout(() => {
          try {
            this.saveServidorV2Config();
          } catch (error) {
            console.error('Erro ao salvar:', error);
            // Restaurar botão em caso de erro
            saveConfigBtn.disabled = false;
            saveConfigBtn.innerHTML = originalText;
            this.showNotification('Erro ao salvar configuração', 'error');
          }
        }, 10); // Delay mínimo para mostrar o spinner
      });
    }

    // Test config button
    const testConfigBtn = document.getElementById('test-v2-config');
    if (testConfigBtn) {
      testConfigBtn.addEventListener('click', () => {
        this.testServidorV2Config();
      });
    }

    // CPF formatting
    const cpfInput = document.getElementById('v2-cpf');
    if (cpfInput) {
      cpfInput.addEventListener('input', (e) => {
        this.formatCPF(e.target);
      });
    }
  }

  async loadConfig() {
    try {
      const config = await window.electronAPI.loadConfig();
            
      document.getElementById('pje-url').value = config.PJE_URL || '';
      document.getElementById('login').value = config.LOGIN || '';
      document.getElementById('password').value = config.PASSWORD || '';
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
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

  renderPeritosTable() {
    const tbody = document.getElementById('peritos-tbody');
    tbody.innerHTML = '';

    this.peritos.forEach((perito, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
                <td>
                    <input type="checkbox" class="perito-checkbox" data-index="${index}" 
                           ${this.selectedPeritos.includes(index) ? 'checked' : ''}>
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
          if (!this.selectedPeritos.includes(index)) {
            this.selectedPeritos.push(index);
          }
        } else {
          this.selectedPeritos = this.selectedPeritos.filter(i => i !== index);
        }
        this.updateAutomationButton();
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
        if (!this.selectedPeritos.includes(index)) {
          this.selectedPeritos.push(index);
        }
      } else {
        this.selectedPeritos = this.selectedPeritos.filter(i => i !== index);
      }
    });
    this.updateAutomationButton();
  }

  updateAutomationButton() {
    const startButton = document.getElementById('start-automation');
    startButton.disabled = this.selectedPeritos.length === 0 || this.isAutomationRunning;
  }

  updateSelectedPeritosDisplay() {
    const container = document.getElementById('selected-peritos-list');
        
    if (this.selectedPeritos.length === 0) {
      container.innerHTML = '<p class="no-selection">Nenhum perito selecionado</p>';
      return;
    }

    const selectedPeritosList = this.selectedPeritos.map(index => {
      const perito = this.peritos[index];
      return `
                <div class="selected-item">
                    <h4>${perito.nome}</h4>
                    <p>CPF: ${perito.cpf}</p>
                    <p>OJs: ${perito.ojs.length} órgão(s)</p>
                </div>
            `;
    }).join('');

    container.innerHTML = selectedPeritosList;
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

    const ojs = ojsText ? ojsText.split('\n').map(oj => oj.trim()).filter(oj => oj) : [];
        
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

  async importPeritos() {
    try {
      const result = await window.electronAPI.showOpenDialog();
      if (!result.canceled && result.filePaths.length > 0) {
        // Here you would read the file and parse it
        // For now, we'll show a placeholder message
        this.showNotification('Funcionalidade de importação será implementada', 'info');
      }
    } catch (error) {
      this.showNotification('Erro ao importar peritos', 'error');
    }
  }

  async exportPeritos() {
    try {
      const result = await window.electronAPI.showSaveDialog();
      if (!result.canceled) {
        // Here you would save the file
        // For now, we'll show a placeholder message
        this.showNotification('Funcionalidade de exportação será implementada', 'info');
      }
    } catch (error) {
      this.showNotification('Erro ao exportar peritos', 'error');
    }
  }

  // ===== SERVIDOR MANAGEMENT METHODS =====

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
      document.getElementById('servidor-ojs').value = servidor.ojs ? servidor.ojs.join('\n') : '';
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

    const ojs = ojsText ? ojsText.split('\n').map(oj => oj.trim()).filter(oj => oj) : [];
        
    const servidor = { nome, cpf, perfil, ojs };
        
    if (this.currentEditingServidorIndex >= 0) {
      this.servidores[this.currentEditingServidorIndex] = servidor;
    } else {
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

  async importServidores() {
    try {
      const result = await window.electronAPI.showOpenDialog();
      if (!result.canceled && result.filePaths.length > 0) {
        // Here you would read the file and parse it
        // For now, we'll show a placeholder message
        this.showNotification('Funcionalidade de importação será implementada', 'info');
      }
    } catch (error) {
      this.showNotification('Erro ao importar servidores', 'error');
    }
  }

  async exportServidores() {
    try {
      const result = await window.electronAPI.showSaveDialog();
      if (!result.canceled) {
        // Here you would save the file
        // For now, we'll show a placeholder message
        this.showNotification('Funcionalidade de exportação será implementada', 'info');
      }
    } catch (error) {
      this.showNotification('Erro ao exportar servidores', 'error');
    }
  }

  toggleServidorSelection(index) {
    const checkboxIndex = this.selectedServidores.indexOf(index);
        
    if (checkboxIndex >= 0) {
      this.selectedServidores.splice(checkboxIndex, 1);
    } else {
      this.selectedServidores.push(index);
    }
        
    this.updateSelectedServidoresDisplay();
    this.renderServidoresTable();
  }

  selectAllServidores(selectAll) {
    if (selectAll) {
      this.selectedServidores = this.servidores.map((_, index) => index);
    } else {
      this.selectedServidores = [];
    }
        
    this.updateSelectedServidoresDisplay();
    this.renderServidoresTable();
  }

  updateSelectedServidoresDisplay() {
    const container = document.getElementById('selected-servidores-list');
    if (!container) return;

    if (this.selectedServidores.length === 0) {
      container.innerHTML = '<p class="no-selection">Nenhum servidor selecionado</p>';
      return;
    }

    const selectedServidoresList = this.selectedServidores.map(index => {
      const servidor = this.servidores[index];
      return `
                <div class="selected-item">
                    <strong>${servidor.nome}</strong>
                    <div class="selected-details">
                        CPF: ${servidor.cpf} | Perfil: ${servidor.perfil}<br>
                        OJs: ${servidor.ojs ? servidor.ojs.length : 0} órgão(s) julgador(es)
                    </div>
                </div>
            `;
    }).join('');

    container.innerHTML = selectedServidoresList;
    
    // Update counter display
    const displayElement = document.getElementById('selected-servidores-display');
    if (displayElement) {
      displayElement.innerHTML = `<small>${this.selectedServidores.length} de ${this.servidores.length} servidores selecionados</small>`;
    }
  }

  async startAutomation() {
    if (this.selectedPeritos.length === 0) {
      this.showNotification('Selecione pelo menos um perito para iniciar a automação', 'warning');
      return;
    }

    this.isAutomationRunning = true;
    const startButton = document.getElementById('start-automation');
    const stopButton = document.getElementById('stop-automation');
    startButton.disabled = true;
    startButton.classList.add('loading');
    stopButton.disabled = false;
    this.updateAutomationButton();
        
    // Calcular total de passos para progress
    const selectedPeritosList = this.selectedPeritos.map(index => this.peritos[index]);
    this.totalSteps = selectedPeritosList.reduce((total, perito) => {
      return total + 3 + perito.ojs.length; // login + navegação + verificação + OJs
    }, 0);
    this.currentProgress = 0;
        
    this.showLoading('Iniciando automação...', 'Preparando sistema e abrindo navegador');
    this.clearStatusLog();
    this.addStatusMessage('info', 'Iniciando automação...');
        
    try {
      const result = await window.electronAPI.startAutomation(selectedPeritosList);
            
      if (!result || !result.success) {
        this.addStatusMessage('error', 'Erro na automação: ' + (result && result.error ? result.error : 'Erro desconhecido'));
      }
    } catch (error) {
      this.addStatusMessage('error', 'Erro ao iniciar automação: ' + error.message);
    } finally {
      this.hideLoading();
      startButton.classList.remove('loading');
      this.isAutomationRunning = false;
      startButton.disabled = false;
      // Manter o botão de parar habilitado para permitir fechar o navegador manualmente
      stopButton.disabled = false;
      this.updateAutomationButton();
    }
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
      const stopButton = document.getElementById('stop-automation');
      startButton.disabled = false;
      stopButton.disabled = true;
      this.updateAutomationButton();
    });
  }

  // ===== SERVIDOR AUTOMATION METHODS =====

  async startServidorAutomation() {
    if (this.selectedServidores.length === 0) {
      this.showNotification('Selecione pelo menos um servidor para iniciar a automação', 'warning');
      return;
    }

    this.isAutomationRunning = true;
    const startButton = document.getElementById('start-servidor-automation');
    const stopButton = document.getElementById('stop-servidor-automation');
    startButton.disabled = true;
    startButton.classList.add('loading');
    stopButton.disabled = false;
        
    // Calcular total de passos para progress
    const selectedServidoresList = this.selectedServidores.map(index => this.servidores[index]);
    this.totalSteps = selectedServidoresList.reduce((total, servidor) => {
      return total + 3 + (servidor.ojs ? servidor.ojs.length : 0); // login + navegação + verificação + OJs
    }, 0);
    this.currentProgress = 0;
        
    this.showLoading('Iniciando automação de servidores...', 'Preparando sistema e abrindo navegador');
    this.clearStatusLog();
    this.addStatusMessage('info', 'Iniciando automação de servidores...');
        
    try {
      // Usar a automação V2 com os dados dos servidores selecionados
      for (const index of this.selectedServidores) {
        const servidor = this.servidores[index];
        
        const config = {
          cpf: servidor.cpf,
          perfil: servidor.perfil,
          orgaos: servidor.ojs ? servidor.ojs.join('\n') : '',
          production: true,
          detailedReport: true,
          useCache: true,
          timeout: 30,
          maxLoginAttempts: 3
        };
        
        this.addStatusMessage('info', `Processando servidor: ${servidor.nome}`);
        
        const result = await window.electronAPI.invoke('start-servidor-automation-v2', config);
        
        if (!result || !result.success) {
          this.addStatusMessage('error', `Erro na automação do servidor ${servidor.nome}: ${result && result.error ? result.error : 'Erro desconhecido'}`);
        } else {
          this.addStatusMessage('success', `Automação do servidor ${servidor.nome} concluída com sucesso`);
        }
      }
    } catch (error) {
      this.addStatusMessage('error', 'Erro ao executar automação de servidores: ' + error.message);
    } finally {
      this.hideLoading();
      startButton.classList.remove('loading');
      this.isAutomationRunning = false;
      startButton.disabled = false;
      stopButton.disabled = false;
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
      if (startButton) startButton.disabled = false;
      if (stopButton) stopButton.disabled = true;
    }
  }

  addStatusMessage(type, message) {
    const statusLog = document.getElementById('status-log');
    const timestamp = new Date().toLocaleTimeString();
        
    const statusItem = document.createElement('div');
    statusItem.className = `status-item ${type}`;
    statusItem.textContent = `[${timestamp}] ${message}`;
        
    statusLog.appendChild(statusItem);
    statusLog.scrollTop = statusLog.scrollHeight;
  }

  clearStatusLog() {
    document.getElementById('status-log').innerHTML = '';
  }

  showFinalReport(relatorio) {
    const total = relatorio.totalOJs;
    const processados = relatorio.ojsVinculados + relatorio.ojsJaVinculados;
    const porcentagemSucesso = total > 0 ? Math.round((processados / total) * 100) : 0;
    const tempoFinal = new Date().toLocaleString('pt-BR');
    
    // Criar modal do relatório final
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content report-modal">
        <div class="modal-header">
          <h2>🎯 Relatório Final - Automação de Peritos</h2>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="report-timestamp">
            <p><strong>Finalizado em:</strong> ${tempoFinal}</p>
            <p><strong>Taxa de Sucesso:</strong> ${porcentagemSucesso}% (${processados}/${total} OJs processados)</p>
          </div>
          
          <div class="report-summary">
            <div class="summary-grid">
              <div class="summary-item success">
                <div class="summary-icon">✅</div>
                <div class="summary-number">${relatorio.ojsVinculados}</div>
                <div class="summary-label">Novos Vínculos</div>
              </div>
              <div class="summary-item info">
                <div class="summary-icon">ℹ️</div>
                <div class="summary-number">${relatorio.ojsJaVinculados}</div>
                <div class="summary-label">Já Vinculados</div>
              </div>
              <div class="summary-item warning">
                <div class="summary-icon">⚠️</div>
                <div class="summary-number">${relatorio.ojsNaoEncontrados.length}</div>
                <div class="summary-label">Não Encontrados</div>
              </div>
              <div class="summary-item error">
                <div class="summary-icon">❌</div>
                <div class="summary-number">${relatorio.ojsComErro.length}</div>
                <div class="summary-label">Com Erro</div>
              </div>
            </div>
          </div>
          
          <div class="report-status">
            <div class="status-message ${porcentagemSucesso >= 80 ? 'success' : porcentagemSucesso >= 50 ? 'warning' : 'error'}">
              ${porcentagemSucesso >= 80 ? 
    '🎉 Excelente! A maioria dos OJs foi processada com sucesso.' :
    porcentagemSucesso >= 50 ? 
      '⚠️ Atenção! Alguns OJs não puderam ser processados.' :
      '❌ Vários problemas encontrados. Verifique os detalhes abaixo.'
}
            </div>
          </div>
          
          ${relatorio.ojsNaoEncontrados.length > 0 ? `
            <div class="report-section">
              <h3>⚠️ OJs Não Encontrados (${relatorio.ojsNaoEncontrados.length})</h3>
              <div class="report-list">
                ${relatorio.ojsNaoEncontrados.map(oj => `
                  <div class="report-item error">
                    <div class="item-header">
                      <strong>${oj.nome}</strong>
                      <span class="perito-name">Perito: ${oj.perito}</span>
                    </div>
                    <div class="item-details">
                      ${oj.motivo}
                      ${oj.opcoesDisponiveis && oj.opcoesDisponiveis.length > 0 ? 
    `<details class="options-details">
                          <summary>Ver opções disponíveis (${oj.opcoesDisponiveis.length})</summary>
                          <div class="options-list">
                            ${oj.opcoesDisponiveis.slice(0, 20).map(opcao => `<span class="option-tag">${opcao}</span>`).join('')}
                            ${oj.opcoesDisponiveis.length > 20 ? `<span class="more-options">... e mais ${oj.opcoesDisponiveis.length - 20}</span>` : ''}
                          </div>
                        </details>` : ''
}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
          
          ${relatorio.ojsComErro.length > 0 ? `
            <div class="report-section">
              <h3>❌ OJs com Erro (${relatorio.ojsComErro.length})</h3>
              <div class="report-list">
                ${relatorio.ojsComErro.map(oj => `
                  <div class="report-item error">
                    <div class="item-header">
                      <strong>${oj.nome}</strong>
                      <span class="perito-name">Perito: ${oj.perito}</span>
                    </div>
                    <div class="item-details">
                      <strong>Erro:</strong> ${oj.erro}
                      <br><strong>Código:</strong> ${oj.codigo}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
          
          ${relatorio.ojsNaoEncontrados.length > 0 ? `
            <div class="report-recommendations">
              <h3>💡 Recomendações</h3>
              <div class="recommendations-list">
                <div class="recommendation-item">
                  <strong>✓ Para OJs Não Encontrados:</strong>
                  <p>Verifique se os nomes dos órgãos julgadores estão corretos. Consulte as opções disponíveis exibidas acima e ajuste os nomes conforme necessário.</p>
                </div>
                <div class="recommendation-item">
                  <strong>✓ Verificação Manual:</strong>
                  <p>O navegador permanece aberto para que você possa verificar os vínculos criados e fazer ajustes manuais se necessário.</p>
                </div>
                <div class="recommendation-item">
                  <strong>✓ Próximos Passos:</strong>
                  <p>Corrija os nomes dos OJs não encontrados na configuração dos peritos e execute a automação novamente para os itens pendentes.</p>
                </div>
              </div>
            </div>
          ` : ''}
          
          <div class="report-section">
            <h3>📈 Resumo por Perito</h3>
            <div class="report-list">
              ${relatorio.detalhes.map(perito => `
                <div class="report-item info">
                  <div class="item-header">
                    <strong>${perito.nome}</strong>
                    <span class="perito-name">CPF: ${perito.cpf}</span>
                  </div>
                  <div class="perito-stats">
                    <span class="stat success">${perito.ojsVinculados} vinculados</span>
                    <span class="stat warning">${perito.ojsJaVinculados} já vinculados</span>
                    <span class="stat error">${perito.ojsNaoEncontrados.length} não encontrados</span>
                    <span class="stat info">${perito.ojsComErro.length} com erro</span>
                  </div>
                  ${perito.erroProcessamento ? `
                    <div class="item-details error">
                      <strong>Erro no processamento:</strong> ${perito.erroProcessamento}
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <div class="footer-info">
            <p>🌐 <strong>Navegador mantido aberto</strong> para revisão manual dos vínculos criados</p>
            <p>💾 Exporte o relatório para manter um registro permanente da operação</p>
          </div>
          <div class="footer-actions">
            <button class="btn btn-primary export-report">📄 Exportar Relatório</button>
            <button class="btn btn-secondary close-report">✅ Concluir</button>
          </div>
        </div>
      </div>
    `;

    // Adicionar modal ao documento
    document.body.appendChild(modal);

    // Configurar eventos
    const closeButtons = modal.querySelectorAll('.modal-close, .close-report');
    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        document.body.removeChild(modal);
      });
    });

    // Configurar exportação
    const exportButton = modal.querySelector('.export-report');
    exportButton.addEventListener('click', async () => {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `relatorio-vinculacao-${timestamp}.json`;
        
        const result = await window.electronAPI.exportFile(relatorio, filename);
        if (result.success) {
          this.addStatusMessage('success', `Relatório exportado: ${result.filePath}`);
        } else if (!result.canceled) {
          this.addStatusMessage('error', `Erro ao exportar: ${result.error}`);
        }
      } catch (error) {
        this.addStatusMessage('error', `Erro ao exportar relatório: ${error.message}`);
      }
    });

    // Fechar modal clicando fora
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });

    // Mostrar log de sucesso
    this.addStatusMessage('success', 
      `Relatório gerado: ${relatorio.ojsVinculados} vinculados, ${relatorio.ojsNaoEncontrados.length} não encontrados, ${relatorio.ojsComErro.length} com erro`
    );
  }

  showLoading(title, subtitle = '') {
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingTitle = document.getElementById('loading-title');
    const loadingSubtitle = document.getElementById('loading-subtitle');
        
    loadingTitle.textContent = title;
    loadingSubtitle.textContent = subtitle;
    loadingOverlay.style.display = 'flex';
  }

  hideLoading() {
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.style.display = 'none';
  }

  updateLoadingProgress(data) {
    if (data.progress !== undefined) {
      this.currentProgress = data.progress;
      const progressBar = document.getElementById('progress-bar');
      const progressText = document.getElementById('progress-text');
            
      const percentage = this.totalSteps > 0 ? (this.currentProgress / this.totalSteps) * 100 : 0;
      progressBar.style.width = `${percentage}%`;
      progressText.textContent = `${this.currentProgress}/${this.totalSteps} passos concluídos`;
    }
        
    if (data.subtitle) {
      const loadingSubtitle = document.getElementById('loading-subtitle');
      loadingSubtitle.textContent = data.subtitle;
    }
  }

  // ===== AUTOMAÇÃO V2 METHODS =====

  async openServidorV2Modal() {
    console.log('=== ABRINDO MODAL SERVIDOR V2 ===');
    const modal = document.getElementById('servidor-v2-modal');
    console.log('Modal encontrado:', !!modal);
        
    if (modal) {
      modal.style.display = 'block';
      console.log('Modal display definido como block');
            
      // Carregar configuração salva
      this.loadServidorV2Config();
            
      console.log('✅ Modal V2 aberto com campo de texto para OJs');
    } else {
      console.error('Modal servidor-v2-modal não encontrado!');
    }
  }

  createSimpleOJSelector(container) {
    console.log('🔧 Criando seletor simples de OJs...');
        
    // Lista básica de OJs para fallback
    const basicOJList = [
      '1ª Vara do Trabalho de Campinas',
      '2ª Vara do Trabalho de Campinas', 
      '3ª Vara do Trabalho de Campinas',
      '4ª Vara do Trabalho de Campinas',
      '5ª Vara do Trabalho de Campinas',
      '6ª Vara do Trabalho de Campinas',
      '7ª Vara do Trabalho de Campinas',
      'Vara do Trabalho de Jundiaí',
      '1ª Vara do Trabalho de Jundiaí',
      '2ª Vara do Trabalho de Jundiaí',
      'Vara do Trabalho de Americana',
      'Vara do Trabalho de Limeira',
      'Vara do Trabalho de Piracicaba',
      'LIQ1 - Campinas',
      'LIQ2 - Campinas',
      'EXE1 - Campinas',
      'EXE2 - Campinas'
    ];
        
    container.innerHTML = `
            <div style="border: 1px solid #ddd; border-radius: 4px; background: white;">
                <input type="text" 
                       id="oj-search-simple" 
                       placeholder="Buscar órgãos julgadores..." 
                       style="width: 100%; padding: 10px; border: none; border-bottom: 1px solid #eee; outline: none;">
                
                <div id="oj-selected-display" style="padding: 10px; min-height: 40px; background: #f9f9f9; border-bottom: 1px solid #eee;">
                    <span style="color: #666; font-style: italic;">Nenhum órgão selecionado</span>
                </div>
                
                <div id="oj-options-list" style="max-height: 200px; overflow-y: auto; display: none;">
                    ${basicOJList.map(oj => `
                        <div class="oj-option-simple" style="padding: 8px 10px; cursor: pointer; border-bottom: 1px solid #f0f0f0;" data-oj="${oj}">
                            <input type="checkbox" style="margin-right: 8px;"> ${oj}
                        </div>
                    `).join('')}
                </div>
                
                <input type="hidden" id="selected-ojs-hidden" name="orgaos" value="">
            </div>
        `;
        
    // Configurar eventos
    const searchInput = container.querySelector('#oj-search-simple');
    const optionsList = container.querySelector('#oj-options-list');
    const selectedDisplay = container.querySelector('#oj-selected-display');
    const hiddenInput = container.querySelector('#selected-ojs-hidden');
        
    // Mostrar/esconder lista ao focar/desfocar
    searchInput.addEventListener('focus', () => {
      optionsList.style.display = 'block';
    });
        
    // Filtrar opções ao digitar
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      const options = container.querySelectorAll('.oj-option-simple');
            
      options.forEach(option => {
        const text = option.textContent.toLowerCase();
        option.style.display = text.includes(term) ? 'block' : 'none';
      });
    });
        
    // Selecionar/deselecionar opções
    container.addEventListener('click', (e) => {
      if (e.target.classList.contains('oj-option-simple') || e.target.parentElement.classList.contains('oj-option-simple')) {
        const option = e.target.classList.contains('oj-option-simple') ? e.target : e.target.parentElement;
        const checkbox = option.querySelector('input[type="checkbox"]');
                
        checkbox.checked = !checkbox.checked;
        this.updateSimpleOJSelection(container);
      }
    });
        
    // Esconder lista ao clicar fora
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        optionsList.style.display = 'none';
      }
    });
        
    console.log('✅ Seletor simples criado com', basicOJList.length, 'opções');
  }

  loadExampleOJsV2() {
    const orgaosInput = document.getElementById('v2-orgaos');
    if (!orgaosInput) {
      console.error('Campo de órgãos não encontrado');
      return;
    }
        
    const exampleOJs = [
      '1ª Vara do Trabalho de Campinas',
      '2ª Vara do Trabalho de Campinas',
      '3ª Vara do Trabalho de Campinas',
      '4ª Vara do Trabalho de Campinas',
      '5ª Vara do Trabalho de Campinas'
    ];
        
    orgaosInput.value = exampleOJs.join('\n');
        
    this.showNotification('Exemplos de OJs carregados!', 'success');
    console.log('✅ Exemplos de OJs carregados:', exampleOJs.length, 'órgãos');
  }

  async initializeOJSelectorV2() {
    const containerId = 'oj-selector-v2';
    const container = document.getElementById(containerId);
        
    console.log('=== INICIALIZANDO OJ SELECTOR V2 ===');
    console.log('Container ID:', containerId);
    console.log('Container encontrado:', !!container);
    console.log('Lista de OJs carregada:', window.ojList ? window.ojList.length : 0);
        
    if (!container) {
      console.error('❌ CONTAINER NÃO ENCONTRADO!');
      console.log('Elementos disponíveis com ID:');
      document.querySelectorAll('[id]').forEach(el => {
        console.log(`- ${el.id}: ${el.tagName}`);
      });
      return;
    }
        
    // Aguardar um pouco para garantir que o DOM está pronto
    await new Promise(resolve => setTimeout(resolve, 100));
        
    // Se a lista de OJs ainda não foi carregada, aguardar ou carregar
    if (!window.ojList || window.ojList.length === 0) {
      console.log('Lista de OJs não carregada, tentando carregar...');
      try {
        console.log('Fazendo fetch para ./orgaos_pje.json...');
        const response = await fetch('./orgaos_pje.json');
        console.log('Response status:', response.status, response.statusText);
                
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
                
        const ojData = await response.json();
        console.log('Dados carregados - tipo:', typeof ojData, 'keys:', Object.keys(ojData));
                
        // Extract all OJs from the structure
        const allOJs = [];
                
        // Processar estrutura por cidades (formato atual do arquivo)
        Object.keys(ojData).forEach(cidade => {
          if (Array.isArray(ojData[cidade])) {
            allOJs.push(...ojData[cidade]);
            console.log(`${cidade}: ${ojData[cidade].length} OJs`);
          }
        });
                
        console.log('Total de OJs antes da ordenação:', allOJs.length);
                
        // Sort alphabetically
        window.ojList = allOJs.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
        console.log('✅ Lista de OJs carregada com sucesso:', window.ojList.length, 'órgãos');
        console.log('Primeiros 5 OJs:', window.ojList.slice(0, 5));
      } catch (error) {
        console.error('❌ Erro ao carregar lista de OJs:', error);
        console.error('Stack trace:', error.stack);
                
        // Fallback to hardcoded list
        window.ojList = [
          '1ª Vara do Trabalho de Campinas',
          '2ª Vara do Trabalho de Campinas', 
          '3ª Vara do Trabalho de Campinas',
          'Vara do Trabalho de Jundiaí',
          'LIQ2 - Bauru',
          'EXE1 - São José dos Campos'
        ].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
        console.log('⚠️ Usando lista de fallback com', window.ojList.length, 'órgãos');
      }
    } else {
      console.log('✅ Lista de OJs já carregada:', window.ojList.length, 'órgãos');
    }
        
    if (container && window.ojList && window.ojList.length > 0) {
      console.log('🔧 Criando seletor...');
            
      // Clear existing selector if any
      if (window.ojSelectors && window.ojSelectors[containerId]) {
        console.log('Removendo seletor anterior...');
        delete window.ojSelectors[containerId];
      }
            
      // Ensure ojSelectors object exists
      if (!window.ojSelectors) {
        window.ojSelectors = {};
      }
            
      try {
        console.log('Instanciando OJSelector...');
        // Create new OJ selector instance
        window.ojSelectors[containerId] = new OJSelector(containerId, window.ojList);
        console.log('✅ OJ Selector V2 inicializado com sucesso com', window.ojList.length, 'órgãos');
                
        // Verificar se o seletor foi criado corretamente
        const selector = window.ojSelectors[containerId];
        console.log('Seletor criado:', !!selector);
        console.log('Container do seletor:', !!selector?.container);
        console.log('Search input:', !!selector?.searchInput);
        console.log('Dropdown:', !!selector?.dropdown);
                
        // Forçar renderização inicial
        if (selector && selector.renderOptions) {
          selector.renderOptions();
          console.log('✅ Renderização inicial forçada');
        }
                
      } catch (error) {
        console.error('❌ Erro ao inicializar OJ Selector V2:', error);
        console.error('Stack trace:', error.stack);
      }
    } else {
      console.warn('❌ Falha na inicialização:');
      console.warn('- Container:', !!container);
      console.warn('- OJ List existe:', !!window.ojList);
      console.warn('- OJ List length:', window.ojList?.length || 0);
    }
  }

  closeServidorV2Modal() {
    const modal = document.getElementById('servidor-v2-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  addOrgaoV2() {
    const container = document.getElementById('orgaos-list-v2');
    if (!container) return;
        
    const orgaoDiv = document.createElement('div');
    orgaoDiv.className = 'orgao-item';
    orgaoDiv.innerHTML = `
            <input type="text" placeholder="Nome do Órgão Julgador" class="orgao-input" required>
            <button type="button" class="btn btn-danger btn-sm remove-orgao">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
    orgaoDiv.querySelector('.remove-orgao').addEventListener('click', () => {
      orgaoDiv.remove();
    });
        
    container.appendChild(orgaoDiv);
  }

  loadExampleOrgaosV2() {
    const container = document.getElementById('orgaos-list-v2');
    if (!container) return;
        
    container.innerHTML = ''; // Clear existing
        
    const exampleOrgaos = [
      '1ª Vara do Trabalho de Campinas',
      '2ª Vara do Trabalho de Campinas',
      '3ª Vara do Trabalho de Campinas',
      '4ª Vara do Trabalho de Campinas',
      '5ª Vara do Trabalho de Campinas'
    ];
        
    exampleOrgaos.forEach(orgao => {
      const orgaoDiv = document.createElement('div');
      orgaoDiv.className = 'orgao-item';
      orgaoDiv.innerHTML = `
                <input type="text" value="${orgao}" class="orgao-input" required>
                <button type="button" class="btn btn-danger btn-sm remove-orgao">
                    <i class="fas fa-trash"></i>
                </button>
            `;
            
      orgaoDiv.querySelector('.remove-orgao').addEventListener('click', () => {
        orgaoDiv.remove();
      });
            
      container.appendChild(orgaoDiv);
    });
  }

  formatCPF(input) {
    let value = input.value.replace(/\D/g, '');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    input.value = value;
  }

  saveServidorV2Config() {
    const config = this.getServidorV2Config();
    if (!config) return;
        
    try {
      // Salvar no localStorage (operação rápida)
      localStorage.setItem('configServidorV2', JSON.stringify(config));
      
      // Salvar CPF no histórico para autocomplete
      if (config.cpf) {
        this.saveCpfToHistory(config.cpf, 'servidor');
      }
      
      // Salvar órgãos no histórico para autocomplete
      if (config.orgaos && config.orgaos.length > 0) {
        config.orgaos.forEach(orgao => this.saveOjToHistory(orgao));
      }
            
      // Atualizar interface imediatamente
      this.updateV2StatusIndicator();
      this.updateServidorControls();
            
      // Fechar modal imediatamente
      this.closeServidorV2Modal();
            
      // Mostrar notificação de sucesso
      this.showNotification('Configuração salva com sucesso!', 'success');
            
      console.log('✅ Configuração V2 salva:', {
        cpf: config.cpf ? '***' + config.cpf.slice(-3) : 'vazio',
        perfil: config.perfil,
        orgaosCount: config.orgaos.length
      });
            
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      this.showNotification('Erro ao salvar configuração', 'error');
    }
  }

  loadServidorV2Config() {
    const saved = localStorage.getItem('configServidorV2');
    if (saved) {
      try {
        const config = JSON.parse(saved);
        this.populateServidorV2Form(config);
      } catch (error) {
        console.error('Erro ao carregar configuração V2:', error);
      }
    }
  }

  populateServidorV2Form(config) {
    const cpfInput = document.getElementById('v2-cpf');
    const perfilInput = document.getElementById('v2-perfil');
    const orgaosInput = document.getElementById('v2-orgaos');
    const productionInput = document.getElementById('v2-production');
    const detailedReportInput = document.getElementById('v2-detailed-report');
    const useCacheInput = document.getElementById('v2-use-cache');
    const timeoutInput = document.getElementById('v2-timeout');
    const maxLoginAttemptsInput = document.getElementById('v2-max-login-attempts');
        
    if (cpfInput) cpfInput.value = config.cpf || '';
    if (perfilInput) perfilInput.value = config.perfil || 'Assessor';
    if (productionInput) productionInput.checked = config.production !== false;
    if (detailedReportInput) detailedReportInput.checked = config.detailedReport !== false;
    if (useCacheInput) useCacheInput.checked = config.useCache !== false;
    if (timeoutInput) timeoutInput.value = config.timeout || 30;
    if (maxLoginAttemptsInput) maxLoginAttemptsInput.value = config.maxLoginAttempts || 3;
        
    // Populate órgãos no textarea (um por linha)
    if (orgaosInput && config.orgaos && config.orgaos.length > 0) {
      orgaosInput.value = config.orgaos.join('\n');
      console.log('✅ OJs populados no textarea:', config.orgaos.length, 'órgãos');
    }
  }

  hasServidorV2Config() {
    // Verificar se há configuração salva no localStorage
    const saved = localStorage.getItem('configServidorV2');
    if (saved) {
      try {
        const config = JSON.parse(saved);
        return config && config.cpf && config.orgaos && config.orgaos.length > 0;
      } catch (error) {
        return false;
      }
    }
    return false;
  }

  getServidorV2Config() {
    const cpfInput = document.getElementById('v2-cpf');
    const perfilInput = document.getElementById('v2-perfil');
    const orgaosInput = document.getElementById('v2-orgaos');
        
    const cpf = cpfInput ? cpfInput.value.trim() : '';
    const perfil = perfilInput ? perfilInput.value.trim() : '';
    const orgaosText = orgaosInput ? orgaosInput.value.trim() : '';
        
    if (!cpf) {
      this.showNotification('CPF é obrigatório', 'error');
      return null;
    }
        
    // Parse órgãos julgadores do textarea (um por linha)
    const orgaos = orgaosText
      .split('\n')
      .map(linha => linha.trim())
      .filter(linha => linha.length > 0);
        
    if (orgaos.length === 0) {
      this.showNotification('Pelo menos um órgão julgador é obrigatório', 'error');
      return null;
    }
        
    const pjeUrlInput = document.getElementById('pje-url');
    const productionInput = document.getElementById('v2-production');
    const detailedReportInput = document.getElementById('v2-detailed-report');
    const useCacheInput = document.getElementById('v2-use-cache');
    const timeoutInput = document.getElementById('v2-timeout');
    const maxLoginAttemptsInput = document.getElementById('v2-max-login-attempts');
        
    const config = {
      cpf,
      perfil: perfil || 'Assessor',
      orgaos,
      url: pjeUrlInput ? pjeUrlInput.value : 'https://pje.trt15.jus.br',
      production: productionInput ? productionInput.checked : true,
      detailedReport: detailedReportInput ? detailedReportInput.checked : true,
      useCache: useCacheInput ? useCacheInput.checked : true,
      timeout: timeoutInput ? parseInt(timeoutInput.value) || 30 : 30,
      maxLoginAttempts: maxLoginAttemptsInput ? parseInt(maxLoginAttemptsInput.value) || 3 : 3
    };
        
    console.log('📋 Configuração V2 obtida:', {
      cpf: config.cpf ? '***' + config.cpf.slice(-3) : 'vazio',
      perfil: config.perfil,
      orgaosCount: config.orgaos.length,
      orgaos: config.orgaos.slice(0, 3) // Mostrar apenas os 3 primeiros
    });
        
    return config;
  }

  async testServidorV2Config() {
    const config = this.getServidorV2Config();
    if (!config) return;
        
    try {
      this.showLoading('Testando Configuração V2', 'Validando parâmetros...');
            
      const result = await window.electronAPI.invoke('validate-servidor-config-v2', config);
            
      this.hideLoading();
            
      if (result.success) {
        this.showNotification('Configuração válida!', 'success');
      } else {
        this.showNotification(`Erro na configuração: ${result && result.error ? result.error : 'Erro desconhecido'}`, 'error');
      }
    } catch (error) {
      this.hideLoading();
      this.showNotification(`Erro ao testar configuração: ${error.message}`, 'error');
    }
  }

  async startServidorAutomationV2() {
    const config = this.getServidorV2Config();
    if (!config) {
      this.showNotification('Configure a automação V2 primeiro', 'warning');
      this.openServidorV2Modal();
      return;
    }
        
    try {
      this.showLoading('Iniciando Automação V2', 'Preparando sistema...');
            
      const result = await window.electronAPI.invoke('start-servidor-automation-v2', config);
            
      if (result.success) {
        this.isServidorAutomationRunning = true;
        this.updateServidorControls();
        this.showNotification('Automação V2 iniciada com sucesso!', 'success');
                
        // Start monitoring
        this.monitorServidorV2Automation();
      } else {
        this.hideLoading();
        this.showNotification(`Erro ao iniciar automação V2: ${result && result.error ? result.error : 'Erro desconhecido'}`, 'error');
      }
    } catch (error) {
      this.hideLoading();
      this.showNotification(`Erro ao iniciar automação V2: ${error.message}`, 'error');
    }
  }

  async stopServidorAutomationV2() {
    try {
      const result = await window.electronAPI.invoke('stop-servidor-automation-v2');
            
      if (result.success) {
        this.isServidorAutomationRunning = false;
        this.updateServidorControls();
        this.hideLoading();
        this.showNotification('Automação V2 parada com sucesso!', 'info');
      } else {
        this.showNotification(`Erro ao parar automação V2: ${result && result.error ? result.error : 'Erro desconhecido'}`, 'error');
      }
    } catch (error) {
      this.showNotification(`Erro ao parar automação V2: ${error.message}`, 'error');
    }
  }

  async monitorServidorV2Automation() {
    const checkStatus = async () => {
      if (!this.isServidorAutomationRunning) return;
            
      try {
        const status = await window.electronAPI.invoke('get-servidor-automation-v2-status');
                
        if (status.isRunning) {
          this.updateLoadingProgress({
            progress: status.progress || 0,
            current: status.processedCount || 0,
            total: status.totalOrgaos || 0
          });
                    
          // Continue monitoring
          setTimeout(checkStatus, 2000);
        } else {
          // Automation finished
          this.isServidorAutomationRunning = false;
          this.updateServidorControls();
          this.hideLoading();
                    
          // Get final report
          const reportResult = await window.electronAPI.invoke('get-servidor-automation-v2-report');
          if (reportResult.success && reportResult.relatorio) {
            this.showServidorV2Report(reportResult.relatorio);
          }
                    
          this.showNotification('Automação V2 concluída!', 'success');
        }
      } catch (error) {
        console.error('Erro ao monitorar automação V2:', error);
        setTimeout(checkStatus, 5000); // Retry after 5 seconds
      }
    };
        
    checkStatus();
  }

  showServidorV2Report(relatorio) {
    const reportWindow = window.open('', '_blank', 'width=800,height=600');
    reportWindow.document.write(`
            <html>
                <head>
                    <title>Relatório de Automação V2</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
                        .success { color: #28a745; }
                        .error { color: #dc3545; }
                        .warning { color: #ffc107; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                    </style>
                </head>
                <body>
                    <h1>Relatório de Automação V2 - Servidores</h1>
                    <div class="summary">
                        <h3>Resumo</h3>
                        <p><strong>Total de Órgãos:</strong> ${relatorio.resumo?.total || 0}</p>
                        <p class="success"><strong>Sucessos:</strong> ${relatorio.resumo?.sucessos || 0} (${relatorio.resumo?.percentualSucesso || 0}%)</p>
                        <p class="error"><strong>Erros:</strong> ${relatorio.resumo?.erros || 0} (${relatorio.resumo?.percentualErros || 0}%)</p>
                        <p class="warning"><strong>Já Incluídos:</strong> ${relatorio.resumo?.jaIncluidos || 0} (${relatorio.resumo?.percentualJaIncluidos || 0}%)</p>
                    </div>
                    
                    <h3>Detalhes</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Órgão Julgador</th>
                                <th>Status</th>
                                <th>Observações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(relatorio.resultados || []).map(resultado => `
                                <tr>
                                    <td>${resultado.orgao}</td>
                                    <td class="${resultado.status.toLowerCase()}">${resultado.status}</td>
                                    <td>${resultado.observacoes || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </body>
            </html>
        `);
  }

  showNotification(message, type = 'info') {
    // Otimizada para resposta rápida
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
        
    // Estilos inline otimizados
    const colors = {
      success: '#27ae60',
      error: '#e74c3c', 
      warning: '#f39c12',
      info: '#3498db'
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
    }, 2000); // Reduzido de 3000 para 2000ms
  }

  updateV2StatusIndicator() {
    const hasConfig = this.hasServidorV2Config();
    const configBtn = document.getElementById('configServidorV2');
    const startBtn = document.getElementById('startServidorAutomation');
        
    if (configBtn) {
      if (hasConfig) {
        configBtn.innerHTML = '<i class="fas fa-check"></i> Configuração OK';
        configBtn.classList.remove('btn-secondary');
        configBtn.classList.add('btn-success');
      } else {
        configBtn.innerHTML = '<i class="fas fa-cog"></i> Configurar Automação';
        configBtn.classList.remove('btn-success');
        configBtn.classList.add('btn-secondary');
      }
    }
        
    if (startBtn) {
      startBtn.disabled = !hasConfig;
    }
  }

  // === SISTEMA DE MEMÓRIA/HISTÓRICO ===

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

  setupAutocomplete() {
    // Configurar autocomplete para CPF do perito
    this.setupCpfAutocomplete('perito-cpf', 'perito-cpf-suggestions');
    
    // Configurar autocomplete para CPF do servidor V2
    this.setupCpfAutocomplete('v2-cpf', 'v2-cpf-suggestions');
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
      return cpfNumbers.includes(searchValue);
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
            <span style="color: var(--text-light)">•</span>
            <span style="color: var(--text-light)">${item.usageCount}x usado</span>
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

  updateSuggestionSelection(items, selectedIndex) {
    items.forEach((item, index) => {
      if (index === selectedIndex) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  getTimeSince(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'há poucos minutos';
    if (diffInHours < 24) return `há ${diffInHours}h`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `há ${diffInDays}d`;
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) return `há ${diffInWeeks}sem`;
    
    const diffInMonths = Math.floor(diffInDays / 30);
    return `há ${diffInMonths}m`;
  }

  saveCpfToHistory(cpf, type) {
    // Salvar CPF no histórico quando usado
    if (cpf && cpf.length >= 11) {
      this.addToHistory('cpf', {
        cpf,
        type // 'perito' ou 'servidor'
      });
    }
  }
}

// Add CSS for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

class ServidorManager {
  constructor(app) {
    this.app = app;
  }

  openServidorModal(index = -1) {
    this.app.currentEditingServidorIndex = index;
    const modal = document.getElementById('servidor-modal');
    const title = document.getElementById('servidor-modal-title');
    const form = document.getElementById('servidor-form');
        
    // Inicializar o seletor principal de OJs primeiro
    this.initializeOJSelector();
        
    if (index >= 0) {
      title.textContent = 'Editar Servidor';
      this.populateServidorForm(this.app.servidores[index]);
    } else {
      title.textContent = 'Adicionar Servidor';
      form.reset();
      // Resetar seletor de OJs para novo servidor
      const ojSelector = window.ojSelectors['oj-selector-main'];
      if (ojSelector) {
        ojSelector.setSelectedOJs([]);
      }
    }
        
    modal.style.display = 'block';
  }

  closeServidorModal() {
    document.getElementById('servidor-modal').style.display = 'none';
    this.app.currentEditingServidorIndex = -1;
  }

  populateServidorForm(servidor) {
    document.getElementById('servidor-nome').value = servidor.nome;
    document.getElementById('servidor-cpf').value = servidor.cpf;
    document.getElementById('servidor-perfil').value = servidor.perfil || '';
        
    // Configurar OJs selecionados no seletor principal
    setTimeout(() => {
      const ojSelector = window.ojSelectors['oj-selector-main'];
      if (ojSelector) {
        // Extrair OJs dos vínculos existentes ou usar nova estrutura
        let ojs = [];
        if (servidor.ojs) {
          ojs = servidor.ojs;
        } else if (servidor.vinculos) {
          // Converter vínculos antigos para nova estrutura
          ojs = servidor.vinculos.map(v => v.localizacao).filter(Boolean);
        }
        ojSelector.setSelectedOJs(ojs);
      }
    }, 100);
  }

  initializeOJSelector() {
    const containerId = 'oj-selector-main';
    const container = document.getElementById(containerId);
    if (container) {
      // Use the global OJ list if available, otherwise use fallback
      let ojList = window.ojList;
      if (!ojList || ojList.length === 0) {
        ojList = [
          'LIQ2 - Bauru',
          'Órgão Centralizador de Leilões Judiciais de Limeira',
          'Órgão Centralizador de Leilões Judiciais de Araraquara',
          'Vara do Trabalho de Ubatuba',
          'EXE1 - São José dos Campos'
        ];
      }
      window.ojSelectors[containerId] = new OJSelector(containerId, ojList);
    }
  }

  async importServidores() {
    try {
      const result = await window.electronAPI.importFile('json');
      if (result.success) {
        this.app.servidores = result.data;
        this.app.saveServidores();
        this.app.renderServidores();
        alert('Servidores importados com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao importar servidores:', error);
      alert('Erro ao importar arquivo!');
    }
  }

  async exportServidores() {
    if (this.app.servidores.length === 0) {
      alert('Não há servidores para exportar!');
      return;
    }
        
    try {
      const result = await window.electronAPI.exportFile(this.app.servidores, 'servidores.json');
      if (result.success) {
        alert('Servidores exportados com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao exportar servidores:', error);
      alert('Erro ao exportar arquivo!');
    }
  }
}

// Initialize the app
const app = new PeritoApp();

// Make app globally available for onclick handlers
window.app = app;

// Inicializar gerenciador de servidores
const servidorManager = new ServidorManager(app);

// OJ Selector Class
class OJSelector {
  constructor(containerId, ojList) {
    this.containerId = containerId;
    this.ojList = ojList;
    this.selectedOJs = [];
    this.filteredOJs = [...ojList];
    this.init();
  }

  init() {
    this.container = document.getElementById(this.containerId);
    console.log('OJSelector init - Container:', this.container);
        
    if (!this.container) {
      console.error('Container não encontrado:', this.containerId);
      return;
    }
        
    // Buscar os elementos já existentes no HTML
    this.searchInput = this.container.querySelector('.oj-search');
    this.selectedContainer = this.container.querySelector('.oj-selected');
    this.dropdown = this.container.querySelector('.oj-dropdown');
    this.optionsContainer = this.container.querySelector('.oj-options');
    this.hiddenInput = this.container.querySelector('input[type="hidden"]');
        
    console.log('OJSelector elementos encontrados:');
    console.log('- searchInput:', !!this.searchInput);
    console.log('- selectedContainer:', !!this.selectedContainer);
    console.log('- dropdown:', !!this.dropdown);
    console.log('- optionsContainer:', !!this.optionsContainer);
    console.log('- hiddenInput:', !!this.hiddenInput);
        
    if (!this.searchInput || !this.selectedContainer || !this.dropdown || !this.optionsContainer || !this.hiddenInput) {
      console.error('Alguns elementos do OJSelector não foram encontrados');
      console.warn('Tentando criar estrutura HTML dinamicamente...');
      this.createHTML();
            
      // Tentar novamente após criar HTML
      this.searchInput = this.container.querySelector('.oj-search');
      this.selectedContainer = this.container.querySelector('.oj-selected');
      this.dropdown = this.container.querySelector('.oj-dropdown');
      this.optionsContainer = this.container.querySelector('.oj-options');
      this.hiddenInput = this.container.querySelector('input[type="hidden"]');
    }
        
    if (!this.searchInput || !this.selectedContainer || !this.dropdown || !this.optionsContainer || !this.hiddenInput) {
      console.error('Falha crítica: elementos do OJSelector não puderam ser inicializados');
      return;
    }
        
    // Initialize filtered list
    this.filteredOJs = [...this.ojList];
        
    this.setupEventListeners();
    this.renderOptions();
    this.updateSelectedDisplay();
  }
    
  createHTML() {
    this.container.innerHTML = `
            <input type="text" class="oj-search" placeholder="Buscar órgãos julgadores...">
            <div class="oj-selected">
                <span class="oj-placeholder">Nenhum órgão selecionado</span>
            </div>
            <div class="oj-dropdown" style="display: none;">
                <div class="oj-options">
                    <!-- Options will be populated dynamically -->
                </div>
            </div>
            <input type="hidden" name="selected-ojs" value="">
        `;
  }

  setupEventListeners() {
    // Search functionality
    this.searchInput.addEventListener('input', (e) => {
      this.filterOptions(e.target.value);
    });

    // Show dropdown on focus
    this.searchInput.addEventListener('focus', () => {
      this.showDropdown();
    });

    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) {
        this.hideDropdown();
      }
    });
  }

  filterOptions(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
        
    if (!term) {
      this.filteredOJs = [...this.ojList];
    } else {
      // Normalize search term for better matching
      const normalizedTerm = term.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const termWords = normalizedTerm.split(/\s+/).filter(word => word.length > 0);
            
      this.filteredOJs = this.ojList.filter(oj => {
        const normalizedOJ = oj.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                
        // Search in the OJ name
        if (normalizedOJ.includes(normalizedTerm)) {
          return true;
        }
                
        // Search by city name (extract city from OJ name)
        const cityMatch = oj.match(/de\s+([A-Za-zÀ-ÿ\s]+)(?:\s|$)/);
        if (cityMatch) {
          const normalizedCity = cityMatch[1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (normalizedCity.includes(normalizedTerm)) {
            return true;
          }
        }
                
        // Check if any word in the OJ starts with the search term
        const words = normalizedOJ.split(/\s+/);
                
        return termWords.every(termWord => 
          words.some(word => word.startsWith(termWord))
        );
      });
    }
        
    this.renderOptions();
        
    // Auto-show dropdown when filtering
    if (term && this.filteredOJs.length > 0) {
      this.showDropdown();
    }
  }

  renderOptions() {
    console.log('🎨 renderOptions chamado');
    console.log('- optionsContainer:', !!this.optionsContainer);
    console.log('- filteredOJs length:', this.filteredOJs ? this.filteredOJs.length : 'undefined');
    console.log('- searchInput value:', this.searchInput ? this.searchInput.value : 'undefined');
        
    if (!this.optionsContainer) {
      console.error('❌ optionsContainer não encontrado!');
      return;
    }
        
    this.optionsContainer.innerHTML = '';
    console.log('✅ optionsContainer limpo');
        
    // Limit initial display for performance
    const maxDisplay = 50;
    const displayOJs = this.filteredOJs.slice(0, maxDisplay);
    console.log('- displayOJs length:', displayOJs.length);
    console.log('- primeiros 3 displayOJs:', displayOJs.slice(0, 3));
        
    if (displayOJs.length === 0 && this.filteredOJs.length === 0) {
      console.log('📝 Exibindo mensagem de "nenhum resultado"');
      const noResults = document.createElement('div');
      noResults.className = 'oj-no-results';
      const searchTerm = this.searchInput.value.trim();
      noResults.innerHTML = searchTerm ? 
        `<i class="fas fa-search"></i><br>Nenhum OJ encontrado para "${searchTerm}"<br><small>Tente usar termos diferentes</small>` :
        '<i class="fas fa-list"></i><br>Digite para buscar órgãos julgadores';
      this.optionsContainer.appendChild(noResults);
      console.log('✅ Mensagem "nenhum resultado" adicionada');
      return;
    }
        
    console.log('🔄 Criando opções para', displayOJs.length, 'OJs');
    displayOJs.forEach((oj, index) => {
      if (index < 3) {
        console.log(`- Criando opção ${index + 1}:`, oj);
      }
            
      const option = document.createElement('div');
      option.className = 'oj-option';
      if (this.selectedOJs.includes(oj)) {
        option.classList.add('selected');
      }
            
      // Highlight search terms
      const searchTerm = this.searchInput.value.trim();
      let displayText = oj;
      if (searchTerm) {
        const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        displayText = oj.replace(regex, '<mark>$1</mark>');
      }
            
      option.innerHTML = `
                <input type="checkbox" ${this.selectedOJs.includes(oj) ? 'checked' : ''}>
                <label>${displayText}</label>
            `;
            
      option.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleOJ(oj);
      });
            
      this.optionsContainer.appendChild(option);
    });
        
    console.log('✅ Opções criadas. Children count:', this.optionsContainer.children.length);
        
    // Show "more results" indicator if there are more items
    if (this.filteredOJs.length > maxDisplay) {
      console.log('📊 Adicionando indicador "mais resultados"');
      const moreResults = document.createElement('div');
      moreResults.className = 'oj-more-results';
      moreResults.innerHTML = `<i class="fas fa-ellipsis-h"></i> Mostrando ${maxDisplay} de ${this.filteredOJs.length} resultados (refine a busca para ver mais)`;
      this.optionsContainer.appendChild(moreResults);
    }
        
    console.log('🎨 renderOptions concluído. Total children:', this.optionsContainer.children.length);
  }

  toggleOJ(oj) {
    const index = this.selectedOJs.indexOf(oj);
    if (index > -1) {
      this.selectedOJs.splice(index, 1);
    } else {
      this.selectedOJs.push(oj);
    }
        
    this.updateSelectedDisplay();
    this.updateHiddenInput();
    this.renderOptions();
  }

  removeOJ(oj) {
    const index = this.selectedOJs.indexOf(oj);
    if (index > -1) {
      this.selectedOJs.splice(index, 1);
      this.updateSelectedDisplay();
      this.updateHiddenInput();
      this.renderOptions();
    }
  }

  updateSelectedDisplay() {
    if (this.selectedOJs.length === 0) {
      this.selectedContainer.innerHTML = '<span class="oj-placeholder">Nenhum órgão selecionado</span>';
    } else {
      const countText = this.selectedOJs.length === 1 ? '1 OJ selecionado' : `${this.selectedOJs.length} OJs selecionados`;
      const tagsHtml = this.selectedOJs.map(oj => `
                <span class="oj-tag" title="${oj}">
                    ${oj.length > 50 ? oj.substring(0, 47) + '...' : oj}
                    <span class="remove" onclick="ojSelectors['${this.containerId}'].removeOJ('${oj.replace(/'/g, '\\\'')}')">×</span>
                </span>
            `).join('');
            
      this.selectedContainer.innerHTML = `
                <div class="oj-count">${countText}</div>
                ${tagsHtml}
            `;
    }
  }

  updateHiddenInput() {
    this.hiddenInput.value = this.selectedOJs.join(',');
  }

  showDropdown() {
    this.dropdown.style.display = 'block';
  }

  hideDropdown() {
    this.dropdown.style.display = 'none';
  }

  getSelectedOJs() {
    return this.selectedOJs;
  }

  setSelectedOJs(ojs) {
    this.selectedOJs = Array.isArray(ojs) ? ojs : [];
    this.updateSelectedDisplay();
    this.updateHiddenInput();
    this.renderOptions();
  }
}

// Global OJ selectors registry
window.ojSelectors = {};
window.ojList = [];

// Initialize OJ selector when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Load OJ list from orgaos_pje.json
    const response = await fetch('./orgaos_pje.json');
    const ojData = await response.json();
        
    // Extract all OJs from the correct structure
    const allOJs = [];
        
    // Verificar se existe a estrutura 'orgaos'
    if (ojData.orgaos) {
      // Processar varas_trabalho
      if (Array.isArray(ojData.orgaos.varas_trabalho)) {
        ojData.orgaos.varas_trabalho.forEach(vara => {
          if (vara.nome) {
            allOJs.push(vara.nome);
          }
        });
        console.log(`Varas do Trabalho: ${ojData.orgaos.varas_trabalho.length} órgãos`);
      }
            
      // Processar outros tipos de órgãos se existirem
      Object.keys(ojData.orgaos).forEach(tipoOrgao => {
        if (tipoOrgao !== 'varas_trabalho' && Array.isArray(ojData.orgaos[tipoOrgao])) {
          ojData.orgaos[tipoOrgao].forEach(orgao => {
            if (orgao.nome) {
              allOJs.push(orgao.nome);
            }
          });
          console.log(`${tipoOrgao}: ${ojData.orgaos[tipoOrgao].length} órgãos`);
        }
      });
    } else {
      // Fallback: tentar estrutura antiga (cidades como chaves)
      Object.keys(ojData).forEach(cidade => {
        if (Array.isArray(ojData[cidade])) {
          allOJs.push(...ojData[cidade]);
        }
      });
    }
        
    // Sort alphabetically
    window.ojList = allOJs.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
        
    console.log('OJs carregados:', window.ojList.length);
        
    // Initialize OJ selector for the main selector
    if (document.getElementById('oj-selector-main')) {
      window.ojSelectors['oj-selector-main'] = new OJSelector('oj-selector-main', window.ojList);
    }
  } catch (error) {
    console.error('Erro ao carregar lista de OJs:', error);
    // Fallback to hardcoded list if file not found
    window.ojList = [
      'LIQ2 - Bauru',
      'Órgão Centralizador de Leilões Judiciais de Limeira',
      'Órgão Centralizador de Leilões Judiciais de Araraquara',
      'Vara do Trabalho de Ubatuba',
      'EXE1 - São José dos Campos'
    ].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
        
    if (document.getElementById('oj-selector-main')) {
      window.ojSelectors['oj-selector-main'] = new OJSelector('oj-selector-main', window.ojList);
    }
  }
});