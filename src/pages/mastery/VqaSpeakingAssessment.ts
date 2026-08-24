import { Page } from '@playwright/test';
import { AnswerSource } from '../../services/answerSource';
import { matchOption } from '../../utils/answerMatcher';
import { ANY_LANGUAGE_LABEL } from '../../utils/languages';

/**
 * Reusable driver for "look at the picture and speak the correct answer" assessments
 * (Mastery S-nodes; first used by M4 S1 / TC-024, designed for reuse across M4–M9).
 *
 * Per question it: reads the question + answer options from the DOM (nothing hardcoded),
 * asks an AnswerSource which option is correct (the source may read the app's content API
 * or look at the captured image — this class doesn't care), matches that answer back to an
 * on-screen option, injects it as the spoken transcript (window.__srForce, consumed by the
 * SpeechRecognition mock in speechHook.ts), clicks the mic to submit, then verifies the app
 * accepted it and advanced.
 *
 * Depends on installSpeechRepeatHook(page) having run BEFORE navigation, and an AnswerSource.
 * UI reads are structural/text-based (no fixed coordinates for content), so it adapts to
 * different questions and to layout drift.
 */
export interface VqaItem {
    question: string;
    options: string[];
    imageSrc: string;
}
export interface VqaAttempt {
    item: VqaItem;
    sourceAnswer: string;
    chosen: string;
    score: number;
    /** How the answer was submitted: 'hook' = app test hook, 'ui' = UI (select+speak) fallback. */
    via: 'hook' | 'ui';
    outcome: 'advanced' | 'wrong' | 'nomatch' | 'timeout';
}

export class VqaSpeakingAssessment {
    constructor(private readonly page: Page, private readonly source: AnswerSource) {}

    /** True while a "speak the correct answer" picture question is on screen. */
    async isOnQuestion(): Promise<boolean> {
        return await this.page.evaluate(() => /speak the correct answer/i.test(document.body.innerText));
    }

    /** Number of remaining "lives" (the assessment fails at 0), or -1 if not shown. */
    async livesLeft(): Promise<number> {
        return await this.page.evaluate(() => {
            const m = document.body.innerText.match(/You have\s+(\d+)\s+lives/i);
            return m ? Number(m[1]) : -1;
        });
    }

