"""
services/google_auth_service.py
-------------------------------
Verifies the ID token that "Sign in with Google" hands the frontend.

Flow: Google Identity Services renders the button, the browser gets a signed
JWT (the "credential"), and it is POSTed here. This module checks that token
is genuinely Google's and genuinely meant for us, then returns the profile
inside it.

Why the token is verified server-side at all: the browser could send anything.
The signature check proves Google issued it, and the audience check proves it
was issued for OUR client id — without that, a token minted for any other site
would be accepted and let anyone sign in as anyone.
"""

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from config import Config

# Google mints its ID tokens under one of these two issuers.
_ISSUERS = ("accounts.google.com", "https://accounts.google.com")

# Small allowance for clock skew between this server and Google's. Without it,
# a machine running a few seconds fast rejects tokens as "used too early".
_CLOCK_SKEW_SECONDS = 10


class GoogleAuthError(Exception):
    """Raised when a Google credential cannot be trusted."""

    def __init__(self, message, status=401):
        super().__init__(message)
        self.message = message
        self.status = status


def verify_google_token(credential: str) -> dict:
    """
    Validate a Google ID token and return the profile it carries:

        {"google_id", "email", "name", "picture"}

    Raises GoogleAuthError for anything that is not a trustworthy token.
    """
    if not Config.google_auth_enabled():
        raise GoogleAuthError(
            "Google sign-in is not configured on this server.", 503
        )
    if not credential:
        raise GoogleAuthError("No Google credential was provided.", 400)

    try:
        claims = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            Config.GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=_CLOCK_SKEW_SECONDS,
        )
    except ValueError as exc:
        # Covers a bad signature, the wrong audience, and an expired token.
        raise GoogleAuthError(
            f"That Google sign-in could not be verified ({exc}). Please try again."
        ) from exc
    except Exception as exc:  # network failure reaching Google's certs
        raise GoogleAuthError(
            "Could not reach Google to verify the sign-in. Please try again.", 503
        ) from exc

    if claims.get("iss") not in _ISSUERS:
        raise GoogleAuthError("That token was not issued by Google.")

    email = (claims.get("email") or "").strip().lower()
    if not email:
        raise GoogleAuthError("That Google account has no email address.")

    # Google sets this false for some Workspace accounts. Treating an
    # unverified address as proven would let someone claim an email they do
    # not own — which is exactly what the OTP flow exists to prevent.
    if not claims.get("email_verified"):
        raise GoogleAuthError(
            "That Google account's email address is not verified. "
            "Please verify it with Google, or sign up with a password instead."
        )

    return {
        "google_id": claims["sub"],
        "email": email,
        # Falls back to the local part of the address for accounts with no
        # display name set, so the UI never greets someone as "None".
        "name": (claims.get("name") or "").strip() or email.split("@")[0],
        "picture": claims.get("picture") or "",
    }
