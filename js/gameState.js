// js/gameState.js — Central Game State for V.O.I.D.
// This module holds all mutable game state and provides methods to manipulate it.

import BEGINNER_TIER     from './levels/beginner.js';
import INTERMEDIATE_TIER from './levels/intermediate.js';
import EXPERT_TIER       from './levels/expert.js';

// Lookup table for the three modular tier configs.
const TIER_MAP = {
  beginner:     BEGINNER_TIER,
  intermediate: INTERMEDIATE_TIER,
  expert:       EXPERT_TIER,
};

const gameState = {
  // --- Meta ---
  gamePhase: 'loading', // 'loading' | 'intro' | 'playing' | 'won' | 'lost'
  scenarioMeta: null,

  // --- Core Data (populated from scenario) ---
  processes: [],
  connections: [],
  aesKey: '',
  maliciousPID: null,
  suspiciousPIDs: [],

  // --- Timer & Encryption ---
  totalTime: 600,        // seconds (10 minutes)
  timeRemaining: 600,
  encryptionProgress: 0, // 0-100
  encryptionRate: 2,     // % per tick
  tickInterval: 15,      // seconds between encryption ticks
  encryptedFiles: [],
  fileTargets: [],

  // --- Player Progress ---
  score: 0,
  hintsUsed: 0,
  actionsLog: [],
  commandCount: 0,
  innocentKills: 0,

  // --- Difficulty ---
  difficulty: 'beginner',
  difficultyConfig: {},
  difficultyFlags: {},

  // --- Hint Progress ---
  lastHintStage: null,
  lastHintText: '',
  pslistExecuted: false,
  pstreeExecuted: false,
  netscanExecuted: false,
  malfindExecuted: false,

  // --- Discovery Flags ---
  foundMaliciousProcess: false,
  foundC2Connection: false,
  foundInjectedCode: false,
  extractedKey: false,
  killedMalicious: false,

  // --- Settings ---
  soundEnabled: true,
  typewriterEnabled: false,
  playerName: '',
  hints: [],

  // --- Quiz Assessment ---
  postQuizScore: 0,
};

export const ACTION_TYPES = {
  SESSION_START: 'SESSION_START',
  EVIDENCE_ACCESS: 'EVIDENCE_ACCESS',
  DISCOVERY: 'DISCOVERY',
  HINT_USED: 'HINT_USED',
  PROCESS_KILLED: 'PROCESS_KILLED',
  KEY_EXTRACTED: 'KEY_EXTRACTED',
  GAME_OVER: 'GAME_OVER',
};

export const DIFFICULTY_CONFIGS = {
  beginner: {
    label: 'Beginner',
    encryptionRate: 2,
    tickInterval: 20,
    complexity: 'low',
    masqueradeMode: false,
  },
  intermediate: {
    label: 'Intermediate',
    encryptionRate: 2,
    tickInterval: 15,
    complexity: 'standard',
    masqueradeMode: false,
  },
  expert: {
    label: 'Expert',
    encryptionRate: 3,
    tickInterval: 12,
    complexity: 'high',
    masqueradeMode: true,
  },
};

export function setDifficulty(level) {
  const config = DIFFICULTY_CONFIGS[level] || DIFFICULTY_CONFIGS.intermediate;
  const normalized = DIFFICULTY_CONFIGS[level] ? level : 'intermediate';
  gameState.difficulty = normalized;
  gameState.difficultyConfig = { ...config };
  gameState.difficultyFlags = {
    complexity: config.complexity,
    masqueradeMode: !!config.masqueradeMode,
  };
  gameState.encryptionRate = config.encryptionRate;
  gameState.tickInterval = config.tickInterval;
}

