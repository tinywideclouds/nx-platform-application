import { TestBed } from '@angular/core/testing';
import { LlmSessionSource } from './llm-session.source';
import { LlmStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { URN } from '@nx-platform-application/platform-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('LlmSessionSource', () => {
  let service: LlmSessionSource;
  let mockStorage: any;

  beforeEach(() => {
    mockStorage = {
      getSessions: vi.fn().mockResolvedValue([]),
    };

    TestBed.configureTestingModule({
      providers: [
        LlmSessionSource,
        { provide: LlmStorageService, useValue: mockStorage },
      ],
    });

    service = TestBed.inject(LlmSessionSource);
  });

  it('should hydrate sessions from storage on initialization', async () => {
    const mockSessions = [
      { id: URN.parse('urn:llm:session:1'), title: 'Test' },
    ];
    mockStorage.getSessions.mockResolvedValue(mockSessions);

    await service.refresh();

    expect(service.sessions()).toEqual(mockSessions);
    expect(mockStorage.getSessions).toHaveBeenCalled();
  });

  it('should instantly add an optimistic session to the top of the list', () => {
    const urn = URN.parse('urn:llm:session:new');
    service.addOptimisticSession(urn);

    const sessions = service.sessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe(urn);
    expect((sessions[0] as any).isOptimistic).toBe(true);
    expect(sessions[0].attachments).toEqual([]);
  });
});
