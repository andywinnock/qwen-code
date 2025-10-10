# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Qwen Code is an AI-powered command-line workflow tool adapted from Gemini CLI, specifically optimized for Qwen3-Coder models. It provides developers with code understanding, automated tasks, and intelligent assistance through a terminal interface.

## Build and Development Commands

### Build
```bash
# Build entire project (all packages)
npm run build

# Build all packages including sandbox container
npm run build:all

# Build specific packages
npm run build:packages

# Build only sandbox container
npm run build:sandbox
```

### Running
```bash
# Start from source (after building)
npm start

# Debug mode with inspector
npm run debug

# Development mode with React DevTools
DEV=true npm start
```

### Testing
```bash
# Run all unit tests
npm run test

# Run CI tests with coverage
npm run test:ci

# Run integration tests (end-to-end)
npm run test:e2e

# Run terminal-bench tests
npm run test:terminal-bench

# Run single test with vitest
vitest run path/to/test.test.ts
```

### Code Quality
```bash
# Full preflight check (required before PRs)
npm run preflight

# Lint only
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type checking
npm run typecheck
```

## Architecture

Qwen Code is organized as a monorepo with the following package structure:

### Core Packages
- **`packages/cli/`** - User-facing CLI interface
  - Input processing and command handling
  - Display rendering and UI (React/Ink-based)
  - History management
  - Theme and configuration management

- **`packages/core/`** - Backend logic and orchestration
  - API clients for model communication (Google Gemini, OpenAI-compatible)
  - Prompt construction and management
  - Tool registration and execution
  - State management for conversations
  - OAuth authentication flow
  - Subagent system for specialized tasks

- **`packages/test-utils/`** - Shared testing utilities

- **`packages/vscode-ide-companion/`** - VS Code integration

### Key Directories

- **`packages/core/src/tools/`** - Individual tool modules that extend model capabilities (file system, shell, web fetching, etc.)
- **`packages/core/src/subagents/`** - Specialized agents for complex tasks
- **`packages/cli/src/commands/`** - CLI command implementations
- **`packages/cli/src/ui/`** - React/Ink UI components
- **`integration-tests/`** - End-to-end integration tests
- **`scripts/`** - Build and development scripts
- **`docs/`** - Comprehensive documentation

## Authentication

Qwen Code supports two authentication methods:

1. **Qwen OAuth (Default)** - OAuth flow with qwen.ai account (2,000 requests/day free)
2. **OpenAI-Compatible API** - Environment variables for API key-based auth

### Environment Variables
```bash
# For OpenAI-compatible providers
export OPENAI_API_KEY="your_api_key"
export OPENAI_BASE_URL="your_api_endpoint"
export OPENAI_MODEL="your_model_choice"
```

### `.env` File Search Order
1. Current directory upward: `.qwen/.env`, then `.env`
2. Home directory fallback: `~/.qwen/.env`, then `~/.env`

Use `/auth` command in CLI to switch authentication methods.

## Key Technical Details

### TypeScript & Build System
- Uses TypeScript 5.3+ with strict typing
- Build system: Custom Node.js scripts (`scripts/build.js`, `scripts/build_package.js`)
- Bundling: esbuild for production bundles
- Requires Node.js ≥20 (development uses ~20.19.0 due to dependency constraints)

### Tool Execution Flow
1. User input → CLI package
2. CLI → Core package
3. Core constructs prompt with available tools → Model API
4. Model response may request tool execution
5. User approval required for write/execute operations (read operations auto-approved)
6. Core executes tool → Returns result to model
7. Model generates final response → CLI displays to user

### Sandboxing
- **macOS**: Seatbelt (`sandbox-exec`) with configurable profiles
- **All platforms**: Container-based (Docker/Podman) with `GEMINI_SANDBOX=true|docker|podman`
- Build sandbox: `npm run build:sandbox`
- Custom sandbox configs: `.qwen/sandbox.Dockerfile`, `.qwen/sandbox.bashrc`

### Session Management
- Token limits configurable via `.qwen/settings.json`
- Commands: `/compress` (compress history), `/clear` (reset), `/stats` (usage info)

### Vision Model Support
- Auto-detects images and switches to vision-capable models
- Configurable via `vlmSwitchMode` in settings: `once`, `session`, `persist`
- Disable with `visionModelPreview: false`

## Development Workflow

### Prerequisites
- Node.js ~20.19.0 for development (≥20 for production)
- Git

### Setup
```bash
git clone https://github.com/QwenLM/qwen-code.git
cd qwen-code
npm install
npm run build
```

### Making Changes
1. Create feature branch from `main`
2. Make focused, atomic changes
3. Run `npm run preflight` to ensure all checks pass
4. Update docs in `/docs` for user-facing changes
5. Follow Conventional Commits for commit messages
6. Link PR to existing issue (create issue first if needed)

### Import Restrictions
- ESLint enforces restrictions on relative imports between packages
- Use package aliases (`@qwen-code/qwen-code-core`) for cross-package imports

### React DevTools
- Start with `DEV=true npm start`
- Run `npx react-devtools@4.28.5` (Ink uses React 4.x compatibility)

## Important Notes

- **Derived from Gemini CLI**: Main contribution is parser-level adaptations for Qwen-Coder models
- **Monorepo structure**: Uses npm workspaces
- **CLA required**: Contributors must sign Google CLA
- **Bundle entry point**: `bundle/gemini.js` (maps to `qwen` command)
- **MCP support**: Model Context Protocol SDK integrated for extensibility
- **Telemetry**: OpenTelemetry instrumentation available (see `docs/telemetry.md`)

## Documentation References

- Architecture: `docs/architecture.md`
- Integration Tests: `docs/integration-tests.md`
- Sandboxing: `docs/sandbox.md`
- Subagents: `docs/subagents.md`
- Tool Development: `docs/tools/`
- Troubleshooting: `docs/troubleshooting.md`
