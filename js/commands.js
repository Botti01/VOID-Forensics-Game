// js/commands.js — All forensic command implementations for V.O.I.D.

import gameState, { getProcess, getChildren, killProcess, logAction, ACTION_TYPES } from './gameState.js';
import { printLine, printError, printSuccess, printWarning, printHeader, printInfo, printBlank, printSeparator, lockInput, unlockInput } from './terminal.js';
import { addScore, removeScore } from './scoring.js';
import { triggerLesson } from './learning.js';

// ============================================================
// COMMAND REGISTRY
// ============================================================

const COMMANDS = {
  help:     { handler: cmdHelp,     desc: "List all available forensic commands" },
  hint:     { handler: cmdHint,     desc: "Get a smart hint (time and encryption penalty)" },
  pslist:   { handler: cmdPslist,   desc: "List all running processes (flat view)" },
  pstree:   { handler: cmdPstree,   desc: "Display hierarchical process tree" },
  netscan:  { handler: cmdNetscan,  desc: "Show active network connections" },
  malfind:  { handler: cmdMalfind,  desc: "Detect injected code and suspicious memory regions" },
  yarascan: { handler: cmdYarascan, desc: "Scan process memory for YARA signatures (--pid <PID>)" },
  memdump:  { handler: cmdMemdump,  desc: "Dump process memory hex view (--pid <PID>)" },
  handles:  { handler: cmdHandles,  desc: "List open handles for a process (--pid <PID>)" },
  dlllist:  { handler: cmdDlllist,  desc: "List loaded DLLs for a process (--pid <PID>)" },
  envars:   { handler: cmdEnvars,   desc: "Show environment variables for a process (--pid <PID>)" },
  kill:     { handler: cmdKill,     desc: "Terminate a process and its children (--pid <PID>)" },
  status:   { handler: cmdStatus,   desc: "Show current encryption %, time remaining, score" },
  clear:    { handler: cmdClear,    desc: "Clear the terminal screen" },
  mute:     { handler: cmdMute,     desc: "Toggle sound effects on/off" },
  tutorial: { handler: cmdTutorial, desc: "Open the interactive tutorial overlay" },

};

const TRIAGE_FILES = [
  { name: 'readme.txt', size: '1.1K', note: 'Quick orientation notes' },
  { name: 'triage_script.py', size: '3.4K', note: 'Memory triage helper' },
  { name: 'ioc_list.txt', size: '512B', note: 'Known indicators' },
  { name: 'capture_notes.txt', size: '928B', note: 'Analyst log excerpt' },
];

const TRIAGE_CONTENT = {
  'readme.txt': [
    'V.O.I.D. TRIAGE DIRECTORY',
    '-------------------------',
    'Purpose: quick reference during live incident response.',
    '',
    'Suggested flow:',
    '1) Use pslist or pstree to identify late-starting processes.',
    '2) Use netscan to correlate suspicious PIDs with external IPs.',
    '3) Use malfind and yarascan to confirm injected code.',
    '4) Run memdump before kill to preserve volatile evidence.',
  ],
  'triage_script.py': [
    '# triage_script.py (mock)',
    '# Purpose: sample workflow outline for memory triage.',
    'print("Step 1: enumerate processes")',
    'print("Step 2: scan for RWX memory regions")',
    'print("Step 3: extract volatile keys before remediation")',
  ],
  'ioc_list.txt': [
    'KNOWN INDICATORS (SAMPLE)',
    '-------------------------',
    'C2 IP: 185.141.27.93',
    'C2 Ports: 443, 8443, 4444',
    'Suspicious library: libshadow.so',
    'Ransomware label: RansomVoid',
  ],
  'capture_notes.txt': [
    'ANALYST NOTES (EXCERPT)',
    '-----------------------',
    'Volatile evidence is time-sensitive.',
    'Kill without memdump = key loss.',
    'Look for late-starting service processes.',
  ],
};

const HINT_PENALTIES = {
  beginner: { time: 15, encryption: 2 },
  intermediate: { time: 30, encryption: 5 },
  expert: { time: 45, encryption: 10 },
};

