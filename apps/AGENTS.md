# apps/ — owner P2 (web console; mobile is a stretch)
- Talk to the backend ONLY through `web/lib/mosaic-client.ts`; types come from `@mosaic/contracts` (shared/ts). Never hand-write backend shapes.
- Develop against `uv run mosaic-mock-gateway`. It replays the full Apollo run, including the approval pause.
- Brief: docs/team/P2-knowledge-console.md (section "Web console").
