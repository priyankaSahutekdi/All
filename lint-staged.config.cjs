/**
 * lint-staged configuration.
 *
 * A .cjs file rather than the previous `.lintstagedrc` JSON so this rationale can live next to
 * the rules — and because a JSON config cannot hold a comment: a `"//"` key in it is parsed as a
 * GLOB PATTERN, and lint-staged duly reports it as a task matching 0 files.
 *
 * ESLINT ONLY, AND IT ONLY REPORTS.
 *
 * The previous config ran `eslint --fix` and `prettier --write`, which silently rewrites staged
 * files at commit time. A hook that edits your commit behind your back is worse than one that
 * tells you what is wrong and lets you decide, so the fix flags are gone — `npm run lint:fix` is
 * still there when the fixes are wanted.
 *
 * Prettier is NOT run here, in either direction. It has never actually been applied to this
 * repo: 31 of the TypeScript sources and 42 of the 44 tracked json/md/yml files differ from what
 * prettier would produce (`npm run format:check` fails today). So `--write` would mean a
 * repo-wide reformat smuggled in through whichever file you happened to stage, and `--check`
 * would block essentially every commit. Adopting prettier is a real decision with a real diff —
 * it belongs in its own change, not in a hook. The `format` / `format:check` scripts remain for
 * when that happens.
 */
module.exports = {
    'src/**/*.ts': ['eslint'],
    // Harvest placeholders must never reach a commit. They were committed three times in one
    // session despite a runtime guard, because that guard stops them being USED, not COMMITTED.
    // See scripts/check-no-placeholders.js for why a quiet placeholder is worse than a loud one.
    'src/**/*.{ts,json}': ['node scripts/check-no-placeholders.js'],
    // A level-exit marker that also matches copy shown DURING the level ends the level early
    // and still reports a PASS. That hid ~60% of Hindi F3 for a month; see the script's header.
    'src/utils/UiCopyData.ts': ['node scripts/check-copy-collisions.js'],
};
