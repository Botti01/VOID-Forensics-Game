// js/main.js — Bootstrap and Game Initialization for V.O.I.D.

import gameState, { initState } from './gameState.js';
import { getScenario } from './scenario.js';
import { initTerminal, printIntro, printBlank, clearTerminal } from './terminal.js';
import { parseCommand } from './parser.js';
import { bindClear } from './commands.js';
import { startGameLoop, stopGameLoop } from './gameLoop.js';
import { playKeyClick } from './audio.js';

let selectedOS = 'linux';
let playerName = '';

document.addEventListener('DOMContentLoaded', () => { setupMenu(); });

function setupMenu() {
  const nameInput = document.getElementById('player-name');
  const startBtn = document.getElementById('btn-start');
  const osButtons = document.querySelectorAll('.os-btn');

  osButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      osButtons.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedOS = btn.dataset.os;
    });
  });

  nameInput.addEventListener('input', () => {
    playerName = nameInput.value.trim();
    startBtn.disabled = playerName.length === 0;
  });

  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && playerName.length > 0) launchGame();
  });

  startBtn.addEventListener('click', () => {
    if (playerName.length > 0) launchGame();
  });
}

function launchGame() {
  document.getElementById('start-menu').classList.add('hidden');
  document.getElementById('game-view').classList.remove('hidden');

  const scenario = getScenario(selectedOS);
  initState(scenario);
  gameState.playerName = playerName;

  const serverName = scenario.meta.target.toLowerCase();
  document.getElementById('terminal-prompt').textContent = `${playerName.toLowerCase()}@${serverName}:~$ `;
  document.getElementById('hud-analyst').textContent = playerName;

  initTerminal(handleCommand);
  bindClear(clearTerminal);

  document.getElementById('terminal-input').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') playKeyClick();
  });

  document.getElementById('hud-title').addEventListener('click', returnToMenu);
  setupLearningPanel();
  startIntroSequence(scenario);
}

function returnToMenu() {
  if (gameState.gamePhase === 'playing') {
    if (!confirm('Abort the current investigation and return to menu?')) return;
  }
  stopGameLoop();
  gameState.gamePhase = 'loading';
  document.getElementById('game-view').classList.add('hidden');
  document.getElementById('start-menu').classList.remove('hidden');
  document.getElementById('terminal-output').innerHTML = '';
  document.querySelectorAll('.lesson-toast').forEach(t => t.remove());
  document.getElementById('player-name').focus();
}

function setupLearningPanel() {
  const panel = document.getElementById('learning-panel');
  const closeBtn = document.getElementById('panel-close-btn');
  const toggleBtn = document.getElementById('learning-toggle');

  closeBtn.addEventListener('click', () => {
    panel.classList.add('collapsed');
    toggleBtn.classList.add('visible');
  });

  toggleBtn.addEventListener('click', () => {
    panel.classList.remove('collapsed');
    toggleBtn.classList.remove('visible');
  });
}

async function startIntroSequence(scenario) {
  const bootLines = [
    `[SYSTEM] Forensic Analysis Interface v2.6.1`,
    `[SYSTEM] Analyst: ${playerName}`,
    `[SYSTEM] Target OS: ${scenario.meta.os}`,
    `[SYSTEM] Establishing secure connection to ${scenario.meta.target}...`,
    `[SYSTEM] Connection established.`,
    "",
  ];

  await printIntro(bootLines, () => {});

  await printIntro(scenario.meta.briefing, () => {
    gameState.gamePhase = 'playing';
    startGameLoop(updateHUD);
    updateHUD();
    const input = document.getElementById('terminal-input');
    if (input) input.focus();
  });
}

function handleCommand(raw) {
  parseCommand(raw);
  if (gameState.gamePhase === 'won') {
    stopGameLoop();
    updateHUD();
  }
}

function updateHUD() {
  const timerEl = document.getElementById('hud-timer');
  const encryptEl = document.getElementById('hud-encryption');
  const encryptBar = document.getElementById('hud-encryption-bar');
  const scoreEl = document.getElementById('hud-score');

  if (timerEl) {
    const m = Math.floor(gameState.timeRemaining / 60);
    const s = gameState.timeRemaining % 60;
    timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    timerEl.classList.remove('critical', 'warning');
    if (gameState.timeRemaining <= 60) timerEl.classList.add('critical');
    else if (gameState.timeRemaining <= 120) timerEl.classList.add('warning');
  }
  if (encryptEl) encryptEl.textContent = `${gameState.encryptionProgress}%`;
  if (encryptBar) {
    encryptBar.style.width = `${gameState.encryptionProgress}%`;
    encryptBar.classList.remove('critical', 'danger');
    if (gameState.encryptionProgress > 75) encryptBar.classList.add('critical');
    else if (gameState.encryptionProgress > 50) encryptBar.classList.add('danger');
  }
  if (scoreEl) scoreEl.textContent = gameState.score;
}
