import { test } from '../../fixtures/appTest';
import { FoundationPage } from '../../pages/foundation';
import { resumeParkedAccount } from '../../utils/sessionResume';

/**
 * THROWAWAY observation probe — Nepali F3 screens (EL-28 follow-up). Not part of any suite.
 *
 * WHY THIS EXISTS: F3's remaining unobserved Nepali strings (memoryChallenge, checkSequence,
 * progressLabel, timeUp, lettersOfCount) live on screens that are only reachable by PLAYING
 * through the earlier F3 games. Foundation levels advance permanently, so every run that drives
 * F3 consumes the parked `Testf3auto` account — an account SHARED with English (both
 * `testdata/english/accounts.json` and `testdata/nepali/accounts.json` name it).
 *
 * A harvest that grabs one string per run therefore costs one account reset per string. This
 * probe exists to make ONE consumption yield EVERY screen: it polls the page text while
 * `completeF3()` drives, de-duplicates, and prints each distinct screen at the end. Read the
 * strings out of that dump, patch them all in one go, and only then run the real spec.
 *
 * It asserts NOTHING. It is expected to end in a throw from completeF3 once it hits a screen
 * whose Nepali copy is still a sentinel — that is the point, and the dump above it is the value.
 *
 * Delete once Nepali F3 copy is observed and committed.
 */
test.describe('@Throwaway Nepali F3 screen observation probe', () => {
    test('observe every F3 screen in one account consumption', async ({ page, accounts, lang }) => {
        test.setTimeout(50 * 60 * 1000);

        const foundation = new FoundationPage(page, lang);
        const seen = new Map<string, string>();   // normalised → first raw text seen

        // Read the page the same way the production locators do (FoundationPage.trainProgress /
        // pageTextHead both use document.body.innerText), so whatever this captures is exactly
        // what the real matchers would have been matching against.
        const capture = async (): Promise<void> => {
            const raw = await page.evaluate(() => document.body.innerText).catch(() => '');
            if (!raw || !raw.trim()) return;
            // Collapse whitespace and strip the digits that change every frame (counters,
            // fuel, timers) so one screen is not recorded dozens of times as it ticks.
            const key = raw.replace(/\s+/g, ' ').replace(/\d+/g, '#').trim();
            if (!seen.has(key)) seen.set(key, raw.replace(/\s+/g, ' ').trim());
        };

        let polling = true;
        const poller = (async () => {
            while (polling) {
                await capture();
                await new Promise((r) => setTimeout(r, 1200));
            }
        })();

        try {
            await resumeParkedAccount(page, foundation, {
                ...accounts.f3,
                lang,
                micSkip: { preWaitMs: 6000, timeoutMs: 10000, postWaitMs: 4000 },
                beforeSkipCheck: () => foundation.installLetterLauncherHook(),
            });
            await capture();
            await foundation.completeF3();
        } catch (e) {
            console.log(`[probe] completeF3 stopped: ${(e as Error).message.split('\n')[0]}`);
        } finally {
            polling = false;
            await poller;
        }

        console.log(`\n===== NEPALI F3 SCREENS OBSERVED: ${seen.size} =====`);
        let i = 0;
        for (const text of seen.values()) {
            console.log(`\n--- screen ${++i} ---\n${text}`);
        }
        console.log('\n===== END OBSERVED SCREENS =====');
    });
});
