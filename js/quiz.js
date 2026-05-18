// js/quiz.js - Post-Investigation Quiz System for V.O.I.D.
// Measures learning outcome after the investigation.
// Questions are drawn randomly from a pool to prevent metagaming.

import gameState from './gameState.js';

// ── Beginner Question Pool (10 questions) ─────────────────────────────────────
// Each question targets a core Memory Forensics concept covered in the
// Beginner scenario. correctIndex is 0-based (matches the options array).

export const BEGINNER_QUIZ_POOL = [
  {
    id: 'b_1',
    tier: 'beginner',
    question: 'Why is it critical to extract the AES key BEFORE killing the ransomware process?',
    options: [
      'Stopping the process can trigger a crash loop that wipes the file cache.',
      'The key only lives in volatile memory and disappears when the process stops.',
      'The process must keep running so endpoint tools can quarantine the sample.',
      'The key is stored in a temp file that is deleted only after reboot.',
    ],
    correctIndex: 1,
    explanation: 'The AES key is held exclusively in the ransomware\'s RAM. This is a textbook application of the Order of Volatility: volatile evidence must be captured before any remediation action that would destroy it.',
  },
  {
    id: 'b_2',
    tier: 'beginner',
    question: 'Which Volatility plugin reveals injected code hiding inside a legitimate process?',
    options: [
      'netscan, enumerates active sockets and TCP endpoints for network triage.',
      'pstree, shows the parent to child process tree and launch lineage.',
      'malfind, flags private RWX regions that suggest injected code.',
      'handles, lists open file, registry, and mutex handles per process.',
    ],
    correctIndex: 2,
    explanation: 'malfind scans process memory for regions with suspicious permissions (rwxp). These Read-Write-Execute anonymous mappings are a strong indicator of injected shellcode, DLL injection, or process hollowing.',
  },
  {
    id: 'b_3',
    tier: 'beginner',
    question: 'What does a suspicious "PPID" (Parent PID) reveal in a forensic investigation?',
    options: [
      'It reports CPU usage spikes that hint at crypto mining activity.',
      'It identifies which process spawned the suspect and maps the chain.',
      'It counts the number of threads the process has created.',
      'It shows the effective user account and privilege level.',
    ],
    correctIndex: 1,
    explanation: 'System daemons (e.g., rsyslogd, svchost.exe) should always be children of a known init process (systemd or services.exe). A daemon with an unexpected parent, such as a web server worker, is a critical anomaly.',
  },
  {
    id: 'b_4',
    tier: 'beginner',
    question: 'What is "Order of Volatility" in digital forensics?',
    options: [
      'A severity ranking that scores malware families by damage potential.',
      'A packet ordering scheme used by routers to prioritize traffic.',
      'A principle that volatile evidence like RAM must be captured first.',
      'A rule that mandates immediate shutdown to preserve disk integrity.',
    ],
    correctIndex: 2,
    explanation: 'Order of Volatility (RFC 3227) dictates collection order: RAM → swap → running processes → network state → disk. Evidence in RAM is destroyed on power-off, making it the top priority in live forensics.',
  },
  {
    id: 'b_5',
    tier: 'beginner',
    question: 'What does the memory protection flag "rwxp" indicate about a memory region?',
    options: [
      'Readable and executable only, typically a signed code segment.',
      'Readable, writable, executable, and private, common in injection.',
      'Shared memory mapped from a file and locked by the kernel.',
      'Kernel space memory allocated for a device driver.',
    ],
    correctIndex: 1,
    explanation: '"rwxp" means the memory region is Readable, Writable, and Executable, and Private (not shared). Legitimate code segments are typically only readable and executable (r-xp). An anonymous rwxp mapping is a textbook sign of dynamically injected code.',
  },
  {
    id: 'b_6',
    tier: 'beginner',
    question: 'Which technique does LD_PRELOAD injection use to compromise a process?',
    options: [
      'It replaces the kernel scheduler to hijack CPU time slices.',
      'It loads a malicious shared library first to hook functions.',
      'It overwrites the on disk executable with a trojaned copy.',
      'It forces the process to download a library over the network.',
    ],
    correctIndex: 1,
    explanation: 'LD_PRELOAD is a Linux environment variable that forces shared libraries to be loaded before all others. Attackers abuse it to hook system calls, for example, intercepting read/write operations to encrypt files transparently.',
  },
  {
    id: 'b_7',
    tier: 'beginner',
    question: 'In a live forensics investigation, why should you NOT shut down the compromised server immediately?',
    options: [
      'A shutdown alerts the attacker who may erase logs remotely.',
      'The malware always reinstalls from a hidden partition on reboot.',
      'Volatile evidence like keys and process state in RAM would vanish.',
      'System logs exist only in memory and are deleted by power loss.',
    ],
    correctIndex: 2,
    explanation: 'RAM is volatile: any data held there, such as encryption keys, decrypted payloads, and active network state, is permanently destroyed on shutdown. Live forensics preserves this evidence before any remediation.',
  },
  {
    id: 'b_8',
    tier: 'beginner',
    question: 'What is the primary goal of the "memdump" command in a ransomware investigation?',
    options: [
      'To terminate the ransomware and stop encryption immediately.',
      'To capture a full snapshot of a process memory space for analysis.',
      'To list every file that has been encrypted on the disk.',
      'To scan memory for known malware signatures in real time.',
    ],
    correctIndex: 1,
    explanation: 'memdump creates a binary image of a process\'s entire virtual address space. In a ransomware scenario, the AES key used for encryption is held in memory and must be extracted this way before the process is terminated.',
  },
  {
    id: 'b_9',
    tier: 'beginner',
    question: 'A web server process (apache2) has spawned a bash shell at 13:45, hours after boot. What does this most likely indicate?',
    options: [
      'A scheduled maintenance job run by the administrator.',
      'A normal Apache behavior during high traffic spikes.',
      'A webshell exploit that spawned a reverse shell from the server.',
      'A kernel crash handler launched after a fault recovery.',
    ],
    correctIndex: 2,
    explanation: 'Web servers should never spawn interactive shells. A bash child of apache2 hours after boot strongly suggests a webshell was uploaded and executed by an attacker, providing them with remote command execution.',
  },
  {
    id: 'b_10',
    tier: 'beginner',
    question: 'What is "process masquerading" in the context of malware evasion?',
    options: [
      'Malware encrypts its own memory to evade scanners.',
      'Malware adopts the name and path of a legitimate process.',
      'Malware migrates to another CPU core to avoid profiling.',
      'Malware registers as a kernel driver to gain privileges.',
    ],
    correctIndex: 1,
    explanation: 'Process masquerading (also called process impersonation) involves naming a malicious process identically to a legitimate system daemon (e.g., svchost.exe or rsyslogd). The analyst must rely on start time, PPID, and memory analysis, not the name alone, to identify it.',
  },
];

