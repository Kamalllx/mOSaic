"""mosaicd — the mOSaic server process (systemd unit: infra/systemd/mosaicd.service).

    uv run mosaicd                         # everything fake -> runs today
    MOSAIC_DEFAULT_MODE=real uv run mosaicd
    MOSAIC_MODE_KNOWLEDGE=real uv run mosaicd   # integrate one component at a time
    uv run mosaicd --print-wiring          # show which implementation backs each service
"""
from __future__ import annotations

import argparse
import logging

from mosaic_contracts.wiring import Settings

from .wiring import build_app, build_services


def main() -> None:
    ap = argparse.ArgumentParser(prog="mosaicd")
    ap.add_argument("--print-wiring", action="store_true")
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    settings = Settings.from_env()
    bundle = build_services(settings)
    width = max(len(k) for k in bundle.modes)
    for attr, mode in bundle.modes.items():
        print(f"  {attr:<{width}}  {mode:<15} {type(getattr(bundle, attr)).__module__}.{type(getattr(bundle, attr)).__name__}")
    if args.print_wiring:
        return

    import uvicorn

    uvicorn.run(build_app(bundle), host=settings.gateway_host, port=settings.gateway_port)


if __name__ == "__main__":
    main()
