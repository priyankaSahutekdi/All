/**
 * Screen-state UI copy, keyed by concept and then by language.
 *
 * `text.ts` made character *classes* script-agnostic. This module owns the other half: the
 * literal WORDS the driver looks for on screen — "How to Play", "Time Up!", "Check Sequence",
 * "Fuel: 12/50", "Ready for Challenge", "Continue", "Next Level". Those were inline literals
 * spread across the page objects, so every one of them was an English-only assumption sitting
 * on the critical path of screen recognition.
 *
 * Screen detection is exactly where a missing translation is most expensive, because it fails
 * in two directions (text.ts:40-43 makes the same point): a false negative stalls the driver
 * until a timeout, and a false positive makes it act on the wrong screen.
 *
 * DESIGN: `copy()`, `copyAlt()` and `copyRe()` THROW when the requested language has no value
 * for a key. They deliberately do not fall back to English. A fallback would mean a Hindi run
 * quietly matching English text — the run would go green while proving nothing, which is the
 * failure mode the whole LANG axis exists to prevent. A missing string must stop the run and
 * name itself.
 *
 * ONE CONCEPT, ONE LITERAL: keys are ATOMIC (`correct`, `great`, `wellDone`), not bundled
 * lists, because call sites legitimately want different subsets — `tapLetterAndAdvance` waits
 * out `Correct|Great` while `tapWordAndAdvance` waits out `Correct|Great|Well done`. A bundled
 * `correctFeedback` key forced one of those to change behaviour; separate keys let each call
 * site name the subset it means via `copyRe(['correct', 'great'], lang)`, while still holding
 * every word exactly once so a translator cannot make two copies drift.
 *
 * `{slot}` PLACEHOLDERS: a few strings wrap variable content ("Start F2", "of 5 letters").
 * The variable part is a `{slot}` and the caller supplies a regex fragment for it, so a
 * language that reorders the sentence ("F2 शुरू करें") is expressible as data rather than
 * needing new code. Where the variable part is a level CODE (`F1`, `F2`) it stays a code, not
 * copy — the app renders those identically in every language (`foundationLevel()` reads them
 * out of `img[alt]`).
 *
 * POPULATING A LANGUAGE: values must be OBSERVED on a real build of that language, never
 * translated or guessed — the same standing rule as src/testdata/hindi/README.md. Hindi is
 * intentionally absent below rather than filled with plausible translations.
 */
import { AppLanguage } from './languages';

/**
 * One concept per key. Values are the exact strings the app renders, per language code.
 *
 * A value may be a list ONLY when the app renders genuinely interchangeable wordings for one
 * concept AND every call site wants all of them; prefer separate atomic keys otherwise (see
 * the ONE CONCEPT, ONE LITERAL note above).
 */