/**
 * Execute a command by name.
 */
export function executeCommand(name, args, flags) {
  const cmd = COMMANDS[name];
  if (!cmd) {
    printError(`Command not found: '${name}'. Type 'help' for available commands.`);
    return;
  }
  cmd.handler(args, flags);
}

// ============================================================
// HELPER: Extract --pid flag
// ============================================================

function getPidFromFlags(flags) {
  const pidStr = flags['pid'];
  if (!pidStr) {
    printError("Missing required flag: --pid <PID>");
    printInfo("Usage: <command> --pid <PID>");
    return null;
  }
  const pid = parseInt(pidStr, 10);
  if (isNaN(pid)) {
    printError(`Invalid PID: '${pidStr}'. PID must be a number.`);
    return null;
  }
  const proc = getProcess(pid);
  if (!proc) {
    printError(`No process found with PID ${pid}.`);
    return null;
  }
  return pid;
}

// ============================================================
// COMMAND IMPLEMENTATIONS
// ============================================================

function cmdHelp() {
  printBlank();
  printHeader("Available Forensic Commands:");
  printSeparator();
  const hideUtilities = gameState.difficulty === 'beginner';
  for (const [name, cmd] of Object.entries(COMMANDS)) {
    if (hideUtilities && (name === 'ls' || name === 'cat')) continue;
    printLine(`  ${name.padEnd(12)} ${cmd.desc}`);
  }
  printBlank();
  printInfo("Tip: Start with 'pstree' or 'pslist' to survey running processes.");
  printBlank();
}

function cmdHint() {
  if (gameState.gamePhase !== 'playing') {
    printWarning('Hints are available during an active investigation.');
    return;
  }

  const maxHints = gameState.hints.length > 0 ? gameState.hints.length : 3;
  if (gameState.hintsUsed >= maxHints) {
    printWarning('No more hints available.');
    return;
  }

  const hintData = getSmartHint();

  if (gameState.lastHintStage === hintData.stage && gameState.lastHintText) {
    // Reminder: do not apply any penalties or log actions when re-requesting
    // the same hint stage without progressing (anti-exploit safeguard).
    printBlank();
    printWarning(`[REMINDER] ${gameState.lastHintText}`);
    printBlank();
    return;
  }

  const penalty = getHintPenalty();
  gameState.hintsUsed++;
  gameState.timeRemaining = Math.max(0, gameState.timeRemaining - penalty.time);
  gameState.encryptionProgress = Math.min(100, gameState.encryptionProgress + penalty.encryption);
  gameState.lastHintStage = hintData.stage;
  gameState.lastHintText = hintData.text;

  logAction(
    ACTION_TYPES.HINT_USED,
    `Smart hint used (penalty: -${penalty.time}s, +${penalty.encryption}% encryption)`,
    'warning'
  );

  printBlank();
  printError(`[HINT PENALTY] -${penalty.time}s time, +${penalty.encryption}% encryption`);
  printWarning(`HINT: ${hintData.text}`);
  printBlank();
}

function getHintPenalty() {
  const level = gameState.difficulty || 'intermediate';
  return HINT_PENALTIES[level] || HINT_PENALTIES.intermediate;
}

function getSmartHint() {
  if (!gameState.pslistExecuted && !gameState.pstreeExecuted) {
    return {
      stage: 'recon',
      text: "Survey running processes and identify services that started far later than boot.",
    };
  }

  if (!gameState.foundC2Connection && !gameState.foundInjectedCode) {
    return {
      stage: 'triage',
      text: "Correlate suspicious processes with external connections or injected memory regions.",
    };
  }

  if (!gameState.foundMaliciousProcess) {
    return {
      stage: 'confirmation',
      text: "Confirm the compromised service by inspecting memory signatures and anomalies.",
    };
  }

  if (!gameState.extractedKey) {
    return {
      stage: 'extraction',
      text: "Dump volatile memory from the malicious process before remediation.",
    };
  }

  if (!gameState.killedMalicious) {
    return {
      stage: 'remediation',
      text: "Terminate the ransomware only after the key is secured.",
    };
  }

  return {
    stage: 'complete',
    text: "Core objectives are complete. Use 'status' to review or wait for the report.",
  };
}

