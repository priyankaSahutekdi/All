/**
 * Geometry-based element locators for accessibility in dynamic UIs.
 *
 * These helpers find elements by coordinate/size characteristics when stable
 * selectors (role, text, class) are unavailable. Returned closures are evaluated
 * in a browser context via page.evaluate().
 */

/**
 * Build a closure that finds the round record/stop toggle by geometry.
 * The toggle is a small, roughly-square, horizontally-centred clickable.
 * Returns null if not present.
 */
export function recordToggleCenterClosure(): () => { x: number; y: number } | null {
    return () => {
        let best: { x: number; y: number; w: number } | null = null;
        for (const n of Array.from(document.querySelectorAll('div, button, svg'))) {
            const el = n as HTMLElement;
            const r = el.getBoundingClientRect();
            const cx = r.x + r.width / 2;
            const cy = r.y + r.height / 2;
            if (cx < 590 || cx > 690) continue;
            if (cy < 285 || cy > 410) continue;
            if (r.width < 30 || r.width > 95) continue;
            const ratio = r.height / (r.width || 1);
            if (ratio < 0.6 || ratio > 1.5) continue;
            if (getComputedStyle(el).cursor !== 'pointer') continue;
            if (!best || r.width < best.w) best = { x: cx, y: cy, w: r.width };
        }
        return best ? { x: best.x, y: best.y } : null;
    };
}

/**
 * Build a closure that finds a tab by its visible text.
 * Returns the centre coordinate of the element or null if not found.
 */
export function findTabByTextClosure(text: string): () => { x: number; y: number } | null {
    return () => {
        for (const el of Array.from(document.querySelectorAll('[role="tab"], button'))) {
            if (((el as HTMLElement).innerText || '').trim() === text) {
                const r = (el as HTMLElement).getBoundingClientRect();
                return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
            }
        }
        return null;
    };
}

/**
 * Build a closure that finds a button in the lower-centre area of the screen.
 * Used to locate the "Let's Start" button on the Foundation landing screen.
 * Returns the centre coordinate or null if not found.
 */
export function letsStartButtonClosure(): () => { x: number; y: number } | null {
    return () => {
        for (const n of Array.from(document.querySelectorAll('div, button, svg'))) {
            const el = n as HTMLElement;
            const r = el.getBoundingClientRect();
            const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
            if (cx < 520 || cx > 760 || cy < 380 || cy > 560) continue;
            if (r.width < 80 || r.width > 320 || r.height < 28 || r.height > 90) continue;
            if (getComputedStyle(el).cursor !== 'pointer') continue;
            return { x: cx, y: cy };
        }
        return null;
    };
}
