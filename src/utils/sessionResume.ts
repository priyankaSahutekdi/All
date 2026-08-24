import { Page } from '@playwright/test';
import { DiscoveryLoginPage } from '../pages/discovery/DiscoveryLoginPage';
import { FoundationPage } from '../pages/foundation/FoundationPage';
import { AppLanguage } from './languages';

/**
 * Resume a persistent, parked test account (`Testf2auto`, `Testf3auto`, `m4auto`, …) on its
 * saved journey. Every F2/F3/M4/M4-S1 spec re-implemented this sequence — login, an optional
 * "Skip" mic-calibration screen, an account-specific audio hook, switching the app language,
 * dismissing coachmarks — so a Hindi spec would otherwise mean five more copies, not one.
 *
 * The four existing call sites do NOT share one exact sequence — confirmed by reading all four
 * before writing this, not assumed:
 *   - F2/F3 wait 6s then check for a "Skip" button (timeout 10s, then a 4s settle); M4/M4-S1
 *     have no such screen and skip the check entirely.
 *   - F3 installs its audio-recovery hook AFTER the 6s wait but BEFORE the Skip check; M4
 *     installs its own hook immediately after login, before anything else.
 *   - M4-S1 swallows a `switchToLanguage` failure (`.catch(() => {})`); F2/F3/M4 let it
 *     propagate and fail the step.
 * `ResumeOptions` parameterizes exactly these four axes so each call site's existing behavior
 * is reproducible byte-for-byte — this is a relocation of the code, not a behavior change.
 */
export interface ResumeOptions {
    /** Credentials for the parked account. */
    username: string;
    password: string;
    /**
     * The account's own "Skip" mic-calibration screen, or `false` if it doesn't show one
     * (m4auto/M4-S1 today). F2/F3 both use `{ preWaitMs: 6000, timeoutMs: 10000, postWaitMs: 4000 }`.
     */
    micSkip: false | { preWaitMs: number; timeoutMs: number; postWaitMs: number };
    /**
     * An account-specific hook that must be installed before the resumed screen's audio
     * preloads (F3's Letter Launcher hook, M4's read-aloud mic injection). Runs AFTER the
     * `preWaitMs` settle but BEFORE the Skip check, matching where F3 already placed it.
     */
    beforeSkipCheck?: () => Promise<void>;
    /** Target language (default 'english' — every current parked account resumes in English). */
    lang?: string | AppLanguage;
    /** M4-S1 swallows a switchToLanguage failure instead of letting it fail the step. */
    ignoreLanguageSwitchErrors?: boolean;
}

/** Navigate, log in as a parked account, and resume it in the target language. */
export async function resumeParkedAccount(
    page: Page,
    foundation: FoundationPage,
    opts: ResumeOptions,
): Promise<void> {
    const login = new DiscoveryLoginPage(page);
    await login.navigate();
    await login.login(opts.username, opts.password);

    if (opts.micSkip) {
        await page.waitForTimeout(opts.micSkip.preWaitMs);
    }
    if (opts.beforeSkipCheck) {
        await opts.beforeSkipCheck();
    }
    if (opts.micSkip) {
        const skip = page.getByRole('button', { name: /^Skip$/i }).first();
        if (await skip.isVisible({ timeout: opts.micSkip.timeoutMs }).catch(() => false)) {
            await skip.click({ force: true });
            await page.waitForTimeout(opts.micSkip.postWaitMs);
        }
    }

    const switchLanguage = (): Promise<void> => foundation.switchToLanguage(opts.lang ?? 'english');
    if (opts.ignoreLanguageSwitchErrors) {
        await switchLanguage().catch(() => {});
    } else {
        await switchLanguage();
    }
    await foundation.dismissCoachmarks().catch(() => {});
}
