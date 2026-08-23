"""
scripts/check_env.py
--------------------
Verifies every credential the app needs, before you paste them into Render.

Each check makes a real call — connecting to MongoDB, listing Groq's models,
logging into SMTP — so a wrong value fails here in seconds instead of ten
minutes into a deploy, where the only clue is a line in the Render logs.

Run it from the backend folder:

    python scripts/check_env.py

It reads backend/.env, or the process environment if a variable is not there,
so you can also point it at the values you are about to give Render:

    MONGO_URI="mongodb+srv://..." python scripts/check_env.py

Secrets are masked in the output. Nothing is written, and no email is sent.
"""

import os
import sys

# Import the app's own config so this checks exactly what the app will read.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import Config  # noqa: E402

PASS, FAIL, SKIP = "PASS", "FAIL", "SKIP"
results = []


def mask(value: str) -> str:
    """Show enough of a secret to recognise it, never enough to use it."""
    if not value:
        return "(empty)"
    if len(value) <= 8:
        return value[0] + "*" * (len(value) - 1)
    return f"{value[:4]}...{value[-4:]} ({len(value)} chars)"


def report(name, status, detail, fix=""):
    results.append((name, status, detail, fix))
    icon = {PASS: "[ OK ]", FAIL: "[FAIL]", SKIP: "[skip]"}[status]
    print(f"{icon} {name}: {detail}")
    if fix and status == FAIL:
        for line in fix.strip().splitlines():
            print(f"       -> {line.strip()}")


# --------------------------------------------------------------------------
# 1. MongoDB
# --------------------------------------------------------------------------
def check_mongo():
    uri = Config.MONGO_URI
    if not uri:
        return report("MongoDB", FAIL, "MONGO_URI is not set",
                      "Atlas > Database > Connect > Drivers, and copy the string.")

    if "<" in uri or ">" in uri:
        return report("MongoDB", FAIL, "MONGO_URI still has <placeholders> in it",
                      "Replace <db_user> and <db_password> with the real values.")

    # A local URI connects fine from this machine and is completely useless in
    # production - Render cannot reach your laptop. Catch it here rather than
    # letting a green check send a broken value to the dashboard.
    if any(h in uri for h in ("localhost", "127.0.0.1", "0.0.0.0")):
        return report("MongoDB", FAIL,
                      "MONGO_URI points at a LOCAL MongoDB, not Atlas",
                      "Fine for local development, but Render has no access to your "
                      "machine. Get the Atlas string: cloud.mongodb.com > Database > "
                      "Connect > Drivers. It starts with mongodb+srv:// and this is the "
                      "value Render needs - you do not have to change your local .env.")

    try:
        from pymongo import MongoClient
        from pymongo.errors import (
            ServerSelectionTimeoutError, OperationFailure, ConfigurationError,
        )
    except ImportError:
        return report("MongoDB", SKIP, "pymongo is not installed here")

    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=8000)
        client.admin.command("ping")
        names = client.list_database_names()
        target = Config.MONGO_DB_NAME
        where = "already exists" if target in names else "will be created on first write"
        report("MongoDB", PASS,
               f"connected; database '{target}' {where}. "
               f"Databases in this cluster: {', '.join(names) or '(none yet)'}")
        _report_cluster_region(uri)
        # A successful connect from here only proves THIS machine's IP is
        # allowed. Render dials in from a completely different address, and
        # that difference is the most common cause of a deploy that builds
        # fine and then cannot reach the database.
        report("  network access", SKIP,
               "this machine can reach the cluster - that does NOT prove Render "
               "can. Atlas > Network Access must list 0.0.0.0/0, because Render's "
               "free plan has no fixed outbound IP")
    except ConfigurationError as exc:
        report("MongoDB", FAIL, f"malformed URI - {exc}",
               "If the password contains @ : / ? # [ ] %, percent-encode it "
               "(@ -> %40, # -> %23, / -> %2F), or change it to letters and digits only.")
    except OperationFailure as exc:
        report("MongoDB", FAIL, f"auth rejected - {exc.details.get('errmsg', exc)}",
               "Atlas > Database Access: check the username, reset the password, "
               "and give the user 'Read and write to any database'.")
    except ServerSelectionTimeoutError:
        report("MongoDB", FAIL, "could not reach the cluster within 8s",
               "Atlas > Network Access must contain 0.0.0.0/0. Render's free plan "
               "has no fixed outbound IP, so a narrow allow-list blocks it.")
    except Exception as exc:  # noqa: BLE001 - surface anything else verbatim
        report("MongoDB", FAIL, f"{type(exc).__name__}: {exc}")


