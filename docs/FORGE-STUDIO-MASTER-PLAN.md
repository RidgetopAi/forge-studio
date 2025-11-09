# mandrel Studio: Technical Implementation Plan (Node.js/TypeScript)

## Project Overview

Building an AI-native streaming system with automated cinematography, real-time visualization of AI reasoning, and intelligent context display. All controlled from a single Node.js service that orchestrates OBS, monitors development activity, and manages overlays.

## Tech Stack

**Core Control:**

- Node.js + TypeScript (central control server)
- Express.js (HTTP server for dashboard)
- Socket.io (websocket communication)
- obs-websocket-js (OBS automation)
- PostgreSQL + pgvector (Mandrel context DB - already built)

**Development Monitoring:**

- Neovim (primary editor)
- neovim npm package (RPC client)
- Terminal output monitoring (pty.js or node-pty)
- Git hooks (nodegit or simple-git)
- File system watchers (chokidar)

**Visualization:**

- OBS Studio (broadcasting engine)
- Browser sources (HTML/CSS/JS overlays)
- Local LLM (Ollama API via fetch)

**APIs:**

- Anthropic Claude API (extract thinking blocks, tool calls)
- Neovim msgpack-rpc
- Local LLM API (Ollama HTTP)

## Phase 1: Foundation & Control Server (Week 1-2)

**Goal:** Get the central nervous system working. Prove we can control OBS and communicate with overlays.

### 1.1 Control Server Setup

```
mandrel-studio/
├── src/
│   ├── server.ts                 # Express + Socket.io server
│   ├── controllers/
│   │   ├── ObsController.ts      # OBS websocket wrapper
│   │   └── SocketManager.ts      # Overlay communication
│   ├── config/
│   │   └── config.ts             # Settings, OBS connection
│   └── types/
│       └── events.ts             # TypeScript event types
├── package.json
├── tsconfig.json
└── .env
```

**What it does:**

- Express server runs on localhost:8000
- Socket.io for real-time bidirectional communication
- Connects to OBS websocket (default: localhost:4455)
- Provides socket namespaces for different overlay types
- Basic REST endpoints for manual control/testing

**Key dependencies:**

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.6.1",
    "obs-websocket-js": "^5.0.3",
    "dotenv": "^16.0.3"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0",
    "nodemon": "^3.0.0"
  }
}
```

**Deliverables:**

- [ ] Express + Socket.io server running
- [ ] Successfully connect to OBS websocket
- [ ] Can switch scenes programmatically
- [ ] Can emit test messages to browser source overlay
- [ ] Simple web dashboard showing connection status

### 1.2 Basic OBS Setup

**Scenes to create:**

- `CODE_EDITOR` - Neovim in terminal, full screen
- `TERMINAL_FOCUS` - Terminal output, zoomed
- `OVERVIEW` - Split view: editor + overlays
- `THINKING` - Full overlay showcase (thinking blocks, context)

**Sources to configure:**

- Terminal window capture
- Browser source: `http://localhost:8000/overlay/main`
- Browser source: `http://localhost:8000/overlay/thinking-blocks`
- Browser source: `http://localhost:8000/overlay/git-status`

**Deliverables:**

- [ ] All scenes created and positioned
- [ ] Browser sources loading (even if blank)
- [ ] Can switch between scenes via Node.js
- [ ] Window capture working for terminal

### 1.3 First Overlay: Thinking Blocks

```
public/
├── overlays/
│   ├── thinking-blocks/
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
```

**What it does:**

- Connects to Socket.io server
- Receives thinking block data (text, type, timestamp)
- Displays in bottom-left corner
- Auto-scrolls, fades out old blocks
- Color-coded by block type

**Socket event:**

```typescript
interface ThinkingBlockEvent {
  type: "thinking_block";
  content: string;
  blockType: "reasoning" | "planning" | "reflection";
  timestamp: string;
}
```

**Client-side (overlay):**

```javascript
const socket = io("http://localhost:8000/thinking-blocks");
socket.on("block", (data) => {
  displayThinkingBlock(data);
});
```

**Deliverables:**

- [ ] Overlay displays test data
- [ ] Socket.io connection stable
- [ ] Clean, readable styling (translucent tiles)
- [ ] Auto-scroll works
- [ ] Can emit thinking blocks from Node and see them appear

---

## Phase 2: Development Activity Monitoring (Week 3-4)

**Goal:** Monitor what's happening in terminal/Neovim and react to it.

