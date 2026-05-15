// js/scoring.js — Score Tracker, Report Builder & Persistent Leaderboard for V.O.I.D.

import gameState from './gameState.js';
import { printLine, printBlank, printHeader, printSuccess, printWarning, printInfo, printError, printSeparator } from './terminal.js';
import { getAllLessons } from './learning.js';

const scoreLog = [];

/**
 * Add points with a reason.
 */
export function addScore(points, reason) {
  // Prevent duplicate scoring for same reason
  if (scoreLog.some(e => e.reason === reason)) return;
  gameState.score += points;
  scoreLog.push({ points, reason, type: 'bonus' });
}

/**
 * Remove points (penalty).
 */
export function removeScore(points) {
  gameState.score = Math.max(0, gameState.score - points);
  scoreLog.push({ points: -points, reason: 'Penalty', type: 'penalty' });
}

/**
 * Calculate final rank based on score.
 */
export function getRank(score) {
  if (score >= 900) return { rank: 'S', label: 'Expert ★★★★★', title: 'Expert Forensic Analyst', stars: '★★★★★' };
  if (score >= 750) return { rank: 'A', label: 'Senior ★★★★☆', title: 'Senior SOC Analyst', stars: '★★★★☆' };
  if (score >= 600) return { rank: 'B', label: 'Analyst ★★★☆☆', title: 'SOC Analyst', stars: '★★★☆☆' };
  if (score >= 400) return { rank: 'C', label: 'Junior ★★☆☆☆', title: 'Junior Analyst', stars: '★★☆☆☆' };
  return { rank: 'D', label: 'Trainee ★☆☆☆☆', title: 'Trainee', stars: '★☆☆☆☆' };
}

export function resetScoring() { scoreLog.length = 0; }
export function getScoreLog() { return [...scoreLog]; }

// ── Persistent Leaderboard (localStorage) ───────────────────────────────────

const LEADERBOARD_KEY_PREFIX = 'void_lb_';
const MAX_LEADERBOARD = 15;

/**
 * Load leaderboard entries from localStorage.
 * Returns a sorted array (descending by score).
 */
export function loadLeaderboard(difficulty = 'intermediate') {
  try {
    const key = LEADERBOARD_KEY_PREFIX + String(difficulty || 'intermediate');
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save the full leaderboard array to localStorage.
 */
function saveLeaderboard(entries, difficulty = 'intermediate') {
  try {
    const key = LEADERBOARD_KEY_PREFIX + String(difficulty || 'intermediate');
    localStorage.setItem(key, JSON.stringify(entries));
  } catch {
    /* Storage full or unavailable — fail silently */
  }
}

/**
 * Add a new entry to the persistent leaderboard.
 * Sorts by score descending, trims to MAX_LEADERBOARD.
 * Returns the updated array.
 */
export function addLeaderboardEntry(entry, difficulty = 'intermediate') {
  const key = difficulty || 'intermediate';
  const lb = loadLeaderboard(key);
  lb.push(entry);
  lb.sort((a, b) => b.score - a.score);
  const trimmed = lb.slice(0, MAX_LEADERBOARD);
  saveLeaderboard(trimmed, key);
  return trimmed;
}

// ── Report Data Builder ─────────────────────────────────────────────────────

/**
 * Build a structured report object with all investigation data.
 * Used by the modal UI, .txt export, and .json export.
 */
export function buildReportData() {
  const elapsed = gameState.totalTime - gameState.timeRemaining;
  const rank = getRank(gameState.score);
  const osType = gameState.scenarioMeta?.osType || 'linux';
  const malName = osType === 'linux'
    ? 'rsyslogd (LD_PRELOAD Injection)'
    : 'svchost.exe (Process Hollowing)';
  const malPID = gameState.maliciousPID || '?';
  const isWin = gameState.gamePhase === 'won';
  const lessons = getAllLessons();
  const now = new Date();

  return {
    // Header
    title: 'V.O.I.D. — Forensic Investigation Report',
    generatedAt: now.toISOString(),
    generatedAtReadable: now.toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }),
    version: '2.6.1',

    // Analyst info
    analyst: gameState.playerName,
    target: gameState.scenarioMeta?.target || '—',
    targetOS: gameState.scenarioMeta?.os || '—',
    osType,
    scenarioName: gameState.scenarioMeta?.name || '—',

    // Outcome
    outcome: isWin ? 'MISSION SUCCESS' : 'MISSION FAILED',
    isWin,
    rank: rank.rank,
    rankTitle: rank.title,
    rankStars: rank.stars,
    rankLabel: rank.label,

    // Timeline
    timeElapsedSeconds: elapsed,
    timeElapsedFormatted: fmtTimeForReport(elapsed),
    timeTotalFormatted: Math.floor(gameState.totalTime / 60) + ':00',
    encryptionPercent: gameState.encryptionProgress,
    filesEncrypted: gameState.encryptedFiles.length,
    filesTotal: gameState.fileTargets.length,

    // Investigation results
    findings: {
      malwareIdentified: gameState.foundMaliciousProcess,
      malwareName: malName,
      malwarePID: malPID,
      c2Found: gameState.foundC2Connection,
      injectedCodeFound: gameState.foundInjectedCode,
      aesKeyRecovered: gameState.extractedKey,
      aesKey: gameState.aesKey,
      ransomwareKilled: gameState.killedMalicious,
    },

    // Penalties
    innocentKills: gameState.innocentKills,
    innocentKillsPenalty: gameState.innocentKills * 50,
    hintsUsed: gameState.hintsUsed,

    // Score
    score: gameState.score,
    maxScore: 1000,
    scoreBreakdown: getScoreLog(),

    // Audit trail
    commandCount: gameState.commandCount,
    actionsLog: gameState.actionsLog.map(a => ({
      timestamp: a.timestamp,
      actionType: a.actionType,
      description: a.description,
      severity: a.severity,
    })),

    // Quiz Assessment
    postQuizScore: gameState.postQuizScore,

    // Learning
    lessonsUnlocked: lessons.map(l => ({
      title: l.title,
      text: l.text,
      source: l.source,
    })),

    // Tips
    learningNotes: buildLearningNotes(),
  };
}

