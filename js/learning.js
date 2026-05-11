// js/learning.js — Educational Lesson System for V.O.I.D.
// OS-specific lessons, centered toast with backdrop.

import gameState from './gameState.js';

const lessons = [];
const shownLessons = new Set();

const LESSON_DB = {
  pstree_anomaly: {
    title: "Process Tree Anomaly Detection",
    linux: "On Linux, daemons are children of systemd (PID 1) and start at boot. A daemon spawning hours after boot is a critical red flag — it was likely created by an attacker. Use pstree to compare start times and trace parent-child relationships.",
    windows: "On Windows, svchost.exe must be a child of services.exe and should start at boot. A new instance spawning hours later indicates Process Hollowing — the attacker replaced its memory with malicious code.",
    source: "pstree command",
  },
  c2_connection: {
    title: "Command & Control (C2) Detection",
    linux: "System daemons like rsyslogd should not establish outbound connections to external IPs. An ESTABLISHED TCP connection to an unknown server strongly indicates C2 communication or a reverse shell.",
    windows: "Legitimate svchost.exe instances rarely connect to external IP addresses. Outbound connections to unknown servers on unusual ports indicate C2 implants phoning home to the attacker.",
    source: "netscan command",
  },
  rwx_memory: {
    title: "Injected Code Detection (RWX Memory)",
    linux: "On Linux, 'rwxp' anonymous memory mappings indicate code injection. Normal ELF binaries map code as r-xp and data as rw-p. Finding rwxp anonymous regions suggests injected shared libraries or shellcode.",
    windows: "PAGE_EXECUTE_READWRITE (RWX) memory regions are a hallmark of code injection on Windows. Normal PE executables use PAGE_EXECUTE_READ for code. Finding RWX indicates injected DLLs or shellcode.",
    source: "malfind command",
  },
  yara_malware: {
    title: "YARA Signature Matching",
    linux: "YARA rules matched malware signatures in this process. Rules like 'Linux_ELF_Injection' detect injected ELF shared objects. Analysts write custom YARA rules based on threat intelligence IOCs.",
    windows: "YARA rules matched malware signatures. Rules like 'CobaltStrike_Beacon' or 'Process_Hollowing' confirm the attack technique. Analysts maintain YARA rule sets from threat intelligence feeds.",
    source: "yarascan command",
  },
  aes_key_extracted: {
    title: "Order of Volatility — Evidence Extraction",
    text: "RAM is the most volatile storage medium — its contents are lost when a process terminates. The AES key exists ONLY in the ransomware's memory. Always capture volatile evidence (RAM, processes, connections) before any remediation.",
    source: "memdump command",
  },
  killed_before_dump: {
    title: "Critical Error — Evidence Destroyed",
    text: "You terminated the process BEFORE extracting the encryption key. In real incident response, encrypted files are permanently unrecoverable. Always: Identify → Extract → Remediate.",
    source: "kill command (without prior memdump)",
  },
  innocent_killed: {
    title: "Collateral Damage — False Positive",
    text: "Killing a legitimate process disrupts stability and could destroy evidence. Always verify using multiple forensic indicators (pstree, netscan, malfind, dlllist) before termination.",
    source: "kill command (legitimate process)",
  },
  ld_preload_detected: {
    title: "Library Injection Detected",
    linux: "LD_PRELOAD forces a shared library to load before all others. Attackers abuse this to inject code into legitimate services. Unusual paths in LD_PRELOAD (e.g., /tmp/.libs/) indicate shared library injection.",
    windows: "The Windows equivalent involves DLL injection through AppInit_DLLs, DLL search order hijacking, or CreateRemoteThread. The concept is the same: forcing malicious code into a legitimate process.",
    source: "envars / dlllist command",
  },
  suspicious_handles: {
    title: "Handle Analysis — Access Patterns",
    linux: "File descriptors reveal active resource usage. A daemon holding write handles to user data, socket connections to external IPs, or lock files in /tmp are strong indicators of malicious intent.",
    windows: "A system service holding a mutex named 'RansomVoid', write handles to user data, or a handle to lsass.exe (credential harvesting) are definitive indicators of malicious behavior.",
    source: "handles command",
  },
};

function getLessonText(lesson) {
  const osType = gameState.scenarioMeta?.osType || 'linux';
  return lesson[osType] || lesson.text || lesson.linux || '';
}

export function triggerLesson(lessonId) {
  if (shownLessons.has(lessonId)) return;
  const def = LESSON_DB[lessonId];
  if (!def) return;
  shownLessons.add(lessonId);
  const text = getLessonText(def);
  const lesson = { id: lessonId, title: def.title, text, source: def.source };
  lessons.push(lesson);
  showToast(lesson);
  addToPanelUI(lesson, lessons.length);
  updateToggleBadge();
}

function showToast(lesson) {
  document.querySelectorAll('.lesson-toast, .toast-backdrop').forEach(el => el.remove());
  const backdrop = document.createElement('div');
  backdrop.className = 'toast-backdrop';
  document.body.appendChild(backdrop);
  const toast = document.createElement('div');
  toast.className = 'lesson-toast';
  toast.innerHTML = `
    <div class="toast-header">
      <span class="toast-label">📘 Forensic Insight</span>
      <button class="toast-close" title="Close (Enter)">✕</button>
    </div>
    <div class="toast-title">${lesson.title}</div>
    <div class="toast-text">${lesson.text}</div>
    <div class="toast-hint">Press Enter or click ✕ to close</div>
  `;
  document.body.appendChild(toast);

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    document.removeEventListener('keyup', onKey);
    toast.classList.add('hiding');
    backdrop.style.opacity = '0';
    backdrop.style.transition = 'opacity 0.3s';
    setTimeout(() => {
      toast.remove(); backdrop.remove();
      const input = document.getElementById('terminal-input');
      if (input) input.focus();
    }, 300);
  };
  const onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); dismiss(); } };
  // Delay listener to avoid the same Enter that triggered the command
  setTimeout(() => { if (!dismissed) document.addEventListener('keyup', onKey); }, 250);
  toast.querySelector('.toast-close').addEventListener('click', dismiss);
  backdrop.addEventListener('click', dismiss);
  setTimeout(() => { if (toast.parentNode && !dismissed) dismiss(); }, 15000);
}

function addToPanelUI(lesson, index) {
  const content = document.getElementById('learning-content');
  if (!content) return;
  const empty = content.querySelector('.panel-empty');
  if (empty) empty.remove();
  const card = document.createElement('div');
  card.className = 'lesson-card';
  card.innerHTML = `
    <div class="lesson-title">#${index} — ${lesson.title}</div>
    <div class="lesson-text">${lesson.text}</div>
    <div class="lesson-source">Discovered via: ${lesson.source}</div>
  `;
  content.appendChild(card);
  content.scrollTop = content.scrollHeight;
}

function updateToggleBadge() {
  const badge = document.getElementById('learning-badge');
  if (badge) badge.textContent = lessons.length;
}

export function getLessonCount() { return lessons.length; }
export function getAllLessons() { return [...lessons]; }
// Only reset per-game counter; shownLessons persists so pop-ups don't repeat on replay
export function resetLessons() { lessons.length = 0; }
