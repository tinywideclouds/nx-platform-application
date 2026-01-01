import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessengerNetworkStatusComponent } from './messenger-network-status.component';
import { Router } from '@angular/router';
import { MockModule, MockProvider } from 'ng-mocks';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { By } from '@angular/platform-browser';

describe('MessengerNetworkStatusComponent', () => {
  let component: MessengerNetworkStatusComponent;
  let fixture: ComponentFixture<MessengerNetworkStatusComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MessengerNetworkStatusComponent,
        MockModule(MatIconModule),
        MockModule(MatTooltipModule),
      ],
      providers: [MockProvider(Router)],
    }).compileComponents();

    fixture = TestBed.createComponent(MessengerNetworkStatusComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);

    // Default required input
    fixture.componentRef.setInput('status', 'disconnected');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Status Display', () => {
    it('should show Green WiFi when connected', () => {
      fixture.componentRef.setInput('status', 'connected');
      fixture.detectChanges();

      const icon = fixture.debugElement.query(By.css('mat-icon'));
      expect(icon.nativeElement.textContent.trim()).toBe('wifi');
      expect(icon.nativeElement.classList).toContain('text-green-600');
    });

    it('should show Red WiFi Off when disconnected/offline', () => {
      fixture.componentRef.setInput('status', 'offline');
      fixture.detectChanges();

      const icon = fixture.debugElement.query(By.css('mat-icon'));
      expect(icon.nativeElement.textContent.trim()).toBe('wifi_off');
      expect(icon.nativeElement.classList).toContain('text-red-400');
    });

    it('should show Spinning Sync when syncing', () => {
      fixture.componentRef.setInput('status', 'syncing');
      fixture.detectChanges();

      const icon = fixture.debugElement.query(By.css('mat-icon'));
      expect(icon.nativeElement.textContent.trim()).toBe('sync');
      expect(icon.nativeElement.classList).toContain('animate-spin');
    });

    it('should show Pulsing Tethering when reconnecting', () => {
      fixture.componentRef.setInput('status', 'reconnection');
      fixture.detectChanges();

      const icon = fixture.debugElement.query(By.css('mat-icon'));
      expect(icon.nativeElement.textContent.trim()).toBe('wifi_tethering');
      expect(icon.nativeElement.classList).toContain('animate-pulse');
    });
  });

  it('should bind tooltip text from input', () => {
    fixture.componentRef.setInput('tooltipText', 'Custom Status Message');
    fixture.detectChanges();

    // Check internal component state or attribute if MatTooltip were real
    expect(component.tooltipText()).toBe('Custom Status Message');
  });

  it('should navigate to settings on click', () => {
    const spy = vi.spyOn(router, 'navigate');
    component.navigateToSettings();
    expect(spy).toHaveBeenCalledWith(['/messenger', 'settings', 'identity']);
  });
});
