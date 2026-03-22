import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataSourcePageComponent } from './data-source-page.component';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { DataSourcesService } from '@nx-platform-application/data-sources/features/state';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {
  DataSourceBundle,
  FileMetadata,
  FilterProfile,
  SyncStreamEvent,
} from '@nx-platform-application/data-sources-types';
import { URN } from '@nx-platform-application/platform-types';
import { of } from 'rxjs';

describe('DataSourcePageComponent', () => {
  let component: DataSourcePageComponent;
  let fixture: ComponentFixture<DataSourcePageComponent>;
  let router: Router;

  const mockStateService = {
    activeDataSourceId: signal<URN | null>(null),
    activeDataSource: signal<DataSourceBundle | null>(null),
    activeProfiles: signal<FilterProfile[]>([]),
    activeFiles: signal<FileMetadata[]>([]),
    syncLogs: signal<SyncStreamEvent[]>([]),
    isActiveDataSourceLoading: signal(false),
    groupedDataSources: signal<Record<string, DataSourceBundle[]>>({}),
    clearSelection: vi.fn(),
    selectDataSource: vi.fn(),
    createDataSource: vi.fn(),
    executeSync: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataSourcePageComponent, BrowserAnimationsModule],
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

    fixture = TestBed.createComponent(DataSourcePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Routing Actions', () => {
    it('should navigate to the new dataSourceId when a different branch is selected', async () => {
      await component.onBranchChange('urn:ds:2');
      expect(router.navigate).toHaveBeenCalledWith([
        '/data-sources',
        'urn:ds:2',
      ]);
    });

    it('should prompt for a new branch and create it when NEW is selected', async () => {
      mockStateService.activeDataSource.set({
        id: URN.parse('urn:ds:1'),
        repo: 'org/repo',
        branch: 'main',
        status: 'ready',
        fileCount: 10,
        lastSyncedAt: 0,
      });
      vi.spyOn(window, 'prompt').mockReturnValue('feature-branch');
      mockStateService.createDataSource.mockResolvedValue(
        URN.parse('urn:ds:new-id'),
      );

      await component.onBranchChange('NEW');

      expect(window.prompt).toHaveBeenCalledWith(
        'Enter new branch name to track for org/repo:',
        'main',
      );
      expect(mockStateService.createDataSource).toHaveBeenCalledWith({
        repo: 'org/repo',
        branch: 'feature-branch',
      });
      expect(router.navigate).toHaveBeenCalledWith([
        '/data-sources',
        'urn:ds:new-id',
      ]);
    });
  });

  describe('Sync Execution', () => {
    it('should parse comma separated globs and execute sync', async () => {
      const dsUrn = URN.parse('urn:ds:1');
      mockStateService.activeDataSourceId.set(dsUrn);
      component.ingestionIncludes.set('**/*.go, **/*.ts');
      component.ingestionExcludes.set('vendor/**');

      await component.onExecuteSync();

      expect(mockStateService.executeSync).toHaveBeenCalledWith(dsUrn, {
        include: ['**/*.go', '**/*.ts'],
        exclude: ['vendor/**'],
      });
    });
  });
});
