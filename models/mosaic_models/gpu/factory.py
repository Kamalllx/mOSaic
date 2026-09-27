"""Factory for P4's ResourceProbe. mosaicd calls it when MOSAIC_MODE_PROBE=real."""
from mosaic_contracts.interfaces import ResourceProbe
from mosaic_contracts.wiring import ServiceBundle, Settings


def build_resource_probe(settings: Settings, services: ServiceBundle) -> ResourceProbe:
    raise NotImplementedError("P4: probe.HostProbe()")
