import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LlmProposalBubbleComponent } from './proposal-bubble.component';
import { SSEProposalEvent } from '@nx-platform-application/llm-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ISODateTimeString } from '@nx-platform-application/platform-types';

describe('LlmProposalBubbleComponent', () => {
  let component: LlmProposalBubbleComponent;
  let fixture: ComponentFixture<LlmProposalBubbleComponent>;

  const mockPatch = `--- a/main.ts
+++ b/main.ts
@@ -1,3 +1,4 @@
 function add(a, b) {
-  return a - b;
+  return a + b;
 }`;

  const mockEvent: SSEProposalEvent = {
    originalContent: 'function add(a, b) {\n  return a - b;\n}',
    proposal: {
      id: 'prop-1',
      sessionId: 'sess-1',
      filePath: 'main.ts',
      patch: mockPatch,
      reasoning: 'Fixed addition logic',
      status: 'pending',
      createdAt: '2026-02-27T10:00:00Z' as ISODateTimeString,
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LlmProposalBubbleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LlmProposalBubbleComponent);
    component = fixture.componentInstance;

    // Set required input
    fixture.componentRef.setInput('event', mockEvent);
    fixture.detectChanges();
  });

  it('should default to preview mode and extract a clean code snippet', () => {
    expect(component.viewMode()).toBe('preview');

    const displayedCode = component.displayCode();

    // Should NOT contain diff metadata
    expect(displayedCode).not.toContain('--- a/main.ts');
    expect(displayedCode).not.toContain('@@ -1,3');

    // Should NOT contain removed lines
    expect(displayedCode).not.toContain('return a - b;');

    // SHOULD contain context and added lines cleanly
    expect(displayedCode).toContain('function add(a, b) {\n  return a + b;\n}');
  });

  it('should switch to diff mode and show the raw patch', () => {
    component.viewMode.set('diff');
    fixture.detectChanges();

    const displayedCode = component.displayCode();
    expect(displayedCode).toBe(mockPatch);
  });

  it('should fallback to truncating newContent if no patch is provided', () => {
    fixture.componentRef.setInput('event', {
      ...mockEvent,
      proposal: {
        ...mockEvent.proposal,
        patch: undefined,
        newContent: Array(20).fill('line').join('\n'), // 20 lines of code
      },
    });
    fixture.detectChanges();

    const displayedCode = component.displayCode();

    // Should truncate at 15 lines and append warning
    const lines = displayedCode.split('\n');
    expect(lines.length).toBeLessThan(20);
    expect(displayedCode).toContain(
      'File truncated. Open Workspace to view full file',
    );
  });

  it('should emit the proposal ID when action buttons are clicked', () => {
    const acceptSpy = vi.spyOn(component.accept, 'emit');
    const rejectSpy = vi.spyOn(component.reject, 'emit');
    const workspaceSpy = vi.spyOn(component.openWorkspace, 'emit');

    component.accept.emit(component.proposal().id);
    component.reject.emit(component.proposal().id);
    component.openWorkspace.emit(component.proposal().id);

    expect(acceptSpy).toHaveBeenCalledWith('prop-1');
    expect(rejectSpy).toHaveBeenCalledWith('prop-1');
    expect(workspaceSpy).toHaveBeenCalledWith('prop-1');
  });
});
