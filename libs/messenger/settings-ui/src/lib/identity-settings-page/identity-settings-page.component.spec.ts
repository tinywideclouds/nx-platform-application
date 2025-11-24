// libs/messenger/settings-ui/src/lib/identity-settings-page/identity-settings-page.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IdentitySettingsPageComponent } from './identity-settings-page.component';
import { IAuthService } from '@nx-platform-application/platform-auth-access';
import { ChatService } from '@nx-platform-application/chat-state';
import { MatDialog } from '@angular/material/dialog';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';

describe('IdentitySettingsPageComponent', () => {
  let component: IdentitySettingsPageComponent;
  let fixture: ComponentFixture<IdentitySettingsPageComponent>;

  const mockUser = {
    id: URN.parse('urn:sm:user:test'),
    alias: 'TestUser',
    email: 'test@test.com'
  };

  const mockAuthService = {
    currentUser: signal(mockUser)
  };

  const mockChatService = {
    logout: vi.fn()
  };

  const mockDialog = {
    open: vi.fn()
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IdentitySettingsPageComponent],
      providers: [
        { provide: IAuthService, useValue: mockAuthService },
        { provide: ChatService, useValue: mockChatService },
        { provide: MatDialog, useValue: mockDialog }
      ]
    }).compileComponents();

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
    // Mock dialog closing with 'true'
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(true)
    });

    component.onSecureLogout();

    expect(mockDialog.open).toHaveBeenCalled();
    expect(mockChatService.logout).toHaveBeenCalled();
  });
});