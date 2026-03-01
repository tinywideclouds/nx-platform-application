import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScrollspaceInputComponent } from './input.component';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ScrollspaceInputComponent', () => {
  let component: ScrollspaceInputComponent;
  let fixture: ComponentFixture<ScrollspaceInputComponent>;

  beforeEach(async () => {
    // Mock URL APIs to prevent reference errors in Node environments
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
    global.URL.revokeObjectURL = vi.fn();

    await TestBed.configureTestingModule({
      imports: [ScrollspaceInputComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ScrollspaceInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should enable the send button only when there is text or attachments', () => {
    expect(component.canSend()).toBe(false);

    component.text.set('Hello');
    expect(component.canSend()).toBe(true);

    component.text.set('   '); // Whitespace only
    expect(component.canSend()).toBe(false);

    // Add a fake attachment
    component.attachments.set([
      { id: '1', file: new File([], 'test.png'), previewUrl: 'url' },
    ]);
    expect(component.canSend()).toBe(true);
  });

  it('should emit the payload and reset state when triggerSend is called', () => {
    const sendSpy = vi.spyOn(component.send, 'emit');

    component.text.set('Send this');
    component.triggerSend();

    expect(sendSpy).toHaveBeenCalledWith({
      text: 'Send this',
      files: [],
    });

    // State should reset
    expect(component.text()).toBe('');
  });

  it('should trigger send on bare Enter key, but allow newlines on Shift+Enter', () => {
    const sendSpy = vi.spyOn(component, 'triggerSend');

    const bareEnter = new KeyboardEvent('keydown', {
      key: 'Enter',
      shiftKey: false,
    });
    component.onKeyDown(bareEnter);
    expect(sendSpy).toHaveBeenCalled();

    sendSpy.mockClear();

    const shiftEnter = new KeyboardEvent('keydown', {
      key: 'Enter',
      shiftKey: true,
    });
    component.onKeyDown(shiftEnter);
    expect(sendSpy).not.toHaveBeenCalled();
  });
});
