// js/commands.js — All forensic command implementations for V.O.I.D.

import gameState, { getProcess, getChildren, killProcess } from './gameState.js';
import { printLine, printError, printSuccess, printWarning, printHeader, printInfo, printBlank, printSeparator } from './terminal.js';
import { addScore, removeScore } from './scoring.js';
import { triggerLesson } from './learning.js';

// ============================================================
// COMMAND REGISTRY
// ============================================================

const COMMANDS = {
  help:     { handler: cmdHelp,     desc: "List all available forensic commands" },
  hint:     { handler: cmdHint,     desc: "Get a contextual investigation hint (time penalty)" },
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
  for (const [name, cmd] of Object.entries(COMMANDS)) {
    printLine(`  ${name.padEnd(12)} ${cmd.desc}`);
  }
  printBlank();
  printInfo("Tip: Start with 'pstree' or 'pslist' to survey running processes.");
  printBlank();
}

function cmdHint() {
  const hintIndex = gameState.hintsUsed;
  if (hintIndex >= gameState.hints.length) {
    printWarning("No more hints available.");
    return;
  }
  const hint = gameState.hints[hintIndex];
  const penalty = hint.cost;
  gameState.hintsUsed++;
  gameState.timeRemaining = Math.max(0, gameState.timeRemaining - penalty);
  removeScore(penalty);

  printBlank();
  printWarning(`[HINT ${hintIndex + 1}/${gameState.hints.length}] (Time penalty: -${penalty}s)`);
  printLine(`  ${hint.text}`, 'hint-text');
  printBlank();
}

function cmdPslist() {
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

    let flag = '';
    if ((p.isMalicious || p.isSuspicious) && p.startTime > '13:00') flag = '  [!]';

    const cssClass = (p.isMalicious || p.isSuspicious) ? 'suspicious' : '';
    printLine(`${offset} ${name} ${pid} ${ppid} ${threads}   ${time}${flag}`, cssClass);
  }
  printBlank();
}

function cmdPstree() {
  printBlank();
  printHeader("Volatility 2.6.1 — pstree");
  printBlank();

  const pids = new Set(gameState.processes.map(p => p.pid));
  const roots = gameState.processes.filter(p => !pids.has(p.ppid));
  let hasSuspicious = false;

  function renderTree(proc, prefix, isLast) {
    const connector = prefix === '' ? '' : (isLast ? '└── ' : '├── ');
    let label = `${proc.name} (PID: ${proc.pid})`;
    if (proc.service) label += ` [${proc.service}]`;

    let flag = '';
    if (proc.isSuspicious && proc.startTime > '13:00') {
      flag = `  ← [!] Started ${proc.startTime} (late)`;
      hasSuspicious = true;
    }

    const cssClass = (proc.isMalicious || proc.isSuspicious) ? 'suspicious' : '';
    printLine(`${prefix}${connector}${label}${flag}`, cssClass);

    const children = gameState.processes.filter(p => p.ppid === proc.pid);
    children.forEach((child, i) => {
      const newPrefix = prefix + (prefix === '' ? '' : (isLast ? '    ' : '│   '));
      renderTree(child, newPrefix, i === children.length - 1);
    });
  }

  for (const root of roots) {
    renderTree(root, '', true);
  }

  if (hasSuspicious) {
    triggerLesson('pstree_anomaly');
  }
  printBlank();
}

function cmdNetscan() {
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

    let flag = c.suspicious ? '  [!]' : '';
    const cssClass = c.suspicious ? 'suspicious' : '';
    printLine(`${proto} ${local} ${remote} ${state} ${pid}  ${proc}${flag}`, cssClass);
  }

  const suspCount = gameState.connections.filter(c => c.suspicious).length;
  if (suspCount > 0) {
    printBlank();
    printWarning(`[!] ${suspCount} suspicious connection(s) detected to external hosts.`);
    gameState.foundC2Connection = true;
    addScore(100, 'Identified C2 connections');
    triggerLesson('c2_connection');
  }
  printBlank();
}

