# P4: Platform, Data & Demo

| Tooling | Review buddy | Skills |
|---|---|---|
| chat assistant + context pack | P1 (reviews your PRs; your browser driver plugs into their executor) | Linux/Ubuntu, NVIDIA drivers, Docker/compose, basic Python, writing realistic documents, presenting |

> **Coding-assistant setup (no Claude Code):**
> 1. `uv run python scripts/context_pack.py P4` → paste or upload `.context/P4-context.md` as the first message (`--lite` for small tools).
> 2. Ask for one file at a time: *"Write `knowledge/mosaic_knowledge/ingestion/converters/jira_json.py` as in §6.3 of my brief."*
> 3. Run the tests yourself and paste failures back. The skeletons below are close to final.
>
> **Start the hardware work on day 1.** Drivers, Docker and GPU passthrough are where time disappears.

---

## 1. Mission
Make mOSaic **real and demo-able**: one RTX machine that boots into the whole stack, a believable organization's knowledge, the pieces that bring outside material in (converters) and let agents see the web safely (browser driver), host resource telemetry, and a rehearsed, failure-proof demo.

## 2. Scope
**You own:** `infra/`, `data/`, `scripts/`, `docs/DEMO_SCRIPT.md`, `knowledge/mosaic_knowledge/ingestion/` + `knowledge/tests/samples/` + `knowledge/tests/test_ingestion_contract.py`, `execution/mosaic_execution/browser/` + `execution/images/sandbox-browser/` + `execution/tests/test_browser_contract.py`, `models/mosaic_models/gpu/` + `models/tests/test_probe_contract.py`.
**Never edit:** other people's code, `shared/fixtures/okf/` (frozen), generated files in `shared/`.

## 3. Inputs: what you consume

| Input | From | Used for |
|---|---|---|
| `IngestRequest` (`source_type`, `uri`, `target_path`, `options`) | P2's `ingest()` calls your converters | converter input |
| `OKFFrontmatter`, `OKFDraft` schemas | shared | converter output |
| `SandboxInfo` with `endpoints["playwright"]` | P1's SandboxManager | where your browser driver connects |
| `models/models.yaml` | P3 | which models to pull into Ollama |
| The Apollo story | `shared/fixtures/okf/`, blueprint §36/§47 | the demo bundle and script |

## 4. Outputs: what you provide

| Output | Interface / artifact | Consumer | Must |
|---|---|---|---|
| Source converters | `SourceConverter` → `list[OKFDraft]`; `ingestion/factory.build_converters` | P2 | pass `SourceConverterContract` for each converter/sample; pure (no writes, no DB, no events) |
| Browser driver | `BrowserDriver` (`open/click/type/screenshot/close`); `browser/factory.build_browser_driver` | P1's executor | pass `BrowserDriverContract`; connect only to the sandbox endpoint; `SANDBOX_FAILED` / `TIMEOUT` errors |
| Browser sandbox image | `mosaic/sandbox-browser:latest` | P1's SandboxManager | Playwright `run-server` on :3000, non-root |
| Resource probe | `ResourceProbe.snapshot() -> ResourceSnapshot`; `gpu/factory.build_resource_probe` | P1 (`/system/resources`, ai-top) | pass `ResourceProbeContract`; < 500 ms, never raises |
| RTX appliance | Ubuntu + drivers + Docker + toolkit + compose + Ollama models + systemd + `/sovereign-data` | everyone | `systemctl start mosaicd` brings up everything |
| Demo OKF bundle | `data/okf/` (40–80 files) | P2 (retrieval QA), P3 (agent answers) | valid frontmatter; contains the facts in §6.6 |
| Offline "vendor website" | `vendor-docs` compose service | P3's research agent via the browser | reachable only from the sandbox network |
| Demo script + QA + recording | `docs/DEMO_SCRIPT.md`, video | the team | rehearsed 3× |

---

## 5. Where your pieces plug in

