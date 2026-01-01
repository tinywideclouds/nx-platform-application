import { Injectable } from '@angular/core';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import {
  OutboundTask,
  RecipientProgress,
} from '@nx-platform-application/messenger-domain-outbox';
import { OutboxRecord } from '../records/outbox.record';

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
      createdAt: record.createdAt as ISODateTimeString,
      recipients: record.recipients.map((r) => ({
        ...r,
        urn: URN.parse(r.urn),
      })) as RecipientProgress[],
    };
  }
}
