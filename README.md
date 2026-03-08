# Replic

**Replic** is an open-source platform for scientific experimentation — making it easier to design, run, and share reproducible experiments. It decouples experimental **design** from **execution**, treating both as independent, peer-reviewable contributions.

## Why Replic?

Traditional science publishing rewards positive results and treats replication as second-class work. Replic flips this:

- **No publication bias** — null and negative results count equally; replications are rewarded, not dismissed.
- **Design ≠ Execution** — designing an experiment and running it are separate contributions, each with their own credit and peer review.
- **Peer review before execution** — designs are reviewed and refined _before_ anyone runs them, freezing the methodology once executions begin.
- **3D reputation** — contributors earn separate Designer, Experimenter, and Reviewer scores instead of a single impact metric.
- **Scientific Value Points (SVP)** — a PageRank-style scoring system that propagates credit across forks, endorsements, and executions.

**Target users:** K-12 students, citizen scientists, amateur researchers, and professional scientists at all levels.

## Core Features

### Experiment Design

Create structured experimental designs with hypotheses, step-by-step procedures, research questions, variables (independent, dependent, controlled), material lists, safety considerations, and references. Designs follow a clear lifecycle:

- **Draft** — private and editable, visible only to authors
- **Published** — public and open for peer review
- **Locked** — methodology frozen once the first execution begins; authors fork to iterate

Designs support versioning with changelogs and can be **forked** in three ways: replication (reproduce), iteration (improve), or adaptation (different context).

### Peer Review

Any non-author can review a published design before executions begin. Reviews include readiness signals, endorsements, and field-level suggestions (edits, issues, questions, safety concerns). Authors can reply to and accept or close suggestions, and accepted contributions are tracked in the scoring ledger.

### Experiment Execution

Run any published or locked design with full tracking: log start dates, add co-experimenters, record methodology deviations, and mark experiments as completed or cancelled. Each execution locks to the design version at the time it starts, preserving methodology integrity.

### Lab Inventory & Smart Matching

Maintain a personal lab inventory of equipment and consumables. Replic matches your inventory against experiment requirements to surface designs you can fully or partially conduct with what you already have. A built-in "Household Items" bundle covers common materials assumed to be universally available.

### Material Catalog

A shared, searchable library of lab materials (consumables and equipment) with categories, tags, supplier links, cost estimates, and safety notes. Users can contribute new materials; admins verify and curate them into bundles (e.g., "Starter Kit").

### Collaboration

Built-in collaboration workflows: send and accept collaboration requests, co-author designs, and add co-experimenters to executions. Discover other researchers by name or affiliation.

### Pipeline & Watchlist

- **Pipeline** — a personal "to-run" list for planning which experiments to execute next
- **Watchlist** — follow designs for update notifications; auto-added when you submit a review

### Notifications

Event-driven notifications for collaboration requests, experiment activity, review interactions, watchlist updates, and admin actions.

### Search & Discovery

Global search across designs (by title, summary, or hypothesis) and users (by name or affiliation). Browse experiments by discipline and difficulty level.

### Scoring & Reputation Ledger

An immutable ledger tracks contribution events: publishing designs, receiving endorsements, having designs forked or referenced, submitting reviews, and having suggestions accepted. These events feed the 3D reputation system and SVP scores.

### Admin Tools

Admin dashboard for user management, platform-wide design oversight, material bundle curation, taxonomy management (disciplines and material categories), and ledger viewing.

## Repository Structure

```
replic/
├── frontend/          # React + Vite + TypeScript web application
├── backend/           # Node.js + Express REST API server
├── docs/              # Project documentation
│   ├── API.md         # API reference
│   ├── style-guide.md # Design system documentation
│   └── tech-stack.md  # Engineering design and stack rationale
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
| UI Components | DaisyUI, Tremor (data viz), Motion Primitives (animations) |
| Backend | Node.js, Express, TypeScript |
| Auth & DB | Firebase (Auth, Firestore) |
| Hosting | Firebase Hosting (frontend), Cloud Functions (backend) |
| CI/CD | GitHub Actions |

**Architecture:** API-first monorepo. All frontend-backend communication goes through RESTful JSON APIs. Firebase Auth handles authentication via Google OAuth and email/password.

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
