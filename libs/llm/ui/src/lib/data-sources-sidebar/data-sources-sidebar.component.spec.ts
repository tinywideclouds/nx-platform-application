import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LlmDataSourcesSidebarComponent } from './data-sources-sidebar.component';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { By } from '@angular/platform-browser';
import { LlmDataSourcesStateService } from '@nx-platform-application/llm-features-data-sources';
import { CacheBundle } from '@nx-platform-application/llm-types';

describe('LlmDataSourcesSidebarComponent', () => {
  let component: LlmDataSourcesSidebarComponent;
  let fixture: ComponentFixture<LlmDataSourcesSidebarComponent>;

  // Strict Mock of the State Service including new signals
  const mockStateService = {
    loadAllCaches: vi.fn(),
    isCachesLoading: signal(false),
    caches: signal<CacheBundle[]>([]),
    groupedCaches: signal<Record<string, CacheBundle[]>>({}),
    activeCache: signal<CacheBundle | null>(null),
  };

  beforeEach(async () => {
    // Reset signals before each test
    mockStateService.isCachesLoading.set(false);
    mockStateService.caches.set([]);
    mockStateService.groupedCaches.set({});
    mockStateService.activeCache.set(null);
    mockStateService.loadAllCaches.mockClear();

    await TestBed.configureTestingModule({
      imports: [LlmDataSourcesSidebarComponent],
      providers: [
        provideRouter([]),
        { provide: LlmDataSourcesStateService, useValue: mockStateService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LlmDataSourcesSidebarComponent);
    component = fixture.componentInstance;
  });

  it('should call loadAllCaches on instantiation', () => {
    expect(mockStateService.loadAllCaches).toHaveBeenCalledTimes(1);
  });

  it('should display empty state when no caches exist', () => {
    mockStateService.isCachesLoading.set(false);
    fixture.detectChanges();

    const emptyEl = fixture.debugElement.nativeElement.textContent;
    expect(emptyEl).toContain('No repositories added yet.');
  });

  it('should group caches by repository and show branch counts correctly', () => {
    mockStateService.groupedCaches.set({
      'org/repo-A': [
        {
          id: 'c-1',
          repo: 'org/repo-A',
          branch: 'main',
          fileCount: 10,
          lastSyncedAt: 2000,
          status: 'ready',
        } as CacheBundle,
        {
          id: 'c-2',
          repo: 'org/repo-A',
          branch: 'dev',
          fileCount: 20,
          lastSyncedAt: 1000,
          status: 'ready',
        } as CacheBundle,
      ],
      'org/repo-B': [
        {
          id: 'c-3',
          repo: 'org/repo-B',
          branch: 'master',
          fileCount: 5,
          lastSyncedAt: 0,
          status: 'unsynced',
        } as CacheBundle,
      ],
    });
    // Add fake array so the empty state check passes
    mockStateService.caches.set([{} as CacheBundle]);
    fixture.detectChanges();

    const links = fixture.debugElement.queryAll(By.css('a.cursor-pointer'));
    expect(links.length).toBe(2);

    // Repo A (Multiple branches: Should link to newest 'c-1' and show '2 branches')
    expect(links[0].attributes['ng-reflect-router-link']).toBe(
      '/data-sources,c-1',
    );
    expect(links[0].nativeElement.textContent).toContain('org/repo-A');
    expect(links[0].nativeElement.textContent).toContain('2 branches');

    // Repo B (Single branch: Should link to 'c-3' and show 'master' and 'Unsynced')
    expect(links[1].attributes['ng-reflect-router-link']).toBe(
      '/data-sources,c-3',
    );
    expect(links[1].nativeElement.textContent).toContain('org/repo-B');
    expect(links[1].nativeElement.textContent).toContain('master');
    expect(links[1].nativeElement.textContent).toContain('Awaiting Sync');
  });

  it('should apply active styling when activeCache repo matches', () => {
    mockStateService.groupedCaches.set({
      'org/repo-A': [
        {
          id: 'c-1',
          repo: 'org/repo-A',
          branch: 'main',
          fileCount: 10,
          lastSyncedAt: 2000,
          status: 'ready',
        } as CacheBundle,
      ],
    });
    mockStateService.caches.set([{} as CacheBundle]);

    // Simulate that we are currently viewing 'org/repo-A'
    mockStateService.activeCache.set({ repo: 'org/repo-A' } as CacheBundle);
    fixture.detectChanges();

    const link = fixture.debugElement.query(By.css('a.cursor-pointer'));
    expect(link.classes['bg-indigo-50']).toBeTruthy();
    expect(link.classes['border-indigo-200']).toBeTruthy();
  });
});
