# HTML Email

> **Contract overrides.** The output contract applies except where it cannot: this artefact
> is an email, not a web page.
>
> - **No CDN references of any kind.** No `<link>`, no external stylesheet, no hosted
>   webfont. Everything travels inside the file.
> - **No images at all** — not external, and not data URIs, which are stripped by Gmail and
>   Outlook and are therefore not a workaround. Every visual is built from markup, colour,
>   borders, and type.
> - The deliverable still opens in a browser and still returns as one document, but a
>   browser is not the test. Score it in a client-rendering service (Litmus, Email on Acid)
>   or a real client matrix. A browser render tells you almost nothing here.
>
> **Target matrix:** Outlook 2016/2019 Windows (Word engine), new Outlook / Outlook.com,
> Apple Mail (macOS and iOS), Gmail web, Gmail app with a non-Gmail account, Yahoo. Light
> and dark mode across all of them.

---

Build a transactional email for a small manufacturer of expensive objects: an order confirmation and dispatch notice, sent to someone who has just spent a lot of money and should feel that the company is worth it.

It needs a header, a confirmation moment, an itemised order table with quantities and totals, a delivery address block, a two-column detail section, a primary call to action, a secondary link, and a footer with the legal and unsubscribe requirements. Invent the company, the product, and the copy. Write the copy properly — transactional email is read more carefully than any campaign ever is.

## Requirements

- **Tables for layout, and know why.** `role="presentation"`, `cellpadding="0" cellspacing="0" border="0"`, `mso-table-lspace` and `mso-table-rspace` zeroed. No flexbox, no grid, no float-based columns, no absolute positioning. Nested tables where nesting is what the layout needs.
- **Inline the styles that matter.** Anything load-bearing is inlined on the element. The `<style>` block carries media queries and progressive enhancement only, and the email must remain correct when that block is stripped entirely — which is exactly what happens in the Gmail app on a non-Gmail account.
- **Handle Outlook honestly.** Ghost tables in MSO conditionals where the fluid layout needs a fixed fallback. `mso-line-height-rule: exactly` where line height matters. A VML fallback if you use a rounded button. Font stacks that do not collapse to Times New Roman. Do not pretend the Word engine is a browser.
- **Responsive, and correct without media queries.** Build fluid or hybrid so the layout is sane at 320px even where media query support is absent. The two-column section must stack, and must stack in Outlook too.
- **Dark mode as a decision, not an accident.** `color-scheme` and `supported-color-schemes` declared, `prefers-color-scheme` handled, and the forced-inversion clients accounted for. A palette that inverts into unreadable grey is a failure even though it is the client's doing.
- **Preheader text**, written deliberately, hidden correctly, and padded so the following body copy does not leak into the inbox preview.
- **Accessible.** `lang` set, `role="presentation"` on every layout table, real heading structure, a `dir` attribute, text contrast that holds in both modes, link text that means something out of context, and no meaning carried by colour alone.
- **Under 102KB** so Gmail does not clip it. Well under, ideally.
- **The design must survive all of the above.** This is the hard part. Anyone can write a compliant grey rectangle.

## What is being evaluated

Knowledge, mostly — this is the one task in the suite that cannot be reasoned from first principles. Either you know that the Gmail app strips `<style>` for non-Gmail accounts, that Outlook ignores `max-width`, that background images need VML, and that data URIs do not render, or you do not. Reasoning your way to a modern, elegant, correct-looking solution produces a broken email.

Then discipline: whether every constraint above is respected simultaneously, under a target matrix that punishes any single lapse.

Then taste, at the reduced weighting the medium allows. With no images, no webfonts, and no modern CSS, the whole design rests on type, colour, spacing, and rule weight. That constraint is the interesting part of the brief, not an apology for it.

A beautiful email that breaks in Outlook has failed. So has a bulletproof one that looks like it was sent in 2009.
