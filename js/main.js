// js/main.js — Bootstrap and Game Initialization for V.O.I.D.

import gameState, { initState } from './gameState.js';
import { getScenario } from './scenario.js';
import { initTerminal, printIntro, printBlank, clearTerminal } from './terminal.js';
import { parseCommand } from './parser.js';
import { bindClear } from './commands.js';
import { startGameLoop, stopGameLoop } from './gameLoop.js';
import { playKeyClick } from './audio.js';
import { getLessonCount, resetLessons, getAllLessons, waitForToastDismiss } from './learning.js';
import { getRank, resetScoring, getScoreLog, applySpeedBonus } from './scoring.js';

// Session leaderboard (persists in same tab)
const sessionLeaderboard = [];

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
  // Hide all views, show game
  document.getElementById('start-menu').classList.add('hidden');
  document.getElementById('results-page').classList.add('hidden');
  document.getElementById('game-view').classList.remove('hidden');

  // Reset for new game
  resetLessons();
  resetScoring();

  const scenario = getScenario(selectedOS);
  initState(scenario);
  gameState.playerName = playerName;

  // Prompt & HUD
  const serverName = scenario.meta.target.toLowerCase();
  document.getElementById('terminal-prompt').textContent = `${playerName.toLowerCase()}@${serverName}:~$ `;
  document.getElementById('hud-analyst').textContent = playerName;
  document.getElementById('hud-timer').textContent = '10:00';
  document.getElementById('hud-timer').className = 'hud-value';
  document.getElementById('hud-encryption').textContent = '0%';
  document.getElementById('hud-encryption-bar').style.width = '0%';
  document.getElementById('hud-encryption-bar').className = 'hud-bar-fill';
  document.getElementById('hud-score').textContent = '0';

  // Clear terminal (but keep learning panel notes from previous games)
  document.getElementById('terminal-output').innerHTML = '';

  // Ensure panel visible
  document.getElementById('learning-panel').classList.remove('collapsed');
  document.getElementById('learning-toggle').classList.remove('visible');

  // Clean up stale UI
  document.querySelectorAll('.lesson-toast, .toast-backdrop, .continue-btn-wrapper, .report-backdrop, .report-modal').forEach(el => el.remove());

  // Re-enable input
  const termInput = document.getElementById('terminal-input');
  termInput.disabled = false;
  termInput.placeholder = 'Type a command...';

  // Bind
  initTerminal(handleCommand);
  bindClear(clearTerminal);

  // Key clicks (clone to avoid duplicate listeners)
  const newInput = termInput.cloneNode(true);
  termInput.parentNode.replaceChild(newInput, termInput);
  newInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') playKeyClick();
  });
  // Re-bind terminal to new input
  initTerminal(handleCommand);

  // VOID logo → menu
  const hudTitle = document.getElementById('hud-title');
  const newTitle = hudTitle.cloneNode(true);
  hudTitle.parentNode.replaceChild(newTitle, hudTitle);
  newTitle.addEventListener('click', returnToMenu);

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
  document.getElementById('results-page').classList.add('hidden');
  document.getElementById('start-menu').classList.remove('hidden');
  document.querySelectorAll('.lesson-toast, .toast-backdrop, .report-backdrop, .report-modal').forEach(t => t.remove());
  document.getElementById('player-name').focus();
}

function setupLearningPanel() {
  const panel = document.getElementById('learning-panel');
  const closeBtn = document.getElementById('panel-close-btn');
  const toggleBtn = document.getElementById('learning-toggle');

  const nc = closeBtn.cloneNode(true);
  closeBtn.parentNode.replaceChild(nc, closeBtn);
  const nt = toggleBtn.cloneNode(true);
  toggleBtn.parentNode.replaceChild(nt, toggleBtn);

  nc.addEventListener('click', () => {
    panel.classList.add('collapsed');
    nt.classList.add('visible');
  });
  nt.addEventListener('click', () => {
    panel.classList.remove('collapsed');
    nt.classList.remove('visible');
  });
}

async function startIntroSequence(scenario) {
  await printIntro([
    `[SYSTEM] Forensic Analysis Interface v2.6.1`,
    `[SYSTEM] Analyst: ${playerName}`,
    `[SYSTEM] Target OS: ${scenario.meta.os}`,
    `[SYSTEM] Establishing secure connection to ${scenario.meta.target}...`,
    `[SYSTEM] Connection established.`,
    "",
  ], () => {});

  await printIntro(scenario.meta.briefing, () => {
    gameState.gamePhase = 'playing';
    startGameLoop(updateHUD, onGameOver);
    updateHUD();
    const input = document.getElementById('terminal-input');
    if (input) input.focus();
  });
}

function handleCommand(raw) {
  parseCommand(raw);
  if (gameState.gamePhase === 'won' || gameState.gamePhase === 'lost') {
    stopGameLoop();
    updateHUD();
    showEndGameUI();
  }
}

function onGameOver() {
  updateHUD();
  showEndGameUI();
}

