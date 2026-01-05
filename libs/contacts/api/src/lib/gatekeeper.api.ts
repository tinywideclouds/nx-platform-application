import { Observable } from 'rxjs';
import { URN } from '@nx-platform-application/platform-types';
import {
  BlockedIdentity,
  PendingIdentity,
} from '@nx-platform-application/contacts-types';

/**
 * PORT: Gatekeeper
 * Handles Security Rules (Blocking, Quarantine, Pending).
 */
export abstract class GatekeeperApi {
  // --- Reactive Streams ---
  abstract readonly blocked$: Observable<BlockedIdentity[]>;
  abstract readonly pending$: Observable<PendingIdentity[]>;

  // --- Blocking ---
  abstract blockIdentity(
    urn: URN,
    scopes: string[],
    reason?: string,
  ): Promise<void>;

  abstract unblockIdentity(urn: URN): Promise<void>;

  abstract getAllBlockedIdentities(): Promise<BlockedIdentity[]>;

  // --- Pending / Quarantine ---
  abstract addToPending(
    urn: URN,
    vouchedBy?: URN,
    note?: string,
  ): Promise<void>;

  abstract getPendingIdentity(urn: URN): Promise<PendingIdentity | null>;

  abstract deletePending(urn: URN): Promise<void>;
}
