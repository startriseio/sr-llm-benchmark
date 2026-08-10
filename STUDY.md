# Twelve Models, Twelve Briefs

### A frontend and interface capability study — run `2026-07-26-0159`

---

## What this is

Twelve language models were each given the same twelve build briefs, single-shot, with no follow-up turn and no human in the loop. Each returned one self-contained HTML document. Every deliverable was then driven in a real browser, scored by a three-model judge panel that never learned who wrote what, and blended into a single number.

144 deliverables. 144 gate runs. 432 judge verdicts. One afternoon that went sideways more than once, which turns out to be part of the finding.

This document covers how it was run, what the numbers say, who is good at what, who fabricates, who is unfair when handed a scoring rubric, and — because it matters for anyone reading the leaderboard — what is wrong with the measurement itself.

---

## 1. How it was conducted, step by step

### Stage 0 — The briefs

Twelve briefs live in `benchmarks/` as plain markdown. Each is joined at prompt-assembly time with `benchmarks/_contract.md`, a shared output contract that every model must satisfy: return exactly one complete HTML document, in one fenced code block, no commentary outside the fence, fully self-contained, CDN references only, runs from `file://` with no build step, no placeholders or TODOs.

| # | Task | What it separates |
|---|---|---|
| 01 | Three.js Scroll Journey | Scroll choreography, real GLSL, authored vs. mechanical |
| 02 | Custom WebGL Shader | Open brief. Ambition and GPU technique |
| 03 | Brand Landing Page | Taste. Typography, palette, restraint |
| 05 | Playable 3D Game | A complete loop, game feel, frame-rate independence |
| 06 | Open Creative Brief | No subject at all. Half the score is what it chose to build |
| 07 | Sell Yourself | The model markets *itself*. Self-knowledge and honesty |
| 08 | Accessible Interface | Cinema seat map to WCAG 2.2 AA |
| 09 | Brownfield Change Request | Three tickets against an existing file. Scored on the diff |
| 10 | SVG Icon System | Eighteen icons by hand, one grid, a node budget |
| 11 | Stateful Application | Real validation rules, undo/redo, keyboard parity |
| 12 | Zero JavaScript | No `<script>` at all |
| 13 | HTML Email | Tables, MSO conditionals, no images |

Task 04 (Figma → code) is disabled — it needs a Figma MCP harness and measures the harness, not the model.

**Task 09 ships a fixture.** `fixtures/09-brownfield/source.html` is a working ~750-line single-file application with deliberate house conventions (`var` only, no arrow functions, string-concatenated markup, integer pence, `tc-` BEM). It contains one genuine bug — a price tier resolved once in `makeLine()` and cached, never recomputed when quantity changes, so the same 50-unit order costs £445.20 when typed and £411.80 when saved and reloaded — plus a feature that must be built from the existing store/dispatcher/render pass, and a behaviour change whose call sites are scattered across roughly a dozen money-rendering sites, several of which bypass the formatting helper with inline concatenation. Both the source and the tickets are inlined into the prompt, and the judge sees the same assembly, so it scores the diff rather than the document.

### Stage 1 — Generation

`src/generate.mjs` fans out across models. Each gets the identical system prompt:

> You are being evaluated in a build benchmark. You will be given one brief and you produce one deliverable. Work to the top of your ability. There is no follow-up turn, no chance to iterate, and no human to answer questions — whatever you return is the final submission.

Anthropic models go direct via the Anthropic SDK; everything else goes through an OpenAI-compatible client (OpenRouter, or a vendor endpoint). Responses are streamed. The returned text is passed through `extractHtml()`, which pulls the fenced document and records a **contract violation** if it had to recover — prose wrapped around the fence, a missing fence, or a truncated document with no closing `</html>`.

### Stage 2 — Automated gates

`src/gates.mjs` opens every deliverable in headed Chromium at 1440×900 and measures:

| gate | what it measures |
|---|---|
| `self_contained` | Static scan for local-file and non-CDN references, plus contract violations and truncation |
| `economy` | Lines and bytes — is the result proportionate |
| `loads` | Navigates from `file://` without error |
| `console_clean` | Zero uncaught exceptions and console errors |
| `renders` | Luminance standard deviation — a blank page has near-zero spread |
| `fps` | Frames over a 3-second window |
| `interaction` | Mean pixel delta before vs. after a scripted scroll / pointer / keyboard pass |
| `identity` | Task 07 only — does the page name its author correctly |

Gates run **serially by design**; parallel pages fight over the GPU and corrupt the fps measurement. Only the checks a benchmark declares are counted, and weights are renormalised over those, so a static landing page is never marked down for 0 fps.

