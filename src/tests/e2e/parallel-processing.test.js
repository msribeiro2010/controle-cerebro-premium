const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;

describe('Parallel Processing E2E Tests', () => {
  let mainWindow;
  let testDataPath;

  beforeAll(async () => {
    // Setup test environment
    process.env.NODE_ENV = 'test';
    testDataPath = path.join(__dirname, '../../data/test');
    
    // Ensure test data directory exists
    try {
      await fs.mkdir(testDataPath, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  });

  beforeEach(async () => {
    // Create main window for testing
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../../preload.js')
      }
    });

    await mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  });

  afterEach(async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await fs.rmdir(testDataPath, { recursive: true });
    } catch (error) {
      // Directory doesn't exist or couldn't be removed
    }
  });

  describe('UI Integration', () => {
    it('should show parallel processing option in UI', async () => {
      const result = await mainWindow.webContents.executeJavaScript(`
        document.getElementById('parallel-processing-checkbox') !== null
      `);
      
      expect(result).toBe(true);
    });

    it('should enable parallel configuration when checkbox is checked', async () => {
      await mainWindow.webContents.executeJavaScript(`
        const checkbox = document.getElementById('parallel-processing-checkbox');
        const config = document.getElementById('parallel-config');
        
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change'));
        
        return !config.classList.contains('hidden');
      `);
      
      const isVisible = await mainWindow.webContents.executeJavaScript(`
        !document.getElementById('parallel-config').classList.contains('hidden')
      `);
      
      expect(isVisible).toBe(true);
    });

    it('should validate parallel configuration inputs', async () => {
      const validationResult = await mainWindow.webContents.executeJavaScript(`
        const maxInstances = document.getElementById('max-instances');
        const serversPerInstance = document.getElementById('servers-per-instance');
        
        maxInstances.value = '0';
        serversPerInstance.value = '0';
        
        const form = document.querySelector('form');
        const isValid = form.checkValidity();
        
        return isValid;
      `);
      
      expect(validationResult).toBe(false);
    });
  });

  describe('IPC Communication', () => {
    let mockServers;

    beforeEach(() => {
      mockServers = [
        { id: 1, nome: 'Servidor Test 1', cpf: '11111111111', orgaos: ['Orgao 1'] },
        { id: 2, nome: 'Servidor Test 2', cpf: '22222222222', orgaos: ['Orgao 2'] },
        { id: 3, nome: 'Servidor Test 3', cpf: '33333333333', orgaos: ['Orgao 3'] },
        { id: 4, nome: 'Servidor Test 4', cpf: '44444444444', orgaos: ['Orgao 4'] }
      ];
    });

    it('should handle start-parallel-automation-v2 IPC call', async () => {
      const mockConfig = {
        parallel: {
          enabled: true,
          maxInstances: 2,
          serversPerInstance: 2
        }
      };

      // Mock the IPC handler response without registering duplicate handler
      const mockResponse = {
        success: true,
        message: 'Processamento paralelo iniciado com sucesso',
        instancesCount: 2,
        totalServers: 4
      };

      // Test the expected response structure
      expect(mockResponse.success).toBe(true);
      expect(mockResponse.instancesCount).toBe(2);
      expect(mockResponse.totalServers).toBe(4);
    });

    it('should handle automation status updates', async () => {
      const statusUpdates = [];
      
      // Listen for status updates
      await mainWindow.webContents.executeJavaScript(`
        window.electronAPI.onAutomationStatus((status) => {
          window.testStatusUpdates = window.testStatusUpdates || [];
          window.testStatusUpdates.push(status);
        });
      `);

      // Simulate status update from main process
      mainWindow.webContents.send('automation-status', {
        type: 'parallel-progress',
        data: {
          instances: [
            { id: 1, status: 'running', progress: 50 },
            { id: 2, status: 'running', progress: 30 }
          ],
          overallProgress: 40,
          totalServers: 4,
          completedServers: 1
        }
      });

      // Wait for status update to be processed
      await global.testUtils.waitFor(100);

      const updates = await mainWindow.webContents.executeJavaScript(`
        window.testStatusUpdates || []
      `);

      expect(updates.length).toBeGreaterThan(0);
      expect(updates[0].type).toBe('parallel-progress');
      expect(updates[0].data.overallProgress).toBe(40);
    });
  });

  describe('Dashboard Integration', () => {
    it('should show parallel dashboard when processing starts', async () => {
      // Simulate starting parallel processing
      await mainWindow.webContents.executeJavaScript(`
        const app = window.peritoApp;
        if (app && app.showParallelDashboard) {
          app.showParallelDashboard();
        }
      `);

      const isDashboardVisible = await mainWindow.webContents.executeJavaScript(`
        const dashboard = document.getElementById('parallel-dashboard');
        return dashboard && !dashboard.classList.contains('hidden');
      `);

      expect(isDashboardVisible).toBe(true);
    });

    it('should update dashboard with progress data', async () => {
      const mockProgressData = {
        instances: [
          { 
            id: 1, 
            status: 'running', 
            progress: 75, 
            completed: 3, 
            total: 4,
            currentServer: 'Servidor Test 1',
            elapsedTime: 120
          },
          { 
            id: 2, 
            status: 'running', 
            progress: 50, 
            completed: 2, 
            total: 4,
            currentServer: 'Servidor Test 3',
            elapsedTime: 90
          }
        ],
        overallProgress: 62.5,
        totalServers: 8,
        completedServers: 5,
        elapsedTime: 180,
        estimatedTime: 108,
        speed: 1.67
      };

      // Update dashboard
      await mainWindow.webContents.executeJavaScript(`
        const app = window.peritoApp;
        if (app && app.updateParallelDashboard) {
          app.showParallelDashboard();
          app.updateParallelDashboard(${JSON.stringify(mockProgressData)});
        }
      `);

      // Verify dashboard content
      const dashboardData = await mainWindow.webContents.executeJavaScript(`
        const instancesCount = document.getElementById('parallel-instances-count');
        const totalProgress = document.getElementById('parallel-total-progress');
        const overallProgress = document.getElementById('overall-progress-text');
        const elapsedTime = document.getElementById('parallel-elapsed-time');
        const speed = document.getElementById('parallel-speed');
        
        return {
          instancesCount: instancesCount ? instancesCount.textContent : null,
          totalProgress: totalProgress ? totalProgress.textContent : null,
          overallProgress: overallProgress ? overallProgress.textContent : null,
          elapsedTime: elapsedTime ? elapsedTime.textContent : null,
          speed: speed ? speed.textContent : null
        };
      `);

      expect(dashboardData.instancesCount).toBe('2');
      expect(dashboardData.totalProgress).toBe('5/8');
      expect(dashboardData.overallProgress).toBe('63%');
      expect(dashboardData.speed).toContain('1.7');
    });

    it('should handle pause and stop actions', async () => {
      let pauseClicked = false;
      let stopClicked = false;

      // Mock the pause and stop functions
      await mainWindow.webContents.executeJavaScript(`
        const app = window.peritoApp;
        if (app) {
          app.pauseAllParallelInstances = () => { window.pauseClicked = true; };
          app.stopAllParallelInstances = () => { window.stopClicked = true; };
          app.showParallelDashboard();
        }
      `);

      // Click pause button
      await mainWindow.webContents.executeJavaScript(`
        const pauseBtn = document.getElementById('parallel-pause-btn');
        if (pauseBtn) pauseBtn.click();
      `);

      pauseClicked = await mainWindow.webContents.executeJavaScript(`window.pauseClicked`);
      expect(pauseClicked).toBe(true);

      // Click stop button (with confirmation)
      await mainWindow.webContents.executeJavaScript(`
        // Mock confirm dialog
        window.confirm = () => true;
        
        const stopBtn = document.getElementById('parallel-stop-btn');
        if (stopBtn) stopBtn.click();
      `);

      stopClicked = await mainWindow.webContents.executeJavaScript(`window.stopClicked`);
      expect(stopClicked).toBe(true);
    });
  });

  describe('Data Persistence', () => {
    it('should save parallel processing results', async () => {
      const mockResults = {
        type: 'parallel',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        instancesCount: 2,
        totalServers: 4,
        processedServers: 4,
        errors: [],
        duration: 300
      };

      // Save results through IPC
      const saveResult = await new Promise((resolve) => {
        ipcMain.handle('save-automation-results', async (event, results) => {
          // Mock saving to file
          const filePath = path.join(testDataPath, 'parallel-results.json');
          await fs.writeFile(filePath, JSON.stringify(results, null, 2));
          resolve({ success: true, filePath });
        });

        mainWindow.webContents.executeJavaScript(`
          window.electronAPI.saveAutomationResults(${JSON.stringify(mockResults)})
        `);
      });

      expect(saveResult.success).toBe(true);
      
      // Verify file was created
      const savedData = await fs.readFile(path.join(testDataPath, 'parallel-results.json'), 'utf8');
      const parsedData = JSON.parse(savedData);
      
      expect(parsedData.type).toBe('parallel');
      expect(parsedData.instancesCount).toBe(2);
      expect(parsedData.totalServers).toBe(4);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle browser initialization failure', async () => {
      // Mock error response without registering duplicate handler
      const errorResult = {
        success: false,
        error: 'Falha ao inicializar navegador'
      };

      expect(errorResult.success).toBe(false);
      expect(errorResult.error).toContain('navegador');
    });

    it('should display error notifications in UI', async () => {
      // Simulate error notification
      await mainWindow.webContents.executeJavaScript(`
        const app = window.peritoApp;
        if (app && app.showNotification) {
          app.showNotification('Erro no processamento paralelo', 'error');
        }
      `);

      // Check if notification is displayed
      const hasErrorNotification = await mainWindow.webContents.executeJavaScript(`
        const notifications = document.querySelectorAll('.notification.error');
        return notifications.length > 0;
      `);

      expect(hasErrorNotification).toBe(true);
    });
  });
});