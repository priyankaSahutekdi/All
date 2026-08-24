// `expect` was imported and never used — removed so `npm run lint` can gate CI. No Mastery logic
// is touched; Mastery stays parked per the 2026-08-18 TC-022 scope decision.
import { Page } from '@playwright/test';
import { FoundationPage } from '../foundation/FoundationPage';
import { TtsHelper } from '../../utils/TtsHelper';
import { AnswerSource } from '../../services/answerSource';
import { VqaSpeakingAssessment, VqaAttempt } from './VqaSpeakingAssessment';
import { LETTER_CLASS } from '../../utils/Text';
import { ANY_LANGUAGE_LABEL_TOKEN } from '../../utils/languages';
import { MASTERY_TRANSITION_RE } from '../../utils/transitions';

/**
 * Mastery (M-series) page object. Starts with M4 — "Sentence Reading (Simple)".
 *
 * M4 is a chain of "Speed Practice" nodes shown as bottom nav pills (P1 P2 P3 P4 S1 …).
 * The scope here is P1 → S1. Mechanics observed in the app (build #612):
 *   - Read Aloud (Speed Practice): a sentence is shown with a green mic; tap it, read the
 *     sentence, stop, then an orange "next" arrow advances to the next sentence.
 *
 * The read-aloud recording reuses the F-series mic-injection primitive
 * (FoundationPage.installMicInjection → window.__playInjected) so the app records the
 * ACTUAL sentence (SAPI TTS) rather than Chromium's fake tone — no new infrastructure and
 * FoundationPage itself is not modified. All selectors are text/alt/coordinate-based to
 * stay resilient to the still-changing UI.
 */
export class MasteryPage {
    private readonly foundation: FoundationPage;

    constructor(private readonly page: Page) {
        this.foundation = new FoundationPage(page);
    }

    /** Install the shared getUserMedia + __playInjected hook (delegates to FoundationPage). */
    async installReadAloudInjection(): Promise<void> {
        await this.foundation.installMicInjection();
    }

    /** The Mastery map "Start Level N" entry (N defaults to 4). */
    startLevelButton(level = 4) {
        return this.page.getByText(new RegExp(`Start Level ${level}`, 'i')).first();
    }

    /** Enter a Mastery level from the map. */
    async startLevel(level = 4): Promise<void> {
        const btn = this.startLevelButton(level);
        await btn.click({ force: true });
        await this.page.waitForTimeout(5000);
        await this.foundation.dismissCoachmarks().catch(() => {});
        await this.page.waitForTimeout(1000);
    }

    /**
     * The active node (e.g. "P1", "S1"), or '' if none. Completed nodes get a green tick
     * and drop out of the bottom nav, so the FIRST remaining P#/S# pill in the page text
     * is the current node — a reliable, scroll-independent signal.
     */
    async currentNode(): Promise<string> {
        return await this.page.evaluate(() => {
            const m = document.body.innerText.replace(/\s+/g, ' ').match(/\b([PS]\d)\b/);
            return m ? m[1] : '';
        });
    }

    /** Click a <button> whose text matches `re` (scrolls it into view first). */
    private async clickButtonByText(re: RegExp): Promise<boolean> {
        const src = re.source; const flags = re.flags;
        const coords = await this.page.evaluate(({ s, f }) => {
            const rx = new RegExp(s, f);
            for (const b of Array.from(document.querySelectorAll('button'))) {
                if (!rx.test((b.innerText || '').trim())) continue;
                b.scrollIntoView({ block: 'center', inline: 'center' });
                const r = b.getBoundingClientRect();
                return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
            }
            return null;
        }, { s: src, f: flags });
        if (!coords) return false;
        await this.page.mouse.click(coords.x, coords.y);
        return true;
    }

    /** Click the orange "next" arrow if present (used to advance summary / result screens). */
    async clickNextArrow(): Promise<boolean> {
        return this.tapControl('next');
    }

