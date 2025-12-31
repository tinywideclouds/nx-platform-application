import { describe, it, expect } from 'vitest';
import { EmptyGroupError, GroupNotFoundError } from './errors';

describe('Contacts Domain Errors', () => {
  describe('EmptyGroupError', () => {
    it('should be an instance of Error', () => {
      const error = new EmptyGroupError('urn:group:123');
      expect(error).toBeInstanceOf(Error);
    });

    it('should have the correct name for error switching', () => {
      const error = new EmptyGroupError('urn:group:123');
      expect(error.name).toBe('EmptyGroupError');
    });

    it('should format the message with the group URN', () => {
      const error = new EmptyGroupError('urn:group:123');
      expect(error.message).toContain('urn:group:123');
      expect(error.message).toContain('is empty');
    });
  });

  describe('GroupNotFoundError', () => {
    it('should be an instance of Error', () => {
      const error = new GroupNotFoundError('urn:group:404');
      expect(error).toBeInstanceOf(Error);
    });

    it('should have the correct name for error switching', () => {
      const error = new GroupNotFoundError('urn:group:404');
      expect(error.name).toBe('GroupNotFoundError');
    });

    it('should format the message with the group URN', () => {
      const error = new GroupNotFoundError('urn:group:404');
      expect(error.message).toContain('urn:group:404');
      expect(error.message).toContain('not found');
    });
  });
});
