import { TestBed } from '@angular/core/testing';
import { LlmSessionActions } from './session-actions.service';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { LlmStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { LlmSessionSource } from '@nx-platform-application/llm-features-chat';
import { LLM_NETWORK_CLIENT } from '@nx-platform-application/llm-infrastructure-client-access';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { LlmSession } from '@nx-platform-application/llm-types';

describe('LlmSessionActions', () => {
  let service: LlmSessionActions;

  // Uses the newly unified Ephemeral Queue Network Contract
  const mockNetwork = {
    removeProposal: vi.fn().mockResolvedValue(undefined),
    buildCache: vi.fn(),
  };
  const mockSnackBar = { open: vi.fn() };
  const mockLogger = { error: vi.fn() };
  const mockRouter = { navigate: vi.fn() };
  const mockSource = { addOptimisticSession: vi.fn(), refresh: vi.fn() };

  const mockSession: LlmSession = {
    id: URN.parse('urn:llm:session:123'), // FIX: 4-part URN
    title: 'Test',
    lastModified: '2026-02-27T10:00:00Z' as ISODateTimeString,
    attachments: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        LlmSessionActions,
        { provide: LLM_NETWORK_CLIENT, useValue: mockNetwork },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: Logger, useValue: mockLogger },
        { provide: Router, useValue: mockRouter },
        { provide: LlmSessionSource, useValue: mockSource },
        { provide: LlmStorageService, useValue: { saveSession: vi.fn() } },
      ],
    });
    service = TestBed.inject(LlmSessionActions);
  });

  describe('Ephemeral Queue Registry', () => {
    it('should successfully clear the queue when accepting', async () => {
      await service.acceptProposal(mockSession, 'prop-999');

      expect(mockNetwork.removeProposal).toHaveBeenCalledWith(
        'urn:llm:session:123', // FIX: Match 4-part URN
        'prop-999',
      );
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('successfully applied'),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should successfully clear the queue when rejecting', async () => {
      await service.rejectProposal(mockSession, 'prop-999');

      expect(mockNetwork.removeProposal).toHaveBeenCalledWith(
        'urn:llm:session:123', // FIX: Match 4-part URN
        'prop-999',
      );
    });
  });
});