    /** True when the current card is a "Did you see the word?" Yes/No recognition item. */
    async isDidYouSeeCard(): Promise<boolean> {
        return await this.page.evaluate(() => /Did you see/i.test(document.body.innerText));
    }

    /**
     * Answer a "Did you see the word? <word>" item. The word is a recognition probe; we
     * answer Yes when it appeared in the most recently shown sentence, else No (this node
     * is a Lesson Tracker — ungated — but answering by the last sentence keeps it honest).
     */
    async answerDidYouSee(lastSentence: string): Promise<string> {
        const word = await this.page.evaluate((cls) => {
            // NOTE: the "Did you see the word?" prompt itself is still an English literal —
            // its localized wording has to be read off the real Hindi build before it can be
            // keyed by language (BUILD_HISTORY.md (Refactoring Plan section) task 13). Only the captured word's
            // character class is script-agnostic here.
            const m = document.body.innerText.replace(/\s+/g, ' ')
                .match(new RegExp(`Did you see the word\\?\\s*([${cls}']+)`, 'iu'));
            return m ? m[1] : '';
        }, LETTER_CLASS);
        // `\b` is defined on ASCII \w, so it never fires beside a Devanagari code point and
        // `\bकिताब\b` would silently never match. Bound the word with letter/digit
        // lookarounds instead — equivalent to `\b` for Latin input.
        const bound = `[${LETTER_CLASS}\\p{N}]`;
        const yes = !!word && new RegExp(`(?<!${bound})${word}(?!${bound})`, 'iu').test(lastSentence);
        await this.clickButtonByText(yes ? /Yes/i : /No/i);
        await this.page.waitForTimeout(1400);
        // a feedback screen follows with a "Next" (redo + arrow) — advance past it
        for (let i = 0; i < 10; i++) {
            if (await this.tapControl('next')) break;
            await this.page.waitForTimeout(400);
        }
        await this.page.waitForTimeout(1400);
        return `${word}->${yes ? 'Yes' : 'No'}`;
    }

    /**
     * The sentence shown on the current read-aloud card. Parsed from the page text (a
     * capitalised run of words ending in sentence punctuation) rather than by position,
     * because the M4 card scrolls as the learner progresses — an absolute y-band is
     * unreliable, but the sentence is always present in the text.
     */
    async readSentence(): Promise<string> {
        return await this.page.evaluate(({ cls, langSrc }) => {
            const t = document.body.innerText.replace(/\s+/g, ' ').trim();
            // The reading sentence sits after the language label and before the speed
            // selector / nav pills / build stamp. Slice it out — robust to any punctuation
            // (curly apostrophes, single-letter leading words) that a strict regex trips on.
            //
            // The label is the app's own name for the current language, so match it from the
            // language registry rather than the literal "English" this used to hardcode: that
            // anchor exists only in an English UI, and in any other language the split would
            // no-op, leave the whole page text in `after`, and fail the length sanity check
            // below — a silent '' return, not an error.
            const after = t.split(new RegExp(langSrc, 'gu')).pop() || '';
            let s = after.split(/\s(?:Slow|Medium|Fast|Words per minute|Words Learnt|P\d|S\d|Build)\b/)[0].trim();
            s = s.replace(/^\d+\s*/, '').trim();               // drop a leading counter digit
            // sanity: letter-dominant, sane length. (Word spacing is NOT required — the
            // styled word spans are sometimes joined without whitespace in innerText.)
            if (s.length < 6 || s.length > 140) return '';
            const letters = (s.match(new RegExp(`[${cls}]`, 'gu')) || []).length;
            if (letters < s.length * 0.6) return '';
            return s;
        }, { cls: LETTER_CLASS, langSrc: ANY_LANGUAGE_LABEL_TOKEN.source });
    }

