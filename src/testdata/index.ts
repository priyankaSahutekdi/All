/**
 * Language-aware test-data loader.
 *
 * Test data is per-language (`testdata/english/`, `testdata/hindi/`, …) because the app's
 * words, sentences and parked accounts differ per language. The data therefore CANNOT be
 * reached with a static `import … from '../../testdata/english/accounts.json'`: a static
 * import bakes the language into the module graph, so no env var or fixture can ever redirect
 * it. That is the single reason this loader exists — resolve the path at runtime instead.
 *
 * Callers pass the language they were given (normally the `lang` fixture, which comes from
 * config/language.ts). Nothing here reads env: the selection axis stays in one place.
 */
import * as fs from 'fs';
import * as path from 'path';
import { AppLanguage } from '../utils/languages';

/** One parked/automation account. `series` keys are F/M-series slots, e.g. 'f2', 'm4'. */
export interface TestAccount {
    username: string;
    password: string;
}

export type Accounts = Record<string, TestAccount>;

/** Per-language literals observed on a real build of that language. */
export interface DiscoveryData {
    /** The sentence the Discovery demo screen displays, used to detect that screen. */
    demoSentence: string;
}

const dataDir = (lang: AppLanguage): string => path.join(__dirname, lang.code);

/**
 * Read one JSON data file for a language.
 *
 * Fails with the reason rather than a raw ENOENT/MODULE_NOT_FOUND, because the expected
 * failure here is "this language has not been populated yet" (Hindi is deliberately empty
 * until it has been observed on a real build — see docs/LANGUAGE_ONBOARDING.md (Appendix B)), and that
 * diagnosis should not require reading a stack trace.
 */
function readData<T>(lang: AppLanguage, file: string): T {
    const dir = dataDir(lang);
    const full = path.join(dir, file);
    if (!fs.existsSync(dir)) {
        throw new Error(
            `No test data directory for language '${lang.code}' (expected ${dir}). ` +
            `Create it and populate it from a real ${lang.code} build — do not translate or guess.`,
        );
    }
    if (!fs.existsSync(full)) {
        throw new Error(
            `Test data '${file}' is missing for language '${lang.code}' (expected ${full}). ` +
            `It must be observed on a real ${lang.code} build, not translated — see ` +
            `src/testdata/${lang.code}/README.md if present.`,
        );
    }
    try {
        return JSON.parse(fs.readFileSync(full, 'utf8')) as T;
    } catch (e) {
        throw new Error(`Test data '${full}' is not valid JSON: ${(e as Error).message}`);
    }
}

/** Parked automation accounts for a language. */
export function loadAccounts(lang: AppLanguage): Accounts {
    return readData<Accounts>(lang, 'accounts.json');
}

/** One parked account by series slot, with a clear error if that slot is not defined. */
export function loadAccount(lang: AppLanguage, series: string): TestAccount {
    const all = loadAccounts(lang);
    const found = all[series];
    if (!found) {
        throw new Error(
            `No '${series}' account in testdata/${lang.code}/accounts.json. ` +
            `Defined: ${Object.keys(all).join(', ') || '(none)'}`,
        );
    }
    return found;
}

/** Discovery screen literals for a language. */
export function loadDiscoveryData(lang: AppLanguage): DiscoveryData {
    return readData<DiscoveryData>(lang, 'discovery-data.json');
}
