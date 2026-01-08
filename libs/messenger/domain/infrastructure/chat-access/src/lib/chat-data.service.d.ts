import { Observable } from 'rxjs';
import { QueuedMessage } from '@nx-platform-application/platform-types';
import * as i0 from "@angular/core";
export declare class ChatDataService {
    private readonly http;
    private readonly baseApiUrl;
    /**
     * Fetches the next available batch of queued messages.
     * Endpoint: GET /api/messages
     */
    getMessageBatch(limit?: number): Observable<QueuedMessage[]>;
    /**
     * Acknowledges receipt of messages.
     * Endpoint: POST /api/messages/ack
     */
    acknowledge(messageIds: string[]): Observable<void>;
    static ɵfac: i0.ɵɵFactoryDeclaration<ChatDataService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<ChatDataService>;
}
