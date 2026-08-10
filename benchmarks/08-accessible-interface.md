# Accessible Interface

Build the booking interface for a small independent cinema, to **WCAG 2.2 Level AA** — all of it, not the parts that are convenient.

The flow: pick a screening, choose seats from a seat map, enter details, review, confirm. One page, one file, no page loads. The seat map is the crux of this task — it is the widget that is almost always an accessibility disaster in the wild, and it is where this brief will be won or lost.

This is not a "make it accessible" veneer over a finished design. Accessibility is the specification. It is also not an excuse for an ugly page: a compliant page that looks like a government form scores badly. The best answer is a page a sighted mouse user would enjoy and a blind keyboard user could complete unaided, with no separate "accessible version" and no compromise visible in either direction.

## Requirements

- **Native first.** Use the HTML element that already does the job. ARIA is a last resort for patterns HTML cannot express, and every `role` you add is a promise you must then keep in full. Sprayed ARIA over `<div>` soup scores worse than no ARIA at all.
- **The seat map.** A two-dimensional grid, navigable with arrow keys under a single tab stop (roving tabindex or equivalent). Every seat exposes an accessible name carrying row, number, price band, and availability. Availability, price band, and selection must never be conveyed by colour alone. Home/End, PageUp/PageDown, and a way to skip a whole row are expected, not optional.
- **Focus management.** Visible focus indicators that satisfy focus appearance and are not obscured by sticky headers or the seat map's own scroll container. Focus moves deliberately on step change, moves into dialogs, is trapped only inside modal dialogs, escapes on `Escape`, and returns to the invoking control on close. Background content inert while a dialog is open.
- **Forms done properly.** Programmatic labels, correct `autocomplete` tokens, input purposes identified, errors identified in text and associated with their field, suggestions offered where a fix is knowable, and no validation that fires only on blur and leaves a keyboard user guessing. Do not use redundant entry where the answer is already known.
- **Announce state changes.** Seat selection, running total, step transitions, validation summaries, and any pending state must reach a screen reader. Choose `polite` or `assertive` per case and be able to justify the choice. Do not announce everything.
- **Reflow and zoom.** Usable at 320px wide with no two-dimensional scrolling, and at 400% zoom. Survives a user stylesheet overriding text spacing without clipping or overlap.
- **Contrast and targets.** 4.5:1 for text, 3:1 for UI components and meaningful graphics — including seat states against each other and against the auditorium background. Interactive targets meet the 2.2 minimum size, with adequate spacing.
- **Motion and preference.** Honour `prefers-reduced-motion` and `prefers-contrast`. No motion that cannot be stopped. Nothing that flashes.
- **Structure.** One `h1`, correct heading order, landmark regions, a skip link that works, page `title` reflecting the current step, `lang` set.
- **No keyboard trap anywhere except an intentional, escapable modal.** No positive `tabindex`. No `outline: none` without a replacement.

## What is being evaluated

Zero automated violations is the floor, not the score — an axe or Lighthouse pass is trivially achievable by a page that is unusable in practice. The score comes from a keyboard-only walkthrough and a screen reader walkthrough, completed end to end without a mouse and without guessing.

Specific failure modes that will be looked for: `role="button"` on a `div` with no key handling; an `aria-label` that contradicts the visible text; a seat grid with 180 tab stops; live regions that fire on every keystroke; a modal that traps focus and cannot be escaped; a focus ring that exists but is hidden behind a sticky bar; and "accessible" states distinguished only by red and green.

Get the seat map right and the rest follows. Get it wrong and nothing else rescues the page.
