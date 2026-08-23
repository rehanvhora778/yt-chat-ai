"""
routes/auth_routes.py
---------------------
Registration, login and "who am I" endpoints using JWT authentication.

There are two ways in:

  * Email + password. Two-step: /register validates the details and emails a
    one-time code but creates NOTHING; /verify-otp checks the code and only
    then inserts the user. An abandoned signup leaves no half-made account
    behind, and an address can never be registered without the person proving
    they can read its inbox.

  * Google. /google takes the ID token from "Sign in with Google" and signs in
    or registers in a single call. There is no code to email: Google only
    issues a token for an address it has already verified, so demanding an OTP
    on top would prove nothing and just add a step.

Both routes end at the same place — _auth_payload — so the rest of the app
never has to care which one was used.
"""

import re

from flask import Blueprint, request, jsonify, g
from pymongo.errors import DuplicateKeyError
from werkzeug.security import generate_password_hash

from config import Config
from models import user as user_model
from models import otp as otp_model
from services.email_service import EmailError, send_otp_email
from services.google_auth_service import GoogleAuthError, verify_google_token
from utils.auth import generate_token, token_required

auth_bp = Blueprint("auth", __name__)

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

PURPOSE_REGISTER = "register"
PURPOSE_LOGIN = "login"


def _auth_payload(user, message):
    return {
        "message": message,
        "token": generate_token(user["_id"]),
        "user": user_model.serialize_user(user),
    }


def _issue_code(email, purpose, payload=None):
    """
    Throttle, mint and email a one-time code. Returns the JSON body describing
    what the client should do next. Raises EmailError if delivery fails.
    """
    since = otp_model.seconds_since_last_send(email, purpose)
    cooldown = Config.OTP_RESEND_COOLDOWN_SECONDS
    if since is not None and since < cooldown:
        wait = int(cooldown - since)
        raise otp_model.OtpError(
            f"Please wait {wait} more second{'s' if wait != 1 else ''} before "
            "requesting another code.",
            429,
        )

    if otp_model.recent_send_count(email, purpose) >= Config.OTP_MAX_SENDS_PER_HOUR:
        raise otp_model.OtpError(
            "Too many codes requested for this email. Please try again later.", 429
        )

    code = otp_model.create_otp(email, purpose, payload)
    result = send_otp_email(email, code, purpose)

    return {
        "otp_required": True,
        "email": email,
        "purpose": purpose,
        "expires_in_minutes": Config.OTP_TTL_MINUTES,
        # True only in local dev with no SMTP: the code went to the server log.
        "dev_echo": result.get("dev_echo", False),
        "message": (
            "We've sent a verification code to your email."
            if result.get("delivered")
            else "SMTP is not configured — the code was printed to the backend console."
        ),
    }


