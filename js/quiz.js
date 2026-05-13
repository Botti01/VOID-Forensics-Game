// js/quiz.js — Post-Investigation Quiz System for V.O.I.D.
// Measures learning outcome after the investigation.

import gameState from './gameState.js';

// ── Question Bank ──────────────────────────────────────────────────────────────

const POST_QUIZ_QUESTIONS = [
  {
    id: 'post_1',
    question: 'During this investigation, why was it critical to extract the AES key BEFORE killing the ransomware process?',
    options: [
      { key: 'A', text: 'Because killing the process would crash the entire server' },
      { key: 'B', text: 'Because the encryption key only existed in the process\'s volatile memory — once killed, it would be lost forever' },
      { key: 'C', text: 'Because the process needed to be running for the antivirus to detect it' },
      { key: 'D', text: 'Because the key was stored in a file that gets deleted on process termination' },
    ],
    correct: 'B',
    explanation: 'The AES key was held exclusively in the ransomware\'s RAM. This is a textbook application of the Order of Volatility — volatile evidence (RAM) must be captured before any remediation action that would destroy it.',
  },
  {
    id: 'post_2',
    question: 'Which forensic technique reveals injected code hiding inside a legitimate process?',
    options: [
      { key: 'A', text: 'netscan — scanning for network connections' },
      { key: 'B', text: 'pstree — viewing the process tree hierarchy' },
      { key: 'C', text: 'malfind — detecting anomalous memory regions (RWX) that suggest code injection' },
      { key: 'D', text: 'handles — listing open file handles' },
    ],
    correct: 'C',
    explanation: 'The malfind plugin scans process memory for regions with suspicious permissions (RWX), which indicate injected shellcode, DLL injection, or process hollowing — techniques used by attackers to hide malicious code inside trusted processes.',
  },
  {
    id: 'post_3',
    question: 'How can you identify a disguised malicious process using parent-child relationships?',
    options: [
      { key: 'A', text: 'By checking if the process has a high PID number' },
      { key: 'B', text: 'By verifying that system daemons were started at boot time and have the expected parent process (e.g., systemd or services.exe)' },
      { key: 'C', text: 'By looking at the process name — malware always uses random characters' },
      { key: 'D', text: 'By measuring the process CPU usage over time' },
    ],
    correct: 'B',
    explanation: 'System services like rsyslogd (Linux) or svchost.exe (Windows) should be children of systemd/services.exe and start at boot. A daemon spawning hours after boot with an unusual parent is a critical anomaly indicating it was likely created by an attacker.',
  },
];

// ── Quiz UI Renderer ───────────────────────────────────────────────────────────

/**
 * Show a quiz modal and return a Promise that resolves with the score (0-3).
 * @returns {Promise<number>} — score (number of correct answers)
 */
export function showQuiz() {
  const questions = POST_QUIZ_QUESTIONS;
  const title = 'POST-INVESTIGATION VERIFICATION';
  const subtitle = 'Confirm what you learned during the investigation.';

  return new Promise((resolve) => {
    // Clean up any previous quiz
    document.querySelectorAll('.quiz-backdrop, .quiz-modal').forEach(el => el.remove());

    const backdrop = document.createElement('div');
    backdrop.className = 'quiz-backdrop';
    document.body.appendChild(backdrop);

    const modal = document.createElement('div');
    modal.className = 'quiz-modal';

    // State
    let currentQ = 0;
    let score = 0;
    const answers = new Array(questions.length).fill(null);

    function render() {
      const q = questions[currentQ];
      const isLast = currentQ === questions.length - 1;
      const hasAnswered = answers[currentQ] !== null;

      modal.innerHTML = `
        <div class="quiz-header">
          <div class="quiz-label">${title}</div>
          <div class="quiz-subtitle">${subtitle}</div>
          <div class="quiz-progress">
            ${questions.map((_, i) => `
              <div class="quiz-dot ${i < currentQ ? 'done' : ''} ${i === currentQ ? 'active' : ''} ${answers[i] !== null && i === currentQ ? (answers[i] === questions[i].correct ? 'correct' : 'wrong') : ''}"></div>
            `).join('')}
          </div>
        </div>

        <div class="quiz-question-number">Question ${currentQ + 1} of ${questions.length}</div>
        <div class="quiz-question">${q.question}</div>

        <div class="quiz-options">
          ${q.options.map(opt => {
            let cls = 'quiz-option';
            if (hasAnswered) {
              if (opt.key === q.correct) cls += ' correct';
              else if (opt.key === answers[currentQ] && opt.key !== q.correct) cls += ' wrong';
              else cls += ' disabled';
            }
            return `<button class="${cls}" data-key="${opt.key}" ${hasAnswered ? 'disabled' : ''}>
              <span class="quiz-option-key">${opt.key}</span>
              <span class="quiz-option-text">${opt.text}</span>
            </button>`;
          }).join('')}
        </div>

        ${hasAnswered ? `
          <div class="quiz-explanation ${answers[currentQ] === q.correct ? 'correct' : 'wrong'}">
            <div class="quiz-explanation-header">${answers[currentQ] === q.correct ? '✓ Correct!' : '✗ Incorrect'}</div>
            <div class="quiz-explanation-text">${q.explanation}</div>
          </div>
          <button class="quiz-next-btn">${isLast ? '▶ VIEW REPORT' : '▶ NEXT QUESTION'}</button>
        ` : ''}
      `;

      // Bind option clicks (only if not answered)
      if (!hasAnswered) {
        modal.querySelectorAll('.quiz-option').forEach(btn => {
          btn.addEventListener('click', () => {
            const key = btn.dataset.key;
            answers[currentQ] = key;
            if (key === q.correct) score++;
            render();
          });
        });
      }

      // Bind next/finish button
      const nextBtn = modal.querySelector('.quiz-next-btn');
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          if (isLast) {
            // Save score and close
            gameState.postQuizScore = score;
            backdrop.remove();
            modal.remove();
            resolve(score);
          } else {
            currentQ++;
            render();
          }
        });
      }
    }

    document.body.appendChild(modal);
    render();
  });
}
