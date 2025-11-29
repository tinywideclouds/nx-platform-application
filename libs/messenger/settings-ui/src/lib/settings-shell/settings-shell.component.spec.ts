import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsShellComponent } from './settings-shell.component';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { MasterDetailLayoutComponent } from '@nx-platform-application/platform-ui-toolkit';
import { SettingsSidebarComponent } from '../settings-sidebar/settings-sidebar.component';
import { MockComponent } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { By } from '@angular/platform-browser';

describe('SettingsShellComponent', () => {
  let component: SettingsShellComponent;
  let fixture: ComponentFixture<SettingsShellComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        SettingsShellComponent,
        MockComponent(MasterDetailLayoutComponent),
        MockComponent(SettingsSidebarComponent),
      ],
      providers: [
        // ✅ Correctly provide Router infrastructure
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsShellComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should navigate home when sidebar emits closeSettings', () => {
    const spy = vi.spyOn(router, 'navigate');

    const sidebar = fixture.debugElement.query(
      By.directive(SettingsSidebarComponent)
    );
    sidebar.componentInstance.closeSettings.emit();

    expect(spy).toHaveBeenCalledWith(['/messenger']);
  });
});
