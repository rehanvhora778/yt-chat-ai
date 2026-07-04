# 🎬 YT Chat GenAI

> Chat with any YouTube video using Generative AI. Paste a link, and the app
> extracts the transcript, builds semantic embeddings, and lets you ask
> questions, generate summaries, and extract key points with timestamps — in
> **English or Hindi**.

A production-quality, full-stack **AI/ML final-year project** built with React,
Flask, LangChain, Groq (Llama 3.3 + Whisper), Google Gemini embeddings, FAISS
and MongoDB Atlas.

---

## ✨ Features

- 🔐 **JWT Authentication** — secure register / login.
- 📺 **Process any YouTube video** — auto-fetch title, thumbnail & transcript.
- 🎙️ **Audio fallback** — for videos *without* captions, the audio is
  downloaded and transcribed by Groq Whisper (or Gemini), so they can still be
  processed.
- 🧩 **RAG pipeline** — LangChain chunking → Gemini/local embeddings → FAISS
  vector store → semantic retrieval.
- 💬 **ChatGPT-style chat** — grounded answers with a typing animation and
  auto-scroll.
- 📝 **AI summaries** and **key points with timestamps**.
- 🎓 **AI Quiz** — auto-generates multiple-choice questions from the video
  (choose count + difficulty), grades answers server-side and shows a score
  with per-question explanations; past attempts are saved.
- 🌐 **Bilingual** — converse in English or Hindi.
- 🗂️ **Chat history** stored in MongoDB, exportable as **PDF / DOCX / TXT**.
- 🎨 **Premium UI** — glassmorphism navbar, animated hero, floating particles,
  gradient backgrounds, Framer Motion, dark/light mode, fully responsive.

### ⚡ AI SaaS upgrade features

- 📊 **Analytics dashboard** — animated stat counters (videos, chats, tokens,
  avg response time) + Recharts visualisations (`/analytics`).
- 🎨 **5 themes** — Dark Purple, Cyber Purple, Glass Dark, Neon Blue, Light AI —
  switchable with smooth transitions, persisted to localStorage.
- 🗂️ **Advanced history** — searchable, date-filterable glass cards with chat
  counts and a "recent" strip.

---

## 🧱 Tech Stack

| Layer            | Technology                                            |
| ---------------- | ----------------------------------------------------- |
| Frontend         | React (Vite), Tailwind CSS, Framer Motion, Axios      |
| Backend          | Python, Flask, Flask-CORS                             |
| AI Framework     | LangChain                                             |
| LLM (text + audio) | Groq API (`llama-3.3-70b-versatile`, `whisper-large-v3`) — falls back to Gemini |
| Embeddings       | Google Gemini (`gemini-embedding-001`), local `fastembed` fallback |
| Vector Database  | FAISS (local, per-video index)                        |
| Database         | MongoDB Atlas (`pymongo`)                             |
| Auth             | JWT (`PyJWT`) + password hashing (`werkzeug`)         |
| Transcripts      | `youtube-transcript-api`                              |

---

## 📁 Project Structure

```
YT-CHAT-GENAI/
│
├── backend/
│   ├── app.py                  # Flask app factory + entry point
│   ├── config.py               # Env-based configuration
│   ├── extensions.py           # MongoDB connection
│   ├── requirements.txt
│   ├── .env.example
│   ├── faiss_store/            # FAISS indexes (generated at runtime)
│   ├── models/                 # users, videos, chats (data access)
│   ├── routes/                 # auth, video, chat blueprints
│   ├── services/               # transcript, vector (FAISS), llm (Groq/Gemini)
│   └── utils/                  # JWT auth, helpers
│
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── .env.example
│   └── src/
│       ├── api/                # axios client + endpoint helpers
│       ├── components/         # Navbar, ChatBubble, InsightsModal, ...
│       ├── context/            # Auth + Theme providers
│       ├── pages/              # Landing, Login, Register, Dashboard,
│       │                       # ProcessVideo, Chat, History, Profile
│       └── utils/              # PDF export
│
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- A **MongoDB Atlas** cluster (free tier works) — get a connection string.
- A **Groq API key** (recommended — free, high limits) — https://console.groq.com/keys
- *(Optional)* a **Google Gemini API key** for embeddings — https://aistudio.google.com/app/apikey
  (without it, embeddings run locally via `fastembed`)
- **ffmpeg** — only needed for the audio-fallback (caption-less videos). Use a
  system install, or the bundled `imageio-ffmpeg` (installed automatically) is
  used if no system ffmpeg is found.

---

### 1️⃣ Backend setup

```bash
cd backend