const UI_COPY = {
    // ── App chrome / navigation ──────────────────────────────────────────────
    /**
     * English-only ON PURPOSE, not an unobserved gap: this key backs the mic-calibration
     * screen's Skip button (`DiscoveryLoginPage.micSkipPattern`, `sessionResume.ts`), which H2a
     * (2026-08-19) proved renders "Skip" in fixed English on a live Hindi-targeted run — that
     * screen is reached before the app has been told any language, so there is no Hindi string
     * to observe here. See `DECISIONS.md` D-10 and `EXECUTION_LOG.md` EL-7.
     */
    skip: { english: 'Skip' },
    /**
     * Hindi value is TC-003's learning-language dropdown confirm ("भाषा चुनें" popup), observed
     * live via H2a (2026-08-19) — NOT the help-language popup's Confirm (TC-002), which renders
     * fixed English for the same reason as `skip` above and is matched via a hardcoded literal
     * at its own call site instead of this key. See `DECISIONS.md` D-10.
     */
    confirm: { english: 'Confirm', hindi: 'कन्फर्म करें' },
    /** English-only — TC-002's help-language popup renders fixed English; see `confirm` above. */
    chooseHelpLanguage: { english: 'Choose your help language' },
    startAssessment: { english: 'Start Assessment', hindi: 'असेसमेंट शुरू करें' },
    letsStart: { english: "Let's Start" },

    // ── Transition / advance controls ────────────────────────────────────────
    // Previously English-only literals in `transitions.ts`. They live here so the advance
    // buttons are translatable like every other screen string; `transitions.ts` still owns
    // the two MATCHING STRATEGIES built from them (see the note in that file).
    /**
     * The Hindi value is the ONE observed non-English string this repo has ever carried: it was
     * an inline `/^Continue$|जारी रखें/` in `AssessmentPage.continueButton`, i.e. somebody hit
     * this screen on a Hindi build and wrote down what it said. Preserved here rather than
     * discarded, because observed copy is exactly what this registry wants and there is no way
     * to re-derive it without a Hindi run. NOT re-verified against a current build.
     */
    continueLabel: { english: 'Continue', hindi: 'जारी रखें' },
    next: { english: 'Next' },
    nextLevel: { english: 'Next Level' },
    letsGo: { english: "Let's Go" },
    startGame: { english: 'Start Game', hindi: 'खेल शुरू करें' },
    skipDemo: { english: 'Skip Demo', hindi: 'डेमो छोड़ें' },
    claim: { english: 'Claim' },
    collect: { english: 'Collect' },
    finish: { english: 'Finish' },
    done: { english: 'Done' },
    playAgain: { english: 'Play Again' },
    gotIt: { english: 'Got it' },

    // ── Journey map / placement screens ─────────────────────────────────────
    learningJourney: { english: 'learning journey' },
    languageSkills: { english: 'language skills' },
    /** The journey-map entry into a Foundation level; `{level}` is the F# code. */
    startFoundationLevel: { english: 'Start {level}' },
    startLevel: { english: 'Start Level' },
    levelWord: { english: 'Level' },
    foundationWord: { english: 'Foundation' },

    // ── Activity identification ─────────────────────────────────────────────
    howToPlay: { english: 'How to Play', hindi: 'कैसे खेलें' },
    letterLauncher: { english: 'Letter Launcher' },
    memoryChallenge: { english: 'Memory Challenge' },
    letterRecognition: { english: 'Letter Recognition' },
    didYouSee: { english: 'Did you see' },
    speakCorrectAnswer: { english: 'speak the correct answer' },
    readyForChallenge: { english: 'Ready for Challenge' },
    loading: { english: 'Loading' },

    // ── Progress / scoring readouts (the numbers are parsed separately) ──────
    fuelLabel: { english: 'Fuel' },
    progressLabel: { english: 'Progress' },
    wordsPerMinute: { english: 'Words per minute' },
    wordsLearnt: { english: 'Words Learnt' },
    livesLabel: { english: 'You have' },
    /** Memory Challenge's answer-grid prompt; `{n}` is the sequence length. */
    lettersOfCount: { english: 'of {n} letters' },

    // ── Transient activity states ───────────────────────────────────────────
    timeUp: { english: 'Time Up' },
    checkSequence: { english: 'Check Sequence' },

    // ── Feedback (atomic — call sites pick the subset they mean) ─────────────
    correct: { english: 'Correct' },
    great: { english: 'Great' },
    wellDone: { english: 'Well done' },
    awesome: { english: 'Awesome' },
    greatJob: { english: 'Great job' },
    /** The games' own wrong-answer shout, distinct from the connectivity page's `tryAgain`. */
    tryAgainShout: { english: 'TRY AGAIN' },
    cantHear: { english: "can't hear" },
    oops: { english: 'Oops' },
    notQuite: { english: 'not quite' },

    // ── Completion ──────────────────────────────────────────────────────────
    hurray: { english: 'Hurray' },
    successfully: { english: 'successfully' },
    complete: { english: 'complete' },
    /** Deliberately a STEM: the app renders "Congratulations" and "Congrats". */
    congratulations: { english: 'congrat' },
    /**
     * The assessment completion popup's own phrases. These overlap the `successfully` /
     * `complete` STEMS above but are not duplicates of them: the stems back FoundationPage's
     * deliberately loose "did the node finish?" heuristic, while these are the specific
     * wordings the popup renders and are what `expectCompletionPopupVisible` asserts on.
     */
    successfullyCompleted: { english: 'successfully completed' },
    completedAssessment: { english: 'completed assessment' },

    // ── Errors ──────────────────────────────────────────────────────────────
    couldntConnect: { english: "Couldn't connect right now" },
    checkInternet: { english: 'check your internet connection' },
    tryAgain: { english: 'try again' },
} as const satisfies Record<string, Record<string, string | readonly string[]>>;

