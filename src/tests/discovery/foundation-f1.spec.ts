import { test, expect } from '../../fixtures/appTest';
import { FoundationPage } from '../../pages/foundation';
import type { SolverResult } from '../../pages/foundation/FoundationPage';
import { MasteryPage } from '../../pages/mastery/MasteryPage';
import { runDiscoveryFlow } from '../../utils/DiscoveryFlow';

/**
 * Foundation F1 series — TC-013 → TC-019 — executed in a SINGLE browser session with a SINGLE
 * login (DiscoveryFullFlow.csv / F1 sheet).
 *
 * There is no parked F1 account to resume from (unlike F2/F3's `Testf2auto`/`Testf3auto`), so
 * this spec plays through Discovery first — via the shared `runDiscoveryFlow` helper, the same
 * TC-001..012 steps `discovery.spec.ts` runs — to reach the F1 landing, then drives F1 itself:
 *   TC-013 (F1)     Click "Let's Start" → redirect to the F1 module landing
 *   TC-014..019     L1..L9/P1..P9/A1..A3 Learn → Practice → Apply chain
 */
test.describe('@P0 @Foundation F1 series (single session, single login)', () => {
    test('TC-013 to TC-019: discovery flow then F1', async ({ page, discoveryData, lang }) => {
        test.setTimeout(75 * 60 * 1000); // up to 75 min (Discovery + deep F1 flow: L1–L9/P1–P9 + A1–A3)

        await test.step('Precondition: Discovery flow to the placement/result screen (TC-001..012)', async () => {
            await runDiscoveryFlow(page, lang, discoveryData);
        });

        const foundation = new FoundationPage(page, lang);

        // Every completeXxx() solver below returns a SolverResult instead of throwing on
        // failure, so its outcome must be checked explicitly — discarding it (as every call
        // site here used to) means a solver that gives up with a specific reason (e.g. "the
        // train counter stayed at 1/16 for 8 rounds") gets silently swallowed, and the failure
        // only surfaces later as a generic, unrelated timeout on the next expectOnXxx() assertion.
        const expectSolved = (result: SolverResult, context: string): void => {
            expect(result.completed, `${context}: ${result.reason}`).toBe(true);
        };
        const expectPairSolved = (result: { train: SolverResult; practice: SolverResult }, context: string): void => {
            expectSolved(result.train, `${context} (train)`);
            expectSolved(result.practice, `${context} (practice)`);
        };

        await test.step('TC-013 (F1): Click "Let\'s Start" → redirect to F1 module landing', async () => {
            await foundation.clickLetsStart();
            // Validate the F1 module landing (learning-journey map with "Start F1").
            await foundation.expectF1Landing();
        });

        await test.step('TC-014 (F1): Complete L1 Letter Train → land on P1', async () => {
            await foundation.clickStartF1();
            // L1 = Letter Train: learn arrows then "say the word" mic, 16 steps.
            expectSolved(await foundation.completeLetterTrain(), 'L1 Letter Train');
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
            expectSolved(await foundation.completeLetterHuntPractice(), 'P1 Letter Hunt');
            await foundation.expectOnLetterTrain();            // P1 passed → L2 Letter Train
        });

        await test.step('TC-016 (F1): Complete L2 Letter Train → P2 → land on L3', async () => {
            expectSolved(await foundation.completeLetterTrain(), 'L2 Letter Train');            // L2 train → P2
            expectSolved(await foundation.completeLetterHuntPractice(), 'P2 Letter Hunt');       // P2 Letter Hunt (handles demo)
            await foundation.expectOnLetterTrain();            // P2 passed → L3
        });

        await test.step('TC-017 (F1): Complete L3 Letter Train + P3 Letter Hunt → navigate to A1 (Apply)', async () => {
            expectSolved(await foundation.completeLetterTrain(), 'L3 Letter Train');             // L3 Letter Train → P3
            expectSolved(await foundation.completeLetterHuntPractice(), 'P3 Letter Hunt');        // P3 Letter Hunt → A1 entry
            // Reaching A1 (Apply 1) shows the "Hurray!!! Ready for Challenge?" entry screen.
            await foundation.expectOnApplyChallenge();
        });

        await test.step('TC-018 (F1): Start → complete A1 (Apply) → L4/P4 → L5/P5 → L6/P6 → A2', async () => {
            // A1 Apply Challenge: click Start Game, answer the 3 levels (Letter-Hunt via
            // the play()-hook), clicking through "Next Level"/"Continue" screens → L4.
            expectSolved(await foundation.completeApplyChallenge(), 'A1 Apply');
            await foundation.expectOnLetterTrain();            // A1 complete → L4 Letter Train
            // Three Learn→Practice pairs (L4/P4, L5/P5, L6/P6); validate each transition.
            expectPairSolved(await foundation.completeLearnPracticePair(), 'L4/P4');   // → L5
            await foundation.expectOnLetterTrain();            // on L5
            expectPairSolved(await foundation.completeLearnPracticePair(), 'L5/P5');   // → L6
            await foundation.expectOnLetterTrain();            // on L6
            expectPairSolved(await foundation.completeLearnPracticePair(), 'L6/P6');   // → A2
            await foundation.expectOnApplyChallenge();         // P6 complete → A2 (Apply 2) entry
        });

        await test.step('TC-019 (F1): From A2 (Apply) → L7/P7 → L8/P8 → L9/P9 → complete A3 (Apply)', async () => {
            expectSolved(await foundation.completeApplyChallenge(), 'A2 Apply');       // → L7
            await foundation.expectOnLetterTrain();            // on L7
            expectPairSolved(await foundation.completeLearnPracticePair(), 'L7/P7');   // → L8
            await foundation.expectOnLetterTrain();            // on L8
            expectPairSolved(await foundation.completeLearnPracticePair(), 'L8/P8');   // → L9
            await foundation.expectOnLetterTrain();            // on L9
            expectPairSolved(await foundation.completeLearnPracticePair(), 'L9/P9');   // → A3
            await foundation.expectOnApplyChallenge();         // P9 complete → A3 (Apply 3) entry
            expectSolved(await foundation.completeApplyChallenge(), 'A3 Apply');       // complete A3 (final F1 Apply)
            // A3 complete → left the challenge (advanced past A3 → the F2 "Start F2" entry).
            await foundation.expectPastApplyChallenge();
        });

        // =====================================================================
        // OPTIONAL single-user FULL end-to-end continuation (enable with FULL_E2E=1).
        // The SAME fresh guest user created by runDiscoveryFlow continues Foundation F2 → F3 in
        // this ONE browser session — no dedicated parked accounts, no re-login. Off by default
        // so the standard regression baseline (TC-001–019) is byte-for-byte unchanged.
        //
        // Scope note: a single linear user lands in Mastery at **M1** after F3, so Mastery M4
        // (TC-023) is NOT reachable from here (it needs M1–M3 first) and is validated
        // separately via the `m4auto` account. This continuation therefore covers the full
        // FOUNDATION (Discovery → F1 → F2 → F3) with one user.
        // =====================================================================
        if (process.env.FULL_E2E) {
            await test.step('E2E-F2 (TC-020): same user → Start F2 → complete A1 → A2 (→ A3 if present)', async () => {
                await foundation.dismissCoachmarks().catch(() => {});
                await expect(foundation.startFoundationButton()).toBeVisible({ timeout: 20000 });
                const n1 = await foundation.completeFoundationThroughApply(1);        // Start F2 → A1
                console.log(`[E2E-F2] nodes (→A1): ${n1.join(' ')}`);
                // F2's Apply count is a genuine, live-confirmed content difference between
                // languages, not a framework assumption: English has 3 Applies (A1/A2/A3);
                // Hindi has only 2 (A1/A2) — after A2, Hindi's F2 is already done and the
                // account is on the "Start F3" screen (confirmed independently 3 times —
                // docs/HINDI_ROLLOUT_LOG.md EL-15/EL-16/this run). Targeting a 3rd Apply that
                // doesn't exist made the driver wander into unrecognised F3 content instead of
                // stopping cleanly. Add the next language's real count here once confirmed,
                // rather than assuming it matches either existing value.
                const remainingApplies = lang.code === 'hindi' ? 1 : 2;
                const n2 = await foundation.completeFoundationThroughApply(remainingApplies, 2);
                console.log(`[E2E-F2] nodes (${remainingApplies === 1 ? 'A2' : 'A2→A3'}): ${n2.join(' ')}`);
                await foundation.expectFoundationApplyCompleted();                    // F2 done → "Start F3"
            });

            // Escape hatch used ONLY to mint a fresh account parked exactly at the F3 landing
            // (e.g. to replace a stale dedicated Foundation account) — off by default, no effect
            // on the normal FULL_E2E run.
            if (process.env.STOP_AFTER_F2) {
                console.log(`[E2E] STOP_AFTER_F2: user parked at F3 landing.`);
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
