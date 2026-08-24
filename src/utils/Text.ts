/**
 * Script-agnostic text helpers shared by answer matching and on-screen text detection.
 *
 * The framework drives the same app in more than one language, so any code that inspects
 * screen text must not assume the Latin alphabet. A Latin-only character class does not
 * fail loudly on another script — it simply never matches, so the driver stops
 * recognising the screen and stalls into a timeout, which is far harder to diagnose than
 * an error. Everything here is therefore built on Unicode property escapes instead of
 * `a-z` ranges.
 *
 * Devanagari note: vowel signs (matras) and the virama are Unicode *marks* (`\p{M}`), not
 * letters, so `\p{L}` on its own would silently shred a Hindi word ("किताब" → "कतब").
 * Every class here admits `\p{M}` alongside `\p{L}`.
 */

/**
 * Lowercase, replace punctuation/symbols with a space, collapse whitespace.
 *
 * Both sides of a comparison must normalize identically, so this is the single
 * normalizer for answer text — used by `answerMatcher` (scoring a spoken/model answer
 * against the on-screen options) and by `ContentApiAnswerSource` (keying the app's own
 * content payload by question and by option set).
 *
 * Behaviour for English input is unchanged from the previous `[^a-z0-9\s]` rule: ASCII
 * punctuation, quotes and dashes are all Unicode punctuation or symbols, so they are
 * still collapsed to a space. The two Unicode-only steps below are likewise no-ops on
 * ASCII, so this stays byte-identical for English while becoming correct for Indic text.
 *
 * NFC first: the same Devanagari word can be encoded more than one way (a precomposed code
 * point vs. base + combining mark). Both sides of every comparison here are compared with
 * `===` or used as a Map key, so without a canonical form two visually identical strings
 * miss each other and the lookup silently returns nothing.
 *
 * Then ZWJ/ZWNJ are removed rather than turned into a space. They are invisible joiners that
 * sit INSIDE a word to force a half-form, and they are `\p{Cf}` — not `\p{L}`, `\p{N}` or
 * `\p{M}` — so the punctuation rule below would otherwise split one word into two.
 * Deleting them also makes the joined and unjoined spellings normalize to the same
 * string, which is what a normalizer keying both sides of a lookup has to do; merely keeping
 * them would preserve the mismatch.
 */
