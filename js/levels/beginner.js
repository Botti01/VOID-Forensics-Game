// js/levels/beginner.js — Beginner difficulty tier configuration for V.O.I.D.
//
// Malware uses an obviously suspicious name so the analyst can identify it
// quickly. Encryption is slow.

const BEGINNER_TIER = {
  // ── Identity ──────────────────────────────────────────────────────────────
  tier: 'beginner',

  // ── Timer ─────────────────────────────────────────────────────────────────
  timerMinutes: 10,               // 600 seconds total investigation time

  // ── Encryption engine ─────────────────────────────────────────────────────
  encryptionTickSeconds: 20,      // one tick every 20 s (slowest pressure)
  encryptionTickPercent: 2,       // +2 % per tick → ~17 min to 100 %

  // ── Feature flags ─────────────────────────────────────────────────────────
  masquerade: false,              // malware name is NOT a system-process alias
  memdumpDelayMs: 0,              // memdump completes instantly

  // ── Malicious process appearance ──────────────────────────────────────────
  // The malicious PID is renamed to a non-system name so it stands out in
  // pslist / pstree output even without deep analysis.
  maliciousProcessOverride: {
    linux: {
      name:    'shadowcryptd',
      path:    '/usr/bin/shadowcryptd',
      service: 'ransomware',
    },
    windows: {
      name:    'ransomvoid.exe',
      path:    'C:\\Windows\\System32\\ransomvoid.exe',
      service: 'ransomware',
    },
  },

  // ── Decoy processes ───────────────────────────────────────────────────────
  // No decoys at beginner — no risk of provoking accidental innocent kills.
  decoyProcesses: {
    linux:   [],
    windows: [],
  },
};

export default BEGINNER_TIER;