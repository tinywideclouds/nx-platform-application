import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { URN } from '../net/urn';
import {
  SecureEnvelope,
  secureEnvelopeToProto,
  secureEnvelopeFromProto,
  serializeEnvelopeToJson,
} from './envelope';

// --- Mocks (Same as provided) ---
vi.mock('@bufbuild/protobuf', () => ({
  create: vi.fn((_schema, data) => ({ ...data })),
  fromJson: vi.fn(),
  toJson: vi.fn(),
}));

vi.mock(
  '@nx-platform-application/platform-protos/secure/v1/envelope_pb',
  () => ({
    SecureEnvelopePbSchema: {},
    SecureEnvelopePb: {},
    SecureEnvelopeListPbSchema: {},
  })
);

describe('SecureEnvelope Mappers', () => {
  // --- Fixtures ---
  const mockUrnString = 'urn:contacts:user:recipient-123';
  const mockUrn = URN.parse(mockUrnString);
  const mockEncKey = new Uint8Array([1, 2, 3]);
  const mockEncData = new Uint8Array([4, 5, 6]);
  const mockSig = new Uint8Array([7, 8, 9]);

  // "Smart" Object
  const mockSmartEnvelope: SecureEnvelope = {
    recipientId: mockUrn,
    encryptedSymmetricKey: mockEncKey,
    encryptedData: mockEncData,
    signature: mockSig,
    isEphemeral: true, // TEST CASE
  };

  // "Proto" Object (Raw Data)
  const mockProtoEnvelope = {
    recipientId: mockUrnString,
    encryptedSymmetricKey: mockEncKey,
    encryptedData: mockEncData,
    signature: mockSig,
    isEphemeral: true, // TEST CASE
  };

  // JSON Representations
  const mockJsonObj = {
    recipientId: mockUrnString,
    encryptedSymmetricKey: 'AQID',
    isEphemeral: true, // TEST CASE
  };

  let mockToJson: Mock;
  let mockCreate: Mock;

  beforeEach(async () => {
    const protoBuf = await import('@bufbuild/protobuf');
    mockToJson = protoBuf.toJson as Mock;
    mockCreate = protoBuf.create as Mock;
    vi.clearAllMocks();
    mockToJson.mockReturnValue(mockJsonObj);
  });

  describe('Internal Mappers (Smart <-> Proto)', () => {
    it('secureEnvelopeToProto should map isEphemeral flag', () => {
      const result = secureEnvelopeToProto(mockSmartEnvelope);

      expect(mockCreate).toHaveBeenCalled();
      expect(result.recipientId).toBe(mockUrnString);
      expect(result.isEphemeral).toBe(true); // Verified
    });

    it('secureEnvelopeFromProto should map isEphemeral flag', () => {
      const result = secureEnvelopeFromProto(mockProtoEnvelope as any);

      expect(result.recipientId).toBeInstanceOf(URN);
      expect(result.isEphemeral).toBe(true); // Verified
    });
  });

  describe('Public API: Serialization (Write)', () => {
    it('serializeEnvelopeToJson should include isEphemeral', () => {
      const result = serializeEnvelopeToJson(mockSmartEnvelope);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          recipientId: mockUrnString,
          isEphemeral: true,
        })
      );

      expect(result).toEqual(mockJsonObj);
    });
  });
});
