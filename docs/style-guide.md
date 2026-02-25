# Replic Style Guide

Living reference for Replic's visual identity. All design decisions should trace back to this document.

---

## Color Palette

### Primary Colors

| Role | Name | Hex | Usage |
|------|------|-----|-------|
| Primary / Action | Burnt Sienna | `#C1502D` | CTA buttons, active states, SVP score highlights, links, key UI accents |
| Dark / Depth | Deep Indigo | `#2F1847` | Dark mode base, navbar backgrounds, heavy headings, footer, overlays |

### Secondary Colors

| Role | Name | Hex | Usage |
|------|------|-----|-------|
| Secondary / Mid | Dusty Plum | `#624763` | Secondary buttons, hover states, borders, secondary tags, dividers, sidebar elements |
| Soft Accent | Blush | `#EABFCB` | Difficulty badges, chips, subtle highlights, tag backgrounds, empty state illustrations |
| Background / Cards | Warm White | `#F5EAE0` | Page backgrounds, card surfaces, input field backgrounds, light mode base |

### Supplementary Tokens

| Role | Name | Hex | Usage |
|------|------|-----|-------|
| Body Text | Warm Near-Black | `#1A1025` | All body copy and UI text on light backgrounds |
| Secondary Text | Mid Gray | `#8C7D8E` | Placeholder text, captions, disabled labels, secondary metadata |

### Usage Rules

- Never use Burnt Sienna (`#C1502D`) as a large background — it's an accent, not a canvas
- Deep Indigo (`#2F1847`) and Warm White (`#F5EAE0`) are the primary light/dark contrast pair
- Blush (`#EABFCB`) should appear sparingly — works best as a background tint on small elements like badges
- Always verify contrast ratios for text accessibility (WCAG AA minimum)
- Never hardcode hex values in code — always use CSS custom properties (see below)

### CSS Custom Properties

```css
:root {
  --color-primary:    #C1502D;  /* Burnt Sienna */
  --color-dark:       #2F1847;  /* Deep Indigo */
  --color-secondary:  #624763;  /* Dusty Plum */
  --color-accent:     #EABFCB;  /* Blush */
  --color-surface:    #F5EAE0;  /* Warm White */
  --color-text:       #1A1025;  /* Near-black (warm) */
  --color-text-muted: #8C7D8E;  /* Mid gray */
}
```

---

## Typography

### Font Stack

| Role | Font | Source | Weights |
|------|------|--------|---------|
| Display / Headings | Fraunces | Google Fonts | 600, 700 |
| UI / Body | Plus Jakarta Sans | Google Fonts | 400, 500, 600 |
| Data / Mono | DM Mono | Google Fonts | 400 |

### Google Fonts Import

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600&family=DM+Mono&display=swap" rel="stylesheet">
```

Or via CSS:

```css
@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600&family=DM+Mono&display=swap');
```

### CSS Font Variables

```css
:root {
  --font-display: 'Fraunces', Georgia, serif;
  --font-body:    'Plus Jakarta Sans', system-ui, sans-serif;
  --font-mono:    'DM Mono', 'Courier New', monospace;
}
```

Never hardcode font family strings in components — always use these variables.

---

### Fraunces — Display & Headings

Optical-size serif with warmth and strong personality. Use it large, use it sparingly. It's the brand voice, not the workhorse.

| Use Case | Size (guideline) | Weight |
|----------|-----------------|--------|
| Hero headline (landing page) | 56–72px | 700 |
| Page title / Design title | 36–48px | 700 |
| Section heading (H2) | 28–32px | 600 |
| Sub-section heading (H3) | 22–26px | 600 |
| Wordmark / Logo | Custom | 700 |

**Do not use Fraunces below ~20px.** At small sizes it loses legibility and its character becomes noise. Hand off to Plus Jakarta Sans for anything smaller.

---

### Plus Jakarta Sans — UI & Body

Clean geometric sans-serif. Handles all functional work — navigation, buttons, labels, body copy, forms.

| Use Case | Size (guideline) | Weight |
|----------|-----------------|--------|
| Body copy (experiment descriptions, steps) | 16px | 400 |
| Secondary body / captions | 14px | 400 |
| UI labels (nav, form fields, tooltips) | 14px | 500 |
| Buttons | 14–16px | 600 |
| Small heading / card title | 18–20px | 600 |
| Eyebrow / overline text | 11–12px | 600 (all-caps + letter-spacing) |

---

### DM Mono — Data & Structured Content

Monospaced font signaling precision. Use wherever content is data-like rather than prose.

| Use Case | Size (guideline) | Weight |
|----------|-----------------|--------|
| Variable names (independent, dependent, controlled) | 13–14px | 400 |
| Measurement units | 13px | 400 |
| SVP score display (stat blocks) | 20–28px | 400 |
| Difficulty level chips | 12px | 400 |
| Discipline tags | 12px | 400 |
| API field names (if surfaced in UI) | 13px | 400 |

---

## Component Guidelines

### Buttons

- Primary action: Burnt Sienna background (`--color-primary`), white text, Plus Jakarta Sans 600
- Secondary action: Dusty Plum border (`--color-secondary`), Dusty Plum text, transparent background
- Destructive: Red (standard danger color), not part of the brand palette
- Disabled: `--color-text-muted` text, `--color-surface` background

### Badges & Chips

- Difficulty level badges: Blush background (`--color-accent`), Deep Indigo text (`--color-dark`), DM Mono 12px
- Discipline tags: same treatment as difficulty badges
- Status chips (draft / published / locked): use DaisyUI badge variants, customized to palette

### Cards

- Background: `--color-surface` (Warm White)
- Border: 1px solid, `--color-secondary` at low opacity (~20%)
- Shadow: subtle, warm-tinted (avoid pure gray box shadows)

### Data Display (Tremor components)

- SVP scores and reputation stats: DM Mono, large size, Burnt Sienna for the number
- Charts and graphs: use palette colors in order — Burnt Sienna, Deep Indigo, Dusty Plum, Blush
- Stat card backgrounds: Warm White surface

### Animations (Motion Primitives)

Use sparingly and intentionally — only where animation adds clear value:
- SVP score reveals and updates
- Onboarding step transitions
- Animated number counters (reputation scores)
- Page-level transitions

Do not animate routine UI interactions (hover states, dropdowns) — DaisyUI handles those.

---

## Quick Reference

> **When in doubt:** Fraunces for headlines, Plus Jakarta Sans for everything functional, DM Mono for data. Burnt Sienna for actions, Deep Indigo for depth, Warm White for surfaces. Use CSS variables always — never hardcode values.
