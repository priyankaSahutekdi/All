/**
 * Match a free-text answer (e.g. from a vision model) to one of the on-screen options.
 *
 * The model is asked to reply verbatim, but real replies vary ("In the tree", "the tree",
 * "tree", "In the tree."). This normalises both sides and scores them so the flow does not
 * depend on an exact string. Pure + provider-agnostic → unit-testable and reusable for any
 * image/text multiple-choice activity (M4–M9).
 */
import { normalizeText as normalize } from './Text';

export interface OptionMatch {
    index: number;
    option: string;
    score: number;   // 0..1 confidence of the match
}

// English function words, removed before the token-overlap score so "in the tree" and
// "tree" still match. Purely additive per language: a script whose stopwords are not
// listed just keeps all its tokens, which costs a little precision but never blocks a
// match (unlike a character class, which would drop the words entirely).
const STOP = new Set(['a', 'an', 'the', 'is', 'are', 'in', 'on', 'at', 'of', 'to', 'it', 'this', 'that']);
function tokens(s: string): string[] {
    return normalize(s).split(' ').filter((w) => w && !STOP.has(w));
}

/** Jaccard overlap of content tokens, scaled into 0..0.8. */
function tokenOverlap(answerTokens: string[], option: string): number {
    const ot = tokens(option);
    const setA = new Set(answerTokens);
    const inter = ot.filter((w) => setA.has(w)).length;
    const union = new Set([...answerTokens, ...ot]).size || 1;
    return (inter / union) * 0.8;
}

/**
 * How good a containment match is, scaled by how much of the longer string the shorter one
 * actually covers: 0.5 (a sliver) … 0.9 (nearly the whole string).
 *
 * This replaces a flat 0.9 for ANY containment, which was wrong in a way that silently picked
 * the wrong answer rather than failing: every mutual substring scored identically, so
 * `matchOption('the tree', ['e', 'tree'])` scored both at 0.9 and the earliest index won —
 * returning 'e'. Scoring by coverage makes 'tree' (0.7) beat 'e' (0.55) and, because the score
 * now depends only on the strings, makes the result independent of the order the options are
 * listed in. Short options are where this bites, so it gets worse the shorter the vocabulary:
 * single letters, and the one- and two-syllable postpositions of an Indic language.
 *
 * The floor of 0.5 is deliberate: it sits above the default `min` of 0.3, so no answer that
 * matched by containment before can now fail to match at all — the fix only re-ranks
 * candidates, it never turns a match into a null.
 */
function containment(a: string, o: string): number {
    if (!a.includes(o) && !o.includes(a)) return 0;
    return 0.5 + 0.4 * (Math.min(a.length, o.length) / Math.max(a.length, o.length));
}

/**
 * Pick the option that best matches `answer`. Strategy (highest wins):
 *   1.0      exact normalized equality
 *   0.5..0.9 one string fully contains the other, scaled by how much of it is covered
 *   0..0.8   Jaccard overlap of content tokens (stopwords removed)
 * A containment candidate also gets its token-overlap score and keeps the better of the two;
 * previously containment short-circuited the token score, so a weak containment could hide a
 * strong token match.
 *
 * Returns null if nothing scores above `min` (default 0.3) — the caller treats that as
 * "vision answer unusable" rather than guessing.
 *
 * Ties are broken on containment coverage, then on the earliest index. The second tie-breaker
 * is needed because token overlap SATURATES: 'mat' and 'the mat' both share every content token
 * with "on the mat" (stopwords are removed), so both score exactly 0.8 and, without the coverage
 * key, whichever was listed first won — order deciding the answer to a multiple-choice question.
 * Coverage picks 'the mat', which is the one that matches more of what was said. Only options
 * that tie on BOTH keys — genuinely indistinguishable — fall through to the earliest index.
 */
export function matchOption(answer: string, options: string[], min = 0.3): OptionMatch | null {
    const a = normalize(answer);
    const at = tokens(answer);
    let bestIndex = -1;
    let bestScore = -1;
    let bestCoverage = -1;

    options.forEach((option, index) => {
        const o = normalize(option);
        let score: number;
        let coverage = 0;
        if (!a || !o) {
            score = 0;
        } else if (a === o) {
            score = 1;
            coverage = 1;
        } else {
            coverage = containment(a, o);
            score = Math.max(coverage, tokenOverlap(at, option));
        }
        if (score > bestScore || (score === bestScore && coverage > bestCoverage)) {
            bestScore = score;
            bestCoverage = coverage;
            bestIndex = index;
        }
    });

    if (bestIndex < 0 || bestScore < min) return null;
    return { index: bestIndex, option: options[bestIndex], score: bestScore };
}
