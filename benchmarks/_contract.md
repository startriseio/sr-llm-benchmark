---

## OUTPUT CONTRACT — non-negotiable

1. Return **exactly one** complete HTML document and nothing else.
2. Wrap it in a single ` ```html ` fenced code block. No commentary before or after the fence.
3. The document must be **fully self-contained**: all CSS inside `<style>`, all JS inside `<script>`. No local file references of any kind (no `./x.js`, no `assets/y.png`).
4. External `<script src>` / `<link href>` is allowed **only** for public CDNs (unpkg, jsdelivr, esm.sh, cdnjs, fonts.googleapis.com). Anything you cannot load from a CDN, generate procedurally in code or embed as a data URI.
5. It must run correctly by opening the file directly in a modern desktop browser — `file://`, no build step, no dev server, no bundler.
6. No network calls to non-CDN hosts. No API keys. No permission prompts (camera, mic, geolocation, clipboard).
7. It must not throw uncaught errors, and it must not log errors to the console.
8. Ship finished work. No placeholders, no `TODO`, no "in a real implementation you would…", no commented-out features you did not build.
9. **Stay within budget: roughly 800 lines and 50 KB.** This is a working budget, not a hard cap — exceed it only where the task genuinely cannot be done inside it, and never to pad. Spend the budget on the thing being asked for. Long files that do little, repeated blocks, dead code, defensive handling for cases that cannot occur, and commentary explaining what the next line does all count against you. A smaller file that does more scores higher than a larger one that does less.
