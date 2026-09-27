# GPU & model runtime (P4; P3 decides which models)

1. NVIDIA driver (`ubuntu-drivers install`) → `nvidia-smi` works
2. NVIDIA Container Toolkit → `docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi` works
3. `docker compose -f infra/compose/docker-compose.yml up -d ollama`
4. Pull the models referenced in `models/models.yaml`:
   ```bash
   docker exec -it mosaic-ollama-1 ollama pull qwen2.5:7b-instruct
   docker exec -it mosaic-ollama-1 ollama pull llama3.2:3b
   docker exec -it mosaic-ollama-1 ollama pull nomic-embed-text
   ```
5. The embedding model is fixed per deployment. Changing it requires `POST /knowledge/reindex` (tell P2 and P3).

Sizing guide for an 8 GB laptop GPU: one 7B Q4 chat model + the embedding model fit together. Route `summarization`/`classification` to a 3B model to keep latency down while agents run in parallel.
