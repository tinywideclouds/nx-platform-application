// libs/messenger/messenger-ui/src/lib/chat-share-contact-footer/chat-share-contact-footer.component.spec.ts

import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { ChatShareContactFooterComponent } from './chat-share-contact-footer.component';
import {
  ContactsStorageService,
  Contact,
} from '@nx-platform-application/contacts-access';
import { URN } from '@nx-platform-application/platform-types';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { vi } from 'vitest';

const mockUrn1 = URN.parse('urn:sm:user:1');
const mockUrn2 = URN.parse('urn:sm:user:2');

const mockContact1: Contact = {
  id: mockUrn1,
  alias: 'Alice',
  firstName: 'Alice',
  surname: 'A',
  email: 'a@a.com',
  phoneNumbers: [],
  emailAddresses: [],
  serviceContacts: {},
};

const mockContact2: Contact = {
  id: mockUrn2,
  alias: 'Bob',
  firstName: 'Bob',
  surname: 'B',
  email: 'b@b.com',
  phoneNumbers: [],
  emailAddresses: [],
  serviceContacts: {},
};

const mockContactsService = {
  contacts$: of([mockContact1, mockContact2]),
};

describe('ChatShareContactFooterComponent', () => {
  let component: ChatShareContactFooterComponent;
  let fixture: ComponentFixture<ChatShareContactFooterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatShareContactFooterComponent, NoopAnimationsModule],
      providers: [
        { provide: ContactsStorageService, useValue: mockContactsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatShareContactFooterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should filter contacts based on search text', async () => {
    // Need to wait for signal initial value
    await fixture.whenStable();

    // 1. Search for "Alice"
    component.searchControl.setValue('Alice');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.filteredContacts().length).toBe(1);
    expect(component.filteredContacts()[0].alias).toBe('Alice');

    // 2. Search for "Bob"
    component.searchControl.setValue('Bob');
    fixture.detectChanges();

    expect(component.filteredContacts().length).toBe(1);
    expect(component.filteredContacts()[0].alias).toBe('Bob');
  });

  it('should exclude the contact being shared', async () => {
    // We are viewing Alice's card, so we shouldn't share Alice with herself
    fixture.componentRef.setInput('contactToShare', mockUrn1);
    fixture.detectChanges();
    await fixture.whenStable();

    // Empty search should return all EXCEPT Alice
    component.searchControl.setValue('');
    fixture.detectChanges();

    const filtered = component.filteredContacts();
    expect(filtered.length).toBe(1);
    expect(filtered[0].alias).toBe('Bob');
  });

  it('should emit share event on send', () => {
    const spy = vi.spyOn(component.share, 'emit');

    // Select Bob
    component.selectedRecipient.set(mockContact2);
    fixture.detectChanges();

    component.onSend();

    expect(spy).toHaveBeenCalledWith(mockUrn2);
    expect(component.searchControl.value).toBe(''); // Should reset
    expect(component.selectedRecipient()).toBeNull();
  });
});
