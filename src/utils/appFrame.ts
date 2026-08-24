import { Frame, Page } from '@playwright/test';

/**
 * Post-2026-08 (AXL) deployment: after login → "Continue to ALL", the entire learning app
 * renders inside a SAME-ORIGIN, full-viewport iframe (`/all-app/index.html`). All existing
 * page objects and specs query the MAIN frame, so they would find nothing once inside the
 * app.
 *
 * `appPage(page)` returns a lazy Proxy over the Page that transparently routes DOM-query
 * methods (evaluate, locator, getBy*, $, $$, waitForSelector, …) to the app iframe when it
 * is present, while page-level operations (mouse, keyboard, screenshot, waitForTimeout,
 * goto, waitForURL, frames, …) stay on the real Page. Because the iframe is full-viewport
 * at (0,0), coordinate clicks via `page.mouse` land inside it unchanged.
 *
 * The routing is LAZY (resolved per call): before "Continue to ALL" the app frame does not
 * exist yet, so DOM methods fall back to the main frame — which is exactly what the login
 * page needs. This makes the whole suite iframe-aware with only a one-line import swap
 * (use the fixture in `src/fixtures/appTest.ts`).
 */

/** DOM-scanning / locator entry points that must run inside the app frame. */
const FRAME_METHODS = new Set<string>([
    'evaluate', 'evaluateHandle',
    'locator', 'getByRole', 'getByText', 'getByLabel', 'getByPlaceholder', 'getByAltText', 'getByTitle', 'getByTestId',
    'frameLocator', 'waitForSelector', 'waitForFunction',
    '$', '$$', '$eval', '$$eval', 'content', 'title',
]);

/**
 * The app's content frame. The ALL Platform runs in a SINGLE child iframe that navigates
 * internally as the journey progresses (`/all-app/index.html` → `/discover` →
 * `/discover-start` → …), so we select the child frame by structure (the direct,
 * http(s) child of the main frame) rather than by a fixed URL. Falls back to the main
 * frame before the iframe exists (i.e. on the login/home pages).
 */
export function currentAppFrame(page: Page): Frame {
    const main = page.mainFrame();
    const child = page.frames().find((f) => f !== main && f.parentFrame() === main && /^https?:/i.test(f.url()));
    return child || main;
}

/** Wait until the app iframe is attached (call after "Continue to ALL"). */
export async function waitForAppFrame(page: Page, timeout = 30000): Promise<Frame> {
    await page.waitForFunction(
        () => document.querySelectorAll('iframe').length > 0,
        undefined,
        { timeout },
    ).catch(() => { /* fall back to main frame */ });
    return currentAppFrame(page);
}

/** Wrap a Page so DOM-query methods route to the app iframe (lazy), page-level ops to the Page. */
export function appPage(page: Page): Page {
    return new Proxy(page, {
        get(target, prop, receiver) {
            if (typeof prop === 'string' && FRAME_METHODS.has(prop)) {
                const frame = currentAppFrame(target);
                const fn = (frame as unknown as Record<string, unknown>)[prop];
                if (typeof fn === 'function') return (fn as (...a: unknown[]) => unknown).bind(frame);
            }
            const value = Reflect.get(target, prop, receiver);
            return typeof value === 'function' ? value.bind(target) : value;
        },
    }) as Page;
}
