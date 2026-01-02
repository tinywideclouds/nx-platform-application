//libs/messenger/infrastructure/chat-storage/src/lib/services/dexie-quarantine.storage.spec.ts
import { TestBed } from '@angular/core/testing';
import { DexieQuarantineStorage } from './dexie-quarantine.storage';
import {
  MessengerDatabase,
  QuarantineMapper,
} from '@nx-platform-application/messenger-infrastructure-db-schema';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { TransportMessage } from '@nx-platform-application/messenger-types';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Dexie } from 'dexie';
import 'fake-indexeddb/auto';

describe('DexieQuarantineStorage', () => {
  let storage: DexieQuarantineStorage;
  let db: MessengerDatabase;

  const senderUrn = URN.parse('urn:contacts:user:stranger');

  const mockTransport: TransportMessage = {
    senderId: senderUrn,
    sentTimestamp: '2025-01-01T10:00:00Z' as ISODateTimeString,
    typeId: URN.parse('urn:message:type:text'),
    payloadBytes: new Uint8Array([1]),
    clientRecordId: 'uuid-123',
  } as unknown as TransportMessage;

  beforeEach(async () => {
    await Dexie.delete('messenger');
    TestBed.configureTestingModule({
      providers: [DexieQuarantineStorage, MessengerDatabase, QuarantineMapper],
    });
    storage = TestBed.inject(DexieQuarantineStorage);
    db = TestBed.inject(MessengerDatabase);
    await db.open();
  });

  afterEach(async () => {
    if (db) await db.close();
  });

  it('should save and retrieve quarantined messages', async () => {
    await storage.saveQuarantinedMessage(mockTransport);

    const msgs = await storage.getQuarantinedMessages(senderUrn);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].id).toBe('uuid-123');
    expect(msgs[0].senderId.toString()).toBe(senderUrn.toString());
  });

  it('should list unique senders', async () => {
    await storage.saveQuarantinedMessage(mockTransport);
    await storage.saveQuarantinedMessage({
      ...mockTransport,
      clientRecordId: 'uuid-456',
    });

    const senders = await storage.getQuarantinedSenders();
    expect(senders).toHaveLength(1);
    expect(senders[0].toString()).toBe(senderUrn.toString());
  });

  it('should delete messages for a specific sender', async () => {
    await storage.saveQuarantinedMessage(mockTransport);
    await storage.deleteQuarantinedMessages(senderUrn);

    const msgs = await storage.getQuarantinedMessages(senderUrn);
    expect(msgs).toHaveLength(0);
  });
});
