# Playwright Test Automation Framework

A modular, scalable test automation framework built with Playwright and TypeScript, driving the **ALL** learning app (EkStep Practice Platform) end-to-end through Discovery, Foundation (F), and Mastery (M) assessments.

## Table of Contents

- [Framework Overview](#framework-overview)
  - [Architecture](#architecture)
  - [Architecture Layers](#architecture-layers)
- [Test Coverage — Discovery & Foundation (F) Series](#test-coverage--discovery--foundation-f-series)
- [Discovery Suite Reference](#discovery-suite-reference)
- [Test-Case CSV Exports](#test-case-csv-exports)
- [Setup Instructions](#setup-instructions)
- [Environment Configuration](#environment-configuration)
- [Environment Execution Guide (UAT / LAB / LAB2)](#environment-execution-guide-uat--lab--lab2)
- [Execution Commands](#execution-commands)
- [Quick Reference — Common Commands](#quick-reference--common-commands)
- [Reporting](#reporting)
- [Environment Setup (Local / Staging / Production)](#environment-setup-local--staging--production)
- [CI/CD Execution](#cicd-execution)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Framework Overview

This framework follows the **Page Object Model (POM)** pattern with a clean separation between:
- **Page Objects**: Individual page representations with locators and basic actions
- **Modules**: Business flow implementations combining multiple page actions
- **Fixtures**: Custom Playwright fixtures for easy dependency injection
- **Test Data**: JSON-based test data separated from test logic
- **Utilities**: Reusable helpers for common operations

### Architecture

```
src/
├── api/              # API test clients
├── config/           # Configuration management
├── fixtures/         # Custom Playwright fixtures
├── modules/          # Business flow modules
├── pages/            # Page Object Models
├── testdata/         # Test data files (JSON)
├── tests/            # Test specifications
└── utils/            # Helper utilities (Logger, WaitHelper, TtsHelper, etc.)
```

### Architecture Layers

Request/implementation flow through the three main layers:

```
┌─────────────────────────────────────┐
│  LAYER 3: Tests (*.spec.ts)         │
│  • Test scenarios & assertions      │
│  • Uses Modules only                │
└─────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  LAYER 2: Modules (*Module.ts)      │
│  • Business logic & workflows       │
│  • Orchestrates Page actions        │
└─────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  LAYER 1: Pages (*Page.ts)          │
│  • Locators (arrow functions)       │
│  • Simple UI actions only           │
└─────────────────────────────────────┘
```

Path aliases used across layers:

```typescript
import { LoginPage } from '@pages/LoginPage';
import { LoginModule } from '@modules/LoginModule';
import { Logger } from '@utils/Logger';
import { config } from '@config/index';
import usersData from '@testdata/users.json';
```

## Test Coverage — Discovery & Foundation (F) Series

The end-to-end suite drives the ALL learning app from login through the Discovery
assessments into the Foundation (F) series, in a **single browser session with a
single login**: [`src/tests/discovery/discovery-e2e.spec.ts`](src/tests/discovery/discovery-e2e.spec.ts).

| TC | Module | Scenario |
|----|--------|----------|
| TC-001 | Discovery | Login + skip microphone test |
| TC-002 | Discovery | Choose help language → Confirm |
| TC-003 | Discovery | Choose learning language (English) → Confirm |
| TC-004 | Discovery | Start assessment → leave demo (sentence shown) |
| TC-005 | Discovery | Record the sentence |
| TC-006 | Discovery | Replay recorded audio |
| TC-007 | Discovery | Re-record via Retry |
| TC-008 | Discovery | Move to next sentence |
| TC-009 | Discovery | Complete Assessment 1 → Continue |
| TC-010 | Discovery | Complete Assessment 2 → Continue |
| TC-011 | Discovery | Skip the Letter Hunt demo |
| TC-012 | Discovery | Fail Letter Hunt (wrong letters) → reach placement/result screen |
| TC-013 | **F1** | Click "Let's Start" → redirect to the F1 module landing |
| TC-014 | **F1** | Complete L1 Letter Train → land on P1 (Letter Hunt practice) |
| TC-015 | **F1** | Pass P1 Letter Hunt (10 Q) → land on L2 |
| TC-016 | **F1** | Complete L2 Letter Train → P2 → land on L3 |
| TC-017 | **F1** | Complete L3 Letter Train + P3 Letter Hunt → navigate to A1 (Apply) |
| TC-018 | **F1** | Complete A1 (Apply challenge, 3 levels) → L4/P4 → L5/P5 → L6/P6 → A2 |
| TC-019 | **F1** | Complete A2 (Apply) → L7/P7 → L8/P8 → L9/P9 → complete A3 |
| TC-020 | **F2** | Login (F2 account) → English → Start F2 → complete F2 Learn/Practice → A1 |
| TC-021 | **F3** | Login (F3 account) → English → Start F3 → P1–P5 "Letter Launcher" + A1 Apply |
| TC-022 | **F3** | P6 → A3: Memory Challenge (letters+words), word Launcher, A2/A3 → F3 complete |
| TC-023 | **M4** | Login → English → Start Level 4 → complete P1–P4 Speed Practice → reach S1 |
| TC-024 | **M4** | S1 assessment (image-comprehension, ASR-gated speaking) — ⛔ **PAUSED / DEFERRED** (see below) |

### Current English status (last verified 2026-08-17, Build #10 · `7c441ed`)

| Scope | Status | Evidence |
|---|---|---|
| TC-001–019 (Discovery + F1) | ✅ **PASS** | single fresh user, one session |
| TC-020 (F2) | ✅ **PASS** | same user continues into F2 (`FULL_E2E=1`) |
| TC-021/022 (F3) | ✅ **PASS** | same user continues into F3 (`FULL_E2E=1`) |
| TC-023 (M4 P1–P4 → S1) | ✅ **PASS** | via the parked `m4auto` account |
| TC-024 (M4 S1) | ⛔ **PAUSED** | deferred by decision — see *Deferred work* |

Verified with: `FULL_E2E=1 ENV=uat node scripts/run-e2e.js --workers=1 src/tests/discovery/discovery-e2e.spec.ts src/tests/discovery/mastery-m4.spec.ts src/tests/discovery/mastery-m4-s1.spec.ts`
(headless, 64m 33s — 2 passed, 0 failed, 1 skipped). Full per-TC evidence:
[Regression Report History](docs/ARCHITECTURE_AND_TESTING.md#regression-report-history).

#### Deferred work — English TC-024 / M4 S1 (PAUSED)

**English TC-024 is paused by decision and is not being developed.** It is kept as
`test.fixme` (reported as *skipped*, never a false pass). Background: S1 is a
"look at the picture and speak the correct answer" assessment. The correct answer is already
solved deterministically (the app's own `GetContent/sentence` marks it with `isAns:true`), but
**the app exposes no working answer-submission path in an automated browser** — verified
exhaustively across builds #1, #4 and #6 (mic is a device-test only; option clicks, the nav
arrow, select+Enter and real `getUserMedia` audio all leave lives/questions unchanged).
Unblocking needs an app-side test hook — spec in the
[Outstanding Dev Request: M4 S1 Non-Audio Answer Hook](docs/BUILD_HISTORY.md#outstanding-dev-request-m4-s1-non-audio-answer-hook)
section of `docs/BUILD_HISTORY.md`. The supporting code
(`src/services/answerSource.ts`, `src/services/visionService.ts`, `src/utils/answerMatcher.ts`,
`src/pages/mastery/VqaSpeakingAssessment.ts`) is **retained but dormant**, and will flip live
without code changes once a build ships the hook.

#### Account model (important)

Guest accounts advance **forward-only** and cannot replay a completed level:

- **Fresh dynamic user** (`testuser_<timestamp>`, password = username) — the repeatable way to
  cover Discovery → F1 → F2 → F3. This is what `FULL_E2E=1` uses.
- **`m4auto`** — parked Mastery account used for TC-023. It is now parked *at S1*, so TC-023
  confirms arrival at S1 rather than re-driving P1–P4.
- **`Testf2auto` / `Testf3auto`** — the old parked Foundation accounts were **reset
  server-side** to fresh Discovery state, so the standalone `foundation-f2.spec.ts` /
  `foundation-f3.spec.ts` fail on login. F2/F3 coverage therefore runs through the
  single-user `FULL_E2E=1` path. (Parked accounts would be one-shot anyway — completing a
  level advances the account past it.)
- **Mastery is sequentially gated:** a single linear user lands at *Start Level 1*, so M4 is
  not reachable without M1–M3.

#### Known limitations

- **Mid-run redeploys.** The app ships very frequently (#1 → #4 → #6 → #7 → #10 within days).
  A deploy during a run drops the session and the app shows *"Couldn't connect right now"*.
  `FoundationPage.recoverIfDisconnected()` detects that screen and clicks **Try Again** at four
  stall points, so long journeys survive it.
- **No stable test hooks in the app.** No `data-testid`/aria; CSS hashes drift between builds,
  so drivers key on **text / role / alt / audio** signals instead.
- **Letter Hunt letters are baked into SVG/audio** — solved by hooking media `play()` to read
  the spoken letter, not by OCR.
- **TC-012 fails the Letter Hunt on purpose** (that is the designed route to the placement
  screen), so it taps one fixed bubble to force wrong answers.
- **Single-session E2E is not parallel-safe** — run the regression with `--workers=1`.
- **Lint/format are not runnable:** `.eslintrc.json`/`.prettierrc` exist but eslint & prettier
  are not installed as devDependencies.

#### Audio / speech handling (no real microphone needed)

- **Chromium flags** supply a fake device and auto-grant mic permission.
- **`src/utils/TtsHelper.ts`** synthesizes a WAV for a given word/sentence.
- **`FoundationPage.installMicInjection()`** patches `getUserMedia` so the app records our
  injected WAV — the app's backend ASR then grades the *actual* expected word.
- **`src/utils/speechHook.ts`** mocks the Web Speech `SpeechRecognition` API (used by the
  Mastery mic calibration); `window.__srForce` sets the transcript.

**23 are reliable, asserted tests** (TC-001–023); TC-024 (M4 S1) is pending a practical
non-audio workaround. The F1 *Letter Hunt practices* (TC-015/016)
are audio-gated — the target letter is only spoken (prompt at
`/audio/<lang>/letter/<LETTER>.wav`). Because that audio is cached (no network request
on replay), the solver reads the target by **hooking the media element's `play()`
in-page**: the app always calls `play()` on an element whose `src` is that URL, even
when cached, so the current letter is captured deterministically and the matching
option is tapped. See `FoundationPage.completeLetterHuntPractice`.

**Letter Trains vary in length.** Lessons are not all 16 steps (L1–L5 = `/16`, L6 = `/14`,
`/15` also seen in L7–L9), so train detection is length-independent: it matches an `N/M`
progress counter with **denominator ≥ 11** from page text (flicker-proof, and excludes the
Letter Hunt practice / Apply `/10`). See `FoundationPage.trainProgress`.

**F1 "say the word" recording (Letter Train word phase).** The word is shown as text
only (no audio prompt; the app hosts no word audio), the mic records via `getUserMedia`,
and the app does **not** gate on recognition (correct vs wrong audio look identical
on-screen). So to make **Metabase** store the correct word, the framework synthesizes
the displayed word locally ([`TtsHelper`](src/utils/TtsHelper.ts), Windows SAPI) and
**injects it into the microphone**: `getUserMedia` is overridden to return one
controllable Web-Audio stream and the word's audio is played into it during recording
(`FoundationPage.installMicInjection` / `completeLetterTrain`). This is scoped to the
F1 word phases — Discovery recordings (TC-005–010) are unaffected. Verified against
Metabase (there is no on-screen recognition result to assert on).

**F2 series (TC-020).** F2 is reached from F1's A3 via a **"Start F2"** entry. To avoid
replaying Discovery + all of F1 each run, F2 uses a **persistent test account**
(`Testf2auto`): after login it shows a Hindi UI + a help-language modal — the suite
confirms it and switches the app language to **English** (top-right switcher), which
resumes the account on its saved F2 journey (`FoundationPage.switchToEnglishForF2`). F2's
Learn nodes reuse the Letter Train mechanic (longer, `/18`); its **Practice is a "Letter
Recognition" game with WORD options** (e.g. `the`/`her`/`me`/`ear`) rather than single
letters — the prompt audio is still `/audio/<lang>/letter/<WORD>.wav`, so the same
play() hook reads the answer and the matching word is tapped
(`FoundationPage.completeWordRecognitionPractice`). F2 lives in its own single-session
suite: [`src/tests/discovery/foundation-f2.spec.ts`](src/tests/discovery/foundation-f2.spec.ts).

**F3 series (TC-021 / TC-022).** F3 is **not** the F1/F2 Letter Train + Hunt — it is a
chain of mini-games driven by `FoundationPage.completeF3()`, reached via a persistent F3
account (`Testf3auto`, login → English → "Start F3"):
- **"Letter Launcher"** (P1–P5 letters, P7–P10 words, A1 Apply): a letter/word is shown and
  one is spoken → press ✓ if they match, ✗ if not (fills rocket fuel under a timer). The
  spoken token plays via an opaque blob, recovered by mapping the preloaded
  `/audio/<lang>/letter/<X>.wav` to the played blob by `Blob.size`
  (`FoundationPage.installLetterLauncherHook`) → `completeLetterLauncher`.
- **"Memory Challenge"** (P6 letters; A2/A3 words): memorize a shown `X - Y - Z` sequence,
  then click the grid tokens in order and submit via "Check Sequence" →
  `completeMemoryChallenge`.
Completing F3 advances the app to the next-phase ("Words per minute") map. F3 lives in
[`src/tests/discovery/foundation-f3.spec.ts`](src/tests/discovery/foundation-f3.spec.ts).

**Mastery M4 series (TC-023).** M4 ("Sentence Reading") is a chain of **"Speed Practice"**
nodes (P1 P2 P3 P4 S1 …), driven by `MasteryPage.completeM4Practices()`, reached via the
Mastery map (`Testf3auto`, login → English → "Start Level 4"):
- **Read Aloud** (P1/P2/P4): a sentence is shown with a green mic → record → orange "next".
  The sentence's SAPI-TTS is injected into the recording via the **reused F-series mic hook**
  (no real audio device — so P1–P4 stay scalable for the full E2E).
- **Paced Read Aloud** (P3): a Slow/Medium/Fast selector + a 3-2-1 countdown / word ticker
  precedes the mic (the driver rides the countdown and picks Fast).
- **"Did you see the word?"** (P3): after a word ticker, a Yes/No recognition probe.
Each node ends with a summary ("Your overall reading speed") + a "Hurray!!! … Continue"
modal. Reaching the S1 "Ready for Challenge?" entry confirms P1–P4 are complete. M4 lives in
[`src/tests/discovery/mastery-m4.spec.ts`](src/tests/discovery/mastery-m4.spec.ts); all M4
code is additive (`MasteryPage` composes `FoundationPage`; F1–F3 and the Chromium config are
untouched). **S1** (image-comprehension, ASR-gated speaking) is a separate case (**TC-024**),
pending a practical non-audio workaround (dev test-hook / API / mock).

Run the full flow (headed):

```bash
# F1: Discovery + Foundation F1 (TC-001–019, fresh user)
npx playwright test src/tests/discovery/discovery-e2e.spec.ts --project=chromium --headed --workers=1

# F2: Foundation F2 (TC-020, persistent F2 account)
npx playwright test src/tests/discovery/foundation-f2.spec.ts --project=chromium --headed --workers=1

# F3: Foundation F3 (TC-021/TC-022, persistent F3 account)
npx playwright test src/tests/discovery/foundation-f3.spec.ts --project=chromium --headed --workers=1

# M4: Mastery M4 P1–P4 (TC-023, persistent M4 account)
npx playwright test src/tests/discovery/mastery-m4.spec.ts --project=chromium --headed --workers=1
```

### Locator strategy (important for this app)

The ALL app exposes **no `data-testid`/`aria` hooks**, bakes most button labels into
**SVGs** (no DOM text), and its emotion `css-*` class hashes **change on every deploy**.
The suite therefore prefers, in order: **visible text** (`getByText` / `getByRole`),
**`alt` text** (e.g. `img[alt="Play"]`), and — only for the genuinely text-less,
hash-volatile controls (record/stop toggle, "Let's Start") — **viewport-relative
coordinates** against the fixed `1280x720` viewport. Page objects:
[`AssessmentPage`](src/pages/discovery/AssessmentPage.ts) (Discovery) and
[`FoundationPage`](src/pages/foundation/FoundationPage.ts) (F-series).

## Discovery Suite Reference

This section documents the original Discovery-only test suite building blocks (page
objects, module, helper) that the end-to-end suite above is built on top of. Discovery
automates the student onboarding flow for the EkStep Practice Platform (ALL) — the
complete journey from login through assessment completion.

### Language options

Help/learning language selection supports: **English**, **Telugu**, **Hindi**.

### Test data

**Dynamic username generation** — each run creates a unique username:
- **Format**: `testuser_<timestamp>`
- **Password**: same as username
- **Example**: `testuser_1716998400000`

**Assessment configuration** — located in `src/testdata/discovery/discovery-data.json`:

```json
{
    "assessments": {
        "discovery1": {
            "sentenceCount": 5
        },
        "discovery2": {
            "sentenceCount": 5
        }
    }
}
```

### Page objects

| Page object | Location | Purpose | Key methods |
|---|---|---|---|
| Discovery Login Page | `src/pages/discovery/DiscoveryLoginPage.ts` | Handle login functionality | `login()`, `enterUsername()`, `enterPassword()` |
| Microphone Test Page | `src/pages/discovery/MicrophoneTestPage.ts` | Handle microphone test screen | `clickSkip()`, `expectWelcomeTextVisible()` |
| Help Language Page | `src/pages/discovery/HelpLanguagePage.ts` | Handle help language selection | `selectHelpLanguage()`, `clickConfirm()` |
| Learning Language Page | `src/pages/discovery/LearningLanguagePage.ts` | Handle learning language selection | `chooseLearningLanguage()`, `clickLanguageDropdown()` |
| Assessment Page | `src/pages/discovery/AssessmentPage.ts` | Handle assessment flow | `recordSentence()`, `clickNext()`, `completeAssessment()` |

### Discovery module

Location: `src/modules/discovery/DiscoveryModule.ts`

```typescript
// Complete login flow
await discoveryModule.doLogin(username, password);

// Handle microphone test
await discoveryModule.handleMicrophoneTest();

// Select languages
await discoveryModule.selectHelpLanguage('English');
await discoveryModule.selectLearningLanguage('English');

// Start assessment
await discoveryModule.startAssessment();

// Record sentence
await discoveryModule.recordSentence();

// Complete full assessment (5 sentences)
await discoveryModule.completeAssessment(5);

// Complete entire Discovery flow
await discoveryModule.completeDiscoveryFlow(
    username,
    password,
    'English', // help language
    'English'  // learning language
);
```

### DiscoveryHelper utility

Location: `src/utils/DiscoveryHelper.ts`

```typescript
// Generate unique username -> testuser_1716998400000
const username = DiscoveryHelper.generateUniqueUsername();

// Create test user -> { username: 'testuser_...', password: 'testuser_...', timestamp: ... }
const testUser = DiscoveryHelper.createTestUser();

// Simulate recording (3 seconds)
await DiscoveryHelper.simulateRecording(3000);
```

### Audio handling — legacy simulated approach (historical)

The original Discovery-only suite simulated audio recording with timeouts rather than
injecting real audio (superseded by the real WAV-injection approach described in
[Audio / speech handling](#audio--speech-handling-no-real-microphone-needed) above, which
is what the current end-to-end suite uses):

```typescript
// Start recording
await assessmentPage.clickMike();

// Simulate recording time
await page.waitForTimeout(2000);

// Stop recording
await assessmentPage.clickStop();
```

Known limitations of that simulated approach: no validation of actual audio content,
microphone permissions may require manual browser permission grant on first run, no
network-throttling simulation, and it was optimized for Chromium only.

### Discovery-specific troubleshooting

- **Test fails at login** — verify the URL is accessible (https://all-uat.theall.ai),
  check network connectivity, and ensure unique username generation is working.
- **Microphone test issues** — check if the welcome-text locator needs updating, verify
  the skip button is visible, increase the timeout if the page loads slowly.
- **Assessment recording fails** — verify the microphone button locator, check if the
  audio simulation timeout is sufficient, ensure the stop button appears after recording
  starts.
- **Language selection issues** — verify language options are available, check
  popup/modal locators, ensure the confirm button is clickable.

### Discovery CI/CD examples

```yaml
# GitHub Actions
- name: Run Discovery Tests
  run: npx playwright test src/tests/discovery
  env:
    BASE_URL: https://all-uat.theall.ai
```

```groovy
// Jenkins
stage('Discovery Tests') {
    steps {
        sh 'npx playwright test src/tests/discovery'
    }
}
```

### Roadmap notes (historical)

These notes are carried over from the original Discovery-only documentation. Foundation
F1–F3 and Mastery M4 (P1–P4 → S1) are now automated — see
[Test Coverage — Discovery & Foundation (F) Series](#test-coverage--discovery--foundation-f-series)
above for current status. Remaining/ongoing items:
- Foundation Level F0 (Auditory & Visual) automation
- Mastery Levels M1–M3, M5–M9 automation
- API-based state setup (to avoid replaying full journeys per run)
- Real audio validation (beyond ASR grading)
- Broader cross-browser testing (currently Chromium-focused)
- Performance metrics collection

## Test-Case CSV Exports

`docs/test-cases/excel-exports/` contains CSV exports of all test-case Excel files:

- **DiscoveryFull.csv** — Discovery flow test cases (TC-001 to TC-010)
- **ALL_v3-0_Flow_Discovery.csv** — Discovery flow details from ALL v3-0 Flow
- **ALL_v3-0_Flow_Foundation.csv** — Foundation levels (F0, F1, F2, F3)
- **ALL_v3-0_Flow_Mastery.csv** — Mastery levels (M1–M9)
- **TestPlan_Summary.csv** — Test plan overview

**How to use**: open any CSV file in Excel, save as `.xlsx` if needed, edit and update as
required.

**Update instructions**: when new Excel files are received, share them with the
automation team; CSV versions get created in that folder, and the
[Master Test Case List](docs/ARCHITECTURE_AND_TESTING.md#master-test-case-list)
section of `docs/ARCHITECTURE_AND_TESTING.md` should be updated accordingly.

> **Note**: these CSV files are treated as source data — do not edit
> `docs/test-cases/excel-exports/*.csv` directly; report findings/changes and let the
> owner apply them.

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install
```

## Environment Configuration

Create a `.env` file in the root directory:

```env
# Application
BASE_URL=https://all-uat.theall.ai
API_BASE_URL=https://all-uat.theall.ai/api

# Test Credentials (Discovery uses dynamic generation)
TEST_USERNAME=testuser@example.com
TEST_PASSWORD=SecurePass123

# Timeouts (in ms)
DEFAULT_TIMEOUT=30000
API_TIMEOUT=30000

# Environment
NODE_ENV=development
LOG_LEVEL=INFO
RETRY_COUNT=3
```

**Note**: Discovery tests generate unique usernames dynamically using the format `testuser_<timestamp>` with password same as username.

## Environment Execution Guide (UAT / LAB / LAB2)

The suite is **environment-independent** — no URL is hardcoded in any test. All instance URLs
live in one place, [`config/environments.ts`](config/environments.ts):

| Env key | Name | URL |
| ------- | ---- | --- |
| `uat`  | UAT  | https://all-uat.theall.ai/login |
| `lab`  | LAB  | https://lab.the-axl.ai/login |
| `lab2` | LAB2 | https://lab2.the-axl.ai/login |

**Add a new instance later** by adding one entry to `config/environments.ts` — no test changes.

### Selecting an environment

Pass `--env=<uat|lab|lab2>` to the runner (default is `uat`). The chosen environment is printed
at startup and shown in the report header/HTML. Selection precedence: `--env`/`ENV` →
`BASE_URL` → default `uat`. Environment selection **never changes test logic** — the same test
behaves identically across instances (given equivalent app functionality).

### Commands (via the environment-aware runner)

```bash
# Full regression (all real TCs) — default env (UAT), headless
npm run regression

# Full regression in HEADED mode
npm run regression:headed

# Full regression against a specific environment
npm run regression:uat
npm run regression:lab
npm run regression:lab2

# Full regression, specific environment, HEADED
npm run regression:uat:headed
npm run regression:lab:headed
npm run regression:lab2:headed

# Generic runner — mix env / headed / a specific spec or grep:
#   npm run e2e -- [--env=uat|lab|lab2] [--headed] [<spec path> | --grep "<pattern>"]

# A SINGLE test case (by spec file) against LAB2, headed:
npm run e2e -- --env=lab2 --headed src/tests/discovery/mastery-m4.spec.ts

# A specific test case against LAB (headless):
npm run e2e -- --env=lab src/tests/discovery/foundation-f2.spec.ts

# All tests against UAT, headed:
npm run e2e -- --env=uat --headed --regression
```

> **Regression set** = the real production specs (`discovery-e2e` TC-001–019, `foundation-f2`
> TC-020, `foundation-f3` TC-021/022, `mastery-m4` TC-023, `mastery-m4-s1` TC-024). The
> `--regression` flag runs them serially (`--workers=1`) since the single-session Discovery E2E
> is not parallel-safe. Debug/scratch specs are intentionally excluded.
>
> **Note on granularity:** Discovery TC-001–019 run as one continuous single-session E2E (by
> design), so they execute together, not as isolable per-TC runs. F2/F3/M4/S1 are separate
> specs and can be run individually by file path (as shown above).

## Execution Commands

### Basic Execution

```bash
# Run all tests
npm test

# Run tests in headed mode
npm run test:headed

# Run tests with UI mode
npm run test:ui

# Run tests in debug mode
npm run test:debug
```

### Browser-Specific Execution

```bash
# Run only on Chromium
npm run test:chromium

# Run only on Firefox
npm run test:firefox

# Run only on Safari/WebKit
npm run test:webkit

# Run on mobile viewport
npm run test:mobile
```

### Test Filtering by Tags

```bash
# Run only smoke tests
npm run test:smoke

# Run only regression tests
npm run test:regression

# Run only P0 (critical) tests
npm run test:p0
```

Tags used across specs:

| Tag | Usage |
|-----|-------|
| `@P0` | Critical priority |
| `@P1` | High priority |
| `@P2` | Medium priority |
| `@Smoke` | Smoke tests |
| `@Regression` | Full regression |
| `@Login` | Feature tag |

Run directly by tag with `--grep`:

```bash
npx playwright test --grep "@P0"
npx playwright test --grep "@Smoke"
npx playwright test --grep "@Login"
```

### Custom Test Execution

```bash
# Run tests matching a pattern
npx playwright test --grep "login"

# Run Discovery tests only
npx playwright test src/tests/discovery

# Run specific test file
npx playwright test src/tests/discovery/discovery.spec.ts

# Run with specific config
npx playwright test --config=playwright.config.ts

# Run single test by name
npx playwright test --grep "TC-001"

# Record a new test interactively
npx playwright codegen
```

### CI/CD Execution

```bash
# Run tests for CI (with JSON reporter)
npm run test:ci
```

## Quick Reference — Common Commands

A cheat-sheet of the most frequently used commands and conventions.

### Key commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests |
| `npm run test:headed` | Run with visible browser |
| `npm run test:ui` | Open Playwright UI mode |
| `npm run test:debug` | Debug with inspector |
| `npm run report` | Show HTML report |
| `npx playwright codegen` | Record new tests |
| `npx playwright show-trace` | View trace files |

### Best practices checklist

**Page class**
- [ ] Locators as arrow functions: `btn = () => this.page.locator('#btn')`
- [ ] No business logic or conditionals
- [ ] Private page in constructor
- [ ] Named exports only

**Module class**
- [ ] Uses Page class methods only
- [ ] No direct `page.locator()` calls
- [ ] Logger for step tracking
- [ ] Async/await throughout

**Test spec**
- [ ] Tags: `@P0`, `@Login`, etc.
- [ ] `test.step()` for reporting
- [ ] beforeEach/afterEach cleanup
- [ ] Uses fixtures

### Common mistakes

| ❌ Wrong | ✅ Correct |
|----------|-----------|
| `page.locator()` in Module | Use `this.loginPage.method()` |
| `if/else` in Page class | Keep logic in Module |
| Missing `test.step()` | Wrap actions in steps |
| `await page.waitForTimeout(5000)` | Use explicit waits |
| Duplicate page instances | Use fixtures |
| `console.log()` | Use Logger |

## Reporting

### Built-in Reporters

The framework includes multiple reporters:

1. **HTML Reporter** - Interactive HTML report
   ```bash
   npm run test:report
   ```

2. **JSON Reporter** - Machine-readable results
   - Output: `test-results/results.json`

3. **List Reporter** - Console output with details

4. **Custom TTA Reporter** - Framework-specific reporting

Alternate/raw report and trace commands:

```bash
# View HTML report directly
npx playwright show-report

# View a specific trace file
npx playwright show-trace test-results/trace.zip
```

Reports location:
- `playwright-report/` — HTML reports
- `test-results/` — JSON, screenshots, videos

### Trace & Screenshots

- **Screenshots**: Captured only on failure (`playwright-report/`)
- **Videos**: Retained on failure
- **Traces**: Retained on failure, view with:
  ```bash
  npx playwright show-trace <trace-file>
  ```

### Environment/instance report metadata

- Every run writes a timestamped HTML report to **`tta-report/report_<YYYYMMDD_HHMMSS>.html`**
  (plus the standard Playwright HTML report under `playwright-report/`).
- View it: open the `tta-report/*.html` file in a browser, or run `npm run test:report` for the
  Playwright report.
- **The report header and HTML meta bar show the Environment (UAT/LAB/LAB2) and Mode
  (headed/headless)** so results are always attributable to the instance they ran against.

## Environment Setup (Local / Staging / Production)

### Local Development

```bash
# Start local application (if applicable)
npm run dev

# Run tests against local
BASE_URL=http://localhost:3000 npm test
```

### Staging Environment

```bash
BASE_URL=https://staging.example.com npm test
```

### Production Environment

```bash
BASE_URL=https://app.example.com npm test
```

## CI/CD Execution

### GitHub Actions

The framework includes GitHub Actions workflows:

```yaml
# .github/workflows/playwright.yml
name: Playwright Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install
      - run: npm test
        env:
          CI: true
```

See [Discovery CI/CD examples](#discovery-ci-cd-examples) above for a Discovery-scoped
GitHub Actions step and Jenkins stage.

### Local CI Simulation

```bash
# Simulate CI environment
CI=true npm test
```

### Jenkins

```groovy
// Jenkinsfile
pipeline {
    agent any
    stages {
        stage('Test') {
            steps {
                script {
                    sh 'npm ci'
                    sh 'npx playwright install'
                    sh 'npm test'
                }
            }
        }
    }
}
```

## Best Practices

### Writing Tests

1. **Use Page Objects**: Always interact through page objects, not directly with locators
2. **Use Modules**: For complex flows, use modules that combine multiple page actions
3. **Use Fixtures**: Leverage fixtures for clean test setup
4. **Tag Tests**: Use tags for filtering (`@Smoke`, `@Regression`, `@P0`)
5. **Modular Steps**: Use `test.step()` for readable test steps

### Locator Best Practices

```typescript
// Good: Stable, semantic locators
usernameInput = () => this.page.locator('#username');
submitButton = () => this.page.locator('button[type="submit"]');

// Better: Test IDs for stability
submitButton = () => this.page.getByTestId('submit-btn');
```

### Test Data

```typescript
// Use typed test data
import usersData from '../testdata/users.json';
const validUser = (usersData as UsersData).validUsers[0];
```

See also the [Best practices checklist](#best-practices-checklist) and
[Common mistakes](#common-mistakes) table above under Quick Reference.

## Troubleshooting

### Common Issues

**Browser not installed**
```bash
npx playwright install
```

**Port already in use**
```bash
# Check running processes
netstat -ano | findstr :3000
```

**Tests timing out**
```bash
# Increase timeout
npx playwright test --timeout=120000
```

See also [Discovery-specific troubleshooting](#discovery-specific-troubleshooting) above
for login, microphone, recording, and language-selection issues.

### Getting Help

```bash
# Show all available Playwright options
npx playwright test --help
```

## License

ISC