### 2.1 Terminal Output Monitor

```
src/
├── monitors/
│   ├── TerminalMonitor.ts
│   └── ErrorDetector.ts
```

**What it does:**

- Monitors stdout/stderr from terminal session
- Detects error patterns (stack traces, "Error:", exit codes)
- Classifies error severity
- Extracts error context (file, line number, message)

**Technical approach:**

- Use `node-pty` to wrap terminal session
- Parse ANSI output in real-time
- Regex patterns for common error formats
- Buffer last N lines for context

**Key code structure:**

```typescript
import * as pty from "node-pty";

class TerminalMonitor {
  private pty: pty.IPty;
  private errorDetector: ErrorDetector;

  constructor(private socketManager: SocketManager) {
    this.pty = pty.spawn("zsh", [], {
      name: "xterm-color",
      cwd: process.env.HOME,
      env: process.env,
    });

    this.pty.onData((data) => {
      this.processOutput(data);
    });
  }

  private processOutput(data: string): void {
    const error = this.errorDetector.detect(data);
    if (error) {
      this.socketManager.emitError(error);
    }
  }
}
```

**Deliverables:**

- [ ] Can capture terminal output in real-time
- [ ] Detects Python tracebacks
- [ ] Detects JavaScript/Node errors
- [ ] Detects shell command failures
- [ ] Emits error events to Socket.io clients
- [ ] Triggers OBS scene switch on error

### 2.2 Neovim Integration

```
src/
├── monitors/
│   ├── NeovimMonitor.ts
│   └── nvimRpc.ts
```

**What it does:**

- Connects to Neovim via RPC (msgpack-rpc)
- Tracks current buffer/file being edited
- Monitors cursor position
- Detects typing activity (buffer change events)
- Identifies idle periods

**Technical approach:**

- Neovim needs to expose RPC: `nvim --listen localhost:6666`
- Use `neovim` npm package
- Subscribe to buffer events via RPC
- Poll cursor position every 100ms during activity

**Key dependencies:**

```json
{
  "dependencies": {
    "neovim": "^4.10.1"
  }
}
```

**Key code structure:**

```typescript
import { attach } from "neovim";
import { Socket } from "net";

class NeovimMonitor {
  private nvim: any;
  private currentFile: string = "";
  private isTyping: boolean = false;

  async connect(): Promise<void> {
    const socket = new Socket();
    socket.connect(6666, "localhost");

    this.nvim = await attach({ socket });

    // Listen for buffer changes
    await this.nvim.command(
      'autocmd TextChanged,TextChangedI * call rpcnotify(1, "buffer_changed")',
    );

    this.nvim.on("notification", (method: string, args: any[]) => {
      if (method === "buffer_changed") {
        this.handleTyping();
      }
    });

    // Poll cursor position
    this.startCursorTracking();
  }

  private async getCurrentFile(): Promise<string> {
    const buffer = await this.nvim.buffer;
    const name = await buffer.name;
    return name;
  }

  private async getCursorPosition(): Promise<[number, number]> {
    const window = await this.nvim.window;
    const cursor = await window.cursor;
    return cursor;
  }
}
```

**Deliverables:**

- [ ] Successfully connect to Neovim RPC
- [ ] Can read current buffer name
- [ ] Can read cursor position (row, col)
- [ ] Detect when buffer changes (typing happening)
- [ ] Detect idle periods (no changes for 5+ seconds)

### 2.3 File Being Edited Overlay

```
public/
├── overlays/
│   ├── current-file/
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
```

**What it displays:**

- Top-right corner
- Current file path
- Language/file type icon
- Lines of code in file
- Time spent in this file

**Socket event:**

```typescript
interface FileUpdateEvent {
  type: "file_update";
  path: string;
  language: string;
  lineCount: number;
  cursorLine: number;
}
```

**Deliverables:**

- [ ] Shows current file being edited
- [ ] Updates in real-time as you switch buffers
- [ ] Clean, minimal design
- [ ] Fades in/out smoothly

### 2.4 Git Change Tracking

```
src/
├── monitors/
│   ├── GitMonitor.ts
│   └── gitHooks.ts
```

**What it does:**

- Monitors git repository for changes
- Hooks into git events (commit, stage, branch switch)
- Generates diff summaries
- Tracks which files changed

**Technical approach:**

- Use `chokidar` to monitor `.git/` directory
- Use `simple-git` for git operations
- On commit: extract diff, count changes
- On stage: show files being added