    /**
     * The read-aloud controls currently on screen, found by their alt tag (scroll-safe —
     * no absolute y-band). A read-aloud item cycles idle "speak" (green mic) → "pause"
     * (red stop, recording) → after stop a "redo" + "next" (orange arrow). Header/nav
     * icons are excluded by requiring the control to sit below the header.
     */
    private async readAloudControls(): Promise<{ x: number; y: number; alt: string }[]> {
        return await this.page.evaluate(() => {
            const wanted = new Set(['speak', 'pause', 'next']);
            const out: { x: number; y: number; alt: string }[] = [];
            for (const el of Array.from(document.querySelectorAll('img'))) {
                const alt = (el.getAttribute('alt') || '').toLowerCase();
                if (!wanted.has(alt)) continue;
                const r = el.getBoundingClientRect();
                const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
                if (cy < 90) continue;                      // exclude the top header row
                if (r.width < 20 || r.width > 100) continue;
                out.push({ x: Math.round(cx), y: Math.round(cy), alt });
            }
            return out;
        });
    }

    /** Find a read-aloud control by alt tag (e.g. 'speak', 'pause', 'next'). */
    private async findControl(alt: string): Promise<{ x: number; y: number; alt: string } | null> {
        const all = await this.readAloudControls();
        return all.find((c) => c.alt === alt) || null;
    }

    /**
     * Scroll the control with the given alt tag into view and click it (scroll-safe). The
     * M4 card can be scrolled, so we re-read the element's viewport coordinates AFTER
     * scrolling it to centre, then click there. Returns false if no such control exists.
     */
    private async tapControl(alt: string): Promise<boolean> {
        const coords = await this.page.evaluate((a) => {
            for (const el of Array.from(document.querySelectorAll('img'))) {
                if ((el.getAttribute('alt') || '').toLowerCase() !== a) continue;
                const pre = el.getBoundingClientRect();
                if (pre.y + pre.height / 2 < 90) continue;   // skip header icons
                el.scrollIntoView({ block: 'center', inline: 'center' });
                const r = el.getBoundingClientRect();
                return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
            }
            return null;
        }, alt);
        if (!coords) return false;
        await this.page.mouse.click(coords.x, coords.y);
        return true;
    }

    /** Play a sentence's TTS into the injected mic stream while recording. */
    private async playSentence(b64: string, ms: number): Promise<void> {
        if (!b64) return;
        await this.page.evaluate(async ({ b, n }) => {
            await (window as unknown as { __playInjected?: (x: string, m: number) => Promise<void> }).__playInjected?.(b, n);
        }, { b: b64, n: ms });
    }

    /**
     * Complete ONE read-aloud item: read the sentence, record it (inject TTS), stop, then
     * tap the orange "next" arrow. Returns the sentence read (or '' if the card wasn't a
     * read-aloud item).
     */
    /**
     * Wait for a read-aloud item to be ready: a mic ("speak") or recording ("pause")
     * control AND a non-empty sentence. Rides the 3-2-1 countdown that paced items
     * (with the Slow/Medium/Fast selector) show before the sentence appears. Returns the
     * ready controls + sentence, or null if none appeared within `ms` (node likely ended).
     */
    private async waitForReadAloudItem(ms = 8000): Promise<{ ctrls: { x: number; y: number; alt: string }[]; sentence: string } | null> {
        for (let i = 0; i < Math.ceil(ms / 400); i++) {
            const ctrls = await this.readAloudControls();
            const ready = ctrls.some((c) => c.alt === 'speak' || c.alt === 'pause');
            const sentence = await this.readSentence();
            if (ready && sentence) return { ctrls, sentence };
            await this.page.waitForTimeout(400);
        }
        return null;
    }

