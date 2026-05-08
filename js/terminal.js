// js/terminal.js — Terminal UI Renderer for V.O.I.D.
// Handles all visual output, user input, command history, and scrolling.

const terminal = {
  outputEl: null,
  inputEl: null,
  promptEl: null,
  history: [],
  historyIndex: -1,
  isLocked: false,
  onCommand: null, // callback set by main.js
};

/**
 * Initialize the terminal, binding to DOM elements.
 */
export function initTerminal(onCommandCallback) {
  terminal.outputEl = document.getElementById('terminal-output');
  terminal.inputEl = document.getElementById('terminal-input');
  terminal.promptEl = document.getElementById('terminal-prompt');
  terminal.onCommand = onCommandCallback;

  terminal.inputEl.addEventListener('keydown', handleKeyDown);
  terminal.inputEl.focus();

  // Keep focus on input when clicking anywhere on terminal
  document.getElementById('terminal').addEventListener('click', () => {
    if (!terminal.isLocked) terminal.inputEl.focus();
  });
}

/**
 * Handle keyboard input.
 */
function handleKeyDown(e) {
  if (terminal.isLocked) {
    e.preventDefault();
    return;
  }

  if (e.key === 'Enter') {
    e.preventDefault();
    const cmd = terminal.inputEl.value.trim();
    if (cmd) {
      terminal.history.push(cmd);
      terminal.historyIndex = terminal.history.length;
      // Echo the command
      printLine(`void@nexus-srv:~$ ${cmd}`, 'input-echo');
      terminal.inputEl.value = '';
      if (terminal.onCommand) terminal.onCommand(cmd);
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (terminal.historyIndex > 0) {
      terminal.historyIndex--;
      terminal.inputEl.value = terminal.history[terminal.historyIndex];
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (terminal.historyIndex < terminal.history.length - 1) {
      terminal.historyIndex++;
      terminal.inputEl.value = terminal.history[terminal.historyIndex];
    } else {
      terminal.historyIndex = terminal.history.length;
      terminal.inputEl.value = '';
    }
  } else if (e.key === 'l' && e.ctrlKey) {
    e.preventDefault();
    clearTerminal();
  }
}

/**
 * Print a line to the terminal output.
 * @param {string} text - The text to print
 * @param {string} cssClass - Optional CSS class for coloring
 */
export function printLine(text, cssClass = '') {
  const line = document.createElement('div');
  line.className = `terminal-line ${cssClass}`;
  line.textContent = text;
  terminal.outputEl.appendChild(line);
  scrollToBottom();
}

/**
 * Print multiple lines at once.
 */
export function printLines(lines, cssClass = '') {
  for (const line of lines) {
    printLine(line, cssClass);
  }
}

/**
 * Print a line with HTML content (for colored segments).
 */
export function printHTML(html, cssClass = '') {
  const line = document.createElement('div');
  line.className = `terminal-line ${cssClass}`;
  line.innerHTML = html;
  terminal.outputEl.appendChild(line);
  scrollToBottom();
}

/**
 * Print an error message (red).
 */
export function printError(text) {
  printLine(text, 'error');
}

/**
 * Print a success message (green).
 */
export function printSuccess(text) {
  printLine(text, 'success');
}

/**
 * Print a warning message (yellow).
 */
export function printWarning(text) {
  printLine(text, 'warning');
}

/**
 * Print a system alert (red, bold — used by game loop for encryption events).
 */
export function printAlert(text) {
  printLine(text, 'alert');
}

/**
 * Print a header/title (cyan, bold).
 */
export function printHeader(text) {
  printLine(text, 'header');
}

/**
 * Print an info message (dim).
 */
export function printInfo(text) {
  printLine(text, 'info');
}

/**
 * Print a blank line.
 */
export function printBlank() {
  printLine('');
}

/**
 * Print a separator line.
 */
export function printSeparator() {
  printLine('─'.repeat(60), 'dim');
}

/**
 * Clear all terminal output.
 */
export function clearTerminal() {
  terminal.outputEl.innerHTML = '';
}

/**
 * Lock the terminal (prevent input during game over, etc.)
 */
export function lockInput() {
  terminal.isLocked = true;
  terminal.inputEl.disabled = true;
  terminal.inputEl.placeholder = '';
  if (terminal.promptEl) terminal.promptEl.style.opacity = '0.3';
}

/**
 * Unlock the terminal.
 */
export function unlockInput() {
  terminal.isLocked = false;
  terminal.inputEl.disabled = false;
  terminal.inputEl.focus();
  if (terminal.promptEl) terminal.promptEl.style.opacity = '1';
}

/**
 * Scroll terminal output to the bottom.
 */
function scrollToBottom() {
  terminal.outputEl.scrollTop = terminal.outputEl.scrollHeight;
}

/**
 * Print the intro sequence with a typewriter effect.
 */
export async function printIntro(lines, callback) {
  lockInput();
  for (const line of lines) {
    printLine(line, 'intro');
    await sleep(80);
  }
  printBlank();
  unlockInput();
  if (callback) callback();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default terminal;
