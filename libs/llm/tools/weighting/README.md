# LLM Tools: Weighting (`@nx-platform-application/llm-tools-weighting`)

A lightweight, isolated utility library for calculating the cognitive load ("weight") and token cost of LLM messages.

## Purpose

Modern LLM chat applications cannot rely on naive "last N messages" truncation, as long copy-pasted logs can easily blow out token limits. This library provides a standardized metric for message size, allowing the chat architecture to trigger background compression/summarization based on actual context weight rather than arbitrary message counts.

## Core Concepts

The library operates on a strict contract defined by `LlmWeightCalculator`. Every calculation returns a `WeightMetrics` object:

```typescript
export interface WeightMetrics {
  weight: number; // Normalized cost (e.g., 1 unit = ~100 tokens)
  unit: string; // 'char' | 'token' | 'hybrid'
  tokens: number; // Estimated or exact token count
  generator: string; // Identifier for the engine used (e.g., 'char-counter')
}
```

## Implementations

### 1. `SimpleCharWeightCalculator` (Default)

A fast, synchronous heuristic calculator.

- Assumes ~4 characters per token (standard English baseline).
- Defines 1 "Weight Unit" as 100 tokens (~400 characters).
- Useful for immediate UI feedback without blocking network calls.

### 2. API Tokenizers (Future)

The abstract base class supports asynchronous returns (`Promise<WeightMetrics>`). Future implementations (e.g., `GeminiTokenCalculator`) can be injected via Angular's DI system to call actual backend `countTokens` endpoints without changing the consuming application code.

## Usage

Provide the desired implementation in your feature module or component:

```typescript
import { LlmWeightCalculator, SimpleCharWeightCalculator } from '@nx-platform-application/llm-tools-weighting';

@NgModule({
  providers: [
    { provide: LlmWeightCalculator, useClass: SimpleCharWeightCalculator }
  ]
})

```
