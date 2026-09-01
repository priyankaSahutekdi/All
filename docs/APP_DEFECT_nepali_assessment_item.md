# App defect — one Nepali Discovery assessment item cannot be completed

**Reported:** 2026-09-01 · **Env:** UAT (`https://all-uat.theall.ai`) · **Build:** v3.0.7 · Build #23 · all-3.0.7 · d9aded3
**Area:** Discovery → Assessment 1 (Nepali) · **Severity:** blocks ~50% of Nepali automated runs
**Status:** open — needs an app-side fix; no test-side workaround exists

## Summary

One sentence served by Nepali Discovery Assessment 1 can never be completed. After recording, the
app renders **no Play / Retry / Next control**, so the item cannot be advanced and the assessment
cannot finish. Every other sentence in the same assessment completes normally in the same session.

The item:

```
हामीले पाठशालामा सिकेका राम्रा कुराहरू जीवनमा अप्नाउँछौँ।
```

## Evidence

Assessment 1 draws its sentences from a pool, so whether a run hits this item varies. Across seven
runs on 2026-09-01 the correlation is total:

| runs | outcome |
|---|---|
| 4 that served this sentence | **4 stalled** (100%) |
| 3 that did not serve it | **3 passed** (100%) |

Every stall is on this sentence specifically, and the run recovers on no subsequent attempt — the
same sentence is re-read indefinitely because the app never offers a way forward.

Page content at the stall (full `document.body.innerText`, Nepali run):

```
Guest 0 नेपाली हामीले पाठशालामा सिकेका राम्रा कुराहरू जीवनमा अप्नाउँछौँ। v3.0.7 · Build #23 · …
```

The accessibility snapshot at the same moment shows only the sentence heading and a single
clickable image (the record toggle). There is no Play, no Retry, no Next, and no skip — on a
working item, Play/Retry/Next appear as soon as a recording is accepted.

## What has been ruled out (test-side)

| hypothesis | test | result |
|---|---|---|
| Recording window too short | raised 2500ms → 6840ms (scaled to sentence length) | still stalls |
| No audio being supplied | injected real TTS speech into the mic stream (the mechanism the F-series already uses) | still stalls |
| Audio never reaching the app | same injection makes every OTHER sentence in the same assessment pass | not the cause |
| Missing/incorrect UI translation | the stall is not a matcher failure; the controls are genuinely absent from the DOM | not the cause |

Both a synthetic tone and real synthesized speech fail on this item while succeeding on its
neighbours in the same run, which points at the item's own scoring/content rather than the audio.

## For the app team to check

1. Whether this item's expected-answer / scoring data is present and well-formed. The item never
   accepts any submission, which is consistent with a missing or unmatchable expected value.
2. Whether the string itself is well-formed Nepali. It renders as `अप्नाउँछौँ` (`अ प ् न …`) where
   the more usual spelling is `अपनाउँछौँ`. **We are not Nepali speakers and are not asserting this
   is wrong** — but if the stored text differs from what the scorer expects, that would explain an
   item that can never be satisfied. Worth a native-speaker check.
3. Whether the UI should offer a retry/skip after N failed attempts. Regardless of this item, a
   learner who cannot satisfy a prompt currently has no way to continue.

## Impact

Nepali Discovery gates every downstream level, so roughly half of all Nepali automated runs fail
before reaching F1 — independent of test coverage. Nepali cannot be reported as reliably green
while this item is in the pool. English and Hindi are unaffected.

## Reproduce

```
npm run e2e:full:nepali
```

Re-run until Assessment 1 serves the sentence above (~50% of runs). The suite fails fast with:

> `[Assessment 1] stalled on item N: the sentence has not changed for 3 consecutive recordings …
> the recording was never accepted, so no Play/Retry/Next control rendered.`
