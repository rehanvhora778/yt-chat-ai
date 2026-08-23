"""
services/email_service.py
-------------------------
Sends the signup verification code, over whichever transport is configured.

There are three, tried in this order:

  1. An HTTP email API (Brevo or Resend). This is the one that works when
     deployed. Render's free plan blocks outbound traffic to SMTP ports 25,
     465 and 587, so Gmail SMTP fails there with "Network is unreachable" no
     matter how correct the credentials are. An HTTP API talks over 443, which
     is not blocked.
  2. SMTP. Fine locally, and fine on a paid Render instance.
  3. Printing the code to the console — development only, so signup stays
     testable with nothing configured at all. Refused in production.

Delivery failures are logged in full server-side and reported to the user in
plain language: the person signing up cannot act on an errno.
"""

import smtplib
import ssl
import traceback
from email.message import EmailMessage

import requests

from config import Config

_TIMEOUT = 20


class EmailError(Exception):
    """Delivery failed; `message` is safe to show the user."""

    def __init__(self, message):
        super().__init__(message)
        self.message = message


def _log_failure(provider, exc):
    """Full detail to the server log; the user gets the friendly message."""
    print(f"[email] {provider} delivery failed: {type(exc).__name__}: {exc}", flush=True)
    traceback.print_exc()


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


# ---------------------------------------------------------------------------
# Transports
# ---------------------------------------------------------------------------
def _send_via_brevo(to_email, subject, text, html):
    """
    Brevo's transactional endpoint. 300 emails/day free, and a single verified
    sender address is enough — no domain of your own required, which is what
    makes it usable for a project that just needs to mail arbitrary Gmail
    addresses.
    """
    resp = requests.post(
        "https://api.brevo.com/v3/smtp/email",
        headers={"api-key": Config.BREVO_API_KEY, "content-type": "application/json"},
        json={
            "sender": {"name": Config.MAIL_FROM_NAME, "email": Config.MAIL_FROM},
            "to": [{"email": to_email}],
            "subject": subject,
            "textContent": text,
            "htmlContent": html,
        },
        timeout=_TIMEOUT,
    )
    if resp.status_code in (200, 201, 202):
        return

    if resp.status_code == 401:
        raise EmailError(
            "The email service rejected the server's API key. Check BREVO_API_KEY."
        )
    if resp.status_code == 400 and "sender" in resp.text.lower():
        raise EmailError(
            f"The sender address {Config.MAIL_FROM} is not verified with Brevo. "
            "Add and verify it under Senders & IPs, then try again."
        )
    raise EmailError(
        f"The email service refused the message ({resp.status_code}). "
        "Please try again in a moment."
    )


def _send_via_resend(to_email, subject, text, html):
    """
    Resend. Note the free tier only delivers to arbitrary recipients once you
    have verified a DOMAIN — without one it will only mail the account owner,
    which is not enough for real signups.
    """
    resp = requests.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {Config.RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "from": f"{Config.MAIL_FROM_NAME} <{Config.MAIL_FROM}>",
            "to": [to_email],
            "subject": subject,
            "text": text,
            "html": html,
        },
        timeout=_TIMEOUT,
    )
    if resp.status_code in (200, 201, 202):
        return

    if resp.status_code in (401, 403):
        raise EmailError(
            "The email service rejected the server's API key. Check RESEND_API_KEY."
        )
    if resp.status_code == 422:
        raise EmailError(
            f"Resend refused the sender {Config.MAIL_FROM}. On the free tier you "
            "must verify your own domain before you can email other people."
        )
    raise EmailError(
        f"The email service refused the message ({resp.status_code}). "
        "Please try again in a moment."
    )


def _send_via_smtp(to_email, subject, text, html):
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"{Config.MAIL_FROM_NAME} <{Config.MAIL_FROM}>"
    message["To"] = to_email
    message.set_content(text)
    message.add_alternative(html, subtype="html")

    try:
        if Config.SMTP_USE_TLS:
            with smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT, timeout=_TIMEOUT) as s:
                s.starttls(context=ssl.create_default_context())
                s.login(Config.SMTP_USER, Config.SMTP_PASSWORD)
                s.send_message(message)
        else:
            with smtplib.SMTP_SSL(
                Config.SMTP_HOST, Config.SMTP_PORT, timeout=_TIMEOUT,
                context=ssl.create_default_context(),
            ) as s:
                s.login(Config.SMTP_USER, Config.SMTP_PASSWORD)
                s.send_message(message)
    except smtplib.SMTPAuthenticationError as exc:
        _log_failure("SMTP", exc)
        raise EmailError(
            "The mail server rejected the credentials. For Gmail, SMTP_PASSWORD "
            "must be a 16-character App Password, not your account password."
        )
    except OSError as exc:
        _log_failure("SMTP", exc)
        # errno 101 ENETUNREACH / 111 ECONNREFUSED reaching an SMTP port is the
        # signature of a host that blocks them. Render's free plan blocks 25,
        # 465 and 587 outright, so no amount of credential fixing helps there.
        if getattr(exc, "errno", None) in (101, 111) or "unreachable" in str(exc).lower():
            raise EmailError(
                "The server cannot open SMTP connections — free hosting plans "
                "usually block those ports. Configure BREVO_API_KEY to send "
                "email over HTTPS instead."
            )
        raise EmailError(
            "Could not reach the mail server. Please try again in a moment."
        )


# ---------------------------------------------------------------------------
def send_otp_email(to_email: str, code: str, purpose: str = "register"):
    """
    Deliver a verification code. Raises EmailError when it cannot be sent and
    there is no legitimate development fallback.
    """
    provider = Config.mail_provider()

    if provider == "none":
        # Development convenience: nothing configured, so surface the code.
        if Config.OTP_DEV_ECHO and not Config.IS_PRODUCTION:
            print(
                "\n[email] No email provider configured — DEV fallback.\n"
                f"[email] Verification code for {to_email}: {code}\n"
                "[email] Set BREVO_API_KEY (or SMTP_USER/SMTP_PASSWORD) to send "
                "real email.\n",
                flush=True,
            )
            return {"delivered": False, "dev_echo": True}
        raise EmailError(
            "Email is not configured on the server, so the verification code "
            "could not be sent. Please contact the site owner."
        )

    subject = f"{code} is your YT Chat GenAI verification code"
    text, html = _otp_bodies(code, purpose)
    senders = {
        "brevo": _send_via_brevo,
        "resend": _send_via_resend,
        "smtp": _send_via_smtp,
    }

    try:
        senders[provider](to_email, subject, text, html)
    except EmailError:
        raise
    except requests.RequestException as exc:
        _log_failure(provider, exc)
        raise EmailError(
            "Could not reach the email service. Please try again in a moment."
        )
    except Exception as exc:
        _log_failure(provider, exc)
        raise EmailError("Could not send the verification email. Please try again.")

    return {"delivered": True, "dev_echo": False}
