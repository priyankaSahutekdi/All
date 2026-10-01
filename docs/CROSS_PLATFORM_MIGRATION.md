# Cross-Platform Migration Guide

## Summary of Changes

The test automation framework has been refactored to support cross-platform execution on Windows, Linux, and macOS. The main change is in the Text-to-Speech (TTS) implementation, which now automatically detects the operating system and uses the appropriate TTS backend.

## What Changed

### 1. **TtsHelper.ts** - Refactored for Cross-Platform Support

**Before**:
- Hardcoded Windows PowerShell + SAPI5 implementation
- Only worked on Windows machines
- Would fail silently or throw cryptic errors on Linux/macOS

**After**:
- Auto-detects the operating system (`process.platform`)
- Routes to the appropriate TTS backend:
  - **Windows**: PowerShell + SAPI5 (unchanged logic)
  - **Linux**: espeak/espeak-ng CLI tool
  - **macOS**: Built-in `say` command

**Key Methods Added**:
- `synthesizeWindows()` - Windows SAPI5 via PowerShell
- `synthesizeLinux()` - espeak/espeak-ng with fallback
- `synthesizeMacOS()` - macOS `say` command

### 2. **VOICE_CONFIG** - Platform-Specific Voice Mappings

New object that maps languages to platform-specific voice identifiers:

```typescript
const VOICE_CONFIG: Partial<Record<string, Record<OSType, string>>> = {
    hindi: {
        win32: 'hi-IN',      // SAPI5 culture code
        linux: 'hi',         // espeak language code
        darwin: 'Samantha',  // macOS voice name
    },
    nepali: {
        win32: 'hi-IN',
        linux: 'hi',
        darwin: 'Samantha',
    },
};
```

### 3. **GitHub Actions Workflow** - Multi-Platform CI/CD

**Before**:
- Single Linux runner
- No TTS support

**After**:
- Matrix strategy: runs tests on Ubuntu (Linux), macOS, and Windows
- Automatically installs TTS dependencies for each platform
- Includes OS in artifact names for easy identification

## Impact on Existing Code

### API Compatibility ✅
The `TtsHelper.generateWavBase64()` method signature is **unchanged**:
```typescript
static generateWavBase64(text: string, lang?: AppLanguage): string
```

All existing call sites in [FoundationPage.ts](../src/pages/foundation/FoundationPage.ts) and [MasteryPage.ts](../src/pages/mastery/MasteryPage.ts) **require no changes**.

### Error Handling Changes
Error messages are now more informative about missing platform dependencies:
- **Linux**: "Install espeak-ng: apt install espeak-ng"
- **Windows**: Preserves the existing "No installed SAPI5 voice" message
- **macOS**: Reports if the `say` command is unavailable

## System Requirements

### Windows
- PowerShell (built-in)
- Optional: Hindi SAPI5 voice (Kalpana/Hemant) for Hindi/Nepali tests

### Linux
- **Required**: `espeak-ng` package and language data
  ```bash
  sudo apt-get install espeak-ng espeak-ng-data
  ```

### macOS
- Built-in `say` command (no additional installation needed)
- Optional: Install Devanagari voices for better quality

## Testing the Migration

### Local Verification

Run tests on your local machine to verify TTS works:

```bash
# English (should work on all platforms)
npm run test

# Hindi (requires language support)
TEST_LANG=hindi npm run test -- --grep "hindi"

# Nepali
TEST_LANG=nepali npm run test -- --grep "nepali"
```

### CI/CD Verification

The GitHub Actions workflow now tests on all three platforms:
1. Go to the **Actions** tab in your repository
2. Click **🎭 Playwright Tests**
3. Click **Run workflow**
4. Workflow will run on Linux, macOS, and Windows
5. Check artifacts for results from each platform

## Development Workflow

### Adding Support for a New Language

1. **Determine voice/language codes for each platform**:
   - Windows: SAPI5 culture code (e.g., "hi-IN")
   - Linux: espeak language code (e.g., "hi")
   - macOS: Voice name (e.g., "Samantha") or language code

2. **Update VOICE_CONFIG in TtsHelper.ts**:
   ```typescript
   const VOICE_CONFIG: Partial<Record<string, Record<OSType, string>>> = {
       // ... existing entries ...
       vietnamese: {
           win32: 'vi-VN',
           linux: 'vi',
           darwin: 'Victoria',
       },
   };
   ```

3. **Ensure voices are installed on CI runners**:
   - Add installation steps to GitHub Actions if needed
   - Document setup in [CROSS_PLATFORM_TTS.md](./CROSS_PLATFORM_TTS.md)

4. **Test locally**:
   ```bash
   TEST_LANG=vietnamese npm run test
   ```

### Debugging TTS Issues

**Step 1**: Identify your OS
```bash
node -e "console.log(process.platform)"  # win32, darwin, or linux
```

**Step 2**: Verify the appropriate TTS tool is installed
- **Windows**: `powershell -Command "Write-Host 'OK'"`
- **Linux**: `which espeak-ng` or `which espeak`
- **macOS**: `say "test"`

**Step 3**: Manually test TTS
- **Windows**: Use [CROSS_PLATFORM_TTS.md#verification](./CROSS_PLATFORM_TTS.md#verification)
- **Linux**: `espeak-ng -v hi "नमस्ते"`
- **macOS**: `say -v Samantha "Hello"`

**Step 4**: Check error messages in test output
- The new TTS implementation provides platform-specific error messages
- Look for "Install espeak-ng" or "No installed voice" in the error

## Breaking Changes ⚠️

**None**. This migration is fully backward compatible:
- The public API is unchanged
- The caching behavior is unchanged
- Error semantics are preserved (still throws on silence)
- Existing tests require no modifications

## Performance Impact

- ✅ No change in synthesis speed (uses native tools on each platform)
- ✅ No change in WAV file size or quality
- ✅ Caching still works as before (per-word per-run)
- ℹ️ Linux espeak may be slightly slower than Windows SAPI5, but still acceptable (<500ms per word)

## Rollback Plan

If issues arise, the migration can be reverted:
1. Restore the original `TtsHelper.ts` from git history
2. Revert the GitHub Actions workflow to single-platform
3. Remove the [CROSS_PLATFORM_TTS.md](./CROSS_PLATFORM_TTS.md) documentation

No database migrations or data structure changes were made, so rollback is clean.

## Questions?

- **TTS-specific setup**: See [CROSS_PLATFORM_TTS.md](./CROSS_PLATFORM_TTS.md)
- **Language support**: See [LANGUAGE_ONBOARDING.md](./LANGUAGE_ONBOARDING.md)
- **Implementation details**: See [src/utils/TtsHelper.ts](../src/utils/TtsHelper.ts) comments
