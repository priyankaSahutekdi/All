#!/usr/bin/env node
/**
 * Environment-aware Playwright runner.
 *
 * Translates a friendly `--env=<uat|lab|lab2>` flag into the ENV variable the framework reads
 * (config/environments.ts) and forwards everything else to `playwright test`. Cross-platform
 * (no cross-env dependency needed) and the single entry point behind the npm scripts.
 *
 * Also translates `--lang=<english|hindi|…>` into TEST_LANG (config/language.ts). NOT `LANG`:
 * that name is POSIX-reserved and usually already set on Linux/CI.
 *
 * Also translates `--full-e2e` into FULL_E2E=1 — the single-session dynamic-user continuation
 * (`foundation-f1.spec.ts`'s FULL_E2E block) that drives ONE fresh guest account straight through
 * Discovery → F1 → F2 → F3 (→ Mastery, gated) rather than the separate parked-account specs. Kept
 * as a translated flag (not a raw env var) for the same cross-platform reason `--env`/`--lang`
 * are: `FULL_E2E=1 node …` isn't valid PowerShell/cmd syntax, so a raw env var prefix in a
 * package.json script silently breaks on Windows.
 *
 * Examples:
 *   node scripts/run-e2e.js --regression --env=uat --headed     # full regression, UAT, headed
 *   node scripts/run-e2e.js --env=lab2 --headed src/tests/discovery/mastery-m4.spec.ts
 *   node scripts/run-e2e.js --env=lab --grep "TC-023"
 *   node scripts/run-e2e.js --regression --lang=hindi           # same suite, Hindi build
 *   node scripts/run-e2e.js --full-e2e --lang=hindi --env=uat src/tests/discovery/foundation-f1.spec.ts
 */
const { spawnSync } = require('child_process');

// The real, production regression test cases (excludes scratch/debug specs).
const REGRESSION_SPECS = [
    'src/tests/discovery/discovery.spec.ts',       // TC-001..TC-012 (Discovery)
    'src/tests/discovery/foundation-f1.spec.ts',   // TC-013..TC-019 (F1)
    'src/tests/discovery/foundation-f2.spec.ts',   // TC-020 (F2)
    'src/tests/discovery/foundation-f3.spec.ts',   // TC-021/TC-022 (F3)
    'src/tests/discovery/mastery-m4.spec.ts',      // TC-023 (M4 P1-P4)
    'src/tests/discovery/mastery-m4-s1.spec.ts',   // TC-024 (M4 S1 — test.fixme)
];

const argv = process.argv.slice(2);
let env = null;
let lang = null;
let headed = false;
let regression = false;
let fullE2E = false;
const passthrough = [];

for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--env=')) env = a.slice('--env='.length);
    else if (a === '--env') env = argv[++i];
    else if (a.startsWith('--lang=')) lang = a.slice('--lang='.length);
    else if (a === '--lang') lang = argv[++i];
    else if (a === '--regression') regression = true;
    else if (a === '--full-e2e') fullE2E = true;
    else if (a === '--headed') { headed = true; passthrough.push('--headed'); }
    else passthrough.push(a);
}

if (env) process.env.ENV = String(env).toLowerCase().trim();
// TEST_LANG, not LANG — LANG is POSIX-reserved and usually already set on Linux/CI.
if (lang) process.env.TEST_LANG = String(lang).toLowerCase().trim();
if (fullE2E) process.env.FULL_E2E = '1';
process.env.TEST_MODE = headed ? 'headed' : 'headless';

// Default to the chromium project unless the caller chose one.
const hasProject = passthrough.some((a) => a.startsWith('--project'));
const projectArgs = hasProject ? [] : ['--project=chromium'];

// If --regression and the caller didn't name a spec/grep, run the full regression set serially
// (workers=1 — the single-session Discovery E2E and heavy PWA runs are not parallel-safe).
const hasTarget = passthrough.some((a) => !a.startsWith('-')) || passthrough.some((a) => a.startsWith('--grep'));
const targetArgs = regression && !hasTarget ? [...REGRESSION_SPECS, '--workers=1'] : [];

// Invoke the Playwright CLI directly via Node (no npx / no shell) — robust cross-platform.
const cli = require.resolve('@playwright/test/cli');
const args = [cli, 'test', ...projectArgs, ...targetArgs, ...passthrough];

// eslint-disable-next-line no-console
console.log(`\n[run-e2e] ENV=${process.env.ENV || '(default: uat)'}  LANG=${process.env.TEST_LANG || '(default: english)'}  MODE=${process.env.TEST_MODE}  FULL_E2E=${fullE2E ? 'on' : 'off'}\n[run-e2e] node ${['playwright', 'test', ...projectArgs, ...targetArgs, ...passthrough].join(' ')}\n`);

const res = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
process.exit(res.status == null ? 1 : res.status);
