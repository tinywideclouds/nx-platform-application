import { TestBed } from '@angular/core/testing';
import { LlmMemoryManagerService } from './memory-manager.service';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { LlmMessage } from '@nx-platform-application/llm-types';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { LlmWeightCalculator } from '@nx-platform-application/llm-tools-weighting';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('LlmMemoryManagerService', () => {
  let service: LlmMemoryManagerService;
  let mockLogger: any;
  let mockCalculator: any;

  beforeEach(() => {
    mockLogger = { debug: vi.fn(), warn: vi.fn(), error: vi.fn() };

    // We mock the calculate function to just return the string length as the weight
    // to easily test the bounds.
    mockCalculator = {
      calculate: vi.fn((text: string) => ({
        weight: text.length,
        unit: 'char',
        tokens: 0,
        generator: 'test',
      })),
    };

    TestBed.configureTestingModule({
      providers: [
        LlmMemoryManagerService,
        { provide: Logger, useValue: mockLogger },
        { provide: LlmWeightCalculator, useValue: mockCalculator },
      ],
    });
    service = TestBed.inject(LlmMemoryManagerService);
  });

  const encoder = new TextEncoder();

  // Helper to generate fake messages.
  // The 'text' length determines the weight based on our mockCalculator.
  const createMockMessages = (
    count: number,
    textString: string,
  ): LlmMessage[] => {
    return Array.from({ length: count }).map((_, i) => ({
      id: URN.parse(`urn:llm:message:${i}`),
      sessionId: URN.parse('urn:llm:session:1'),
      typeId: URN.parse('urn:llm:type:text'),
      role: 'user',
      timestamp:
        `2026-03-14T10:00:${i.toString().padStart(2, '0')}Z` as ISODateTimeString,
      payloadBytes: encoder.encode(textString),
      isExcluded: false,
    }));
  };

  it('should not trigger compression if under budgets', async () => {
    // 10 messages of string 'ab' (weight 2) = 20 total weight.
    const messages = createMockMessages(10, 'ab');

    await service.analyzeAndCompressDryRun(messages);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('On-Screen=20u'),
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('should fill off-screen buffer but not compress if under threshold', async () => {
    // 30 messages of weight 2 = 60 total weight.
    const messages = createMockMessages(30, 'ab');

    await service.analyzeAndCompressDryRun(messages);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('On-Screen=50u'),
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Off-Screen=10u'),
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('should trigger dry run compression on the oldest chunk when threshold exceeded', async () => {
    // 40 messages of weight 2 = 80 total weight.
    const messages = createMockMessages(40, 'ab');

    await service.analyzeAndCompressDryRun(messages);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Triggering Dry Run'),
    );

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Would compress 13 messages'),
    );

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Message ID range: urn:llm:message:0 to urn:llm:message:12',
      ),
    );
  });
});
