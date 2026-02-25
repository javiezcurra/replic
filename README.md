# Replic

**Replic** is an open-source platform for scientific experimentation — making it easier to design, run, and share reproducible experiments.

## Repository Structure

```
replic/
├── frontend/          # React + Vite + TypeScript web application
├── backend/           # Node.js + Express REST API server
├── docs/              # Project documentation
│   └── API.md         # API reference (populated as we build)
├── .github/
│   └── workflows/     # GitHub Actions CI/CD pipelines
├── firebase.json      # Firebase Hosting + Cloud Functions config
├── .env.example       # Root-level environment variable reference
└── README.md
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Auth & DB | Firebase (Auth, Firestore) |
| Hosting | Firebase Hosting (frontend) |
| Functions | Firebase Cloud Functions (backend) |
| CI/CD | GitHub Actions |

## Local Development

### Prerequisites

- Node.js 18+
- npm 9+
- Firebase CLI: `npm install -g firebase-tools`

### 1. Clone the repository

```bash
git clone https://github.com/javiezcurra/replic.git
cd replic
```

### 2. Set up environment variables

```bash
# Root (reference only)
cp .env.example .env

# Frontend
cp frontend/.env.example frontend/.env

# Backend
cp backend/.env.example backend/.env
```

Fill in your Firebase project credentials in each `.env` file.
Find them in the [Firebase Console](https://console.firebase.google.com) under **Project Settings**.

### 3. Install dependencies

```bash
# Frontend
cd frontend && npm install

# Backend
cd ../backend && npm install
```

### 4. Run the development servers

**Frontend** (runs on http://localhost:5173):
```bash
cd frontend
npm run dev
```

**Backend** (runs on http://localhost:3001):
```bash
cd backend
npm run dev
```

### 5. Verify the backend is running

```bash
curl http://localhost:3001/api/health
# Expected: {"status":"ok","timestamp":"...","environment":"development"}
```

## Firebase Setup

1. Create a project at [Firebase Console](https://console.firebase.google.com)
2. Enable **Authentication** and **Firestore**
3. Download the Admin SDK service account key for the backend
4. Log in to Firebase CLI: `firebase login`
5. Set your project: `firebase use --add`

## Deployment

Deployment is automated via GitHub Actions on push to `main`.

To deploy manually:
```bash
# Build frontend
cd frontend && npm run build

# Build backend
cd backend && npm run build

# Deploy both
firebase deploy
```

## Contributing

See [CONTRIBUTING.md](./docs/CONTRIBUTING.md) for guidelines (coming soon).

## License

MIT
