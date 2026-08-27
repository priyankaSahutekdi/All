/**
 * Screen-state UI copy DATA, keyed by concept and then by language.
 *
 * `text.ts` made character *classes* script-agnostic. This module owns the other half: the
 * literal WORDS the driver looks for on screen — "How to Play", "Time Up!", "Check Sequence",
 * "Fuel: 12/50", "Ready for Challenge", "Continue", "Next Level". Those were inline literals
 * spread across the page objects, so every one of them was an English-only assumption sitting
 * on the critical path of screen recognition.
 *
 * Screen detection is exactly where a missing translation is most expensive, because it fails
 * in two directions (text.ts:40-43 makes the same point): a false negative stalls the driver
 * until a timeout, and a false positive makes it act on the wrong screen.
 *
 * The lookup/regex-building functions that read this table (`copy`, `copyAlt`, `copyRe`, …)
 * live in `uiCopyLookup.ts` — this file owns only the data and its key type.
 *
 * ONE CONCEPT, ONE LITERAL: keys are ATOMIC (`correct`, `great`, `wellDone`), not bundled
 * lists, because call sites legitimately want different subsets — `tapLetterAndAdvance` waits
 * out `Correct|Great` while `tapWordAndAdvance` waits out `Correct|Great|Well done`. A bundled
 * `correctFeedback` key forced one of those to change behaviour; separate keys let each call
 * site name the subset it means via `copyRe(['correct', 'great'], lang)`, while still holding
 * every word exactly once so a translator cannot make two copies drift.
 *
 * `{slot}` PLACEHOLDERS: a few strings wrap variable content ("Start F2", "of 5 letters").
 * The variable part is a `{slot}` and the caller supplies a regex fragment for it, so a
 * language that reorders the sentence ("F2 शुरू करें") is expressible as data rather than
 * needing new code. Where the variable part is a level CODE (`F1`, `F2`) it stays a code, not
 * copy — the app renders those identically in every language (`foundationLevel()` reads them
 * out of `img[alt]`).
 *
 * POPULATING A LANGUAGE: values must be OBSERVED on a real build of that language, never
 * translated or guessed — the same standing rule as src/docs/LANGUAGE_ONBOARDING.md (Appendix B). Hindi is
 * intentionally absent below rather than filled with plausible translations.
 */
import { AppLanguage } from './languages';

/**
 * One concept per key. Values are the exact strings the app renders, per language code.
 *
 * A value may be a list ONLY when the app renders genuinely interchangeable wordings for one
 * concept AND every call site wants all of them; prefer separate atomic keys otherwise (see
 * the ONE CONCEPT, ONE LITERAL note above).
 */
