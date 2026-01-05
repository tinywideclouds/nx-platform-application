// libs/messenger/chat-ui/src/lib/chat-message-input/chat-message-input.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ChatMessageInputComponent } from './chat-message-input.component';

describe('ChatMessageInputComponent', () => {
  let fixture: ComponentFixture<ChatMessageInputComponent>;
  let component: ChatMessageInputComponent;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatMessageInputComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatMessageInputComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should disable the send button when the form is empty', () => {
    const sendButton = el.querySelector(
      '[data-testid="send-button"]',
    ) as HTMLButtonElement;
    expect(sendButton.disabled).toBe(true);
  });

  it('should enable the send button when text is entered', () => {
    const sendButton = el.querySelector(
      '[data-testid="send-button"]',
    ) as HTMLButtonElement;
    const textarea = el.querySelector(
      '[data-testid="message-textarea"]',
    ) as HTMLTextAreaElement;

    textarea.value = 'Hello';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(sendButton.disabled).toBe(false);
    expect(component.messageText()).toBe('Hello');
  });

  it('should emit (messageSent) and reset on send', () => {
    const emitSpy = vi.spyOn(component.messageSent, 'emit');

    component.messageText.set('Test message');
    fixture.detectChanges();

    const sendButton = el.querySelector(
      '[data-testid="send-button"]',
    ) as HTMLButtonElement;
    sendButton.click();
    fixture.detectChanges();

    expect(emitSpy).toHaveBeenCalledWith('Test message');
    expect(component.messageText()).toBe('');
  });

  it('should send on "Enter" but not "Shift+Enter"', () => {
    const emitSpy = vi.spyOn(component.messageSent, 'emit');
    const textarea = el.querySelector(
      '[data-testid="message-textarea"]',
    ) as HTMLTextAreaElement;

    component.messageText.set('Test message');
    fixture.detectChanges();

    // Shift+Enter
    textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }),
    );
    fixture.detectChanges();
    expect(emitSpy).not.toHaveBeenCalled();

    // Enter
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(emitSpy).toHaveBeenCalledWith('Test message');
  });

  // ✅ NEW TEST: Verify the chain is fixed
  it('should emit (typing) on input event', () => {
    const typingSpy = vi.spyOn(component.typing, 'emit');
    const textarea = el.querySelector(
      '[data-testid="message-textarea"]',
    ) as HTMLTextAreaElement;

    textarea.value = 'Typing...';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(typingSpy).toHaveBeenCalled();
  });

  it('should disable the textarea when the disabled input is true', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    const textarea = el.querySelector(
      '[data-testid="message-textarea"]',
    ) as HTMLTextAreaElement;
    const sendButton = el.querySelector(
      '[data-testid="send-button"]',
    ) as HTMLButtonElement;

    expect(textarea.disabled).toBe(true);
    expect(sendButton.disabled).toBe(true);
  });
});