**Key dependencies:**

```json
{
  "dependencies": {
    "simple-git": "^3.19.0",
    "chokidar": "^3.5.3"
  }
}
```

**Key code structure:**

```typescript
import simpleGit, { SimpleGit } from "simple-git";
import chokidar from "chokidar";

class GitMonitor {
  private git: SimpleGit;
  private watcher: chokidar.FSWatcher;

  constructor(
    private repoPath: string,
    private socketManager: SocketManager,
  ) {
    this.git = simpleGit(repoPath);
    this.setupWatcher();
  }

  private setupWatcher(): void {
    this.watcher = chokidar.watch(`${this.repoPath}/.git/logs/HEAD`, {
      persistent: true,
    });

    this.watcher.on("change", () => {
      this.handleCommit();
    });
  }

  private async handleCommit(): Promise<void> {
    const log = await this.git.log({ maxCount: 1 });
    const latestCommit = log.latest;

    const diff = await this.git.diffSummary([
      `${latestCommit?.hash}~1`,
      latestCommit?.hash,
    ]);

    this.socketManager.emitGitCommit({
      message: latestCommit?.message || "",
      files: diff.files.map((f) => ({
        path: f.file,
        additions: f.insertions,
        deletions: f.deletions,
      })),
      timestamp: new Date().toISOString(),
    });
  }
}
```

**Deliverables:**

- [ ] Detects when `git commit` happens
- [ ] Extracts commit message
- [ ] Lists changed files with +/- line counts
- [ ] Sends data to overlay

### 2.5 Git Status Overlay

```
public/
├── overlays/
│   ├── git-status/
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
```

**What it displays:**

- Appears briefly after git commit (5 seconds)
- Shows commit message
- Lists changed files with stats
- Fades out automatically

**Socket event:**

```typescript
interface GitCommitEvent {
  type: "git_commit";
  message: string;
  files: Array<{
    path: string;
    additions: number;
    deletions: number;
  }>;
  timestamp: string;
}
```

**Deliverables:**

- [ ] Displays commit information
- [ ] Shows file changes clearly
- [ ] Auto-dismisses after 5 seconds
- [ ] Styled to match other overlays

---

## Phase 3: AI Reasoning Extraction (Week 5-6)

**Goal:** Extract and display Claude's thinking blocks and tool calls in real-time.

### 3.1 Claude API Interceptor

```
src/
├── ai-monitors/
│   ├── ClaudeInterceptor.ts
│   └── ThinkingExtractor.ts
```

**What it does:**

- Intercepts/monitors Claude API responses
- Extracts thinking blocks from streaming responses
- Identifies tool calls being made
- Tracks token usage

**Technical approach:**

- Use Anthropic TypeScript SDK
- Wrap streaming responses
- Parse for thinking blocks in real-time
- Extract tool use blocks
- Emit to Socket.io as they arrive

**Key dependencies:**

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.20.0"
  }
}
```

**Key code structure:**

```typescript
import Anthropic from "@anthropic-ai/sdk";

class ClaudeInterceptor {
  private client: Anthropic;

