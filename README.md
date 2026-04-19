# StudySheet

AI-powered exam cheatsheet generator. Upload course materials → AI builds an exam-point content tree → Adjust and generate a draggable, editable chunk layout → Export as PDF / HTML.

## Tech Stack

- **Frontend:** React (Vite) + TypeScript + Zustand + dnd-kit + Tailwind CSS
- **Backend:** Node.js + Express + TypeScript
- **Database:** MongoDB (Mongoose)
- **LLM:** User-provided API Key (OpenAI / Anthropic)

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB 7+
- Docker & Docker Compose (optional)

### Development

```bash
# Install dependencies
cd client && npm install
cd ../server && npm install

# Install MongoDB Community Server (one-time)
# macOS (Homebrew):
brew tap mongodb/brew && brew install mongodb-community@7.0
# Ubuntu/Debian: follow the official MongoDB apt repo setup, then install mongodb-org
# Windows (PowerShell + winget):
winget install MongoDB.Server

# Start MongoDB
# macOS (Homebrew service):
brew services start mongodb-community@7.0
# Linux (systemd):
sudo systemctl start mongod
# Windows (as service):
net start MongoDB

# Start server
cd server && npm run dev

# Start client
cd client && npm run dev
```

### Docker

```bash
cp .env.example .env
# Edit .env with your secrets
docker compose up
```

## Project Structure

```
studysheet/
├── client/          # React frontend
├── server/          # Express backend
└── docker-compose.yml
```
