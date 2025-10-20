import { describe, it, expect } from 'vitest';
import { create } from '@bufbuild/protobuf';
import { URN, urnToPb, urnFromPb } from './urn';

// Import the raw proto types for creating test instances
import {
  UrnPbSchema,
} from '@nx-platform-application/platform-protos/net/v1/urn_pb.js';

describe('URN Logic and Mappers', () => {
  const mockUrnString = 'urn:sm:user:user-123-abc';
  const mockUrn = URN.parse(mockUrnString);

  // --- 1. Typical Usage (Testing the URN class itself) ---
  describe('URN Class Logic', () => {
    it('should correctly parse a valid URN string', () => {
      expect(mockUrn).toBeInstanceOf(URN);
      expect(mockUrn.namespace).toBe('sm');
      expect(mockUrn.entityType).toBe('user');
      expect(mockUrn.entityId).toBe('user-123-abc');
    });

    it('should correctly create a URN instance', () => {
      const createdUrn = URN.create('device', 'device-xyz');
      expect(createdUrn).toBeInstanceOf(URN);
      expect(createdUrn.namespace).toBe('sm');
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
      expect(() => URN.parse('not-a-urn')).toThrow('Invalid URN format: expected 4 parts');
      expect(() => URN.parse('http:sm:user:id')).toThrow("Invalid URN format: invalid scheme 'http'");
    });

    it('should throw an error on empty fields (create)', () => {
      expect(() => URN.create('', 'id')).toThrow('Invalid URN format: entityType cannot be empty');
      expect(() => URN.create('user', '')).toThrow('Invalid URN format: entityId cannot be empty');
    });
  });

  // --- 2. Proto Mappers (Testing the "Buddy System" logic) ---
  describe('Proto Mappers', () => {
    /**
     * Test 1: Round Trip
     * Verifies that a TS object can be converted to a Proto object and back
     * to the original TS object without data loss.
     */
    it('should perform a round trip conversion successfully', () => {
      // 1. TS -> Proto
      const protoPb = urnToPb(mockUrn);
      // 2. Proto -> TS
      const roundTripTs = urnFromPb(protoPb);

      // 3. Verify
      expect(roundTripTs).toEqual(mockUrn);
      expect(roundTripTs.toString()).toBe(mockUrnString);
    });

    /**
     * Test 2: Typical Usage (TS to Proto)
     * Verifies the 'urnToPb' mapper works as expected.
     */
    it('should correctly map URN (TS) to UrnPb (Proto)', () => {
      const protoPb = urnToPb(mockUrn);

      expect(protoPb).toBeDefined();
      expect(protoPb.namespace).toBe(mockUrn.namespace);
      expect(protoPb.entityType).toBe(mockUrn.entityType);
      expect(protoPb.entityId).toBe(mockUrn.entityId);
    });

    /**
     * Test 3: Typical Usage (Proto to TS)
     * Verifies the 'urnFromPb' mapper works as expected.
     */
    it('should correctly map UrnPb (Proto) to URN (TS)', () => {
      // Use 'create' to simulate a real Proto object
      const mockProtoPb = create(UrnPbSchema, {
        namespace: 'sm',
        entityType: 'message',
        entityId: 'msg-456',
      });

      const tsUrn = urnFromPb(mockProtoPb);

      expect(tsUrn).toBeInstanceOf(URN);
      expect(tsUrn.namespace).toBe('sm'); // URN.create ensures this
      expect(tsUrn.entityType).toBe(mockProtoPb.entityType);
      expect(tsUrn.entityId).toBe(mockProtoPb.entityId);
    });
  });
});
