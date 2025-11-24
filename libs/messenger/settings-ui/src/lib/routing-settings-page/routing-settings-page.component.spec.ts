// libs/messenger/settings-ui/src/lib/routing-settings-page/routing-settings-page.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RoutingSettingsPageComponent } from './routing-settings-page.component';
import { ChatService } from '@nx-platform-application/chat-state';
import { Logger } from '@nx-platform-application/console-logger';
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache'; // <--- Import
import { MatSnackBar } from '@angular/material/snack-bar';
import { signal } from '@angular/core';
import { vi } from 'vitest';

describe('RoutingSettingsPageComponent', () => {
  let component: RoutingSettingsPageComponent;
  let fixture: ComponentFixture<RoutingSettingsPageComponent>;

  const mockChatService = {
    messages: signal([])
  };
  const mockLogger = { warn: vi.fn(), info: vi.fn(), error: vi.fn() };
  const mockSnackBar = { open: vi.fn() };
  
  // Mock KeyCacheService
  const mockKeyCache = {
    clear: vi.fn().mockResolvedValue(undefined)
  };

  beforeEach(async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await TestBed.configureTestingModule({
      imports: [RoutingSettingsPageComponent],
      providers: [
        { provide: ChatService, useValue: mockChatService },
        { provide: Logger, useValue: mockLogger },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: KeyCacheService, useValue: mockKeyCache } // <--- Provide
      ]
    })
    .overrideProvider(MatSnackBar, { useValue: mockSnackBar })
    .compileComponents();

    fixture = TestBed.createComponent(RoutingSettingsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call KeyCacheService.clear() on clear cache action', async () => {
    await component.onClearKeyCache();
    
    expect(mockKeyCache.clear).toHaveBeenCalled();
    expect(mockSnackBar.open).toHaveBeenCalledWith(
      expect.stringContaining('cleared'), 
      expect.any(String), 
      expect.any(Object)
    );
  });
});