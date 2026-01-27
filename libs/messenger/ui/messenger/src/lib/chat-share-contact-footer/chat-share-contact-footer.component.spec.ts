import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatShareContactFooterComponent } from './chat-share-contact-footer.component';
import {
  ContactsStorageService,
  Contact,
} from '@nx-platform-application/contacts-infrastructure-storage';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { vi } from 'vitest';
import { MockProvider } from 'ng-mocks';
import { By } from '@angular/platform-browser';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';

const mockUrn1 = URN.parse('urn:contacts:user:1');
const mockUrn2 = URN.parse('urn:contacts:user:2');

const mockContact1: Contact = {
  id: mockUrn1,
  alias: 'Alice',
  firstName: 'Alice',
  surname: 'A',
  email: 'a@a.com',
  lastModified: '' as ISODateTimeString,
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
  lastModified: '' as ISODateTimeString,
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
    // 1. REFACTOR: Simulate Input
    const inputEl = fixture.debugElement.query(By.css('input')).nativeElement;
    inputEl.value = 'Alice';
    inputEl.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.filteredContacts().length).toBe(1);
    expect(component.filteredContacts()[0].alias).toBe('Alice');

    // 2. Search for Bob
    inputEl.value = 'Bob';
    inputEl.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.filteredContacts().length).toBe(1);
    expect(component.filteredContacts()[0].alias).toBe('Bob');
  });

  it('should update selectedRecipient on option selected', () => {
    // Manually trigger the handler since simulating the full Material overlay in unit tests is flaky
    const event = {
      option: { value: mockContact2 },
    } as MatAutocompleteSelectedEvent;

    component.onOptionSelected(event);
    fixture.detectChanges();

    expect(component.selectedRecipient()).toBe(mockContact2);
    // Should also update the display text
    expect(component.searchQuery()).toBe('Bob');
  });

  it('should emit share event on send', () => {
    const spy = vi.spyOn(component.share, 'emit');

    // Select Bob manually
    component.selectedRecipient.set(mockContact2);
    fixture.detectChanges();

    component.onSend();

    expect(spy).toHaveBeenCalledWith(mockUrn2);
    expect(component.searchQuery()).toBe('');
    expect(component.selectedRecipient()).toBeNull();
  });
});
