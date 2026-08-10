# Scoring Protocol

**Audience: whoever is analysing a run.** This defines the pipeline, the axes, the scale, and the rules the analysis is held to. Deviating from it makes runs non-comparable, which is the only way this benchmark can fail outright.

---

## 0. How this document relates to the runner

This is the **analysis protocol**. It is not the configuration the automated panel runs on, and the two are deliberately not the same thing. Do not "reconcile" them by editing the runner.

| | Automated panel (`config/scoring.json`) | This document |
|---|---|---|
| Axes | 4 — craft, technique, adherence, originality | 5 — C, R, D, A, B |
| Scale | 0–10 per axis | 0–5 integers |
| Weighting | flat across axes, then blended 25% gate / 45% panel / 30% human | per-task weights, §6 |
| Output | one score per artefact | a four-cluster profile, §1 |

The panel's four axes map onto this document's five: **adherence → C**, **technique → R**, **craft → D**, **originality → A**. There is no panel axis for **B (robustness)** because robustness is measured rather than opined on — it arrives through the automated gate column and through the per-task hard checks in §6.

So: the panel produces the raw per-artefact numbers, and this document governs how those numbers, the gate results, and the human column are aggregated and written up. Task-specific emphasis reaches the panel through each benchmark's `judgeNote` in `config/benchmarks.json`, which is where the §6 weighting is expressed in a form the live judges actually see. When you change a weight here, change the corresponding `judgeNote` too, or the two layers drift apart.

---

## 1. What this benchmark measures

Frontend and interface capability, broadly defined: creative coding, visual taste, interface engineering, and engineering discipline. It does not measure general reasoning, backend work, or agentic tool use, and it should never be reported as if it does.

The output is not a single number. It is a **profile across four clusters**, plus two isolated tasks that never enter the headline figure.

| Cluster | Tasks |
|---|---|
| Creative coding | 01 three.js scroll, 02 WebGL shader, 06 open creative |
| Design & taste | 03 landing page, 10 SVG icon system, 12 zero JavaScript |
| Interface engineering | 08 accessible interface, 11 stateful application |
| Engineering discipline | 05 3D game, 09 brownfield change, 13 HTML email |
| **Isolated — reported separately** | 04 Figma→code, 07 self-pitch |

**04** measures the harness, not the model, and is only comparable between runs on the same harness. **07** measures self-knowledge, which depends heavily on what a provider puts in a system prompt; it is interesting and it is not a capability score. Neither is averaged into anything.

---

## 2. Pipeline

Run in this order. Never score craft before the gate has been applied.

### Stage 0 — Automated gate (pass/fail, no human judgment)

Scripted, run on every artefact before a judge sees it:

1. Exactly one HTML document was returned, inside one fenced block, with no commentary outside it.
2. Opens from `file://` and renders without a build step.
3. Zero uncaught exceptions and zero console errors during a 60-second scripted interaction pass.
4. No network requests to hosts outside the CDN allowlist. No non-CDN external references.
5. No `TODO`, `FIXME`, `placeholder`, or "in a real implementation" strings.
6. No permission prompts fired.
7. Task-specific hard checks (see §6) — for example, zero `<script>` tags on task 12, node budget on task 10.

**A gate failure caps the run's total at 40%** and is recorded with the specific clause breached. Do not "score it as if" the contract were met. Do not repair the artefact and score the repair. If it does not run, the craft axes are scored on what does run, and the missing parts score zero.

### Stage 1 — Blind independent scoring

Each artefact is scored by **two judging agents independently**, with no access to the model identity, the other judge's scores, or any other run. Artefacts are shuffled per task. Score every axis before totalling; never total first and back-fill.

### Stage 2 — Reconciliation

Where the two judges differ by **2 or more points on any axis**, a third pass resolves it by re-examining the artefact against the evidence both wrote. Disagreement is resolved by evidence, never by averaging.

### Stage 3 — Aggregation

See §5.

---

## 3. The axes

Five axes. Not all apply to every task; weights are in §6, and `—` means the axis is not scored for that task.

**C — Brief compliance.** Did it do what was asked, in full? Every explicit requirement in the brief is a checklist item. Requirements silently dropped, requirements reinterpreted into something easier, and requirements claimed in a comment but not implemented all cost here.

**R — Craft & correctness.** Does it work, and is the code sound? Correct maths, sane architecture, handled edge cases, no resource leaks, no per-frame allocation in a hot path, frame-rate independence where relevant, code a competent reviewer would approve.

**D — Design & taste.** Typography, colour, layout, rhythm, restraint, motion. Whether it looks like someone with judgment made deliberate choices, or like the median output of a model that has seen a lot of landing pages.

**A — Idea & ambition.** Did it take a real swing? Is the concept a thought rather than a template? Reserved for tasks where the model chooses the subject.

**B — Robustness.** Resize, device pixel ratio, 390px, keyboard, accessibility floor, performance under load, degraded browsers, adversarial input. What happens when the judge tries to break it.

---

## 4. The scale

**0–5 integers only. No halves.** Unanchored ten-point scales produce mush; halves are a way of avoiding a decision.

| | |
|---|---|
| **5** | Exceptional. Would be held up as an example of how to do this. Rare — expect a handful across an entire suite run. |
| **4** | Strong. A professional would ship this. Minor flaws, no significant ones. |
| **3** | Competent. Does the job. Nothing wrong, nothing memorable. This is the honest centre and most work belongs here. |
| **2** | Flawed. Recognisably attempts the axis but a real problem is visible on inspection. |
| **1** | Poor. Attempted and largely failed, or so generic as to carry no information. |
| **0** | Absent, or actively broken. |

