import { TestBed } from '@angular/core/testing';
import { WorkspaceStateService } from './workspace.service';
import { signal } from '@angular/core';
import { LlmSessionSource } from '@nx-platform-application/llm-features-session';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { URN } from '@nx-platform-application/platform-types';
import { LlmProposalService } from '@nx-platform-application/llm-domain-proposals';

// Import the new abstract provider
import { LlmTargetProvider } from '@nx-platform-application/llm-domain-data-target';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('WorkspaceStateService', () => {
  let service: WorkspaceStateService;

  const mockSessionSource = {
    activeSessionId: signal<URN | null>(null),
    activeSession: signal<any>({
      id: URN.parse('urn:llm:session:123'),
      workspaceTarget: URN.parse('urn:datasource:stream:target'),
    }),
  };

  const mockRegistry = {
    getProposalsForSession: vi.fn().mockResolvedValue([]),
    registryMutated: signal(0),
  };

  const mockTargetProvider = {
    getBaseFileContent: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        WorkspaceStateService,
        { provide: LlmSessionSource, useValue: mockSessionSource },
        { provide: LlmProposalService, useValue: mockRegistry },
        { provide: LlmTargetProvider, useValue: mockTargetProvider },
        {
          provide: Logger,
          useValue: { error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
        },
      ],
    });
    service = TestBed.inject(WorkspaceStateService);
  });

  it('should construct the overlayMap purely from incoming proposals', async () => {
    mockRegistry.getProposalsForSession.mockResolvedValue([
      {
        id: URN.parse('urn:llm:proposal:p1'),
        ownerSessionId: URN.parse('urn:llm:session:123'),
        filePath: 'src/main.ts',
        status: 'pending',
        createdAt: '2026-03-01T10:00:00Z',
      },
    ]);

    mockSessionSource.activeSessionId.set(URN.parse('urn:llm:session:123'));

    // Wait for the effect to resolve
    await new Promise(process.nextTick);

    expect(service.overlayMap().has('src/main.ts')).toBe(true);
    const fileRecord = service.overlayMap().get('src/main.ts');

    expect(fileRecord?.proposalChain.length).toBe(1);
    expect(fileRecord?.baseContent).toBeNull(); // Hasn't been fetched yet
  });

  it('should successfully JIT load base content using the TargetProvider', async () => {
    mockTargetProvider.getBaseFileContent.mockResolvedValue('const a = 1;');

    // Trigger the fetch JIT mechanism
    await service.loadContent(
      'src/main.ts',
      URN.parse('urn:datasource:stream:target'),
    );

    // Check if the service cached the content correctly
    const overlay = service.overlayMap().get('src/main.ts');
    // It should now be populated in the state internally.
    // Assuming a proposal pushed it into the map earlier:
    expect(mockTargetProvider.getBaseFileContent).toHaveBeenCalledWith(
      URN.parse('urn:datasource:stream:target'),
      'src/main.ts',
    );
  });
});
