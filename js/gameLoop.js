// js/gameLoop.js — Timer, Encryption Progression, and Alert System for V.O.I.D.

import gameState, { advanceEncryption } from './gameState.js';
import { printAlert, printBlank, printError, printHeader, printInfo, lockInput } from './terminal.js';
import { playAlert } from './audio.js';
import { generateReport } from './scoring.js';

let timerInterval = null;
let encryptionInterval = null;
let updateHUDCallback = null;
let onGameOverCallback = null;

/**
 * Start the game loop (timer + encryption).
 * @param {Function} onHUDUpdate - callback to update the HUD display
 */
export function startGameLoop(onHUDUpdate, onGameOver) {
  updateHUDCallback = onHUDUpdate;
  onGameOverCallback = onGameOver || null;
  gameState.gamePhase = 'playing';

  // Timer: counts down every second
  timerInterval = setInterval(() => {
    if (gameState.gamePhase !== 'playing') {
      stopGameLoop();
      return;
    }

    gameState.timeRemaining--;

    if (updateHUDCallback) updateHUDCallback();

    // Check time-based game over
    if (gameState.timeRemaining <= 0) {
      gameState.timeRemaining = 0;
      triggerGameOver();
    }
  }, 1000);

  // Encryption: advances every tickInterval seconds
  encryptionInterval = setInterval(() => {
    if (gameState.gamePhase !== 'playing') return;

    const file = advanceEncryption();

    if (file) {
      printAlert(`[RANSOMWARE] ██ File encrypted: ${file} (${gameState.encryptionProgress}% complete)`);
      playAlert();
    }

    if (updateHUDCallback) updateHUDCallback();

    // Check encryption-based game over
    if (gameState.encryptionProgress >= 100) {
      triggerGameOver();
    }
  }, gameState.tickInterval * 1000);
}

/**
 * Stop all game loop intervals.
 */
export function stopGameLoop() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  if (encryptionInterval) { clearInterval(encryptionInterval); encryptionInterval = null; }
}

/**
 * Trigger game over (lost).
 */
function triggerGameOver() {
  stopGameLoop();
  gameState.gamePhase = 'lost';

  printBlank();
  printError("═══════════════════════════════════════════════════");
  printError("       ██  GAME OVER — INVESTIGATION FAILED  ██");
  printError("═══════════════════════════════════════════════════");
  printBlank();

  if (gameState.encryptionProgress >= 100) {
    printError("  All critical files have been encrypted.");
    printError("  The ransomware completed its operation.");
  } else {
    printError("  Time has expired.");
    printError(`  Encryption reached: ${gameState.encryptionProgress}%`);
  }

  printBlank();
  printInfo("  The volatile memory evidence has been lost.");
  printInfo("  Remember: In live incident response, speed is critical.");
  printBlank();

  generateReport();

  if (updateHUDCallback) updateHUDCallback();
  if (onGameOverCallback) onGameOverCallback();
}
