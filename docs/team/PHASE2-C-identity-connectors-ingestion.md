# Phase 2 brief: Person C, identity and RBAC, connected apps, real ingestion (GPU optional)

## Kickoff prompt (paste into Claude Code in the repo root)

```
You are Person C on the mOSaic hackathon team (phase 2). mOSaic is a self-hosted AI operating system: knowledge is a
filesystem, agents are processes, world actions are governed syscalls, everything is audited. Your area: organizations
and people (Google sign-in, orgs, members, roles, access control), connected apps (GitHub, Google Calendar/Meet) as
governed tools, and real data ingestion (uploads, URLs, connector sync) so mOSaic stops being a fixed demo bundle.

First: git fetch; git checkout -b c/identity origin/ui/desktop. Create a git-ignored CLAUDE.local.md in the repo root
containing the single line @docs/team/PHASE2-C-identity-connectors-ingestion.md. Read, in order: docs/PROJECT_CONTEXT.md
(all of it, especially section 4 on adding desktop apps and section 8 on the interfaces), AGENTS.md, shared/README.md,
kernel/mosaic_kernel/gateway/app.py, kernel/mosaic_kernel/persistence/, kernel/mosaic_kernel/policy/,
knowledge/mosaic_knowledge/ingestion/, execution/mosaic_execution/connectors/, and this brief.

Setup: uv sync --all-packages --all-extras; npm --prefix apps/web ci; cp .env.example .env if missing. You can develop
entirely in fake mode (MOSAIC_DEFAULT_MODE=fake uv run mosaicd) with the dev console; a GPU only matters for testing
real ingestion embeddings. uv run pytest -q must be green before you start.

Work through the tasks in docs/team/PHASE2-C-identity-connectors-ingestion.md in order. Tests first, implement until
green, run uv run pytest -q, uvx ruff check ., and for web changes npm --prefix apps/web run lint/test/build; commit one
logical change at a time with an area prefix (auth:, p1:, p2:, ui:). Contract changes go on their own contract/<topic>
branch with a version bump and regenerated artifacts; tell the team the new names. Secrets (OAuth client secrets,
tokens, session keys) never go into the repo, events or the audit log. Push your branch and tell Kamal; he merges into
ui/desktop. Never push to main or ui/desktop, never force-push, never skip hooks. Keep MOSAIC_AUTH=dev working so the
demo, the tests and the mock gateway still run without a login. If the same error beats you three times, stop and ask.
Start with task C1.
```

## Your area
- Identity and RBAC in `kernel/` (gateway, persistence, policy).
- Connectors in `execution/mosaic_execution/connectors/`.
- Ingestion in `knowledge/mosaic_knowledge/ingestion/`.
- Your desktop apps in `apps/web/components/apps/`: Sign-in and onboarding, Organization, Connections, Ingest.
- The contract changes for all of these.

Person B bounds dynamic agents by your permissions; Person D's mobile app signs in through your endpoints. Agree on the Principal shape with both on day one.

## Tasks (in order)

### C1. Principal, orgs, members, roles (contract and backend)
- **Contract:** `Org`, `Member` (user, email, name, avatar, role, status: invited / active), `Role`, and `Principal { user_id, org_id, roles[], permissions[] }`.
  - Roles: `owner`, `admin`, `approver`, `member`, `viewer`.
  - Permissions: `task.create`, `task.cancel`, `approval.resolve`, `knowledge.read`, `knowledge.ingest`, `connectors.manage`, `config.read`, `config.manage`, `members.manage`.
  - Keep the role → permissions table in one YAML (`policies/roles.yaml`), so an admin can adjust it.
- **Persistence:** tables in the kernel's SQLAlchemy store, with migrations.
- **Endpoints:** `POST /orgs`, `GET /orgs/me`, `GET/POST/PATCH/DELETE /orgs/{id}/members`, `GET /orgs/{id}/roles`. Every change is written to the audit log (actor, target, old role, new role).
- **Enforcement:**
  - every gateway endpoint declares its permission, checked centrally;
  - the kernel policy can reference roles (for example: `jira.write` needs approval by `approver` or above);
  - approvals record who approved and under which role.
