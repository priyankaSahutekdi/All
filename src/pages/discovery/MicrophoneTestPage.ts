import { expect, Page } from '@playwright/test';

/**
 * Page Object for Microphone Test Page
 * Appears after successful login
 */
export class MicrophoneTestPage {
    private page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    // ============================================
    // LOCATORS
    // ============================================

    welcomeText = () => this.page.locator('text=/Hi!.*Listen to the audio and repeat it!|Now repeat what you heard/i');
    skipButton = () => this.page.getByRole('button', { name: /^Skip$/i });
    microphoneIcon = () => this.page.locator('[class*="mic"], [data-testid*="mic"]');
    audioPlayer = () => this.page.locator('audio, [class*="audio"]');

    // ============================================
    // ACTIONS
    // ============================================

    /**
     * Click skip button
     */
    async clickSkip(): Promise<void> {
        await this.skipButton().click();
    }

    /**
     * Wait for microphone test page to load.
     *
     * `domcontentloaded`, not `networkidle`: this app polls its backend continuously, so
     * "no network activity for 500ms" may never arrive, and waiting for it is a flake waiting to
     * happen (playwright/no-networkidle flags exactly this). Waiting for the Skip control is the
     * meaningful signal that the screen is usable.
     *
     * NOTE: this whole class still has ZERO call sites — its fate is HINDI_READINESS_PLAN.md P3-8
     * (delete it, or wire it in and de-hardcode its 'Skip'). This change makes `npm run lint` green
     * so it can gate CI; it does not pre-empt that decision.
     */
    async waitForPageLoad(): Promise<void> {
        await this.page.waitForLoadState('domcontentloaded');
        await this.skipButton().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    }

    /**
     * Get welcome text
     */
    async getWelcomeText(): Promise<string> {
        return (await this.welcomeText().textContent()) || '';
    }

    // ============================================
    // ASSERTIONS
    // ============================================

    /**
     * Expect welcome text to be visible
     */
    async expectWelcomeTextVisible(): Promise<void> {
        await expect(this.welcomeText()).toBeVisible({ timeout: 10000 });
    }

    /**
     * Expect skip button to be visible
     */
    async expectSkipButtonVisible(): Promise<void> {
        await expect(this.skipButton()).toBeVisible();
    }

    /**
     * Expect to be on microphone test page
     */
    async expectOnMicrophoneTestPage(): Promise<void> {
        await this.expectWelcomeTextVisible();
        await this.expectSkipButtonVisible();
    }
}
