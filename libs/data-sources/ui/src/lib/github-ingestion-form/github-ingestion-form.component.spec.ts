import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GithubIngestionFormComponent } from './github-ingestion-form.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';
import { IngestionTarget as IngestionSource } from '@nx-platform-application/data-sources-types';

describe('GithubIngestionFormComponent', () => {
  let component: GithubIngestionFormComponent;
  let fixture: ComponentFixture<GithubIngestionFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GithubIngestionFormComponent, BrowserAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(GithubIngestionFormComponent);
    component = fixture.componentInstance;
  });

  it('should enforce validation rules when creating a new ingestion source', () => {
    fixture.componentRef.setInput('isNew', true);
    fixture.detectChanges();

    // Initial state: empty repo, branch defaults to 'main'
    expect(component.totalErrors()).toBe(1);
    expect(component.repoError()).toBe('Repository is required');

    // Invalid repo format
    component.repo.set('angular');
    expect(component.repoError()).toBe('Must be in owner/repo format');

    // Valid repo format
    component.repo.set('angular/angular');
    expect(component.repoError()).toBeNull();
    expect(component.totalErrors()).toBe(0);

    // Invalid branch
    component.branch.set('   ');
    expect(component.branchError()).toBe('Branch is required');
  });

  it('should emit saveSource when triggerSave is called and the form is valid', () => {
    fixture.componentRef.setInput('isNew', true);
    component.repo.set('test/repo');
    component.branch.set('main');
    fixture.detectChanges();

    const emitSpy = vi.spyOn(component.saveSource, 'emit');
    component.triggerSave();

    expect(emitSpy).toHaveBeenCalledWith({ repo: 'test/repo', branch: 'main' });
  });

  it('should populate draft state when an existing ingestion source is provided and ignore validation', () => {
    const mockSource: IngestionSource = {
      id: URN.parse('urn:ingestiontarget:1'),
      repo: 'existing/repo',
      branch: 'dev',
      lastSyncedAt: 0,
      fileCount: 0,
      status: 'ready',
    };

    fixture.componentRef.setInput('isNew', false);
    fixture.componentRef.setInput('source', mockSource);
    fixture.detectChanges();

    expect(component.repo()).toBe('existing/repo');
    expect(component.branch()).toBe('dev');

    // Existing sources shouldn't bubble up validation errors to block the UI
    expect(component.totalErrors()).toBe(0);
  });
});
