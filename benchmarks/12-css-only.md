# Zero JavaScript

Build an interactive editorial page with no JavaScript at all.

**No `<script>` tag of any kind. No inline event handlers. No `javascript:` URLs.** The only things doing work are HTML and CSS. Everything the visitor can do, they do through native element behaviour and selectors that respond to it.

**The subject:** a long-form feature for an archive or catalogue with real depth — a field guide, a collection, an index of things — where the reader needs to navigate, filter, compare, and read. Choose your own; invent the content and write it properly. It should be worth reading, not lorem with a nice grid.

## Requirements

- **Interaction without script.** At minimum: a filterable or facetable index, expandable detail sections, a lightbox or expanded-figure view, a persistent reading-position or section indicator, and a light/dark treatment that respects system preference and can also be overridden by the reader. Build these from native elements and modern selectors, not from checkbox hacks that leave the page unusable for a keyboard or screen reader user.
- **Show the modern CSS you actually know.** Container queries where the component's context matters more than the viewport. `:has()` where relational styling is the honest solution. Subgrid where alignment must cross containers. Scroll-driven animation, view transitions, anchor positioning, `@property`, and `color-mix()` are all fair game. Use each one because it is right, not to tick it off — gratuitous use scores no better than ignorance.
- **Degrade deliberately.** Wrap newer features in `@supports` and decide what the page becomes without them. The fallback must be a considered version of the page, not a broken one. State your baseline.
- **Still accessible.** Native semantics, correct heading order, keyboard operable throughout, visible focus, no content hidden from assistive technology because a selector needed it that way. `prefers-reduced-motion` honoured — and with scroll-driven animation this matters more than usual.
- **Typography carries the page.** Real scale, real measure, real leading, fluid type that stays readable at both ends. Google Fonts via CDN is available.
- **Responsive to 390px**, with layout decisions that change shape rather than stack.
- **No canvas, no SVG filters standing in for CSS, no WebGL.** Any imagery is constructed with CSS or inline SVG geometry. You do not get to hide weak CSS behind a rendering context.

## What is being evaluated

Whether you can actually write CSS. Every other task in this suite can be won by a model with a canvas and a flexbox column; this one cannot.

The two failure modes are equally common. The first is a beautiful static page with three hover transitions submitted as though the interaction requirement were optional. The second is a demo reel — every new specification in one page, none of them load-bearing, held together by nothing.

What scores well is a page where a reader would not immediately notice there is no JavaScript, and where a developer reading the stylesheet would find the reasoning sound.
