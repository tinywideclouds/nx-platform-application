import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessengerHomePageComponent } from './messenger-home-page.component';
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { IAuthService } from '@nx-platform-application/platform-auth-access';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { Router } from '@angular/router';

const mockAuthService = {
  currentUser: signal({ 
    id: 'user-123', 
    alias: 'TestUser', 
    email: 'test@test.com' 
  }),
  logout: vi.fn()
};

describe('MessengerHomePageComponent', () => {
  let component: MessengerHomePageComponent;
  let fixture: ComponentFixture<MessengerHomePageComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessengerHomePageComponent, RouterTestingModule, NoopAnimationsModule],
      providers: [
        { provide: IAuthService, useValue: mockAuthService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MessengerHomePageComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    
    vi.spyOn(router, 'navigate');
    
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should navigate to conversations on viewConversations', () => {
    component.onViewConversations();
    expect(router.navigate).toHaveBeenCalledWith(['/messenger', 'conversations']);
  });

  it('should navigate to compose on onViewCompose', () => {
    component.onViewCompose();
    expect(router.navigate).toHaveBeenCalledWith(['/messenger', 'compose']);
  });

  it('should navigate to contacts on onViewContacts', () => {
    component.onViewContacts();
    expect(router.navigate).toHaveBeenCalledWith(['/messenger', 'contacts']);
  });
});