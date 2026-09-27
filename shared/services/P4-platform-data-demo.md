# P4 Platform, Data & Demo: what this split provides
Full brief: [docs/team/P4-platform-data-demo.md](../../docs/team/P4-platform-data-demo.md) · Paths: `infra/`, `data/`, `scripts/`, `knowledge/mosaic_knowledge/ingestion/`, `execution/mosaic_execution/browser/`, `execution/images/sandbox-browser/`, `models/mosaic_models/gpu/`

| Provides | Kind | Consumers | Fake until ready | Contract |
|---|---|---|---|---|
| `SourceConverter`s (markdown, jira-json, slack-export, csv, [document]) | interface | P2 ingest pipeline | `FakeMarkdownConverter` | `SourceConverterContract` |
| `BrowserDriver` (Playwright → sandbox) + `mosaic/sandbox-browser` image | interface + image | P1 executor | `FakeBrowserDriver` | `BrowserDriverContract` |
| `ResourceProbe` (CPU/RAM/GPU) | interface | P1 `/system/resources`, ai-top | `FakeResourceProbe` | `ResourceProbeContract` |
| RTX appliance (Ubuntu, drivers, toolkit, compose, Ollama models, systemd, `/sovereign-data`) | platform | everyone | dev laptops | boot → `ready: true` |
| `data/okf` demo bundle (+ `QA.md`) | data | P2 QA, P3 answers | `shared/fixtures/okf` | validates cleanly |
| `vendor-docs` offline site | compose service | P3 research agent via browser | fake page | — |
| Demo script, QA checklist, backup recording | docs/video | team | — | — |

## Status (owner keeps this current)
| Item | Status |
|---|---|
| RTX box: drivers · Docker · toolkit · Ollama models | ☐ |
| Resource probe | ☐ |
| Converters: markdown · jira-json · slack · csv | ☐ |
| Browser image + driver + vendor-docs | ☐ |
| data/okf ≥ 30 (M1) / ≥ 60 (M3) files + QA.md | ☐ / ☐ |
| systemd boot + LAN access | ☐ |
| Demo script · 3 rehearsals · backup video | ☐ |
