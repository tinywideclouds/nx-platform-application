import { TestBed } from '@angular/core/testing';
import { LlmStorageService } from './llm-storage.service';
import {
  LlmDatabase,
  LlmMessageMapper,
  LlmSessionMapper,
} from '@nx-platform-application/llm-infrastructure-indexed-db';
import { URN } from '@nx-platform-application/platform-types';
import { Dexie } from 'dexie';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { LlmMessage } from '@nx-platform-application/llm-types';

describe('LlmStorageService', () => {
  let service: LlmStorageService;
  let dbMock: any;
  let sessionMapperMock: any;
  let messageMapperMock: any;

  beforeEach(() => {
    // Mock Dexie Tables and Transaction
    dbMock = {
      sessions: {
        put: vi.fn(),
        get: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      messages: {
        put: vi.fn(),
        get: vi.fn(),
        bulkPut: vi.fn(),
        where: vi.fn().mockReturnThis(),
        between: vi.fn().mockReturnThis(),
        toArray: vi.fn(),
      },
      // Immediately execute the transaction callback for testing
      transaction: vi.fn(async (mode, tables, callback) => await callback()),
    };

    sessionMapperMock = {
      toRecord: vi.fn(),
      toDomain: vi.fn(),
    };

    messageMapperMock = {
      toRecord: vi.fn(),
      toDomain: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        LlmStorageService,
        { provide: LlmDatabase, useValue: dbMock },
        { provide: LlmSessionMapper, useValue: sessionMapperMock },
        { provide: LlmMessageMapper, useValue: messageMapperMock },
      ],
    });

    service = TestBed.inject(LlmStorageService);
  });

  describe('saveMessage', () => {
    const mockMsg = { id: URN.parse('urn:llm:message:1') } as LlmMessage;
    const mockRecord = {
      id: 'urn:llm:message:1',
      sessionId: 'urn:llm:session:99',
      timestamp: '2026-02-28T10:00:00Z',
    };

    beforeEach(() => {
      messageMapperMock.toRecord.mockReturnValue(mockRecord);
    });

    it('should update the session lastModified if the session already exists', async () => {
      dbMock.sessions.get.mockResolvedValue({ id: 'urn:llm:session:99' }); // Session exists

      await service.saveMessage(mockMsg);

      expect(dbMock.transaction).toHaveBeenCalled();
      expect(dbMock.messages.put).toHaveBeenCalledWith(mockRecord);
      expect(dbMock.sessions.update).toHaveBeenCalledWith(
        'urn:llm:session:99',
        { lastModified: '2026-02-28T10:00:00Z' },
      );
      expect(dbMock.sessions.put).not.toHaveBeenCalledWith(
        expect.objectContaining({ contextGroups: {} }),
      ); // Ensure new session wasn't created
    });

    it('should create a brand new session record if it does not exist', async () => {
      dbMock.sessions.get.mockResolvedValue(undefined); // Session does NOT exist

      await service.saveMessage(mockMsg);

      expect(dbMock.transaction).toHaveBeenCalled();
      expect(dbMock.messages.put).toHaveBeenCalledWith(mockRecord);
      expect(dbMock.sessions.put).toHaveBeenCalledWith({
        id: 'urn:llm:session:99',
        title: 'urn:llm:session:99',
        lastModified: '2026-02-28T10:00:00Z',
        contextGroups: {},
        attachments: [],
        quickContext: [],
      });
    });
  });

  describe('getSessionMessages', () => {
    it('should query messages using the compound [sessionId+timestamp] index', async () => {
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
