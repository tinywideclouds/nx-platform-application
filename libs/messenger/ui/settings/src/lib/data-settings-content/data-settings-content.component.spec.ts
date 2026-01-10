import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataSettingsContentComponent } from './data-settings-content.component';
import { ChatService } from '@nx-platform-application/messenger-state-app';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MockProvider, MockComponent } from 'ng-mocks';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import { MessengerSyncCardComponent } from '../messenger-sync-card/messenger-sync-card.component';

describe('DataSettingsContentComponent', () => {
  let component: DataSettingsContentComponent;
  let fixture: ComponentFixture<DataSettingsContentComponent>;

  const mockChatService = {
    messages: signal([{ id: '1' }, { id: '2' }]), // Real signal mock
    clearLocalMessages: vi.fn().mockResolvedValue(undefined),
    clearLocalContacts: vi.fn().mockResolvedValue(undefined),
    fullDeviceWipe: vi.fn().mockResolvedValue(undefined),
  };

  const mockDialog = {
    open: vi.fn().mockReturnValue({ afterClosed: () => of(true) }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataSettingsContentComponent],
      providers: [
        { provide: ChatService, useValue: mockChatService },
        { provide: MatDialog, useValue: mockDialog },
        MockProvider(MatSnackBar),
        MockProvider(Logger),
      ],
    })
      .overrideComponent(DataSettingsContentComponent, {
        add: { imports: [MockComponent(MessengerSyncCardComponent)] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(DataSettingsContentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should display the real message count from the service', () => {
    expect(fixture.nativeElement.textContent).toContain('2');
    mockChatService.messages.set([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('0');
  });

  it('should call clearLocalContacts when requested', async () => {
    await component.onClearContacts();
    expect(mockChatService.clearLocalContacts).toHaveBeenCalled();
  });
});
