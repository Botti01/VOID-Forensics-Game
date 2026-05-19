# V.O.I.D. — Tutorial & Quick Start Guide

## 🚀 How to Launch

V.O.I.D. runs entirely in your browser — no installation needed.

### Option 1: Play on GitHub pages
[VOID GAME](https://botti01.github.io/VOID-Forensics-Game/)

### Option 2: Simple (just open the file)
1. Navigate to the project folder
2. Double-click `index.html` — it opens in your default browser
3. That's it!

### Option 3: Local Server (recommended for development)
```bash
cd VOID-Forensics-Game
python3 -m http.server 8080
```
Then open [http://localhost:8080](http://localhost:8080) in your browser.

---

## 🎮 How to Play

### Step 1 — Start Menu
When the game loads, you'll see the V.O.I.D. start screen:
1. **Enter your name** (analyst callsign) in the text field
2. **Select the target OS** — Linux (Ubuntu Server) or Windows (Windows Server 2019).
3. Click **"BEGIN INVESTIGATION"** (or press Enter)

### Step 2 — Read the Briefing
The terminal will display a classified briefing explaining:
- What server has been compromised
- What type of attack is underway (active ransomware)
- Why the server cannot be shut down (volatile evidence = AES key in RAM)
- Your 3-part mission

### Step 3 — Investigate
Use forensic commands to analyze the system. The **HUD bar** at the top shows:
- ⏱ **Time Remaining** — you have 10 minutes
- 🔴 **Encryption Progress** — files are being encrypted in real-time
- 🏆 **Score** — your investigation performance

### Step 4 — Win or Lose
- **WIN:** Extract the AES key from the malicious process's memory, then terminate it.
- **PARTIAL LOSS:** Kill the ransomware but forget to extract the key first — files are unrecoverable
- **LOSS:** Time runs out or encryption reaches 100%

---

## 📋 Available Commands

| Command | Description |
|---------|-------------|
| `help` | Show all available commands |
| `pslist` | List all running processes (flat table) |
| `pstree` | Show hierarchical process tree (parent-child) |
| `netscan` | Display active network connections |
| `malfind` | Scan for injected code (suspicious RWX memory) |
| `yarascan --pid <PID>` | Run YARA rules against a process's memory |
| `memdump --pid <PID>` | Dump hex view of a process's memory |
| `handles --pid <PID>` | Show open file/socket/mutex handles |
| `dlllist --pid <PID>` | List loaded libraries/DLLs |
| `envars --pid <PID>` | Show environment variables |
| `kill --pid <PID>` | Terminate a process (and its children) |
| `hint` | Get a contextual hint (costs time!) |
| `status` | Show current time, encryption %, and score |
| `clear` | Clear the terminal screen |
| `mute` | Toggle sound effects on/off |
| `report` | View your forensic report (after game ends) |
| `exit` | Exit from the game |

---

## 🧠 Educational Concepts Covered

- **Order of Volatility** — Why RAM evidence must be captured before anything else
- **Process Tree Analysis** — Using parent-child PID relationships to trace attack chains
- **Memory Injection Detection** — Identifying RWX memory, injected PE/ELF headers
- **Network Correlation** — Linking suspicious connections to malicious processes
- **Live Incident Response** — Making triage decisions under time pressure
- **Evidence Preservation** — Why extracting evidence before remediation is critical
