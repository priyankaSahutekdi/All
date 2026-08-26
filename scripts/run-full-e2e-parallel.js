#!/usr/bin/env node
/**
 * Runs the English and Hindi FULL_E2E confirmations (Discovery → F1 → F2 → F3, one fresh guest
 * account each) side by side, each in its own child process.
 *
 * Why this exists rather than `npm run e2e:full:english & npm run e2e:full:hindi`: `&` only
 * backgrounds a command in POSIX shells — it's a syntax error in PowerShell and runs commands
 * SEQUENTIALLY (not in parallel) in cmd.exe, which is npm's default shell on Windows. Spawning
 * both from Node instead is genuinely cross-platform, matching `run-e2e.js`'s own reasoning for
 * translating `--env`/`--lang`/`--full-e2e` instead of relying on shell env-var prefixes.
 *
 * Why each run needs its own `--output` directory: Playwright wipes its `test-results` output
 * directory at the START of every run. Two runs sharing the default directory will delete each
 * other's screenshots/traces/videos out from under one another — confirmed live (2026-08-26):
 * a real run's failure screenshot was silently lost this way when a second run started while the
 * first was still going. `e2e:full:english`/`e2e:full:hindi` already each pass their own
 * `--output=test-results-full-<lang>`; this script does the same when invoked directly.
 *
 * Output: each run's full console output streams to its own log file (`full-e2e-english.log` /
 * `full-e2e-hindi.log`, in the repo root, gitignored alongside `test-results/`) AND to this
 * process's own stdout, prefixed per line so you can tell them apart live. A summary prints once
 * both finish.
 *
 * Usage: node scripts/run-full-e2e-parallel.js [--headed] [--env=uat|lab|lab2]
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const passthrough = argv.filter((a) => a === '--headed' || a.startsWith('--env='));

const RUNS = [
    { label: 'english', lang: null, outDir: 'test-results-full-english', logFile: 'full-e2e-english.log' },
    { label: 'hindi', lang: 'hindi', outDir: 'test-results-full-hindi', logFile: 'full-e2e-hindi.log' },
];

function runOne(run) {
    const args = [
        path.join(__dirname, 'run-e2e.js'),
        '--full-e2e',
        ...(run.lang ? [`--lang=${run.lang}`] : []),
        ...passthrough,
        'src/tests/discovery/foundation-f1.spec.ts',
        `--output=${run.outDir}`,
    ];
    const logStream = fs.createWriteStream(run.logFile, { flags: 'w' });
    const child = spawn(process.execPath, args, { env: process.env });

    const tag = `[${run.label}]`;
    const pipe = (stream) => {
        stream.on('data', (chunk) => {
            logStream.write(chunk);
            // eslint-disable-next-line no-console
            process.stdout.write(chunk.toString().split('\n').map((l, i, arr) => (i < arr.length - 1 || l ? `${tag} ${l}` : l)).join('\n'));
        });
    };
    pipe(child.stdout);
    pipe(child.stderr);

    return new Promise((resolve) => {
        child.on('close', (code) => { logStream.end(); resolve({ label: run.label, code, logFile: run.logFile }); });
    });
}

(async () => {
    // eslint-disable-next-line no-console
    console.log(`\n[run-full-e2e-parallel] Starting English + Hindi FULL_E2E runs in parallel.\n`
        + `[run-full-e2e-parallel] English log: ${RUNS[0].logFile}  |  Hindi log: ${RUNS[1].logFile}\n`);

    const results = await Promise.all(RUNS.map(runOne));

    // eslint-disable-next-line no-console
    console.log(`\n${'='.repeat(60)}\n[run-full-e2e-parallel] SUMMARY\n${'='.repeat(60)}`);
    for (const r of results) {
        // eslint-disable-next-line no-console
        console.log(`  ${r.code === 0 ? '✅ PASS' : '❌ FAIL'}  ${r.label.padEnd(8)}  exit=${r.code}  log=${r.logFile}`);
    }
    process.exit(results.every((r) => r.code === 0) ? 0 : 1);
})();
