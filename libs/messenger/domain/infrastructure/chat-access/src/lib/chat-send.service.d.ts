import { Observable } from 'rxjs';
import { SecureEnvelope } from '@nx-platform-application/platform-types';
import * as i0 from "@angular/core";
export declare class ChatSendService {
    private readonly http;
    private readonly baseApiUrl;
    private readonly sendUrl;
    /**
     * Sends a fully formed SecureEnvelope.
     * Endpoint: POST /api/send
     */
    sendMessage(envelope: SecureEnvelope): Observable<void>;
    static ɵfac: i0.ɵɵFactoryDeclaration<ChatSendService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<ChatSendService>;
}
