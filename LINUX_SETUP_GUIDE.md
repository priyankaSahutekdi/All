# Linux Setup & Troubleshooting Guide

## Quick Fix (TL;DR)

If you just got the error `spawnSync powershell ENOENT`, follow these steps:

```bash
cd /home/nd/All-automation/All

# 1. Pull latest code with cross-platform TTS fix
git pull origin feat/neplali

# 2. Recompile TypeScript (this is CRITICAL)
npm run build

# 3. Install espeak-ng
sudo apt-get update
sudo apt-get install -y espeak-ng espeak-ng-data espeak-ng-data-en

# 4. Verify espeak-ng is installed
espeak-ng --version

# 5. Run tests
npm run test
```

---

## Detailed Setup Guide

### Step 1: Update Code & Recompile

```bash
cd /home/nd/All-automation/All

# Pull the feat/neplali branch (has cross-platform TTS fix)
git fetch origin
git checkout feat/neplali
git pull origin feat/neplali

# Verify you have the latest commit
git log --oneline -1
# Should show: "framework: implement cross-platform text-to-speech support"

# CRITICAL: Recompile TypeScript to JavaScript
npm run build

# Verify build succeeded (no errors)
echo "Build status: $?"  # Should be 0
```

### Step 2: Install espeak-ng

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y espeak-ng espeak-ng-data espeak-ng-data-en

# Optional: Install other language data packs
sudo apt-get install -y espeak-ng-data-hi   # Hindi
```

**Fedora/RHEL/CentOS:**
```bash
sudo dnf install espeak-ng espeak-ng-data
```

**Alpine Linux:**
```bash
apk add espeak-ng
```

### Step 3: Verify Installation

```bash
# Check espeak-ng is installed
which espeak-ng
# Should output: /usr/bin/espeak-ng or similar

# Check version
espeak-ng --version
# Should show version info

# Check available voices/languages
espeak-ng --voices | head -20

# Test it manually
espeak-ng -v en "Hello world" -w /tmp/test.wav
ls -lh /tmp/test.wav
# Should be ~10-50KB, not 46 bytes (silence)

# Test Hindi (if you installed Hindi data)
espeak-ng -v hi "नमस्ते" -w /tmp/hindi_test.wav
ls -lh /tmp/hindi_test.wav
```

### Step 4: Run Tests

```bash
# Run all tests
npm run test

# Or run specific test
npm run test -- --grep "TC-014"

# Or run with headed mode (see browser)
npm run test:headed

# English only (fastest)
npm run test -- --grep "english"

# Hindi (requires Hindi data)
TEST_LANG=hindi npm run test -- --grep "hindi"
```

---

## Troubleshooting

### Error: "espeak-ng: command not found"

**Cause**: espeak-ng not installed or not in PATH

**Solution**:
```bash
# Install espeak-ng
sudo apt-get install -y espeak-ng espeak-ng-data

# Verify it's installed
which espeak-ng

# If still not found, try:
sudo apt-get install --reinstall espeak-ng
```

### Error: "spawnSync powershell ENOENT"

**Cause**: Old compiled JavaScript still in `dist/` folder

**Solution**:
```bash
# Clean and rebuild
rm -rf dist/
npm run build

# Verify build succeeded
npm run build 2>&1 | tail -5
```

### Error: "TTS synthesis failed for 'Egg'"

**Cause**: espeak-ng not installed or available

**Solution**:
```bash
# Step 1: Verify espeak-ng is installed
espeak-ng --version

# If not found, install it
sudo apt-get install -y espeak-ng espeak-ng-data

# Step 2: Test espeak-ng manually
espeak-ng -v en "Egg" -w /tmp/test_egg.wav
ls -lh /tmp/test_egg.wav

# Should be ~20-50KB, not 46 bytes
if [ $(stat -f%z /tmp/test_egg.wav 2>/dev/null || stat -c%s /tmp/test_egg.wav) -lt 1000 ]; then
    echo "ERROR: WAV is too small, espeak-ng may not be working"
else
    echo "OK: espeak-ng is working"
fi
```

### Error: "WAV file is 46 bytes (silence)"

**Cause**: espeak-ng ran but produced no audio

**Possible reasons**:
- espeak-ng not installed properly
- Language data missing
- Invalid language code

**Solution**:
```bash
# Test espeak-ng with English
espeak-ng -v en "test" -w /tmp/test.wav

# Test with the exact language
espeak-ng -v en "Egg" -w /tmp/egg.wav
file /tmp/egg.wav