export function applyDifficultyTuning() {
  const osType = gameState.scenarioMeta?.osType || 'linux';
  if (gameState.difficulty === 'beginner') {
    const malProc = gameState.processes.find(p => p.pid === gameState.maliciousPID);
    if (malProc) {
      if (osType === 'linux') {
        malProc.name = 'shadowcryptd';
        malProc.path = '/usr/bin/shadowcryptd';
        malProc.service = 'ransomware';
      } else {
        malProc.name = 'ransomvoid.exe';
        malProc.path = 'C:\\Windows\\System32\\ransomvoid.exe';
        malProc.service = 'ransomware';
      }
      malProc.isSuspicious = true;
    }
    gameState.suspiciousPIDs = [gameState.maliciousPID];
  }
}

/**
 * Apply a modular difficulty tier to the live game state.
 *
 * This is the preferred replacement for the setDifficulty + applyDifficultyTuning
 * pair. Call it AFTER initState() so the scenario processes are already loaded.
 *
 * What it does:
 *  1. Writes timing parameters (timer length, encryption speed) into state.
 *  2. Writes feature flags (masquerade, memdumpDelay, enableUtilities).
 *  3. Renames the malicious process according to the tier's masquerade config.
 *  4. Injects decoy processes (expert tier) that the analyst must not kill.
 *
 * @param {string} tierString - One of 'beginner' | 'intermediate' | 'expert'
 */
export function applyDifficultyTier(tierString) {
  const tier   = TIER_MAP[tierString] || TIER_MAP.intermediate;
  const osType = gameState.scenarioMeta?.osType || 'linux';

  // ── 1. Timing parameters ──────────────────────────────────────────────────
  gameState.difficulty      = tier.tier;
  gameState.totalTime       = tier.timerMinutes * 60;
  gameState.timeRemaining   = gameState.totalTime;
  gameState.encryptionRate  = tier.encryptionTickPercent;
  gameState.tickInterval    = tier.encryptionTickSeconds;

  // ── 2. Feature flags ──────────────────────────────────────────────────────
  // Store the full tier config for reference by other modules (e.g. commands.js
  // reads difficultyFlags.memdumpDelayMs to simulate extraction latency).
  gameState.difficultyConfig = { ...tier };
  gameState.difficultyFlags  = {
    masqueradeMode:  tier.masquerade,
    memdumpDelayMs:  tier.memdumpDelayMs,
  };

  // ── 3. Malicious process name override ────────────────────────────────────
  const malProc = gameState.processes.find(p => p.pid === gameState.maliciousPID);
  if (malProc) {
    const override = tier.maliciousProcessOverride[osType];
    if (override) {
      malProc.name    = override.name;
      malProc.path    = override.path;
      malProc.service = override.service;
    }
    // At beginner the process name is obviously wrong, so flag it with [!]
    // in pslist output. At higher tiers it looks legitimate — no flag.
    malProc.isSuspicious = !tier.masquerade;
  }

  // ── 4. Decoy process injection ────────────────────────────────────────────
  // Decoys are OS-specific. They are only present in expert tier but the
  // shape is consistent across all tiers (empty arrays for beginner/intermediate).
  const decoyList = tier.decoyProcesses
    ? (tier.decoyProcesses[osType] || [])
    : [];

  if (decoyList.length > 0) {
    const existingPids = new Set(gameState.processes.map(p => p.pid));
    for (const decoy of decoyList) {
      // Guard against double-injection when launchGame() is called repeatedly.
      if (!existingPids.has(decoy.pid)) {
        gameState.processes.push({ ...decoy });
        existingPids.add(decoy.pid);
      }
    }
  }

  // ── 5. suspiciousPIDs housekeeping ────────────────────────────────────────
  // Beginner marks only the single malicious PID as suspicious (drives the [!]
  // indicator). Intermediate and expert remove the pre-set suspicious flag so
  // the analyst cannot shortcut identification.
  if (tier.tier === 'beginner') {
    gameState.suspiciousPIDs = [gameState.maliciousPID];
  } else {
    // Clear the scenario's default suspicious list — masquerade means nothing
    // should be pre-flagged for the player.
    gameState.suspiciousPIDs = [];
  }

  // ── 6. Inject expert envars into malicious process ────────────────────────
  // Expert tier hides the C2 from netscan and places it in an environment
  // variable instead, forcing the analyst to use the envars command.
  if (tier.maliciousEnvars && malProc) {
    const envarList = tier.maliciousEnvars[osType] || [];
    for (const ev of envarList) {
      // Guard against duplicate injection on replay
      if (!malProc.envars.some(e => e.name === ev.name)) {
        malProc.envars.push({ ...ev });
      }
    }
  }

  // ── 7. Strip suspicious connections (expert tier) ─────────────────────────
  // When stripSuspiciousConnections is true, remove all connections flagged
  // as suspicious so netscan alone cannot reveal the C2 server.
  if (tier.stripSuspiciousConnections) {
    gameState.connections = gameState.connections.filter(c => !c.suspicious);
  }

  // ── 8. Scramble PIDs (anti-metagaming) ────────────────────────────────────
  // Runs last so that all injected processes (decoys, overrides) are included.
  scramblePIDs();
}

