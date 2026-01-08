import { URN } from '@nx-platform-application/platform-types';
import { ChatMessage, TransportMessage } from '@nx-platform-application/messenger-types';
import { QuarantineStorage } from '../quarantine.storage';
import * as i0 from "@angular/core";
export declare class DexieQuarantineStorage implements QuarantineStorage {
    private readonly db;
    private readonly mapper;
    saveQuarantinedMessage(message: TransportMessage): Promise<void>;
    getQuarantinedMessages(senderId: URN): Promise<ChatMessage[]>;
    getQuarantinedSenders(): Promise<URN[]>;
    deleteQuarantinedMessages(senderId: URN): Promise<void>;
    static ɵfac: i0.ɵɵFactoryDeclaration<DexieQuarantineStorage, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<DexieQuarantineStorage>;
}
