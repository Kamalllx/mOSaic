"""PDF / DOCX / PPTX / XLSX -> Markdown via markitdown (optional extra `ingest`)."""
from __future__ import annotations

import asyncio
import importlib.util
from pathlib import Path

from mosaic_contracts.errors import MosaicError
from mosaic_contracts.schema import IngestRequest, IngestSourceType, OKFDraft

from .base import draft, okf_path, require_path, slug

SUFFIXES = {".pdf", ".docx", ".pptx", ".xlsx"}


def markitdown_available() -> bool:
    return importlib.util.find_spec("markitdown") is not None


def _convert(path: Path) -> tuple[str, str | None]:
    from markitdown import MarkItDown

    result = MarkItDown(enable_plugins=False).convert(str(path))
    return result.text_content or "", getattr(result, "title", None)


class DocumentConverter:
    name = "document"
    source_types = [IngestSourceType.FILE]

    def can_convert(self, request: IngestRequest) -> bool:
        p = Path(request.uri)
        return p.is_file() and p.suffix.lower() in SUFFIXES and markitdown_available()

    async def convert(self, request: IngestRequest) -> list[OKFDraft]:
        src = require_path(request)
        if not src.is_file() or src.suffix.lower() not in SUFFIXES:
            raise MosaicError("BAD_REQUEST", f"unsupported document: {src}")
        try:
            text, title = await asyncio.to_thread(_convert, src)
        except Exception as e:  # markitdown raises parser-specific errors
            raise MosaicError("BAD_REQUEST", f"cannot convert {src}: {e}") from e
        if not text.strip():
            raise MosaicError("BAD_REQUEST", f"{src} contains no extractable text")
        title = (title or "").strip() or src.stem.replace("-", " ").replace("_", " ").title()
        return [draft(request, okf_path(request, slug(src.stem)), text, str(src), type="note", title=title,
                      description=f"Imported from {src.name}", tags=["document", src.suffix.lower().lstrip(".")],
                      source="document", trust="unverified")]
