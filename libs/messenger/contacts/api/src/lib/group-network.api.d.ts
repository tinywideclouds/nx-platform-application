import { URN } from '@nx-platform-application/platform-types';
import { GroupMemberStatus } from '@nx-platform-application/contacts-types';
/**
 * PORT: Group Network Storage
 * Handles low-level database operations required by the Network Protocol
 * (e.g., Consensus Updates) that are separate from the User's Address Book.
 */
export declare abstract class GroupNetworkStorageApi {
    /**
     * Atomic update for a single member's status.
     * Used by the Protocol Service to record consensus (Join/Leave/Reject).
     */
    abstract updateGroupMemberStatus(groupUrn: URN, contactUrn: URN, status: GroupMemberStatus): Promise<void>;
}
