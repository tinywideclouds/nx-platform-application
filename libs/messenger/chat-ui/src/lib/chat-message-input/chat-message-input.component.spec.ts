// libs/messenger/chat-ui/src/lib/chat-message-input/chat-message-input.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { vi } from 'vitest';

import { ChatMessageInputComponent } from './chat-message-input.component';

describe('ChatMessageInputComponent', () => {
  let fixture: ComponentFixture<ChatMessageInputComponent>;
  let component: ChatMessageInputComponent;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatMessageInputComponent, ReactiveFormsModule],
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
      '[data-testid="send-button"]'
    ) as HTMLButtonElement;
    expect(sendButton.disabled).toBe(true);
  });

  it('should enable the send button when text is entered', () => {
    const sendButton = el.querySelector(
      '[data-testid="send-button"]'
    ) as HTMLButtonElement;
    const textarea = el.querySelector(
      '[data-testid="message-textarea"]'
    ) as HTMLTextAreaElement;

    textarea.value = 'Hello';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(sendButton.disabled).toBe(false);
  });

  it('should emit (messageSent) and reset the form on send', () => {
    // 1. Spy on the output signal's emit method
    const emitSpy = vi.spyOn(component.messageSent, 'emit');

    component.form.patchValue({ messageText: 'Test message' });
    fixture.detectChanges();

    const sendButton = el.querySelector(
      '[data-testid="send-button"]'
    ) as HTMLButtonElement;
    sendButton.click();
    fixture.detectChanges();

    expect(emitSpy).toHaveBeenCalledWith('Test message');
    expect(component.form.value.messageText).toBeNull();
  });

  it('should send on "Enter" but not "Shift+Enter"', () => {
    const emitSpy = vi.spyOn(component.messageSent, 'emit');
    const textarea = el.querySelector(
      '[data-testid="message-textarea"]'
    ) as HTMLTextAreaElement;

    component.form.patchValue({ messageText: 'Test message' });
    fixture.detectChanges();

    textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true })
    );
    fixture.detectChanges();
    expect(emitSpy).not.toHaveBeenCalled();

    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(emitSpy).toHaveBeenCalledWith('Test message');
  });

  it('should disable the form when the disabled input is true', () => {
    // 2. Refactored Test: Use setInput to trigger the Effect
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges(); // Triggers the effect

    const textarea = el.querySelector(
      '[data-testid="message-textarea"]'
    ) as HTMLTextAreaElement;
    const sendButton = el.querySelector(
      '[data-testid="send-button"]'
    ) as HTMLButtonElement;

    expect(component.form.disabled).toBe(true);
    expect(textarea.disabled).toBe(true);
    expect(sendButton.disabled).toBe(true);
  });
});