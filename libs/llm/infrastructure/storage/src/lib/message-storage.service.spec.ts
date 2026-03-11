import { TestBed } from '@angular/core/testing';
import { MessageStorageService } from './message-storage.service';
import {
  LlmDatabase,
  LlmMessageMapper,
} from '@nx-platform-application/llm-infrastructure-indexed-db';
import { URN } from '@nx-platform-application/platform-types';
import { Dexie } from 'dexie';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { LlmMessage } from '@nx-platform-application/llm-types';

describe('MessageStorageService', () => {
  let service: MessageStorageService;
  let dbMock: any;
  let mapperMock: any;

  beforeEach(() => {
    dbMock = {
      sessions: {
        put: vi.fn(),
        get: vi.fn(),
        update: vi.fn(),
      },
      messages: {
        put: vi.fn(),
        get: vi.fn(),
        bulkPut: vi.fn(),
        where: vi.fn().mockReturnThis(),
        between: vi.fn().mockReturnThis(),
        toArray: vi.fn(),
      },
      transaction: vi.fn(async (mode, tables, callback) => await callback()),
    };

    mapperMock = {
      toRecord: vi.fn(),
      toDomain: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        MessageStorageService,
        { provide: LlmDatabase, useValue: dbMock },
        { provide: LlmMessageMapper, useValue: mapperMock },
      ],
    });

    service = TestBed.inject(MessageStorageService);
  });

  describe('saveMessage', () => {
    const mockMsg = { id: URN.parse('urn:llm:message:1') } as LlmMessage;
    const mockRecord = {
      id: 'urn:llm:message:1',
      sessionId: 'urn:llm:session:99',
      timestamp: '2026-03-09T10:00:00Z',
    };

    beforeEach(() => {
      mapperMock.toRecord.mockReturnValue(mockRecord);
    });

    it('should update the session lastModified if the session already exists', async () => {
      dbMock.sessions.get.mockResolvedValue({ id: 'urn:llm:session:99' });

      await service.saveMessage(mockMsg);

      expect(dbMock.messages.put).toHaveBeenCalledWith(mockRecord);
      expect(dbMock.sessions.update).toHaveBeenCalledWith(
        'urn:llm:session:99',
        { lastModified: '2026-03-09T10:00:00Z' },
      );
    });

    it('should create a brand new session record with new intent buckets if it does not exist', async () => {
      dbMock.sessions.get.mockResolvedValue(undefined);

      await service.saveMessage(mockMsg);

      expect(dbMock.sessions.put).toHaveBeenCalledWith({
        id: 'urn:llm:session:99',
        title: 'urn:llm:session:99',
        lastModified: '2026-03-09T10:00:00Z',
        inlineContexts: [],
        systemContexts: [],
        compiledContext: undefined,
        quickContext: [],
      });
    });
  });

  describe('getSessionMessages', () => {
    it('should query messages using the compound index [sessionId+timestamp]', async () => {
      dbMock.messages.toArray.mockResolvedValue([]);

      await service.getSessionMessages(URN.parse('urn:llm:session:123'));

      expect(dbMock.messages.where).toHaveBeenCalledWith(
        '[sessionId+timestamp]',
      );
      expect(dbMock.messages.between).toHaveBeenCalledWith(
        ['urn:llm:session:123', Dexie.minKey],
        ['urn:llm:session:123', Dexie.maxKey],
      );
    });
  });
});
