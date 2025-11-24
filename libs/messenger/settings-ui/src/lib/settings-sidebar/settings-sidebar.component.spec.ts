// libs/messenger/settings-ui/src/lib/settings-sidebar/settings-sidebar.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsSidebarComponent } from './settings-sidebar.component';
import { RouterTestingModule } from '@angular/router/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';

describe('SettingsSidebarComponent', () => {
  let component: SettingsSidebarComponent;
  let fixture: ComponentFixture<SettingsSidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsSidebarComponent, RouterTestingModule]
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsSidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit closeSettings when back button is clicked', () => {
    const spy = vi.spyOn(component.closeSettings, 'emit');
    const btn = fixture.debugElement.query(By.css('button'));
    
    btn.nativeElement.click();
    expect(spy).toHaveBeenCalled();
  });
});