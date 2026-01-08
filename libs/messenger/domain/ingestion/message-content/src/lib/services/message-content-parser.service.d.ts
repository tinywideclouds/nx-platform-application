import { URN } from '@nx-platform-application/platform-types';
import { ParsedMessage } from '../models/content-types';
import * as i0 from "@angular/core";
export declare class MessageContentParser {
    private metadataService;
    private decoder;
    parse(typeId: URN, rawBytes: Uint8Array): ParsedMessage;
    static ɵfac: i0.ɵɵFactoryDeclaration<MessageContentParser, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<MessageContentParser>;
}
