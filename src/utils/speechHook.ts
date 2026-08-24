import { Page } from '@playwright/test';

/**
 * Speaking-assessment automation hook (Mastery S-series "Read the Image / listen-and-repeat").
 *
 * These assessments capture the learner's spoken answer via the browser's Web Speech
 * `SpeechRecognition` API and gate on it. In automated Chromium there is no real microphone,
 * so real recognition returns nothing ("We can't hear you!"). The app also DICTATES the
 * phrase to repeat via `speechSynthesis` ("Now repeat what you heard!").
 *
 * This hook, installed BEFORE the app loads (via addInitScript, so it applies to the
 * same-origin app iframe too):
 *   1. Captures each `speechSynthesis.speak(...)` text into `window.__lastSpoken`.
 *   2. Replaces `SpeechRecognition` / `webkitSpeechRecognition` with a mock whose `start()`
 *      emits a synthetic final `result` whose transcript IS the last dictated phrase — i.e.
 *      it "repeats what it heard" perfectly.
 *
 * Result: the app receives a clean, correct transcript and accepts the answer — no real
 * audio, no backend ASR, no image comprehension needed. Isolated + reusable for any
 * speaking assessment; install it only in the specs that need it (F-series is untouched).
 */
export async function installSpeechRepeatHook(page: Page): Promise<void> {
    await page.addInitScript(() => {
        const w = window as unknown as { __lastSpoken?: string; __speechHook?: boolean; __srEvents?: string[] };
        if (w.__speechHook) return;
        w.__speechHook = true;
        w.__lastSpoken = '';
        // Lightweight recognition-event log (harmless; aids debugging the mic/submit flow).
        w.__srEvents = [];
        const logEv = (s: string) => { try { (w.__srEvents = w.__srEvents || []).push(s); } catch { /* */ } };

        // 1. Capture the dictated phrase.
        try {
            const ss = window.speechSynthesis;
            if (ss && ss.speak) {
                const orig = ss.speak.bind(ss);
                ss.speak = (u: SpeechSynthesisUtterance) => { try { if (u && u.text) w.__lastSpoken = u.text; } catch { /* ignore */ } return orig(u); };
            }
        } catch { /* ignore */ }

        // 2. Mock SpeechRecognition → emit the last dictated phrase as the recognised result.
        try {
            const g = window as unknown as Record<string, unknown>;
            if (g.SpeechRecognition || g.webkitSpeechRecognition) {
                class MockSpeechRecognition extends EventTarget {
                    onresult: ((e: Event) => void) | null = null;
                    onend: ((e: Event) => void) | null = null;
                    onstart: ((e: Event) => void) | null = null;
                    onerror: ((e: Event) => void) | null = null;
                    onspeechend: ((e: Event) => void) | null = null;
                    onaudioend: ((e: Event) => void) | null = null;
                    lang = ''; continuous = false; interimResults = false; maxAlternatives = 1;
                    start(): void {
                        logEv('start');
                        setTimeout(() => { try { this.onstart?.(new Event('start')); this.dispatchEvent(new Event('start')); } catch { /* */ } }, 40);
                        setTimeout(() => {
                            // Prefer an explicit override (`window.__srForce`, set by the
                            // driver to speak a specific answer); else echo the dictated phrase.
                            const ww = window as unknown as { __lastSpoken?: string; __srForce?: string };
                            const transcript = (ww.__srForce && ww.__srForce.length ? ww.__srForce : ww.__lastSpoken) || '';
                            logEv('emit:' + transcript);
                            const alt = { transcript, confidence: 0.97 };
                            const result = Object.assign([alt], { isFinal: true, length: 1 });
                            const results = Object.assign([result], { length: 1 });
                            const ev = Object.assign(new Event('result'), { results, resultIndex: 0 });
                            try { this.onresult?.(ev); } catch { /* */ }
                            try { this.dispatchEvent(ev); } catch { /* */ }
                            try { this.onspeechend?.(new Event('speechend')); } catch { /* */ }
                            try { this.onaudioend?.(new Event('audioend')); } catch { /* */ }
                            const endEv = new Event('end');
                            try { this.onend?.(endEv); } catch { /* */ }
                            try { this.dispatchEvent(endEv); } catch { /* */ }
                        }, 700);
                    }
                    stop(): void { /* no-op: result already emitted on start */ }
                    abort(): void { /* no-op */ }
                }
                g.SpeechRecognition = MockSpeechRecognition;
                g.webkitSpeechRecognition = MockSpeechRecognition;
            }
        } catch { /* ignore */ }
    });
}