export type CopyKey = keyof typeof UI_COPY;

/** Every key, for coverage checks when a new language is added. */
export const COPY_KEYS = Object.keys(UI_COPY) as CopyKey[];

/**
 * The exact string(s) the app renders for `keys` in `lang`, in the order given.
 *
 * Throws when the language has no value for a key — see the DESIGN note above; falling back to
 * English would produce a green run that validated the wrong language.
 */
export function copy(keys: CopyKey | readonly CopyKey[], lang: AppLanguage): string[] {
    const list = typeof keys === 'string' ? [keys] : keys;
    return list.flatMap((key) => {
        const entry = UI_COPY[key] as Record<string, string | readonly string[]>;
        const value = entry[lang.code];
        if (value === undefined) {
            throw new Error(
                `No '${lang.code}' UI copy for '${key}'. It must be observed on a real ${lang.code} ` +
                `build and added to src/utils/uiCopy.ts — not translated or guessed. ` +
                `Defined for: ${Object.keys(entry).join(', ')}`,
            );
        }
        return typeof value === 'string' ? [value] : [...value];
    });
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A `{slot}` placeholder. Two patterns because `String.prototype.split` splices EVERY capture
 * group of its separator into the result — so the splitting pattern must expose exactly one
 * group (the whole token) and the name is read afterwards.
 */
const SLOT_SPLIT_RE = /(\{[A-Za-z_][A-Za-z0-9_]*\})/;
const SLOT_NAME_RE = /^\{([A-Za-z_][A-Za-z0-9_]*)\}$/;

export interface CopyReOptions {
    /** Anchor the whole match (`^…$`). Default false — substring, as most call sites use. */
    exact?: boolean;
    /** Regex flags. Default 'i', matching the inline literals this replaces. */
    flags?: string;
    /**
     * Regex fragments (NOT escaped) for the `{slot}` placeholders in the copy. Every slot in
     * the copy must be supplied and every supplied slot must be used — a mismatch is a bug in
     * either the call site or the translation, and both must be loud rather than silently
     * producing a pattern that never matches.
     */
    slots?: Record<string, string>;
    /**
     * How to treat an apostrophe in the copy. `'optional'` → `'?` and `'any'` → `.?`, which is
     * what the inline literals being replaced did ("Couldn'?t", "Let.?s") because the app is
     * inconsistent about straight vs. curly vs. absent apostrophes. Default `'literal'`.
     */
    apostrophe?: 'literal' | 'optional' | 'any';
    /**
     * `'flexible'` turns each run of literal whitespace into `\s*`, reproducing the inline
     * literals that were written that way ("Start\s*F1"). Default `'exact'`.
     */
    space?: 'exact' | 'flexible';
}

/** One copy string → a regex source fragment, with slots spliced in and options applied. */
function literalToSource(literal: string, key: CopyKey, opts: CopyReOptions, usedSlots: Set<string>): string {
    const { slots = {}, apostrophe = 'literal', space = 'exact' } = opts;
    return literal
        .split(SLOT_SPLIT_RE)
        .filter((part) => part !== undefined && part !== '')
        .map((part) => {
            const slot = part.match(SLOT_NAME_RE);
            if (slot) {
                const fragment = slots[slot[1]];
                if (fragment === undefined) {
                    throw new Error(
                        `uiCopy '${key}' ("${literal}") has slot '{${slot[1]}}' but no fragment was ` +
                        `supplied. Pass it as { slots: { ${slot[1]}: '<regex source>' } }.`,
                    );
                }
                usedSlots.add(slot[1]);
                return fragment;
            }
            // escapeRe leaves apostrophes and whitespace alone, so these run safely after it.
            let src = escapeRe(part);
            if (apostrophe === 'optional') {
                src = src.replace(/['’]/g, "'?");
            } else if (apostrophe === 'any') {
                src = src.replace(/['’]/g, '.?');
            }
            if (space === 'flexible') {
                src = src.replace(/\s+/g, '\\s*');
            }
            return src;
        })
        .join('');
}

/**
 * `keys` as a regex source fragment for `lang` — `(?:a|b)`, grouped so it is safe to anchor or
 * embed in a larger pattern.
 *
 * Exposed alongside `copyRe` because several call sites need the fragment, not a finished
 * RegExp: they interpolate it into a pattern that also carries capture groups
 * (`Fuel:\s*(\d+)\s*\/\s*(\d+)`) or mixes anchored and unanchored alternatives.
 */
export function copyAlt(keys: CopyKey | readonly CopyKey[], lang: AppLanguage, opts: CopyReOptions = {}): string {
    const list = typeof keys === 'string' ? [keys] : keys;
    const used = new Set<string>();
    const body = list
        .flatMap((key) => copy(key, lang).map((literal) => literalToSource(literal, key, opts, used)))
        .join('|');
    for (const name of Object.keys(opts.slots || {})) {
        if (!used.has(name)) {
            throw new Error(
                `uiCopy: slot '{${name}}' was supplied for [${list.join(', ')}] in '${lang.code}' but ` +
                `no copy string uses it. Either the slot name is misspelled at the call site or the ` +
                `'${lang.code}' translation dropped it.`,
            );
        }
    }
    return `(?:${body})`;
}

/**
 * `keys` as a pattern for `lang` — an alternation when several keys (or wordings) are given.
 *
 * Defaults reproduce the inline literals being replaced (unanchored, case-insensitive), so
 * migrating a call site is not a behaviour change for English. Verified per site.
 */
export function copyRe(keys: CopyKey | readonly CopyKey[], lang: AppLanguage, opts: CopyReOptions = {}): RegExp {
    const { exact = false, flags = 'i' } = opts;
    const body = copyAlt(keys, lang, opts);
    return new RegExp(exact ? `^${body}$` : body, flags);
}

/**
 * The individual WORDS of `keys` in `lang`, de-duplicated.
 *
 * For the call sites that must recognise one word of a multi-word title on its own — the
 * Letter Launcher prompt scraper has to exclude the headings "Letter", "Launcher", "Memory"
 * and "Challenge" as chrome, and deriving those by splitting "Letter Launcher" / "Memory
 * Challenge" is what keeps them from drifting away from the titles they come from.
 */
export function copyWords(keys: CopyKey | readonly CopyKey[], lang: AppLanguage): string[] {
    return [...new Set(copy(keys, lang).flatMap((s) => s.split(/\s+/)).filter(Boolean))];
}

/** `copyWords` as a grouped regex source fragment — `(?:Letter|Launcher|Memory|…)`. */
export function copyWordsAlt(keys: CopyKey | readonly CopyKey[], lang: AppLanguage): string {
    return `(?:${copyWords(keys, lang).map(escapeRe).join('|')})`;
}

/**
 * Which keys `lang` is missing — for a readiness check before starting work in a language,
 * so the gaps are known up front instead of one timeout at a time.
 */
export function missingCopyKeys(lang: AppLanguage): CopyKey[] {
    return COPY_KEYS.filter((k) => (UI_COPY[k] as Record<string, unknown>)[lang.code] === undefined);
}

/**
 * Defines `key` on `obj` as a lazily-computed, self-memoizing property: `compute()` runs on
 * first access — which is where a missing-translation throw now happens, instead of at
 * construction — and the getter then replaces itself with the resolved value, so every later
 * read is a plain property access with no re-computation.
 *
 * Exists so a page object's pattern-builder (`foundationPatterns`, `assessmentPatterns`, …) can
 * return an object whose keys are each resolved only if some call site actually reads them,
 * instead of eagerly resolving every key at construction. That eager-everything design meant a
 * language missing even one unused key (e.g. an F2/F3-only key during an F1-only run) could not
 * be constructed at all — confirmed live against Hindi, where `DiscoveryLoginPage`,
 * `AssessmentPage` and `FoundationPage` all threw before the browser navigated anywhere. Making
 * resolution lazy fixes that with ZERO change to any consuming call site: `this.copy.xyz` still
 * means exactly what it means today, just resolved on first read instead of up front.
 */
export function lazyProp<V>(obj: object, key: PropertyKey, compute: () => V): void {
    Object.defineProperty(obj, key, {
        configurable: true,
        enumerable: true,
        get() {
            const value = compute();
            Object.defineProperty(obj, key, { value, enumerable: true, configurable: true, writable: false });
            return value;
        },
    });
}
