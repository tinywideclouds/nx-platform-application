import { ChatMessage } from '@nx-platform-application/messenger-types';
import { MessageRecord } from '../records/message.record';
import * as i0 from "@angular/core";
export declare class MessageMapper {
    toDomain(record: MessageRecord): ChatMessage;
    toRecord(message: ChatMessage): MessageRecord;
    static ɵfac: i0.ɵɵFactoryDeclaration<MessageMapper, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<MessageMapper>;
}
