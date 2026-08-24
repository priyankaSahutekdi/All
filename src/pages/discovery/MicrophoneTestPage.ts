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
     * Wait for microphone test page to load
     */
    async waitForPageLoad(): Promise<void> {
        await this.page.waitForLoadState('networkidle');
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
