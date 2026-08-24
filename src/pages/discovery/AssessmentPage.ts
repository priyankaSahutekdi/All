import { expect, Page } from '@playwright/test';

/**
 * Page Object for Assessment Page
 * Handles sentence recording, playback, and navigation
 */
export class AssessmentPage {
    private page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    // ============================================
    // LOCATORS
    // ============================================

    // NOTE ON LOCATOR STRATEGY (this app has no data-testid/aria hooks and its
    // emotion css-* hashes change between builds): we prefer TEXT/role/alt selectors
    // everywhere they exist (build-independent), and fall back to the few css classes
    // that have proven stable across builds. The round record/stop toggle has no
    // stable hook at all, so it is driven by viewport-centre coordinates (see
    // DiscoveryModule.recordSentence) against the fixed 1280x720 viewport.

    // Text-labelled buttons (stable across builds)
    startAssessmentButton = () => this.page.getByText('Start Assessment', { exact: true }).first();
    skipDemoButton = () => this.page.getByText('Skip Demo', { exact: true }).first();
    startGameButton = () => this.page.getByText('Start Game', { exact: true }).first();
    confirmButton = () => this.page.getByText('Confirm', { exact: true }).first();
    // "Let's Start" may use a straight OR curly apostrophe (or none) — match any char.
    letsStartButton = () => this.page.getByText(/Let.?s\s*Start/i).first();

    // ---- Recording controls ----
    // Post-record controls keep stable styled-classes across builds (#550..#582):
    //   Play  -> img[alt="Play"]   Retry -> .css-1w4297d   Next -> .css-4g6ai3
    playButton = () => this.page.locator('img[alt="Play"]').first();
    retryButton = () => this.page.locator('div.css-1w4297d, img[alt="Retry"]').first();
    nextButton = () => this.page.locator('div.css-4g6ai3, div.css-1m9gxh8 > div').first();

    // Completion popup "Continue" — real text button when present.
    continueButton = () => this.page.getByText(/^Continue$|जारी रखें/).first();

    // Content — the sentence/word to read renders as a NON-EMPTY level-4 heading
    // (there is also an empty h4 on the page, so we must filter for text).
    sentenceText = () => this.page.getByRole('heading', { level: 4 })
        .filter({ hasText: /\S/ }).first();
    // Completion popup shows a "Hurray" celebration message.
    completionPopup = () => this.page.getByText(/Hurray|successfully completed|completed assessment/i).first();

    // ============================================
    // ACTIONS
    // ============================================

    /**
     * Click Start Assessment button
     */
    async clickStartAssessment(): Promise<void> {
        await this.startAssessmentButton().click({ timeout: 15000, force: true });
    }

    /**
     * Locate the round record/stop toggle's centre coordinates. This control has
     * NO stable text/role/class hook, so we find the single round (~70px) clickable
     * graphic horizontally centred below the sentence. Returns null if not present.
     */
    async recordToggleCenter(): Promise<{ x: number; y: number } | null> {
        return await this.page.evaluate(() => {
            // The toggle is a small, roughly-square, horizontally-centred clickable.
            // Idle = green mic (has <svg>); recording = red circle (often NO svg child).
            // We therefore do NOT require an svg, but keep it round and centred and
            // pick the SMALLEST such element (the button, not its container/waveform).
            let best: { x: number; y: number; w: number } | null = null;
            for (const n of Array.from(document.querySelectorAll('div, button, svg'))) {
                const el = n as HTMLElement;
                const r = el.getBoundingClientRect();
                const cx = r.x + r.width / 2;
                const cy = r.y + r.height / 2;                  // use CENTRE, not top
                if (cx < 590 || cx > 690) continue;             // centre column
                if (cy < 285 || cy > 410) continue;             // mic/stop zone (excludes Next @~426)
                if (r.width < 30 || r.width > 95) continue;     // round button size
                const ratio = r.height / (r.width || 1);
                if (ratio < 0.6 || ratio > 1.5) continue;       // roughly square/round
                if (getComputedStyle(el).cursor !== 'pointer') continue;
                if (!best || r.width < best.w) best = { x: cx, y: cy, w: r.width };
            }
            return best ? { x: best.x, y: best.y } : null;
        });
    }

    /** Click the centred record/stop toggle (coordinate-based; viewport is fixed). */
    async clickRecordToggle(): Promise<void> {
        const c = await this.recordToggleCenter();
        await this.page.mouse.click(c ? c.x : 640, c ? c.y : 380); // fallback: viewport centre
    }

