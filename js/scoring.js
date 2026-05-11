// js/scoring.js — Score Tracker & Final Report Generator for V.O.I.D.

import gameState from './gameState.js';
import { printLine, printBlank, printHeader, printSuccess, printWarning, printInfo, printError, printSeparator } from './terminal.js';

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
  printHeader("  COMMANDS EXECUTED");
  printSeparator();
  for (const a of gameState.actionsLog) {
    printLine(`  [${a.timestamp}]  ${a.details || a.action}`, 'dim');
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