    async doReadAloudItem(): Promise<string> {
        const ready = await this.waitForReadAloudItem();
        if (!ready) return '';
        const has = (a: string) => ready.ctrls.some((c) => c.alt === a);
        const sentence = ready.sentence;
        const b64 = sentence ? TtsHelper.generateWavBase64(sentence) : '';

        if (has('speak')) {
            // idle: tap the green mic to start recording, then play the sentence in
            await this.tapControl('speak');
            await this.page.waitForTimeout(700);
            await this.playSentence(b64, 3200);
            await this.page.waitForTimeout(3300);
        } else if (has('pause')) {
            // already recording (auto-started / resumed): play the sentence in, then stop
            await this.playSentence(b64, 2600);
            await this.page.waitForTimeout(2700);
        } else {
            return '';   // not a read-aloud card
        }

        // stop recording if a "pause" (red stop) is showing
        if (await this.findControl('pause')) { await this.tapControl('pause'); await this.page.waitForTimeout(1500); }

        // advance via the orange "next" arrow (rendered next to a "redo" after stop)
        for (let i = 0; i < 12; i++) {
            if (await this.tapControl('next')) break;
            await this.page.waitForTimeout(400);
        }
        await this.page.waitForTimeout(1800);
        return sentence;
    }

    /** Whether the Slow/Medium/Fast paced-reading speed selector is on screen. */
    private async hasSpeedSelector(): Promise<boolean> {
        return await this.page.evaluate(() => /\bSlow\b/.test(document.body.innerText) && /\bFast\b/.test(document.body.innerText));
    }

    /** Select the "Fast" reading speed (shortens the word-ticker on paced items). */
    private async selectFastSpeed(): Promise<boolean> {
        const coords = await this.page.evaluate(() => {
            for (const el of Array.from(document.querySelectorAll('div, span'))) {
                if (((el as HTMLElement).innerText || '').trim() !== 'Fast') continue;
                const r = (el as HTMLElement).getBoundingClientRect();
                if (r.x < 880) continue;                    // the selector sits on the right
                if (r.width < 20 || r.width > 120) continue;
                el.scrollIntoView({ block: 'center' });
                const rr = (el as HTMLElement).getBoundingClientRect();
                return { x: Math.round(rr.x + rr.width / 2), y: Math.round(rr.y + rr.height / 2) };
            }
            return null;
        });
        if (!coords) return false;
        await this.page.mouse.click(coords.x, coords.y);
        return true;
    }

    // Transition / completion controls. The label may be a <button> OR a clickable <div>
    // (e.g. the "Hurray!!! … Continue" completion modal uses a div), so both are matched.
    // The word list itself lives in utils/transitions.ts, shared with FoundationPage's own
    // (differently-structured) advance-button matcher — see that file for why they aren't
    // fully merged.

    /** Locate a transition/completion control (button or clickable div/span) → its centre. */
    private async transitionControl(): Promise<{ x: number; y: number } | null> {
        const src = MASTERY_TRANSITION_RE.source; const flags = MASTERY_TRANSITION_RE.flags;
        return await this.page.evaluate(({ s, f }) => {
            const rx = new RegExp(s, f);
            for (const el of Array.from(document.querySelectorAll('button, div, span'))) {
                const t = ((el as HTMLElement).innerText || '').trim();
                if (!rx.test(t)) continue;
                const r = (el as HTMLElement).getBoundingClientRect();
                if (r.width < 40 || r.width > 320 || r.height < 24 || r.height > 90) continue;   // a button-sized control
                if (getComputedStyle(el as Element).cursor !== 'pointer'
                    && (el as HTMLElement).tagName !== 'BUTTON') continue;
                (el as HTMLElement).scrollIntoView({ block: 'center' });
                const rr = (el as HTMLElement).getBoundingClientRect();
                return { x: Math.round(rr.x + rr.width / 2), y: Math.round(rr.y + rr.height / 2) };
            }
            return null;
        }, { s: src, f: flags });
    }

    /** Is a transition/completion control on screen? */
    private async intermissionButton(): Promise<boolean> {
        return (await this.transitionControl()) !== null;
    }

