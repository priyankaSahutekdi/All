/**
 * Which language a run targets — the LANG selection axis.
 *
 * Deliberately separate from `src/utils/languages.ts`, which is the app's language
 * *vocabulary* (what each language is called on screen) and reads no env by design. This file
 * is the other half: it picks ONE language for the current run and is the only place that
 * decides what "no language specified" means.
 *
 * Singular filename on purpose — `language.ts` (the run's language) vs `languages.ts` (all the
 * languages the app offers). Two files both named `languages` would be a permanent
 * wrong-import hazard.
 *
 * Selection precedence (highest first):
 *   1. TEST_LANG   (e.g. TEST_LANG=hindi)      ← the normal selector (npm run e2e -- --lang=hindi)
 *   2. APP_LANG    (alias, for callers that prefer it)
 *   3. default: english
 *
 * NOT named `LANG`: that variable is POSIX-reserved and is usually already set on Linux/CI to
 * something like `en_US.UTF-8`, which would be read as an unknown language on every CI run.
 */
import { AppLanguage, languageByCode, LANGUAGES } from '../src/utils/languages';

export const DEFAULT_LANG_CODE = 'english';

/**
 * Resolve the active language from TEST_LANG / APP_LANG (see precedence above).
 *
 * Note this deliberately does NOT mirror `resolveEnvironment()`'s warn-and-fall-back on an
 * unknown value. Falling back to UAT on a bad env is recoverable — you notice immediately
 * because the URL is wrong. Falling back to English on a bad language code is not: the run
 * goes green while validating a language nobody asked for, which is the exact failure this
 * axis exists to prevent. An explicitly-set unknown language is a hard error; the default
 * applies only when nothing was set at all.
 */
export function resolveLanguage(): AppLanguage {
    const explicit = (process.env.TEST_LANG || process.env.APP_LANG || '').toLowerCase().trim();
    if (!explicit) {return languageByCode(DEFAULT_LANG_CODE);}
    // languageByCode throws with the known-codes list, which is the message we want here.
    return languageByCode(explicit);
}

/** Every selectable language code, for CLI help and validation messages. */
export function knownLanguageCodes(): string[] {
    return LANGUAGES.map((l) => l.code);
}
