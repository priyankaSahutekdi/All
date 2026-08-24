import { test, expect } from '../../fixtures/appTest';
import { FoundationPage } from '../../pages/foundation/FoundationPage';
import { MasteryPage } from '../../pages/mastery/MasteryPage';
import { resumeParkedAccount } from '../../utils/sessionResume';

/**
 * Mastery M4 — "Sentence Reading (Simple)". TC-023: complete the practice nodes P1 → P4
 * and land on the S1 assessment entry. Single browser session, single login.
 *
 * M4 is a chain of "Speed Practice" nodes (NOT the F-series Letter Train/Hunt):
 *   - Read Aloud: a sentence is shown with a green mic; record it (the sentence's SAPI-TTS
 *     is injected into the recording via the shared F-series mic hook — no real audio
 *     device needed) then advance via the orange "next".
 *   - Paced Read Aloud: same, but a Slow/Medium/Fast selector + a 3-2-1 countdown / word
 *     ticker precedes the mic (the driver rides the countdown and picks Fast).
 *   - "Did you see the word?": after a word ticker, answer a Yes/No recognition probe.
 * Each node ends with a per-node summary ("Your overall reading speed") and a completion
 * modal ("Hurray!!! … Continue"). All of this is driven by MasteryPage.completeM4Practices().
 *
 * Reached via the dedicated M4 account (m4auto → Guest login → Continue to ALL → English →
 * "Start Level 4"). Post-2026-08 AXL deployment: the app runs in a same-origin iframe (see
 * src/utils/appFrame.ts) and login uses the Guest flow (src/pages/discovery/DiscoveryLoginPage).
 * S1 is a separate, gated speaking assessment (image comprehension) covered by its own
 * test case (TC-024) once a practical, non-audio workaround is in place.
 *
 * NOTE: the M4 account advances permanently (forward-only), so once P1–P4 are complete it
 * resumes at S1; a fresh full P1→P4 drive is re-exercised by the dynamic-user E2E.
 */
test.describe('@P0 @Mastery M4 (single session, M4 account)', () => {
    test('TC-023 M4: login → English → Start Level 4 → complete P1–P4 → reach S1', async ({ page, accounts, lang }) => {
        test.setTimeout(40 * 60 * 1000);

        const foundation = new FoundationPage(page);
        const mastery = new MasteryPage(page);

        await test.step('Login as the M4 account and resume M4 in English', async () => {
            // Dedicated Mastery account parked at M4 (Guest login → Continue to ALL → skip
            // mic → resumes on the Mastery map with "Start Level 4"). Post-2026-08 AXL build.
            await resumeParkedAccount(page, foundation, {
                ...accounts.m4,
                lang,
                micSkip: false,   // m4auto never shows the mic-calibration screen
                beforeSkipCheck: () => mastery.installReadAloudInjection(),
            });
        });

        await test.step('Enter Mastery Level 4', async () => {
            // The Mastery map shows "Start Level 4"; if the account is already inside M4
            // (forward-only), the entry may not be present — that is fine.
            if (await mastery.startLevelButton(4).isVisible({ timeout: 8000 }).catch(() => false)) {
                await mastery.startLevel(4);
            }
        });

        await test.step('TC-023 (M4): complete P1 → P4 and reach the S1 assessment', async () => {
            const log = await mastery.completeM4Practices();
            console.log(`[TC-023] M4 P-node actions: ${log.join(' | ')}`);
            // P1–P4 are complete exactly when the S1 assessment has been reached.
            expect(await mastery.isAtS1(), `expected to reach S1 after P1–P4; actions: ${log.join(' | ')}`).toBe(true);
        });
    });
});
