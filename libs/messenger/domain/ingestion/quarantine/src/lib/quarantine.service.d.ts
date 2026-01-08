import { URN } from '@nx-platform-application/platform-types';
import { TransportMessage, ChatMessage } from '@nx-platform-application/messenger-types';
import * as i0 from "@angular/core";
export declare class QuarantineService {
    private readonly storage;
    private readonly contacts;
    private readonly logger;
    private readonly identityResolver;
    process(message: TransportMessage, blockedSet: Set<string>): Promise<URN | null>;
    getPendingRequests(): Promise<URN[]>;
    retrieveForInspection(senderId: URN): Promise<ChatMessage[]>;
    reject(senderId: URN): Promise<void>;
    static ɵfac: i0.ɵɵFactoryDeclaration<QuarantineService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<QuarantineService>;
}
