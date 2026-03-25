import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { IngestionSidebarComponent } from './ingestion-sidebar.component';
import { DataSourcesService } from '@nx-platform-application/data-sources-features-state';
import { GithubIngestionTarget } from '@nx-platform-application/data-sources-types';
import { URN } from '@nx-platform-application/platform-types';

describe('IngestionSidebarComponent', () => {
  let component: IngestionSidebarComponent;
  let fixture: ComponentFixture<IngestionSidebarComponent>;

  const mockStateService = {
    isTargetsLoading: signal(false),
    githubTargets: signal<GithubIngestionTarget[]>([]),
    groupedTargets: signal<Record<string, GithubIngestionTarget[]>>({}),
    activeTarget: signal<GithubIngestionTarget | null>(null),
  };

  beforeEach(async () => {
    // Reset signals before each test
    mockStateService.isTargetsLoading.set(false);
    mockStateService.githubTargets.set([]);
    mockStateService.groupedTargets.set({});
    mockStateService.activeTarget.set(null);

    await TestBed.configureTestingModule({
      imports: [IngestionSidebarComponent],
      providers: [
        provideRouter([]),
        { provide: DataSourcesService, useValue: mockStateService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IngestionSidebarComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should display loading state when targets are loading', () => {
    mockStateService.isTargetsLoading.set(true);
    fixture.detectChanges();

    const textContent = fixture.debugElement.nativeElement.textContent;
    expect(textContent).toContain('Loading repositories...');
  });

  it('should display empty state when no repositories exist', () => {
    mockStateService.isTargetsLoading.set(false);
    mockStateService.githubTargets.set([]);
    fixture.detectChanges();

    const textContent = fixture.debugElement.nativeElement.textContent;
    expect(textContent).toContain('No repositories connected.');
  });

  it('should group targets by repository and show branch counts correctly', () => {
    mockStateService.groupedTargets.set({
      'tinywideclouds/repo-A': [
        {
          id: URN.parse('urn:ingestiontarget:1'),
          repo: 'tinywideclouds/repo-A',
          branch: 'main',
          fileCount: 10,
          lastSyncedAt: '2026-03-24T10:00:00.000Z',
          status: 'ready',
        } as GithubIngestionTarget,
        {
          id: URN.parse('urn:ingestiontarget:2'),
          repo: 'tinywideclouds/repo-A',
          branch: 'dev',
          fileCount: 20,
          lastSyncedAt: '2026-03-23T10:00:00.000Z',
          status: 'ready',
        } as GithubIngestionTarget,
      ],
      'tinywideclouds/repo-B': [
        {
          id: URN.parse('urn:ingestiontarget:3'),
          repo: 'tinywideclouds/repo-B',
          branch: 'master',
          fileCount: 5,
          lastSyncedAt: '', // Unsynced
          status: 'unsynced',
        } as GithubIngestionTarget,
      ],
    });
    // Set at least one target to bypass the empty state check
    mockStateService.githubTargets.set([{} as GithubIngestionTarget]);
    fixture.detectChanges();

    const links = fixture.debugElement.queryAll(By.css('a.cursor-pointer'));
    expect(links.length).toBe(2);

    // Repo A (Multiple branches: Should link to newest 'urn:ingestiontarget:1' and show '2 branches')
    expect(links[0].attributes['ng-reflect-router-link']).toBe(
      '/data-sources/repos,urn:ingestiontarget:1',
    );
    expect(links[0].nativeElement.textContent).toContain(
      'tinywideclouds/repo-A',
    );
    expect(links[0].nativeElement.textContent).toContain('2 branches');

    // Repo B (Single branch)
    expect(links[1].attributes['ng-reflect-router-link']).toBe(
      '/data-sources/repos,urn:ingestiontarget:3',
    );
    expect(links[1].nativeElement.textContent).toContain(
      'tinywideclouds/repo-B',
    );
    expect(links[1].nativeElement.textContent).toContain('master');
    expect(links[1].nativeElement.textContent).toContain('unsynced');
  });

  it('should apply active styling when activeTarget repo matches', () => {
    mockStateService.groupedTargets.set({
      'tinywideclouds/repo-A': [
        {
          id: URN.parse('urn:ingestiontarget:1'),
          repo: 'tinywideclouds/repo-A',
          branch: 'main',
          status: 'ready',
        } as GithubIngestionTarget,
      ],
    });
    mockStateService.githubTargets.set([{} as GithubIngestionTarget]);

    // Set the active target to trigger the active class
    mockStateService.activeTarget.set({
      repo: 'tinywideclouds/repo-A',
    } as GithubIngestionTarget);
    fixture.detectChanges();

    const link = fixture.debugElement.query(By.css('a.cursor-pointer'));
    expect(link.classes['bg-gray-100']).toBeTruthy();
    expect(link.classes['border-gray-300']).toBeTruthy();
  });
});
