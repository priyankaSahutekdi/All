import { test, expect } from '../../fixtures/appTest';
import {
    DiscoveryLoginPage,
    MicrophoneTestPage,
    AssessmentPage,
} from '../../pages/discovery';
import { FoundationPage } from '../../pages/foundation';
import { MasteryPage } from '../../pages/mastery/MasteryPage';
import { DiscoveryHelper } from '../../utils/DiscoveryHelper';

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
        // run. It now arrives via the `discoveryData` fixture (REFACTORING_PLAN.md R5 + R1).
        const DEMO_SENTENCE = discoveryData.demoSentence;

        const loginPage = new DiscoveryLoginPage(page, lang);
        const micPage = new MicrophoneTestPage(page);
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

        const completionVisible = async (): Promise<boolean> =>
            await page.getByText(/Hurray|successfully completed|completed assessment/i)
                .first().isVisible().catch(() => false);

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
            if (await page.getByText('How to Play').first().isVisible().catch(() => false)) return true;
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
                if (await clickByText('Skip Demo', 1500)) {
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
            await expect(page.getByText(/Choose your help language|Start Assessment|Confirm/i).first())
                .toBeVisible({ timeout: 20000 });
        });

        await test.step('TC-002: Choose help language & Confirm', async () => {
            await page.waitForTimeout(2500);
            // Help-language popup: confirm the (pre)selected option.
            const confirmed = await clickByText('Confirm', 10000);
            expect(confirmed, 'help-language Confirm button should be present').toBeTruthy();
            await page.waitForTimeout(2500);
        });

        await test.step('TC-003: Choose learning language English & Confirm', async () => {
            // Open the top-right language dropdown (shows हिंदी / English).
            await page.locator('div.MuiBox-root', { hasText: /^हिंदी$|^English$/ }).last()
                .click({ force: true }).catch(() => {});
            await page.waitForTimeout(2000);
            await clickByText('English', 5000);            // select English in popup
            await page.waitForTimeout(800);
            await clickByText('Confirm', 5000);            // confirm selection
            await page.waitForTimeout(2500);
            // English now active on the assessment landing.
            await expect(page.getByText('Start Assessment', { exact: true }).first())
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
            await assess.clickPlay();
            await page.waitForTimeout(2000);
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
            await clickByText(/^Continue$|जारी रखें/, 8000);
            await page.waitForTimeout(3000);
        });

        await test.step('TC-010: Complete Assessment 2 → Continue', async () => {
            await leaveDemoIfPresent();
            await completeUntilPopup('Assessment 2');
            await expect(assess.completionPopup()).toBeVisible({ timeout: 10000 });
            await clickByText(/^Continue$|जारी रखें/, 8000);
            await page.waitForTimeout(3000);
        });

        await test.step('TC-011: Skip the Letter Hunt demo', async () => {
            // Assessment 3 (Letter Hunt) starts with a demo skipped via "Skip Demo".
            const skipped = await clickByText('Skip Demo', 10000);
            expect(skipped, 'Skip Demo button should be present on Letter Hunt demo').toBeTruthy();
            await page.waitForTimeout(3000);
            // Letter Hunt is a letter-selection game (no sentence). Verify we left the
            // demo and the game is shown (multiple single-letter bubbles present).
            await expect(page.getByText('Skip Demo')).toHaveCount(0);
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

        await test.step('TC-018 (F1): Start → complete A1 (Apply) → L4/P4 → L5/P5 → L6/P6 → A2', async () => {
            // A1 Apply Challenge: click Start Game, answer the 3 levels (Letter-Hunt via
            // the play()-hook), clicking through "Next Level"/"Continue" screens → L4.
            await foundation.completeApplyChallenge();
            await foundation.expectOnLetterTrain();            // A1 complete → L4 Letter Train
            // Three Learn→Practice pairs (L4/P4, L5/P5, L6/P6); validate each transition.
            await foundation.completeLearnPracticePair();      // L4/P4 → L5
            await foundation.expectOnLetterTrain();            // on L5
            await foundation.completeLearnPracticePair();      // L5/P5 → L6
            await foundation.expectOnLetterTrain();            // on L6
            await foundation.completeLearnPracticePair();      // L6/P6 → A2
            await foundation.expectOnApplyChallenge();         // P6 complete → A2 (Apply 2) entry
        });

        await test.step('TC-019 (F1): From A2 (Apply) → L7/P7 → L8/P8 → L9/P9 → complete A3 (Apply)', async () => {
            await foundation.completeApplyChallenge();         // A2 Apply → L7
            await foundation.expectOnLetterTrain();            // on L7
            await foundation.completeLearnPracticePair();      // L7/P7 → L8
            await foundation.expectOnLetterTrain();            // on L8
            await foundation.completeLearnPracticePair();      // L8/P8 → L9
            await foundation.expectOnLetterTrain();            // on L9
            await foundation.completeLearnPracticePair();      // L9/P9 → A3
            await foundation.expectOnApplyChallenge();         // P9 complete → A3 (Apply 3) entry
            await foundation.completeApplyChallenge();         // complete A3 (final F1 Apply)
            // A3 complete → left the challenge (advanced past A3 → the F2 "Start F2" entry).
            await foundation.expectPastApplyChallenge();
        });

        // =====================================================================
        // OPTIONAL single-user FULL end-to-end continuation (enable with FULL_E2E=1).
        // The SAME fresh guest user created above continues Foundation F2 → F3 in this ONE
        // browser session — no dedicated parked accounts, no re-login. Off by default so the
        // standard regression baseline (TC-001–019) is byte-for-byte unchanged.
        //
        // Scope note: a single linear user lands in Mastery at **M1** after F3, so Mastery M4
        // (TC-023) is NOT reachable from here (it needs M1–M3 first) and is validated
        // separately via the `m4auto` account. This continuation therefore covers the full
        // FOUNDATION (Discovery → F1 → F2 → F3) with one user.
        // =====================================================================
        if (process.env.FULL_E2E) {
            await test.step('E2E-F2 (TC-020): same user → Start F2 → complete A1 → A2 → A3', async () => {
                await foundation.dismissCoachmarks().catch(() => {});
                await expect(foundation.startFoundationButton()).toBeVisible({ timeout: 20000 });
                const n1 = await foundation.completeFoundationThroughApply(1);        // Start F2 → A1
                console.log(`[E2E-F2] nodes (→A1): ${n1.join(' ')}`);
                const n2 = await foundation.completeFoundationThroughApply(2, 2);     // A2, then A3
                console.log(`[E2E-F2] nodes (A2→A3): ${n2.join(' ')}`);
                await foundation.expectFoundationApplyCompleted();                    // F2 done → "Start F3"
            });

            // Escape hatch used ONLY to mint a fresh account parked exactly at the F3 landing
            // (e.g. to replace a stale dedicated Foundation account) — off by default, no effect
            // on the normal FULL_E2E run.
            if (process.env.STOP_AFTER_F2) {
                console.log(`[E2E] STOP_AFTER_F2: user "${user.username}" parked at F3 landing.`);
                return;
            }

            await test.step('E2E-F3 (TC-021/022): same user → complete F3 games → past F3', async () => {
                await foundation.installLetterLauncherHook();   // patch audio before F3 games play
                await foundation.dismissCoachmarks().catch(() => {});
                const games = await foundation.completeF3();
                console.log(`[E2E-F3] games: ${games.join(' ')}`);
                expect(await foundation.isPastF3(), 'expected the single user to complete F3').toBe(true);
            });

            await test.step('E2E-M4 (TC-023): same user → Mastery → Start Level 4 → P1–P4 → S1', async () => {
                const mastery = new MasteryPage(page);
                await foundation.dismissCoachmarks().catch(() => {});
                await page.waitForTimeout(3000);
                // Capture the Mastery landing — definitive evidence of which level the single
                // (linear) user lands on, and whether Level 4 is reachable or gated.
                const mapState = await page.evaluate(() => {
                    const t = document.body.innerText.replace(/\s+/g, ' ');
                    const starts = Array.from(t.matchAll(/Start Level \d+/gi)).map((m) => m[0]);
                    return { starts: Array.from(new Set(starts)), head: t.slice(0, 220) };
                });
                console.log(`[E2E-M4] Mastery landing: starts=${JSON.stringify(mapState.starts)} head="${mapState.head}"`);

                const level4Reachable = await mastery.startLevelButton(4).isVisible({ timeout: 8000 }).catch(() => false);
                if (level4Reachable) {
                    // Level 4 is reachable → genuinely drive M4 P1–P4 (TC-023) with this user.
                    await mastery.startLevel(4).catch(() => {});
                    const log = await mastery.completeM4Practices();
                    console.log(`[E2E-M4] P-node actions: ${log.join(' ')}`);
                    expect(await mastery.isAtS1(), 'single user should complete M4 P1–P4 and reach S1 (TC-023)').toBe(true);
                } else {
                    // CONFIRMED (Build #6): Mastery is sequentially gated — a linear user lands at
                    // "Start Level 1", so M4/TC-023 is NOT reachable until M1–M3 are automated.
                    // This is an app-progression constraint, not a defect, so we SKIP (not fail):
                    // the single-user run's achievable scope is the full Foundation (TC-001–022).
                    const reason = `TC-023 (M4) not reachable by a single linear user — Mastery gated at `
                        + `"${mapState.starts[0] || '(no Start Level button)'}"; needs M1–M3 first (or the m4auto account).`;
                    console.log(`[E2E-M4] GATED (documented, not a failure): ${reason}`);
                    test.info().annotations.push({ type: 'TC-023 gated', description: reason });
                }
            });
        }
        // NB: without FULL_E2E, F2/F3/M4 run in their own single-session suites using dedicated
        // accounts parked at each level (e.g. `mastery-m4.spec.ts` with `m4auto`), which resume
        // that level via Guest login.
    });
});
