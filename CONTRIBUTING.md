# Contributing

Thanks for taking an interest. This benchmark is useful in direct proportion to how much it can be trusted, so most of the rules below are about keeping results comparable across runs.

## What we welcome

- **New models.** One entry in `config/models.json`, a probe that shows the ID resolves, and a run. See [Adding a model](README.md#adding-a-model). Please include the verified catalog ID, list price at run time, output ceiling, and any quirks (reasoning inside the output budget, vision support, retention requirements) in the entry's `$comment`.
- **New briefs.** Open an issue first using the *Brief proposal* template. A good brief separates models on something the existing twelve don't, has a deterministic output contract, and can be gated in a browser. Briefs are plain markdown in `benchmarks/`; the judge notes live in `config/benchmarks.json`.
- **Harness fixes.** Gates, judging, scoring, the report UI. Keep stages independent: `generate → gates → judge → score` must each be re-runnable on their own against a run directory.
- **Measurement defects.** If you find one, open an issue with the cell(s) affected and how to reproduce. We publish every defect we find in the study write-up; yours will be credited.

## What we don't change lightly

- **The twelve published briefs and `_contract.md`.** Editing a brief breaks comparability with every run on record. If a brief needs to change, it becomes a new brief with a new id.
- **The fixture for brief 09.** `fixtures/09-brownfield/` is frozen for the life of the benchmark.
- **Scoring weights** in `config/scoring.json`. Changes require a re-score of all runs and a note in the changelog.
- **The judge panel.** Three labs, three lenses, median per axis. Swapping a judge model is a new era; say so in the run note.

## Running locally

```bash
npm install          # also fetches Chromium for Playwright
cp .env.example .env # add the keys for the providers you want to run
npm test             # validates the config files and brief set
npm start            # interactive picker
```

Gates run **headed** on a real GPU and serially by design; frame-rate numbers from a headless or parallel run are not comparable.

## Pull requests

- One concern per PR.
- Run `npm test` before opening it.
- If the PR changes anything that affects scores, say which runs you re-scored and attach the before/after leaderboard.
- Keep `$comment` fields in the config files current; they are the operator documentation.

## Reporting results

If you publish results from this harness, please link the run id, the exact config, and the brief set version, and state whether human ratings were included. Partial runs (a model that delivered fewer than twelve briefs) must say so.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
