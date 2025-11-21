// libs/contacts/contacts-ui/src/lib/components/contacts-viewer/contacts-viewer.component.spec.ts

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
import {
  Router,
  ActivatedRoute,
  ParamMap,
  convertToParamMap,
} from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ContactsViewerComponent } from './contacts-viewer.component';
import { ContactListComponent } from '../contact-list/contact-list.component';
import { ContactGroupListComponent } from '../contact-group-list/contact-group-list.component';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';
import { PendingListComponent } from '../pending-list/pending-list.component';
import { BlockedListComponent } from '../blocked-list/blocked-list.component';

const MOCK_CONTACTS: Contact[] = [];
const MOCK_GROUPS: ContactGroup[] = [];
const MOCK_PENDING: PendingIdentity[] = [
  {
    urn: URN.parse('urn:auth:google:stranger'),
    firstSeenAt: '2023-01-01T00:00:00Z' as any,
  },
];
const MOCK_BLOCKED: BlockedIdentity[] = [
  {
    urn: URN.parse('urn:auth:google:spam'),
    blockedAt: '2023-01-01T00:00:00Z' as any,
  },
];

const { mockContactsService } = vi.hoisted(() => {
  return {
    mockContactsService: {
      contacts$: null as Subject<Contact[]> | null,
      groups$: null as Subject<ContactGroup[]> | null,
      pending$: null as Subject<PendingIdentity[]> | null,
      blocked$: null as Subject<BlockedIdentity[]> | null,
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
    mockContactsService.contacts$ = new Subject<Contact[]>();
    mockContactsService.groups$ = new Subject<ContactGroup[]>();
    mockContactsService.pending$ = new Subject<PendingIdentity[]>();
    mockContactsService.blocked$ = new Subject<BlockedIdentity[]>();

    mockContactsService.deletePending.mockResolvedValue(undefined);
    mockContactsService.blockIdentity.mockResolvedValue(undefined);
    mockContactsService.unblockIdentity.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([]),
        NoopAnimationsModule,
        MatTabsModule,
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
        ContactsViewerComponent,
        ContactListComponent,
        ContactGroupListComponent,
        ContactsPageToolbarComponent,
        PendingListComponent,
        BlockedListComponent,
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

  function initializeComponent(params: ParamMap) {
    mockQueryParamMap.next(params);
    mockContactsService.contacts$!.next(MOCK_CONTACTS);
    mockContactsService.groups$!.next(MOCK_GROUPS);
    mockContactsService.pending$!.next(MOCK_PENDING);
    mockContactsService.blocked$!.next(MOCK_BLOCKED);
    fixture.detectChanges();
  }

  it('should create', () => {
    initializeComponent(convertToParamMap({}));
    expect(component).toBeTruthy();
  });

  it('should select "Manage" tab (index 2) when ?tab=manage', () => {
    initializeComponent(convertToParamMap({ tab: 'manage' }));
    expect(component.tabIndex()).toBe(2);
  });

  it('should display pending items in Manage tab', () => {
    initializeComponent(convertToParamMap({ tab: 'manage' }));
    fixture.detectChanges();

    const pendingList = fixture.debugElement.query(
      By.directive(PendingListComponent)
    );
    const blockedList = fixture.debugElement.query(
      By.directive(BlockedListComponent)
    );

    expect(pendingList).toBeTruthy();
    expect(blockedList).toBeTruthy();

    // Check signals are passed
    expect(pendingList.componentInstance.pending()).toEqual(MOCK_PENDING);
    expect(blockedList.componentInstance.blocked()).toEqual(MOCK_BLOCKED);
  });

  it('should handle events from PendingList', async () => {
    initializeComponent(convertToParamMap({ tab: 'manage' }));
    fixture.detectChanges();

    const pendingList = fixture.debugElement.query(
      By.directive(PendingListComponent)
    );

    // Trigger block
    pendingList.triggerEventHandler('block', MOCK_PENDING[0]);

    // FIX: Wait for async component methods (blockIdentity + deletePending)
    await fixture.whenStable();

    expect(mockContactsService.blockIdentity).toHaveBeenCalledWith(
      MOCK_PENDING[0].urn,
      'Blocked via Manager'
    );
    expect(mockContactsService.deletePending).toHaveBeenCalledWith(
      MOCK_PENDING[0].urn
    );

    // Trigger approve
    pendingList.triggerEventHandler('approve', MOCK_PENDING[0]);

    // FIX: Wait for async component methods (deletePending)
    await fixture.whenStable();

    expect(mockContactsService.deletePending).toHaveBeenCalledTimes(2);
  });

  it('should handle events from BlockedList', async () => {
    initializeComponent(convertToParamMap({ tab: 'manage' }));
    fixture.detectChanges();

    const blockedList = fixture.debugElement.query(
      By.directive(BlockedListComponent)
    );

    blockedList.triggerEventHandler('unblock', MOCK_BLOCKED[0]);

    // FIX: Wait for async component methods (unblockIdentity)
    await fixture.whenStable();

    expect(mockContactsService.unblockIdentity).toHaveBeenCalledWith(
      MOCK_BLOCKED[0].urn
    );
  });
});
