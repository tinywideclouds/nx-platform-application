import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RoutingSettingsPageComponent } from './routing-settings-page.component';
import { ChatService } from '@nx-platform-application/chat-state';
import { Logger } from '@nx-platform-application/console-logger';
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';

describe('RoutingSettingsPageComponent', () => {
  let component: RoutingSettingsPageComponent;
  let fixture: ComponentFixture<RoutingSettingsPageComponent>;
  let keyCache: KeyCacheService;

  // 1. Manual Spies
  const snackBarSpy = {
    open: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoutingSettingsPageComponent],
      providers: [
        MockProvider(ChatService, { messages: signal([]) }),
        MockProvider(Logger),
        MockProvider(KeyCacheService, {
          clear: vi.fn().mockResolvedValue(undefined),
        }),
        // 2. Force override with useValue
        { provide: MatSnackBar, useValue: snackBarSpy },
      ],
    })
      // 3. Remove real module
      .overrideComponent(RoutingSettingsPageComponent, {
        remove: { imports: [MatSnackBarModule] },
        add: { imports: [] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(RoutingSettingsPageComponent);
    component = fixture.componentInstance;
    keyCache = TestBed.inject(KeyCacheService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call KeyCacheService.clear() on clear cache action', async () => {
    await component.onClearKeyCache();

    expect(keyCache.clear).toHaveBeenCalled();
    // Now this assertion will pass because snackBarSpy.open is a real Vitest spy
    expect(snackBarSpy.open).toHaveBeenCalledWith(
      expect.stringContaining('cleared'),
      'OK',
      expect.any(Object)
    );
  });
});
