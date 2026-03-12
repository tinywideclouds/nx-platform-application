import { TestBed } from '@angular/core/testing';
import { GeminiDataService } from './gemini-data.service';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { LlmStreamEvent } from '@nx-platform-application/llm-infrastructure-client-access';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('GeminiDataService', () => {
  let service: GeminiDataService;

  const mockLogger = {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GeminiDataService, { provide: Logger, useValue: mockLogger }],
    });
    service = TestBed.inject(GeminiDataService);
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Ephemeral Queue REST', () => {
    it('should securely remove a proposal via DELETE', async () => {
      (global.fetch as any).mockResolvedValue({ ok: true });

      await service.removeProposal('sess-456', 'prop-789');

      expect(global.fetch).toHaveBeenCalledWith(
        '/v1/llm/session/sess-456/proposals/prop-789',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('SSE Stream Parser', () => {
    it('should multiplex reasoning thoughts, standard text, and proposal_created events seamlessly', (done) => {
      const mockStreamData =
        `data: {"candidates": [{"content": {"parts": [{"text": "Hmm, I need to look at main.ts", "isThought": true}]}}]}\n\n` +
        `data: {"candidates": [{"content": {"parts": [{"text": "I will fix that."}]}}]}\n\n` +
        `event: proposal_created\n` +
        `data: {"originalContent": "old code", "proposal": {"id": "prop-1", "file_path": "main.ts", "patch": "@@ -1 +1 @@", "status": "pending", "created_at": "now"}}\n\n` +
        `event: done\n` +
        `data: {}\n\n`;

      const encoder = new TextEncoder();

      const mockBody = {
        getReader: () => {
          let hasRead = false;
          return {
            read: async () => {
              if (!hasRead) {
                hasRead = true;
                return { done: false, value: encoder.encode(mockStreamData) };
              }
              return { done: true, value: undefined };
            },
          };
        },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        body: mockBody,
      });

      const events: LlmStreamEvent[] = [];

      service
        .generateStream({ sessionId: 'sess-1', model: 'test', history: [] })
        .subscribe({
          next: (event) => events.push(event),
          complete: () => {
            expect(events).toHaveLength(3);

            // Assert Thought Parsing
            expect(events[0].type).toBe('thought');
            expect((events[0] as any).content).toBe(
              'Hmm, I need to look at main.ts',
            );

            // Assert Standard Text Parsing
            expect(events[1].type).toBe('text');
            expect((events[1] as any).content).toBe('I will fix that.');

            // Assert Proposal Parsing
            expect(events[2].type).toBe('proposal');
            expect((events[2] as any).event.proposal.patch).toBe('@@ -1 +1 @@');
          },
        });
    });
  });
});