function showEndGameUI() {
  const termInput = document.getElementById('terminal-input');
  if (termInput) {
    termInput.disabled = true;
    termInput.placeholder = 'Investigation complete.';
  }

  // Wait for any active lesson toast to be read and dismissed first
  waitForToastDismiss().then(() => showReportModal());
}

function showReportModal() {
  // Remove stale modals
  document.querySelectorAll('.report-backdrop, .report-modal, .continue-btn-wrapper').forEach(el => el.remove());

  // Apply speed bonus before building report
  applySpeedBonus();

  // Gather data
  const elapsed = gameState.totalTime - gameState.timeRemaining;
  const rank = getRank(gameState.score);
  const osType = gameState.scenarioMeta?.osType || 'linux';
  const malName = osType === 'linux' ? 'rsyslogd (LD_PRELOAD Injection)' : 'svchost.exe (Process Hollowing)';
  const malPID = gameState.maliciousPID || '?';
  const isWin = gameState.gamePhase === 'won';
  const scoreLog = getScoreLog();
  const lessons = getAllLessons();

  const backdrop = document.createElement('div');
  backdrop.className = 'report-backdrop';
  document.body.appendChild(backdrop);

  const modal = document.createElement('div');
  modal.className = 'report-modal';

  // Helpers
  const row = (label, value, cls) =>
    `<div class="report-row"><span class="label">${label}</span><span class="value ${cls || ''}">${value}</span></div>`;
  const chk = (flag, label, ok, fail) => flag
    ? row(label, '\u2713 ' + ok, 'ok')
    : row(label, '\u2717 ' + fail, 'fail');

  // Score breakdown HTML
  let scoreBreakdownHTML = '';
  for (const e of scoreLog) {
    const sign = e.points >= 0 ? '+' : '';
    const cls = e.points >= 0 ? 'ok' : 'fail';
    scoreBreakdownHTML += row(e.reason, sign + e.points, cls);
  }

  // Commands executed HTML
  let commandsHTML = '';
  for (const a of gameState.actionsLog) {
    commandsHTML += `<div class="report-cmd">[${a.timestamp}]  ${a.details || a.action}</div>`;
  }

  // Learning notes HTML
  let learningHTML = '';
  if (!gameState.foundMaliciousProcess) learningHTML += `<div class="report-tip">\u2192 Use 'pstree' to identify processes starting abnormally late.</div>`;
  if (!gameState.foundC2Connection) learningHTML += `<div class="report-tip">\u2192 Use 'netscan' to find connections to unknown external IPs.</div>`;
  if (!gameState.extractedKey) learningHTML += `<div class="report-tip">\u2192 Always run 'memdump --pid &lt;PID&gt;' BEFORE killing a process.</div>`;
  if (gameState.innocentKills > 0) learningHTML += `<div class="report-tip">\u2192 Verify a process is malicious before terminating it.</div>`;
  if (!learningHTML) learningHTML = `<div class="report-tip" style="color:var(--accent-green)">\u2713 Excellent investigation \u2014 no critical mistakes!</div>`;

  modal.innerHTML = `
    <h2>V.O.I.D. \u2014 FORENSIC INVESTIGATION REPORT</h2>
    <div class="report-outcome ${isWin ? 'win' : 'loss'}">
      ${isWin ? '\u2605 MISSION SUCCESSFUL \u2014 Ransomware Neutralized' : '\u2717 MISSION FAILED'}
    </div>
    <div class="report-rank">${rank.title} ${rank.stars}</div>

    <div class="report-grid">
      <div class="report-col">
        <div class="report-section">
          <div class="report-section-title">Timeline</div>
          ${row('Analyst', gameState.playerName)}
          ${row('Target', gameState.scenarioMeta?.target || '\u2014')}
          ${row('Target OS', gameState.scenarioMeta?.os || '\u2014')}
          ${row('Time Elapsed', fmtTime(elapsed) + ' / ' + Math.floor(gameState.totalTime / 60) + ':00')}
          ${row('Encryption at End', gameState.encryptionProgress + '%')}
          ${row('Files Encrypted', gameState.encryptedFiles.length + ' / ' + gameState.fileTargets.length)}
        </div>

        <div class="report-section">
          <div class="report-section-title">Investigation Results</div>
          ${chk(gameState.foundMaliciousProcess, 'Malware Identified', malName + ' (PID ' + malPID + ')', 'Not identified')}
          ${chk(gameState.foundC2Connection, 'C2 Server Found', 'External C2 connections detected', 'Not found')}
          ${chk(gameState.foundInjectedCode, 'Injected Code', 'RWX memory detected via malfind', 'Not detected')}
          ${chk(gameState.extractedKey, 'AES Key Recovered', gameState.aesKey, 'Key lost \u2014 files unrecoverable')}
          ${chk(gameState.killedMalicious, 'Ransomware Killed', 'Process terminated', 'Still running')}
        </div>

        <div class="report-section">
          <div class="report-section-title">Penalties</div>
          ${row('Innocent Kills', gameState.innocentKills + ' (\u2212' + (gameState.innocentKills * 50) + ' pts)', gameState.innocentKills > 0 ? 'fail' : '')}
          ${row('Hints Used', String(gameState.hintsUsed))}
        </div>
      </div>

      <div class="report-col">
        <div class="report-section">
          <div class="report-section-title">Score Breakdown</div>
          ${scoreBreakdownHTML}
          <div class="report-row" style="border-top:1px solid #2a3a4a;padding-top:6px;margin-top:6px">
            <span class="label" style="font-weight:700">TOTAL SCORE</span>
            <span class="value" style="font-weight:700;font-size:15px">${gameState.score} / 1000</span>
          </div>
        </div>

        <div class="report-section">
          <div class="report-section-title">Commands Executed (${gameState.commandCount})</div>
          <div class="report-cmds-list">${commandsHTML || '<div class="report-cmd">No commands executed.</div>'}</div>
        </div>

        <div class="report-section">
          <div class="report-section-title">Learning Notes</div>
          ${learningHTML}
        </div>
      </div>
    </div>

    <button class="report-continue">\u25b6 CONTINUE TO RESULTS</button>
  `;
  document.body.appendChild(modal);

  modal.querySelector('.report-continue').addEventListener('click', () => {
    backdrop.remove();
    modal.remove();
    showResultsPage();
  });
}

