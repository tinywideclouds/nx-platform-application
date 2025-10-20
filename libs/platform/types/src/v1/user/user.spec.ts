import { create } from '@bufbuild/protobuf';
import {
  User,
  userToPb,
  userFromPb,
} from './user';
// Import the necessary proto types for testing purposes
import { UserPbSchema } from '@nx-platform-application/platform-protos/user/v1/user_pb.js';

describe('user mappers', () => {
  const mockUser: User = {
    id: 'user-123',
    alias: 'johndoe',
    email: 'john@example.com',
  };

  it('should correctly map User to UserPb', () => {
    const userPb = userToPb(mockUser);

    expect(userPb).toBeDefined();
    expect(userPb.id).toBe(mockUser.id);
    expect(userPb.alias).toBe(mockUser.alias);
    expect(userPb.email).toBe(mockUser.email);
  });

  it('should correctly map UserPb back to User', () => {
    // Create a mock UserPb instance using the protobuf helper
    const mockUserPb = create(UserPbSchema, {
      id: 'pb-456',
      alias: 'janedoe',
      email: 'jane@example.com',
    });

    const user = userFromPb(mockUserPb);

    expect(user).toBeDefined();
    expect(user.id).toBe(mockUserPb.id);
    expect(user.alias).toBe(mockUserPb.alias);
    expect(user.email).toBe(mockUserPb.email);
  });

  it('should perform a round trip conversion successfully', () => {
    const userPb = userToPb(mockUser);
    const user = userFromPb(userPb);

    expect(user).toEqual(mockUser);
  });
});