@auth_bp.route("/register", methods=["POST"])
def register():
    """Validate the signup, email a code, and hold the details until verified."""
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    # ---- Validation ----
    if not name or not email or not password:
        return jsonify({"error": "Name, email and password are required"}), 400
    if not _EMAIL_RE.match(email):
        return jsonify({"error": "Please provide a valid email address"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    try:
        existing = user_model.find_by_email(email)
        if existing and not user_model.has_password(existing):
            return (
                jsonify(
                    {
                        "error": "This email is already registered with Google. "
                        "Use the Continue with Google button to sign in."
                    }
                ),
                409,
            )
        if existing:
            return jsonify({"error": "An account with this email already exists"}), 409

        # Hash now so the plaintext password is never held in the otps document.
        pending = {
            "name": name,
            "email": email,
            "password_hash": generate_password_hash(password),
        }
        return jsonify(_issue_code(email, PURPOSE_REGISTER, pending)), 200
    except otp_model.OtpError as exc:
        return jsonify({"error": exc.message}), exc.status
    except EmailError as exc:
        return jsonify({"error": exc.message}), 503
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 503
    except Exception as exc:
        return jsonify({"error": f"Registration failed: {exc}"}), 500


@auth_bp.route("/verify-otp", methods=["POST"])
def verify_otp():
    """Consume a code: create the pending account (register) or sign in (login)."""
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    code = (data.get("code") or "").strip()
    purpose = (data.get("purpose") or PURPOSE_REGISTER).strip().lower()

    if not email or not code:
        return jsonify({"error": "Email and verification code are required"}), 400
    if purpose not in (PURPOSE_REGISTER, PURPOSE_LOGIN):
        return jsonify({"error": "Unknown verification purpose"}), 400

    try:
        payload = otp_model.verify_otp(email, purpose, code)

        if purpose == PURPOSE_LOGIN:
            user = user_model.find_by_email(email)
            if not user:
                return jsonify({"error": "Account not found"}), 404
            return jsonify(_auth_payload(user, "Login successful"))

        # ---- register ----
        if user_model.find_by_email(email):
            # Verified in another tab/session while this code was outstanding.
            otp_model.clear_for(email, PURPOSE_REGISTER)
            return jsonify({"error": "An account with this email already exists"}), 409
        if not payload:
            return jsonify({"error": "This signup expired. Please register again."}), 400

        user = user_model.create_verified_user(
            payload["name"], payload["email"], payload["password_hash"]
        )
        otp_model.clear_for(email, PURPOSE_REGISTER)
        return jsonify(_auth_payload(user, "Registration successful")), 201
    except otp_model.OtpError as exc:
        return jsonify({"error": exc.message}), exc.status
    except DuplicateKeyError:
        return jsonify({"error": "An account with this email already exists"}), 409
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 503
    except Exception as exc:
        return jsonify({"error": f"Verification failed: {exc}"}), 500


@auth_bp.route("/resend-otp", methods=["POST"])
def resend_otp():
    """Re-send a code, reusing the details captured when /register was called."""
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    purpose = (data.get("purpose") or PURPOSE_REGISTER).strip().lower()

    if not email:
        return jsonify({"error": "Email is required"}), 400
    if purpose not in (PURPOSE_REGISTER, PURPOSE_LOGIN):
        return jsonify({"error": "Unknown verification purpose"}), 400

    try:
        pending = otp_model.pending_payload(email, purpose)
        if purpose == PURPOSE_REGISTER and not pending:
            return (
                jsonify({"error": "This signup expired. Please register again."}),
                400,
            )
        if purpose == PURPOSE_LOGIN and not user_model.find_by_email(email):
            return jsonify({"error": "Account not found"}), 404

        return jsonify(_issue_code(email, purpose, pending)), 200
    except otp_model.OtpError as exc:
        return jsonify({"error": exc.message}), exc.status
    except EmailError as exc:
        return jsonify({"error": exc.message}), 503
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 503
    except Exception as exc:
        return jsonify({"error": f"Could not resend the code: {exc}"}), 500


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    try:
        user = user_model.find_by_email(email)

        # Naming the real problem here leaks nothing: whoever is typing already
        # supplied the address, and "invalid password" for an account that has
        # no password is a dead end they cannot reason their way out of.
        if user and not user_model.has_password(user):
            return (
                jsonify(
                    {
                        "error": "This account was created with Google. "
                        "Use the Continue with Google button to sign in."
                    }
                ),
                409,
            )

        if not user or not user_model.verify_password(user, password):
            return jsonify({"error": "Invalid email or password"}), 401

        # Signup-only verification by default; flip OTP_ON_LOGIN in .env to
        # require an emailed code here too.
        if Config.OTP_ON_LOGIN:
            return jsonify(_issue_code(email, PURPOSE_LOGIN)), 200

        return jsonify(_auth_payload(user, "Login successful"))
    except otp_model.OtpError as exc:
        return jsonify({"error": exc.message}), exc.status
    except EmailError as exc:
        return jsonify({"error": exc.message}), 503
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 503
    except Exception as exc:
        return jsonify({"error": f"Login failed: {exc}"}), 500


@auth_bp.route("/google", methods=["POST"])
def google_sign_in():
    """
    Sign in or register from a Google ID token. One endpoint for both, because
    the client cannot know which it is: whether this Google account has been
    here before is a question only the database can answer.
    """
    data = request.get_json(silent=True) or {}
    credential = (data.get("credential") or "").strip()

    try:
        profile = verify_google_token(credential)
    except GoogleAuthError as exc:
        return jsonify({"error": exc.message}), exc.status

    try:
        # 1. Seen this Google account before - straight in.
        user = user_model.find_by_google_id(profile["google_id"])
        if user:
            return jsonify(_auth_payload(user, "Login successful"))

        # 2. The address already has a password account. Link them rather than
        #    failing on the unique email index: Google has proven this person
        #    controls the address, which is the same thing the emailed code
        #    proves, so refusing here would lock someone out of their own
        #    account for using a different button.
        existing = user_model.find_by_email(profile["email"])
        if existing:
            user = user_model.link_google_account(
                existing["_id"], profile["google_id"], profile["picture"]
            )
            return jsonify(_auth_payload(user, "Login successful"))

        # 3. Brand new - register on the spot.
        user = user_model.create_google_user(
            profile["name"], profile["email"],
            profile["google_id"], profile["picture"],
        )
        # A half-finished password signup for this address is now moot.
        otp_model.clear_for(profile["email"], PURPOSE_REGISTER)
        return jsonify(_auth_payload(user, "Registration successful")), 201

    except DuplicateKeyError:
        # Two tabs raced through step 3. Whichever lost re-reads the winner.
        user = user_model.find_by_email(profile["email"])
        if user:
            return jsonify(_auth_payload(user, "Login successful"))
        return jsonify({"error": "An account with this email already exists"}), 409
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 503
    except Exception as exc:
        return jsonify({"error": f"Google sign-in failed: {exc}"}), 500


@auth_bp.route("/me", methods=["GET"])
@token_required
def me():
    user = user_model.find_by_id(g.user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"user": user_model.serialize_user(user)})
