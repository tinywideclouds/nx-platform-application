import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactsSecurityComponent } from './contacts-security.component';
import { ContactsStateService } from '@nx-platform-application/contacts-state';
import { PendingIdentity } from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';
import { MockComponent, MockProvider } from 'ng-mocks';
import { PendingListComponent } from '../pending-list/pending-list.component';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';

const MOCK_PENDING: PendingIdentity = {
  urn: URN.parse('urn:auth:google:stranger'),
  firstSeenAt: '2025-01-01T00:00:00Z' as any,
};

describe('ContactsSecurityComponent', () => {
  let component: ContactsSecurityComponent;
  let fixture: ComponentFixture<ContactsSecurityComponent>;
  let stateService: ContactsStateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactsSecurityComponent, MockComponent(PendingListComponent)],
      providers: [
        // ✅ CORRECT: Mock the State Service directly
        MockProvider(ContactsStateService, {
          pending: signal([MOCK_PENDING]),
          deletePending: vi.fn(),
          blockIdentity: vi.fn(),
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactsSecurityComponent);
    component = fixture.componentInstance;
    stateService = TestBed.inject(ContactsStateService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load pending requests from state', () => {
    expect(component.pending()).toEqual([MOCK_PENDING]);
  });

  it('should delegate APPROVE action to state', async () => {
    await component.approveIdentity(MOCK_PENDING);
    expect(stateService.deletePending).toHaveBeenCalledWith(MOCK_PENDING.urn);
  });

  it('should delegate BLOCK action to state', async () => {
    await component.blockPending(MOCK_PENDING);
    expect(stateService.blockIdentity).toHaveBeenCalledWith(MOCK_PENDING.urn, [
      'messenger',
    ]);
  });
});
