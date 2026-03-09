import { TestBed } from '@angular/core/testing';
import { SessionStorageService } from './session-storage.service';
import {
  LlmDatabase,
  LlmSessionMapper,
} from '@nx-platform-application/llm-infrastructure-indexed-db';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { LlmSession } from '@nx-platform-application/llm-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('SessionStorageService', () => {
  let service: SessionStorageService;
  let dbMock: any;
  let mapperMock: any;

  beforeEach(() => {
    dbMock = {
      sessions: {
        put: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
        orderBy: vi.fn().mockReturnThis(),
        reverse: vi.fn().mockReturnThis(),
        toArray: vi.fn(),
      },
      messages: { clear: vi.fn() },
      transaction: vi.fn(async (mode, tables, callback) => await callback()),
    };

    mapperMock = {
      toRecord: vi.fn(),
      toDomain: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        SessionStorageService,
        { provide: LlmDatabase, useValue: dbMock },
        { provide: LlmSessionMapper, useValue: mapperMock },
      ],
    });

    service = TestBed.inject(SessionStorageService);
  });

  const mockSession: LlmSession = {
    id: URN.parse('urn:llm:session:1'),
    title: 'Test',
    lastModified: '2026-03-09T10:00:00Z' as ISODateTimeString,
    attachments: [],
  };

  const mockRecord = { id: 'urn:llm:session:1', title: 'Test' };

  it('should save a session', async () => {
    mapperMock.toRecord.mockReturnValue(mockRecord);
    await service.saveSession(mockSession);
    expect(dbMock.sessions.put).toHaveBeenCalledWith(mockRecord);
  });

  it('should retrieve a session', async () => {
    dbMock.sessions.get.mockResolvedValue(mockRecord);
    mapperMock.toDomain.mockReturnValue(mockSession);

    const result = await service.getSession(mockSession.id);
    expect(result).toEqual(mockSession);
  });
});
