import { TestBed } from '@angular/core/testing';
import { SimpleCharWeightCalculator } from './simple-char-calculator.service';
import { describe, it, expect, beforeEach } from 'vitest';

describe('SimpleCharWeightCalculator', () => {
  let service: SimpleCharWeightCalculator;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SimpleCharWeightCalculator],
    });
    service = TestBed.inject(SimpleCharWeightCalculator);
  });

  it('should return 0 weight for empty strings', () => {
    const result = service.calculate('');
    expect(result.weight).toBe(0);
    expect(result.tokens).toBe(0);
  });

  it('should assign a minimum weight of 1 to tiny messages', () => {
    const result = service.calculate('ok');
    expect(result.weight).toBe(1);
    expect(result.tokens).toBe(1); // 2 chars / 4 = 0.5 -> rounded to 1
  });

  it('should calculate weights for larger text blocks accurately', () => {
    // Generate a string of exactly 800 characters
    // 800 chars / 4 = 200 tokens. 200 tokens / 100 = weight of 2.
    const longText = 'a'.repeat(800);

    const result = service.calculate(longText);
    expect(result.tokens).toBe(200);
    expect(result.weight).toBe(2);
    expect(result.generator).toBe('char-counter');
  });
});