    /**
     * Read the current question, its answer options, and the illustration image src from the
     * DOM. Uses "tightest text leaf" detection + geometry (options sit below the question,
     * above the footer, to the right of the radio/▶ icons) so it is not tied to specific
     * strings or a fixed number of options.
     */
    async readItem(): Promise<VqaItem> {
        return await this.page.evaluate((langSrc) => {
            // Chrome to ignore when scraping options. The language name is the app's own
            // label for the current language, so it comes from the language registry —
            // hardcoding "English" would leave the label in the option list in any other
            // language, where it could be picked as an answer.
            const NOISE = new RegExp(`^(?:${langSrc}|Guest|You have|Words|Build|S\\d|P\\d|Level|Logout|\\d+)$`, 'iu');
            const isVis = (el: Element) => {
                const r = el.getBoundingClientRect();
                const cs = getComputedStyle(el as HTMLElement);
                return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
            };
            const text = (el: Element) => ((el as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim();
            // "tightest" leaf: no child element carries the same trimmed text.
            const isLeaf = (el: Element) => {
                const t = text(el);
                if (!t) return false;
                for (const c of Array.from(el.children)) if (text(c) === t) return false;
                return true;
            };

            const leaves = Array.from(document.querySelectorAll('div, span, p, li'))
                .filter(isVis).filter(isLeaf)
                .map((el) => { const r = el.getBoundingClientRect(); return { t: text(el), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), a: r.width * r.height }; });

            // Question: shortest-area leaf that ends with '?' in the content band.
            const qCands = leaves.filter((l) => /\?\s*$/.test(l.t) && l.y > 200 && l.y < 420 && l.t.length <= 80)
                .sort((p, q) => p.a - q.a);
            const q = qCands[0];
            const question = q ? q.t : '';
            const qy = q ? q.y : 380;

            // Options: short text leaves below the question, above the footer, right of icons.
            const seen = new Map<string, { t: string; y: number; a: number }>();
            for (const l of leaves) {
                if (l.y <= qy + 4 || l.y > 640) continue;
                if (l.x < 440 || l.x > 900) continue;
                if (l.t.length < 2 || l.t.length > 40) continue;
                if (/\?\s*$/.test(l.t) || NOISE.test(l.t)) continue;
                const key = l.t.toLowerCase();
                const prev = seen.get(key);
                if (!prev || l.a < prev.a) seen.set(key, { t: l.t, y: l.y, a: l.a });
            }
            const options = Array.from(seen.values()).sort((p, q2) => p.y - q2.y).map((o) => o.t);

            // Illustration: prefer a content image (content-service / mechanics_images);
            // otherwise the largest non-icon image. `rank` boosts content images so a large
            // decorative image never outranks the real illustration.
            let img: { src: string; rank: number } | null = null;
            for (const el of Array.from(document.querySelectorAll('img'))) {
                if (!isVis(el)) continue;
                const src = el.getAttribute('src') || '';
                const r = el.getBoundingClientRect();
                const a = r.width * r.height;
                const isContent = /content|mechanics_images/i.test(src);
                const isIcon = /logout|scoreView|profile|backgroundAddOn|practice-bg/i.test(src) || a < 2500;
                if (isIcon && !isContent) continue;
                const rank = isContent ? a + 1e9 : a;
                if (!img || rank > img.rank) img = { src, rank };
            }
            return { question, options, imageSrc: img ? img.src : '' };
        }, ANY_LANGUAGE_LABEL.source);
    }

    /**
     * Capture the illustration as base64. Prefers fetching the raster source directly (full
     * resolution → best VQA accuracy); falls back to an element screenshot (works for SVG /
     * canvas / tainted images too, so this stays reusable for other activity types).
     */
    async captureImage(imageSrc: string): Promise<{ base64: string; mediaType: string }> {
        const ext = (imageSrc.split('?')[0].split('.').pop() || '').toLowerCase();
        const raster = ext === 'png' || ext === 'jpg' || ext === 'jpeg';
        if (raster && /^https?:/i.test(imageSrc)) {
            try {
                const resp = await this.page.request.get(imageSrc);
                if (resp.ok()) {
                    const buf = await resp.body();
                    return { base64: buf.toString('base64'), mediaType: ext === 'png' ? 'image/png' : 'image/jpeg' };
                }
            } catch { /* fall through to screenshot */ }
        }
        // Fallback: screenshot the element (always yields a PNG the model can read).
        const loc = this.page.locator(`img[src="${imageSrc.replace(/"/g, '\\"')}"]`).first();
        const buf = await loc.screenshot();
        return { base64: buf.toString('base64'), mediaType: 'image/png' };
    }

    /** Centre of the top-right mic control (used to submit the spoken answer). */
    private async micCentre(): Promise<{ x: number; y: number }> {
        const c = await this.page.evaluate(() => {
            let best: { x: number; y: number; d: number } | null = null;
            for (const el of Array.from(document.querySelectorAll('svg, button, [role="button"]'))) {
                const r = el.getBoundingClientRect();
                const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
                if (cy > 60 || cx < 1150 || cx > 1215) continue;      // header, just left of logout
                if (r.width < 12 || r.width > 60) continue;
                const d = Math.abs(cx - 1186) + Math.abs(cy - 33);
                if (!best || d < best.d) best = { x: Math.round(cx), y: Math.round(cy), d };
            }
            return best;
        });
        return c ? { x: c.x, y: c.y } : { x: 1186, y: 33 };
    }

    /** Inject `answer` as the spoken transcript and click the mic to submit it. */
    private async speak(answer: string): Promise<void> {
        await this.page.evaluate((a) => { (window as unknown as { __srForce?: string }).__srForce = a; }, answer);
        const mic = await this.micCentre();
        await this.page.mouse.click(mic.x, mic.y);
    }

    /**
     * Submit the chosen answer via an APP TEST HOOK if the build exposes one (bypasses the
     * real-microphone requirement — see docs/S1_DEV_HOOK_REQUEST.md for the contract).
     * Feature-detected: returns true only if a hook was actually invoked, so builds without
     * the hook are unaffected. Accepts several names so it works with whatever the app ships.
     */
    private async submitViaHook(optionText: string, optionIndex: number): Promise<boolean> {
        return await this.page.evaluate(async ({ t, i }) => {
            /* eslint-disable @typescript-eslint/no-explicit-any */
            const w = window as any;
            const api = w.__allTest || w.__ALL_TEST__ || w.__e2e || {};
            const fn = api.submitS1Answer || api.submitAnswer || w.__submitS1Answer || w.__e2eSubmitAnswer;
            if (typeof fn === 'function') { try { await fn.call(api, t, i); return true; } catch { return false; } }
            return false;
            /* eslint-enable @typescript-eslint/no-explicit-any */
        }, { t: optionText, i: optionIndex });
    }

    /** Best-effort UI selection of the option radio by index (used by the fallback path). */
    private async selectOptionRadio(index: number): Promise<void> {
        await this.page.evaluate((i) => {
            const btns = Array.from(document.querySelectorAll('.MuiButtonBase-root')).filter((el) => {
                const r = el.getBoundingClientRect();
                return r.x < 460 && r.y > 390 && r.y < 630 && !!el.querySelector('svg');
            }).sort((a, b) => a.getBoundingClientRect().y - b.getBoundingClientRect().y);
            (btns[i] as HTMLElement | undefined)?.click();
        }, index);
    }

    /**
     * Submit the answer: prefer the app test hook (deterministic, non-audio); if absent, fall
     * back to the UI (select the option radio + speak via the SR mock). Returns which path ran.
     */
    private async submit(optionText: string, optionIndex: number): Promise<'hook' | 'ui'> {
        if (await this.submitViaHook(optionText, optionIndex)) return 'hook';
        await this.selectOptionRadio(optionIndex).catch(() => {});
        await this.speak(optionText);
        return 'ui';
    }

    /** Dismiss a "correct!"/feedback transition if one appears between questions. */
    private async clickContinueIfAny(): Promise<boolean> {
        const c = await this.page.evaluate(() => {
            const rx = /^(CONTINUE|Continue|Next|Got it|Great|Awesome)$/;
            for (const el of Array.from(document.querySelectorAll('button, div, span'))) {
                const t = ((el as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim();
                if (!rx.test(t) || t.length > 16) continue;
                const r = (el as HTMLElement).getBoundingClientRect();
                if (r.width < 30 || r.width > 320) continue;
                return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
            }
            return null;
        });
        if (!c) return false;
        await this.page.mouse.click(c.x, c.y);
        await this.page.waitForTimeout(1200);
        return true;
    }

    /**
     * Answer ONE question end-to-end. Returns the attempt (including the vision answer and
     * outcome) so the caller can log/assert. `isDone` lets the caller define "assessment
     * finished" (e.g. MasteryPage.isPastS1) so this class stays activity-agnostic.
     */
    async answerOne(isDone: () => Promise<boolean>): Promise<VqaAttempt> {
        const item = await this.readItem();
        const empty: VqaAttempt = { item, sourceAnswer: '', chosen: '', score: 0, via: 'ui', outcome: 'nomatch' };
        if (!item.question || item.options.length < 2) return empty;

        // Ask the answer source. Image capture is lazy — only sources that need it (vision)
        // trigger the screenshot/fetch; the content-API source ignores it.
        const sourceAnswer = await this.source.answer({
            question: item.question,
            options: item.options,
            captureImage: () => this.captureImage(item.imageSrc),
        });
        const match = matchOption(sourceAnswer, item.options);
        if (!match) return { ...empty, sourceAnswer };

        const beforeQ = item.question;
        const via = await this.submit(match.option, match.index);
        const base = { item, sourceAnswer, chosen: match.option, score: match.score, via };

        // Verify: advanced (new question / past node) = success; TRY AGAIN / life lost = wrong.
        for (let w = 0; w < 18; w++) {
            await this.page.waitForTimeout(1000);
            if (await isDone()) return { ...base, outcome: 'advanced' };
            await this.clickContinueIfAny();
            const now = await this.page.evaluate(() => document.body.innerText);
            if (/TRY AGAIN|can't hear|Oops|not quite/i.test(now)) {
                return { ...base, outcome: 'wrong' };
            }
            const cur = await this.readItem();
            if (cur.question && cur.question !== beforeQ) {
                return { ...base, outcome: 'advanced' };
            }
        }
        return { ...base, outcome: 'timeout' };
    }

    /**
     * Complete the whole assessment: answer questions until `isDone()` or the lives run out
     * or `maxItems` is hit. Returns every attempt for logging/assertion.
     */
    async complete(isDone: () => Promise<boolean>, maxItems = 25): Promise<VqaAttempt[]> {
        const attempts: VqaAttempt[] = [];
        let stuck = 0;
        for (let i = 0; i < maxItems; i++) {
            if (await isDone()) break;
            if (!(await this.isOnQuestion())) {
                if (await this.clickContinueIfAny()) { await this.page.waitForTimeout(1000); continue; }
                if (++stuck > 3) break;
                await this.page.waitForTimeout(1200);
                continue;
            }
            const a = await this.answerOne(isDone);
            attempts.push(a);
            if (a.outcome === 'advanced') { stuck = 0; continue; }
            // wrong / nomatch / timeout: a wrong answer costs a life; bail if exhausted.
            if ((await this.livesLeft()) === 0) break;
            if (++stuck > 4) break;
            await this.page.waitForTimeout(1000);
        }
        return attempts;
    }
}
