import { URN } from '@nx-platform-application/platform-types';
import { PrivateKeys } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import * as i0 from "@angular/core";
export declare class OutboxWorkerService {
    private readonly repo;
    private readonly keyCache;
    private readonly crypto;
    private readonly sendService;
    private readonly logger;
    private readonly identityResolver;
    private isProcessing;
    processQueue(senderUrn: URN, myKeys: PrivateKeys): Promise<void>;
    sendEphemeralBatch(recipients: URN[], typeId: URN, payloadBytes: Uint8Array, senderUrn: URN, myKeys: PrivateKeys): Promise<void>;
    private processTask;
    private coreDelivery;
    clearAllTasks(): Promise<void>;
    static ɵfac: i0.ɵɵFactoryDeclaration<OutboxWorkerService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<OutboxWorkerService>;
}
