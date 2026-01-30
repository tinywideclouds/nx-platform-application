import { TestBed } from '@angular/core/testing';
import { QuarantineMapper } from './quarantine.mapper';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { QuarantineRecord } from '../records/quarantine.record';
import { TransportMessage } from '@nx-platform-application/messenger-types';

describe('QuarantineMapper', () => {
  let mapper: QuarantineMapper;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [QuarantineMapper],
    });
    mapper = TestBed.inject(QuarantineMapper);
  });

  describe('toDomain', () => {
    it('should map QuarantineRecord -> ChatMessage (Received Context)', () => {
      const record: QuarantineRecord = {
        messageId: 'q-1',
        senderId: 'urn:contacts:user:stranger',
        sentTimestamp: '2024-01-01T10:00:00Z' as ISODateTimeString,
        typeId: 'urn:message:type:text',
        payloadBytes: new Uint8Array([99]),
      };

      const domain = mapper.toDomain(record);

      expect(domain.id).toBe('q-1');
      expect(domain.senderId.toString()).toBe('urn:contacts:user:stranger');
      expect(domain.conversationUrn.toString()).toBe(
        'urn:contacts:user:stranger',
      );
      expect(domain.status).toBe('received');
      expect(domain.tags).toEqual([]);
    });
  });

  describe('toRecord', () => {
    const mockTransport: TransportMessage = {
      senderId: URN.parse('urn:contacts:user:stranger'),
      sentTimestamp: '2024-01-01T10:00:00Z' as ISODateTimeString,
      typeId: URN.parse('urn:message:type:text'),
      payloadBytes: new Uint8Array([10]),
      clientRecordId: 'uuid-123',
    };

    it('should map TransportMessage -> QuarantineRecord using client ID if present', () => {
      const record = mapper.toRecord(mockTransport);

      expect(record.messageId).toBe('uuid-123');
      expect(record.clientRecordId).toBe('uuid-123');
      expect(record.senderId).toBe('urn:contacts:user:stranger');
    });

    it('should generate ID if clientRecordId is missing', () => {
      const transportWithoutId = {
        ...mockTransport,
        clientRecordId: undefined,
      };

      const record = mapper.toRecord(transportWithoutId);

      expect(record.messageId).toBeDefined();
      expect(record.messageId).not.toBe('');
      expect(record.clientRecordId).toBeUndefined();
    });
  });
});
