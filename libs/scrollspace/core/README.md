# scrollspace-core

This library acts as the UI-agnostic mathematical and structural engine for the application's conversational and timeline interfaces. It completely decouples the complex logic of virtual scrolling, date grouping, and markdown parsing from any specific domain implementations (like LLM Chat or Standard Messaging).

## Architectural Principles

- **Domain Agnostic**: This library does not know what an `LlmMessage` is. It operates entirely on generic `ScrollItem<T>` containers and requires consuming domains to provide mapping functions (e.g., `getTimestamp`, `getActorId`).
- **Strict Identity**: All entities managed by this core (Actors, Messages, Cursors) strictly adhere to the workspace's 4-part canonical URN format (`urn:namespace:entityType:entityId`).
- **Pure Transformations**: The core utilities are predominantly static, pure functions designed to take raw data arrays and output highly-structured View Models ready for Angular's high-performance virtual scroll loops.

## Core Utilities

### 1. `TimeSeries` (Transformation Engine)

The workhorse of the virtual scroll layout. It transforms flat arrays of domain objects into structured `ScrollItem` streams.

- **Date Headers**: Automatically calculates Temporal boundaries and injects string-based `date-header` items into the array when days change.
- **Continuity**: Compares adjacent `actorId` strings to set `layout.isContinuous`, allowing the UI to collapse margins and hide redundant avatars for sequential messages from the same sender.

### 2. `TokenGrouper` (Reasoning UI Support)

Intercepts parsed markdown tokens and groups them into logical sections. This is specifically designed to isolate HTML `<think>` blocks emitted by advanced reasoning models (like DeepSeek or Gemini) from standard content, allowing the UI to render them as collapsible "Thought Process" accordions.

### 3. `ScrollspacePalette` (Deterministic UI)

An abstract interface and default implementation (`DefaultPaletteService`) for generating deterministic avatar and chat bubble styles. It hashes the unique 4-part URN of an actor to ensure they receive the exact same assigned color every time they appear in the timeline.

### 4. `MarkdownParser`

A lightweight, injectable wrapper around the `marked` library to safely generate token arrays for UI rendering.

## Testing Notes

When writing unit tests for domains consuming `scrollspace-core`, ensure that all mock IDs strictly conform to the `URN.parse()` 4-part requirement. Shorthand strings (e.g., `urn:test:1`) will throw parsing exceptions.

## Running unit tests

Run `nx test scrollspace-core` to execute the unit tests.
