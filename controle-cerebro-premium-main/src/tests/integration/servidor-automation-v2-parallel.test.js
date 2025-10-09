const ServidorAutomationV2 = require('../../main/servidor-automation-v2');
const ParallelServerManager = require('../../main/parallel-server-manager');
const { EventEmitter } = require('events');
const path = require('path');

describe('ServidorAutomationV2 - Parallel Processing Integration', () => {
  let automation;
  let mockEventEmitter;
  let mockConfig;

  beforeEach(() => {
    mockEventEmitter = new EventEmitter();
    mockConfig = {
      headless: true,
      timeout: 30000,
      retryAttempts: 2,
      parallel: {
        enabled: true,
        maxInstances: 2,
        serversPerInstance: 3,
        delayBetweenInstances: 500
      }
    };

    automation = new ServidorAutomationV2(mockEventEmitter);
    
    // Mock browser methods
    automation.browser = {
      newContext: jest.fn().mockResolvedValue({
        newPage: jest.fn().mockResolvedValue({
          goto: jest.fn().mockResolvedValue(undefined),
          waitForSelector: jest.fn().mockResolvedValue({}),
          click: jest.fn().mockResolvedValue(undefined),
          fill: jest.fn().mockResolvedValue(undefined),
          evaluate: jest.fn().mockResolvedValue(undefined),
          close: jest.fn().mockResolvedValue(undefined),
          url: jest.fn().mockReturnValue('https://test-pje.com'),
          waitForTimeout: jest.fn().mockResolvedValue(undefined)
        }),
        close: jest.fn().mockResolvedValue(undefined)
      }),
      close: jest.fn().mockResolvedValue(undefined)
    };

    // Mock login and navigation methods
    automation.login = jest.fn().mockResolvedValue({ success: true });
    automation.navigateToGerenciamentoPessoas = jest.fn().mockResolvedValue({ success: true });
    automation.processServer = jest.fn().mockResolvedValue({
      success: true,
      server: { id: 1, name: 'Test Server' },
      processedOJs: 2
    });
  });

  afterEach(async () => {
    if (automation && automation.parallelManager) {
      automation.parallelManager.stopAll();
    }
    if (automation && automation.browser) {
      await automation.browser.close();
    }
  });

  describe('startParallelAutomation', () => {
    let mockServers;

    beforeEach(() => {
      mockServers = [
        { id: 1, nome: 'Servidor 1', cpf: '11111111111', orgaos: ['Orgao 1', 'Orgao 2'] },
        { id: 2, nome: 'Servidor 2', cpf: '22222222222', orgaos: ['Orgao 3', 'Orgao 4'] },
        { id: 3, nome: 'Servidor 3', cpf: '33333333333', orgaos: ['Orgao 5', 'Orgao 6'] },
        { id: 4, nome: 'Servidor 4', cpf: '44444444444', orgaos: ['Orgao 7', 'Orgao 8'] },
        { id: 5, nome: 'Servidor 5', cpf: '55555555555', orgaos: ['Orgao 9', 'Orgao 10'] },
        { id: 6, nome: 'Servidor 6', cpf: '66666666666', orgaos: ['Orgao 11', 'Orgao 12'] }
      ];
    });

    it('should initialize parallel manager with correct configuration', async () => {
      const result = await automation.startParallelAutomation(mockServers, mockConfig);

      expect(automation.parallelManager).toBeInstanceOf(ParallelServerManager);
      expect(automation.parallelManager.config.maxInstances).toBe(2);
      expect(automation.parallelManager.config.serversPerInstance).toBe(3);
      expect(automation.parallelManager.config.delayBetweenInstances).toBe(500);
    });

    it('should start parallel processing successfully', async () => {
      const result = await automation.startParallelAutomation(mockServers, mockConfig);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Processamento paralelo iniciado');
      expect(result.instancesCount).toBe(2);
      expect(result.totalServers).toBe(6);
    });

    it('should emit automation-started event', async () => {
      const startedHandler = jest.fn();
      mockEventEmitter.on('automation-started', startedHandler);

      await automation.startParallelAutomation(mockServers, mockConfig);

      expect(startedHandler).toHaveBeenCalledWith({
        type: 'parallel',
        instancesCount: 2,
        totalServers: 6
      });
    });

    it('should handle empty servers list', async () => {
      const emptyConfig = {
        ...mockConfig,
        servidores: []
      };
      const result = await automation.startParallelAutomation([], emptyConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Nenhum servidor fornecido');
    });

    it('should handle invalid configuration', async () => {
      const invalidConfig = {
        ...mockConfig,
        servidores: mockServers,
        parallel: {
          enabled: true,
          maxInstances: 0
        }
      };

      const result = await automation.startParallelAutomation(mockServers, invalidConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Configuração inválida');
    });

    it('should prevent starting when already running', async () => {
      const configWithServers = {
        ...mockConfig,
        servidores: mockServers
      };
      
      // Start first automation
      await automation.startParallelAutomation(mockServers, configWithServers);

      // Try to start second automation
      const result = await automation.startParallelAutomation(mockServers, configWithServers);

      expect(result.success).toBe(false);
      expect(result.error).toContain('já está em execução');
    });

    it('should handle browser initialization failure', async () => {
      automation.browser = null;
      automation.initializeBrowser = jest.fn().mockRejectedValue(new Error('Browser failed'));

      const result = await automation.startParallelAutomation(mockServers, mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Browser failed');
    });
  });

  describe('parallel processing events', () => {
    let mockServers;
    let eventData;

    beforeEach(() => {
      mockServers = [
        { id: 1, nome: 'Servidor 1', cpf: '11111111111', orgaos: ['Orgao 1'] },
        { id: 2, nome: 'Servidor 2', cpf: '22222222222', orgaos: ['Orgao 2'] }
      ];
      eventData = [];

      mockEventEmitter.on('parallel-progress', (data) => {
        eventData.push(data);
      });
    });

    it('should emit progress events during processing', async () => {
      await automation.startParallelAutomation(mockServers, mockConfig);

      // Wait for some processing
      await global.testUtils.waitFor(1000);

      expect(eventData.length).toBeGreaterThan(0);
      expect(eventData[0]).toHaveProperty('instances');
      expect(eventData[0]).toHaveProperty('overallProgress');
      expect(eventData[0]).toHaveProperty('totalServers');
      expect(eventData[0]).toHaveProperty('completedServers');
    });

    it('should emit completion event when all instances finish', async () => {
      const completedHandler = jest.fn();
      mockEventEmitter.on('automation-completed', completedHandler);

      await automation.startParallelAutomation(mockServers, mockConfig);

      // Wait for completion
      await global.testUtils.waitFor(2000);

      expect(completedHandler).toHaveBeenCalledWith({
        type: 'parallel',
        totalProcessed: expect.any(Number),
        totalErrors: expect.any(Number),
        duration: expect.any(Number)
      });
    });

    it('should emit error events when instances fail', async () => {
      const errorHandler = jest.fn();
      mockEventEmitter.on('automation-error', errorHandler);

      // Make processServer fail
      automation.processServer.mockRejectedValue(new Error('Processing failed'));

      await automation.startParallelAutomation(mockServers, mockConfig);

      // Wait for error
      await global.testUtils.waitFor(1000);

      expect(errorHandler).toHaveBeenCalledWith({
        type: 'parallel',
        error: expect.stringContaining('Processing failed'),
        instanceId: expect.any(Number)
      });
    });
  });

  describe('parallel manager integration', () => {
    let mockServers;

    beforeEach(() => {
      mockServers = [
        { id: 1, nome: 'Servidor 1', cpf: '11111111111', orgaos: ['Orgao 1'] },
        { id: 2, nome: 'Servidor 2', cpf: '22222222222', orgaos: ['Orgao 2'] },
        { id: 3, nome: 'Servidor 3', cpf: '33333333333', orgaos: ['Orgao 3'] },
        { id: 4, nome: 'Servidor 4', cpf: '44444444444', orgaos: ['Orgao 4'] }
      ];
    });

    it('should create parallel manager with correct configuration', async () => {
      const config = {
        ...mockConfig,
        servidores: mockServers,
        parallel: {
          enabled: true,
          maxInstances: 3,
          serversPerInstance: 2
        }
      };

      await automation.startParallelAutomation(mockServers, config);
      
      expect(automation.parallelManager).toBeInstanceOf(ParallelServerManager);
      expect(automation.parallelManager.config.maxInstances).toBe(3);
      expect(automation.parallelManager.config.serversPerInstance).toBe(2);
    });

    it('should distribute servers correctly across instances', async () => {
      await automation.startParallelAutomation(mockServers, mockConfig);

      const status = automation.parallelManager.getStatus();
      
      expect(status.instances).toHaveLength(2);
      expect(status.totalServers).toBe(4);
      expect(status.isRunning).toBe(true);
    });

    it('should distribute servers correctly among instances', async () => {
      const config = {
        ...mockConfig,
        servidores: mockServers,
        parallel: {
          enabled: true,
          maxInstances: 2,
          serversPerInstance: 3
        }
      };

      await automation.startParallelAutomation(mockServers, config);
      
      const status = automation.parallelManager.getStatus();
      expect(status.instances).toHaveLength(2);
      expect(status.totalServers).toBe(4);
    });

    it('should handle pause and resume operations', async () => {
      await automation.startParallelAutomation(mockServers, mockConfig);

      // Pause all instances
      automation.parallelManager.pauseAll();
      
      const pausedStatus = automation.parallelManager.getStatus();
      expect(pausedStatus.instances.some(i => i.status === 'paused')).toBe(true);

      // Resume all instances
      automation.parallelManager.resumeAll();
      
      const resumedStatus = automation.parallelManager.getStatus();
      expect(resumedStatus.instances.some(i => i.status === 'running')).toBe(true);
    });

    it('should handle stop operation correctly', async () => {
      await automation.startParallelAutomation(mockServers, mockConfig);

      // Stop all instances
      automation.parallelManager.stopAll();
      
      const stoppedStatus = automation.parallelManager.getStatus();
      expect(stoppedStatus.isRunning).toBe(false);
      expect(stoppedStatus.instances).toEqual([]);
    });

    it('should handle stop operation', async () => {
      const config = {
        ...mockConfig,
        servidores: mockServers,
        parallel: {
          enabled: true,
          maxInstances: 2,
          serversPerInstance: 2
        }
      };

      await automation.startParallelAutomation(mockServers, config);
      
      automation.parallelManager.stopAll();
      const status = automation.parallelManager.getStatus();
      expect(status.isRunning).toBe(false);
    });

    it('should provide accurate status information', async () => {
      await automation.startParallelAutomation(mockServers, mockConfig);

      const status = automation.parallelManager.getStatus();
      
      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('instances');
      expect(status).toHaveProperty('totalServers');
      expect(status).toHaveProperty('completedServers');
      expect(status).toHaveProperty('overallProgress');
      expect(status).toHaveProperty('elapsedTime');
      expect(status).toHaveProperty('estimatedTime');
      expect(status).toHaveProperty('speed');
    });
  });

  describe('error handling and recovery', () => {
    let mockServers;

    beforeEach(() => {
      mockServers = [
        { id: 1, nome: 'Servidor 1', cpf: '11111111111', orgaos: ['Orgao 1'] },
        { id: 2, nome: 'Servidor 2', cpf: '22222222222', orgaos: ['Orgao 2'] }
      ];
    });

    it('should handle instance failures gracefully', async () => {
      // Make one instance fail
      automation.processServer
        .mockResolvedValueOnce({ success: true, server: mockServers[0], processedOJs: 1 })
        .mockRejectedValueOnce(new Error('Instance failed'));

      const result = await automation.startParallelAutomation(mockServers, mockConfig);

      expect(result.success).toBe(true); // Should still succeed with partial results
    });

    it('should retry failed operations according to configuration', async () => {
      const config = {
        ...mockConfig,
        retry: {
          maxAttempts: 3,
          delay: 100
        }
      };

      let attemptCount = 0;
      automation.processServer.mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve({ success: true, server: mockServers[0], processedOJs: 1 });
      });

      await automation.startParallelAutomation(mockServers, config);

      expect(attemptCount).toBeGreaterThan(2); // Should have retried
    });

    it('should clean up resources on error', async () => {
      const config = {
        ...mockConfig
      };
      
      automation.processServer.mockRejectedValue(new Error('Critical failure'));

      try {
        await automation.startParallelAutomation(mockServers, config);
      } catch (error) {
        expect(error.message).toContain('Processing failed');
      }

      // Should clean up even after error
      if (automation.parallelManager) {
        expect(automation.parallelManager.getStatus().isRunning).toBe(false);
      }
    });
  });
});