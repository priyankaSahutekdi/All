import { test } from '../../fixtures/appTest';
import { FoundationPage } from '../../pages/foundation';
import { runDiscoveryFlow } from '../../utils/DiscoveryFlow';

/**
 * THROWAWAY observation probe — Nepali Discovery + F1 screens. Not part of any suite.
 *
 * WHY: the remaining unobserved Nepali strings sit on screens spread across the whole flow —
 * `learningJourney`/`languageSkills` on the placement screen (reachable in ~3 min),
 * `readyForChallenge`/`great`/`wellDone`/`nextLevel`/`startLevel` inside F1 gameplay. Harvesting
 * one per run costs a full Discovery replay each time (45+ min), because there is no parked F1
 * account to resume from and Nepali no longer has parked F2/F3 accounts at all (they were
 * removed in P0 — they were English's).
 *
 * So this captures EVERY distinct screen in ONE pass and prints them at the end. Read the
 * strings out of the dump, patch them all together, and only then run the real spec.
 *
 * It asserts NOTHING and swallows every error on purpose: with sentinels in `UiCopyData`, the
 * drive is EXPECTED to throw as soon as it needs a copy key that has not been observed. The
 * throw is the stopping point, not the result — the dump above it is.
 *
 * Delete once Nepali copy is observed and committed.
 */
test.describe('@Throwaway Nepali flow observation probe', () => {
    test('observe every Discovery + F1 screen in one pass', async ({ page, discoveryData, lang }) => {
        test.setTimeout(75 * 60 * 1000);

        const foundation = new FoundationPage(page, lang);
        const seen = new Map<string, string>();

        // Read the page exactly as the production locators do (FoundationPage.trainProgress and
        // pageTextHead both read document.body.innerText), so what this captures is what the real
        // matchers would have been matching against.
        const capture = async (): Promise<void> => {
            const raw = await page.evaluate(() => (document.body?.innerText ?? '')).catch(() => '');
            if (!raw || !raw.trim()) return;
            // Collapse whitespace and mask digits so one screen is not recorded dozens of times
            // as its counters/timers tick.
            const key = raw.replace(/\s+/g, ' ').replace(/\d+/g, '#').trim();
            if (!seen.has(key)) seen.set(key, raw.replace(/\s+/g, ' ').trim());
        };

        let polling = true;
        const poller = (async () => {
            while (polling) {
                await capture();
                await new Promise((r) => setTimeout(r, 1000));
            }
        })();

        const stages: string[] = [];
        try {
            await runDiscoveryFlow(page, lang, discoveryData);
            stages.push('discovery: OK (reached placement screen)');
        } catch (e) {
            stages.push(`discovery: stopped — ${(e as Error).message.split('\n')[0]}`);
        }

        try {
            await foundation.clickLetsStart();
            await foundation.expectF1Landing();
            stages.push('F1 landing: OK');
            await foundation.clickStartF1();
            // completeFoundationThroughApply assumes the intro coach-marks are already gone --
            // true in the real spec only because completeLetterTrain dismisses them first. Called
            // directly it lands on the "वर्णमाला चार्ट" tooltip and reports "screen not
            // recognised after 0 nodes", which reads as a driver bug rather than an ordering one.
            await foundation.dismissCoachmarks();
            // Drive the whole L/P/A chain, not just L1: readyForChallenge lives on the A1 entry
            // screen and great/wellDone/nextLevel only appear during and after Apply, so a probe
            // that stops at the first Letter Train can never see them.
            const nodes = await foundation.completeFoundationThroughApply(3);
            stages.push(`F1 nodes driven: ${nodes.join(' ')}`);
        } catch (e) {
            stages.push(`F1: stopped — ${(e as Error).message.split('\n')[0]}`);
        }

        polling = false;
        await poller;
        await capture();

        console.log('\n===== STAGES =====');
        stages.forEach((s) => console.log(`  ${s}`));
        console.log(`\n===== NEPALI SCREENS OBSERVED: ${seen.size} =====`);
        let i = 0;
        for (const text of seen.values()) {
            console.log(`\n--- screen ${++i} ---\n${text}`);
        }
        console.log('\n===== END OBSERVED SCREENS =====');
    });
});
