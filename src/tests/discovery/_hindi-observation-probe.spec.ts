/* eslint-disable no-console */
/**
 * ============================================================================
 * THROWAWAY / LOCAL-ONLY — H2a Hindi observation probe. DO NOT COMMIT.
 * ============================================================================
 *
 * Purpose (HINDI_ROLLOUT_LOG.md (Readiness Plan section) Phase 4, task H2a): observe REAL Hindi app behaviour —
 * screen text, audio URLs, counters, geometry — before writing any Hindi fix. This file does
 * not become part of the permanent framework. It exists to produce evidence, not to pass/fail
 * a suite.
 *
 * Design choices, all deliberate:
 *   - Does NOT construct DiscoveryLoginPage / AssessmentPage / FoundationPage with a Hindi
 *     `lang` for driving the flow, because their constructors eagerly resolve `uiCopy` and
 *     THROW immediately for every key with no Hindi value (this is itself checked and logged
 *     as the first step below). Driving is done with raw, language-agnostic Playwright calls
 *     (role/css/geometry locators that do not depend on uiCopy) instead.
 *   - Never guesses or hardcodes a Hindi string. Where a click needs to find "Confirm" or
 *     similar, it tries the known ENGLISH literal first (to test the H-1 hypothesis that
 *     pre-switch screens render in the app's default language), then falls back to a
 *     geometry-only "click the most prominent visible button" heuristic and LOGS the text it
 *     actually found — that logged text is the observation, never assumed in advance.
 *   - Every screen is captured (URL, full innerText, screenshot) regardless of whether a click
 *     succeeded, so a stalled step still yields evidence.
 *   - Capped iteration counts (assessment items, wrong-tap rounds) — this is a diagnostic
 *     sweep, not a full completion run. Caps are logged explicitly so they are never mistaken
 *     for a failure.
 *   - Never throws out of the test: a `try/finally` always writes the evidence files, and any
 *     escaped error is recorded as the first-failure point rather than crashing silently.
 */
import * as fs from 'fs';
import * as path from 'path';
import { test } from '../../fixtures/appTest';
import { DiscoveryLoginPage, AssessmentPage } from '../../pages/discovery';
import { FoundationPage } from '../../pages/foundation';
import { DiscoveryHelper } from '../../utils/DiscoveryHelper';
import { languageByCode, labelRe, ANY_LANGUAGE_LABEL_TOKEN } from '../../utils/languages';

const HINDI = languageByCode('hindi');
test.use({ lang: HINDI });

const OUT_DIR = path.join('test-results', 'hindi-probe');
fs.mkdirSync(OUT_DIR, { recursive: true });

