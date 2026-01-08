import { Table } from 'dexie';
import { PlatformDexieService } from '@nx-platform-application/platform-dexie-storage';
import { MessageRecord } from './records/message.record';
import { ConversationIndexRecord } from './records/conversation.record';
import { DeletedMessageRecord } from './records/tombstone.record';
import { QuarantineRecord } from './records/quarantine.record';
import { OutboxRecord } from './records/outbox.record';
import * as i0 from "@angular/core";
export declare class MessengerDatabase extends PlatformDexieService {
    messages: Table<MessageRecord, string>;
    conversations: Table<ConversationIndexRecord, string>;
    tombstones: Table<DeletedMessageRecord, string>;
    quarantined_messages: Table<QuarantineRecord, string>;
    outbox: Table<OutboxRecord, string>;
    settings: Table<{
        key: string;
        value: any;
    }, string>;
    constructor();
    static ɵfac: i0.ɵɵFactoryDeclaration<MessengerDatabase, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<MessengerDatabase>;
}
