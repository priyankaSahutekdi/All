import { expect, Page } from '@playwright/test';
import { AppLanguage, languageByCode } from '../../utils/languages';
import { copy, copyRe } from '../../utils/uiCopy';
import { TRANSITION_KEYS } from '../../utils/transitions';

/**
 * Every on-screen string this page object matches, resolved for one language.
 *
 * Exported so the English-equivalence check can compare each pattern against the inline literal
 * it replaced. See `foundationPatterns` in FoundationPage.ts for the same shape and the reasons
 * behind it (built once, throws on a missing translation rather than falling back to English).
 */
export function assessmentPatterns(lang: AppLanguage) {
    const K = TRANSITION_KEYS;
    return {
        /**
         * The completion popup's celebration message. `successfully completed` /
         * `completed assessment` are the popup's own phrases, deliberately narrower than
         * FoundationPage's `successfully` / `complete` stems.
         */
        completionPopup: copyRe(['hurray', 'successfullyCompleted', 'completedAssessment'], lang),
        letsStart: copyRe('letsStart', lang, { apostrophe: 'any', space: 'flexible' }),
        /**
         * Anchored and CASE-SENSITIVE (`flags: ''`), reproducing the inline
         * `/^Continue$|जारी रखें/` for English exactly.
         *
         * That literal also matched the Hindi wording during an ENGLISH run, which this
         * deliberately no longer does — matching another language's text is the false positive
         * the LANG axis exists to prevent, and it would make a mis-switched run look healthy.
         * The Hindi wording is not lost: it is now `continueLabel.hindi` in the registry, so a
         * Hindi run gets it and an English run does not.
         */
        continueExact: copyRe(K.continue, lang, { exact: true, flags: '' }),

        /** Plain labels, for the `getByText(exact)` call sites. */
        labels: {
            startAssessment: copy('startAssessment', lang)[0],
            skipDemo: copy(K.skipDemo, lang)[0],
            startGame: copy(K.startGame, lang)[0],
            confirm: copy('confirm', lang)[0],
        },
    };
}

/**
 * Page Object for Assessment Page
 * Handles sentence recording, playback, and navigation
 */
export class AssessmentPage {
    private page: Page;
    /** Every on-screen string this page matches, resolved for the run's language. */
    private readonly copy: ReturnType<typeof assessmentPatterns>;

    /** `lang` defaults to English so any call site not yet carrying the LANG axis still works. */
    constructor(page: Page, lang: AppLanguage = languageByCode('english')) {
        this.page = page;
        this.copy = assessmentPatterns(lang);
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

    // Text-labelled buttons (stable across builds). The labels come from the uiCopy registry,
    // so they follow the run's language instead of being English-only.
    startAssessmentButton = () => this.page.getByText(this.copy.labels.startAssessment, { exact: true }).first();
    skipDemoButton = () => this.page.getByText(this.copy.labels.skipDemo, { exact: true }).first();
    startGameButton = () => this.page.getByText(this.copy.labels.startGame, { exact: true }).first();
    confirmButton = () => this.page.getByText(this.copy.labels.confirm, { exact: true }).first();
    // "Let's Start" may use a straight OR curly apostrophe (or none) — match any char.
    letsStartButton = () => this.page.getByText(this.copy.letsStart).first();

    // ---- Recording controls ----
    // Post-record controls keep stable styled-classes across builds (#550..#582):
    //   Play  -> img[alt="Play"]   Retry -> .css-1w4297d   Next -> .css-4g6ai3
    playButton = () => this.page.locator('img[alt="Play"]').first();
    retryButton = () => this.page.locator('div.css-1w4297d, img[alt="Retry"]').first();
    nextButton = () => this.page.locator('div.css-4g6ai3, div.css-1m9gxh8 > div').first();

    // Completion popup "Continue" — real text button when present.
    continueButton = () => this.page.getByText(this.copy.continueExact).first();

    // Content — the sentence/word to read renders as a NON-EMPTY level-4 heading
    // (there is also an empty h4 on the page, so we must filter for text).
    sentenceText = () => this.page.getByRole('heading', { level: 4 })
        .filter({ hasText: /\S/ }).first();
    // Completion popup shows a "Hurray" celebration message.
    completionPopup = () => this.page.getByText(this.copy.completionPopup).first();

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

    // ---- Playback verification ----------------------------------------------
    // "The Play button is still visible after clicking it" is true whether or not anything
    // played, so a replay test built on that proves nothing. These two methods let a spec
    // assert that audio actually STARTED.
    //
    // BOTH playback mechanisms are hooked because which one this app uses for replay has not
    // been confirmed: an <audio>/<video> element (HTMLMediaElement.play) or Web Audio
    // (AudioBufferSourceNode.start, which is what FoundationPage's own mic injection uses).
    // Hooking only one would make the assertion depend on an unverified assumption, and would
    // fail for the wrong reason if the app used the other.

    /** Install the playback probe. Must be called BEFORE the click that starts playback. */
    async installPlaybackProbe(): Promise<void> {
        await this.page.evaluate(() => {
            const w = window as unknown as { __playbackProbe?: { mediaPlays: number; webAudioStarts: number; maxTime: number } };
            if (w.__playbackProbe) {
                w.__playbackProbe.mediaPlays = 0;
                w.__playbackProbe.webAudioStarts = 0;
                w.__playbackProbe.maxTime = 0;
                return;
            }
            const probe = { mediaPlays: 0, webAudioStarts: 0, maxTime: 0 };
            w.__playbackProbe = probe;

            const origPlay = HTMLMediaElement.prototype.play;
            HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
                probe.mediaPlays++;
                // currentTime advancing is what separates "play() was called" from "audio ran".
                this.addEventListener('timeupdate', () => {
                    if (this.currentTime > probe.maxTime) probe.maxTime = this.currentTime;
                });
                return origPlay.apply(this, arguments as unknown as []);
            };

            const BufferSource = (window as unknown as { AudioBufferSourceNode?: { prototype: { start: unknown } } }).AudioBufferSourceNode;
            if (BufferSource) {
                const proto = BufferSource.prototype as { start: (...a: unknown[]) => unknown };
                const origStart = proto.start;
                proto.start = function (this: unknown, ...args: unknown[]) {
                    probe.webAudioStarts++;
                    return origStart.apply(this, args);
                };
            }
        });
    }

    /** What the probe has observed since `installPlaybackProbe`. */
    async playbackObserved(): Promise<{ mediaPlays: number; webAudioStarts: number; maxTime: number }> {
        return await this.page.evaluate(() => {
            const w = window as unknown as { __playbackProbe?: { mediaPlays: number; webAudioStarts: number; maxTime: number } };
            return w.__playbackProbe || { mediaPlays: 0, webAudioStarts: 0, maxTime: 0 };
        });
    }

    /**
     * Expect audio playback to have started by either mechanism.
     *
     * The failure message names both candidate causes on purpose: a genuine no-op replay
     * button, and a third playback mechanism this probe does not hook. Those are the only two
     * explanations for a failure here, and a reader of the log should not have to guess which.
     */
    async expectPlaybackStarted(): Promise<void> {
        await expect.poll(async () => {
            const o = await this.playbackObserved();
            return o.mediaPlays + o.webAudioStarts;
        }, {
            timeout: 10000,
            message: 'expected replay to start audio playback, but neither HTMLMediaElement.play() '
                + 'nor AudioBufferSourceNode.start() fired. Either the Play button is a no-op, or '
                + 'this build replays audio by a mechanism the probe does not hook '
                + '(see AssessmentPage.installPlaybackProbe)',
        }).toBeGreaterThan(0);
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
