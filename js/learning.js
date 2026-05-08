// js/learning.js — Educational Lesson System for V.O.I.D.

const lessons = [];
const shownLessons = new Set();

const LESSON_DB = {
  pstree_anomaly: {
    title: "Process Tree Anomaly Detection",
    text: "Legitimate system services follow predictable parent-child hierarchies. A service spawning hours after boot is a critical red flag indicating possible injection or unauthorized process creation.",
    source: "pstree command",
  },
  c2_connection: {
    title: "Command & Control (C2) Detection",
    text: "Network connections from system services to external IP addresses are highly suspicious. Identifying C2 channels is essential to understanding the attacker's infrastructure.",
    source: "netscan command",
  },
  rwx_memory: {
    title: "Injected Code Detection (RWX Memory)",
    text: "RWX memory regions are a strong indicator of code injection. Normal programs map code as read-execute and data as read-write. Finding RWX regions suggests shellcode or injected libraries.",
    source: "malfind command",
  },
  yara_malware: {
    title: "YARA Signature Matching",
    text: "YARA rules define patterns to identify malware families. Matching signatures confirms the nature of the threat. Analysts write custom YARA rules based on known IOCs from threat intelligence feeds.",
    source: "yarascan command",
  },
  aes_key_extracted: {
    title: "Order of Volatility — Evidence Extraction",
    text: "RAM is the most volatile storage medium. The AES key exists ONLY in the ransomware's memory. Always capture volatile evidence before taking any remediation action.",
    source: "memdump command",
  },
  killed_before_dump: {
    title: "Critical Error — Evidence Destroyed",
    text: "You terminated the process BEFORE extracting the key. In real incident response, encrypted files are permanently unrecoverable. Always extract, then remediate.",
    source: "kill command (without prior memdump)",
  },
  innocent_killed: {
    title: "Collateral Damage — False Positive",
    text: "Killing a legitimate process disrupts stability and could destroy evidence. Always verify using multiple forensic indicators before termination.",
    source: "kill command (legitimate process)",
  },
  ld_preload_detected: {
    title: "Library Injection Detected",
    text: "LD_PRELOAD (Linux) and DLL injection (Windows) force malicious libraries into legitimate processes. Suspicious library paths are a strong indicator of code injection.",
    source: "envars / dlllist command",
  },
  suspicious_handles: {
    title: "Handle Analysis — Access Patterns",
    text: "Process handles reveal active resource usage. Suspicious mutexes, write handles to user data, or credential store access are strong indicators of malicious intent.",
    source: "handles command",
  },
};

export function triggerLesson(lessonId) {
  if (shownLessons.has(lessonId)) return;
  const lesson = LESSON_DB[lessonId];
  if (!lesson) return;
  shownLessons.add(lessonId);
  lessons.push({ id: lessonId, ...lesson });
  showToast(lesson);
  addToPanelUI(lesson, lessons.length);
  updateToggleBadge();
}

function showToast(lesson) {
  const existing = document.querySelector('.lesson-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'lesson-toast';
  toast.innerHTML = `
    <div class="toast-header">
      <span class="toast-label">📘 Forensic Insight</span>
      <button class="toast-close" title="Close">✕</button>
    </div>
    <div class="toast-title">${lesson.title}</div>
    <div class="toast-text">${lesson.text}</div>
  `;
  document.body.appendChild(toast);
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  });
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add('hiding');
      setTimeout(() => toast.remove(), 300);
    }
  }, 12000);
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
