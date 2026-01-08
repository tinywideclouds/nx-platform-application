import { Observable } from 'rxjs';
import { URN } from '@nx-platform-application/platform-types';
import { BlockedIdentity, PendingIdentity } from '@nx-platform-application/contacts-types';
import { GatekeeperApi } from '@nx-platform-application/contacts-api';
import * as i0 from "@angular/core";
export declare class GatekeeperStorage implements GatekeeperApi {
    private readonly db;
    private readonly mapper;
    readonly pending$: Observable<PendingIdentity[]>;
    readonly blocked$: Observable<BlockedIdentity[]>;
    blockIdentity(urn: URN, scopes: string[], reason?: string): Promise<void>;
    unblockIdentity(urn: URN): Promise<void>;
    getAllBlockedIdentities(): Promise<BlockedIdentity[]>;
    addToPending(urn: URN, vouchedBy?: URN, note?: string): Promise<void>;
    getPendingIdentity(urn: URN): Promise<PendingIdentity | null>;
    deletePending(urn: URN): Promise<void>;
    static ɵfac: i0.ɵɵFactoryDeclaration<GatekeeperStorage, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<GatekeeperStorage>;
}