// ── Question Sampler ──────────────────────────────────────────────────────────

/**
 * Return `count` random questions from the pool filtered by tier.
 * Uses a Fisher-Yates shuffle so questions differ each session.
 *
 * @param {string} tier  - Difficulty tier ('beginner' | 'intermediate' | 'expert')
 * @param {number} count - Number of questions to return (default: 3)
 * @returns {object[]}   - Sampled question objects
 */
export function getRandomQuestions(tier = 'beginner', count = 3) {
  // Filter to the requested tier; fall back to the full pool if none match.
  let pool = BEGINNER_QUIZ_POOL.filter(q => q.tier === tier);
  if (pool.length === 0) pool = [...BEGINNER_QUIZ_POOL];

  // Fisher-Yates in-place shuffle on a shallow copy
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// ── Quiz UI Renderer ──────────────────────────────────────────────────────────

/**
 * Show a quiz modal and return a Promise that resolves with the score (0-3).
 * Questions are sampled dynamically from the pool via getRandomQuestions().
 *
 * @returns {Promise<number>} - number of correct answers (0-3)
 */
export function showQuiz() {
  // Draw 3 random questions for the active difficulty tier.
  const questions = getRandomQuestions(gameState.difficulty || 'beginner', 3);
  const total = questions.length;
  const title = 'POST-INVESTIGATION VERIFICATION';
  const subtitle = 'Confirm what you learned during the investigation.';

  return new Promise((resolve) => {
    // Remove any previous quiz overlay
    document.querySelectorAll('.quiz-backdrop, .quiz-modal').forEach(el => el.remove());

    const backdrop = document.createElement('div');
    backdrop.className = 'quiz-backdrop';
    document.body.appendChild(backdrop);

    const modal = document.createElement('div');
    modal.className = 'quiz-modal';

    // Per-session state
    let currentQ = 0;
    let score = 0;
    const answers = new Array(total).fill(null); // null | correctIndex | wrong index

    function render() {
      const q = questions[currentQ];
      const isLast = currentQ === total - 1;
      const selectedIndex = answers[currentQ]; // null or 0-based option index
      const hasAnswered = selectedIndex !== null;
      const isCorrect = hasAnswered && selectedIndex === q.correctIndex;

      modal.innerHTML = `
        <div class="quiz-header">
          <div class="quiz-label">${title}</div>
          <div class="quiz-subtitle">${subtitle}</div>
          <div class="quiz-progress">
            ${questions.map((_, i) => {
              let cls = 'quiz-dot';
              if (i < currentQ)  cls += ' done';
              if (i === currentQ) cls += ' active';
              if (answers[i] !== null && i === currentQ) {
                cls += answers[i] === questions[i].correctIndex ? ' correct' : ' wrong';
              }
              return `<div class="${cls}"></div>`;
            }).join('')}
          </div>
        </div>

        <div class="quiz-question-number">Question ${currentQ + 1} of ${total}</div>
        <div class="quiz-question">${q.question}</div>

        <div class="quiz-options">
          ${q.options.map((text, idx) => {
            const keys = ['A', 'B', 'C', 'D'];
            let cls = 'quiz-option';
            if (hasAnswered) {
              if (idx === q.correctIndex)          cls += ' correct';
              else if (idx === selectedIndex)      cls += ' wrong';
              else                                 cls += ' disabled';
            }
            return `<button class="${cls}" data-idx="${idx}" ${hasAnswered ? 'disabled' : ''}>
              <span class="quiz-option-key">${keys[idx]}</span>
              <span class="quiz-option-text">${text}</span>
            </button>`;
          }).join('')}
        </div>

        ${hasAnswered ? `
          <div class="quiz-explanation ${isCorrect ? 'correct' : 'wrong'}">
            <div class="quiz-explanation-header">${isCorrect ? '✓ Correct!' : '✗ Incorrect'}</div>
            <div class="quiz-explanation-text">${q.explanation}</div>
          </div>
          <button class="quiz-next-btn">${isLast ? '▶ VIEW REPORT' : '▶ NEXT QUESTION'}</button>
        ` : ''}
      `;

      // Bind option clicks (only when the question has not yet been answered)
      if (!hasAnswered) {
        modal.querySelectorAll('.quiz-option').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx, 10);
            answers[currentQ] = idx;
            if (idx === q.correctIndex) score++;
            render();
          });
        });
      }

      // Bind the next / finish button
      const nextBtn = modal.querySelector('.quiz-next-btn');
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          if (isLast) {
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
