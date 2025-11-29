import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessengerNetworkStatusComponent } from './messenger-network-status.component';
import { ChatCloudService } from '@nx-platform-application/chat-cloud-access';
import { Router } from '@angular/router';
import { MockProvider, MockModule } from 'ng-mocks';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('MessengerNetworkStatusComponent', () => {
  let component: MessengerNetworkStatusComponent;
  let fixture: ComponentFixture<MessengerNetworkStatusComponent>;
  let router: Router;

  // Mock Signals for the Service
  const mockIsCloudEnabled = signal(false);
  const mockIsBackingUp = signal(false);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MessengerNetworkStatusComponent,
        MockModule(MatIconModule),
        // Keep Tooltip real or mock? Mocking is safer for unit tests.
        MockModule(MatTooltipModule),
      ],
      providers: [
        MockProvider(ChatCloudService, {
          isCloudEnabled: mockIsCloudEnabled,
          isBackingUp: mockIsBackingUp,
        }),
        MockProvider(Router),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MessengerNetworkStatusComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);

    // Reset signals defaults
    mockIsCloudEnabled.set(false);
    mockIsBackingUp.set(false);

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Tooltip Logic', () => {
    it('should show "Offline" when cloud is disabled', () => {
      mockIsCloudEnabled.set(false);
      mockIsBackingUp.set(false);
      fixture.detectChanges();

      expect(component.getTooltip()).toContain('Offline');
    });

    it('should show "Active" when cloud is enabled but not syncing', () => {
      mockIsCloudEnabled.set(true);
      mockIsBackingUp.set(false);
      fixture.detectChanges();

      expect(component.getTooltip()).toContain('Active');
    });

    it('should show "Syncing" when backing up', () => {
      mockIsCloudEnabled.set(true);
      mockIsBackingUp.set(true);
      fixture.detectChanges();

      expect(component.getTooltip()).toContain('Syncing');
    });
  });

  describe('Navigation', () => {
    it('should navigate to identity settings on click', () => {
      const spy = vi.spyOn(router, 'navigate');

      component.navigateToSettings();

      expect(spy).toHaveBeenCalledWith(['/messenger', 'settings', 'identity']);
    });
  });
});
