import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Mock } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';

// --- Mock @bufbuild/protobuf ---
vi.mock('@bufbuild/protobuf', async () => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const actual = await vi.importActual('@bufbuild/protobuf');
  return {
    ...actual, // Retain 'create'
    fromJson: vi.fn(),
    // toJsonString is not needed for digest
  };
});
// --- End Mock ---

import { create, fromJson } from '@bufbuild/protobuf';

// --- Import Proto Types (needed for mocks) ---
import {
  EncryptedDigestItemPbSchema,
  EncryptedDigestPbSchema,
} from '@nx-platform-application/messenger-protos/envelope/v1/digest_pb.js'; // Assumed path

// --- Import functions/types under test ---
import {
  EncryptedDigest,
  EncryptedDigestItem,
  deserializeJsonToDigest,
  // Internal mappers are not exported, but we can test the public one
  // which uses them indirectly.
} from './digest';

// --- Mock Data ---
const mockUrn1 = URN.parse('urn:sm:user:alice');
const mockUrn2 = URN.parse('urn:sm:group:work');
const mockSnippet1 = new Uint8Array([1, 1]);
const mockSnippet2 = new Uint8Array([2, 2]);

// Smart Models
const mockDigestItem1: EncryptedDigestItem = { conversationUrn: mockUrn1, encryptedSnippet: mockSnippet1 };
const mockDigestItem2: EncryptedDigestItem = { conversationUrn: mockUrn2, encryptedSnippet: mockSnippet2 };
const mockSmartDigest: EncryptedDigest = { items: [mockDigestItem1, mockDigestItem2] };

// Proto Models (as created by 'create')
const mockProtoItem1 = create(EncryptedDigestItemPbSchema, { conversationUrn: mockUrn1.toString(), encryptedSnippet: mockSnippet1 });
const mockProtoItem2 = create(EncryptedDigestItemPbSchema, { conversationUrn: mockUrn2.toString(), encryptedSnippet: mockSnippet2 });
const mockProtoDigest = create(EncryptedDigestPbSchema, { items: [mockProtoItem1, mockProtoItem2] });

// Raw JSON Response (as from HttpClient)
const mockRawJson = {
  items: [
    { conversationUrn: mockUrn1.toString(), encryptedSnippet: 'AQE=' }, // Protobuf JSON uses Base64 for bytes
    { conversationUrn: mockUrn2.toString(), encryptedSnippet: 'AgI=' },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('digest serializers (Public API)', () => {

  it('deserializeJsonToDigest: should deserialize JSON object to smart Digest', () => {
    // Arrange: Mock 'fromJson' to return the proto digest object
    (fromJson as Mock).mockReturnValue(mockProtoDigest);

    // Act: Call the function under test
    const result = deserializeJsonToDigest(mockRawJson);

    // Assert:
    // 1. Verify 'fromJson' was called correctly
    expect(fromJson).toHaveBeenCalledWith(
      EncryptedDigestPbSchema,
      mockRawJson
    );

    // 2. Verify the result matches the expected smart digest structure
    expect(result).toEqual(mockSmartDigest);
    expect(result.items.length).toBe(2);
    expect(result.items[0].conversationUrn).toEqual(mockUrn1);
    expect(result.items[0].encryptedSnippet).toEqual(mockSnippet1);
    expect(result.items[1].conversationUrn).toEqual(mockUrn2);
    expect(result.items[1].encryptedSnippet).toEqual(mockSnippet2);
  });

  // We don't test the internal mappers directly, but the above test
  // implicitly covers them via deserializeJsonToDigest.
});
