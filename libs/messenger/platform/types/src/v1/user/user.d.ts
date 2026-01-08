import { UserPb } from '@nx-platform-application/platform-protos/user/v1/user_pb.js';
import { Resource } from '../../lib/resource';
export interface User extends Resource {
    alias: string;
    email: string;
    profileUrl?: string;
}
export declare function userToPb(user: User): UserPb;
export declare function userFromPb(userPb: UserPb): User;
