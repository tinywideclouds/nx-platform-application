import { Mock } from 'vitest';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';

// --- Mocks ---
vi.mock('@bufbuild/protobuf', () => ({
  create: vi.fn((_schema, data) => ({ ...data })), // Simple pass-through
  toBinary: vi.fn(),
  fromBinary: vi.fn(),
}));

vi.mock(
  '@nx-platform-application/messenger-protos/message/v1/payload_pb.js',
  () => ({
    EncryptedMessagePayloadPbSchema: {}, // Mock schema
    EncryptedMessagePayloadPb: {}, // Mock type
  })
);

// Mock platform-types (just for URN.parse)
vi.mock('@nx-platform-application/platform-types', () => ({
  URN: {
    parse: vi.fn(), // We will define the implementation in beforeEach
  },
  ISODateTimeString: vi.fn(),
}));

// --- Facade Under Test ---
import {
  EncryptedMessagePayload,
  serializePayloadToProtoBytes,
  deserializeProtoBytesToPayload,
} from './payload';

describe('EncryptedMessagePayload Facade Mappers', () => {
  // --- Mocks ---
  let mockToBinary: Mock;
  let mockFromBinary: Mock;
  let mockUrnParse: Mock;

  // --- Fixtures ---
  const mockTimestamp = new Date().toISOString() as ISODateTimeString;
  const mockSenderUrnString = 'urn:contacts:user:sender';
  const mockTypeUrnString = 'urn:message:type:text';
  const mockBytes = new Uint8Array([1, 2, 3]);

  // --- THIS IS THE FIX ---
  // 1. Create the mock URN objects as stable fixtures
  const mockSenderUrnObj = {
    toString: () => mockSenderUrnString,
    urn: mockSenderUrnString,
  };
  const mockTypeUrnObj = {
    toString: () => mockTypeUrnString,
    urn: mockTypeUrnString,
  };
  // --- END FIX ---

  // "Smart" object fixture (now uses the stable fixtures)
  const mockSmartPayload: EncryptedMessagePayload = {
    senderId: mockSenderUrnObj as URN,
    sentTimestamp: mockTimestamp,
    typeId: mockTypeUrnObj as URN,
    payloadBytes: mockBytes,
  };

  // "Proto" object fixture
  const mockProtoPayload = {
    senderId: mockSenderUrnString,
    sentTimestamp: mockTimestamp,
    typeId: mockTypeUrnString,
    payloadBytes: mockBytes,
  };

  // "Binary" fixture
  const mockBinaryBytes = new Uint8Array([10, 20, 30]);

  beforeEach(async () => {
    const protoBuf = await import('@bufbuild/protobuf');
    mockToBinary = protoBuf.toBinary as Mock;
    mockFromBinary = protoBuf.fromBinary as Mock;

    const platformTypes = await import(
      '@nx-platform-application/platform-types'
    );
    mockUrnParse = platformTypes.URN.parse as Mock;

    vi.clearAllMocks();

    // Default mock implementations
    mockToBinary.mockReturnValue(mockBinaryBytes);
    mockFromBinary.mockReturnValue(mockProtoPayload);

    // --- THIS IS THE FIX ---
    // 2. Have the mock return the pre-built fixture objects
    mockUrnParse.mockImplementation((urnStr: string) => {
      if (urnStr === mockSenderUrnString) return mockSenderUrnObj;
      if (urnStr === mockTypeUrnString) return mockTypeUrnObj;
      return { toString: () => urnStr, urn: urnStr };
    });
    // --- END FIX ---
  });

  // --- Tests ---

  describe('serializePayloadToProtoBytes (Write)', () => {
    it('should map a smart object to binary bytes', () => {
      // Act
      const result = serializePayloadToProtoBytes(mockSmartPayload);

      // Assert
      expect(mockToBinary).toHaveBeenCalledWith(
        expect.anything(),
        mockProtoPayload
      );
      expect(result).toBe(mockBinaryBytes);
    });
  });

  describe('deserializeProtoBytesToPayload (Read)', () => {
    it('should map binary bytes back to a smart object', () => {
      // Act
      const result = deserializeProtoBytesToPayload(mockBinaryBytes);

      // Assert
      expect(mockFromBinary).toHaveBeenCalledWith(
        expect.anything(),
        mockBinaryBytes
      );
      expect(mockUrnParse).toHaveBeenCalledWith(mockSenderUrnString);
      expect(mockUrnParse).toHaveBeenCalledWith(mockTypeUrnString);

      // This will now pass because both `result` and
      // `mockSmartPayload` use the *exact same* URN objects.
      expect(result).toEqual(mockSmartPayload);
    });
  });
});
