import { ChatMessage, TransportMessage } from '@nx-platform-application/messenger-types';
import { QuarantineRecord } from '../records/quarantine.record';
import * as i0 from "@angular/core";
export declare class QuarantineMapper {
    /**
     * Converts a Stored Quarantine Record into a Domain Chat Message.
     */
    toDomain(record: QuarantineRecord): ChatMessage;
    /**
     * Converts a Wire Message into a Storable Record.
     */
    toRecord(message: TransportMessage): QuarantineRecord;
    static ɵfac: i0.ɵɵFactoryDeclaration<QuarantineMapper, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<QuarantineMapper>;
}
