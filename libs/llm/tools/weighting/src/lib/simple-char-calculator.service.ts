import { Injectable } from '@angular/core';
import { LlmWeightCalculator, WeightMetrics } from './weighting.types';

@Injectable({ providedIn: 'root' })
export class SimpleCharWeightCalculator implements LlmWeightCalculator {
  // Configurable thresholds
  private readonly CHARS_PER_TOKEN = 4;
  private readonly TOKENS_PER_WEIGHT_UNIT = 100;

  calculate(text: string): WeightMetrics {
    if (!text) {
      return { weight: 0, unit: 'char', tokens: 0, generator: 'char-counter' };
    }

    const charCount = text.length;

    // Roughly 4 chars per token
    const estimatedTokens = Math.ceil(charCount / this.CHARS_PER_TOKEN);

    // Calculate weight chunks
    let weight = Math.ceil(estimatedTokens / this.TOKENS_PER_WEIGHT_UNIT);

    // Even a 1-word message has a baseline cognitive load/weight of 1
    if (weight < 1) {
      weight = 1;
    }

    return {
      weight,
      unit: 'char',
      tokens: estimatedTokens,
      generator: 'char-counter',
    };
  }
}