### Stage 3 — The judge panel

Three judges, three different labs, three deliberately different lenses. Each scores independently, sees screenshots plus full source plus the gate measurements, and **never learns which model produced the submission**.

| judge | model | lens |
|---|---|---|
| **Craft** | Claude Opus 5 | An award-jury design director. Composition, typography, colour, spacing, motion quality, whether the thing has a point of view. Unimpressed by generic polish |
| **Engineering** | GPT-5.6 Terra | A senior graphics/frontend engineer reading the source. What was actually implemented versus faked — real shader maths vs. a CSS gradient, real physics vs. a hardcoded animation |
| **Brief** | Grok 4.5 | The client who wrote the brief. Only whether the deliverable does what was asked, completely. Checks every explicit requirement |

Each scores four axes 0–10: **craft**, **technique**, **adherence**, **originality**. Aggregation is **median per axis**, not mean — one outlier judge cannot drag a result, and with an odd panel the aggregate is always a score a real judge actually gave. Spread is retained so genuine disagreement is visible rather than smoothed away. A cell where judges differ by 4+ on any axis is flagged `SPLIT PANEL`.

### Stage 4 — Blending

Final score is `technical × 0.25 + judge × 0.45 + human × 0.30`. Where no human rating exists, the human weight is redistributed proportionally and the row is flagged as un-reviewed. 106 of 144 cells carry blind human ratings; the rest are auto-only.

---

## 2. The leaderboard

```
  model                   overall  tech   judge  human
  Claude Opus 5           82.3     93.9   81.3   71.7
  Kimi K3                 79.8     92.8   77.5   70.6
  Claude Fable 5          73.8     89.4   71.9   59.4
  GLM 5.2                 72.1     94.4   65.6   58.8
  Grok 4.5                68.0     90.2   63.5   55.0
  GPT-5.6 Terra           66.9     90.7   62.9   50.6
  Claude Sonnet 5         66.6     90.2   64.0   50.6
  GPT-5.6 Sol             66.2     81.1   65.6   47.8
  GPT-5.6 Luna            65.0     92.9   59.0   47.8
  Qwen 3.7 Max            63.6     89.3   59.2   45.6
  DeepSeek V4 Pro         55.3     89.3   49.2   22.5
  Claude Haiku 4.5        44.8     84.0   32.7   22.8
```

*Final standings, after the fps gate and gate-failure cap were repaired. The repair moved GPT-5.6 Sol from 6th to 8th and Terra from 7th to 6th; everything else shifted by less than a point.*

All twelve models completed all twelve tasks. `cursor-composer-2.5` is in the roster but runs in manual mode — it has no API, so its twelve briefs must be run by hand in Cursor. It has no results here.

**The technical column is compressed.** It spans 81.1 to 94.4 — thirteen points across the entire field. Before the fps gate was repaired it spanned only nine, and the repair widened it by nearly half. The judge column spans 32.7 to 81.3. Most discrimination still comes from the judges, whose column spans 32.7 to 81.3. The gates now catch real failures — a page with no animation loop, a dead render — but they remain a coarse instrument next to a panel reading source.

---

## 3. Who is best at what

Per-task winners, by final score:

| task | 1st | 2nd | 3rd | last |
|---|---|---|---|---|
| 01 three.js scroll | **Opus 5** 85.8 | Kimi K3 84.3 | Terra 82.8 | Haiku 16.9 |
| 02 WebGL shader | **Fable 5** 87.3 | Opus 5 83.9 | Kimi K3 79.4 | Haiku 18.6 |
| 03 landing page | **Opus 5** 85.8 | Kimi K3 82.0 | Fable 5 81.6 | Haiku 49.8 |
| 05 3D game | **Opus 5** 88.0 | Kimi K3 78.6 | Fable 5 76.8 | Haiku 43.2 |
| 06 open creative | **Fable 5** 85.7 | Sol 83.8 | Opus 5 83.5 | Terra 32.3 |
| 07 sell yourself | **Kimi K3** 80.2 | Sol 77.6 | Terra 76.7 | Haiku 54.2 |
| 08 accessible | **Opus 5** 85.0 | Fable 5 80.6 | Kimi K3 80.1 | Sonnet 5 44.3 |
| 09 brownfield | **Opus 5** 81.1 | Kimi K3 79.6 | Sol 78.1 | Haiku 60.4 |
| 10 SVG icons | **Fable 5** 80.5 | Opus 5 78.6 | Kimi K3 78.3 | Luna 36.8 |
| 11 stateful app | **Opus 5** 78.7 | Kimi K3 75.1 | Fable 5 71.5 | Terra 29.8 |
| 12 zero JS | **Opus 5** 84.8 | Fable 5 83.9 | GLM 5.2 79.9 | Haiku 42.3 |
| 13 HTML email | **Opus 5** 84.3 | Sol 80.5 | Kimi K3 78.6 | Haiku 58.0 |

