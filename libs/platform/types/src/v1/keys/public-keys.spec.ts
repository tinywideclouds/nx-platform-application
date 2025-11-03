import { Mock } from 'vitest';
import {
  PublicKeys,
  deserializeJsonToPublicKeys,
  serializePublicKeysToJson,
} from './public-keys';

// --- Protobuf Mocking ---
vi.mock('@bufbuild/protobuf', () => ({
  create: vi.fn((_schema, data) => ({ ...data })), // Simple pass-through
  fromJson: vi.fn(),
}));

// Mock the generated proto schema
vi.mock('@nx-platform-application/platform-protos/key/v1/key_pb', () => ({
  PublicKeysPbSchema: {}, // Mock schema object
  PublicKeysPb: {}, // Mock type (not strictly needed by functions)
}));

// --- Base64 Mocking ---
vi.stubGlobal('btoa', vi.fn());
vi.stubGlobal('atob', vi.fn());

describe('PublicKeys Mappers', () => {
  // --- Fixtures ---
  const mockEncKeyBytes = new Uint8Array([1, 2, 3]);
  const mockSigKeyBytes = new Uint8Array([4, 5, 6]);

  const mockEncKeyB64 = 'AQID'; // btoa([1, 2, 3])
  const mockSigKeyB64 = 'BAUG'; // btoa([4, 5, 6])

  // "Smart" object fixture
  const mockSmartKeys: PublicKeys = {
    encKey: mockEncKeyBytes,
    sigKey: mockSigKeyBytes,
  };

  // "Proto" object fixture (as returned by fromJson)
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
  let mockBtoa: Mock;

  beforeEach(async () => {
    // We must re-import mocks inside beforeEach when using vi.mock
    const protoBuf = await import('@bufbuild/protobuf');
    mockFromJson = protoBuf.fromJson as Mock;
    mockBtoa = btoa as Mock;

    vi.clearAllMocks();

    // Default mock implementations
    mockFromJson.mockReturnValue(mockProtoKeys);

    // Fix: Added explicit `string` type to `str`
    mockBtoa.mockImplementation((str: string) => {
      if (String.fromCharCode.apply(null, Array.from(mockEncKeyBytes)) === str)
        return mockEncKeyB64;
      if (String.fromCharCode.apply(null, Array.from(mockSigKeyBytes)) === str)
        return mockSigKeyB64;
      return '';
    });
  });

  // --- Tests ---

  describe('deserializeJsonToPublicKeys (Read)', () => {
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
    it('should serialize a smart PublicKeys object into a JSON-safe object', () => {
      // Act
      const result = serializePublicKeysToJson(mockSmartKeys);

      // Assert
      // 1. Check that btoa was called for each key
      expect(mockBtoa).toHaveBeenCalledTimes(2);

      // 2. Check that the final object has the correct B64 strings
      expect(result).toEqual(mockJsonForNetwork);
    });
  });
});
