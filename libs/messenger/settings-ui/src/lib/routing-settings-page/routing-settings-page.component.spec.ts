// libs/messenger/settings-ui/src/lib/routing-settings-page/routing-settings-page.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RoutingSettingsPageComponent } from './routing-settings-page.component';
import { ChatService } from '@nx-platform-application/chat-state';
import { Logger } from '@nx-platform-application/console-logger';
import { signal } from '@angular/core';
import { vi } from 'vitest';

describe('RoutingSettingsPageComponent', () => {
  let component: RoutingSettingsPageComponent;
  let fixture: ComponentFixture<RoutingSettingsPageComponent>;

  const mockChatService = {
    messages: signal([])
  };

  const mockLogger = {
    warn: vi.fn()
  };

  beforeEach(async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    await TestBed.configureTestingModule({
      imports: [RoutingSettingsPageComponent],
      providers: [
        { provide: ChatService, useValue: mockChatService },
        { provide: Logger, useValue: mockLogger }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RoutingSettingsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should log warning when clearing history', () => {
    component.onClearHistory();
    expect(mockLogger.warn).toHaveBeenCalled();
  });
});