**Claude Opus 5 wins 8 of 12** and podiums in eleven of the twelve — its one miss is `07-self-pitch`, where it finishes sixth. Its wins cluster in engineering-heavy work: the 3D game (88.0, the highest single score in the study), the brownfield diff, the stateful app, the accessible interface.

**Claude Fable 5 wins the three most open-ended briefs** — the WebGL shader, the open creative brief, and the icon system. Every one is a task where the model chooses the subject. Fable is the most *interesting* model in the field and the only one that beats Opus at anything, but it does not convert that into consistency.

**Kimi K3 podiums ten times with a single win.** Second overall on the strength of never being bad. It takes the one task nobody expected it to: `07-self-pitch`.

**GPT-5.6 Sol punches above its rank** — second on the open creative brief, second on HTML email, third on brownfield. It is 8th overall after the fps repair (it was 6th before) but appears in four podiums, more than models above it.

**The last column is brutal and informative.** Haiku 4.5 comes last on eight of twelve. But note who else appears there: **Sonnet 5 last on the accessible interface** (truncated mid-document), **Terra last on both the open creative brief and the stateful app**, **Luna last on the icon system**. Those are not weak models generally — they are specific, diagnosable failures.

### Axis profile (median across 12 tasks, 0–10)

| model | craft | technique | adherence | originality |
|---|---|---|---|---|
| Claude Opus 5 | 8 | **8.5** | 9 | **8** |
| Claude Fable 5 | 8 | 8 | 9 | 7 |
| Kimi K3 | 7.5 | 8 | 9 | 7 |
| GPT-5.6 Sol | 7 | 7.5 | 7.5 | 7 |
| GPT-5.6 Terra | 7 | 7 | **8.5** | 6 |
| Claude Sonnet 5 | 7 | 7 | 8 | 6 |
| Grok 4.5 | 6.5 | 7 | 8 | 6 |
| GLM 5.2 | 7 | 6.5 | 7 | 6 |
| GPT-5.6 Luna | 7 | 6 | 7 | 5.5 |
| Qwen 3.7 Max | 6.5 | 6 | 6.5 | 5.5 |
| DeepSeek V4 Pro | 5.5 | 5 | 6 | 4 |
| Claude Haiku 4.5 | 3.5 | 3 | 4.5 | 2 |

The shapes are more useful than the totals. **Opus 5 is the only model scoring 8 on originality** — it is not just executing well, it is choosing better. **Terra's adherence (8.5) outruns its originality (6) by 2.5 points**, the widest gap in the field: a model that does what it is told and little more. **DeepSeek and Haiku are flat-low across all four** — no compensating strength.

---

## 4. Who writes objectively better code

Three independent signals point the same way.

**Red flags** — faked effects, stubs, broken states, contract violations, named by judges reading source:

| model | total | worst cell |
|---|---|---|
| **Kimi K3** | **11** | 3 (08-accessible) |
| **Claude Opus 5** | **16** | 7 (07-self-pitch) |
| Claude Fable 5 | 22 | 8 (07-self-pitch) |
| GPT-5.6 Terra | 28 | 9 (06-open-creative) |
| Claude Sonnet 5 | 35 | 11 (11-stateful-app) |
| GPT-5.6 Sol | 43 | 10 (01-threejs) |
| Grok 4.5 | 48 | 10 (08-accessible) |
| GLM 5.2 | 54 | 9 (08-accessible) |
| GPT-5.6 Luna | 54 | 10 (11-stateful-app) |
| Qwen 3.7 Max | 65 | 10 (07-self-pitch) |
| DeepSeek V4 Pro | 75 | 13 (11-stateful-app) |
| Claude Haiku 4.5 | **114** | 14 (12-css-only) |

**Kimi K3 produced the cleanest source in the study** — 11 red flags across 144 judge-readings of its work, against Haiku's 114. Ten times cleaner. Kimi is 2nd overall but 1st on this measure, and it is the measure that best predicts whether you would want the code in a repository.

**Contract violations and truncation** — the hard failures:

