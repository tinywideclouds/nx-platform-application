//
import { Mock } from 'vitest';
import {
  PublicKeys,
  deserializeJsonToPublicKeys,
  serializePublicKeysToJson,
  publicKeysToProto, // Import this to test the internal call
} from './public-keys';

// --- Protobuf Mocking ---
vi.mock('@bufbuild/protobuf', () => ({
  create: vi.fn((_schema, data) => ({ ...data })), // Simple pass-through
  fromJson: vi.fn(),
  toJson: vi.fn(), // 1. Add 'toJson' to the mock
}));

// Mock the generated proto schema
vi.mock('@nx-platform-application/platform-protos/key/v1/key_pb', () => ({
  PublicKeysPbSchema: {}, // Mock schema object
  PublicKeysPb: {}, // Mock type (not strictly needed by functions)
}));

// 2. --- REMOVE THIS ---
// --- Base64 Mocking ---
// vi.stubGlobal('btoa', vi.fn());
// vi.stubGlobal('atob', vi.fn());
// ---

describe('PublicKeys Mappers', () => {
  // --- Fixtures (remain unchanged) ---
  const mockEncKeyBytes = new Uint8Array([1, 2, 3]);
  const mockSigKeyBytes = new Uint8Array([4, 5, 6]);

  const mockEncKeyB64 = 'AQID'; // btoa([1, 2, 3])
  const mockSigKeyB64 = 'BAUG'; // btoa([4, 5, 6])

  // "Smart" object fixture
  const mockSmartKeys: PublicKeys = {
    encKey: mockEncKeyBytes,
    sigKey: mockSigKeyBytes,
  };

  // "Proto" object fixture (as returned by fromJson and create)
  const mockProtoKeys = {
    encKey: mockEncKeyBytes,
    sigKey: mockSigKeyBytes,
  };

  // "JSON" fixture (from network response)
  const mockJsonFromNetwork: unknown = {
    encKey: mockEncKeyB64,
    sigKey: mockSigKeyB64,
  };

  // "JSON" fixture (for network request)
  const mockJsonForNetwork: Record<string, string> = {
    encKey: mockEncKeyB64,
    sigKey: mockSigKeyB64,
  };

  // --- Mocks ---
  let mockFromJson: Mock;
  let mockToJson: Mock; // 3. Add 'mockToJson'
  let mockCreate: Mock; // Get the create mock to verify the internal call

  beforeEach(async () => {
    // We must re-import mocks inside beforeEach when using vi.mock
    const protoBuf = await import('@bufbuild/protobuf');
    mockFromJson = protoBuf.fromJson as Mock;
    mockToJson = protoBuf.toJson as Mock; // 4. Get the 'toJson' mock
    mockCreate = protoBuf.create as Mock; // 5. Get the 'create' mock

    vi.clearAllMocks();

    // Default mock implementations
    mockFromJson.mockReturnValue(mockProtoKeys);
    mockToJson.mockReturnValue(mockJsonForNetwork); // 6. Mock 'toJson' return

    // 7. --- REMOVE BTOA MOCK ---
  });

  // --- Tests ---

  describe('deserializeJsonToPublicKeys (Read)', () => {
    // ... (this test remains unchanged)
    it('should parse JSON from the network into a smart PublicKeys object', () => {
      // Act
      const result = deserializeJsonToPublicKeys(mockJsonFromNetwork);

      // Assert
      // 1. Check that the raw JSON was passed to the protobuf parser
      expect(mockFromJson).toHaveBeenCalledWith(
        {}, // PublicKeysPbSchema
        mockJsonFromNetwork
      );

      // 2. Check that the parser's output was mapped to the smart interface
      expect(result).toEqual(mockSmartKeys);
    });
  });

  describe('serializePublicKeysToJson (Write)', () => {
    // 8. --- UPDATE THIS TEST ---
    it('should serialize a smart PublicKeys object into a JSON-safe object', () => {
      // Act
      const result = serializePublicKeysToJson(mockSmartKeys);

      // Assert
      // 1. Check that the smart object was first converted to a proto object
      // (This test relies on the simple pass-through mock for 'create')
      expect(mockCreate).toHaveBeenCalledWith(
        {}, // PublicKeysPbSchema
        mockSmartKeys
      );

      // 2. Check that 'toJson' was called with the resulting proto object
      expect(mockToJson).toHaveBeenCalledWith(
        {}, // PublicKeysPbSchema
        mockProtoKeys // The result from 'create'
      );

      // 3. Check that the final object has the correct B64 strings
      expect(result).toEqual(mockJsonForNetwork);
    });
  });
});
