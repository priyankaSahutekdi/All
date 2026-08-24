import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import { resolveEnvironment } from './config/environments';
import { resolveLanguage } from './config/language';

dotenv.config();

// Resolve the target instance (UAT / LAB / LAB2 / …) from ENV/TEST_ENV/BASE_URL. This is the
// single source of truth for the base URL — tests use page.goto('/') and never hardcode it.
const APP_ENV = resolveEnvironment();
// Resolve the target language from TEST_LANG (default english). Throws on an unknown code
// rather than falling back, so a typo cannot produce a green run in the wrong language.
const APP_LANG = resolveLanguage();
// Expose the resolved name + language + run mode to the custom reporter (it reads these envs).
process.env.TEST_ENV = APP_ENV.name;
process.env.TEST_LANG = APP_LANG.code;
process.env.TEST_MODE = process.env.TEST_MODE || (process.argv.includes('--headed') ? 'headed' : 'headless');
// eslint-disable-next-line no-console
console.log(`\n🌐 Target environment: ${APP_ENV.name}  (${APP_ENV.baseURL})  |  language: ${APP_LANG.code}  |  mode: ${process.env.TEST_MODE}\n`);

export default defineConfig({
    testDir: './src/tests',
    timeout: 120000, // Increased to 2 minutes for complex flows
    expect: { timeout: 15000 }, // Increased expect timeout
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 2 : 3,

    reporter: [
        ['./src/utils/CustomTTAReporter.ts'],
        ['html', { open: 'never' }],
        ['json', { outputFile: 'test-results/results.json' }],
        ['list'],
    ],

    use: {
        baseURL: APP_ENV.baseURL,
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        trace: 'retain-on-failure',
        // Web-optimized settings
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: true,
        acceptDownloads: true,
    },

    projects: [
        // Desktop browsers only - no mobile devices
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1280, height: 720 },
                // Grant + fake the microphone so the assessment recording flow
                // works headlessly without a real audio device or permission prompt.
                permissions: ['microphone'],
                launchOptions: {
                    args: [
                        '--use-fake-device-for-media-stream',
                        '--use-fake-ui-for-media-stream',
                        '--autoplay-policy=no-user-gesture-required',
                        // Stability: avoid the small default shared-memory segment that can
                        // OOM-crash the renderer during long runs (heavy PWA-in-iframe + audio).
                        '--disable-dev-shm-usage',
                    ],
                },
                // NOTE: no `channel: 'chrome'` — Playwright launches its own BUNDLED
                // Chromium (the "test browser"), fully isolated from the user's Google
                // Chrome. Never kill chrome.exe by name (it also matches the user's Chrome);
                // Playwright closes its own browser automatically after each run.
            }
        },
        { 
            name: 'firefox', 
            use: { 
                ...devices['Desktop Firefox'],
                viewport: { width: 1280, height: 720 },
            } 
        },
        { 
            name: 'webkit', 
            use: { 
                ...devices['Desktop Safari'],
                viewport: { width: 1280, height: 720 },
            } 
        },
        // Removed mobile-chrome project for web-only testing
    ],
});