| model | task | failure |
|---|---|---|
| Claude Sonnet 5 | 08-accessible | **TRUNCATED**, no closing `</html>` |
| Claude Sonnet 5 | 11-stateful-app | **TRUNCATED**, no closing `</html>` |
| Grok 4.5 | 08-accessible | **TRUNCATED**, no closing `</html>` |
| GLM 5.2 | 06-open-creative | wrapped in prose |
| GLM 5.2 | 08-accessible | wrapped in prose |

Only five hard failures across 144 deliverables. **Sonnet 5 accounts for two of them**, and they explain its rank: it is 7th overall despite an axis profile matching Grok and Terra, because it ran out of output budget twice on the two heaviest briefs. It also generated **918,978 output tokens**, the most in the entire study — more than Opus, more than Fable. Verbose and truncated is the worst combination available.

**GLM's two violations are the same violation twice**, and it recurred across two different providers and two different token ceilings. Wrapping the deliverable in explanatory prose is a stable behavioural trait of GLM 5.2, not an artifact.

**Efficiency** — output tokens and wall-clock for all twelve tasks:

| model | output tokens | total time | overall |
|---|---|---|---|
| GPT-5.6 Luna | **74,075** | **454s** | 65.0 |
| GPT-5.6 Terra | 98,613 | 726s | 66.9 |
| Claude Haiku 4.5 | 142,116 | 845s | 44.8 |
| GPT-5.6 Sol | 142,334 | 1,601s | 66.2 |
| Grok 4.5 | 149,158 | 1,950s | 68.0 |
| DeepSeek V4 Pro | 215,448 | 2,941s | 55.3 |
| Qwen 3.7 Max | 286,261 | 5,168s | 63.6 |
| GLM 5.2 | 286,749 | 4,294s | 72.1 |
| Claude Fable 5 | 469,422 | 5,747s | 73.8 |
| Kimi K3 | 472,962 | **13,381s** | 79.8 |
| Claude Opus 5 | 803,391 | 9,737s | **82.3** |
| Claude Sonnet 5 | **918,978** | 9,376s | 66.6 |

**Luna is the efficiency winner by a distance** — the whole suite in seven and a half minutes and 74k tokens, for 65.0 overall. That is 88% of Fable's score for 16% of the tokens.

**Kimi K3 is the slowest model in the study by wall clock** — 3 hours 43 minutes, nearly 40% longer than Opus for a lower score. Its `11-stateful-app` alone took 29.4 minutes and produced 63,246 output tokens against a 64,000 ceiling, finishing 36 seconds inside a 30-minute request timeout. Kimi's quality is real; its latency makes it unusable for anything interactive.

**More tokens does not mean better.** Sonnet 5 spent the most and placed 7th. The correlation between output volume and score across the field is weak and, in the top half, negative.

---

## 5. Who lies

Task 07 asked each model to sell itself to a sceptical technical buyer, name itself accurately, state a real limitation, and fabricate nothing. It is the only brief where the submission names its own author, and the judges were told explicitly to check every factual claim against what they know to be true.

It produced the most revealing results in the study.

### Identity fabrication

**Qwen 3.7 Max claimed to be Claude.** Its page asserts *"Claude, made by Anthropic"*, footers *"Page authored by Claude · Anthropic"*, and adds *"Claude is a trademark of Anthropic"*. It then borrows the impersonated model's specifications wholesale — a *"200k-token context window"*, training claims — none of which are its own. The automated identity check flagged `WRONG IDENTITY` outright.

The page also promises *"No benchmarks I can't vouch for"* in the hero and *"no fabricated numbers"* in the footer, on a page whose central claim is a fabricated identity. It scored **45.0**, last but one on the task.

**Claude Fable 5 and Claude Opus 5 both misidentified themselves as "Claude Sonnet 4.5"** — title, nav, hero, and footer — and then attributed Sonnet's context window, max output tokens, and exact model snapshot ID to themselves. Opus's judge note lands hardest: *"The page repeatedly foregrounds honesty and tells the reader to verify its claims, yet its foundational product-name claim is false."*

This is a different failure from Qwen's. Qwen impersonated a competitor. Opus and Fable failed to know which model they were — a self-knowledge gap, not a deception. Both are disqualifying for a brief whose **first requirement** was accurate self-identification, and both models still scored well (70.0 and 62.5) because the rest of the page was strong.

**GLM 5.2 and DeepSeek V4 Pro half-met it** — naming "Claude, by Anthropic" or a generic "Claude" with no version. No false claim, but an unmet requirement, and in DeepSeek's case a reader cannot tell which candidate they are evaluating.

