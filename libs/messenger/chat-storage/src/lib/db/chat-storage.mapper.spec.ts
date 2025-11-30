import { TestBed } from '@angular/core/testing';
import { URN } from '@nx-platform-application/platform-types';
import { ChatStorageMapper } from './chat-storage.mapper';
import { MessageRecord } from './chat-storage.models';

describe('ChatStorageMapper', () => {
  let mapper: ChatStorageMapper;

  // Fixtures use strings as they represent raw DB output
  const mockRecord: MessageRecord = {
    messageId: 'msg-123',
    senderId: 'urn:contacts:user:me',
    recipientId: 'urn:contacts:user:bob',
    sentTimestamp: '2024-01-01T10:00:00Z' as any,
    typeId: 'urn:message:type:text',
    // Simulate raw binary data (stored as Uint8Array, retrieved often as ArrayBuffer)
    payloadBytes: new Uint8Array([72, 101, 108, 108, 111]) as any,
    status: 'sent',
    conversationUrn: 'urn:contacts:user:bob',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ChatStorageMapper],
    });
    mapper = TestBed.inject(ChatStorageMapper);
  });

  it('should convert MessageRecord to DecryptedMessage', () => {
    const result = mapper.mapRecordToSmart(mockRecord);

    // 1. Assert URN Objects are restored
    expect(result.senderId).toBeInstanceOf(URN);
    expect(result.conversationUrn).toBeInstanceOf(URN);
    expect(result.senderId.toString()).toBe(mockRecord.senderId);

    // 2. Assert Binary Integrity
    // Check that the data is a Uint8Array instance (critical for TextDecoder)
    expect(result.payloadBytes).toBeInstanceOf(Uint8Array);
    // Check content integrity
    expect(new TextDecoder().decode(result.payloadBytes)).toBe('Hello');

    // 3. Assert Data Integrity
    expect(result.messageId).toBe('msg-123');
  });

  it('should maintain type even if input is a generic ArrayBuffer', () => {
    // Simulate Dexie returning a raw ArrayBuffer
    const rawBufferRecord = {
      ...mockRecord,
      payloadBytes: mockRecord.payloadBytes.buffer,
    };

    const result = mapper.mapRecordToSmart(rawBufferRecord);

    // It should successfully create a Uint8Array view from the ArrayBuffer
    expect(result.payloadBytes).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(result.payloadBytes)).toBe('Hello');
  });
});
