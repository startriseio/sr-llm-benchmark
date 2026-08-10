# What Twelve Models Cost

### An economics companion to the capability study — run `2026-07-26-0159`

---

## The short answer

**Total spend to generate all 144 deliverables: $70.76.**

Two models account for **$44.11 of that — 62% — for two of the twelve rows.** Claude Opus 5 and Claude Fable 5 cost more between them than the other ten models combined, several times over.

If you want the single number: **GLM 5.2 delivers 88% of the winner's quality for 3% of the winner's price.**

---

## 1. What each model cost

Prices are per million tokens, taken live from the provider at run time. Anthropic models are billed direct; everything else routes through OpenRouter. Sonnet 5 is priced at its introductory rate ($2/$10), valid through 2026-08-31 — at standard rates ($3/$15) its cost here would be **$13.89** rather than $9.26.

| model | $/M in | $/M out | input tok | output tok | **cost** | score |
|---|---|---|---|---|---|---|
| DeepSeek V4 Pro | 0.435 | 0.870 | 25,104 | 215,448 | **$0.20** | 55.3 |
| GPT-5.6 Luna | 1.00 | 6.00 | 24,428 | 74,075 | **$0.47** | 65.0 |
| GLM 5.2 | 0.675 | 2.121 | 24,711 | 286,749 | **$0.63** | 72.1 |
| Claude Haiku 4.5 | 1.00 | 5.00 | 28,805 | 142,116 | **$0.74** | 44.8 |
| Grok 4.5 | 2.00 | 6.00 | 27,665 | 149,158 | **$0.95** | 68.0 |
| Qwen 3.7 Max | 1.475 | 4.425 | 26,461 | 286,261 | **$1.31** | 63.6 |
| GPT-5.6 Terra | 2.50 | 15.00 | 24,428 | 98,613 | **$1.54** | 66.9 |
| GPT-5.6 Sol | 5.00 | 30.00 | 24,428 | 142,334 | **$4.39** | 66.2 |
| Kimi K3 | 3.00 | 15.00 | 25,369 | 472,962 | **$7.17** | 79.8 |
| Claude Sonnet 5 | 2.00 | 10.00 | 36,835 | 918,978 | **$9.26** | 66.6 |
| Claude Opus 5 | 5.00 | 25.00 | 36,835 | 803,391 | **$20.27** | 82.3 |
| Claude Fable 5 | 10.00 | 50.00 | 36,835 | 469,422 | **$23.84** | 73.8 |

**Input is irrelevant.** Every model received between 24,428 and 36,835 input tokens across all twelve briefs — the prompts are nearly identical in size, and input never exceeds $0.37 for any model. **Cost in this benchmark is almost purely a function of output volume × output price.** That is worth internalising: for generative build work, the output rate on a pricing page is the number that matters, and the input rate is nearly decorative.

### The list price is not the bill

The most counterintuitive result in this table: **Claude Fable 5 is priced at exactly twice Claude Opus 5 — $10/$50 against $5/$25 — and cost only 17.6% more.** $23.84 against $20.27.

Fable wrote 42% less. 469,422 output tokens against Opus's 803,391. Double the rate multiplied by 0.58 the volume is 1.17 the bill, and the arithmetic converges almost exactly.

This is not an isolated quirk. **Three pairs in this study invert** — the model with the *cheaper* output rate produced the *larger* invoice:

| pair | cheaper per token | actual spend | why |
|---|---|---|---|
| Haiku 4.5 ($5/M) vs **GPT-5.6 Luna** ($6/M) | Haiku, by 17% | **$0.74 vs $0.47** | Haiku wrote 1.92× the tokens |
| Sonnet 5 ($10/M) vs **Kimi K3** ($15/M) | Sonnet, by 33% | **$9.26 vs $7.17** | Sonnet wrote 1.94× the tokens |
| **Opus 5** ($25/M) vs Fable 5 ($50/M) | Opus, by 50% | $20.27 vs $23.84 | Fable wrote 0.58× the tokens |

**A model's verbosity is as much a cost driver as its price, and it is not on any pricing page.** Two models on the same rate card can differ 2× in spend on identical work, and a rate-card comparison will rank them backwards. The only way to know is to run your own workload and measure the output tokens — which, for a benchmark of twelve briefs, costs less than a lunch.

The practical form of this: **budget in output tokens per task, not dollars per million.** Luna needs ~6,200 output tokens for one of these briefs; Sonnet 5 needs ~76,600. That ratio, not the price column, is what determines your bill.

---

## 2. Value ranking — dollars per 100 points of quality

