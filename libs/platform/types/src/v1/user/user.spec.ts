import { describe, it, expect } from 'vitest';
import { create } from '@bufbuild/protobuf';
import { User, userToPb, userFromPb } from './user';
import { URN } from '../net/urn'; // <-- 1. Import URN

// Import the necessary proto types for testing purposes
import { UserPbSchema } from '@nx-platform-application/platform-protos/user/v1/user_pb.js';

describe('user mappers', () => {
  // --- 2. Create a proper URN for the mock ---
  const mockUrnString = 'urn:sm:user:user-123';
  const mockUrn = URN.parse(mockUrnString);

  const mockUser: User = {
    id: mockUrn, // <-- 3. Use the URN object here
    alias: 'johndoe',
    email: 'john@example.com',
  };

  it('should correctly map User to UserPb', () => {
    const userPb = userToPb(mockUser);

    expect(userPb).toBeDefined();
    // --- 4. Assert against the string value ---
    expect(userPb.id).toBe(mockUser.id.toString());
    expect(userPb.id).toBe(mockUrnString);
    // ---
    expect(userPb.alias).toBe(mockUser.alias);
    expect(userPb.email).toBe(mockUser.email);
  });

  it('should correctly map UserPb back to User', () => {
    // Use a valid URN string for the mock proto
    const mockPbId = 'urn:sm:user:pb-456';
    const mockUserPb = create(UserPbSchema, {
      id: mockPbId,
      alias: 'janedoe',
      email: 'jane@example.com',
    });

    const user = userFromPb(mockUserPb);

    expect(user).toBeDefined();
    // --- 5. Assert that the 'id' is a URN instance ---
    expect(user.id).toBeInstanceOf(URN);
    // You can check the string value
    expect(user.id.toString()).toBe(mockPbId);
    // Or do a deep equality check
    expect(user.id).toEqual(URN.parse(mockPbId));
    // ---
    expect(user.alias).toBe(mockUserPb.alias);
    expect(user.email).toBe(mockUserPb.email);
  });

  it('should perform a round trip conversion successfully', () => {
    const userPb = userToPb(mockUser);
    const user = userFromPb(userPb);

    // This deep-equality check should now work perfectly
    expect(user).toEqual(mockUser);
    expect(user.id.toString()).toBe(mockUrnString);
  });
});