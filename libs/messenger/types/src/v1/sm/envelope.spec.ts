import { Mock } from 'vitest';

// --- Mock @bufbuild/protobuf ---
vi.mock('@bufbuild/protobuf', async () => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const actual = await vi.importActual('@bufbuild/protobuf');
  return {
    ...actual, // Import and retain default behavior (like 'create')
    toJsonString: vi.fn(),
    fromJson: vi.fn(),
  };
});
// --- End Mock ---

import { create, toJsonString, fromJson } from '@bufbuild/protobuf';
import {
  SecureEnvelope,
  secureEnvelopeToProto,
  secureEnvelopeFromProto,
  serializeEnvelopeToJson,       // <-- Import new public API
  deserializeJsonToEnvelopes, deserializeJsonToEnvelope,    // <-- Import new public API
} from './envelope';
// base64ToBytes is no longer imported

import { URN } from '@nx-platform-application/platform-types';

// Import the raw proto types
import {
  SecureEnvelopePbSchema,
  SecureEnvelopeListPbSchema,
} from '@nx-platform-application/messenger-protos/envelope/v1/secure-envelope_pb.js'; // Assumed path

// --- Mocks ---
const mockEnvelope: SecureEnvelope = {
  senderId: URN.parse('urn:sm:user:sender-alice'),
  recipientId: URN.parse('urn:sm:user:receiver-bob'),
  messageId: 'msg-123-abc',
  encryptedData: new Uint8Array([1, 2, 3]),
  encryptedSymmetricKey: new Uint8Array([4, 5, 6]),
  signature: new Uint8Array([7, 8, 9]),
};

// A mock Proto object, as created by 'create'
const mockProtoPb = create(SecureEnvelopePbSchema, {
  senderId: 'urn:sm:user:sender-alice',
  recipientId: 'urn:sm:user:receiver-bob',
  messageId: 'msg-123-abc',
  encryptedData: new Uint8Array([1, 2, 3]),
  encryptedSymmetricKey: new Uint8Array([4, 5, 6]),
  signature: new Uint8Array([7, 8, 9]),
});

beforeEach(() => {
  // Reset mock function calls before each test
  vi.clearAllMocks();
});

describe('envelope mappers (Internal)', () => {
  /**
   * Test 1: Round Trip (Internal Mappers)
   */
  it('should perform a round trip conversion successfully', () => {
    // 1. TS -> Proto
    const protoPb = secureEnvelopeToProto(mockEnvelope);
    // 2. Proto -> TS
    const roundTripTs = secureEnvelopeFromProto(protoPb);

    // 3. Verify
    expect(roundTripTs).toEqual(mockEnvelope);
  });

  /**
   * Test 2: TS to Proto (Internal Mapper)
   */
  it('should correctly map SecureEnvelope (TS) to SecureEnvelopePb (Proto)', () => {
    const protoPb = secureEnvelopeToProto(mockEnvelope);
    expect(protoPb.senderId).toBe(mockEnvelope.senderId.toString());
    expect(protoPb.encryptedData).toEqual(mockEnvelope.encryptedData);
  });

  /**
   * Test 3: Proto to TS (Internal Mapper)
   */
  it('should correctly map SecureEnvelopePb (Proto) to SecureEnvelope (TS)', () => {
    const tsEnvelope = secureEnvelopeFromProto(mockProtoPb);
    expect(tsEnvelope.senderId).toEqual(URN.parse(mockProtoPb.senderId));
    expect(tsEnvelope.encryptedData).toEqual(mockProtoPb.encryptedData);
  });
});

describe('envelope serializers (Public API)', () => {
  /**
   * Test 4: Smart Object -> JSON String
   */
  it('should serialize a smart envelope to a JSON string', () => {
    const mockJsonString = '{"senderId":"urn:sm:user:sender-alice"}';
    (toJsonString as Mock).mockReturnValue(mockJsonString);

    const result = serializeEnvelopeToJson(mockEnvelope);

    // 1. Verify it called toJsonString with the correct schema
    expect(toJsonString).toHaveBeenCalledWith(
      SecureEnvelopePbSchema,
      expect.objectContaining({
        senderId: mockEnvelope.senderId.toString(),
      })
    );

    // 2. Verify it returned the string
    expect(result).toBe(mockJsonString);
  });

  /**
   * Test 5: JSON Object -> Smart Object Array
   */
  it('should deserialize a JSON object into an array of smart envelopes', () => {
    // This is the raw JSON object HttpClient would provide
    const mockRawJson = {
      envelopes: [
        { senderId: 'urn:sm:user:sender-alice' /* ...other fields */ },
      ],
    };
    // (The incorrect jsonString and stringify import are removed)

    // This is the mock Proto List object 'fromJson' will return
    const mockProtoList = create(SecureEnvelopeListPbSchema, {
      envelopes: [mockProtoPb],
    });

    (fromJson as Mock).mockReturnValue(mockProtoList);

    // (FIX: Pass the raw mockRawJson object, not a string)
    const result = deserializeJsonToEnvelopes(mockRawJson);

    // 1. Verify it called fromJson with the correct schema and data
    expect(fromJson).toHaveBeenCalledWith(
      SecureEnvelopeListPbSchema,
      mockRawJson
    );

    // 2. Verify it returned the correctly mapped smart object
    expect(result).toEqual([mockEnvelope]);
  });

  /**
   * Test 6: JSON Object -> Smart Object (Single)
   */
  it('should deserialize a single JSON object into a smart envelope', () => {
    // This is the raw JSON object from a WebSocket
    const mockRawJson = {
      senderId: 'urn:sm:user:sender-alice',
      recipientId: 'urn:sm:user:receiver-bob',
      messageId: 'msg-123-abc',
      encryptedData: 'AQID', // "AQID" is Base64 for [1, 2, 3]
      encryptedSymmetricKey: 'BAUG', // "BAUG" is Base64 for [4, 5, 6]
      signature: 'BwgJ', // "BwgJ" is Base64 for [7, 8, 9]
    };

    // Arrange: Mock 'fromJson' to return the singular proto object
    // (mockProtoPb is already defined in your spec file)
    (fromJson as Mock).mockReturnValue(mockProtoPb);

    // Act: Call the new function
    const result = deserializeJsonToEnvelope(mockRawJson);

    // Assert:
    // 1. Verify 'fromJson' was called correctly
    expect(fromJson).toHaveBeenCalledWith(
      SecureEnvelopePbSchema, // <-- Singular schema
      mockRawJson
    );

    // 2. Verify the result matches the expected smart envelope
    // (mockEnvelope is already defined in your spec file)
    expect(result).toEqual(mockEnvelope);
  });
});
