/**
 * Screen-state UI copy, keyed by concept and then by language.
 *
 * `text.ts` made character *classes* script-agnostic and `transitions.ts` collected the ~12
 * advance-button labels. Neither covers the third and largest group: the strings that decide
 * WHICH SCREEN the driver is looking at — "How to Play", "Time Up!", "Check Sequence",
 * "Fuel: 12/50", "Did you see the word?", "Ready for Challenge". Those were inline literals
 * spread across the page objects, so every one of them was an English-only assumption sitting
 * on the critical path of screen recognition.
 *
 * Screen detection is exactly where a missing translation is most expensive, because it fails
 * in two directions (text.ts:40-43 makes the same point): a false negative stalls the driver
 * until a timeout, and a false positive makes it act on the wrong screen.
 *
 * DESIGN: `copy()` and `copyRe()` THROW when the requested language has no value for a key.
 * They deliberately do not fall back to English. A fallback would mean a Hindi run quietly
 * matching English text — the run would go green while proving nothing, which is the failure
 * mode the whole LANG axis exists to prevent. A missing string must stop the run and name
 * itself.
 *
 * POPULATING A LANGUAGE: values must be OBSERVED on a real build of that language, never
 * translated or guessed — the same standing rule as src/testdata/hindi/README.md. Hindi is
 * intentionally absent below rather than filled with plausible translations.
 */
import { AppLanguage } from './languages';

/**
 * One concept per key. Values are the exact strings the app renders, per language code.
 * A value may be a list when the app legitimately uses more than one wording for one state
 * (kept as data rather than as an inline `a|b` alternation, which is the pattern this
 * module exists to remove).
 */
const UI_COPY = {
    // ── App chrome / navigation ──────────────────────────────────────────────
    skip: { english: 'Skip' },
    confirm: { english: 'Confirm' },
    chooseHelpLanguage: { english: 'Choose your help language' },
    startAssessment: { english: 'Start Assessment' },

    // ── Activity identification ─────────────────────────────────────────────
    howToPlay: { english: 'How to Play' },
    letterLauncher: { english: 'Letter Launcher' },
    memoryChallenge: { english: 'Memory Challenge' },
    letterRecognition: { english: 'Letter Recognition' },
    didYouSee: { english: 'Did you see' },
    speakCorrectAnswer: { english: 'speak the correct answer' },
    readyForChallenge: { english: 'Ready for Challenge' },

    // ── Progress / scoring readouts (the numbers are parsed separately) ──────
    fuelLabel: { english: 'Fuel' },
    progressLabel: { english: 'Progress' },
    wordsPerMinute: { english: 'Words per minute' },
    wordsLearnt: { english: 'Words Learnt' },
    startLevel: { english: 'Start Level' },
    livesLabel: { english: 'You have' },

    // ── Transient activity states ───────────────────────────────────────────
    timeUp: { english: 'Time Up' },
    checkSequence: { english: 'Check Sequence' },

    // ── Feedback ────────────────────────────────────────────────────────────
    correctFeedback: { english: ['Correct', 'Great', 'Well done'] },
    encouragement: { english: ['Awesome', 'Well done', 'Great job'] },
    retryFeedback: { english: ['TRY AGAIN', "can't hear", 'Oops', 'not quite'] },

    // ── Completion ──────────────────────────────────────────────────────────
    completion: { english: ['Hurray', 'successfully', 'complete'] },

    // ── Errors ──────────────────────────────────────────────────────────────
    connectionLost: { english: ["Couldn't connect right now", 'check your internet connection'] },
    tryAgain: { english: 'try again' },
} as const satisfies Record<string, Record<string, string | readonly string[]>>;

export type CopyKey = keyof typeof UI_COPY;

/** Every key, for coverage checks when a new language is added. */
export const COPY_KEYS = Object.keys(UI_COPY) as CopyKey[];

/**
 * The exact string(s) the app renders for `key` in `lang`.
 *
 * Throws when the language has no value — see the DESIGN note above; falling back to English
 * would produce a green run that validated the wrong language.
 */
export function copy(key: CopyKey, lang: AppLanguage): string[] {
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
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface CopyReOptions {
    /** Anchor the whole match (`^…$`). Default false — substring, as most call sites use. */
    exact?: boolean;
    /** Regex flags. Default 'i', matching the inline literals this replaces. */
    flags?: string;
}

/**
 * `key` as a pattern for `lang` — an alternation when the concept has several wordings.
 *
 * Defaults reproduce the inline literals being replaced (unanchored, case-insensitive), so
 * migrating a call site is not a behaviour change for English. Verified per site.
 */
export function copyRe(key: CopyKey, lang: AppLanguage, opts: CopyReOptions = {}): RegExp {
    const { exact = false, flags = 'i' } = opts;
    const body = copy(key, lang).map(escapeRe).join('|');
    return new RegExp(exact ? `^(?:${body})$` : `(?:${body})`, flags);
}

/**
 * Which keys `lang` is missing — for a readiness check before starting work in a language,
 * so the gaps are known up front instead of one timeout at a time.
 */
export function missingCopyKeys(lang: AppLanguage): CopyKey[] {
    return COPY_KEYS.filter((k) => (UI_COPY[k] as Record<string, unknown>)[lang.code] === undefined);
}
