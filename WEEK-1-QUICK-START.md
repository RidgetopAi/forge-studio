# FORGE STUDIO - WEEK 1 QUICK START

**Goal:** First broadcast ready in 7 days

---

## DAY 1-2: FOUNDATION

### Setup Project Structure
```bash
cd forge-live/forge-studio

# Create directories
mkdir -p server/src/integrations
mkdir -p control-panel
mkdir -p overlays/{context-transfer,mandrel-display,spindles-viewer,error-alert}
mkdir -p shared/styles
mkdir -p scripts
```

### Initialize Server
```bash
cd server
npm init -y
npm install express socket.io cors
npm install --save-dev nodemon typescript @types/node @types/express
```

**Create server/src/index.ts:**
```typescript
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

// State management
const state = {
  contextTransfer: { visible: false, topic: '', status: 0 },
  mandrel: { contexts: [] },
  spindles: { visible: true, blocks: [] },
  errorAlert: { active: false }
};

// Static files
app.use(express.static('../'));

// WebSocket connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send current state
  socket.emit('state:full', state);

  // Handle control commands
  socket.on('control:context:show', () => {
    state.contextTransfer.visible = true;
    io.emit('context:show');
  });

  socket.on('control:context:hide', () => {
    state.contextTransfer.visible = false;
    io.emit('context:hide');
  });

  // Add more handlers...

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Forge Studio Server running on http://localhost:${PORT}`);
});
```

### Test Server
```bash
npx nodemon src/index.ts
```

**✅ Checkpoint:** Server starts, WebSocket ready

---

## DAY 3: CONTEXT TRANSFER OVERLAY

### Migrate Existing Overlay

**Move files:**
```bash
# Copy context-transfer-standalone.html content to new overlay
cp ../forge-web/obs-overlays/context-transfer-standalone.html \
   overlays/context-transfer/index.html
```

**Create overlays/context-transfer/controller.js:**
```javascript
const socket = io('http://localhost:3000');

// Listen for control events
socket.on('context:show', () => {
  showBanner();
});

socket.on('context:hide', () => {
  hideBanner();
});

socket.on('context:updateTopic', (data) => {
  document.getElementById('topicText').textContent = data.topic;
});

socket.on('context:setStatus', (data) => {
  setStatus(data.status);
});

socket.on('context:reset', () => {
  resetStatuses();
});

// Remove standalone control panel
// Keep only the banner and its animations
```

**Update index.html:**
- Remove control panel div
- Remove toggle button
- Add Socket.IO client script
- Add controller.js script
- Keep all banner and status HTML/CSS

**✅ Checkpoint:** Overlay loads in browser, connects to server

---

## DAY 4: MANDREL DISPLAY & SPINDLES

### Mandrel Display Overlay

**Create overlays/mandrel-display/index.html:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>Mandrel Context Display</title>
  <link rel="stylesheet" href="../../shared/styles/hud-theme.css">
  <style>
    body {
      width: 400px;
      height: 600px;
      background: transparent;
      overflow: hidden;
    }

    .context-card {
      background: rgba(40, 50, 60, 0.9);
      border-left: 4px solid #6cbaef;
      border-radius: 4px;
      padding: 15px;
      margin-bottom: 10px;
      animation: slideIn 0.3s ease;
    }

    .context-type {
      color: #6cbaef;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      margin-bottom: 5px;
    }

    .context-content {
      color: #d0e0f0;
      font-size: 14px;
      line-height: 1.4;
    }

    @keyframes slideIn {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  </style>
</head>
<body>
  <div id="contexts"></div>

  <script src="http://localhost:3000/socket.io/socket.io.js"></script>
  <script src="controller.js"></script>
</body>
</html>
```

**Create overlays/mandrel-display/controller.js:**
```javascript
const socket = io('http://localhost:3000');
const maxVisible = 3;
let contexts = [];

socket.on('mandrel:newContext', (data) => {
  addContext(data);
});

socket.on('mandrel:clear', () => {
  contexts = [];
  render();
});

function addContext(context) {
  contexts.unshift(context);
  if (contexts.length > maxVisible) {
    contexts.pop();
  }
  render();

  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    contexts = contexts.filter(c => c !== context);
    render();
  }, 10000);
}

function render() {
  const container = document.getElementById('contexts');
  container.innerHTML = contexts.map(c => `
    <div class="context-card">
      <div class="context-type">${c.type}</div>
      <div class="context-content">${truncate(c.content, 100)}</div>
    </div>
  `).join('');
}

function truncate(str, len) {
  return str.length > len ? str.substring(0, len) + '...' : str;
}
```

### Connect to Mandrel

