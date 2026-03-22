import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataSourcesSidebarComponent } from './data-sources-sidebar.component';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { By } from '@angular/platform-browser';
import { DataSourcesService } from '@nx-platform-application/data-sources-features-state';
import {
  IngestionTarget,
  DataGroup,
} from '@nx-platform-application/data-sources-types';
import { URN } from '@nx-platform-application/platform-types';

describe('DataSourcesSidebarComponent', () => {
  let component: DataSourcesSidebarComponent;
  let fixture: ComponentFixture<DataSourcesSidebarComponent>;

  const mockStateService = {
    loadAllTargets: vi.fn(),
    loadAllDataGroups: vi.fn(),
    isTargetsLoading: signal(false),
    isDataGroupsLoading: signal(false),
    targets: signal<IngestionTarget[]>([]),
    dataGroups: signal<DataGroup[]>([]),
    groupedTargets: signal<Record<string, IngestionTarget[]>>({}),
    activeTarget: signal<IngestionTarget | null>(null),
    activeDataGroupId: signal<URN | null>(null),
  };

  beforeEach(async () => {
    mockStateService.isTargetsLoading.set(false);
    mockStateService.targets.set([]);
    mockStateService.groupedTargets.set({});
    mockStateService.activeTarget.set(null);
    mockStateService.loadAllTargets.mockClear();

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

  it('should call loadAllTargets on instantiation', () => {
    expect(mockStateService.loadAllTargets).toHaveBeenCalledTimes(1);
    expect(mockStateService.loadAllDataGroups).toHaveBeenCalledTimes(1);
  });

  it('should display empty state when no targets exist', () => {
    mockStateService.isTargetsLoading.set(false);
    fixture.detectChanges();

    const emptyEl = fixture.debugElement.nativeElement.textContent;
    expect(emptyEl).toContain('No repositories added yet.');
  });

  it('should group targets by repository and show branch counts correctly', () => {
    mockStateService.groupedTargets.set({
      'org/repo-A': [
        {
          id: URN.parse('urn:ingestiontarget:1'),
          repo: 'org/repo-A',
          branch: 'main',
          fileCount: 10,
          lastSyncedAt: 2000,
          status: 'ready',
        } as IngestionTarget,
        {
          id: URN.parse('urn:ingestiontarget:2'),
          repo: 'org/repo-A',
          branch: 'dev',
          fileCount: 20,
          lastSyncedAt: 1000,
          status: 'ready',
        } as IngestionTarget,
      ],
      'org/repo-B': [
        {
          id: URN.parse('urn:ingestiontarget:3'),
          repo: 'org/repo-B',
          branch: 'master',
          fileCount: 5,
          lastSyncedAt: 0,
          status: 'unsynced',
        } as IngestionTarget,
      ],
    });
    mockStateService.targets.set([{} as IngestionTarget]);
    fixture.detectChanges();

    const links = fixture.debugElement.queryAll(By.css('a.cursor-pointer'));
    expect(links.length).toBe(2);

    // Repo A (Multiple branches: Should link to newest 'urn:ds:1' and show '2 branches')
    expect(links[0].attributes['ng-reflect-router-link']).toBe(
      '/data-sources/repos,urn:ingestiontarget:1',
    );
    expect(links[0].nativeElement.textContent).toContain('org/repo-A');
    expect(links[0].nativeElement.textContent).toContain('2 branches');

    // Repo B (Single branch)
    expect(links[1].attributes['ng-reflect-router-link']).toBe(
      '/data-sources/repos,urn:ingestiontarget:3',
    );
    expect(links[1].nativeElement.textContent).toContain('org/repo-B');
    expect(links[1].nativeElement.textContent).toContain('master');
    expect(links[1].nativeElement.textContent).toContain('Awaiting Sync');
  });

  it('should apply active styling when activeTarget repo matches', () => {
    mockStateService.groupedTargets.set({
      'org/repo-A': [
        {
          id: URN.parse('urn:ingestiontarget:1'),
          repo: 'org/repo-A',
          branch: 'main',
          fileCount: 10,
          lastSyncedAt: 2000,
          status: 'ready',
        } as IngestionTarget,
      ],
    });
    mockStateService.targets.set([{} as IngestionTarget]);

    mockStateService.activeTarget.set({
      repo: 'org/repo-A',
    } as IngestionTarget);
    fixture.detectChanges();

    const link = fixture.debugElement.query(By.css('a.cursor-pointer'));
    expect(link.classes['bg-indigo-50']).toBeTruthy();
    expect(link.classes['border-indigo-200']).toBeTruthy();
  });
});
