import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LogoutDialogComponent } from './logout-dialog.component';
import { MockModule } from 'ng-mocks';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { By } from '@angular/platform-browser';

describe('LogoutDialogComponent', () => {
  let component: LogoutDialogComponent;
  let fixture: ComponentFixture<LogoutDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        LogoutDialogComponent,
        MockModule(MatDialogModule),
        MockModule(MatButtonModule),
        MockModule(MatIconModule),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LogoutDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should contain sign out button', () => {
    const button = fixture.debugElement.query(
      By.css('[data-testid="confirm-logout-button"]')
    );
    expect(button).toBeTruthy();
    expect(button.nativeElement.textContent).toContain('Sign Out');
  });
});