    /** The S1 assessment entry ("Ready for Challenge? Start Game"). */
    async isS1Entry(): Promise<boolean> {
        return await this.page.evaluate(() => /Ready for Challenge/i.test(document.body.innerText)
            && /Start Game/i.test(document.body.innerText));
    }

    /** True once the M4 P-practices (P1–P4) are complete: the S1 assessment is reached. */
    async isAtS1(): Promise<boolean> {
        return (await this.currentNode()) === 'S1' || (await this.isS1Entry());
    }

    /**
     * Poll for a recognizable M4 screen state and return it. States:
     *  's1'          — the S1 assessment node is now active (caller decides what to do)
     *  'didyousee'   — a "Did you see the word?" Yes/No item
     *  'readaloud'   — a read-aloud item (mic/recording present) with a sentence
     *  'next'        — a summary/result screen advanced by the orange "next" arrow
     *  'intermission'— a Continue/Let's-Go style transition button
     *  ''            — nothing recognized within `ms`
     */
    async detectState(ms = 26000, stopAtS1 = true): Promise<string> {
        let fastSelected = false;
        for (let i = 0; i < Math.ceil(ms / 350); i++) {
            // S1 is reached either as the active nav pill or via its "Ready for Challenge?"
            // entry screen (which is full-screen, so it shows no nav pill).
            if (stopAtS1 && ((await this.currentNode()) === 'S1' || (await this.isS1Entry()))) return 's1';
            if (await this.isDidYouSeeCard()) return 'didyousee';
            // A completion modal ("Hurray … Continue") can overlay the next node's card —
            // dismiss it before trying to interact with the read-aloud controls behind it.
            if (await this.intermissionButton()) return 'intermission';
            const ctrls = await this.readAloudControls();
            if (ctrls.some((c) => c.alt === 'speak' || c.alt === 'pause') && (await this.readSentence())) return 'readaloud';
            if (ctrls.some((c) => c.alt === 'next')) return 'next';
            // A paced item is mid-countdown / word-ticker (speed selector shown, nothing
            // actionable yet). Select "Fast" once to shorten it, then keep waiting — this
            // is a transient, not a stuck screen.
            if (!fastSelected && (await this.hasSpeedSelector())) { await this.selectFastSpeed(); fastSelected = true; }
            await this.page.waitForTimeout(350);
        }
        return '';
    }

    /** Click the first matching intermission/transition control (button or div). */
    private async clickIntermission(): Promise<boolean> {
        const c = await this.transitionControl();
        if (!c) return false;
        await this.page.mouse.click(c.x, c.y);
        return true;
    }

    /**
     * Drive M4 forward from the current node until the S1 assessment is reached (or
     * `maxSteps` is hit). Handles the P-node mechanics (read-aloud items, "Did you see"
     * recognition, per-node summary screens, intermissions). Returns a compact action log.
     * Stops AT S1 without attempting it when `stopAtS1` is true (the assessment is driven
     * separately once its mechanic is confirmed).
     */
    async driveToS1(maxSteps = 200, stopAtS1 = true): Promise<string[]> {
        const log: string[] = [];
        let lastSentence = '';
        let emptyStreak = 0;
        for (let step = 0; step < maxSteps; step++) {
            const state = await this.detectState(26000, stopAtS1);
            const node = await this.currentNode();
            if (state === 's1') { log.push(`${node}:S1-reached`); break; }
            if (state === 'didyousee') { emptyStreak = 0; log.push(`${node}:${await this.answerDidYouSee(lastSentence)}`); continue; }
            if (state === 'readaloud') {
                emptyStreak = 0;
                const s = await this.doReadAloudItem();
                if (s) lastSentence = s;
                log.push(`${node}:RA`);
                continue;
            }
            if (state === 'next') { emptyStreak = 0; await this.clickNextArrow(); await this.page.waitForTimeout(2000); log.push(`${node}:next`); continue; }
            if (state === 'intermission') { emptyStreak = 0; await this.clickIntermission(); await this.page.waitForTimeout(2500); log.push(`${node}:cont`); continue; }
            // Nothing recognized this pass — a long paced ticker can outlast one detect
            // window. Retry a couple of times before giving up.
            if (++emptyStreak < 3) { log.push(`${node}:wait`); continue; }
            log.push(`${node}:STUCK`);
            break;
        }
        return log;
    }