# Create & activate a virtual environment
python -m venv venv
# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env        # (Windows: copy .env.example .env)
# -> open .env and fill in MONGO_URI and GROQ_API_KEY
#    (GOOGLE_API_KEY is optional — used for embeddings when present)
```

Run the backend:

```bash
python app.py
# API runs at http://localhost:5000
```

### 2️⃣ Frontend setup

```bash
cd frontend

# Install dependencies
npm install

# (optional) configure environment
cp .env.example .env        # leave VITE_API_BASE_URL empty for local dev

# Start the dev server
npm run dev
# App runs at http://localhost:5173
```

The Vite dev server proxies `/api/*` to `http://localhost:5000`, so no extra
config is needed locally.

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

| Variable           | Description                                       |
| ------------------ | ------------------------------------------------- |
| `SECRET_KEY`       | Flask secret key                                  |
| `JWT_SECRET`       | Secret used to sign JWTs                          |
| `JWT_EXPIRY_HOURS` | Token lifetime in hours (default 24)              |
| `MONGO_URI`        | MongoDB Atlas connection string                   |
| `MONGO_DB_NAME`    | Database name (default `yt_chat_genai`)           |
| `GROQ_API_KEY`     | **Groq API key (recommended)** — text gen + audio |
| `GROQ_MODEL`       | Chat model (default `llama-3.3-70b-versatile`)    |
| `GROQ_WHISPER_MODEL` | Audio model (default `whisper-large-v3`)        |
| `GOOGLE_API_KEY`   | Google Gemini key — optional; used for embeddings (and as LLM fallback) |
| `GEMINI_MODEL`     | Gemini fallback chat model (default `gemini-2.5-flash-lite`) |
| `EMBEDDING_MODEL`  | Embedding model (default `models/gemini-embedding-001`) |
| `FAISS_STORE_PATH` | Folder for FAISS indexes (default `faiss_store`)  |
| `CORS_ORIGINS`     | Comma-separated allowed frontend origins          |

### Frontend (`frontend/.env`)

| Variable            | Description                                              |
| ------------------- | ------------------------------------------------------- |
| `VITE_API_BASE_URL` | Backend base URL. Empty in dev (uses the Vite proxy).   |

---

## 🗄️ Database Collections

**users** — `{ name, email (unique), password (hashed), created_at }`
**videos** — `{ video_id (unique), title, url, author, thumbnail, language, transcript, segments, created_at }`
**chats** — `{ user_id, video_id, video_title, question, answer, language, timestamp }`
**analytics** — `{ user_id, type, tokens, response_time_ms, video_id, timestamp }`
**history** — `{ user_id, video_id, title, thumbnail, source, processed_at }`
**quizzes** — `{ user_id, video_id, video_title, language, difficulty, questions, answers, score, status, created_at, completed_at }`

---

## 📡 API Endpoints

| Method   | Endpoint                  | Auth | Description                         |
| -------- | ------------------------- | ---- | ----------------------------------- |
| `POST`   | `/api/auth/register`      | ❌   | Create an account                   |
| `POST`   | `/api/auth/login`         | ❌   | Log in, returns a JWT               |
| `GET`    | `/api/auth/me`            | ✅   | Current user                        |
| `POST`   | `/api/process-video`      | ✅   | Process a YouTube URL (RAG build)   |
| `GET`    | `/api/video/<video_id>`   | ✅   | Get a processed video's metadata    |
| `POST`   | `/api/ask`                | ✅   | Ask a question about a video        |
| `POST`   | `/api/summary`            | ✅   | Generate a summary                  |
| `POST`   | `/api/key-points`         | ✅   | Extract key points + timestamps     |
| `POST`   | `/api/quiz/generate`      | ✅   | Generate MCQs from the video        |
| `POST`   | `/api/quiz/submit`        | ✅   | Submit answers, get graded results  |
| `GET`    | `/api/quiz/attempts`      | ✅   | Past quiz attempts (`?video_id=`)   |
| `GET`    | `/api/history`            | ✅   | Get chat history (`?video_id=`)     |
| `DELETE` | `/api/history`            | ✅   | Clear history (all / video / single)|
| `GET`    | `/api/analytics`          | ✅   | Aggregated usage analytics          |
| `GET`    | `/api/processed`          | ✅   | Advanced history (processed videos) |
| `DELETE` | `/api/processed`          | ✅   | Remove a video from history         |

---

## 🧠 How the AI Pipeline Works

1. **Extract** the video id from the URL and fetch metadata via YouTube oEmbed.
2. **Transcribe** using `youtube-transcript-api` (English/Hindi preference). If
   the video has **no captions**, the audio is downloaded with `yt-dlp`,
   compressed with `ffmpeg`, and transcribed by **Groq Whisper**
   (`whisper-large-v3`, or Gemini inline as a fallback) with timestamps — so
   caption-less videos still work.
3. **Chunk** the transcript with LangChain's `RecursiveCharacterTextSplitter`,
   preserving each chunk's start **timestamp** as metadata.
4. **Embed** chunks with Google `gemini-embedding-001` (or a local `fastembed`
   model when no Gemini key/quota) and store them in a **FAISS** index saved to
   disk per video.
5. **Retrieve** the top-k relevant chunks via semantic similarity search.
6. **Generate** a grounded answer with **Groq** (`llama-3.3-70b-versatile`,
   falling back to Gemini), including recent chat history for context.

---

## ☁️ Deployment

### Backend → Render / Railway

1. Push the repo to GitHub.
2. Create a new **Web Service** pointing at `backend/`.
3. Build command: `pip install -r requirements.txt`
4. Start command: `gunicorn "app:create_app()" -b 0.0.0.0:$PORT`
5. Add all backend environment variables in the dashboard.
6. Note: FAISS indexes are stored on local disk — use a persistent disk, or
   re-process videos after a restart on ephemeral hosts.

### Frontend → Vercel / Netlify

1. Set the project root to `frontend/`.
2. Build command: `npm run build` — output directory: `dist`.
3. Set `VITE_API_BASE_URL` to your deployed backend URL.
4. Add the deployed frontend origin to the backend's `CORS_ORIGINS`.

---

## 🧪 Testing the Flow

1. Register a new account.
2. From the **Dashboard**, paste a YouTube URL **that has captions** (most
   popular videos do) and click **Process Video**.
3. Wait for processing, then **chat** with the video.
4. Try the **Summary** and **Key Points** quick actions.
5. Switch between **English/Hindi** and **dark/light** modes.
6. Open **History**, then **Download** a conversation as PDF.

> ℹ️ Videos **without captions** are handled by the audio fallback: the audio
> is downloaded and transcribed by Groq Whisper (this takes a couple of minutes
> for a ~15-min video, vs. seconds when captions exist).
>
> ⚠️ **Free-tier quota:** Groq's free tier has generous per-day limits, but
> heavy testing can still hit a `429 rate limit` — wait a minute and retry. The
> Gemini embedding fallback also has a tiny free-tier quota; when it's exhausted
> the app automatically embeds locally via `fastembed`.

---

## 🛠️ Troubleshooting

- **`MONGO_URI` / `GROQ_API_KEY` missing** — the backend prints a warning on
  startup; set them in `backend/.env`. (An LLM key is required — Groq *or*
  Gemini; Groq is recommended for its higher free-tier limits.)
- **"Transcripts are disabled for this video"** — pick a video with captions.
- **CORS errors** — ensure your frontend origin is listed in `CORS_ORIGINS`.
- **FAISS deserialization** — indexes are trusted local files; loading uses
  `allow_dangerous_deserialization=True` by design.

---

## 📄 License

Released under the MIT License — free to use for academic and personal projects.

---

<p align="center">Built with ❤️ for an AI/ML final-year project.</p>
