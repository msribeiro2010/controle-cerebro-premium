# 🛠️ Plano de Implementação: Processamento Paralelo

## 📋 Roadmap Detalhado

### **Fase 1: Arquitetura Base (Semana 1-2)**

#### **1.1 Criar Classe ParallelServerManager**
```javascript
// src/main/parallel-server-manager.js
class ParallelServerManager {
  constructor(maxInstances = 2) {
    this.maxInstances = maxInstances;
    this.instances = [];
    this.serverQueue = [];
    this.results = new Map();
    this.isRunning = false;
    this.mainWindow = null;
  }

  async initialize() {
    console.log(`🚀 Inicializando ${this.maxInstances} instâncias paralelas...`);
    
    for (let i = 0; i < this.maxInstances; i++) {
      const instance = await this.createInstance(i);
      this.instances.push(instance);
    }
    
    console.log(`✅ ${this.instances.length} instâncias criadas com sucesso`);
  }

  async createInstance(id) {
    const { chromium } = require('playwright');
    
    const browser = await chromium.launch({
      headless: false,
      args: [
        `--user-data-dir=/tmp/pje-parallel-${id}`,
        `--window-position=${id * 400},${id * 100}`,
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    const page = await browser.newPage();
    
    return {
      id,
      browser,
      page,
      busy: false,
      currentServer: null,
      automation: new ServidorAutomationV2(),
      results: [],
      errors: []
    };
  }

  async processServersInParallel(servers) {
    this.serverQueue = [...servers];
    this.isRunning = true;
    
    // Iniciar processamento em todas as instâncias
    const promises = this.instances.map(instance => 
      this.processWithInstance(instance)
    );
    
    await Promise.all(promises);
    
    return this.consolidateResults();
  }

  async processWithInstance(instance) {
    while (this.serverQueue.length > 0 && this.isRunning) {
      const server = this.serverQueue.shift();
      if (!server) break;
      
      instance.busy = true;
      instance.currentServer = server;
      
      this.sendStatusUpdate({
        type: 'instance-start',
        instanceId: instance.id,
        server: server.nome,
        remaining: this.serverQueue.length
      });
      
      try {
        const result = await this.processServerWithInstance(instance, server);
        instance.results.push(result);
        
        this.sendStatusUpdate({
          type: 'instance-success',
          instanceId: instance.id,
          server: server.nome,
          result
        });
        
      } catch (error) {
        instance.errors.push({ server, error: error.message });
        
        this.sendStatusUpdate({
          type: 'instance-error',
          instanceId: instance.id,
          server: server.nome,
          error: error.message
        });
      } finally {
        instance.busy = false;
        instance.currentServer = null;
      }
    }
  }

  async processServerWithInstance(instance, server) {
    // Configurar automação para esta instância
    instance.automation.browser = instance.browser;
    instance.automation.page = instance.page;
    instance.automation.mainWindow = this.mainWindow;
    
    // Processar servidor
    const startTime = Date.now();
    
    await instance.automation.performLogin();
    await instance.automation.navigateDirectlyToPerson(server.cpf);
    await instance.automation.navigateToServerTab();
    
    // Configurar OJs para este servidor
    instance.automation.config = { orgaos: server.orgaos };
    await instance.automation.processOrgaosJulgadores();
    
    const endTime = Date.now();
    
    return {
      servidor: server,
      tempoProcessamento: endTime - startTime,
      sucessos: instance.automation.results.filter(r => r.status === 'Incluído com Sucesso').length,
      erros: instance.automation.results.filter(r => r.status !== 'Incluído com Sucesso').length,
      detalhes: instance.automation.results
    };
  }

  sendStatusUpdate(status) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('parallel-status-update', status);
    }
  }

  async cleanup() {
    console.log('🧹 Limpando instâncias paralelas...');
    
    for (const instance of this.instances) {
      try {
        await instance.browser.close();
      } catch (error) {
        console.error(`Erro ao fechar instância ${instance.id}:`, error);
      }
    }
    
    this.instances = [];
    this.isRunning = false;
  }
}

module.exports = ParallelServerManager;
```

