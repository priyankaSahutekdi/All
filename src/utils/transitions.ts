/**
 * Transition/completion button matchers — "Continue", "Next Level", "Skip Demo", etc. — shared
 * by FoundationPage and MasteryPage's own advance-button lookups.
 *
 * Before this, the same kind of word list existed twice (`FoundationPage.clickChallengeAdvance`
 * and `MasteryPage.TRANSITION_RE`), so a Hindi translation would have to be added in two places
 * and could drift.
 *
 * The VOCABULARY now lives in `uiCopy.ts` (keys `continueLabel`, `next`, `nextLevel`, …) rather
 * than as English literals here, because these buttons are screen copy like any other and were
 * the single largest block of English-only strings left on the critical path — an advance button
 * that cannot be found stalls the driver just as surely as an unrecognised screen. What stays
 * here is the two MATCHING STRATEGIES, both now parameterized by language.
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
 * shared; each site keeps its own matching code unchanged, sourced from these builders instead
 * of inline literals. Runtime behavior for English is unchanged — every pattern built below
 * matches exactly what each site matched before (verified against the compiled module).
 */

import { AppLanguage, languageByCode } from './languages';
import { CopyKey, copyAlt, copyRe, tryCopyRe } from './UiCopy';

/**
 * The `uiCopy` keys for the advance-button vocabulary, named so each site can reference a slot
 * without re-typing a word. Both sites' label sets are sub-lists of this.
 */
export const TRANSITION_KEYS = {
    continue: 'continueLabel',
    next: 'next',
    letsGo: 'letsGo',
    startGame: 'startGame',
    claim: 'claim',
    collect: 'collect',
    finish: 'finish',
    done: 'done',
    playAgain: 'playAgain',
    /** FoundationPage-only — a compound label needing its own priority slot ahead of "Next". */
    nextLevel: 'nextLevel',
    skipDemo: 'skipDemo',
    /** MasteryPage-only. */
    gotIt: 'gotIt',
} as const satisfies Record<string, CopyKey>;

const K = TRANSITION_KEYS;

/**
 * The apostrophe in "Let's Go" is optional, as the original patterns had it — the app is not
 * consistent about rendering it. Every builder below carries this, so it is stated once.
 */
const APOSTROPHE = { apostrophe: 'optional' } as const;

/**
 * One or more labels as a grouped, unanchored, case-insensitive source fragment —
 * `(?:Start Game|Skip Demo)`. Grouped so callers can anchor it (`^…$`) or drop it into a larger
 * alternation without the precedence bug an ungrouped `a|b` would introduce.
 */
export function transitionAlt(keys: readonly CopyKey[], lang: AppLanguage): string {
    return copyAlt(keys, lang, APOSTROPHE);
}

/** One or more labels as an unanchored, case-insensitive pattern (e.g. for `getByText`). */
export function transitionRe(keys: readonly CopyKey[], lang: AppLanguage): RegExp {
    return copyRe(keys, lang, APOSTROPHE);
}

/** `transitionRe`, but `null` instead of throwing when `lang` has no value for `keys` — for
 *  priority-ordered slot lists where a language missing one slot's translation should just have
 *  fewer priority slots to try, not lose the slots it DOES have (see `foundationTransitionPriority`). */
export function tryTransitionRe(keys: readonly CopyKey[], lang: AppLanguage): RegExp | null {
    return tryCopyRe(keys, lang, APOSTROPHE);
}

/**
 * FoundationPage's priority-ordered advance patterns — same order and unanchored substring
 * semantics as before: the compound/specific labels first, then the rest as one group. A
 * language missing a slot's translation just has that slot dropped (`clickChallengeAdvance`
 * iterates the array trying each in turn, so a shorter list costs it nothing but that label).
 */
export function foundationTransitionPriority(lang: AppLanguage): RegExp[] {
    return [
        tryTransitionRe([K.startGame], lang),
        tryTransitionRe([K.nextLevel], lang),   // checked before plain "Next" so the more specific label wins
        tryTransitionRe([K.continue], lang),
        tryTransitionRe([K.next], lang),
        tryTransitionRe([K.letsGo, K.claim, K.collect, K.finish, K.done, K.playAgain], lang),
        // Low-priority fallback: some celebration/completion screens render their "Continue"
        // button in FIXED ENGLISH regardless of app language — the same "app-shell chrome isn't
        // localized" pattern already confirmed for the mic-calibration Skip button and the
        // help-language modal (H-1/D-10). Observed live (EL-19, docs/HINDI_ROLLOUT_LOG.md): F3's
        // post-Letter-Launcher celebration screen showed a literal "→ Continue" button in
        // English while every other word on that same screen was Hindi. Checked LAST, after every
        // language-specific slot above, so a language whose "Continue" IS translated (Hindi's own
        // `continueLabel`, confirmed elsewhere) always matches that first — this only fires when
        // nothing else did.
        tryTransitionRe([K.continue], languageByCode('english')),
    ].filter((re): re is RegExp => re !== null);
}

/** All labels MasteryPage matches, as ONE anchored alternation — `MasteryPage.TRANSITION_RE`. */
export function masteryTransitionRe(lang: AppLanguage): RegExp {
    return copyRe(
        [K.continue, K.next, K.letsGo, K.startGame, K.skipDemo, K.claim, K.collect, K.finish,
            K.done, K.playAgain, K.gotIt],
        lang,
        { ...APOSTROPHE, exact: true },
    );
}

/**
 * English-built constant, kept because `MasteryPage` still consumes it directly. Mastery is
 * parked out of scope by the 2026-08-18 TC-022 scope decision, so it is not being re-plumbed to
 * take a language yet — `masteryTransitionRe(lang)` above is what it moves to when that scope
 * opens (HINDI_ROLLOUT_LOG.md (Readiness Plan section) P2-1c).
 */
export const MASTERY_TRANSITION_RE = masteryTransitionRe(languageByCode('english'));