    /**
     * Click Skip Demo button
     */
    async clickSkipDemo(): Promise<void> {
        await this.skipDemoButton().click();
    }

    /**
     * Start assessment flow
     */
    async startAssessment(): Promise<void> {
        await this.clickStartAssessment();
        // Wait for demo to appear and skip it
        await this.page.waitForTimeout(1000);
        const skipDemo = this.skipDemoButton();
        if (await skipDemo.isVisible({ timeout: 3000 }).catch(() => false)) {
            await this.clickSkipDemo();
        }
    }

    // Bounded click timeout so a missing recording-control locator fails fast
    // (~20s) with a clear error instead of hanging for the full test timeout.
    private static readonly CLICK_TIMEOUT = 20000;

    /**
     * Click microphone button to start recording (round centre toggle).
     */
    async clickMike(): Promise<void> {
        await this.clickRecordToggle();
    }

    /**
     * Click stop button to stop recording (same round centre toggle).
     */
    async clickStop(): Promise<void> {
        await this.clickRecordToggle();
    }

    /**
     * Click play button to replay audio
     */
    async clickPlay(): Promise<void> {
        await this.playButton().click({ timeout: AssessmentPage.CLICK_TIMEOUT });
    }

    /**
     * Click retry button to re-record
     */
    async clickRetry(): Promise<void> {
        await this.retryButton().click({ timeout: AssessmentPage.CLICK_TIMEOUT });
    }

    /**
     * Click next button to move to next sentence
     */
    async clickNext(): Promise<void> {
        await this.nextButton().click({ timeout: AssessmentPage.CLICK_TIMEOUT });
    }

    /**
     * Click continue button on completion popup
     */
    async clickContinue(): Promise<void> {
        await this.continueButton().click({ timeout: AssessmentPage.CLICK_TIMEOUT });
    }

    /**
     * Record a sentence (mock recording for automation)
     */
    async recordSentence(): Promise<void> {
        await this.clickMike();
        await this.page.waitForTimeout(2000); // Simulate recording time
        await this.clickStop();
    }

    /**
     * Get displayed sentence text
     */
    async getSentenceText(): Promise<string> {
        return (await this.sentenceText().textContent()) || '';
    }

    /**
     * Complete all sentences in an assessment
     */
    async completeAllSentences(sentenceCount: number = 5): Promise<void> {
        for (let i = 0; i < sentenceCount; i++) {
            await this.recordSentence();
            await this.page.waitForTimeout(1000);
            
            // Click next if not the last sentence
            if (i < sentenceCount - 1) {
                await this.clickNext();
                await this.page.waitForTimeout(1000);
            }
        }
    }

    // ============================================
    // ASSERTIONS
    // ============================================

    /**
     * Expect Start Assessment button to be visible
     */
    async expectStartAssessmentVisible(): Promise<void> {
        await expect(this.startAssessmentButton()).toBeVisible({ timeout: 10000 });
    }

    /**
     * Expect sentence text to be visible AND populated.
     * After "Skip Demo"/"Start Game" the app plays a 3-2-1 countdown before the
     * sentence renders, so we wait for non-whitespace text rather than mere
     * visibility (which would pass during the countdown with an empty container).
     */
    async expectSentenceVisible(): Promise<void> {
        await expect(this.sentenceText()).toBeVisible({ timeout: 20000 });
        await expect(this.sentenceText()).toHaveText(/\S/, { timeout: 20000 });
    }

    /**
     * Expect microphone button to be present (the centred round toggle).
     */
    async expectMikeButtonVisible(): Promise<void> {
        await expect.poll(async () => (await this.recordToggleCenter()) !== null, {
            timeout: 15000,
            message: 'record/stop toggle not found in centre of assessment card',
        }).toBe(true);
    }

    /**
     * Expect play button to be visible
     */
    async expectPlayButtonVisible(): Promise<void> {
        await expect(this.playButton()).toBeVisible();
    }

    /**
     * Expect retry button to be visible
     */
    async expectRetryButtonVisible(): Promise<void> {
        await expect(this.retryButton()).toBeVisible();
    }

    /**
     * Expect next button to be visible
     */
    async expectNextButtonVisible(): Promise<void> {
        await expect(this.nextButton()).toBeVisible();
    }

    /**
     * Expect completion popup to be visible
     */
    async expectCompletionPopupVisible(): Promise<void> {
        await expect(this.completionPopup()).toBeVisible({ timeout: 10000 });
    }

    /**
     * Expect continue button to be visible
     */
    async expectContinueButtonVisible(): Promise<void> {
        await expect(this.continueButton()).toBeVisible();
    }
}