function buildLearningNotes() {
  const notes = [];
  if (!gameState.foundMaliciousProcess) {
    notes.push("Use 'pstree' to identify processes starting abnormally late.");
  }
  if (!gameState.foundC2Connection) {
    notes.push("Use 'netscan' to find connections to unknown external IPs.");
  }
  if (!gameState.extractedKey) {
    notes.push("Always run 'memdump --pid <PID>' BEFORE killing a process.");
  }
  if (gameState.innocentKills > 0) {
    notes.push("Verify a process is malicious before terminating it.");
  }
  if (notes.length === 0) {
    notes.push("Excellent investigation — no critical mistakes!");
  }
  return notes;
}

function fmtTimeForReport(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ── Export Generators ───────────────────────────────────────────────────────

/**
 * Generate a formatted plain-text (.txt) forensic report string.
 */
export function generateTxtReport(data) {
  const sep = '═'.repeat(60);
  const dash = '─'.repeat(60);
  const lines = [];

  lines.push(sep);
  lines.push('  V.O.I.D. — FORENSIC INVESTIGATION REPORT');
  lines.push('  Volatile Output Investigation & Discovery');
  lines.push(sep);
  lines.push('');
  lines.push(`  Generated:  ${data.generatedAtReadable}`);
  lines.push(`  Version:    ${data.version}`);
  lines.push('');
  lines.push(dash);
  lines.push('  ANALYST & TARGET');
  lines.push(dash);
  lines.push(`  Analyst:           ${data.analyst}`);
  lines.push(`  Target:            ${data.target}`);
  lines.push(`  Target OS:         ${data.targetOS}`);
  lines.push(`  Scenario:          ${data.scenarioName}`);
  lines.push('');
  lines.push(dash);
  lines.push('  OUTCOME');
  lines.push(dash);
  lines.push(`  Result:            ${data.outcome}`);
  lines.push(`  Analyst Rating:    ${data.rankTitle} ${data.rankStars}`);
  lines.push(`  Rank:              ${data.rank}`);
  lines.push(`  Final Score:       ${data.score} / ${data.maxScore}`);
  lines.push('');
  lines.push(dash);
  lines.push('  TIMELINE');
  lines.push(dash);
  lines.push(`  Time Elapsed:      ${data.timeElapsedFormatted} / ${data.timeTotalFormatted}`);
  lines.push(`  Encryption at End: ${data.encryptionPercent}%`);
  lines.push(`  Files Encrypted:   ${data.filesEncrypted} / ${data.filesTotal}`);
  lines.push('');
  lines.push(dash);
  lines.push('  INVESTIGATION RESULTS');
  lines.push(dash);
  const f = data.findings;
  lines.push(`  Malware Identified:  ${f.malwareIdentified ? `YES — ${f.malwareName} (PID ${f.malwarePID})` : 'NO'}`);
  lines.push(`  C2 Server Found:     ${f.c2Found ? 'YES — External C2 connections detected' : 'NO'}`);
  lines.push(`  Injected Code:       ${f.injectedCodeFound ? 'YES — RWX memory detected via malfind' : 'NO'}`);
  lines.push(`  AES Key Recovered:   ${f.aesKeyRecovered ? `YES — ${f.aesKey}` : 'NO — Key lost'}`);
  lines.push(`  Ransomware Killed:   ${f.ransomwareKilled ? 'YES — Process terminated' : 'NO — Still running'}`);
  lines.push('');
  lines.push(dash);
  lines.push('  KNOWLEDGE ASSESSMENT');
  lines.push(dash);
  lines.push(`  Post-Investigation Verification Score: ${data.postQuizScore} / 3`);
  lines.push('');
  lines.push(dash);
  lines.push('  PENALTIES');
  lines.push(dash);
  lines.push(`  Innocent Kills:    ${data.innocentKills} (-${data.innocentKillsPenalty} pts)`);
  lines.push(`  Hints Used:        ${data.hintsUsed}`);
  lines.push('');
  lines.push(dash);
  lines.push('  SCORE BREAKDOWN');
  lines.push(dash);
  for (const e of data.scoreBreakdown) {
    const sign = e.points >= 0 ? '+' : '';
    lines.push(`  ${sign}${String(e.points).padStart(4)}  ${e.reason}`);
  }
  lines.push(`  ${'─'.repeat(30)}`);
  lines.push(`  TOTAL:  ${data.score} / ${data.maxScore}`);
  lines.push('');
  lines.push(dash);
  lines.push(`  CHAIN OF CUSTODY & AUDIT TRAIL (${data.actionsLog.length})`);
  lines.push(dash);
  if (data.actionsLog.length === 0) {
    lines.push('  (none)');
  } else {
    for (const a of data.actionsLog) {
      const sev = (a.severity || 'info').toUpperCase();
      lines.push(`  [${a.timestamp}]  [${a.actionType}]  [${sev}]  ${a.description}`);
    }
  }
  lines.push('');
  lines.push(dash);
  lines.push('  FORENSIC INSIGHTS UNLOCKED');
  lines.push(dash);
  if (data.lessonsUnlocked.length === 0) {
    lines.push('  (none)');
  } else {
    for (const l of data.lessonsUnlocked) {
      lines.push(`  * ${l.title}`);
      lines.push(`    ${l.text}`);
      lines.push(`    Source: ${l.source}`);
      lines.push('');
    }
  }
  lines.push(dash);
  lines.push('  LEARNING NOTES');
  lines.push(dash);
  for (const note of data.learningNotes) {
    lines.push(`  -> ${note}`);
  }
  lines.push('');
  lines.push(sep);
  lines.push('  END OF REPORT');
  lines.push(sep);

  return lines.join('\n');
}

/**
 * Generate a structured JSON report string.
 */
export function generateJsonReport(data) {
  return JSON.stringify(data, null, 2);
}

/**
 * Trigger a file download in the browser.
 * Uses a hidden anchor element with explicit download attribute.
 */
export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);

  // Use requestAnimationFrame to ensure the element is fully in the DOM
  // before triggering the click — prevents UUID-named downloads in some browsers
  requestAnimationFrame(() => {
    a.click();
    // Defer cleanup to allow the download to start
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);
  });
}

