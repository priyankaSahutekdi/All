/**
 * Central environment registry — the ONE place application instance URLs live.
 *
 * Add a new instance by adding an entry here; no test/page code changes are needed.
 * Selection precedence (highest first):
 *   1. ENV / TEST_ENV  (e.g. ENV=lab)         ← the normal selector (npm run e2e -- --env=lab)
 *   2. BASE_URL        (explicit URL override) ← ad-hoc / back-compat with .env
 *   3. default: uat
 *
 * Tests must NEVER hardcode a URL — call page.goto('/') (resolved against Playwright's
 * configured baseURL, which comes from resolveEnvironment() below).
 */
export interface AppEnvironment {
    /** short selector key, e.g. 'uat' */
    key: string;
    /** display name shown in the report, e.g. 'UAT' */
    name: string;
    /** origin used as Playwright baseURL (no trailing slash, no /login) */
    baseURL: string;
    /** the human login URL, for docs/logging */
    loginURL: string;
}

export const ENVIRONMENTS: Record<string, AppEnvironment> = {
    uat: { key: 'uat', name: 'UAT', baseURL: 'https://all-uat.theall.ai', loginURL: 'https://all-uat.theall.ai/login' },
    lab: { key: 'lab', name: 'LAB', baseURL: 'https://lab.the-axl.ai', loginURL: 'https://lab.the-axl.ai/login' },
    lab2: { key: 'lab2', name: 'LAB2', baseURL: 'https://lab2.the-axl.ai', loginURL: 'https://lab2.the-axl.ai/login' },
};

export const DEFAULT_ENV_KEY = 'uat';

const norm = (u: string) => u.replace(/\/+$/, '');

/** Resolve the active environment from ENV / TEST_ENV / BASE_URL (see precedence above). */
export function resolveEnvironment(): AppEnvironment {
    const explicit = (process.env.ENV || process.env.TEST_ENV || '').toLowerCase().trim();
    if (explicit) {
        if (ENVIRONMENTS[explicit]) return ENVIRONMENTS[explicit];
        // eslint-disable-next-line no-console
        console.warn(`[environments] Unknown env "${explicit}"; known: ${Object.keys(ENVIRONMENTS).join(', ')}. Falling back.`);
    }
    if (process.env.BASE_URL) {
        const match = Object.values(ENVIRONMENTS).find((e) => norm(e.baseURL) === norm(process.env.BASE_URL!));
        return match || { key: 'custom', name: 'CUSTOM', baseURL: norm(process.env.BASE_URL), loginURL: `${norm(process.env.BASE_URL)}/login` };
    }
    return ENVIRONMENTS[DEFAULT_ENV_KEY];
}
