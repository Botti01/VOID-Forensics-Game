// js/levels/intermediate.js — Intermediate difficulty tier configuration for V.O.I.D.
//
// Masquerade mode is active: the malware adopts a name that is visually
// similar to a legitimate system process (one character substituted with a
// digit). The analyst must inspect start times, parent PIDs, and memory
// regions rather than relying on the process name alone.

const INTERMEDIATE_TIER = {
  // ── Identity ──────────────────────────────────────────────────────────────
  tier: 'intermediate',

  // ── Timer ─────────────────────────────────────────────────────────────────
  timerMinutes: 10,               // 600 seconds total investigation time

  // ── Encryption engine ─────────────────────────────────────────────────────
  encryptionTickSeconds: 15,      // one tick every 15 s (standard pressure)
  encryptionTickPercent: 2,       // +2 % per tick → ~12.5 min to 100 %

  // ── Feature flags ─────────────────────────────────────────────────────────
  masquerade: true,               // malware mimics a real system process name
  memdumpDelayMs: 0,              // memdump completes instantly

  // ── Malicious process appearance ──────────────────────────────────────────
  // Linux:   rsys1ogd  — the lowercase letter 'l' is replaced with the digit '1'
  // Windows: svch0st.exe — the letter 'o' is replaced with the digit '0'
  // Both names are visually close to a legitimate daemon at a glance.
  maliciousProcessOverride: {
    linux: {
      name:    'rsys1ogd',             // '1' not 'l' — look carefully
      path:    '/usr/sbin/rsys1ogd',
      service: 'logging',
    },
    windows: {
      name:    'svch0st.exe',          // '0' not 'o' — look carefully
      path:    'C:\\Windows\\System32\\svch0st.exe',
      service: 'LocalService',
    },
  },

  // ── Decoy processes ───────────────────────────────────────────────────────
  // No additional decoys at intermediate — masquerading is the primary
  // challenge; adding decoys would overlap with the expert tier's objective.
  decoyProcesses: {
    linux:   [],
    windows: [],
  },
};

export default INTERMEDIATE_TIER;