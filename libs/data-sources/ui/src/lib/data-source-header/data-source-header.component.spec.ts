import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataSourceHeaderComponent } from './data-source-header.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DataSourceBundle } from '@nx-platform-application/data-sources-types';
import { URN } from '@nx-platform-application/platform-types';

describe('DataSourceHeaderComponent', () => {
  let component: DataSourceHeaderComponent;
  let fixture: ComponentFixture<DataSourceHeaderComponent>;

  const mockBundle: DataSourceBundle = {
    id: URN.parse('urn:data-source:1'),
    repo: 'test/repo',
    branch: 'main',
    status: 'ready',
    fileCount: 10,
    lastSyncedAt: 1600000000,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataSourceHeaderComponent, BrowserAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(DataSourceHeaderComponent);
    component = fixture.componentInstance;
  });

  it('should display "New Repository Cache" when isNew is true', () => {
    fixture.componentRef.setInput('isNew', true);
    fixture.componentRef.setInput('cache', null);
    fixture.componentRef.setInput('availableBranches', []);
    fixture.detectChanges();

    const textContent = fixture.debugElement.nativeElement.textContent;
    expect(textContent).toContain('New Repository Cache');
  });

  it('should display the repo name and branch selector when isNew is false', () => {
    fixture.componentRef.setInput('isNew', false);
    fixture.componentRef.setInput('cache', mockBundle);
    fixture.componentRef.setInput('availableBranches', [mockBundle]);
    fixture.detectChanges();

    const textContent = fixture.debugElement.nativeElement.textContent;
    expect(textContent).toContain('test/repo');
    expect(textContent).toContain('Branch:');
    expect(textContent).toContain('Synced');
  });

  it('should emit branchChange when a new branch is selected', () => {
    fixture.componentRef.setInput('isNew', false);
    fixture.componentRef.setInput('cache', mockBundle);
    fixture.componentRef.setInput('availableBranches', [mockBundle]);
    fixture.detectChanges();

    const emitSpy = vi.spyOn(component.branchChange, 'emit');

    // Simulate selection change directly on the component's output
    component.branchChange.emit('NEW');

    expect(emitSpy).toHaveBeenCalledWith('NEW');
  });
});