  constructor(private socketManager: SocketManager) {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async streamMessage(prompt: string): Promise<void> {
    const stream = await this.client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    stream.on("text", (text) => {
      // Extract thinking blocks from text
      const thinkingBlocks = this.extractThinking(text);
      thinkingBlocks.forEach((block) => {
        this.socketManager.emitThinkingBlock(block);
      });
    });

    stream.on("message", (message) => {
      // Extract tool calls
      const toolCalls = message.content.filter((c) => c.type === "tool_use");
      toolCalls.forEach((tool) => {
        this.socketManager.emitToolCall({
          toolName: tool.name,
          params: tool.input,
          timestamp: new Date().toISOString(),
        });
      });
    });
  }

  private extractThinking(text: string): Array<ThinkingBlock> {
    // Parse thinking blocks from response
    // Look for patterns or structured thinking
    return [];
  }
}
```

**Deliverables:**

- [ ] Can intercept Claude API responses
- [ ] Extracts thinking blocks in real-time
- [ ] Identifies tool calls (name, parameters)
- [ ] Sends to thinking blocks overlay
- [ ] Sends to tool call indicator overlay

### 3.2 Tool Call Indicator Overlay

```
public/
├── overlays/
│   ├── tool-calls/
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
```

**What it displays:**

- Top-left corner
- Each tool call as a small badge/icon
- Tool name + brief indicator
- Fades in as called, fades out after 3 seconds
- Stacks vertically if multiple tools called

**Socket event:**

```typescript
interface ToolCallEvent {
  type: "tool_call";
  toolName: string;
  params: Record<string, any>;
  timestamp: string;
}
```

**Deliverables:**

- [ ] Displays tool calls as they happen
- [ ] Shows tool name clearly
- [ ] Brief parameter preview (truncated)
- [ ] Auto-fades after completion
- [ ] Handles rapid successive tool calls

### 3.3 Enhanced Thinking Blocks Display

**Improvements to Phase 1 thinking blocks:**

- Classify thinking types (reasoning, planning, reflection)
- Color-code by type
- Show confidence indicators (if Claude hedges)
- Smooth scroll animation
- Cap at 5 visible blocks at once

**Deliverables:**

- [ ] Color-coded by thinking type
- [ ] Smooth animations
- [ ] Handles high-frequency updates
- [ ] Readable at a glance

---

## Phase 4: mandrel Context Integration (Week 7-8)

**Goal:** Show when context is saved and retrieved from vector database.

### 4.1 mandrel Event Monitor

```
src/
├── mandrel-integration/
│   ├── DbMonitor.ts
│   ├── ContextTracker.ts
│   └── VectorQueryLogger.ts
```

**What it does:**

- Monitors mandrel database operations
- Detects context saves (new embeddings)
- Tracks semantic queries (context retrieval)
- Logs similarity scores
- Identifies which past contexts are being referenced

**Technical approach:**

- Import your existing mandrel TypeScript code
- Add event emitters on save/query operations
- Send events to Socket.io
- Include metadata (what was saved, similarity scores)

**Integration with existing mandrel:**

```typescript
import { EventEmitter } from "events";
import { mandrelDB } from "./mandrel"; // Your existing code

class mandrelMonitor extends EventEmitter {
  constructor(private db: mandrelDB) {
    super();
    this.hookIntoOperations();
  }

  private hookIntoOperations(): void {
    // Wrap your existing save/query methods
    const originalSave = this.db.saveContext.bind(this.db);
    this.db.saveContext = async (...args) => {
      const result = await originalSave(...args);
      this.emit("context_saved", {
        content: args[0],
        type: args[1],
        timestamp: new Date().toISOString(),
      });
      return result;
    };

    const originalQuery = this.db.queryContext.bind(this.db);
    this.db.queryContext = async (...args) => {
      const results = await originalQuery(...args);
      this.emit("context_retrieved", {
        query: args[0],
        results: results.length,
        topSimilarity: results[0]?.similarity,
      });
      return results;
    };
  }
}
```

**Deliverables:**

- [ ] Detects when context is saved to mandrel
- [ ] Detects when context is retrieved
- [ ] Extracts similarity scores
- [ ] Sends events to overlay system

### 4.2 Context Save Popup Overlay

```
public/
├── overlays/
│   ├── context-save/
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
```

**What it displays:**

- Center of screen, brief appearance (3 seconds)
- "Context Saved" notification
- Brief preview of what was saved
- Icon indicating save type (code, decision, experiment)

**Socket event:**

```typescript
interface ContextSaveEvent {
  type: "context_save";
  contentPreview: string;
  saveType: "code_solution" | "decision" | "experiment";
  tags: string[];
  timestamp: string;
}
```

**Deliverables:**

- [ ] Appears when context saved
- [ ] Shows readable preview
- [ ] Styled consistently
- [ ] Dismisses automatically

### 4.3 Conversation Summary Sidebar

```
public/
├── overlays/
│   ├── conversation-summary/
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
```

**What it displays:**

- Right side of screen
- Vertical timeline of conversation
- Each exchange summarized (1 line each)
- Scrollable history
- Highlights key decisions/changes

**Technical approach:**

- Buffer conversation history in control server
- Use local LLM (Ollama) to generate 1-sentence summaries per exchange
- Send to overlay as conversation progresses
- Limit to last 10 exchanges

**Local LLM integration:**

```typescript
class ConversationSummarizer {
  async summarize(exchange: string): Promise<string> {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3",
        prompt: `Summarize this in one sentence (max 15 words): ${exchange}`,
        stream: false,
      }),
    });

    const data = await response.json();
    return data.response;
  }
}
```

**Socket event:**

```typescript
interface ConversationUpdateEvent {
  type: "conversation_update";
  exchanges: Array<{
    summary: string;
    timestamp: string;
    type: "question" | "response";
  }>;
}
```

**Deliverables:**

- [ ] Displays conversation summary
- [ ] Auto-scrolls as new exchanges added
- [ ] Local LLM generates summaries
- [ ] Clean, readable timeline design

---

## Phase 5: Automated Cinematography (Week 9-10)

**Goal:** Intelligent camera control based on activity and context.

### 5.1 Scene Director

```
src/
├── cinematography/
│   ├── SceneDirector.ts
│   ├── ZoomController.ts
│   └── TransitionManager.ts
```

**What it does:**

- Central decision-maker for camera control
- Receives all monitor events (errors, typing, commits, etc.)
- Applies rules to decide scene/zoom changes
- Manages cooldowns (prevent rapid switching)
- Handles smooth transitions

**Key code structure:**

```typescript
class SceneDirector {
  private currentScene: string = "CODE_EDITOR";
  private lastSceneChange: number = Date.now();
  private cooldownMs: number = 5000;