**Calibration rule:** 3 is the default. Start every axis at 3 and move only with a reason you can write down. A run where most axes are 4s is a mis-calibrated judge, not an exceptional model.

---

## 5. Aggregation

1. **Per task, per axis:** the reconciled score from Stage 2.
2. **Per task total:** weighted mean of axes using §6 weights, expressed as a percentage of the maximum.
3. **Across the N runs of a task:** take the **median**, not the mean. Creative tasks have heavy tails and one catastrophic run should not sink a model that produces good work four times in five.
4. **Per cluster:** unweighted mean of its task medians.
5. **Headline:** unweighted mean of the four cluster scores. Clusters are equally weighted so that a model cannot win the suite on WebGL alone.

**Run N = 3 minimum, N = 5 preferred.** Report the interquartile range alongside every task median. **Variance is a reported result, not noise** — a model that scores 85/40/80 is a different proposition from one that scores 68/70/69, and for production use the second is often the better choice. Say so in the write-up.

Also report, separately and always:

- **Gate pass rate** per model across all tasks. This is frequently the single most decision-relevant number in the whole report.
- The **axis profile** — mean C/R/D/A/B across the suite. Models have distinct shapes here and the shape is more useful to a reader than the total.

---

## 6. Task weights and hard checks

| Task | C | R | D | A | B | Automated hard checks |
|---|---|---|---|---|---|---|
| 01 three.js scroll | 15 | 25 | 30 | 20 | 10 | DPR clamped; reverse scroll restores state; no per-frame geometry allocation |
| 02 WebGL shader | 10 | 30 | 25 | 25 | 10 | Fragment shader does the work; ≥30fps at 1440×900; graceful no-WebGL path |
| 03 landing page | 15 | 15 | 45 | 15 | 10 | No external images; renders at 390px; contrast pass |
| 05 3D game | 10 | 30 | 15 | 20 | 25 | Delta-time verified at 60/144Hz; full state loop reachable; no score after death |
| 06 open creative | 5 | 25 | 25 | 40 | 5 | Interactive; works offline; not on the excluded-ideas list in the brief |
| 08 accessible interface | 35 | 30 | 15 | — | 20 | Zero axe violations; full keyboard traversal; 320px reflow; target size |
| 09 brownfield change | 40 | 35 | 5 | — | 20 | Diff size vs. reference minimum; all tickets satisfied; zero regressions |
| 10 SVG icon system | 20 | 30 | 40 | 5 | 5 | No raster/`<image>`/glyphs; ≤24 path commands per icon; <12KB gzipped |
| 11 stateful application | 15 | 35 | 20 | 10 | 20 | Undo/redo across 20 scripted ops; lossless export/import round-trip |
| 12 zero JavaScript | 30 | 30 | 30 | 5 | 5 | Zero `<script>` tags; zero inline handlers; keyboard operable |
| 13 HTML email | 35 | 30 | 25 | — | 10 | Zero images and zero data URIs; no CDN or hosted webfont; correct with `<style>` stripped; under 102KB |

Task **04** is scored on Fidelity (60), R (25), B (15) and reported only against other runs on the same harness. Task **07** is scored on Honesty (50), argument quality (25), D (25); any fabricated statistic, benchmark figure, testimonial, or customer name sets Honesty to 0 regardless of the rest of the page.

---

## 7. Rules for judges

**Write the evidence before the number.** Every axis score requires at least one specific, checkable observation — what you did, what happened, where in the file. "Feels polished" is not a score. If you cannot write the evidence, you have not judged it.

**Judge the artefact, never the comments.** A comment claiming a feature is not the feature. A README-style preamble describing sophistication you did not observe is worth nothing, and if it describes something absent it is a compliance failure.

**Interact before scoring.** Every artefact gets a real session: resize it, hit it with the keyboard, take it to 390px, try to break the state, scroll it backwards, restart it. Screenshots are not judging.

**Known biases to correct for, actively:**

- *Length bias.* More code is not more quality. A 300-line answer that does the job beats a 2,000-line one that does the same job.
- *Complexity bias.* Ambition is only rewarded where it lands. An elaborate system that stutters scores below a simple one that is perfect.
- *First-frame bias.* A striking opening view is one moment. Score the whole artefact, especially the states a judge has to work to reach.
- *Familiarity bias.* You will recognise house styles. Recognition is not quality, and if you find yourself confident you know which model wrote something, that is a reason to slow down, not to score faster.
- *Concept forgiveness.* Do not award craft points for a good idea. That is what axis A is for, and it is deliberately separate.

**Do not compare across models on the first pass.** Score each artefact against the brief in isolation. Comparison happens after all scores are in, and only as a calibration check — if the ordering then looks wrong, revisit the evidence, not the numbers.

**Never rescue a run.** Do not fix a syntax error, supply a missing CDN, or evaluate what the model "clearly meant". Judge what was submitted.

---

## 8. Known limits — state these in every report

- Aesthetic scoring is irreducibly subjective. Two-judge reconciliation reduces variance; it does not create objectivity.
- Published briefs enter training data. Maintain a private holdout variant of at least three tasks and report headline figures from public and holdout separately. Divergence between them is the contamination signal.
- Every task is single-shot. Iteration — the failure mode where a model regresses working code across turns — is not measured here and must not be claimed. If you need it, run tasks 03 and 11 in a four-turn harness mode as a separate experiment, with its own protocol.
- Sample sizes are small. Do not report differences of a few percentage points as meaningful. If two models' interquartile ranges overlap, they are tied; write them as tied.
