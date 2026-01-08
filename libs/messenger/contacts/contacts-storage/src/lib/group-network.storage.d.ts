import { URN } from '@nx-platform-application/platform-types';
import { GroupMemberStatus } from '@nx-platform-application/contacts-types';
import { GroupNetworkStorageApi } from '@nx-platform-application/contacts-api';
import * as i0 from "@angular/core";
export declare class GroupNetworkStorage implements GroupNetworkStorageApi {
    private readonly db;
    /**
     * ATOMIC PROTOCOL WRITE:
     * Updates a specific member's status (joined/left) based on Network Consensus.
     */
    updateGroupMemberStatus(groupUrn: URN, contactUrn: URN, status: GroupMemberStatus): Promise<void>;
    static ɵfac: i0.ɵɵFactoryDeclaration<GroupNetworkStorage, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<GroupNetworkStorage>;
}