  constructor(
    private obsController: ObsController,
    private socketManager: SocketManager,
  ) {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.socketManager.on("error_detected", (error) => {
      this.handleError(error);
    });

    this.socketManager.on("typing_detected", () => {
      this.handleTyping();
    });

    this.socketManager.on("idle_detected", () => {
      this.handleIdle();
    });

    this.socketManager.on("git_commit", (commit) => {
      this.handleCommit(commit);
    });
  }

  private async handleError(error: any): Promise<void> {
    if (!this.canSwitchScene()) return;

    await this.obsController.setScene("TERMINAL_FOCUS");
    await this.obsController.zoomToError(error.line);
    this.lastSceneChange = Date.now();
  }

  private async handleTyping(): Promise<void> {
    if (this.currentScene !== "CODE_EDITOR" && this.canSwitchScene()) {
      await this.obsController.setScene("CODE_EDITOR");
      this.lastSceneChange = Date.now();
    }
  }

  private async handleIdle(): Promise<void> {
    if (this.canSwitchScene()) {
      await this.obsController.setScene("THINKING");
      this.lastSceneChange = Date.now();
    }
  }

  private canSwitchScene(): boolean {
    return Date.now() - this.lastSceneChange > this.cooldownMs;
  }
}
```

**Scene switching logic:**

```typescript
IF error detected in terminal:
    - Switch to TERMINAL_FOCUS scene
    - Zoom to error line
    - Wait 5 seconds before allowing switch

IF typing detected in Neovim:
    - Switch to CODE_EDITOR scene
    - Gentle zoom to cursor region

IF no activity for 10 seconds:
    - Switch to THINKING scene
    - Show overlays prominently

IF git commit happens:
    - Brief overlay (stays on current scene)
    - Show git status for 5 seconds

IF thinking blocks streaming:
    - If on THINKING scene, no change
    - If on CODE_EDITOR, add thinking block overlay
```

**Deliverables:**

- [ ] Scene director making decisions
- [ ] Smooth scene transitions (crossfade)
- [ ] Cooldown timers prevent spam
- [ ] Manual override capability
- [ ] Logging of all decisions (for debugging)

### 5.2 Zoom & Pan Automation

**What it does:**

- Calculate zoom region based on cursor position
- Smooth zoom transitions (easing functions)
- Pan to follow cursor movement
- Zoom to error location in terminal

**Technical approach:**

- OBS transform API via obs-websocket-js
- Calculate crop/zoom based on cursor coordinates
- Use easing: `ease-in-out` over 0.5-1 second
- Don't zoom on every cursor movement (threshold)

**Key code structure:**

```typescript
class ZoomController {
  private currentZoom: number = 1.0;
  private targetZoom: number = 1.0;
  private isAnimating: boolean = false;

  constructor(private obsController: ObsController) {}

  async zoomToCursor(x: number, y: number): Promise<void> {
    if (this.isAnimating) return;

    this.isAnimating = true;
    this.targetZoom = 1.5;

    // Calculate center point for zoom
    const centerX = x;
    const centerY = y;

    // Animate zoom over 500ms
    await this.animateZoom(
      this.currentZoom,
      this.targetZoom,
      centerX,
      centerY,
      500,
    );

    this.isAnimating = false;
  }

  private async animateZoom(
    start: number,
    end: number,
    centerX: number,
    centerY: number,
    durationMs: number,
  ): Promise<void> {
    const startTime = Date.now();

    const animate = async () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1);

      // Ease-in-out function
      const eased =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const currentZoom = start + (end - start) * eased;

