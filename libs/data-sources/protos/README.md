# Data Sources Protobuf Contracts (`data-sources-protos`)

This library acts as the strict API boundary and single source of truth between the Angular frontend and the Go backend for the **Data Sources** microservice.

It utilizes [Buf](https://buf.build/) to compile `.proto` definitions into both TypeScript interfaces and Go structs.

## Domain Concepts

This contract defines the following core domain entities:

- **DataSourceBundle (`DataSourceMetadataPb`)**: Represents a specific GitHub repository and branch synced into the system.
- **FilterProfile (`ProfilePb`)**: User-defined YAML rules (includes/excludes) to filter which files from a Data Source are ingested.
- **DataGroup (`DataGroupPb`)**: A "Context Blueprint". A named collection of Data Sources (and their applied Filter Profiles). This allows users to bundle multiple repos and standards together. The LLM domain utilizes the `metadata` map on this entity to store ephemeral cache receipts (like Gemini `compiledCacheId`).

## Code Generation

This project uses Buf to generate the respective language bindings.

### Generating TypeScript

The TypeScript generator uses the `es` plugin configured in `buf.gen.ts.yaml`.
To generate the TS files into `dist/ts`:

```bash
npx buf generate --template buf.gen.ts.yaml

```

### Generating Go

The Go generator uses the `go` plugin configured in `buf.gen.go.yaml`.
To generate the Go files into `dist/go`:

```bash
npx buf generate --template buf.gen.go.yaml

```

_Note: The generated files in `dist/` are typically git-ignored and should be regenerated during CI/CD or local development setup._
