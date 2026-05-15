// js/levels/expert.js — Expert difficulty tier configuration for V.O.I.D.
//
// Maximum pressure. Malware uses the EXACT name of a legitimate system
// process, making name-based identification impossible. The analyst must rely
// entirely on start time, parent PID, memory region analysis, and YARA scans.
//
// Decoy processes are injected at the same late start time as the malware to
// provoke innocent kills. memdump simulates realistic extraction latency
// (10 seconds) to penalise impatient analysts who kill before dumping.

const EXPERT_TIER = {
  // ── Identity ──────────────────────────────────────────────────────────────
  tier: 'expert',

  // ── Timer ─────────────────────────────────────────────────────────────────
  timerMinutes: 10,               // 600 seconds total investigation time

  // ── Encryption engine ─────────────────────────────────────────────────────
  encryptionTickSeconds: 12,      // one tick every 12 s (aggressive pressure)
  encryptionTickPercent: 3,       // +3 % per tick → ~6.7 min to 100 %

  // ── Feature flags ─────────────────────────────────────────────────────────
  masquerade: true,               // exact system-process name impersonation
  memdumpDelayMs: 10000,          // 10 s simulated extraction time — kills before
                                  // this window expires lose the AES key
  enableUtilities: true,          // ls / cat visible in help output

  // ── Malicious process appearance ──────────────────────────────────────────
  // The malware retains the same name and path as the legitimate daemon it
  // injected itself into. No character substitution — it IS the real name.
  // Only start time, parent PID, and memory analysis betray it.
  maliciousProcessOverride: {
    linux: {
      name:    'rsyslogd',             // identical to the legitimate daemon
      path:    '/usr/sbin/rsyslogd',
      service: 'logging',
    },
    windows: {
      name:    'svchost.exe',          // identical to every legitimate svchost
      path:    'C:\\Windows\\System32\\svchost.exe',
      service: 'LocalService',
    },
  },

  // ── Decoy processes ───────────────────────────────────────────────────────
  // These are LEGITIMATE processes that spawn at nearly the same time as the
  // malware (13:5x UTC, hours after boot). They are injected to make the
  // process list ambiguous and provoke accidental innocent kills.
  //
  // All decoys: isMalicious = false, isSuspicious = false.
  // Killing any of them costs 50 pts and triggers the innocent_killed lesson.
  decoyProcesses: {
    linux: [
      // A late-starting cron job — common on production servers after a
      // scheduled config reload. Looks suspicious by start time alone.
      {
        pid:          9901,
        ppid:         1,
        name:         'crond',
        path:         '/usr/sbin/crond',
        threads:      2,
        startTime:    '13:51:22',
        service:      'scheduled-tasks',
        isMalicious:  false,
        isSuspicious: false,
        isHollowed:   false,
        memoryRegions: [],
        handles:      [],
        dlls:         [],
        envars:       [],
        hexDump:      null,
        yaraResults:  [],
      },
      // A secondary syslogd instance — legitimate on multi-tenant servers
      // but visually close to rsyslogd when scanning quickly.
      {
        pid:          9902,
        ppid:         1,
        name:         'syslogd',
        path:         '/usr/sbin/syslogd',
        threads:      1,
        startTime:    '13:52:05',
        service:      'logging',
        isMalicious:  false,
        isSuspicious: false,
        isHollowed:   false,
        memoryRegions: [],
        handles:      [],
        dlls:         [],
        envars:       [],
        hexDump:      null,
        yaraResults:  [],
      },
    ],

    windows: [
      // A late-starting svchost — legitimately spawned by a delayed-start
      // service (e.g., Windows Remote Management). Same name as the malicious
      // PID; only the service tag and memory regions differentiate them.
      {
        pid:          9901,
        ppid:         636,
        name:         'svchost.exe',
        path:         'C:\\Windows\\System32\\svchost.exe',
        threads:      9,
        startTime:    '13:50:44',
        service:      'AppInfo',
        isMalicious:  false,
        isSuspicious: false,
        isHollowed:   false,
        memoryRegions: [
          {
            address:    '0x00007ff7b1000000',
            size:       '0x15000',
            protection: 'PAGE_EXECUTE_READ',
            flags:      'COMMIT',
          },
        ],
        handles:     [],
        dlls:        [],
        envars:      [],
        hexDump:     null,
        yaraResults: [],
      },
      // Another delayed svchost for WinRM — started programmatically after
      // a Group Policy update. Innocent, but indistinguishable by name alone.
      {
        pid:          9902,
        ppid:         636,
        name:         'svchost.exe',
        path:         'C:\\Windows\\System32\\svchost.exe',
        threads:      5,
        startTime:    '13:53:18',
        service:      'WinRM',
        isMalicious:  false,
        isSuspicious: false,
        isHollowed:   false,
        memoryRegions: [
          {
            address:    '0x00007ff7b2000000',
            size:       '0x15000',
            protection: 'PAGE_EXECUTE_READ',
            flags:      'COMMIT',
          },
        ],
        handles:     [],
        dlls:        [],
        envars:      [],
        hexDump:     null,
        yaraResults: [],
      },
    ],
  },
};

export default EXPERT_TIER;