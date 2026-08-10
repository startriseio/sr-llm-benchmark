# StarRise LLM Benchmark

An in-house benchmarking engine for frontier models on **build tasks** — hard frontend, real-time 3D, design, and open creative work. Every model gets the same brief, returns **one self-contained HTML file**, and that file is scored three ways:

| Column | Weight | Who decides | What it measures |
|---|---|---|---|
| **Technical** | 25% | Playwright, headed, real GPU | Does it load, render, hold frame rate, respond to input, stay in one file, keep the console clean |
| **Judges** | 45% | A quorum of LLMs from different labs | Craft, technical ambition, brief adherence, originality |
| **Human** | 30% | You, **blind** | Whether you would actually ship it |

Nothing here is a multiple-choice eval. Every task produces an artefact you can open, click, and judge.

---

## Quick start

```bash
npm install                 # also fetches Chromium for Playwright
cp .env.example .env        # add your keys
npm start                   # interactive picker — choose models and tasks, then run
```

`npm start` lists every model with a key, shows how much of the suite each has already completed and how much you have rated, and pre-selects the ones with gaps. Space toggles, `a` selects all, enter continues. It prints the full plan — and the exact `npm run bench` command it is about to run — before it starts anything.

For the browser instead: `npm run report` opens a control centre at `localhost:4321` that does the same thing with live output, plus **Blind review** for rating and **Overall** for cross-run comparison.

Direct CLI:

```bash
npm run bench -- --all --note "july baseline"       # new run, everything
npm run bench -- --model kimi-k3                    # new model just dropped
npm run bench -- --all --run latest                 # top up the newest run
npm run bench -- --all --audit                      # also audit the judges
```

---

## How the score is computed

**Per submission** (one model, one task), the three columns are combined:

```
final = 0.25 × technical  +  0.45 × judges  +  0.30 × you
```

- **technical** — the weighted mean of only the gate checks that task declares. A static landing page has no `fps` check, so its absence costs nothing. Two checks beyond the obvious ones:
  - **economy** — the output contract sets a working budget of ~800 lines / 50 KB. Score tapers from full marks inside budget to zero at 2.5×, so a task that genuinely needs more is not failed outright, but padding is measured rather than merely disapproved of.
  - **identity** *(self-pitch only)* — does the page name its own model correctly? Checked deterministically with a regex, not by a judge: a judge cannot know the true author unless told, and telling it would leak identity into the quorum and manufacture the vendor bias the audit exists to detect. Confidently claiming to be a different model scores 0; declining to name a version scores 0.5 (the brief asked, but it is not dishonest); naming itself correctly scores 1.
- **judges** — each of the three judges scores four axes 0–10. Take the **median per axis** across judges, average the four medians, ×10.
- **you** — your blind 0–10, ×10.

If you have not rated it yet, the human weight is redistributed across the other two and the row is flagged provisional everywhere. It is a real number, not a placeholder — but it is not the final one.

**Per model, one run:** the mean of its `final` scores across the tasks it completed.

**Per model, all-time** (the **Overall** tab): each (model, task) pair is averaged across every run it appears in, then those are averaged across tasks.

One caveat worth knowing: a model is averaged over **the tasks it completed**, so failing to produce a file does not drag its mean down — it shrinks the sample instead. That is why coverage (`4/6`) is shown next to every score. A 90 over two tasks is not the same claim as a 90 over six, and the leaderboard does not pretend otherwise.

---

## The benchmarks

| # | Task | What it separates |
|---|---|---|
| 01 | **Three.js Scroll Journey** | Scroll choreography, real GLSL, whether the page is authored or mechanical |
| 02 | **Custom WebGL Shader** | Open brief: the coolest shader the model can write. Ambition and GPU technique |
| 03 | **Brand Landing Page** | Taste. Typography, palette, restraint — explicitly penalises default-AI aesthetics |
| 04 | **Figma → Code** | *(disabled)* Layout fidelity via Figma MCP. Needs a frame URL and an agentic harness |
| 05 | **Playable 3D Game** | A complete loop, game feel, collision, frame-rate independence |
| 06 | **Open Creative Brief** | No subject at all. Half the score is what the model thought was worth building |
| 07 | **Sell Yourself** | The model markets *itself* to you. Self-knowledge, persuasion, and honesty under pressure |
| 08 | **Accessible Interface** | A cinema seat map to WCAG 2.2 AA. The hardest common a11y widget there is |
| 09 | **Brownfield Change Request** | Three tickets against an existing file. Scored on the diff — restraint, not rewriting |
| 10 | **SVG Icon System** | Eighteen icons drawn by hand in code. One grid, one hand, a node budget |
| 11 | **Stateful Application** | A scheduler with real rules. Undo/redo, bulk ops, keyboard parity, the skipped states |
| 12 | **Zero JavaScript** | No `<script>` at all. Closes the gap where every other task can be won with flexbox |
| 13 | **HTML Email** | Tables, MSO conditionals, no images. Knowledge that cannot be reasoned from first principles |

