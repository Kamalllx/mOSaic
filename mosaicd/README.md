# mosaicd — composition root

The only code that imports implementations. `wiring.py` maps each component to its fake (from `mosaic_contracts.testing.fakes`) or its real factory (`<package>/factory.py`), chosen by `MOSAIC_MODE_<COMPONENT>=fake|real`. If a real factory still raises `NotImplementedError`, it falls back to the fake with a warning.

```bash
uv run mosaicd --print-wiring                      # which implementation backs each service
MOSAIC_MODE_KNOWLEDGE=real uv run mosaicd          # integrate one component at a time
MOSAIC_DEFAULT_MODE=real uv run mosaicd            # everything real
```
Maintained by P1. Registering a new factory is a one-line change in `REGISTRY`.
