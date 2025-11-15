// libs/messenger/chat-ui/src/lib/chat-message-input/chat-message-input.component.spec.ts

import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
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

    // Set value and dispatch event
    textarea.value = 'Hello';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(sendButton.disabled).toBe(false);
  });

  it('should emit (messageSent) and reset the form on send', () => {
    const emitSpy = vi.spyOn(component.messageSent, 'emit');

    // Fill form
    component.form.patchValue({ messageText: 'Test message' });
    fixture.detectChanges();

    // Click send
    const sendButton = el.querySelector(
      '[data-testid="send-button"]'
    ) as HTMLButtonElement;
    sendButton.click();
    fixture.detectChanges();

    // Assert
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

    // 1. Test Shift+Enter (should not send)
    textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true })
    );
    fixture.detectChanges();
    expect(emitSpy).not.toHaveBeenCalled();

    // 2. Test Enter (should send)
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(emitSpy).toHaveBeenCalledWith('Test message');
  });

  it('should disable the form when the disabled input is true', () => {
    component.disabled = true;
    component.ngOnChanges({
      disabled: { currentValue: true, previousValue: false, firstChange: true, isFirstChange: () => true }
    });
    fixture.detectChanges();

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