Each brief lives in `benchmarks/` and is joined with `benchmarks/_contract.md`, the single-file output contract every model must satisfy. Edit the briefs freely — they are plain markdown and are the highest-leverage thing in the repo.

**09 ships with a fixture.** `fixtures/09-brownfield/source.html` is a working ~700-line application with deliberate house conventions, one genuine bug, and a behaviour change whose call sites are scattered across the file; `tickets.md` is the change request. Both are inlined into the prompt by `loadPrompt()` and the judge sees the same assembly, so it scores the diff rather than the document. **The fixture is fixed for the life of the benchmark — do not regenerate it between runs**, or results stop being comparable.

**13 overrides the shared contract** in two places, both stated at the top of its brief: no CDN references of any kind, and no images at all including data URIs. A browser render tells you almost nothing about an email; score it from the source, or in a client-rendering service.

How the suite is grouped into clusters, weighted per task, and aggregated across runs is in `benchmarks/SCORING.md`. That document governs the write-up; the live panel keeps its own four axes and `config/scoring.json` is the authority for what the judges actually run on — §0 of SCORING.md explains how the two layers map.

To re-enable Figma: put a frame URL in `config/figma.json` and set `disabled: false` in `config/benchmarks.json`. It runs in `manual` mode — you produce the file in Claude Code or Cursor and drop it at `runs/<run>/<model>/04-figma-to-code/index.html`; scoring is identical.

---

## The judge quorum

One LLM judge is a single point of failure with a single set of blind spots. This uses a **panel of three, from three different labs**, each with a different lens:

- **Craft** — an award-jury design director (Claude Opus 5)
- **Engineering** — a graphics engineer reading the source for faked effects (GPT-5.6 Terra)
- **Brief** — the client, checking every stated requirement (Grok 4.5)

Each judge scores all four axes independently, sees screenshots plus source plus the gate measurements, and never learns which model produced what. Scores aggregate by **median, per axis** — so one outlier judge cannot drag a result — and the **spread is kept**, so you can see where the panel genuinely disagreed instead of trusting a consensus that does not exist. A result where judges differ by 4+ on an axis is flagged `panel split` and surfaced first in the CLI output.

Configure in `config/judges.json`. Use an odd number so the median is a score a real judge actually gave. Judges without an API key are skipped; the panel needs `minJudges` to produce a verdict.

---

## Auditing the judges

```bash
npm run audit                              # on 07-self-pitch (authorship disclosed)
npm run audit -- --bench 01-threejs-scroll # control: authorship hidden
```

Every rostered model scores every submission, using the ordinary judging prompt with a neutral lens — **the models are not told they are being evaluated**. What comes back is a picture of each model *as a judge*:

- **self-bias** — how much better it scored its own work than the rest of the panel did, **net of its own leniency**. A uniformly generous judge is not dishonest; a judge generous only to itself is.
- **vendor bias** — the same measurement across same-vendor siblings
- **leniency / discrimination / agreement** — is it calibrated, does it differentiate at all, does it track the panel

The self-pitch benchmark is the sharp probe, because there every page names its own author and a judge always knows whose work it is looking at. Run the audit on a benchmark where authorship is hidden and you have the control: **bias that appears only when the byline is visible is a preference, not noise.** Audit scores are written to `results/<run>/judge-audit.json` and never touch the official quorum.

---

## Blind review

The human column is collected blind, because a scoreboard that shows "Claude Opus 5" next to a slider is not measuring the artefact.

The blind page receives **no model identities at all** — not in the DOM, not in a payload, not in the asset URLs. Every submission is an opaque token resolved server-side, links go through `/s/<run>/<token>/…`, and names only arrive when you press **Reveal**, per benchmark, after you have rated everything in it. Reveal then shows your ranking beside the judges'.