| rank | model | score | cost | **$ per 100 pts** |
|---|---|---|---|---|
| 1 | **DeepSeek V4 Pro** | 55.3 | $0.20 | **$0.36** |
| 2 | **GPT-5.6 Luna** | 65.0 | $0.47 | **$0.72** |
| 3 | **GLM 5.2** | 72.1 | $0.63 | **$0.87** |
| 4 | Grok 4.5 | 68.0 | $0.95 | $1.40 |
| 5 | Claude Haiku 4.5 | 44.8 | $0.74 | $1.65 |
| 6 | Qwen 3.7 Max | 63.6 | $1.31 | $2.05 |
| 7 | GPT-5.6 Terra | 66.9 | $1.54 | $2.30 |
| 8 | GPT-5.6 Sol | 66.2 | $4.39 | $6.63 |
| 9 | Kimi K3 | 79.8 | $7.17 | $8.99 |
| 10 | Claude Sonnet 5 | 66.6 | $9.26 | $13.91 |
| 11 | Claude Opus 5 | 82.3 | $20.27 | $24.63 |
| 12 | Claude Fable 5 | 73.8 | $23.84 | $32.30 |

**The spread is 90×.** DeepSeek buys a point of quality for $0.0036; Fable pays $0.324 for the same point.

**Do not read this ranking naively.** It rewards cheapness, and quality is not linear — a 55 is not "two thirds of an 82" in any way that matters to a shipped product. The ranking answers *"what does a marginal point cost?"*, not *"what should I build on?"* Sections 3 and 4 answer that.

---

## 3. The efficient frontier

Strip out every model that another model beats on **both** price and quality, and four remain:

| model | score | cost | why it survives |
|---|---|---|---|
| **DeepSeek V4 Pro** | 55.3 | $0.20 | Nothing is cheaper |
| **GPT-5.6 Luna** | 65.0 | $0.47 | +9.7 points for +$0.27 |
| **GLM 5.2** | 72.1 | $0.63 | +7.4 points for +$0.16 |
| **Claude Opus 5** | 82.3 | $20.27 | Nothing scores higher |

Everything else is dominated. **Kimi K3 (79.8, $7.17) is the only near-miss** — it is beaten only by Opus, and costs a third as much, so if the top of the table matters and Opus's price does not fit, Kimi is the fallback.

The steps between frontier points tell the real story:

- **DeepSeek → Luna**: +9.7 points for **2.8 cents per point**
- **Luna → GLM**: +7.4 points for **2.2 cents per point**
- **GLM → Opus**: +10.2 points for **$1.93 per point** — an 88× jump in marginal cost

**The frontier is nearly flat up to GLM 5.2 and then goes vertical.** Every point of quality up to ~72 is close to free. Every point above it is expensive. If your work tolerates a 72, you are paying $0.63; if it demands an 82, you are paying $20.27 — and the ten points in between cost more than thirty times everything that came before.

---

## 4. Waste

Three kinds of waste showed up, and they are worth separating because only one is the model's fault.

### Tokens spent on unusable output

Deliverables that truncated mid-document are a total loss — the file has no closing `</html>` and fails the contract outright:

| model | task(s) | wasted tokens | wasted cost |
|---|---|---|---|
| **Claude Sonnet 5** | `08-accessible` + `11-stateful-app` | **256,000** | **$2.56** |
| Grok 4.5 | `08-accessible` | 13,011 | $0.08 |

**Sonnet 5 burned $2.56 — 28% of its entire benchmark spend — producing two files that cannot be opened.** It generated more output than any other model in the study (918,978 tokens, more than Opus) and turned a quarter of that budget into nothing. That is the single worst efficiency result here, and it is why Sonnet 5 places 7th on quality and 10th on value despite an axis profile matching models above it.

### Verbosity that buys nothing

Comparing output volume against score across the field, the correlation is weak — and in the top half it inverts:

| model | output tok | score |
|---|---|---|
| Claude Sonnet 5 | 918,978 | 66.6 |
| Claude Opus 5 | 803,391 | 82.3 |
| Kimi K3 | 472,962 | 79.8 |
| Claude Fable 5 | 469,422 | 73.8 |
| GLM 5.2 | 286,749 | 72.1 |
| GPT-5.6 Luna | **74,075** | 65.0 |

**Luna scores 65.0 on 74,075 tokens. Sonnet 5 scores 66.6 on 918,978** — 12.4× the output for 1.6 more points. **GLM reaches 72.1 on less than a third of Sonnet's tokens.** More writing is not more quality; past a point it is a liability, because the ceiling is fixed and verbosity is what pushes a deliverable through it.

