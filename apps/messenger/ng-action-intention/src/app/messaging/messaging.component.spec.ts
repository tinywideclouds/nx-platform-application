import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { User } from '@nx-platform-application/platform-types';
import { IAuthService } from '@nx-platform-application/platform-auth-access';
import { MessagingComponent } from './messaging.component';

const testUser: User = {
  id: '123-test',
  email: 'test@example.com',
  alias: 'TestUser',
};

describe('MessagingComponent (Zoneless + Globals)', () => {
  let fixture: ComponentFixture<MessagingComponent>;
  let component: MessagingComponent;
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };
  let mockAuthService: {
    currentUser: WritableSignal<User | null>;
    logout: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    const currentUserSignal = signal<User | null>(null);
    mockRouter = { navigate: vi.fn() };
    mockAuthService = {
      currentUser: currentUserSignal,
      logout: vi.fn(() => of(void 0)),
    };

    await TestBed.configureTestingModule({
      imports: [MessagingComponent], // Import standalone component
      providers: [
        provideNoopAnimations(),
        { provide: Router, useValue: mockRouter },
        { provide: IAuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MessagingComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should not display the card if user is null', async () => {
    mockAuthService.currentUser.set(null);
    fixture.detectChanges();
    await fixture.whenStable(); // Wait for effects of signal change

    const card = fixture.debugElement.query(By.css('mat-card'));
    expect(card).toBeFalsy();
  });

  it('should display user information when currentUser signal is set', async () => {
    mockAuthService.currentUser.set(testUser);
    fixture.detectChanges();
    await fixture.whenStable(); // Wait for effects of signal change

    const cardTitle: HTMLElement = fixture.debugElement.query(
      By.css('mat-card-title')
    ).nativeElement;
    expect(cardTitle.textContent).toContain('Welcome, TestUser!');
  });

  it('should call logout() and navigate when the logout button is clicked', async () => {
    mockAuthService.currentUser.set(testUser);
    fixture.detectChanges();
    await fixture.whenStable();

    const logoutButton: HTMLButtonElement = fixture.debugElement.query(
      By.css('button[color="warn"]')
    ).nativeElement;
    logoutButton.click();

    expect(mockAuthService.logout).toHaveBeenCalledTimes(1);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });
});
