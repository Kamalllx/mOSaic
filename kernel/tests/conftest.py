import pytest
from mosaic_kernel.testing import kernel_factory


@pytest.fixture
def make_kernel(tmp_path):
    return kernel_factory(tmp_path)