function cmdPslist() {
  gameState.pslistExecuted = true;
  logAction(ACTION_TYPES.EVIDENCE_ACCESS, 'Executed pslist (process snapshot)', 'info');
  printBlank();
  printHeader("Volatility 2.6.1 — pslist");
  printBlank();
  const header = "Offset(V)          Name                    PID   PPID   Thds   Start";
  const sep    = "────────────────── ──────────────────── ────── ────── ────── ───────────────────";
  printLine(header, 'table-header');
  printLine(sep, 'dim');

  for (const p of gameState.processes) {
    const offset = `0xffffae81${(34567890 + p.pid * 0x1000).toString(16).padStart(8, '0')}`;
    const name = p.name.padEnd(20);
    const pid = String(p.pid).padStart(6);
    const ppid = String(p.ppid).padStart(6);
    const threads = String(p.threads).padStart(6);
    const time = `2024-11-22 ${p.startTime}`;

    printLine(`${offset} ${name} ${pid} ${ppid} ${threads}   ${time}`);
  }
  printBlank();
}

function cmdPstree() {
  gameState.pstreeExecuted = true;
  logAction(ACTION_TYPES.EVIDENCE_ACCESS, 'Executed pstree (process hierarchy)', 'info');
  printBlank();
  printHeader("Volatility 2.6.1 — pstree");
  printBlank();

  const pids = new Set(gameState.processes.map(p => p.pid));
  const roots = gameState.processes.filter(p => !pids.has(p.ppid));

  function renderTree(proc, prefix, isLast) {
    const connector = prefix === '' ? '' : (isLast ? '└── ' : '├── ');
    let label = `${proc.name} (PID: ${proc.pid})`;

    printLine(`${prefix}${connector}${label}`);

    const children = gameState.processes.filter(p => p.ppid === proc.pid);
    children.forEach((child, i) => {
      const newPrefix = prefix + (prefix === '' ? '' : (isLast ? '    ' : '│   '));
      renderTree(child, newPrefix, i === children.length - 1);
    });
  }

  for (const root of roots) {
    renderTree(root, '', true);
  }
  printBlank();
}

function cmdNetscan() {
  gameState.netscanExecuted = true;
  logAction(ACTION_TYPES.EVIDENCE_ACCESS, 'Executed netscan (network connections)', 'info');
  printBlank();
  printHeader("Volatility 2.6.1 — netscan");
  printBlank();
  const header = "Proto    Local Address                Remote Address           State          PID    Process";
  const sep    = "──────── ─────────────────────────── ──────────────────────── ────────────── ────── ─────────────";
  printLine(header, 'table-header');
  printLine(sep, 'dim');

  for (const c of gameState.connections) {
    const proto = c.proto.padEnd(8);
    const local = c.localAddr.padEnd(27);
    const remote = c.remoteAddr.padEnd(24);
    const state = (c.state || '').padEnd(14);
    const pid = String(c.pid).padStart(6);
    const proc = c.process;
    printLine(`${proto} ${local} ${remote} ${state} ${pid}  ${proc}`);
  }

  const suspCount = gameState.connections.filter(c => c.suspicious).length;
  if (suspCount > 0) {
    if (!gameState.foundC2Connection) {
      logAction(ACTION_TYPES.DISCOVERY, 'Identified external C2 connections', 'success');
    }
    gameState.foundC2Connection = true;
    addScore(100, 'Identified C2 connections');
    triggerLesson('c2_connection');
  }
  printBlank();
}

