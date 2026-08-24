# Language Onboarding — Runbook

**Who this is for:** anyone adding a new UI language to this test-automation suite, even without
prior experience in this codebase. Every step below says what to do, **why it matters**, and how
to check you did it correctly. Where you need to read or write code, the exact file and an example
are included.

**Where this comes from:** this procedure is distilled from actually doing it once, for Hindi
(branch history `feat/hindi`). The detailed evidence trail for that specific pass — every string
observed, every run result — lives in `docs/HINDI_ROLLOUT_LOG.md`'s
[Readiness Plan, Phase 4](docs/HINDI_ROLLOUT_LOG.md#phase-4--hindi-discovery--f1),
[Execution Log](docs/HINDI_ROLLOUT_LOG.md#execution-log), and
[Decisions Log](docs/HINDI_ROLLOUT_LOG.md#decisions-log) sections. This doc is the reusable "how
to do it again for language #3, #4, #5" version.

This single file merges what used to be three separate docs: the language-onboarding runbook
itself, the Windows TTS-voice admin runbook it depends on for Step 3 (now **Appendix A**), and the
Hindi test-data provenance note that serves as a worked example of Step 5 (now **Appendix B**).
Nothing from any of the three was dropped in the merge.

---

## Table of contents

- [0. Read this first — the one rule that matters more than any step below](#0-read-this-first--the-one-rule-that-matters-more-than-any-step-below)
- [1. Glossary — terms used throughout this doc](#1-glossary--terms-used-throughout-this-doc)
- [2. Before you start — prerequisites and scope decision](#2-before-you-start--prerequisites-and-scope-decision)
- [3. Step 1 — Register the language's name in the code](#3-step-1--register-the-languages-name-in-the-code)
- [4. Step 2 — Look at the real app and write down exactly what it says (observation)](#4-step-2--look-at-the-real-app-and-write-down-exactly-what-it-says-observation)
- [5. Step 3 — Set up a computer voice for the language (only needed for F1 and beyond)](#5-step-3--set-up-a-computer-voice-for-the-language-only-needed-for-f1-and-beyond)
- [6. Step 4 — Add the observed text into `uiCopy.ts`](#6-step-4--add-the-observed-text-into-uicopyts)
- [7. Step 5 — Add the small data files with real example content](#7-step-5--add-the-small-data-files-with-real-example-content)
- [8. Step 6 — Sanity-check a few things that don't automatically "just work"](#8-step-6--sanity-check-a-few-things-that-dont-automatically-just-work)
- [9. Step 7 — Prove nothing broke, and prove the new language actually works](#9-step-7--prove-nothing-broke-and-prove-the-new-language-actually-works)
- [10. Step 8 — Write down what you did](#10-step-8--write-down-what-you-did)
- [Appendix: where the pieces live, and how to shape your commits](#appendix-where-the-pieces-live-and-how-to-shape-your-commits)
- [What you do *not* need to touch](#what-you-do-not-need-to-touch)
- [Quick checklist](#quick-checklist)
- [Appendix A: TTS Voice Setup (Admin Runbook)](#appendix-a-tts-voice-setup-admin-runbook)
- [Appendix B: Worked Example — Hindi Test Data Provenance](#appendix-b-worked-example--hindi-test-data-provenance)

---

## 0. Read this first — the one rule that matters more than any step below

**Every piece of text or data you add for the new language must come from actually looking at the
real app running in that language — never from translating English yourself, and never from
guessing what the app "probably" says.**

This isn't a style preference — the whole suite is built around enforcing it. If you type in a
translation instead of an observed string, the test will either:
- **fail loudly and immediately** (good outcome — a missing/wrong string throws a clear error and
  you find out right away), or
- **worse — pass anyway on the wrong text**, which means the automation is now silently checking
  nothing. That is the one outcome this whole design exists to prevent.

A real example of why this matters happened during the Hindi work: a reference spreadsheet said
the app's "Confirm" button in Hindi reads **"पुष्टि करें"**. When someone actually looked at the
live app, it said **"कन्फर्म करें"** instead — a different (and more common) Hindi phrase for the
same idea. Both are valid Hindi. Only one is what the app actually shows. If the spreadsheet's
version had been typed in without checking, the test would have looked for text that would never
appear, and either hung until it timed out or — if written carelessly — silently done nothing.
**Always look at the live screen. Never fill in a value from memory, a translation tool, or a
document, no matter how official it looks.**

---

## 1. Glossary — terms used throughout this doc

You don't need programming background to follow the steps, but a few words come up repeatedly:

| Term | Meaning here |
|---|---|
| **UI copy / copy** | The literal text words the app displays on screen — button labels, headings, popup messages. `uiCopy.ts` is the file that stores these, one per language. |
| **`uiCopy.ts`** | The single file (`src/utils/uiCopy.ts`) that holds every piece of app text the automation looks for, organized as `key: { english: '...', hindi: '...' }`. |
| **Key** | A short internal name for one piece of text, e.g. `confirm`, `startAssessment`. Not shown to real users — it's just how the code refers to "the Confirm button's label," in whichever language. |
| **Language code** | A short lowercase word used everywhere in the code and folder names for a language: `english`, `hindi`, `tamil`. Not the same as the label — see below. |
| **Label** | The text the app itself shows for a language's name, in that language — e.g. Hindi's label is `हिंदी`, not `Hindi`. |
| **TTS (Text-to-Speech)** | The Windows feature that turns typed text into spoken audio. Some tests need to "speak" a word into a fake microphone so the app can be tested as if a student said it out loud. |
| **SAPI5 voice** | A specific kind of Windows text-to-speech voice that older/desktop software (including this suite) can use. Windows also has a newer kind ("OneCore") that looks similar but isn't automatically usable by this suite — see Step 3. |
| **Culture code / BCP-47 tag** | A standard short code for "language as spoken in a place," e.g. `hi-IN` (Hindi, India), `ta-IN` (Tamil, India). Windows voices are labeled with these. |
| **Fixture / test data** | Small files of real, observed example content (like the exact sentence Discovery displays) that the automated tests need in order to run. Stored under `src/testdata/<language-code>/`. |
| **Regression** | Running the *existing* English tests again after making a change, to prove you didn't accidentally break anything that used to work. |
| **Live run** | Actually running the automated test against the real running app (as opposed to just reading code) — this is the only way to prove something really works. |
| **Throw / throws an error** | Programmer's way of saying "the code stops and reports a specific error message" instead of continuing silently. In this codebase, throwing on a missing translation is intentional and good — see Section 0. |
| **Regex / regular expression** | A pattern used to search for text. You will see these in the code, but for most of this task you are filling in a plain text string, not writing a regex yourself — the surrounding code builds the pattern for you. |
| **Scope** | How far into the app you're testing in the new language: just the sign-up/placement flow ("Discovery"), or also the first real lesson set ("F1"), or further. Decide this before you start (Step 2). |

---

## 2. Before you start — prerequisites and scope decision

1. **Access.** You need:
   - The repo checked out locally, with `npm install` already run.
   - Access to a real running build of the app in the target language (a test/UAT environment,
     not production), so you can actually look at real screens.
   - If your scope includes the first lesson set ("F1") or beyond: **Administrator access** on the
     Windows machine that will run the tests (needed only for Step 3, one time).
2. **Decide your scope, in writing, before touching any file.** Pick one:
   - **Discovery only** — the sign-up, placement quiz, and result screen. No speech synthesis
     needed. Least work.
   - **Discovery + F1** — adds the first lesson set, which needs the app to "hear" a spoken word,
     which needs a computer voice for that language (Step 3) and roughly 35 more pieces of text
     (Step 5).
   - **Further (F2/F3/Mastery)** — needs pre-set-up test accounts too (Step 6). Not covered in
     full detail here — ask before starting this, since it's a bigger commitment.

   Why decide this up front: the amount of text you need to collect and add is directly tied to
   how far into the app you're testing. Deciding late means redoing the "what do I need" analysis
   partway through.

---

## 3. Step 1 — Register the language's name in the code

**File:** `src/utils/languages.ts` — look for the block that starts with `export const LANGUAGES = [`.

**What this is:** a plain list of every language the app's own language switcher can offer, and
the exact word the app uses for each one's name (in that language). The automation reads this
list to know, e.g., "when this run should be in Tamil, the button I'm looking for says தமிழ், not
the English word Tamil."

**Why it matters:** almost everything else in this codebase looks up a language by this short
code and by this label. If the label here doesn't exactly match what the app shows on screen
(including exact spelling and script), every subsequent step that depends on "does the screen say
X" will silently fail to match.

**What to do:**
- If your language is already listed (as of this writing: `tamil`, `telugu`, `kannada`,
  `gujarati`, `odia` all already have an entry, alongside `english` and `hindi`), you likely don't
  need to add anything — but still **open the real app's language switcher and visually confirm**
  the label matches exactly what's on screen right now. Apps get updated; text can change between
  versions. (This exact thing happened during Hindi onboarding — see Section 0's example.)
- If it's genuinely new, add one line following the existing pattern:
  ```ts
  { code: 'tamil', label: 'தமிழ்', aliases: ['Tamil'] },
  ```
  - `code`: lowercase, short, no spaces — this becomes the value you'll type after `--lang=`
    when running tests, and the name of a folder you'll create later.
  - `label`: **copy-pasted from the real app's own on-screen switcher**, not typed from memory —
    getting even one character wrong (a different diacritical mark, for instance) will make every
    "is the app now showing this language?" check fail.
  - `aliases`: any other spelling the app uses elsewhere for the same language — commonly the
    English name (`'Tamil'`).

**How to check you did this right:** open the app's language-picker popup on a real device/browser
and compare, character by character, against what you typed. When in doubt, zoom in on a
screenshot — some scripts have very similar-looking letters.

---

## 4. Step 2 — Look at the real app and write down exactly what it says (observation)

**What this is:** before writing any code, you (or whoever is doing this) walk through the actual
app in the target language — as a real student would — and record, screen by screen:
- The exact wording of every button, heading, and popup message.
- Any accessible image labels (screen-reader text on icons).
- The exact sentence(s) shown on the placement-quiz demo screen.
- Any audio file names you can see in the browser's network activity, if you know how to check
  that (not required if you're not comfortable with browser dev tools — a developer can do this
  part).

**Why it matters:** this is the raw material for every later step. Steps 5 and 6 below are just
"take what you wrote down here and put it into the right file." If this step is skipped or rushed,
every later step either breaks or gets filled with guesses — which Section 0 already explained is
the one thing not to do.

**How to actually do this, practically:**
- The easiest way is to have a developer run a small throwaway script that walks through the app
  automatically and takes a screenshot + full text dump of every screen along the way. There's
  already an example of this kind of script that was used for Hindi:
  `src/tests/discovery/_hindi-observation-probe.spec.ts` (its filename starts with `_` and it's
  marked "DO NOT COMMIT" at the top — it's a disposable helper, not part of the permanent test
  suite). A developer can copy that file, change the language it targets, and run it to get the
  same kind of screen-by-screen record for the new language.
- If no such script exists yet for your case, the fallback is manual: create a fresh guest login
  in the target language and click through every screen in your chosen scope, writing down the
  exact text and taking a screenshot of each screen.

**Specific things to double-check while you're looking (these surprised people during Hindi):**
- Some screens (the microphone-permission "Skip" button, and the "Confirm" button on the
  help-language popup, right at the very start of the flow) may show up in **English even when
  you're testing a different language** — the app hasn't been told the target language yet at
  that exact point. If you see this, it's expected — don't try to find a translated version of
  that specific screen, there may not be one to find, and the code already treats these two
  screens specially (see Step 5).
- The language-picker popup might have the new language **already pre-selected** for a fresh
  guest account instead of requiring you to actively choose it. Both behaviors are handled by the
  existing code — just note honestly which one you saw.
- A few buttons are icons only, with no visible text at all (this happened with the "Let's Start"
  button in Hindi — it's a picture, not a word). If a button has no text, write down "no text —
  icon only," don't invent a label for it.

---

## 5. Step 3 — Set up a computer voice for the language (only needed for F1 and beyond)

**Skip this whole step if your scope is Discovery-only** (Section 2) — the placement quiz doesn't
need the app to "hear" anything.

**What this is:** starting from the first lesson set (F1), one exercise asks the student to say a
word out loud, and the app listens for it through the microphone. Since there's no student in the
loop during automated testing, the test computer has to generate a fake spoken-word recording and
feed it into a fake microphone — using a Windows text-to-speech voice for that language.

**Why it matters:** without this, that one exercise has no way to give a correct spoken answer,
and every test in F1 or beyond will get stuck at that exercise.

**What to do, in order (this part needs Administrator rights on the test machine — it's a one-time
setup per machine, not something each test run does):**

1. Follow the step-by-step instructions in **[Appendix A: TTS Voice Setup (Admin Runbook)](#appendix-a-tts-voice-setup-admin-runbook)**
   below. In short: an administrator installs a Windows "speech pack" for the target language
   (e.g. Tamil → `ta-IN`), then double-checks it actually shows up in the *specific* list this
   suite reads from (Windows sometimes installs a similar-but-different, newer kind of voice that
   this suite cannot see automatically — Appendix A explains exactly how to tell the difference
   and what to do if that happens).
2. Once a real, working voice is confirmed installed, a developer adds **one line** to
   `src/utils/TtsHelper.ts`, in the list that starts with `const VOICE_CULTURE = {`:
   ```ts
   const VOICE_CULTURE = {
       hindi: 'hi-IN',
       tamil: 'ta-IN',   // <-- new line, using the culture code confirmed in step 1
   };
   ```
3. **Prove the voice actually speaks**, not just that Windows lists it as installed — a voice can
   be "installed" but silently produce a blank/empty sound file for a given piece of text, which
   looks identical to success unless you check the file size. Appendix A explains the exact way to
   test this safely, and it matters that it's tested the *same way the automation itself will use
   it* (there's a known Windows quirk where testing it a slightly different way gives a false "it
   doesn't work" result — Appendix A calls this out explicitly).
4. Update the small status table at the end of Appendix A with the result, so the next person
   doesn't have to redo this investigation.

**How to check you did this right:** Appendix A's own verification steps produce a clear yes/no
answer — either you get real spoken audio (a sizeable sound file) or a clear error message naming
the problem. There's no ambiguous "probably fine" outcome here by design.

---

## 6. Step 4 — Add the observed text into `uiCopy.ts`

**File:** `src/utils/uiCopy.ts`.

**What this is:** the file structure looks like this — one line per piece of text ("key"), with
one value per language:
```ts
confirm: { english: 'Confirm', hindi: 'कन्फर्म करें' },
```
You are adding your language as one more entry on lines like this, using **exactly** what you
wrote down in Step 2 — copy-pasted, not retyped from memory if you can avoid it (retyping risks a
small, invisible mistake in a script you may not read fluently).

**Why it's built this way:** if a piece of text is missing for a language, the code deliberately
**stops with a clear error** naming exactly which piece of text is missing, instead of quietly
skipping it or falling back to English. That's a safety feature: a run that silently fell back to
English would look successful while not actually testing the target language at all. You'll see
this error yourself while doing this step — that's expected, not a bug.

**What to do:**
1. First, check where you stand. From the repo's root folder, run:
   ```
   node scripts/check-language-readiness.js tamil
   ```
   (replace `tamil` with your language's code). This prints something like:
   ```
   tamil (தமிழ்): 0/57 uiCopy keys populated
     Missing 57: skip, confirm, chooseHelpLanguage, startAssessment, ...
   ```
   This is your worklist. You do **not** need all of them if your scope is smaller than the full
   app — see the next point.
2. Figure out which of those keys you actually need for your scope.
   [`docs/HINDI_ROLLOUT_LOG.md`'s Readiness Plan, Phase 4](docs/HINDI_ROLLOUT_LOG.md#phase-4--hindi-discovery--f1)
   (the "uiCopy gap" table) has the exact worked-out list of which keys matter for a
   Discovery+F1 scope and which are needed only so the code doesn't crash on startup (even though
   nothing actually reads them in that scope) — the same list applies to any language, because
   it's driven by which screens get built for that scope, not by which language you're adding.
3. For each key you have an observed value for, add your language as a new entry, e.g.:
   ```ts
   startAssessment: { english: 'Start Assessment', hindi: 'असेसमेंट शुरू करें', tamil: '<what you observed>' },
   ```
   Do not remove or change the `english:` value that's already there — you're adding alongside it.
4. **If the word order is different in your language, that's fine and expected — write it as you
   observed it.** For example, English says "Start F1" (verb first), but the equivalent Hindi
   phrase observed on screen put the level name first and the verb last. The code already
   supports this (it's why some entries use a `{level}` placeholder instead of a fixed word
   order) — just write down what the screen actually shows, in the order it actually shows it.
5. Run the readiness check again after each batch you add, to watch the "missing" count go down
   and confirm you're not accidentally introducing a typo (a typo in the *key name*, e.g. spelling
   `confirm` as `confrim`, will make the script still report it as missing).
6. **Leave out anything you genuinely didn't see on a real screen.** Don't fill a gap with a guess
   "just to make the error go away" — the error is telling you the truth (you haven't observed
   that text yet), and silencing it with a guess reintroduces exactly the risk Section 0 describes.

**How to check you did this right:** `node scripts/check-language-readiness.js <your-code>` shows
0 missing for the keys your scope needs (a few keys outside your scope being reported as missing
is fine and expected — you're not filling in the whole app in one pass).

---

## 7. Step 5 — Add the small data files with real example content

**Folder:** `src/testdata/<your-language-code>/` (e.g. `src/testdata/tamil/`) — create it if it
doesn't exist.

**What this is:** a couple of small files holding a handful of real, observed pieces of content
the tests need as reference, separate from `uiCopy.ts`'s button/label text.

**What to add:**
1. `discovery-data.json` — at minimum, the exact sentence shown on the Discovery demo screen, in
   the target language, e.g.:
   ```json
   { "demoSentence": "<the exact sentence you observed on screen>" }
   ```
2. `accounts.json` — **only if your scope reaches the second/third lesson set or further** — these
   need a pre-positioned test account rather than a fresh guest. Skip this file for a
   Discovery/F1-only scope; a brand-new guest account is created automatically for every run
   regardless of language, so there is nothing to prepare here for that scope.
3. `README.md` — a short note recording: the date you observed this, which version/build of the
   app you looked at, which environment (test/UAT link), and what you did and didn't capture.
   See **[Appendix B: Worked Example — Hindi Test Data Provenance](#appendix-b-worked-example--hindi-test-data-provenance)**
   below as a template for the format. This matters months later when someone needs to know "was
   this actually checked against the real app, or made up" — the date and build number are your
   evidence.

**Why it matters:** the code that loads these files is written to fail with a clear, specific
message ("test data is missing for language X, go observe it on a real build") rather than
crashing mysteriously or silently using empty/wrong data — so if you forget this step, you'll find
out immediately and clearly when you try to run a test.

---

## 8. Step 6 — Sanity-check a few things that don't automatically "just work"

A lot of the underlying code was written to handle any language/script automatically (any
alphabet, any combination of accents/marks) — but a few specific things were **never actually
confirmed on a real non-English build** and are worth a deliberate look rather than an assumption:

- **Do the on-screen counters (like "Fuel: 3/10" or a progress count) use the language's own
  digit characters, or plain 0-9 regardless of language?** Some languages have their own numeral
  characters (Hindi has १२३ for 123, for example) and some app builds render these; others keep
  plain digits everywhere. Look at a counter on screen and check. If it does use the language's
  own digits, flag it to a developer — the code that reads and does arithmetic on those numbers
  currently only understands plain 0-9 and would need a small addition.
- **Does the "say a word out loud" exercise's answer-checking work correctly for this script?**
  This is a developer-level check (comparing what the fake microphone "said" against what the
  screen expects), but worth explicitly asking about rather than assuming it's fine, since it
  hasn't been proven correct for every script yet.
- **Do any buttons/answer-bubbles get missed or mis-clicked because the text is taller/wider than
  English text?** Some scripts have accent marks that sit above or below the main letter, making
  a line of text taller than the equivalent English line. If you notice the automation clicking
  the wrong spot or missing a button that's clearly visible on screen, tell a developer exactly
  which screen — that's the specific, provable case where the "clickable area" for a button should
  be widened, rather than widening things speculatively ahead of time.

None of these need to block you from starting — they're things to watch for and report, not
prerequisites.

---

## 9. Step 7 — Prove nothing broke, and prove the new language actually works

Do these in order — don't skip ahead if an earlier one fails:

1. **Have a developer run the project's type-check and linter** (automated code-quality checks) —
   these should report zero new problems caused by your changes.
2. **Confirm the English tests still pass exactly as before.** This is the most important safety
   check: adding a new language should have **zero effect** on the existing English test suite.
   This is usually done by running the full English regression test and comparing to a previous
   passing run.
3. **Run the real test suite against the real app, in your new language**, scoped to whatever you
   decided in Section 2 (Discovery-only, or Discovery+F1). The exact command looks like:
   ```
   node scripts/run-e2e.js --lang=tamil
   ```
   (A developer will know the right specific command/flags for your exact scope.)
4. **Expect this to take a few rounds.** The Hindi pass needed five attempts before Discovery
   passed cleanly — each attempt failed on exactly one clearly-identified missing piece of text or
   one specific wrong assumption, which was then fixed before the next attempt. That's the normal,
   expected process, not a sign that something is going wrong with the approach. Fix one thing,
   re-run, repeat.

---

## 10. Step 8 — Write down what you did

Keep a record, the same way the Hindi work did, so the next person (including a future you) isn't
starting from zero:
- Any surprising thing you found while observing the app (e.g., "the Confirm button here is
  always in English, even when testing Tamil") belongs in
  [`docs/HINDI_ROLLOUT_LOG.md`'s Decisions Log](docs/HINDI_ROLLOUT_LOG.md#decisions-log).
- A plain record of what you ran and what happened (including the failed attempts, not just the
  final success) belongs in
  [`docs/HINDI_ROLLOUT_LOG.md`'s Execution Log](docs/HINDI_ROLLOUT_LOG.md#execution-log).
- If you did the text-to-speech setup (Step 3), update the status table in
  **[Appendix A: TTS Voice Setup (Admin Runbook)](#appendix-a-tts-voice-setup-admin-runbook)** below.
- Keep your code changes in separate, clearly-labeled commits by topic (e.g., one commit for the
  `uiCopy.ts`/test-data additions, a separate one for the text-to-speech wiring) rather than one
  giant "add Tamil" commit — this makes it much easier to review and, if something needs undoing
  later, to undo just that one piece.

---

## Appendix: where the pieces live, and how to shape your commits

**File map** — everything a language addition touches, in one place:

```text
src/
├── utils/
│   ├── languages.ts
│   ├── uiCopy.ts
│   └── TtsHelper.ts
│
├── testdata/
│   └── <language-code>/
│       ├── discovery-data.json
│       ├── accounts.json          # F2/F3/Mastery only
│       └── README.md
│
├── tests/
│   └── discovery/
│       └── _<language>-observation-probe.spec.ts  # temporary only, do not commit

config/
└── language.ts

docs/
└── LANGUAGE_ONBOARDING.md   # this file (Appendix A covers TTS voice setup)

scripts/
├── check-language-readiness.js
└── run-e2e.js

docs/
└── HINDI_ROLLOUT_LOG.md   # Decisions Log + Execution Log sections
```

**Commit shape** — avoid one large "add Tamil" commit; prefer commits scoped by concern, e.g.:

```text
feat(language): add Tamil UI copy and test data
feat(tts): add Tamil voice configuration
test(language): validate Tamil Discovery and F1 flow
```

Keeping these separated makes review, debugging, and rollback easier — see Step 8.

---

## What you do *not* need to touch

To avoid wasted effort, these are already written to work for any language without changes —
confirmed by reading the current code, not assumed:
- The actual test scripts themselves (they take `--lang=` as an option; there's no separate script
  per language, and there shouldn't need to be one).
- The setup that reads which language a run should use (`config/language.ts`).
- The code that loads test-data files and account fixtures — it's generic and reads whichever
  language folder you created in Step 5.
- The report/summary page that shows test results — it already labels results by whichever
  language was tested.
- The character-matching code for letters and combining marks (accents, matras, etc.) — it's built
  to handle any alphabet already, not just Latin letters. (Still worth the sanity checks in Step
  6 — "built to handle it in general" and "confirmed correct for this specific script" are
  different things.)

---

## Quick checklist

- [ ] Scope decided (Discovery / Discovery+F1 / further) — Section 2
- [ ] Language registered in `src/utils/languages.ts`, label visually verified against the live app — Step 1
- [ ] Real app observed screen-by-screen, exact text written down — Step 2
- [ ] (F1+ only) Computer voice installed, confirmed working, wired into `TtsHelper.ts` — Step 3
- [ ] `uiCopy.ts` filled in for the keys your scope needs; readiness script shows 0 missing for
      those keys — Step 4
- [ ] `src/testdata/<code>/discovery-data.json` (+ `accounts.json` only if in scope) + `README.md`
      added — Step 5
- [ ] Digit rendering, spoken-answer checking, and button-click accuracy checked against the real
      app, not assumed — Step 6
- [ ] Code-quality checks clean; English tests still pass unchanged; new-language test run passes
      for your scope — Step 7
- [ ] Findings written down in `docs/HINDI_ROLLOUT_LOG.md`'s Decisions Log / Execution Log /
      Appendix A's status table; changes committed in separate, labeled commits — Step 8

---

## Appendix A: TTS Voice Setup (Admin Runbook)

**Purpose:** install a Windows SAPI5 text-to-speech voice for a language this suite's F-series
"say the word" mic-injection mechanic needs (`src/utils/TtsHelper.ts`). This is an **admin-only,
one-time, per-runner** action — not something the test session itself can do (see *Why this needs
admin* below). Repeat this for every new language that reaches F1+ in the onboarding process
tracked in [`docs/HINDI_ROLLOUT_LOG.md`'s Readiness Plan](docs/HINDI_ROLLOUT_LOG.md#readiness-plan)
(Step 3 of the main runbook above links here).

### Why this needs admin

`TtsHelper.ts` synthesizes the displayed word locally via
`System.Speech.Synthesis.SpeechSynthesizer` (Windows SAPI5) and injects the resulting WAV into the
browser's fake microphone. That API only sees voices registered under
`HKLM:\SOFTWARE\Microsoft\Speech\Voices\Tokens` — a machine-wide (`HKLM`) hive. Installing a
Windows language/TTS capability writes there, which requires local Administrator rights. A
non-admin test-runner session cannot do this itself; `Get-WindowsCapability -Online` fails with
"requires elevation" otherwise (confirmed on this runner, 2026-08-18 — see
[`docs/HINDI_ROLLOUT_LOG.md`'s Execution Log, EL-5](docs/HINDI_ROLLOUT_LOG.md#execution-log)).

**Docker does not sidestep this.** `System.Speech` is a Windows-only .NET Framework API — it does
not exist on Linux, so a Linux container can't run it at all. Windows containers could in theory,
but Windows Server Core/Nano base images are stripped down and typically lack the Speech
component and DISM feature-source media needed to add a language pack inside the image build —
a real infra investment, not a shortcut around this runbook.

### Steps (run as Administrator)

Replace `hi-IN` with the target language's BCP-47 tag for languages after Hindi.

#### 1. Install the TTS capability

```powershell
# Confirm the exact capability name for this Windows build first — the version suffix can differ.
Get-WindowsCapability -Online | Where-Object Name -like "Language.TextToSpeech*hi-IN*"

# Install it (adjust the name to exactly what the command above printed, if different)
Add-WindowsCapability -Online -Name "Language.TextToSpeech~~~hi-IN~0.0.1.0"
```

This can take a few minutes and may prompt a restart.

#### 2. Restart

If prompted, restart the machine. If not, at least close and reopen the PowerShell/terminal
session — voice registration sometimes only becomes visible in a fresh session.

#### 3. Verify it's visible where the tests actually look (SAPI5, not just OneCore)

```powershell
Add-Type -AssemblyName System.Speech
(New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices() |
    ForEach-Object { $_.VoiceInfo } | Format-Table Name, Culture, Id -AutoSize
```

Look for a row with the target **Culture** (e.g. `hi-IN`). Also check the registry directly:

```powershell
Get-ChildItem 'HKLM:\SOFTWARE\Microsoft\Speech\Voices\Tokens'
```

**If the voice appears in both** — done. Report back so H1 (or the equivalent onboarding task for
that language) can be re-verified and `TtsHelper` wired to select it.

#### 4. If it only appears under OneCore, not SAPI5 — a known Windows trap

```powershell
Get-ChildItem 'HKLM:\SOFTWARE\Microsoft\Speech_OneCore\Voices\Tokens'
```

If the voice shows up here but **not** in Step 3's `GetInstalledVoices()`, Windows installed the
modern "OneCore" voice (used by Narrator/WinRT), which classic `System.Speech` does not see by
default. This is a documented split, not a mistake in the steps above.

**✅ RESOLVED for hi-IN, 2026-08-19** — see *The OneCore→SAPI5 bridge, worked example* below for
the exact script and why it's safe. The short version: the OneCore and SAPI5 voices on this
runner share the identical engine CLSID (`{179F3D56-1B0B-42B2-A962-59B7EF59FE1B}`, confirmed via
`HKLM:\SOFTWARE\Classes\CLSID\<clsid>\InprocServer32`), so the bridge is a verbatim registry-key
copy — no CLSID remapping needed. This may not hold on every Windows build; re-verify the CLSID
match before assuming the same script works elsewhere.

#### The OneCore→SAPI5 bridge, worked example (hi-IN, 2026-08-19)

1. Confirm both tokens' `CLSID` value match (`Get-ItemProperty` on each token). If they don't
   match, stop and investigate further before copying anything — a mismatched CLSID means the
   OneCore voice uses a genuinely different (and possibly SAPI5-incompatible) engine.
2. For each OneCore voice token, create a same-named key under
   `HKLM:\SOFTWARE\Microsoft\Speech\Voices\Tokens\<name>` and copy every value (including the
   `Attributes` subkey) verbatim from the OneCore source. This only ADDS new keys — it never
   touches any existing SAPI5 voice, and is trivially reversible
   (`Remove-Item -Recurse` the new key).
3. Verify with `GetInstalledVoices()` (Step 3 above) — the bridged voice should now appear.
4. **Verify it actually SPEAKS, not just that it's listed.** A registry-visible voice that
   silently produces a 44-byte WAV on `.Speak()` is a real failure mode distinct from "not
   bridged at all" — test with the SAME invocation mechanism the framework actually uses
   (`TtsHelper.ts`'s `execFileSync(['-Command', ps])`, not a saved `.ps1` file run via `-File`).
   **This distinction matters**: Windows PowerShell 5.1 reads a `.ps1` file using the system
   codepage unless it has a UTF-8 BOM, so a script file containing literal non-Latin text (e.g.
   Devanagari) run via `-File` can silently double-encode that text into garbage before the
   engine ever sees it — producing the exact same 46-byte "silence" symptom as a missing voice,
   for a completely different reason. `-Command` with the PowerShell code passed as a process
   argument does NOT have this problem (Windows delivers the argument as UTF-16 directly), which
   is exactly why `TtsHelper.ts` uses that form. Confirmed: `execFileSync` with real Devanagari
   text produced 41,966 bytes (real speech) on the first try; a `.ps1`-file `-File` test of the
   identical text produced 46 bytes (silence) until the test itself was rewritten to also use
   `-Command`-style invocation.

### Status by language

| Language | Capability installed? | Visible in `GetInstalledVoices()` (SAPI5)? | Notes |
|---|---|---|---|
| English (`en-US`) | ✅ pre-installed | ✅ `Microsoft David Desktop`, `Microsoft Zira Desktop` | Default on this runner |
| Hindi (`hi-IN`) | ✅ installed | ✅ `Microsoft Hemant`, `Microsoft Kalpana` (bridged) | **H1 CLOSED, 2026-08-19.** `TtsHelper.ts` now selects by culture (`hi-IN`) via `VOICE_CULTURE`; verified producing real speech for actual Devanagari text through the framework's own invocation path. |

Update this table (and [`docs/HINDI_ROLLOUT_LOG.md`'s Readiness Plan](docs/HINDI_ROLLOUT_LOG.md#readiness-plan)) after each attempt, whatever the outcome.

---

## Appendix B: Worked Example — Hindi Test Data Provenance

*Originally recorded at `src/testdata/hindi/README.md` as the provenance note for the Hindi test
data added in Step 5 of the main runbook above. Kept here verbatim as a worked example of what
that step's `README.md` should look like in practice.*

**Date observed:** 2026-08-19
**Build:** all-3.0.7 (Build #12, commit 861b025)
**Environment:** UAT (https://all-uat.theall.ai)
**Probe:** H2a (throwaway observation probe, `_hindi-observation-probe.spec.ts`)

### Overview

All values below were **observed on a real Hindi build** running through Discovery→Assessment→F1
flow. No values are translated, guessed, or imported from any other source — they are
screen-captures from the live app.

### Data

#### `discovery-data.json`

- **demoSentence**: "बिल्ली सो रही है।"
  - Observed on the Discovery Assessment demo screen
  - Sentence-narration audio: `https://all-uat.theall.ai/audio/audio-preview/sentence-recording/hi/narration<N>.wav`

#### Assessment items observed (H2a probe, capped at 4 items for diagnostic purposes)

1. "बिल्ली सो रही है।" (demo sentence)
2. "माँ रोज खीर बनाती है।" (Mother makes kheer every day)
3. "दूध में चीनी मिलाती है।" (Mixes sugar in milk)
4. "दूध में चीनी मिलाती है।" (same, repeated)

### H2a results summary

**Test flow:** Discovery login → Mic test → Help language → Learn language (Hindi switch) →
Start assessment → Assessment items (4) → Letter Hunt → F1 Landing

**Screens captured:** 22 with full text, screenshots, geometry, and URL tracking

**H-1 confirmed:** Pre-language-switch screens (TC-001 mic-test, TC-002 help-language) render in
the app's default English, not the run's target Hindi

**Evidence location:** `test-results/hindi-probe/` (screenshots + text files)

**Stopping point:** F1 Letter Train landing (TTS not available — H1 blocked by OneCore/SAPI5
bridge at the time this was recorded; see Appendix A above, which the bridge work later resolved)

### Notes

- This data covers only the Discovery phase and early F1.
- F2/F3 Hindi strings are not captured (deferred to H2b if needed).
- Word-narration audio testing is blocked (H1: no hi-IN SAPI5 voice installed, as of this note —
  see Appendix A for the resolution).
- For uiCopy values and other Hindi strings observed, see
  [`docs/HINDI_ROLLOUT_LOG.md`'s Execution Log, EL-7](docs/HINDI_ROLLOUT_LOG.md#execution-log).
