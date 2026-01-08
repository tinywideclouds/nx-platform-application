import { SendStrategy, SendContext, OutboundResult } from '../send-strategy.interface';
import * as i0 from "@angular/core";
export declare class NetworkGroupStrategy implements SendStrategy {
    private logger;
    private storageService;
    private contactsApi;
    private outboxStorage;
    private worker;
    private metadataService;
    private identityResolver;
    send(ctx: SendContext): Promise<OutboundResult>;
    static ɵfac: i0.ɵɵFactoryDeclaration<NetworkGroupStrategy, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<NetworkGroupStrategy>;
}