#### **1.2 Modificar ServidorAutomationV2**
```javascript
// Adicionar ao src/main/servidor-automation-v2.js

class ServidorAutomationV2 {
  // ... código existente ...

  async startParallelAutomation(config, maxInstances = 2) {
    if (this.isRunning) {
      throw new Error('Automação já está em execução');
    }

    this.isRunning = true;
    this.config = config;
    
    try {
      const parallelManager = new ParallelServerManager(maxInstances);
      parallelManager.mainWindow = this.mainWindow;
      
      await parallelManager.initialize();
      
      this.sendStatus('info', `🚀 Iniciando processamento paralelo com ${maxInstances} instâncias`, 0, 
        `${config.servidores.length} servidores na fila`);
      
      const results = await parallelManager.processServersInParallel(config.servidores);
      
      await this.generateParallelReport(results);
      
      this.sendStatus('success', 'Processamento paralelo concluído!', 100, 
        `${results.totalServidores} servidores processados`);
      
      await parallelManager.cleanup();
      
    } catch (error) {
      console.error('Erro no processamento paralelo:', error);
      this.sendStatus('error', `Erro: ${error.message}`, this.currentProgress);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  async generateParallelReport(results) {
    // Gerar relatório específico para processamento paralelo
    const outputDir = path.join(__dirname, '..', '..', 'data');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    const report = {
      timestamp: new Date().toISOString(),
      tipoProcessamento: 'Paralelo',
      instanciasUtilizadas: results.instanciasUtilizadas,
      tempoTotalProcessamento: results.tempoTotal,
      eficienciaParalela: results.eficiencia,
      servidores: results.servidores,
      estatisticasGerais: results.estatisticas
    };
    
    const reportPath = path.join(outputDir, `relatorio-paralelo-${timestamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📊 Relatório paralelo salvo: ${reportPath}`);
  }
}
```

### **Fase 2: Interface de Usuário (Semana 3)**

#### **2.1 Atualizar Frontend**
```javascript
// Adicionar ao src/renderer/script.js

class AutomationUI {
  // ... código existente ...

  initializeParallelControls() {
    // Adicionar controles de paralelização
    const parallelSection = document.createElement('div');
    parallelSection.className = 'parallel-controls';
    parallelSection.innerHTML = `
      <div class="parallel-config">
        <h3>🚀 Processamento Paralelo</h3>
        <div class="parallel-options">
          <label>
            <input type="radio" name="processing-mode" value="sequential" checked>
            Sequencial (1 instância)
          </label>
          <label>
            <input type="radio" name="processing-mode" value="parallel-2">
            Paralelo (2 instâncias) - 50% mais rápido
          </label>
          <label>
            <input type="radio" name="processing-mode" value="parallel-4">
            Paralelo (4 instâncias) - 75% mais rápido
          </label>
        </div>
        <div class="resource-warning">
          ⚠️ Processamento paralelo usa mais CPU e RAM
        </div>
      </div>
    `;
    
    document.querySelector('.automation-controls').appendChild(parallelSection);
  }

  async startParallelAutomation() {
    const mode = document.querySelector('input[name="processing-mode"]:checked').value;
    const maxInstances = mode === 'sequential' ? 1 : parseInt(mode.split('-')[1]);
    
    if (maxInstances > 1) {
      const confirmed = confirm(
        `Iniciar processamento paralelo com ${maxInstances} instâncias?\n\n` +
        `Isso usará mais recursos do sistema mas será ${maxInstances === 2 ? '50%' : '75%'} mais rápido.`
      );
      
      if (!confirmed) return;
    }
    
    this.showParallelProgress(maxInstances);
    
    try {
      await window.electronAPI.startParallelAutomation({
        servidores: this.getSelectedServidores(),
        maxInstances
      });
    } catch (error) {
      this.showNotification(`Erro: ${error.message}`, 'error');
    }
  }

  showParallelProgress(instances) {
    const progressContainer = document.querySelector('.progress-container');
    progressContainer.innerHTML = `
      <div class="parallel-progress">
        <h3>Processamento Paralelo (${instances} instâncias)</h3>
        <div class="instances-grid">
          ${Array.from({length: instances}, (_, i) => `
            <div class="instance-card" id="instance-${i}">
              <div class="instance-header">
                <span class="instance-title">Instância ${i + 1}</span>
                <span class="instance-status">Aguardando...</span>
              </div>
              <div class="instance-progress">
                <div class="progress-bar">
                  <div class="progress-fill" style="width: 0%"></div>
                </div>
                <div class="current-server">-</div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="overall-progress">
          <h4>Progresso Geral</h4>
          <div class="progress-bar large">
            <div class="progress-fill" style="width: 0%"></div>
          </div>
          <div class="progress-stats">
            <span id="completed-servers">0</span> / 
            <span id="total-servers">0</span> servidores concluídos
          </div>
        </div>
      </div>
    `;
  }

  handleParallelStatusUpdate(status) {
    const instanceCard = document.getElementById(`instance-${status.instanceId}`);
    
    switch (status.type) {
      case 'instance-start':
        instanceCard.querySelector('.instance-status').textContent = 'Processando';
        instanceCard.querySelector('.current-server').textContent = status.server;
        instanceCard.classList.add('active');
        break;
        
      case 'instance-success':
        instanceCard.querySelector('.instance-status').textContent = 'Concluído';
        instanceCard.classList.remove('active');
        instanceCard.classList.add('success');
        this.updateOverallProgress();
        break;
        
      case 'instance-error':
        instanceCard.querySelector('.instance-status').textContent = 'Erro';
        instanceCard.classList.remove('active');
        instanceCard.classList.add('error');
        this.updateOverallProgress();
        break;
    }
  }
}

// Registrar listener para atualizações paralelas
window.electronAPI.onParallelStatusUpdate((status) => {
  automationUI.handleParallelStatusUpdate(status);
});
```

### **Fase 3: Testes e Otimização (Semana 4)**

#### **3.1 Suite de Testes**
```javascript
// tests/parallel-processing.test.js
const ParallelServerManager = require('../src/main/parallel-server-manager');

describe('Processamento Paralelo', () => {
  let manager;
  
  beforeEach(() => {
    manager = new ParallelServerManager(2);
  });
  
  afterEach(async () => {
    await manager.cleanup();
  });
  
  test('deve criar múltiplas instâncias', async () => {
    await manager.initialize();
    expect(manager.instances).toHaveLength(2);
    expect(manager.instances[0].id).toBe(0);
    expect(manager.instances[1].id).toBe(1);
  });
  
  test('deve processar servidores em paralelo', async () => {
    const mockServers = [
      { nome: 'Servidor 1', cpf: '111.111.111-11', orgaos: ['OJ1', 'OJ2'] },
      { nome: 'Servidor 2', cpf: '222.222.222-22', orgaos: ['OJ3', 'OJ4'] }
    ];
    
    const startTime = Date.now();
    const results = await manager.processServersInParallel(mockServers);
    const endTime = Date.now();
    
    expect(results.totalServidores).toBe(2);
    expect(endTime - startTime).toBeLessThan(60000); // Menos de 1 minuto
  });
});
```

#### **3.2 Benchmarks de Performance**
```javascript
// scripts/benchmark-parallel.js
const { performance } = require('perf_hooks');

async function benchmarkProcessing() {
  const testServers = generateTestServers(10); // 10 servidores de teste
  
  console.log('🧪 Iniciando benchmark de processamento...');
  
  // Teste sequencial
  console.log('📊 Testando processamento sequencial...');
  const sequentialStart = performance.now();
  await processSequential(testServers);
  const sequentialTime = performance.now() - sequentialStart;
  
  // Teste paralelo (2 instâncias)
  console.log('📊 Testando processamento paralelo (2 instâncias)...');
  const parallel2Start = performance.now();
  await processParallel(testServers, 2);
  const parallel2Time = performance.now() - parallel2Start;
  
  // Teste paralelo (4 instâncias)
  console.log('📊 Testando processamento paralelo (4 instâncias)...');
  const parallel4Start = performance.now();
  await processParallel(testServers, 4);
  const parallel4Time = performance.now() - parallel4Start;
  
  // Resultados
  console.log('\n📈 RESULTADOS DO BENCHMARK:');
  console.log(`Sequencial: ${(sequentialTime/1000).toFixed(1)}s`);
  console.log(`Paralelo (2): ${(parallel2Time/1000).toFixed(1)}s (${((sequentialTime/parallel2Time)*100).toFixed(0)}% da velocidade sequencial)`);
  console.log(`Paralelo (4): ${(parallel4Time/1000).toFixed(1)}s (${((sequentialTime/parallel4Time)*100).toFixed(0)}% da velocidade sequencial)`);
  
  console.log('\n⚡ GANHOS DE PERFORMANCE:');
  console.log(`2 instâncias: ${((1 - parallel2Time/sequentialTime)*100).toFixed(0)}% mais rápido`);
  console.log(`4 instâncias: ${((1 - parallel4Time/sequentialTime)*100).toFixed(0)}% mais rápido`);
}

benchmarkProcessing().catch(console.error);
```

## 🎯 Cronograma de Implementação

### **Semana 1: Arquitetura Base**
- [ ] Criar ParallelServerManager
- [ ] Modificar ServidorAutomationV2
- [ ] Implementar isolamento de instâncias
- [ ] Testes básicos de funcionamento

### **Semana 2: Integração**
- [ ] Integrar com sistema existente
- [ ] Implementar coordenação entre instâncias
- [ ] Tratamento de erros paralelos
- [ ] Testes de estabilidade

### **Semana 3: Interface**
- [ ] Atualizar UI para suporte paralelo
- [ ] Dashboard de múltiplas instâncias
- [ ] Controles de configuração
- [ ] Testes de usabilidade

### **Semana 4: Otimização**
- [ ] Benchmarks de performance
- [ ] Ajustes de configuração
- [ ] Documentação completa
- [ ] Testes finais

## 📋 Checklist de Entrega

### **Funcionalidades Core**
- [ ] Processamento com 2, 4 ou 8 instâncias
- [ ] Isolamento completo entre instâncias
- [ ] Coordenação central de tarefas
- [ ] Tratamento robusto de erros
- [ ] Relatórios consolidados

### **Interface de Usuário**
- [ ] Seleção de modo de processamento
- [ ] Dashboard de múltiplas instâncias
- [ ] Progresso individual por instância
- [ ] Estatísticas em tempo real
- [ ] Controles de parada/pausa

### **Performance e Estabilidade**
- [ ] Redução de 50%+ no tempo total
- [ ] Uso eficiente de recursos
- [ ] Recuperação automática de falhas
- [ ] Testes de stress com 65 servidores
- [ ] Benchmarks documentados

### **Documentação**
- [ ] Guia de uso do modo paralelo
- [ ] Configurações recomendadas
- [ ] Troubleshooting
- [ ] Comparativos de performance

---

**🎯 Meta**: Reduzir o tempo de processamento de 65 servidores de **3 horas para 1.5 horas** com implementação robusta e interface intuitiva.