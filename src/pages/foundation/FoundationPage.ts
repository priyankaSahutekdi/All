import { expect, Page } from '@playwright/test';
import { AssessmentPage } from '../discovery';
import { TtsHelper } from '../../utils/TtsHelper';
import { currentAppFrame } from '../../utils/appFrame';
import {
    ONE_LETTER, ONE_WORD, SHORT_TOKEN, LETTER_CLASS, DIGIT_CLASS,
    LETTER_AUDIO_RE, LETTER_AUDIO_RE_SOURCE, decodeAudioToken,
} from '../../utils/Text';
import { AppLanguage, ANY_LANGUAGE_LABEL, labelRe, languageByCode } from '../../utils/languages';
import {
    TRANSITION_KEYS, foundationTransitionPriority, transitionAlt, transitionRe,
} from '../../utils/transitions';
import { copy, copyAlt, copyRe, copyWordsAlt, lazyProp, tryCopyRe } from '../../utils/UiCopy';
import { letsStartButtonClosure } from '../../utils/GeometryLocator';

const K = TRANSITION_KEYS;

/** The shape `foundationPatterns` resolves, one key per on-screen string this page matches. */
export interface FoundationCopy {
    resultMessage: RegExp;
    startF1: RegExp;
    startAnyFoundation: RegExp;
    /** `null` in a language whose F1-entry button has no text at all to observe (Hindi, confirmed H11: icon-only SVG). */
    letsStart: RegExp | null;
    helpLanguageModal: RegExp;
    confirmExact: RegExp;
    howToPlay: RegExp;
    practiceStart: RegExp;
    skipDemoExact: RegExp;
    nextOrContinueExact: RegExp;
    letterRecognition: RegExp;
    letterLauncher: RegExp;
    memoryChallenge: RegExp;
    readyForChallenge: RegExp;
    fuelCounter: RegExp;
    progressCounter: RegExp;
    checkSequence: RegExp;
    sequenceGridReady: RegExp;
    pastF3: RegExp;
    feedbackShort: RegExp;
    feedbackFull: RegExp;
    completion: RegExp;
    connectionLost: RegExp;
    tryAgainExact: RegExp;
    notAnAnswerOption: RegExp;
    launcherChrome: RegExp;
    pastApplyMarkers: RegExp;
    applyCompletedMarkers: RegExp;
    labels: {
        startGame: string;
        practiceStart: string[];
    };
}

/**
 * Every on-screen string this page object matches, resolved for one language.
 *
 * Each key is defined via `lazyProp` (`uiCopy.ts`) — resolved on first read, not eagerly here.
 * This used to build every pattern eagerly at construction, which meant a language with even one
 * missing translation threw at construction time, whether or not the current run ever needed
 * that key (confirmed live against Hindi — F1-only runs threw on F2/F3-only keys, and even
 * Discovery-only runs threw immediately on core keys). Resolving lazily means a missing
 * translation still throws — by design, per uiCopy.ts's DESIGN note, no English fallback — but
 * only when something actually reads that key, naming the gap at the point it matters instead of
 * gating construction on every key the class could ever need.
 *
 * Several of these are consumed inside `page.evaluate`, which cannot close over Node scope, so
 * they are passed through as `.source`/`.flags` and rebuilt in-page — the existing idiom in
 * `text.ts` and `MasteryPage.clickButtonByText`.
 *
 * Exported so the English-equivalence check can compare each pattern against the inline literal
 * it replaced, rather than the migration being taken on trust.
 */
export function foundationPatterns(lang: AppLanguage): FoundationCopy {
    /** The journey-map entry button for a Foundation level; `code` is an F# regex fragment. */
    const startFoundation = (code: string, space: 'exact' | 'flexible' = 'flexible'): string =>
        copyAlt('startFoundationLevel', lang, { slots: { level: code }, space });
    /** A "<label>: N/M" readout. The colon is a formatting convention, not translated copy.
     *  Digits use DIGIT_CLASS (script-agnostic), hence the 'u' flag. */
    const counter = (key: 'fuelLabel' | 'progressLabel'): RegExp =>
        new RegExp(`${copyAlt(key, lang)}:\\s*([${DIGIT_CLASS}]+)\\s*\\/\\s*([${DIGIT_CLASS}]+)`, 'iu');

    const p = {} as FoundationCopy;

    /** Discovery result / placement screen message. */
    lazyProp(p, 'resultMessage', () => copyRe(['learningJourney', 'languageSkills', 'hurray'], lang));
    /** The F1 landing entry button on the learning-journey map. */
    lazyProp(p, 'startF1', () => new RegExp(startFoundation('F1'), 'i'));
    /** Any "Start F#" journey-map entry (opens the next Foundation level). */
    lazyProp(p, 'startAnyFoundation', () => new RegExp(startFoundation('F\\d+'), 'i'));
    lazyProp(p, 'letsStart', () => tryCopyRe('letsStart', lang, { apostrophe: 'any', space: 'flexible' }));

    lazyProp(p, 'helpLanguageModal', () => copyRe('chooseHelpLanguage', lang));
    lazyProp(p, 'confirmExact', () => copyRe('confirm', lang, { exact: true }));

    lazyProp(p, 'howToPlay', () => copyRe('howToPlay', lang));
    /** The two ways into a practice from its demo screen. */
    lazyProp(p, 'practiceStart', () => transitionRe([K.startGame, K.skipDemo], lang));
    lazyProp(p, 'skipDemoExact', () => copyRe(K.skipDemo, lang, { apostrophe: 'optional', exact: true }));
    lazyProp(p, 'nextOrContinueExact', () => copyRe([K.next, K.continue], lang, { apostrophe: 'optional', exact: true }));

    lazyProp(p, 'letterRecognition', () => copyRe('letterRecognition', lang));
    lazyProp(p, 'letterLauncher', () => copyRe('letterLauncher', lang));
    lazyProp(p, 'memoryChallenge', () => copyRe('memoryChallenge', lang));
    lazyProp(p, 'readyForChallenge', () => copyRe('readyForChallenge', lang));

    lazyProp(p, 'fuelCounter', () => counter('fuelLabel'));
    lazyProp(p, 'progressCounter', () => counter('progressLabel'));
    lazyProp(p, 'checkSequence', () => copyRe('checkSequence', lang));
    /** The memorize window has ended and the answer grid is live. Digits use DIGIT_CLASS
     *  (script-agnostic), hence the 'u' flag. */
    lazyProp(p, 'sequenceGridReady', () => new RegExp(
        [copyAlt('timeUp', lang), copyAlt('lettersOfCount', lang, { slots: { n: `[${DIGIT_CLASS}]+` } })].join('|'),
        'iu',
    ));

    /** F3 is done — the app has moved to the next-phase journey map. */
    lazyProp(p, 'pastF3', () => copyRe(['wordsPerMinute', 'wordsLearnt', 'startLevel'], lang));

    /** Correct-answer feedback still on screen. Two subsets, as the two call sites had. */
    lazyProp(p, 'feedbackShort', () => copyRe(['correct', 'great'], lang));
    lazyProp(p, 'feedbackFull', () => copyRe(['correct', 'great', 'wellDone'], lang));
    lazyProp(p, 'completion', () => copyRe(['hurray', 'successfully', 'complete'], lang));

    lazyProp(p, 'connectionLost', () => copyRe(['couldntConnect', 'checkInternet'], lang, { apostrophe: 'optional' }));
    lazyProp(p, 'tryAgainExact', () => copyRe('tryAgain', lang, { exact: true }));

    /**
     * Button labels that are NOT an answer option — the transition controls plus Confirm.
     * "Next" is anchored (a bare "Next" button) while the rest are substrings, exactly as
     * the inline literal was.
     */
    lazyProp(p, 'notAnAnswerOption', () => new RegExp([
        transitionAlt([K.nextLevel], lang),
        transitionAlt([K.continue], lang),
        transitionAlt([K.startGame], lang),
        transitionAlt([K.skipDemo], lang),
        `^${transitionAlt([K.next], lang)}$`,
        copyAlt('confirm', lang),
        transitionAlt([K.claim, K.collect, K.finish, K.done, K.playAgain], lang),
    ].join('|'), 'i'));

    /**
     * UI chrome to exclude when scraping the Letter Launcher prompt heading. The individual
     * words are derived from the game titles rather than re-listed, so they cannot drift
     * away from them.
     */
    lazyProp(p, 'launcherChrome', () => new RegExp(
        `^(?:${ANY_LANGUAGE_LABEL.source}|`
        + `${copyWordsAlt(['letterLauncher', 'memoryChallenge', 'fuelLabel', 'progressLabel', 'loading'], lang)})$`,
        'iu',
    ));

    /**
     * Loose "we advanced past the Apply" markers. These are heuristics OR'd with the
     * definitive checks at their call sites, not assertions on their own.
     *
     * `F2` stays a literal: F# is a level CODE the app renders identically in every language
     * (`foundationLevel()` reads it out of `img[alt]`), not translated copy. The
     * "<word> <number>" ordering IS an assumption that may not hold in another language —
     * recorded as a known limitation rather than papered over, because both patterns are
     * backed by a definitive check at the call site.
     */
    lazyProp(p, 'pastApplyMarkers', () => new RegExp([
        copyAlt('complete', lang),
        copyAlt('congratulations', lang),
        copyAlt('wellDone', lang),
        'F2',
        `${copyAlt('levelWord', lang)} 2`,
        `${copyAlt('foundationWord', lang)} 2`,
        copyAlt('hurray', lang),
    ].join('|'), 'i'));
    /** Digits in the `levelWord` fragment use DIGIT_CLASS (script-agnostic), hence 'u'.
     *  `startFoundation('F\\d', ...)`'s F# stays ASCII — it's a level CODE, not translated
     *  copy, rendered identically in every language (see the class-level note above). */
    lazyProp(p, 'applyCompletedMarkers', () => new RegExp([
        copyAlt('complete', lang),
        copyAlt('congratulations', lang),
        copyAlt('wellDone', lang),
        copyAlt('foundationWord', lang),
        `${copyAlt('levelWord', lang)} [${DIGIT_CLASS}]`,
        startFoundation('F\\d', 'exact'),
    ].join('|'), 'iu'));

    /** Plain (non-regex) labels, for the `getByText(exact)` call sites. */
    lazyProp(p, 'labels', () => ({
        startGame: copy(K.startGame, lang)[0],
        practiceStart: copy([K.startGame, K.skipDemo], lang),
    }));

    return p;
}