# If still 46 bytes, reinstall:
sudo apt-get remove espeak-ng espeak-ng-data
sudo apt-get install espeak-ng espeak-ng-data
```

### Error: "TTS produced N bytes for 'word' — that is silence"

**Cause**: The word produced a WAV file under 1000 bytes

**Solution**:
```bash
# 1. Verify espeak-ng works with the same word
espeak-ng -v en "word" -w /tmp/test_word.wav
stat -c%s /tmp/test_word.wav   # Show file size

# 2. If under 1000 bytes, espeak-ng may have an issue
# Try reinstalling language data:
sudo apt-get install --reinstall espeak-ng-data

# 3. If still failing, check espeak-ng installation:
espeak-ng --voices | grep -i en
```

---

## Verification Checklist

Run this to verify your Linux setup:

```bash
#!/bin/bash
echo "=== Linux TTS Setup Verification ==="

# 1. Check Node.js
echo "✓ Node version:"
node --version

# 2. Check npm
echo "✓ npm version:"
npm --version

# 3. Check espeak-ng
echo "✓ espeak-ng:"
which espeak-ng || echo "  NOT FOUND - install with: sudo apt-get install espeak-ng"

# 4. Check espeak-ng version
echo "✓ espeak-ng version:"
espeak-ng --version || echo "  FAILED"

# 5. Test espeak-ng manually
echo "✓ Testing espeak-ng with 'Hello':"
espeak-ng -v en "Hello" -w /tmp/tts_test.wav 2>/dev/null
SIZE=$(stat -c%s /tmp/test.wav 2>/dev/null || echo "0")
if [ "$SIZE" -gt 1000 ]; then
    echo "  OK - Generated $SIZE bytes"
else
    echo "  FAILED - Only $SIZE bytes (should be >1000)"
fi

# 6. Check git branch
echo "✓ Current branch:"
git rev-parse --abbrev-ref HEAD

# 7. Check latest commit
echo "✓ Latest commit:"
git log --oneline -1

# 8. Check if build artifacts exist
echo "✓ Build artifacts:"
if [ -f "dist/utils/TtsHelper.js" ]; then
    echo "  Found (OK)"
else
    echo "  NOT FOUND - run: npm run build"
fi

# 9. Verify TtsHelper.js contains Linux code
echo "✓ Checking TtsHelper.js for Linux support:"
if grep -q "espeak-ng" dist/utils/TtsHelper.js 2>/dev/null; then
    echo "  Found espeak-ng support (OK)"
else
    echo "  NOT FOUND - may need to rebuild"
fi

echo ""
echo "=== Verification Complete ==="
```

---

## Running Tests on Linux

### Basic Test Run

```bash
# Run the failing test (TC-014)
npm run test -- --grep "TC-014"

# Expected: Should now PASS (not fail with powershell error)
```

### Full Test Suite

```bash
# Run all tests
npm run test

# Run regression suite
node scripts/run-e2e.js --regression

# Run with specific language
TEST_LANG=hindi node scripts/run-e2e.js --regression

# Run specific test file
npm run test -- src/tests/discovery/foundation-f1.spec.ts
```

### Debug Mode

```bash
# Show more details
npm run test -- --grep "TC-014" --reporter=list

# Debug with headed browser
npm run test:headed -- --grep "TC-014"

# Show trace logs
npm run test -- --grep "TC-014" --trace on
```

---

## Common Commands Reference

```bash
# Update code
git pull origin feat/neplali

# Rebuild
npm run build

# Install dependencies
npm install

# Run tests
npm run test

# Run specific test
npm run test -- --grep "TC-014"

# View test reports
npm run test:report

# Check what would be built
npm run build 2>&1 | grep -i error

# Check if espeak-ng works
espeak-ng -v en "test" -w /tmp/test.wav && file /tmp/test.wav
```

---

## Expected Behavior After Fix

### Before (Error):
```
Error: TTS synthesis failed for "Egg"
spawnSync powershell ENOENT
```

### After (Success):
```
✓ TC-014 (F1): Complete L1 Letter Train → land on P1
```

---

## Getting Help

If you're still having issues after following this guide:

1. **Run the verification checklist above** (the bash script)
2. **Share the output** of these commands:
   ```bash
   espeak-ng --version
   npm run build 2>&1 | tail -20
   npm run test -- --grep "TC-014" 2>&1 | head -50
   ```
3. **Check the error logs**: `test-results/` folder

---

## Key Points to Remember

⚠️ **CRITICAL**: After pulling code, always run `npm run build` to recompile TypeScript

✅ **Verify**: espeak-ng is installed with `which espeak-ng`

✅ **Test Manually**: `espeak-ng -v en "test" -w /tmp/test.wav` should create a non-empty WAV

✅ **Language Code**: For English use `en`, not `english`

✅ **Clear Cache**: If issues persist, clear `/tmp/tts_*.wav` files and re-run tests
