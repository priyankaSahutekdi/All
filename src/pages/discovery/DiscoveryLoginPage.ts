import { expect, Page } from '@playwright/test';
import { AppLanguage, languageByCode } from '../../utils/languages';
import { copyRe, lazyProp } from '../../utils/UiCopy';
import { findTabByTextClosure } from '../../utils/GeometryLocator';

/**
 * Page Object for the AXL login page (post-2026-08 deployment).
 * URL: https://all-uat.theall.ai  (redirects to /login)
 *
 * New login flow:
 *   1. Launch the app → the AXL login page.
 *   2. Dismiss the "App Ready … Got it!" PWA modal if present.
 *   3. Click the "Guest" tab.
 *   4. Enter User ID and Password (guest fields).
 *   5. Select the Grade from the Grade dropdown (default "2" / Grade 2, from env GRADE).
 *   6. Click "Login as Guest" → Home page (/home).
 *   7. On the Home page, click "Continue to ALL" → the ALL Platform (/all), where the
 *      existing journey (mic test, help/learning language, assessments, …) continues.
 *
 * All existing specs call `navigate()` then `login(username, password)`, so they inherit
 * the new flow automatically. Credentials come from each test; the Grade is config-driven.
 */
export class DiscoveryLoginPage {
    private page: Page;
    /**
     * The mic-calibration "Skip" pattern — FIXED ENGLISH, not the run's `lang`.
     *
     * WHERE THE LANGUAGE BOUNDARY IS on this page: everything down to "Continue to ALL" belongs
     * to the AXL PLATFORM SHELL, which is reached before any learning-app language exists — the
     * language switcher lives inside the ALL Platform, i.e. after that button. Those labels are
     * therefore left as literals deliberately, not by omission.
     *
     * `skipMicTestIfPresent` was ONCE THOUGHT to be an exception to that boundary — the comment
     * here used to claim its "Skip" is app copy that follows the run's language, on the theory
     * that the mic-calibration screen is already inside the ALL Platform. **H2a (2026-08-19)
     * disproved that theory live**: on a real `--lang=hindi` run this screen still rendered
     * "Skip" in English (`HINDI_ROLLOUT_LOG.md (Execution Log section)` EL-7) — because the app has not yet been told which
     * language the user wants at this point in the flow (that happens later, at the TC-003
     * learning-language switcher). This is H-1 (`HINDI_ROLLOUT_LOG.md (Decisions Log section)` D-10); `skip` in `uiCopy.ts` is
     * therefore English-only on purpose, and this pattern resolves it in English UNCONDITIONALLY
     * — not in `lang` — regardless of what language the run targets.
     */
    /**
     * Lazy (`lazyProp`, `uiCopy.ts`): resolved on first read, not at construction. Since the
     * source language is now always English (see above), laziness no longer guards against a
     * missing translation — it is kept anyway for consistency with the rest of this codebase's
     * pattern-builders and because it costs nothing.
     */
    private readonly micSkipPattern!: RegExp;

    /** Grade selected during guest login (options 1..8). Config-driven; default "2". */
    static readonly DEFAULT_GRADE = process.env.GRADE || '2';

    /**
     * `lang` is accepted (and passed by every call site) for API consistency with the other page
     * objects on this journey, but is currently unused here: every string this page matches is
     * either fixed AXL-shell English (see `micSkipPattern` above) or plain role/css locators with
     * no language dependency at all. Kept as a parameter, not removed, so a future genuinely
     * language-dependent addition to this page does not need a call-site signature change.
     */
    constructor(page: Page, _lang: AppLanguage = languageByCode('english')) {
        this.page = page;
        lazyProp(this, 'micSkipPattern', () => copyRe('skip', languageByCode('english'), { exact: true }));
    }

    // ============================================
    // LOCATORS
    // ============================================

    // "Got it!" button on the PWA "App Ready" modal (may or may not appear).
    appReadyGotItButton = () => this.page.getByRole('button', { name: /Got it/i }).first();
    // Student / Guest are role="tab" toggle buttons.
    guestTab = () => this.page.getByRole('tab', { name: /^Guest$/i }).first();
    studentTab = () => this.page.getByRole('tab', { name: /^Student$/i }).first();
    // Guest form fields.
    usernameInput = () => this.page.locator('#username-guest, input[placeholder="User ID"]').first();
    passwordInput = () => this.page.locator('#password-guest, input[placeholder="Password"]').first();
    gradeSelect = () => this.page.locator('#grade-guest');
    loginButton = () => this.page.getByRole('button', { name: /Login as Guest/i }).first();
    // Home page → ALL Platform entry (exact text avoids matching "Continue to AML").
    continueToAllButton = () => this.page.getByText('Continue to ALL', { exact: true }).first();
    // The ALL Platform opens on a microphone-calibration screen with a "Skip". This one IS app
    // copy (it is past "Continue to ALL") — see micSkipPattern for where the boundary sits.
    micTestSkip = () => this.page.getByText(this.micSkipPattern).first();
    errorMessage = () => this.page.locator('[class*="error"], [role="alert"]');

