# Replic API Reference

Base URL (local): `http://localhost:3001`
Base URL (production): `https://<project-id>.web.app/api`

All responses are JSON. Successful responses use `2xx` status codes; errors follow the shape:

```json
{
  "status": "error",
  "message": "Human-readable description"
}
```

---

## Health

### `GET /api/health`

Verify the server is running and reachable.

**Response `200 OK`**

```json
{
  "status": "ok",
  "timestamp": "2024-02-25T00:00:00.000Z",
  "environment": "development",
  "version": "0.1.0"
}
```

---

_This document is a living reference and will be populated as endpoints are built._
