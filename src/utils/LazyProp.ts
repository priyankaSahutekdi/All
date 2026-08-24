/**
 * Defines `key` on `obj` as a lazily-computed, self-memoizing property: `compute()` runs on
 * first access — which is where a missing-translation throw now happens, instead of at
 * construction — and the getter then replaces itself with the resolved value, so every later
 * read is a plain property access with no re-computation.
 *
 * Exists so a page object's pattern-builder (`foundationPatterns`, `assessmentPatterns`, …) can
 * return an object whose keys are each resolved only if some call site actually reads them,
 * instead of eagerly resolving every key at construction. That eager-everything design meant a
 * language missing even one unused key (e.g. an F2/F3-only key during an F1-only run) could not
 * be constructed at all — confirmed live against Hindi, where `DiscoveryLoginPage`,
 * `AssessmentPage` and `FoundationPage` all threw before the browser navigated anywhere. Making
 * resolution lazy fixes that with ZERO change to any consuming call site: `this.copy.xyz` still
 * means exactly what it means today, just resolved on first read instead of up front.
 *
 * Generic — does not depend on `AppLanguage`/`CopyKey`/`UI_COPY`; it happens to be used
 * exclusively alongside the uiCopy lookup functions today, but the memoization pattern itself
 * is unrelated to copy/translation.
 */
export function lazyProp<V>(obj: object, key: PropertyKey, compute: () => V): void {
    Object.defineProperty(obj, key, {
        configurable: true,
        enumerable: true,
        get() {
            const value = compute();
            Object.defineProperty(obj, key, { value, enumerable: true, configurable: true, writable: false });
            return value;
        },
    });
}