function cmdMalfind() {
  gameState.malfindExecuted = true;
  logAction(ACTION_TYPES.EVIDENCE_ACCESS, 'Executed malfind (memory injection scan)', 'info');
  printBlank();
  printHeader("Volatility 2.6.1 — malfind");
  printBlank();

  let found = false;
  for (const p of gameState.processes) {
    const rwxRegions = p.memoryRegions.filter(r =>
      r.protection === 'PAGE_EXECUTE_READWRITE' || r.protection === 'rwxp'
    );
    if (rwxRegions.length === 0) continue;

    found = true;
    for (const region of rwxRegions) {
      printLine(`Process: ${p.name}  PID: ${p.pid}  Address: ${region.address}`);
      printLine(`  Flags:      ${region.flags}`);
      printLine(`  Protection: ${region.protection}`);
      printBlank();
      printLine(`  ${region.content}`);
      printSeparator();
      printBlank();
    }
  }

  if (found) {
    if (!gameState.foundInjectedCode) {
      logAction(ACTION_TYPES.DISCOVERY, 'Detected injected code via RWX memory regions', 'success');
    }
    gameState.foundInjectedCode = true;
    addScore(150, 'Detected injected code via malfind');
    triggerLesson('rwx_memory');
  } else {
    printInfo("No suspicious memory regions found.");
  }
  printBlank();
}

function cmdYarascan(args, flags) {
  const pid = getPidFromFlags(flags);
  if (pid === null) return;

  const proc = getProcess(pid);
  logAction(ACTION_TYPES.EVIDENCE_ACCESS, `Executed yarascan on PID ${pid} (${proc.name})`, 'info');
  printBlank();
  printHeader(`Volatility 2.6.1 — yarascan (PID: ${pid})`);
  printBlank();

  if (proc.yaraResults.length === 0) {
    printLine(`No YARA matches found for ${proc.name} (PID: ${pid}).`);
  } else {
    const header = "Rule                         Offset              Match";
    const sep    = "──────────────────────────── ─────────────────── ──────────────────────────────────────";
    printLine(header, 'table-header');
    printLine(sep, 'dim');
    for (const yr of proc.yaraResults) {
      const rule   = yr.rule.padEnd(28);
      const offset = yr.offset.padEnd(19);
      printLine(`${rule} ${offset} ${yr.matchedString}`);
    }

    if (proc.isMalicious) {
      if (!gameState.foundMaliciousProcess) {
        logAction(ACTION_TYPES.DISCOVERY, `Identified malicious process: ${proc.name} (PID: ${pid})`, 'success');
      }
      gameState.foundMaliciousProcess = true;
      addScore(100, `Identified malicious process: ${proc.name} (PID: ${pid})`);
    }
    triggerLesson('yara_malware');
  }
  printBlank();
}

