import { URN } from '@nx-platform-application/platform-types';
/**
 * CONTRACT: Identity Resolver
 * Abstract class acting as a Dependency Injection Token.
 * Decouples the consumer (ChatState) from the provider (ContactsStorage).
 */
export declare abstract class IdentityResolver {
    /**
     * Forward Resolution (UI -> Network)
     * Converts a local/private URN (e.g., Contact ID) into a routable/public Handle URN (e.g., Email).
     */
    abstract resolveToHandle(urn: URN): Promise<URN>;
    /**
     * Reverse Resolution (Network -> UI)
     * Maps an incoming Sender Handle to a local Contact URN if one exists.
     */
    abstract resolveToContact(handle: URN): Promise<URN>;
    /**
     * Storage Identity Strategy
     * Determines the Canonical ID to use for local history (usually the Contact ID).
     */
    abstract getStorageUrn(urn: URN): Promise<URN>;
}
