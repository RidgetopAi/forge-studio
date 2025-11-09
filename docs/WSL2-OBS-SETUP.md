# WSL2 to Windows OBS Connection Guide

## Problem
WSL2 cannot connect to OBS running on Windows host.

## Solution Steps

### 1. Enable OBS WebSocket Server (Windows)

In **Windows OBS Studio**:
1. Open OBS Studio
2. Go to **Tools** → **WebSocket Server Settings**
3. Check **"Enable WebSocket server"**
4. **Server Port**: 4455 (default)
5. **Server Password**: Leave empty (or set and update .env)
6. Click **OK**

### 2. Allow Through Windows Firewall

**Option A: Quick Test (Disable Firewall Temporarily)**
```powershell
# In Windows PowerShell (Admin):
netsh advfirewall set allprofiles state off
```

**Option B: Add Firewall Rule (Recommended)**
```powershell
# In Windows PowerShell (Admin):
New-NetFirewallRule -DisplayName "OBS WebSocket" -Direction Inbound -LocalPort 4455 -Protocol TCP -Action Allow
```

### 3. Test Connection from Windows

```powershell
# In Windows PowerShell:
Test-NetConnection -ComputerName localhost -Port 4455
```

Should show: **TcpTestSucceeded : True**

### 4. Test Connection from WSL2

```bash
# In WSL2:
nc -zv 10.255.255.254 4455
# Or:
curl -v telnet://10.255.255.254:4455
```

Should connect successfully.

### 5. Verify .env Configuration

```bash
cat ~/aidis/projects/forge-live/forge-studio/.env
```

Should show:
```
OBS_HOST=10.255.255.254
OBS_PORT=4455
OBS_PASSWORD=
```

### 6. Restart FSCR Server

```bash
cd ~/aidis/projects/forge-live/forge-studio
npm run dev
```

## Troubleshooting

### Still Getting ECONNREFUSED?

1. **Check OBS WebSocket is actually enabled**
   - OBS → Tools → WebSocket Server Settings
   - "Enable WebSocket server" should be checked

2. **Check Windows Firewall**
   - Windows Defender Firewall → Advanced Settings
   - Inbound Rules → Look for port 4455

3. **Check OBS is not using a different port**
   - OBS → Tools → WebSocket Server Settings
   - Verify port is 4455

4. **Check from Windows side first**
   ```powershell
   # Windows PowerShell:
   netstat -an | findstr 4455
   ```
   Should show: `TCP    0.0.0.0:4455    0.0.0.0:0    LISTENING`

5. **If using password in OBS**
   - Update .env: `OBS_PASSWORD=your_password_here`

### Alternative: Find Windows Host IP

If 10.255.255.254 doesn't work, try:

```bash
# Method 1: From resolv.conf
cat /etc/resolv.conf | grep nameserver | awk '{print $2}'

# Method 2: From route
ip route show | grep default | awk '{print $3}'

# Method 3: Manual check
ipconfig.exe | grep -A 15 "WSL" | grep "IPv4" | cut -d: -f2 | tr -d ' \r'
```

### Test with WebSocket Client

```bash
# Install wscat if needed:
npm install -g wscat

# Test connection:
wscat -c ws://10.255.255.254:4455
```

## Success Indicators

When working correctly, you should see:

**FSCR Logs:**
```
2025-11-09 XX:XX:XX [info]: Connecting to OBS at ws://10.255.255.254:4455...
2025-11-09 XX:XX:XX [info]: Successfully connected to OBS
2025-11-09 XX:XX:XX [info]: OBS connected event received
```

**Dashboard:**
- OBS status: Green "Connected"
- Scene list populated with your OBS scenes
- Current scene displayed

**API Test:**
```bash
curl http://localhost:8000/api/obs/status
# Returns: {"connected":true}
```
