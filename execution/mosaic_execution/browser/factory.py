"""Factory for P4's BrowserDriver (see mosaic_contracts.wiring). mosaicd calls it when MOSAIC_MODE_BROWSER=real."""
from mosaic_contracts.interfaces import BrowserDriver
from mosaic_contracts.wiring import ServiceBundle, Settings


def build_browser_driver(settings: Settings, services: ServiceBundle) -> BrowserDriver:
    raise NotImplementedError("P4: driver.PlaywrightDriver()")
