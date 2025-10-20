import { describe, it, expect } from 'vitest';
import { create } from '@bufbuild/protobuf';
import {
  DeviceToken,
  NotificationRequest,
  deviceTokenToPb,
  deviceTokenFromPb,
} from './notification';
import { URN } from '@nx-platform-application/platform-types';

// Import the raw proto types for creating test instances
import {
  DeviceTokenPbSchema,
} from '@nx-platform-application/messenger-protos/notification/v1/notification_pb.js';

describe('notification mappers', () => {
  const mockDeviceToken: DeviceToken = {
    token: 'a-test-token-123',
    platform: 'ios',
  };

  /**
   * Test 1: Round Trip
   * Verifies that a TS object can be converted to a Proto object and back
   * to the original TS object without data loss.
   */
  it('should perform a round trip conversion successfully for DeviceToken', () => {
    // 1. TS -> Proto
    const protoPb = deviceTokenToPb(mockDeviceToken);
    // 2. Proto -> TS
    const roundTripTs = deviceTokenFromPb(protoPb);

    // 3. Verify
    expect(roundTripTs).toEqual(mockDeviceToken);
  });

  /**
   * Test 2: Typical Usage (TS to Proto)
   * Verifies the 'deviceTokenToPb' mapper works as expected.
   */
  it('should correctly map DeviceToken (TS) to DeviceTokenPb (Proto)', () => {
    const deviceTokenPb = deviceTokenToPb(mockDeviceToken);

    expect(deviceTokenPb).toBeDefined();
    expect(deviceTokenPb.token).toBe(mockDeviceToken.token);
    expect(deviceTokenPb.platform).toBe(mockDeviceToken.platform);
  });

  /**
   * Test 3: Typical Usage (Proto to TS)
   * Verifies the 'deviceTokenFromPb' mapper works as expected.
   */
  it('should correctly map DeviceTokenPb (Proto) to DeviceToken (TS)', () => {
    // Use 'create' to simulate a real Proto object
    const mockProtoPb = create(DeviceTokenPbSchema, {
      token: 'another-token-456',
      platform: 'android',
    });

    const deviceTokenTs = deviceTokenFromPb(mockProtoPb);

    expect(deviceTokenTs).toBeDefined();
    expect(deviceTokenTs.token).toBe(mockProtoPb.token);
    expect(deviceTokenTs.platform).toBe(mockProtoPb.platform);
  });

  /**
   * Test 4: Typical Usage (Interface Instantiation)
   * Verifies that the exported NotificationRequest interface can be
   * instantiated correctly with its complex types (URN, DeviceToken).
   */
  it('should allow instantiation of the NotificationRequest interface', () => {
    const mockRequest: NotificationRequest = {
      recipientId: URN.parse('urn:sm:user:user-bob'),
      tokens: [mockDeviceToken],
      content: {
        title: 'Test Title',
        body: 'Test body content',
        sound: 'default',
      },
      dataPayload: {
        messageId: 'msg-abc',
      },
    };

    expect(mockRequest).toBeDefined();
    expect(mockRequest.recipientId).toBeInstanceOf(URN);
    expect(mockRequest.tokens[0].platform).toBe('ios');
  });
});
