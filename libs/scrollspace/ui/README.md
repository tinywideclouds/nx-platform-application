# scrollspace-ui

This library provides the domain-agnostic, strictly-typed UI components and pipes required to build high-performance chat and timeline interfaces. It consumes the interfaces from `scrollspace-types` and the math/parsing logic from `scrollspace-core`, acting as the pure visual layer.

## Architecture

This library is designed for high-performance, streaming-friendly interfaces. It leverages Angular's modern reactivity (Signals, `effect`, `afterNextRender`) to minimize DOM repaints and ensure smooth scrolling even during heavy Server-Sent Events (SSE) updates.

## Core Components

### 1. The Viewport & Rows (`ScrollspaceViewportComponent`, `ScrollspaceRowComponent`)

The rendering backbone of the scrollspace.

- **Smart Auto-Scrolling**: The viewport tracks whether the user is near the bottom. If they are reading history (scrolled up), new incoming messages will not forcefully yank their scroll position, but will instead show a "scroll to bottom" FAB.
- **Temporal Clustering**: The `ScrollspaceRowComponent` reads the `layout.isContinuous` flag to seamlessly collapse margins and hide redundant avatars when a single actor sends multiple messages in a row.
- **Visibility Tracking**: Rows utilize a native `IntersectionObserver` to emit events when they enter the viewport, enabling highly efficient read-receipt and pagination triggers without binding to expensive global scroll events.
- **Pluggable Templates**: The viewport accepts generic `TemplateRef` inputs for gutters, dates, new-item markers, and the rows themselves, allowing consuming domains to project any content they need.

### 2. The Input (`ScrollspaceInputComponent`)

A highly interactive, automatically resizing text area.

- **Rich Interactions**: Supports multiline text (`Shift+Enter`), clipboard pasting of images, manual file selection, and drag-and-drop.
- **Memory Management**: Automatically manages the lifecycle of local `Blob` URLs for image previews, calling `URL.revokeObjectURL` upon transmission or component destruction to prevent browser memory leaks.

### 3. The Markdown Engine (`ScrollspaceMarkdownBubbleComponent`, `MarkdownTokensPipe`)

A streaming-optimized rich-text renderer.

- **Identity Cache Stabilization**: The `MarkdownTokensPipe` maintains an internal cache of parsed tokens. During active text streaming, it reuses the exact memory references for unchanged markdown blocks. This tricks Angular into skipping DOM reconciliation for those specific elements, completely eliminating UI jitter.
- **Self-Weighting Protocol**: The bubble component calculates its own structural weight (adding points for raw text length and heavy DOM elements like code blocks). It emits this weight upstream to assist in dynamic viewport pruning.

## Running unit tests

Run `nx test scrollspace-ui` to execute the unit tests.
