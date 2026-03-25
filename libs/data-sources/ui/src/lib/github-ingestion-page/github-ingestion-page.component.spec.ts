import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GithubIngestionPageComponent } from './github-ingestion-page.component';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { DataSourcesService } from '@nx-platform-application/data-sources-features-state';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {
  GithubIngestionTarget,
  FileMetadata,
  SyncStreamEvent,
} from '@nx-platform-application/data-sources-types';
import { URN } from '@nx-platform-application/platform-types';
import { of } from 'rxjs';

describe('GithubIngestionPageComponent', () => {
  let component: GithubIngestionPageComponent;
  let fixture: ComponentFixture<GithubIngestionPageComponent>;
  let router: Router;

  const mockStateService = {
    activeTargetId: signal<URN | null>(null),
    activeTarget: signal<GithubIngestionTarget | null>(null),
    activeFiles: signal<FileMetadata[]>([]),
    syncLogs: signal<SyncStreamEvent[]>([]),
    isActiveTargetLoading: signal(false),
    groupedTargets: signal<Record<string, GithubIngestionTarget[]>>({}),
    clearSelection: vi.fn(),
    selectTarget: vi.fn(),
    createGithubTarget: vi.fn(),
    executeSync: vi.fn(),
    checkRemoteTrackingState: vi.fn(), // ADDED missing mock
    updateTrackingState: vi.fn(), // ADDED missing mock
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GithubIngestionPageComponent, BrowserAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: DataSourcesService, useValue: mockStateService },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(new Map([['id', 'new']])) },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockImplementation(async () => true);

    fixture = TestBed.createComponent(GithubIngestionPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Sync Execution Filters', () => {
    it('should merge visual tree rules and manual override globs together on sync', async () => {
      const targetUrn = URN.parse('urn:datasource:target:1');
      mockStateService.activeTargetId.set(targetUrn);

      component.visualRules.set({ include: ['**/*'], exclude: ['docs/**'] });
      component.manualIncludes.set('**/*.ts, **/*.go');
      component.manualExcludes.set('vendor/**, node_modules/**');

      await component.onExecuteSync();

      expect(mockStateService.executeSync).toHaveBeenCalledWith(targetUrn, {
        include: ['**/*', '**/*.ts', '**/*.go'],
        exclude: ['docs/**', 'vendor/**', 'node_modules/**'],
      });
    });
  });
});