function showResultsPage() {
  // Remove any lingering lesson toasts
  document.querySelectorAll('.lesson-toast, .toast-backdrop').forEach(el => el.remove());

  const elapsed = gameState.totalTime - gameState.timeRemaining;

  // Save to session leaderboard
  const entry = {
    name: gameState.playerName,
    os: gameState.scenarioMeta?.osType === 'windows' ? 'Windows' : 'Linux',
    score: gameState.score,
    outcome: gameState.gamePhase === 'won' ? 'WIN' : 'LOSS',
    time: fmtTime(elapsed),
    ts: Date.now(),
  };
  sessionLeaderboard.push(entry);
  sessionLeaderboard.sort((a, b) => b.score - a.score);

  // Switch views
  document.getElementById('game-view').classList.add('hidden');
  document.getElementById('results-page').classList.remove('hidden');

  // Populate stats
  const rank = getRank(gameState.score);
  document.getElementById('results-score').textContent = gameState.score;
  document.getElementById('results-rank').textContent = rank.label;
  document.getElementById('results-time').textContent = fmtTime(elapsed);
  document.getElementById('results-commands').textContent = gameState.commandCount;
  document.getElementById('results-encryption').textContent = `${gameState.encryptionProgress}%`;
  document.getElementById('results-lessons').textContent = getLessonCount();

  // Outcome
  const oel = document.getElementById('results-outcome');
  if (gameState.gamePhase === 'won') {
    oel.textContent = '★ MISSION SUCCESSFUL — Ransomware Neutralized';
    oel.className = 'results-outcome win';
  } else {
    oel.textContent = '✗ MISSION FAILED';
    oel.className = 'results-outcome loss';
  }

  // Leaderboard
  const tbody = document.getElementById('leaderboard-body');
  tbody.innerHTML = '';
  sessionLeaderboard.forEach((e, i) => {
    const tr = document.createElement('tr');
    if (e.ts === entry.ts) tr.className = 'current';
    tr.innerHTML = `<td class="rank-col">${i + 1}</td><td>${e.name}</td><td>${e.os}</td><td>${e.outcome}</td><td class="score-col">${e.score}</td>`;
    tbody.appendChild(tr);
  });

  // Wire buttons (clone to avoid duplicate listeners)
  const rb = document.getElementById('btn-replay');
  const mb = document.getElementById('btn-back-menu');
  const nrb = rb.cloneNode(true);
  rb.parentNode.replaceChild(nrb, rb);
  const nmb = mb.cloneNode(true);
  mb.parentNode.replaceChild(nmb, mb);
  nrb.addEventListener('click', () => launchGame());
  nmb.addEventListener('click', () => returnToMenu());
}

function updateHUD() {
  const te = document.getElementById('hud-timer');
  const ee = document.getElementById('hud-encryption');
  const eb = document.getElementById('hud-encryption-bar');
  const se = document.getElementById('hud-score');
  if (te) {
    te.textContent = fmtTime(gameState.timeRemaining);
    te.classList.remove('critical', 'warning');
    if (gameState.timeRemaining <= 60) te.classList.add('critical');
    else if (gameState.timeRemaining <= 120) te.classList.add('warning');
  }
  if (ee) ee.textContent = `${gameState.encryptionProgress}%`;
  if (eb) {
    eb.style.width = `${gameState.encryptionProgress}%`;
    eb.classList.remove('critical', 'danger');
    if (gameState.encryptionProgress > 75) eb.classList.add('critical');
    else if (gameState.encryptionProgress > 50) eb.classList.add('danger');
  }
  if (se) se.textContent = gameState.score;
}

function fmtTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