Ratings are marked `blind: true` so you can tell later which ones were honest.

---

## Run history and the all-time view

Every run is kept forever under `runs/<runId>/`. Nothing is overwritten.

Runs will usually **not** contain the whole roster — when a model ships you run just that one. So the **Overall** tab pools every run on record: each (model, benchmark) pair is averaged across however many times it has been run, with the sample count `n` attached so a single sample is never mistaken for a settled number. That is where a newly-added model gets compared against everything that came before it, and a line chart tracks overall quality per run over time.

```bash
npm run bench -- --model some-new-model --note "shipped today"
# → new run containing one model; Overall compares it with the entire back-catalogue
```

The per-run **Scoreboard** stays useful for the detail of a single session; **Overall** is the view that matters once runs stop containing everything.

```
runs/2026-07-26-1432/claude-opus-5/02-webgl-shader/
  index.html          the deliverable
  meta.json           tokens, latency, bytes, contract violations
  gates.json          every check with its detail
  judge.json          all judge verdicts + per-axis median and spread
  shots/              initial, after-interaction, settled
results/2026-07-26-1432/
  human.json          your ratings
  scores.json         the computed leaderboard
  judge-audit.json    judge behaviour, if audited
```

---

## Adding a model

One entry in `config/models.json`, then `npm run bench -- --model <id>`.

```jsonc
{
  "id": "some-new-model",
  "label": "Some New Model",
  "provider": "openai-compatible",       // or "anthropic", or "manual"
  "model": "vendor/some-new-model",
  "baseURL": "https://openrouter.ai/api/v1",
  "apiKeyEnv": "OPENROUTER_API_KEY",
  "vendor": "somelab",                   // used for vendor-bias detection
  "params": { "max_tokens": 64000 }      // passed through verbatim
}
```

`provider: "manual"` covers models with no public API — Cursor Composer, for instance. See below.

`params` is passed straight through, which matters: Claude Opus 5 and Sonnet 5 take `thinking: {type: "adaptive"}` with `output_config.effort`, while **Haiku 4.5 predates both** and needs the older `budget_tokens` form — sending it `effort` returns a 400.

---

## Running a manual model (Cursor Composer)

Composer only exists inside Cursor, so it cannot be driven over an API. `npm run manual` sets up the folders for you:

```bash
npm run manual -- --model cursor-composer-2.5                    # writes every brief + shows the checklist
npm run manual -- --model cursor-composer-2.5 --bench 02 --copy  # copies one brief to the clipboard (macOS)
```

It creates one folder per benchmark containing `PROMPT.md` — **byte-identical to what the API models received**, brief plus output contract, no edits — and tells you exactly where to save the result:

```
runs/<run>/cursor-composer-2.5/02-webgl-shader/
  PROMPT.md     ← paste this into Cursor
  index.html    ← save Composer's output here
```

Then score it like anything else:

```bash
npm run bench -- --model cursor-composer-2.5 --run <run-id>
```

Re-running `npm run manual` shows a checklist of which benchmarks still need a file. Two things to keep it fair: paste the brief **verbatim** and don't iterate with Composer — the API models got exactly one shot with no follow-up turn, so a Composer result you refined over five messages is measuring something different.

---

## Notes and caveats

- **Generation and judging run everything in parallel by default.** Wall-clock is the slowest single generation, not the sum — seven models on one brief finished in the time the slowest took. Throttle with `--concurrency N` if a provider rate-limits you.
- **Gates are deliberately serial, and run headed.** Parallel pages compete for the GPU and corrupt the frame-rate measurement, and headless Chromium falls back to software rendering, which makes FPS meaningless for WebGL work. `--headless` exists and warns you.
- **Benchmarks only score the checks they declare.** A static landing page is not marked down for having no frame rate.
- **`fps` is measured on your machine's GPU.** Numbers are comparable within a run, not across machines.
- **An unrated result still gets a score**, with the human weight redistributed — but it is flagged provisional everywhere, and `npm run score` tells you how many are outstanding.
- **GLM 5.2 runs on your Z.ai coding-plan endpoint** (`/api/coding/paas/v4`), not the pay-as-you-go one. The plan rate-limits, so it can 429 under a parallel run — retry it alone, or swap that entry to OpenRouter.
- **The judges are LLMs.** They are consistent and specific, but they are not the ground truth. That is what the human column is for, and why it carries 30%.
