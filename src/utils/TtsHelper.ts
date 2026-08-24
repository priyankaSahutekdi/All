import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

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
 * real Hindi build has been probed — REFACTORING_PLAN.md tasks 13-14. Until then this
 * function returning near-empty audio for Devanagari is expected, and a Hindi read-aloud
 * assertion would fail on silence rather than on a missing word.
 */
export class TtsHelper {
    // Cache per word so we synthesize each word only once per run.
    private static cache = new Map<string, string>();

    /** Synthesize `text` to a WAV via Windows SAPI; returns the WAV bytes as base64. */
    static generateWavBase64(text: string): string {
        // Keep letters (any script), digits and spaces; drop punctuation and symbols, which
        // SAPI would either read aloud ("exclamation mark") or choke on. The previous
        // `[^A-Za-z0-9 ]` rule deleted every Devanagari code point, so a Hindi word reduced
        // to '' and this returned no audio at all — the app then recorded silence with no
        // error to trace. `\p{M}` is required alongside `\p{L}`: matras are marks, so
        // without it "किताब" would be mangled to "कतब".
        const safe = (text || '').replace(/[^\p{L}\p{M}\p{N} ]/gu, '').trim();
        if (!safe) return '';
        const cached = TtsHelper.cache.get(safe.toLowerCase());
        if (cached) return cached;

        // Temp filename must stay ASCII — it is interpolated into a PowerShell command line,
        // so a non-ASCII path would add a code-page variable to an already fiddly hop. The
        // readable slug is kept for Latin words; other scripts get a stable hash.
        const slug = safe.toLowerCase().replace(/\s+/g, '_');
        const stem = /^[a-z0-9_]+$/.test(slug) ? slug : createHash('sha1').update(slug).digest('hex').slice(0, 16);
        const outFile = path.join(os.tmpdir(), `tts_${stem}.wav`);
        // 16 kHz / 16-bit / mono PCM is widely decodable by Web Audio decodeAudioData.
        const ps = [
            "Add-Type -AssemblyName System.Speech;",
            '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;',
            "$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000,[System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,[System.Speech.AudioFormat.AudioChannel]::Mono);",
            `$s.SetOutputToWaveFile('${outFile}', $fmt);`,
            // Doubling `'` is how a literal quote is escaped in a PowerShell single-quoted
            // string. Punctuation is stripped above so this cannot trigger today; it is here
            // so widening that filter later cannot turn into command construction.
            `$s.Speak('${safe.replace(/'/g, "''")}');`,
            '$s.Dispose();',
        ].join(' ');

        execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'ignore' });
        const b64 = fs.readFileSync(outFile).toString('base64');
        try { fs.unlinkSync(outFile); } catch { /* ignore */ }
        TtsHelper.cache.set(safe.toLowerCase(), b64);
        return b64;
    }
}