/**
 * Why a node solver stopped.
 *
 * The solvers used to return `void` and give up with a bare `return` when they ran out of
 * budget — indistinguishable, to the caller, from finishing the node. `completeF3` therefore
 * pushed 'LL'/'MC' into its completed-games log whether the game had been played or not, and
 * the F3 spec's assertion is on that log, so a game that did nothing at all still produced a
 * green test. Making the outcome part of the return type is what removes the possibility.
 */
export interface SolverResult {
    /**
     * True when the solver reached a real end state for the node — it finished the node, or
     * found the node already gone. False means it exhausted its budget while the node was
     * still active, i.e. it made no further progress and the node is NOT done.
     */
    completed: boolean;
    /** Short reason, for the node log when completed and for the error message when not. */
    reason: string;
}

const completed = (reason: string): SolverResult => ({ completed: true, reason });
const gaveUp = (reason: string): SolverResult => ({ completed: false, reason });

/**
 * Page Object for the Foundation (F) series entry.
 *
 * Flow handled here:
 *   /discover-end  (discovery result / placement screen, "Let's Start" button)
 *        │  clickLetsStart()
 *        ▼
 *   /discover-start  (F1 learning-journey map, "Start F1" entry button)
 *
 * Locator notes (this app bakes most button labels into SVGs and has no
 * data-testid/aria hooks, and its css-* hashes change per build):
 *  - The result screen's "Let's Start" label is an SVG (NOT in the DOM text), so it
 *    is clicked via the single centred clickable button on the result screen, with a
 *    fixed-coordinate fallback against the 1280x720 viewport.
 *  - The F1 map's "Start F1" label IS real DOM text, so it is matched by text.
 */
export class FoundationPage {
    private page: Page;
    private lang: AppLanguage;
    private assess: AssessmentPage;
    private lhNetLetter: string | null = null;   // target letter from the network (backup to the play() hook)
    /** Every screen string this page matches, resolved for the run's language. */
    private readonly copy: FoundationCopy;
    /**
     * The advance-button matchers, in priority order, for the run's language. Lazy (`lazyProp`,
     * `uiCopy.ts`): `foundationTransitionPriority` resolves 5 patterns immediately when called,
     * so this field is resolved as one unit on first read (by `clickChallengeAdvance`) rather
     * than at construction — same reasoning as `copy` above.
     */
    private readonly transitions!: RegExp[];

    /**
     * `lang` defaults to English so the parked Mastery specs (out of scope per the 2026-08-18
     * TC-022 decision) keep constructing this unchanged. In-scope specs pass the `lang` fixture,
     * which is what makes the LANG axis reach the page objects.
     */
    constructor(page: Page, lang: AppLanguage = languageByCode('english')) {
        this.page = page;
        this.lang = lang;
        this.copy = foundationPatterns(lang);
        lazyProp(this, 'transitions', () => foundationTransitionPriority(lang));
        // Reuse the Discovery assessment page's centred record/stop toggle for the
        // Letter Train "say the word" mic (same 70x70 centre control).
        this.assess = new AssessmentPage(page, lang);
    }

    /**
     * True when the app's visible text matches EVERY pattern.
     *
     * One place where a screen-detection pattern crosses into the page, so the `.source`/`.flags`
     * marshalling that `page.evaluate` requires is written once instead of in each of the dozen
     * detection helpers below. An OR is expressed as a single alternation pattern in
     * `foundationPatterns`, which is why only the AND form is needed here.
     */
    private async pageTextMatchesAll(...patterns: RegExp[]): Promise<boolean> {
        const specs = patterns.map((p) => ({ s: p.source, f: p.flags }));
        return await this.page.evaluate((list) => {
            const text = document.body.innerText;
            return list.every((o) => new RegExp(o.s, o.f).test(text));
        }, specs);
    }

    // ============================================
    // LOCATORS
    // ============================================

    // Discovery result/placement screen message (build-independent text).
    resultMessage = () => this.page.getByText(this.copy.resultMessage).first();

    // F1 landing entry button — real DOM text on the learning-journey map.
    startF1Button = () => this.page.getByText(this.copy.startF1).first();

    // ============================================
    // ACTIONS
    // ============================================

    /**
     * Click the result screen's "Let's Start" button. Its label is an SVG, so a text
     * locator cannot find it — click the single centred clickable button on the
     * result screen, falling back to fixed viewport-centre coordinates.
     *
     * `this.copy.letsStart` is `null` in a language with nothing to observe here (uiCopy.ts has
     * no Hindi value — confirmed live, H11, 2026-08-19: the button really is icon-only there, an
     * SVG `<path>` with no `<text>` element at all) rather than throwing, via `tryCopyRe`, so this
     * falls straight through to the geometry fallback instead of the fallback being unreachable.
     */
    async clickLetsStart(): Promise<void> {
        const pattern = this.copy.letsStart;
        const matched = pattern !== null
            && await this.page.getByText(pattern).first().click({ timeout: 4000 }).then(() => true).catch(() => false);
        if (matched) return;

        const c = await this.page.evaluate(letsStartButtonClosure());
        await this.page.mouse.click(c ? c.x : 640, c ? c.y : 472);
    }

    /** Click the "Start F1" entry button on the F1 learning-journey map. */
    async clickStartF1(): Promise<void> {
        await this.startF1Button().click({ timeout: 15000, force: true });
    }

    // Generic "Start F#" journey-map entry button (opens the next Foundation level, e.g. "Start F2").
    startFoundationButton = () => this.page.getByText(this.copy.startAnyFoundation).first();

    /**
     * Put the app into `lang` so a parked account resumes its saved journey.
     *
     * The persistent F2/F3/M test accounts log in showing a help-language modal, and some of
     * them in a non-English UI, which leaves them on the wrong screen entirely. Confirm that
     * modal, then switch the app language via the top-right header switcher.
     *
     * Every step is guarded, so this is safe to call when the app is already in `lang` (the
     * common case) — it returns early. `lang` may be a code ('english', 'hindi') or an
     * AppLanguage from the registry.
     *
     * THROWS if the app is not in `lang` when it finishes. The individual clicks stay tolerant
     * (the help modal genuinely may not be showing), but the *outcome* is verified, because a
     * silent failure here is the worst failure in the suite: the run continues in whatever
     * language the app happened to be in and reports green, having validated a language nobody
     * asked for. Verifying the end state rather than each click is also what makes the tolerant
     * clicks safe to keep.
     */
    async switchToLanguage(lang: string | AppLanguage = 'english'): Promise<void> {
        const target = typeof lang === 'string' ? languageByCode(lang) : lang;
        const targetRe = labelRe(target);

        // 1. Confirm the "Choose your help language" modal if it is showing.
        if (await this.page.getByText(this.copy.helpLanguageModal).isVisible({ timeout: 4000 }).catch(() => false)) {
            const helpConfirm = this.page.getByText(this.copy.confirmExact).first();
            if (await helpConfirm.isVisible({ timeout: 2000 }).catch(() => false)) {
                await helpConfirm.click({ force: true }).catch(() => {});
                await this.page.waitForTimeout(2500);
            }
        }
        // 2. If the header switcher already shows the target language, nothing more to do.
        if (await this.headerShowsLanguage(targetRe)) return;
        // 3. Open the top-right language switcher — a clickable header box showing whichever
        //    language is currently active, so it is matched against every known label.
        await this.page.evaluate((langSrc) => {
            const anyLabel = new RegExp(langSrc, 'u');
            for (const el of Array.from(document.querySelectorAll('div'))) {
                const r = el.getBoundingClientRect();
                if (r.y < 60 && r.x > 850 && r.width > 90 && r.width < 260
                    && getComputedStyle(el).cursor === 'pointer'
                    && anyLabel.test(el.textContent || '')) {
                    (el as HTMLElement).click();
                    return;
                }
            }
        }, ANY_LANGUAGE_LABEL.source);
        await this.page.waitForTimeout(1500);
        // 4. Pick the target language from the "Select Language" modal, then Confirm.
        await this.page.getByText(targetRe).first().click({ force: true }).catch(() => {});
        await this.page.waitForTimeout(1000);
        const langConfirm = this.page.getByText(this.copy.confirmExact).first();
        if (await langConfirm.isVisible({ timeout: 3000 }).catch(() => false)) {
            await langConfirm.click({ force: true }).catch(() => {});
            await this.page.waitForTimeout(4500);
        }
        // 5. Verify. Polled rather than checked once: step 4 already waited, but the header
        //    re-renders after the language change and a single instant read can race it.
        for (let i = 0; i < 10; i++) {
            if (await this.headerShowsLanguage(targetRe)) return;
            await this.page.waitForTimeout(600);
        }
        await this.captureState(`language-switch-failed-${target.code}`);
        const shown = await this.currentHeaderLanguage();
        throw new Error(
            `Failed to switch the app to '${target.code}' (${target.label}). ` +
            `The header language switcher ${shown ? `still shows '${shown}'` : 'could not be read'}. ` +
            `Continuing would run the whole spec in the wrong language and report it as a pass. ` +
            `Screen text: ${await this.pageTextHead()}`,
        );
    }

    /**
     * Assert the app is actually running in `lang`, by the same header-switcher read that
     * `switchToLanguage` verifies itself with.
     *
     * Public because a spec that drives the language-selection UI by hand needs to assert the
     * OUTCOME, not just that its clicks found something to click: "the language dropdown was
     * operated" and "the app is in the requested language" are different claims, and only the
     * second one is worth a test. Polled for the same reason step 5 of `switchToLanguage` is —
     * the header re-renders after a language change and a single read can race it.
     */
    async expectAppInLanguage(lang: string | AppLanguage = 'english'): Promise<void> {
        const target = typeof lang === 'string' ? languageByCode(lang) : lang;
        await expect.poll(async () => this.headerShowsLanguage(labelRe(target)), {
            timeout: 15000,
            message: `expected the app to be running in '${target.code}' (${target.label}); `
                + 'the header language switcher does not show it',
        }).toBe(true);
    }

