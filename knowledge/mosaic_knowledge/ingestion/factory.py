"""Factory for P4's converters (see mosaic_contracts.wiring). mosaicd calls it when MOSAIC_MODE_CONVERTERS=real."""
from mosaic_contracts.interfaces import SourceConverter
from mosaic_contracts.wiring import ServiceBundle, Settings

from .converters import (
    CsvConverter,
    DocumentConverter,
    JiraJsonConverter,
    MarkdownConverter,
    SlackConverter,
    markitdown_available,
)


def build_converters(settings: Settings, services: ServiceBundle) -> list[SourceConverter]:
    """Priority order: specific formats first; markdown (any .md file or directory) is the catch-all, so it goes last."""
    converters: list[SourceConverter] = [JiraJsonConverter(), SlackConverter(), CsvConverter()]
    if markitdown_available():
        converters.append(DocumentConverter())
    converters.append(MarkdownConverter())
    return converters