test.describe('@Throwaway Hindi Discovery+F1 observation probe (H2a, not committed)', () => {
    test('observe', async ({ page }) => {
        test.setTimeout(40 * 60 * 1000);

        const log: string[] = [];
        const record = (msg: string): void => {
            const line = `[${new Date().toISOString()}] ${msg}`;
            console.log(`[H2a] ${msg}`);
            log.push(line);
        };

        const waveRequests: string[] = [];
        page.on('request', (req) => {
            const url = req.url();
            if (/\/letter\/|\.wav(\?|$)|\/audio\//i.test(url)) waveRequests.push(url);
        });
        const consoleErrors: string[] = [];
        page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
        const pageErrors: string[] = [];
        page.on('pageerror', (err) => pageErrors.push(String(err)));

        let seq = 0;
        const snap = async (label: string): Promise<void> => {
            seq += 1;
            const idx = String(seq).padStart(2, '0');
            const file = path.join(OUT_DIR, `${idx}-${label}`);
            let text = '';
            try {
                text = await page.evaluate(() => document.body.innerText);
                fs.writeFileSync(`${file}.txt`, text, 'utf8');
            } catch (e) {
                text = `<<FAILED to read text: ${(e as Error).message}>>`;
            }
            try {
                await page.screenshot({ path: `${file}.png`, fullPage: true });
            } catch (e) {
                record(`[${idx}] ${label} | FAILED to screenshot: ${(e as Error).message}`);
            }
            record(`[${idx}] ${label} | url=${page.url()} | text[0..300]="${text.replace(/\s+/g, ' ').slice(0, 300)}"`);
        };

        /** Geometry-only "click the most prominent visible button" — no text assumed. Returns the text it found. */
        const clickPrimaryModalButton = async (): Promise<string | null> => {
            return await page.evaluate(() => {
                const cands = Array.from(
                    document.querySelectorAll('button, [role="button"], div[class*="btn" i]'),
                ) as HTMLElement[];
                let best: HTMLElement | null = null;
                let bestArea = 0;
                for (const el of cands) {
                    const r = el.getBoundingClientRect();
                    if (r.width < 40 || r.height < 20) continue;
                    if (r.top < 0 || r.bottom > window.innerHeight || r.width <= 0) continue;
                    // Exclude the header bar entirely (observed ~0-70px: language pill, mic icon,
                    // power/logout icon). Twice now, this fallback's only "real button" candidate
                    // on a screen has turned out to be the header's icon-only logout control,
                    // because this app's actual CTAs (language tiles, Confirm, Start Assessment)
                    // are plain non-matching <div>s. Excluding the header is a general safety fix,
                    // not a guess at any screen's text — real CTAs live in the content area below.
                    if (r.top < 70) continue;
                    if (getComputedStyle(el).visibility === 'hidden') continue;
                    const area = r.width * r.height;
                    if (area > bestArea) { bestArea = area; best = el; }
                }
                if (!best) return null;
                const t = (best.innerText || '').trim();
                best.click();
                return t;
            }).catch(() => null);
        };

        /** Try known English literals first (tests H-1); fall back to the geometry click and log the real text. */
        const bestEffortAdvance = async (label: string, englishCandidates: string[]): Promise<void> => {
            for (const c of englishCandidates) {
                const loc = page.getByText(c, { exact: true }).first();
                if (await loc.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await loc.click({ timeout: 5000, force: true }).catch(() => {});
                    record(`${label}: clicked ENGLISH literal "${c}" (H-1 signal: pre-switch/this screen rendered English)`);
                    return;
                }
            }
            const found = await clickPrimaryModalButton();
            record(`${label}: no English literal matched; geometry-fallback clicked button, observed text = ${JSON.stringify(found)}`);
        };

        /** Geometry-only round/square record-stop toggle centre — copied from AssessmentPage.recordToggleCenter (language-agnostic). */
        const recordToggleCenter = async (): Promise<{ x: number; y: number } | null> => {
            return await page.evaluate(() => {
                let best: { x: number; y: number; w: number } | null = null;
                for (const n of Array.from(document.querySelectorAll('div, button, svg'))) {
                    const el = n as HTMLElement;
                    const r = el.getBoundingClientRect();
                    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
                    if (cx < 590 || cx > 690) continue;
                    // Upper bound widened 410→450: round 3 (2026-08-18) measured the toggle at
                    // cy≈415 on this Hindi demo screen (screenshot 13-assessment-item-0-no-toggle),
                    // just past the English-derived band. Widened only by the measured amount —
                    // H-4's own methodology — and only in this throwaway probe, not the framework.
                    if (cy < 285 || cy > 450) continue;
                    if (r.width < 30 || r.width > 95) continue;
                    const ratio = r.height / (r.width || 1);
                    if (ratio < 0.6 || ratio > 1.5) continue;
                    if (getComputedStyle(el).cursor !== 'pointer') continue;
                    if (!best || r.width < best.w) best = { x: cx, y: cy, w: r.width };
                }
                return best ? { x: best.x, y: best.y } : null;
            });
        };

        /** Geometry-only Letter Hunt bubble detector — copied verbatim from discovery-e2e.spec.ts (language-agnostic). */
        const getLetterBubbles = async (): Promise<{ x: number; y: number }[]> =>
            await page.evaluate(() => {
                const seen = new Set<string>();
                const out: { x: number; y: number }[] = [];
                for (const el of Array.from(document.querySelectorAll('div, svg, button, img'))) {
                    const r = (el as HTMLElement).getBoundingClientRect();
                    if (r.y < 110 || r.y > 365) continue;
                    if (r.width < 30 || r.width > 80) continue;
                    const ratio = r.height / (r.width || 1);
                    if (ratio < 0.7 || ratio > 1.4) continue;
                    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
                    const key = `${Math.round(cx / 16)},${Math.round(cy / 16)}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    out.push({ x: cx, y: cy });
                }
                return out;
            });

        const sentenceText = () => page.getByRole('heading', { level: 4 }).filter({ hasText: /\S/ }).first();

        let firstFailure: string | null = null;

        try {
            // ---- Step 0: does constructing the real page objects with lang=hindi throw? -----
            await test.step('H2a-0: page-object construction check (hindi)', async () => {
                const attempts: Array<[string, () => void]> = [
                    ['DiscoveryLoginPage', () => { new DiscoveryLoginPage(page, HINDI); }],
                    ['AssessmentPage', () => { new AssessmentPage(page, HINDI); }],
                    ['FoundationPage', () => { new FoundationPage(page, HINDI); }],
                ];
                for (const [name, fn] of attempts) {
                    try {
                        fn();
                        record(`CONSTRUCT ${name}(hindi): OK (no throw)`);
                    } catch (e) {
                        record(`CONSTRUCT ${name}(hindi): THROWS -> ${(e as Error).message}`);
                    }
                }
            });

            // ---- Step 1: raw navigate + guest login (identical mechanics to DiscoveryLoginPage.login, inlined) ----
            await test.step('H2a-1: navigate + guest login', async () => {
                await page.goto('/');
                await page.waitForTimeout(3000);
                await snap('login-landing');

                const gotIt = page.getByRole('button', { name: /Got it/i }).first();
                if (await gotIt.isVisible({ timeout: 4000 }).catch(() => false)) {
                    await gotIt.click({ timeout: 4000 }).catch(() => {});
                    await page.waitForTimeout(600);
                }

                await page.getByRole('tab', { name: /^Guest$/i }).first().click({ timeout: 5000 }).catch(() => {});
                const grade = page.locator('#grade-guest');
                if (!(await grade.isVisible({ timeout: 2000 }).catch(() => false))) {
                    const box = await page.evaluate(() => {
                        for (const el of Array.from(document.querySelectorAll('[role="tab"], button'))) {
                            if (((el as HTMLElement).innerText || '').trim() === 'Guest') {
                                const r = (el as HTMLElement).getBoundingClientRect();
                                return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
                            }
                        }
                        return null;
                    });
                    if (box) await page.mouse.click(box.x, box.y);
                    await grade.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
                }

                const user = DiscoveryHelper.createTestUser();
                record(`guest user: ${user.username} (fresh, language-agnostic minting — no reuse of any English account)`);
                await page.locator('#username-guest, input[placeholder="User ID"]').first().fill(user.username);
                await page.locator('#password-guest, input[placeholder="Password"]').first().fill(user.password);
                await grade.selectOption('2').catch(async () => { await grade.selectOption({ label: '2' }).catch(() => {}); });
                await page.getByRole('button', { name: /Login as Guest/i }).first().click();

                await page.waitForURL(/\/home/i, { timeout: 30000 }).catch(() => {});
                await snap('home-page');
                await page.getByText('Continue to ALL', { exact: true }).first().click({ timeout: 10000 }).catch(() => {});
                await page.waitForURL(/\/all/i, { timeout: 30000 }).catch(() => {});
                await page.waitForTimeout(4000);
                await snap('all-platform-entry');
            });

            // ---- Step 2: TC-001 mic-test screen — the FIRST test of H-1 (pre-switch language) ----
            await test.step('H2a-2: TC-001 mic-test screen', async () => {
                await snap('mic-test-screen');
                await bestEffortAdvance('mic-test Skip', ['Skip']);
                await page.waitForTimeout(2000);
                await snap('after-mic-skip-attempt');
            });

            // ---- Step 3: TC-002 help-language popup ----
            await test.step('H2a-3: TC-002 help-language popup', async () => {
                await snap('help-language-popup');
                await bestEffortAdvance('help-language Confirm', ['Confirm']);
                await page.waitForTimeout(2500);
                await snap('after-help-language-confirm');
            });

            // ---- Step 4: TC-003 learning-language switcher — settles the "which direction" question ----
            await test.step('H2a-4: TC-003 learning-language switcher', async () => {
                await page.locator('div.MuiBox-root', { hasText: ANY_LANGUAGE_LABEL_TOKEN }).last()
                    .click({ force: true }).catch(() => {});
                await page.waitForTimeout(2000);
                await snap('language-dropdown-open');

                const hindiOpt = page.getByText(labelRe(HINDI)).first();
                const hindiVisible = await hindiOpt.isVisible({ timeout: 5000 }).catch(() => false);
                record(`Hindi option (हिंदी/Hindi) visible in dropdown: ${hindiVisible}`);
                if (hindiVisible) {
                    await hindiOpt.click({ force: true }).catch(() => {});
                    await page.waitForTimeout(800);
                    record('clicked the हिंदी/Hindi option');
                } else {
                    record('Hindi option NOT found in dropdown by label — capturing screenshot for manual read');
                }
                await snap('after-hindi-option-click');

                // 'कन्फर्म करें' is now an OBSERVED string (previous run, 2026-08-18, this modal) —
                // not a guess. Trying it before the geometry fallback avoids repeating the
                // mis-click that caused an unplanned logout last time.
                await bestEffortAdvance('learning-language Confirm', ['Confirm', 'कन्फर्म करें']);
                await page.waitForTimeout(2500);
                await snap('after-language-confirm');

                // Bounded explicitly (8s, caught) — last run this hung 30+ min here after the
                // fallback above landed on the wrong element and logged the session out, because
                // an unbounded .innerText() on a locator with zero matches did not time out as
                // expected. Never leave this call unbounded again.
                const headerLabel = await page.locator('div.MuiBox-root', { hasText: ANY_LANGUAGE_LABEL_TOKEN })
                    .last().innerText({ timeout: 8000 }).catch((e) => `(not found: ${(e as Error).message.slice(0, 80)})`);
                record(`header language switcher now reads: "${headerLabel}"`);
            });

            // ---- Step 5: TC-004 start assessment / demo ----
            await test.step('H2a-5: TC-004 start assessment + demo', async () => {
                // 'असेसमेंट शुरू करें' observed in round 2 (2026-08-18) — not a guess.
                await bestEffortAdvance('Start Assessment', ['Start Assessment', 'असेसमेंट शुरू करें']);
                await page.waitForTimeout(3000);
                await snap('post-start-assessment');
                // Demo screen may need Start Game / Skip Demo / one record cycle to leave. Checks
                // BOTH the English literal and the Hindi values H2a round 2 (2026-08-18) already
                // observed ('खेल शुरू करें' / 'डेमो छोड़ें') — the original probe only checked
                // English here, which on a real Hindi run never matches post-switch screens (this
                // IS a post-switch screen), so the loop silently no-opped and every later step
                // kept operating on the still-open demo instead of the real assessment.
                for (let i = 0; i < 4; i++) {
                    const started = (await page.getByText('Start Game', { exact: true }).first()
                        .isVisible({ timeout: 1500 }).catch(() => false))
                        || (await page.getByText('खेल शुरू करें', { exact: true }).first()
                            .isVisible({ timeout: 1500 }).catch(() => false));
                    const skipped = (await page.getByText('Skip Demo', { exact: true }).first()
                        .isVisible({ timeout: 1500 }).catch(() => false))
                        || (await page.getByText('डेमो छोड़ें', { exact: true }).first()
                            .isVisible({ timeout: 1500 }).catch(() => false));
                    if (started) {
                        await bestEffortAdvance('demo Start Game', ['Start Game', 'खेल शुरू करें']);
                        await page.waitForTimeout(6000);
                    } else if (skipped) {
                        await bestEffortAdvance('demo Skip Demo', ['Skip Demo', 'डेमो छोड़ें']);
                        await page.waitForTimeout(4000);
                    } else {
                        break;
                    }
                }
                await snap('after-demo-exit-attempt');
            });

            // ---- Step 6: TC-005-010 — drive BOTH assessments to real completion (H11 attempt 1,
            // 2026-08-19, proved TC-001..TC-008 pass live via the real production spec; it failed
            // cleanly at TC-009 only because 'hurray'/'successfullyCompleted'/'completedAssessment'
            // have never been observed. This step exists solely to observe those 3 strings plus
            // the Continue button, for both assessment rounds — a cap high enough that completion
            // is reached for real (English needed 3 items for Assessment 1, 5 for Assessment 2;
            // see HINDI_ROLLOUT_LOG.md (Execution Log section) EL-9), not the old diagnostic-only 4-item probe.) ----
            const ASSESSMENT_ITEM_CAP = 8;
            const runAssessmentRound = async (roundLabel: string): Promise<void> => {
                await test.step(`H2a-6 (${roundLabel}): drive to real completion (capped at ${ASSESSMENT_ITEM_CAP} items)`, async () => {
                    for (let i = 0; i < ASSESSMENT_ITEM_CAP; i++) {
                        const txt = (await sentenceText().textContent({ timeout: 8000 }).catch(() => '')) || '';
                        if (!txt.trim()) {
                            record(`${roundLabel} item ${i}: no sentence text found — likely the completion popup replaced it; capturing`);
                            await snap(`${roundLabel}-completion-candidate`);
                            break;
                        }
                        record(`${roundLabel} item ${i}: sentence/content text = "${txt}"`);
                        const toggle = await recordToggleCenter();
                        if (!toggle) {
                            record(`${roundLabel} item ${i}: record/stop toggle geometry NOT found (H-4 candidate — layout may have shifted)`);
                            await snap(`${roundLabel}-item-${i}-no-toggle`);
                            break;
                        }
                        await page.mouse.click(toggle.x, toggle.y); // start recording
                        await page.waitForTimeout(2500);
                        await page.mouse.click(toggle.x, toggle.y); // stop recording
                        await page.waitForTimeout(1500);
                        // Next control: stable css class per AssessmentPage.nextButton (language-agnostic).
                        // On the FINAL item this may not be the button shown (e.g. a differently
                        // classed "Finish"/"Submit" control) — fall back to the generic
                        // largest-visible-button click and KEEP LOOPING rather than stopping here,
                        // so the top-of-loop "no sentence text" check is what actually detects
                        // completion (this is what the original H2a probe did; an earlier revision
                        // of this file broke on this branch instead, which meant it always stopped
                        // one item short of the real completion popup).
                        const nextBtn = page.locator('div.css-4g6ai3, div.css-1m9gxh8 > div').first();
                        if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                            await nextBtn.click({ timeout: 5000 }).catch(() => {});
                            record(`${roundLabel} item ${i}: clicked Next (css-class locator)`);
                        } else {
                            const found = await clickPrimaryModalButton();
                            record(`${roundLabel} item ${i}: Next button (css-class locator) not visible — `
                                + `geometry fallback clicked, observed text = ${JSON.stringify(found)}`);
                        }
                        await page.waitForTimeout(4000);
                    }
                    // Whatever is on screen now IS the observation target (completion popup, ideally).
                    await snap(`${roundLabel}-after-item-loop`);
                    record(`${roundLabel}: full completion-popup text captured above (see the .txt file) — `
                        + `this is the raw source for 'hurray'/'successfullyCompleted'/'completedAssessment'`);
                    await bestEffortAdvance(`${roundLabel} completion Continue`, ['Continue']);
                    await page.waitForTimeout(3000);
                    await snap(`${roundLabel}-after-continue-attempt`);
                });
            };
            await runAssessmentRound('Assessment-1');
            await runAssessmentRound('Assessment-2');

            // ---- Step 7: TC-011/012 — Letter Hunt demo skip + deliberate-fail routine ----
            const WRONG_TAP_CAP = 20;
            await test.step('H2a-7: Letter Hunt demo skip + deliberate-fail routine', async () => {
                await bestEffortAdvance('Letter Hunt Skip Demo', ['Skip Demo']);
                await page.waitForTimeout(3000);
                await snap('letter-hunt-after-skip-demo');

                let bubbles = await getLetterBubbles();
                record(`Letter Hunt bubbles detected: ${bubbles.length}`);
                if (bubbles.length === 0) {
                    record('no bubbles detected — Letter Hunt may not have been reached; capturing evidence and stopping this step');
                    await snap('letter-hunt-no-bubbles');
                    return;
                }
                for (let round = 0; round < WRONG_TAP_CAP; round++) {
                    bubbles = await getLetterBubbles();
                    if (bubbles.length === 0) {
                        record(`Letter Hunt: bubbles vanished after ${round} rounds — likely reached result screen`);
                        break;
                    }
                    await page.mouse.click(bubbles[0].x, bubbles[0].y).catch(() => {});
                    await page.waitForTimeout(1500);
                }
                await snap('letter-hunt-result-or-stall');
            });

            // ---- Step 8: F1 entry attempt (best-effort, generic — no known Hindi/English label assumed) ----
            await test.step('H2a-8: F1 entry attempt (best-effort, generic)', async () => {
                const found = await clickPrimaryModalButton();
                record(`result-screen primary-button click (expected "Let's Start" equivalent): observed text = ${JSON.stringify(found)}`);
                await page.waitForTimeout(3000);
                await snap('after-lets-start-attempt');

                const startF = await clickPrimaryModalButton();
                record(`F1-landing primary-button click (expected "Start F1" equivalent): observed text = ${JSON.stringify(startF)}`);
                await page.waitForTimeout(3000);
                await snap('after-start-f1-attempt');
            });

            // ---- Step 9: F1 Letter Train — observe only, STOP before any mic/TTS step (H1 is BLOCKED) ----
            await test.step('H2a-9: F1 Letter Train landing — observe, then stop (TTS blocked, H1 BLOCKED)', async () => {
                await snap('f1-letter-train-landing');
                const toggle = await recordToggleCenter();
                record(`F1 Letter Train "say the word" mic control present: ${toggle !== null}. `
                    + 'STOPPING here per scope — no hi-IN SAPI voice is installed (H1 BLOCKED), so no '
                    + 'synthesized Hindi audio can be injected. This is the documented F1 stopping point, not a bug.');
            });
        } catch (e) {
            firstFailure = (e as Error).stack || String(e);
            record(`FATAL — probe stopped by an unhandled error: ${firstFailure}`);
            await snap('fatal-error-state').catch(() => {});
        } finally {
            fs.writeFileSync(path.join(OUT_DIR, 'observation-log.md'), log.join('\n'), 'utf8');
            fs.writeFileSync(path.join(OUT_DIR, 'audio-requests.json'), JSON.stringify(waveRequests, null, 2), 'utf8');
            fs.writeFileSync(path.join(OUT_DIR, 'console-errors.json'), JSON.stringify(consoleErrors, null, 2), 'utf8');
            fs.writeFileSync(path.join(OUT_DIR, 'page-errors.json'), JSON.stringify(pageErrors, null, 2), 'utf8');
            fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify({
                firstFailure,
                waveRequestCount: waveRequests.length,
                consoleErrorCount: consoleErrors.length,
                pageErrorCount: pageErrors.length,
                screenshotCount: seq,
            }, null, 2), 'utf8');
            console.log(`[H2a] evidence written to ${OUT_DIR} (${seq} screens captured, ${waveRequests.length} audio/letter requests, firstFailure=${firstFailure ? 'YES' : 'no'})`);
        }
    });
});
