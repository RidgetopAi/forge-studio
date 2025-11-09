# OBS Connection and Scene Switching Tests

## Prerequisites

1. **OBS Studio** must be installed and running
2. **OBS WebSocket Server** must be enabled:
   - Open OBS Studio
   - Go to Tools → WebSocket Server Settings
   - Enable WebSocket Server
   - Port: 4455 (default)
   - Password: (leave empty or update .env file)

## Test Scenarios

### 1. Start Server Without OBS Running

**Test**: Server should start gracefully without OBS connection

```bash
npm run dev
```

**Expected Behavior**:
- Server starts successfully
- Logs warning about OBS not connected
- Server continues running
- Dashboard accessible at http://localhost:8000/dashboard

### 2. Connect to OBS

**Test**: Server connects to OBS when it's running

1. Start OBS Studio
2. Enable WebSocket Server (Tools → WebSocket Server Settings)
3. Start the Forge Studio server:

```bash
npm run dev
```

**Expected Behavior**:
- Server connects to OBS successfully
- Logs show "Successfully connected to OBS"
- Dashboard shows OBS status as "Connected"

### 3. Get Scene List

**Test**: API endpoint returns list of scenes

```bash
curl http://localhost:8000/api/obs/scenes
```

**Expected Response**:
```json
{
  "currentProgramSceneName": "Scene 1",
  "scenes": [
    {"sceneName": "Scene 1", "sceneIndex": 0},
    {"sceneName": "Scene 2", "sceneIndex": 1}
  ]
}
```

### 4. Get Current Scene

**Test**: API endpoint returns current active scene

```bash
curl http://localhost:8000/api/obs/scene/current
```

**Expected Response**:
```json
{
  "sceneName": "Scene 1"
}
```

### 5. Switch Scene via API

**Test**: Switch OBS scene programmatically

```bash
curl -X POST http://localhost:8000/api/obs/scene/switch \
  -H "Content-Type: application/json" \
  -d '{"sceneName": "Scene 2"}'
```

**Expected Behavior**:
- OBS switches to "Scene 2"
- API returns success
- Dashboard shows updated scene
- Socket.io clients receive scene_switch event

**Expected Response**:
```json
{
  "success": true,
  "sceneName": "Scene 2"
}
```

### 6. Switch Scene via Dashboard

**Test**: Dashboard UI can control OBS

1. Open http://localhost:8000/dashboard
2. Click on a scene button in the "Scene Control" section

**Expected Behavior**:
- OBS switches to selected scene
- Current scene display updates
- Selected button shows as active
- Event log shows scene switch

### 7. Socket.io Real-time Updates

**Test**: Socket clients receive real-time events

1. Open http://localhost:8000/tests/socket-client-test.html
2. Manually switch scenes in OBS
3. Or use the dashboard to switch scenes

**Expected Behavior**:
- Test client receives scene_switch events
- Test client receives status_update events
- Timestamps are current

### 8. OBS Disconnection and Reconnection

**Test**: Server handles OBS disconnection gracefully

1. Start server with OBS running
2. Close OBS Studio
3. Restart OBS Studio

**Expected Behavior**:
- Server detects disconnection
- Logs show reconnection attempts
- Server reconnects automatically when OBS is available
- Dashboard updates status in real-time

### 9. Health Check

**Test**: Health check endpoint works

```bash
curl http://localhost:8000/api/health
```

**Expected Response**:
```json
{
  "status": "ok",
  "obsConnected": true,
  "socketClients": 2,
  "timestamp": "2025-11-09T12:00:00.000Z"
}
```

### 10. Multiple Socket.io Clients

**Test**: Multiple clients can connect simultaneously

1. Open dashboard in 2 browser tabs
2. Open test client in another tab
3. Check health endpoint

**Expected Behavior**:
- All clients receive events
- `socketClients` count reflects all connections
- No conflicts or race conditions

## Success Criteria

✅ Server starts with and without OBS running
✅ Server connects to OBS WebSocket
✅ Can retrieve scene list via API
✅ Can get current scene via API
✅ Can switch scenes via API
✅ Can switch scenes via dashboard
✅ Socket.io clients receive real-time events
✅ Server reconnects when OBS restarts
✅ Health check endpoint works
✅ Multiple clients can connect

## Common Issues

### OBS Won't Connect

- Verify OBS WebSocket Server is enabled
- Check port 4455 is not in use
- Verify password matches (or is empty)
- Check firewall settings

### Scenes Not Switching

- Verify scene name exists in OBS
- Check OBS is not locked
- Verify WebSocket permissions

### Socket.io Not Connecting

- Check server is running
- Verify port 8000 is accessible
- Check browser console for errors
- Verify CORS settings
