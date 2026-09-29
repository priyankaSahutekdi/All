# Cross-Platform Text-to-Speech (TTS) Configuration

## Overview

The test automation framework uses Text-to-Speech synthesis for "say the word" recording assessments. The implementation automatically detects the operating system and uses the appropriate TTS backend:

- **Windows**: Windows SAPI5 via PowerShell
- **Linux**: espeak/espeak-ng command-line tool
- **macOS**: Built-in `say` command

## Platform-Specific Setup

### Windows

**Default Behavior**: Works out-of-the-box with Microsoft David/Zira voices (en-US) included in Windows.

**For Hindi & Nepali Support**:
1. Install a Hindi SAPI5 voice (e.g., Kalpana/Hemant for Hindi)
2. The voice must be properly registered in the Windows Speech Registry
3. Update `VOICE_CONFIG` in [src/utils/TtsHelper.ts](../src/utils/TtsHelper.ts) if using a different culture code

**Verification**:
```powershell
powershell -NoProfile -NonInteractive -Command {
    Add-Type -AssemblyName System.Speech
    $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $s.GetInstalledVoices() | ForEach-Object { Write-Host $_.VoiceInfo.Name, $_.VoiceInfo.Culture.Name }
}
```

### Linux

**Install espeak-ng** (recommended over espeak):
```bash
# Debian/Ubuntu
sudo apt update
sudo apt install espeak-ng

# Fedora/RHEL
sudo dnf install espeak-ng

# Arch
sudo pacman -S espeak-ng

# Alpine
apk add espeak-ng
```

**Install Language Data** (if not included):
```bash
# For English (usually default)
sudo apt install espeak-ng-data

# For specific languages
sudo apt install espeak-ng-data-{lang}
```

**Verification**:
```bash
espeak-ng --voices | grep -E "^  hi|^  en"
```

**Language Codes** (espeak format):
- `en` - English (default)
- `hi` - Hindi
- `hi` - Nepali (falls back to Hindi, uses Devanagari script)

**Implementation Note**: The TtsHelper.synthesizeLinux() method tries `espeak` first, then falls back to `espeak-ng`. Both tools accept the same `-v` (voice/language) and `-w` (output file) arguments.

### macOS

**Built-in Support**: The `say` command is included in macOS and requires no additional installation.

**Available Voices**:
```bash
say -v ? | head -20
```

**For Hindi & Nepali**: macOS has limited Devanagari voice support. The fallback uses `Samantha` voice, which will produce English-accented speech. For better results:
1. Install third-party Devanagari voices if available
2. Update `VOICE_CONFIG` in [src/utils/TtsHelper.ts](../src/utils/TtsHelper.ts) with the voice name

**Verification**:
```bash
say -v Samantha "Hello world" -o /tmp/test.wav
```

## CI/CD Integration

### GitHub Actions Configuration

For **self-hosted Windows runner**:
```yaml
- name: Install Hindi voice (Windows)
  if: runner.os == 'Windows'
  run: |
    # Add script to install SAPI5 Hindi voice if needed
    # Voices may be pre-installed on your runner image
```

For **Linux runner**:
```yaml
- name: Install TTS dependencies (Linux)
  if: runner.os == 'Linux'
  run: |
    sudo apt update
    sudo apt install -y espeak-ng espeak-ng-data
```

For **macOS runner**:
```yaml
# No installation needed; say command is built-in
- name: Verify TTS (macOS)
  if: runner.os == 'macOS'
  run: say -v Samantha "test" -o /tmp/test.wav
```

### Docker Integration

**Dockerfile example for Linux**:
```dockerfile
FROM node:18-bullseye

RUN apt-get update && apt-get install -y \
    espeak-ng \
    espeak-ng-data \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
RUN npm install

CMD ["npm", "run", "test"]
```

## Language Configuration

The `VOICE_CONFIG` object in [src/utils/TtsHelper.ts](../src/utils/TtsHelper.ts) maps languages to platform-specific voice identifiers:

```typescript
const VOICE_CONFIG: Partial<Record<string, Record<OSType, string>>> = {
    hindi: {
        win32: 'hi-IN',      // SAPI5 culture code
        linux: 'hi',         // espeak language code
        darwin: 'Samantha',  // macOS voice name
    },
    nepali: {
        win32: 'hi-IN',      // No dedicated Nepali voice; use Hindi
        linux: 'hi',         // espeak doesn't have Nepali; use Hindi
        darwin: 'Samantha',  // Uses Hindi voice as fallback
    },
};
```

**Adding New Languages**:
1. Add a new entry to `VOICE_CONFIG`
2. Specify the appropriate identifier for each platform
3. Ensure the voice/language is installed on target systems
4. Test with the language before committing

## Troubleshooting

### "TTS synthesis failed" Error

**Windows**: 
- Verify PowerShell is accessible: `powershell -Command "Write-Host 'OK'"`
- Check SAPI5 voice installation with the verification command above
- Ensure the culture code in `VOICE_CONFIG` matches an installed voice

**Linux**:
- Verify espeak-ng is installed: `which espeak-ng`
- Check language support: `espeak-ng --voices | grep hi`
- Install missing language data: `sudo apt install espeak-ng-data-{lang}`

**macOS**:
- Verify `say` command works: `say "test"`
- List available voices: `say -v ?`
- Check output directory is writable: `ls -la /tmp/`

### "No installed voice for culture" Error

This occurs when the language-specific voice is not installed. Solutions:
1. Install the required voice on the system
2. Verify the culture/language code in `VOICE_CONFIG`
3. Fall back to English (remove the language mapping entry)

### Silent Audio (46-byte WAV)

This indicates the TTS backend ran but produced no actual speech:
- **Windows**: The installed voice cannot speak the target script (e.g., en-US voice given Devanagari text)
- **Linux**: espeak may not have the language data installed
- **macOS**: The selected voice may not support the script

Solution: Install an appropriate voice that supports the language script.

## Development & Testing

### Local Testing

Test TTS with different languages:
```bash
# English
npm run test -- --grep "english" --headed

# Hindi (requires hi-IN voice on Windows, espeak-ng on Linux)
TEST_LANG=hindi npm run test -- --grep "hindi" --headed

# Nepali
TEST_LANG=nepali npm run test -- --grep "nepali" --headed
```

### Unit Testing TtsHelper

To test the cross-platform implementation directly:
```typescript
import { TtsHelper } from './utils/TtsHelper';

const wav = TtsHelper.generateWavBase64("अनार"); // Hindi word
console.log(`Generated ${Buffer.from(wav, 'base64').length} bytes`);
```

## Performance Notes

- WAV files are cached per word, so synthesis happens only once per test run
- Typical synthesis time: 100-500ms per word
- Timeout is set to 20 seconds to catch hung processes
- Base64 encoding adds ~33% overhead to WAV size

## See Also

- [LANGUAGE_ONBOARDING.md](./LANGUAGE_ONBOARDING.md) - Language-specific setup guide
- [src/utils/TtsHelper.ts](../src/utils/TtsHelper.ts) - Implementation details