# Which Render region to pick, per AWS region the Atlas cluster sits in.
# Render offers exactly five: oregon, ohio, virginia, frankfurt, singapore.
# A service's region is fixed at creation, so this has to be right up front.
_RENDER_REGION = {
    "us-west": "oregon", "us-east": "virginia", "ca-central": "ohio",
    "sa-east": "virginia", "eu-": "frankfurt", "me-": "frankfurt",
    "af-": "frankfurt", "ap-": "singapore",
}


def _cluster_ip(uri):
    """First shard IP behind an Atlas SRV URI, or None."""
    import re
    import socket

    host_match = re.search(r"@([^/?,]+)", uri)
    if not host_match:
        return None
    host = host_match.group(1).split(":")[0]
    try:
        import dns.resolver
    except ImportError:
        return None

    res = dns.resolver.Resolver()
    # Atlas shard names sometimes fail on a local/ISP resolver; ask a public one.
    res.nameservers = ["8.8.8.8", "1.1.1.1"]
    res.timeout, res.lifetime = 6, 10
    try:
        targets = [str(r.target).rstrip(".")
                   for r in res.resolve("_mongodb._tcp." + host, "SRV")]
    except Exception:
        return None
    for node in targets:
        try:
            return str(res.resolve(node, "A")[0])
        except Exception:
            continue
    return None


def _locate_ip(ip):
    """
    Where an IP physically is, as (label, hint) - or None.

    Tried in order: AWS's published ranges, then the geofeed advertised in the
    netblock's RDAP record. Atlas shared clusters sit on MongoDB's own AS,
    which has no PTR records, so RDAP + geofeed is the path that works there.
    """
    import ipaddress

    try:
        import requests
    except ImportError:
        return None
    addr = ipaddress.ip_address(ip)

    try:
        for p in requests.get("https://ip-ranges.amazonaws.com/ip-ranges.json",
                              timeout=25).json()["prefixes"]:
            if addr in ipaddress.ip_network(p["ip_prefix"]):
                return p["region"], "AWS"
    except Exception:
        pass

    try:
        rdap = requests.get(f"https://rdap.org/ip/{ip}", timeout=25,
                            headers={"Accept": "application/rdap+json"}).json()
        feed = None
        for rem in rdap.get("remarks", []):
            for line in rem.get("description", []):
                if "geofeed" in line.lower() and "http" in line:
                    feed = line.split("http", 1)[1]
                    feed = "http" + feed.split()[0]
        if not feed:
            return None
        for line in requests.get(feed, timeout=30).text.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split(",")
            try:
                net = ipaddress.ip_network(parts[0], strict=False)
            except ValueError:
                continue
            if addr in net:
                city = parts[3] if len(parts) > 3 else ""
                country = parts[1] if len(parts) > 1 else ""
                return f"{city or country}".strip(), country
    except Exception:
        pass
    return None


# Country / AWS region -> the nearest of Render's five regions.
_TO_RENDER = {
    "IN": "singapore", "SG": "singapore", "JP": "singapore", "AU": "singapore",
    "HK": "singapore", "KR": "singapore", "ID": "singapore", "MY": "singapore",
    "TH": "singapore", "PH": "singapore", "VN": "singapore", "TW": "singapore",
    "AE": "frankfurt", "IL": "frankfurt", "ZA": "frankfurt",
    "DE": "frankfurt", "FR": "frankfurt", "GB": "frankfurt", "IE": "frankfurt",
    "NL": "frankfurt", "IT": "frankfurt", "ES": "frankfurt", "SE": "frankfurt",
    "CH": "frankfurt", "PL": "frankfurt", "BE": "frankfurt",
    "US": "oregon", "CA": "ohio", "BR": "virginia",
}
_AWS_TO_RENDER = {
    "us-west": "oregon", "us-east": "virginia", "ca-": "ohio", "sa-": "virginia",
    "eu-": "frankfurt", "me-": "frankfurt", "af-": "frankfurt", "ap-": "singapore",
}


