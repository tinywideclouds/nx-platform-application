import { SendStrategy, SendContext } from '../send-strategy.interface';
import { OutboundResult } from '../send-strategy.interface';
import * as i0 from "@angular/core";
export declare class DirectSendStrategy implements SendStrategy {
    private logger;
    private storageService;
    private outbox;
    private worker;
    private metadataService;
    private identityResolver;
    send(ctx: SendContext): Promise<OutboundResult>;
    static ɵfac: i0.ɵɵFactoryDeclaration<DirectSendStrategy, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<DirectSendStrategy>;
}
