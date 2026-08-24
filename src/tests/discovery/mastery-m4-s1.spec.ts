import { test, expect } from '../../fixtures/appTest';
import { FoundationPage } from '../../pages/foundation/FoundationPage';
import { MasteryPage } from '../../pages/mastery/MasteryPage';
import { AnswerSource, ContentApiAnswerSource, VisionAnswerSource } from '../../services/answerSource';
import { VisionService } from '../../services/visionService';
import { installSpeechRepeatHook } from '../../utils/speechHook';
import { resumeParkedAccount } from '../../utils/sessionResume';

/**
 * Mastery M4 — S1 assessment. TC-024: complete the S1 "Look at the picture and speak the
 * correct answer" activity and confirm the app advances to the next stage.
 *
 * S1 is a picture multiple-choice activity gated on the CORRECT answer. Automation:
 *   1. installSpeechRepeatHook(page) — mocks Web Speech SpeechRecognition so an injected
 *      transcript (window.__srForce) is delivered as the recognised answer (no real mic).
 *   2. An AnswerSource decides the correct option per question (nothing hardcoded):
 *        • ContentApiAnswerSource (DEFAULT) reads it from the app's own content API
 *          response (GetContent/sentence marks the answer with isAns:true) — deterministic,
 *          free, no third-party service. Best for a reliable regression suite.
 *        • VisionAnswerSource (S1_ANSWER_SOURCE=vision) sends the image to a vision model —
 *          requires VISION_API_KEY.
 *   3. VqaSpeakingAssessment reads the question/options, asks the source, matches the answer
 *      to an on-screen option, injects it, clicks the mic, and verifies the app advances.
 *
 * Reached via the dedicated M4 account (m4auto), which persists at S1. Isolated: the speech
 * hook + VQA layer are used only here, so the F-series and M4 P-node suites are unaffected.
 *
 * ── STATUS: BLOCKED on an APPLICATION issue in build #1 (marked test.fixme; NOT a false
 *    pass). The "correct answer" half is fully solved and verified: ContentApiAnswerSource
 *    reads the right option from the app's own GetContent/sentence payload (isAns:true) and
 *    matches it exactly (score 1.00). What is NOT possible on build #1 is SUBMITTING the
 *    answer — exhaustively verified by headed investigation (2026-08-11):
 *      • The only speech UI (top-right mic) is a microphone DEVICE TEST that always ends
 *        "Perfect! You're all set!" and NEVER grades the spoken answer — driving it to
 *        completion with the correct transcript forced (SR mock confirmed emitting it) does
 *        not advance the question.
 *      • Selecting an option (text / ▶ / radio, incl. real element-clicks on the post-Skip
 *        MUI radio buttons) does not submit and shows no submit/confirm control.
 *      • No answer-recognition ever auto-starts on the question screen.
 *    => S1 answer submission/grading is not wired in build #1. Re-enable this test (change
 *    fixme→normal) once the app provides a working submit path (or a dev answer hook). The
 *    injection point is ready: set the resolved answer as the transcript / selected option.
 *
 * ── RE-VERIFIED on build #10 (v3.0.7 · 7c441ed, 2026-08-17) — STILL BLOCKED. Now confirmed
 *    across FOUR builds (#1, #4, #6, #10). Latest run (headed, m4auto): the answer half is
 *    perfect — ContentApiAnswerSource resolved "A mountain" and matched the on-screen option
 *    exactly (score 1.00) on all 5 attempts — but every attempt reported `via=ui` (i.e. the
 *    driver probed for a dev submit hook and found NONE) and every outcome was `timeout`:
 *    the question never advanced, no TRY AGAIN appeared, and lives never changed, so nothing
 *    was graded. Automation cannot complete TC-024 until the app ships a submit path or the
 *    test hook specified in docs/S1_DEV_HOOK_REQUEST.md (the consumer is already wired:
 *    VqaSpeakingAssessment.submitViaHook auto-detects it, so this test flips green with no
 *    code change). Kept as fixme — tracked as pending, never a false pass.
 */
test.describe('@P0 @Mastery M4 S1 (single session, m4auto)', () => {
    // BLOCKED (app-side, build #1): the S1 answer cannot be submitted — see the block comment
    // above for the exact, evidence-backed root cause. Kept as fixme so it is tracked as
    // pending and never reported as a false pass.
    test.fixme('TC-024 M4 S1: speak-the-answer picture assessment → advance to next stage', async ({ page, accounts, lang }) => {
        test.setTimeout(25 * 60 * 1000);

        // Choose the answer source. Content-API is the default (deterministic + free); set
        // S1_ANSWER_SOURCE=vision (with VISION_API_KEY) to use the vision model instead.
        const useVision = (process.env.S1_ANSWER_SOURCE || '').toLowerCase() === 'vision';
        let source: AnswerSource;
        if (useVision) {
            const vision = new VisionService();
            test.skip(!vision.isConfigured(),
                'S1 vision source needs VISION_API_KEY. Unset S1_ANSWER_SOURCE to use the free content-API source.');
            source = new VisionAnswerSource(vision);
        } else {
            // Attach BEFORE navigation so the content payload is captured as the app loads.
            source = ContentApiAnswerSource.attach(page);
        }

        const foundation = new FoundationPage(page);
        const mastery = new MasteryPage(page);

        await test.step('Install the SpeechRecognition hook before navigation', async () => {
            await installSpeechRepeatHook(page);
        });

        await test.step('Login (m4auto) → English → reach the S1 assessment', async () => {
            await resumeParkedAccount(page, foundation, {
                ...accounts.m4,
                lang,
                micSkip: false,
                ignoreLanguageSwitchErrors: true,   // this call already swallowed the error
            });
            if (await mastery.startLevelButton(4).isVisible({ timeout: 8000 }).catch(() => false)) {
                await mastery.startLevel(4).catch(() => {});
            }
            if (!(await mastery.isAtS1())) await mastery.completeM4Practices().catch(() => {});
            expect(await mastery.isAtS1(), 'expected to reach the S1 assessment').toBe(true);
        });

        await test.step(`TC-024 (S1): answer each picture question (source=${source.describe}) and advance`, async () => {
            const attempts = await mastery.completeS1(source);
            const summary = attempts.map((a) =>
                `[${a.item.question}] answer="${a.sourceAnswer}" -> chose="${a.chosen}" (${a.score.toFixed(2)}) via=${a.via} = ${a.outcome}`);
            console.log(`[TC-024] S1 attempts (${attempts.length}):\n  ${summary.join('\n  ')}`);

            const advanced = attempts.filter((a) => a.outcome === 'advanced').length;
            expect(advanced, `at least one question should be answered correctly and advance; attempts:\n${summary.join('\n')}`).toBeGreaterThan(0);
            expect(await mastery.isPastS1(),
                `S1 should complete and advance past S1; attempts:\n${summary.join('\n')}`).toBe(true);
        });
    });
});
