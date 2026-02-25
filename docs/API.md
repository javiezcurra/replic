# Replic API Reference

Base URL (local): `http://localhost:3001`
Base URL (production): `https://<project-id>.web.app/api`

All responses are JSON. Successful responses use `2xx` status codes. Errors follow:

```json
{
  "status": "error",
  "message": "Human-readable description"
}
```

**Authentication** — Protected endpoints require a Firebase ID token in the `Authorization` header:

```
Authorization: Bearer <firebase-id-token>
```

---

## Table of Contents

- [Health](#health)
- [Users](#users)
- [Designs](#designs)

---

## Health

### `GET /api/health`

Verify the server is running.

**Response `200`**

```json
{
  "status": "ok",
  "timestamp": "2024-02-25T00:00:00.000Z",
  "environment": "development",
  "version": "0.1.0"
}
```

---

## Users

All `/api/users` endpoints require authentication.

### Shared types

**`UserProfile`** — returned for the authenticated user's own profile:

```json
{
  "uid": "firebase-uid",
  "displayName": "Ada Lovelace",
  "email": "ada@example.com",
  "photoURL": "https://...",
  "bio": "Biochemist at MIT",
  "affiliation": "MIT",
  "scores": {
    "designer": 0,
    "experimenter": 0,
    "reviewer": 0
  },
  "createdAt": "2024-02-25T00:00:00.000Z",
  "updatedAt": "2024-02-25T00:00:00.000Z"
}
```

**`PublicUserProfile`** — same shape but without `email`.

---

### `POST /api/users/me` 🔒

Create or sync the authenticated user's profile. Call this on every sign-in. Syncs `displayName`, `email`, and `photoURL` from the Firebase auth token on subsequent calls.

**Response `201`** — first sign-in (profile created)
**Response `200`** — subsequent sign-ins (profile synced)

```json
{ "status": "ok", "data": { ...UserProfile } }
```

---

### `GET /api/users/me` 🔒

Retrieve the authenticated user's full profile.

**Response `200`**

```json
{ "status": "ok", "data": { ...UserProfile } }
```

**Response `404`** — profile not yet created (call `POST /api/users/me` first).

---

### `PATCH /api/users/me` 🔒

Update editable profile fields. All fields are optional; omit any you don't want to change.

**Request body**

| Field | Type | Description |
|---|---|---|
| `displayName` | `string` | Public display name |
| `photoURL` | `string \| null` | Avatar URL |
| `bio` | `string \| null` | Short biography |
| `affiliation` | `string \| null` | Institution or organisation |

**Response `200`**

```json
{ "status": "ok", "data": { ...UserProfile } }
```

---

### `GET /api/users/:id` 🔒

Get the public profile of any user by their UID.

**Response `200`**

```json
{ "status": "ok", "data": { ...PublicUserProfile } }
```

**Response `404`** — user not found.

---

## Designs

### Lifecycle

```
Draft (private) ──publish──▶ Published (public) ──first execution──▶ Locked (public)
```

- **Draft** — only visible to authors; fully editable.
- **Published** — publicly visible; fully editable.
- **Locked** — publicly visible; methodology fields are frozen. Fork to iterate.

### Locked fields

Once a design has `execution_count >= 1` the following fields **cannot be changed** via `PATCH`. A `403` is returned if any are included in the request body. Fork the design to modify them.

`hypothesis` · `steps` · `materials` · `research_questions` · `independent_variables` · `dependent_variables` · `controlled_variables`

---

### Shared types

<details>
<summary><strong>Design object</strong></summary>

```json
{
  "id": "firestore-doc-id",

  "title": "Effect of light wavelength on plant growth",
  "hypothesis": "Plants exposed to blue light will grow faster than those under red light.",
  "discipline_tags": ["biology", "botany"],
  "difficulty_level": "High School",

  "steps": [
    {
      "step_number": 1,
      "instruction": "Set up three identical plant beds.",
      "duration_minutes": 30,
      "safety_notes": null
    }
  ],
  "materials": [
    {
      "material_id": "uuid",
      "quantity": "3 units",
      "alternatives_allowed": false,
      "criticality": "required",
      "usage_notes": null,
      "estimated_cost_usd": 12.50
    }
  ],
  "research_questions": [
    {
      "id": "stable-uuid",
      "question": "Does wavelength affect stem length after 4 weeks?",
      "expected_data_type": "numeric",
      "measurement_unit": "cm",
      "success_criteria": ">10% difference between groups"
    }
  ],
  "independent_variables": [
    { "name": "light_wavelength", "type": "categorical", "values_or_range": "red, blue, white", "units": "nm" }
  ],
  "dependent_variables": [
    { "name": "stem_length", "type": "continuous", "values_or_range": "0–50", "units": "cm" }
  ],
  "controlled_variables": [
    { "name": "watering_volume", "type": "continuous", "values_or_range": "200 mL/day", "units": "mL" }
  ],

  "parent_designs": [],
  "references": [
    { "citation": "Smith et al. 2020", "url": null, "doi": "10.1000/xyz123", "relevance_note": "baseline growth rates" }
  ],
  "sample_size": 30,
  "repetitions": 3,
  "statistical_methods": ["ANOVA", "Tukey HSD"],
  "analysis_plan": "Compare mean stem lengths across groups using one-way ANOVA...",
  "estimated_duration": {
    "setup_minutes": 60,
    "execution_minutes": 40320,
    "analysis_minutes": 120,
    "total_days": 30
  },
  "estimated_budget_usd": 75.00,
  "safety_requirements": {
    "risk_level": "low",
    "ppe_required": ["gloves"],
    "supervision_required": false,
    "hazards": null
  },
  "ethical_considerations": null,
  "seeking_collaborators": false,
  "collaboration_notes": null,

  "status": "published",
  "version": 2,
  "author_ids": ["uid-abc"],
  "review_status": "unreviewed",
  "review_count": 0,
  "execution_count": 0,
  "scientific_value_points": 0,
  "derived_design_count": 0,
  "fork_metadata": null,

  "created_at": "2024-02-25T00:00:00.000Z",
  "updated_at": "2024-02-25T00:00:00.000Z"
}
```

</details>

**Enum values**

| Field | Values |
|---|---|
| `difficulty_level` | `Pre-K` `Elementary` `Middle School` `High School` `Undergraduate` `Graduate` `Professional` |
| `status` | `draft` `published` `locked` |
| `review_status` | `unreviewed` `under_review` `reviewed` `flagged` |
| `fork_metadata.fork_type` | `iteration` `adaptation` `replication` |
| `research_questions[].expected_data_type` | `numeric` `categorical` `image` `text` `other` |
| `variables[].type` | `continuous` `discrete` `categorical` |
| `materials[].criticality` | `required` `recommended` `optional` |
| `safety_requirements.risk_level` | `none` `low` `moderate` `high` |

---

### `GET /api/designs`

List all published and locked designs. Results are ordered by `created_at` descending.

**Query parameters**

| Param | Type | Description |
|---|---|---|
| `discipline` | `string` | Filter by a single discipline tag |
| `difficulty` | `string` | Filter by `difficulty_level` |
| `limit` | `number` | Results per page (default `20`, max `100`) |
| `after` | `string` | Design ID to start after (cursor-based pagination) |

**Response `200`**

```json
{ "status": "ok", "data": [ ...Design ], "count": 20 }
```

---

### `POST /api/designs` 🔒

Create a new design. Starts in `draft` status.

**Request body**

Required fields:

| Field | Type | Constraints |
|---|---|---|
| `title` | `string` | Max 200 characters |
| `hypothesis` | `string` | Markdown supported |
| `discipline_tags` | `string[]` | 1–5 tags |
| `difficulty_level` | `DifficultyLevel` | See enum table |
| `steps` | `DesignStep[]` | At least 1 step |
| `research_questions` | `ResearchQuestion[]` | At least 1 question |
| `independent_variables` | `Variable[]` | — |
| `dependent_variables` | `Variable[]` | — |
| `controlled_variables` | `Variable[]` | — |

All other Design fields are optional on creation.

**Response `201`**

```json
{ "status": "ok", "data": { ...Design } }
```

---

### `GET /api/designs/me/list` 🔒

List all designs owned by the authenticated user, including drafts. Ordered by `updated_at` descending.

**Response `200`**

```json
{ "status": "ok", "data": [ ...Design ], "count": 5 }
```

---

### `GET /api/designs/:id`

Get a single design by ID.

- Published / locked designs are publicly accessible.
- Draft designs return `404` to unauthenticated callers and non-authors (to avoid revealing their existence).

**Response `200`**

```json
{ "status": "ok", "data": { ...Design } }
```

**Response `404`** — design not found (or draft not visible to caller).

---

### `PATCH /api/designs/:id` 🔒

Update a design. Caller must be an author.

All fields are optional — only send the fields you want to change.

**Locked designs** (`execution_count >= 1`) — attempting to change any [locked field](#locked-fields) returns `403`.

**Response `200`**

```json
{ "status": "ok", "data": { ...Design } }
```

**Response `403`** — not an author, or attempting to change a locked field.

---

### `POST /api/designs/:id/publish` 🔒

Publish a draft design, making it publicly visible. Caller must be an author.

The design must satisfy all required field constraints before it can be published.

**Response `200`**

```json
{ "status": "ok", "data": { ...Design, "status": "published" } }
```

**Response `400`** — design is not a draft, or fails validation.

---

### `POST /api/designs/:id/fork` 🔒

Fork a published or locked design into a new draft owned by the caller. Increments `derived_design_count` on the source design.

**Request body**

| Field | Type | Description |
|---|---|---|
| `fork_type` | `ForkType` | `iteration` · `adaptation` · `replication` |
| `fork_rationale` | `string` | Why this fork exists |

**Response `201`**

```json
{ "status": "ok", "data": { ...Design, "status": "draft", "fork_metadata": { ... } } }
```

**Response `403`** — source design is a draft.

---

### `DELETE /api/designs/:id` 🔒

Permanently delete a draft design. Caller must be an author. Published and locked designs cannot be deleted.

**Response `200`**

```json
{ "status": "ok", "message": "Design deleted" }
```

**Response `403`** — not an author, or design is not a draft.

---

_This document is a living reference and will be populated as endpoints are built._
