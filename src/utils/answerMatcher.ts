/**
 * Match a free-text answer (e.g. from a vision model) to one of the on-screen options.
 *
 * The model is asked to reply verbatim, but real replies vary ("In the tree", "the tree",
 * "tree", "In the tree."). This normalises both sides and scores them so the flow does not
 * depend on an exact string. Pure + provider-agnostic → unit-testable and reusable for any
 * image/text multiple-choice activity (M4–M9).
 */
import { normalizeText as normalize } from './text';

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

/**
 * Pick the option that best matches `answer`. Strategy (highest wins):
 *   1.0  exact normalized equality
 *   0.9  one string fully contains the other (normalized)
 *   0..0.8  Jaccard overlap of content tokens (stopwords removed)
 * Returns null if nothing scores above `min` (default 0.3) — the caller treats that as
 * "vision answer unusable" rather than guessing.
 */
export function matchOption(answer: string, options: string[], min = 0.3): OptionMatch | null {
    const a = normalize(answer);
    const at = tokens(answer);
    let bestIndex = -1;
    let bestScore = -1;

    options.forEach((option, index) => {
        const o = normalize(option);
        let score: number;
        if (a && o && a === o) {
            score = 1;
        } else if (a && o && (a.includes(o) || o.includes(a))) {
            score = 0.9;
        } else {
            const ot = tokens(option);
            const setA = new Set(at);
            const inter = ot.filter((w) => setA.has(w)).length;
            const union = new Set([...at, ...ot]).size || 1;
            score = (inter / union) * 0.8;
        }
        if (score > bestScore) { bestScore = score; bestIndex = index; }
    });

    if (bestIndex < 0 || bestScore < min) return null;
    return { index: bestIndex, option: options[bestIndex], score: bestScore };
}
