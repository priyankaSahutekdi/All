// THROWAWAY / LOCAL-ONLY diagnostic probe for H12 (F1 A1 Apply Challenge completion, TC-018).
// Copied from discovery-e2e.spec.ts up through TC-017, then replaced TC-018's
// `completeApplyChallenge()` + `expectOnLetterTrain()` pair (which times out — completeApplyChallenge
// itself doesn't throw, so something about its result or the post-Apply screen is the gap) with a
// version that logs the solver's own result and polls raw screen text. DO NOT COMMIT.
import { test, expect } from '../../fixtures/appTest';
// MicrophoneTestPage is deliberately NOT imported: it was constructed here and never used, and
// it has zero call sites anywhere (confirmed in Phase 1). Its fate is HINDI_ROLLOUT_LOG.md (Readiness Plan section)
// P3-8 — deleted or wired in, not left as a variable that implies it does something.
import { DiscoveryLoginPage, AssessmentPage } from '../../pages/discovery';
import { FoundationPage } from '../../pages/foundation';
import { MasteryPage } from '../../pages/mastery/MasteryPage';
import { DiscoveryHelper } from '../../utils/DiscoveryHelper';
import { ANY_LANGUAGE_LABEL_TOKEN, labelRe, languageByCode } from '../../utils/languages';
import { copy, copyAlt, copyRe } from '../../utils/UiCopy';

/**
 * Full end-to-end Discovery + F-series flow — TC-001 → TC-013 — executed in a SINGLE
 * browser session with a SINGLE login (DiscoveryFullFlow.csv / Foundation sheet).
 *   TC-001..TC-011  Discovery onboarding + assessments 1, 2 and Letter Hunt demo skip
 *   TC-012          Fail the Letter Hunt → reach the discovery result/placement screen
 *   TC-013 (F1)     Click "Let's Start" → redirect to the F1 module landing
 *
 * Locator strategy: the app has no data-testid/aria hooks and its css-* hashes drift
 * between builds, so we drive everything by TEXT/role/alt where it exists and by the
 * centred round-toggle coordinates for the record/stop control (see AssessmentPage).
 */

