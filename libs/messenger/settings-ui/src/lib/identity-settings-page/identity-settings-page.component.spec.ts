// libs/messenger/settings-ui/src/lib/identity-settings-page/identity-settings-page.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IdentitySettingsPageComponent } from './identity-settings-page.component';
import { IAuthService } from '@nx-platform-application/platform-auth-access';
import { ChatService } from '@nx-platform-application/chat-state';
import { ChatCloudService } from '@nx-platform-application/chat-cloud-access';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MockProvider } from 'ng-mocks';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';

describe('IdentitySettingsPageComponent', () => {
  let component: IdentitySettingsPageComponent;
  let fixture: ComponentFixture<IdentitySettingsPageComponent>;

  // Define spies
  let dialogSpy: { open: any };
  let chatServiceSpy: { logout: any };
  let cloudServiceSpy: any;

  const mockUser = {
    id: URN.parse('urn:contacts:user:test'),
    alias: 'TestUser',
    email: 'test@test.com',
  };

  beforeEach(async () => {
    // Initialize spies for each test run to ensure isolation
    dialogSpy = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of(true),
      }),
    };

    chatServiceSpy = {
      logout: vi.fn(),
    };

    cloudServiceSpy = {
      isCloudEnabled: signal(false),
      isBackingUp: signal(false),
      lastBackupTime: signal(null),
      disconnect: vi.fn(),
      connect: vi.fn(),
      backup: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [IdentitySettingsPageComponent],
      providers: [
        MockProvider(IAuthService, {
          currentUser: signal(mockUser),
        }),
        // Explicitly provide the spies to guarantee they are used
        { provide: ChatService, useValue: chatServiceSpy },
        { provide: ChatCloudService, useValue: cloudServiceSpy },
        { provide: MatDialog, useValue: dialogSpy },
        MockProvider(MatSnackBar),
      ],
    })
      // CRITICAL FIX: Remove MatDialogModule.
      // This prevents the real Material Dialog code from executing and crashing.
      .overrideComponent(IdentitySettingsPageComponent, {
        remove: {
          imports: [MatDialogModule],
        },
        add: {
          imports: [],
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