    /** Does the top-right header switcher currently show a label matching `labelPattern`? */
    private async headerShowsLanguage(labelPattern: RegExp): Promise<boolean> {
        return this.page.evaluate(({ s, f }) => {
            const want = new RegExp(s, f);
            for (const el of Array.from(document.querySelectorAll('div'))) {
                const r = el.getBoundingClientRect();
                if (r.y < 60 && r.x > 850 && getComputedStyle(el).cursor === 'pointer' && want.test((el.textContent || '').trim())) return true;
            }
            return false;
        }, { s: labelPattern.source, f: labelPattern.flags });
    }

    /** The language label the header switcher is showing, if any — for error messages. */
    private async currentHeaderLanguage(): Promise<string> {
        return this.page.evaluate((langSrc) => {
            const anyLabel = new RegExp(langSrc, 'u');
            for (const el of Array.from(document.querySelectorAll('div'))) {
                const r = el.getBoundingClientRect();
                if (r.y < 60 && r.x > 850 && getComputedStyle(el).cursor === 'pointer') {
                    const m = (el.textContent || '').trim().match(anyLabel);
                    if (m) return m[0];
                }
            }
            return '';
        }, ANY_LANGUAGE_LABEL.source);
    }

    /**
     * @deprecated Use `switchToLanguage('english')`. Kept so the existing F2/F3/M specs are
     * untouched by this change — they are the green baseline, and churning five call sites in
     * the same commit that rewrites the implementation would make a regression harder to
     * attribute. Call sites move over with the LANG axis work (BUILD_HISTORY.md (Refactoring Plan section) R1/R3).
     */
    async switchToEnglishForF2(): Promise<void> {
        await this.switchToLanguage('english');
    }

