// Jest setup file for PJE Automation tests

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to ignore specific console methods
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test utilities
global.testUtils = {
  // Helper to create mock data
  createMockPerito: (overrides = {}) => ({
    id: 'test-id-123',
    nome: 'Test Perito',
    cpf: '12345678901',
    ojs: ['Vara do Trabalho de Test'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides
  }),

  createMockServidor: (overrides = {}) => ({
    id: 'test-server-123',
    nome: 'Test Servidor',
    cpf: '98765432100',
    perfil: 'Secretário de Audiência',
    orgaos: ['Vara do Trabalho de Test'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides
  }),

  // Helper to create mock automation result
  createMockAutomationResult: (overrides = {}) => ({
    id: 'result-123',
    startTime: new Date('2024-01-01T10:00:00Z'),
    endTime: new Date('2024-01-01T10:05:00Z'),
    status: 'completed',
    processedItems: [],
    errors: [],
    metrics: {
      totalItems: 0,
      successCount: 0,
      errorCount: 0,
      skippedCount: 0
    },
    ...overrides
  }),

  // Helper to wait for async operations
  waitFor: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Helper to create mock browser page
  createMockPage: () => ({
    goto: jest.fn().mockResolvedValue(undefined),
    waitForSelector: jest.fn().mockResolvedValue({}),
    click: jest.fn().mockResolvedValue(undefined),
    fill: jest.fn().mockResolvedValue(undefined),
    evaluate: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    setDefaultTimeout: jest.fn(),
    setDefaultNavigationTimeout: jest.fn(),
    url: jest.fn().mockReturnValue('https://test.com'),
    waitForTimeout: jest.fn().mockResolvedValue(undefined)
  }),

  // Helper to create mock browser
  createMockBrowser: () => ({
    newPage: jest.fn().mockResolvedValue(global.testUtils.createMockPage()),
    close: jest.fn().mockResolvedValue(undefined),
    contexts: jest.fn().mockReturnValue([]),
    newContext: jest.fn().mockResolvedValue({
      newPage: jest.fn().mockResolvedValue(global.testUtils.createMockPage())
    })
  })
};

// Setup environment variables for tests
process.env.NODE_ENV = 'test';
process.env.PJE_URL = 'https://test-pje.example.com';
process.env.LOGIN = 'test-user';
process.env.PASSWORD = 'test-password';

// Mock electron modules for testing
jest.mock('electron', () => ({
  app: {
    whenReady: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    quit: jest.fn()
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn(),
    webContents: {
      send: jest.fn(),
      openDevTools: jest.fn()
    },
    on: jest.fn(),
    isDestroyed: jest.fn().mockReturnValue(false)
  })),
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn()
  },
  dialog: {
    showSaveDialog: jest.fn(),
    showOpenDialog: jest.fn()
  }
}));

// Mock playwright for testing
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue(global.testUtils.createMockBrowser()),
    connectOverCDP: jest.fn().mockResolvedValue(global.testUtils.createMockBrowser())
  }
}));