#!/usr/bin/env node
/**
 * Onboarding-readiness check for a language: prints every `uiCopy` key it is missing a value
 * for, via `missingCopyKeys()` (src/utils/uiCopy.ts) — built for exactly this, previously never
 * called from anywhere.
 *
 * Compiles just uiCopy.ts + its two small local dependencies (languages.ts, text.ts — none of
 * which import Playwright or touch the DOM) to a temp dir and requires the result, rather than
 * needing a full project build or an extra ts-node-style dependency this repo doesn't have.
 *
 * Usage:
 *   node scripts/check-language-readiness.js hindi
 *   node scripts/check-language-readiness.js hindi tamil telugu   # multiple languages at once
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const codes = process.argv.slice(2);
if (codes.length === 0) {
    console.error('Usage: node scripts/check-language-readiness.js <language-code> [more-codes...]');
    console.error('Known codes come from src/utils/languages.ts (e.g. hindi, tamil, telugu, kannada, gujarati, odia).');
    process.exit(1);
}

const repoRoot = path.join(__dirname, '..');
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lang-readiness-'));

try {
    execFileSync(process.execPath, [
        require.resolve('typescript/bin/tsc'),
        '--target', 'ES2020',
        '--lib', 'ES2020',
        '--module', 'commonjs',
        '--moduleResolution', 'node',
        '--esModuleInterop',
        '--skipLibCheck',
        '--resolveJsonModule',
        '--outDir', outDir,
        path.join(repoRoot, 'src/utils/uiCopy.ts'),
    ], { cwd: repoRoot, stdio: 'inherit' });
} catch (e) {
    console.error('\nFailed to compile src/utils/uiCopy.ts (+ its local deps) — see the tsc output above.');
    process.exit(1);
}

// tsc's computed rootDir is the common ancestor of the compiled files (src/utils, since that's
// where uiCopy.ts and its two local deps all live), so output lands flat in outDir with no
// src/utils/ prefix.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { missingCopyKeys, COPY_KEYS } = require(path.join(outDir, 'uiCopy.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { languageByCode, LANGUAGES } = require(path.join(outDir, 'languages.js'));

for (const code of codes) {
    let lang;
    try {
        lang = languageByCode(code);
    } catch (e) {
        console.error(`\n${code}: ${e.message}`);
        continue;
    }
    const missing = missingCopyKeys(lang);
    const have = COPY_KEYS.length - missing.length;
    console.log(`\n${lang.code} (${lang.label}): ${have}/${COPY_KEYS.length} uiCopy keys populated`);
    if (missing.length === 0) {
        console.log('  ✅ fully populated — nothing missing.');
    } else {
        console.log(`  Missing ${missing.length}: ${missing.join(', ')}`);
    }
}

console.log(`\n(Known language codes: ${LANGUAGES.map((l) => l.code).join(', ')})`);
fs.rmSync(outDir, { recursive: true, force: true });
