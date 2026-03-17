import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LlmMemorySidebarComponent } from './memory-sidebar.component';
import { signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { URN } from '@nx-platform-application/platform-types';
import { LlmDigestSource } from '@nx-platform-application/llm-features-memory';
import { LlmDigestService } from '@nx-platform-application/llm-domain-digests';
import {
  StandardPrompt,
  ArchitecturalPrompt,
} from '@nx-platform-application/llm-domain-digests';

describe('LlmMemorySidebarComponent', () => {
  let component: LlmMemorySidebarComponent;
  let fixture: ComponentFixture<LlmMemorySidebarComponent>;

  const mockDigests = [
    {
      id: URN.parse('urn:llm:digest:1'),
      typeId: StandardPrompt,
      startTime: '2026-03-15T10:00:00Z',
      coveredMessageIds: [],
    },
    {
      id: URN.parse('urn:llm:digest:2'),
      typeId: ArchitecturalPrompt,
      startTime: '2026-03-16T10:00:00Z',
      coveredMessageIds: [],
    },
  ];

  const mockSource = {
    digests: signal(mockDigests),
    refresh: vi.fn(),
  };

  const mockDigestService = {
    deleteDigest: vi.fn().mockResolvedValue(undefined),
  };

  const mockDialogRef = { afterClosed: vi.fn() };
  const mockDialog = { open: vi.fn().mockReturnValue(mockDialogRef) };

  const mockSnackBar = { open: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [LlmMemorySidebarComponent],
      providers: [
        { provide: LlmDigestSource, useValue: mockSource },
        { provide: LlmDigestService, useValue: mockDigestService },
        { provide: MatDialog, useValue: mockDialog },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LlmMemorySidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should filter digests based on activeFilter', () => {
    // Default is ALL
    expect(component.filteredDigests().length).toBe(2);

    // Filter to Architectural only
    component.activeFilter.set(ArchitecturalPrompt.toString());
    expect(component.filteredDigests().length).toBe(1);
    expect(component.filteredDigests()[0].id.toString()).toBe(
      'urn:llm:digest:2',
    );
  });

  it('should sort digests with newest (most recent startTime) at the top', () => {
    // Digest 2 is newer (March 16 vs March 15)
    expect(component.filteredDigests()[0].id.toString()).toBe(
      'urn:llm:digest:2',
    );
  });

  it('should toggle edit mode and clear selection', () => {
    component.selectedForDeletion.set(new Set(['urn:llm:digest:1']));
    component.toggleEditMode();

    expect(component.isEditMode()).toBe(true);
    expect(component.selectedForDeletion().size).toBe(0); // Cleared on toggle
  });

  it('should emit selectDigest when clicked in normal mode', () => {
    const emitSpy = vi.spyOn(component.selectDigest, 'emit');
    component.onDigestClick(URN.parse('urn:llm:digest:1'));

    expect(emitSpy).toHaveBeenCalledWith(URN.parse('urn:llm:digest:1'));
  });

  it('should add/remove to deletion set when clicked in edit mode', () => {
    component.isEditMode.set(true);

    // Select
    component.onDigestClick(URN.parse('urn:llm:digest:1'));
    expect(component.selectedForDeletion().has('urn:llm:digest:1')).toBe(true);

    // Deselect
    component.onDigestClick(URN.parse('urn:llm:digest:1'));
    expect(component.selectedForDeletion().has('urn:llm:digest:1')).toBe(false);
  });

  it('should call domain service to delete when confirmed', async () => {
    component.isEditMode.set(true);
    component.selectedForDeletion.set(new Set(['urn:llm:digest:1']));

    // Simulate user confirming dialog
    mockDialogRef.afterClosed.mockReturnValue(of(true));

    component.confirmDelete();

    // Await the microtasks to let the subscribe block execute
    await new Promise(process.nextTick);

    expect(mockDigestService.deleteDigest).toHaveBeenCalledWith(
      URN.parse('urn:llm:digest:1'),
    );
    expect(mockSource.refresh).toHaveBeenCalled();
    expect(component.isEditMode()).toBe(false);
  });
});
