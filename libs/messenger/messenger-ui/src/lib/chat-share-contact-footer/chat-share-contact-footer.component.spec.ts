import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatShareContactFooterComponent } from './chat-share-contact-footer.component';
import {
  ContactsStorageService,
  Contact,
} from '@nx-platform-application/contacts-storage';
import { URN } from '@nx-platform-application/platform-types';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { vi } from 'vitest';
import { MockProvider } from 'ng-mocks';

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

describe('ChatShareContactFooterComponent', () => {
  let component: ChatShareContactFooterComponent;
  let fixture: ComponentFixture<ChatShareContactFooterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatShareContactFooterComponent, NoopAnimationsModule],
      providers: [
        MockProvider(ContactsStorageService, {
          contacts$: of([mockContact1, mockContact2]),
        }),
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
    // 1. Search for "Alice"
    component.searchControl.setValue('Alice');
    fixture.detectChanges();

    expect(component.filteredContacts().length).toBe(1);
    expect(component.filteredContacts()[0].alias).toBe('Alice');

    // 2. Search for "Bob"
    component.searchControl.setValue('Bob');
    fixture.detectChanges();

    expect(component.filteredContacts().length).toBe(1);
    expect(component.filteredContacts()[0].alias).toBe('Bob');
  });

  it('should exclude the contact being shared', async () => {
    // We are viewing Alice's card
    fixture.componentRef.setInput('contactToShare', mockUrn1);
    fixture.detectChanges();

    // Empty search should return all EXCEPT Alice (so just Bob)
    component.searchControl.setValue('');
    fixture.detectChanges();

    const filtered = component.filteredContacts();
    expect(filtered.length).toBe(1);
    expect(filtered[0].alias).toBe('Bob');
  });

  it('should emit share event on send', () => {
    const spy = vi.spyOn(component.share, 'emit');

    // Select Bob manually
    component.selectedRecipient.set(mockContact2);
    fixture.detectChanges();

    component.onSend();

    expect(spy).toHaveBeenCalledWith(mockUrn2);
    expect(component.searchControl.value).toBe('');
    expect(component.selectedRecipient()).toBeNull();
  });
});
