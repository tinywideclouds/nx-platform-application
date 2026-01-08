import { PrivateKeys } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { URN } from '@nx-platform-application/platform-types';
import { OutboundResult, SendOptions } from './send-strategy.interface';
import * as i0 from "@angular/core";
export declare class OutboundService {
    private logger;
    private identityResolver;
    private outboxWorker;
    private directStrategy;
    private networkStrategy;
    private broadcastStrategy;
    triggerQueueProcessing(senderUrn: URN, myKeys: PrivateKeys): void;
    sendMessage(myKeys: PrivateKeys, myUrn: URN, recipientUrn: URN, typeId: URN, originalPayloadBytes: Uint8Array, options?: SendOptions): Promise<OutboundResult | null>;
    static ɵfac: i0.ɵɵFactoryDeclaration<OutboundService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<OutboundService>;
}
