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

# Start MongoDB (if not using Docker)
mongod

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
