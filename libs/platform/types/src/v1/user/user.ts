import { create } from '@bufbuild/protobuf';

import {
  UserPb,
  UserPbSchema,
} from '@nx-platform-application/platform-protos/user/v1/user_pb.js';

export interface User {
  id: string;
  alias: string;
  email: string;
}

export function userToPb(user: User): UserPb {
  return create(UserPbSchema, {
    id: user.id,
    alias: user.alias,
    email: user.email,
  });
}

export function userFromPb(userPb: UserPb): User {
  return {
    id: userPb.id,
    alias: userPb.alias,
    email: userPb.email,
  };
}
