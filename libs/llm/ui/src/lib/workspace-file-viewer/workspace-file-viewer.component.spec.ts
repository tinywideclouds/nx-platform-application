import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';

import { LlmWorkspaceFileViewerComponent } from './workspace-file-viewer.component';

describe('LlmWorkspaceFileViewerComponent', () => {
  let component: LlmWorkspaceFileViewerComponent;
  let fixture: ComponentFixture<LlmWorkspaceFileViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LlmWorkspaceFileViewerComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(LlmWorkspaceFileViewerComponent);
    component = fixture.componentInstance;
  });

  it('should render empty state when no file is selected', async () => {
    fixture.componentRef.setInput('filePath', null);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain(
      'Select a file to review',
    );
  });

  it('should render the code block with displayContent', async () => {
    fixture.componentRef.setInput('filePath', 'src/main.ts');
    fixture.componentRef.setInput('displayContent', 'const x = 1;');
    await fixture.whenStable();

    const pre = fixture.debugElement.query(By.css('pre'));
    expect(pre.nativeElement.textContent).toBe('const x = 1;');
  });

  it('should render proposal toggles and emit selection', async () => {
    const mockProposals = [
      { id: 'prop-1', filePath: 'src/main.ts', status: 'pending' } as any,
      { id: 'prop-2', filePath: 'src/main.ts', status: 'pending' } as any,
    ];

    fixture.componentRef.setInput('filePath', 'src/main.ts');
    fixture.componentRef.setInput('activeProposals', mockProposals);
    await fixture.whenStable();

    let emittedView: string | null = 'not-emitted';
    component.previewSelected.subscribe((val) => (emittedView = val));

    const toggleGroup = fixture.debugElement.query(
      By.css('mat-button-toggle-group'),
    );
    toggleGroup.triggerEventHandler('change', { value: 'prop-1' });

    expect(emittedView).toBe('prop-1');
  });

  it('should show accept/reject buttons when a proposal is selected and emit on click', async () => {
    const mockProposals = [
      { id: 'prop-1', filePath: 'src/main.ts', status: 'pending' } as any,
    ];

    fixture.componentRef.setInput('filePath', 'src/main.ts');
    fixture.componentRef.setInput('activeProposals', mockProposals);
    fixture.componentRef.setInput('selectedProposalId', 'prop-1');
    await fixture.whenStable();

    let acceptedId = '';
    component.acceptProposal.subscribe((id) => (acceptedId = id));

    const acceptBtn = fixture.debugElement.query(
      By.css('button[color="primary"]'),
    );
    acceptBtn.triggerEventHandler('click', null);

    expect(acceptedId).toBe('prop-1');
  });
});