```text
P2 KnowledgeFS.ingest(req) ──► for conv in services.converters: if conv.can_convert(req): drafts = await conv.convert(req)
                               └─► P2 writes drafts to data/okf, validates, indexes
P1 ToolExecutor(browser.open) ──► SandboxManager.provision(display=True) → SandboxInfo(endpoints={"playwright": ws://…})
                               └─► YOUR BrowserDriver.open(sandbox, url) → BrowserPage (+ screenshot)
P1 GET /system/resources ──► YOUR ResourceProbe.snapshot() → ResourceSnapshot (P1 adds process counters)
```

## 6. Implementation spec (with skeletons)

### 6.1 RTX machine runbook (`infra/appliance/README.md`, `infra/gpu/README.md`)
1. Ubuntu 24.04 LTS. Create a separate ext4 partition, mounted at `/sovereign-data` (fstab or `sovereign-data.mount`), owned by user `mosaic`. Create `okf raw indexes memory agents runs audit policies artifacts`.
2. NVIDIA driver: `sudo ubuntu-drivers install` → reboot → `nvidia-smi` works.
3. Docker Engine + compose plugin (the official apt repo), then add the user to the `docker` group.
4. NVIDIA Container Toolkit, then `sudo nvidia-ctk runtime configure --runtime=docker && sudo systemctl restart docker`. Check with `docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi`.
5. `uv` + the repo in `/opt/mosaic`; `uv sync --all-packages`; `.env` with `MOSAIC_DATA_DIR=/sovereign-data`.
6. `docker compose -f infra/compose/docker-compose.yml up -d postgres redis ollama mock-jira vendor-docs`, then pull the models listed in `models/models.yaml` (`docker exec -it mosaic-ollama-1 ollama pull …`).
7. Build the images: `docker build -t mosaic/sandbox-base execution/images/sandbox-base` and `docker build -t mosaic/sandbox-browser execution/images/sandbox-browser`.
8. `sudo cp infra/systemd/mosaicd.service /etc/systemd/system/ && sudo systemctl enable --now mosaicd`. After a reboot, the gateway must answer on `:8080`.
9. LAN access for teammates' laptops and phones (Tailscale recommended); the MOTD prints the gateway URL.
10. Stretch: an `autoinstall.yaml` that reproduces steps 1–8.

**Acceptance:** after a cold boot, `curl http://<box>:8080/system/status` → `ready: true`, and `nvidia-smi` shows Ollama using the GPU during a run.

### 6.2 Resource probe (`models/mosaic_models/gpu/probe.py`)
```python
import asyncio, time
import psutil
from mosaic_contracts.schema import GpuStatus, ResourceSnapshot

class HostProbe:
    def __init__(self):
        self._gpu_cache: tuple[float, GpuStatus | None] = (0.0, None)
        psutil.cpu_percent(interval=None)                     # prime the CPU counter

    async def _gpu(self) -> GpuStatus | None:
        ts, cached = self._gpu_cache
        if time.monotonic() - ts < 1.0:
            return cached
        try:
            proc = await asyncio.create_subprocess_exec(
                "nvidia-smi", "--query-gpu=name,utilization.gpu,memory.used,memory.total", "--format=csv,noheader,nounits",
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL)
            out, _ = await asyncio.wait_for(proc.communicate(), timeout=1.0)
            name, util, used, total = [x.strip() for x in out.decode().splitlines()[0].split(",")]
            gpu = GpuStatus(name=name, utilization=float(util) / 100, memory_used_mb=int(used), memory_total_mb=int(total))
        except (FileNotFoundError, asyncio.TimeoutError, ValueError, IndexError):
            gpu = None
        self._gpu_cache = (time.monotonic(), gpu)
        return gpu

    async def snapshot(self) -> ResourceSnapshot:
        vm = psutil.virtual_memory()
        return ResourceSnapshot(cpu_percent=psutil.cpu_percent(interval=None),
                                ram_used_mb=(vm.total - vm.available) // 2**20, ram_total_mb=vm.total // 2**20,
                                gpu=await self._gpu())
```
`gpu/factory.py`: `return HostProbe()`. Test: `uv run pytest models/tests/test_probe_contract.py -rs`.

