import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LlmChatWindowHeaderComponent } from './chat-window-header.component';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { describe, it, expect, beforeEach } from 'vitest';

describe('LlmChatWindowHeaderComponent', () => {
  let component: LlmChatWindowHeaderComponent;
  let fixture: ComponentFixture<LlmChatWindowHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        LlmChatWindowHeaderComponent,
        MatDialogModule,
        MatTooltipModule,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LlmChatWindowHeaderComponent);
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
