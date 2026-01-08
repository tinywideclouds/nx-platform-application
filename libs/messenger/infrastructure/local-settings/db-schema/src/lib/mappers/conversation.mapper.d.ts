import { ConversationSummary } from '@nx-platform-application/messenger-types';
import { ConversationIndexRecord } from '../records/conversation.record';
import * as i0 from "@angular/core";
export declare class ConversationMapper {
    /**
     * Maps the Storage Record (DB) to the Domain Summary (UI/State).
     */
    toDomain(record: ConversationIndexRecord): ConversationSummary;
    /**
     * Maps the Domain Summary back to a Storage Record.
     */
    toRecord(domain: ConversationSummary): ConversationIndexRecord;
    static ɵfac: i0.ɵɵFactoryDeclaration<ConversationMapper, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<ConversationMapper>;
}
