import { Injectable } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { OutboundTask, RecipientProgress } from '../models/outbound-task.model';
import { OutboxRecord } from './outbox.record';

@Injectable({ providedIn: 'root' })
export class OutboxMapper {
  toRecord(domain: OutboundTask): OutboxRecord {
    return {
      ...domain,
      conversationUrn: domain.conversationUrn.toString(),
      typeId: domain.typeId.toString(),
      tags: domain.tags.map((t) => t.toString()),
      recipients: domain.recipients.map((r) => ({
        ...r,
        urn: r.urn.toString(),
      })),
    };
  }

  toDomain(record: OutboxRecord): OutboundTask {
    return {
      ...record,
      conversationUrn: URN.parse(record.conversationUrn),
      typeId: URN.parse(record.typeId),
      tags: record.tags.map((t) => URN.parse(t)),
      recipients: record.recipients.map((r) => ({
        ...r,
        urn: URN.parse(r.urn),
      })) as RecipientProgress[],
    };
  }
}
