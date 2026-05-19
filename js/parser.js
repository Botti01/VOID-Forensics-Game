// js/parser.js — Command Parser for V.O.I.D.
// Tokenizes raw CLI input and dispatches to command handlers.

import { executeCommand } from './commands.js';
import { printInfo, printWarning } from './terminal.js';
import gameState from './gameState.js';

/**
 * Parse and execute a raw command string.
 * @param {string} raw - The raw user input string
 */
export function parseCommand(raw) {
  if (gameState.awaitingExitConfirm) {
    const answer = raw.trim().toLowerCase();
    gameState.awaitingExitConfirm = false;

    if (answer === 'y' || answer === 'yes') {
      printWarning('Abort confirmed. Returning to menu.');
      document.dispatchEvent(new CustomEvent('void:exit'));
      return;
    }

    printInfo('Exit canceled. Investigation continues.');
    return;
  }

  if (gameState.gamePhase !== 'playing') {
    // Allow 'report' during won/lost
    if (gameState.gamePhase === 'won' || gameState.gamePhase === 'lost') {
      if (raw.trim().toLowerCase() === 'report') {
        executeCommand('report', [], {});
        return;
      }
    }
    return;
  }

  const tokens = tokenize(raw);
  if (tokens.length === 0) return;

  const command = tokens[0].toLowerCase();
  const args = [];
  const flags = {};

  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.startsWith('--')) {
      const key = t.slice(2);
      // Check if next token is a value (not another flag)
      if (i + 1 < tokens.length && !tokens[i + 1].startsWith('--')) {
        flags[key] = tokens[i + 1];
        i++;
      } else {
        flags[key] = true;
      }
    } else if (t.startsWith('-') && t.length === 2) {
      const key = t.slice(1);
      if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) {
        flags[key] = tokens[i + 1];
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      args.push(t);
    }
  }

  gameState.commandCount++;
  executeCommand(command, args, flags);
}

/**
 * Tokenize a raw input string, respecting quoted strings.
 */
function tokenize(raw) {
  const tokens = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (const ch of raw) {
    if (inQuote) {
      if (ch === quoteChar) {
        inQuote = false;
        tokens.push(current);
        current = '';
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
    } else if (ch === ' ' || ch === '\t') {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }

  if (current) tokens.push(current);
  return tokens;
}

export default parseCommand;
