"""mosaic-os: the Python client and command line for mOSaic, the operating system for organizational AI.

    from mosaic_os import Mosaic
    m = Mosaic("http://localhost:8089")
    task = m.ask("Why is Project Apollo over budget?")
"""
from __future__ import annotations

__version__ = "0.1.0"

from .client import Mosaic, MosaicError  # noqa: E402

__all__ = ["Mosaic", "MosaicError", "__version__"]
