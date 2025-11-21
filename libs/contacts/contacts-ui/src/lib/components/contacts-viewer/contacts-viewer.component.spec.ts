import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { Subject } from 'rxjs';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
  PendingIdentity,
  BlockedIdentity,
} from '@nx-platform-application/contacts-access';
import { URN } from '@nx-platform-application/platform-types';
import { Router, ActivatedRoute, ParamMap, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { ContactsViewerComponent } from './contacts-viewer.component';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';

// --- MOCKS ---
const mockContactId = 'urn:sm:user:123';
const mockContact: Contact = {
  id: URN.parse(mockContactId),
  alias: 'Test User',
  firstName: 'Test',
  surname: 'User',
  email: 'test@test.com',
  phoneNumbers: [],
  emailAddresses: [],
  serviceContacts: {}
};

// FIX: Initialize as empty object, populate in beforeEach
const { mockContactsService } = vi.hoisted(() => {
  return {
    mockContactsService: {
      contacts$: null, // Placeholder
      groups$: null,
      pending$: null,
      blocked$: null,
      deletePending: vi.fn(),
      blockIdentity: vi.fn(),
      unblockIdentity: vi.fn(),
    },
  };
});

const mockQueryParamMap = new Subject<ParamMap>();
const mockActivatedRoute = {
  queryParamMap: mockQueryParamMap.asObservable(),
  snapshot: {},
};

describe('ContactsViewerComponent', () => {
  let fixture: ComponentFixture<ContactsViewerComponent>;
  let component: ContactsViewerComponent;
  let router: Router;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // FIX: Initialize Subjects here
    mockContactsService.contacts$ = new Subject<Contact[]>();
    mockContactsService.groups$ = new Subject<ContactGroup[]>();
    mockContactsService.pending$ = new Subject<PendingIdentity[]>();
    mockContactsService.blocked$ = new Subject<BlockedIdentity[]>();
    
    await TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([]),
        NoopAnimationsModule,
        ContactsViewerComponent, 
      ],
      providers: [
        { provide: ContactsStorageService, useValue: mockContactsService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactsViewerComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');
  });

  async function initializeData() {
    // Cast to any to access the subjects we monkey-patched
    (mockContactsService.contacts$ as any).next([mockContact]);
    (mockContactsService.groups$ as any).next([]);
    (mockContactsService.pending$ as any).next([]);
    (mockContactsService.blocked$ as any).next([]);
    mockQueryParamMap.next(convertToParamMap({}));
    
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('should create', async () => {
    await initializeData();
    expect(component).toBeTruthy();
  });

  // ... rest of the tests (unchanged logic) ...
  it('should determine activeContact based on selectedId Input', async () => {
    await initializeData();
    expect(component.activeContact()).toBeNull();
    fixture.componentRef.setInput('selectedId', mockContactId);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.activeContact()).toEqual(mockContact);
  });

  it('should navigate with queryParams on Desktop contact selection', async () => {
    await initializeData();
    const toolbar = fixture.debugElement.query(By.directive(ContactsPageToolbarComponent)).componentInstance;
    // Mock the signal indirectly by mocking the property it depends on? 
    // Actually, since we can't easily spy on 'mode', we just check the method logic:
    
    // Pass 'true' to simulate wide mode
    component.onContactSelect(mockContact, true);

    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: { selectedId: mockContactId },
      queryParamsHandling: 'merge'
    }));
  });

  it('should navigate to edit page on Mobile contact selection', async () => {
    await initializeData();
    component.onContactSelect(mockContact, false);
    expect(router.navigate).toHaveBeenCalledWith(['edit', mockContactId], expect.anything());
  });
});