      await this.obsController.setSceneItemTransform("terminal", {
        scaleX: currentZoom,
        scaleY: currentZoom,
        positionX: centerX * (1 - currentZoom),
        positionY: centerY * (1 - currentZoom),
      });

      if (progress < 1) {
        setTimeout(animate, 16); // ~60fps
      } else {
        this.currentZoom = end;
      }
    };

    await animate();
  }
}
```

**Deliverables:**

- [ ] Can zoom to specific cursor location
- [ ] Smooth zoom transitions
- [ ] Pan follows cursor (delayed/smoothed)
- [ ] Zoom to error line in terminal output
- [ ] Configurable zoom intensity

### 5.3 Control Dashboard

```
public/
├── dashboard/
│   ├── index.html
│   ├── style.css
│   └── script.js
```

**What it shows:**

- Current scene
- Automation status (enabled/disabled)
- Recent events log (errors, commits, tool calls)
- Manual scene controls
- Zoom sensitivity slider
- Scene switch cooldown timer

**Socket integration:**

```typescript
// Server emits status updates
socketManager.emit('status_update', {
  currentScene: 'CODE_EDITOR',
  automationEnabled: true,
  recentEvents: [...],
  cooldownRemaining: 2500
});
```

**Deliverables:**

- [ ] Web dashboard accessible at localhost:8000
- [ ] Shows system status in real-time
- [ ] Manual override buttons work
- [ ] Can adjust automation sensitivity
- [ ] Event log displays recent activity

---

## Phase 6: Error Intelligence & Audio (Week 11-12)

**Goal:** Smart error analysis and subtle audio feedback.

### 6.1 Local LLM Error Analyzer

```
src/
├── ai-monitors/
│   ├── LocalLlmClient.ts
│   └── ErrorAnalyzer.ts
```

**What it does:**

- Sends errors to local LLM (Ollama)
- Gets quick 2-3 sentence explanation
- Classifies error severity
- Suggests potential fix

**Ollama integration:**

```typescript
class LocalLlmClient {
  private baseUrl: string = "http://localhost:11434";

  async analyzeError(error: string, context: string): Promise<ErrorAnalysis> {
    const prompt = `You are analyzing a development error. Be concise (2-3 sentences max).

Error: ${error}
Context: ${context}

Provide:
1. What caused this
2. Severity (minor/moderate/critical)
3. Quick fix suggestion`;

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3",
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 100,
        },
      }),
    });

    const data = await response.json();
    return this.parseAnalysis(data.response);
  }

  private parseAnalysis(response: string): ErrorAnalysis {
    // Parse LLM response into structured format
    return {
      explanation: "",
      severity: "moderate",
      suggestion: "",
    };
  }
}
```

**Deliverables:**

- [ ] Local LLM running (Ollama with llama3)
- [ ] Can send errors and get responses
- [ ] Response time < 2 seconds
- [ ] Formatted for display

### 6.2 Error Explanation Overlay

```
public/
├── overlays/
│   ├── error-explanation/
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
```

**What it displays:**

- Bottom-center of screen
- Appears when error detected
- Shows LLM explanation
- Severity indicator (color-coded)
- Dismisses after 10 seconds or when error resolved

**Socket event:**

```typescript
interface ErrorExplanationEvent {
  type: "error_explanation";
  explanation: string;
  severity: "minor" | "moderate" | "critical";
  suggestion: string;
  timestamp: string;
}
```

**Deliverables:**

- [ ] Displays error explanations
- [ ] Color-coded by severity
- [ ] Readable, not distracting
- [ ] Auto-dismisses appropriately

### 6.3 Audio Cues

```
src/
├── audio/
│   ├── AudioManager.ts
│   └── sounds/
│       ├── thinking-start.wav
│       ├── tool-call.wav
│       ├── error.wav
│       ├── commit.wav
│       └── context-save.wav
```

**What it does:**

- Plays subtle audio cues for key events
- Thinking blocks start: soft "bloom" sound
- Tool call: gentle "click"
- Error: low warning tone
- Git commit: success chime
- Context save: subtle "save" sound

**Technical approach:**

- Use Web Audio API in browser sources
- Very low volume (background)
- Can be toggled off
- Sounds are < 0.5 seconds each

**Implementation:**

```typescript
class AudioManager {
  private audioContext: AudioContext;
  private sounds: Map<string, AudioBuffer> = new Map();
  private volume: number = 0.3;

