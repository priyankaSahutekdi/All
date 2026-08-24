import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AppLanguage } from './languages';

/**
 * Windows SAPI5 culture tag (BCP-47) for each language's TTS voice, keyed by `AppLanguage.code`.
 * English has no entry: the runner's default voice (David/Zira) already speaks it, so no
 * explicit `SelectVoice` is needed. Add an entry here only once a real SAPI5 voice for that
 * language is actually installed on the target runner(s) — see `docs/LANGUAGE_ONBOARDING.md (Appendix A)`.
 */
const VOICE_CULTURE: Partial<Record<string, string>> = {
    hindi: 'hi-IN',
};

/**
 * Text-to-speech helper for the F-series "say the word" recording assessments.
 *
 * The word screens display a word as TEXT with no audio prompt, and the app hosts no
 * word audio to reuse — so to feed the *correct* word into the microphone (instead of
 * Chromium's fake tone) we synthesize the word locally. On Windows we use the built-in
 * SAPI voice via PowerShell (`System.Speech.Synthesis`), which needs no network or
 * extra dependency. The resulting WAV bytes are returned base64-encoded so they can be
 * handed to the page and decoded into the injected microphone stream.
 *
 * Non-Latin text now survives the input filter, but that is only half of what a non-English
 * language needs, and the other half is an environment prerequisite rather than code:
 *
 *   SAPI synthesizes with the selected installed voice. This runner has only `Microsoft
 *   David/Zira Desktop` (en-US), and handing an en-US voice Devanagari yields a valid but
 *   EMPTY wav — a 46-byte header, i.e. silence. Verified, not assumed.
 *
 * So Hindi read-aloud needs (a) a hi-IN voice installed on whatever machine runs the suite,
 * and (b) voice selection by language here. Both belong to the Hindi support work once the
 * real Hindi build has been probed — BUILD_HISTORY.md (Refactoring Plan section) tasks 13-14.
 *
 * Until then, that silence is detected and THROWN rather than returned: a 46-byte WAV is
 * still non-empty base64, so every `if (b64)` guard at the call sites passed and the app went
 * on to record silence with nothing to trace. Failing here names the cause instead. See
 * MIN_REAL_WAV_BYTES for the measured numbers behind the threshold.
 */
export class TtsHelper {
    // Cache per word so we synthesize each word only once per run.
    private static cache = new Map<string, string>();

    /**
     * Smallest WAV we will accept as real speech, in bytes.
     *
     * Measured on this runner (Microsoft David/Zira Desktop, en-US), not guessed:
     *   • Devanagari with an en-US voice → 46 bytes (a 44-byte header + 2) = silence
     *   • the shortest real utterances ("a", "e", "i", "o") → 33,646 bytes
     *   • a typical word ("cat") → 39,086 bytes
     * A 730x gap, so any threshold in between is unambiguous. 1000 sits ~20x above the
     * header and ~33x below the smallest real word.
     */
    private static readonly MIN_REAL_WAV_BYTES = 1000;

    /** Hard cap on the SAPI subprocess so a hung voice cannot consume the whole test timeout. */
    private static readonly SYNTH_TIMEOUT_MS = 20000;