**Create server/src/integrations/mandrel-listener.ts:**
```typescript
// This will listen to Mandrel context_store events
// For now, we'll create a simple HTTP endpoint to test

export function setupMandrelIntegration(io: any) {
  // TODO: Hook into Mandrel MCP server
  // For Week 1: Manual trigger from control panel

  return {
    emitContext: (context: any) => {
      io.emit('mandrel:newContext', context);
    }
  };
}
```

### Spindles Viewer

**Create overlays/spindles-viewer/index.html:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>Spindles Viewer</title>
  <link rel="stylesheet" href="../../shared/styles/hud-theme.css">
  <style>
    body {
      width: 600px;
      height: 800px;
      background: rgba(20, 25, 30, 0.95);
      border: 1px solid rgba(108, 186, 239, 0.3);
      border-left: 4px solid #6cbaef;
      font-family: 'JetBrains Mono', monospace;
      overflow: hidden;
    }

    #content {
      padding: 20px;
      height: 100%;
      overflow-y: auto;
      color: #d0e0f0;
      font-size: 13px;
      line-height: 1.6;
    }

    .thinking-block {
      margin-bottom: 15px;
      padding: 10px;
      background: rgba(40, 50, 60, 0.5);
      border-radius: 4px;
    }

    .error {
      color: #ff6b6b;
      border-left: 3px solid #ff6b6b;
    }
  </style>
</head>
<body>
  <div id="content"></div>

  <script src="http://localhost:3000/socket.io/socket.io.js"></script>
  <script src="controller.js"></script>
</body>
</html>
```

**✅ Checkpoint:** Both overlays load and receive test data

---

## DAY 5: ERROR ALERT & CONTROL PANEL

### Error Alert Overlay

**Create overlays/error-alert/index.html:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>Error Alert</title>
  <style>
    body {
      width: 1920px;
      height: 1080px;
      background: transparent;
      margin: 0;
      padding: 0;
    }

    .error-border {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border: 4px solid transparent;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .error-border.active {
      opacity: 1;
      border-color: #ff6b6b;
      box-shadow:
        inset 0 0 50px rgba(255, 107, 107, 0.3),
        0 0 50px rgba(255, 107, 107, 0.5);
      animation: errorPulse 1s ease-in-out infinite;
    }

    @keyframes errorPulse {
      0%, 100% { opacity: 0.8; }
      50% { opacity: 1; }
    }
  </style>
</head>
<body>
  <div class="error-border" id="errorBorder"></div>

  <script src="http://localhost:3000/socket.io/socket.io.js"></script>
  <script>
    const socket = io('http://localhost:3000');
    const border = document.getElementById('errorBorder');

    socket.on('error:trigger', () => {
      border.classList.add('active');
    });

    socket.on('error:clear', () => {
      border.classList.remove('active');
    });
  </script>
</body>
</html>
```

### Control Panel