def _report_cluster_region(uri):
    """
    Work out where the cluster lives, so render.yaml's region can match it.

    Worth the network calls: a Render service's region is fixed at creation,
    and a mismatch adds hundreds of milliseconds to every database call.
    """
    ip = _cluster_ip(uri)
    if not ip:
        return report("  cluster region", SKIP,
                      "could not resolve the shard hosts; check the cluster card "
                      "in the Atlas dashboard")

    located = _locate_ip(ip)
    if not located:
        return report("  cluster region", SKIP,
                      f"cluster is at {ip}, but its location could not be determined")

    label, hint = located
    pick = next((v for k, v in _AWS_TO_RENDER.items() if label.startswith(k)), None)
    if pick is None:
        pick = _TO_RENDER.get(hint.upper(), "oregon")

    configured = _render_yaml_region()
    if configured and configured != pick:
        report("  cluster region", FAIL,
               f"cluster is in {label} -> nearest Render region is '{pick}', "
               f"but render.yaml says '{configured}'",
               "Fix render.yaml BEFORE creating the service. A Render service's "
               "region cannot be changed afterwards - you would have to delete it "
               "and start over.")
    else:
        report("  cluster region", PASS,
               f"{label} -> render.yaml region '{pick}'"
               + (" (matches)" if configured else ""))


def _render_yaml_region():
    """The region currently set in render.yaml, if it can be read."""
    import os
    import re

    path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "render.yaml")
    try:
        with open(path, encoding="utf-8") as fh:
            m = re.search(r"^\s*region:\s*(\w+)", fh.read(), re.M)
            return m.group(1) if m else None
    except OSError:
        return None


# --------------------------------------------------------------------------
# 2. Groq - key works AND the configured models still exist
# --------------------------------------------------------------------------
def check_groq():
    key = Config.GROQ_API_KEY
    if not key:
        return report("Groq", SKIP, "GROQ_API_KEY is not set (Gemini would be used instead)")

    try:
        import requests
    except ImportError:
        return report("Groq", SKIP, "requests is not installed here")

    try:
        resp = requests.get(
            "https://api.groq.com/openai/v1/models",
            headers={"Authorization": f"Bearer {key}"},
            timeout=20,
        )
    except Exception as exc:  # noqa: BLE001
        return report("Groq", FAIL, f"could not reach api.groq.com - {exc}")

    if resp.status_code == 401:
        return report("Groq", FAIL, f"key rejected ({mask(key)})",
                      "Create a fresh key at https://console.groq.com/keys")
    if resp.status_code != 200:
        return report("Groq", FAIL, f"HTTP {resp.status_code} - {resp.text[:160]}")

    available = {m["id"] for m in resp.json().get("data", [])}
    report("Groq", PASS, f"key valid ({mask(key)}); {len(available)} models available")

    # Groq retires models regularly, and a decommissioned model 404s at runtime
    # rather than at startup - so check the two this app is configured to use.
    for label, model in (
        ("GROQ_MODEL", Config.GROQ_MODEL),
        ("GROQ_FALLBACK_MODEL", Config.GROQ_FALLBACK_MODEL),
        ("GROQ_WHISPER_MODEL", Config.GROQ_WHISPER_MODEL),
    ):
        if not model:
            continue
        if model in available:
            report(f"  {label}", PASS, f"'{model}' is live")
        else:
            close = sorted(m for m in available if m.split("/")[-1][:6] in model)
            report(f"  {label}", FAIL, f"'{model}' is NOT in Groq's model list",
                   "It was probably decommissioned. Pick a current one from "
                   "https://console.groq.com/docs/models and set this variable on Render."
                   + (f" Similar available: {', '.join(close[:4])}" if close else ""))


