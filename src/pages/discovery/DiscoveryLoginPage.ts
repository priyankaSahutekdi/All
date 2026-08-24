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
     * The mic-calibration "Skip" pattern for the run's language.
     *
     * WHERE THE LANGUAGE BOUNDARY IS on this page: everything down to "Continue to ALL" belongs
     * to the AXL PLATFORM SHELL, which is reached before any learning-app language exists — the
     * language switcher lives inside the ALL Platform, i.e. after that button. Those labels are
     * therefore left as literals deliberately, not by omission. Whether the AXL shell localizes
     * at all has NOT been observed on a non-English build (HINDI_READINESS_PLAN.md P2-1b).
     *
     * `skipMicTestIfPresent` is the exception: the mic-calibration screen is already inside the
     * ALL Platform, so its "Skip" is app copy and follows the run's language — the same string
     * `sessionResume` de-hardcoded in P1-9, which reaches this screen by the other path.
     */
    /**
     * Lazy (`lazyProp`, `uiCopy.ts`): resolved on first read, not at construction — so a
     * language missing the 'skip' value doesn't stop this class from being constructed at all,
     * only from calling `skipMicTestIfPresent`/`micTestSkip`.
     */
    private readonly micSkipPattern!: RegExp;

    /** Grade selected during guest login (options 1..8). Config-driven; default "2". */
    static readonly DEFAULT_GRADE = process.env.GRADE || '2';

    constructor(page: Page, lang: AppLanguage = languageByCode('english')) {
        this.page = page;
        lazyProp(this, 'micSkipPattern', () => copyRe('skip', lang, { exact: true }));
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
