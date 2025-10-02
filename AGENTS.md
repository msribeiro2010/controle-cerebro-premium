# Repository Guidelines

## Project Structure & Module Organization
- `src/main/`: Electron main process and automation flows (e.g., `parallel-oj-processor.js`, `servidor-automation-v2.js`).
- `src/renderer/`: UI assets and static files (`index.html`, `script.js`, `styles.css`).
- `src/utils/`: Shared utilities (e.g., `performance-optimizer.js`, `Logger.js`).
- `src/tests/`: Jest tests — `unit/`, `integration/`, `e2e/` plus `setup.js`.
- `assets/`: App icons and build resources. `dist/`: build output (ignored).

## Build, Test, and Development Commands
- `npm install`: install dependencies. Example first run: `npm install && npm run dev`.
- `npm run dev` / `npm start`: launch Electron app (dev/regular mode).
- `npm test`: run all tests. Variants: `test:unit`, `test:integration`, `test:e2e`, `test:watch`, `test:coverage`.
- `npm run lint` / `lint:fix`: check/fix ESLint issues. `npm run format`: Prettier write.
- `npm run build`: package via electron-builder. Targets: `build:win`, `build:mac`, `build:linux`, or `build:all`.
- Cross-platform helper: `npm run build:cross-platform` (see `build-cross-platform.js`).

## Coding Style & Naming Conventions
- JavaScript (ES2021). Indent 2 spaces, single quotes, semicolons; prefer `const`, no `var`.
- Filenames: use kebab-case for modules (`performance-monitor.js`); PascalCase only for classes inside files.
- Tools: ESLint (`.eslintrc.js`) and Prettier (`.prettierrc`). Run `npm run lint:fix && npm run format` before PRs.

## Testing Guidelines
- Framework: Jest (`jest.config.js`, Node environment).
- Locations: place tests under `src/tests/{unit|integration|e2e}`; name `*.test.js`.
- Setup: common hooks in `src/tests/setup.js`. Run `npm run test:coverage` for reports in `coverage/`.
- E2E uses Playwright; ensure required browsers are installed/configured locally.

## Commit & Pull Request Guidelines
- Use Conventional Commits when possible: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`.
- Examples: `feat: adiciona verificação paralela de OJs`, `fix: corrige duplicação de servidores`.
- PRs: include purpose, linked issues, steps to test, and screenshots/GIFs for `src/renderer` changes. Ensure tests pass and lint is clean.

## Security & Configuration Tips
- Secrets via `.env` (loaded with `dotenv`); do not commit. Configure DB/Playwright creds locally.
- See `ARCHITECTURE.md` for a deeper overview and `SECURITY.md` for security practices.
