// libs/messenger/messenger-types/src/lib/payload.spec.ts

import { Mock } from 'vitest';
import { ISODateTimeString } from '@nx-platform-application/platform-types';

// --- Mocks ---
vi.mock('@bufbuild/protobuf', () => ({
  create: vi.fn((_schema, data) => ({ ...data })),
  toBinary: vi.fn(),
  fromBinary: vi.fn(),
}));

vi.mock(
  '@nx-platform-application/messenger-protos/message/v1/payload_pb.js',
  () => ({
    EncryptedMessagePayloadPbSchema: {},
    EncryptedMessagePayloadPb: {},
  }),
);

vi.mock('@nx-platform-application/platform-types', () => ({
  URN: {
    parse: vi.fn(),
  },
  ISODateTimeString: vi.fn(),
}));

import {
  EncryptedMessagePayload,
  serializePayloadToProtoBytes,
  deserializeProtoBytesToPayload,
} from './payload';

describe('EncryptedMessagePayload Facade Mappers', () => {
  let mockToBinary: Mock;
  let mockFromBinary: Mock;
  let mockUrnParse: Mock;

  const mockTimestamp = new Date().toISOString() as ISODateTimeString;
  const mockSenderUrnString = 'urn:contacts:user:sender';
  const mockTypeUrnString = 'urn:message:type:text';
  const mockBytes = new Uint8Array([1, 2, 3]);
  const mockClientId = 'local-uuid-1234'; // ✅ NEW

  // Stable URN Mocks
  const mockSenderUrnObj = {
    toString: () => mockSenderUrnString,
    urn: mockSenderUrnString,
  };
  const mockTypeUrnObj = {
    toString: () => mockTypeUrnString,
    urn: mockTypeUrnString,
  };

  // Fixtures
  const mockSmartPayload: EncryptedMessagePayload = {
    senderId: mockSenderUrnObj as any,
    sentTimestamp: mockTimestamp,
    typeId: mockTypeUrnObj as any,
    payloadBytes: mockBytes,
    clientRecordId: mockClientId, // ✅ NEW
  };

  const mockProtoPayload = {
    senderId: mockSenderUrnString,
    sentTimestamp: mockTimestamp,
    typeId: mockTypeUrnString,
    payloadBytes: mockBytes,
    clientRecordId: mockClientId, // ✅ NEW
  };

  const mockBinaryBytes = new Uint8Array([10, 20, 30]);

  beforeEach(async () => {
    const protoBuf = await import('@bufbuild/protobuf');
    mockToBinary = protoBuf.toBinary as Mock;
    mockFromBinary = protoBuf.fromBinary as Mock;

    const platformTypes =
      await import('@nx-platform-application/platform-types');
    mockUrnParse = platformTypes.URN.parse as Mock;

    vi.clearAllMocks();

    mockToBinary.mockReturnValue(mockBinaryBytes);
    mockFromBinary.mockReturnValue(mockProtoPayload);

    mockUrnParse.mockImplementation((urnStr: string) => {
      if (urnStr === mockSenderUrnString) return mockSenderUrnObj;
      if (urnStr === mockTypeUrnString) return mockTypeUrnObj;
      return { toString: () => urnStr, urn: urnStr };
    });
  });

  describe('serializePayloadToProtoBytes', () => {
    it('should map smart object (with clientRecordId) to binary', () => {
      const result = serializePayloadToProtoBytes(mockSmartPayload);
      expect(mockToBinary).toHaveBeenCalledWith(
        expect.anything(),
        mockProtoPayload,
      );
      expect(result).toBe(mockBinaryBytes);
    });
  });

  describe('deserializeProtoBytesToPayload', () => {
    it('should map binary bytes back to smart object (with clientRecordId)', () => {
      const result = deserializeProtoBytesToPayload(mockBinaryBytes);
      expect(mockFromBinary).toHaveBeenCalledWith(
        expect.anything(),
        mockBinaryBytes,
      );
      expect(result.clientRecordId).toBe(mockClientId);
      expect(result).toEqual(mockSmartPayload);
    });
  });
});