  constructor() {
    this.audioContext = new AudioContext();
    this.loadSounds();
  }

  private async loadSounds(): Promise<void> {
    const soundFiles = [
      "thinking-start",
      "tool-call",
      "error",
      "commit",
      "context-save",
    ];

    for (const sound of soundFiles) {
      const response = await fetch(`/sounds/${sound}.wav`);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.sounds.set(sound, audioBuffer);
    }
  }

  play(soundName: string): void {
    const buffer = this.sounds.get(soundName);
    if (!buffer) return;

    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();

    source.buffer = buffer;
    gainNode.gain.value = this.volume;

    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    source.start(0);
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }
}
```

**Deliverables:**

- [ ] Audio cues play for each event type
- [ ] Volume is subtle, not annoying
- [ ] Can be disabled via dashboard
- [ ] Sounds are distinct but minimal

---

## Phase 7: Polish & Optimization (Week 13-14)

**Goal:** Make everything smooth, reliable, and performant.

### 7.1 Performance Optimization

**Tasks:**

- [ ] Profile Node.js server (identify bottlenecks)
- [ ] Optimize Socket.io message frequency
- [ ] Reduce OBS browser source count if needed
- [ ] Add message batching for high-frequency events
- [ ] Monitor CPU/memory usage during streams
- [ ] Use `cluster` module if needed for parallel processing

### 7.2 Error Handling & Reliability

**Tasks:**

- [ ] Add reconnection logic for OBS websocket
- [ ] Handle Neovim RPC disconnection gracefully
- [ ] Add fallbacks if local LLM is slow/unavailable
- [ ] Log all errors to file (winston or pino)
- [ ] Add health check endpoints
- [ ] Implement graceful shutdown

**Example error handling:**

```typescript
class ObsController {
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  async connect(): Promise<void> {
    try {
      await this.obs.connect("ws://localhost:4455");
      this.reconnectAttempts = 0;
    } catch (error) {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), 2000);
      } else {
        throw new Error("Failed to connect to OBS after multiple attempts");
      }
    }
  }
}
```

### 7.3 Configuration & Customization

```
config/
├── default.json
├── production.json
└── development.json
```

**Use `config` npm package:**

```json
{
  "obs": {
    "host": "localhost",
    "port": 4455,
    "password": ""
  },
  "neovim": {
    "host": "localhost",
    "port": 6666
  },
  "automation": {
    "sceneSwitchCooldown": 5000,
    "zoomIntensity": 1.5,
    "errorAnalysisEnabled": true
  },
  "audio": {
    "enabled": true,
    "volume": 0.3
  },
  "monitors": {
    "terminal": true,
    "neovim": true,
    "git": true,
    "claude": true,
    "mandrel": true
  }
}
```

**Deliverables:**

- [ ] Config file with all settings
- [ ] Dashboard allows runtime config changes
- [ ] Settings persist between sessions
- [ ] Sane defaults for first-time use
- [ ] Environment-specific configs

### 7.4 Documentation

**Create:**

- [ ] README with setup instructions
- [ ] OBS scene setup guide
- [ ] Neovim RPC setup instructions
- [ ] Control server API documentation
- [ ] Troubleshooting guide
- [ ] Architecture diagram

---

## Phase 8: Testing & Launch (Week 15-16)

**Goal:** Test everything end-to-end, fix bugs, go live.

### 8.1 Integration Testing

**Test scenarios:**

- [ ] Full coding session with all monitors active
- [ ] Intentionally trigger errors, verify zoom/explanation
- [ ] Make commits, verify git overlay appears
- [ ] Let it idle, verify scene switches to THINKING
- [ ] Rapid typing, verify no scene switch spam
- [ ] Claude API conversation, verify thinking blocks appear

**Testing script example:**

```typescript
// test/integration.test.ts
describe("mandrel Studio Integration", () => {
  it("should detect errors and switch scenes", async () => {
    // Trigger error in terminal
    // Verify scene switched to TERMINAL_FOCUS
    // Verify error explanation appeared
  });

  it("should track git commits", async () => {
    // Make a git commit
    // Verify git overlay appeared
    // Verify correct file changes displayed
  });
});
```

### 8.2 Stream Test Runs

**Tasks:**

- [ ] Do 2-3 test streams (private)
- [ ] Review recordings for issues
- [ ] Adjust timing, zoom speeds, overlay positions
- [ ] Get feedback on readability
- [ ] Ensure no sensitive info in overlays

### 8.3 Launch Prep

**Tasks:**

- [ ] Write stream titles/descriptions
- [ ] Prepare "what you're watching" explainer
- [ ] Test on slower internet connection
- [ ] Verify audio cues aren't annoying
- [ ] Do final polish on overlay styling
- [ ] Set up stream schedule

### 8.4 Go Live

- [ ] First public stream with full system
- [ ] Monitor for issues during stream
- [ ] Take notes on what needs adjustment
- [ ] Iterate based on real-world usage

---

## Project Structure (Final)

```
mandrel-studio/
├── src/
│   ├── server.ts
│   ├── controllers/
│   │   ├── ObsController.ts
│   │   └── SocketManager.ts
│   ├── monitors/
│   │   ├── TerminalMonitor.ts
│   │   ├── NeovimMonitor.ts
│   │   ├── GitMonitor.ts
│   │   └── ErrorDetector.ts
│   ├── ai-monitors/
│   │   ├── ClaudeInterceptor.ts
│   │   ├── ThinkingExtractor.ts
│   │   ├── LocalLlmClient.ts
│   │   └── ErrorAnalyzer.ts
│   ├── mandrel-integration/
│   │   ├── DbMonitor.ts
│   │   ├── ContextTracker.ts
│   │   └── VectorQueryLogger.ts
│   ├── cinematography/
│   │   ├── SceneDirector.ts
│   │   ├── ZoomController.ts
│   │   └── TransitionManager.ts
│   ├── audio/
│   │   └── AudioManager.ts
│   ├── config/
│   │   └── config.ts
│   └── types/
│       └── events.ts
├── public/
│   ├── dashboard/
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
│   ├── overlays/
│   │   ├── thinking-blocks/
│   │   ├── tool-calls/
│   │   ├── current-file/
│   │   ├── git-status/
│   │   ├── context-save/
│   │   ├── conversation-summary/
│   │   └── error-explanation/
│   └── sounds/
│       ├── thinking-start.wav
│       ├── tool-call.wav
│       ├── error.wav
│       ├── commit.wav
│       └── context-save.wav
├── config/
│   ├── default.json
│   ├── production.json
│   └── development.json
├── test/
│   └── integration.test.ts
├── package.json
├── tsconfig.json
├── .env
└── README.md
```

## Key Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.6.1",
    "obs-websocket-js": "^5.0.3",
    "@anthropic-ai/sdk": "^0.20.0",
    "neovim": "^4.10.1",
    "node-pty": "^1.0.0",
    "simple-git": "^3.19.0",
    "chokidar": "^3.5.3",
    "dotenv": "^16.0.3",
    "config": "^3.3.9",
    "winston": "^3.8.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/node": "^20.0.0",
    "@types/config": "^3.3.0",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0",
    "nodemon": "^3.0.0",
    "jest": "^29.5.0",
    "@types/jest": "^29.5.0"
  }
}
```

