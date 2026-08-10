# SVG Icon System

Draw an icon set by hand, in code, with no canvas to check yourself against.

**The set:** eighteen icons for a coastal tide and weather station dashboard. The subject is chosen because it forces three different kinds of form into one family — organic (a swell, wind, moon phase, rainfall), mechanical (an anemometer, a buoy, a tide gauge, a mooring), and abstract interface (filter, export, alert, history, compare, favourite). Holding a consistent hand across all three is the task.

Ship them as a working icon system in one HTML document: a `<symbol>` sprite, plus a specimen page that presents the set the way a design system site would.

## Requirements

- **One grid, one hand.** A 24×24 viewBox with a stated live area and stated padding. Consistent stroke weight, consistent cap and join style, consistent corner radius, consistent visual density. Apply optical correction where mathematical correctness looks wrong — a circle and a square of the same nominal size are not the same size to the eye.
- **Drawn, not assembled.** No `<image>`, no `<foreignObject>`, no embedded raster, no data URIs, no text glyphs or icon-font characters used as shapes. Every mark is path, geometry, or stroke that you authored.
- **Budget your nodes.** No icon may exceed 24 path commands. Tracing a shape with a hundred tiny segments is not drawing it. Total sprite size, gzipped, must stay under 12KB.
- **Correct SVG hygiene.** Accurate `viewBox` with nothing clipped at the edges, coordinates to at most two decimal places, no transform stacks used to avoid recomputing geometry, no empty groups, no editor cruft. `<title>` on each symbol.
- **Themeable.** Everything inherits `currentColor`. Stroke width must survive being set from CSS. The set must work on light and dark backgrounds without a second copy.
- **Scale honestly.** Each icon must remain readable at 16px and hold up at 96px. If an icon needs a simplified form at small sizes, ship the second form deliberately and show both.
- **The specimen page is part of the deliverable.** A real page: the full set in a grid, a size ramp, light and dark, the icons in context inside a plausible UI fragment, the usage snippet, and the grid/construction rules stated. Designed, not a debug dump.
- Accessible usage demonstrated: decorative instances hidden from assistive technology, meaningful instances named.

## What is being evaluated

The row test, first and hardest: all eighteen icons at 24px in a single line. Do they look like one family drawn by one person on one afternoon, or like eighteen competent icons sourced from eighteen different sets? Most attempts pass individually and fail here — the mechanical icons come out heavier than the organic ones, the abstract ones drift to a different optical weight, and the whole row wobbles.

Then the source. The SVG will be read, not just rendered. Structure, reuse, coordinate quality, and node economy are scored directly.

Then judgment: which eighteen forms you chose to represent the concepts, and whether the specimen page is the work of someone who has shipped a design system or someone who has seen a screenshot of one.
