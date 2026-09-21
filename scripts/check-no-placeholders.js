/**
 * Refuse to commit harvest placeholders.
 *
 * Onboarding a language uses a deliberate trick: fill each unobserved uiCopy key with a value
 * that can never match real screen text, so `copy()` resolves and a run walks far enough into the
 * app to reveal the real string on a failure snapshot (docs/HINDI_ROLLOUT_LOG.md, EL-28). The
 * placeholders are supposed to live in the working tree and never reach a commit.
 *
 * WHY THIS EXISTS AS A HOOK. On 2026-09-21 they were committed three separate times in one
 * session, each time by a `git add -A` that swept up `UiCopyData.ts` mid-harvest. There is
 * already a runtime guard in `UiCopyLookup.copy()`, but it stops placeholders being USED, not
 * being COMMITTED — the wrong half of the problem. A committed placeholder is quiet:
 *
 *   - `missingCopyKeys()` counts it as populated, so coverage reporting overstates a language.
 *     It reported Nepali at PARITY with Hindi while 12 keys were fake.
 *   - every matcher built from it hunts text that cannot exist, so the failure lands as a timeout
 *     on some unrelated screen, which is expensive to trace back.
 *
 * Intent is not a substitute for a check when the same mistake recurs. Run by lint-staged on
 * commit; also runnable directly as `node scripts/check-no-placeholders.js`.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');

/** Matches the placeholder convention used while harvesting. Keep in sync with UiCopyLookup. */
const PLACEHOLDER_RE = /UNOBS\b|__(TODO|PLACEHOLDER|UNOBSERVED)/;

/** Files lint-staged passed us, or every staged file when run standalone. */
function targets() {
    const fromArgs = process.argv.slice(2);
    if (fromArgs.length) return fromArgs;
    return execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM'], { encoding: 'utf8' })
        .split('\n')
        .filter((f) => f.trim() && /\.(ts|json)$/.test(f));
}

const offenders = [];
for (const file of targets()) {
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch {
        continue; // deleted or unreadable; not our problem
    }
    text.split('\n').forEach((line, i) => {
        // Skip the definitions and prose that legitimately name the convention.
        if (/PLACEHOLDER_RE|check-no-placeholders|^\s*[*/]/.test(line)) return;
        if (PLACEHOLDER_RE.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim()}`);
    });
}

if (offenders.length) {
    console.error('\nRefusing the commit: harvest placeholders are staged.\n');
    offenders.forEach((o) => console.error(`  ${o}`));
    console.error(
        '\nThese are scaffolding, not observed copy. Replace each with the real string from a\n' +
        'failure snapshot, or strip them before committing:\n\n' +
        '  node -e "const f=require(\'fs\'),p=\'src/utils/UiCopyData.ts\';' +
        'f.writeFileSync(p,f.readFileSync(p,\'utf8\').replace(/, [a-z]+: \'[^\']*UNOBS[^\']*\'/g,\'\'))"\n\n' +
        'Committing them makes coverage reports overstate the language and turns every matcher\n' +
        'built from them into a timeout on an unrelated screen. See EL-28.\n',
    );
    process.exit(1);
}