/**
 * Randomise all process PIDs (> 10) to prevent players from memorising
 * the malicious PID across sessions.
 *
 * Algorithm:
 *  1. Build oldPid -> newPid mapping for every process with PID > 10.
 *  2. Apply the new PIDs and remap PPID references.
 *  3. Remap PIDs in gameState.connections.
 *  4. Update gameState.maliciousPID and suspiciousPIDs.
 */
function scramblePIDs() {
  const pidMapping = {};

  // ── Step 1: generate unique random PIDs for every non-kernel process ───────
  const usedPIDs = new Set();
  // Pre-seed with kernel PIDs so we never collide with them
  for (const p of gameState.processes) {
    if (p.pid <= 10) usedPIDs.add(p.pid);
  }

  for (const proc of gameState.processes) {
    if (proc.pid <= 10) continue; // keep kernel/init PIDs stable (1, 2 …)
    let newPid;
    do {
      newPid = Math.floor(Math.random() * 9000) + 1000; // 1000-9999
    } while (usedPIDs.has(newPid));
    usedPIDs.add(newPid);
    pidMapping[proc.pid] = newPid;
  }

  // ── Step 2: apply new PIDs and remap parent references ────────────────────
  for (const proc of gameState.processes) {
    if (pidMapping[proc.pid]  !== undefined) proc.pid  = pidMapping[proc.pid];
    if (pidMapping[proc.ppid] !== undefined) proc.ppid = pidMapping[proc.ppid];
  }

  // ── Step 3: remap connection PIDs ─────────────────────────────────────────
  for (const conn of gameState.connections) {
    if (pidMapping[conn.pid] !== undefined) conn.pid = pidMapping[conn.pid];
  }

  // ── Step 4: update high-level PID references in game state ────────────────
  if (pidMapping[gameState.maliciousPID] !== undefined) {
    gameState.maliciousPID = pidMapping[gameState.maliciousPID];
  }
  gameState.suspiciousPIDs = gameState.suspiciousPIDs.map(
    pid => pidMapping[pid] !== undefined ? pidMapping[pid] : pid
  );
}

/**
 * Initialize game state from scenario data.
 * @param {object} scenario - The scenario data object from scenario.js
 */
