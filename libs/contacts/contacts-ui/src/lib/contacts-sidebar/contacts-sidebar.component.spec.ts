import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { Subject } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatTabChangeEvent } from '@angular/material/tabs';

import { ContactsSidebarComponent } from './contacts-sidebar.component';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
  PendingIdentity,
  BlockedIdentity,
} from '@nx-platform-application/contacts-storage';
import { URN } from '@nx-platform-application/platform-types';

// --- MOCK DATA ---
const mockContactUrn = URN.parse('urn:sm:user:123');
const mockContact: Contact = {
  id: mockContactUrn,
  alias: 'Test User',
  firstName: 'Test',
  surname: 'User',
  email: 'test@test.com',
  phoneNumbers: [],
  emailAddresses: [],
  serviceContacts: {},
};
const mockGroup: ContactGroup = {
  id: URN.parse('urn:sm:group:999'),
  name: 'Test Group',
  contactIds: [],
};

// --- SERVICE MOCK ---
// We use subjects to control the data streams during tests
const mockContactsService = {
  contacts$: new Subject<Contact[]>(),
  groups$: new Subject<ContactGroup[]>(),
  pending$: new Subject<PendingIdentity[]>(),
  blocked$: new Subject<BlockedIdentity[]>(),
  deletePending: vi.fn(),
  blockIdentity: vi.fn(),
  unblockIdentity: vi.fn(),
};

describe('ContactsSidebarComponent', () => {
  let fixture: ComponentFixture<ContactsSidebarComponent>;
  let component: ContactsSidebarComponent;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset Subjects
    mockContactsService.contacts$ = new Subject<Contact[]>();
    mockContactsService.groups$ = new Subject<ContactGroup[]>();
    mockContactsService.pending$ = new Subject<PendingIdentity[]>();
    mockContactsService.blocked$ = new Subject<BlockedIdentity[]>();

    await TestBed.configureTestingModule({
      imports: [
        RouterTestingModule, // For routerLink in toolbar
        NoopAnimationsModule,
        ContactsSidebarComponent,
      ],
      providers: [
        { provide: ContactsStorageService, useValue: mockContactsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactsSidebarComponent);
    component = fixture.componentInstance;

    // Initial Render
    fixture.detectChanges();
  });

  // --- RENDERING & DATA ---

  it('should render contact list when data is emitted', async () => {
    // 1. Emit data
    mockContactsService.contacts$.next([mockContact]);

    // 2. Wait for signal update and render
    await fixture.whenStable();
    fixture.detectChanges();

    // 3. Verify
    const items = fixture.debugElement.queryAll(By.css('contacts-list-item'));
    expect(items.length).toBe(1);
    expect(items[0].nativeElement.textContent).toContain('Test User');
  });

  it('should render group list when data is emitted', async () => {
    // Switch to Groups tab (index 1) to render the group list from DOM perspective
    // (Though purely logic-wise, the signal updates regardless of tab)
    fixture.componentRef.setInput('tabIndex', 1);
    mockContactsService.groups$.next([mockGroup]);

    await fixture.whenStable();
    fixture.detectChanges();

    const items = fixture.debugElement.queryAll(
      By.css('contacts-group-list-item')
    );
    expect(items.length).toBe(1);
    expect(items[0].nativeElement.textContent).toContain('Test Group');
  });

  // --- OUTPUT EVENTS ---

  it('should emit contactSelected when a contact is clicked', async () => {
    // Setup
    mockContactsService.contacts$.next([mockContact]);
    await fixture.whenStable();
    fixture.detectChanges();

    // Spy on Output
    const spy = vi.spyOn(component.contactSelected, 'emit');

    // Simulate Click
    const item = fixture.debugElement.query(By.css('contacts-list-item'));
    item.triggerEventHandler('select', mockContact); // Assuming child emits 'select'

    expect(spy).toHaveBeenCalledWith(mockContact);
  });

  it('should emit tabChange when tabs are switched', () => {
    const spy = vi.spyOn(component.tabChange, 'emit');

    // Create a fake event
    const mockEvent = {
      index: 1,
      tab: { textLabel: 'Groups' },
    } as MatTabChangeEvent;

    // Trigger internal handler
    component.onTabChange(mockEvent);

    expect(spy).toHaveBeenCalledWith(mockEvent);
  });

  // --- ACTIONS (Gatekeeper) ---

  it('should call deletePending when approving identity', async () => {
    const mockPending: PendingIdentity = {
      urn: URN.parse('urn:sm:user:p1'),
      alias: 'Stranger',
    } as any;

    await component.approveIdentity(mockPending);

    expect(mockContactsService.deletePending).toHaveBeenCalledWith(
      mockPending.urn
    );
  });
});