    /** Click the "Start F#" entry (e.g. "Start F2") if the journey map is showing it. */
    async clickStartFoundationIfPresent(): Promise<boolean> {
        const btn = this.startFoundationButton();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await btn.click({ force: true }).catch(() => {});
            await this.page.waitForTimeout(2500);
            return true;
        }
        return false;
    }

    // ---- F1 lesson helpers ---------------------------------------------------

    /**
     * Current Letter Train progress as "N/M" (empty string when not on a train).
     * The denominator VARIES per lesson (L1–L5 = /16, L6 = /14, /15 also seen in L7–L9),
     * so detection must not hardcode a count. It reads an "N/M" counter from page text
     * (flicker-proof) accepting only a train-length denominator (>= 11), which excludes
     * the Letter Hunt practice / Apply "/10" and any small level counter (e.g. "1/3").
     */
    async trainProgress(): Promise<string> {
        return await this.page.evaluate((digitClass) => {
            const text = document.body.innerText;
            // Fast path: the classic 16-item counter (L1–L5). Text-only → flicker-proof,
            // and never matches the Letter Hunt practice / Apply, so their detection is
            // unchanged. The numerator uses DIGIT_CLASS (script-agnostic); the "16" stays an
            // ASCII literal — unverified whether a build with native digits would render its
            // denominators natively too, in which case this fast path would simply miss (falling
            // through to the general match below, which still requires ASCII `parseInt` on the
            // denominator — see DIGIT_CLASS's own note in text.ts on the numeric-parsing gap).
            const m16 = text.match(new RegExp(`([${digitClass}]+)\\s*\\/\\s*16`, 'u'));
            if (m16) return m16[0];
            // Other lesson lengths (e.g. L6 = /14). Match a counter whose denominator is
            // a train length (>= 11) — TEXT-only so it stays flicker-proof through item
            // transitions, and it excludes the practice/Apply "/10" and any small level
            // counter (e.g. "1/3"), so those are never mistaken for a Letter Train.
            const all = text.match(new RegExp(`([${digitClass}]+)\\s*\\/\\s*([${digitClass}]+)`, 'gu')) || [];
            for (const s of all) {
                if (parseInt(s.split('/')[1], 10) >= 11) return s.trim();
            }
            return '';
        }, DIGIT_CLASS);
    }

    /** True when a Letter Hunt "How to Play" practice/demo screen is showing. */
    async isOnPracticeDemo(): Promise<boolean> {
        return await this.pageTextMatchesAll(this.copy.howToPlay, this.copy.practiceStart);
    }

    /**
     * Dismiss any intro coach-mark tooltips (e.g. "Alphabet Chart") until the lesson
     * content is ready (train counter "X/16" or a "How to Play" practice screen).
     */
    async dismissCoachmarks(maxTries = 6): Promise<void> {
        const howToPlay = this.copy.howToPlay;
        for (let i = 0; i < maxTries; i++) {
            const ready = await this.page.evaluate(({ s, f }) =>
                !!document.querySelector('img[alt="train"]') || new RegExp(s, f).test(document.body.innerText),
            { s: howToPlay.source, f: howToPlay.flags });
            if (ready) return;
            await this.page.keyboard.press('Escape').catch(() => {});
            await this.page.waitForTimeout(400);
            // A coach-mark close (×) is a small mid-screen button (not header / bottom map nav).
            await this.page.evaluate(() => {
                for (const el of Array.from(document.querySelectorAll('button'))) {
                    const r = el.getBoundingClientRect();
                    const cx = r.x + r.width / 2;
                    if (r.width < 30 || r.width > 46 || r.y < 90 || r.y > 520 || cx > 900) continue;
                    (el as HTMLElement).click();
                    return;
                }
            });
            await this.page.waitForTimeout(1000);
        }
    }

    /** The rightmost arrow control in the learn-phase row (the orange "next" →). */
    private async rightmostArrow(): Promise<{ x: number; y: number } | null> {
        return await this.page.evaluate(() => {
            const seen = new Set<string>();
            const items: { x: number; y: number }[] = [];
            for (const el of Array.from(document.querySelectorAll('button, div, svg'))) {
                const r = (el as HTMLElement).getBoundingClientRect();
                const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
                if (cy < 400 || cy > 475 || cx < 520 || cx > 760) continue;
                if (r.width < 36 || r.width > 72) continue;
                if (getComputedStyle(el as Element).cursor !== 'pointer') continue;
                const k = `${Math.round(cx / 12)}`;
                if (seen.has(k)) continue; seen.add(k);
                items.push({ x: cx, y: cy });
            }
            items.sort((a, b) => a.x - b.x);
            return items.length ? items[items.length - 1] : null;
        });
    }

    /**
     * Install a scoped microphone-injection hook. Overrides getUserMedia so the app
     * always receives ONE persistent, controllable audio stream (a Web-Audio
     * MediaStreamDestination). We then play a word's TTS audio into that stream at
     * record time via __playInjected(), so the recording carries the correct word —
     * regardless of when the app called getUserMedia. Installed only for the F1 word
     * phases (Discovery ran earlier and is unaffected).
     */
    async installMicInjection(): Promise<void> {
        await this.page.evaluate(() => {
            const w = window as unknown as {
                __micInjectInstalled?: boolean;
                __playInjected?: (b64: string, ms: number) => Promise<void>;
            };
            if (w.__micInjectInstalled) return;
            w.__micInjectInstalled = true;

            const AudioCtx = (window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
                || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            let ctx: AudioContext | null = null;
            let dest: MediaStreamAudioDestinationNode | null = null;
            const ensure = () => { if (!ctx) { ctx = new AudioCtx(); dest = ctx.createMediaStreamDestination(); } };

            // Play the word's WAV into the shared destination for ~ms while recording.
            w.__playInjected = async (b64: string, ms: number) => {
                ensure();
                if (ctx!.state === 'suspended') { try { await ctx!.resume(); } catch { /* ignore */ } }
                const bin = atob(b64);
                const arr = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
                const buf = await ctx!.decodeAudioData(arr.buffer);
                const src = ctx!.createBufferSource();
                src.buffer = buf; src.loop = true; src.connect(dest!); src.start();
                setTimeout(() => { try { src.stop(); } catch { /* ignore */ } }, ms);
            };

            const md = navigator.mediaDevices as MediaDevices | undefined;
            if (md && md.getUserMedia) {
                const orig = md.getUserMedia.bind(md);
                md.getUserMedia = async (constraints: MediaStreamConstraints) => {
                    if (!constraints || !constraints.audio) return orig(constraints);
                    ensure();
                    return dest!.stream;    // app records our controllable stream
                };
            }
        });
    }

    /**
     * Read the prominent single word shown on a "say the word" screen (e.g. "Ice").
     * The word is rendered with a coloured first-letter span, so we match the whole
     * word (>= 2 letters) and take the TIGHTEST element that wraps exactly that word
     * (avoids the single-letter span and any larger container).
     */
    async readCurrentWord(): Promise<string> {
        return await this.page.evaluate(({ s, f }) => {
            const oneWord = new RegExp(s, f);
            let best = ''; let bestArea = Infinity;
            for (const el of Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,div,span,p'))) {
                const t = (el.textContent || '').trim();
                if (!oneWord.test(t)) continue;                         // exactly one word
                const r = (el as HTMLElement).getBoundingClientRect();
                if (r.y < 150 || r.y > 400 || r.width < 20) continue;   // upper-centre card
                const area = r.width * r.height;
                if (area < bestArea) { bestArea = area; best = t; }     // tightest wrapper
            }
            return best;
        }, { s: ONE_WORD.source, f: ONE_WORD.flags });
    }

    /**
     * Complete a Letter Train lesson (L1, L2, …). Two phases:
     *   - Learn phase → advance via the lower-centre "next" (→) arrow.
     *   - Word phase  → "say the word": read the displayed word, synthesize it (TTS)
     *     and inject it into the mic so the app records the ACTUAL word audio.
     * Loops until the "N/16" counter disappears (lesson complete → next node).
     */
    async completeLetterTrain(): Promise<SolverResult> {
        await this.dismissCoachmarks();
        await this.installMicInjection();
        let stuck = 0;
        for (let i = 0; i < 45; i++) {
            let p = await this.trainProgress();
            if (!p) {
                // Confirm the train is really gone (the counter/graphic can blink out for
                // a beat during an item transition) before treating the lesson as done.
                await this.page.waitForTimeout(700);
                p = await this.trainProgress();
                if (!p) {
                    return completed(`train finished after ${i} items`);
                }
            }
            console.log(`[Letter Train] ${p}`);
            const arrow = await this.rightmostArrow();
            if (arrow) {
                await this.page.mouse.click(arrow.x, arrow.y);
                await this.page.waitForTimeout(1500);
            } else {
                // Word phase ("say the word"): read the displayed word, synthesize it
                // (TTS), start recording, then play the word into the mic stream so the
                // app records the ACTUAL word audio (not Chromium's fake tone).
                const word = await this.readCurrentWord();
                const b64 = word ? TtsHelper.generateWavBase64(word, this.lang) : '';
                await this.assess.clickRecordToggle();   // start recording (records our stream)
                await this.page.waitForTimeout(300);
                if (b64) {
                    await this.page.evaluate(async ({ b, ms }) => {
                        await (window as unknown as { __playInjected?: (x: string, n: number) => Promise<void> }).__playInjected?.(b, ms);
                    }, { b: b64, ms: 3000 });
                }
                await this.page.waitForTimeout(2600);    // let the word play into the recording
                await this.assess.clickRecordToggle();   // stop → advances
                await this.page.waitForTimeout(1500);
            }
            const np = await this.trainProgress();
            stuck = np === p ? stuck + 1 : 0;
            // Not advancing can mean the app dropped its connection (redeploy) rather than
            // "lesson finished" — recover and keep driving instead of silently giving up.
            if (stuck >= 3 && await this.recoverIfDisconnected()) { stuck = 0; continue; }
            // Safety valve: the counter has not moved in 8 rounds. Historically this returned
            // as though the lesson were done ("likely transitioned"), which is a guess. If the
            // train really did transition the check at the top of the loop sees it gone and
            // returns `completed`; reaching here means the counter is STILL showing `p`, so the
            // honest answer is that the solver stopped making progress.
            if (stuck >= 8) {
                return gaveUp(`the train counter stayed at ${p} for 8 rounds`);
            }
        }
        return gaveUp(`reached the 45-item cap while the train counter was still showing`);
    }

    /** The URL of the app's content iframe (post-2026-08 deployment: the journey runs
     *  inside a same-origin iframe, so route/URL checks must read the frame, not the page). */
    private appUrl(): string {
        return currentAppFrame(this.page).url();
    }

    /** Fast, non-waiting check for the result screen (safe inside poll loops). */
    async isOnResultScreen(): Promise<boolean> {
        if (/discover-end/.test(this.appUrl())) return true;
        return await this.resultMessage().isVisible().catch(() => false);
    }

    // ============================================
    // ASSERTIONS
    // ============================================

    /** Expect to be on the discovery result/placement screen. */
    async expectOnResultScreen(): Promise<void> {
        await expect.poll(() => this.appUrl(), { timeout: 20000 }).toMatch(/discover-end/);
        await expect(this.resultMessage()).toBeVisible({ timeout: 10000 });
    }

    // ── Letter-Hunt answer atoms (shared by practices P# and the Apply challenge A#) ──
    // The target letter is spoken (prompt audio `/audio/<lang>/letter/<LETTER>.wav`).
    // Reading it from NETWORK requests is unreliable because the audio is cached (no
    // request on replay), so we primarily hook the media element's play() in-page — the
    // app always calls play() on an element whose src is that URL, even when cached —
    // and keep the network listener as a backup.

    /** Install the in-page play() hook + network listener that capture the spoken
     *  target letter. Returns a cleanup function (removes the network listener). */
    private async installLetterHook(): Promise<() => void> {
        // The audio-path pattern is passed in (not inlined) so it has a single home in text.ts
        // — it gates the whole answer chain and used to exist as four Latin-only copies.
        await this.page.evaluate((audioReSrc) => {
            const w = window as unknown as { __lhInstalled?: boolean; __lhLetter?: string | null };
            if (w.__lhInstalled) return;
            w.__lhInstalled = true;
            w.__lhLetter = null;
            const audioRe = new RegExp(audioReSrc, 'i');
            // Mirrors decodeAudioToken() in text.ts; inlined because an evaluate body is
            // serialized and cannot close over an imported function.
            const decode = (raw: string): string => {
                let s = raw || '';
                try { s = decodeURIComponent(s); } catch { /* keep the raw form */ }
                return s.normalize('NFC').toUpperCase();
            };
            const capture = (src: string | null | undefined) => {
                const m = (src || '').match(audioRe);
                if (m) w.__lhLetter = decode(m[1]);
            };
            const origPlay = HTMLMediaElement.prototype.play;
            HTMLMediaElement.prototype.play = function (this: HTMLMediaElement, ...args: unknown[]) {
                capture(this.currentSrc || this.src);
                return origPlay.apply(this, args as []);
            };
        }, LETTER_AUDIO_RE_SOURCE);
        this.lhNetLetter = null;
        const onReq = (r: { url: () => string }) => {
            const m = r.url().match(LETTER_AUDIO_RE);
            if (m) this.lhNetLetter = decodeAudioToken(m[1]);
        };
        this.page.on('request', onReq);
        return () => this.page.off('request', onReq);
    }

    /** Click the speaker (centre, above the options) and read the spoken target letter. */
    private async readSpokenLetter(): Promise<string | null> {
        await this.page.evaluate(() => { (window as unknown as { __lhLetter: string | null }).__lhLetter = null; });
        this.lhNetLetter = null;
        let letter: string | null = null;
        for (let tryPlay = 0; tryPlay < 3 && !letter; tryPlay++) {
            await this.page.mouse.click(640, 295);   // speaker
            for (let w = 0; w < 8 && !letter; w++) {
                await this.page.waitForTimeout(300);
                letter = (await this.page.evaluate(() => (window as unknown as { __lhLetter: string | null }).__lhLetter)) || this.lhNetLetter;
            }
        }
        return letter;
    }

    /** Tap the option for `letter`, then advance via the "→" continue button. */
    private async tapLetterAndAdvance(letter: string): Promise<void> {
        await this.page.getByRole('button', { name: letter, exact: true }).first()
            .click({ force: true }).catch(() => {});
        await this.page.waitForTimeout(900);         // "Correct!" feedback
        for (let adv = 0; adv < 5; adv++) {
            if (!await this.pageTextMatchesAll(this.copy.feedbackShort)) break;
            const nextHandle = await this.page.evaluateHandle(() => {
                let best: Element | null = null; let bestCy = -1;
                for (const el of Array.from(document.querySelectorAll('button, div, svg, img'))) {
                    const r = (el as HTMLElement).getBoundingClientRect();
                    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
                    if (cx < 560 || cx > 720 || cy < 455 || cy > 645) continue;   // "→" continue, below options
                    if (r.width < 28 || r.width > 90 || r.height < 28 || r.height > 90) continue;
                    if (getComputedStyle(el as Element).cursor !== 'pointer') continue;
                    if (cy > bestCy) { best = el; bestCy = cy; }                  // lowest = the → button
                }
                return best;
            });
            const nextEl = nextHandle.asElement();
            if (nextEl) await nextEl.click({ force: true }).catch(() => {});
            await nextHandle.dispose();
            await this.page.waitForTimeout(1100);
        }
    }

    /** True when letter answer-option buttons are on screen (a Letter-Hunt question). */
    private async hasLetterOptions(): Promise<boolean> {
        return await this.page.evaluate(({ s, f }) => {
            const oneLetter = new RegExp(s, f);
            return Array.from(document.querySelectorAll('button')).some((b) => {
                const r = b.getBoundingClientRect();
                return oneLetter.test((b.textContent || '').trim()) && r.width > 60 && r.y > 300 && r.y < 480;
            });
        }, { s: ONE_LETTER.source, f: ONE_LETTER.flags });
    }

    /**
     * Complete a Letter Hunt practice (P1, P2, …): enter via "Start Game" if a demo is
     * shown, then answer each of the ~10 questions (read the spoken letter → tap it →
     * advance) until the next lesson node (a Letter Train "N/16") appears.
     */
    async completeLetterHuntPractice(): Promise<SolverResult> {
        const cleanup = await this.installLetterHook();
        const startGame = this.page.getByText(this.copy.labels.startGame, { exact: true }).first();
        if (await startGame.isVisible({ timeout: 8000 }).catch(() => false)) {
            await startGame.click({ force: true });
            await this.page.waitForTimeout(2500);
        }
        try {
            let stuck = 0;
            for (let q = 0; q < 60; q++) {
                if ((await this.trainProgress()) !== '') {
                    return completed(`advanced to the next Letter Train after ${q} questions`);
                }
                if (await this.pageTextMatchesAll(this.copy.completion)) {
                    return completed(`reached a completion screen after ${q} questions`);
                }
                const letter = await this.readSpokenLetter();
                // No recoverable spoken letter means no answer can be given — the questions are
                // not being answered, so this is a give-up, not a completion.
                if (!letter) {
                    if (++stuck > 8) {
                        return gaveUp(`could not recover the spoken letter 9 times in a row (at question ${q + 1})`);
                    }
                    continue;
                }
                stuck = 0;
                await this.tapLetterAndAdvance(letter);
            }
            return gaveUp('reached the 60-question cap without leaving the practice');
        } finally {
            cleanup();
        }
    }

    // ── F2 "Letter Recognition" practice ─────────────────────────────────────────────
    // F2's Practice (P#) is a "Letter Recognition" game: the prompt audio plays a WORD
    // (served at the same `/audio/<lang>/letter/<WORD>.wav` path as F1, so the play()
    // hook reads it), and the 4 answer options are WORDS (e.g. "the", "her", "me", "ear")
    // rather than single letters. Only the option shape differs from F1's Letter Hunt, so
    // the audio hook is reused unchanged; the F1 atoms are left untouched.

    /** True when on F2's "Letter Recognition" practice (its demo or active question). */
    async isOnWordRecognition(): Promise<boolean> {
        return await this.pageTextMatchesAll(this.copy.letterRecognition);
    }

    /**
     * True when a WORD-option question is showing (F2 Apply): a 🔊 speaker plus >= 2
     * short-word answer buttons in the option area. Gated on the speaker so it never
     * matches transition screens (whose only buttons are "Next Level"/"Continue"/etc.).
     */
    private async hasWordQuestion(): Promise<boolean> {
        const notOption = this.copy.notAnAnswerOption;
        return await this.page.evaluate(({ s, f, bs, bf }) => {
            if (!/🔊/.test(document.body.innerText)) return false;
            const oneWord = new RegExp(s, f);
            const bad = new RegExp(bs, bf);
            let n = 0;
            for (const b of Array.from(document.querySelectorAll('button'))) {
                const t = (b.textContent || '').trim();
                const r = b.getBoundingClientRect();
                if (oneWord.test(t) && !bad.test(t) && r.width > 40 && r.y > 200 && r.y < 560) n++;
            }
            return n >= 2;
        }, { s: ONE_WORD.source, f: ONE_WORD.flags, bs: notOption.source, bf: notOption.flags });
    }

    /** Read the spoken prompt word by clicking the 🔊 speaker (audio /letter/<WORD>.wav). */
    private async readSpokenViaSpeaker(): Promise<string | null> {
        await this.page.evaluate(() => { (window as unknown as { __lhLetter: string | null }).__lhLetter = null; });
        this.lhNetLetter = null;
        let token: string | null = null;
        for (let tryPlay = 0; tryPlay < 3 && !token; tryPlay++) {
            const spk = this.page.getByText('🔊').first();
            if (await spk.isVisible({ timeout: 800 }).catch(() => false)) await spk.click({ force: true }).catch(() => {});
            else await this.page.mouse.click(640, 295);
            for (let w = 0; w < 8 && !token; w++) {
                await this.page.waitForTimeout(300);
                token = (await this.page.evaluate(() => (window as unknown as { __lhLetter: string | null }).__lhLetter)) || this.lhNetLetter;
            }
        }
        return token;
    }

    /** Tap the answer option whose text matches `token` (case-insensitive) and advance. */
    private async tapWordAndAdvance(token: string): Promise<void> {
        await this.page.evaluate((tok) => {
            const t = tok.trim().toUpperCase();
            for (const b of Array.from(document.querySelectorAll('button'))) {
                if ((b.textContent || '').trim().toUpperCase() === t) {
                    const r = b.getBoundingClientRect();
                    if (r.width > 0 && r.height > 0) { (b as HTMLElement).click(); return; }
                }
            }
        }, token);
        await this.page.waitForTimeout(1000);                    // "Correct!" feedback
        // Advance to the next question. F2 may auto-advance, or show a Next/Continue/→.
        for (let adv = 0; adv < 4; adv++) {
            const stillFeedback = await this.pageTextMatchesAll(this.copy.feedbackFull);
            if (!stillFeedback) break;
            const nxt = this.page.getByText(this.copy.nextOrContinueExact).first();
            if (await nxt.isVisible({ timeout: 700 }).catch(() => false)) {
                await nxt.click({ force: true }).catch(() => {});
                await this.page.waitForTimeout(900);
            } else {
                await this.clickChallengeAdvance();              // fall back to a centred "→"
                await this.page.waitForTimeout(900);
            }
        }
    }

    /**
     * Complete an F2 "Letter Recognition" practice (P#): enter via "Start Game" if the
     * demo is shown, then answer each of the ~10 questions (hear the word → tap the
     * matching word option → advance) until the next node (a Letter Train or Apply entry).
     */
    async completeWordRecognitionPractice(): Promise<SolverResult> {
        const cleanup = await this.installLetterHook();
        const startGame = this.page.getByText(this.copy.labels.startGame, { exact: true }).first();
        if (await startGame.isVisible({ timeout: 8000 }).catch(() => false)) {
            await startGame.click({ force: true });
            await this.page.waitForTimeout(2500);
        }
        try {
            let stuck = 0;
            for (let q = 0; q < 60; q++) {
                if ((await this.trainProgress()) !== '') {
                    return completed(`advanced to the next Letter Train after ${q} questions`);
                }
                if (await this.isOnApplyEntry()) {
                    return completed(`reached an Apply entry after ${q} questions`);
                }
                if (await this.pageTextMatchesAll(this.copy.completion)) {
                    return completed(`reached a completion screen after ${q} questions`);
                }
                const token = await this.readSpokenViaSpeaker();
                if (!token) {
                    if (++stuck > 8) {
                        return gaveUp(`could not recover the spoken word 9 times in a row (at question ${q + 1})`);
                    }
                    continue;
                }
                stuck = 0;
                await this.tapWordAndAdvance(token);
            }
            return gaveUp('reached the 60-question cap without leaving the practice');
        } finally {
            cleanup();
        }
    }

    // ── F3 "Letter Launcher" practice ────────────────────────────────────────────────
    // F3's Practice (P#) is a turn-based "Letter Launcher" game: a letter is displayed, a
    // prompt letter is spoken, and you press ✓ if they match / ✗ if not. The letter audio
    // is preloaded as `/audio/<lang>/letter/<X>.wav` then replayed via opaque blob URLs,
    // so the spoken letter is recovered by mapping each blob to its letter via Blob.size
    // (synchronous → no race). Each correct answer adds fuel; reaching the fuel target
    // (e.g. 50/50) completes the practice. Additive — does not touch the F1/F2 hooks.

    /** True when on F3's "Letter Launcher" practice (its demo or active game). */
    async isOnLetterLauncher(): Promise<boolean> {
        return await this.pageTextMatchesAll(this.copy.letterLauncher);
    }

    /** Install the Letter-Launcher spoken-letter recovery (fetch + createObjectURL + play
     *  hooks). Sets window.__spokenLetter to the currently-played letter. Idempotent.
     *  MUST be called BEFORE the F3 game preloads its letter audio (i.e. before clicking
     *  "Start F3"), otherwise the preload fetches are missed and recovery fails. */
    async installLetterLauncherHook(): Promise<void> {
        await this.page.evaluate((audioReSrc) => {
            const w = window as unknown as { __llInstalled?: boolean; __spokenLetter?: string | null; __spokenSeq?: string[] };
            if (w.__llInstalled) return;
            w.__llInstalled = true;
            w.__spokenLetter = null;
            w.__spokenSeq = [];   // ordered list of spoken letters (for the Memory Challenge sequence)
            const audioRe = new RegExp(audioReSrc, 'i');
            // Mirrors decodeAudioToken() in text.ts — see the note there; an evaluate body is
            // serialized so it cannot close over the imported helper.
            const decode = (raw: string): string => {
                let s = raw || '';
                try { s = decodeURIComponent(s); } catch { /* keep the raw form */ }
                return s.normalize('NFC').toUpperCase();
            };
            const lenToLetter: Record<number, string> = {};
            const blobToLetter = new Map<string, string>();
            const origFetch = window.fetch.bind(window);
            window.fetch = async (...args: unknown[]) => {
                const res = await origFetch(...(args as Parameters<typeof fetch>));
                try {
                    const a0 = args[0] as string | Request; const url = typeof a0 === 'string' ? a0 : a0.url;
                    const m = (url || '').match(audioRe);
                    if (m) res.clone().arrayBuffer().then((b) => { lenToLetter[b.byteLength] = decode(m[1]); }).catch(() => {});
                } catch { /* ignore */ }
                return res;
            };
            const origCreate = URL.createObjectURL.bind(URL);
            URL.createObjectURL = (obj: Blob | MediaSource) => {
                const u = origCreate(obj as Blob);
                try { if (obj instanceof Blob) { const L = lenToLetter[(obj as Blob).size]; if (L) blobToLetter.set(u, L); } } catch { /* ignore */ }
                return u;
            };
            const origPlay = HTMLMediaElement.prototype.play;
            HTMLMediaElement.prototype.play = function (this: HTMLMediaElement, ...args: unknown[]) {
                const src = this.currentSrc || this.src;
                const d = (src || '').match(audioRe);
                let letter: string | null = null;
                if (d) letter = decode(d[1]);
                else if (src && blobToLetter.has(src)) letter = blobToLetter.get(src)!;
                if (letter) { w.__spokenLetter = letter; (w.__spokenSeq as string[]).push(letter); }
                return origPlay.apply(this, args as []);
            };
        }, LETTER_AUDIO_RE_SOURCE);
    }

    /** Current Letter-Launcher state: displayed token (a single letter OR a whole word,
     *  e.g. "O" or "he"), recovered spoken token, and fuel. */
    private async launcherState(): Promise<{ on: boolean; shown: string; spoken: string | null; fx: number; fy: number }> {
        const { launcherChrome, fuelCounter, letterLauncher } = this.copy;
        return await this.page.evaluate(({ s, f, chromeSrc, chromeFlags, fuelSrc, onSrc }) => {
            const w = window as unknown as { __spokenLetter: string | null };
            const body = document.body.innerText;
            // The prompt is a heading holding a pure-letter token — a single letter (letter
            // rounds) or a word (word rounds). Exclude the UI headings; the language name is
            // one of them, and both it and the game-title words come from registries, so they
            // are excluded whatever language the app is in (they used to be inline literals).
            const shortToken = new RegExp(s, f);
            const chrome = new RegExp(chromeSrc, chromeFlags);
            const shown = Array.from(document.querySelectorAll('h1,h2,h3')).map((h) => (h.textContent || '').trim())
                .find((t) => shortToken.test(t) && !chrome.test(t)) || '';
            const fm = body.match(new RegExp(fuelSrc, 'i'));
            return { on: new RegExp(onSrc, 'i').test(body), shown, spoken: w.__spokenLetter, fx: fm ? +fm[1] : -1, fy: fm ? +fm[2] : -1 };
        }, {
            s: SHORT_TOKEN.source, f: SHORT_TOKEN.flags,
            chromeSrc: launcherChrome.source, chromeFlags: launcherChrome.flags,
            fuelSrc: fuelCounter.source, onSrc: letterLauncher.source,
        });
    }

    /** Click the mic/prompt button (small square control in the game area). */
    private async clickLauncherMic(): Promise<void> {
        await this.page.evaluate(() => {
            const cands = Array.from(document.querySelectorAll('button')).filter((b) => {
                const r = b.getBoundingClientRect();
                return r.width >= 30 && r.width <= 90 && r.height >= 30 && r.height <= 90 && r.y > 120 && r.x > 200;
            });
            cands.sort((a, b) => b.getBoundingClientRect().y - a.getBoundingClientRect().y);   // lowest = the replay/mic
            if (cands[0]) (cands[0] as HTMLElement).click();
        });
    }

    /** Press the ✓ (match, left) or ✗ (mismatch, right) choice button. */
    private async pressLauncherChoice(match: boolean): Promise<void> {
        await this.page.evaluate((yes) => {
            const choices = Array.from(document.querySelectorAll('button')).filter((b) => {
                const r = b.getBoundingClientRect();
                return r.width > 180 && r.width < 340 && r.height > 40 && r.height < 100;
            }).sort((a, b) => a.getBoundingClientRect().x - b.getBoundingClientRect().x);
            const t = yes ? choices[0] : choices[1];
            if (t) (t as HTMLElement).click();
        }, match);
    }

    /**
     * Complete an F3 "Letter Launcher" practice: enter via Start Game/Skip Demo if a demo
     * is shown, then per round — click the mic to play the prompt, recover the spoken
     * letter, compare to the displayed letter, and press ✓ (match) / ✗ (mismatch) — until
     * the fuel target is reached and the game advances to the next node.
     */
    async completeLetterLauncher(maxRounds = 80): Promise<SolverResult> {
        await this.installLetterLauncherHook();
        for (const label of this.copy.labels.practiceStart) {
            const b = this.page.getByText(label, { exact: true }).first();
            if (await b.isVisible({ timeout: 5000 }).catch(() => false)) { await b.click({ force: true }); await this.page.waitForTimeout(3000); break; }
        }
        await this.page.waitForTimeout(1500);   // let the preloaded letter audio resolve
        let miss = 0;
        for (let i = 0; i < maxRounds; i++) {
            const st = await this.launcherState();
            if (!st.on) {
                return completed(`no longer on the Letter Launcher (after ${i} rounds)`);
            }
            if (st.fx >= 0 && st.fy > 0 && st.fx >= st.fy) {
                return completed(`fuel target reached (${st.fx}/${st.fy}) after ${i} rounds`);
            }
            await this.page.evaluate(() => { (window as unknown as { __spokenLetter: string | null }).__spokenLetter = null; });
            await this.clickLauncherMic();
            let s = await this.launcherState();
            for (let w = 0; w < 16 && !(s.shown && s.spoken); w++) { await this.page.waitForTimeout(300); s = await this.launcherState(); }
            // ALWAYS press to advance the round: press ✓ when the recovered spoken letter
            // matches the displayed one, otherwise ✗. If the spoken letter couldn't be
            // recovered this round (e.g. the very first round, whose audio doesn't fire
            // until the round is advanced), default to ✗ — a wrong guess only forgoes fuel
            // (no penalty) and the NEXT round's audio then plays reliably. Never stall.
            const match = !!(s.shown && s.spoken && s.spoken.toUpperCase() === s.shown.toUpperCase());
            if (!s.spoken) {
                if (++miss > 25) {
                    await this.captureState('letter-launcher-stuck');
                    return gaveUp(`the spoken letter could not be recovered for 26 consecutive rounds `
                        + `(fuel ${st.fx}/${st.fy}) — the answers are guesses, so the game is not being played`);
                }
            } else {
                miss = 0;
            }
            await this.pressLauncherChoice(match);
            await this.page.waitForTimeout(1300);
        }
        return gaveUp(`reached the ${maxRounds}-round cap without filling the fuel target`);
    }

    // ── F3 "Memory Challenge" practice ───────────────────────────────────────────────
    // Each round speaks a short letter sequence ONCE (no replay); the target letters are
    // recovered from the audio hook (window.__spokenSeq, populated by
    // installLetterLauncherHook) and clicked from the grid in the spoken order. Requires
    // a CLEAN audio buffer at the first round — i.e. reach P6 without replaying other
    // letter audio first (a fresh P6 account resumes clean) — so each round's letters are
    // the next ones appended (tracked by a consumed index).

    /** True when on F3's "Memory Challenge" game. */
    async isOnMemoryChallenge(): Promise<boolean> {
        return await this.pageTextMatchesAll(this.copy.memoryChallenge);
    }

    /** Read the sequence displayed on-screen during the memorize window. Handles both a
     *  letter sequence ("E - O - T") and a WORD sequence ("the - he - or") — the tokens are
     *  whatever is separated by dashes. */
    private async displayedSequence(): Promise<string[]> {
        return await this.page.evaluate((cls) => {
            const m = document.body.innerText.match(new RegExp(`[${cls}]+(?:\\s*-\\s*[${cls}]+)+`, 'u'));
            return m ? m[0].split(/\s*-\s*/).map((s) => s.trim()).filter(Boolean) : [];
        }, LETTER_CLASS);
    }

    /**
     * Complete an F3 "Memory Challenge". Each round shows a short letter sequence as
     * on-screen TEXT ("X - Y - Z") for a ~3s memorize window (with a countdown), then hides
     * it ("Time Up!") and shows the answer grid. The solver reads that displayed sequence,
     * waits for the grid, clicks the letters in the shown order, and submits via the
     * "Check Sequence" button — repeated for the 5 rounds. The letters are presented
     * visually (no audio in this environment), so no audio hook is needed.
     */
    async completeMemoryChallenge(maxRounds = 8): Promise<SolverResult> {
        for (let round = 0; round < maxRounds; round++) {
            // Capture the displayed sequence FIRST (the memorize window can be as short as
            // ~1.6s for word rounds), before any other check, using a tight poll. A demo
            // "Start Game" may briefly block — click it once as a fallback.
            let seq: string[] = [];
            for (let w = 0; w < 60 && seq.length === 0; w++) {
                seq = await this.displayedSequence();
                if (seq.length) break;
                if (w === 2) { const sg = this.page.getByText(this.copy.labels.startGame, { exact: true }).first(); if (await sg.isVisible({ timeout: 150 }).catch(() => false)) { await sg.click({ force: true }); } }
                await this.page.waitForTimeout(80);
            }
            if (seq.length === 0) {
                if (!(await this.isOnMemoryChallenge())) {
                    return completed(`advanced past the Memory Challenge after ${round} rounds`);
                }
                const progress = this.copy.progressCounter.source;
                const full = await this.page.evaluate((src) => { const m = document.body.innerText.match(new RegExp(src, 'i')); return m ? (+m[1] >= +m[2] && +m[2] > 0) : false; }, progress);
                if (full) {
                    return completed(`all rounds done (progress counter full) after ${round} rounds`);
                }
                // Still on the Memory Challenge, progress not full, and no sequence appeared:
                // the solver has nothing to answer with. This used to return as though the node
                // were finished, which is what let completeF3 log 'MC' for a game it never played.
                await this.captureState('memory-challenge-no-sequence');
                return gaveUp(`no letter sequence appeared on round ${round + 1} while still on the `
                    + 'Memory Challenge with rounds outstanding');
            }
            // Wait for the memorize display to end and the answer grid to be active.
            for (let w = 0; w < 30; w++) { const ready = await this.pageTextMatchesAll(this.copy.sequenceGridReady); if (ready) break; await this.page.waitForTimeout(150); }
            await this.page.waitForTimeout(250);
            // Click the letters in the grid in the shown order.
            for (const L of seq) {
                await this.page.evaluate((letter) => {
                    const b = Array.from(document.querySelectorAll('button')).find((x) => (x.textContent || '').trim().toUpperCase() === letter);
                    if (b) (b as HTMLElement).click();
                }, L.toUpperCase());
                await this.page.waitForTimeout(300);
            }
            // Submit via "Check Sequence" — click the actual button element (scrollIntoView
            // + native click); a text-locator click did not reliably trigger the handler.
            await this.page.evaluate((src) => {
                const submit = new RegExp(src, 'i');
                const b = Array.from(document.querySelectorAll('button')).find((x) => submit.test(x.textContent || ''));
                if (b) { (b as HTMLElement).scrollIntoView({ block: 'center' }); (b as HTMLElement).click(); }
            }, this.copy.checkSequence.source);
            await this.page.waitForTimeout(2200);   // round registers + the next round's memorize begins
        }
        // Fell out of the round loop. If the game has ended anyway, that is a completion; if it
        // is still showing, the cap was hit with rounds outstanding.
        return await this.isOnMemoryChallenge()
            ? gaveUp(`reached the ${maxRounds}-round cap while still on the Memory Challenge`)
            : completed(`left the Memory Challenge after ${maxRounds} rounds`);
    }

    /** True when F3 has been completed — the app leaves F3 for the next-phase ("Words
     *  per minute" / "Start Level") journey map, so `foundationLevel` is no longer F3. */
    async isPastF3(): Promise<boolean> {
        return await this.pageTextMatchesAll(this.copy.pastF3);
    }

    /** Where a parked account has come to rest, relative to F3. */
    async f3Position(entryTimeoutMs = 20000): Promise<'past' | 'in-game' | 'at-entry' | 'unknown'> {
        // Ordered cheapest-first, and 'past' first because the next-phase map is a distinct
        // screen: a decayed account must be classified as decayed, not as an unknown screen.
        if (await this.isPastF3()) {
            return 'past';
        }
        if (await this.isOnLetterLauncher() || await this.isOnMemoryChallenge()) {
            return 'in-game';
        }
        // Last, and the only one that waits — the journey map may still be rendering.
        if (await this.startFoundationButton().isVisible({ timeout: entryTimeoutMs }).catch(() => false)) {
            return 'at-entry';
        }
        return 'unknown';
    }

    /**
     * Assert a parked account is somewhere the F3 drive can start from, and report WHERE.
     *
     * The F3 spec had no precondition at all (only the F2 spec did), so a resume that landed on
     * the wrong screen — a help-language modal that was not confirmed, a decayed account, a
     * changed post-login flow — surfaced much later as `completeF3` throwing "unrecognised
     * screen", which reads as a defect in the F3 driver. It is not; it is the account or the
     * resume, and the difference decides who has to do something about it. Returning the
     * position rather than just passing/failing lets the caller treat a forward-decayed account
     * as the account-state problem it is.
     */
    async expectPositionedForF3(entryTimeoutMs = 20000): Promise<'past' | 'in-game' | 'at-entry'> {
        const position = await this.f3Position(entryTimeoutMs);
        if (position === 'unknown') {
            await this.captureState('f3-precondition-unrecognised');
            throw new Error(
                'F3 precondition failed: after login and resume the account is not at an F3 entry '
                + '("Start F3"), not inside an F3 game (Letter Launcher / Memory Challenge), and '
                + 'not past F3. This is a RESUME or ACCOUNT-STATE failure, not a failure of the F3 '
                + `drive — completeF3 has not run. Screen text: "${await this.pageTextHead()}"`,
            );
        }
        return position;
    }

    /**
     * Drive the entire F3 level to completion. F3 is a chain of mini-games: "Letter
     * Launcher" (a shown letter OR word matched to a spoken one → ✓/✗) and "Memory
     * Challenge" (memorize a shown letter/word sequence → click it back → Check Sequence),
     * plus Apply challenges made of those games. This dispatches each node to its solver,
     * clicking through demos/celebrations/level entries, until F3 is complete (the app
     * advances to the next-phase map). Returns the ordered list of games completed.
     * The audio-recovery hook must be installed before F3's games preload (done here,
     * before "Start F3"). Throws (with a screenshot) if it can't recognise a screen.
     */
    /**
     * Record a finished F3 game in the node log, or fail loudly if its solver gave up.
     *
     * The node log is what `foundation-f3.spec.ts` asserts on, so appending to it is a claim
     * that the game was played. A solver that gave up has not earned that claim, and the run
     * must stop there rather than continue accumulating a log that will read as success.
     */
    private async recordF3Game(name: string, tag: string, done: string[], result: SolverResult): Promise<void> {
        if (!result.completed) {
            await this.captureState(`f3-${tag.toLowerCase()}-did-not-complete`);
            throw new Error(
                `completeF3: the ${name} did not complete — ${result.reason}. `
                + `Games finished so far: ${done.length ? done.join(' ') : '(none)'}. `
                + `Screen text: "${await this.pageTextHead()}"`,
            );
        }
        console.log(`[F3] ${name} complete — ${result.reason}`);
        done.push(tag);
    }

    async completeF3(maxNodes = 120): Promise<string[]> {
        await this.installLetterLauncherHook();          // before Start F3 → capture launcher audio
        const done: string[] = [];
        let stuck = 0, entered = false;
        for (let i = 0; i < maxNodes; i++) {
            if (entered && await this.isPastF3()) return done;          // F3 finished → next phase
            if (!entered && await this.clickStartFoundationIfPresent()) { entered = true; done.push('StartF3'); stuck = 0; continue; }
            // A game is recorded in `done` ONLY when its solver says it finished. This used to
            // push 'LL'/'MC' unconditionally, so a solver that gave up without playing the game
            // still contributed to the log the F3 spec asserts on — a game that did nothing
            // produced a green test. See SolverResult.
            if (await this.isOnLetterLauncher()) {
                await this.recordF3Game('Letter Launcher', 'LL', done, await this.completeLetterLauncher());
                stuck = 0; continue;
            }
            if (await this.isOnMemoryChallenge()) {
                await this.recordF3Game('Memory Challenge', 'MC', done, await this.completeMemoryChallenge());
                stuck = 0; continue;
            }
            // Demo / celebration / apply-entry transitions.
            if (await this.clickChallengeAdvance()) {
                // Fast-poll so the next game (esp. a Memory Challenge with a short memorize
                // window) is entered promptly rather than after a fixed wait.
                for (let k = 0; k < 18; k++) { if (await this.isOnLetterLauncher() || await this.isOnMemoryChallenge() || await this.isOnApplyEntry() || await this.isPastF3()) break; await this.page.waitForTimeout(150); }
                stuck = 0; continue;
            }
            // F3 launcher demo intro ("Captain Rahi! … our rocket needs fuel! — Skip Demo"),
            // shown when F3 is entered fresh (a resumed account skips straight to the game).
            // "Skip Demo" is not one of clickChallengeAdvance's matchers, so handle it here.
            const introSkip = this.page.getByText(this.copy.skipDemoExact).first();
            if (await introSkip.isVisible({ timeout: 500 }).catch(() => false)) {
                await introSkip.click({ force: true }).catch(() => {});
                for (let k = 0; k < 18; k++) { if (await this.isOnLetterLauncher() || await this.isOnMemoryChallenge() || await this.isOnApplyEntry() || await this.isPastF3()) break; await this.page.waitForTimeout(150); }
                stuck = 0; continue;
            }
            if (entered && await this.isPastF3()) return done;
            stuck++;
            if (stuck >= 4 && await this.recoverIfDisconnected()) { stuck = 0; continue; }
            if (stuck > 12) { await this.captureState('f3-unrecognised'); throw new Error(`completeF3: unrecognised screen after ${done.length} games (${done.join(' ')}). Page text: "${await this.pageTextHead()}"`); }
            await this.page.waitForTimeout(1000);
        }
        return done;
    }

    /**
     * Complete one Learn→Practice pair: a Letter Train (L#) followed by a Letter Hunt
     * (P#). Lands on the next lesson node (the next Letter Train, or an Apply entry
     * after every 3rd pair).
     */
    async completeLearnPracticePair(): Promise<{ train: SolverResult; practice: SolverResult }> {
        const train = await this.completeLetterTrain();          // L# Letter Train → P#
        const practice = await this.completeLetterHuntPractice();   // P# Letter Hunt → next node
        return { train, practice };
    }

    /**
     * Complete an Apply "Challenge" (A1, A2, A3): 3 levels, lives. Same Letter-Hunt
     * answering as the practices (read spoken letter → tap → advance), but with
     * level/continue screens ("Next Level" between the 3 levels, "Continue" at the end).
     * When no question is showing we click the transition button until the challenge
     * finishes and the next node (a Letter Train "N/16") appears.
     */
    async completeApplyChallenge(): Promise<SolverResult> {
        const cleanup = await this.installLetterHook();
        try {
            let stuck = 0;
            for (let i = 0; i < 120; i++) {
                if ((await this.trainProgress()) !== '') {
                    return completed(`reached the next Letter Train after ${i} iterations`);
                }
                if (await this.hasLetterOptions()) {               // F1 apply: single-letter options
                    const letter = await this.readSpokenLetter();
                    if (letter) { await this.tapLetterAndAdvance(letter); stuck = 0; continue; }
                } else if (await this.hasWordQuestion()) {          // F2 apply: word options + 🔊
                    const token = await this.readSpokenViaSpeaker();
                    if (token) { await this.tapWordAndAdvance(token); stuck = 0; continue; }
                }
                // No question → a "Ready for Challenge?" / "Next Level" / "Continue"
                // transition screen. Click the advance button to proceed. (The intro
                // "Alphabet Chart" coach-mark may briefly show; it clears on its own.)
                if (await this.clickChallengeAdvance()) { stuck = 0; await this.page.waitForTimeout(2500); continue; }
                stuck++;
                if (stuck >= 4 && await this.recoverIfDisconnected()) { stuck = 0; continue; }
                if (stuck > 12) {
                    return gaveUp(`no question and no advance control for 13 iterations (at iteration ${i + 1})`);
                }
                await this.page.waitForTimeout(1000);
            }
            return gaveUp('reached the 120-iteration cap without reaching the next Letter Train');
        } finally {
            cleanup();
        }
    }

    /** Current Foundation level shown on the journey-map footer ("F1"/"F2"/…; '' if none). */
    async foundationLevel(): Promise<string> {
        return await this.page.evaluate(() => {
            for (const img of Array.from(document.querySelectorAll('img[alt]'))) {
                const a = (img as HTMLImageElement).alt.trim();
                if (/^F\d+$/.test(a)) return a;
            }
            return '';
        });
    }

    /** Non-throwing check for an Apply "Ready for Challenge?" entry screen. */
    async isOnApplyEntry(): Promise<boolean> {
        return await this.pageTextMatchesAll(this.copy.readyForChallenge);
    }

    /** First ~200 chars of visible page text (single-line) — for diagnostics. */
    private async pageTextHead(): Promise<string> {
        return await this.page.evaluate(() =>
            document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 200));
    }

    /**
     * The app renders a full-screen "Couldn't connect right now / check your internet
     * connection" page with a **Try Again** button whenever it loses its backend connection —
     * most often because the server was REDEPLOYED mid-run (this app ships very frequently:
     * builds #1 → #4 → #6 → #7 within days). A 70-minute journey will otherwise stall there
     * forever and fail on an unrelated assertion.
     *
     * Detects that screen and clicks "Try Again" to resume. Returns true only if the screen
     * was actually present, so callers can treat it as "recovered, keep going" rather than
     * "no progress". Deliberately narrow: it keys on the connectivity copy, NOT on the
     * "Try Again" button alone (games have their own TRY AGAIN for wrong answers).
     */
    async recoverIfDisconnected(maxAttempts = 3): Promise<boolean> {
        // `this.copy.connectionLost` is a lazy getter that can itself throw (e.g. a
        // language with no translation for its keys yet) — deferring the access into the
        // `.then()` keeps that throw inside the promise chain the trailing `.catch()`
        // covers, instead of escaping synchronously before `pageTextMatchesAll` is even
        // called. This check must never throw: it is a safety net, not an assertion.
        const isDown = async (): Promise<boolean> => Promise.resolve()
            .then(() => this.pageTextMatchesAll(this.copy.connectionLost))
            .catch(() => false);

        if (!await isDown()) return false;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            console.log(`[Foundation] ⚠️  app disconnected (likely a redeploy) — Try Again ${attempt}/${maxAttempts}`);
            // Click the connectivity page's own "Try Again" control.
            const clicked = await this.page.evaluate(({ s, f }) => {
                const retry = new RegExp(s, f);
                for (const el of Array.from(document.querySelectorAll('button, div, span, a'))) {
                    const t = ((el as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim();
                    if (!retry.test(t)) continue;
                    const r = (el as HTMLElement).getBoundingClientRect();
                    if (r.width < 20 || r.height < 12) continue;
                    (el as HTMLElement).click();
                    return true;
                }
                return false;
            }, { s: this.copy.tryAgainExact.source, f: this.copy.tryAgainExact.flags }).catch(() => false);
            if (!clicked) await this.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
            await this.page.waitForTimeout(6000);
            if (!await isDown()) {
                console.log('[Foundation] ✅ reconnected');
                await this.dismissCoachmarks().catch(() => {});
                return true;
            }
        }
        await this.captureState('app-disconnected');
        throw new Error('App is showing "Couldn\'t connect right now" and did not recover after '
            + `${maxAttempts} Try Again attempts — the backend/deployment is unavailable.`);
    }

    /**
     * Generic Foundation-level driver. From the current screen it:
     *   - clicks a "Start F#" journey-map entry to open a new level (e.g. F1 → F2),
     *   - completes Learn (Letter Train) and Practice (Letter Hunt) nodes,
     *   - clicks through celebration / level-intro / between-level transitions,
     * until it has COMPLETED `targetApplies` Apply challenges (e.g. 2 → through A2),
     * then returns the ordered list of nodes done (e.g.
     * ["StartF", "L(16)", "P", …, "A1", …, "A2"]) for validation/logging.
     *
     * It reuses the existing node helpers, so it works for any level whose nodes use the
     * same Letter Train / Letter Hunt / Apply mechanics. If it can't recognise the
     * current screen (a level with different mechanics) or an Apply fails to complete, it
     * captures a screenshot + page text and throws, so the blocker is explicit rather
     * than a silent hang.
     */
    async completeFoundationThroughApply(targetApplies: number, startApplyNum = 1, maxNodes = 120): Promise<string[]> {
        const done: string[] = [];
        let applies = 0, stuck = 0, entered = false;
        for (let i = 0; i < maxNodes; i++) {
            if (!entered && await this.clickStartFoundationIfPresent()) {   // open the next level (Start F#)
                entered = true; done.push('StartF'); stuck = 0; continue;
            }
            if (await this.isOnApplyEntry()) {           // an Apply "Ready for Challenge?" entry
                const apply = await this.completeApplyChallenge();
                // Two independent signals, both kept: the solver's own outcome, and a re-read of
                // the screen. The screen check is the stronger of the two (it does not depend on
                // the solver being honest about itself), so it stays as the gate; the solver's
                // reason is folded into the message because it says WHY.
                if (await this.isOnApplyEntry()) {       // still on the entry → it never ran
                    await this.captureState('foundation-apply-did-not-complete');
                    throw new Error(`Apply challenge did not complete (still on 'Ready for Challenge') `
                        + `— ${apply.reason}. Page text: "${await this.pageTextHead()}"`);
                }
                applies++; done.push(`A${startApplyNum + applies - 1}`);
                console.log(`[Foundation] completed Apply A${startApplyNum + applies - 1}; nodes: ${done.join(' ')}`);
                if (applies >= targetApplies) return done;
                stuck = 0; continue;
            }
            const tp = await this.trainProgress();
            if (tp) {                                    // Learn node (Letter Train)
                const train = await this.completeLetterTrain();
                // A train that gave up is still on screen, so the loop would re-enter it and
                // append another L(n) each time — the node log would grow while nothing
                // progressed. Fail here instead of accumulating a log that reads like work.
                if (!train.completed) {
                    await this.captureState('letter-train-did-not-complete');
                    throw new Error(`Letter Train did not complete after ${done.length} nodes `
                        + `— ${train.reason} (level=${await this.foundationLevel()}). `
                        + `Page text: "${await this.pageTextHead()}"`);
                }
                done.push(`L(${tp.split('/')[1]})`);
                stuck = 0; continue;
            }
            const onWordRec = await this.isOnWordRecognition();    // F2 "Letter Recognition"
            if (onWordRec || await this.isOnPracticeDemo() || await this.hasLetterOptions()) {   // Practice node
                const practice = onWordRec
                    ? await this.completeWordRecognitionPractice()   // F2 word options
                    : await this.completeLetterHuntPractice();       // F1 letter options
                // Confirm the practice actually advanced (to a train / Apply entry / any
                // non-practice screen). If it's still a practice, it didn't complete
                // (e.g. a level whose answer/advance mechanic differs) — capture and fail
                // fast instead of looping the whole test budget.
                const advanced = (await this.trainProgress()) !== ''
                    || await this.isOnApplyEntry()
                    || !(await this.isOnWordRecognition() || await this.hasLetterOptions() || await this.isOnPracticeDemo());
                if (!advanced) {
                    await this.captureState('practice-did-not-advance');
                    throw new Error(`Practice did not advance after ${done.length} nodes `
                        + `— ${practice.reason} (level=${await this.foundationLevel()}). `
                        + `Page text: "${await this.pageTextHead()}"`);
                }
                done.push('P');
                stuck = 0; continue;
            }
            if (await this.clickChallengeAdvance()) {    // celebration / level-intro transition
                stuck = 0; await this.page.waitForTimeout(2000); continue;
            }
            stuck++;
            if (stuck >= 4 && await this.recoverIfDisconnected()) { stuck = 0; continue; }
            if (stuck > 10) {
                await this.captureState('foundation-opening-unrecognised');
                throw new Error(`completeFoundationThroughApply: screen not recognised after ${done.length} nodes `
                    + `(level=${await this.foundationLevel()}). Page text: "${await this.pageTextHead()}"`);
            }
            await this.page.waitForTimeout(1000);
        }
        throw new Error(`completeFoundationThroughApply: reached maxNodes with only ${applies}/${targetApplies} applies (${done.join(' ')})`);
    }

    /** Save a screenshot to test-results for post-mortem of an unrecognised screen. */
    private async captureState(tag: string): Promise<void> {
        await this.page.screenshot({ path: `test-results/${tag}.png`, fullPage: false }).catch(() => {});
        console.log(`[Foundation] captured state "${tag}" — text: ${await this.pageTextHead()}`);
    }

    /**
     * Click a transition button on an Apply screen. Matchers are substring (not
     * anchored) — the A1 entry button is "Start Game ➜", between-level screens use
     * "Next Level", and the final screen "Continue". Falls back to a centred clickable.
     */
    private async clickChallengeAdvance(): Promise<boolean> {
        for (const re of this.transitions) {
            const btn = this.page.getByText(re).first();
            if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
                await btn.click({ force: true }).catch(() => {});
                return true;
            }
        }
        // Fallback: a centred clickable button near the bottom of the card.
        const h = await this.page.evaluateHandle(() => {
            let best: Element | null = null; let bestCy = -1;
            for (const el of Array.from(document.querySelectorAll('button, div, svg, img'))) {
                const r = (el as HTMLElement).getBoundingClientRect();
                const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
                if (cx < 540 || cx > 740 || cy < 440 || cy > 660) continue;
                if (r.width < 28 || r.width > 100) continue;
                if (getComputedStyle(el as Element).cursor !== 'pointer') continue;
                if (cy > bestCy) { best = el; bestCy = cy; }
            }
            return best;
        });
        const el = h.asElement();
        if (el) { await el.click({ force: true }).catch(() => {}); await h.dispose(); return true; }
        await h.dispose();
        return false;
    }

    /** Expect a Letter Hunt practice screen ("How to Play" + Start Game/Skip Demo). */
    async expectOnPracticeDemo(): Promise<void> {
        await expect.poll(async () => this.isOnPracticeDemo(), {
            timeout: 20000,
            message: 'expected to land on a Letter Hunt practice ("How to Play") screen',
        }).toBe(true);
    }

    /**
     * Expect an Apply "Challenge" entry (A1/A2/A3). After the last practice before an
     * Apply node, the app shows a "Hurray!!! Ready for Challenge?" screen with a Start
     * Game button that begins the Apply Letter Hunt.
     */
    async expectOnApplyChallenge(): Promise<void> {
        await expect(this.page.getByText(this.copy.readyForChallenge).first())
            .toBeVisible({ timeout: 20000 });
    }

    /**
     * Expect to have advanced PAST an Apply challenge (used after the final F1 Apply,
     * A3): either onto the next lesson node (a Letter Train "N/16") or a
     * completion / next-level (F2) screen — and no longer on the "Ready for Challenge?"
     * entry.
     */
    async expectPastApplyChallenge(): Promise<void> {
        await expect.poll(async () => {
            if ((await this.trainProgress()) !== '') return true;          // on the next Letter Train
            return !(await this.pageTextMatchesAll(this.copy.readyForChallenge))
                && await this.pageTextMatchesAll(this.copy.pastApplyMarkers);
        }, { timeout: 25000, message: 'expected to have advanced past the A3 Apply challenge' }).toBe(true);
    }

    /** Expect a Letter Train lesson (the train graphic + "N/M" progress counter is visible). */
    async expectOnLetterTrain(): Promise<void> {
        await expect.poll(async () => (await this.trainProgress()) !== '', {
            timeout: 20000,
            message: 'expected to land on a Letter Train lesson (train graphic + N/M progress)',
        }).toBe(true);
    }

    /**
     * Expect to have completed a level's final Apply and advanced past it — i.e. NOT
     * still on a "Ready for Challenge?" entry, and on a next lesson (Letter Train), a
     * "Start F#" next-level entry, or a completion/level screen. Used after F2's A3.
     */
    async expectFoundationApplyCompleted(): Promise<void> {
        await expect.poll(async () => {
            if (await this.isOnApplyEntry()) return false;                 // still at an apply entry
            if ((await this.trainProgress()) !== '') return true;          // next Learn train
            if (await this.startFoundationButton().isVisible({ timeout: 500 }).catch(() => false)) return true; // "Start F#"
            return await this.pageTextMatchesAll(this.copy.applyCompletedMarkers);
        }, { timeout: 30000, message: 'expected to have completed the final Apply and advanced past it' }).toBe(true);
    }

    /** Expect the journey-map footer to show a given Foundation level (e.g. "F2"). */
    async expectOnFoundationLevel(label: string): Promise<void> {
        await expect.poll(async () => this.foundationLevel(), {
            timeout: 20000,
            message: `expected the journey map to show Foundation level ${label}`,
        }).toBe(label);
    }

    /** Expect the F1 module landing page (learning-journey map) to have loaded. */
    async expectF1Landing(): Promise<void> {
        // Left the result screen…
        await expect.poll(() => this.appUrl(), { timeout: 20000 }).not.toMatch(/discover-end/);
        // …and the F1 entry point ("Start F1") is shown on the journey map.
        await expect(this.startF1Button()).toBeVisible({ timeout: 20000 });
    }
}
