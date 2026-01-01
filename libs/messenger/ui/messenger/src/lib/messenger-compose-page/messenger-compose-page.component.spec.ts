import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessengerComposePageComponent } from './messenger-compose-page.component';
import { Router } from '@angular/router';
import { URN } from '@nx-platform-application/platform-types';
import { Contact } from '@nx-platform-application/contacts-storage';
import { vi } from 'vitest';
import { By } from '@angular/platform-browser';

// ng-mocks
import { MockComponent, MockProvider } from 'ng-mocks';
import { ContactsSidebarComponent } from '@nx-platform-application/contacts-ui';
import { MasterDetailLayoutComponent } from '@nx-platform-application/platform-ui-toolkit';

// Mock Data
const mockContact = {
  id: URN.parse('urn:contacts:user:test'),
  alias: 'Test User',
} as Contact;

describe('MessengerComposePageComponent', () => {
  let component: MessengerComposePageComponent;
  let fixture: ComponentFixture<MessengerComposePageComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MessengerComposePageComponent,
        // ✅ Mock children directly
        MockComponent(ContactsSidebarComponent),
        MockComponent(MasterDetailLayoutComponent),
      ],
      providers: [MockProvider(Router)],
    }).compileComponents();

    fixture = TestBed.createComponent(MessengerComposePageComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should navigate to conversation when a contact is selected via the sidebar', () => {
    const spy = vi.spyOn(router, 'navigate');

    // 1. Find the Mock Component
    const sidebar = fixture.debugElement.query(
      By.directive(ContactsSidebarComponent),
    );
    expect(sidebar).toBeTruthy();

    // 2. Simulate Output Emission
    // Using componentInstance logic which ng-mocks supports for outputs
    sidebar.componentInstance.contactSelected.emit(mockContact);

    // 3. Verify Router Navigation
    expect(spy).toHaveBeenCalledWith([
      '/messenger',
      'conversations',
      'urn:contacts:user:test',
    ]);
  });
});
