import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { URN } from '../net/urn';
import {
  SecureEnvelope,
  secureEnvelopeToProto,
  secureEnvelopeFromProto,
  serializeEnvelopeToJson,
  deserializeJsonToEnvelope,
  deserializeJsonToEnvelopes,
} from './envelope';

// --- Mocks ---

// 1. Mock Protobuf internals
vi.mock('@bufbuild/protobuf', () => ({
  create: vi.fn((_schema, data) => ({ ...data })), // Pass-through
  fromJson: vi.fn(),
  toJson: vi.fn(),
}));

// 2. Mock the generated proto schema objects
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

  // "Smart" Object (Idiomatic TS)
  const mockSmartEnvelope: SecureEnvelope = {
    recipientId: mockUrn,
    encryptedSymmetricKey: mockEncKey,
    encryptedData: mockEncData,
    signature: mockSig,
  };

  // "Proto" Object (Raw Data)
  // This mimics what 'create' or 'fromJson' would return
  const mockProtoEnvelope = {
    recipientId: mockUrnString,
    encryptedSymmetricKey: mockEncKey,
    encryptedData: mockEncData,
    signature: mockSig,
  };

  // "Proto List" Object (for the list deserializer)
  const mockProtoEnvelopeList = {
    envelopes: [mockProtoEnvelope, mockProtoEnvelope],
  };

  // JSON Representations
  const mockJsonObj = {
    recipientId: mockUrnString,
    encryptedSymmetricKey: 'AQID', // base64 mock
    /* ... other fields ... */
  };

  // --- Mock References ---
  let mockFromJson: Mock;
  let mockToJson: Mock;
  let mockCreate: Mock;

  beforeEach(async () => {
    // Re-import mocks to capture the fresh vi.mock instances
    const protoBuf = await import('@bufbuild/protobuf');
    mockFromJson = protoBuf.fromJson as Mock;
    mockToJson = protoBuf.toJson as Mock;
    mockCreate = protoBuf.create as Mock;

    vi.clearAllMocks();

    // Default Return Values
    mockFromJson.mockReturnValue(mockProtoEnvelope);
    mockToJson.mockReturnValue(mockJsonObj);
  });

  // --- Tests ---

  describe('Internal Mappers (Smart <-> Proto)', () => {
    it('secureEnvelopeToProto should flatten URN to string', () => {
      const result = secureEnvelopeToProto(mockSmartEnvelope);

      expect(mockCreate).toHaveBeenCalled();
      expect(result.recipientId).toBe(mockUrnString); // Key check: URN -> String
      expect(result.encryptedData).toEqual(mockEncData);
    });

    it('secureEnvelopeFromProto should inflate string to URN', () => {
      // We cast mockProtoEnvelope to any because the real type implies strict proto types
      const result = secureEnvelopeFromProto(mockProtoEnvelope as any);

      expect(result.recipientId).toBeInstanceOf(URN); // Key check: String -> URN
      expect(result.recipientId.toString()).toBe(mockUrnString);
      expect(result.signature).toEqual(mockSig);
    });
  });

  describe('Public API: Serialization (Write)', () => {
    it('serializeEnvelopeToJson should convert Smart -> Proto -> JSON Object', () => {
      const result = serializeEnvelopeToJson(mockSmartEnvelope);

      // 1. Verify 'create' was called (Smart -> Proto conversion)
      expect(mockCreate).toHaveBeenCalledWith(
        expect.anything(), // Schema
        expect.objectContaining({ recipientId: mockUrnString })
      );

      // 2. Verify 'toJson' was called with the result of create
      expect(mockToJson).toHaveBeenCalledWith(
        expect.anything(), // Schema
        expect.objectContaining({ recipientId: mockUrnString }) // The proto object
      );

      // 3. Verify return value
      expect(result).toEqual(mockJsonObj);
    });
  });

  describe('Public API: Deserialization (Read)', () => {
    it('deserializeJsonToEnvelope should convert JSON -> Proto -> Smart', () => {
      // Override mock for this specific test if needed, but default is fine
      const result = deserializeJsonToEnvelope(mockJsonObj);

      // 1. Verify 'fromJson' was called
      expect(mockFromJson).toHaveBeenCalledWith(
        expect.anything(), // Schema
        mockJsonObj
      );

      // 2. Verify result is mapped to Smart object
      expect(result).toEqual(mockSmartEnvelope);
      expect(result.recipientId).toBeInstanceOf(URN);
    });

    it('deserializeJsonToEnvelopes should handle a list of messages', () => {
      // Setup mock to return a list wrapper
      mockFromJson.mockReturnValue(mockProtoEnvelopeList);

      const result = deserializeJsonToEnvelopes([mockJsonObj, mockJsonObj]);

      // 1. Verify 'fromJson' called (likely with the List Schema)
      expect(mockFromJson).toHaveBeenCalled();

      // 2. Verify we got an array of Smart objects back
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(mockSmartEnvelope);
      expect(result[0].recipientId).toBeInstanceOf(URN);
    });
  });
});
