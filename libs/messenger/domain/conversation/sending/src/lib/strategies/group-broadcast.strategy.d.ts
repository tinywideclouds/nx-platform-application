import { SendStrategy, SendContext } from '../send-strategy.interface';
import { OutboundResult } from '../send-strategy.interface';
import * as i0 from "@angular/core";
export declare class LocalBroadcastStrategy implements SendStrategy {
    private logger;
    private storageService;
    private contactsApi;
    private metadataService;
    private outboxStorage;
    private worker;
    private identityResolver;
    send(ctx: SendContext): Promise<OutboundResult>;
    static ɵfac: i0.ɵɵFactoryDeclaration<LocalBroadcastStrategy, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<LocalBroadcastStrategy>;
}
