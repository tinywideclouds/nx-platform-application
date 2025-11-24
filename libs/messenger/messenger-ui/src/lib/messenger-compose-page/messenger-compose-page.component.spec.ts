import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessengerComposePageComponent } from './messenger-compose-page.component';
import { Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { URN } from '@nx-platform-application/platform-types';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-access';
import { vi } from 'vitest';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { By } from '@angular/platform-browser';

// --- ARTIFACTS UNDER TEST ---
// Import original to override
import { ContactsSidebarComponent } from '@nx-platform-application/contacts-ui';
import { MasterDetailLayoutComponent } from '@nx-platform-application/platform-ui-toolkit';

// --- STUBS ---

@Component({
  selector: 'contacts-sidebar',
  standalone: true,
  template: ''
})
class StubContactsSidebarComponent {
  @Input() selectionMode = false;
  @Input() showAddActions = true;
  @Output() contactSelected = new EventEmitter<Contact>();
  @Output() groupSelected = new EventEmitter<ContactGroup>();
}

@Component({
  selector: 'lib-master-detail-layout',
  standalone: true,
  template: '<ng-content select="[sidebar]"></ng-content><ng-content select="[main]"></ng-content>'
})
class StubLayoutComponent {
  @Input() showDetail = false;
}

// --- MOCK DATA ---
const mockContact = { 
  id: URN.parse('urn:sm:user:test'), 
  alias: 'Test User' 
} as Contact;

describe('MessengerComposePageComponent', () => {
  let component: MessengerComposePageComponent;
  let fixture: ComponentFixture<MessengerComposePageComponent>;
  let router: Router;

  beforeEach(async () => {
    // Mock Router
    const routerMock = {
      navigate: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [MessengerComposePageComponent, NoopAnimationsModule],
      providers: [
        { provide: Router, useValue: routerMock }
      ]
    })
    .overrideComponent(MessengerComposePageComponent, {
      remove: { 
        imports: [ContactsSidebarComponent, MasterDetailLayoutComponent] 
      },
      add: { 
        imports: [StubContactsSidebarComponent, StubLayoutComponent] 
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(MessengerComposePageComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should navigate to conversation when a contact is selected via the sidebar stub', () => {
    // 1. Find the Stub
    const sidebarStub = fixture.debugElement.query(By.directive(StubContactsSidebarComponent));
    expect(sidebarStub).toBeTruthy();

    // 2. Emit the event from the Stub
    sidebarStub.componentInstance.contactSelected.emit(mockContact);

    // 3. Verify Router Navigation
    expect(router.navigate).toHaveBeenCalledWith(
      ['/messenger', 'conversations', 'urn:sm:user:test']
    );
  });
});