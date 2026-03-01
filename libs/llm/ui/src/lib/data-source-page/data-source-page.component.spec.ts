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
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LlmDataSourcePageComponent, BrowserAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: LlmDataSourcesStateService, useValue: mockStateService },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(new Map([['id', 'new']])) },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockImplementation(async () => true);

    fixture = TestBed.createComponent(LlmDataSourcePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Routing Actions', () => {
    it('should navigate to the new cacheId when a different branch is selected', async () => {
      await component.onBranchChange('c-2');
      expect(router.navigate).toHaveBeenCalledWith(['/data-sources', 'c-2']);
    });

    it('should prompt for a new branch and create it when NEW is selected', async () => {
      mockStateService.activeCache.set({
        id: 'c-1',
        repo: 'org/repo',
        branch: 'main',
        status: 'ready',
        fileCount: 10,
        lastSyncedAt: 0,
      });
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
