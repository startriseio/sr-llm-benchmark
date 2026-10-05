# Security

## Scope

This repository is a benchmarking harness that calls third-party model APIs with keys you supply and drives model-generated HTML in a local browser. Two things deserve care:

1. **API keys.** Keys are read from `.env`, which is git-ignored. Never commit a key, and never paste one into an issue. If a key leaks, rotate it at the provider first and tell us second.
2. **Model-generated deliverables.** Every file under `runs/` was written by a model and is executed, untouched, in headed Chromium during the gates stage and in a sandboxed `<iframe sandbox="allow-scripts allow-pointer-lock">` in the report UI. Treat `runs/` as untrusted content. Don't open deliverables outside the sandbox on a machine you care about without reading them first.

## Reporting a vulnerability

Email **hello@startrise.io** with the subject `sr-llm-benchmark security`. Please include the affected file or stage, a reproduction, and whether it involves a model-generated deliverable. We aim to acknowledge within three business days.

Please do not open a public issue for anything that could expose keys or allow code execution outside the sandbox.