### Waste the harness caused

Not the models' fault, and the largest single item of the day.

**GLM 5.2 was configured with `max_tokens: 64000`.** It spends its output budget on reasoning before emitting content, so it exhausted the budget mid-thought: one task produced 2kb after ten minutes, another returned an entirely empty body with `finish_reason: length`. Across two abandoned attempts it consumed hours of wall clock and produced eight files of which two were junk — all discarded and regenerated.

OpenRouter publishes `max_completion_tokens: 131072` for this model. **The ceiling was ours, not the model's.** Raised to 128,000, GLM completed all twelve tasks in fourteen minutes with zero truncation, posted the highest technical score in the study, and cost **$0.63**.

Separately, the OpenAI-compatible provider path made blocking requests with a 30-minute timeout and three retries, so a slow generation could burn up to four full attempts — every one billed — before erroring. Both are now fixed. The lesson is uncomfortable and general: **a misconfigured harness will bill you for a model's failure and then report it as the model's fault.**

---

## 5. What the judging cost

Generation was the cheap half. The full run also spent:

- **432 judge verdicts** (144 cells × 3 judges), each carrying up to 90,000 characters of source plus three screenshots — roughly 30–40k input tokens per call.
- **839 judge-audit calls**, where every model in the roster scored every other model's work across all twelve tasks.

The audit alone is the largest line item of the entire exercise — **roughly two thirds of total spend** — and it is optional. It exists to measure judge bias, and the README describes it as a spot-check on one task plus one control. Run across all twelve benchmarks with eleven judges it becomes 839 calls; run as designed it is about 180.

**If you re-run this suite and want to control cost, the order of leverage is:**

1. **Scope the judge audit** to two benchmarks, not twelve. Saves ~80% of the largest line item.
2. **Trim what each judge call ships** — `MAX_SOURCE_CHARS` is 90,000 and every call sends three screenshots.
3. **Reconsider the panel**. The Craft judge is Opus 5, invoked on all 144 cells.
4. Generation itself is close to noise by comparison, unless you are running Opus or Fable.

---

## 6. Recommendations by budget

**Under $1 for a full suite — GLM 5.2.** 72.1 quality, $0.63, highest technical score in the study. Give it 128k `max_tokens`; expect it to wrap deliverables in explanatory prose, which is a stable trait across two providers and costs it adherence points. Nothing else near this price is close.

**Highest quality regardless of price — Claude Opus 5.** 82.3, wins 8 of 12 tasks, podiums on all twelve, and is the only model that never has a bad day. $20.27. Note it also sat on its own judging panel, so treat its margin over Kimi K3 as a tie.

**High quality on a real budget — Kimi K3.** 79.8 for $7.17, and the cleanest source in the study by a distance (11 red flags against Haiku's 114). The catch is latency: **3 hours 43 minutes** for twelve tasks, the slowest in the field. Fine for batch, unusable interactively.

**Volume work — GPT-5.6 Luna.** 65.0 for $0.47 and the whole suite in seven and a half minutes. If you are running thousands of these a day and "good" beats "excellent", this is the pick.

**Avoid on value grounds — Claude Fable 5.** The worst value in the field: more expensive than Opus ($23.84 vs $20.27) and 8.5 points behind. It earns its place only if you specifically need the three open-subject briefs it wins, where it beats everything including Opus. That is a real strength, but it is a narrow one at $50 per million output tokens.

**Avoid — Claude Sonnet 5 at current settings.** 10th on value, wasted 28% of its spend on truncated files, and generated more output than any model in the study for a mid-table score. Much of this is a `max_tokens` configuration failure rather than a model failure, and it deserves a re-run with a higher ceiling before being judged on these numbers.

---

## 7. Caveats

**N=1.** Every task ran once per model. Token counts, and therefore costs, will vary run to run — particularly for reasoning models, where output volume is not stable. Treat these figures as one sample, not a rate card.

**Prices move.** OpenRouter rates were read live at run time; Anthropic rates are first-party list. Sonnet 5's figure uses introductory pricing that expires 2026-08-31.

**Quality scores carry their own error bars.** The $/point ranking inherits every limitation of the capability study — single-shot, 106 of 144 cells human-reviewed, and a judging panel that includes three models from the field being judged. Differences of a few points in the score column are not real, so differences of a few cents in the value column are not either.

**Cost excludes failed and abandoned attempts** except where noted. The real spend for this run was higher than $70.76 — GLM alone was generated three times.

---

*Companion to [STUDY.md](STUDY.md). Raw data in `results/2026-07-26-0159/scores.json` and `runs/2026-07-26-0159/`.*