export const UI_COPY = {
    // ── App chrome / navigation ──────────────────────────────────────────────
    /**
     * English-only ON PURPOSE, not an unobserved gap: this key backs the mic-calibration
     * screen's Skip button (`DiscoveryLoginPage.micSkipPattern`, `sessionResume.ts`), which H2a
     * (2026-08-19) proved renders "Skip" in fixed English on a live Hindi-targeted run — that
     * screen is reached before the app has been told any language, so there is no Hindi string
     * to observe here. See `HINDI_ROLLOUT_LOG.md (Decisions Log section)` D-10 and `HINDI_ROLLOUT_LOG.md (Execution Log section)` EL-7.
     */
    skip: { english: 'Skip' },
    /**
     * Hindi value is TC-003's learning-language dropdown confirm ("भाषा चुनें" popup), observed
     * live via H2a (2026-08-19) — NOT the help-language popup's Confirm (TC-002), which renders
     * fixed English for the same reason as `skip` above and is matched via a hardcoded literal
     * at its own call site instead of this key. See `HINDI_ROLLOUT_LOG.md (Decisions Log section)` D-10.
     */
    confirm: { english: 'Confirm', hindi: 'कन्फर्म करें' },
    /** English-only — TC-002's help-language popup renders fixed English; see `confirm` above. */
    chooseHelpLanguage: { english: 'Choose your help language' },
    startAssessment: { english: 'Start Assessment', hindi: 'असेसमेंट शुरू करें' },
    letsStart: { english: "Let's Start" },

    // ── Transition / advance controls ────────────────────────────────────────
    // Previously English-only literals in `transitions.ts`. They live here so the advance
    // buttons are translatable like every other screen string; `transitions.ts` still owns
    // the two MATCHING STRATEGIES built from them (see the note in that file).
    /**
     * Hindi value was carried forward, unverified, from an old inline
     * `/^Continue$|जारी रखें/` literal — someone observed it once but the current build had
     * never re-confirmed it. **Re-verified live 2026-08-19 (H11)**: the Assessment 1 completion
     * popup's own CTA reads exactly "जारी रखें". P2-15 closed.
     */
    continueLabel: { english: 'Continue', hindi: 'जारी रखें' },
    next: { english: 'Next' },
    // hindi observed live, H12 (2026-08-20): the post-A1-Apply celebration screen ("अरे वाह!
    // आपने सब सही किया! अगला स्तर 🦉 मुझे आप पर बहुत गर्व है! ऐसे ही जारी रखो!") — "अगला स्तर"
    // is the "Next Level" advance control embedded in that congratulatory text.
    nextLevel: { english: 'Next Level', hindi: 'अगला स्तर' },
    letsGo: { english: "Let's Go" },
    // hindi observed live, H12 (2026-08-20): the app renders TWO distinct wordings for this
    // one concept depending on screen — 'खेल शुरू करें' (practice-demo entry, confirmed H11/H5)
    // and 'गेम शुरू करें' (Apply-challenge entry, "गेम" is the English loanword). Both are real,
    // both are needed — `copy()` already supports multiple literals per language (an array).
    startGame: { english: 'Start Game', hindi: ['खेल शुरू करें', 'गेम शुरू करें'] },
    skipDemo: { english: 'Skip Demo', hindi: 'डेमो छोड़ें', },
    claim: { english: 'Claim' },
    collect: { english: 'Collect' },
    finish: { english: 'Finish' },
    done: { english: 'Done' },
    playAgain: { english: 'Play Again' },
    gotIt: { english: 'Got it' },

    // ── Journey map / placement screens ─────────────────────────────────────
    /**
     * Hindi values observed live 2026-08-19 (H11) on the discovery-result/placement screen
     * (reached by failing the Letter Hunt): "शाबाश!!! आपके पास अच्छी भाषा कौशल है। आप स्तर B से
     * शुरू कर सकते हैं। सीखने की यात्रा शुरू हो!" — literal substrings, with the placement
     * level ("B") deliberately excluded, same reason the English values exclude any level.
     */
    learningJourney: { english: 'learning journey', hindi: 'सीखने की यात्रा' },
    languageSkills: { english: 'language skills', hindi: 'भाषा कौशल' },
    /**
     * The journey-map entry into a Foundation level; `{level}` is the F# code. Hindi observed
     * live 2026-08-19 (H11) via the F1 landing screen's accessibility snapshot: "F1 शुरू करें" —
     * note the REVERSED word order vs English (level first, then the "start" verb), which is why
     * this is a template rather than a fixed prefix/suffix string.
     */
    startFoundationLevel: { english: 'Start {level}', hindi: '{level} शुरू करें' },
    // hindi observed live, EL-24 (2026-08-26): the Mastery landing screen (shown after F3
    // genuinely completes) has a "स्तर 1 शुरू करें" ("Start Level 1") button — same reversed
    // word order as `startFoundationLevel`. Recorded as the distinguishing word "स्तर" ("Level"/
    // "Stage", Mastery's own vocabulary, distinct from Foundation's "F#" codes) rather than the
    // full numbered phrase, since this key (unlike `startFoundationLevel`) has no `{level}`
    // template to hold the number, and this is only ever used as one of several OR'd "have we
    // left F3" signals (see `pastF3` below) — a broader single-word match is fine there.
    startLevel: { english: 'Start Level', hindi: 'स्तर' },
    levelWord: { english: 'Level' },
    foundationWord: { english: 'Foundation' },

    // ── Activity identification ─────────────────────────────────────────────
    howToPlay: { english: 'How to Play', hindi: 'कैसे खेलें' },
    // hindi observed live, EL-17 (2026-08-26): F3's Letter Launcher game heading read exactly
    // "अक्षर लॉन्चर ईंधन: 0 / 50" above a shown letter + ✓/✗ buttons — "अक्षर लॉन्चर" is this
    // key; "ईंधन" is `fuelLabel` below (screenshot: test-results/f3-unrecognised.png).
    letterLauncher: { english: 'Letter Launcher', hindi: 'अक्षर लॉन्चर' },
    // hindi observed live, EL-21 (2026-08-26): F3's Memory Challenge screen heading read exactly
    // "मेमोरी चैलेंज" (screenshot captured via completeF3's own diagnostics after a full LL x8
    // solve run; see docs/HINDI_ROLLOUT_LOG.md EL-21/EL-22).
    memoryChallenge: { english: 'Memory Challenge', hindi: 'मेमोरी चैलेंज' },
    // hindi observed live, EL-12 (2026-08-19): F1's post-Letter-Train practice-demo screen
    // read "अक्षर पहचान पातळी 1 • basic • 5-8 min कैसे खेलें …" — "अक्षर पहचान" ("Letter
    // Recognition") and "कैसे खेलें" (howToPlay) were confirmed correct Hindi at the time (the
    // rest of that same screen was Marathi, tracked separately as D-13/H12 — not this key).
    // Reused here since `isOnWordRecognition()` matches this exact generic activity-type
    // heading via a whole-page text scan, not a level-specific locator.
    letterRecognition: { english: 'Letter Recognition', hindi: 'अक्षर पहचान' },
    didYouSee: { english: 'Did you see' },
    speakCorrectAnswer: { english: 'speak the correct answer' },
    // hindi observed live, H12 (2026-08-20): A1 Apply entry screen — full text "शाबाश!!!
    // चैलेंज के लिए तैयार हैं? गेम शुरू करें ➜". "शाबाश!!!" is the already-registered `hurray`;
    // this key is just the "Ready for Challenge?" heading fragment (question mark excluded,
    // same reasoning as other counted/punctuated fragments in this file).
    readyForChallenge: { english: 'Ready for Challenge', hindi: 'चैलेंज के लिए तैयार हैं' },
    loading: { english: 'Loading' },

    // ── Progress / scoring readouts (the numbers are parsed separately) ──────
    // hindi observed live, EL-17 (2026-08-26): F3 Letter Launcher's "ईंधन: 0 / 50" readout —
    // same screen/citation as `letterLauncher` above.
    fuelLabel: { english: 'Fuel', hindi: 'ईंधन' },
    // hindi observed live, EL-21 (2026-08-26): F3 Memory Challenge's "Progress: 0/5" readout
    // rendered the WORD "Progress" in literal English on the Hindi build — not a missing
    // translation guessed as English, a direct observation (same "unlocalized app-shell chrome"
    // pattern already confirmed for the mic-skip button, the help-language modal, and this
    // screen's own "Continue"-equivalent elsewhere — see D-10/EL-21). If a future build
    // localizes this, re-observe and correct; do not assume it stays English forever.
    progressLabel: { english: 'Progress', hindi: 'Progress' },
    wordsPerMinute: { english: 'Words per minute' },
    // hindi observed live, EL-24 (2026-08-26): F3's post-completion "next phase" journey map
    // (Mastery landing) header read "- सीखे गए शब्द" next to a book icon and a count — "सीखे गए
    // शब्द" ("words learnt").
    wordsLearnt: { english: 'Words Learnt', hindi: 'सीखे गए शब्द' },
    livesLabel: { english: 'You have' },
    /** Memory Challenge's answer-grid prompt; `{n}` is the sequence length. */
    // hindi observed live, EL-21 (2026-08-26): the SAME Memory Challenge screen showed
    // "0 of 3 letters" — again literal English, not translated. Same caveat as `progressLabel`.
    lettersOfCount: { english: 'of {n} letters', hindi: 'of {n} letters' },

    // ── Transient activity states ───────────────────────────────────────────
    // hindi observed live, EL-21 (2026-08-26): Memory Challenge's countdown-expired badge read
    // "⏰ समय समाप्त!" — "समय समाप्त" ("time is over/up"), punctuation excluded per this file's
    // convention for counted/punctuated fragments (see `readyForChallenge` above).
    timeUp: { english: 'Time Up', hindi: 'समय समाप्त' },
    // hindi observed live, EL-23 (2026-08-26): Memory Challenge's submit button, read verbatim
    // off the accessibility tree (not a screenshot read) as `button "क्रम जाँचें"` once all 3
    // letters were selected — "क्रम" (sequence/order) + "जाँचें" (check).
    checkSequence: { english: 'Check Sequence', hindi: 'क्रम जाँचें' },

    // ── Feedback (atomic — call sites pick the subset they mean) ─────────────
    // hindi observed live, H12 (2026-08-20): F1 Letter Hunt practice (P1) correct-answer
    // banner reads "🎉 सही है।" ("is correct") — a short phrase, not a single word like
    // English's "Correct". `feedbackShort`/`feedbackFull` alternate ALL of correct/great/
    // wellDone (copyAlt requires every listed key to resolve, not just one to match), and
    // this is the only distinct Hindi feedback phrase observed so far — reused across all
    // three (same idiom as `hurray` being confirmed correct on two different screens) rather
    // than left unobserved. If a live run ever shows a DIFFERENT Hindi phrase for a
    // "Great"/"Well done" moment specifically, split it out then — don't assume this is final.
    correct: { english: 'Correct', hindi: 'सही है' },
    great: { english: 'Great', hindi: 'सही है' },
    wellDone: { english: 'Well done', hindi: 'सही है' },
    awesome: { english: 'Awesome' },
    greatJob: { english: 'Great job' },
    /** The games' own wrong-answer shout, distinct from the connectivity page's `tryAgain`. */
    tryAgainShout: { english: 'TRY AGAIN' },
    cantHear: { english: "can't hear" },
    oops: { english: 'Oops' },
    notQuite: { english: 'not quite' },

    // ── Completion ──────────────────────────────────────────────────────────
    /**
     * Hindi value observed live 2026-08-19 (H11) on the Assessment 1 completion popup:
     * "शाबाश!!! आपने असेसमेंट 1 सफलतापूर्वक पूरा कर लिया है जारी रखें". `hurray` itself is the
     * popup's heading, "शाबाश!!!" — confirmed correct for the ASSESSMENT completion popup only
     * (`AssessmentPage.completionPopup`, `discovery.spec.ts`'s `completionPopupRe`). This key
     * is ALSO used by `FoundationPage.completion` and `FoundationPage.resultMessage` (F1 node
     * completions, the Letter-Hunt-fail result screen) — NOT yet confirmed those screens render
     * the same "शाबाश!!!"; H12/H10 must re-verify before relying on it there.
     */
    hurray: { english: 'Hurray', hindi: 'शाबाश!!!' },
    successfully: { english: 'successfully' },
    complete: { english: 'complete' },
    /** Deliberately a STEM: the app renders "Congratulations" and "Congrats". */
    congratulations: { english: 'congrat' },
    /**
     * The assessment completion popup's own phrases. These overlap the `successfully` /
     * `complete` STEMS above but are not duplicates of them: the stems back FoundationPage's
     * deliberately loose "did the node finish?" heuristic, while these are the specific
     * wordings the popup renders and are what `expectCompletionPopupVisible` asserts on.
     * Hindi values observed live 2026-08-19 (H11), both literal substrings of the popup's own
     * body text ("आपने असेसमेंट 1 सफलतापूर्वक पूरा कर लिया है") with the assessment NUMBER
     * deliberately excluded — same reason the English values exclude it — so the same pattern
     * matches both Assessment 1 and Assessment 2's completion (only Assessment 1's popup was
     * directly observed; Assessment 2's is assumed identical apart from the number, since both
     * are driven by the same `completeUntilPopup`/`AssessmentPage.completionPopup` code path).
     * Used only here — no cross-screen reuse risk like `hurray` above.
     */
    successfullyCompleted: { english: 'successfully completed', hindi: 'सफलतापूर्वक पूरा कर लिया है' },
    completedAssessment: { english: 'completed assessment', hindi: 'असेसमेंट' },

    // ── Errors ──────────────────────────────────────────────────────────────
    couldntConnect: { english: "Couldn't connect right now" },
    checkInternet: { english: 'check your internet connection' },
    tryAgain: { english: 'try again' },
} as const satisfies Record<string, Record<string, string | readonly string[]>>;

export type CopyKey = keyof typeof UI_COPY;

/** Every key, for coverage checks when a new language is added. */
export const COPY_KEYS = Object.keys(UI_COPY) as CopyKey[];

// Re-exported so consumers of the data table can name the language type without a second import.
export type { AppLanguage };