**Create control-panel/index.html:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>Forge Studio Control</title>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'JetBrains Mono', monospace;
      background: #1a1f26;
      color: #d0e0f0;
      padding: 20px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    h1 {
      color: #6cbaef;
      margin-bottom: 10px;
      font-size: 28px;
    }

    .status {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-left: 10px;
    }

    .status.connected { background: #4caf50; }
    .status.disconnected { background: #ff6b6b; }

    .section {
      background: rgba(40, 50, 60, 0.5);
      border: 1px solid rgba(108, 186, 239, 0.3);
      border-left: 4px solid #6cbaef;
      border-radius: 4px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .section h2 {
      color: #6cbaef;
      font-size: 18px;
      margin-bottom: 15px;
    }

    .controls {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 10px;
    }

    button {
      padding: 12px;
      background: rgba(108, 186, 239, 0.1);
      border: 1px solid rgba(108, 186, 239, 0.3);
      border-radius: 4px;
      color: #6cbaef;
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }

    button:hover {
      background: rgba(108, 186, 239, 0.2);
      border-color: #6cbaef;
    }

    button.active {
      background: #6cbaef;
      color: #1a1f26;
    }

    input[type="text"] {
      width: 100%;
      padding: 10px;
      background: #22272e;
      border: 1px solid rgba(108, 186, 239, 0.3);
      border-radius: 4px;
      color: #d0e0f0;
      font-family: 'JetBrains Mono', monospace;
      margin-bottom: 10px;
    }

    #activityLog {
      background: #22272e;
      border: 1px solid rgba(108, 186, 239, 0.2);
      border-radius: 4px;
      padding: 15px;
      max-height: 200px;
      overflow-y: auto;
      font-size: 12px;
    }

    .log-entry {
      margin-bottom: 5px;
      color: #7a8a9a;
    }

    .log-entry .time {
      color: #6cbaef;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>FORGE STUDIO CONTROL <span class="status disconnected" id="connectionStatus"></span></h1>

    <div class="section">
      <h2>Context Transfer</h2>
      <input type="text" id="topicInput" placeholder="Topic..." value="Building Multi-Agent Systems">
      <div class="controls">
        <button onclick="showContext()">Show Banner</button>
        <button onclick="hideContext()">Hide Banner</button>
        <button onclick="setStatus(1)">Status 1: Loaded</button>
        <button onclick="setStatus(2)">Status 2: Progress</button>
        <button onclick="setStatus(3)">Status 3: Complete</button>
        <button onclick="resetContext()">Reset</button>
      </div>
    </div>

    <div class="section">
      <h2>Mandrel Display</h2>
      <div class="controls">
        <button onclick="testMandrel()">Test Context</button>
        <button onclick="clearMandrel()">Clear</button>
      </div>
    </div>

    <div class="section">
      <h2>Error Alert</h2>
      <div class="controls">
        <button onclick="triggerError()">Trigger</button>
        <button onclick="clearError()">Clear</button>
      </div>
    </div>

    <div class="section">
      <h2>Activity Log</h2>
      <div id="activityLog"></div>
    </div>
  </div>

  <script src="http://localhost:3000/socket.io/socket.io.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

**Create control-panel/app.js:**
```javascript
const socket = io('http://localhost:3000');
const statusEl = document.getElementById('connectionStatus');
const logEl = document.getElementById('activityLog');

// Connection status
socket.on('connect', () => {
  statusEl.className = 'status connected';
  log('Connected to Forge Studio Server');
});

socket.on('disconnect', () => {
  statusEl.className = 'status disconnected';
  log('Disconnected from server');
});

// Context Transfer controls
function showContext() {
  const topic = document.getElementById('topicInput').value;
  socket.emit('control:context:updateTopic', { topic });
  socket.emit('control:context:show');
  log('Context Transfer: Show');
}

function hideContext() {
  socket.emit('control:context:hide');
  log('Context Transfer: Hide');
}

function setStatus(status) {
  socket.emit('control:context:setStatus', { status });
  log(`Context Transfer: Status ${status}`);
}

function resetContext() {
  socket.emit('control:context:reset');
  log('Context Transfer: Reset');
}

// Mandrel controls
function testMandrel() {
  socket.emit('control:mandrel:test', {
    type: 'decision',
    content: 'This is a test context from the control panel',
    timestamp: new Date().toISOString()
  });
  log('Mandrel: Test context sent');
}

function clearMandrel() {
  socket.emit('control:mandrel:clear');
  log('Mandrel: Cleared');
}

// Error controls
function triggerError() {
  socket.emit('control:error:trigger');
  log('Error Alert: Triggered');
}

function clearError() {
  socket.emit('control:error:clear');
  log('Error Alert: Cleared');
}

// Activity logging
function log(message) {
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<span class="time">${time}</span> - ${message}`;
  logEl.insertBefore(entry, logEl.firstChild);

  // Keep only last 50 entries
  while (logEl.children.length > 50) {
    logEl.removeChild(logEl.lastChild);
  }
}

// Listen for server events
socket.on('activity:log', (data) => {
  log(data.message);
});
```

**✅ Checkpoint:** Control panel controls all overlays

---

## DAY 6: INTEGRATION & SERVER UPDATES

### Update Server with All Handlers

**Add to server/src/index.ts:**
```typescript
// Context Transfer handlers
socket.on('control:context:show', () => {
  state.contextTransfer.visible = true;
  io.emit('context:show');
  io.emit('activity:log', { message: 'Context Transfer shown' });
});

socket.on('control:context:hide', () => {
  state.contextTransfer.visible = false;
  io.emit('context:hide');
  io.emit('activity:log', { message: 'Context Transfer hidden' });
});

socket.on('control:context:updateTopic', (data) => {
  state.contextTransfer.topic = data.topic;
  io.emit('context:updateTopic', data);
  io.emit('activity:log', { message: `Topic updated: ${data.topic}` });
});

socket.on('control:context:setStatus', (data) => {
  state.contextTransfer.status = data.status;
  io.emit('context:setStatus', data);
  io.emit('activity:log', { message: `Status set to ${data.status}` });
});

socket.on('control:context:reset', () => {
  state.contextTransfer.status = 0;
  io.emit('context:reset');
  io.emit('activity:log', { message: 'Context reset' });
});

// Mandrel handlers
socket.on('control:mandrel:test', (data) => {
  io.emit('mandrel:newContext', data);
  io.emit('activity:log', { message: 'Mandrel context: ' + data.type });
});

socket.on('control:mandrel:clear', () => {
  io.emit('mandrel:clear');
  io.emit('activity:log', { message: 'Mandrel cleared' });
});

// Error handlers
socket.on('control:error:trigger', () => {
  state.errorAlert.active = true;
  io.emit('error:trigger');
  io.emit('activity:log', { message: 'Error alert triggered' });
});

socket.on('control:error:clear', () => {
  state.errorAlert.active = false;
  io.emit('error:clear');
  io.emit('activity:log', { message: 'Error alert cleared' });
});
```

### Create Shared HUD Styles

**Create shared/styles/hud-theme.css:**
```css
/* Shared HUD styling for all overlays */

@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'JetBrains Mono', monospace;
  background: transparent;
  overflow: hidden;
}

/* HUD Color Palette */
:root {
  --hud-blue: #6cbaef;
  --hud-blue-glow: rgba(108, 186, 239, 0.3);
  --hud-dark: rgba(40, 50, 60, 0.9);
  --hud-text: #d0e0f0;
  --hud-text-dim: #7a8a9a;
  --error-red: #ff6b6b;
}

/* Standard animations */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; }
}
```

**✅ Checkpoint:** All systems integrated and working

---

## DAY 7: OBS SETUP & TESTING

### OBS Configuration

1. **Create Scenes:**
   - Main (Coding)
   - Talking
   - Starting Soon
   - BRB

2. **Add Browser Sources (in Main scene):**

```
Context Transfer:
  URL: http://localhost:3000/overlays/context-transfer
  Width: 1920, Height: 1080

