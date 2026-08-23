"""
services/email_service.py
-------------------------
Sends transactional email over SMTP — currently just the signup verification
code. Gmail works with an APP PASSWORD (Google Account > Security > 2-Step
Verification > App passwords); a normal account password is rejected by Google
and must never be placed in .env.

When SMTP is not configured the code is printed to the backend console instead,
so signup stays testable locally. That fallback is refused outside development.
"""

import smtplib
import ssl
from email.message import EmailMessage

from config import Config


class EmailError(Exception):
    """Delivery failed; `message` is safe to show the user."""

    def __init__(self, message):
        super().__init__(message)
        self.message = message


def _otp_bodies(code: str, purpose: str):
    """Return (plain_text, html) for the code email."""
    action = "finish creating your account" if purpose == "register" else "sign in"
    minutes = Config.OTP_TTL_MINUTES

    text = (
        f"Your YT Chat GenAI verification code is {code}\n\n"
        f"Enter it to {action}. The code expires in {minutes} minutes.\n"
        f"If you didn't request this, you can ignore this email.\n"
    )

    html = f"""\
<div style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#f7f7f8;padding:32px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e3e3e8;
              border-radius:16px;padding:32px;text-align:center">
    <div style="font-size:12px;font-weight:800;letter-spacing:.1em;
                text-transform:uppercase;color:#dc1424">YT Chat GenAI</div>
    <h1 style="font-size:20px;color:#0f172a;margin:14px 0 6px">Verify your email</h1>
    <p style="font-size:14px;color:#5a5a64;margin:0 0 22px">
      Enter this code to {action}.</p>
    <div style="font-size:32px;font-weight:800;letter-spacing:.35em;color:#0f172a;
                background:#f5f5f7;border-radius:12px;padding:16px 12px 16px 24px">
      {code}</div>
    <p style="font-size:12px;color:#84848f;margin:22px 0 0">
      The code expires in {minutes} minutes. If you didn't request it, ignore this email.
    </p>
  </div>
</div>"""
    return text, html


def send_otp_email(to_email: str, code: str, purpose: str = "register"):
    """
    Deliver a verification code. Raises EmailError when it cannot be sent and
    there is no legitimate development fallback.
    """
    if not Config.smtp_configured():
        # Development convenience: no mail server, so surface the code locally.
        if Config.OTP_DEV_ECHO and Config.FLASK_ENV != "production":
            print(
                "\n[email] SMTP is not configured — DEV fallback.\n"
                f"[email] Verification code for {to_email}: {code}\n"
                "[email] Set SMTP_USER / SMTP_PASSWORD in backend/.env to send "
                "real email.\n",
                flush=True,
            )
            return {"delivered": False, "dev_echo": True}
        raise EmailError(
            "Email is not configured on the server, so the verification code "
            "could not be sent. Set SMTP_USER and SMTP_PASSWORD in backend/.env."
        )

    text, html = _otp_bodies(code, purpose)

    message = EmailMessage()
    message["Subject"] = f"{code} is your YT Chat GenAI verification code"
    message["From"] = f"{Config.SMTP_FROM_NAME} <{Config.SMTP_FROM}>"
    message["To"] = to_email
    message.set_content(text)
    message.add_alternative(html, subtype="html")

    try:
        if Config.SMTP_USE_TLS:
            with smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT, timeout=20) as server:
                server.starttls(context=ssl.create_default_context())
                server.login(Config.SMTP_USER, Config.SMTP_PASSWORD)
                server.send_message(message)
        else:
            with smtplib.SMTP_SSL(
                Config.SMTP_HOST,
                Config.SMTP_PORT,
                timeout=20,
                context=ssl.create_default_context(),
            ) as server:
                server.login(Config.SMTP_USER, Config.SMTP_PASSWORD)
                server.send_message(message)
    except smtplib.SMTPAuthenticationError:
        # Overwhelmingly the cause: a real password instead of an App Password.
        raise EmailError(
            "The mail server rejected the credentials. For Gmail, SMTP_PASSWORD "
            "must be a 16-character App Password, not your account password."
        )
    except Exception as exc:
        raise EmailError(f"Could not send the verification email: {exc}")

    return {"delivered": True, "dev_echo": False}