function cmdMemdump(args, flags) {
  const pid = getPidFromFlags(flags);
  if (pid === null) return;

  const proc = getProcess(pid);
  logAction(ACTION_TYPES.EVIDENCE_ACCESS, `Executed memdump on PID ${pid} (${proc.name})`, 'info');
  printBlank();
  printHeader(`Memory Dump — ${proc.name} (PID: ${pid})`);
  printBlank();

  // Non-malicious processes always dump instantly (nothing special to extract)
  if (!proc.isMalicious) {
    if (proc.hexDump && proc.hexDump.length > 0) {
      for (const line of proc.hexDump) {
        let cssClass = '';
        if (line.startsWith('[!]')) cssClass = 'warning';
        else if (line.startsWith('0x')) cssClass = 'hex';
        else if (line.startsWith('Region:') || line.startsWith('Memory dump')) cssClass = 'header';
        printLine(line, cssClass);
      }
    } else {
      printInfo(`Standard memory layout for ${proc.name}. No notable artifacts.`);
    }
    printBlank();
    return;
  }

  // ── Malicious process: check for extraction delay ─────────────────────────
  const delayMs = gameState.difficultyFlags?.memdumpDelayMs || 0;

  if (delayMs > 0) {
    const delaySec = Math.round(delayMs / 1000);
    printLine(`Dumping memory for ${proc.name} (PID: ${pid})... estimated time: ${delaySec}s`);
    printBlank();

    const termInput = document.getElementById('terminal-input');
    if (termInput) {
      termInput.disabled = true;
      termInput.placeholder = 'Memory extraction in progress...';
    }

    setTimeout(() => {
      const stillExists = gameState.processes.find(p => p.pid === pid);
      if (!stillExists) {
        printError('[✗] Process terminated during memory dump — extraction failed.');
        printBlank();
      } else {
        if (proc.hexDump && proc.hexDump.length > 0) {
          for (const line of proc.hexDump) {
            let cssClass = '';
            if (line.startsWith('0x')) cssClass = 'hex';
            else if (line.startsWith('Region:') || line.startsWith('Memory dump')) cssClass = 'header';
            // Skip explicit [!] advisory lines — player reads the hex
            if (line.startsWith('[!]')) continue;
            printLine(line, cssClass);
          }
        }

        if (!gameState.extractedKey) {
          logAction(ACTION_TYPES.KEY_EXTRACTED, `Extracted AES key from ${proc.name} (PID: ${pid})`, 'success');
        }
        gameState.extractedKey = true;
        addScore(200, 'Extracted AES encryption key from memory');
        triggerLesson('aes_key_extracted');
        // Beginner tier: print explicit success — they cannot read hex dumps yet
        if (gameState.difficulty === 'beginner') {
          printBlank();
          printSuccess('[*] SUCCESS: AES encryption key successfully extracted and logged as evidence.');
        }
        printBlank();
      }

      if (termInput) {
        termInput.disabled = false;
        termInput.placeholder = 'Type a command...';
        termInput.focus();
      }
    }, delayMs);
  } else {
    // Beginner / Intermediate: instant extraction
    if (proc.hexDump && proc.hexDump.length > 0) {
      for (const line of proc.hexDump) {
        let cssClass = '';
        if (line.startsWith('0x')) cssClass = 'hex';
        else if (line.startsWith('Region:') || line.startsWith('Memory dump')) cssClass = 'header';
        // Skip explicit [!] advisory lines — player reads the hex
        if (line.startsWith('[!]')) continue;
        printLine(line, cssClass);
      }

      if (!gameState.extractedKey) {
        logAction(ACTION_TYPES.KEY_EXTRACTED, `Extracted AES key from ${proc.name} (PID: ${pid})`, 'success');
      }
      gameState.extractedKey = true;
      addScore(200, 'Extracted AES encryption key from memory');
      triggerLesson('aes_key_extracted');
      // Beginner tier: print explicit success — they cannot read hex dumps yet
      if (gameState.difficulty === 'beginner') {
        printBlank();
        printSuccess('[*] SUCCESS: AES encryption key successfully extracted and logged as evidence.');
      }
    } else {
      printInfo(`Standard memory layout for ${proc.name}. No notable artifacts.`);
    }
    printBlank();
  }
}

function cmdHandles(args, flags) {
  const pid = getPidFromFlags(flags);
  if (pid === null) return;

  const proc = getProcess(pid);
  logAction(ACTION_TYPES.EVIDENCE_ACCESS, `Executed handles on PID ${pid} (${proc.name})`, 'info');
  printBlank();
  printHeader(`Handles — ${proc.name} (PID: ${pid})`);
  printBlank();

  if (proc.handles.length === 0) {
    printInfo("No notable handles found.");
  } else {
    const header = "Type       Name                                                   Access";
    printLine(header, 'table-header');
    printSeparator();
    let hasSusp = false;
    for (const h of proc.handles) {
      const type = h.type.padEnd(10);
      const name = h.name.padEnd(55);
      // Detect suspicious handles for lesson trigger (no visual flag shown)
      if (h.name.includes('RansomVoid') || h.name.includes('lsass') || h.name.includes('SUSPICIOUS') || h.name.includes('shadowcrypt')) {
        hasSusp = true;
      }
      printLine(`${type} ${name} ${h.access}`);
    }
    if (hasSusp) triggerLesson('suspicious_handles');
  }
  printBlank();
}

