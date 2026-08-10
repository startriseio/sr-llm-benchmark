# Figma → Code

> **Mode: manual.** The API runner skips this benchmark. Figma MCP requires an agentic
> harness with tool access, so this measures the *harness* (Claude Code, Cursor, Codex,
> …) rather than the raw model. Produce the file in your harness of choice and drop it at
> `runs/<model-id>/04-figma-to-code/index.html`, then score it like any other.
>
> Set the Figma file URL for the run in `config/figma.json` so every harness is given the
> same source of truth.

---

You have access to the Figma MCP server. Reproduce the linked Figma frame as a single, static HTML file.

**Figma frame:** see `config/figma.json` → `frameUrl`

## Requirements

- Use the Figma MCP tools to read the design — do not eyeball it from a screenshot. Pull the real layout, spacing, type, colour, and asset data.
- **Fidelity is the entire task.** Match spacing, sizing, type scale, weights, letter-spacing, line-height, colour values, corner radii, borders, and shadows to the design. Where the design uses variables or styles, reflect that structure in CSS custom properties.
- Reproduce the layout with the same structural intent as the Figma auto-layout: flex/grid where the design uses stacks and grids, not absolute positioning to force pixel positions.
- Images and icons: export via the MCP tools and inline them as data URIs, or reconstruct vector icons as inline SVG. No external image URLs.
- Semantic HTML. The visual result should not come at the cost of nonsense markup.
- Static reproduction — no invented interactions. Include hover states only where the design specifies them.
- If the design defines responsive behaviour or multiple frames, implement it. If it does not, build to the frame's own width and let it centre gracefully in a wider viewport.

## What is being evaluated

How close the rendered page is to the source frame, and whether the CSS reflects the design's structure or merely simulates its appearance. A page that looks right but is a stack of absolutely positioned divs scores below one that is a few pixels off with correct structure.
