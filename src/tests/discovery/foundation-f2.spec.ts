import { test, expect } from '../../fixtures/appTest';
import { FoundationPage } from '../../pages/foundation';
import { resumeParkedAccount } from '../../utils/sessionResume';

/**
 * Foundation F2 series — single browser session, single login.
 *
 * F2 is reached via the persistent F2 test account (Testf2auto): logging in shows a
 * Hindi UI + a help-language modal; confirming it and switching the app language to
 * English resumes the account on its saved F2 journey ("Start F2"). This lets the F2
 * flow be exercised without replaying Discovery + all of F1 each run.
 *
 * F2's nodes reuse the F1 mechanics with one difference: the Practice (P#) is a
 * "Letter Recognition" game whose options are WORDS (e.g. "the"/"her"/"me"/"ear") rather
 * than single letters — solved by `FoundationPage.completeWordRecognitionPractice`
 * (the prompt audio is still served at `/audio/<lang>/letter/<WORD>.wav`, so the same
 * play() hook reads the answer).
 */
test.describe('@P0 @Foundation F2 series (single session, F2 account)', () => {
    test('TC-020 F2: login → English → Start F2 → complete full F2 (A1 → A2 → A3)', async ({ page, accounts, lang }) => {
        test.setTimeout(45 * 60 * 1000);

        const foundation = new FoundationPage(page, lang);

        // Where the account came to rest after the resume. Classified once, up front, so the
        // steps below can tell an account-state problem from a code problem (mirrors F3).
        let position: 'past' | 'in-game' | 'at-entry';

        await test.step('Login as the F2 account and resume F2 in English', async () => {
            // Returning user starts at the mic test → Skip it (same as Discovery TC-001), then
            // the help-language modal is confirmed and the app language switched to English.
            await resumeParkedAccount(page, foundation, {
                ...accounts.f2,
                lang,
                micSkip: { preWaitMs: 6000, timeoutMs: 10000, postWaitMs: 4000 },
            });
            // PRECONDITION: confirm we're specifically at/inside F2, not just at "some" Start
            // F# entry (the old check here couldn't tell F1/F2/F3 apart text-wise — see
            // EL-4/P2-19 and FoundationPage.expectPositionedForF2's own doc comment).
            position = await foundation.expectPositionedForF2();
            console.log(`[TC-020] F2 account position after resume: ${position}`);
        });

        await test.step('TC-020 (F2): Start F2 → complete Learn/Practice nodes through A1', async () => {
            // The account has already been carried past F2, and Foundation levels advance
            // PERMANENTLY, so there is nothing left to drive here — and there never will be on
            // this account (mirrors foundation-f3.spec.ts's ALLOW_STALE_F3 handling).
            if (position === 'past') {
                const detail = `The parked F2 account (${accounts.f2.username}) has already `
                    + 'graduated past F2, and Foundation levels do not go backwards, so this spec '
                    + 'cannot exercise F2 on it again — not on this run and not on any future run. '
                    + 'This is ACCOUNT STATE, not a code failure: nothing here is broken, but F2 is '
                    + 'NOT being tested. Fix by re-parking a fresh F2-positioned account as '
                    + 'accounts.f2, or by covering F2 through the dynamic-user E2E '
                    + '(FULL_E2E=1 in foundation-f1.spec.ts), which walks a new user F1→F2→F3.';
                if (process.env.ALLOW_STALE_F2 !== '1') {
                    throw new Error(`F2 coverage has lapsed. ${detail} `
                        + 'Set ALLOW_STALE_F2=1 to acknowledge this and skip instead of failing.');
                }
                console.warn(`[TC-020] ⚠️  F2 NOT TESTED — skipped by ALLOW_STALE_F2=1. ${detail}`);
                test.skip(true, `F2 not tested: account is past F2, acknowledged via ALLOW_STALE_F2=1. ${detail}`);
                return;
            }
            // Drive F2: click "Start F2", complete its Letter Train (L#) + "Letter
            // Recognition" practice (P#) nodes, and complete its first Apply (A1).
            const nodes = await foundation.completeFoundationThroughApply(1);
            const level = await foundation.foundationLevel();
            console.log(`[TC-020] F2 nodes: ${nodes.join(' ')}; level=${level}`);
            // The node sequence is the definitive proof: entered via "Start F2" and
            // completed at least one Learn, one (word-recognition) Practice, and A1.
            // (The footer level img is only read as a guard — it can be absent on the
            // brief post-Apply transition screen — so we only assert we're NOT back in F1.)
            expect(level, `unexpected level=${level}`).not.toBe('F1');
            expect(nodes, `nodes: ${nodes.join(' ')}`).toContain('StartF');
            expect(nodes.some((n) => n.startsWith('L')), `nodes: ${nodes.join(' ')}`).toBeTruthy();
            expect(nodes, `nodes: ${nodes.join(' ')}`).toContain('P');
            expect(nodes, `nodes: ${nodes.join(' ')}`).toContain('A1');
        });

        await test.step('TC-020 (F2 cont.): same session → complete A2 → A3 (full F2)', async () => {
            // Continue in the SAME session from post-A1: complete the Learn/Practice nodes
            // and the next two Apply challenges (A2, then the final A3).
            const nodes = await foundation.completeFoundationThroughApply(2, 2);   // A2, A3
            console.log(`[TC-020] F2 nodes (A2→A3): ${nodes.join(' ')}; level=${await foundation.foundationLevel()}`);
            // Completed A2 and A3 (two more Apply challenges) …
            expect(nodes, `nodes: ${nodes.join(' ')}`).toContain('A2');
            expect(nodes, `nodes: ${nodes.join(' ')}`).toContain('A3');
            expect(nodes.some((n) => n.startsWith('L')), `nodes: ${nodes.join(' ')}`).toBeTruthy();
            expect(nodes, `nodes: ${nodes.join(' ')}`).toContain('P');
            // … and completed the final Apply, advancing past A3 (F2 done → e.g. "Start F3").
            await foundation.expectFoundationApplyCompleted();
        });
    });
});
