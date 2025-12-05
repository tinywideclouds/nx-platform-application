import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactsSecurityComponent } from './contacts-security.component';
import {
  ContactsStorageService,
  PendingIdentity,
} from '@nx-platform-application/contacts-storage';
import { URN } from '@nx-platform-application/platform-types';
import { MockComponent, MockProvider } from 'ng-mocks';
import { PendingListComponent } from '../pending-list/pending-list.component';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';

// Test Data
const MOCK_PENDING: PendingIdentity = {
  urn: URN.parse('urn:auth:google:stranger'),
  firstSeenAt: '2025-01-01T00:00:00Z' as any,
};

describe('ContactsSecurityComponent', () => {
  let component: ContactsSecurityComponent;
  let fixture: ComponentFixture<ContactsSecurityComponent>;
  let contactsService: ContactsStorageService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactsSecurityComponent, MockComponent(PendingListComponent)],
      providers: [
        MockProvider(ContactsStorageService, {
          // Mock the signal stream
          pending$: of([MOCK_PENDING]),
          deletePending: vi.fn(),
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactsSecurityComponent);
    component = fixture.componentInstance;
    contactsService = TestBed.inject(ContactsStorageService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load pending requests from storage', () => {
    // The component uses toSignal, so it should read the observable immediately
    expect(component.pending()).toEqual([MOCK_PENDING]);
  });

  it('should delegate APPROVE action to storage', async () => {
    await component.approveIdentity(MOCK_PENDING);
    // Approving just means removing it from the pending list (and usually adding to contacts, handled elsewhere or implicit)
    expect(contactsService.deletePending).toHaveBeenCalledWith(
      MOCK_PENDING.urn
    );
  });

  it('should delegate BLOCK action to storage', async () => {
    await component.blockPending(MOCK_PENDING);

    expect(contactsService.deletePending).toHaveBeenCalledWith(
      MOCK_PENDING.urn
    );
  });
});
