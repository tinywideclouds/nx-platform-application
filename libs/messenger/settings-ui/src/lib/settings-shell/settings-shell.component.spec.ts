// libs/messenger/settings-ui/src/lib/settings-shell/settings-shell.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsShellComponent } from './settings-shell.component';
import { Router } from '@angular/router';
import { MasterDetailLayoutComponent } from '@nx-platform-application/platform-ui-toolkit';
import { SettingsSidebarComponent } from '../settings-sidebar/settings-sidebar.component';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { vi } from 'vitest';

// --- Mocks ---
@Component({
  selector: 'lib-master-detail-layout',
  standalone: true,
  template: '<ng-content select="[sidebar]"></ng-content><ng-content select="[main]"></ng-content>'
})
class MockLayout {
  @Input() showDetail = false;
}

@Component({
  selector: 'lib-settings-sidebar',
  standalone: true,
  template: ''
})
class MockSidebar {
  @Output() closeSettings = new EventEmitter<void>();
}

describe('SettingsShellComponent', () => {
  let component: SettingsShellComponent;
  let fixture: ComponentFixture<SettingsShellComponent>;
  let router: Router;

  beforeEach(async () => {
    const routerMock = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SettingsShellComponent],
      providers: [{ provide: Router, useValue: routerMock }]
    })
    .overrideComponent(SettingsShellComponent, {
      remove: { imports: [MasterDetailLayoutComponent, SettingsSidebarComponent] },
      add: { imports: [MockLayout, MockSidebar] }
    })
    .compileComponents();

    fixture = TestBed.createComponent(SettingsShellComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should navigate back to messenger root on close', () => {
    component.onClose();
    expect(router.navigate).toHaveBeenCalledWith(['/messenger']);
  });
});