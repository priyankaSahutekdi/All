import { execFileSync, execSync } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AppLanguage } from './languages';

type OSType = 'win32' | 'darwin' | 'linux';

/**
 * Language/voice mapping for each platform.
 * Windows uses SAPI5 culture tags (BCP-47).
 * Linux uses espeak language codes.
 * macOS uses voice names.
 */
const VOICE_CONFIG: Partial<Record<string, Record<OSType, string>>> = {
    hindi: {
        win32: 'hi-IN',
        linux: 'hi',
        darwin: 'Samantha', // fallback; macOS voices are limited
    },
    nepali: {
        win32: 'hi-IN',
        linux: 'hi', // espeak doesn't have Nepali, use Hindi as fallback
        darwin: 'Samantha',
    },
};

/**
 * Cross-platform text-to-speech helper for the F-series "say the word" recording assessments.
 *
 * The word screens display a word as TEXT with no audio prompt, and the app hosts no
 * word audio to reuse — so to feed the *correct* word into the microphone (instead of
 * Chromium's fake tone) we synthesize the word locally. The implementation automatically
 * selects the appropriate TTS backend based on the operating system:
 *
 *   - Windows: Built-in SAPI5 via PowerShell (`System.Speech.Synthesis`)
 *   - Linux: espeak/espeak-ng command-line tool
 *   - macOS: Built-in `say` command
 *
 * The resulting WAV bytes are returned base64-encoded so they can be handed to the page
 * and decoded into the injected microphone stream.
 *
 * Non-Latin text now survives the input filter, but that is only half of what a non-English
 * language needs, and the other half is an environment prerequisite rather than code:
 *
 * For non-English languages:
 *   - Windows: Requires appropriate SAPI5 voice installed (e.g., hi-IN for Hindi)
 *   - Linux: Requires espeak package and appropriate language data
 *   - macOS: Uses available system voices
 *
 * Silence is detected and THROWN rather than returned: a 46-byte WAV is still non-empty
 * base64, so every `if (b64)` guard at the call sites passed and the app went on to record
 * silence with nothing to trace. Failing here names the cause instead. See MIN_REAL_WAV_BYTES.
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

    static generateWavBase64(text: string, lang?: AppLanguage): string {
        const safe = (text || '').replace(/[^\p{L}\p{M}\p{N} ]/gu, '').trim();
        if (!safe) {return '';}

        const voiceConfig = lang ? VOICE_CONFIG[lang.code] : undefined;
        const osType = process.platform as OSType;
        const voice = voiceConfig?.[osType];
        const cacheKey = `${voice || 'default'}:${safe.toLowerCase()}`;
        const cached = TtsHelper.cache.get(cacheKey);
        if (cached) {return cached;}

        const slug = safe.toLowerCase().replace(/\s+/g, '_');
        const stem = /^[a-z0-9_]+$/.test(slug) ? slug : createHash('sha1').update(slug).digest('hex').slice(0, 16);
        const outFile = path.join(os.tmpdir(), `tts_${stem}.wav`);

        try {
            switch (osType) {
                case 'win32':
                    TtsHelper.synthesizeWindows(safe, voice, outFile);
                    break;
                case 'darwin':
                    TtsHelper.synthesizeMacOS(safe, voice, outFile);
                    break;
                case 'linux':
                    TtsHelper.synthesizeLinux(safe, voice, outFile);
                    break;
                default:
                    throw new Error(`Unsupported platform: ${process.platform}`);
            }
        } catch (e) {
            const err = e as { signal?: string; message?: string };
            throw new Error(
                `TTS synthesis failed for "${safe}" on ${osType}` +
                (err.signal === 'SIGTERM' ? ` (timed out after ${TtsHelper.SYNTH_TIMEOUT_MS}ms)` : '') +
                `\n${err.message || ''}`,
            );
        }

        const buf = fs.readFileSync(outFile);
        try { fs.unlinkSync(outFile); } catch { /* ignore */ }

        if (buf.length < TtsHelper.MIN_REAL_WAV_BYTES) {
            throw new Error(
                `TTS produced ${buf.length} bytes for "${safe}" — that is silence, not speech ` +
                `(a WAV header alone is 44 bytes; real speech should be >1000 bytes). ` +
                (voice
                    ? `Voice selection for '${voice}' ran but produced silence. The voice may not support this script.`
                    : `No language-specific voice was selected; the default voice was used.`) +
                ` Text was: ${JSON.stringify(safe)}`,
            );
        }

        const b64 = buf.toString('base64');
        TtsHelper.cache.set(cacheKey, b64);
        return b64;
    }

    private static synthesizeWindows(text: string, culture: string | undefined, outFile: string): void {
        const selectVoice = culture
            ? `$v = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -eq '${culture}' } | Select-Object -First 1; `
              + `if (-not $v) { throw 'No installed SAPI5 voice for culture ${culture}' }; `
              + '$s.SelectVoice($v.VoiceInfo.Name);'
            : '';
        const ps = [
            "Add-Type -AssemblyName System.Speech;",
            '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;',
            selectVoice,
            "$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000,[System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,[System.Speech.AudioFormat.AudioChannel]::Mono);",
            `$s.SetOutputToWaveFile('${outFile}', $fmt);`,
            `$s.Speak('${text.replace(/'/g, "''")}');`,
            '$s.Dispose();',
        ].filter(Boolean).join(' ');

        execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], {
            stdio: ['ignore', 'ignore', 'pipe'],
            timeout: TtsHelper.SYNTH_TIMEOUT_MS,
        });
    }

    private static synthesizeLinux(text: string, lang: string | undefined, outFile: string): void {
        const langCode = lang || 'en';
        try {
            execSync(`espeak -v ${langCode} -w "${outFile}" "${text.replace(/"/g, '\\"')}"`, {
                stdio: ['ignore', 'ignore', 'pipe'],
                timeout: TtsHelper.SYNTH_TIMEOUT_MS,
            });
        } catch {
            try {
                execSync(`espeak-ng -v ${langCode} -w "${outFile}" "${text.replace(/"/g, '\\"')}"`, {
                    stdio: ['ignore', 'ignore', 'pipe'],
                    timeout: TtsHelper.SYNTH_TIMEOUT_MS,
                });
            } catch (e) {
                throw new Error(`TTS failed: neither espeak nor espeak-ng found. Install espeak-ng: apt install espeak-ng`);
            }
        }
    }

    private static synthesizeMacOS(text: string, voice: string | undefined, outFile: string): void {
        const voiceArg = voice ? `-v ${voice}` : '';
        execSync(`say ${voiceArg} -o "${outFile}" "${text.replace(/"/g, '\\"')}"`, {
            stdio: ['ignore', 'ignore', 'pipe'],
            timeout: TtsHelper.SYNTH_TIMEOUT_MS,
        });
    }
}
