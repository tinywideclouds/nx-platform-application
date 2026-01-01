// libs/messenger/settings-ui/src/lib/identity-settings-page/identity-settings-page.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IdentitySettingsPageComponent } from './identity-settings-page.component';
import { IAuthService } from '@nx-platform-application/platform-auth-access';
import { ChatService } from '@nx-platform-application/messenger-state-chat-session';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MockComponent, MockProvider } from 'ng-mocks';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';
import { MessengerSyncCardComponent } from '../messenger-sync-card/messenger-sync-card.component';

describe('IdentitySettingsPageComponent', () => {
  let component: IdentitySettingsPageComponent;
  let fixture: ComponentFixture<IdentitySettingsPageComponent>;

  let dialogSpy: { open: any };
  let chatServiceSpy: { logout: any };

  const mockUser = {
    id: URN.parse('urn:contacts:user:test'),
    alias: 'TestUser',
    email: 'test@test.com',
  };

  beforeEach(async () => {
    dialogSpy = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of(true),
      }),
    };

    chatServiceSpy = {
      logout: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [IdentitySettingsPageComponent],
      providers: [
        MockProvider(IAuthService, {
          currentUser: signal(mockUser),
        }),
        { provide: ChatService, useValue: chatServiceSpy },
        { provide: MatDialog, useValue: dialogSpy },
        MockProvider(MatSnackBar),
      ],
    })
      .overrideComponent(IdentitySettingsPageComponent, {
        remove: {
          imports: [MatDialogModule, MessengerSyncCardComponent],
        },
        add: {
          imports: [
            // ✅ Mock the sync card so we don't need to provide CloudSyncService here
            MockComponent(MessengerSyncCardComponent),
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(IdentitySettingsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display user alias', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('TestUser');
  });

  it('should open dialog and logout on confirmation', () => {
    component.onSecureLogout();

    expect(dialogSpy.open).toHaveBeenCalled();
    expect(chatServiceSpy.logout).toHaveBeenCalled();
  });
});
