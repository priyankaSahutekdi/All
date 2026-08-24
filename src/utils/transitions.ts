/**
 * Transition/completion button labels — "Continue", "Next Level", "Skip Demo", etc. — shared
 * vocabulary for FoundationPage and MasteryPage's own advance-button matchers.
 *
 * Before this, the same kind of word list existed twice (`FoundationPage.clickChallengeAdvance`
 * and `MasteryPage.TRANSITION_RE`), so a Hindi translation would have to be added in two places
 * and could drift. Every label below is a literal exactly once — both sites build their own
 * pattern by referencing these keys, never by re-typing the word.
 *
 * Deliberately NOT a full merge into one shared regex or one shared matching function: the two
 * sites use genuinely different STRATEGIES —
 *   - FoundationPage checks a small number of PRIORITY-ORDERED patterns (try "Start Game" first,
 *     then "Continue", etc.) via separate `getByText` locator calls, unanchored substrings.
 *   - MasteryPage tests ONE anchored alternation against every element's exact trimmed text in
 *     DOM order, plus a geometry filter (button-sized, clickable cursor).
 * Reconciling those into one function is a real behavior change (verified: FoundationPage
 * deliberately excludes "Skip Demo" from `clickChallengeAdvance` — `completeF3` handles it via
 * its own dedicated check right after — and MasteryPage has no "Next Level" entry at all). Doing
 * that safely needs its own investigation and a full regression, so only the VOCABULARY is
 * shared here; each site keeps its own matching code unchanged, sourced from these constants
 * instead of inline literals. Runtime behavior for English is unchanged — every regex built from
 * these constants is byte-for-byte identical to what each site had before (verified against the
 * compiled module: same `.source`/`.flags` on every pattern).
 */

export const TRANSITION_LABELS = {
    continue: 'Continue',
    next: 'Next',
    letsGo: "Let's Go",
    startGame: 'Start Game',
    claim: 'Claim',
    collect: 'Collect',
    finish: 'Finish',
    done: 'Done',
    playAgain: 'Play Again',
    /** FoundationPage-only — a compound label needing its own priority slot ahead of "Next". */
    nextLevel: 'Next Level',
    /** MasteryPage-only — not part of FoundationPage's matcher (see the note above). */
    skipDemo: 'Skip Demo',
    /** MasteryPage-only. */
    gotIt: 'Got it',
} as const;

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** "Let's Go" / "Lets Go" — the apostrophe is optional, as the original patterns had it. */
const apostropheOptional = (s: string): string => escapeRe(s).replace(/'/g, "'?");

/** One label as an unanchored, case-insensitive substring pattern (e.g. for `getByText`). */
function labelRe(label: string): RegExp {
    return new RegExp(apostropheOptional(label), 'i');
}

/** Several labels as ONE unanchored alternation — matches any of them as a substring. */
function anyLabelRe(labels: readonly string[]): RegExp {
    return new RegExp(labels.map(apostropheOptional).join('|'), 'i');
}

const T = TRANSITION_LABELS;

/**
 * FoundationPage's priority-ordered advance patterns — same order and unanchored substring
 * semantics as before: the compound/specific labels first, then the rest as one group.
 */
export const FOUNDATION_TRANSITION_PRIORITY: RegExp[] = [
    labelRe(T.startGame),
    labelRe(T.nextLevel),   // checked before plain "Next" so the more specific label wins
    labelRe(T.continue),
    labelRe(T.next),
    anyLabelRe([T.letsGo, T.claim, T.collect, T.finish, T.done, T.playAgain]),
];

/** All labels MasteryPage matches, as ONE anchored alternation — `MasteryPage.TRANSITION_RE`. */
export const MASTERY_TRANSITION_RE = new RegExp(
    `^(${[T.continue, T.next, T.letsGo, T.startGame, T.skipDemo, T.claim, T.collect, T.finish, T.done, T.playAgain, T.gotIt]
        .map(apostropheOptional).join('|')})$`,
    'i',
);
