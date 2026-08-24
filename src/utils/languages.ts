/**
 * The languages the ALL app offers, and how they appear in its UI.
 *
 * The app writes a language's name in that language ("English", "हिंदी"), and that label is
 * load-bearing for automation: it is the text of the header language switcher, an option in
 * the "Select Language" modal, and a chrome string that has to be told apart from real
 * content when scraping a screen.
 *
 * Keeping the set in one place is what stops the two anti-patterns already visible in this
 * repo: a hardcoded single language (`switchToEnglishForF2`, `split(/\bEnglish\b/)`) that
 * simply does not work in another language, and an ever-growing inline alternation
 * (`/^Continue$|जारी रखें/`) that has to be found and extended in every locator.
 *
 * Scope note: this is the app's language *vocabulary*, not the LANG selection axis. Choosing
 * which language a run targets (env var, config, reporting) is a later, separate change —
 * BUILD_HISTORY.md (Refactoring Plan section) R1/R8. This module deliberately holds no defaults and reads no env.
 */

import { LETTER_CLASS } from './Text';

export interface AppLanguage {
    /** BCP-47-ish short code used as the key in code and test data. */
    code: string;
    /** The label the app renders for this language, in that language. */
    label: string;
    /** Also accepted when reading the label off screen (e.g. the English exonym). */
    aliases?: string[];
}

/**
 * Taken from the app's own header language switcher. Only `english` is exercised by the
 * current suite; the rest are listed because the switcher offers them and because matching
 * the *current* label is how the driver decides whether it needs to switch at all.
 */
export const LANGUAGES: AppLanguage[] = [
    { code: 'english', label: 'English' },
    { code: 'hindi', label: 'हिंदी', aliases: ['Hindi'] },
    { code: 'tamil', label: 'தமிழ்', aliases: ['Tamil'] },
    { code: 'telugu', label: 'తెలుగు', aliases: ['Telugu'] },
    { code: 'kannada', label: 'ಕನ್ನಡ', aliases: ['Kannada'] },
    { code: 'gujarati', label: 'ગુજરાતી', aliases: ['Gujarati'] },
    { code: 'odia', label: 'ଓଡିଆ', aliases: ['Odia'] },
];

/** Look up a language by code (case-insensitive). Throws on an unknown code. */
export function languageByCode(code: string): AppLanguage {
    const found = LANGUAGES.find((l) => l.code === (code || '').toLowerCase());
    if (!found) {
        throw new Error(`Unknown language code '${code}'. Known: ${LANGUAGES.map((l) => l.code).join(', ')}`);
    }
    return found;
}

/** Every on-screen spelling of a language, e.g. `['हिंदी', 'Hindi']`. */
export function languageLabels(lang: AppLanguage): string[] {
    return [lang.label, ...(lang.aliases || [])];
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Matches exactly one language's label, anchored — for "is the UI already in X?". */
export function labelRe(lang: AppLanguage): RegExp {
    return new RegExp(`^(?:${languageLabels(lang).map(escapeRe).join('|')})$`, 'iu');
}

/**
 * Matches any language label. Two uses, both about telling app chrome from content: finding
 * the header switcher whatever language it currently shows, and excluding the language name
 * when scraping text off a screen.
 */
export const ANY_LANGUAGE_LABEL = new RegExp(
    LANGUAGES.flatMap(languageLabels).map(escapeRe).join('|'),
    'u',
);

/**
 * Any language label as a standalone word — the `\b…\b` equivalent. `\b` is defined on ASCII
 * `\w`, so it can never fire next to Devanagari; letter/digit lookarounds give the same
 * result for a Latin label and actually work for the others.
 *
 * Used to slice app chrome off screen text: the language name is a separator between UI
 * furniture and real content, so it must match as a word and not inside one.
 */
export const ANY_LANGUAGE_LABEL_TOKEN = new RegExp(
    `(?<![${LETTER_CLASS}\\p{N}])(?:${LANGUAGES.flatMap(languageLabels).map(escapeRe).join('|')})(?![${LETTER_CLASS}\\p{N}])`,
    'u',
);
