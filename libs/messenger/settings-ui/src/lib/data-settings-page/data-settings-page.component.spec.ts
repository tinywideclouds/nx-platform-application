import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataSettingsPageComponent } from './data-settings-page.component';
import { ChatService } from '@nx-platform-application/chat-state';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MockComponent, MockProvider } from 'ng-mocks';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Logger } from '@nx-platform-application/console-logger';
import { MessengerSyncCardComponent } from '../messenger-sync-card/messenger-sync-card.component';
import { SecureLogoutDialogComponent } from '../secure-logout-dialog/secure-logout-dialog.component';

describe('DataSettingsPageComponent', () => {
  let component: DataSettingsPageComponent;
  let fixture: ComponentFixture<DataSettingsPageComponent>;

  const chatServiceSpy = {
    messages: signal([]),
    logout: vi.fn(),
  };

  const dialogSpy = {
    open: vi.fn().mockReturnValue({ afterClosed: () => of(true) }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataSettingsPageComponent],
      providers: [
        { provide: ChatService, useValue: chatServiceSpy },
        { provide: MatDialog, useValue: dialogSpy },
        MockProvider(MatSnackBar),
        MockProvider(Logger),
      ],
    })
      .overrideComponent(DataSettingsPageComponent, {
        remove: { imports: [MessengerSyncCardComponent] },
        add: { imports: [MockComponent(MessengerSyncCardComponent)] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(DataSettingsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should open secure logout dialog', () => {
    component.onSecureLogout();
    expect(dialogSpy.open).toHaveBeenCalledWith(SecureLogoutDialogComponent);
    expect(chatServiceSpy.logout).toHaveBeenCalled();
  });
});