test.describe('@P0 @Smoke @Discovery Discovery + F-series E2E (single session, single login)', () => {
    test('TC-001 to TC-013: discovery flow then F1 entry', async ({ page, discoveryData, lang }) => {
        test.setTimeout(75 * 60 * 1000); // up to 75 min (deep F1 flow: Discovery + L1–L9/P1–P9 + A1–A3)

        // Per-language literal, loaded at runtime from testdata/<lang>/discovery-data.json.
        // Was an inline literal, then a static english/ import — neither could follow a Hindi
        // run. It now arrives via the `discoveryData` fixture (BUILD_HISTORY.md (Refactoring Plan section) R5 + R1).
        const DEMO_SENTENCE = discoveryData.demoSentence;

        const loginPage = new DiscoveryLoginPage(page, lang);
        const assess = new AssessmentPage(page, lang);
        const foundation = new FoundationPage(page, lang);
        const user = DiscoveryHelper.createTestUser();
        console.log(`[E2E] single user: ${user.username} (password == username)`);

        // ---- helpers --------------------------------------------------------
        // NOTE: locator.isVisible() does NOT wait — it samples the current state. To
        // wait for an element we must use waitFor(). clickByText waits up to `timeout`
        // for the text to become visible, then clicks it.
        const clickByText = async (text: string | RegExp, timeout = 6000): Promise<boolean> => {
            const loc = (typeof text === 'string'
                ? page.getByText(text, { exact: true })
                : page.getByText(text)).first();
            try {
                await loc.waitFor({ state: 'visible', timeout });
            } catch {
                return false;
            }
            await loc.click({ force: true }).catch(() => {});
            return true;
        };

        // Screen strings this spec matches directly, resolved for the run's language. They were
        // inline English literals — the same defect P2-1 fixed in the page objects, in the spec
        // that drives them, so Discovery could not have run in Hindi with only the page objects
        // migrated. `continueExact` carries the observed Hindi wording via the registry rather
        // than the inline `/^Continue$|जारी रखें/`, which matched Hindi even in an English run.
        // Lazy (not resolved until first call): these keys are only needed starting TC-009
        // (assessment completion), same principle as `lazyProp` in the page objects (EL-6) — a
        // language missing them can still run TC-001..TC-008 instead of failing at test startup.
        const completionPopupRe = (): RegExp => copyRe(['hurray', 'successfullyCompleted', 'completedAssessment'], lang);
        const continueExact = (): RegExp => copyRe('continueLabel', lang, { exact: true, flags: '' });
        /**
         * TC-002's help-language popup Confirm — FIXED ENGLISH, not `lang`. H2a (2026-08-19)
         * proved live that this screen renders "Confirm" in English regardless of the run's
         * target language (the app has not been told which language the user wants yet at this
         * point in the flow — that happens later, at TC-003). This is H-1 (`HINDI_ROLLOUT_LOG.md (Decisions Log section)` D-10).
         * Do not confuse with TC-003's OWN Confirm button below, which correctly follows `lang`.
         */
        const confirmLabel = copy('confirm', languageByCode('english'))[0];
        const skipDemoLabel = copy('skipDemo', lang)[0];
        const howToPlayLabel = copy('howToPlay', lang)[0];
        /**
         * Any of the screens login can legitimately land on (help-language modal, or past it).
         * `chooseHelpLanguage`/`confirm` are the TC-002 help-language popup — FIXED ENGLISH, same
         * H-1 reasoning as `confirmLabel` above. `startAssessment` is the screen reached once
         * TC-002 is already dismissed, which correctly follows `lang` (H2a confirmed it renders
         * in Hindi on a Hindi run, e.g. "असेसमेंट शुरू करें").
         */
        const postLoginLanding = new RegExp(
            `${copyAlt(['chooseHelpLanguage', 'confirm'], languageByCode('english'))}|${copyAlt('startAssessment', lang)}`,
            'i',
        );

        const completionVisible = async (): Promise<boolean> =>
            await page.getByText(completionPopupRe()).first().isVisible().catch(() => false);

        // Letter Hunt bubbles: the letters are baked into SVGs (no DOM text), so we
        // detect bubbles by SHAPE — small, roughly-circular, clickable elements in the
        // game area. Deduped by position. (We cannot know which letter is which without
        // OCR/audio, but as a discovery assessment, tapping bubbles advances it.)
        const getLetterBubbles = async (): Promise<{ x: number; y: number }[]> =>
            await page.evaluate(() => {
                const seen = new Set<string>();
                const out: { x: number; y: number }[] = [];
                for (const el of Array.from(document.querySelectorAll('div, svg, button, img'))) {
                    const r = (el as HTMLElement).getBoundingClientRect();
                    if (r.y < 110 || r.y > 365) continue;           // bubble zone (above the audio button)
                    if (r.width < 30 || r.width > 80) continue;     // bubble size
                    const ratio = r.height / (r.width || 1);
                    if (ratio < 0.7 || ratio > 1.4) continue;       // circular
                    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
                    const key = `${Math.round(cx / 16)},${Math.round(cy / 16)}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    out.push({ x: cx, y: cy });
                }
                return out;
            });

        // Record one item: mic -> (record) -> stop -> replay. Returns the item text.
        const recordCurrentItem = async (replay = true): Promise<string> => {
            const itemText = (await assess.getSentenceText().catch(() => '')) || '';
            await assess.clickMike();                      // start recording
            await page.waitForTimeout(2500);               // read aloud window
            await assess.clickStop();                      // stop recording
            await page.waitForTimeout(1500);
            if (replay && await assess.playButton().isVisible({ timeout: 4000 }).catch(() => false)) {
                await assess.clickPlay().catch(() => {});
                await page.waitForTimeout(1500);
            }
            return itemText;
        };

        // The demo screen always shows the fixed demo sentence "The cat is sleeping."
        // (build-independent signal) plus "How to Play" / Start Game / Skip Demo.
        const onDemo = async (): Promise<boolean> => {
            const txt = (await assess.getSentenceText().catch(() => '')) || '';
            if (txt.includes(DEMO_SENTENCE)) return true;
            if (await page.getByText(howToPlayLabel).first().isVisible().catch(() => false)) return true;
            return await assess.startGameButton().isVisible().catch(() => false);
        };

        // Leave the demo and confirm a REAL (non-demo) sentence is shown. The demo is
        // a guided tutorial: depending on build it leaves via "Start Game", via
        // "Skip Demo", or only after recording the demo sentence once. Poll all three.
        const leaveDemoIfPresent = async (): Promise<void> => {
            await page.waitForTimeout(2500); // let the demo render after navigation
            for (let i = 0; i < 8; i++) {
                const txt = (await assess.getSentenceText().catch(() => '')) || '';
                if (txt.trim() && !txt.includes(DEMO_SENTENCE) && !(await onDemo())) return;
                // A) Start Game (actionable click; force as fallback)
                const sg = assess.startGameButton();
                if (await sg.isVisible({ timeout: 1500 }).catch(() => false)) {
                    await sg.click({ timeout: 5000 }).catch(async () => { await sg.click({ force: true }).catch(() => {}); });
                    console.log(`demo[${i}]: clicked Start Game`);
                    await page.waitForTimeout(6000); // 3-2-1 countdown
                    continue;
                }
                // B) record the demo sentence once (tutorial may gate on this)
                await assess.clickMike().catch(() => {});
                await page.waitForTimeout(2500);
                await assess.clickStop().catch(() => {});
                await page.waitForTimeout(1500);
                // C) Skip Demo
                if (await clickByText(skipDemoLabel, 1500)) {
                    console.log(`demo[${i}]: clicked Skip Demo`);
                    await page.waitForTimeout(5000);
                }
            }
        };

        // Dynamic loop: record/replay/next until a completion popup appears.
        const completeUntilPopup = async (label: string, maxItems = 20): Promise<void> => {
            for (let i = 0; i < maxItems; i++) {
                if (await completionVisible()) {
                    console.log(`[${label}] completion popup after ${i} items`);
                    return;
                }
                await assess.expectSentenceVisible();
                const txt = await recordCurrentItem(true);
                console.log(`[${label}] item ${i + 1}: "${txt}"`);
                if (await completionVisible()) return;
                // advance to next item
                await assess.clickNext().catch(() => {});
                await page.waitForTimeout(2500);
            }
            throw new Error(`[${label}] completion popup not reached within ${maxItems} items`);
        };

        // =====================================================================
        await test.step('TC-001: Login with valid credentials & skip mic test', async () => {
            await loginPage.navigate();
            // New AXL login: Guest tab → User ID/Password → Grade 2 → Login as Guest →
            // Continue to ALL → skip the entry mic-calibration. The app then lands on the
            // help-language modal (TC-002). (Post-2026-08 deployment; app runs in an iframe.)
            await loginPage.login(user.username, user.password);
            await expect(page.getByText(postLoginLanding).first())
                .toBeVisible({ timeout: 20000 });
        });

        await test.step('TC-002: Choose help language & Confirm', async () => {
            await page.waitForTimeout(2500);
            // Help-language popup: confirm the (pre)selected option.
            const confirmed = await clickByText(confirmLabel, 10000);
            expect(confirmed, 'help-language Confirm button should be present').toBeTruthy();
            await page.waitForTimeout(2500);
        });

        await test.step(`TC-003: Choose learning language ${lang.label} & Confirm`, async () => {
            // Open the top-right language dropdown. The labels come from the language registry,
            // not the inline /^हिंदी$|^English$/ this used to carry — that literal named the two
            // languages it happened to know about and could not follow the run's language.
            await page.locator('div.MuiBox-root', { hasText: ANY_LANGUAGE_LABEL_TOKEN }).last()
                .click({ force: true }).catch(() => {});
            await page.waitForTimeout(2000);
            // Both clicks are ASSERTED, not discarded. Previously their return values were
            // dropped, so a run where neither control existed still reached the final assert
            // below — and that assert ("Start Assessment" is visible) is true regardless of
            // which language the app is in, which made the whole step a no-op-tolerant pass.
            const picked = await clickByText(labelRe(lang), 5000);
            expect(picked, `the ${lang.label} option should be present in the language dropdown`).toBeTruthy();
            await page.waitForTimeout(800);
            const confirmed = await clickByText(copyRe('confirm', lang, { exact: true }), 5000);
            expect(confirmed, 'learning-language Confirm button should be present').toBeTruthy();
            await page.waitForTimeout(2500);
            // The OUTCOME, which is what this step is actually about: the app is running in the
            // run's language. Asserted via the same header read switchToLanguage verifies with.
            await foundation.expectAppInLanguage(lang);
            // …and the assessment landing is reachable.
            await expect(page.getByText(copy('startAssessment', lang)[0], { exact: true }).first())
                .toBeVisible({ timeout: 15000 });
        });

        await test.step('TC-004: Start assessment & leave demo (sentence shown)', async () => {
            await assess.clickStartAssessment();
            await page.waitForTimeout(3000);
            await leaveDemoIfPresent();
            await assess.expectSentenceVisible();
            const sentence = await assess.getSentenceText();
            expect(sentence.trim().length).toBeGreaterThan(0);
            expect(sentence).not.toContain(DEMO_SENTENCE);
        });

        await test.step('TC-005: Record the sentence', async () => {
            await assess.expectMikeButtonVisible();
            await assess.clickMike();
            await page.waitForTimeout(2500);
            await assess.clickStop();
            await page.waitForTimeout(1500);
            await expect(assess.playButton()).toBeVisible({ timeout: 10000 });
        });

        await test.step('TC-006: Replay the recorded audio', async () => {
            await expect(assess.playButton()).toBeVisible();
            // Probe installed BEFORE the click. This step used to assert only that the Play
            // button was visible before and after clicking it — true whether or not anything
            // played, so a no-op Play button passed. Now the claim is that audio STARTED.
            await assess.installPlaybackProbe();
            await assess.clickPlay();
            await assess.expectPlaybackStarted();
            const observed = await assess.playbackObserved();
            console.log(`[TC-006] playback: mediaPlays=${observed.mediaPlays} `
                + `webAudioStarts=${observed.webAudioStarts} maxTime=${observed.maxTime.toFixed(2)}s`);
            // The control is still available afterwards (replay is repeatable).
            await expect(assess.playButton()).toBeVisible();
        });

        await test.step('TC-007: Re-record via Retry', async () => {
            await expect(assess.retryButton()).toBeVisible({ timeout: 8000 });
            await assess.clickRetry();                 // Retry auto-starts re-recording
            await page.waitForTimeout(2500);           // read the sentence again
            await assess.clickStop();                  // stop the re-recording
            await page.waitForTimeout(1500);
            await expect(assess.playButton()).toBeVisible({ timeout: 10000 });
        });

        await test.step('TC-008: Move to the next sentence', async () => {
            const first = await assess.getSentenceText();
            const nextCount = await assess.nextButton().count();
            console.log(`[TC-008] first="${first}" nextButtonCount=${nextCount}`);
            await assess.clickNext();
            // Poll for the sentence to change (rides post-click transition/countdown).
            let second = first;
            for (let i = 0; i < 8; i++) {
                await page.waitForTimeout(1500);
                second = await assess.getSentenceText();
                if (second.trim() && second !== first) break;
            }
            console.log(`[TC-008] second="${second}"`);
            await page.screenshot({ path: 'test-results/tc008-debug.png' });
            expect(second, 'sentence should change after Next').not.toBe(first);
        });

        await test.step('TC-009: Complete Assessment 1 → Continue', async () => {
            await completeUntilPopup('Assessment 1');
            await expect(assess.completionPopup()).toBeVisible({ timeout: 10000 });
            await clickByText(continueExact(), 8000);
            await page.waitForTimeout(3000);
        });

        await test.step('TC-010: Complete Assessment 2 → Continue', async () => {
            await leaveDemoIfPresent();
            await completeUntilPopup('Assessment 2');
            await expect(assess.completionPopup()).toBeVisible({ timeout: 10000 });
            await clickByText(continueExact(), 8000);
            await page.waitForTimeout(3000);
        });

        await test.step('TC-011: Skip the Letter Hunt demo', async () => {
            // Assessment 3 (Letter Hunt) starts with a demo skipped via "Skip Demo".
            const skipped = await clickByText(skipDemoLabel, 10000);
            expect(skipped, 'Skip Demo button should be present on Letter Hunt demo').toBeTruthy();
            await page.waitForTimeout(3000);
            // Letter Hunt is a letter-selection game (no sentence). Verify we left the
            // demo and the game is shown (multiple single-letter bubbles present).
            await expect(page.getByText(skipDemoLabel)).toHaveCount(0);
            await page.waitForTimeout(2000);
            await page.screenshot({ path: 'test-results/lh-after-skip.png' });
            const bubbles = await getLetterBubbles();
            console.log(`[Letter Hunt] letter bubbles detected: ${bubbles.length}`);
            expect(bubbles.length, 'Letter Hunt should show letter bubbles').toBeGreaterThan(0);
        });

        await test.step('TC-012: Fail Letter Hunt with wrong letters → discovery result screen', async () => {
            // Per the discovery design, FAILING the Letter Hunt (Assessment 3) ends the
            // discovery flow and routes to the placement/result screen. We can't read the
            // SVG letters or hear the audio prompt, so to force WRONG answers we repeatedly
            // tap a SINGLE fixed bubble — it rarely matches the prompt, so lives deplete.
            for (let round = 0; round < 18; round++) {
                if (await foundation.isOnResultScreen()) break;
                const bubbles = await getLetterBubbles();
                if (bubbles.length === 0) { await page.waitForTimeout(1500); continue; }
                await page.mouse.click(bubbles[0].x, bubbles[0].y).catch(() => {}); // same bubble → wrong
                console.log(`[Letter Hunt] wrong-tap ${round + 1}`);
                await page.waitForTimeout(1500);
            }
            // Failing routes to the placement/result screen (/discover-end) which carries
            // the "Let's Start" entry button into the F series (clicked in TC-013).
            await foundation.expectOnResultScreen();
        });

        await test.step('TC-013 (F1): Click "Let\'s Start" → redirect to F1 module landing', async () => {
            await foundation.clickLetsStart();
            // Validate the F1 module landing (learning-journey map with "Start F1").
            await foundation.expectF1Landing();
        });

        await test.step('TC-014 (F1): Complete L1 Letter Train → land on P1', async () => {
            await foundation.clickStartF1();
            // L1 = Letter Train: learn arrows then "say the word" mic, 16 steps.
            await foundation.completeLetterTrain();
            // Completing L1 auto-advances to P1 (Letter Hunt "How to Play" practice).
            await foundation.expectOnPracticeDemo();
        });

        // ---------------------------------------------------------------------
        // TC-015 / TC-016 drive the F1 Letter Hunt PRACTICES (P1, P2). These are
        // audio-gated: the target letter is only spoken (prompt audio at
        // /audio/<lang>/letter/<LETTER>.wav). The solver hooks the media element's
        // play() in-page to read the currently-playing letter — reliable even when the
        // audio is served from cache — then taps the matching option. See
        // FoundationPage.completeLetterHuntPractice.
        // ---------------------------------------------------------------------
        await test.step('TC-015 (F1): Complete P1 Letter Hunt (10 questions) → land on L2', async () => {
            await foundation.completeLetterHuntPractice();
            await foundation.expectOnLetterTrain();            // P1 passed → L2 Letter Train
        });

        await test.step('TC-016 (F1): Complete L2 Letter Train → P2 → land on L3', async () => {
            await foundation.completeLetterTrain();            // L2 train → P2
            await foundation.completeLetterHuntPractice();     // P2 Letter Hunt (handles demo)
            await foundation.expectOnLetterTrain();            // P2 passed → L3
        });

        await test.step('TC-017 (F1): Complete L3 Letter Train + P3 Letter Hunt → navigate to A1 (Apply)', async () => {
            await foundation.completeLetterTrain();            // L3 Letter Train → P3
            await foundation.completeLetterHuntPractice();     // P3 Letter Hunt → A1 entry
            // Reaching A1 (Apply 1) shows the "Hurray!!! Ready for Challenge?" entry screen.
            await foundation.expectOnApplyChallenge();
        });

        await test.step('H12d PROBE: complete A1 Apply Challenge, capture result + raw screen text', async () => {
            const result = await foundation.completeApplyChallenge();
            console.log(`[H12d-PROBE] completeApplyChallenge result: ${JSON.stringify(result)}`);
            const frame = require('../../utils/appFrame').currentAppFrame(page);
            for (let i = 0; i < 15; i++) {
                const text = (await frame.locator('body').innerText().catch(() => '(no frame body)'))
                    .replace(/\s+/g, ' ').trim().slice(0, 300);
                const tp = await foundation.trainProgress();
                console.log(`[H12d-PROBE] t=${i}s trainProgress="${tp}" text="${text}"`);
                if (tp) { console.log('[H12d-PROBE] on a Letter Train now.'); break; }
                await page.screenshot({ path: `test-results/h12d-t${i}.png`, fullPage: false }).catch(() => {});
                await page.waitForTimeout(1000);
            }
        });
    });
});
