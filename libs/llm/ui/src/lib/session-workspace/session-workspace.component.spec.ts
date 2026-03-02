import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { LlmSessionWorkspaceComponent } from './session-workspace.component';
import { WorkspaceStateService } from '@nx-platform-application/llm-features-workspace';
import { LlmSessionActions } from '@nx-platform-application/llm-domain-conversation';
import { LlmSessionSource } from '@nx-platform-application/llm-features-chat';

describe('LlmSessionWorkspaceComponent', () => {
  let component: LlmSessionWorkspaceComponent;
  let fixture: ComponentFixture<LlmSessionWorkspaceComponent>;

  // Vitest Mocks
  let mockWorkspaceState: any;
  let mockSessionActions: any;
  let mockSessionSource: any;

  beforeEach(async () => {
    // Setup pure signal-based mocks
    mockWorkspaceState = {
      overlayMap: signal(new Map()),
      conflictsMap: signal(new Map()),
      driftScore: signal(0),
      loadContent: vi.fn(),
    };

    mockSessionActions = {
      acceptProposal: vi.fn(),
      rejectProposal: vi.fn(),
    };

    mockSessionSource = {
      sessions: signal([]),
    };

    await TestBed.configureTestingModule({
      imports: [LlmSessionWorkspaceComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: WorkspaceStateService, useValue: mockWorkspaceState },
        { provide: LlmSessionActions, useValue: mockSessionActions },
        { provide: LlmSessionSource, useValue: mockSessionSource },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LlmSessionWorkspaceComponent);
    component = fixture.componentInstance;

    // Set required inputs
    fixture.componentRef.setInput('sessionId', 'urn:llm:session:123');
  });

  it('should generate sidebar files from the overlay map', async () => {
    const mockMap = new Map();
    mockMap.set('src/main.ts', {
      activeProposals: [{ id: 'p1' }],
      acceptedProposals: [],
    });
    mockMap.set('src/clean.ts', {
      activeProposals: [],
      acceptedProposals: [],
    });

    // Update the signal
    mockWorkspaceState.overlayMap.set(mockMap);

    // In zoneless, we await whenStable() or just call detectChanges() to flush
    await fixture.whenStable();

    const files = component.sidebarFiles();
    expect(files.length).toBe(1);
    expect(files[0].path).toBe('src/main.ts');
    expect(files[0].hasPendingProposals).toBe(true);
  });

  it('should request content load when a file is selected', () => {
    component.onSelectFile('src/main.ts');

    expect(component.selectedFilePath()).toBe('src/main.ts');
    expect(mockWorkspaceState.loadContent).toHaveBeenCalledWith('src/main.ts');
    expect(mockWorkspaceState.loadContent).toHaveBeenCalledTimes(1);
  });

  it('should disable commit button when conflicts exist', async () => {
    mockWorkspaceState.driftScore.set(1);
    mockWorkspaceState.conflictsMap.set(new Map([['src/main.ts', true]]));

    await fixture.whenStable();
    expect(component.canCommit()).toBe(false);

    mockWorkspaceState.conflictsMap.set(new Map([['src/main.ts', false]]));

    await fixture.whenStable();
    expect(component.canCommit()).toBe(true);
  });
});
