// js/gameState.js — Central Game State for V.O.I.D.
// This module holds all mutable game state and provides methods to manipulate it.

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
};

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
  gameState.foundMaliciousProcess = false;
  gameState.foundC2Connection = false;
  gameState.foundInjectedCode = false;
  gameState.extractedKey = false;
  gameState.killedMalicious = false;
  gameState.hints = scenario.hints ? [...scenario.hints] : [];
}

/**
 * Log a player action for the final report.
 */
export function logAction(action, details = '') {
  const elapsed = gameState.totalTime - gameState.timeRemaining;
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timestamp = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  gameState.actionsLog.push({ timestamp, action, details });
  gameState.commandCount++;
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