### 6.3 Source converters (`knowledge/mosaic_knowledge/ingestion/converters/`)
Common rules: pure functions, **no file writes**. `okf_file` = `<target_rel>/<name>.md`, where `target_rel = request.target_path.removeprefix("/org").strip("/")`. Frontmatter always includes `type`, `title`, `description`, `tags`, `source`, `source_version` (when known), `trust`, `privacy`. Missing input → `raise MosaicError("BAD_REQUEST", …)`.

```python
# converters/base.py
import re
from pathlib import Path
from mosaic_contracts.errors import MosaicError
from mosaic_contracts.schema import IngestRequest, OKFDraft, OKFFrontmatter

def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60] or "untitled"

def target_rel(req: IngestRequest) -> str:
    return req.target_path.removeprefix("/org").strip("/")

def okf_path(req: IngestRequest, *parts: str) -> str:
    return "/".join(p for p in (target_rel(req), *parts) if p) + ".md"

def require_path(req: IngestRequest) -> Path:
    p = Path(req.uri)
    if not p.exists():
        raise MosaicError("BAD_REQUEST", f"no such file or directory: {req.uri}")
    return p

def draft(okf_file: str, body: str, source_ref: str, **fm) -> OKFDraft:
    return OKFDraft(okf_file=okf_file, frontmatter=OKFFrontmatter.model_validate(fm), body=body, source_ref=source_ref)
```
```python
# converters/jira_json.py
import json
from mosaic_contracts.schema import IngestSourceType
from .base import draft, okf_path, require_path

class JiraJsonConverter:
    name = "jira-json"
    source_types = [IngestSourceType.FILE, IngestSourceType.API]

    def can_convert(self, req):
        return req.uri.endswith(".json") and "jira" in req.uri.lower()

    async def convert(self, req):
        data = json.loads(require_path(req).read_text(encoding="utf-8"))
        drafts = []
        for issue in data.get("issues", []):
            f = issue["fields"]
            status = f.get("status", {}).get("name", "unknown")
            body = (f"# {issue['key']}: {f.get('summary','')}\n\n"
                    f"- **Status:** {status}\n- **Assignee:** {f.get('assignee', {}).get('displayName', '-')}\n"
                    f"- **Due:** {f.get('duedate', '-')}\n\n## Description\n\n{f.get('description','')}\n")
            drafts.append(draft(okf_path(req, "jira", issue["key"].lower()), body, source_ref=issue["key"],
                                type="note", title=f"{issue['key']} {f.get('summary','')}",
                                description=f"Jira issue {issue['key']} ({status})", tags=["jira", *f.get("labels", [])],
                                status=status.lower(), source="jira", source_version=issue["key"], trust="trusted"))
        return drafts
```
- **markdown**: `.md` file or directory; keep existing frontmatter; fill `title` (from the first `#` heading, else the filename), `description` (first paragraph, ≤ 160 chars), `type: note`, `source: markdown`.
- **slack-export**: directory `<channel>/<YYYY-MM-DD>.json` (a list of messages) → one note per channel-day: title `#<channel> <date>`, body = bullets `**user**: text` grouped by `thread_ts`, tags `[slack, <channel>]`, `trust: unverified`.
- **csv**: one file → a Markdown table; `type = options.get("type", "finance" if "budget" in name else "note")`; description = column names.
- *(optional)* **document**: pdf/docx/pptx via `markitdown` (extra `ingest`), `trust: unverified`.

`ingestion/factory.py`: `return [MarkdownConverter(), JiraJsonConverter(), SlackConverter(), CsvConverter()]`, in priority order. Test: `uv run pytest knowledge/tests/test_ingestion_contract.py -rs`, with samples already in `knowledge/tests/samples/`.

