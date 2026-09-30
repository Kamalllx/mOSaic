"""Token vault: encrypted-at-rest per-org storage for OAuth tokens and API keys.

Tokens are kept inside the kernel DB, encrypted with MOSAIC_VAULT_KEY.
They are NEVER sent to agents, never logged, and never included in audit entries.

Usage::

    vault = TokenVault(vault_key=os.environ["MOSAIC_VAULT_KEY"])
    await vault.store(org_id, connector_id, token_data)
    token = await vault.get(org_id, connector_id)   # None if not found
    await vault.delete(org_id, connector_id)

`vault_key` must be a 32-byte value encoded as hex or base64.  Use
`python -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"`.
Set it in `.env` as `MOSAIC_VAULT_KEY=<value>`.  Never commit the key.
"""
from __future__ import annotations

import base64
import json
from typing import Any

# cryptography is an optional extra; the vault raises on import if it is not installed.
try:
    from cryptography.fernet import Fernet
    _HAS_CRYPTO = True
except ModuleNotFoundError:
    _HAS_CRYPTO = False


def _make_fernet(key_str: str) -> Fernet:
    """Accept base64-urlsafe or hex keys; pad or convert as needed."""
    if not _HAS_CRYPTO:
        raise RuntimeError("Token vault requires the 'cryptography' package. "
                           "Install it with: uv add cryptography")
    # Try raw base64-urlsafe (Fernet native)
    try:
        raw = base64.urlsafe_b64decode(key_str + "==")
    except Exception:
        raw = bytes.fromhex(key_str)
    if len(raw) != 32:
        raise ValueError("MOSAIC_VAULT_KEY must be exactly 32 bytes (256-bit AES).")
    return Fernet(base64.urlsafe_b64encode(raw))


class TokenVault:
    """Encrypted-at-rest token store.

    In dev mode (key=None) tokens are held in-process in a plaintext dict.
    This is intentional: MOSAIC_AUTH=dev never touches the vault key, so the
    demo and tests run without configuration.  A warning is logged at startup.
    """

    def __init__(self, vault_key: str | None = None) -> None:
        self._dev_mode = vault_key is None
        self._fernet = None if self._dev_mode else _make_fernet(vault_key)
        self._store: dict[tuple[str, str], str] = {}  # (org_id, connector_id) → encrypted blob

        if self._dev_mode:
            import logging
            logging.getLogger("mosaic.vault").warning(
                "Token vault running in dev mode (MOSAIC_VAULT_KEY not set). "
                "Tokens are not encrypted. Do not use in production."
            )

    def _encrypt(self, data: dict[str, Any]) -> str:
        payload = json.dumps(data).encode()
        if self._dev_mode:
            return base64.b64encode(payload).decode()
        return self._fernet.encrypt(payload).decode()  # type: ignore[union-attr]

    def _decrypt(self, blob: str) -> dict[str, Any]:
        payload_bytes = base64.b64decode(blob.encode()) if self._dev_mode else self._fernet.decrypt(blob.encode())  # type: ignore[union-attr]
        return json.loads(payload_bytes)

    async def store(self, org_id: str, connector_id: str, token_data: dict[str, Any]) -> None:
        """Encrypt and store token data for an org/connector pair."""
        self._store[(org_id, connector_id)] = self._encrypt(token_data)

    async def get(self, org_id: str, connector_id: str) -> dict[str, Any] | None:
        """Retrieve and decrypt a token. Returns None if not found or decryption fails."""
        blob = self._store.get((org_id, connector_id))
        if blob is None:
            return None
        try:
            return self._decrypt(blob)
        except Exception:  # InvalidToken, json errors
            return None

    async def delete(self, org_id: str, connector_id: str) -> None:
        """Remove a stored token."""
        self._store.pop((org_id, connector_id), None)

    async def exists(self, org_id: str, connector_id: str) -> bool:
        """Return True if a token is stored for this org/connector."""
        return (org_id, connector_id) in self._store
