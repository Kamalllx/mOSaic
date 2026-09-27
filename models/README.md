# models/ — P3 model runtime (`mosaic_models`); `gpu/` (ResourceProbe) is P4's
Providers (Ollama first, then OpenAI-compatible llama.cpp/vLLM, optional approved remote), the policy-driven `ModelRouter`, and the fixed embedding model. Routing config: [models.yaml](models.yaml). Briefs: [P3](../docs/team/P3-agents-models.md) · [P4](../docs/team/P4-platform-data-demo.md) (probe).

```bash
ollama pull llama3.2:3b && ollama pull nomic-embed-text      # or use the RTX box (infra/gpu/README.md)
uv run pytest models/tests -rs                               # router suite skips if Ollama is unreachable
```
