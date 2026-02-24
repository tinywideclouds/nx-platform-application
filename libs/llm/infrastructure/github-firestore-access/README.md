# LLM Infrastructure: GitHub & Firestore Access

This library (`@nx-platform-application/llm-infrastructure-github-firestore-access`) acts as the strict HTTP infrastructure client connecting the Angular application to the Go-based `go-github-store` sync microservice.

## Architectural Role

This library is strictly "dumb" infrastructure. It holds no application state, signals, or UI logic. Its sole responsibility is to accurately map TypeScript payloads to the `GET`, `POST`, `PUT`, and `DELETE` requests defined by the backend API.

The service routes traffic to the `/v1/caches` proxy endpoint, which the local development server (via `proxy.conf.json`) maps to the Go service on `:8080`.

## API Coverage

The `LlmGithubFirestoreClient` covers the following domain boundaries:

- **Ingestion:** Triggering GitHub repository syncing (`POST /v1/caches/sync`).
- **Metadata Reading:** Fetching available caches and lightweight file structures (excluding massive file content bodies to save bandwidth).
- **Profile Management:** Full CRUD operations for YAML-based Filter Profiles.

## Running unit tests

Run `nx test llm-infrastructure-github-firestore-access` to execute the unit tests via Vitest.

The test suite uses `HttpTestingController` to ensure exact URL and HTTP verb mappings against the Go `ServeMux` specifications.
