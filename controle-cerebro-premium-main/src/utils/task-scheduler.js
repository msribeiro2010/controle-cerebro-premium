/**
 * Task Scheduler - Sistema de Agendamento de Automações
 *
 * Permite agendar execuções de automações (Servidores e Peritos)
 * para datas e horários específicos.
 *
 * Features:
 * - Agendamento único ou recorrente (diário, semanal)
 * - Persistência em JSON
 * - Execução em background
 * - Notificações de status
 * - Histórico de execuções
 */

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class TaskScheduler extends EventEmitter {
  constructor() {
    super();
    this.scheduledTasks = [];
    this.taskHistory = [];
    this.intervalId = null;
    this.tasksFilePath = path.join(__dirname, '../../data/scheduled-tasks.json');
    this.historyFilePath = path.join(__dirname, '../../data/task-history.json');

    this.loadTasks();
    this.loadHistory();
    this.startScheduler();
  }

  /**
   * Carrega tarefas agendadas do arquivo
   */
  loadTasks() {
    try {
      if (fs.existsSync(this.tasksFilePath)) {
        const data = fs.readFileSync(this.tasksFilePath, 'utf8');
        this.scheduledTasks = JSON.parse(data);
        console.log(`✅ ${this.scheduledTasks.length} tarefas agendadas carregadas`);
      } else {
        this.scheduledTasks = [];
      }
    } catch (error) {
      console.error('❌ Erro ao carregar tarefas agendadas:', error.message);
      this.scheduledTasks = [];
    }
  }

  /**
   * Carrega histórico de execuções
   */
  loadHistory() {
    try {
      if (fs.existsSync(this.historyFilePath)) {
        const data = fs.readFileSync(this.historyFilePath, 'utf8');
        this.taskHistory = JSON.parse(data);
      } else {
        this.taskHistory = [];
      }
    } catch (error) {
      console.error('❌ Erro ao carregar histórico:', error.message);
      this.taskHistory = [];
    }
  }

  /**
   * Salva tarefas no arquivo
   */
  saveTasks() {
    try {
      const dataDir = path.dirname(this.tasksFilePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      fs.writeFileSync(this.tasksFilePath, JSON.stringify(this.scheduledTasks, null, 2), 'utf8');
      console.log('✅ Tarefas agendadas salvas');
    } catch (error) {
      console.error('❌ Erro ao salvar tarefas:', error.message);
    }
  }

  /**
   * Salva histórico no arquivo
   */
  saveHistory() {
    try {
      const dataDir = path.dirname(this.historyFilePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Manter apenas últimas 100 execuções
      const recentHistory = this.taskHistory.slice(-100);
      fs.writeFileSync(this.historyFilePath, JSON.stringify(recentHistory, null, 2), 'utf8');
    } catch (error) {
      console.error('❌ Erro ao salvar histórico:', error.message);
    }
  }

  /**
   * Agenda nova tarefa
   * @param {Object} task - Configuração da tarefa
   * @returns {string} ID da tarefa criada
   */
  scheduleTask(task) {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const scheduledTask = {
      id: taskId,
      type: task.type, // 'servidor' ou 'perito'
      name: task.name,
      scheduledDate: task.scheduledDate, // ISO string
      scheduledTime: task.scheduledTime, // HH:MM
      recurrence: task.recurrence || 'once', // 'once', 'daily', 'weekly'
      enabled: true,
      data: task.data, // Dados específicos (servidores, peritos, etc)
      createdAt: new Date().toISOString(),
      lastRun: null,
      nextRun: this.calculateNextRun(task.scheduledDate, task.scheduledTime, task.recurrence),
      status: 'pending', // 'pending', 'running', 'completed', 'failed'
      executionCount: 0
    };

    this.scheduledTasks.push(scheduledTask);
    this.saveTasks();

    console.log(`✅ Tarefa agendada: ${taskId} para ${scheduledTask.nextRun}`);

    this.emit('task-scheduled', scheduledTask);

    return taskId;
  }

  /**
   * Calcula próxima execução
   */
  calculateNextRun(date, time, recurrence) {
    const [hours, minutes] = time.split(':').map(Number);
    const scheduledDate = new Date(date);
    scheduledDate.setHours(hours, minutes, 0, 0);

    const now = new Date();

    // Se a data/hora já passou
    if (scheduledDate < now) {
      if (recurrence === 'daily') {
        // Próximo dia no mesmo horário
        scheduledDate.setDate(scheduledDate.getDate() + 1);
      } else if (recurrence === 'weekly') {
        // Próxima semana no mesmo dia/horário
        scheduledDate.setDate(scheduledDate.getDate() + 7);
      } else {
        // Tarefa única já passou
        return null;
      }
    }

    return scheduledDate.toISOString();
  }

  /**
   * Remove tarefa agendada
   */
  removeTask(taskId) {
    const index = this.scheduledTasks.findIndex(t => t.id === taskId);
    if (index !== -1) {
      const task = this.scheduledTasks[index];
      this.scheduledTasks.splice(index, 1);
      this.saveTasks();
      console.log(`✅ Tarefa removida: ${taskId}`);
      this.emit('task-removed', task);
      return true;
    }
    return false;
  }

  /**
   * Habilita/Desabilita tarefa
   */
  toggleTask(taskId, enabled) {
    const task = this.scheduledTasks.find(t => t.id === taskId);
    if (task) {
      task.enabled = enabled;
      this.saveTasks();
      console.log(`✅ Tarefa ${taskId} ${enabled ? 'habilitada' : 'desabilitada'}`);
      this.emit('task-toggled', task);
      return true;
    }
    return false;
  }

  /**
   * Atualiza tarefa existente
   */
  updateTask(taskId, updates) {
    const task = this.scheduledTasks.find(t => t.id === taskId);
    if (task) {
      Object.assign(task, updates);

      // Recalcular próxima execução se mudou data/hora
      if (updates.scheduledDate || updates.scheduledTime || updates.recurrence) {
        task.nextRun = this.calculateNextRun(
          task.scheduledDate,
          task.scheduledTime,
          task.recurrence
        );
      }

      this.saveTasks();
      console.log(`✅ Tarefa atualizada: ${taskId}`);
      this.emit('task-updated', task);
      return true;
    }
    return false;
  }

  /**
   * Lista todas as tarefas
   */
  getTasks(filter = {}) {
    let tasks = [...this.scheduledTasks];

    if (filter.type) {
      tasks = tasks.filter(t => t.type === filter.type);
    }

    if (filter.enabled !== undefined) {
      tasks = tasks.filter(t => t.enabled === filter.enabled);
    }

    if (filter.status) {
      tasks = tasks.filter(t => t.status === filter.status);
    }

    // Ordenar por próxima execução
    tasks.sort((a, b) => {
      if (!a.nextRun) return 1;
      if (!b.nextRun) return -1;
      return new Date(a.nextRun) - new Date(b.nextRun);
    });

    return tasks;
  }

  /**
   * Inicia o scheduler (verifica a cada minuto)
   */
  startScheduler() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    console.log('🚀 Task Scheduler iniciado');

    // Verificar tarefas a cada 30 segundos
    this.intervalId = setInterval(() => {
      this.checkAndExecuteTasks();
    }, 30000); // 30 segundos

    // Executar verificação inicial
    this.checkAndExecuteTasks();
  }

  /**
   * Para o scheduler
   */
  stopScheduler() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 Task Scheduler parado');
    }
  }

  /**
   * Verifica e executa tarefas pendentes
   */
  async checkAndExecuteTasks() {
    const now = new Date();

    for (const task of this.scheduledTasks) {
      if (!task.enabled || !task.nextRun || task.status === 'running') {
        continue;
      }

      const nextRunDate = new Date(task.nextRun);

      // Se chegou a hora (com margem de 1 minuto)
      if (nextRunDate <= now) {
        console.log(`⏰ Executando tarefa agendada: ${task.name}`);
        await this.executeTask(task);
      }
    }
  }

  /**
   * Executa uma tarefa
   */
  async executeTask(task) {
    task.status = 'running';
    task.lastRun = new Date().toISOString();
    task.executionCount++;
    this.saveTasks();

    this.emit('task-started', task);

    const historyEntry = {
      taskId: task.id,
      taskName: task.name,
      type: task.type,
      startTime: new Date().toISOString(),
      endTime: null,
      status: 'running',
      result: null,
      error: null
    };

    try {
      // Emitir evento para execução (será capturado pelo main.js)
      this.emit('execute-task', task);

      // Aguardar confirmação de execução (timeout 5 minutos)
      const result = await this.waitForExecution(task, 300000);

      historyEntry.endTime = new Date().toISOString();
      historyEntry.status = 'completed';
      historyEntry.result = result;

      task.status = 'completed';

      console.log(`✅ Tarefa ${task.name} concluída com sucesso`);
      this.emit('task-completed', { task, result });

    } catch (error) {
      historyEntry.endTime = new Date().toISOString();
      historyEntry.status = 'failed';
      historyEntry.error = error.message;

      task.status = 'failed';

      console.error(`❌ Erro ao executar tarefa ${task.name}:`, error.message);
      this.emit('task-failed', { task, error });
    }

    // Adicionar ao histórico
    this.taskHistory.push(historyEntry);
    this.saveHistory();

    // Calcular próxima execução
    if (task.recurrence !== 'once') {
      task.nextRun = this.calculateNextRunRecurrent(task);
      task.status = 'pending';
    } else {
      task.nextRun = null;
      task.enabled = false; // Desabilitar tarefa única após execução
    }

    this.saveTasks();
  }

  /**
   * Calcula próxima execução para tarefas recorrentes
   */
  calculateNextRunRecurrent(task) {
    const lastRun = new Date(task.lastRun);

    if (task.recurrence === 'daily') {
      lastRun.setDate(lastRun.getDate() + 1);
    } else if (task.recurrence === 'weekly') {
      lastRun.setDate(lastRun.getDate() + 7);
    }

    return lastRun.toISOString();
  }

  /**
   * Aguarda execução da tarefa (implementação simplificada)
   */
  async waitForExecution(task, timeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout ao executar tarefa'));
      }, timeout);

      // Handler temporário para resultado
      const resultHandler = (result) => {
        if (result.taskId === task.id) {
          clearTimeout(timeoutId);
          this.removeListener('task-execution-result', resultHandler);
          resolve(result);
        }
      };

      this.on('task-execution-result', resultHandler);
    });
  }

  /**
   * Retorna histórico de execuções
   */
  getHistory(taskId = null, limit = 50) {
    let history = [...this.taskHistory];

    if (taskId) {
      history = history.filter(h => h.taskId === taskId);
    }

    // Ordenar por mais recente
    history.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

    return history.slice(0, limit);
  }

  /**
   * Limpa histórico antigo
   */
  clearOldHistory(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    this.taskHistory = this.taskHistory.filter(h => {
      return new Date(h.startTime) > cutoffDate;
    });

    this.saveHistory();
    console.log(`✅ Histórico antigo limpo (> ${days} dias)`);
  }

  /**
   * Estatísticas do scheduler
   */
  getStats() {
    const total = this.scheduledTasks.length;
    const enabled = this.scheduledTasks.filter(t => t.enabled).length;
    const pending = this.scheduledTasks.filter(t => t.status === 'pending').length;
    const running = this.scheduledTasks.filter(t => t.status === 'running').length;

    const recentHistory = this.taskHistory.slice(-100);
    const successfulRuns = recentHistory.filter(h => h.status === 'completed').length;
    const failedRuns = recentHistory.filter(h => h.status === 'failed').length;
    const successRate = recentHistory.length > 0
      ? ((successfulRuns / recentHistory.length) * 100).toFixed(1)
      : 0;

    return {
      totalTasks: total,
      enabledTasks: enabled,
      pendingTasks: pending,
      runningTasks: running,
      totalExecutions: recentHistory.length,
      successfulExecutions: successfulRuns,
      failedExecutions: failedRuns,
      successRate: `${successRate}%`
    };
  }
}

// Singleton
let schedulerInstance = null;

function getScheduler() {
  if (!schedulerInstance) {
    schedulerInstance = new TaskScheduler();
  }
  return schedulerInstance;
}

module.exports = {
  TaskScheduler,
  getScheduler
};
