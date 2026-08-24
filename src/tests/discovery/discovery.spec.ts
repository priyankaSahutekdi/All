import { test, expect } from '../../fixtures/appTest';
import { runDiscoveryFlow } from '../../utils/DiscoveryFlow';

/**
 * Discovery onboarding + assessments — TC-001 → TC-012 — executed in a SINGLE browser session
 * with a SINGLE login (DiscoveryFullFlow.csv / Discovery sheet).
 *   TC-001..TC-011  Discovery onboarding + assessments 1, 2 and Letter Hunt demo skip
 *   TC-012          Fail the Letter Hunt → reach the discovery result/placement screen
 *
 * F1 (TC-013 onward) is a separate spec, `foundation-f1.spec.ts` — there is no parked F1
 * account to resume from, so it re-runs this same flow (via `runDiscoveryFlow`) as its own
 * precondition rather than continuing in this file's session.
 */
test.describe('@P0 @Smoke @Discovery Discovery E2E (single session, single login)', () => {
    test('TC-001 to TC-012: discovery flow to the placement/result screen', async ({ page, discoveryData, lang }) => {
        test.setTimeout(30 * 60 * 1000); // up to 30 min (two assessments + Letter Hunt)

        const user = await runDiscoveryFlow(page, lang, discoveryData);
        expect(user).toBeDefined();
    });
});
