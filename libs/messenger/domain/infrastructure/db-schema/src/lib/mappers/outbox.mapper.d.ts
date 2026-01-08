import { OutboundTask } from '@nx-platform-application/messenger-types';
import { OutboxRecord } from '../records/outbox.record';
import * as i0 from "@angular/core";
export declare class OutboxMapper {
    toRecord(domain: OutboundTask): OutboxRecord;
    toDomain(record: OutboxRecord): OutboundTask;
    static ɵfac: i0.ɵɵFactoryDeclaration<OutboxMapper, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<OutboxMapper>;
}
