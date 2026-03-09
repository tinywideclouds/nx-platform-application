# LLM Features: Data Sources Workspace

This library (`@nx-platform-application/llm-features-data-sources`) contains the UI, routing, and feature-level state management for the GitHub-to-Firestore ingestion engine.

## Architectural Overview

This feature is built strictly using Angular's modern reactivity model (Zoneless, Signals) and adheres to a strict unidirectional data flow. It acts as the "Smart/Feature" layer, consuming the "Dumb/Infrastructure" network client (`LlmGithubFirestoreClient`).

### 1. Feature State (`LlmDataSourcesStateService`)

The single Source of Truth (SOT) for the UI. It manages:

- **Global State:** The list of available `CacheBundles`.
- **Active Selection State:** The currently selected Cache, its associated `FileMetadata` (read-only projections), and its `FilterProfiles`.
- **Side Effects:** Coordinates network calls to the Go microservice, handles `firstValueFrom` promise resolutions, mutates local signal state to avoid unnecessary network refetching, and triggers `MatSnackBar` user feedback.

### 2. UI Layout & Routing

The workspace utilizes a nested routing architecture mapped to the platform's core UI toolkits:

- **`LlmDataSourcesLayoutComponent`:** The root of the feature. It wraps the workspace in the `<platform-master-detail-layout>`, placing the Sidebar on the left and a `<router-outlet>` on the right.
- **`LlmDataSourcesPlaceholderComponent`:** The default empty state (`/data-sources`) that prompts the user to create a new ingestion cache.

### 3. Smart / Dumb Component Pattern

- **Smart Page (`LlmDataSourcePageComponent`):** Bound to the router (`/data-sources/new` or `/data-sources/:id`). It injects the state service, coordinates the toolbar actions (Edit/Save/Cancel), and passes pristine data down via `input()`.
- **Dumb Forms/Displays (`LlmDataSourceFormComponent`, `LlmFileExplorerDisplayComponent`):** Pure presentation components. They manage their own local transient state (e.g., draft YAML strings), compute their own field-level validation, and communicate entirely via `output()` events. They have zero awareness of HTTP or Routing.

## Integration

This feature expects the Go microservice (`go-github-store`) to be running and accessible via the `/v1/caches` proxy configuration.

## Testing

Run `nx test llm-features-data-sources` to execute the Vitest suite. Tests rely on `ng-mocks` and Angular Router testing modules to verify signal reactivity without hitting the real infrastructure layer.
