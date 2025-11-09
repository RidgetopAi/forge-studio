# Forge Studio Control Room (FSCR)

Central control system for AI-native streaming with automated cinematography and real-time visualization.

## Overview

Forge Studio Control Room is the orchestration hub that coordinates:
- OBS automation (scene switching, zoom, transitions)
- Real-time overlays (thinking blocks, tool calls, git status, file tracking)
- Development activity monitoring (terminal, Neovim, git)
- AI reasoning extraction (Claude API, local LLM)
- Mandrel context integration

## Architecture

```
forge-studio/
├── src/
│   ├── server.ts              # Express + Socket.io control server
│   ├── controllers/
│   │   ├── ObsController.ts   # OBS websocket automation
│   │   └── SocketManager.ts   # Overlay communication hub
│   ├── monitors/              # Activity monitors (git, terminal, etc.)
│   ├── config/                # Configuration management
│   └── types/                 # TypeScript type definitions
├── public/
│   ├── dashboard/             # Control dashboard UI
│   └── overlays/              # Browser source overlays
└── config/                    # Runtime configuration files
```

## Quick Start

```bash
npm install
npm run dev
```

Control server runs on: `http://localhost:8000`

## Status

🚧 **In Development** - Building Phase 1: Foundation & Control Server

## Documentation

See `docs/FORGE-STUDIO-MASTER-PLAN.md` for full implementation plan.
