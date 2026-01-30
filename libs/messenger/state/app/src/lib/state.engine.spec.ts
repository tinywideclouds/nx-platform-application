// libs/messenger/state/app/src/lib/state.engine.spec.ts

import { describe, it, expect } from 'vitest';
import { StateEngine, StateEngineInputs } from './state.engine';
import { URN } from '@nx-platform-application/platform-types';

describe('StateEngine', () => {
  // Helper to create a baseline input object
  const baseInputs: StateEngineInputs = {
    urn: null,
    isLoading: false,
    messages: [],
    isBlocked: false,
    isQuarantined: false,
  };

  describe('Loading & Errors', () => {
    it('should return LOADING if URN is null', () => {
      const result = StateEngine.resolvePageState(baseInputs);
      expect(result).toBe('LOADING');
    });

    it('should return LOADING if isLoading is true', () => {
      const inputs = {
        ...baseInputs,
        urn: URN.parse('urn:messenger:user:1'),
        isLoading: true,
      };
      expect(StateEngine.resolvePageState(inputs)).toBe('LOADING');
    });

    it('should return BLOCKED if isBlocked is true (overrides URN type)', () => {
      const inputs = {
        ...baseInputs,
        urn: URN.parse('urn:messenger:user:1'),
        isBlocked: true,
      };
      expect(StateEngine.resolvePageState(inputs)).toBe('BLOCKED');
    });

    it('should return QUARANTINE_REQUEST if isQuarantined is true', () => {
      const inputs = {
        ...baseInputs,
        urn: URN.parse('urn:messenger:user:unknown'),
        isQuarantined: true,
      };
      expect(StateEngine.resolvePageState(inputs)).toBe('QUARANTINE_REQUEST');
    });
  });

  describe('Active History', () => {
    it('should return ACTIVE_CHAT if messages exist, regardless of URN type', () => {
      // Even a "passive" contact group becomes active once it has messages
      const inputs = {
        ...baseInputs,
        urn: URN.parse('urn:contacts:group:local-1'),
        messages: [{ id: 'msg1' } as any],
      };
      expect(StateEngine.resolvePageState(inputs)).toBe('ACTIVE_CHAT');
    });
  });

  describe('Empty States (URN Driven)', () => {
    it('should return EMPTY_NETWORK_GROUP for a Messenger Group with no messages', () => {
      const inputs = {
        ...baseInputs,
        urn: URN.parse('urn:messenger:group:net-1'),
        messages: [],
      };
      expect(StateEngine.resolvePageState(inputs)).toBe('EMPTY_NETWORK_GROUP');
    });

    it('should return PASSIVE_CONTACT_GROUP for a Contacts Group with no messages', () => {
      const inputs = {
        ...baseInputs,
        urn: URN.parse('urn:contacts:group:local-1'),
        messages: [],
      };
      expect(StateEngine.resolvePageState(inputs)).toBe(
        'PASSIVE_CONTACT_GROUP',
      );
    });

    it('should return PASSIVE_CONTACT_USER for a User URN (Contacts) with no messages', () => {
      const inputs = {
        ...baseInputs,
        urn: URN.parse('urn:contacts:user:alice'),
        messages: [],
      };
      expect(StateEngine.resolvePageState(inputs)).toBe('PASSIVE_CONTACT_USER');
    });

    it('should return PASSIVE_CONTACT_USER for a User URN (Messenger) with no messages', () => {
      const inputs = {
        ...baseInputs,
        urn: URN.parse('urn:messenger:user:bob'),
        messages: [],
      };
      expect(StateEngine.resolvePageState(inputs)).toBe('PASSIVE_CONTACT_USER');
    });
  });

  describe('Edge Cases', () => {
    it('should return NOT_FOUND for unknown entity types', () => {
      const inputs = {
        ...baseInputs,
        urn: URN.parse('urn:messenger:unknown:123'),
        messages: [],
      };
      expect(StateEngine.resolvePageState(inputs)).toBe('NOT_FOUND');
    });
  });
});