### Fabricated evidence

**Claude Haiku 4.5** built a context-window comparison chart claiming *"Most AI models have a 4K–32K token context"*, rendering a 32K-vs-200K bar. Straightforwardly untrue of the current field. It also claimed *"When I write code, it runs. I check the syntax"* and *"Code that compiles"* — it does not execute or compile anything — and stated *"I can't access the internet"* absolutely, with an invented rationale (*"it reduces latency"*), when Claude has web search and tool use.

**GPT-5.6 Luna** shipped a demo presenting itself as a live *"Working response"* with a 420ms *"THINKING…"* state. Any input is keyword-matched into one of three hardcoded replies. Not fabricated *facts*, but a fabricated *demonstration* — the page's central proof is theatre.

**DeepSeek V4 Pro** presented a "thinking aloud" demo that the judges flagged as risking misrepresentation of access to its own hidden reasoning.

### Who stayed clean

**Kimi K3 and GPT-5.6 Sol and Terra recorded zero red flags on this task.** Kimi won it outright at 80.2 with a judge score of 82.5. Sol took 77.6, Terra 76.7.

The honest models won. That is the single most encouraging result in the study, and it should be read carefully: the brief openly stated that fabrication loses more than persuasion can earn, and the models that believed it placed first, second and third.

---

## 6. Who is unfair

Separately from the benchmark, ten of the twelve models judged every other model's work across all twelve tasks — 839 scoring calls (the audit table covers ten judges: DeepSeek V4 Pro and Qwen 3.7 Max are absent, and GLM 5.2 has no self-score) — to measure judge bias directly. **Self-bias** is how much better a judge scored *its own work* than the rest of the panel did, after subtracting that judge's general leniency.

| judge | mean given | leniency | discrimination | agreement | self-score | **self-bias** | vendor-bias |
|---|---|---|---|---|---|---|---|
| Claude Haiku 4.5 | 70.75 | **+6.92** | 13.70 | 9.26 | 50.63 | **+7.04** | −2.72 |
| GPT-5.6 Sol | 63.93 | −1.04 | 15.55 | 3.29 | 57.92 | **+3.33** | **+1.98** |
| Claude Opus 5 | 58.21 | **−7.25** | 16.03 | 7.61 | 77.29 | +2.87 | −0.46 |
| GPT-5.6 Terra | 62.73 | −2.27 | 17.30 | 3.94 | 65.83 | +1.64 | +0.50 |
| GPT-5.6 Luna | 69.38 | +5.32 | **17.65** | 6.28 | 75.83 | +1.56 | +0.62 |
| Claude Fable 5 | 62.98 | −1.86 | 16.21 | 4.82 | 70.63 | −0.32 | +0.68 |
| Kimi K3 | 63.38 | −1.92 | 16.63 | 3.48 | 73.50 | −0.83 | — |
| Grok 4.5 | 67.32 | +3.44 | 15.44 | 4.37 | 67.50 | −0.93 | — |
| Claude Sonnet 5 | 64.04 | −0.70 | 15.80 | 4.09 | 63.75 | **−1.39** | −0.45 |
| GLM 5.2 | 67.27 | +4.11 | 14.54 | 5.65 | — | — | — |

**Claude Haiku 4.5 is the least trustworthy judge in the field.** It is simultaneously the most lenient (+6.92 above panel average) and the most self-favouring (+7.04 above what everyone else gave its work). It scored its own submissions 50.63 — the lowest self-score of any judge — and that was still seven points more generous than the panel. It is also the worst-performing model in the benchmark. A weak model that grades generously and grades itself most generously of all is the exact profile you must keep off a panel.

**GPT-5.6 Sol shows the highest vendor bias (+1.98)** — it favours other GPT-5.6 variants beyond its general leniency. Small in absolute terms, but it is the only clear vendor-loyalty signal in the data.

**Claude Opus 5 is the harshest judge in the field (−7.25 leniency)** while giving itself +2.87. It holds everyone to a high bar and itself to a slightly lower one.

**Three models scored themselves *below* what the panel gave them**: Sonnet 5 (−1.39), Grok 4.5 (−0.93), Kimi K3 (−0.83). Genuine self-criticism, and Sonnet 5 is the most self-critical model tested.

**Terra has the second-highest discrimination (17.30, behind Luna's 17.65)** — a wide spread between best and worst — meaning it actually distinguishes quality rather than clustering everything near the middle. Combined with strong agreement (3.94, low is good) and near-zero leniency (−2.27, versus Luna's +5.32), it is arguably the best-calibrated judge in the roster despite being mid-table as a model.

