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

/**
 * Parked accounts are MUTABLE SHARED STATE, so two languages must never name the same one.
 *
 * Foundation levels advance PERMANENTLY: driving F3 on `Testf3auto` carries that account past
 * F3 for every language that names it, and it cannot be reused without a manual reset. This is
 * not hypothetical — on 2026-09-01 `testdata/nepali/accounts.json` was created by copying
 * English's, so a Nepali F3 run consumed ENGLISH's parked account (EL-29). The parallel runner
 * drives language lanes concurrently, so the same collision can also corrupt two live runs at
 * once, and it surfaces as unreproducible "flaky app" failures rather than as a fixture bug.
 *
 * Checked here rather than in a test because it must fail for ANY entry point that loads
 * accounts, and it must fail BEFORE a run starts spending an account it does not own.
 */
function assertAccountsNotShared(lang: AppLanguage, mine: Accounts): void {
    const root = __dirname;
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name === lang.code) continue;
        const other = path.join(root, entry.name, 'accounts.json');
        if (!fs.existsSync(other)) continue;
        let theirs: Accounts;
        try { theirs = JSON.parse(fs.readFileSync(other, 'utf8')) as Accounts; } catch { continue; }
        const theirNames = new Set(Object.values(theirs).map((a) => a?.username).filter(Boolean));
        const clashes = Object.entries(mine)
            .filter(([, a]) => a?.username && theirNames.has(a.username))
            .map(([slot, a]) => `${slot}="${a.username}"`);
        if (clashes.length) {
            throw new Error(
                `Parked account collision: testdata/${lang.code}/accounts.json shares ` +
                `${clashes.join(', ')} with testdata/${entry.name}/accounts.json. ` +
                `Parked accounts advance PERMANENTLY, so a '${lang.code}' run would consume ` +
                `'${entry.name}' accounts (and vice versa), and concurrent language lanes would ` +
                `corrupt each other. Give '${lang.code}' its OWN provisioned accounts, or delete ` +
                `testdata/${lang.code}/accounts.json so it uses the dynamic-user path instead ` +
                `(which is what Hindi does).`,
            );
        }
    }
}

/** Parked automation accounts for a language. */
export function loadAccounts(lang: AppLanguage): Accounts {
    const accounts = readData<Accounts>(lang, 'accounts.json');
    assertAccountsNotShared(lang, accounts);
    return accounts;
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
