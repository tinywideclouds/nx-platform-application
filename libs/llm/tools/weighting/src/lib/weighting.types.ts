export interface WeightMetrics {
  /** The normalized "cost" of this message (e.g., 1 unit = ~100 tokens) */
  weight: number;
  /** The methodology used to calculate the tokens */
  unit: 'char' | 'token' | 'hybrid';
  /** The estimated or exact token count */
  tokens: number;
  /** Identifier for the calculator engine used */
  generator: string;
}

export abstract class LlmWeightCalculator {
  /** * Calculates the weight of a given text payload.
   * Can return a Promise to support asynchronous API-based tokenizers in the future.
   */
  abstract calculate(text: string): WeightMetrics | Promise<WeightMetrics>;
}
