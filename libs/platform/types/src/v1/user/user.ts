import { create } from '@bufbuild/protobuf';
import { URN } from '../net/urn';

import {
  UserPb,
  UserPbSchema,
} from '@nx-platform-application/platform-protos/user/v1/user_pb.js';
import { Resource } from '../../lib/resource';

export interface User extends Resource {
  alias: string;
  email: string;
  profileUrl?: string;
}

export function userToPb(user: User): UserPb {
  return create(UserPbSchema, {
    id: user.id.toString(),
    alias: user.alias,
    email: user.email,
    profileUrl: user.profileUrl,
  });
}

export function userFromPb(userPb: UserPb): User {
  return {
    id: URN.parse(userPb.id),
    alias: userPb.alias,
    email: userPb.email,
    profileUrl: userPb.profileUrl,
  };
}
