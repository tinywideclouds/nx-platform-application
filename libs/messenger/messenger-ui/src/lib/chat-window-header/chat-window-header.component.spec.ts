// libs/messenger/messenger-ui/src/lib/chat-window-header/chat-window-header.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatBadgeModule } from '@angular/material/badge';
import { ChatWindowHeaderComponent } from './chat-window-header.component';
import { ChatParticipant } from '@nx-platform-application/messenger-types';
import { URN } from '@nx-platform-application/platform-types';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';

const MOCK_PARTICIPANT: ChatParticipant = {
  urn: URN.parse('urn:sm:user:alice'),
  name: 'Alice',
  initials: 'A',
  profilePictureUrl: 'http://img.com/alice.png'
};

describe('ChatWindowHeaderComponent', () => {
  let component: ChatWindowHeaderComponent;
  let fixture: ComponentFixture<ChatWindowHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatWindowHeaderComponent, MatBadgeModule],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatWindowHeaderComponent);
    component = fixture.componentInstance;
    
    fixture.componentRef.setInput('participant', MOCK_PARTICIPANT);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display participant info', () => {
    const nameEl = fixture.debugElement.query(By.css('.font-medium'));
    const imgEl = fixture.debugElement.query(By.css('img'));

    expect(nameEl.nativeElement.textContent).toContain('Alice');
    expect(imgEl.nativeElement.src).toContain('alice.png');
  });

  it('should show "info" icon in chat mode', () => {
    fixture.componentRef.setInput('mode', 'chat');
    fixture.detectChanges();
    
    const btn = fixture.debugElement.query(By.css('[data-testid="info-button"]'));
    expect(btn.nativeElement.textContent).toContain('info');
  });

  it('should show "chat" icon in details mode', () => {
    fixture.componentRef.setInput('mode', 'details');
    fixture.detectChanges();
    
    const btn = fixture.debugElement.query(By.css('[data-testid="info-button"]'));
    expect(btn.nativeElement.textContent).toContain('chat');
  });

  it('should emit back event', () => {
    const spy = vi.spyOn(component.back, 'emit');
    const backBtn = fixture.debugElement.query(By.css('button[aria-label="Back"]'));
    
    backBtn.nativeElement.click();
    expect(spy).toHaveBeenCalled();
  });

  it('should emit toggleInfo event', () => {
    const spy = vi.spyOn(component.toggleInfo, 'emit');
    const infoBtn = fixture.debugElement.query(By.css('[data-testid="info-button"]'));
    
    infoBtn.nativeElement.click();
    expect(spy).toHaveBeenCalled();
  });

  it('should show warning badge when hasKeyIssue is true', () => {
    fixture.componentRef.setInput('hasKeyIssue', true);
    fixture.detectChanges();

    const infoBtn = fixture.debugElement.query(By.css('[data-testid="info-button"]'));
    
    // 1. Check it is not hidden
    expect(infoBtn.nativeElement.classList).not.toContain('mat-badge-hidden');
    
    // 2. Check that the badge content is actually rendered in the DOM
    const badgeContent = fixture.debugElement.query(By.css('.mat-badge-content'));
    expect(badgeContent).toBeTruthy();
    expect(badgeContent.nativeElement.textContent).toContain('!');
  });

  it('should hide warning badge when hasKeyIssue is false', () => {
    fixture.componentRef.setInput('hasKeyIssue', false);
    fixture.detectChanges();

    const infoBtn = fixture.debugElement.query(By.css('[data-testid="info-button"]'));
    // Material adds this class when the badge is hidden
    expect(infoBtn.nativeElement.classList).toContain('mat-badge-hidden');
  });
});