function cmdMalfind() {
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
      printWarning(`Process: ${p.name}  PID: ${p.pid}  Address: ${region.address}`);
      printLine(`  Flags: ${region.flags}`);
      printLine(`  Protection: ${region.protection}     [ALERT: RWX memory region]`, 'alert');
      printBlank();
      printLine(`  ${region.content}`, 'info');
      printSeparator();
      printBlank();
    }
  }

  if (found) {
    printWarning("[!] Injected code detected. Use 'yarascan --pid <PID>' or 'memdump --pid <PID>' for deeper analysis.");
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
  printBlank();
  printHeader(`Volatility 2.6.1 — yarascan (PID: ${pid})`);
  printBlank();

  if (proc.yaraResults.length === 0) {
    printSuccess(`No YARA matches found for ${proc.name} (PID: ${pid}).`);
    printInfo("Process memory appears clean.");
  } else {
    printWarning(`[!] YARA matches found in ${proc.name} (PID: ${pid}):`);
    printBlank();
    for (const yr of proc.yaraResults) {
      printLine(`  Rule:    ${yr.rule}`, 'warning');
      printLine(`  Offset:  ${yr.offset}`);
      printLine(`  Match:   ${yr.matchedString}`, 'info');
      printSeparator();
    }

    if (proc.isMalicious) {
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
  printBlank();
  printHeader(`Memory Dump — ${proc.name} (PID: ${pid})`);
  printBlank();

  if (proc.hexDump && proc.hexDump.length > 0) {
    for (const line of proc.hexDump) {
      let cssClass = '';
      if (line.startsWith('[!]')) cssClass = 'warning';
      else if (line.startsWith('0x')) cssClass = 'hex';
      else if (line.startsWith('Region:') || line.startsWith('Memory dump')) cssClass = 'header';
      printLine(line, cssClass);
    }

    if (proc.isMalicious) {
      gameState.extractedKey = true;
      addScore(200, 'Extracted AES encryption key from memory');
      printBlank();
      printSuccess("★ AES key has been captured and logged as evidence.");
      triggerLesson('aes_key_extracted');
    }
  } else {
    printInfo(`Standard memory layout for ${proc.name}. No notable artifacts.`);
  }
  printBlank();
}

function cmdHandles(args, flags) {
  const pid = getPidFromFlags(flags);
  if (pid === null) return;

  const proc = getProcess(pid);
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
      let cssClass = '';
      if (h.name.includes('RansomVoid') || h.name.includes('lsass') || h.name.includes('SUSPICIOUS') || h.name.includes('shadowcrypt')) {
        cssClass = 'suspicious';
        hasSusp = true;
      }
      printLine(`${type} ${name} ${h.access}`, cssClass);
    }
    if (hasSusp) triggerLesson('suspicious_handles');
  }
  printBlank();
}

function cmdDlllist(args, flags) {
  const pid = getPidFromFlags(flags);
  if (pid === null) return;

  const proc = getProcess(pid);
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
      const cssClass = isSusp ? 'suspicious' : '';
      if (isSusp) hasInjectedLib = true;
      printLine(`${d.base}   ${d.size.padEnd(12)}  ${d.path}`, cssClass);
    }
    if (hasInjectedLib) triggerLesson('ld_preload_detected');
  }
  printBlank();
}

function cmdEnvars(args, flags) {
  const pid = getPidFromFlags(flags);
  if (pid === null) return;

  const proc = getProcess(pid);
  printBlank();
  printHeader(`Environment Variables — ${proc.name} (PID: ${pid})`);
  printBlank();

  if (proc.envars.length === 0) {
    printInfo("Standard environment. No anomalies.");
  } else {
    let hasLdPreload = false;
    for (const e of proc.envars) {
      const isSusp = (e.name === 'PSExecutionPolicyPreference' || e.name === 'LD_PRELOAD' || e.name === 'SHADOW_C2');
      const cssClass = isSusp ? 'suspicious' : '';
      if (e.name === 'LD_PRELOAD') hasLdPreload = true;
      printLine(`  ${e.name} = ${e.value}`, cssClass);
    }
    if (hasLdPreload) triggerLesson('ld_preload_detected');
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