export function initState(scenario) {
  gameState.scenarioMeta = scenario.meta;
  gameState.processes = JSON.parse(JSON.stringify(scenario.processes));
  gameState.connections = JSON.parse(JSON.stringify(scenario.connections));
  gameState.aesKey = scenario.aesKey;
  gameState.maliciousPID = scenario.maliciousPID;
  gameState.suspiciousPIDs = [...scenario.suspiciousPIDs];
  gameState.fileTargets = [...scenario.encryptionTargets];
  gameState.totalTime = scenario.meta.totalTime || 600;
  gameState.timeRemaining = gameState.totalTime;

  gameState.gamePhase = 'intro';
  gameState.encryptionProgress = 0;
  gameState.encryptedFiles = [];
  gameState.score = 0;
  gameState.hintsUsed = 0;
  gameState.actionsLog = [];
  gameState.commandCount = 0;
  gameState.innocentKills = 0;
  gameState.lastHintStage = null;
  gameState.lastHintText = '';
  gameState.pslistExecuted = false;
  gameState.pstreeExecuted = false;
  gameState.netscanExecuted = false;
  gameState.malfindExecuted = false;
  gameState.foundMaliciousProcess = false;
  gameState.foundC2Connection = false;
  gameState.foundInjectedCode = false;
  gameState.extractedKey = false;
  gameState.killedMalicious = false;
  gameState.hints = scenario.hints ? [...scenario.hints] : [];

  // Quiz score is set by quiz.js via gameState.postQuizScore
  gameState.postQuizScore = 0;
}

/**
 * Log a player action for the final report.
 */
export function logAction(actionType, description, severity = 'info') {
  const elapsed = Math.max(0, gameState.totalTime - gameState.timeRemaining);
  const hours = Math.floor(elapsed / 3600);
  const mins = Math.floor((elapsed % 3600) / 60);
  const secs = elapsed % 60;
  const timestamp = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  gameState.actionsLog.push({
    timestamp,
    actionType,
    description,
    severity,
  });
}

/**
 * Find a process by PID.
 */
export function getProcess(pid) {
  return gameState.processes.find(p => p.pid === pid);
}

/**
 * Get all children of a process (recursive).
 */
export function getChildren(pid) {
  const directChildren = gameState.processes.filter(p => p.ppid === pid);
  let all = [...directChildren];
  for (const child of directChildren) {
    all = all.concat(getChildren(child.pid));
  }
  return all;
}

/**
 * Kill a process and all its children. Returns result object.
 */
export function killProcess(pid) {
  const process = getProcess(pid);
  if (!process) {
    return { success: false, error: `No process found with PID ${pid}.` };
  }

  const children = getChildren(pid);
  const killed = [process, ...children];
  const pids = killed.map(p => p.pid);

  // Remove processes
  gameState.processes = gameState.processes.filter(p => !pids.includes(p.pid));

  // Remove associated connections
  gameState.connections = gameState.connections.filter(c => !pids.includes(c.pid));

  const wasMalicious = pid === gameState.maliciousPID || pids.includes(gameState.maliciousPID);
  const wasInnocent = !process.isMalicious && !process.isSuspicious;

  if (wasMalicious) {
    gameState.killedMalicious = true;
  }

  if (wasInnocent) {
    gameState.innocentKills++;
  }

  return {
    success: true,
    wasMalicious,
    wasInnocent,
    killed: killed.map(p => ({ pid: p.pid, name: p.name })),
  };
}

/**
 * Advance encryption by one tick.
 * Returns the file that was encrypted, or null.
 */
export function advanceEncryption() {
  if (gameState.encryptionProgress >= 100) return null;

  gameState.encryptionProgress = Math.min(100, gameState.encryptionProgress + gameState.encryptionRate);

  // Pick a file to "encrypt"
  const remaining = gameState.fileTargets.filter(f => !gameState.encryptedFiles.includes(f));
  if (remaining.length > 0) {
    const file = remaining[Math.floor(Math.random() * remaining.length)];
    gameState.encryptedFiles.push(file);
    return file;
  }
  return null;
}

/**
 * Check win/lose conditions.
 */
export function checkGameEnd() {
  if (gameState.killedMalicious && gameState.extractedKey) {
    return 'won';
  }
  if (gameState.killedMalicious && !gameState.extractedKey) {
    return 'partial_win';
  }
  if (gameState.timeRemaining <= 0 || gameState.encryptionProgress >= 100) {
    return 'lost';
  }
  return null;
}

/**
 * Format time remaining as MM:SS.
 */
export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default gameState;