### 6.4 Browser sandbox image + driver
The image already exists: `execution/images/sandbox-browser/Dockerfile` (Playwright `run-server` on :3000). **Pin the same Playwright version** as the Python package (`uv run python -c "import playwright; print(playwright.__version__)"`) and change the Dockerfile tag to match.
```python
# execution/mosaic_execution/browser/driver.py
import asyncio
from playwright.async_api import Error as PWError, async_playwright
from mosaic_contracts.errors import MosaicError
from mosaic_contracts.schema import BrowserPage, SandboxInfo

class PlaywrightDriver:
    def __init__(self, nav_timeout_ms: int = 15000):
        self._pw = None
        self._pages: dict[str, tuple] = {}          # sandbox_id -> (browser, context, page)
        self.nav_timeout_ms = nav_timeout_ms

    async def _page(self, sb: SandboxInfo):
        if sb.sandbox_id in self._pages:
            return self._pages[sb.sandbox_id][2]
        endpoint = sb.endpoints.get("playwright")
        if not endpoint:
            raise MosaicError("SANDBOX_FAILED", f"sandbox {sb.sandbox_id} has no playwright endpoint")
        try:
            self._pw = self._pw or await async_playwright().start()
            browser = await self._pw.chromium.connect(endpoint, timeout=10000)
            ctx = await browser.new_context(viewport={"width": 1280, "height": 800})
            page = await ctx.new_page()
        except PWError as e:
            raise MosaicError("SANDBOX_FAILED", f"cannot connect to {endpoint}: {e}") from e
        self._pages[sb.sandbox_id] = (browser, ctx, page)
        return page

    async def _snapshot(self, page) -> BrowserPage:
        text = (await page.inner_text("body"))[:20000]
        links = await page.eval_on_selector_all("a[href]", "els => els.map(e => e.href)")
        return BrowserPage(url=page.url, title=await page.title(), text=text, links=links[:100])

    async def open(self, sb, url):
        page = await self._page(sb)
        try:
            await page.goto(url, timeout=self.nav_timeout_ms)
        except PWError as e:
            raise MosaicError("TIMEOUT", f"navigation to {url} failed: {e}") from e
        return await self._snapshot(page)

    async def click(self, sb, selector):
        page = await self._page(sb); await page.click(selector, timeout=5000); return await self._snapshot(page)

    async def type(self, sb, selector, text):
        page = await self._page(sb); await page.fill(selector, text, timeout=5000); return await self._snapshot(page)

    async def screenshot(self, sb) -> bytes:
        return await (await self._page(sb)).screenshot(type="png")

    async def close(self, sb):
        entry = self._pages.pop(sb.sandbox_id, None)
        if entry:
            await entry[0].close()
```
`browser/factory.py`: `return PlaywrightDriver()`. Test: build the image, then `uv run pytest execution/tests/test_browser_contract.py -rs` (it starts the container itself).

### 6.5 Offline vendor website (`infra/compose/vendor-docs/`)
A static nginx site serving `sdk-v5.html` ("SDK v5 GA moved to 2026-10-20; certification issue; migration guide…"), attached **only** to the internal `sandbox` network. The research agent opens `http://vendor-docs/sdk-v5.html`, which `policies/research-agent-v1.yaml` allowlists. The demo therefore needs no internet.

### 6.6 Demo OKF bundle (`data/okf/`)
Start: `cp -r shared/fixtures/okf/* data/okf/`, then grow it to **40–80 files**. Everything must be consistent with one story: *Apollo is 31% over budget and 6 weeks late*.