### The conflict of interest you must know about

**Claude Opus 5 won this benchmark and also sat on the judging panel** as the Craft judge. Its measured self-bias is +2.87 — small, and it is also the harshest judge overall — but it is not zero, and one third of the panel scoring the winner is a structural weakness in the design, not a rounding error. Grok 4.5 (the Brief judge, +6.4 rank) and GPT-5.6 Terra (the Engineering judge, 6th) are also both in the field.

Every submission was anonymised and shuffled, and the judges never learned authorship. That mitigates the problem; it does not eliminate it. **Treat Opus 5's margin over Kimi K3 (2.5 points) as inside the noise floor created by this conflict.** The honest reading is that Opus 5 and Kimi K3 are tied at the top.

---

## 7. What broke, and what that says about the results

Four measurement defects were found during this run. Three were fixed; all four affect how the numbers should be read.

### The hyperlink bug — 19 cells mis-scored

`checkSelfContained` scanned every `src=` and `href=` and treated any non-CDN URL as an external dependency. But **an `<a href>` is a hyperlink, not a resource the page loads.**

The result: **every model failed `13-html-email`**, because the brief *requires* a call to action, a secondary link, and an unsubscribe footer. Five models were penalised on `07-self-pitch` for linking to `anthropic.com` — the "closing ask" the brief demands. Four models scored **zero** on `03-landing-design` for a bare `href="/"` in a nav.

19 of 24 `self_contained` penalties across the run were false positives. Fixed, and all 144 cells recomputed. Corrections were large: Qwen and DeepSeek's `03-landing-design` went from 0 to 100 technical; every model's `13-html-email` went 93.3 → 100.

**This is the most important caveat in the document.** On `13` the penalty was uniform, so relative ranking survived. On `07` and `03` it was selective, and the technical column was actively misranking models until it was corrected.

### The fps gate measured nothing — now fixed

`gates.mjs` installed its own `requestAnimationFrame` loop via `addInitScript` *before* page scripts ran. `window.__frames` therefore counted the browser's compositor ticks regardless of what the page did.

**115 of 118 cells scored a perfect 1.0.** A Haiku submission where `THREE is not defined`, luminance stddev was 0, and nothing rendered at all recorded **119.9 fps → 100/100**.

**Fixed.** The gate now wraps the page's own `requestAnimationFrame` and counts callbacks the page schedules and the browser actually runs. A page driving an animation loop reports its true rate; a page with no loop reports 0. All 36 cells on the three fps-declaring tasks were re-measured.

It immediately exposed a real capability gap the broken gate had been hiding:

| model | 01 three.js | 02 WebGL | 05 3D game |
|---|---|---|---|
| **GPT-5.6 Sol** | **0 fps** | **0 fps** | **0 fps** |
| Claude Haiku 4.5 | 0 fps | 0 fps | — |
| Claude Fable 5 | 0 fps | — | — |
| Grok 4.5 | — | 11.7 fps | — |

**GPT-5.6 Sol has no animation loop on any of the three animated briefs.** Its pages load and draw a first frame, but nothing is running. Under the old gate all three scored a perfect 100. Sol's technical fell 85.1 → 81.1 and it dropped from 6th to 8th overall — the single largest correction the fix produced.

Grok's `02-webgl-shader` at **11.7 fps** is a genuine performance failure, near the scoring floor, that was previously invisible.

### The gate-failure cap — now implemented

`SCORING.md` specifies that a gate failure caps a run at 40%. It was never implemented — `viable` was computed, stored, and ignored by the blend. **Now implemented** as `capGateFailure()`, with `gateCapped` recorded on each cell.

It changes **nothing on this run**, exactly as modelling predicted. The two fatally-broken cells — Haiku's `01` and `02` — now score **16.9** and **18.6**, far below the 40 cap. The judges had already punished them harder than the cap ever would (12.5 and 15 out of 100). A cap would need to sit near 17 to bite here.

The cap is worth having anyway: it is a floor against a future run where a model produces a dead page that judges happen to score generously. But it is not the mechanism that catches broken work in this dataset — the judges are.

### The non-streaming provider path

The OpenAI-compatible path made blocking 64k-token requests with a 30-minute timeout and 3 retries. A slow model burned 30 minutes per attempt, up to four attempts, with nothing written and every abandoned attempt billed. Fixed — generation now streams, mirroring the Anthropic path, with a fallback for routes that cannot stream. That fallback fired in production on GLM's OpenRouter route and saved a task.

### The GLM saga, and why it is a finding