function cmdDlllist(args, flags) {
  const pid = getPidFromFlags(flags);
  if (pid === null) return;

  const proc = getProcess(pid);
  logAction(ACTION_TYPES.EVIDENCE_ACCESS, `Executed dlllist on PID ${pid} (${proc.name})`, 'info');
  printBlank();
  printHeader(`DLL List — ${proc.name} (PID: ${pid})`);
  printBlank();

  if (proc.dlls.length === 0) {
    printInfo("Standard DLL list. No anomalies detected.");
  } else {
    const header = "Base                Size          Path";
    printLine(header, 'table-header');
    printSeparator();
    let hasInjectedLib = false;
    for (const d of proc.dlls) {
      const isSusp = d.path.includes('SUSPICIOUS') || d.path.includes('Temp\\') || d.path.includes('libshadow');
      if (isSusp) hasInjectedLib = true;
      // Strip the inline [!] SUSPICIOUS annotation from the path string
      const cleanPath = d.path.replace(/\s*\[!\].*$/, '');
      printLine(`${d.base}   ${d.size.padEnd(12)}  ${cleanPath}`);
    }
    if (hasInjectedLib) triggerLesson('ld_preload_detected');
  }
  printBlank();
}

function cmdEnvars(args, flags) {
  const pid = getPidFromFlags(flags);
  if (pid === null) return;

  const proc = getProcess(pid);
  logAction(ACTION_TYPES.EVIDENCE_ACCESS, `Executed envars on PID ${pid} (${proc.name})`, 'info');
  printBlank();
  printHeader(`Environment Variables — ${proc.name} (PID: ${pid})`);
  printBlank();

  if (proc.envars.length === 0) {
    printInfo("Standard environment. No anomalies.");
  } else {
    let hasLdPreload = false;
    let hasC2Endpoint = false;
    for (const e of proc.envars) {
      const isSusp = (e.name === 'PSExecutionPolicyPreference' || e.name === 'LD_PRELOAD' || e.name === 'SHADOW_C2' || e.name === 'C2_ENDPOINT');
      if (e.name === 'LD_PRELOAD') hasLdPreload = true;
      if (e.name === 'C2_ENDPOINT') hasC2Endpoint = true;
      printLine(`  ${e.name} = ${e.value}`);
    }
    if (hasLdPreload) triggerLesson('ld_preload_detected');

    // C2 discovery via environment variable (expert tier)
    if (hasC2Endpoint && proc.isMalicious) {
      printBlank();
      printWarning('[!] C2 endpoint configuration found in process environment.');
      if (!gameState.foundC2Connection) {
        logAction(ACTION_TYPES.DISCOVERY, 'Identified C2 endpoint via environment variables', 'success');
        addScore(100, 'Identified C2 connections');
      }
      gameState.foundC2Connection = true;
      triggerLesson('c2_connection');
    }
  }
  printBlank();
}

