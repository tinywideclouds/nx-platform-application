import { Mock } from 'vitest';
import { URN } from '../net/urn';
import { SecureEnvelope } from '../secure/envelope';
import {
  QueuedMessage,
  deserializeJsonToQueuedMessages,
  queuedMessageFromProto,
} from './queue';
import { SecureEnvelopePb } from '@nx-platform-application/platform-protos/secure/v1/envelope_pb';
import { QueuedMessagePb } from '@nx-platform-application/platform-protos/routing/v1/queue_pb';

// --- Protobuf Mocking ---
vi.mock('@bufbuild/protobuf', () => ({
  fromJson: vi.fn(),
}));

// Mock the generated proto schema
vi.mock('@nx-platform-application/platform-protos/routing/v1/queue_pb', () => ({
  QueuedMessageListPbSchema: {}, // Mock schema
  QueuedMessageListPb: {}, // Mock type
  QueuedMessagePb: {}, // Mock type
}));

// Mock our *other* facade (which this one depends on)
//
// --- THIS IS THE FIX ---
// The path must exactly match the import statement
vi.mock('../secure/envelope', () => ({
  secureEnvelopeFromProto: vi.fn(),
}));
// --- END FIX ---

describe('Queue Facade Mappers', () => {
  // --- Mocks ---
  let mockFromJson: Mock;
  let mockSecureEnvelopeFromProto: Mock;

  // --- Fixtures ---
  const mockEnvelopePb: SecureEnvelopePb = {
    $typeName: 'src.types.secure.v1.SecureEnvelopePb',
    recipientId: 'urn:contacts:user:test',
    encryptedData: new Uint8Array([1]),
    encryptedSymmetricKey: new Uint8Array([2]),
    signature: new Uint8Array([3]),
  };

  const mockSmartEnvelope: SecureEnvelope = {
    recipientId: URN.parse('urn:contacts:user:test'),
    encryptedData: new Uint8Array([1]),
    encryptedSymmetricKey: new Uint8Array([2]),
    signature: new Uint8Array([3]),
  };

  // The "Proto" QueuedMessage
  const mockQueuedMessagePb: QueuedMessagePb = {
    $typeName: 'src.types.routing.v1.QueuedMessagePb',
    id: 'ack-id-123',
    envelope: mockEnvelopePb,
  };

  // The "Smart" QueuedMessage
  const mockSmartQueuedMessage: QueuedMessage = {
    id: 'ack-id-123',
    envelope: mockSmartEnvelope,
  };

  // The "Proto" List (as returned by fromJson)
  const mockProtoQueuedList = {
    messages: [mockQueuedMessagePb, mockQueuedMessagePb],
  };

  // The raw JSON from the network
  const mockJsonFromNetwork: unknown = {
    messages: [
      {
        id: 'ack-id-123',
        envelope: {
          /* ... base64 strings ... */
        },
      },
    ],
  };

  beforeEach(async () => {
    const protoBuf = await import('@bufbuild/protobuf');
    mockFromJson = protoBuf.fromJson as Mock;

    // This import will now grab the mock from vi.mock
    const envelopeFacade = await import('../secure/envelope');
    mockSecureEnvelopeFromProto =
      envelopeFacade.secureEnvelopeFromProto as Mock;

    vi.clearAllMocks();

    // Default mock implementations
    mockFromJson.mockReturnValue(mockProtoQueuedList);
    mockSecureEnvelopeFromProto.mockReturnValue(mockSmartEnvelope);
  });

  // --- Tests ---

  describe('queuedMessageFromProto (Internal Mapper)', () => {
    it('should map a proto message to a smart message', () => {
      const result = queuedMessageFromProto(mockQueuedMessagePb);
      expect(result).toEqual(mockSmartQueuedMessage);
      expect(mockSecureEnvelopeFromProto).toHaveBeenCalledWith(mockEnvelopePb);
    });

    it('should throw if the envelope is missing', () => {
      const badPb = { ...mockQueuedMessagePb, envelope: undefined };
      expect(() => queuedMessageFromProto(badPb)).toThrow(
        'Invalid QueuedMessagePb: missing envelope.'
      );
    });
  });

  describe('deserializeJsonToQueuedMessages (Public API)', () => {
    it('should deserialize network JSON into an array of smart QueuedMessage objects', () => {
      // Act
      const result = deserializeJsonToQueuedMessages(mockJsonFromNetwork);

      // Assert
      // 1. Check that JSON was passed to protobuf parser
      expect(mockFromJson).toHaveBeenCalledWith(
        {}, // QueuedMessageListPbSchema
        mockJsonFromNetwork
      );

      // 2. Check that the internal mapper was called for each item
      expect(mockSecureEnvelopeFromProto).toHaveBeenCalledTimes(2);
      expect(mockSecureEnvelopeFromProto).toHaveBeenCalledWith(mockEnvelopePb);

      // 3. Check final result
      expect(result).toEqual([mockSmartQueuedMessage, mockSmartQueuedMessage]);
    });
  });
});
