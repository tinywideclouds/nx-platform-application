import { ISODateTimeString } from '@nx-platform-application/platform-types';
/**
 * Represents a raw message held in the 'quarantined_messages' table.
 * Corresponds to TransportMessage (Wire Object).
 */
export interface QuarantineRecord {
    messageId: string;
    senderId: string;
    sentTimestamp: ISODateTimeString;
    typeId: string;
    payloadBytes: Uint8Array;
    clientRecordId?: string;
}
