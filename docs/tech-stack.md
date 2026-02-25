# Replic — Engineering Design & Tech Stack

---

## Engineering Philosophy

### API-First Architecture

All UI↔backend interactions go through custom REST APIs. This enables:
- Multiple interfaces (web, mobile, etc.) built against the same backend
- Public API for third-party tools and integrations
- Clear contract between frontend and backend
- Automatic API documentation via OpenAPI/Swagger

### Responsive Web-First MVP

Start with a web app that works on all screen sizes. Native apps can follow if needed without rearchitecting the backend.

### Single Repository

Frontend, backend, and docs live in one repo for easier Claude Code management and unified deployment.

---

## Core Tech Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Frontend | React + TypeScript + Tailwind CSS | Responsive design, rapid iteration with Claude Code |
| Backend | Node.js + Express | Simple API layer, runs on Firebase Cloud Functions |
| Database | Firestore | Managed, integrates cleanly with Firebase ecosystem |
| Hosting | Firebase (Hosting + Cloud Functions) | Generous free tier, auto-scaling, familiar |
| API Docs | OpenAPI / Swagger | Auto-generated, consumable by tools and third-parties |
| Version Control | GitHub | Claude Code integration, public API discovery |
| Dev Environment | Claude Code (Desktop) | All code written by Claude, deployed via GitHub Actions |

---

## UI Libraries

| Library | Role | License | Link |
|---------|------|---------|------|
| DaisyUI | Primary component library | MIT (free) | [daisyui.com](https://daisyui.com) |
| Motion Primitives | Selective animations | MIT (free) | [motion-primitives.com](https://motion-primitives.com) |
| Tremor | Data visualization surfaces | MIT (free) | [tremor.so](https://tremor.so) |

### DaisyUI

Semantic Tailwind CSS plugin — the primary component system for all general UI. Buttons, forms, cards, modals, navbars, badges, dropdowns, and all standard components come from here.

**Why DaisyUI over shadcn/MUI/Chakra:** Strong personality and a full theming system that maps cleanly to the Replic color palette via CSS variables. More character than shadcn without sacrificing accessibility or practicality. Matches the tone of a platform targeting K-12 to adult users.

**Theming:** Configure the DaisyUI theme using the CSS custom properties defined in `docs/style-guide.md`. Never use DaisyUI's default color names directly — always route through the Replic palette tokens.

### Motion Primitives

Purpose-built React components wrapping Framer Motion. Use sparingly — only for moments that genuinely benefit from animation:
- SVP score reveals and updates
- Reputation counter animations
- Onboarding step transitions
- Landing page hero elements

Do not use for routine UI interactions. DaisyUI handles hover states, focus rings, and transitions.

### Tremor

Purpose-built for data display surfaces. Use for:
- SVP score stat blocks
- Reputation score cards (Designer / Experimenter / Reviewer)
- Execution count charts
- Experiment metric displays

Tremor fills the one gap DaisyUI doesn't address — structured data visualization. The two libraries are compatible and complementary.

---

## Design System

Full documentation in `docs/style-guide.md`. Summary:

**Palette:** Burnt Sienna (`#C1502D`) primary, Deep Indigo (`#2F1847`) dark, Dusty Plum (`#624763`) secondary, Blush (`#EABFCB`) accent, Warm White (`#F5EAE0`) surface.

**Fonts:** Fraunces (display/headings only), Plus Jakarta Sans (UI + body), DM Mono (data + structured content).

**Rule:** Always use CSS custom properties — never hardcode hex values or font family strings.

---

## Repository Structure

```
CLAUDE.md                  ← Project brief, read by Claude Code automatically
/backend
  /src
    /controllers           ← Route handlers
    /middleware            ← Auth, error handling, 404
    /routes                ← Express routers
    /types                 ← TypeScript interfaces (design.ts, user.ts)
    /lib                   ← Firebase admin setup
  package.json
  tsconfig.json
/frontend
  /components              ← React components (DaisyUI + Motion Primitives + Tremor)
  /styles                  ← Tailwind config, DaisyUI theme, global CSS + CSS variables
/docs
  API.md                   ← REST API reference (OpenAPI)
  style-guide.md           ← Full design system documentation
  tech-stack.md            ← This file
.env.example               ← Firebase config template
firebase.json
.firebaserc
```

---

## Development Flow

1. Create GitHub repo + Firebase project
2. Paste Firebase config into `.env`
3. Claude Code writes backend APIs and frontend UI
4. Test locally on Mac
5. Push to GitHub → auto-deploy to Firebase via GitHub Actions

---

## Future Flexibility

This stack supports adding React Native (iOS/Android) later without backend changes — additional clients simply call the same REST APIs. DaisyUI has a React Native companion project if that path is pursued.
