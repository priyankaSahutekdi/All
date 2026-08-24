/**
 * Lookup / regex-building functions over the `UI_COPY` table in `uiCopyData.ts`.
 *
 * DESIGN: `copy()`, `copyAlt()` and `copyRe()` THROW when the requested language has no value
 * for a key. They deliberately do not fall back to English. A fallback would mean a Hindi run
 * quietly matching English text — the run would go green while proving nothing, which is the
 * failure mode the whole LANG axis exists to prevent. A missing string must stop the run and
 * name itself.
 */
import { AppLanguage } from './languages';
import { COPY_KEYS, CopyKey, UI_COPY } from './UiCopyData';

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
                `build and added to src/utils/uiCopyData.ts — not translated or guessed. ` +
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
 * `copyRe`, but `null` instead of throwing when `lang` has no value for `keys`.
 *
 * For the rare call site that has an established NON-TEXT fallback already (geometry, role) and
 * genuinely cannot observe a translation because there is no text to observe — e.g. an icon-only
 * button (confirmed live, H11, 2026-08-19: `FoundationPage.clickLetsStart`'s F1-entry button is
 * an SVG `<path>` with no `<text>` element in Hindi at all). This is NOT a way to silently ignore
 * a translation gap that could be filled — `copy`/`copyRe` still throw for every other call site,
 * exactly per the DESIGN note above, and this helper's own doc-comment is the place a future
 * reader checks before reaching for it.
 */
export function tryCopyRe(keys: CopyKey | readonly CopyKey[], lang: AppLanguage, opts: CopyReOptions = {}): RegExp | null {
    try {
        return copyRe(keys, lang, opts);
    } catch {
        return null;
    }
}

/** Same as `copyAlt`, but `null` instead of throwing — the fragment-level counterpart to
 *  `tryCopyRe`, for callers that combine several independent alternatives into one larger
 *  pattern and can safely drop any one that isn't observed yet for `lang` (see `transitions.ts`'s
 *  `tryTransitionAlt` and `FoundationPage.notAnAnswerOption`). Same caveat as `tryCopyRe`: only
 *  for call sites with an established fallback for "this alternative doesn't apply," not a
 *  general bypass. */
export function tryCopyAlt(keys: CopyKey | readonly CopyKey[], lang: AppLanguage, opts: CopyReOptions = {}): string | null {
    try {
        return copyAlt(keys, lang, opts);
    } catch {
        return null;
    }
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
