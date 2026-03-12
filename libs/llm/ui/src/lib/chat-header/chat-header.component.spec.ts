import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LlmChatHeaderComponent } from './chat-header.component';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { describe, it, expect, beforeEach } from 'vitest';

describe('LlmChatHeaderComponent', () => {
  let component: LlmChatHeaderComponent;
  let fixture: ComponentFixture<LlmChatHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LlmChatHeaderComponent, MatDialogModule, MatTooltipModule],
    }).compileComponents();

    fixture = TestBed.createComponent(LlmChatHeaderComponent);
    component = fixture.componentInstance;
  });

  it('should mask the technical model name for the display badge', () => {
    fixture.componentRef.setInput('activeModelId', 'gemini-3-flash-preview');
    fixture.detectChanges();
    expect(component.primaryModelLabel()).toBe('Gemini Flash');
  });

  it('should toggle thoughts visibility', () => {
    expect(component.showThoughts()).toBe(false);
    component.toggleThoughts();
    expect(component.showThoughts()).toBe(true);
  });
});
