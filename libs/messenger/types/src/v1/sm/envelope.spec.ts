import { describe, it, expect } from 'vitest';
import { create } from '@bufbuild/protobuf';
import {
  SecureEnvelope,
  secureEnvelopeToProto,
  secureEnvelopeFromProto,
  base64ToBytes,
} from './envelope';
import { URN } from '@nx-platform-application/platform-types';

// Import the raw proto types for creating test instances
import {
  SecureEnvelopePb,
  SecureEnvelopePbSchema,
} from '@nx-platform-application/messenger-protos/envelope/v1/secure-envelope_pb.js';

describe('envelope mappers', () => {
  // Mock data for a TS SecureEnvelope
  const mockEnvelope: SecureEnvelope = {
    senderId: URN.parse('urn:sm:user:sender-alice'),
    recipientId: URN.parse('urn:sm:user:receiver-bob'),
    messageId: 'msg-123-abc',
    encryptedData: new Uint8Array([1, 2, 3]),
    encryptedSymmetricKey: new Uint8Array([4, 5, 6]),
    signature: new Uint8Array([7, 8, 9]),
  };

  /**
   * Test 1: Round Trip
   * Verifies that a TS object can be converted to a Proto object and back.
   *
   * NOTE: This test will FAIL if 'secureEnvelopeFromProto' incorrectly
   * attempts to parse Base64 strings (as seen in envelope.ts) instead of
   * handling the 'Uint8Array' fields provided by 'secureEnvelopeToProto'.
   * This test assumes the mappers *should* be symmetrical.
   */
  it('should perform a round trip conversion successfully for SecureEnvelope', () => {
    // 1. TS -> Proto
    const protoPb = secureEnvelopeToProto(mockEnvelope);
    // 2. Proto -> TS
    const roundTripTs = secureEnvelopeFromProto(protoPb);

    // 3. Verify
    expect(roundTripTs).toEqual(mockEnvelope);
  });

  /**
   * Test 2: Typical Usage (TS to Proto)
   * Verifies the 'secureEnvelopeToProto' mapper works as expected.
   */
  it('should correctly map SecureEnvelope (TS) to SecureEnvelopePb (Proto)', () => {
    const protoPb = secureEnvelopeToProto(mockEnvelope);

    expect(protoPb).toBeDefined();
    expect(protoPb.senderId).toBe(mockEnvelope.senderId.toString());
    expect(protoPb.recipientId).toBe(mockEnvelope.recipientId.toString());
    expect(protoPb.messageId).toBe(mockEnvelope.messageId);
    expect(protoPb.encryptedData).toEqual(mockEnvelope.encryptedData);
    expect(protoPb.encryptedSymmetricKey).toEqual(
      mockEnvelope.encryptedSymmetricKey
    );
    expect(protoPb.signature).toEqual(mockEnvelope.signature);
  });

  /**
   * Test 3: Typical Usage (Proto to TS)
   * Verifies the 'secureEnvelopeFromProto' mapper works as expected.
   * This test creates a mock Proto object with the 'Uint8Array' fields
   * that 'secureEnvelopeToProto' would create.
   */
  it('should correctly map SecureEnvelopePb (Proto) to SecureEnvelope (TS)', () => {
    const mockProtoPb = create(SecureEnvelopePbSchema, {
      senderId: 'urn:sm:user:sender-alice',
      recipientId: 'urn:sm:user:receiver-bob',
      messageId: 'msg-123-abc',
      encryptedData: new Uint8Array([1, 2, 3]),
      encryptedSymmetricKey: new Uint8Array([4, 5, 6]),
      signature: new Uint8Array([7, 8, 9]),
    });

    const tsEnvelope = secureEnvelopeFromProto(mockProtoPb);

    expect(tsEnvelope).toBeDefined();
    expect(tsEnvelope.senderId).toEqual(URN.parse(mockProtoPb.senderId));
    expect(tsEnvelope.recipientId).toEqual(
      URN.parse(mockProtoPb.recipientId)
    );
    expect(tsEnvelope.messageId).toBe(mockProtoPb.messageId);

    // These assertions will FAIL unless 'secureEnvelopeFromProto' is
    // fixed to handle Uint8Array directly, like the 'signature' field does.
    expect(tsEnvelope.encryptedData).toEqual(mockProtoPb.encryptedData);
    expect(tsEnvelope.encryptedSymmetricKey).toEqual(
      mockProtoPb.encryptedSymmetricKey
    );
    expect(tsEnvelope.signature).toEqual(mockProtoPb.signature);
  });

  /**
   * Test 4: Utility Function (base64ToBytes)
   * Tests the helper function exported from envelope.ts.
   */
  describe('base64ToBytes', () => {
    it('should correctly decode a Base64 string to Uint8Array', () => {
      // "Hello" = SGVsbG8=
      const base64Str = 'SGVsbG8=';
      const expectedBytes = new Uint8Array([72, 101, 108, 108, 111]); // 'H', 'e', 'l', 'l', 'o'
      const result = base64ToBytes(base64Str);
      expect(result).toEqual(expectedBytes);
    });
  });
});
