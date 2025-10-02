# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Central IA - NAPJe is an intelligent automation system for the Brazilian judicial system (PJE - Processo Judicial Eletrônico), built with Electron and Playwright. It automates the process of linking experts ("peritos") and court staff ("servidores") to judicial bodies ("órgãos julgadores").

## Essential Development Commands

```bash
# Development
npm start                    # Start application in production mode
npm run dev                  # Start with DevTools enabled
npm run syntax-check         # Check main files syntax before running

# Testing
npm test                     # Run all tests
npm run test:unit           # Run unit tests only  
npm run test:integration    # Run integration tests only
npm run test:e2e            # Run end-to-end tests only
npm run test:watch          # Run tests in watch mode
npm run test:coverage       # Run tests with coverage report

# Code Quality
npm run lint                 # Run ESLint
npm run lint:fix            # Auto-fix ESLint issues
npm run format              # Format code with Prettier

# Building & Distribution
npm run build               # Build for current OS
npm run build:win           # Build for Windows
npm run build:mac           # Build for macOS  
npm run build:linux         # Build for Linux
npm run build:all           # Build for all platforms

# Utilities
npm run setup               # Install deps and create desktop shortcut
npm run create-shortcut     # Create desktop shortcut only
npm run clean               # Clean build directory
npm run rebuild             # Clean and rebuild
```

## Architecture Overview

### Main Process Architecture (`src/main.js`)

The main process orchestrates the entire application with several key responsibilities:

1. **Window Management**: Creates and manages the Electron main window with security settings
2. **IPC Communication Hub**: Handles all renderer-to-main process communication via secure channels
3. **Data Persistence**: Manages JSON files for experts (`data/perito.json`) and servers (`data/servidores.json`)
4. **Automation Orchestration**: Controls two parallel automation engines:
   - **Expert Automation**: Uses legacy flow for linking experts to judicial bodies
   - **Server Automation v2**: Modern engine with parallel processing capabilities

The main process exposes these IPC handlers:
- `load-peritos`, `save-peritos`: Expert data CRUD operations
- `load-servidores`, `save-servidores`: Server data management
- `start-automation`, `stop-automation`: Control expert automation
- `start-servidor-automation-v2`: Launch modern server automation
- `import-file`, `export-file`: Data import/export functionality

### Automation Engine Architecture

The system employs sophisticated browser automation with multiple fallback strategies:

**Core Automation Modules**:
- `login.js`: Handles PDPJ authentication with 9+ selector strategies
- `navigate.js`: Menu navigation with 13+ menu selectors and 29+ edit icon strategies
- `vincularOJ.js`: Links judicial bodies with retry logic and validation
- `verificarOJVinculado.js`: Prevents duplicates by checking existing links
- `servidor-automation-v2.js`: Modern parallel processing engine for servers

**Optimization Systems**:
- `parallel-server-manager.js`: Manages concurrent server processing
- `turbo-mode-processor.js`: High-speed processing mode
- `pje-resilience-manager.js`: Error recovery and retry logic
- `smart-retry-manager.js`: Intelligent retry with exponential backoff
- `navigation-optimizer.js`: Optimizes DOM traversal and element location

### Database Integration

Optional PostgreSQL integration for verification and caching:
- `database-connection.js`: Connection pool management
- `oj-database-service.js`: Judicial body data operations
- `servidor-database-service.js`: Server data operations
- `process-database-service.js`: Process state management
- `smart-database-verifier.js`: Intelligent duplicate detection

### Performance Optimization Stack

**Caching Layers**:
- `intelligent-cache-manager.js`: Multi-level cache orchestration
- `smart-dom-cache.js`: DOM element caching
- `smart-oj-cache.js`: Judicial body data caching
- `location-cache-manager.js`: Location data optimization

**Performance Monitoring**:
- `performance-monitor.js`: Real-time metrics collection
- `performance-optimizer.js`: Dynamic optimization adjustments
- `performance-dashboard.js`: Metrics visualization
- `memory-monitor.js`: Memory usage tracking

### Renderer Process (`src/renderer/`)

The frontend provides a tabbed interface with:
- **Experts Tab**: CRUD operations for expert management
- **Servers Tab**: Server configuration and management  
- **Settings Tab**: PJE URL and credentials configuration
- **Automation Tab**: Real-time status monitoring and control

## Key Technical Patterns

### Selector Resilience Strategy
```javascript
// Multiple fallback selectors for maximum compatibility
const selectors = [
  'mat-select[placeholder*="Papel"]',
  'mat-select[ng-reflect-placeholder*="Papel"]',
  // ... up to 29 different strategies
];
```

### Parallel Processing Pattern
The system uses worker pools for concurrent operations:
- Servers can be processed in parallel (configurable batch size)
- Judicial bodies are processed sequentially for stability
- Smart throttling prevents server overload

### Error Recovery Pattern
Three-tier error handling:
1. **Element-level**: Retry with different selectors
2. **Operation-level**: Retry entire operation with backoff
3. **Session-level**: Restart browser and resume from checkpoint

## Configuration

### Environment Variables (`.env`)
```env
PJE_URL=https://pje.trt15.jus.br/primeirograu/login.seam
LOGIN=your_cpf
PASSWORD=your_password
DEBUG=true              # Optional: Enable debug logging
TIMEOUT=30000          # Optional: Global timeout in ms
SLOW_MO=20            # Optional: Slow down actions by X ms
```

### Database Configuration (`database.config.js`)
Optional PostgreSQL configuration for advanced verification features.

## Testing Strategy

The project uses Jest with three test categories:
- **Unit Tests** (`src/tests/unit/`): Test individual modules
- **Integration Tests** (`src/tests/integration/`): Test module interactions  
- **E2E Tests** (`src/tests/e2e/`): Test complete automation workflows

Run specific test files:
```bash
npm test -- src/tests/unit/normalizacao.test.js
```

## Development Workflow

### Adding New Automation Features
1. Create module in appropriate directory (`src/main/` for process logic, `src/utils/` for utilities)
2. Implement multiple selector strategies for resilience
3. Add error handling and retry logic
4. Create IPC handler in `main.js` if needed
5. Update renderer UI in `script.js` if user-facing
6. Write tests covering success and failure cases

### Debugging Automation Issues
1. Run with `npm run dev` to enable DevTools
2. Check console logs for selector debug information
3. Browser runs in non-headless mode for visual debugging
4. Failed elements are automatically captured for analysis
5. Check status panel for detailed operation feedback

### Performance Optimization
- Use parallel processing for independent operations
- Implement caching for frequently accessed data
- Monitor memory usage with built-in tools
- Profile with performance dashboard
- Adjust timeouts based on operation complexity

## Data Structures

### Expert Data Format
```json
{
  "cpf": "000.000.000-00",
  "nome": "Expert Name",
  "ojs": ["Court 1", "Court 2"]
}
```

### Server Data Format
```json
{
  "nome": "Server Name",
  "cpf": "000.000.000-00", 
  "perfil": "Role/Profile",
  "localizacoes": ["Location 1", "Location 2"]
}
```

## Critical Files Reference

- `src/main/servidor-automation-v2.js`: Modern automation engine
- `src/utils/normalizacao.js`: Text normalization for matching
- `src/utils/verificacao-dupla-oj.js`: Duplicate detection logic
- `src/renderer/orgaos_pje.json`: 400+ judicial body definitions