    /**
     * Synthesize `text` to a WAV via Windows SAPI; returns the WAV bytes as base64.
     *
     * `lang` selects the installed voice by culture (`VOICE_CULTURE`) when given; omitted (or a
     * language with no culture entry, e.g. English) uses the runner's default voice unchanged —
     * zero behavior change for every existing call site. Verified live, 2026-08-19 (H1): a hi-IN
     * voice bridged into the classic SAPI5 hive (`LANGUAGE_ONBOARDING.md (Appendix A)`) synthesizes real Devanagari
     * speech via this exact `execFileSync`/`-Command` mechanism (41,966 bytes for "अनार", not the
     * 46-byte silence a mismatched-language voice produces).
     */
    static generateWavBase64(text: string, lang?: AppLanguage): string {
        // Keep letters (any script), digits and spaces; drop punctuation and symbols, which
        // SAPI would either read aloud ("exclamation mark") or choke on. The previous
        // `[^A-Za-z0-9 ]` rule deleted every Devanagari code point, so a Hindi word reduced
        // to '' and this returned no audio at all — the app then recorded silence with no
        // error to trace. `\p{M}` is required alongside `\p{L}`: matras are marks, so
        // without it "किताब" would be mangled to "कतब".
        const safe = (text || '').replace(/[^\p{L}\p{M}\p{N} ]/gu, '').trim();
        if (!safe) {return '';}
        const culture = lang ? VOICE_CULTURE[lang.code] : undefined;
        const cacheKey = `${culture || 'default'}:${safe.toLowerCase()}`;
        const cached = TtsHelper.cache.get(cacheKey);
        if (cached) {return cached;}

        // Temp filename must stay ASCII — it is interpolated into a PowerShell command line,
        // so a non-ASCII path would add a code-page variable to an already fiddly hop. The
        // readable slug is kept for Latin words; other scripts get a stable hash.
        const slug = safe.toLowerCase().replace(/\s+/g, '_');
        const stem = /^[a-z0-9_]+$/.test(slug) ? slug : createHash('sha1').update(slug).digest('hex').slice(0, 16);
        const outFile = path.join(os.tmpdir(), `tts_${stem}.wav`);
        // Select the installed voice by culture when one is required. Thrown loudly if missing
        // (not a silent fallback to the default voice), for the same reason MIN_REAL_WAV_BYTES
        // throws below: a mismatched-language voice produces a "valid" but silent WAV, so the
        // failure must name its cause rather than surface later as a 46-byte-file mystery.
        const selectVoice = culture
            ? `$v = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -eq '${culture}' } | Select-Object -First 1; `
              + `if (-not $v) { throw 'No installed SAPI5 voice for culture ${culture} - see docs/LANGUAGE_ONBOARDING.md (Appendix A)' }; `
              + '$s.SelectVoice($v.VoiceInfo.Name);'
            : '';
        // 16 kHz / 16-bit / mono PCM is widely decodable by Web Audio decodeAudioData.
        const ps = [
            "Add-Type -AssemblyName System.Speech;",
            '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;',
            selectVoice,
            "$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000,[System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,[System.Speech.AudioFormat.AudioChannel]::Mono);",
            `$s.SetOutputToWaveFile('${outFile}', $fmt);`,
            // Doubling `'` is how a literal quote is escaped in a PowerShell single-quoted
            // string. Punctuation is stripped above so this cannot trigger today; it is here
            // so widening that filter later cannot turn into command construction.
            `$s.Speak('${safe.replace(/'/g, "''")}');`,
            '$s.Dispose();',
        ].filter(Boolean).join(' ');

        // stderr is captured, not discarded: SAPI can fail non-terminally, exit 0 and write no
        // file, in which case the readFileSync below throws a bare ENOENT and the actual
        // diagnosis is whatever PowerShell printed. `stdio: 'ignore'` used to throw it away.
        try {
            execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], {
                stdio: ['ignore', 'ignore', 'pipe'],
                timeout: TtsHelper.SYNTH_TIMEOUT_MS,
            });
        } catch (e) {
            const err = e as { stderr?: Buffer; signal?: string; message?: string };
            const stderr = (err.stderr?.toString() || '').trim();
            throw new Error(
                `TTS synthesis failed for "${safe}"` +
                (err.signal === 'SIGTERM' ? ` (timed out after ${TtsHelper.SYNTH_TIMEOUT_MS}ms)` : '') +
                (stderr ? `\nPowerShell stderr: ${stderr}` : `\n${err.message || ''}`),
            );
        }

        const buf = fs.readFileSync(outFile);
        try { fs.unlinkSync(outFile); } catch { /* ignore */ }

        // A WAV that is header-only is silence, and silence is NOT a usable prompt: the app
        // would record nothing and the assessment would fail somewhere far away, or worse pass
        // for an unrelated reason. The known cause is a voice that cannot speak the script at
        // all (no hi-IN voice installed for Devanagari), which is an environment problem and
        // must be reported as one rather than surfacing later as an opaque decode error.
        if (buf.length < TtsHelper.MIN_REAL_WAV_BYTES) {
            throw new Error(
                `TTS produced ${buf.length} bytes for "${safe}" — that is silence, not speech ` +
                `(a WAV header alone is 44 bytes; real speech on this runner is >33KB).\n` +
                (culture
                    ? `Voice selection for culture '${culture}' ran but still produced silence — ` +
                      `the installed voice may not cover this exact text. See docs/LANGUAGE_ONBOARDING.md (Appendix A).`
                    : `No language was requested (or it has no VOICE_CULTURE entry), so the runner's ` +
                      `default voice was used — it most likely cannot speak this script. If this text ` +
                      `is non-English, pass 'lang' through to generateWavBase64.`) +
                ` Text was: ${JSON.stringify(safe)}`,
            );
        }

        const b64 = buf.toString('base64');
        TtsHelper.cache.set(cacheKey, b64);
        return b64;
    }
}
