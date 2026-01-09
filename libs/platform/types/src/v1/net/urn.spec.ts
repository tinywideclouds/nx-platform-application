import { describe, it, expect } from 'vitest';
import { create } from '@bufbuild/protobuf';
import { URN, urnToPb, urnFromPb } from './urn';

// Import the raw proto types for creating test instances
import { UrnPbSchema } from '@nx-platform-application/platform-protos/net/v1/urn_pb.js';

describe('URN Logic and Mappers', () => {
  const mockUrnString = 'urn:app:user:user-123-abc';
  const mockUrn = URN.parse(mockUrnString);

  // --- 1. Typical Usage (Testing the URN class itself) ---
  describe('URN Class Logic', () => {
    it('should correctly parse a valid URN string', () => {
      expect(mockUrn).toBeInstanceOf(URN);
      expect(mockUrn.namespace).toBe('app');
      expect(mockUrn.entityType).toBe('user');
      expect(mockUrn.entityId).toBe('user-123-abc');
    });

    it('should correctly create a URN instance', () => {
      const createdUrn = URN.create('device', 'device-xyz');
      expect(createdUrn).toBeInstanceOf(URN);
      expect(createdUrn.namespace).toBe('app');
      expect(createdUrn.entityType).toBe('device');
      expect(createdUrn.entityId).toBe('device-xyz');
    });

    it('should correctly convert back to a string', () => {
      expect(mockUrn.toString()).toBe(mockUrnString);
    });

    it('should correctly serialize to JSON', () => {
      expect(mockUrn.toJSON()).toBe(mockUrnString);
      expect(JSON.stringify({ id: mockUrn })).toBe(`{"id":"${mockUrnString}"}`);
    });

    it('should throw an error on invalid URN string (parse)', () => {
      expect(() => URN.parse('not-a-urn')).toThrow(
        'Invalid URN format: expected 4 parts',
      );
      expect(() => URN.parse('http:app:user:id')).toThrow(
        "Invalid URN format: invalid scheme 'http'",
      );
    });

    it('should throw an error on empty fields (create)', () => {
      expect(() => URN.create('', 'id')).toThrow(
        'Invalid URN format: entityType cannot be empty',
      );
      expect(() => URN.create('user', '')).toThrow(
        'Invalid URN format: entityId cannot be empty',
      );
    });

    // ✅ NEW: Structural Equality Tests
    describe('Equality', () => {
      it('should return true for identical URNs', () => {
        const u1 = URN.parse('urn:app:user:1');
        const u2 = URN.parse('urn:app:user:1');
        expect(u1.equals(u2)).toBe(true);
      });

      it('should return false for different IDs', () => {
        const u1 = URN.parse('urn:app:user:1');
        const u2 = URN.parse('urn:app:user:2');
        expect(u1.equals(u2)).toBe(false);
      });

      it('should return false for different Types', () => {
        const u1 = URN.parse('urn:app:user:1');
        const u2 = URN.parse('urn:app:group:1');
        expect(u1.equals(u2)).toBe(false);
      });

      it('should handle null/undefined gracefully', () => {
        const u1 = URN.parse('urn:app:user:1');
        expect(u1.equals(null)).toBe(false);
        expect(u1.equals(undefined)).toBe(false);
      });
    });
  });

  // --- 2. Proto Mappers (Testing the "Buddy System" logic) ---
  describe('Proto Mappers', () => {
    it('should perform a round trip conversion successfully', () => {
      const protoPb = urnToPb(mockUrn);
      const roundTripTs = urnFromPb(protoPb);
      expect(roundTripTs).toEqual(mockUrn);
      expect(roundTripTs.toString()).toBe(mockUrnString);
    });

    it('should correctly map URN (TS) to UrnPb (Proto)', () => {
      const protoPb = urnToPb(mockUrn);
      expect(protoPb).toBeDefined();
      expect(protoPb.namespace).toBe(mockUrn.namespace);
      expect(protoPb.entityType).toBe(mockUrn.entityType);
      expect(protoPb.entityId).toBe(mockUrn.entityId);
    });

    it('should correctly map UrnPb (Proto) to URN (TS)', () => {
      const mockProtoPb = create(UrnPbSchema, {
        namespace: 'app',
        entityType: 'message',
        entityId: 'msg-456',
      });
      const tsUrn = urnFromPb(mockProtoPb);
      expect(tsUrn).toBeInstanceOf(URN);
      expect(tsUrn.namespace).toBe('app');
      expect(tsUrn.entityType).toBe(mockProtoPb.entityType);
      expect(tsUrn.entityId).toBe(mockProtoPb.entityId);
    });
  });
});
