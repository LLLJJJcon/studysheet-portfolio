# StudySheet

AI-powered exam cheatsheet generator. Upload course materials → AI builds an exam-point content tree → Adjust and generate a draggable, editable chunk layout → Export as PDF / HTML.

## Demo Video
[![IMAGE ALT TEXT HERE](https://img.youtube.com/vi/2wg5UHxdGtU/0.jpg)](https://www.youtube.com/watch?v=2wg5UHxdGtU)

## 1. Problem Statement

### The Problem

University students preparing for closed-book or cheatsheet-allowed exams face a recurring challenge: distilling an entire semester of lecture notes, slides, and readings into a single, information-dense study sheet. This manual process is:

- **Time-consuming**: Students often spend 6-10 hours organizing, condensing, and formatting content — time better spent actually studying.
- **Error-prone**: Important topics are missed, layout space is wasted, and formatting is inconsistent.
- **Unstructured**: There is no systematic way to prioritize exam-relevant topics (high-frequency vs. awareness-level content).

### Why It Matters

- **Immediate relevance**: Cheatsheet exams are standard practice across CS, engineering, and business programs worldwide.
- **5-year horizon**: As course materials grow with supplementary videos, code repos, and papers, the volume of content to distill will only increase.
- **10-year horizon**: AI-assisted learning tools are an emerging category. StudySheet sits at the intersection of EdTech and generative AI — a space projected to grow significantly.

### Challenges

1. **Multi-format document parsing**: Extracting clean text from PDFs (including scanned ones via OCR), DOCX, and PPTX.
2. **Hierarchical knowledge extraction**: Using LLMs to identify exam-relevant topics and organize them into a structured tree — not a flat list.
3. **Space-optimal layout**: Fitting maximum information onto fixed page dimensions while maintaining readability — a variant of the 2D bin-packing problem.
4. **Streaming UX**: The generation pipeline takes 1-3 minutes. Users need real-time feedback via SSE streaming, not a loading spinner.
5. **Provider-agnostic LLM**: Supporting OpenAI, Anthropic, and Gemini (plus any OpenAI-compatible API) with a single abstraction.

## 2. Solution Architecture

### Information Architecture

```
┌─────────────────────────────────────────────────────┐
│                    User Browser                      │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Auth &   │  │  Generation  │  │  Canvas       │  │
│  │  Settings │  │  Progress    │  │  Editor       │  │
│  │  Pages    │  │  (SSE)       │  │  (dnd-kit)    │  │
│  └──────────┘  └──────────────┘  └───────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │ REST + SSE
┌──────────────────────▼──────────────────────────────┐
│                Express Backend                       │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Auth    │  │  Generation  │  │  Layout       │  │
│  │  Service │  │  Orchestrator│  │  Engine       │  │
│  └──────────┘  └──────┬───────┘  └───────────────┘  │
│                       │                              │
│  ┌──────────────────────────────────────────────┐   │
│  │          LLM Provider Factory                 │   │
│  │  ┌─────────┐  ┌──────────┐  ┌─────────────┐  │   │
│  │  │ OpenAI  │  │Anthropic │  │   Gemini    │  │   │
│  │  │(+compat)│  │          │  │             │  │   │
│  │  └─────────┘  └──────────┘  └─────────────┘  │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────┘
                       │ Mongoose
              ┌────────▼────────┐
              │    MongoDB      │
              │  Users, Courses │
              │  Trees, Chunks  │
              │  Layouts, Vers. │
              └─────────────────┘
```

### Generation Pipeline (L1 → L4)

| Stage | Input | Output | Method |
|-------|-------|--------|--------|
| **L1** Tree | Raw text from files | Hierarchical knowledge tree (JSON) | LLM streaming |
| **L2** Chunks | Tree + source text | Content chunks per leaf node | LLM (3 concurrent subtrees) |
| **L3** Compress | Chunks by importance | Condensed chunks fitting word limit | LLM per importance level |
| **L4** Layout | Chunks + page config | Container positions (x, y, w, h) | Algorithmic bin-packing |

### Module Breakdown

| Module | Responsibility |
|--------|---------------|
| `client/src/stores/` | Zustand state management (auth, canvas, tree, generation, chat) |
| `client/src/components/canvas/` | WYSIWYG page editor with drag-drop, resize, CSS column splitting |
| `server/src/llm/` | Provider factory, rate limiter, prompt templates |
| `server/src/services/generationOrchestrator.ts` | L1-L4 pipeline with SSE streaming and cancellation |
| `server/src/utils/algorithmicLayout.ts` | Column-based layout engine with binary search optimization |

## 3. Legal / Open-Source Aspects

### Open-Source Libraries Used

| Library | License | Usage |
|---------|---------|-------|
| React 18 | MIT | Frontend framework |
| Express | MIT | Backend framework |
| MongoDB / Mongoose | SSPL / MIT | Database / ODM |
| OpenAI SDK | Apache 2.0 | LLM provider client |
| Anthropic SDK | MIT | LLM provider client |
| Google Generative AI | Apache 2.0 | LLM provider client |
| dnd-kit | MIT | Drag-and-drop functionality |
| Tailwind CSS | MIT | Styling |
| react-markdown + remark-gfm | MIT | Markdown rendering |
| Vite | MIT | Build tooling |
| mammoth.js | BSD-2 | DOCX parsing |
| pdf-parse | MIT | PDF text extraction |

All dependencies use permissive licenses (MIT, Apache 2.0, BSD) compatible with both open-source and commercial use.

### Open-Sourcing Potential

The project can be open-sourced under the **MIT License**. Key considerations:
- **No proprietary LLM dependency**: Users bring their own API keys; no vendor lock-in.
- **No sensitive data in repo**: API keys are encrypted at rest; `.env` files are gitignored.
- **Prompt templates are the IP**: The LLM prompts in `server/src/llm/prompts/` represent the core differentiation — they could be kept proprietary while open-sourcing the framework.

### Protection Strategies

1. **Prompt engineering as trade secret**: The multi-stage generation prompts are the hardest part to replicate.
2. **SaaS model**: Host as a service rather than distributing — users never see the backend.
3. **Encryption of API keys**: AES-256-GCM encryption prevents key theft even if the database is compromised.

## 4. Competition Analysis

| Product | Approach | Limitations |
|---------|----------|-------------|
| **Cheatsheet Generator (various)** | Template-based, manual input | No AI content extraction; user does all the work |
| **ChatGPT / Claude (direct)** | Paste text → ask for summary | No structured layout; no page-fitting; no drag-drop editing |
| **Notion AI** | AI-assisted note editing | General-purpose; no exam-specific prioritization or page layout |
| **Cram / Quizlet** | Flashcard generation | Different goal (recall testing vs. reference sheet) |
| **Napkin AI** | AI-powered visual content | Focused on presentations, not dense reference sheets |

### StudySheet's Differentiators

1. **End-to-end pipeline**: From raw PDF/DOCX upload to print-ready cheatsheet — no manual intermediate steps.
2. **Exam-aware prioritization**: Content is tagged as High-Frequency / Important / Awareness based on exam relevance.
3. **Page-optimal layout**: Algorithmic bin-packing with CSS column splitting ensures zero wasted space.
4. **WYSIWYG editing**: Drag-drop chunks, inline editing, AI chat for per-chunk refinement — not just a static output.
5. **Provider-agnostic**: Works with OpenAI, Anthropic, Gemini, or any compatible API — users choose cost/quality tradeoffs.

## 5. Front-End Features

### Authentication & Settings
- User registration and login with JWT persistence
- API key configuration for OpenAI, Anthropic, Gemini
- Custom OpenAI-compatible base URL (for AiHubMix, DeepSeek, GLM, etc.)
- Preferred provider and model selection
- Settings page with account management and logout

### Course Management
- Create / list / update / delete courses
- Page configuration (size, columns, word limit, font size)
- Multi-file upload (PDF, DOCX, PPTX, TXT, images) with drag-and-drop
- File list display with per-file deletion

### Generation Pipeline UI
- Real-time SSE streaming of L1-L4 generation progress
- Elapsed time tracking and per-stage progress indicators
- L2 subtree completion badges and percentage
- L3 compression progress by importance level
- Generation cancellation with server-side cleanup
- Streaming console showing partial JSON output

### Canvas / Page Editor
- WYSIWYG multi-page layout with visual page boundaries
- CSS column layout with automatic chunk splitting across columns and pages
- Drag-and-drop chunk reordering within and between sections
- Inline chunk editing with auto-sizing textarea
- Chunk resizing via mouse drag
- Importance-based color coding (red / blue / gray)
- Zoom (10%-300%) with Ctrl+Wheel, pan with Alt+drag
- Column count selector (Auto, 1-4 columns)
- Font size selector (Auto, 6pt-12pt)
- Image insertion into chunks via file upload
- `box-decoration-break: clone` for clean visual splitting of chunks

### Content Tree Panel
- Interactive tree visualization with expand / collapse
- Node selection with canvas highlighting sync
- Drag-and-drop node reorganization
- Importance tagging display
- Tree zoom controls

### AI Chunk Chat
- Per-chunk AI assistant with multi-turn conversation
- Streaming response with token-by-token rendering
- Intent-aware pipeline (expand, compress, rewrite, translate, deduplicate, etc.)
- Duplicate detection with visual highlighting of similar chunks
- Apply-suggestion button to commit AI edits
- Word count awareness and page limit constraints

### Version Management
- Auto-save with debounced triggering (5s after changes)
- Manual snapshots with custom labels
- Version timeline with restore and baseline marking
- Save-on-unload via `sendBeacon` API

### Export
- HTML export with print-ready multi-column CSS
- PDF export via headless browser rendering
- Format selector modal with download

### Markdown Rendering
- Full GFM support (tables, strikethrough, task lists) via `remark-gfm`
- Code blocks, headings, bold, lists, blockquotes, images
- Table styling with borders and compact padding

## 6. Back-End Architecture

### Request Flow

All API requests follow this path:

```
Client → Express Router → Auth Middleware (JWT) → Controller → Service → Response
```

For generation requests, the flow is streaming:

```
Client → POST /generate → SSE connection held open
  → generationOrchestrator runs L1 → L2 → L3 → L4
  → Each stage emits SSE events (start, chunk, complete, error)
  → Client receives real-time progress
```

### Third-Party API Integration

All LLM calls are made **from the backend only** — the frontend never contacts LLM providers directly. This design ensures:
- API keys stay server-side (encrypted in MongoDB, decrypted only at call time)
- Rate limiting is enforced globally across all user actions
- Prompt templates are not exposed to the client

```
Backend ──── ProviderFactory ──┬── OpenAIProvider ──→ OpenAI API / Compatible APIs
                               ├── AnthropicProvider ──→ Anthropic API
                               └── GeminiProvider ──→ Google Generative AI
```

The `ProviderFactory` selects the provider based on user preferences, decrypts the API key, wraps with `ModelBoundProvider` (if custom model), and wraps with `RateLimitedProvider` (global 429 throttling).

### Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| SSE over WebSocket | Generation is server-push only; SSE is simpler, works through proxies, auto-reconnects |
| Provider Factory pattern | Adding a new LLM provider requires only one new class implementing `LLMProvider` |
| Algorithmic layout (no LLM for L4) | Layout is deterministic and fast; LLM-based layout was unreliable |
| User-provided API keys | No operational cost for LLM usage; users control spend; no rate-limit contention |
| Encrypted key storage | AES-256-GCM encryption at rest; keys decrypted only in-memory at call time |
| AbortController for cancellation | Propagates cancel signal through rate limiter, LLM stream, and database operations |

## 7. Back-End Features

### Authentication & Security
- JWT-based authentication with 7-day token expiry
- Bcrypt password hashing (12 salt rounds)
- AES-256-GCM encryption for stored API keys
- Per-route auth middleware
- API key masking in responses (show only first/last 4 chars)

### Course & File Management
- Full CRUD for courses with user isolation
- Multi-file upload via Multer (up to 20 files per request)
- File parsing: PDF (text layer + OCR fallback), DOCX (mammoth.js), PPTX, TXT, images
- Static file serving for uploaded content
- Cascading delete (course → tree, chunks, layout, versions)

### LLM Integration
- **3 providers**: OpenAI (+ any compatible API), Anthropic, Gemini
- **3 call modes**: `chat()`, `chatStream()`, `chatWithTools()`
- Custom base URL support for OpenAI-compatible APIs (auto-strips `/chat/completions` suffix)
- User-configurable model override per provider
- Global rate limiter: detects 429/quota errors, throttles all subsequent calls
- Retry with exponential backoff (2-3 attempts)
- Reasoning model preamble stripping (`<think>`, `<reasoning>`, etc.)

### Generation Pipeline (L1-L4)
- **L1**: Tree generation from extracted text (max 60K chars, 15K per file)
- **L2**: Concurrent chunk generation (3 subtrees in parallel, 28K chars per subtree)
- **L3**: Importance-based compression (High-Frequency → Important → Awareness)
- **L4**: Algorithmic layout with binary-search column height optimization
- SSE streaming with per-stage events (`l1:start`, `l1:chunk`, `l1:complete`, etc.)
- AbortController-based cancellation with cleanup
- Crash recovery: stuck courses auto-recovered on server restart

### Incremental Merge
- 6-stage pipeline for adding new files without full regeneration
- Tree diff computation (old vs. new)
- Merge operations: create, update, delete, move
- Validation and rollback on failure

### Chunk Chat (AI Editing)
- Router → Retriever → Generator pipeline
- Intent classification (expand, compress, rewrite, deduplicate, translate, etc.)
- Duplicate detection across all course chunks
- Word count constraint awareness
- Streaming response with suggestion parsing

### Layout Engine
- Pure algorithmic (no LLM): binary search for optimal column height
- Multi-column support (1-4 columns auto-detected from page width and font size)
- Container grouping by parent tree node
- Tree-order preservation across columns and pages
- Re-layout and optimize-layout endpoints

### Version Management
- Auto-save on generation completion
- Manual snapshots with label and description
- Full tree + layout + chunks snapshot restore
- Baseline marking for reference versions

### Export
- HTML export with multi-column print CSS
- PDF export via Puppeteer (lazy-loaded optional dependency)
- Configurable page size and margins

### API Surface

| Group | Endpoints |
|-------|-----------|
| Auth | `POST /register`, `POST /login`, `GET /me`, `PUT /api-keys`, `PUT /settings` |
| Courses | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`, `POST /:id/files`, `DELETE /:id/files/:fileId` |
| Generation | `POST /:id/generate`, `POST /:id/incremental-merge`, `POST /:id/cancel` |
| Layout | `GET /:id/layout`, `PUT /:id/layout`, `POST /:id/relayout`, `POST /:id/optimize-layout` |
| Tree | `GET /:id/content-tree`, `PUT /:id/content-tree` |
| Chunks | `PATCH /:id/chunks/:nodeId`, `POST /:id/chunks/:nodeId/chat` |
| Export | `GET /:id/export/html`, `GET /:id/export/pdf` |
| Versions | `GET /:id/versions`, `POST /:id/versions`, `POST /:id/versions/:vid/restore`, `PUT /:id/versions/:vid/baseline`, `DELETE /:id/versions/:vid` |
| Utility | `POST /:id/cmd-k`, `GET /:id/source-file/:fid`, `POST /:id/images`, `GET /health` |

---

## Getting Started

### Prerequisites

| Tool | Localhost | Docker |
|------|-----------|--------|
| Node.js 18+ | Required | Not needed |
| MongoDB 7+ | Required | Included in compose |
| Docker & Docker Compose | Not needed | Required |

### Option A — Localhost

#### 1. Install MongoDB

**macOS (Homebrew):**

```bash
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0
```

**Ubuntu / Debian:**

```bash
# See https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-ubuntu/
sudo systemctl start mongod
```

**Windows:**

```powershell
winget install MongoDB.Server
# MongoDB runs as a Windows service automatically after installation.
# If it does not start, run:
net start MongoDB
```

#### 2. Install Dependencies

```bash
cd client && npm install
cd ../server && npm install
```

#### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env — set JWT_SECRET and ENCRYPTION_KEY to secure random strings.
# Uncomment MONGODB_URI if your MongoDB is not on localhost:27017.
```

#### 4. Start the App

Open **two terminals**:

```bash
# Terminal 1 — Backend (http://localhost:3001)
cd server
npm run dev
```

```bash
# Terminal 2 — Frontend (http://localhost:5173)
cd client
npm run dev
```

Open **http://localhost:5173** in your browser.

### Option B — Docker

#### 1. Configure Environment

```bash
cp .env.example .env
# Edit .env — set JWT_SECRET and ENCRYPTION_KEY to secure random strings.
```

#### 2a. Development (with hot-reload)

```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:3001 |
| MongoDB | localhost:27017 |

Source file changes sync into the containers automatically via `docker compose watch`.

#### 2b. Production

```bash
docker compose -f docker-compose.prod.yml up --build
```

| Service | URL |
|---------|-----|
| App (Nginx) | http://localhost (port 80) |
| Backend | http://localhost:3001 |

#### Useful Docker Commands

```bash
docker compose down              # Stop and remove containers
docker compose down -v           # Also remove volumes (deletes DB data)
docker compose logs -f server    # Tail server logs
docker compose exec mongo mongosh studysheet   # Open MongoDB shell
```

## Project Structure

```
studysheet/
├── client/                 # React frontend (Vite)
│   ├── src/
│   │   ├── components/     # UI components by feature
│   │   ├── pages/          # Route pages
│   │   ├── stores/         # Zustand state management
│   │   ├── services/       # API client
│   │   ├── hooks/          # Custom React hooks
│   │   ├── types/          # TypeScript interfaces
│   │   └── utils/          # Helpers
│   ├── Dockerfile
│   ├── nginx.conf          # Production reverse proxy config
│   └── vite.config.ts
├── server/                 # Express backend
│   ├── src/
│   │   ├── config/         # DB, CORS, env config
│   │   ├── controllers/    # Route handlers
│   │   ├── models/         # Mongoose schemas
│   │   ├── routes/         # API route definitions
│   │   ├── services/       # Business logic
│   │   ├── llm/            # LLM provider adapters & prompts
│   │   ├── middleware/     # Error handling
│   │   └── utils/          # Helpers
│   └── Dockerfile
├── deploy/                 # EC2 deployment scripts
├── docker-compose.yml      # Development compose
├── docker-compose.prod.yml # Production compose
└── .env.example            # Environment template
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | — | Secret for signing JWTs (required) |
| `ENCRYPTION_KEY` | — | Key for encrypting stored API keys (required, min 32 chars) |
| `MONGODB_URI` | `mongodb://localhost:27017/studysheet` | MongoDB connection string |
| `PORT` | `3001` | Backend server port |
| `NODE_ENV` | `development` | `development` or `production` |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `UPLOAD_DIR` | `uploads` | Directory for uploaded files |