- **Tests:** each role against each endpoint (a table-driven test), and the audit entries.

### C2. Google sign-in and sessions
- `MOSAIC_AUTH=dev|google`. `dev` keeps today's `X-Mosaic-User` headers, for tests, the mock and the demo fallback.
- `POST /auth/google {id_token}`:
  - verify the token with Google's certs (`google-auth`);
  - find or create the user;
  - accept pending invites by email;
  - return a signed session token, using `MOSAIC_SESSION_SECRET` in `.env` only.

  Also add `GET /auth/me` and `POST /auth/logout`. The gateway resolves `Authorization: Bearer` to the Principal; the WebSocket gets the token as a query parameter or in the first message.
- **Google Cloud OAuth client:** create it yourself with a **Web** client ID for the console and an **Android** client ID for Person D. Put the client IDs in `.env.example` as placeholders, and document the steps in `docs/AUTH.md`.

### C3. Sign-in, onboarding and the Organization app (web)
- **Sign-in screen** before the desktop when `MOSAIC_AUTH=google`, using Google Identity Services. **Onboarding:** create an org (name, domain), invite members by email with a role, then land on the desktop.
- **Organization desktop app:** members (avatar, role picker, invite, remove), roles and their permissions (read-only view of `roles.yaml` at first), and recent membership audit entries.
- Show the signed-in user and org in the menu bar (coordinate with Kamal, who owns the menu bar), and hide actions the user lacks permission for.
- Follow `docs/PROJECT_CONTEXT.md` §4 to add apps. Use design tokens only; Kamal is re-skinning the desktop.

### C4. Connected apps: GitHub and Google Calendar/Meet
- **Framework:**
  - a connect flow (OAuth redirect, then callback);
  - a **token vault**: encrypted at rest with `MOSAIC_VAULT_KEY`, per org, never sent to agents or logged;
  - connector status in `GET /connectors`.
- **GitHub:**
  - `github.read`: repos, issues, PRs, file contents;
  - `github.write`: create issue, comment. Requires approval by default.
- **Google Calendar/Meet:**
  - `calendar.read`: free/busy, events;
  - `calendar.write`: create an event with a Meet link. Requires approval.
- Both register as tools in the tool registry, so Person B's agents can call them through `ctx.syscall`.
- **Connections desktop app:** connect or disconnect, scopes granted, last sync, and which agents used the connector recently (from the audit log).

### C5. Real ingestion
- **Upload:** `POST /knowledge/upload`, a multipart form with files, target folder, privacy and trust (default `unverified`). It uses the existing converters (Markdown, PDF/DOCX via markitdown, CSV, Slack, Jira), writes OKF objects under the chosen `/org/...` path with provenance (who uploaded it, when, the original filename), and reindexes.
- **URL ingest:** fetch through the sandboxed browser, never from mosaicd directly.
- **Connector sync:** a GitHub repo's docs, issues and READMEs go under `/org/github/<repo>/...`, on demand or on a schedule.
- **Progress:** `ingest.progress` events (file, stage, done or error).
- **Ingest desktop app:** drag and drop (also onto the desktop itself), pick a folder and privacy, per-file progress, and results with links into Knowledge.
- **Replace the "same old KB" feeling:**
  - ingest a real public repo's docs;
  - add a second realistic document set.

  Keep `data/okf` intact for the Apollo demo.

## Useful facts
- **Headers today:** `kernel/mosaic_kernel/gateway/app.py` reads `X-Mosaic-User` / `X-Mosaic-Org` into a Principal.
- **Existing ingestion:** `POST /knowledge/ingest {source_type, uri, target_path}`. Converters are in `knowledge/mosaic_knowledge/ingestion/converters/` and are covered by contract tests.
- **Connector example:** the Jira connector (`jira.py`) and its in-process mock (`jira_mock.py`) show the shape of a governed tool.
- **Mock gateway:** `shared/python/mosaic_contracts/api/mock_gateway.py`. Add your endpoints there too, so the UI works without a backend.