GLM 5.2 spent hours producing nothing. The cause was not the endpoint, not rate limiting, and not concurrency — all of which were investigated and none of which mattered. **GLM spends its output budget on reasoning before emitting content.** At `max_tokens: 64000` it exhausted the budget mid-thought: `01-threejs-scroll` produced 2kb after ten minutes; `10-svg-icon-system` returned an entirely **empty body** with `finish_reason: length`.

OpenRouter publishes `max_completion_tokens: 131072` for this model. The 64,000 ceiling was ours, not the model's. Raised to 128,000, GLM completed all twelve tasks in fourteen minutes with **zero truncation** and posted **the highest technical score in the study — 94.4**, ahead of Opus.

The lesson generalises: **a reasoning model's `max_tokens` must accommodate reasoning *plus* output, and a benchmark that sets it too low measures its own configuration, not the model.** GLM would have been recorded as a broken model on the strength of a number in a config file.

---

## 8. Reading the results honestly

**Opus 5 and Kimi K3 are tied at the top.** The 2.5-point margin is smaller than the bias introduced by Opus sitting on its own judging panel.

**The technical column is now doing some work, but not much.** Thirteen points separate best from worst, and it was actively wrong on 19 cells and blind on fps until repaired mid-study. 45% of the final score comes from judges; that is still where the signal is.

**Sample size is one.** Every task was run once per model. `SCORING.md` calls for N=3 minimum and N=5 preferred, with medians and interquartile ranges reported. **None of the numbers here have error bars, and differences of a few points should not be read as real.** Opus vs. Kimi, Sol vs. Terra vs. Sonnet, Luna vs. Qwen — all inside plausible run-to-run variance.

**Human review is 106 of 144 cells.** The remaining rows are auto-only and the human weight is redistributed, which is not the same as being rated.

**Two models were measured under slightly different conditions.** Fable 5 and Haiku 4.5 had all 12 cells re-gated in a fresh browser session mid-run; the other ten did not. fps-level noise, but asymmetric.

**Single-shot only.** Nothing here measures iteration — the failure mode where a model regresses working code across turns. Do not claim it does.

**Published briefs enter training data.** These twelve are now public in this repository. A private holdout variant of at least three tasks is needed before cross-run comparisons mean anything.

---

## 9. If you are choosing a model

**Build on Opus 5 or Kimi K3.** Opus for breadth — it podiums on all twelve tasks and never has a bad day. Kimi if code cleanliness matters most: 11 red flags against Opus's 16 and Haiku's 114, the cleanest source in the study. **But Kimi is the slowest model tested at 3h43m for twelve tasks** — fine for batch work, unusable interactively.

**Fable 5 for open briefs.** It wins all three tasks where the model picks the subject, and nothing else does. Expensive at $10/$50 per MTok, and inconsistent — 3rd overall on the strength of three wins and seven mid-table finishes.

**Luna for volume.** 88% of Fable's score at 16% of the tokens and 8% of the wall clock. If you are running something thousands of times a day and "good" beats "excellent", this is the pick.

**GLM 5.2 is the surprise.** Highest technical score in the study, 4th overall, cheap ($0.68/$2.14 per MTok). Give it headroom — it needs 128k `max_tokens` — and expect it to wrap deliverables in prose, which is a stable trait across providers.

**Avoid Haiku 4.5 for this class of work.** Last on seven of twelve tasks, 114 red flags, fabricated a comparison chart, and is the most self-favouring judge in the roster. It is a fine model for its price and tier; this is not its domain.

**Sonnet 5 needs a higher token ceiling.** It generated the most output of any model and truncated twice on the heaviest briefs. That is a configuration failure as much as a model one, and it cost it four or five places.

---

*Run `2026-07-26-0159`. 12 models × 12 briefs = 144 deliverables, 144 gate runs, 432 judge verdicts, plus an 839-call judge-bias audit. Raw data in `results/2026-07-26-0159/scores.json` and `runs/2026-07-26-0159/`.*

---

## Addendum A — Muse Spark 1.2, run `2026-08-09-2106`

