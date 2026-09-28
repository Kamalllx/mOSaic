"""Contract tests for P1. They SKIP until the factory stops raising NotImplementedError, then they gate CI."""
import tempfile
from pathlib import Path

import pytest
from mosaic_contracts.api import route_signatures
from mosaic_contracts.testing import contracts as c
from mosaic_contracts.wiring import ServiceBundle, Settings
from mosaic_kernel import factory


def _build(fn):
    s = Settings(data_dir=Path(tempfile.mkdtemp(prefix="mosaic-test-")))  # isolated state per suite
    try:
        return fn(s, ServiceBundle(settings=s))
    except NotImplementedError as e:
        pytest.skip(f"not implemented yet: {e}")


class TestEventBus(c.EventBusContract):
    def make(self):
        return _build(factory.build_event_bus)


class TestPolicyEngine(c.PolicyEngineContract):
    def make(self):
        return _build(factory.build_policy_engine)


class TestAuditLog(c.AuditLogContract):
    def make(self):
        return _build(factory.build_audit_log)


def test_gateway_matches_contract():
    from mosaic_contracts.api.mock_gateway import build_mock_app
    from mosaic_contracts.testing.fakes import fake_bundle

    app = _build(lambda s, b: factory.build_kernel_app(s, fake_bundle(s)))
    missing = route_signatures(build_mock_app()) - route_signatures(app)
    assert not missing, f"gateway is missing contract routes: {sorted(missing)}"
