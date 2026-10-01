import pytest
from mosaic_contracts.errors import MosaicError
from mosaic_kernel.gateway.connectors import github_repo


@pytest.mark.parametrize("pasted", ["Kamalllx/mOSaic", "https://github.com/Kamalllx/mOSaic", "https://github.com/Kamalllx/mOSaic.git",
                                    "git@github.com:Kamalllx/mOSaic.git", "github.com/Kamalllx/mOSaic/tree/main", " Kamalllx/mOSaic/ "])
def test_github_repo_accepts_what_people_paste(pasted):
    assert github_repo(pasted) == ("Kamalllx", "mOSaic")


def test_a_bare_repo_name_is_refused_clearly():
    # "mOSaic" alone used to become /repos/mOSaic//issues and a 404 from GitHub at sync time
    with pytest.raises(MosaicError, match="owner/repo"):
        github_repo("mOSaic")
