import { test as base, expect } from '@playwright/test';
import { appPage } from '../utils/appFrame';
import { resolveLanguage } from '../../config/language';
import { AppLanguage } from '../utils/languages';
import { Accounts, DiscoveryData, loadAccounts, loadDiscoveryData } from '../testdata';

/**
 * Test fixture that transparently makes the `page` iframe-aware for the AXL deployment
 * (the learning app runs inside the same-origin `/all-app/…` iframe). DOM-query methods
 * route to the app iframe when present; page-level operations stay on the real Page; and
 * before login (main frame) everything falls back to the main frame automatically.
 *
 * Discovery / Foundation / Mastery specs import { test, expect } from this module instead
 * of '@playwright/test' — a one-line swap that makes every existing `page` usage (specs and
 * page objects) work against the new iframe with no other changes.
 *
 * It also carries the run's LANGUAGE and the test data for it:
 *
 *   • `lang`   — the resolved AppLanguage (config/language.ts, TEST_LANG, default english).
 *                Declared as an option so a spec or project can override it with
 *                `test.use({ lang: languageByCode('hindi') })`.
 *   • `accounts` / `discoveryData` — that language's data, loaded at RUNTIME. Specs must not
 *                static-import `testdata/<lang>/…`, because a static import bakes the
 *                language in and no env var can redirect it.
 */
interface AppFixtures {
    lang: AppLanguage;
    accounts: Accounts;
    discoveryData: DiscoveryData;
}

export const test = base.extend<AppFixtures>({
    page: async ({ page }, use) => {
        await use(appPage(page));
    },

    // `option: true` so it is overridable per-spec/per-project; the default comes from the
    // one place that owns language selection.
    lang: [resolveLanguage(), { option: true }],

    accounts: async ({ lang }, use) => {
        await use(loadAccounts(lang));
    },

    discoveryData: async ({ lang }, use) => {
        await use(loadDiscoveryData(lang));
    },
});

export { expect };
