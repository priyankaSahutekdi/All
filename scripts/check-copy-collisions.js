/**
 * Refuse copy values that make a "we have LEFT this screen" marker match while still ON it.
 *
 * WHY THIS EXISTS. `pastF3` (FoundationPage.ts) is an OR of three optional signals —
 * `wordsPerMinute`, `wordsLearnt`, `startLevel` — joined by `optFrag` WITHOUT anchoring. Any one
 * of them matching anywhere in the page text means "F3 is over".
 *
 * On 2026-09-21 Hindi's `startLevel` was the bare word "स्तर" ("level"), chosen deliberately on
 * the reasoning that a broad single-word match is harmless for an OR'd signal. But `nextLevel`
 * for Hindi is "अगला स्तर", which CONTAINS "स्तर" — so the mid-F3 celebration screen's own
 * "Next Level" button satisfied `pastF3`. The driver declared F3 complete after the first Memory
 * Challenge and the suite went GREEN on 9 of 22 nodes. English survived only by luck of phrasing:
 * "Start Level" does not occur inside "Next Level".
 *
 * That failure mode is silent, language-specific, and invisible in a pass/fail report — the only
 * reason it surfaced was an unexplained duration gap against English. Every language onboarded
 * from here (Nepali, Kannada, Telugu) walks into the same trap, so it is checked mechanically
 * rather than left to the next reviewer to notice.
 *
 * Run directly: `node scripts/check-copy-collisions.js`
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'src', 'utils', 'UiCopyData.ts');

/** Signals that mean "we have left the screen/level". A false positive here ends a level early. */
const EXIT_SIGNALS = ['wordsPerMinute', 'wordsLearnt', 'startLevel'];
/** Copy that is rendered WHILE still inside the level. An exit signal must not occur in these. */
const ON_SCREEN = ['nextLevel', 'continueLabel', 'startGame', 'skipDemo', 'letsGo', 'next', 'claim', 'collect', 'playAgain', 'readyForChallenge', 'memoryChallenge', 'letterLauncher'];

const src = fs.readFileSync(FILE, 'utf8');

/** All values for one key/language, as a list (a key may hold an array of wordings). */
function values(key, lang) {
    const entry = src.match(new RegExp('^[ ]{4}' + key + ':[ ]*\\{([^\\n]*)\\},?$', 'm'));
    if (!entry) return [];
    const body = entry[1];
    const arr = body.match(new RegExp(lang + ":\\s*\\[([^\\]]*)\\]"));
    if (arr) return arr[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
    const one = body.match(new RegExp(lang + ":\\s*'([^']*)'"));
    return one ? [one[1]] : [];
}

const langs = ['english', 'hindi', 'nepali', 'kannada', 'telugu'];
const problems = [];

for (const lang of langs) {
    for (const sig of EXIT_SIGNALS) {
        for (const sigVal of values(sig, lang)) {
            if (!sigVal.trim()) continue;
            for (const key of ON_SCREEN) {
                for (const onVal of values(key, lang)) {
                    // A slot template can't be compared literally; skip those.
                    if (sigVal.includes('{') || onVal.includes('{')) continue;
                    if (onVal.toLowerCase().includes(sigVal.toLowerCase())) {
                        problems.push(
                            `  ${lang}: exit signal ${sig} = "${sigVal}"\n` +
                            `      occurs inside on-screen copy ${key} = "${onVal}"`,
                        );
                    }
                }
            }
        }
    }
}

if (problems.length) {
    console.error('\nRefusing: a level-exit signal is a substring of copy shown DURING the level.\n');
    problems.forEach((p) => console.error(p));
    console.error(
        '\nThis makes the driver believe the level ended while it is still running, so the suite\n' +
        'reports a PASS on partial coverage — the exact failure that hid ~60% of Hindi F3.\n\n' +
        'Fix by giving the exit signal a value specific enough not to occur in the on-screen copy\n' +
        '(a full phrase, or a {slot} template), or by leaving that language\'s value absent so the\n' +
        'remaining signals carry the detection. Absent is safe: a missing signal fails loudly.\n',
    );
    process.exit(1);
}

console.log(`OK: no exit-signal collisions across ${langs.length} languages.`);
