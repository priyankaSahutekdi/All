/**
 * Commitlint Configuration
 *
 * Format: type(scope): description
 *
 * The type list below is THIS REPO'S convention, not the generic conventional-commits set.
 * That matters: the previous list was the stock feat/fix/refactor/chore/... enum, which does
 * not contain `config`, `utility` or `framework` — three of the six types actually used in this
 * repo's history. Had the hook layer ever been installed, it would have rejected the team's own
 * commits on day one. Verified against `git log`: every existing commit's type is in the list
 * below, and `config`/`utility`/`framework` were all rejected by the old one.
 *
 * Examples (real commits from this repo):
 *   config: add TEST_LANG selection axis (resolveLanguage, --lang flag)
 *   utility: add runtime language-aware test-data loader and fixtures
 *   test: switch specs to language-aware fixtures instead of static imports
 *   docs: add Hindi readiness task-wise action plan
 */

module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
        // Type must be one of the following — this repo's categories, in use since eda82c6.
        'type-enum': [
            2,
            'always',
            [
                'config',    // Config, CI/CD, build and tooling changes
                'utility',   // Shared helpers, page objects, reporters — the framework's internals
                'test',      // Adding or updating specs
                'docs',      // Documentation only
                'framework', // Structural changes to the framework's shape (rare)
                'feat',      // New capability (used by the initial commit)
                'revert',    // Revert a previous commit
            ],
        ],
        // Type must be lowercase
        'type-case': [2, 'always', 'lower-case'],
        // Type cannot be empty
        'type-empty': [2, 'never'],
        // Subject cannot be empty
        'subject-empty': [2, 'never'],
        // Subject must not end with period
        'subject-full-stop': [2, 'never', '.'],
        // Header max length
        'header-max-length': [2, 'always', 100],
        // Body max line length
        'body-max-line-length': [2, 'always', 200],
    },
};

