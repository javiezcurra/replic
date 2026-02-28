# Replic — Claude Code Project Brief

Read this file at the start of every session. Full documentation lives in `/docs/`.

---

> ## ⚠️ ALWAYS OPEN A PULL REQUEST AFTER PUSHING
>
> **Every single time you push code to any branch, you MUST immediately open a
> pull request targeting `main`.** Do not wait to be asked. Do not push and
> move on. Push → open PR, every time, no exceptions.
>
> Use `gh pr create` or the GitHub API. Include a summary of changes and a
> test-plan checklist in the PR body.

---

## What Replic Is

A scientific platform that decouples experimental **design** from **execution**, treating both as independent, peer-reviewable contributions. Core principles:

- No publication bias — null/negative results count equally; replications are rewarded
- Four first-class entities: Design, Design Review, Execution, Execution Review
- 3D reputation system: Designer Score, Experimenter Score, Reviewer Score
- Scientific Value Points (SVP) — PageRank-style scoring propagated across executions
- Target users: K-12 students, citizen scientists, amateur researchers

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript + Tailwind CSS |
| UI Components | DaisyUI (primary), Tremor (data viz), Motion Primitives (animations — use sparingly) |
| Backend | Node.js + Express (Firebase Cloud Functions) |
| Database | Firestore |
| Hosting | Firebase Hosting + Cloud Functions |
| API Docs | OpenAPI / Swagger |
| Version Control | GitHub |

**Architecture:** API-first. All UI↔backend communication through REST APIs. Single monorepo (`/frontend`, `/backend`, `/docs`).

See `/docs/tech-stack.md` for full rationale and library usage rules.

---

## Design System

**Palette:**

| Token | Hex | Role |
|-------|-----|------|
| `--color-primary` | `#C1502D` | Burnt Sienna — CTAs, active states, SVP highlights |
| `--color-dark` | `#2F1847` | Deep Indigo — dark backgrounds, headings, footer |
| `--color-secondary` | `#624763` | Dusty Plum — secondary elements, hover states, borders |
| `--color-accent` | `#EABFCB` | Blush — badges, chips, subtle highlights |
| `--color-surface` | `#F5EAE0` | Warm White — page backgrounds, cards |
| `--color-text` | `#1A1025` | Near-black (warm) — body text |
| `--color-text-muted` | `#8C7D8E` | Mid gray — secondary/placeholder text |

**Fonts:**

| Font | Role | Weights |
|------|------|---------|
| Fraunces | Display/headings only — logo, hero text, H1/H2. Never below ~20px | 600, 700 |
| Plus Jakarta Sans | All UI chrome and body copy — nav, buttons, labels, body text | 400, 500, 600 |
| DM Mono | Data and structured content — variable names, measurement units, SVP scores, tags | 400 |

**Google Fonts import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600&family=DM+Mono&display=swap');
```

**CSS custom properties** (add to global stylesheet):
```css
:root {
  --color-primary:    #C1502D;
  --color-dark:       #2F1847;
  --color-secondary:  #624763;
  --color-accent:     #EABFCB;
  --color-surface:    #F5EAE0;
  --color-text:       #1A1025;
  --color-text-muted: #8C7D8E;

  --font-display: 'Fraunces', Georgia, serif;
  --font-body:    'Plus Jakarta Sans', system-ui, sans-serif;
  --font-mono:    'DM Mono', 'Courier New', monospace;
}
```

See `/docs/style-guide.md` for full usage rules, size guidelines, and component-level decisions.

---

## UI Library Rules

- **DaisyUI** — use for all general components (buttons, forms, cards, modals, navbars, badges). Configure the DaisyUI theme using the CSS variables above.
- **Tremor** — use for data display surfaces only: SVP stat blocks, reputation scores, execution count charts, experiment metrics.
- **Motion Primitives** — use sparingly and intentionally: score reveals, page transitions, onboarding moments, animated counters. Not a default — only where it adds clear value.

---

## Key Data Types

The primary Firestore entity is `Design`. Required fields on creation:

```typescript
title: string                      // max 200 chars
hypothesis: string
discipline_tags: string[]          // max 5
difficulty_level: DifficultyLevel  // 'Pre-K' | 'Elementary' | 'Middle School' | 'High School' | 'Undergraduate' | 'Graduate' | 'Professional'
steps: DesignStep[]                // at least 1
research_questions: ResearchQuestion[]  // at least 1
independent_variables: Variable[]
dependent_variables: Variable[]
controlled_variables: Variable[]
```

Full type definitions: `/backend/src/types/design.ts` and `/backend/src/types/user.ts`.

---

## Coding Conventions

- All TypeScript — no plain JS files in frontend or backend
- Use CSS custom properties (defined above) for all colors — never hardcode hex values
- Use `--font-display`, `--font-body`, `--font-mono` variables — never hardcode font family strings
- DaisyUI components should use the custom theme tokens, not DaisyUI's default color names
- Keep components small and composable
- API responses always follow the pattern: `{ status: 'ok', data: ... }` or `{ status: 'error', message: ... }`

---

## Git Workflow

After pushing any branch, **always open a pull request** targeting `main`. Include a short summary of changes and a test plan checklist in the PR body.

---

## Repo Structure

```
CLAUDE.md              ← you are here
/backend
  /src
    /controllers       ← route handlers (designController.ts, userController.ts, etc.)
    /middleware        ← auth, error handling
    /routes            ← Express routers
    /types             ← TypeScript interfaces (design.ts, user.ts)
    /lib               ← Firebase admin setup
/frontend
  /components          ← React components
  /styles              ← Tailwind config, DaisyUI theme, global CSS
/docs
  API.md               ← OpenAPI/REST API reference
  style-guide.md       ← Full design system documentation
  tech-stack.md        ← Full engineering design and stack rationale
```
