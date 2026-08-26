import { test, expect } from '../../fixtures/appTest';
import { FoundationPage } from '../../pages/foundation';
import { resumeParkedAccount } from '../../utils/sessionResume';

/**
 * Foundation F3 series — TC-021 / TC-022. Single browser session, single login.
 *
 * F3 is a chain of mini-games (not the F1/F2 Letter Train + Hunt):
 *   - "Letter Launcher": a shown letter OR word is matched to a spoken one → press ✓/✗
 *     (P1–P5 letters, P7–P10 words, and the A1 Apply's 3 levels at fuel /100).
 *   - "Memory Challenge": memorize a shown letter/word sequence ("T - D - S" / "me - our
 *     - on"), then click it back on the grid in order and submit via "Check Sequence"
 *     (P6 letters; A2/A3 word rounds).
 * All of this is driven by `FoundationPage.completeF3()`; the letter audio is recovered
 * in-page (see installLetterLauncherHook). F3 is reached via the persistent F3 account
 * (Testf3auto): login → skip mic → select English → the account resumes on its F3 journey
 * ("Start F3"). Completing F3 advances the app to the next-phase ("Words per minute") map.
 *
 * TC-021 = F3 opening through A1; TC-022 = F3 through A3 (full F3). Both are covered by a
 * single completeF3() drive here; they are also exercised end-to-end by the dynamic-user
 * E2E once F1→F2→F3 are chained.
 */
test.describe('@P0 @Foundation F3 series (single session, F3 account)', () => {
    test('TC-021 / TC-022 F3: login → English → complete F3 (P1 → A3)', async ({ page, accounts, lang }) => {
        test.setTimeout(50 * 60 * 1000);

        const foundation = new FoundationPage(page, lang);

        // Where the account came to rest after the resume. Classified once, up front, so the
        // steps below can tell an account-state problem from a code problem.
        let position: 'past' | 'in-game' | 'at-entry';

        await test.step('Login as the F3 account and resume F3 in English', async () => {
            await resumeParkedAccount(page, foundation, {
                ...accounts.f3,
                lang,
                micSkip: { preWaitMs: 6000, timeoutMs: 10000, postWaitMs: 4000 },
                // Must be installed before F3's games preload their audio.
                beforeSkipCheck: () => foundation.installLetterLauncherHook(),
            });
            // PRECONDITION (the F2 spec has had one all along; this one did not). Without it a
            // resume that landed on the wrong screen surfaced later as completeF3 throwing
            // "unrecognised screen", which reads as a bug in the F3 driver rather than in the
            // resume or the account. Attribution is the whole point.
            position = await foundation.expectPositionedForF3();
            console.log(`[TC-022] F3 account position after resume: ${position}`);
        });

        await test.step('TC-021 / TC-022 (F3): drive all games through A3', async () => {
            // The account has been carried past F3. Foundation levels advance PERMANENTLY, so
            // there is nothing left to drive — and there never will be on this account.
            //
            // This used to be an unconditional test.skip(), which is the finding: a skip that
            // can never stop happening reports as "not run" forever while the surrounding docs
            // go on showing this test as covered (BUILD_HISTORY.md (Project Context section) still lists TC-021 as ✅).
            // Nobody has to look at it, so nobody does, and F3 quietly stops being tested.
            //
            // It is now a FAILURE, correctly attributed to account state rather than to code.
            // ALLOW_STALE_F3=1 is a deliberate acknowledgement for a run where that is
            // understood and accepted — it still skips, but the skip is a stated choice with a
            // name, which is exactly what the silent version lacked.
            if (position === 'past') {
                const detail = `The parked F3 account (${accounts.f3.username}) has already `
                    + 'graduated past F3, and Foundation levels do not go backwards, so this spec '
                    + 'cannot exercise F3 on it again — not on this run and not on any future run. '
                    + 'This is ACCOUNT STATE, not a code failure: nothing here is broken, but F3 is '
                    + 'NOT being tested. Fix by re-parking a fresh F3-positioned account as '
                    + 'accounts.f3, or by covering F3 through the dynamic-user E2E '
                    + '(FULL_E2E=1 in foundation-f1.spec.ts), which walks a new user F1→F2→F3.';
                if (process.env.ALLOW_STALE_F3 !== '1') {
                    throw new Error(`F3 coverage has lapsed. ${detail} `
                        + 'Set ALLOW_STALE_F3=1 to acknowledge this and skip instead of failing.');
                }
                console.warn(`[TC-022] ⚠️  F3 NOT TESTED — skipped by ALLOW_STALE_F3=1. ${detail}`);
                test.skip(true, `F3 not tested: account is past F3, acknowledged via ALLOW_STALE_F3=1. ${detail}`);
                return;
            }
            const games = await foundation.completeF3();
            console.log(`[TC-022] F3 games completed: ${games.join(' ')}`);
            // Entered F3 and completed its games (Letter Launchers + Memory Challenges) …
            expect(games, `games: ${games.join(' ')}`).toContain('StartF3');
            expect(games.filter((g) => g === 'LL').length, `games: ${games.join(' ')}`).toBeGreaterThan(0);
            expect(games.filter((g) => g === 'MC').length, `games: ${games.join(' ')}`).toBeGreaterThan(0);
            // … and F3 is complete (the app has advanced to the next-phase map).
            expect(await foundation.isPastF3(), 'expected to have completed F3 (advanced past it)').toBe(true);
        });
    });
});