# --------------------------------------------------------------------------
# 3. Gemini - only used for embeddings, so test an embedding
# --------------------------------------------------------------------------
def check_gemini():
    key = Config.GOOGLE_API_KEY
    if not key:
        return report("Gemini", SKIP,
                      "GOOGLE_API_KEY is not set - embeddings will run on the "
                      "Render instance via fastembed (heavier on 512 MB of RAM)")

    try:
        import requests
    except ImportError:
        return report("Gemini", SKIP, "requests is not installed here")

    model = Config.EMBEDDING_MODEL.replace("models/", "")
    try:
        resp = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent",
            params={"key": key},
            json={"model": f"models/{model}",
                  "content": {"parts": [{"text": "deployment check"}]}},
            timeout=25,
        )
    except Exception as exc:  # noqa: BLE001
        return report("Gemini", FAIL, f"could not reach the API - {exc}")

    if resp.status_code == 200:
        dims = len(resp.json().get("embedding", {}).get("values", []))
        return report("Gemini", PASS,
                      f"key valid ({mask(key)}); '{model}' returned a {dims}-dim vector")
    if resp.status_code in (400, 403):
        return report("Gemini", FAIL, f"key rejected - {resp.text[:160]}",
                      "Create a new key at https://aistudio.google.com/app/apikey")
    if resp.status_code == 429:
        return report("Gemini", FAIL, "quota exhausted on this key",
                      "Works, but is rate limited right now. The app falls back to "
                      "local embeddings when this happens.")
    report("Gemini", FAIL, f"HTTP {resp.status_code} - {resp.text[:160]}")


# --------------------------------------------------------------------------
# 4. SMTP - log in only, never send
# --------------------------------------------------------------------------
def check_smtp():
    if not Config.smtp_configured():
        return report("SMTP", FAIL,
                      "not configured - SMTP_USER and/or SMTP_PASSWORD are empty",
                      "Signup emails a code and creates no account until it is verified, "
                      "so nobody can register without this. Create a Gmail App Password "
                      "at https://myaccount.google.com/apppasswords")

    import smtplib

    password = Config.SMTP_PASSWORD
    if " " in password:
        report("SMTP", FAIL, "SMTP_PASSWORD contains spaces",
               "Google displays app passwords as 'abcd efgh ijkl mnop'. "
               "Remove the spaces: 'abcdefghijklmnop'.")
        return
    if len(password) != 16:
        report("  note", SKIP,
               f"password is {len(password)} chars; Gmail app passwords are 16 "
               "(fine if you are not on Gmail)")

    try:
        if Config.SMTP_USE_TLS:
            server = smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT, timeout=20)
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(Config.SMTP_HOST, Config.SMTP_PORT, timeout=20)
        server.login(Config.SMTP_USER, password)
        server.quit()
        report("SMTP", PASS,
               f"logged in as {Config.SMTP_USER} on {Config.SMTP_HOST}:{Config.SMTP_PORT} "
               "(no mail sent)")
    except smtplib.SMTPAuthenticationError:
        report("SMTP", FAIL, "authentication rejected",
               "This is almost always a normal account password rather than an App "
               "Password. Google refuses account passwords for SMTP. Enable 2-Step "
               "Verification, then create one at https://myaccount.google.com/apppasswords")
    except Exception as exc:  # noqa: BLE001
        report("SMTP", FAIL, f"{type(exc).__name__}: {exc}")


# --------------------------------------------------------------------------
# 5. Settings that only matter once deployed
# --------------------------------------------------------------------------
def check_deploy_settings():
    origins = Config.CORS_ORIGINS
    local_only = all(("localhost" in o or "127.0.0.1" in o) for o in origins)
    if local_only:
        report("CORS", SKIP,
               f"{origins} - correct for local dev; set this to your Vercel URL on Render")
    else:
        bad = [o for o in origins if o.endswith("/") or "/" in o.split("://", 1)[-1]]
        if bad:
            report("CORS", FAIL, f"these are not bare origins: {bad}",
                   "Scheme + host only, e.g. https://yt-chat-ai.vercel.app "
                   "(no trailing slash, no path).")
        else:
            report("CORS", PASS, f"{origins}")

    proxy = Config.youtube_proxy_url()
    report("YouTube proxy", SKIP,
           "configured" if proxy else
           "none - fine locally; only needed if the deployed app reports that "
           "YouTube is blocking the server's IP")


def main():
    print("=" * 74)
    print(" Credential check - run this before pasting values into Render")
    print("=" * 74)
    check_mongo()
    print()
    check_groq()
    print()
    check_gemini()
    print()
    check_smtp()
    print()
    check_deploy_settings()

    failures = [r for r in results if r[1] == FAIL]
    print("\n" + "=" * 74)
    if failures:
        print(f" {len(failures)} problem(s) to fix before deploying:")
        for name, _, detail, _ in failures:
            print(f"   - {name}: {detail}")
        print("=" * 74)
        return 1
    print(" Everything checks out. Safe to paste these into Render.")
    print("=" * 74)
    return 0


if __name__ == "__main__":
    sys.exit(main())
