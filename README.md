# V.O.I.D. — Volatile Output Investigation & Discovery

<p align="center">
  <em>A Serious Game for Computer Forensics education, focused on Memory Forensics and Live Incident Response.</em>
</p>

## 🔎 Game Concept

V.O.I.D. is a browser-based **Live Incident Response simulator** built entirely with a Command-Line Interface (CLI). It puts the player in the role of a SOC Analyst responding to an **active ransomware attack** on a corporate server.

The machine cannot be shut down — critical decryption keys exist **only in volatile memory** (RAM). The player must race against the clock, using forensic analysis tools to identify the malicious process, extract the AES encryption key from its memory, and terminate the ransomware before all corporate data is encrypted.

## Gameplay Flow

The game follows a structured, pedagogical sequence designed to introduce concepts before time pressure begins.

1. **Interactive Tutorial Overlay**. On a first visit, the player receives a guided tutorial that explains the terminal interface and the learning panel.
2. **Terminal Mission Briefing**. The briefing prints directly into the CLI with the operational context and objectives.
3. **Timer Activation**. The countdown starts only after the player confirms readiness by pressing Enter at the mission prompt.
4. **Live Investigation**. The player performs memory forensics actions while encryption progresses in real time.
5. **Post Game Sequence**. The end of the session is ordered as follows: transparent cyberpunk Game Over screen, knowledge assessment quiz, and final forensic report.

### Key Features
- **Dual OS Scenarios** - Choose between a Linux (Ubuntu Server) or Windows (Windows Server 2019) investigation, each with a distinct attack chain
- **Guided Onboarding** - A first run tutorial clarifies interface elements before the briefing starts
- **Terminal Native Briefing** - The mission context is delivered through the CLI to maintain immersion
- **Controlled Time Start** - The timer begins only after explicit analyst confirmation
- **Structured Post Game Assessment** - A Game Over screen, quiz, and report deliver feedback in a fixed order
- **Order of Volatility as Core Mechanic** - Terminating the ransomware before extracting the key causes irreversible data loss

## 🎯 Learning Outcomes

This project was developed as a supplementary activity (Serious Game) for the course "Computer Forensics and Cyber Crime Analysis" (Prof. Atzeni, Politecnico di Torino).

- **Live Response Under Stress** — Perform memory triage during an active high-impact incident
- **Order of Volatility** — Understand why volatile evidence must be captured before remediation
- **Malware Chain Identification** — Trace parent-child PID relationships to find the attack origin
- **Memory Analysis** — Apply Volatility-style tools (`pstree`, `malfind`, `yarascan`, `memdump`) on dynamic outputs
- **Evidence-First Methodology** — Learn that remediation without evidence preservation leads to data loss

## 💻 Architecture & Technologies

The game runs entirely client-side in the browser — no backend, no VM, no installation:

- **Frontend:** HTML5, Vanilla CSS (cyberpunk terminal theme), vanilla JavaScript (ES6 modules)
- **Data Engine:** Scenario state stored as mutable JSON, manipulated by player actions in real-time
- **Audio:** Synthetic sound effects via Web Audio API (no external files)
- **AI-Assisted Development:** As approved by the professor, the technical scaffolding (terminal UI, command parser, game loop) was developed with AI assistance, allowing the author to focus on forensic accuracy and educational content design

## 🚀 Quick Start

Play on GitHub Pages: https://botti01.github.io/VOID-Forensics-Game/

```bash
# Clone the repository
git clone https://github.com/Botti01/VOID-Forensics-Game.git
cd VOID-Forensics-Game

# Option 1: Just open index.html in your browser
# Option 2: Start a local server (recommended)
python3 -m http.server 8080
# Then open http://localhost:8080
```

See [TUTORIAL.md](TUTORIAL.md) for a detailed gameplay guide and command reference.

## 📁 Project Structure

```
VOID-Forensics-Game/
├── index.html                  # Entry point (start menu + game)
├── css/style.css               # Cyberpunk terminal theme
├── js/
│   ├── main.js                 # Bootstrap, menu logic, HUD
│   ├── terminal.js             # Terminal UI renderer
│   ├── parser.js               # Command tokenizer & dispatcher
│   ├── commands.js             # 16 forensic command implementations
│   ├── gameState.js            # Central mutable game state
│   ├── scenario.js             # Scenario selector (Linux/Windows)
│   ├── scenarios/
│   │   ├── linux.js            # Ubuntu Server attack scenario
│   │   └── windows.js          # Windows Server attack scenario
│   ├── gameLoop.js             # Timer & encryption progression
│   ├── scoring.js              # Score tracking & forensic report
│   └── audio.js                # Synthetic sound effects
├── TUTORIAL.md                 # How to play guide
└── README.md                   # This file
```

---

*Educational project by Andrea Botticella (s347291) — Politecnico di Torino, 2025/2026.*
