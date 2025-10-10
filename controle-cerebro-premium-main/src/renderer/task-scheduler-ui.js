/**
 * Task Scheduler UI - Interface de Agendamento de Automações
 *
 * Gerencia a interface de agendamento de automações programadas
 */

// ipcRenderer já está disponível globalmente via nodeIntegration ou preload
const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: window.ipcRenderer };

class TaskSchedulerUI {
  constructor() {
    this.currentTasks = [];
    this.currentTaskType = null; // 'servidor' ou 'perito'
    this.editingTaskId = null;

    this.init();
  }

  /**
   * Inicializa o componente
   */
  async init() {
    console.log('🚀 Inicializando Task Scheduler UI...');

    // Event listeners
    this.setupEventListeners();

    // Carregar tarefas existentes
    await this.loadTasks();

    // Auto-refresh a cada 30 segundos
    setInterval(() => this.loadTasks(), 30000);

    console.log('✅ Task Scheduler UI inicializado');
  }

  /**
   * Setup de event listeners
   */
  setupEventListeners() {
    console.log('🎯 Configurando event listeners do Task Scheduler...');

    // Usar event delegation para os botões de adicionar tarefa
    document.addEventListener('click', (e) => {
      // Verificar se clicou no botão ou em um filho do botão (ícone ou texto)
      const button = e.target.id === 'add-scheduled-task-btn' ? e.target : e.target.closest('#add-scheduled-task-btn');

      if (button) {
        console.log('✅ Botão add-scheduled-task-btn clicado!');
        e.preventDefault();
        e.stopPropagation();
        this.openSchedulerModal();
      }
    });

    // Form submit
    const form = document.getElementById('scheduler-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }

    // Change no tipo de automação
    const taskTypeSelect = document.getElementById('task-type');
    if (taskTypeSelect) {
      taskTypeSelect.addEventListener('change', (e) => this.handleTaskTypeChange(e.target.value));
    }

    // Atualizar preview ao mudar campos
    const formFields = ['task-name', 'task-date', 'task-time', 'task-recurrence'];
    formFields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.addEventListener('input', () => this.updatePreview());
      }
    });

    // Listeners IPC
    ipcRenderer.on('task-scheduled', (event, task) => {
      this.onTaskScheduled(task);
    });

    ipcRenderer.on('task-started', (event, task) => {
      this.onTaskStarted(task);
    });

    ipcRenderer.on('task-completed', (event, data) => {
      this.onTaskCompleted(data);
    });

    ipcRenderer.on('task-failed', (event, data) => {
      this.onTaskFailed(data);
    });
  }

  /**
   * Carrega tarefas do scheduler
   */
  async loadTasks() {
    try {
      const result = await ipcRenderer.invoke('get-scheduled-tasks');

      if (result.success) {
        this.currentTasks = result.tasks;
        this.renderTasks();
      } else {
        console.error('Erro ao carregar tarefas:', result.error);
      }
    } catch (error) {
      console.error('Erro ao carregar tarefas:', error);
    }
  }

  /**
   * Renderiza lista de tarefas
   */
  renderTasks() {
    const container = document.getElementById('scheduled-tasks-list');
    if (!container) return;

    // Se não houver tarefas, mostrar empty state
    if (this.currentTasks.length === 0) {
      container.innerHTML = `
        <div class="tasks-empty-state">
          <i class="fas fa-calendar-times"></i>
          <h3>Nenhuma automação programada</h3>
          <p>Clique em "Nova Automação Programada" para agendar uma execução</p>
        </div>
      `;
      return;
    }

    // Renderizar cards de tarefas
    container.innerHTML = '';

    this.currentTasks.forEach(task => {
      const card = this.createTaskCard(task);
      container.appendChild(card);
    });
  }

  /**
   * Cria card de tarefa
   */
  createTaskCard(task) {
    const template = document.getElementById('scheduled-task-card-template');
    const card = template.content.cloneNode(true).querySelector('.scheduled-task-card');

    card.dataset.taskId = task.id;

    // Adicionar classe disabled se tarefa está desabilitada
    if (!task.enabled) {
      card.classList.add('disabled');
    }

    // Preencher dados
    card.querySelector('.task-card-title').textContent = task.name;

    const typeBadge = card.querySelector('.task-card-type-badge');
    typeBadge.textContent = task.type === 'servidor' ? 'Servidores' : 'Peritos';
    typeBadge.classList.add(task.type);

    // Data e hora
    const scheduledDate = new Date(task.scheduledDate);
    card.querySelector('.schedule-date').textContent = scheduledDate.toLocaleDateString('pt-BR');
    card.querySelector('.schedule-time').textContent = task.scheduledTime;

    // Recorrência
    const recurrenceMap = {
      'once': 'Única',
      'daily': 'Diária',
      'weekly': 'Semanal'
    };
    card.querySelector('.schedule-recurrence').textContent = recurrenceMap[task.recurrence] || 'Única';

    // Status
    const statusBadge = card.querySelector('.status-badge');
    const statusMap = {
      'pending': 'Agendada',
      'running': 'Executando',
      'completed': 'Concluída',
      'failed': 'Falhou'
    };
    statusBadge.textContent = statusMap[task.status] || task.status;
    statusBadge.classList.add(task.status);

    // Próxima execução
    const nextRunInfo = card.querySelector('.next-run-info');
    if (task.nextRun) {
      const nextRun = new Date(task.nextRun);
      const now = new Date();
      const diffMs = nextRun - now;
      const diffHours = Math.floor(diffMs / 1000 / 60 / 60);
      const diffMinutes = Math.floor((diffMs / 1000 / 60) % 60);

      if (diffMs > 0) {
        if (diffHours > 24) {
          const diffDays = Math.floor(diffHours / 24);
          nextRunInfo.textContent = `Em ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
        } else if (diffHours > 0) {
          nextRunInfo.textContent = `Em ${diffHours}h ${diffMinutes}min`;
        } else {
          nextRunInfo.textContent = `Em ${diffMinutes} minuto${diffMinutes > 1 ? 's' : ''}`;
        }
      } else {
        nextRunInfo.textContent = 'Executando...';
      }
    } else {
      nextRunInfo.textContent = task.enabled ? 'Aguardando' : 'Desabilitada';
    }

    // Estatísticas
    card.querySelector('.execution-count').textContent = task.executionCount || 0;

    const lastRunSpan = card.querySelector('.last-run');
    if (task.lastRun) {
      const lastRun = new Date(task.lastRun);
      lastRunSpan.textContent = lastRun.toLocaleString('pt-BR');
    } else {
      lastRunSpan.textContent = 'Nunca';
    }

    // Ícone do toggle
    const toggleBtn = card.querySelector('[onclick*="toggleScheduledTask"]');
    const toggleIcon = toggleBtn.querySelector('i');
    if (task.enabled) {
      toggleIcon.classList.remove('fa-toggle-off');
      toggleIcon.classList.add('fa-toggle-on');
      toggleIcon.style.color = '#10b981';
    } else {
      toggleIcon.classList.remove('fa-toggle-on');
      toggleIcon.classList.add('fa-toggle-off');
      toggleIcon.style.color = '#94a3b8';
    }

    return card;
  }

  /**
   * Abre modal de agendamento
   */
  openSchedulerModal(taskId = null) {
    console.log('🚪 openSchedulerModal chamado, taskId:', taskId);

    const modal = document.getElementById('scheduler-modal');
    console.log('📦 Modal encontrado:', modal ? 'SIM' : 'NÃO');

    if (!modal) {
      console.error('❌ Modal scheduler-modal não encontrado no DOM!');
      return;
    }

    // Resetar form
    const form = document.getElementById('scheduler-form');
    console.log('📋 Form encontrado:', form ? 'SIM' : 'NÃO');

    if (form) {
      form.reset();
    }

    this.editingTaskId = taskId;

    // Se estiver editando, carregar dados
    if (taskId) {
      this.loadTaskToEdit(taskId);
    } else {
      // Definir data mínima como hoje
      const today = new Date().toISOString().split('T')[0];
      const taskDateInput = document.getElementById('task-date');
      const taskTimeInput = document.getElementById('task-time');

      if (taskDateInput) {
        taskDateInput.min = today;
        taskDateInput.value = today;
      }

      // Definir hora padrão como hora atual + 1
      const now = new Date();
      now.setHours(now.getHours() + 1);
      const hour = String(now.getHours()).padStart(2, '0');
      const minute = String(now.getMinutes()).padStart(2, '0');

      if (taskTimeInput) {
        taskTimeInput.value = `${hour}:${minute}`;
      }
    }

    // Atualizar preview
    this.updatePreview();

    modal.style.display = 'flex';
    console.log('✅ Modal aberto! Display:', modal.style.display);
  }

  /**
   * Fecha modal
   */
  closeSchedulerModal() {
    const modal = document.getElementById('scheduler-modal');
    if (modal) {
      modal.style.display = 'none';
    }
    this.editingTaskId = null;
  }

  /**
   * Handle mudança de tipo de automação
   */
  async handleTaskTypeChange(type) {
    this.currentTaskType = type;
    const container = document.getElementById('task-data-selector');

    if (!type) {
      container.innerHTML = '<p style="color: #64748b;">Selecione o tipo de automação primeiro</p>';
      return;
    }

    container.innerHTML = '<p style="color: #64748b;"><i class="fas fa-spinner fa-spin"></i> Carregando...</p>';

    try {
      if (type === 'servidor') {
        const result = await ipcRenderer.invoke('load-servidores');
        if (result.success && result.servidores.length > 0) {
          this.renderServidorSelector(result.servidores, container);
        } else {
          container.innerHTML = '<p style="color: #ef4444;">Nenhum servidor cadastrado</p>';
        }
      } else if (type === 'perito') {
        const result = await ipcRenderer.invoke('load-peritos');
        if (result.success && result.peritos.length > 0) {
          this.renderPeritoSelector(result.peritos, container);
        } else {
          container.innerHTML = '<p style="color: #ef4444;">Nenhum perito cadastrado</p>';
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      container.innerHTML = '<p style="color: #ef4444;">Erro ao carregar dados</p>';
    }

    this.updatePreview();
  }

  /**
   * Renderiza seletor de servidores
   */
  renderServidorSelector(servidores, container) {
    container.innerHTML = `
      <div style="max-height: 200px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px;">
        <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
          <input type="checkbox" id="select-all-servidores" onchange="taskSchedulerUI.toggleSelectAll('servidor', this.checked)">
          <strong>Selecionar Todos (${servidores.length})</strong>
        </label>
        <div id="servidor-checkboxes">
          ${servidores.map((servidor, index) => `
            <label style="display: flex; align-items: center; gap: 8px; padding: 8px; hover: background: #f8fafc; cursor: pointer;">
              <input type="checkbox" name="servidor-checkbox" value="${index}" data-cpf="${servidor.cpf}">
              <span>${servidor.nome} (${servidor.cpf})</span>
            </label>
          `).join('')}
        </div>
      </div>
      <small style="color: #64748b; margin-top: 8px; display: block;">
        <i class="fas fa-info-circle"></i> Selecione os servidores que serão processados
      </small>
    `;
  }

  /**
   * Renderiza seletor de peritos
   */
  renderPeritoSelector(peritos, container) {
    container.innerHTML = `
      <div style="max-height: 200px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px;">
        <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
          <input type="checkbox" id="select-all-peritos" onchange="taskSchedulerUI.toggleSelectAll('perito', this.checked)">
          <strong>Selecionar Todos (${peritos.length})</strong>
        </label>
        <div id="perito-checkboxes">
          ${peritos.map((perito, index) => `
            <label style="display: flex; align-items: center; gap: 8px; padding: 8px; hover: background: #f8fafc; cursor: pointer;">
              <input type="checkbox" name="perito-checkbox" value="${index}" data-cpf="${perito.cpf}">
              <span>${perito.nome} (${perito.cpf})</span>
            </label>
          `).join('')}
        </div>
      </div>
      <small style="color: #64748b; margin-top: 8px; display: block;">
        <i class="fas fa-info-circle"></i> Selecione os peritos que serão processados
      </small>
    `;
  }

  /**
   * Toggle selecionar todos
   */
  toggleSelectAll(type, checked) {
    const checkboxes = document.querySelectorAll(`input[name="${type}-checkbox"]`);
    checkboxes.forEach(checkbox => {
      checkbox.checked = checked;
    });
    this.updatePreview();
  }

  /**
   * Atualiza preview da programação
   */
  updatePreview() {
    const previewDiv = document.getElementById('scheduler-preview-text');
    if (!previewDiv) return;

    const name = document.getElementById('task-name')?.value || '';
    const type = document.getElementById('task-type')?.value || '';
    const date = document.getElementById('task-date')?.value || '';
    const time = document.getElementById('task-time')?.value || '';
    const recurrence = document.getElementById('task-recurrence')?.value || 'once';

    if (!name || !type || !date || !time) {
      previewDiv.innerHTML = '<i class="fas fa-info-circle"></i> Preencha os campos acima para ver o resumo';
      return;
    }

    // Contar itens selecionados
    const checkboxes = type === 'servidor'
      ? document.querySelectorAll('input[name="servidor-checkbox"]:checked')
      : document.querySelectorAll('input[name="perito-checkbox"]:checked');
    const selectedCount = checkboxes.length;

    const typeLabel = type === 'servidor' ? 'servidores' : 'peritos';
    const recurrenceMap = {
      'once': 'executará <strong>apenas uma vez</strong>',
      'daily': 'será executada <strong>diariamente</strong>',
      'weekly': 'será executada <strong>semanalmente</strong>'
    };

    const dateFormatted = new Date(date + 'T' + time).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    previewDiv.innerHTML = `
      <div style="line-height: 1.6;">
        A automação "<strong>${name}</strong>" ${recurrenceMap[recurrence]}
        e processará <strong>${selectedCount} ${typeLabel}</strong>
        a partir de <strong>${dateFormatted}</strong>.
      </div>
    `;
  }

  /**
   * Handle submit do form
   */
  async handleFormSubmit(e) {
    e.preventDefault();

    const formData = this.getFormData();

    if (!formData) {
      return;
    }

    try {
      const result = this.editingTaskId
        ? await ipcRenderer.invoke('update-scheduled-task', this.editingTaskId, formData)
        : await ipcRenderer.invoke('schedule-task', formData);

      if (result.success) {
        this.showNotification('success', `Automação ${this.editingTaskId ? 'atualizada' : 'agendada'} com sucesso!`);
        this.closeSchedulerModal();
        await this.loadTasks();
      } else {
        this.showNotification('error', result.error || 'Erro ao agendar automação');
      }
    } catch (error) {
      console.error('Erro:', error);
      this.showNotification('error', 'Erro ao processar solicitação');
    }
  }

  /**
   * Obtém dados do formulário
   */
  getFormData() {
    const name = document.getElementById('task-name').value.trim();
    const type = document.getElementById('task-type').value;
    const date = document.getElementById('task-date').value;
    const time = document.getElementById('task-time').value;
    const recurrence = document.getElementById('task-recurrence').value;
    const notify = document.getElementById('task-notify').checked;
    const enabled = document.getElementById('task-enabled').checked;

    // Validar itens selecionados
    const checkboxes = type === 'servidor'
      ? document.querySelectorAll('input[name="servidor-checkbox"]:checked')
      : document.querySelectorAll('input[name="perito-checkbox"]:checked');

    if (checkboxes.length === 0) {
      this.showNotification('warning', `Selecione pelo menos um ${type === 'servidor' ? 'servidor' : 'perito'}`);
      return null;
    }

    // Coletar dados selecionados
    const selectedData = Array.from(checkboxes).map(cb => ({
      cpf: cb.dataset.cpf,
      index: parseInt(cb.value)
    }));

    return {
      name,
      type,
      scheduledDate: date,
      scheduledTime: time,
      recurrence,
      notify,
      enabled,
      data: selectedData
    };
  }

  /**
   * Mostra notificação
   */
  showNotification(type, message) {
    // Usar sistema de notificação existente ou criar um simples
    console.log(`[${type.toUpperCase()}] ${message}`);

    // Se existir função global de notificação, use-a
    if (typeof showNotification === 'function') {
      showNotification(type, message);
    } else {
      alert(message);
    }
  }

  /**
   * Callbacks de eventos
   */
  onTaskScheduled(task) {
    this.loadTasks();
  }

  onTaskStarted(task) {
    this.loadTasks();
    this.showNotification('info', `Automação "${task.name}" iniciada`);
  }

  onTaskCompleted(data) {
    this.loadTasks();
    this.showNotification('success', `Automação "${data.task.name}" concluída com sucesso!`);
  }

  onTaskFailed(data) {
    this.loadTasks();
    this.showNotification('error', `Automação "${data.task.name}" falhou: ${data.error.message}`);
  }
}

// Funções globais para os botões dos cards
function editScheduledTask(btn) {
  const card = btn.closest('.scheduled-task-card');
  const taskId = card.dataset.taskId;
  taskSchedulerUI.openSchedulerModal(taskId);
}

function toggleScheduledTask(btn) {
  const card = btn.closest('.scheduled-task-card');
  const taskId = card.dataset.taskId;
  const task = taskSchedulerUI.currentTasks.find(t => t.id === taskId);

  if (task) {
    ipcRenderer.invoke('toggle-scheduled-task', taskId, !task.enabled)
      .then(result => {
        if (result.success) {
          taskSchedulerUI.loadTasks();
        }
      });
  }
}

function deleteScheduledTask(btn) {
  const card = btn.closest('.scheduled-task-card');
  const taskId = card.dataset.taskId;
  const task = taskSchedulerUI.currentTasks.find(t => t.id === taskId);

  if (confirm(`Tem certeza que deseja excluir a automação "${task.name}"?`)) {
    ipcRenderer.invoke('remove-scheduled-task', taskId)
      .then(result => {
        if (result.success) {
          taskSchedulerUI.showNotification('success', 'Automação removida com sucesso');
          taskSchedulerUI.loadTasks();
        }
      });
  }
}

function closeSchedulerModal() {
  taskSchedulerUI.closeSchedulerModal();
}

// Instanciar quando DOM carregar
let taskSchedulerUI;

function initTaskScheduler() {
  console.log('🔧 Inicializando Task Scheduler UI...');
  console.log('📊 Estado do DOM:', document.readyState);

  // Verificar se os elementos existem
  const container = document.getElementById('scheduler-component-container');
  const button = document.getElementById('add-scheduled-task-btn');
  const modal = document.getElementById('scheduler-modal');

  console.log('✅ Container encontrado:', container ? 'SIM' : 'NÃO');
  console.log('✅ Botão encontrado:', button ? 'SIM' : 'NÃO');
  console.log('✅ Modal encontrado:', modal ? 'SIM' : 'NÃO');

  taskSchedulerUI = new TaskSchedulerUI();
  window.taskSchedulerUI = taskSchedulerUI; // Expor globalmente

  console.log('🎉 Task Scheduler UI criado e exposto globalmente');
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    console.log('⏳ DOM ainda carregando, aguardando DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', initTaskScheduler);
  } else {
    console.log('✅ DOM já carregado, inicializando imediatamente...');
    // DOM já está pronto, pode inicializar imediatamente
    initTaskScheduler();
  }
}

module.exports = TaskSchedulerUI;