function cmdKill(args, flags) {
  const pid = getPidFromFlags(flags);
  if (pid === null) return;

  const proc = getProcess(pid);
  printBlank();

  const result = killProcess(pid);

  if (!result.success) {
    printError(result.error);
    return;
  }

  const childCount = Math.max(0, result.killed.length - 1);
  let killSeverity = 'warning';
  if (result.wasInnocent) killSeverity = 'critical';
  if (result.wasMalicious) killSeverity = 'success';
  const killDesc = childCount > 0
    ? `Terminated ${proc.name} (PID: ${pid}) and ${childCount} child process(es)`
    : `Terminated ${proc.name} (PID: ${pid})`;
  logAction(ACTION_TYPES.PROCESS_KILLED, killDesc, killSeverity);

  if (result.wasMalicious) {
    printSuccess(`[✓] Terminated malicious process: ${proc.name} (PID: ${pid})`);
    addScore(200, `Terminated ransomware process (PID: ${pid})`);
    for (const k of result.killed.filter(p => p.pid !== pid)) {
      printLine(`    └── Child terminated: ${k.name} (PID: ${k.pid})`, 'info');
    }

    if (gameState.extractedKey) {
      printBlank();
      printSuccess("═══════════════════════════════════════════════════");
      printSuccess("  ★  MISSION COMPLETE — RANSOMWARE NEUTRALIZED  ★");
      printSuccess("═══════════════════════════════════════════════════");
      printBlank();
      printSuccess(`  AES Key Recovered: ${gameState.aesKey}`);
      printSuccess(`  Encryption halted at: ${gameState.encryptionProgress}%`);
      gameState.gamePhase = 'won';
      logAction(ACTION_TYPES.GAME_OVER, 'Investigation concluded: MISSION SUCCESS', 'success');
      printBlank();
      // Report is shown via modal popup in main.js
    } else {
      printBlank();
      printWarning("═══════════════════════════════════════════════");
      printWarning("  PARTIAL SUCCESS — Ransomware stopped, but");
      printWarning("  the AES key was NOT recovered from memory!");
      printWarning("  Encrypted files cannot be decrypted.");
      printWarning("═══════════════════════════════════════════════");
      gameState.gamePhase = 'lost';
      logAction(ACTION_TYPES.GAME_OVER, 'Investigation concluded: PARTIAL SUCCESS (key not recovered)', 'critical');
      triggerLesson('killed_before_dump');
      printBlank();
      // Report is shown via modal popup in main.js
    }
  } else if (result.wasInnocent) {
    printError(`[✗] WARNING: You killed a LEGITIMATE process: ${proc.name} (PID: ${pid})`);
    printError("    Killing innocent processes disrupts system stability!");
    removeScore(50);
    for (const k of result.killed.filter(p => p.pid !== pid)) {
      printLine(`    └── Child terminated: ${k.name} (PID: ${k.pid})`, 'error');
    }
    triggerLesson('innocent_killed');
  } else {
    printWarning(`Terminated process: ${proc.name} (PID: ${pid})`);
    for (const k of result.killed.filter(p => p.pid !== pid)) {
      printLine(`    └── Child terminated: ${k.name} (PID: ${k.pid})`, 'info');
    }
  }
  printBlank();
}

function cmdStatus() {
  const m = Math.floor(gameState.timeRemaining / 60);
  const s = gameState.timeRemaining % 60;
  const time = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  printBlank();
  printHeader("System Status");
  printSeparator();
  printLine(`  Time Remaining:     ${time}`);
  printLine(`  Encryption:         ${gameState.encryptionProgress}%`, gameState.encryptionProgress > 60 ? 'alert' : 'warning');
  printLine(`  Score:              ${gameState.score}`);
  printLine(`  Commands Executed:  ${gameState.commandCount}`);
  printLine(`  Hints Used:         ${gameState.hintsUsed}`);
  printSeparator();
  printBlank();
}

function cmdLs() {
  printBlank();
  printHeader('Triage Directory');
  printSeparator();
  printLine('Name                 Size    Notes', 'table-header');
  printLine('-------------------- ------- ------------------------------', 'dim');
  for (const f of TRIAGE_FILES) {
    const name = f.name.padEnd(20);
    const size = f.size.padEnd(7);
    printLine(`${name} ${size} ${f.note}`);
  }
  printBlank();
}

function cmdCat(args) {
  const target = (args[0] || '').trim();
  if (!target) {
    printError("Missing file name. Usage: cat <file>");
    return;
  }

  const normalized = target.replace(/^\.\//, '');
  const content = TRIAGE_CONTENT[normalized];
  if (!content) {
    printError(`File not found: ${normalized}`);
    return;
  }

  printBlank();
  printHeader(`File: ${normalized}`);
  printSeparator();
  for (const line of content) {
    printLine(line);
  }
  printBlank();
}

function cmdClear() {
  const { clearTerminal } = require_terminal();
  clearTerminal();
}

// Avoid circular import: terminal clear is bound in main.js
let clearFn = null;
export function bindClear(fn) { clearFn = fn; }
function require_terminal() { return { clearTerminal: clearFn || (() => {}) }; }

function cmdMute() {
  gameState.soundEnabled = !gameState.soundEnabled;
  printInfo(`Sound effects: ${gameState.soundEnabled ? 'ON' : 'OFF'}`);
}

function cmdTutorial() {
  if (gameState.gamePhase !== 'playing') {
    printWarning('Tutorial is available during an active investigation.');
    return;
  }
  document.dispatchEvent(new CustomEvent('void:tutorial', { detail: { source: 'command' } }));
}
