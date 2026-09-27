# mosaicd appliance image (P1 app, P4 packaging). Dev machines usually run `uv run mosaicd` on the host instead.
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim
WORKDIR /app
COPY . .
RUN uv sync --all-packages --frozen --no-dev
ENV MOSAIC_DATA_DIR=/sovereign-data
EXPOSE 8080
CMD ["uv", "run", "--no-sync", "mosaicd"]
