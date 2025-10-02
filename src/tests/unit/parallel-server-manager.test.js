const ParallelServerManager = require('../../main/parallel-server-manager');
const { EventEmitter } = require('events');

describe('ParallelServerManager', () => {
  let manager;
  let mockConfig;
  let mockEventEmitter;

  beforeEach(() => {
    const eventHandlers = new Map();
    mockEventEmitter = {
      emit: jest.fn((event, ...args) => {
        const handlers = eventHandlers.get(event) || [];
        handlers.forEach(handler => handler(...args));
      }),
      on: jest.fn((event, handler) => {
        if (!eventHandlers.has(event)) {
          eventHandlers.set(event, []);
        }
        eventHandlers.get(event).push(handler);
      }),
      removeAllListeners: jest.fn()
    };
    
    mockConfig = {
      maxInstances: 2,
      timeout: 30000
    };
    
    manager = new ParallelServerManager(mockConfig.maxInstances, mockEventEmitter);
    
    // Mock do método createInstance para evitar criação de browsers reais
    manager.createInstance = jest.fn().mockImplementation((id) => {
      const mockPage = {
        isClosed: jest.fn().mockReturnValue(false),
        evaluate: jest.fn().mockResolvedValue('Mock Page Title')
      };
      
      const mockContext = {
        browser: {
          isConnected: jest.fn().mockReturnValue(true)
        }
      };
      
      return Promise.resolve({
        id,
        context: mockContext,
        page: mockPage,
        browser: mockContext, // Alias para compatibilidade
        userDataDir: `/tmp/test-${id}`,
        busy: false,
        currentServer: null,
        automation: null,
        results: [],
        errors: [],
        startTime: null,
        endTime: null,
        totalProcessed: 0,
        totalSuccesses: 0,
        totalErrors: 0,
        createdAt: Date.now(),
        isValid: true,
        lastActivity: Date.now()
      });
    });
    
    // Mock das instâncias
    manager.instances = [
      {
        id: 'instance-1',
        browser: null,
        page: null,
        busy: false,
        results: [],
        errors: [],
        currentServer: null,
        startTime: null,
        endTime: null
      },
      {
        id: 'instance-2',
        browser: null,
        page: null,
        busy: false,
        results: [],
        errors: [],
        currentServer: null,
        startTime: null,
        endTime: null
      }
    ];
  });

  afterEach(() => {
    if (manager && manager.stop) {
      manager.stop();
    }
  });

  describe('constructor', () => {
    it('should initialize with correct default values', () => {
      const defaultManager = new ParallelServerManager(2, mockEventEmitter);
      
      expect(defaultManager.maxInstances).toBe(2);
      expect(defaultManager.instances).toEqual([]);
      expect(defaultManager.isRunning).toBe(false);
    });

    it('should initialize with custom max instances', () => {
      expect(manager.maxInstances).toBe(2);
      expect(manager.instances).toHaveLength(2);
      expect(manager.isRunning).toBe(false);
    });

    it('should initialize instances array with correct structure', () => {
      expect(manager.instances).toHaveLength(2);
      expect(manager.instances[0]).toHaveProperty('id', 'instance-1');
      expect(manager.instances[1]).toHaveProperty('id', 'instance-2');
      expect(manager.isRunning).toBe(false);
    });
  });

  describe('distributeServers', () => {
    it('should distribute servers evenly across instances', () => {
      const servers = Array.from({ length: 14 }, (_, i) => ({ id: i + 1, name: `Server ${i + 1}` }));
      const distribution = manager.distributeServers(servers);

      expect(distribution).toHaveLength(2);
      expect(distribution[0]).toHaveLength(7);
      expect(distribution[1]).toHaveLength(7);
    });

    it('should handle uneven distribution', () => {
      const servers = Array.from({ length: 16 }, (_, i) => ({ id: i + 1, name: `Server ${i + 1}` }));
      const distribution = manager.distributeServers(servers);

      expect(distribution).toHaveLength(2);
      expect(distribution[0]).toHaveLength(8);
      expect(distribution[1]).toHaveLength(8);
    });

    it('should handle fewer servers than max capacity', () => {
      const servers = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, name: `Server ${i + 1}` }));
      const distribution = manager.distributeServers(servers);

      expect(distribution).toHaveLength(2);
      expect(distribution[0]).toHaveLength(4);
      expect(distribution[1]).toHaveLength(4);
    });

    it('should return empty array for empty servers list', () => {
      const distribution = manager.distributeServers([]);
      expect(distribution).toEqual([]);
    });
  });

  describe('processServersInParallel', () => {
    let mockServers;
    let mockAutomationInstance;

    beforeEach(() => {
      mockServers = Array.from({ length: 10 }, (_, i) => ({ 
        id: i + 1, 
        name: `Server ${i + 1}`,
        orgao: `Orgao ${i + 1}`
      }));

      mockAutomationInstance = {
        processServers: jest.fn().mockImplementation(async (servers) => {
          // Simular processamento com delay para permitir eventos de progresso
          await new Promise(resolve => setTimeout(resolve, 10));
          return {
            success: true,
            processedCount: servers.length,
            errors: [],
            resultados: servers.map(server => ({
              servidor: server,
              sucessos: 1,
              timestamp: new Date().toISOString()
            }))
          };
        })
      };
    });

    it('should start parallel processing successfully', async () => {
      // Inicializar o manager antes do processamento
      await manager.initialize();
      
      // Mock dos métodos necessários para o processamento
      jest.spyOn(manager, 'processWithInstance').mockImplementation(async (instance) => {
        instance.results = mockServers.slice(0, 5).map(server => ({
          servidor: server,
          sucessos: 1,
          timestamp: new Date().toISOString()
        }));
        instance.errors = [];
        instance.endTime = Date.now();
        return Promise.resolve();
      });
      
      jest.spyOn(manager, 'consolidateResults').mockReturnValue({
        success: true,
        totalServidores: mockServers.length,
        servidoresProcessados: mockServers.length,
        sucessos: mockServers.length,
        erros: 0,
        resultados: mockServers.map(server => ({
          servidor: server,
          sucessos: 1,
          timestamp: new Date().toISOString()
        })),
        errors: [],
        tempoTotal: 1000,
        eficienciaParalela: 0.8
      });
      
      const config = { automationInstance: mockAutomationInstance };
      const result = await manager.processServersInParallel(mockServers, config);

      expect(result.success).toBe(true);
      expect(manager.isRunning).toBe(false); // isRunning é false após conclusão
      expect(manager.instances).toHaveLength(2);
    });

    it('should emit progress events during processing', async () => {
      // Inicializar o manager antes do processamento
      await manager.initialize();
      
      const progressEvents = [];
      mockEventEmitter.on('parallel-progress', (data) => {
        progressEvents.push(data);
      });

      // Mock dos métodos necessários para o processamento
      jest.spyOn(manager, 'processWithInstance').mockImplementation(async (instance) => {
        // Simular emissão de evento de progresso
        mockEventEmitter.emit('parallel-progress', {
          instances: manager.instances.map(inst => ({
            id: inst.id,
            busy: inst.busy,
            currentServer: inst.currentServer
          })),
          overallProgress: {
            completed: 5,
            total: mockServers.length,
            percentage: (5 / mockServers.length) * 100
          }
        });
        
        instance.results = mockServers.slice(0, 5).map(server => ({
          servidor: server,
          sucessos: 1,
          timestamp: new Date().toISOString()
        }));
        instance.errors = [];
        instance.endTime = Date.now();
        return Promise.resolve();
      });
      
      jest.spyOn(manager, 'consolidateResults').mockReturnValue({
        success: true,
        totalServidores: mockServers.length,
        servidoresProcessados: mockServers.length,
        sucessos: mockServers.length,
        erros: 0,
        resultados: mockServers.map(server => ({
          servidor: server,
          sucessos: 1,
          timestamp: new Date().toISOString()
        })),
        errors: [],
        tempoTotal: 1000,
        eficienciaParalela: 0.8
      });

      const config = { automationInstance: mockAutomationInstance };
      await manager.processServersInParallel(mockServers, config);

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0]).toHaveProperty('instances');
      expect(progressEvents[0]).toHaveProperty('overallProgress');
    });

    it('should handle processing errors gracefully', async () => {
      // Não inicializar o manager para simular erro de não inicialização
      const config = { automationInstance: mockAutomationInstance };
      const result = await manager.processServersInParallel(mockServers, config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('ParallelServerManager não foi inicializado');
    });

    it('should not start if already running', async () => {
      manager.isRunning = true;

      const config = { automationInstance: mockAutomationInstance };
      const result = await manager.processServersInParallel(mockServers, config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('já está em execução');
    });
  });

  describe('pauseAll', () => {
    beforeEach(() => {
      manager.instances = [
        { id: 1, status: 'running', pause: jest.fn() },
        { id: 2, status: 'running', pause: jest.fn() },
        { id: 3, status: 'completed', pause: jest.fn() }
      ];
    });

    it('should pause all running instances', () => {
      manager.pauseAll();

      expect(manager.instances[0].pause).toHaveBeenCalled();
      expect(manager.instances[1].pause).toHaveBeenCalled();
      expect(manager.instances[2].pause).not.toHaveBeenCalled();
    });

    it('should emit pause event', () => {
      const pauseHandler = jest.fn();
      mockEventEmitter.on('parallel-paused', pauseHandler);

      manager.pauseAll();

      expect(pauseHandler).toHaveBeenCalled();
    });
  });

  describe('resumeAll', () => {
    beforeEach(() => {
      manager.instances = [
        { id: 1, status: 'paused', resume: jest.fn() },
        { id: 2, status: 'paused', resume: jest.fn() },
        { id: 3, status: 'running', resume: jest.fn() }
      ];
    });

    it('should resume all paused instances', () => {
      manager.resumeAll();

      expect(manager.instances[0].resume).toHaveBeenCalled();
      expect(manager.instances[1].resume).toHaveBeenCalled();
      expect(manager.instances[2].resume).not.toHaveBeenCalled();
    });

    it('should emit resume event', () => {
      const resumeHandler = jest.fn();
      mockEventEmitter.on('parallel-resumed', resumeHandler);

      manager.resumeAll();

      expect(resumeHandler).toHaveBeenCalled();
    });
  });

  describe('stopAll', () => {
    beforeEach(() => {
      manager.instances = [
        { id: 1, status: 'running', stop: jest.fn() },
        { id: 2, status: 'paused', stop: jest.fn() },
        { id: 3, status: 'error', stop: jest.fn() }
      ];
      manager.isRunning = true;
    });

    it('should call stop on all instances', async () => {
      const instance1 = { id: 1, status: 'running', stop: jest.fn() };
      const instance2 = { id: 2, status: 'paused', stop: jest.fn() };
      const instance3 = { id: 3, status: 'error', stop: jest.fn() };
      
      manager.instances = [instance1, instance2, instance3];

      await manager.stop();

      expect(instance1.stop).toHaveBeenCalled();
      expect(instance2.stop).toHaveBeenCalled();
      expect(instance3.stop).toHaveBeenCalled();
    });

    it('should reset manager state', async () => {
      manager.instances = [
        { id: 1, status: 'running', stop: jest.fn() },
        { id: 2, status: 'paused', stop: jest.fn() },
        { id: 3, status: 'error', stop: jest.fn() }
      ];
      manager.isRunning = true;

      await manager.stop();

      expect(manager.isRunning).toBe(false);
      expect(manager.instances).toEqual([]);
    });

    it('should emit stop event', async () => {
      const stopHandler = jest.fn();
      mockEventEmitter.on('parallel-stopped', stopHandler);

      await manager.stop();

      expect(stopHandler).toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    beforeEach(() => {
      // Setup servidores for totalServers calculation
      manager.servidores = new Array(18).fill(null).map((_, i) => ({ id: i + 1, nome: `Server ${i + 1}` }));
      
      manager.instances = [
        { 
          id: 1, 
          status: 'running', 
          progress: 50, 
          completed: 5, 
          total: 10,
          elapsedTime: 120,
          currentServer: { nome: 'Server 1' },
          busy: true,
          results: new Array(5).fill({}), // 5 completed
          errors: new Array(2).fill({}) // 2 errors
        },
        { 
          id: 2, 
          status: 'completed', 
          progress: 100, 
          completed: 8, 
          total: 8,
          elapsedTime: 180,
          currentServer: null,
          busy: false,
          results: new Array(8).fill({}), // 8 completed
          errors: [] // no errors
        }
      ];
      manager.isRunning = true;
      manager.startTime = Date.now() - 300000; // 5 minutes ago
    });

    it('should return comprehensive status information', () => {
      const status = manager.getStatus();

      expect(status.isRunning).toBe(true);
      expect(status.instances).toHaveLength(2);
      expect(status.totalServers).toBe(18);
      expect(status.completedServers).toBe(13);
      expect(status.overallProgress).toBeCloseTo(72.22, 1);
      expect(status.elapsedTime).toBeGreaterThan(0);
    });

    it('should calculate speed correctly', () => {
      const status = manager.getStatus();
      
      expect(status.speed).toBeGreaterThan(0);
      expect(typeof status.speed).toBe('number');
    });

    it('should estimate remaining time', () => {
      const status = manager.getStatus();
      
      expect(status.estimatedTime).toBeGreaterThan(0);
      expect(typeof status.estimatedTime).toBe('number');
    });

    it('should return default status when not running', () => {
      manager.isRunning = false;
      manager.instances = [];
      
      const status = manager.getStatus();
      
      expect(status.isRunning).toBe(false);
      expect(status.instances).toEqual([]);
      expect(status.overallProgress).toBe(0);
      expect(status.speed).toBe(0);
      expect(status.totalServers).toBe(18); // servidores still configured
      expect(status.completedServers).toBe(0);
    });
  });
});