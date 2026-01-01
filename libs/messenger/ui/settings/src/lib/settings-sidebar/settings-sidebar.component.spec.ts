import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsSidebarComponent } from './settings-sidebar.component';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockModule } from 'ng-mocks';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';

describe('SettingsSidebarComponent', () => {
  let component: SettingsSidebarComponent;
  let fixture: ComponentFixture<SettingsSidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        SettingsSidebarComponent,
        // Mock UI modules to avoid rendering overhead
        MockModule(MatListModule),
        MockModule(MatIconModule),
      ],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsSidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit closeSettings when back button is clicked', () => {
    const emitSpy = vi.spyOn(component.closeSettings, 'emit');
    // Assuming the first button is the back button based on template
    const backButton = fixture.debugElement.query(By.css('button'));

    backButton.nativeElement.click();

    expect(emitSpy).toHaveBeenCalled();
  });
});