    // ============================================
    // ACTIONS
    // ============================================

    /** Navigate to the login page of the CONFIGURED environment (UAT/LAB/LAB2/…).
     *  Uses '/' so Playwright resolves it against `use.baseURL` (see config/environments.ts) —
     *  no URL is hardcoded, so the same test runs against any instance via --env. */
    async navigate(): Promise<void> {
        await this.page.goto('/');
        await this.page.waitForTimeout(3000);
    }

    /** Dismiss the "App Ready … Got it!" PWA modal if it is showing (best-effort). */
    async dismissAppReadyModal(): Promise<void> {
        if (await this.appReadyGotItButton().isVisible({ timeout: 4000 }).catch(() => false)) {
            await this.appReadyGotItButton().click({ timeout: 4000 }).catch(() => {});
            await this.page.waitForTimeout(600);
        }
    }

    /** Switch to the Guest tab. Falls back to a coordinate click (the tab is role="tab",
     *  which some locator strategies miss) and confirms the guest form is shown. */
    async selectGuestTab(): Promise<void> {
        await this.guestTab().click({ timeout: 5000 }).catch(() => {});
        const isVisible = await this.gradeSelect().isVisible({ timeout: 2000 }).catch(() => false);
        if (!isVisible) {
            // fallback: click the tab by its on-screen position
            const box = await this.page.evaluate(findTabByTextClosure('Guest'));
            if (box) { await this.page.mouse.click(box.x, box.y); }
            await this.gradeSelect().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
        }
    }

    /** Select a grade in the Grade dropdown (native <select>, options 1..8). */
    async selectGrade(grade: string): Promise<void> {
        await this.gradeSelect().selectOption(grade).catch(async () => {
            await this.gradeSelect().selectOption({ label: grade }).catch(() => {});
        });
    }

    async enterUsername(username: string): Promise<void> {
        await this.usernameInput().fill(username);
    }

    async enterPassword(password: string): Promise<void> {
        await this.passwordInput().fill(password);
    }

    /** Click "Login as Guest". */
    async clickLogin(): Promise<void> {
        await this.loginButton().click();
    }

    /** On the Home page, enter the ALL Platform via "Continue to ALL". */
    async continueToAll(): Promise<void> {
        await this.page.waitForURL(/\/home/i, { timeout: 30000 }).catch(() => {});
        await this.continueToAllButton().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
        await this.continueToAllButton().click({ timeout: 10000 }).catch(() => {});
        await this.page.waitForURL(/\/all/i, { timeout: 30000 }).catch(() => {});
        await this.page.waitForTimeout(4000); // let the ALL Platform (iframe) load
        await this.skipMicTestIfPresent();
    }

    /**
     * The ALL Platform opens on a microphone-calibration screen ("Now repeat what you
     * heard!") with a "Skip". Skip it (best-effort) so the journey (help/learning language
     * → assessment) resumes. Requires a real pointer click — an in-page click is ignored.
     */
    async skipMicTestIfPresent(): Promise<void> {
        if (await this.micTestSkip().isVisible({ timeout: 6000 }).catch(() => false)) {
            await this.micTestSkip().click({ timeout: 5000 }).catch(() => {});
            await this.page.waitForTimeout(2000);
        }
    }

    /**
     * Perform the complete new login: Guest tab → User ID/Password → Grade → Login as Guest
     * → Continue to ALL. The grade is config-driven (env GRADE, default "2").
     */
    async login(username: string, password: string, grade: string = DiscoveryLoginPage.DEFAULT_GRADE): Promise<void> {
        await this.dismissAppReadyModal();
        await this.selectGuestTab();
        await this.enterUsername(username);
        await this.enterPassword(password);
        await this.selectGrade(grade);
        await this.clickLogin();
        await this.continueToAll();
    }

    // ============================================
    // ASSERTIONS
    // ============================================

    /** Expect to be on the login page. */
    async expectOnLoginPage(): Promise<void> {
        await expect(this.page).toHaveURL(/.*all-uat\.theall\.ai.*/);
    }

    /** Expect the User ID field to be visible (after selecting the Guest tab). */
    async expectUsernameFieldVisible(): Promise<void> {
        await expect(this.usernameInput()).toBeVisible();
    }

    /** Expect the Password field to be visible (after selecting the Guest tab). */
    async expectPasswordFieldVisible(): Promise<void> {
        await expect(this.passwordInput()).toBeVisible();
    }

    /** Expect the "Login as Guest" button to be visible. */
    async expectLoginButtonVisible(): Promise<void> {
        await expect(this.loginButton()).toBeVisible();
    }
}