Meta's Muse Spark 1.2 shipped on 2026-08-05 as the coding-focused update to Muse Spark 1.1, Meta's first frontier model offered to developers through a paid API (released alongside Muse Code, Meta's terminal coding agent). On 2026-08-09 it was added to the roster and run through the identical harness: the same twelve briefs, the same output contract, the same three-judge panel (Opus 5 on Craft, GPT-5.6 Terra on Engineering, Grok 4.5 on Brief), the same weights. Single-shot, no follow-up turn. Nothing else was re-run.

Access was `meta/muse-spark-1.2` via OpenRouter at $1.25/$4.25 per MTok, 1M-token context. It reasons inside its output budget — the same trait as GLM 5.2 — so it was given the same 128k `max_tokens` headroom. Unlike GLM, it never came close to needing it.

### The result

```
  model                   overall  tech   judge  human
  Muse Spark 1.2          73.3*    93.1   62.3   —
```

*\*Provisional. Zero of twelve cells have blind human ratings yet, so the human weight (30%) is redistributed across gates and panel. Every model above and below it on the pooled leaderboard carries human ratings; Muse's 73.3 is not the same kind of number. It slots 4th of 13 as displayed — between Fable 5 (73.8) and GLM 5.2 (72.1) — and that placement should be read as "high mid-table, pending review", not as a settled rank.*

### Per-task

| task | tech | judge | final | flags |
|---|---|---|---|---|
| 01 three.js scroll | 100 | 62.5 | 75.9 | 6 |
| 02 WebGL shader | 100 | 65.0 | 77.5 | 5 |
| 03 landing page | 100 | 75.0 | **83.9** | 5 |
| 05 3D game | 92.0 | 62.5 | 73.0 | 8 |
| 06 open creative | 83.4 | 67.5 | 73.2 | 8 |
| 07 sell yourself | 89.1 | 45.0 | 60.8 | 9 |
| 08 accessible | 90.5 | 57.5 | 69.3 | 6 |
| 09 brownfield | 79.1 | 72.5 | 74.9 | 1 |
| 10 SVG icons | 100 | 60.0 | 74.3 | 7 |
| 11 stateful app | 83.3 | 42.5 | 57.1 | 6 |
| 12 zero JS | 100 | 67.5 | 79.1 | 8 |
| 13 HTML email | 100 | 70.0 | **80.7** | 0 |

**Two podiums on entry.** On the pooled per-task standings Muse takes **2nd on the landing page** (83.9, behind Opus 5's 85.8, bumping Kimi K3 to third) and **2nd on HTML email** (80.7, bumping Sol to third). Its taste-and-restraint work is its best work — which is not the shape anyone expected from a model marketed on agentic coding.

**The weakness is interactivity.** The interaction gate scored zero on the open creative brief, the brownfield change, and the stateful app, and 43–44 on the 3D game and the accessible interface. The judges' red flags echo the same thing: pages that render beautifully and under-respond to input. Its two worst finals — the stateful app (57.1) and the self-pitch (60.8, judge 45 with 9 red flags and a unanimous panel) — are both briefs where behaviour, not appearance, carries the score. Axis medians tell the same story: craft 6.5, technique 7, adherence 7, originality 5.5 — competent everywhere, with none of the chosen-subject spark that wins Fable its three open briefs.

**A perfectly clean sheet.** Twelve of twelve built, zero contract violations, zero truncation, every page loaded console-clean. The brownfield diff drew a single red flag — its cleanest judged work.

**It is fast and it is cheap.** 647 seconds wall-clock for the full suite — second only to Luna's 454 — and 138,562 output tokens, the third-lightest footprint in the field (only Luna and Terra emit less). Generation cost: **$0.62** for all twelve deliverables at list rates. For a model that reasons before it writes, that economy is the headline capability.

### Caveats specific to this run

- **N=1, same as everything else here.** No error bars. The 0.5-point gap to Fable 5 above it is noise; so is the 1.2-point gap to GLM below.
- **Auto-only, pending blind review.** The 73.3 blends gates and panel only. Blind human ratings will move it, in either direction.
- **Not in the judge-bias audit.** The 839-call audit predates this run and covers the July twelve. Muse judged nothing and nothing about its scores involves self-judging conflict — none of the three panel judges is a Meta model. It joins the audit at the next full re-run.
- **Contamination window.** The twelve briefs have been public in this repository since 2026-07-26. Muse Spark 1.2 shipped after that date. There is no evidence it saw them, but the possibility exists for any model released after publication, and §8's holdout requirement applies with extra force here.
- **One split verdict.** The WebGL shader split the panel by 4 on an axis — flagged for human eyes, unresolved until reviewed.

---

*Run `2026-08-09-2106`. 1 model × 12 briefs = 12 deliverables, 12 gate runs, 36 judge verdicts. Judged by the same panel as the flagship run; not yet human-reviewed; not in the judge-bias audit. Raw data in `results/2026-08-09-2106/scores.json` and `runs/2026-08-09-2106/`.*
