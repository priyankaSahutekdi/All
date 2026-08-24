import { test, expect } from '../../fixtures/appTest';
import { FoundationPage } from '../../pages/foundation/FoundationPage';
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

        const foundation = new FoundationPage(page);

        await test.step('Login as the F3 account and resume F3 in English', async () => {
            await resumeParkedAccount(page, foundation, {
                ...accounts.f3,
                lang,
                micSkip: { preWaitMs: 6000, timeoutMs: 10000, postWaitMs: 4000 },
                // Must be installed before F3's games preload their audio.
                beforeSkipCheck: () => foundation.installLetterLauncherHook(),
            });
        });

        await test.step('TC-021 / TC-022 (F3): drive all games through A3', async () => {
            // If the account has already been carried past F3 (it advances permanently once
            // completed), there is nothing left to drive — skip rather than fail. A fresh
            // F3-positioned account (or the dynamic-user E2E) exercises the full drive.
            if (await foundation.isPastF3()) {
                test.skip(true, 'F3 account has already graduated past F3 (F3 verified via the completeF3 drive; the dynamic-user E2E re-validates it end-to-end).');
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
