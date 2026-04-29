# StudySheet

AI-powered exam cheatsheet generator. Upload course materials → AI builds an exam-point content tree → Adjust and generate a draggable, editable chunk layout → Export as PDF / HTML.

## Tech Stack

- **Frontend:** React 18 (Vite) + TypeScript + Zustand + dnd-kit + Tailwind CSS
- **Backend:** Node.js + Express + TypeScript
- **Database:** MongoDB 7+ (Mongoose)
- **LLM:** User-provided API Key (OpenAI / Anthropic / Gemini)

## Prerequisites

| Tool | Localhost | Docker |
|------|-----------|--------|
| Node.js 18+ | Required | Not needed |
| MongoDB 7+ | Required | Included in compose |
| Docker & Docker Compose | Not needed | Required |

## Option 1 — Localhost

### 1. Install MongoDB

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

### 2. Install Dependencies

```bash
cd client && npm install
cd ../server && npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env — set JWT_SECRET and ENCRYPTION_KEY to secure random strings.
# Uncomment MONGODB_URI if your MongoDB is not on localhost:27017.
```

### 4. Start the App

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

## Option 2 — Docker

### 1. Configure Environment

```bash
cp .env.example .env
# Edit .env — set JWT_SECRET and ENCRYPTION_KEY to secure random strings.
```

### 2a. Development (with hot-reload)

```bash
docker compose up
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- MongoDB: localhost:27017

Source file changes sync into the containers automatically (`docker compose watch`).

### 2b. Production

```bash
docker compose -f docker-compose.prod.yml up --build
```

- App: http://localhost (port 80, served by Nginx)
- Backend: http://localhost:3001

### Useful Docker Commands

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

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Log in |
| GET | `/api/courses` | List user courses |
| POST | `/api/courses` | Create a course |
| POST | `/api/courses/:id/generate` | Generate content tree & chunks |
| GET | `/api/courses/:id/versions` | List version snapshots |
| GET | `/api/courses/:id/export` | Export as PDF / HTML |
| GET | `/api/health` | Health check |
