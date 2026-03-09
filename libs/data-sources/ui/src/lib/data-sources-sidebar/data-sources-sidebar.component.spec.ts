import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataSourcesSidebarComponent } from './data-sources-sidebar.component';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { By } from '@angular/platform-browser';
import { DataSourcesService } from '@nx-platform-application/data-sources/features/state';
import { DataSourceBundle } from '@nx-platform-application/data-sources-types';
import { URN } from '@nx-platform-application/platform-types';

describe('DataSourcesSidebarComponent', () => {
  let component: DataSourcesSidebarComponent;
  let fixture: ComponentFixture<DataSourcesSidebarComponent>;

  const mockStateService = {
    loadAllDataSources: vi.fn(),
    isDataSourcesLoading: signal(false),
    caches: signal<DataSourceBundle[]>([]),
    groupedDataSources: signal<Record<string, DataSourceBundle[]>>({}),
    activeDataSource: signal<DataSourceBundle | null>(null),
  };

  beforeEach(async () => {
    mockStateService.isDataSourcesLoading.set(false);
    mockStateService.caches.set([]);
    mockStateService.groupedDataSources.set({});
    mockStateService.activeDataSource.set(null);
    mockStateService.loadAllDataSources.mockClear();

    await TestBed.configureTestingModule({
      imports: [DataSourcesSidebarComponent],
      providers: [
        provideRouter([]),
        { provide: DataSourcesService, useValue: mockStateService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DataSourcesSidebarComponent);
    component = fixture.componentInstance;
  });

  it('should call loadAllDataSources on instantiation', () => {
    expect(mockStateService.loadAllDataSources).toHaveBeenCalledTimes(1);
  });

  it('should display empty state when no data sources exist', () => {
    mockStateService.isDataSourcesLoading.set(false);
    fixture.detectChanges();

    const emptyEl = fixture.debugElement.nativeElement.textContent;
    expect(emptyEl).toContain('No repositories added yet.');
  });

  it('should group data sources by repository and show branch counts correctly', () => {
    mockStateService.groupedDataSources.set({
      'org/repo-A': [
        {
          id: URN.parse('urn:ds:1'),
          repo: 'org/repo-A',
          branch: 'main',
          fileCount: 10,
          lastSyncedAt: 2000,
          status: 'ready',
        } as DataSourceBundle,
        {
          id: URN.parse('urn:ds:2'),
          repo: 'org/repo-A',
          branch: 'dev',
          fileCount: 20,
          lastSyncedAt: 1000,
          status: 'ready',
        } as DataSourceBundle,
      ],
      'org/repo-B': [
        {
          id: URN.parse('urn:ds:3'),
          repo: 'org/repo-B',
          branch: 'master',
          fileCount: 5,
          lastSyncedAt: 0,
          status: 'unsynced',
        } as DataSourceBundle,
      ],
    });
    mockStateService.caches.set([{} as DataSourceBundle]);
    fixture.detectChanges();

    const links = fixture.debugElement.queryAll(By.css('a.cursor-pointer'));
    expect(links.length).toBe(2);

    // Repo A (Multiple branches: Should link to newest 'urn:ds:1' and show '2 branches')
    expect(links[0].attributes['ng-reflect-router-link']).toBe(
      '/data-sources,urn:ds:1',
    );
    expect(links[0].nativeElement.textContent).toContain('org/repo-A');
    expect(links[0].nativeElement.textContent).toContain('2 branches');

    // Repo B (Single branch)
    expect(links[1].attributes['ng-reflect-router-link']).toBe(
      '/data-sources,urn:ds:3',
    );
    expect(links[1].nativeElement.textContent).toContain('org/repo-B');
    expect(links[1].nativeElement.textContent).toContain('master');
    expect(links[1].nativeElement.textContent).toContain('Awaiting Sync');
  });

  it('should apply active styling when activeDataSource repo matches', () => {
    mockStateService.groupedDataSources.set({
      'org/repo-A': [
        {
          id: URN.parse('urn:ds:1'),
          repo: 'org/repo-A',
          branch: 'main',
          fileCount: 10,
          lastSyncedAt: 2000,
          status: 'ready',
        } as DataSourceBundle,
      ],
    });
    mockStateService.caches.set([{} as DataSourceBundle]);

    mockStateService.activeDataSource.set({
      repo: 'org/repo-A',
    } as DataSourceBundle);
    fixture.detectChanges();

    const link = fixture.debugElement.query(By.css('a.cursor-pointer'));
    expect(link.classes['bg-indigo-50']).toBeTruthy();
    expect(link.classes['border-indigo-200']).toBeTruthy();
  });
});
