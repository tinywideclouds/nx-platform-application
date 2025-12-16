// --- File: libs/platform/types/src/lib/notification.spec.ts ---
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import {
  webPushSubscriptionToProto,
  webPushSubscriptionFromProto,
  serializeWebPushSubscription,
  deserializeWebPushSubscription,
  WebPushSubscription,
} from './notification';

// Mock protobuf library
vi.mock('@bufbuild/protobuf', () => ({
  create: vi.fn((_schema, data) => data), // Pass-through
  fromJson: vi.fn(),
  toJson: vi.fn(),
}));

// Mock generated schema
vi.mock(
  '@nx-platform-application/platform-protos/notification/v1/notification_pb',
  () => ({
    WebPushSubscriptionPbSchema: {},
    WebPushSubscriptionPb: {},
  }),
);

describe('Notification Facade', () => {
  // --- Fixtures ---
  const mockEndpoint = 'https://push.example.com';

  // DOMAIN: Native Uint8Arrays
  const mockKeys = {
    p256dh: new Uint8Array([1, 2, 3]),
    auth: new Uint8Array([4, 5, 6]),
  };

  const domainSub: WebPushSubscription = {
    endpoint: mockEndpoint,
    keys: mockKeys,
  };

  // PROTO: Structure passed to create()
  const protoSub = {
    endpoint: mockEndpoint,
    p256dh: mockKeys.p256dh,
    auth: mockKeys.auth,
  };

  // JSON: Wire format (Simulated Base64 output from toJson)
  const jsonOutput = {
    endpoint: mockEndpoint,
    p256dh: 'AQID', // Base64 for [1,2,3]
    auth: 'BAUG', // Base64 for [4,5,6]
  };

  let mockFromJson: Mock;
  let mockToJson: Mock;
  let mockCreate: Mock;

  beforeEach(async () => {
    const protoBuf = await import('@bufbuild/protobuf');
    mockFromJson = protoBuf.fromJson as Mock;
    mockToJson = protoBuf.toJson as Mock;
    mockCreate = protoBuf.create as Mock;

    vi.clearAllMocks();
  });

  describe('Internal Mappers', () => {
    it('webPushSubscriptionToProto should map domain to proto struct', () => {
      const result = webPushSubscriptionToProto(domainSub);

      expect(mockCreate).toHaveBeenCalledWith(expect.anything(), {
        endpoint: domainSub.endpoint,
        p256dh: domainSub.keys.p256dh,
        auth: domainSub.keys.auth,
      });
      expect(result).toEqual(protoSub);
    });

    it('webPushSubscriptionFromProto should map proto to domain', () => {
      // Cast because our mock create() returns a plain object,
      // but the function expects the full Proto type
      const result = webPushSubscriptionFromProto(protoSub as any);
      expect(result).toEqual(domainSub);
    });
  });

  describe('Public API: Serialization', () => {
    it('serializeWebPushSubscription should delegate to toJson', () => {
      mockToJson.mockReturnValue(jsonOutput);

      const result = serializeWebPushSubscription(domainSub);

      expect(mockCreate).toHaveBeenCalled();
      expect(mockToJson).toHaveBeenCalledWith(expect.anything(), protoSub);
      expect(result).toEqual(jsonOutput);
    });

    it('deserializeWebPushSubscription should delegate to fromJson', () => {
      mockFromJson.mockReturnValue(protoSub);

      const result = deserializeWebPushSubscription(jsonOutput);

      expect(mockFromJson).toHaveBeenCalledWith(expect.anything(), jsonOutput);
      expect(result).toEqual(domainSub);
    });
  });
});