/**
 * Apply speed bonus (call once at game end).
 */
export function applySpeedBonus() {
  if (gameState.gamePhase === 'won') {
    const timeRatio = gameState.timeRemaining / gameState.totalTime;
    const speedBonus = Math.floor(timeRatio * 250);
    addScore(speedBonus, 'Speed bonus (time remaining)');
  }
}

/**
 * Generate and print the full forensic investigation report.
 * NOTE: Terminal report is no longer displayed — kept for reference.
 * The report is now shown via the modal popup in main.js.
 */
export function generateReport() {
  applySpeedBonus();
  const elapsed = gameState.totalTime - gameState.timeRemaining;
  const elapsedMin = Math.floor(elapsed / 60);
  const elapsedSec = elapsed % 60;
  const totalMin = Math.floor(gameState.totalTime / 60);

  const { rank, title, stars } = getRank(gameState.score);
  const outcome = gameState.gamePhase === 'won' ? 'MISSION SUCCESS' : 'MISSION FAILED';
  const osType = gameState.scenarioMeta?.osType || 'linux';
  const malName = osType === 'linux' ? 'rsyslogd (LD_PRELOAD Injection)' : 'svchost.exe (Process Hollowing)';
  const malPID = gameState.maliciousPID || '?';

  printBlank();
  printHeader("═══════════════════════════════════════════════════════════");
  printHeader("   V.O.I.D. — FORENSIC INVESTIGATION REPORT");
  printHeader("═══════════════════════════════════════════════════════════");
  printBlank();

  printLine(`  Analyst:            ${gameState.playerName}`, 'info');
  printLine(`  Target:             ${gameState.scenarioMeta?.target || '—'}`, 'info');
  printLine(`  Target OS:          ${gameState.scenarioMeta?.os || '—'}`, 'info');
  printBlank();
  printLine(`  Outcome:            ${outcome}`, gameState.gamePhase === 'won' ? 'success' : 'error');
  printLine(`  Analyst Rating:     ${title} ${stars}`, 'header');
  printLine(`  Rank:               ${rank}`);
  printBlank();

  printSeparator();
  printHeader("  TIMELINE");
  printSeparator();
  printLine(`  Time Elapsed:       ${String(elapsedMin).padStart(2,'0')}:${String(elapsedSec).padStart(2,'0')} / ${totalMin}:00`);
  printLine(`  Encryption at End:  ${gameState.encryptionProgress}%`);
  printLine(`  Files Encrypted:    ${gameState.encryptedFiles.length} / ${gameState.fileTargets.length}`);
  printBlank();

  printSeparator();
  printHeader("  INVESTIGATION RESULTS");
  printSeparator();
  printLine(`  Malware Identified: ${gameState.foundMaliciousProcess ? `✓ ${malName} (PID ${malPID})` : '✗ Not identified'}`,
    gameState.foundMaliciousProcess ? 'success' : 'error');
  printLine(`  C2 Server Found:    ${gameState.foundC2Connection ? '✓ External C2 connections detected' : '✗ Not found'}`,
    gameState.foundC2Connection ? 'success' : 'error');
  printLine(`  Injected Code:      ${gameState.foundInjectedCode ? '✓ RWX memory detected via malfind' : '✗ Not detected'}`,
    gameState.foundInjectedCode ? 'success' : 'error');
  printLine(`  AES Key Recovered:  ${gameState.extractedKey ? '✓ ' + gameState.aesKey : '✗ Key lost — files unrecoverable'}`,
    gameState.extractedKey ? 'success' : 'error');
  printLine(`  Ransomware Killed:  ${gameState.killedMalicious ? '✓ Process terminated' : '✗ Still running'}`,
    gameState.killedMalicious ? 'success' : 'error');
  printBlank();

  printSeparator();
  printHeader("  PENALTIES");
  printSeparator();
  printLine(`  Innocent Kills:     ${gameState.innocentKills} (−${gameState.innocentKills * 50} pts)`);
  printLine(`  Hints Used:         ${gameState.hintsUsed}`);
  printBlank();

  printSeparator();
  printHeader("  SCORE BREAKDOWN");
  printSeparator();
  for (const entry of scoreLog) {
    const sign = entry.points >= 0 ? '+' : '';
    const cssClass = entry.points >= 0 ? 'success' : 'error';
    printLine(`  ${sign}${entry.points}  ${entry.reason}`, cssClass);
  }
  printBlank();
  printLine(`  TOTAL SCORE:  ${gameState.score} / 1000`, 'header');
  printBlank();

  printSeparator();
  printHeader("  CHAIN OF CUSTODY & AUDIT TRAIL");
  printSeparator();
  for (const a of gameState.actionsLog) {
    const sev = (a.severity || 'info').toUpperCase();
    printLine(`  [${a.timestamp}]  [${a.actionType}]  [${sev}]  ${a.description}`, 'dim');
  }
  printBlank();

  // Educational feedback
  printSeparator();
  printHeader("  LEARNING NOTES");
  printSeparator();
  if (!gameState.foundMaliciousProcess) {
    printInfo("  → Use 'pstree' to identify processes starting abnormally late.");
    printInfo("    A system daemon starting 5+ hours after boot is a major red flag.");
  }
  if (!gameState.foundC2Connection) {
    printInfo("  → Use 'netscan' to find connections to unknown external IPs.");
    printInfo("    Legitimate system services rarely connect to external servers.");
  }
  if (!gameState.extractedKey) {
    printInfo("  → Always run 'memdump --pid <PID>' BEFORE killing a process.");
    printInfo("    Once killed, volatile memory is lost forever (Order of Volatility).");
  }
  if (gameState.innocentKills > 0) {
    printInfo("  → Verify a process is malicious before terminating it.");
    printInfo("    Check pstree, netscan, malfind, and dlllist first.");
  }
  printBlank();
  printHeader("═══════════════════════════════════════════════════════════");
  printBlank();
}
