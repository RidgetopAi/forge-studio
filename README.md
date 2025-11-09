# Forge Studio Control Room (FSCR)

Central control system for AI-native streaming with automated cinematography and real-time visualization.

## Overview

Forge Studio Control Room is the orchestration hub that coordinates:
- OBS automation (scene switching, zoom, transitions)
- Real-time overlays (thinking blocks, tool calls, git status, file tracking)
- Development activity monitoring (terminal, Neovim, git)
- AI reasoning extraction (Claude API, local LLM)
- Mandrel context integration

## Quick Start

### Prerequisites

1. **Node.js** 18+ installed
2. **OBS Studio** with WebSocket Server enabled (Tools → WebSocket Server Settings, Port: 4455)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Or build and run production
npm run build
npm start
```

**Server URLs**:
- Control Server: `http://localhost:8000`
- Dashboard: `http://localhost:8000/dashboard`
- Health Check: `http://localhost:8000/api/health`

### Configuration

Edit `.env` file to customize:

```env
PORT=8000                    # Server port
OBS_HOST=localhost          # OBS WebSocket host
OBS_PORT=4455               # OBS WebSocket port
OBS_PASSWORD=               # OBS password (if set)
LOG_LEVEL=info              # Logging level
```

## Features (Phase 1.1 Complete)

✅ **OBS Integration**
- Connect to OBS WebSocket
- Switch scenes programmatically
- Auto-reconnection on disconnection
- Get scene list and current scene

✅ **Real-time Communication**
- Socket.io server for browser overlays
- Event broadcasting to all clients
- Client identification and tracking
- Connection monitoring

✅ **Dashboard UI**
- Real-time OBS status
- Scene switching controls
- Event log with timestamps
- Connection status indicators

✅ **RESTful API**
- Health check endpoint
- Scene management endpoints
- OBS status endpoint

## Project Structure

```
forge-studio/
├── src/
│   ├── server.ts                  # Main Express + Socket.io server
│   ├── controllers/
│   │   ├── ObsController.ts       # OBS WebSocket wrapper
│   │   └── SocketManager.ts       # Socket.io communication
│   ├── config/
│   │   └── config.ts              # Configuration management
│   ├── types/
│   │   ├── events.ts              # Socket.io event types
│   │   ├── config.ts              # Config types
│   │   ├── obs.ts                 # OBS types
│   │   └── index.ts               # Type exports
│   └── utils/
│       └── logger.ts              # Winston logger
├── public/
│   ├── dashboard/                 # Control dashboard UI
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
│   └── overlays/                  # (Future: Browser source overlays)
├── tests/
│   ├── socket-client-test.html    # Socket.io test client
│   └── obs-test-instructions.md   # Testing guide
├── docs/
│   ├── FSCR-ARCHITECTURE.md           # Architecture diagram
│   ├── FORGE-STUDIO-MASTER-PLAN.md    # Master plan
│   └── PHASE-1-COMPLETION-REPORT.md   # Phase 1.1 report
└── dist/                          # Compiled JavaScript
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server health check |
| GET | `/api/obs/status` | OBS connection status |
| GET | `/api/obs/scenes` | List all OBS scenes |
| GET | `/api/obs/scene/current` | Get current active scene |
| POST | `/api/obs/scene/switch` | Switch to specific scene |

### Example API Usage

```bash
# Get scene list
curl http://localhost:8000/api/obs/scenes

# Switch scene
curl -X POST http://localhost:8000/api/obs/scene/switch \
  -H "Content-Type: application/json" \
  -d '{"sceneName": "Scene 2"}'
```

## Development

```bash
# Type checking
npm run type-check

# Build TypeScript
npm run build

# Linting
npm run lint

# Run tests
npm test
```

## Testing

See `tests/obs-test-instructions.md` for comprehensive testing guide.

Quick tests:
1. Open dashboard: `http://localhost:8000/dashboard`
2. Open test client: `http://localhost:8000/tests/socket-client-test.html`
3. Switch scenes and verify real-time updates

## Status

✅ **Phase 1.1 Complete** - Foundation & Control Server

**Next**: Phase 1.2 - Monitor Integrations (Neovim, Terminal, Git)

## Documentation

- **Master Plan**: `docs/FORGE-STUDIO-MASTER-PLAN.md`
- **Architecture**: `docs/FSCR-ARCHITECTURE.md`
- **Phase 1.1 Report**: `docs/PHASE-1-COMPLETION-REPORT.md`
- **Test Guide**: `tests/obs-test-instructions.md`

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.3
- **Server**: Express 4.18
- **Real-time**: Socket.io 4.6
- **OBS**: obs-websocket-js 5.0
- **Logging**: Winston 3.11

## License

MIT