    /**
     * Complete the M4 practice nodes P1 → P4 (all "Speed Practice" variants: read-aloud,
     * paced word-ticker, and "Did you see the word?" recognition, with their per-node
     * summaries and completion modals) and stop at the S1 assessment entry. Returns the
     * action log. S1 itself is a separate, gated speaking assessment handled elsewhere.
     */
    async completeM4Practices(maxSteps = 200): Promise<string[]> {
        return this.driveToS1(maxSteps, true);
    }

    // ============================================
    // S1 — "Read the Image" speaking assessment (TC-024)
    // ============================================
    //
    // S1 captures the spoken answer via the Web Speech `SpeechRecognition` API and gates on
    // it; the app dictates the phrase to repeat via `speechSynthesis`. In automated Chromium
    // there is no real mic, so the shared `installSpeechRepeatHook(page)` (src/utils/
    // speechHook.ts) must be installed BEFORE navigation: it mocks SpeechRecognition to emit
    // the dictated phrase as the recognised transcript (listen-and-repeat) — no real audio,
    // backend ASR, or image comprehension needed. These helpers just drive the S1 UI.

    /** True once S1 is complete: the app has advanced past S1 to the next node/stage. */
    async isPastS1(): Promise<boolean> {
        return await this.page.evaluate(() => {
            const t = document.body.innerText;
            // Left the S1 assessment: the "speak the correct answer" prompt is gone AND
            // either a completion/next-stage marker shows or S1 is no longer the active pill.
            if (/speak the correct answer/i.test(t)) return false;
            if (/successfully completed|Hurray/i.test(t)) return true;
            const m = t.replace(/\s+/g, ' ').match(/\b([PS]\d)\b/);
            return !!m && m[1] !== 'S1';
        });
    }

    /** Click the tightest "Start Game ➜" control (S1 "Ready for Challenge?" entry). */
    async clickStartGame(): Promise<boolean> {
        const c = await this.page.evaluate(() => {
            let best: { x: number; y: number; a: number } | null = null;
            for (const el of Array.from(document.querySelectorAll('button, div, span'))) {
                const t = ((el as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim();
                if (!/^Start Game/i.test(t) || t.length > 20) continue;
                const r = (el as HTMLElement).getBoundingClientRect(); const a = r.width * r.height;
                if (!best || a < best.a) best = { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), a };
            }
            return best;
        });
        if (!c) return false;
        await this.page.mouse.click(c.x, c.y);
        return true;
    }

    /** Centre of a control matching `re` (button/div/span/img, tightest), or null. */
    private async controlCentre(re: RegExp): Promise<{ x: number; y: number } | null> {
        const src = re.source; const flags = re.flags;
        return await this.page.evaluate(({ s, f }) => {
            const rx = new RegExp(s, f);
            let best: { x: number; y: number; a: number } | null = null;
            for (const el of Array.from(document.querySelectorAll('button, div, span, img'))) {
                const t = ((el as HTMLElement).innerText || (el as HTMLElement).getAttribute('alt') || '').replace(/\s+/g, ' ').trim();
                if (!rx.test(t) || t.length > 20) continue;
                const r = (el as HTMLElement).getBoundingClientRect();
                if (r.width < 8 || r.height < 8) continue;
                const a = r.width * r.height;
                if (!best || a < best.a) best = { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), a };
            }
            return best ? { x: best.x, y: best.y } : null;
        }, { s: src, f: flags });
    }

