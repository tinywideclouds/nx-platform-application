import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LlmDataSourcePageComponent } from './data-source-page.component';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { LlmDataSourcesStateService } from '@nx-platform-application/llm-features-data-sources';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {
  CacheBundle,
  FileMetadata,
  FilterProfile,
  SyncStreamEvent,
} from '@nx-platform-application/llm-types';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

describe('LlmDataSourcePageComponent', () => {
  let component: LlmDataSourcePageComponent;
  let fixture: ComponentFixture<LlmDataSourcePageComponent>;
  let router: Router;

  // Mock State
  const mockStateService = {
    activeCacheId: signal<string | null>(null),
    activeCache: signal<CacheBundle | null>(null),
    activeProfiles: signal<FilterProfile[]>([]),
    activeFiles: signal<FileMetadata[]>([]),
    syncLogs: signal<SyncStreamEvent[]>([]),
    isActiveCacheLoading: signal(false),
    groupedCaches: signal<Record<string, CacheBundle[]>>({}),
    clearSelection: vi.fn(),
    selectCache: vi.fn(),
    createCache: vi.fn(),
    executeSync: vi.fn(),
    saveProfile: vi.fn(),
    deleteProfile: vi.fn(),
  };

  const mockDialog = {
    open: vi.fn().mockReturnValue({ afterClosed: () => of(true) }),
  };

  const mockActivatedRoute = {
    paramMap: of({ get: () => 'cache-1' }),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [LlmDataSourcePageComponent, BrowserAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: LlmDataSourcesStateService, useValue: mockStateService },
        { provide: MatDialog, useValue: mockDialog },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockImplementation(async () => true);

    fixture = TestBed.createComponent(LlmDataSourcePageComponent);
    component = fixture.componentInstance;
  });

  describe('Route Handling', () => {
    it('should call selectCache when an ID is provided', () => {
      fixture.detectChanges();
      expect(mockStateService.selectCache).toHaveBeenCalledWith('cache-1');
      expect(component.isNew()).toBe(false);
    });

    it('should show the Unsynced Analysis block when status is unsynced', () => {
      mockStateService.activeCache.set({
        id: 'cache-1',
        repo: 'org/repo',
        branch: 'main',
        status: 'unsynced',
        analysis: { totalFiles: 1500, totalSizeBytes: 1048576, extensions: {} },
      } as CacheBundle);
      fixture.detectChanges();

      const textContent = fixture.debugElement.nativeElement.textContent;
      // Note: Because formatBytes is now in the child component, we simply verify the
      // parent component orchestrates the template and renders the title
      expect(textContent).toContain('Ready for First Sync');
    });

    it('should show the Syncing Terminal block when status is syncing', () => {
      mockStateService.activeCache.set({
        id: 'cache-1',
        status: 'syncing',
      } as CacheBundle);
      mockStateService.syncLogs.set([
        { stage: 'GitHub', details: { message: 'Fetching...' } },
      ]);
      fixture.detectChanges();

      const textContent = fixture.debugElement.nativeElement.textContent;
      expect(textContent).toContain('Sync Execution Stream');
      expect(textContent).toContain('[GITHUB]');
      expect(textContent).toContain('Fetching...');
    });
  });

  describe('Branch Switcher', () => {
    beforeEach(() => {
      mockStateService.activeCache.set({
        id: 'c-1',
        repo: 'org/repo',
        branch: 'main',
        status: 'ready',
      } as CacheBundle);
      mockStateService.groupedCaches.set({
        'org/repo': [
          {
            id: 'c-1',
            repo: 'org/repo',
            branch: 'main',
            status: 'ready',
          } as CacheBundle,
          {
            id: 'c-2',
            repo: 'org/repo',
            branch: 'dev',
            status: 'ready',
          } as CacheBundle,
        ],
      });
      fixture.detectChanges();
    });

    it('should compute available branches for the active repo', () => {
      expect(component.availableBranches().length).toBe(2);
      expect(component.availableBranches()[1].id).toBe('c-2');
    });

    it('should navigate to the new cacheId when a different branch is selected', async () => {
      await component.onBranchChange('c-2');
      expect(router.navigate).toHaveBeenCalledWith(['/data-sources', 'c-2']);
    });

    it('should prompt for a new branch and create it when NEW is selected', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue('feature-branch');
      mockStateService.createCache.mockResolvedValue('new-cache-id');

      await component.onBranchChange('NEW');

      expect(window.prompt).toHaveBeenCalledWith(
        'Enter new branch name to track for org/repo:',
        'main',
      );
      expect(mockStateService.createCache).toHaveBeenCalledWith({
        repo: 'org/repo',
        branch: 'feature-branch',
      });
      expect(router.navigate).toHaveBeenCalledWith([
        '/data-sources',
        'new-cache-id',
      ]);
    });
  });

  describe('Sync Execution', () => {
    it('should parse comma separated globs and execute sync', async () => {
      mockStateService.activeCacheId.set('cache-1');
      component.ingestionIncludes.set('**/*.go, **/*.ts');
      component.ingestionExcludes.set('vendor/**');

      await component.onExecuteSync();

      expect(mockStateService.executeSync).toHaveBeenCalledWith('cache-1', {
        include: ['**/*.go', '**/*.ts'],
        exclude: ['vendor/**'],
      });
    });
  });
});
