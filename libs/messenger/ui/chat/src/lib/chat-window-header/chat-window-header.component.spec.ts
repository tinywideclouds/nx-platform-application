import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatWindowHeaderComponent } from './chat-window-header.component';
import { MatBadge, MatBadgeModule } from '@angular/material/badge';
import { ChatParticipant } from '@nx-platform-application/messenger-types';
import { URN } from '@nx-platform-application/platform-types';
import { By } from '@angular/platform-browser';
import { vi, describe, it, expect, beforeEach } from 'vitest';
// 1. Import ngMocks
import { MockModule, ngMocks } from 'ng-mocks';

const MOCK_PARTICIPANT: ChatParticipant = {
  urn: URN.parse('urn:contacts:user:alice'),
  name: 'Alice',
  initials: 'A',
  profilePictureUrl: 'http://img.com/alice.png',
};

describe('ChatWindowHeaderComponent', () => {
  let component: ChatWindowHeaderComponent;
  let fixture: ComponentFixture<ChatWindowHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ChatWindowHeaderComponent,
        // Mock Material to avoid rendering heavy real badge logic
        MockModule(MatBadgeModule),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatWindowHeaderComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('participant', MOCK_PARTICIPANT);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should hide warning badge when hasKeyIssue is false', () => {
    fixture.componentRef.setInput('hasKeyIssue', false);
    fixture.detectChanges();

    const infoBtn = fixture.debugElement.query(
      By.css('[data-testid="info-button"]'),
    );

    // ✅ CORRECT: Pass the element and the input alias string
    const isHidden = ngMocks.input(infoBtn, 'matBadgeHidden');

    expect(isHidden).toBe(true);
  });

  it('should show warning badge when hasKeyIssue is true', () => {
    fixture.componentRef.setInput('hasKeyIssue', true);
    fixture.detectChanges();

    const infoBtn = fixture.debugElement.query(
      By.css('[data-testid="info-button"]'),
    );

    // ✅ CORRECT: Check hidden status
    const isHidden = ngMocks.input(infoBtn, 'matBadgeHidden');
    expect(isHidden).toBe(false);

    // ✅ CORRECT: Check content
    const content = ngMocks.input(infoBtn, 'matBadge');
    expect(content).toBe('!');
  });

  it('should emit back event', () => {
    const spy = vi.spyOn(component.back, 'emit');
    const backBtn = fixture.debugElement.query(
      By.css('button[aria-label="Back"]'),
    );

    backBtn.nativeElement.click();
    expect(spy).toHaveBeenCalled();
  });

  it('should emit toggleInfo event', () => {
    const spy = vi.spyOn(component.toggleInfo, 'emit');
    const infoBtn = fixture.debugElement.query(
      By.css('[data-testid="info-button"]'),
    );

    infoBtn.nativeElement.click();
    expect(spy).toHaveBeenCalled();
  });
});
