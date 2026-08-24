import { test as base, expect } from '@playwright/test';
import { appPage } from '../utils/appFrame';

/**
 * Test fixture that transparently makes the `page` iframe-aware for the AXL deployment
 * (the learning app runs inside the same-origin `/all-app/…` iframe). DOM-query methods
 * route to the app iframe when present; page-level operations stay on the real Page; and
 * before login (main frame) everything falls back to the main frame automatically.
 *
 * Discovery / Foundation / Mastery specs import { test, expect } from this module instead
 * of '@playwright/test' — a one-line swap that makes every existing `page` usage (specs and
 * page objects) work against the new iframe with no other changes.
 */
export const test = base.extend({
    page: async ({ page }, use) => {
        await use(appPage(page));
    },
});

export { expect };
