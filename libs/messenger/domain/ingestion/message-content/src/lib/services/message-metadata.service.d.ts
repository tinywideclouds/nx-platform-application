import { URN } from '@nx-platform-application/platform-types';
import * as i0 from "@angular/core";
export interface WrappedPayload {
    conversationId?: URN;
    tags?: URN[];
    content: Uint8Array;
}
export declare class MessageMetadataService {
    private decoder;
    private encoder;
    /**
     * Only wraps if metadata is provided.
     * Otherwise, returns the original bytes for lean signaling.
     */
    wrap(content: Uint8Array, conversationId?: URN, tags?: URN[]): Uint8Array;
    /**
     * Attempts to unwrap. If the first byte isn't '{',
     * it's likely a flat signal.
     */
    unwrap(bytes: Uint8Array): WrappedPayload;
    static ɵfac: i0.ɵɵFactoryDeclaration<MessageMetadataService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<MessageMetadataService>;
}