| Folder | Add | Why |
|---|---|---|
| `people/` | 8–10 people (Priya: Apollo lead, Marco: Zeus lead, a finance analyst, a CTO…) | owners, `owned_by` graph edges |
| `projects/` | apollo (exists), zeus, hermes, 2 small ones | distractors |
| `finance/` | apollo-budget (exists), q3-forecast, cloud-bill-2026-08, cloud-bill-2026-09, vendor-contracts, payroll-2026 (**confidential**) | finance evidence + privacy demo |
| `engineering/` | 3 weekly status notes, **postmortem: backfill failure (duplicate recon ids)** | engineering root cause |
| `systems/` | payments-api, ledger-db, reconciliation-pipeline, auth | graph |
| `decisions/` | ADR-042 (exists), ADR-039 (ledger schema change), ADR-045 (vendor SDK choice) | decision evidence |
| `policies/` | security (v1, exists), data-access, approvals | policy facts |
| `playbooks/` | incident-response, release, recovery-planning | what the planner cites for the recovery plan |
| `meetings/` | 2 steering-committee notes mentioning the slip | cross-evidence |
| `inbox/` | vendor email with the **prompt injection** (exists) + 2 normal emails | firewall demo |
| `jira/`, `slack/` | produced by **your converters** from `data/raw/` exports | ingestion demo |

**Must-have facts** (each backed by at least two documents): (1) cloud cost doubled by ADR-042 dual-running because the migration slipped; (2) the migration backfill failed on duplicate reconciliation ids (APOLLO-12); (3) vendor SDK v5 blocked on certification (APOLLO-31) → an emergency support contract. Keep `data/demo-assets/security-policy-v2.md` **outside** the bundle, to drop in live for the invalidation demo.
Write the 10 demo questions + expected top-3 paths into `data/okf/QA.md` (P2 turns them into a test).

### 6.7 Demo script (`docs/DEMO_SCRIPT.md`) and QA
The skeleton exists: fill in timings, talking points, the exact prompt, what to click, and a **fallback for every step** (mock gateway replay, recorded video). Rehearse three times at M3. Record a full run as a backup. Before each rehearsal, run the QA checklist (all services healthy, models warm, sandbox images built, `data/okf` indexed).

---

## 7. Ordered task list

| # | Task | Acceptance criteria |
|---|---|---|
| T1 | RTX box: Ubuntu, drivers, Docker, toolkit, compose services, Ollama models (§6.1 steps 1–7) | GPU container test passes; `ollama list` shows the models in `models.yaml` ← do on **day 1** |
| T2 | Resource probe | `ResourceProbeContract` green (on the RTX box, with GPU values) |
| T3 | Markdown + jira-json converters + `build_converters` | `SourceConverterContract` green for both |
| T4 | `data/okf` to ≥ 30 files + `QA.md` | `uv run mosaic-okf validate` (P2's CLI) or `FakeKnowledgeService(Path("data/okf")).validate()` with no errors ← **M1 gate** |
| T5 | Slack + CSV converters; raw exports in `data/raw/` converted into `data/okf/jira`, `data/okf/slack` | contract green; ingested files readable in the UI |
| T6 | Browser image + driver + `vendor-docs` service | `BrowserDriverContract` green; screenshot of the vendor page ← **M2** |
| T7 | systemd + `/sovereign-data` + LAN access; `data/okf` ≥ 60 files | cold boot → `ready: true`; teammates reach it from their laptops ← **M3** |
| T8 | Demo script, QA checklist, 3 rehearsals, backup recording | recorded video exists; script has fallbacks ← **M3/M4** |
| S1 | stretch: Expo mobile thin client (composer + approvals only) using `@mosaic/contracts` | approve from a phone |
| S2 | stretch: `autoinstall.yaml` for a one-shot appliance install | |

## 8. Definition of done
Converter, browser and probe contract suites green · RTX box boots the whole stack via systemd · `data/okf` ≥ 60 valid files containing the must-have facts · offline vendor site works through the sandbox · demo rehearsed 3× with a backup recording · `shared/services/P4-platform-data-demo.md` status updated.

## 9. Pitfalls
- A Playwright client/server **version mismatch** is the #1 browser failure: pin both.
- Ollama in Docker needs the GPU runtime. If `nvidia-smi` works on the host but not in a container, re-run `nvidia-ctk runtime configure`.
- Don't edit `shared/fixtures/okf/`; copy to `data/okf/`.
- Keep frontmatter dates as full ISO timestamps (`2026-09-18T12:00:00Z`), not bare dates.
- Big local models on an 8 GB GPU will swap. Stick to 7B Q4 + 3B + the embedding model.