export function normalizeText(s: string): string {
    return (s || '')
        .normalize('NFC')
        .toLowerCase()
        .replace(/[\u200C\u200D]/g, '')   // ZWNJ + ZWJ (escaped: literals are invisible)
        .replace(/[^\p{L}\p{N}\p{M}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// ============================================
// Screen-text token patterns
// ============================================
//
// These gate screen *detection* ("is a Letter Hunt question showing?"), so both a false
// negative (driver stalls) and a false positive (driver acts on the wrong screen) are
// expensive. Each pattern is therefore written as two alternatives:
//
//   1. the original Latin rule, byte-for-byte — so English detection is provably unchanged
//   2. a non-Latin rule, reachable only when the token does NOT start with a Latin letter
//
// The `(?!\p{Script=Latin})` guard is what keeps them separate. Without it, widening the
// single-letter class to `\p{L}` would also start matching two-letter English words and
// could mis-detect an English screen. Latin input can only ever take branch 1.
//
// Lengths are counted in BASE LETTERS on both branches (see nonLatinRun), so the same
// {min,max} means the same thing in either script even though one Devanagari akshara can
// span several code points (क + ् + ष). The numbers are still the English-derived ones and
// have not been checked against a real Hindi screen -- revisit after REFACTORING_PLAN.md
// task 13.
//
// Consumed inside page.evaluate(), which cannot close over Node scope, so callers pass
// `.source`/`.flags` through and rebuild the RegExp in-page (the existing idiom in
// MasteryPage.clickButtonByText).

/**
 * Viramas for the scripts the app's language switcher offers (Devanagari, Bengali,
 * Gurmukhi, Gujarati, Odia, Tamil, Telugu, Kannada, Malayalam). A virama joins two base
 * letters into one conjunct, so it is the one place a single written letter legitimately
 * contains a second `\p{L}`.
 */
const VIRAMA = '\\u094D\\u09CD\\u0A4D\\u0ACD\\u0B4D\\u0BCD\\u0C4D\\u0CCD\\u0D4D';
/** Combining marks and joiners, excluding the viramas (which are matched explicitly). */
const MARKS = `(?:(?![${VIRAMA}])[\\p{M}\\u200C\\u200D])*`;
/**
 * One written letter: a base letter with its marks, plus any virama-joined conjunct parts
 * (क्ष is क + virama + ष — one letter). Requiring the virama is what stops this matching
 * an ordinary two-letter word such as पेड़ or हिंदी.
 */
const NON_LATIN_LETTER = `(?!\\p{Script=Latin})\\p{L}${MARKS}(?:[${VIRAMA}]\\p{L}${MARKS})*`;
/**
 * A run of `{min,max}` **base letters** in a non-Latin script, each carrying any combining
 * marks. Counting base letters — not code points — is what makes this bound mean the same
 * thing as the Latin `{min,max}` beside it: `अंतर्राष्ट्रीयकरण` is 17 code points but 11
 * letters, so it compares against the same limit an 11-character English word would.
 *
 * Requiring `\p{L}` at the start of every repetition also means a run of marks alone cannot
 * match. Combining marks are not Latin-script, so a bare matra passed the script guard, and
 * `[\p{L}\p{M}]{1,16}` then accepted it as a token — including invisible ZWJ/ZWNJ, which
 * would have handed `readCurrentWord` a "word" with no glyphs to synthesize.
 */
const nonLatinRun = (min: number, max: number): string => `(?!\\p{Script=Latin})(?:\\p{L}[\\p{M}\\u200C\\u200D]*){${min},${max}}`;

/** Exactly one letter — an F1 Letter Hunt answer option. Latin: a single `A-Za-z`. */
export const ONE_LETTER = new RegExp(`^(?:[A-Za-z]|${NON_LATIN_LETTER})$`, 'u');

/** A single word — an F1 "say the word" prompt, an F2 word option. 2-15 letters. */
export const ONE_WORD = new RegExp(`^(?:[A-Za-z]{2,15}|${nonLatinRun(2, 15)})$`, 'u');

/** A short token, letter OR word — the F3 Letter Launcher prompt. 1-10 letters. */
export const SHORT_TOKEN = new RegExp(`^(?:[A-Za-z]{1,10}|${nonLatinRun(1, 10)})$`, 'u');

/**
 * Letters and combining marks, as a class body for building in-page patterns (e.g. the
 * Memory Challenge's "क - ख - ग" sequence, or a letter-density sanity check). Widening
 * from `A-Za-z` to `\p{L}\p{M}` is a superset, so Latin text matches exactly as before
 * and no script guard is needed.
 */
export const LETTER_CLASS = '\\p{L}\\p{M}';

/**
 * Native decimal digits, as a class body for building in-page patterns — the digit counterpart
 * to `LETTER_CLASS`. `\p{Nd}` covers ASCII `0-9` and every script's native decimal-digit block
 * (e.g. Devanagari `०-९`), so English/ASCII behaviour is unchanged (a strict superset of `\d`)
 * while a build that renders native digits in a counter ("१२/१६") is no longer silently
 * unmatched. Any regex built with this MUST carry the `u` flag — `\p{Nd}` is only a Unicode
 * property escape under `u`; without it, the literal characters `p{Nd}` would be matched instead.
 *
 * NOTE: matching the digit RUN is only half of what a native script needs — code that then
 * parses the matched text as a number (`parseInt`, unary `+`) still only understands ASCII
 * digits. Untested whether any build actually renders native digits at all (unconfirmed as of
 * 2026-08-18); if one does, the numeric-parsing side needs its own fix, not assumed to follow
 * automatically from this class existing.
 */
export const DIGIT_CLASS = '\\p{Nd}';

// ============================================
// Prompt-audio path
// ============================================

/**
 * The app's letter/word prompt audio, e.g. `/audio/english/letter/A.wav`, capturing the token.
 *
 * One home for this pattern because it is read in four places (two in-page hooks, one network
 * listener, one blob-recovery hook) and it gates the ENTIRE answer chain for F1/F2/F3: if the
 * token cannot be recovered, `readSpokenLetter` / `readSpokenViaSpeaker` / `launcherState`
 * return nothing and the solvers fall into their give-up paths, answering nothing at all.
 *
 * `[^/]+` rather than `[A-Za-z]+`: the old class silently failed on any non-Latin filename,
 * and because failure is silent it would look like a stalled game rather than a bug. `[^/]+`
 * is a strict superset for Latin paths — it cannot cross a path separator, and the `\.wav`
 * suffix stops it running away — so English behaviour is unchanged.
 *
 * NOTE (unverified): whether a Hindi build actually serves Devanagari filenames, percent-
 * encoded ones, or transliterated ASCII has NOT been observed on a real build. This widening
 * plus `decodeAudioToken` covers the first two; if the real build transliterates, the token
 * will need mapping instead. Confirm before trusting a Hindi run (REFACTORING_PLAN.md task 13).
 */
export const LETTER_AUDIO_RE = /\/letter\/([^/]+)\.wav/i;

/** `LETTER_AUDIO_RE` as a source string, for rebuilding inside `page.evaluate`. */
export const LETTER_AUDIO_RE_SOURCE = LETTER_AUDIO_RE.source;

/**
 * Turn a token captured from an audio path into the form used for comparison.
 *
 * Percent-decoded (a non-ASCII filename may arrive either raw or encoded depending on how the
 * URL was built), NFC-composed (so a decomposed spelling matches a precomposed one under
 * `===`), then upper-cased. `toUpperCase()` is a no-op for Devanagari but is what the existing
 * Latin comparisons use, so it is kept for both rather than branching on script.
 *
 * Decoding is guarded: `decodeURIComponent` throws on a malformed sequence (a stray `%`), and
 * a throw inside an audio hook would break playback recovery entirely.
 */
export function decodeAudioToken(raw: string): string {
    let s = raw || '';
    try { s = decodeURIComponent(s); } catch { /* keep the raw form */ }
    return s.normalize('NFC').toUpperCase();
}
