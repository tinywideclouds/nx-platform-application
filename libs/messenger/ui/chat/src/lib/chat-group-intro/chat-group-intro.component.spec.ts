import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatGroupIntroComponent } from './chat-group-intro.component';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { vi, describe, it, expect, beforeEach } from 'vitest';

@Component({
  standalone: true,
  imports: [ChatGroupIntroComponent],
  template: `
    <messenger-chat-group-intro
      [groupName]="name"
      [memberCount]="count"
      (startBroadcast)="onBroadcast()"
      (createGroupChat)="onGroupChat()"
    />
  `,
})
class TestHostComponent {
  name = 'Test Group';
  count = 5;
  onBroadcast = vi.fn();
  onGroupChat = vi.fn();
}

describe('ChatGroupIntroComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let hostComponent: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, ChatGroupIntroComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render group name and member count', () => {
    const element = fixture.nativeElement;
    expect(element.textContent).toContain('Test Group');
    expect(element.textContent).toContain('5 members');
  });

  it('should emit startBroadcast when broadcast card is clicked', () => {
    // Select the "Start Broadcast" button (first button in the grid)
    const buttons = fixture.debugElement.queryAll(
      By.css('button[mat-flat-button]'),
    );
    const broadcastBtn = buttons[0];

    broadcastBtn.nativeElement.click();
    expect(hostComponent.onBroadcast).toHaveBeenCalled();
  });

  it('should emit createGroupChat when group chat card is clicked', () => {
    // Select the "Create Group Chat" button (second button in the grid)
    const buttons = fixture.debugElement.queryAll(
      By.css('button[mat-flat-button]'),
    );
    const groupChatBtn = buttons[1];

    groupChatBtn.nativeElement.click();
    expect(hostComponent.onGroupChat).toHaveBeenCalled();
  });
});