## Success Criteria

After all phases complete, you should have:

✅ Automated camera control (zooms, scene switches)
✅ Real-time thinking block display
✅ Tool call indicators
✅ Git change tracking with overlays
✅ Current file display
✅ Context save notifications
✅ Conversation summary sidebar
✅ Error detection with zoom & explanation
✅ Audio cues for key events
✅ Central control dashboard
✅ Smooth, non-jarring transitions
✅ Minimal manual intervention needed during coding

**The stream shows:**

- What you're coding (with context)
- How AI is thinking (in real-time)
- When knowledge is saved/retrieved
- Errors and their explanations
- The entire development process, automated

---

## Notes for Claude When Reading This

When implementing:

1. Start with Phase 1 to prove the foundation works
2. Each phase builds on previous phases
3. Test each component individually before integration
4. Neovim RPC setup: `nvim --listen localhost:6666`
5. OBS websocket default: `localhost:4455`
6. All overlays connect via Socket.io namespaces
7. Terminal monitoring uses `node-pty` for PTY wrapper
8. Audio cues use Web Audio API (browser-based)
9. Scene switching needs cooldowns to prevent spam
10. Everything is configurable via `config` package
11. Use TypeScript for type safety across the stack
12. Socket.io provides bidirectional real-time communication
13. Integration with existing mandrel codebase should be straightforward since it's already TypeScript

The goal is a system that runs itself while Brian codes, making AI development watchable without requiring Brian to perform or explain in real-time. Since everything is already Node.js/TypeScript, integration will be cleaner and more maintainable.
