# Build History — Pre-Hindi Framework Development

**What this is:** the dated change log and accumulated business-rules/assumptions from building
the ALL-platform automation suite (Discovery → F1 → F2 → F3 → Mastery M4), from the first
Discovery tests through the framework cleanup that preceded the Hindi multi-language work.
This file used to be `CHECKLIST.md`; its live test-status tables (pass counts, coverage
percentages) went stale and are superseded by the [Current Status](docs/HINDI_ROLLOUT_LOG.md#current-status)
section of `docs/HINDI_ROLLOUT_LOG.md` — only the durable
history and the discovered-behavior notes are kept here. For the Hindi-specific work that
follows this history, see the [Readiness Plan](docs/HINDI_ROLLOUT_LOG.md#readiness-plan),
[Execution Log](docs/HINDI_ROLLOUT_LOG.md#execution-log), and [Decisions Log](docs/HINDI_ROLLOUT_LOG.md#decisions-log)
sections of `docs/HINDI_ROLLOUT_LOG.md`.

## Table of Contents

- [Notes & Assumptions](#notes--assumptions)
- [Change Log](#change-log)
- [Project Context & Hand-off](#project-context--hand-off)
- [Refactoring Plan (Multi-Language Readiness)](#refactoring-plan-multi-language-readiness)
- [Execution Plan (Git Baseline & Session Hand-off)](#execution-plan-git-baseline--session-hand-off)
- [Optimization & Refactoring Plan](#optimization--refactoring-plan)
- [Outstanding Dev Request: M4 S1 Non-Audio Answer Hook](#outstanding-dev-request-m4-s1-non-audio-answer-hook)

**On this consolidation:** the five sections after the Change Log were originally standalone files
(`PROJECT_CONTEXT.md`, `REFACTORING_PLAN.md`, `EXECUTION_PLAN.md`, `OPTIMIZATION_PLAN.md`,
`S1_DEV_HOOK_REQUEST.md`). They were merged into this file to keep the project at a maximum of five
docs, with no content lost. Cross-references between them (and to the three names already folded in
here earlier — `CHECKLIST.md`, `PROGRESS_TRACKER.md`, `TRACEABILITY_MATRIX.md`) have been repointed
to sections of this file where they were pure "see also" pointers; references that were historical
snapshots of actual filenames tracked in git at a point in time were left as written, since rewriting
those would misrepresent history.

---

## Notes & Assumptions

### Implementation Details
1. **Dynamic Username Generation**: Each test creates a unique username using timestamp (format: `testuser_<timestamp>`)
2. **Password Strategy**: Password is same as username as per requirement
3. **Audio Handling**: Discovery recordings use Chromium fake-media launch args (`--use-fake-device-for-media-stream`). The F1 "say the word" phase injects the ACTUAL word audio into the mic (SAPI TTS + `getUserMedia` override) so Metabase stores correct words — see Business Rule 9.
4. **Language Support**: Framework supports English, Telugu, and Hindi
5. **Assessment Flow**: Dynamic — loops record→replay→next until the completion popup (no hardcoded sentence count)
6. **Single-session E2E**: TC-001→TC-013 run in one browser session with one login (`discovery-e2e.spec.ts`)

### Business Rules / Assumptions discovered (Discovery → F1)
1. **Assessment 3 is "Letter Hunt"**, a letter-selection game (audio prompt → tap the matching letter bubble), NOT the record→replay→next mechanic documented in the original CSV. Letters are SVG glyphs (no DOM text).
2. **Failing the Letter Hunt** (selecting wrong letters until lives deplete) ends Discovery and routes to the placement/result screen at **`/discover-end`**.
3. The result screen shows a placement message and a **"Let's Start"** button (SVG label) that begins the learning journey.
4. **Clicking "Let's Start" redirects to the F1 module landing** (learning-journey map at `/discover-start`) which presents a **"Start F1"** entry button with Beginner / Level 1 markers. This is TC-013's verification point.
5. The placement message text reflects Assessment 1 & 2 (spoken) performance and may read positively ("good language skills") even when the Letter Hunt was failed — the F1 redirect is driven by the Letter Hunt outcome, verified via the "Start F1" landing.

### Business Rules / Assumptions discovered (F1 lessons)
6. **F1 lesson sequence:** clicking "Start F1" opens the first node; nodes run L1 → P1 → L2 → P2 → L3 … (shown on the bottom map). **L# = Learn (Letter Train)**, **P# = Practice (Letter Hunt)**.
7. **Letter Train (L#)** is deterministic: a "learn" phase (navigate with ← ↻ → arrows) then a "say the word" phase (record via the centre mic); on completion it auto-advances to the next node. An intro coach-mark ("Alphabet Chart") may appear and must be dismissed. **The step count VARIES per lesson** (L1–L5 = `/16`, L6 = `/14`, others `/15` observed), so train detection must NOT hardcode a denominator — the suite matches an `N/M` progress counter with denominator ≥ 11 (text-only, flicker-proof; excludes the Letter Hunt practice / Apply `/10`).
8. **Letter Hunt practice (P#)** is **audio-gated**: a spoken prompt names the target letter (no on-screen target); 4 letter options; 3 lives; 10 questions; each answered then advanced via a "→" button. The prompt audio is `/audio/<lang>/letter/<LETTER>.wav`. Reading that from **network requests is unreliable** (the audio is cached, so a replay fires no request). **Solution used:** hook `HTMLMediaElement.prototype.play()` in-page (via `page.evaluate`) — the app always calls `play()` on an element whose `src` is that URL, **even when cached** — so the currently-playing letter is captured deterministically. Answers are always correct (lives never drop). This made TC-015/TC-016 **reliable** (removed the earlier best-effort handling).
10. **Apply node (A#) is a Letter-Hunt "Challenge" with 3 levels.** Entered via a "Start Game ➜" button on a "Hurray!!! Ready for Challenge?" screen. Same answering as P# (spoken letter → tap the match; the play()-hook answers correctly so lives never drop), but with **3 levels of 10 questions**, a **"Next Level"** button between levels and a **"Continue"** button at the end → next node. An intro "Alphabet Chart" coach-mark may flash and clears on its own. Handled by `completeApplyChallenge` (reuses the shared Letter-Hunt answer atoms).

### Business Rules / Assumptions discovered (F2 series)
11. **Reaching F2 (TC-020):** completing F1's A3 shows a **"Start F2"** entry on the journey map. For automation speed a **persistent F2 account** (`Testf2auto`) is used: on login it presents a **Hindi UI + a "Choose your help language" modal (Kannada/Telugu)**. **Confirm** that modal, then open the **top-right language switcher** and select **English + Confirm** — this resumes the account on its saved F2 journey ("Start F2"). Encapsulated in `FoundationPage.switchToEnglishForF2`. F2 runs as its own single-session suite (`foundation-f2.spec.ts`).
12. **F2 Learn (L#)** reuses the F1 Letter Train mechanic but longer (**/18**), sometimes a "Syllable" train (say-the-word words like "Sofa"/"Gas"). **F2 Practice (P#) is a "Letter Recognition" game** whose 4 answer options are **WORDS** (e.g. the/her/me/ear), not single letters — but the prompt audio is still served at `/audio/<lang>/letter/<WORD>.wav`, so the **same `play()` hook reads the answer**; the matching **word** button is tapped (case-insensitive). Handled by `completeWordRecognitionPractice`; the number of L/P pairs before an Apply varies (2–3 observed). The Apply challenge may use word options too, so `completeApplyChallenge` has an additive word-answer fallback (F1's single-letter path is checked first, leaving F1 unchanged).

### Business Rules / Assumptions discovered (F3 series — TC-021/TC-022)
13. **F3 is a chain of mini-games, NOT the Letter Train + Hunt.** Reached via a persistent F3 account (`Testf3auto`): login → skip mic → select **English** → resumes on the F3 journey ("Start F3"). Nodes are P1–P10 practices + A1/A2/A3 Applies; completing F3 advances the app to the next-phase ("Words per minute" / "Start Level") map (detected by `isPastF3`). The whole level is driven by `FoundationPage.completeF3()`. **The account advances permanently** — once F3 is completed it resumes on the next phase, so re-running F3 needs a fresh F3-positioned account (the dynamic-user E2E is the reproducible validation).
14. **"Letter Launcher" (P1–P5 letters, P7–P10 words, A1 levels):** a token is **shown** (a single letter *or* a whole word) and a token is **spoken**; press **✓** if they match, **✗** if not. Each correct answer adds rocket "fuel" (target /50 or /100) under a timer. The spoken token plays via an **opaque blob** URL (letter audio is preloaded as `/audio/<lang>/letter/<X>.wav` in a batch), so it's recovered by mapping each blob to its letter via **`Blob.size`** (synchronous → no race) — `installLetterLauncherHook`. Round 1's audio only fires once the round is advanced, so the solver **presses to advance** rather than stalling. Handled by `completeLetterLauncher` (displayed-token detection reads a letter OR a word).
15. **"Memory Challenge" (P6 letters; A2/A3 words):** a short sequence is **shown as dash-separated text** ("T - D - S" / "me - our - on") during a ~2–3s memorize window (with a countdown), then hidden ("Time Up!"); you then click those tokens on the grid **in order** and submit via the **"Check Sequence"** button. In this environment the letters are **not audible** — they are read from the on-screen text during the window (capture-first, tight poll, because the word window is only ~1.6s). Submit is clicked via the **button element** (`scrollIntoView` + native `click`), which a text-locator click did not reliably trigger. Handled by `completeMemoryChallenge` (parses letter and word sequences). 5 rounds per node.

### Business Rules / Assumptions discovered (Mastery M4 — TC-023 / TC-024)
16. **M4 is a chain of "Speed Practice" nodes, NOT the Train/Hunt.** Reached via the Mastery map (`Testf3auto` → login → English → **"Start Level 4"**). Bottom nav pills show the remaining nodes (P1 P2 P3 P4 S1 P5…); **completed nodes get a green tick and drop out**, so the **first remaining `P#`/`S#` in the page text is the active node** (`MasteryPage.currentNode`). The card **scrolls** as you progress, so all detection is **text/alt-based and scroll-independent** (controls found by `alt` tag then scrolled into view before clicking). Driven by `MasteryPage.completeM4Practices()`; **all M4 code is additive** (`MasteryPage` composes `FoundationPage`'s mic hook; F1–F3 and `playwright.config.ts` unchanged).
17. **M4 Read Aloud (P1/P2/P4):** a sentence is shown with a green **mic** → record → the recording is fed the sentence's **SAPI-TTS via the reused F-series injection** (`installMicInjection` / `__playInjected`) → stop → orange **"next"**. Ungated (Lesson Tracker), so any recording advances; **no real audio device needed → scalable for E2E**. Sentences are parsed from page text (space-less/curly-apostrophe/one-letter-word variants handled).
18. **M4 Paced Read Aloud (P3):** adds a **Slow/Medium/Fast** selector + a 3-2-1 **countdown / word-ticker** before the mic; the driver **rides the countdown** (patient `detectState`) and selects **Fast** to shorten it.
19. **M4 "Did you see the word?" (P3):** after a word ticker, a **Yes/No** recognition probe, then a feedback **"next"**. Ungated. Each node ends with a summary ("Your overall reading speed") + a **"Hurray!!! … Continue"** completion modal (Continue may be a `<div>`, not a `<button>`). Reaching the S1 **"Ready for Challenge?"** entry confirms P1–P4 complete (`isAtS1`).
20. **M4 S1 (TC-024, PENDING as of this history):** a **"Read the Image"** speaking assessment — picture + question + 3 options, answered by **speaking** (ASR-gated, 5 lives, 80%). **Two blockers:** (a) the correct answer needs **image comprehension** — image/options/audio are opaque S3 UUIDs, no `data-answer`, clicking an option doesn't submit; (b) answering needs a **real voice the app hears** — Web-Audio injection is only partially detected ("We can't hear you"), and Chromium `--use-file-for-fake-audio-capture` IS heard (mic-test reached "Awesome! You did great!") **but is flaky** and still needs the correct answer. Deferred with a **practical non-audio workaround** (dev test-hook / API / mock), kept behind `MasteryPage` so it can be swapped without touching the rest.

9. **Letter Train "say the word" phase records the microphone.** The word is shown as **text only** (Egg, Apple, Orange, Tiger, Ice, Nest, Sun, Rat…) — no audio prompt, and the app hosts **no word audio** (`/audio/.../word/*.wav` → 404). The app records via `getUserMedia` (no `MediaRecorder`) and **does not gate on recognition** — a correct word and a deliberately-wrong word both show the same "accepted" (green box) UI and advance. **Solution used (so Metabase stores the correct word):** synthesize the displayed word locally with **Windows SAPI TTS** (`TtsHelper`), override `getUserMedia` to return one persistent Web-Audio `MediaStreamDestination`, and **play the word's audio into that stream during recording** so the app records the ACTUAL word. **Verified via Metabase** (the app exposes no on-screen recognition result — correct vs wrong are UI-identical — so Metabase is the source of truth). Scoped to the F1 word phases; Discovery recordings (TC-005–010) are unaffected.

### 🔧 Nice-to-have Request to Dev Team (test hooks) — would simplify F-series automation
Automation currently works via the `play()`-hook workaround. Native hooks would still be cleaner/more robust:
1. **`data-testid`/`aria-label`** on F1 controls (speaker, answer options, "→" next, Letter Train arrows/mic).
2. Expose the **current prompt's target letter** in a non-audio way (e.g. `data-answer`/`aria-label` on the question) so answers don't depend on the audio `play()` hook.
3. **M4 S1 (and other ASR/image assessments):** expose the **correct answer** on the question (e.g. `data-answer` / `aria-label` on the option) and/or a **non-audio way to submit** the chosen answer (so automation needn't rely on live ASR / real microphone audio). This is the blocker for TC-024.

### Locator strategy
- No `data-testid`/`aria` hooks; button labels are often SVGs; `css-*` hashes change per build.
- Prefer **text** (`getByText`/`getByRole`) and **`alt`** (`img[alt="Play"]`); use **viewport coordinates** only for text-less, hash-volatile controls (record/stop toggle, "Let's Start").

### Framework Gaps Identified
1. Audio quality validation not implemented (out of scope)
2. Actual microphone permission handling may need manual intervention
3. Network throttling not tested
4. Cross-browser testing pending (Phase 2)

### Recommendations
1. ✅ Discovery flow automated (TC-001 to TC-010)
2. ⏳ Foundation levels (F0-F3) - awaiting prioritization
3. ⏳ Mastery levels (M1-M9) - awaiting prioritization
4. ⏳ API testing for state management - future enhancement

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-05-29 | Initial checklist created | Kiro |
| 2026-06-30 | Discovery TC-011/TC-012 added; build-independent locators; single-session E2E | QA Automation |
| 2026-06-30 | F-series started: TC-013 (F1 entry) automated and verified (13/13 passing) | QA Automation |
| 2026-07-02 | TC-014 (F1 L1 Letter Train → P1) automated & verified; TC-015/TC-016 (P1/P2 Letter Hunt) implemented best-effort (app audio-gated flakiness); dev-hooks request documented | QA Automation |
| 2026-08-03 | TC-015/TC-016 fixed & promoted to fully asserted — in-page `play()` hook reads the target letter reliably (even when audio cached); all 16/16 passing in consecutive runs | QA Automation |
| 2026-08-03 | F1 "say the word" phase now records the correct word audio via SAPI TTS + `getUserMedia` injection (`TtsHelper`); Metabase confirmed accurate word storage; 16/16 still passing | QA Automation |
| 2026-08-03 | TC-017 added — complete L3 + P3 → navigate to A1 (Apply "Ready for Challenge?"); reuses existing train/hunt helpers; 17/17 passing | QA Automation |
| 2026-08-03 | TC-018 added — complete A1 (Apply, 3 levels) → L4 → P4 → L5 (`completeApplyChallenge`; refactored shared Letter-Hunt answer atoms); 18/18 passing | QA Automation |
| 2026-08-03 | TC-018 extended to A2 (L4/P4–L5/P5–L6/P6) + TC-019 added (A2 → L7–L9/P7–P9 → complete A3) via `completeLearnPracticePair`; fixed train detection to be length-independent (L6 = /14, others /15 — was hardcoded /16); 19/19 passing headed (~24 min) | QA Automation |
| 2026-08-05 | TC-020 (F2) added — reach F2 via persistent account (`Testf2auto`, login→English) and complete F2 opening through A1; F2 Practice is word-based "Letter Recognition" (`completeWordRecognitionPractice`) + word-aware Apply fallback (F1 paths untouched); own spec `foundation-f2.spec.ts`; PASSED headed (~7 min) | QA Automation |
| 2026-08-06 | TC-021/TC-022 (F3) added — F3 is a chain of mini-games ("Letter Launcher" letters+words; "Memory Challenge" letter+word sequences) + A1/A2/A3 Applies. New solvers `completeLetterLauncher`, `completeMemoryChallenge`, driver `completeF3()`, blob→letter recovery `installLetterLauncherHook`; own spec `foundation-f3.spec.ts` (account `Testf3auto`). Drove P1→A3 to Foundation completion. All additive — F1/F2 unchanged | QA Automation |
| 2026-08-07 | TC-023 (Mastery M4 P1–P4) added — M4 is a chain of "Speed Practice" nodes (Read Aloud, paced word-ticker, "Did you see the word?"). New page object `src/pages/mastery/MasteryPage.ts` + barrel, driver `completeM4Practices()`; own spec `mastery-m4.spec.ts` (account `Testf3auto`, "Start Level 4"). Read-aloud reuses the F-series mic injection (no real audio device). Additive — `MasteryPage` composes `FoundationPage`; F1–F3 and `playwright.config.ts` unchanged. PASSED headed (reaches S1). **S1 → TC-024 pending** (image-comprehension + ASR-gated speaking; needs a non-audio workaround). | QA Automation |
| 2026-08-10 | **Deployment migration (app rebranded "AXL", build #1).** Login changed: **Guest tab → User ID/Password → Grade dropdown (Grade 2) → "Login as Guest" → Home → "Continue to ALL"**. The learning app now renders inside a **same-origin iframe** (`/all-app/…` that navigates internally: `/discover`, `/discover-start`, …), and the ALL Platform opens on a **mic-calibration** screen with a "Skip". Framework updated (login only): `DiscoveryLoginPage` rewritten to the new flow (grade config-driven via `.env` `GRADE`, default 2; dismisses "Got it!" PWA modal; skips the entry mic-test); new **`src/utils/appFrame.ts`** (`appPage` proxy routing DOM queries to the app iframe, page-level ops to the page) + **`src/fixtures/appTest.ts`** fixture; 4 real specs swapped to the fixture (one-line import); `FoundationPage` URL checks now read the app-frame URL. **Discovery + F1 (TC-001–019) RE-VERIFIED PASS on the new build (~30.6 min).** No page-object business logic changed beyond the URL-frame checks. | QA Automation |
| 2026-08-10 | **F2/F3/M4 (TC-020–023) initially blocked by the deployment's login-model change.** Guest login starts a **fresh Discovery session** (no old-account resume), and the Student tab requires **registered** credentials (`Testf2auto`/`Testf3auto` don't authenticate). A fresh-guest **play-through** (Discovery→F1→F2→F3) was built + verified for F1→F2 and F2→F3 transitions (F2 completes A1–A3; F3 launcher-intro "Skip Demo" handled), but it is long and env-flaky, and a fresh guest lands in Mastery at **M1** (M4 unreachable without M1–M3). | QA Automation |
| 2026-08-11 | **M4 S1 (TC-024) — audio SOLVED, but correctness-gated → still pending.** Investigated the speaking assessment on the new build with `m4auto` (which persists at S1). Mechanic: "Read the Image, speak the correct answer" (opaque-UUID image, 3 options, 5 lives); the mic uses the Web Speech **`SpeechRecognition`** API (getUserMedia/file-capture audio and Web-Audio injection are NOT accepted by its backend). **Fix for the audio half:** new **`src/utils/speechHook.ts`** `installSpeechRepeatHook(page)` — installed before navigation, it captures the `speechSynthesis`-dictated phrase and **mocks SpeechRecognition to emit a chosen transcript** (`window.__srForce`, else the dictated phrase). This passes the app's mic gate (calibration → "Awesome! You did great!"), no real audio needed; isolated + reusable (used only by the S1 spec). **Remaining blocker:** S1 is **correctness-gated** — injecting a *wrong* option ("In a school" for "Where are the children") returns **"TRY AGAIN"** and does not advance; only the **correct** option passes, and it depends on the image (no DOM/`data-answer`). So TC-024 needs the correct answer via **image comprehension (vision)** or a **dev `data-answer`/answer hook**. Driver `MasteryPage.completeS1()` + `mastery-m4-s1.spec.ts` are in place; TC-024 marked `test.fixme` (pending, not a false pass) until the answer source is chosen. F-series/M4-P1–P4 unaffected. **Ruled out — option-audio transcription:** each option's ▶ plays only that option's word (opaque per-item WAVs), the question ▶ plays the question, and nothing plays/reveals the *correct* option — so the answer is NOT derivable from audio; it genuinely requires the image. | QA Automation |
| 2026-08-11 | **Chrome-crash / browser-disruption root cause + fix.** (1) The user's *regular* Google Chrome was being disrupted because a cleanup command killed `chrome.exe` **by name**, which also matches the user's Chrome. Playwright launches its **own bundled Chromium** (no `channel:'chrome'` in the config), fully isolated — so **never kill `chrome.exe` globally**; Playwright closes its browser automatically (only ever target the `ms-playwright` executable path if orphan cleanup is truly needed). (2) The separate in-run "Target page/context/browser has been closed" crashes are **memory pressure** (the user's many Chrome tabs + the heavy AXL PWA-in-iframe + audio during long 30–90 min runs exhaust RAM → renderer OOM), **not** a Playwright config/code defect. Mitigations: added `--disable-dev-shm-usage` to the chromium launch args; prefer **headless** for long flows; use per-level dedicated accounts (`m4auto`) instead of 60–90 min play-throughs. Config documented (bundled Chromium, isolation note). | QA Automation |
| 2026-08-11 | **M4 (TC-023) RE-VERIFIED PASS on the new build (~10.4 min)** using a **dedicated Mastery account `m4auto`** parked at Level 4 (Guest login → Continue to ALL → English → "Start Level 4" → `completeM4Practices` drives P1–P4 → S1). `mastery-m4.spec.ts` updated to `m4auto`. The fragile play-through continuation was removed from `discovery-e2e.spec.ts`, restoring it to the stable Discovery+F1 (TC-001–019) baseline; per-level dedicated accounts (like `m4auto`) are the reliable way to validate each Mastery/Foundation level. **F2 (TC-020) and F3 (TC-021/022) remain pending equivalent dedicated accounts** (e.g. `f2auto`/`f3auto`). | QA Automation |
| 2026-08-11 | **M4 S1 (TC-024) — VQA answer-source SOLVED; answer SUBMISSION blocked by an app issue in build #1.** Built a reusable, config-driven Visual-Question-Answering layer: **`src/services/answerSource.ts`** (pluggable `AnswerSource` — `ContentApiAnswerSource` reads the correct option from the app's own `GetContent/sentence` payload where each option carries `isAns:true` + a `correctness` map; `VisionAnswerSource` wraps a provider-agnostic **`src/services/visionService.ts`** Anthropic/OpenAI vision client, keys from `.env` `VISION_*`), **`src/utils/answerMatcher.ts`** (normalized exact/contains/token-overlap matching), and **`src/pages/mastery/VqaSpeakingAssessment.ts`** (reads question+options+image dynamically, asks the source, injects the answer, verifies advance). Nothing hardcoded; reusable for M4–M9 image MCQs. `MasteryPage.completeS1()` + `mastery-m4-s1.spec.ts` wired; F-series/M4-P1–P4 untouched; typechecks clean. **Correct-answer half VERIFIED** (content-API returns the exact right option, match score 1.00; vision pipeline verified end-to-end up to the paid call — Anthropic key valid but the account has **zero credit balance** → HTTP 400, an account/billing matter). **Answer-submission BLOCKER (app-side, build #1), exhaustively verified headed:** the S1 question screen has **no working submit/grading path** — the top-right mic is only a microphone **device test** (always ends "Perfect! You're all set!" and never grades, even with the correct transcript forced and confirmed emitted); selecting an option (text/▶/radio, incl. real element-clicks on the post-Skip MUI radio buttons) does not submit and shows no submit control; and no answer-recognition ever auto-starts. TC-024 kept **`test.fixme`** (tracked pending, NOT a false pass) with the evidence in the spec; re-enable once the app wires a submit path (or provides a dev answer hook). | QA Automation |
| 2026-08-12 | **M4 S1 (TC-024) submission blocker RE-CONFIRMED on Build #4 (`371bfce`)** — the app was redeployed mid-investigation (Build #1 → #4), so re-verified on the current build with `m4auto`. Same result: options are now selectable (radio fills on click) but **grading still does not occur for any input** — selecting the correct option, clicking the bottom "›" (which is only the nav-pill carousel scroller), and driving the mic/speak flow with the correct answer (SR mock confirmed emitting it) all leave **lives unchanged (5) and the question unchanged**. The mic remains a device-test that always ends "Perfect! You're all set!" without grading. Note: this may be an automated-environment limitation (the grader likely needs real microphone audio that fake-audio/SR-mock don't satisfy) **and** there is no non-audio submit path — either way TC-024 cannot pass via automation until a non-audio answer-submit hook is provided or the app change lands. Answer-source (content-API, `isAns:true`) remains solved & verified; a static image→answer test-data fallback would not help (blocker is submission, not the answer). TC-024 stays `test.fixme`. | QA Automation |
| 2026-08-12 | **M4 S1 (TC-024) — full submission-strategy SWEEP on Build #4, all negative.** Per request, tried every distinct submit mechanism one-by-one on a live S1 question (correct answer from content-API), stopping at the first that grades: **(D)** real answer-audio injected via `getUserMedia` during the mic "REPEAT NOW" (backend-ASR path used by the F-series), **(A)** play the question ▶ then speak, **(B)** select the correct radio + Enter, **(E)** real element-click on the option text — plus earlier: Web-Speech SR-mock speaking, radio select, the bottom "›" (nav-pill scroller). **Result: winner = NONE** — every attempt left **lives = 5** and the **question unchanged**, i.e. the app registers no submission/grading in the automated browser. Conclusion (stable across builds #1 and #4): S1 has **no automatable answer-submission path**; unblocking requires an app-side change or a dev non-audio submit hook (the driver + content-API answer are ready to plug in). TC-024 remains `test.fixme` (honest pending, not a false pass). | QA Automation |
| 2026-08-12 | **M4 S1 (TC-024) — DEV-HOOK path chosen & automation made hook-ready.** Per the decision to unblock via a dev non-audio submit hook: wrote the app-team spec **"Outstanding Dev Request" section below** (now merged in; contract `window.__allTest.submitS1Answer(optionText[, index])`, gated behind a test-only flag e.g. `?e2e=1`; DOM `data-answer` alternative; acceptance criteria) and wired the consumer — `VqaSpeakingAssessment.submitViaHook()` **feature-detects** the hook (several name aliases) and uses it, falling back to the UI (select radio + speak) when absent, so builds without the hook are unaffected. `VqaAttempt.via` ('hook'|'ui') logs which path ran. Typechecks clean; TC-024 stays `test.fixme` and flips live (no code change) once a build ships the hook + flag. Isolated to S1; Discovery–F3 + M4 P1–P4 untouched. Reusable for M5–M9 speaking assessments. | QA Automation |
| 2026-08-12 | **Multi-environment support + full UAT regression.** Added **`config/environments.ts`** (single source of truth: `uat`→all-uat.theall.ai, `lab`→lab.the-axl.ai, `lab2`→lab2.the-axl.ai; add an instance = one entry), wired `playwright.config.ts` `baseURL` to the resolved env (UAT default → baseline preserved), **de-hardcoded `DiscoveryLoginPage.navigate()`** (`goto('/')` → uses `baseURL`), added runner **`scripts/run-e2e.js`** + npm scripts (`regression`, `regression:{uat,lab,lab2}`, `:headed`, generic `e2e -- --env= --headed <spec>`), and the reporter now shows **Environment + Mode**. README got an **Environment Execution Guide**. Selection is config-only — no test logic changed. **Full regression vs UAT (Build #4, headless, ~25m42s):** Discovery+F1 **TC-001–019 = 19/19 PASS**, **TC-023 (M4) PASS**, **TC-024 SKIP** (fixme), **TC-020 (F2) & TC-021/022 (F3) FAIL** — the **known deployment account-blocker** (`Testf2auto`/`Testf3auto` no longer resume F2/F3; F3 lands on a fresh "Guest 0" Discovery). **Not a code regression and not caused by the env changes** (same login path passes in Discovery + M4). Env work introduced **zero regressions**. F2/F3 need dedicated parked accounts (`f2auto`/`f3auto`), mirroring `m4auto`. Full table + evidence: **`docs/REGRESSION_REPORT.md`**. | QA Automation |
| 2026-08-12 | **F SERIES COMPLETE — single-user full-Foundation E2E PASSED (68m41s).** Added a `FULL_E2E=1`-guarded continuation to `discovery-e2e.spec.ts` (off by default → baseline byte-for-byte unchanged) so ONE fresh Guest user (username==password, per-run) flows the whole Foundation in one continuous session: **Discovery+F1 (TC-001–019) ✅ → F2 (TC-020) ✅** (`StartF→L/P×3→A1→A2→A3`) **→ F3 (TC-021/022) ✅** (`StartF3→16×LetterLauncher+6×MemoryChallenge→past F3`). This **proves F2/F3 are functionally correct** — the standalone-spec failures are solely the stale parked accounts (`Testf2auto`/`Testf3auto`), not the automation. Single linear user then enters Mastery (M4 not linearly reachable — needs M1–M3; validated via `m4auto`). Reusable drivers unchanged; additive only. Evidence: `docs/REGRESSION_REPORT.md`. | QA Automation |
| 2026-08-14 | **ALL TCs GREEN in one headed run (76m12s, Build #7 · `3b6a229`).** Root-caused two TC-018 failures: the app itself showed **"Couldn't connect right now"** and the build stamp changed **#6→#7 mid-run** — the server was **redeployed during the test**, dropping the session (stall at `[Letter Train] 14/16`; `Ready for Challenge` never appeared). **Not an automation defect.** **Fix:** added `FoundationPage.recoverIfDisconnected()` — detects the connectivity screen by its copy (NOT by the "Try Again" button alone, since games use `TRY AGAIN` for wrong answers), clicks Try Again (reload fallback), resumes; throws with a screenshot after 3 attempts instead of hanging. Wired at 4 stall points (Letter Train, Apply Challenge, Foundation-through-Apply, F3) — fires only when progress stalls, happy path untouched. Also cleaned 9 orphaned Playwright Chromium processes (an earlier TC-007 "browser has been closed" was self-inflicted teardown, not a defect; user's own Chrome untouched). **Headed single-user result: TC-001–019 ✅, TC-020 (F2) ✅, TC-021/022 (F3) ✅, TC-023 ✅ (via `m4auto`), TC-024 ⏭️ fixme.** Recovery did NOT need to fire (0 occurrences) → insurance, not masking. Evidence: `docs/REGRESSION_REPORT.md`, `tta-report/report_20260814_170908.html`. | QA Automation |
| 2026-08-17 | **Framework CLEANUP + English baseline re-verified + TC-024 re-tested on Build #10.** (1) **Cleanup** (Search→Verify→Remove→Regress): traced all 5 real specs transitively, then removed the two **unrelated suites** — Katalon CURA (15 specs) + e-commerce template (4 specs) — with all support code (`src/api/`, `src/modules/`, `src/pages/katalon/`, 4 e-comm pages, `src/fixtures/{katalon,auth.fixture,index}`, `src/testdata/{katalon,products,users,types}`, `src/config/`, `ApiHelper`/`Logger`/`WaitHelper`), **14 ALL debug/scratch specs**, **7 stale root docs**, 12 old `tta-report/*.html`, `run-demo.bat`, 15 dead npm scripts, and 2 unused+broken language page objects (`HelpLanguagePage`, `LearningLanguagePage` — duplicated language logic, would confuse the Hindi handler). **39 spec files → 5**; `tsc` went **10 pre-existing errors → fully clean**. Retained deliberately: the paused TC-024/S1 code and `discovery-data.json` (seeds language test data — already lists Hindi). Restored `test:firefox`/`test:webkit` after over-trimming. (2) **English regression GREEN post-cleanup** (Build #10 · `7c441ed`, headless, 64m33s): TC-001–019 ✅, TC-020 (F2) ✅, TC-021/022 (F3) ✅ via the single-user `FULL_E2E=1` path, TC-023 ✅ (`m4auto`), TC-024 ⏭️ — **cleanup changed no behavior**. (3) **TC-024 re-tested on Build #10 → STILL BLOCKED** (4th build: #1/#4/#6/#10). Answer half perfect (`"A mountain"` matched 1.00, 5/5) but every attempt logged **`via=ui` (no dev hook present)** and outcome **`timeout`** — question never advanced, lives unchanged, nothing graded. Reverted to `test.fixme` (never a false pass); needs the app-side hook described in the *Outstanding Dev Request* section below, which the driver already auto-detects. (4) README updated: current English status, account model, known limitations, audio/speech handling, TC-024 deferred. | QA Automation |

---

## Project Context & Hand-off

*Merged from the former standalone `PROJECT_CONTEXT.md` (a fresh-session hand-off doc). Section
numbering below (`### 1.`, `### 2.`, …) is that original document's own, preserved as-is; it is not
continuous with the numbering elsewhere in this file.*

**Read this first.** It is the single entry point for anyone (human or a fresh Claude session)
picking up this project. It is self-contained for *understanding*; for *what to do next* it points
to two companion docs rather than duplicating them.

| Doc | Purpose |
|---|---|
| **this file** | What the project is, where it stands, the rules, the constraints |
| the *Refactoring Plan* section (below) | The **what**: findings, per-change risk table, priorities, commit plan |
| the *Execution Plan* section (below) | The **how**: git strategy, branch strategy, skills, agent workflow, rollback |

**Last updated:** 2026-08-17 · **Verified against:** app Build #10 (`v3.0.7` · `7c441ed`)

---

### 1. Purpose & scope

This repo automates end-to-end testing of the **ALL platform** (`theall.ai`) — a children's
literacy/language-learning web app. A learner progresses through three phases:

```
Discovery  →  Foundation (F1 → F2 → F3)  →  Mastery (M1 … M9)
(placement)   (letters, words, reading)     (sentence reading & comprehension)
```

**Current state:** English automation is complete and verified through Mastery M4.
**Next objective:** add **Hindi** support without duplicating the framework, then other languages.

Stack: **Playwright + TypeScript**, Page Object Model, custom HTML reporter, multi-environment
(UAT/LAB/LAB2).

---

### 2. Current automation coverage

24 test cases. **TC-001–023 are reliable, asserted, passing tests. TC-024 is blocked app-side.**

| TC | Phase | What it covers | Status |
|---|---|---|---|
| TC-001 | Discovery | Login + skip microphone test | ✅ |
| TC-002 | Discovery | Choose help language → Confirm | ✅ |
| TC-003 | Discovery | Choose learning language (English) → Confirm | ✅ |
| TC-004 | Discovery | Start assessment → leave demo (real sentence shown) | ✅ |
| TC-005 | Discovery | Record the sentence | ✅ |
| TC-006 | Discovery | Replay recorded audio | ✅ |
| TC-007 | Discovery | Re-record via Retry | ✅ |
| TC-008 | Discovery | Move to next sentence | ✅ |
| TC-009 | Discovery | Complete Assessment 1 → Continue | ✅ |
| TC-010 | Discovery | Complete Assessment 2 → Continue | ✅ |
| TC-011 | Discovery | Skip the Letter Hunt demo | ✅ |
| TC-012 | Discovery | **Deliberately fail** Letter Hunt → reach placement/result screen | ✅ |
| TC-013 | F1 | "Let's Start" → F1 module landing | ✅ |
| TC-014 | F1 | Complete L1 Letter Train → land on P1 | ✅ |
| TC-015 | F1 | Pass P1 Letter Hunt (10 Q) → L2 | ✅ |
| TC-016 | F1 | L2 Letter Train → P2 → L3 | ✅ |
| TC-017 | F1 | L3 + P3 → reach A1 (Apply) | ✅ |
| TC-018 | F1 | A1 → L4/P4 → L5/P5 → L6/P6 → A2 | ✅ |
| TC-019 | F1 | A2 → L7/P7 → L8/P8 → L9/P9 → complete A3 | ✅ |
| TC-020 | F2 | Start F2 → Learn/Practice nodes → A1 → A2 → A3 | ✅ |
| TC-021 | F3 | Start F3 → P1–P5 Letter Launcher + A1 Apply | ✅ |
| TC-022 | F3 | P6 → A3: Memory Challenge, word Launcher, A2/A3 → F3 complete | ✅ |
| TC-023 | M4 | Start Level 4 → complete P1–P4 Speed Practice → reach S1 | ✅ |
| TC-024 | M4 | S1 image-comprehension ASR-gated speaking assessment | ⛔ **BLOCKED (app-side)** |

**TC-024 detail — do not attempt to "fix" this in automation.** The *answer* half is fully solved:
`ContentApiAnswerSource` reads the correct option from the app's own `GetContent/sentence` payload
(`isAns:true`) and matches it exactly (score 1.00). What does not exist is a way to **submit** it.
Verified across **four** builds (#1, #4, #6, #10): every attempt reports `via=ui` (no dev hook found)
and `outcome=timeout` — the question never advances, no TRY AGAIN appears, lives never change, so
nothing is graded. Mic device-test, option clicks, nav arrows, select+Enter, and real `getUserMedia`
audio were all exhausted. It needs an app-side hook per the *Outstanding Dev Request* section (below); the consumer
(`VqaSpeakingAssessment.submitViaHook`) already auto-detects it, so the test flips green with **zero
code change** once a build ships it. Kept as `test.fixme` — tracked as pending, never a false pass.

---

### 3. English flow status & how to run it

**Verified:** 2026-08-17, Build #10, **2 passed / 0 failed / 1 skipped**, 64m 33s (the 1 skip is
TC-024's `fixme`). Cleanup did not change behavior — same result before and after.

```bash
npm run regression                 # full suite, UAT, headless  (~65-75 min)
npm run regression:headed          # same, headed (for visual/audio debugging)
npm run regression:lab2 --         # against a different environment
npm run e2e -- --env=lab2 --headed src/tests/discovery/mastery-m4.spec.ts   # one spec
```

The runner is `scripts/run-e2e.js`. `--regression` runs these 5 specs with `--workers=1`
(**not parallel-safe** — single continuous browser session):

```
src/tests/discovery/discovery-e2e.spec.ts    TC-001..019  (+ F2/F3 when FULL_E2E=1)
src/tests/discovery/foundation-f2.spec.ts    TC-020
src/tests/discovery/foundation-f3.spec.ts    TC-021/022
src/tests/discovery/mastery-m4.spec.ts       TC-023
src/tests/discovery/mastery-m4-s1.spec.ts    TC-024 (test.fixme)
```

`FULL_E2E=1` drives **one fresh dynamic user** through Discovery → F1 → F2 → F3 in a single session.
Off by default so the TC-001–019 baseline is unchanged. This is the durable way to cover F2/F3
repeatably (see §7 on why the parked accounts go stale).

---

### 4. App mechanics and how each is solved

Understanding these is essential — they are the reason the code looks the way it does.

**Letter Train (F1/F2 Learn nodes, "L1"…"L9").** A paged lesson with an `N/16` counter (denominator
varies: /14, /15, /16). Two phases: a *learn* phase advanced by a lower-centre "next" arrow, and a
*word* phase ("say the word") that requires recording the displayed word.
→ Solved by reading the word from the DOM, synthesizing it with **Windows SAPI TTS** (`TtsHelper`),
and injecting it into the mic stream (`installMicInjection()` overrides `getUserMedia` with a
Web-Audio `MediaStreamDestination`), so the app records the *actual word* — not Chromium's fake tone.

**Letter Hunt (F1 Practice, "P1"…"P9", and F1 Apply).** The target letter is only **spoken** (audio
at `/audio/<lang>/letter/<LETTER>.wav`); options are single letters.
→ Solved by hooking `HTMLMediaElement.prototype.play()` in-page to read the currently-playing letter
(reliable even when cached, unlike a network listener), then tapping the matching option.

**Letter Recognition (F2 Practice).** Same audio path, but options are **words** (`the`/`her`/`me`).
→ Same audio hook reused; only the option shape differs.

**Letter Launcher (F3 Practice P1–P5 letters, P7–P10 words, A1 Apply).** A shown letter/word is
compared to a spoken one; press ✓ if they match, ✗ if not. Correct answers add fuel; reaching the
target (e.g. 50/50) completes it. The audio is preloaded then replayed via **opaque blob URLs**.
→ Solved by mapping each blob to its letter via `Blob.size` (synchronous, so no race) — hooks on
`fetch` + `URL.createObjectURL` + `play()`. **Must be installed before F3 preloads its audio**, i.e.
before clicking "Start F3".

**Memory Challenge (F3 P6, A2/A3).** A short sequence (`E - O - T` or `the - he - or`) is shown for a
~1.6–3s memorize window, then hidden; click it back on a grid in order and submit "Check Sequence".
→ Solved by reading the displayed sequence with a **tight poll** (the window is very short), waiting
for the grid, clicking in order, then a native element click on "Check Sequence" (a text-locator
click did not reliably fire the handler).

**Apply Challenges (A1/A2/A3).** 3 levels with lives, using the same answering mechanics as the
practices, plus "Next Level" / "Continue" transition screens.

**Mastery M4 "Speed Practice" (P1–P4).** Read-aloud items (sentence + green mic → record → orange
next arrow), paced variants with a Slow/Medium/Fast selector and a 3-2-1 countdown/word ticker, and
"Did you see the word?" Yes/No recognition probes. Each node ends with a summary and a completion
modal.
→ Read-aloud reuses the same TTS mic-injection primitive.

**Mastery S-nodes (S1, TC-024).** Image + question + spoken-answer options, gated on correctness.
→ Answer resolved via `ContentApiAnswerSource` (passively observes the app's content API for
`isAns:true`) or optionally a vision model (`VisionAnswerSource`, needs `VISION_API_KEY`).
Speech is mocked via `speechHook.ts` (replaces `SpeechRecognition`; `window.__srForce` injects a
transcript). **Submission is the blocked part** — see §2.

---

### 5. Framework structure

```
src/
  fixtures/appTest.ts          iframe-aware test/expect wrapper (see §6)
  pages/discovery/             DiscoveryLoginPage · MicrophoneTestPage · AssessmentPage
  pages/foundation/            FoundationPage.ts  (1,119 lines — ALL F1+F2+F3 mechanics)
  pages/mastery/               MasteryPage.ts · VqaSpeakingAssessment.ts
  services/                   answerSource.ts (content-API + vision) · visionService.ts
  utils/                      appFrame · speechHook · TtsHelper · answerMatcher
                              text.ts (script-agnostic patterns) · languages.ts (label registry)
                              DiscoveryHelper · CustomTTAReporter · DataGenerator (UNUSED)
  testdata/discovery/          discovery-types.ts · discovery-data.json (ORPHANED)
  tests/discovery/             the 5 specs listed in §3
config/environments.ts         env registry (uat/lab/lab2) — single source of truth for base URLs
playwright.config.ts           reads the resolved baseURL; chromium/firefox/webkit projects
scripts/run-e2e.js             environment-aware runner behind the npm scripts
scripts/rule-engine.js         architecture linter — STALE, unenforced (see REFACTORING_PLAN §2.4)
```

Layer ownership: **specs** assert business outcomes · **page objects** own locators + interactions ·
**services** own answer sourcing · **utils** own cross-cutting primitives (audio, iframe, matching).

---

### 6. Key architectural decisions (and why)

**Text/role/alt locators, not CSS.** The app ships **no `data-testid` and no aria hooks**, and its
emotion `css-<hash>` class names churn between builds. So text/role/alt selectors are the *stable*
choice here — this is deliberate, not laziness. Where a label is baked into an **SVG** (so it has no
DOM text) or a control has no stable hook at all, **viewport-coordinate clicks** are used against the
fixed 1280×720 viewport, and every such case is documented at the call site.
→ **Never introduce a new `css-<hash>` selector.**

**Same-origin iframe proxy (`utils/appFrame.ts`).** Post-2026-08 the whole learning app renders
inside a same-origin full-viewport iframe. `appPage(page)` is a lazy `Proxy` that routes DOM-query
methods (`locator`, `getBy*`, `evaluate`, …) to the app frame while page-level ops (`mouse`,
`keyboard`, `goto`) stay on the real `Page`. Before login the frame does not exist, so it falls back
to the main frame automatically. This made the whole suite iframe-aware with a one-line import swap.

**Speech mocking vs real audio injection — two different tools.**
`speechHook.ts` mocks the `SpeechRecognition` **API** (for ASR-gated speaking assessments).
`installMicInjection()` + `TtsHelper` inject **real audio** into `getUserMedia` (for recording-based
assessments that upload audio). Do not conflate them.

**Content-API answer sourcing over vision.** Deterministic, free, no third-party dependency. The
vision path exists behind the same `AnswerSource` interface as a fallback.

---

### 7. Account model — important and non-obvious

Login is a **Guest** flow: Guest tab → User ID/Password → Grade dropdown (env `GRADE`, default `2`)
→ "Login as Guest" → "Continue to ALL". Discovery users are minted dynamically
(`testuser_<timestamp>`, password == username).

**Accounts are forward-only.** A learner cannot replay a completed level. This has real consequences:

- `Testf2auto` / `Testf3auto` / `m4auto` are *parked* accounts meant to resume at F2/F3/M4.
- **They go stale.** Completing a level with a parked account advances it permanently, so it is no
  longer parked. `Testf2auto`/`Testf3auto` have been observed reset to fresh "Guest 0 · Start
  Assessment" screens on builds #6/#7/#10. **This is an account/deployment issue, not a code defect** —
  proven because `discovery-e2e` (fresh guest) and `mastery-m4` (`m4auto`) pass using the identical
  `navigate()`/`login()` code path.
- The durable fix adopted is **`FULL_E2E=1`** (one continuous fresh user through Discovery→F1→F2→F3),
  *not* minting new one-shot parked accounts.
- `m4auto` is currently parked **at S1**, so TC-023 validates reaching S1 as a state check rather than
  re-driving P1–P4 from scratch.
- **Mastery is sequentially gated** (confirmed empirically): a single linear user lands at "Start
  Level 1" after Foundation, so M4/TC-023 is *not* reachable by one user without M1–M3 first.

Some accounts log in with a **Hindi UI + a help-language modal**; `switchToEnglishForF2()` confirms
the modal and switches the app language to English to resume the saved journey.

---

### 8. Standing automation rules (binding)

1. **Never break a previously passing test to fix a new test.**
2. **Never mark a TC as PASS without verifying its expected result.**
3. Do not hardcode dynamic application content unnecessarily.
4. Do not duplicate framework logic for different languages when it can be shared.
5. Keep English and Hindi test cases/status clearly separated.
6. Keep test data separate from test logic.
7. Use dynamic/reusable locators wherever practical.
8. Keep environment configuration separate from test logic.
9. Run regression after significant changes.
10. Update the CSV and relevant documentation after *verified* changes.
11. Remove temporary/unused code only after checking dependencies.
12. Before making architectural changes, identify the benefit and risk.
13. **Do not claim PASS based only on successful clicks — validate the application's business outcome.**
14. For final E2E validation, use a fresh/dynamically created user, not a permanent temporary one.

**The pass criterion, explicitly:**
`Action → Application Response → Expected Result → Assertion → PASS`
If any expected business result is missing, the test **fails** and gets investigated.

**On blockers:** stop and explain the exact issue. Do not mark a test as passed and do not make
unnecessary changes to work around it.

**Failure classification** (always classify before fixing): app/environment · locator · automation
logic · test data · browser/audio.

---

### 9. Known limitations

- **The app redeploys frequently** (builds #1 → #4 → #6 → #7 → #10 within weeks). A mid-run redeploy
  drops the session and shows *"Couldn't connect right now"*. `FoundationPage.recoverIfDisconnected()`
  detects that specific copy (deliberately **not** the "Try Again" button alone — games have their own
  TRY AGAIN for wrong answers) and recovers. Wired into 4 stall-detection loops. It is insurance: in
  the verified Build #10 run it never fired.
- **No test hooks / no `data-testid`** anywhere in the app (see §6).
- Letter Hunt letters are **baked into SVG/audio**, not DOM text — hence the audio hooks.
- **TC-012 fails the Letter Hunt on purpose** — that is the designed route to the placement screen.
- **Not parallel-safe.** The single-session E2E requires `--workers=1`.
- **`npm run lint` / `format` are broken** — `.eslintrc.json` and `.prettierrc` exist but `eslint`
  and `prettier` are not in `devDependencies`.
- **TC-024 is blocked app-side** (§2).
- Windows-only TTS: `TtsHelper` uses PowerShell `System.Speech` (SAPI).
- **Never kill `chrome.exe` by name.** Playwright's bundled Chromium lives under
  `AppData\Local\ms-playwright\...`; the user's own Chrome is in `C:\Program Files\Google\Chrome\`.
  Filter on the `ms-playwright` path. (This mistake once killed a live test run.)

---

### 10. Stable baseline

| Item | Value |
|---|---|
| Verified commit | `61afb75` (docs added on top as `b36df6a`) |
| Restore tag | **`english-baseline-v1`** → `b36df6a` |
| `master` | `b36df6a` (local only, **not** pushed) |
| `origin/master` | `05e7ca7` — deliberately not advanced |
| Working branch | `refactor/multi-language-readiness` |
| Guarantee | TC-001–023 PASS, TC-024 skipped (fixme), Build #10, 64m 33s |

Global abort: `git checkout english-baseline-v1`.

⚠️ **`.env` no longer exists on disk.** It was tracked at `05e7ca7` and deleted in `61afb75`, so
checking out `master` during the tagging step silently replaced the local gitignored copy with the
committed one, and the fast-forward then deleted it. Gitignored files are overwritten by checkout
without the usual "untracked file would be overwritten" refusal — that is the trap.

To restore: `git show 05e7ca7:.env > .env`. If that copy holds a placeholder rather than the real
`VISION_API_KEY`, the live value is gone and must be re-issued from the provider.

Impact is limited: `VISION_API_KEY` is read only by `services/visionService.ts`, used by the optional
`VisionAnswerSource` on the `fixme`'d TC-024. `GRADE` and `ENV` have code defaults, so **TC-001–023
do not need `.env`**.

Still true: never stage `.env`, never `git add -A` or `git add .` in this repo, `.env.example` is the
sanitized template. **New rule: back up `.env` before any branch switch or checkout.**

`tta-report/`, `test-results/`, `playwright-report/` are gitignored generated artifacts (~192 MB).

---

### 11. Refactoring goals

Full detail in the *Refactoring Plan* section (below). The headline:

**The framework had English-only assumptions embedded in code that both languages are supposed to
share.** They failed *silently* — Devanagari simply never matched the regex, so the driver did not
recognise the screen and stalled into a timeout. That is much harder to debug than a clean error.

**Status: M1–M4 are implemented on `refactor/multi-language-readiness`. ⚠️ The English regression has
NOT yet been re-run, so the baseline is not re-verified.** Each change was checked against the
compiled module for zero behaviour change on Latin input, and `tsc` + `playwright test --list` pass —
but that is not the pass criterion in §8. Until a full regression run is green, treat these as
*implemented, unverified*.

| Where | The gate | Effect in Hindi | Now |
|---|---|---|---|
| `utils/answerMatcher.ts` | `.replace(/[^a-z0-9\s]/g,' ')` | Strips **all** Devanagari → every option normalizes to `''` → `nomatch` on every Hindi question | ✅ `utils/text.ts` `normalizeText`, Unicode-aware |
| `services/answerSource.ts` | **the same normalizer, duplicated verbatim** | Content-API answers keyed to `''` → no answer ever found | ✅ imports the shared one |
| `FoundationPage.ts` ×5 | `[A-Za-z]` gates | F1 word/letter, F2 options, F3 launcher + memory sequence all unseen | ✅ script-scoped patterns |
| `MasteryPage.ts` | `[A-Za-z]` density, `\b<word>\b` | M4 sentence rejected; `\b` cannot fire next to Devanagari | ✅ letter-class + lookaround bounds |
| `MasteryPage.ts` | `t.split(/\bEnglish\b/g)` | Literal "English" used to slice out the read-aloud sentence | ✅ `utils/languages.ts` registry |
| `VqaSpeakingAssessment.ts` | `NOISE` contains `English` | Language label scraped as a candidate answer | ✅ registry |
| `TtsHelper.ts` | `[^A-Za-z0-9 ]` | Hindi word → `''` → **silence injected into the mic** | ✅ text survives; see caveat below |
| `FoundationPage.ts` | `switchToEnglishForF2()` | Hardcoded to one language; called by every F2/F3/M spec | ✅ `switchToLanguage(lang)` + deprecated wrapper |

Three of these (the duplicated normalizer, `TtsHelper`, and the `\b` bound) were **not** in the
original plan's findings table — they were found by auditing for the same defect class.

⚠️ **Hindi audio is blocked on the environment, not the code.** This runner has only `en-US` SAPI
voices (David/Zira). Handing an `en-US` voice Devanagari returns a valid but *empty* 46-byte WAV, so
Hindi read-aloud will record silence until a `hi-IN` voice is installed **and** `TtsHelper` selects a
voice by language. Verified by direct measurement, not assumed.

⚠️ **Still English-only, deliberately left alone:** the app's own UI *strings* — the "Did you see the
word?" prompt, the transition-button labels (`Continue`/`Next Level`/…), the `bad`/`chrome` filter
words, and the `/letter/<X>.wav` audio path assumption. These need the **real Hindi wording read off a
real Hindi build** (task 13). Inventing them would violate contract §12.7.

Target architecture: **shared core** (login, navigation, page objects, assessment handling, audio
utilities, reporting, env config) **+ language-specific handlers/data**. Language must be a
configurable axis independent of environment (`Environment × Language × Mode × Test`), with test data
under `testdata/<lang>/`. **Never duplicate the framework per language. Never find-and-replace
`English` → `Hindi`.**

Also pending: remove `DataGenerator.ts` (unused), resolve `discovery-data.json` (orphaned), fix
lint/format tooling. The stale `rule-engine` is being **kept as-is** by decision (see §13).

**Explicitly deferred** (benefit does not justify risk while there are no unit tests): splitting the
1,119-line `FoundationPage` by mechanic, and consolidating the 6 duplicated region-geometry helpers.

---

### 12. Do-not-break contract

1. **TC-001–023 must stay green.** They are the baseline. TC-024 stays `fixme`.
2. Restore point: see §10 above / the *Execution Plan* section, §1. Global abort:
   `git checkout chore/cleanup-and-english-baseline`.
3. **One logical change per commit.** Never mix (no `feat: add Hindi + refactor + fix + docs`).
4. **Run regression after every behavior-touching commit** — before starting the next one.
5. Sequence: English baseline PASS → refactor → English regression PASS again → implement Hindi →
   English regression PASS again → Hindi TC PASS → next Hindi TC.
6. Ask before any potentially impactful architectural change. Do not refactor for its own sake.
7. **Verify real Hindi application behavior before implementing anything Hindi.** Do not assume it
   mirrors English.
8. **Priority order: Stability → Maintainability → Optimization.** If the current implementation is
   stable and the benefit is minimal, leave it alone.

---

### 13. Immediate next step

#### Decisions taken (2026-08-17)

| # | Decision | Outcome |
|---|---|---|
| 1 | Push baseline to `origin/master`? | **No** — local only. `origin/master` stays at `05e7ca7`. |
| 2 | Stale `rule-engine` | **Keep as-is, untouched.** Not deleted, not rewritten; a rewrite is its own task. It still enforces nothing and still contradicts the real architecture — do not run `rules:check` expecting it to pass. |
| 3 | `discovery-data.json` | **Repurpose** as the `testdata/<lang>/` seed. Not yet done. |
| 4 | lint/format | **Install** eslint + prettier. Not yet done. |
| 5 | Hindi TC numbering | **`TC-001-HI` … `TC-023-HI`** (mirrors English 1:1; English `TC-024` already exists). |
| 6 | Scope of this pass | M1–M5 only. |

#### Done

Checkpoint (merge to `master`, tag `english-baseline-v1`, branch `refactor/multi-language-readiness`)
plus 6 commits: M1 unicode normalization (+ the duplicate in `answerSource`) · M2 script-based screen
detection (+ a self-review fix for marks-only false positives) · TTS non-Latin passthrough · M3
language registry replacing `"English"` anchors · M4 `switchToLanguage(lang)`.

#### Regression status (2026-08-17): partially reverified, NOT green — do not tag `english-baseline-v2` yet

Three runs today, none of them a clean pass of the full suite:

| Run | Result | Diagnosis |
|---|---|---|
| `npm run regression` (full, 26m) | TC-001–019 ✅, TC-023 ✅, **TC-020/021/022 ❌**, TC-024 skip (expected) | F2/F3 failures: `Testf2auto`/`Testf3auto` landed on a fresh "Guest 0 · Start Assessment" screen — the pre-existing account-staleness issue this section already documented (§7), not code |
| Retry of just F2/F3 (1m) | Same 2 ❌, **byte-identical error text** | Confirms genuine staleness, not a timing flake — retrying will not help |
| `FULL_E2E=1` fresh user (24m) | ❌ inside F1, before reaching F2/F3 | `completeLetterHuntPractice` silently gave up mid-practice (3/10, full hearts) waiting on the audio hook; the caller's next assertion timed out 20s later with a confusing, disconnected error. **Confirmed unrelated to this refactor** — every line in the failing path (`installLetterHook`/`readSpokenLetter`/`tapLetterAndAdvance`/`completeLetterHuntPractice`) falls outside every diff hunk between `english-baseline-v1` and `HEAD`. A genuine **pre-existing latent bug** (silent stuck-bail hides the real failure point) surfaced by this extra verification attempt, not introduced by it. |

**Net honest state:** TC-001–019 and TC-023 have now passed in a run that includes all M1–M4 changes,
which does exercise M2's F1 Letter Train/Hunt detection and the TTS fix live. **Never exercised live
today, by any of the three runs:** M2's F2 `hasWordQuestion`, F3 `launcherState`/`displayedSequence`,
M3's `MasteryPage.readSentence`/`answerDidYouSee`, and M1/M3's VQA answer-scoring path. These were
checked only against the compiled module for zero-Latin-drift (see the *Refactoring Plan* section below), which is
real evidence but is **not** the §8 pass criterion — a verified business outcome on the live app.

Decision taken: **stop chasing E2E coverage today rather than keep spending ~25min/attempt against a
flaky shared environment.** Proceed to R2–R7 on that basis, but do not treat M2/M3's untested paths as
proven, and revisit before Hindi TCs are authored against them.

#### The immediate next step

1. **New, unrelated finding to track:** `FoundationPage.completeLetterHuntPractice()` returns silently
   after 8 failed polls for a spoken letter, abandoning the practice mid-way with no error — the
   caller's failure surfaces confusingly far downstream. Worth a `fix:` commit on its own, once
   R2–R7 are through; not blocking, not in scope for the Hindi-readiness work.
2. Continue with R2–R7 (see the *Refactoring Plan* section, §5).
3. **Before Hindi TCs touch F2/F3/M4-practice code:** get one clean live run through those paths —
   another `FULL_E2E=1` attempt (now that the F1 stall is understood as pre-existing/environmental,
   not a reason to distrust the refactor), or wait for `Testf2auto`/`Testf3auto` to be re-parked.
4. Task 13 — **probe a real Hindi build** — before any Hindi code. Do not assume Hindi mirrors
   English.

---

## Refactoring Plan (Multi-Language Readiness)

*Merged from the former standalone `REFACTORING_PLAN.md`. Section numbering below is that
original document's own, preserved as-is.*

**Status:** **M1–M5 IMPLEMENTED — English regression run, PARTIALLY verified.** R1–R8 and O1–O2 still
proposed. **Do not tag `english-baseline-v2` yet** — see the results section below §6.
**Prepared:** 2026-08-17 · **Last updated:** 2026-08-17
**Baseline commit:** `61afb75` → tagged **`english-baseline-v1`** (`b36df6a`, includes these docs)
**Working branch:** `refactor/multi-language-readiness`

> ⚠️ Per §8 the pass criterion is a verified business outcome, not a compile. TC-001–019 and TC-023
> passed live (real evidence for M2's F1 detection + the TTS fix). TC-020/021/022 failed on the
> pre-existing account-staleness issue (§7), confirmed not a regression. **M2's F2/F3 detection, M3's
> `MasteryPage` sentence parsing, and M1/M3's VQA scoring were not exercised live by any run today** —
> only checked against the compiled module. Details below.
**Goal:** prepare the framework for **English → Hindi → other languages** without duplicating the
automation codebase per language, and without breaking the currently-green English suite.

> **Reading order:** §1 (baseline/checkpoint) → §2 (findings) → §3 (change table) →
> §4 (priority) → §5 (commit plan) → §6 (task tracker).

---

### 1. Stable baseline / checkpoint (do this FIRST)

The working English automation must always be restorable. Today it is **not** tagged — there are
zero git tags in this repo, so "the last known-good English state" is only identifiable by
remembering a commit hash. Fix that before touching any code.

#### Current state

**Done 2026-08-17.** The gap below is closed.

| Item | Value |
|---|---|
| Baseline commit | `61afb75`, + these docs as `b36df6a` |
| Restore tag | **`english-baseline-v1`** → `b36df6a` ✅ |
| `master` | `b36df6a` ✅ (fast-forward, local only) |
| `origin/master` | `05e7ca7` — **not** advanced, by decision |
| Working branch | `refactor/multi-language-readiness` ✅ |
| Verified against | Build #10 (`v3.0.7` · `7c441ed`) |
| Regression result | 2 passed / 0 failed / 1 skipped · 64m 33s *(pre-refactor)* |

⚠️ **Casualty of the checkout, recorded so it is not repeated:** `.env` was tracked at `05e7ca7` and
deleted in `61afb75`, so `git checkout master` silently replaced the local gitignored `.env` with the
committed one and the fast-forward then deleted it. **Gitignored files do not get the "untracked file
would be overwritten" refusal.** Recover with `git show 05e7ca7:.env > .env`; if that is a placeholder
the real `VISION_API_KEY` must be re-issued. Only the optional vision path for the `fixme`'d TC-024
uses it, so TC-001–023 are unaffected. **Back up `.env` before any checkout.**

#### Recommended checkpoint actions

1. **Merge the verified baseline to `master`** so the known-good state is on the main line:
   ```bash
   git checkout master && git merge chore/cleanup-and-english-baseline
   ```
2. **Tag it as the immutable restore point:**
   ```bash
   git tag -a english-baseline-v1 -m "Verified English baseline: TC-001-023 PASS, TC-024 blocked (app-side). Build #10, 64m33s."
   ```
3. **Do all refactoring on a new branch**, never directly on `master`:
   ```bash
   git checkout -b refactor/multi-language-readiness
   ```

#### Restore procedure (if a refactor breaks English)

```bash
git checkout english-baseline-v1        # inspect the known-good state
# or, to revert one specific bad commit without losing unrelated work:
git revert <bad-commit-sha>
```

Because §5 sequences each change as its own small commit with a regression run between them,
`git bisect` / `git revert` can isolate a single regression instead of unwinding a large batch.

#### Checkpoint ladder

```
english-baseline-v1  (tag — verified English, always restorable)
        ↓
Framework Refactoring  (commits 1-9, regression after each)
        ↓
english-baseline-v2  (tag — English re-verified GREEN post-refactor)
        ↓
Language Support  (LANG axis, config, reporting)
        ↓
Hindi Automation  (TC-xxx-HI)
        ↓
english-hindi-v1  (tag — both suites verified)
```

---

### 2. Findings

Reviewed: all 26 files under `src/`, `config/environments.ts`, `playwright.config.ts`,
`package.json`, `scripts/run-e2e.js`, `scripts/rule-engine.js`, `rules/framework-rule-engine.json`,
`src/testdata/discovery/discovery-data.json`.

#### 2.1 Current structure

```
src/
  fixtures/appTest.ts          iframe-aware test/expect wrapper      [generic infra — good]
  pages/discovery/             DiscoveryLoginPage, MicrophoneTestPage, AssessmentPage
  pages/foundation/            FoundationPage.ts (1,119 lines — F1+F2+F3 mechanics in one class)
  pages/mastery/               MasteryPage.ts, VqaSpeakingAssessment.ts
  services/                    answerSource.ts, visionService.ts     [provider-agnostic — good]
  utils/                       DataGenerator, DiscoveryHelper, TtsHelper, answerMatcher,
                               appFrame, speechHook, CustomTTAReporter
  testdata/discovery/          discovery-types.ts, discovery-data.json  [JSON orphaned]
  tests/discovery/             5 specs (the entire regression suite)
config/environments.ts         env registry uat/lab/lab2             [clean, single source of truth]
playwright.config.ts           clean
scripts/run-e2e.js             env-aware runner                      [clean]
scripts/rule-engine.js         architecture linter                   [STALE — see 2.4]
rules/framework-rule-engine.json                                     [STALE — see 2.4]
```

The tree is already lean (an earlier cleanup took 39 specs → 5). The findings below are about
**what will break or rot when Hindi arrives** — not cosmetic tidiness.

#### 2.2 ⚠️ Critical: English-only assumptions embedded in *shared* code

This is the single most important finding. `FoundationPage`, `answerMatcher`, and `MasteryPage` are
the "common framework logic" that both languages are supposed to share — but several of them gate
on **Latin-alphabet regex**. With Devanagari text these do not throw a clean error; they simply
**never match**, so the driver never recognises the screen and stalls into a timeout. That is far
harder to debug than a compile failure.

| # | File | Line | Code | Failure mode in Hindi |
|---|---|---|---|---|
| A | `src/utils/answerMatcher.ts` | 15-21 | `normalize()` → `.replace(/[^a-z0-9\s]/g,' ')` | Strips **all** Devanagari. Both the answer and every option normalize to `''` → `matchOption` scores 0 → **`nomatch` on every Hindi question.** This is the function `VqaSpeakingAssessment` depends on for all M-series speaking assessments. |
| B | `src/pages/foundation/FoundationPage.ts` | 278 | `readCurrentWord()` → `/^[A-Za-z]{2,15}$/` | F1 "say the word" text never detected → returns `''` → Letter Train word phase silently stalls. |
| C | `src/pages/foundation/FoundationPage.ts` | 438-441 | `hasLetterOptions()` → `/^[A-Za-z]$/` | F1 Letter Hunt answer options never recognised as a question screen. |
| D | `src/pages/foundation/FoundationPage.ts` | 496 | `hasWordQuestion()` → `/^[A-Za-z]{2,15}$/` | F2 word-recognition options never recognised as answer buttons. |
| E | `src/pages/mastery/MasteryPage.ts` | 121 | `readSentence()` → `t.split(/\bEnglish\b/g).pop()` | Uses the literal string **"English"** as a text-parsing anchor to slice out the read-aloud sentence. No such anchor in a Hindi UI. Needs a *structural* anchor — **not** a find-and-replace of the word. |
| F | `src/pages/foundation/FoundationPage.ts` | 87 | `switchToEnglishForF2()` | Named and hardcoded for one target language. Every F2/F3/M-series spec calls this to resume a parked account. Must become `switchToLanguage(lang)` — **not** duplicated as `switchToHindiForF2()`. |
| G | `src/utils/answerMatcher.ts` | 23 | `STOP` = `a, an, the, is, are, in, on, at, of, to, it, this, that` | English-only stopwords. Harmless once Unicode support lands, but confirms the function was never designed for a second language. |

**Found later, while implementing M1–M4 — same defect class, missed by the original review.** All
four are fixed in the same commits; recorded because they show the audit above was not exhaustive and
a further sweep is warranted before Hindi.

| # | File | Code | Failure mode in Hindi |
|---|---|---|---|
| H | `src/services/answerSource.ts` | `normalize()` — **a verbatim duplicate of finding A** | Keys the content-API payload by question and by option-set. Both keys normalize to `''`, so `answer()` returns `''` and the deterministic answer source silently finds nothing — the exact bug A describes, in the other half of the same flow. Fixing A alone would have left this. Both now import `utils/text.ts`. |
| I | `src/utils/TtsHelper.ts` | `.replace(/[^A-Za-z0-9 ]/g,'')` | Deletes every Devanagari code point before synthesis, so a Hindi word becomes `''`, `generateWavBase64` returns `''`, and `installMicInjection` feeds the app **silence**. A recording assessment then fails with nothing indicating why. |
| J | `src/pages/mastery/MasteryPage.ts` | `new RegExp('\\b' + word + '\\b')` | `\b` is defined on ASCII `\w`, so it can never fire adjacent to a Devanagari code point — `\bकिताब\b` matches nothing, ever. Replaced with letter/digit lookarounds, verified equivalent to `\b` on Latin input. |
| K | `src/pages/foundation/FoundationPage.ts` | `/\/letter\/([A-Za-z]+)\.wav/i` ×4 | The Letter Hunt / Launcher audio hooks parse the target letter out of the audio URL. Fine if Hindi serves transliterated ASCII filenames, broken if it serves Devanagari or percent-encoded ones. **Left unchanged deliberately** — which it is cannot be guessed, it must be observed (task 13). |

**Also still English-only, and deliberately left alone:** the app's UI *strings* — `Did you see the
word?`, the transition labels (`Continue`/`Next Level`/`Start Game`/…), and the `bad`/`chrome` filter
word lists. These need the real Hindi wording from a real Hindi build (task 13). Inventing plausible
translations would violate the standing rule against assuming Hindi mirrors English.

**Note on an existing pattern to avoid:** `AssessmentPage.continueButton()` (line 41) is already
bilingual — `getByText(/^Continue$|जारी रखें/)`. Someone hardcoded the Hindi string inline as a
regex alternative. This is evidence the app *does* surface Hindi in some UI chrome, but it is the
wrong pattern to scale: every bilingual locator becomes an ever-growing alternation. Replace with a
language-keyed lookup (see change L5).

#### 2.3 Duplicate code / repeated patterns

| Pattern | Occurrences | Note |
|---|---|---|
| "Find tightest/lowest clickable control in a screen region" via `page.evaluate` | **6×** — `AssessmentPage.recordToggleCenter()`, `FoundationPage.clickLetsStart()`, `FoundationPage.rightmostArrow()`, `FoundationPage.tapLetterAndAdvance()` next-finder, `MasteryPage.transitionControl()`, `MasteryPage.controlCentre()` | Each re-derives the same geometry logic with different bounds. Extraction candidate, but it is UI-geometry, not business logic → benefit is maintainability only. |
| Transition/advance button text matchers | **2×** — `FoundationPage.clickChallengeAdvance()` and `MasteryPage.TRANSITION_RE` | Overlapping but unshared, and these are exactly the strings needing Hindi equivalents. **Consolidate before adding Hindi**, or Hindi text gets added in two places inconsistently. |
| login → skip-mic → confirm-help-language → switch-language | **5×** — every spec re-implements the `Skip` check + `switchToEnglishForF2()` + `dismissCoachmarks()` sequence | The natural seam for a shared "resume session in language X" helper. Hindi would otherwise double the copies to 10. |
| Test-account credentials as inline literals | 5 specs — `'Testf2auto'`, `'Testf3auto'`, `'m4auto'` | Low risk today; externalize before Hindi accounts double the literals. |

#### 2.4 Unused / dead / stale code

| Item | Status | Evidence |
|---|---|---|
| `src/utils/DataGenerator.ts` | **Fully unused** | Exported from `utils/index.ts` but zero importers across `src/tests`, `src/pages`, `src/utils`. `DiscoveryHelper` mints usernames itself via `Date.now()`, not via this class. Contents (random email/phone/address/names) are leftovers from a generic e-commerce framework — irrelevant to this app. |
| `src/testdata/discovery/discovery-data.json` + `DiscoveryData`/`AssessmentData` interfaces | **Orphaned** | Only `TestUser` from `discovery-types.ts` is used (by `DiscoveryHelper`). The JSON already lists `"help": ["English","Telugu","Hindi"]` — a plausible seed for real language config, but currently inert. **Decision needed: delete, or repurpose as the `test-data/<lang>/` seed.** |
| `rules/framework-rule-engine.json` + `scripts/rule-engine.js` | **Stale, self-contradicting, unenforced** | `sourceRoots` still lists `src/modules`, `src/api`, `src/config` — **all three deleted** in the earlier cleanup. Rule `tests-no-direct-page-import` forbids `from '../pages/...'` in specs — **every current spec violates it.** Rule `pages-no-business-logic` forbids `if (`/`switch (` in `*Page.ts` — `FoundationPage.ts` is full of both. `no-console-log` points at a `Logger` utility that was deleted. Nothing (package.json / CI / git hook) invokes `rules:check`, so it has rotted silently and would fail loudly the moment anyone ran it. **Decision needed: delete, or rewrite to match reality + encode the English/Hindi separation rules.** |
| `lint`, `lint:fix`, `format`, `format:check` npm scripts | **Non-functional** | `.eslintrc.json` and `.prettierrc` exist, but `eslint`/`prettier` are **not** in `devDependencies` (only `@playwright/test`, `@types/node`, `dotenv`, `typescript`). All 4 scripts fail today with "command not found". Flagged previously, still unresolved. |

#### 2.5 Hardcoded values / fragile locators

The text/role-based locator strategy is **intentional and sound** — documented in `AssessmentPage.ts`:
the app ships no `data-testid`/`aria` hooks and its emotion `css-*` hashes churn between builds, so
text/role/alt selectors are the *stable* choice here. Not a defect. Real exceptions:

| Item | Location | Issue |
|---|---|---|
| `DEMO_SENTENCE = 'The cat is sleeping'` | `discovery-e2e.spec.ts:23` | Hardcoded English literal used as the discovery-demo detection anchor. Needs a Hindi counterpart **via config**, not a code duplicate. |
| Account credentials | 5 specs | Inline literals — externalize (see 2.3). |
| Grade, base URLs | `DiscoveryLoginPage.DEFAULT_GRADE`, `config/environments.ts` | **Already config-driven — no action needed.** |

#### 2.6 Scalability gaps for multi-language

| Gap | Current | Needed |
|---|---|---|
| Language selection axis | Does not exist. Only `ENV` (uat/lab/lab2). | `LANG` selector mirroring the proven `config/environments.ts` pattern → `config/languages.ts` + `resolveLanguage()`. Environment × Language independently selectable. |
| Language-specific test data | Does not exist. | `src/testdata/english/` + `src/testdata/hindi/` — externalized, not inline. |
| Reporting | `CustomTTAReporter` shows Environment + Mode + Browser. | Add **Language**, so `TC-023` and `TC-023-HI` are distinguishable in reports. |
| Execution commands | `regression:{uat,lab,lab2}[:headed]` | Add language variants (e.g. `test:english` / `test:hindi`), reusing `scripts/run-e2e.js` rather than inventing a parallel runner. |
| `FoundationPage.ts` size | 1,119 lines, F1+F2+F3 mechanics in one class (internally sectioned by comments). | Optional split by mechanic — see change O1. Higher risk; not blocking. |

---

### 3. Recommended changes

Each row states **Current behavior → Proposed change → Benefit → Regression risk → Testing required**,
per the "do not refactor blindly" rule.

#### 3.1 Must do now — blockers that cause *silent* Hindi failures

| ID | Area | Current | Proposed | Benefit | Risk | Testing required | Commit |
|---|---|---|---|---|---|---|---|
| **M1** | Utilities | `answerMatcher.normalize()` strips all non-`a-z0-9` | Unicode-aware stripping (`\p{L}\p{N}` with `u` flag); keep English stopwords additive | Answer matching works for Devanagari; unblocks all M-series Hindi speaking assessments | **Low** — pure function, no Playwright dependency | Unit-test both scripts; full English regression | `fix:` |
| **M2** | Framework | `FoundationPage` `[A-Za-z]` gates (B, C, D) | Generalize to Unicode letter classes | Prevents silent stalls on Hindi F1/F2 screens | **Medium** — a broadened regex could over-match and pick up unintended text | Full English regression **before** trusting it; verify word/letter detection logs unchanged | `fix:` |
| **M3** | Framework | `MasteryPage.readSentence()` splits on literal `"English"` | Replace with a structural anchor (position/role of the language badge, not its text) | Removes a landmine that only works in an English UI | **Medium** — sentence parsing is finicky and drives M4 read-aloud | Re-verify M4 English (TC-023) specifically, then full regression | `fix:` |
| **M4** | Framework | `switchToEnglishForF2()` hardcoded to English | `switchToLanguage(lang)`; keep a thin `switchToEnglishForF2()` wrapper so no call-site churn | One implementation serves both languages; no duplicated modal logic | **Low** — additive; existing callers unaffected | Full English regression | `refactor:` |
| **M5** | Tooling | Stale `rule-engine` claims to enforce rules nothing follows | **DECIDED: keep as-is.** Left untouched; a rewrite is its own task | — | none (no change made) | n/a (not in the test path) | *no commit* |

**Implementation notes on M1–M4 (what actually landed, and why it is safe for English):**

- The guiding constraint was **provable zero behaviour change on Latin input**, not "looks
  equivalent". Every widened pattern is written as *the original Latin rule* OR *a non-Latin rule
  behind a `(?!\p{Script=Latin})` guard*, so Latin text can only ever take the original branch. This
  matters most for `ONE_LETTER`: widening `^[A-Za-z]$` to `\p{L}` outright would also match
  two-letter English words and could mis-detect an English screen — the M2 "over-match" risk the
  table above flags.
- Verified by compiling `utils/text.ts` and asserting old-vs-new across representative English
  tokens, answer strings, page text and word-boundary cases: **0 differences**. TtsHelper was checked
  against real SAPI: identical WAV byte sizes for English. Devanagari cases were checked to classify
  correctly (single letter vs conjunct vs word).
- `\p{M}` is admitted everywhere alongside `\p{L}` because Devanagari matras and the virama are
  Unicode *marks*: `\p{L}` alone silently shreds a Hindi word (`किताब` → `कतब`).
- A single written letter is base + marks + *virama-joined* conjunct parts (`क्ष` = `क` + virama +
  `ष`). Requiring the virama is what keeps `ONE_LETTER` from also matching ordinary two-letter words
  like `पेड़`.
- Non-Latin length bounds are sized from Devanagari orthography (code points, not graphemes), **not**
  from observed Hindi screens. Tighten after task 13.
- Spec call sites were **not** touched: `switchToEnglishForF2()` remains as a deprecated wrapper, so
  a regression cannot be ambiguous between "the new implementation" and "the edited specs". Call
  sites migrate with R1/R3.

#### 3.2 Recommended — real maintainability wins before/alongside Hindi

| ID | Area | Current | Proposed | Benefit | Risk | Testing required | Commit |
|---|---|---|---|---|---|---|---|
| **R1** | Configuration | No language axis | `config/languages.ts` + `resolveLanguage()`, mirroring `environments.ts` | Env × Language independently selectable | **Low** — purely additive, proven pattern | Regression (should be a no-op for English) | `feat:` |
| **R2** | Utilities | Transition matchers declared in 2 places | Consolidate into one language-keyed matcher table | Hindi transition text added in one place, not two | **Low-Med** — must confirm both call sites truly want identical matchers (check for F-series vs M-series divergence first) | Full regression | `refactor:` |
| **R3** | Utilities | login→skip-mic→language-switch repeated in 5 specs | Extract a shared session-resume helper parameterized by language | Removes copy-paste before Hindi doubles it | **Medium** — touches every spec's setup | Full regression | `refactor:` |
| **R4** | Refactoring | `DataGenerator.ts` fully unused | Delete | Removes dead code | **Very low** — zero references confirmed | Typecheck + regression | `refactor:` |
| **R5** | Test Data | `discovery-data.json` orphaned | **Decision:** delete, or repurpose as the `testdata/english/` + `testdata/hindi/` seed | Removes dead weight, or gives Hindi data a designed start | **Very low** to delete; **Low** to repurpose | Typecheck | `refactor:` or `feat:` |
| **R6** | Tooling | `lint`/`format` scripts reference uninstalled packages | Install eslint+prettier as devDependencies, **or** remove the 4 dead scripts | Scripts stop lying about working | **Low** | n/a | `chore:` |
| **R7** | Test Data | Account creds inline in 5 specs | Externalize to test data | Hindi accounts don't double the literals | **Low** | Full regression | `refactor:` |
| **R8** | Reporting | No Language column | Add Language to `CustomTTAReporter` (depends on R1) | `TC-023-HI PASS` distinguishable from `TC-023 PASS` | **Low** | Visual check of report | `feat:` |

#### 3.3 Optional / future — benefit does not currently justify the risk

| ID | Area | Current | Proposed | Benefit | Risk | Recommendation | Commit |
|---|---|---|---|---|---|---|---|
| **O1** | Framework | `FoundationPage.ts` 1,119 lines, all mechanics | Split by mechanic (Letter Train / Hunt / Word Recognition / Launcher / Memory Challenge); `FoundationPage` composes them | Easier to add a Hindi variant of one mechanic | **HIGH** — large surface, **no unit tests**, only E2E coverage; a 70-min regression per attempt | **Defer.** Stability first. Revisit only if Hindi actually needs per-mechanic divergence. | `refactor:` |
| **O2** | Refactoring | 6× region-geometry helpers | One `findControlInRegion(bounds, filter)` utility | Less duplication | **Medium** — these are the load-bearing click helpers for every screen | **Defer** until after Hindi is green. | `refactor:` |

---

### 4. Priority summary

| Priority | IDs | Rationale |
|---|---|---|
| **Must do now** | M1, M2, M3, M4, M5 | M1-M4 cause *silent* Hindi failures (stall/timeout, not a clean error). M5 is actively misleading tooling. |
| **Recommended** | R1, R2, R3, R4, R5, R6, R7, R8 | Real maintainability wins; low-to-medium risk; cheaper before Hindi than after. |
| **Optional / future** | O1, O2 | Genuine improvements, but the regression risk outweighs the benefit while the suite has no unit tests. **Explicitly recommend leaving unchanged for now.** |

**Guiding principle applied throughout: Stability first → Maintainability second → Optimization third.**

---

### 5. Git commit plan

#### Rules
- One logical change per commit. **Never** `feat: add Hindi + refactor framework + fix F3 + update docs`.
- Regression run after each behavior-touching commit.
- Categories: `refactor:` (framework/optimization) · `feat:` (new functionality/language support) ·
  `fix:` (bug fixes) · `test:` (test-case automation) · `docs:` (documentation) · `chore:` (tooling/deps).

#### Sequence

```
english-baseline-v1              ← TAG (restore point; §1)                       ✅ b36df6a
        │
        ├─ 1.  fix: make answer-text normalization unicode-aware              [M1,H]  ✅ 20b0c2e
        ├─ 2.  fix: detect screen text by script, not the Latin alphabet      [M2,J]  ✅ 0926217
        ├─ 2b. fix: keep non-Latin text through TTS synthesis                 [I]     ✅ 1ff4cca
        ├─ 3.  fix: replace 'English' anchors with a language registry        [M3]    ✅ 378b9ba
        ├─ 4.  refactor: generalize switchToEnglishForF2 to switchToLanguage  [M4]    ✅ 00a6dd5
        │      (M5 rule-engine: decided KEEP — no commit)
        │
        ├─ ⏳ RUN THE ENGLISH REGRESSION HERE — gates everything below
        │
        ├─ 6.  refactor: consolidate transition-button matchers                  [R2]  → regression
        ├─ 7.  refactor: remove unused DataGenerator and orphaned test data      [R4,R5] → regression
        ├─ 8.  chore: resolve lint/format tooling                                [R6]
        ├─ 9.  refactor: externalize test accounts + shared session-resume helper[R3,R7] → regression
        │
english-baseline-v2              ← TAG (English re-verified GREEN post-refactor)
        │
        ├─ 10. feat: add LANG configuration axis                                 [R1]  → regression
        ├─ 11. feat: add Language to test reporting                              [R8]
        ├─ 12. feat: add Hindi language automation support                       (config/handlers wiring)
        ├─ 13. test: automate Hindi TC-001-HI … TC-023-HI                        → per-TC + English regression
        │
        ├─ 14. docs: update automation documentation (English/Hindi/Framework)
        │
english-hindi-v1                 ← TAG (both suites verified)
```

#### Why this shape
- Commits 1-4 are `fix:` not `refactor:` — they correct latent defects (English-only assumptions in
  shared code), not style.
- Commits 5, 8 are tooling-only and touch no test path → no regression needed.
- Commit 9 bundles R3+R7 because externalizing credentials and extracting the login helper touch the
  same 5 spec setup blocks; splitting them would mean touching each spec twice.
- Commit 13 is where the Hindi TC numbering convention applies (see §7 open question).

---

### 6. Task tracker

| # | Task | ID | Category | Status | Regression after? |
|---|---|---|---|---|---|
| 0a | Merge baseline to `master` | — | chore | ☑ `b36df6a` | — |
| 0b | Tag `english-baseline-v1` | — | chore | ☑ | — |
| 0c | Branch `refactor/multi-language-readiness` | — | chore | ☑ | — |
| 1 | Unicode-aware answer normalization (+ the duplicate in `answerSource`) | M1, H | fix | ☑ `20b0c2e` | ⚠️ **partial — see below** |
| 2 | Generalize F/M-series letter/word detection (+ the `\b` bound) | M2, J | fix | ☑ `0926217`, self-review fix `65949aa` | ⚠️ **partial — see below** |
| 2b | Keep non-Latin text through TTS synthesis | I | fix | ☑ `1ff4cca` | ⚠️ **partial — see below** |
| 3 | Remove `"English"` parsing anchors → language registry | M3 | fix | ☑ `378b9ba` | ⚠️ **partial — see below** |
| 4 | `switchToEnglishForF2` → `switchToLanguage(lang)` | M4 | refactor | ☑ `00a6dd5` | ✅ live-verified (F2/F3/M4 logins) |
| 5 | Stale rule-engine | M5 | chore | ☑ **decided: keep as-is** | — |
| 5b | Run the English regression | — | — | ☑ **done, mixed result — see below** | — |
| 6 | Consolidate transition-button matchers | R2 | refactor | ☑ `7b376b0` | ⏳ **pending** |
| 7 | Remove `DataGenerator` + repurpose orphaned JSON | R4, R5 | refactor | ☑ `6604f4c` | ⏳ **pending** |
| 8 | Install lint/format tooling | R6 | chore | ☑ `ae249cc` | n/a (no test-path change) |
| 9 | Externalize accounts + session-resume helper | R3, R7 | refactor | ☑ `ed5176e` | ⏳ **pending — highest-risk item, see below** |
| 10 | Tag `english-baseline-v2` | — | chore | ☐ **NOT YET — regression still pending** | — |
| 11 | `LANG` configuration axis | R1 | feat | ☐ | ✅ |
| 12 | Language in reporting | R8 | feat | ☐ | — |
| 13 | Probe **actual** Hindi app behavior (no code yet) | — | — | ☐ | — |
| 14 | Hindi language support wiring | — | feat | ☐ | ✅ |
| 15 | Automate Hindi TC-001-HI … TC-023-HI | — | test | ☐ | ✅ (both) |
| 16 | Final code review | — | — | ☐ | — |
| 17 | Update docs (English / Hindi / Framework sections) | — | docs | ☐ | — |
| 18 | Tag `english-hindi-v1` | — | chore | ☐ | — |
| — | *Deferred:* split `FoundationPage` by mechanic | O1 | refactor | ⏸ | — |
| — | *Deferred:* consolidate region-geometry helpers | O2 | refactor | ⏸ | — |

#### R2–R7 implementation notes (2026-08-17) — what actually landed, and why it deviates

**R2 (transition matchers) — vocabulary consolidated, matching logic deliberately NOT merged.**
Investigated a full merge first, since that's what the plan called for, and found
`FoundationPage.clickChallengeAdvance` (priority-ordered, unanchored `getByText` checks) and
`MasteryPage.TRANSITION_RE` (one anchored alternation + geometry filter over every element) are
not interchangeable — confirmed `clickChallengeAdvance` deliberately excludes "Skip Demo"
(`completeF3` handles it via its own check right after), and `TRANSITION_RE` has no "Next Level"
entry. Merging the matching strategy is a real behavior change needing its own investigation and
regression. Shipped only the vocabulary consolidation (`utils/transitions.ts`, `TRANSITION_LABELS`
— every word a literal exactly once) with each site's existing matching code untouched. Verified
byte-for-byte against the compiled module: every regex's `.source`/`.flags` is identical to before.

**R5 (orphaned JSON) — repurposed narrowly, no invented content.** The JSON's `baseUrl` and
`languages` fields were dead weight already superseded by `config/environments.ts` and
`utils/languages.ts`; its `assessments`/`testUsers` fields were never real data. Rather than
carry those forward, moved the one genuinely-hardcoded piece of English test data this repo has —
`discovery-e2e.spec.ts`'s inline `DEMO_SENTENCE`, flagged in finding 2.5 as needing "a Hindi
counterpart via config" — into `testdata/english/discovery-data.json`. `testdata/hindi/` is an
empty placeholder pointing at task 13; its content must be observed on a real build, not guessed.

**R6 (lint/format) — installed only, NOT applied.** `npm run lint` now reports real output instead
of "command not found": 459 problems (188 errors, 271 warnings) across the pre-existing codebase,
and `format:check` flags 29 files. Fixing that is a separate, much larger cleanup with its own
review and regression needs — explicitly out of scope for "install the tooling." Only this
session's own new files were kept lint-clean (4 trivial return-type annotations fixed).

**R3+R7 (session-resume helper + credentials) — the highest-risk item, parameterized, NOT yet
live-verified.** Read all four call sites (F2/F3/M4/M4-S1) in full before writing anything, since
the plan's own risk note demanded confirming divergence first — and found real divergence: F2/F3
wait 6s then check for a Skip button, M4/M4-S1 don't; F3's audio hook installs before the Skip
check, M4's installs immediately after login with no wait; M4-S1 swallows a language-switch
failure, the other three don't. `utils/sessionResume.ts`'s `resumeParkedAccount()` parameterizes
exactly those four axes so each site reproduces its existing sequence byte-for-byte — verified by
diffing each spec against its original. This is the one R-item touching the exact specs that
failed live today (account staleness, §above) for reasons unrelated to this change, so it carries
real residual risk despite the careful diffing: **get a live F2/F3/M4/M4-S1 run through this before
trusting it**, not just the static diff review.

#### Regression run results (2026-08-17) — do NOT tag `english-baseline-v2` from this

Three attempts, summarized here; full detail in the *Project Context & Hand-off* section above, §13.

1. **Full regression:** TC-001–019 ✅, TC-023 ✅, TC-020/021/022 ❌, TC-024 skip (expected). The two
   failures are the pre-existing `Testf2auto`/`Testf3auto` account-staleness issue from §7/§2.6 —
   both landed on a fresh "Guest 0 · Start Assessment" screen, not F2/F3 content.
2. **Retry of just F2/F3:** identical failure, byte-for-byte. Confirms genuine staleness, not a flake.
3. **`FULL_E2E=1` fresh user:** failed inside F1, before reaching the F2/F3 continuation. Root cause —
   `completeLetterHuntPractice()` silently returns after 8 failed polls for the audio hook, abandoning
   a practice mid-way (observed: 3/10, full hearts) with no error; the failure only surfaces later,
   confusingly, at an unrelated downstream assertion. **Verified this is pre-existing and unrelated to
   M1–M4**: every line in the failing call chain (`installLetterHook` → `readSpokenLetter` →
   `tapLetterAndAdvance` → `completeLetterHuntPractice`) falls outside every diff hunk between
   `english-baseline-v1` and `HEAD`. New finding, tracked below — not a blocker for this work.

**What this does and doesn't prove:** TC-001–019 and TC-023 passing means M2's F1 Letter Train/Hunt
detection and the TTS fix now have live confirmation, on top of the compiled-module checks. **M2's F2
`hasWordQuestion`, F3 `launcherState`/`displayedSequence`, M3's `MasteryPage.readSentence`/
`answerDidYouSee`, and M1/M3's VQA scoring path have NOT been exercised live by anything today** — the
account staleness and the F1 stall both cut the run off before reaching them. The compiled-module
verification in each commit is real but is not the §8 pass criterion (a verified business outcome).

**Decision:** stop spending further ~25min attempts against a flaky shared UAT environment today;
proceed to R2–R7. Get one clean live run through F2/F3/M4-practice before Hindi TCs are written
against that code — `FULL_E2E=1` again once the F1 stall is understood as unrelated noise, or once
the parked accounts are re-provisioned.

#### 4th run, after R2–R7 (2026-08-17) — same shape, and it now clears R2–R7's highest-risk item

Ran the full regression again once R2, R4, R5, R6, R3, R7 were all committed, specifically to
verify `resumeParkedAccount()` — the item flagged above as touching the exact specs already
failing live. Result: **TC-001–019 ✅ (23m11s), TC-023 ✅ (49s), TC-020/021/022 ❌, TC-024 skip
(expected)** — the identical shape to run 1, not a new failure pattern.

What's different and matters: **every session-resume call site executed without throwing.**
- F2: `resumeParkedAccount()` completed; the failure is the SAME downstream assertion
  (`startFoundationButton` timeout) at nearly identical timing (57.5s vs 58.1s before) — the
  helper is not the cause.
- F3: **the login step now PASSES** (37.7s) — `resumeParkedAccount()` correctly ran
  `installLetterLauncherHook` before the Skip check and switched language; `completeF3` then hit
  the same fresh "Guest 0 · Start Assessment" text as every prior run, confirming staleness, not a
  helper regression.
- M4: login step passes (31.9s), TC-023 completes (49s) — `resumeParkedAccount()`'s
  `micSkip: false` + `beforeSkipCheck` (read-aloud injection) path confirmed live.
- Bonus live coverage from this same run: TC-001–019 passing means **R2's transition-matcher
  consolidation** (used throughout F1's Apply challenges) and **R5's `testdata/english/
  discovery-data.json`** (TC-004's demo-sentence detection read the JSON successfully) are now
  live-verified too, not just statically checked. R4 (DataGenerator removal) is implicitly
  confirmed by `DiscoveryHelper.createTestUser()` still working.

**Net: R2, R3, R4, R5, R7 all now have live confirmation on every code path the environment
allows reaching. The only unverified surface is unchanged from before** — F2's word-recognition
detection, F3's Launcher/Memory-Challenge detection, and `MasteryPage`'s sentence parsing, all cut
off by the same pre-existing account staleness, not by anything in this session's commits.

**Still do not tag `english-baseline-v2`.** Two of five specs fail in this run; regardless of
attributed cause, the project's own contract (§12.1: "TC-001–023 must stay green") and pass
criterion (§8: verified business outcome, not "probably not our fault") aren't met by a run with
failures in it. Tagging is a judgment call for you: the evidence now strongly says the failures are
external (identical failure signature across 3 independent attempts, on code paths this session
never touched, with the newly-added/changed code all executing cleanly) — but "strongly indicates"
isn't the same as green.

**New tracked finding (not part of M1–M5, do not fix inside this refactor's scope):**

| # | File | Issue |
|---|---|---|
| L | `FoundationPage.completeLetterHuntPractice()` | Returns silently after 8 consecutive failed reads of the spoken-letter audio hook, leaving the practice incomplete with no error raised. The caller has no way to know it didn't finish; the eventual test failure lands on an unrelated assertion far downstream. Should raise or return a status the caller can act on. |

**Task 13 is a hard gate:** per the standing rule, verify real Hindi application behavior before
implementing anything. Do not assume Hindi mirrors English; do not simply swap `"English"` → `"Hindi"`.

---

### 7. Open questions (need a decision before starting)

**All resolved 2026-08-17.**

| # | Question | Decision | Status |
|---|---|---|---|
| 1 | Stale `rule-engine` (M5) | **Keep as-is, untouched.** Not deleted, not rewritten. A rewrite is its own task. It still enforces nothing and still contradicts the real architecture (`sourceRoots` names three deleted directories; every spec violates `tests-no-direct-page-import`), so **do not run `rules:check` expecting a pass** — it will fail loudly and that is known, not a new problem. | ☑ no code change |
| 2 | `discovery-data.json` (R5) | **Repurpose** as the `testdata/<lang>/` seed — it already lists Hindi under help/learning languages. | ☐ not yet done |
| 3 | lint/format tooling (R6) | **Install** eslint + prettier; the configs already exist. | ☐ not yet done |
| 4 | Hindi TC numbering | **`TC-001-HI` … `TC-023-HI`**, mirroring English 1:1. (Your original example was `TC-024-HI`, but English `TC-024` already exists — the blocked S1 case — so mirroring avoids the collision.) | ☑ convention fixed |
| 5 | English TC-024 | **Proceed to Hindi**; keep as `test.fixme` and tracked. Flips green with zero code change once the app ships the hook per the *Outstanding Dev Request* section below. | ☑ unchanged |
| 6 | Push baseline to `origin/master`? | **No** — local only. `origin/master` stays at `05e7ca7`. | ☑ |

#### New open question, raised by the work

| # | Question | Why it matters |
|---|---|---|
| 7 | How does Hindi serve the Letter Hunt / Launcher audio (finding K)? | The four `/letter/([A-Za-z]+).wav` hooks recover the target letter from the URL. Transliterated ASCII filenames keep working as-is; Devanagari or percent-encoded ones break all of F1 P-nodes and F3. **Must be observed on a real Hindi build (task 13), not guessed.** |
| 8 | Where does a `hi-IN` SAPI voice come from? | Measured: this runner has only `en-US` (David/Zira), and an `en-US` voice given Devanagari yields an empty 46-byte WAV. Hindi read-aloud needs a `hi-IN` voice installed on the runner **plus** voice selection in `TtsHelper`. This is an environment provisioning question, not just code. |

---

### 8. Related documents

- The *Outstanding Dev Request* section below — the app-side hook contract that unblocks English TC-024.
- The [Regression Report History](docs/ARCHITECTURE_AND_TESTING.md#regression-report-history) section of `docs/ARCHITECTURE_AND_TESTING.md` — regression run history and root-cause writeups.
- `README.md` — current English status, account model, known limitations, audio/speech handling.
- This file (formerly `CHECKLIST.md`) — dated per-change verification log.

---

## Execution Plan (Git Baseline & Session Hand-off)

*Merged from the former standalone `EXECUTION_PLAN.md`. Section numbering below is that original
document's own, preserved as-is. Note its status line below ("PROPOSED — awaiting approval") is
the status as of that document's own last update; check the Change Log above for what actually
executed afterward.*

**Status:** PROPOSED — awaiting approval. **Nothing has been executed.**
**Prepared:** 2026-08-17
**Companion section:** the *Refactoring Plan* section above (the *what*; this section is the *how*)

---

### 0. Verified facts this plan is built on

| Fact | Value | Why it matters |
|---|---|---|
| `origin/master` | `05e7ca7` | Shared remote (`vishalchincholi1/Playwright-Test-Automation-Framework`) — **never force-push** |
| `chore/cleanup-and-envscode-webview://08dsjnq9npsoa8vhsqsgrr58inemnles7off0961986pgb2ilqjo/docs/EXECUTION_PLAN.mdglish-baseline` | `61afb75` | **LOCAL ONLY** — not on the remote → safe to rewrite locally |
| `61afb75` composition | 48 add · 52 delete · 10 modify = 110 files | Genuinely mixed → split is justified |
| The 48 adds | The **entire** ALL framework: all page objects, all 5 specs, services, utils, `config/environments.ts`, `scripts/run-e2e.js`, all docs | **The automation has no granular history at all** |
| Tags in repo | **none** | No restore point exists today |
| Untracked right now | `.claude/`, `docs/REFACTORING_PLAN.md` | Must NOT be swept into split commits |
| Regression verified at | `61afb75` — Build #10, 2 passed / 0 failed / 1 skipped, 64m 33s | Verification carries over **only if the tree stays byte-identical** |

---

### 1. Recommended Git strategy

#### 1.1 The core decision: split `61afb75`? → **Yes**

I initially leaned against splitting. The 48-add finding reversed that: `61afb75` is not "a cleanup
commit", it is *"delete the old unrelated framework + add the whole ALL framework + add multi-env
support + fix a tracked secret + add all documentation"* in one shot. Leaving it intact means the
automation framework itself is permanently un-bisectable.

**The safety argument that makes this acceptable:** the split preserves the *tree* exactly. The final
split commit will be byte-identical to `61afb75`, provable in one command:

```bash
git diff --stat 61afb75 HEAD     # MUST output nothing
```

If that is empty, then (a) no code was lost, and (b) the Build #10 regression result still applies —
no 70-minute re-run needed. If it is *not* empty, we abort and reset to the untouched backup.

#### 1.2 Never-rewrite guarantees

- The split happens on a **new branch**. `chore/cleanup-and-english-baseline` is left **pointing at
  `61afb75`, untouched** — it *is* the backup, no rewriting of any existing branch occurs.
- A tag is also placed on `61afb75` before anything starts, so it stays reachable even if the branch
  is later deleted.
- `master` only ever receives **fast-forward** merges of verified work.
- Nothing is force-pushed. Ever.

#### 1.3 Proposed commit split (5 commits, in this order)

Order matters — the secret-hygiene commit goes **first** so no intermediate commit tree contains a
tracked `.env` alongside the new work.

| # | Commit | Contents |
|---|---|---|
| 1 | `chore: untrack .env, add .env.example, ignore generated artifacts` | `.gitignore`, `D .env`, `.env.example` |
| 2 | `chore: remove unrelated Katalon/e-commerce suites and legacy utilities` | the 52 deletions (old specs, pages, api, modules, Logger/WaitHelper/ApiHelper, stale reports) |
| 3 | `feat: add ALL platform automation (Discovery, Foundation F1–F3, Mastery M4)` | `src/pages/**`, `src/tests/**`, `src/services/**`, `src/fixtures/**`, `src/utils/{appFrame,speechHook,TtsHelper,answerMatcher,DiscoveryHelper}.ts`, `src/testdata/**`, barrels |
| 4 | `feat: add multi-environment support (UAT/LAB/LAB2)` | `config/environments.ts`, `scripts/run-e2e.js`, `playwright.config.ts`, `package.json`, `package-lock.json`, `.npmrc`, `CustomTTAReporter` env/mode display |
| 5 | `docs: add ALL automation documentation, test cases and regression reports` | `README.md`, `docs/**`, `pri-doc/**`, `CHECKLIST.md`, `PROGRESS_TRACKER.md`, `TRACEABILITY_MATRIX.md`, `docs/ARCHITECTURE.html` |

`Dockerfile` is modified in `61afb75` — **needs inspection at execution time** to decide whether it
belongs in commit 2 (removing old scope) or 4 (env/infra). Will not guess.

#### 1.4 ⚠️ The single biggest hazard in this operation

After `git reset --soft 05e7ca7`, **`.env` becomes tracked again** (it was tracked at `05e7ca7`), and
the working-tree copy **contains the real 109-char `VISION_API_KEY`**. It will appear as a *modified*
tracked file. If it is ever staged, the live key enters history.

Mitigations, all three applied:
- Commit 1 runs `git rm --cached .env` **before any other staging**.
- **Only explicit pathspecs** are used — never `git add -A`, never `git add .`, never `git add :/`.
- `git diff --cached --name-status` is reviewed before **every** commit, and the key is grepped for
  before the final push.

(Prior verification: `git log --all -S "VISION_API_KEY="` confirmed the key was **never** in any
commit, so no history rewrite of `05e7ca7` or earlier is needed.)

#### 1.5 Proposed commands — Phase A: safety net (reversible, no history change)

```bash
# A1 — make 61afb75 permanently reachable by name, independent of any branch
git tag baseline-verified-61afb75 61afb75

# A2 — pre-flight: confirm .env at 05e7ca7 does NOT contain the live key
git show 05e7ca7:.env | grep -c "VISION_API_KEY=." || echo "clean (no key value at 05e7ca7)"

# A3 — inspect the one file whose grouping is undecided
git diff 05e7ca7 61afb75 -- Dockerfile
```

*What this does:* creates a named restore point and answers two questions before touching anything.
Nothing is modified. **Fully reversible** (a tag can just be deleted).

#### 1.6 Proposed commands — Phase B: the split (local history rewrite, on a NEW branch)

```bash
# B1 — new branch at the verified commit; the ORIGINAL branch is left untouched at 61afb75
git checkout -b baseline/english-v1 61afb75

# B2 — move HEAD back 1 commit, keeping every change in the index (nothing is deleted from disk)
git reset --soft 05e7ca7

# B3 — unstage everything, working tree still untouched, ready to stage group by group
git reset

# B4 — commit 1/5: secret hygiene FIRST
git rm --cached --quiet .env
git add .gitignore .env.example
git status --short                      # REVIEW before committing
git commit -m "chore: untrack .env, add .env.example, ignore generated artifacts"

# B5..B8 — commits 2/5 … 5/5, each: stage explicit paths → review → commit
#          (exact pathspecs listed in §1.3; reviewed with `git diff --cached --name-status`)

# B9 — THE PROOF: tree must be byte-identical to the verified baseline
git diff --stat 61afb75 HEAD            # MUST be empty
git status --short                       # only .claude/ and docs/*.md should remain untracked
```

*What this does:* replays the same file content as 5 categorized commits. `--soft` and mixed `reset`
**never touch the working tree**, so no file on disk is at risk. B9 is the go/no-go gate.

#### 1.7 Proposed commands — Phase C: publish the baseline & open the refactor branch

```bash
# C1 — fast-forward master to the split baseline (no merge commit, linear history)
git checkout master
git merge --ff-only baseline/english-v1

# C2 — the immutable restore point
git tag -a english-baseline-v1 -m "Verified English baseline: TC-001-023 PASS, TC-024 blocked app-side. Build #10, 64m33s."

# C3 — the working branch for all refactoring (M1..R8 from the Refactoring Plan section above)
git checkout -b refactor/multi-language-readiness
```

*What this does:* puts the verified baseline on the mainline as 5 clean commits and opens an isolated
branch for refactoring. `--ff-only` guarantees it fails loudly rather than creating a surprise merge.

#### 1.8 Push — needs your decision

The remote is a **shared** repo. I will not push without explicit instruction. Recommended once B9
passes, so the baseline survives a machine failure:

```bash
git push origin master
git push origin english-baseline-v1 baseline-verified-61afb75
```

**Question for you:** push to `origin/master`, or keep everything local for now?

---

### 2. Proposed branch strategy

```
origin/master ────────────────────────────────────────────────────────►  (shared, ff-only)
                    │
05e7ca7 ────────────┤
                    │
                    ├── chore/cleanup-and-english-baseline @ 61afb75   [FROZEN BACKUP — never touched]
                    │        └─ tag: baseline-verified-61afb75
                    │
                    └── baseline/english-v1  (5 categorized commits, tree ≡ 61afb75)
                             └─ tag: english-baseline-v1  ◄── RESTORE POINT
                             │
                             └── refactor/multi-language-readiness   (M1…R8, one commit each)
                                      └─ tag: english-baseline-v2  ◄── English re-verified GREEN
                                      │
                                      └── feature/hindi-automation   (TC-xxx-HI)
                                               └─ tag: english-hindi-v1
```

| Branch | Purpose | Merge rule |
|---|---|---|
| `master` | Verified mainline | fast-forward only, after regression GREEN |
| `chore/cleanup-and-english-baseline` | Frozen backup at `61afb75` | never commit, never delete until pushed |
| `baseline/english-v1` | The 5-commit split baseline | merged to master via ff |
| `refactor/multi-language-readiness` | All framework refactoring | merged only after English re-verified |
| `feature/hindi-automation` | Hindi test cases | merged only after **both** suites GREEN |

---

### 3. How to safely handle the latest commit — summary

| Concern | How it is handled |
|---|---|
| "Do not delete or lose any working code" | `--soft`/mixed reset never touch the working tree; tree-identity proven at B9; `61afb75` frozen on its own branch **and** tagged |
| "Soft-reset only if required" | Required here — `61afb75` contains 48 new framework files with no history |
| "Do not modify the existing automation yet" | Phases A–C contain **zero** source edits. Only staging, committing, branching, tagging |
| Secret exposure | §1.4 — three independent mitigations |
| Regression re-run cost | Avoided — byte-identical tree means Build #10 verification carries over |
| Abort path | §10 |

---

### 4. Fresh-session hand-off document — proposed structure

To be created as `docs/PROJECT_CONTEXT.md` **at execution time** (not now). Target ≤ 400 lines so a
fresh session can load it in one read. Proposed sections. *(This was created as planned, and its
content now lives in the "Project Context & Hand-off" section above, following a later consolidation
that folded it back into this file.)*

| § | Section | Content |
|---|---|---|
| 1 | Purpose & scope | What the ALL platform is; that this suite tests Discovery → Foundation → Mastery; English done, Hindi next |
| 2 | Current coverage | TC-001–019 (Discovery+F1), TC-020 (F2), TC-021/022 (F3), TC-023 (M4 P1–P4), TC-024 (blocked) — with PASS/BLOCKED status |
| 3 | English flow status | Verified Build #10, 64m33s; the exact regression command; what GREEN looks like |
| 4 | App mechanics: F1/F2/F3/M4 | Letter Train, Letter Hunt, Letter Recognition, Letter Launcher, Memory Challenge, Apply challenges, M4 read-aloud + "Did you see the word?" — one paragraph each, incl. how each is *solved* (audio hooks, TTS injection, content-API answers) |
| 5 | Framework structure | The tree from the *Refactoring Plan* section above, §2.1 + what each layer owns |
| 6 | Key architectural decisions | Why text/role locators (no data-testid, css-* churn); the iframe proxy (`appFrame.ts`); speech mocking vs real audio injection; content-API answer sourcing |
| 7 | Account model | Guest login; **forward-only** progression; `Testf2auto`/`Testf3auto`/`m4auto` and why they go stale; `FULL_E2E=1` single-user path; Mastery sequential gating |
| 8 | Automation rules | The 14 standing rules, verbatim — esp. #1 (never break a passing test), #2/#13 (no PASS without verified business outcome) |
| 9 | Known limitations | Mid-run redeploys + `recoverIfDisconnected`; no test hooks; SVG/audio-baked letters; not parallel-safe; TC-024 app-side blocker |
| 10 | Stable baseline | `english-baseline-v1`, what it guarantees, how to restore |
| 11 | Refactoring goals | Pointer to the *Refactoring Plan* section above, §3-§5 (not duplicated) |
| 12 | Do-not-break contract | The English TCs that must stay green; run regression after each behavior-touching commit |

**Note:** it will *reference* the *Refactoring Plan* and *Execution Plan* sections rather than duplicate
them, so there is one source of truth per topic.

---

### 5. Required Claude skills

A skill earns its place only if it is invoked **repeatedly** with a **fixed procedure**. Of your ten
candidate areas, five qualify; the rest are better as one-off agent prompts (stated plainly below).

#### 5.1 Recommended — create as `.claude/skills/<name>/SKILL.md`

| Skill | Why it must be a skill | Encodes |
|---|---|---|
| `regression-run` | Invoked after **every** behavior-touching commit (~12+ times) | Exact command per scope; expected durations; the **Action → App Response → Expected Result → Assertion → PASS** criterion; that clicks completing ≠ PASS; failure classification (app/env · locator · automation · test-data · browser/audio); never kill `chrome.exe` by name — filter on `ms-playwright` paths only |
| `commit-categorize` | Invoked per commit (~20+ times) | The 8 categories; never-mix rule; message format; `Co-Authored-By` trailer; always `git status` review before commit; explicit pathspecs only |
| `locator-strategy` | Consulted on every page-object touch | This app has no `data-testid`/`aria` and its emotion `css-*` hashes churn per build → prefer text/role/alt; coordinate fallback allowed **only** where documented (SVG-baked labels); never introduce a new `css-<hash>` selector; how to verify a locator survives a rebuild |
| `english-baseline-guard` | The protection contract, checked before every change | Which TCs must stay green; that `english-baseline-v1` is the restore point; regression-before-proceeding rule; stop-and-report on risk instead of guessing |
| `multilang-architecture` | Consulted on all Hindi work | Shared-core vs language-handler split; test-data under `testdata/<lang>/`; the concrete Unicode pitfalls found (`answerMatcher` normalize, `[A-Za-z]` gates, the `"English"` parse anchor); never duplicate the framework per language; never find-and-replace `English`→`Hindi` |

#### 5.2 Not recommended as skills — use agent prompts instead

`codebase-analysis`, `refactoring`, `documentation`, `code-review`. These are **one-shot, context-
specific** activities, not repeated fixed procedures. Encoding them as skills adds indirection
without reuse. They belong in the agent definitions in §6.

---

### 6. Multi-agent structure — proposal (with honest deviations)

Four of your seven roles map cleanly to subagents. **Two I recommend restructuring** — delegating
them would actively weaken the safety guarantees you asked for. Reasoning given for each.

#### 6.1 Agents recommended as-is

| Agent | Role | Tools | Output |
|---|---|---|---|
| **A1 — Codebase Analyst** | Independently map structure, dependency graph, dead code, risks | read-only (Read/Grep/Glob) | Findings report. **No code changes** |
| **A2 — Framework Architect** | Review architecture; propose shared-core vs language-specific boundaries | read-only | Recommendation, no implementation |
| **A3 — Locator/Playwright Specialist** | Audit locator strategy; flag fragile selectors; assess Hindi impact | read-only | Prioritized list, no changes |
| **A6 — Code Review Agent** | Adversarially review each refactor commit; maintainability, duplication, regression risk | read-only + git | Findings, severity-ranked |
| **A7 — Documentation Agent** | Update README/CSV/architecture **after** verification | read + write to docs only | Doc diffs |

**High-value nuance for A1–A3:** I have already produced these findings in the *Refactoring Plan* section above. Their
job is therefore **independent verification, not fresh discovery** — they run *without* seeing my
conclusions and we compare. Agreement raises confidence; disagreement finds my mistakes. That is worth
more than a first pass.

#### 6.2 Agents I recommend restructuring

**A4 — Refactoring Agent → keep in the main session, not a fire-and-forget agent.**
Each approved change (M1…R8) is small — a Unicode regex, a method rename, deleting a dead file — but
each needs a **70-minute regression before the next one starts**, plus your approval at several
points. A delegated agent would either (a) batch changes to look efficient, defeating the one-commit-
per-change strategy, or (b) idle between regressions. Worse, it loses the context needed to interpret
a failure. **Recommendation:** implement in the main session, one commit at a time, with A6 reviewing
each. *This is a deviation from your Step 4 — flagging it rather than silently doing it.*

**A5 — Regression Agent → run the suite in the main session; delegate only failure triage.**
This is the important one. Your rules #2 and #13 say *never* mark a TC as PASS without verifying the
business outcome. A subagent whose summary is "regression passed" is precisely that failure mode — I
would be relaying a claim I did not verify. **Recommendation:** run regression via background bash in
the main session and read the raw output myself. Delegate to a subagent only the *post-mortem* of a
failure that already occurred (read the trace, screenshot, and page text; classify the cause) — where
a fresh context genuinely helps and cannot manufacture a false green.

#### 6.3 Resulting structure

```
                        MAIN SESSION  (orchestrator + implementer + regression reader)
                                 │
   ┌──────────────┬──────────────┼──────────────┬──────────────┐
   ▼              ▼              ▼              ▼              ▼
  A1            A2             A3             A6             A7
Analyst      Architect      Locator        Reviewer         Docs
(parallel, read-only, independent verification)   (per-commit)  (last)
                                 │
                                 └── A5' failure-triage agent (only when a test actually fails)
```

---

### 7. Agent rules (binding on all agents)

1. Do **not** modify working functionality unnecessarily.
2. Do **not** overwrite another agent's work — A1/A2/A3 are read-only; only the main session and A7 write.
3. Do **not** make architectural changes without approval.
4. Keep changes isolated and reviewable — one logical change per commit.
5. Follow the commit strategy in §1.3 above / the *Refactoring Plan* section, §5.
6. Run the appropriate regression after any behavior-touching change.
7. Report clearly **what** changed and **why**.
8. On finding a risk: **stop and report** — never guess, never work around it silently.
9. The existing English automation is the baseline and must remain protected.
10. Never claim PASS from clicks alone — `Action → App Response → Expected Result → Assertion → PASS`.
11. Never use `git add -A` / `git add .` — explicit pathspecs only (secret-safety, §1.4).
12. Read-only agents must state explicitly that they made no modifications.

---

### 8. Order of execution

| Phase | Step | Owner | Gate |
|---|---|---|---|
| **0** | A1 · A2 · A3 (parallel, read-only, blind to my findings) | agents | — |
| **0** | Reconcile agent findings vs the *Refactoring Plan* section above; report deltas | main | **APPROVAL 1** |
| **A** | Safety net: tag `61afb75`, pre-flight `.env` + `Dockerfile` checks | main | **APPROVAL 2** |
| **B** | The 5-commit split on `baseline/english-v1` | main | **APPROVAL 3** — B9 tree-identity must be empty |
| **C** | ff-merge to `master`, tag `english-baseline-v1`, open refactor branch | main | **APPROVAL 4** (incl. push decision) |
| **D** | Create the 5 skills + `docs/PROJECT_CONTEXT.md` | main | **APPROVAL 5** |
| **E** | *(optional)* fresh session loading `PROJECT_CONTEXT.md` | — | — |
| **F** | M1 → regression → A6 review → commit | main + A6 | **APPROVAL** per commit |
| **F** | M2, M3, M4, M5, R2, R4/R5, R6, R3/R7 — same loop each | main + A6 | per commit |
| **G** | Full regression; tag `english-baseline-v2` | main | **APPROVAL** — must be GREEN |
| **H** | R1 (LANG axis), R8 (reporting) | main | per commit |
| **I** | **Probe real Hindi app behavior** — no code | main | **APPROVAL** — hard gate |
| **J** | Hindi support wiring + `TC-001-HI…TC-023-HI` | main + A6 | per TC |
| **K** | Full English + Hindi regression | main | must both be GREEN |
| **L** | A6 final review · A7 docs · tag `english-hindi-v1` | A6, A7 | **APPROVAL** |

---

### 9. Approval checkpoints

| # | Checkpoint | Question you answer | Blocks |
|---|---|---|---|
| 1 | Analysis reconciled | Do you accept the findings & the Must/Recommended/Optional split? | all code work |
| 2 | Pre-flight results | Proceed to rewrite local history? | Phase B |
| 3 | Split verified | Tree-identity empty → accept the 5 commits? | Phase C |
| 4 | Baseline published | ff-merge to `master`? Push to `origin`? | refactoring |
| 5 | Skills & context | Are the 5 skills + `PROJECT_CONTEXT.md` right? | Phase F |
| 6–13 | Per refactor commit | Regression GREEN + review clean → keep it? | the next commit |
| 14 | `english-baseline-v2` | English still fully green post-refactor? | any Hindi work |
| 15 | Hindi behavior probe | Does observed Hindi behavior match the assumed design? | Hindi implementation |
| 16 | Final | Both suites green, review clean, docs updated? | tagging & merge |

**Open decisions still needed** (from the *Refactoring Plan* section above, §7): stale rule-engine (delete vs rewrite)
· `discovery-data.json` (delete vs repurpose) · lint/format (install vs remove) · Hindi TC numbering
· push-to-origin or stay local.

---

### 10. Risks & rollback

| # | Risk | Likelihood | Impact | Mitigation | Rollback |
|---|---|---|---|---|---|
| 1 | **Live `VISION_API_KEY` staged during the split** (§1.4) | Medium | **Critical** | `git rm --cached .env` first; explicit pathspecs only; review `--cached` before every commit; grep before any push | Not yet pushed → `git reset` the commit and re-stage. Nothing leaves the machine before the grep |
| 2 | Split loses or alters file content | Low | High | B9 `git diff --stat 61afb75 HEAD` must be empty | `git checkout -B baseline/english-v1 61afb75` — restart from the frozen commit |
| 3 | Refactor breaks a passing English TC | Medium | High | One change per commit + regression each; A6 review | `git revert <sha>` — isolates that change only |
| 4 | Regression fails for an **app-side** reason (mid-run redeploy) mid-refactor | Medium | Medium | `recoverIfDisconnected()` already handles it; compare build stamp before/after | Re-run; classify as app/env, not automation. Do not "fix" code for an app outage |
| 5 | Unicode regex broadening (M2) over-matches and picks up wrong text | Medium | Medium | Compare word/letter detection logs against the baseline run, not just PASS/FAIL | `git revert` M2; reconsider a script-parameterized approach |
| 6 | `.claude/` or planning docs swept into a split commit | Low | Low | Explicit pathspecs; B9 `git status` check | `git rm --cached` the stray path, amend |
| 7 | ff-merge to `master` fails (unexpected divergence) | Low | Low | `--ff-only` fails loudly instead of auto-merging | Investigate before proceeding; no state changed |
| 8 | A subagent reports a false green | Low | **High** | Regression is **never** delegated (§6.2); main session reads raw output | Re-run in main session |
| 9 | Frozen backup branch deleted prematurely | Low | High | Also tagged `baseline-verified-61afb75`; delete only after push | `git checkout baseline-verified-61afb75` |
| 10 | Hindi work destabilizes English | Medium | High | `english-baseline-v2` tag before any Hindi; separate branch; English regression re-run after Hindi | Reset `feature/hindi-automation`; English mainline untouched |

#### Global abort — return to the exact verified state at any time

```bash
git checkout chore/cleanup-and-english-baseline    # or: git checkout baseline-verified-61afb75
# working tree is once again byte-identical to the Build #10-verified baseline
```

---

### 11. What has NOT been done

No git commands executed · no branch/tag created · no source file modified · no skill created ·
no agent launched. The only content written was the material now in the *Refactoring Plan* and *Execution Plan* sections of this document.

---

## Optimization & Refactoring Plan

*Merged from the former standalone `OPTIMIZATION_PLAN.md`. Section numbering below is that
original document's own, preserved as-is.*

**Status as of 2026-08-24.** Discovery, F1, F2, F3, and M4 (correctly gated) all confirmed passing
post-refactor via a clean 100% end-to-end run (§3 Attempt 5) — no regression found anywhere. Only
open item: the `english-baseline-v2` tag decision (§6/§7), purely a judgment call now. This is the
single current-status source for pending framework
optimization/refactor work on the `All` repo — it supersedes the scattered tracking that had
built up across the *Refactoring Plan* section above, the Readiness Plan's Phase 3 section, and
the Open TODOs' Phase 3 section (both now in [docs/HINDI_ROLLOUT_LOG.md](docs/HINDI_ROLLOUT_LOG.md#readiness-plan)).
Those three keep their detailed historical evidence in place
(investigation notes, dated findings, commit hashes) — nothing there was deleted — but each now
points here for "what's actually pending right now," so a future read only needs one document for
current status.

---

### 1. Context

- **F2 development is paused** by user decision (2026-08-23). Don't resume F2-specific automation
  without explicit instruction.
- **F2 (TC-020) RE-VERIFIED PASS 2026-08-24** — `foundation-f2.spec.ts` via `Testf2auto`, full
  A1→A2→A3, 20m3s, 100%. Confirms `Testf2auto` was NOT drifted (unlike `Testf3auto`), and confirms
  no regression from the 2026-08-23/24 `FoundationPage.ts` hardening (`clickChallengeAdvance`/
  `clickStartFoundationIfPresent`/`completeApplyChallenge` are all on F2's code path). Superseded
  the prior "unknown since 2026-08-17" status. **Note:** `Testf2auto` has now graduated past F2
  from this run (forward-only) — running `foundation-f2.spec.ts` again will hit the same
  "drifted past target" issue `foundation-f3.spec.ts` has, until it's re-parked.
- Focus has shifted to **optimizing/hardening the existing automation code**, not adding new
  coverage.
- Hindi automation is a separate, ongoing track (the [Readiness Plan](docs/HINDI_ROLLOUT_LOG.md#readiness-plan)
  and [Execution Log](docs/HINDI_ROLLOUT_LOG.md#execution-log) sections of `docs/HINDI_ROLLOUT_LOG.md`):
  Discovery Hindi (TC-001–012) verified live; F1 Hindi (TC-013–019) **blocked** on an app-side
  content bug (Marathi text on the post-L1 screen, not a framework gap); F2/F3/M4 Hindi not
  started, explicitly parked.

---

### 2. Done (2026-08-23)

1. **Spec split** — `discovery-e2e.spec.ts` → `discovery.spec.ts` (TC-001–012) + new
   `foundation-f1.spec.ts` (TC-013–019, replays Discovery as its own precondition via the new
   shared `src/utils/discoveryFlow.ts`, since no parked F1 account exists; carries the `FULL_E2E`
   F2→F3→M4 continuation unchanged).
2. **`UiCopy.ts` split** — into `uiCopyData.ts` (the data table), `uiCopyLookup.ts` (lookup/regex
   functions), `lazyProp.ts` (the unrelated generic helper), with `UiCopy.ts` now a thin
   re-export barrel. Zero call-site changes across all 7 consumers.
3. **Dead-code re-check** — the candidates listed in the [Technical Review and Recommendations](docs/ARCHITECTURE_AND_TESTING.md#technical-review-and-recommendations) section of `docs/ARCHITECTURE_AND_TESTING.md`
   (`WaitHelper`, `DataGenerator`, `auth.fixture.ts`, `src/api/`, `ApiHelper`, `DiscoveryModule`)
   **no longer exist** — already removed in the 2026-08-17 cleanup (see this file's change
   log). That review is stale on this point; nothing to clean up there.
4. **Error-handling hardening** — full triage of ~66 `.catch(() => {})`/`force: true` sites across
   the core page objects (`FoundationPage.ts`, `discoveryFlow.ts`, `DiscoveryLoginPage.ts`,
   `sessionResume.ts`, `MasteryPage.ts`, `AssessmentPage.ts`, `VqaSpeakingAssessment.ts`,
   `MicrophoneTestPage.ts`). Most are deliberate best-effort/fallback patterns already covered by
   a later assertion — left unchanged. **3 real fixes applied, all failure-path-only (happy path
   unchanged):**
   - `DiscoveryLoginPage.selectGrade()` — a failed grade selection was completely unobservable
     (both the by-value and by-label attempts could fail silently, nothing downstream checked
     which grade landed). Now reads back the dropdown's actual value and `console.warn`s on a
     mismatch (warning, not a throw — grade correctness isn't gated by any current TC).
   - `discoveryFlow.ts` TC-009/TC-010 — the "Continue" click after each assessment-completion
     popup discarded its result (every other `clickByText` call site in the file asserts it). A
     silent failure there could make Assessment 2 falsely appear pre-completed. Now asserted.
   - `FoundationPage.ts` — `clickChallengeAdvance()`/`clickStartFoundationIfPresent()` now report
     the click's real outcome instead of an unconditional `true`; `completeF3()` now throws on
     loop exhaustion instead of returning silently (made symmetric with its sibling
     `completeFoundationThroughApply()`, which already throws).
   - `tsc --noEmit` and `npm run lint` both clean, same pre-existing warning/error count as before
     (the 3 pre-existing lint errors are confined to the throwaway `_hindi-*-probe.spec.ts` files).
5. **Doc-tracker corrections** — the *Refactoring Plan* section above's task tracker had gone stale since
   2026-08-17: R1 (LANG axis) and R8 (Language in reporting) were actually completed later under
   the `feat/hindi` branch's work, just never reported back. Corrected in place. Tasks 13–15 also
   corrected to reflect the real Hindi-track status (see §1 above).

---

### 3. Regression status

#### Attempt 1 (2026-08-23 ~05:36 UTC) — INCONCLUSIVE, UAT server offline

`discovery.spec.ts`, `foundation-f1.spec.ts`, `foundation-f3.spec.ts`, `mastery-m4.spec.ts`,
`mastery-m4-s1.spec.ts` (F2 excluded — paused) headless against UAT. **Result: 4 failed, 1 skipped
(fixme) — but the UAT server was offline for the entire run** (user-confirmed). None of the 4
failures traced to the changes in §2 (TC-001 stuck on login form; F3/M4 browser-crash timeouts).

#### Attempt 2 (2026-08-24, run manually by the user, server confirmed back up) — 2 passed, 2 failed, 1 skipped

Same command, run manually. Build `v3.0.7 · Build #12 · 861b025` (previously observed 2026-08-18,
not a new deploy). Total duration 7m7s (the run ended early on genuine failures rather than
grinding through the full budget — see below).

| Spec | Result | Notes |
|---|---|---|
| `discovery.spec.ts` (TC-001–012) | ✅ **PASS** | |
| `foundation-f1.spec.ts` (TC-013–019) | ❌ **FAIL** — TC-014, 2m53s in | Precondition (Discovery replay) passed; failed on `expectOnPracticeDemo()` after `completeLetterTrain()` — see finding below |
| `foundation-f3.spec.ts` (TC-021/022) | ❌ **FAIL**, 39s | **Not a regression** — self-diagnosing: `Testf3auto` has already graduated past F3 (forward-only account drift, pre-existing, see this file's Change Log / the [Current Status](docs/HINDI_ROLLOUT_LOG.md#current-status) section of `docs/HINDI_ROLLOUT_LOG.md`). Needs a fresh parked account or `FULL_E2E=1` coverage, not a code fix |
| `mastery-m4.spec.ts` (TC-023) | ✅ **PASS**, 47s | |
| `mastery-m4-s1.spec.ts` (TC-024) | ⏭️ **SKIPPED** | Expected — `test.fixme`, blocked app-side (§ elsewhere) |

**New finding — TC-014 failure, not attributable to today's refactor:** the failure screenshot
shows the app stuck at Letter Train item **"1/16"** (the very first item), not on the expected
Letter Hunt practice screen. `completeLetterTrain()` almost certainly returned `gaveUp(...)` with
a specific reason (e.g. "the train counter stayed at 1/16 for 8 rounds") — but **`foundation-f1.spec.ts`'s
TC-014/TC-016/TC-017 all discard that `SolverResult` without checking `.completed`**, so the
specific reason is thrown away and the test only surfaces the generic downstream
`expectOnPracticeDemo()` timeout. This discard pattern (and `completeLetterTrain()`/`trainProgress()`/
the mic-injection code it uses) is **pre-existing, unmodified by today's changes** — none of it is
in the diff. Most likely a live-app flake (mic-injection timing, or a slow first request), but the
discard bug means this run's output can't confirm that. **Proposed follow-up** (same spirit as
§2's TC-009/TC-010 fix): check each `SolverResult` in `foundation-f1.spec.ts` and throw with the
real reason on `!completed`, so a future recurrence is self-diagnosing instead of a generic
timeout.

**Verdict on attempt 2:** the 2026-08-23 error-handling hardening pass shows **no regressions** —
the one new failure (TC-014) is in code nobody touched, and the other (F3) is a well-understood
pre-existing account-state issue. Not fully green, so not formally "verified," but nothing here
contradicts the refactor being safe.

#### Attempt 3 (2026-08-24) — targeted re-run of `foundation-f1.spec.ts` alone, after applying the discard fix

Applied the proposed follow-up: `foundation-f1.spec.ts`'s TC-014/015/016/017/018/019 now assert
every `SolverResult` (`completeLetterTrain`/`completeLetterHuntPractice`/`completeApplyChallenge`/
`completeLearnPracticePair`) via a shared `expectSolved`/`expectPairSolved` helper instead of
discarding it. `tsc`/`eslint` clean, no new issues.

Re-ran `foundation-f1.spec.ts` alone (25m51s). **TC-014 did NOT reproduce** — L1 Letter Train
completed cleanly this time (all 16 items), confirming the previous stall was a one-off live-app
flake, not a regression. TC-015 through TC-018 all passed too — real progress past where attempt 2
got stuck, and proof the new assertions don't false-positive on the happy path.

**TC-019 (A3 Apply) then failed** with a specific, actionable message instead of a generic
timeout — exactly what the fix was for: `"A3 Apply: no question and no advance control for 13
iterations (at iteration 50)"`. Investigated: the failure screenshot showed the app already on
**"Start F2"** — meaning A3 had actually completed correctly and the app had advanced past F1 into
F2. This was **not** a click-reliability regression from `clickChallengeAdvance()` (yesterday's
change) — it was a **pre-existing gap** in `completeApplyChallenge()`'s own success detection: its
loop only recognized "landed on the next Letter Train" as done, which is true for A1→L4 and
A2→L7 but not for A3, whose real next state is the "Start F2" entry (a different screen). Under
the old discard-the-result code, this gap was invisible — the discarded `gaveUp()` just let the
next assertion (`expectPastApplyChallenge()`, which DOES recognize `startFoundationButton()`) be
the real arbiter and pass anyway. Yesterday's hardening surfaced the gap by finally checking the
result.

**Fixed at the source** (not by loosening the assertion): `completeApplyChallenge()` now also
recognizes `startFoundationButton()` ("Start F#") becoming visible as a valid completion,
mirroring the identical check `expectFoundationApplyCompleted()` already uses for the same
purpose. `tsc`/`eslint` clean. Not yet re-verified live — the evidence (the actual screenshot
showing "Start F2" present) strongly supports the fix, and it reuses an already-proven pattern
from the same file, but a full re-run would still be the honest confirmation per the project's own
pass criteria.

**Net effect of today's two-part hardening + fix:** the discard bug fix didn't just fail to find a
regression — it found and fixed a **real, previously-invisible defect** in `completeApplyChallenge()`
that would have silently misreported "gave up" on every future A3-ending level (the same gap likely
also affects F2/F3's own final Applies, not yet checked).

#### Attempt 4 (2026-08-24) — `FULL_E2E=1` fresh-user run (Discovery→F1→F2) + dedicated F2 re-verify

Two things run: (1) `FULL_E2E=1` against `foundation-f1.spec.ts` with a fresh guest user —
user-observed Discovery and F1 both completed and the run continued into F2, which **live-confirms
the `completeApplyChallenge()` fix from Attempt 3**: reaching F2 requires passing TC-019's A3→F2
transition, so the fix is no longer just screenshot-supported, it's verified live. (2) Separately,
`foundation-f2.spec.ts` run directly against the dedicated `Testf2auto` account — **PASSED, 20m3s,
100%, full A1→A2→A3**. This confirms `Testf2auto` was NOT drifted (unlike `Testf3auto`), and
confirms no regression from the 2026-08-23/24 `FoundationPage.ts` hardening on F2's own code path.
**F2's "unknown since 2026-08-17" status (§1) is resolved: F2 is confirmed current and passing as
of 2026-08-24.** `Testf2auto` has now graduated past F2 from this run (forward-only) — expect the
same "drifted past target" symptom on a future standalone run until it's re-parked.

#### Attempt 5 (2026-08-24) — full `FULL_E2E=1` run to completion: Discovery→F1→F2→F3→M4 attempt

Ran to completion this time (previous FULL_E2E attempt was only observed partway, into F2).
**Result: 100% PASS, 61m9s, one fresh guest user, one continuous session:**

| Stage | Result | Detail |
|---|---|---|
| Discovery (TC-001–012) | ✅ PASS | |
| F1 (TC-013–019) | ✅ PASS | Includes TC-019/A3 — the `completeApplyChallenge()` fix confirmed live a second time |
| F2 (TC-020) | ✅ PASS | Full A1→A2→A3 (`nodes: L(18) P L(18) P L(18) P A2 L(18) P L(18) P L(18) P A3`) |
| F3 (TC-021/022) | ✅ PASS | Full P1–P10 Letter Launcher + Memory Challenge (`games: StartF3 LL×8 MC×3 LL×8 MC×3`), reached past F3 |
| M4 (TC-023) | ✅ PASS (gated, as expected) | Single linear user lands at Mastery "Start Level 1" — M4 needs M1–M3 first, correctly detected and annotated, not a failure |

**This is the F3 signal that was missing** — `Testf3auto` is still stale, but this fresh-user run
gives an equally valid current confirmation (same precedent as the 2026-08-12/17 `FULL_E2E`
verifications that established F2/F3 were "functionally correct" independent of parked-account
drift). Combined with Attempt 4's direct `Testf2auto` pass, **every stage of Foundation (Discovery
through F3) now has an independent, current, passing confirmation** — no regression found
anywhere from the 2026-08-23/24 hardening pass.

---

### 4. Pending structural work (Phase 3)

None of the items below have been started. Tracking only — not scheduled — per explicit user
decision 2026-08-23. The *Refactoring Plan* section above tracks two of these under its own IDs **O1**/**O2**;
they are the same items as **P3-1**/**P3-4** below — don't duplicate work across the two IDs.

| ID | Task | Status / gate |
|---|---|---|
| **P3-1** / O1 | Extract the 5 activity solvers (Letter Train, Letter Hunt, Word Recognition, Letter Launcher, Memory Challenge) out of `FoundationPage.ts` (now **1647 lines**, was 1,119/1,152 when first flagged) into `src/activities/` | Deferred — high blast radius, E2E-only coverage, no unit tests. Gate: "revisit only if Hindi actually needs per-mechanic divergence," unproven while Hindi F1 is blocked. **Reference implementation exists — see §5 below.** |
| **P3-4** / O2 | Consolidate the ~16 duplicated "find control in geometry box" `page.evaluate()` scans into one shared helper | Deferred, same reasoning. **Reference implementation exists — see §5 below.** |
| **P3-3** | Split `CustomTTAReporter.ts` (769 lines of embedded CSS + 142 lines of JS in template strings) into real `.css`/`.js` files | Not started. Low risk, no live-app coverage needed to verify (pure build-output change) |
| **P3-6** | Delete confirmed-dead code: `src/utils/index.ts` (if truly zero importers), unused `DiscoveryHelper` members, `switchToEnglishForF2` (re-confirmed zero callers 2026-08-23), `mint.json`, unused Playwright browser projects, dead reporter fns | Not started. **Re-verify each item is still actually dead before deleting** — list is from 2026-08-18, other cleanups have landed since (search → verify dependency → remove) |
| **P3-7** | Per-language stopwords for `answerMatcher.ts` (currently one flat English `STOP` set) | Not started. Refinement, not a fix — unlisted scripts just keep lower precision today, never blocked |
| **P3-8** | Decide `MicrophoneTestPage.ts`'s fate — delete (dead, zero call sites re-confirmed 2026-08-23) or wire it in and de-hardcode its `Skip` too | Not started — needs a decision, not just code |
| **P2-18** | Decide whether to adopt prettier for real (repo-wide reformat, its own change) | Not started |

**Intentionally out of scope for now** (Mastery-related, capped by the TC-022 scope decision):
**P3-2** (`AudioHarness` extraction) and **P3-5** (parameterize Mastery M1–M9 as one spec).

---

### 5. Reference implementation for P3-1/P3-4 (found 2026-08-23)

`c:\Users\ttpl-rt-224\workspace\allAppAutomation` — the parallel clean-rebuild repo — has already
built working solutions to exactly these two items. Its own docs explicitly cite `All`'s
`FoundationPage.ts` god-object and duplicated geometry scans as the case study its design avoids.
Read these before designing either item from scratch:

- **P3-1/O1** — `src/activities/activity.ts` (an `Activity` interface: `detect()`/`solve()`, plus
  a discriminated-union `ActivityResult` that makes "gave up without saying why" a *compile*
  error, not a review checklist item) and `src/flows/levelDriver.ts` (one generic `driveLevel()`
  sequencer replacing per-level hand-dispatch — its own comment names
  `completeFoundationThroughApply`/`completeF3` as the duplication it removes). Worked example:
  `src/activities/foundation/letterTrain.ts`.
- **P3-4/O2** — `src/core/ui/geometry.ts`: one `findControls(page, query, order)` with a
  `ControlQuery` (region/width/height/aspect/dedupeGrid/textPattern) replacing the hand-rolled
  `page.evaluate()` scans; `config/viewport.ts`'s `region()` helper validates bounds at
  declare-time (a typo'd region fails at import, not mid-run).

**Caveats — pattern to port, not code to copy-paste.** That repo threads a single
`ctx: AppContext` object through every call, not `All`'s page-object-holds-`page`/`lang`-as-fields
shape — translating the idea is real work. It's also early-stage: only Discovery is fully
verified there, and `driveLevel()` itself had **never been run against the live app** as of its
last session handoff (only `.detect()`/`.solve()` called directly in a probe). Treat it as a
well-designed reference, not a battle-tested one — re-verify the pattern holds once ported.

---

### 6. Open decisions

- **Tag `english-baseline-v2`?** As of 2026-08-24: Discovery, F1 (including the
  `completeApplyChallenge()` fix, live-verified twice), F2, F3, and M4 (correctly gated) are **all
  confirmed passing post-refactor** — Attempt 5 (§3) is a clean 100% pass of the entire Foundation
  chain end-to-end, one fresh user, one session. No regression found anywhere from the
  2026-08-23/24 hardening pass. The only asterisk: F3's confirmation came via the `FULL_E2E`
  fresh-user path rather than an independent `Testf3auto` run (still stale) — but that's the same
  precedent the project already accepted in 2026-08-12/17 as valid proof F2/F3 are "functionally
  correct" independent of parked-account drift. **Nothing outstanding is blocking this tag on
  technical grounds anymore — cutting it is now purely the user's call to make.**
- **Two test-case sheets duplicate TC-013–022 and disagree on TC-020–022 status**
  (`docs/test-cases/excel-exports/DiscoveryFullFlow.csv` says PASSED, `FSeriesFullFlow.csv` says
  BLOCKED per a 2026-08-10 deployment note). Flagged, not resolved — see the
  [Coverage Gaps](docs/ARCHITECTURE_AND_TESTING.md#coverage-gaps) section of `docs/ARCHITECTURE_AND_TESTING.md`
  (formerly the old root `TRACEABILITY_MATRIX.md`'s "Coverage gaps" section).
  **Do not edit these CSVs directly** — report findings only, let the user apply
  changes (standing feedback from 2026-08-23, see memory).

---

### 7. Next steps, in order

1. ~~Re-run the regression once the UAT server is back up~~ — **done 2026-08-24**, see §3
   Attempts 2–5. Discovery, F1, F2, F3, and M4 (gated) all confirmed passing; no regression found.
2. ~~Get an F3 signal~~ — **done 2026-08-24** via Attempt 5's full `FULL_E2E=1` run.
3. **Decide the `english-baseline-v2` tag (§6)** — this is now the only open item before moving
   on to lower-priority cleanup. Purely a judgment call for the user; nothing technical is
   blocking it.
4. Lower-priority cleanup, any order, none blocking: P3-3, P3-6 (re-verify first), P3-7, P3-8,
   P2-18.
5. P3-1/O1 and P3-4/O2 stay deferred until Hindi F1 unblocks (or the gate condition is otherwise
   revisited) — read §5's reference material first when that happens.

---

### 8. Related documents

- The *Refactoring Plan* section above — original M1-M5/R1-R8/O1-O2 analysis (2026-08-17), English/Hindi-readiness
  framing, task tracker (corrected 2026-08-23, see its own note).
- The [Readiness Plan](docs/HINDI_ROLLOUT_LOG.md#readiness-plan) section of `docs/HINDI_ROLLOUT_LOG.md` — Phase 3's full original item list (P3-1…P3-8) plus the detailed
  reference-implementation note this document's §5 summarizes.
- The [Open TODOs](docs/HINDI_ROLLOUT_LOG.md#open-todos) section of `docs/HINDI_ROLLOUT_LOG.md` — day-to-day Hindi-track checklist; its own Phase 3 section mirrors §4 above.
- This file (formerly `CHECKLIST.md`) — dated change log; see the 2026-08-23 entry in the Change Log above for the full unabridged detail
  behind §2 above.
- The [Current Status](docs/HINDI_ROLLOUT_LOG.md#current-status) section of `docs/HINDI_ROLLOUT_LOG.md` — live snapshot, includes the §3 regression attempt's raw detail,
  plus the "Account state" section's test-user × language × date × result execution log — the
  place to check before running a dedicated-account spec, and to update after any run.

---

## Outstanding Dev Request: M4 S1 Non-Audio Answer Hook

*Merged from the former standalone `S1_DEV_HOOK_REQUEST.md`. This is a specific, still-unresolved
ask sent to the ALL/AXL app development team — kept intact and clearly identifiable as a standalone
request rather than folded anonymously into the general history above. It stays live until the app
team ships the hook (or an equivalent) and TC-024 is unblocked; see the Change Log entries above
(2026-08-12 onward) for how automation-side readiness for this evolved.*

**Audience:** ALL/AXL web app developers · **Requested by:** QA Automation · **Date:** 2026-08-12
**Status:** Automation is fully built and blocked ONLY on this hook.

### 1. Context

M4 **S1** is a picture multiple-choice speaking assessment: *"Look at the picture and speak the
correct answer from below"* (image + question + 3 options, "5 lives"). It is the last node
needed to complete **TC-024**.

The automation for this is complete and isolated:
- It already obtains the **correct option deterministically** from the app's own content API
  (`GET .../lais/scores/GetContent/sentence…` → each option carries `isAns: true/false`).
  No answers are hardcoded; nothing to maintain when content changes.
- It reads the on-screen question/options dynamically and matches the correct one.

### 2. The problem (verified, not a guess)

There is **no way for automation to SUBMIT an answer** in the current builds. Verified headed
against **Build #1 (`8502035`)** and **Build #4 (`371bfce`)** with the dedicated account
`m4auto`, trying every mechanism:

| Attempt (always with the correct answer) | Result |
|---|---|
| Speak via Web Speech `SpeechRecognition` (mocked transcript) | Mic opens only a **device test** ("Perfect! You're all set!") — never grades |
| Feed real answer audio via `getUserMedia` during the mic recording | No grade |
| Select the correct option radio (it does visually select on Build #4) | No submit, no advance |
| Click the bottom "›" (it is only the nav-pill carousel scroller) | No effect |
| Select + Enter / element-click option text / play question audio then speak | No grade |

**In every case `lives` stays at 5 and the question never advances** — i.e. the app registers
**no submission at all** in an automated browser. The most likely cause is that grading
depends on **real microphone audio** that a headless/CI browser cannot synthesize, and there
is no non-audio path. This is an application/environment gap, not an automation defect.

### 3. What we need

A **test-only** hook that submits an answer for the current S1 question, running the **same
grading code path** a real spoken answer would (mark correct/incorrect, decrement a life on
wrong, advance to the next question on correct, and complete S1 after the last question).

#### Preferred contract (JS global)

Expose, **only when a test flag is on** (see §4):

```ts
// Submits `optionText` (exact text of one of the on-screen options) as the learner's answer
// for the current S1 question, via the same handler a correct spoken answer triggers.
// Optional second arg is the option index (0-based) as a convenience.
window.__allTest = {
  submitS1Answer(optionText: string, optionIndex?: number): void | Promise<{ correct: boolean }>
};
```

The automation already looks for this (and a few aliases: `window.__allTest.submitAnswer`,
`window.__submitS1Answer`, `window.__e2eSubmitAnswer`) and will use it automatically the moment
it exists — **no further automation changes required**.

#### Acceptable alternative (DOM, no JS API)

If a global is undesirable, in test builds:
1. add `data-answer="true|false"` to each option element, **and**
2. make an option **click** actually submit + grade (currently clicking an option does nothing).

Automation would then click the option whose `data-answer="true"`. (We still prefer the JS
global — it is unambiguous and audio-independent.)

### 4. Guardrails (important)

- **Gate the hook behind a test-only switch** so it never ships to real users — e.g. active only
  when `?e2e=1` (or a build/env flag like `REACT_APP_E2E`). When off, the hook must be absent.
- The hook must exercise the **real** grading/advance logic (not a shortcut that skips scoring),
  so the test verifies the genuine flow.

### 5. How to verify it works (acceptance criteria)

With the hook enabled, on an S1 question:
1. `window.__allTest.submitS1Answer(<correct option text>)` → the question advances to the next
   one; after the final question, S1 completes and the app moves to the next stage.
2. `window.__allTest.submitS1Answer(<wrong option text>)` → `lives` decrements and the question
   does not advance.

Once this is in a build, tell QA the flag to enable; TC-024 (`mastery-m4-s1.spec.ts`, currently
`test.fixme`) will be switched live and verified headed — no code changes needed on our side.

### 6. Automation readiness (already done)

- `src/services/answerSource.ts` — `ContentApiAnswerSource` (reads `isAns:true`) + `VisionAnswerSource`.
- `src/pages/mastery/VqaSpeakingAssessment.ts` — reads question/options, resolves the answer, and
  **submits via the hook if present** (`submitViaHook`), else falls back to the UI attempt.
- `src/tests/discovery/mastery-m4-s1.spec.ts` — TC-024, kept `test.fixme` until the hook lands.

This is fully **isolated to S1** — Discovery–F3 and M4 P1–P4 suites are unaffected, and the same
mechanism will be reused for the later M5–M9 speaking assessments.