Mandrel Display:
  URL: http://localhost:3000/overlays/mandrel-display
  Width: 400, Height: 600
  Position: Bottom-right (1500, 450)

Spindles Viewer:
  URL: http://localhost:3000/overlays/spindles-viewer
  Width: 600, Height: 800
  Position: Right side (1300, 100)

Error Alert:
  URL: http://localhost:3000/overlays/error-alert
  Width: 1920, Height: 1080
  (Full screen overlay)
```

3. **Copy Main scene sources to Talking scene**

### Testing Checklist

**Server Test:**
```bash
cd forge-studio/server
npm start
# Should see: "🚀 Forge Studio Server running on http://localhost:3000"
```

**Control Panel Test:**
- Open http://localhost:3000/control-panel
- Check green status dot
- Test each button
- Verify activity log updates

**Overlay Tests (in OBS):**
- [ ] Context Transfer shows/hides on command
- [ ] Topic updates in real-time
- [ ] Status changes work (1, 2, 3)
- [ ] Mandrel test context appears
- [ ] Error alert triggers red border
- [ ] All animations smooth

**End-to-End Test:**
1. Start server
2. Open control panel
3. Load all overlays in OBS
4. Run through full Context Transfer sequence
5. Trigger test Mandrel context
6. Trigger error alert
7. Verify all working together

### Create Startup Script

**Create scripts/start-studio.sh:**
```bash
#!/bin/bash

echo "🚀 Starting Forge Studio..."

cd server
npm start
```

Make executable:
```bash
chmod +x scripts/start-studio.sh
```

**✅ FINAL CHECKPOINT:** Ready for first broadcast!

---

## PRE-BROADCAST CHECKLIST

**24 Hours Before:**
- [ ] Full system test
- [ ] Backup current state
- [ ] Practice run-through
- [ ] Test internet connection
- [ ] Verify OBS settings

**1 Hour Before:**
- [ ] Start Forge Studio server
- [ ] Open control panel
- [ ] Load OBS scenes
- [ ] Test all overlays
- [ ] Test microphone/camera
- [ ] Post "going live soon" message

**Go Live:**
- [ ] Deep breath
- [ ] Remember: It's a learning experience
- [ ] Have fun building live!

---

## TROUBLESHOOTING

**Overlays not connecting:**
- Check server is running
- Verify WebSocket port (3000)
- Check browser console for errors
- Refresh browser sources in OBS

**Control panel not responding:**
- Check Socket.IO connection
- Verify server logs
- Hard refresh browser (Ctrl+Shift+R)

**Animations laggy:**
- Reduce FPS in OBS (try 30fps)
- Simplify overlay animations
- Check CPU usage

**Emergency Fallback:**
- Use original standalone overlay
- Manual scene switching
- Focus on content over tech

---

## SUCCESS!

After Day 7, you'll have:
✅ Working control server
✅ 4 functional overlays
✅ Central control panel
✅ OBS configured
✅ Ready to broadcast

**Remember:** Week 1 is about proving the concept. Perfection comes later.

**You got this!** 🚀
