"""
gunicorn.conf.py
----------------
Production WSGI settings. Used by Render via:

    gunicorn -c gunicorn.conf.py app:app

Read this before changing the worker counts — the values are not arbitrary.
"""

import os

# Render injects the port to listen on; nothing else may bind it.
bind = f"0.0.0.0:{os.getenv('PORT', '5000')}"

# ---- Concurrency -----------------------------------------------------------
# EXACTLY ONE WORKER, ON PURPOSE.
#
# routes/video_routes.py tracks in-progress video processing in a module level
# `_jobs` dict and runs the work in a background thread. That state lives in
# one process's memory, so with 2+ workers a `/process-video/status/<job_id>`
# poll can be routed to a worker that has never heard of the job and the
# frontend would see the upload fail at random. Multi-worker requires moving
# the job store into MongoDB or Redis first.
#
# It also keeps memory in budget: faiss + fastembed are heavy, and Render's
# free instance only has 512 MB — a second worker doubles the footprint and
# gets the service OOM-killed.
workers = int(os.getenv("WEB_CONCURRENCY", "1"))

# Threads give concurrency within that single worker, so one slow LLM answer
# does not block every other request.
worker_class = "gthread"
threads = int(os.getenv("GUNICORN_THREADS", "4"))

# ---- Timeouts --------------------------------------------------------------
# Processing a caption-less video downloads and transcribes its audio, and an
# LLM answer can take a minute when the model falls back. The default 30s
# would kill the worker mid-request — and killing the worker also kills the
# background processing threads living inside it.
timeout = int(os.getenv("GUNICORN_TIMEOUT", "300"))
graceful_timeout = 30
# Longer than Render's edge keep-alive so idle connections are closed there.
keepalive = 65

# ---- Logging ---------------------------------------------------------------
# Render captures stdout/stderr as the service's logs.
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")

# Do NOT set max_requests: recycling a worker mid-job would discard the
# in-memory job state described above.
