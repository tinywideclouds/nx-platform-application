import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScrollspaceMarkdownBubbleComponent } from './markdown-bubble.component';
import { Token } from 'marked';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ScrollspaceMarkdownBubbleComponent', () => {
  let component: ScrollspaceMarkdownBubbleComponent;
  let fixture: ComponentFixture<ScrollspaceMarkdownBubbleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScrollspaceMarkdownBubbleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ScrollspaceMarkdownBubbleComponent);
    component = fixture.componentInstance;
  });

  it('should calculate and emit weight based on token complexity', async () => {
    const emitSpy = vi.spyOn(component.weightUpdate, 'emit');

    // Set inputs
    fixture.componentRef.setInput('itemId', 'msg-123');
    fixture.componentRef.setInput('tokens', [
      { type: 'paragraph', text: 'a'.repeat(1000) } as any, // Should add 2 weight (1000 / 500)
      { type: 'code', text: 'console.log()' } as any, // Should add 5 weight
    ] as Token[]);

    // Flush the effect
    fixture.detectChanges();
    await fixture.whenStable();

    // Base weight (1) + Text (2) + Code (5) = 8
    expect(emitSpy).toHaveBeenCalledWith({
      itemId: 'msg-123',
      newWeight: 8,
    });
  });
});
