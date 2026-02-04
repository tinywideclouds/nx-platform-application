import { describe, it, expect } from 'vitest';
import { MessagePayloadFactory } from './message-payload.factory';

describe('MessagePayloadFactory', () => {
  it('should create valid Text Payload', () => {
    const text = 'Hello World';
    const result = MessagePayloadFactory.createText(text);

    expect(result.kind).toBe('text');
    expect(result.text).toBe(text);
  });
});
