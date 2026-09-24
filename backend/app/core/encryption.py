from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings

# Categories whose complaint description is encrypted at rest, per the
# roadmap's security scope: Whistleblow and Harassment are the two BRD
# explicitly calls out as needing confidentiality beyond the ordinary
# role-based access checks already in place.
ENCRYPTED_CATEGORIES = frozenset({"harassment", "whistleblow"})


@lru_cache
def _get_fernet() -> Fernet:
    return Fernet(get_settings().encryption_key.encode())


def encrypt_text(plain: str) -> str:
    return _get_fernet().encrypt(plain.encode()).decode()


def decrypt_text(value: str) -> str:
    """Decrypt a value encrypted with encrypt_text.

    Falls back to returning the value as-is if it isn't a valid Fernet
    token — covers rows written before encryption was added, so old data
    doesn't crash the app. Not a security feature, just a compatibility
    shim for pre-existing plaintext.
    """
    try:
        return _get_fernet().decrypt(value.encode()).decode()
    except (InvalidToken, ValueError):
        return value


def encrypt_if_sensitive(category: str, plain: str) -> str:
    if category in ENCRYPTED_CATEGORIES:
        return encrypt_text(plain)
    return plain


def decrypt_if_sensitive(category: str, value: str) -> str:
    if category in ENCRYPTED_CATEGORIES:
        return decrypt_text(value)
    return value