    private async hasText(re: RegExp): Promise<boolean> {
        const src = re.source; const flags = re.flags;
        return await this.page.evaluate(({ s, f }) => new RegExp(s, f).test(document.body.innerText), { s: src, f: flags });
    }

    /**
     * Answer ONE S1 item via the listen-and-repeat mic flow: open the mic, "Click to listen"
     * (the app dictates the phrase — captured by the speech hook), "REPEAT NOW" (the mocked
     * SpeechRecognition emits that phrase), then advance on success. Requires
     * installSpeechRepeatHook(page) to have run before navigation. Returns 'ok' | 'retry' | ''.
     */
    async answerS1Item(): Promise<string> {
        // Open the mic if the calibration/record modal isn't already showing.
        if (!(await this.hasText(/repeat what you heard|Click to listen|REPEAT NOW/i))) {
            await this.page.mouse.click(1200, 33);   // top-right mic
            await this.page.waitForTimeout(1500);
        }
        const listen = await this.controlCentre(/Click to listen/i);
        if (listen) { await this.page.mouse.click(listen.x, listen.y); await this.page.waitForTimeout(2600); }
        const repeat = await this.controlCentre(/^REPEAT NOW$/i);
        if (repeat) { await this.page.mouse.click(repeat.x, repeat.y); }
        // Wait for the outcome (the mock emits the dictated phrase).
        for (let w = 0; w < 16; w++) {
            if (await this.hasText(/Awesome|Well done|listen to your voice|Great job|CONTINUE/i)) {
                // advance past the success / continue screen
                const cont = await this.controlCentre(/^CONTINUE$/i);
                if (cont) { await this.page.mouse.click(cont.x, cont.y); await this.page.waitForTimeout(1500); }
                return 'ok';
            }
            if (await this.hasText(/TRY AGAIN|can't hear/i)) {
                const ta = await this.controlCentre(/^TRY AGAIN$/i);
                if (ta) { await this.page.mouse.click(ta.x, ta.y); await this.page.waitForTimeout(700); }
                return 'retry';
            }
            await this.page.waitForTimeout(1000);
        }
        return '';
    }

    /**
     * Complete the S1 "look at the picture and speak the correct answer" assessment (TC-024).
     *
     * S1 is a visual-question-answering activity: each item shows an image, a question, and
     * spoken-answer options, and gates on CORRECTNESS. So the answer cannot be echoed — it is
     * determined by looking at the picture. This delegates to the reusable
     * VqaSpeakingAssessment (capture image → vision model → match option → inject transcript →
     * click mic → verify advance), keeping M-series VQA logic isolated and reusable for
     * later image-based nodes (M4–M9).
     *
     * A one-time listen-and-repeat calibration may appear first; it is handled by the
     * existing answerS1Item() before the VQA question loop. Requires installSpeechRepeatHook
     * before navigation and an AnswerSource (content-API by default, or vision).
     */
    async completeS1(source: AnswerSource, maxItems = 25): Promise<VqaAttempt[]> {
        if (await this.isS1Entry()) { await this.clickStartGame(); await this.page.waitForTimeout(4000); }
        // Pass a one-time listen-and-repeat calibration if the app shows one before questions.
        for (let i = 0; i < 3; i++) {
            const isQuestion = await this.hasText(/speak the correct answer/i);
            const isCalibration = await this.hasText(/repeat what you heard|Click to listen|REPEAT NOW/i);
            if (isQuestion || (await this.isPastS1())) break;
            if (!isCalibration) break;
            await this.page.evaluate(() => { (window as unknown as { __srForce?: string }).__srForce = ''; });
            await this.answerS1Item();
            await this.page.waitForTimeout(1200);
        }
        const vqa = new VqaSpeakingAssessment(this.page, source);
        return vqa.complete(() => this.isPastS1(), maxItems);
    }
}
