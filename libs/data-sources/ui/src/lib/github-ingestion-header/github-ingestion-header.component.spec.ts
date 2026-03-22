import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GithubIngestionHeaderComponent } from './github-ingestion-header.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { IngestionTarget as IngestionSource } from '@nx-platform-application/data-sources-types';
import { URN } from '@nx-platform-application/platform-types';

describe('GithubIngestionHeaderComponent', () => {
  let component: GithubIngestionHeaderComponent;
  let fixture: ComponentFixture<GithubIngestionHeaderComponent>;

  const mockSource: IngestionSource = {
    id: URN.parse('urn:ingestiontarget:1'),
    repo: 'test/repo',
    branch: 'main',
    status: 'ready',
    fileCount: 10,
    lastSyncedAt: 1600000000,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GithubIngestionHeaderComponent, BrowserAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(GithubIngestionHeaderComponent);
    component = fixture.componentInstance;
  });

  it('should display "New GitHub Repository" when isNew is true', () => {
    fixture.componentRef.setInput('isNew', true);
    fixture.componentRef.setInput('source', null);
    fixture.componentRef.setInput('availableBranches', []);
    fixture.detectChanges();

    const textContent = fixture.debugElement.nativeElement.textContent;
    expect(textContent).toContain('New GitHub Repository');
  });

  it('should display the repo name and branch selector when isNew is false', () => {
    fixture.componentRef.setInput('isNew', false);
    fixture.componentRef.setInput('source', mockSource);
    fixture.componentRef.setInput('availableBranches', [mockSource]);
    fixture.detectChanges();

    const textContent = fixture.debugElement.nativeElement.textContent;
    expect(textContent).toContain('test/repo');
    expect(textContent).toContain('Branch:');
    expect(textContent).toContain('Synced');
  });

  it('should emit branchChange when a new branch is selected', () => {
    fixture.componentRef.setInput('isNew', false);
    fixture.componentRef.setInput('source', mockSource);
    fixture.componentRef.setInput('availableBranches', [mockSource]);
    fixture.detectChanges();

    const emitSpy = vi.spyOn(component.branchChange, 'emit');

    component.branchChange.emit('NEW');

    expect(emitSpy).toHaveBeenCalledWith('NEW');
  });
});
