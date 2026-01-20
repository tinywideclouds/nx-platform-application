import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { Contact } from '@nx-platform-application/contacts-types';
import { Temporal } from '@js-temporal/polyfill';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import {
  expectIntention,
  DISCARD_TRIGGER_NAME,
} from '@nx-platform-application/platform-ux-intention';

import { ContactListComponent } from './contact-list.component';
import { ContactListItemComponent } from '../contact-list-item/contact-list-item.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

const MOCK_CONTACTS: Contact[] = [
  {
    id: URN.parse('urn:contacts:user:user-123'),
    alias: 'johndoe',
    email: 'john@example.com',
    firstName: 'John',
    lastModified: Temporal.Now.instant().toString() as ISODateTimeString,
    surname: 'Doe',
    phoneNumbers: [],
    emailAddresses: [],
    serviceContacts: {},
  },
  {
    id: URN.parse('urn:contacts:user:user-456'),
    alias: 'janedoe',
    email: 'jane@example.com',
    firstName: 'Jane',
    lastModified: Temporal.Now.instant().toString() as ISODateTimeString,
    surname: 'Doe',
    phoneNumbers: [],
    emailAddresses: [],
    serviceContacts: {},
  },
];

@Component({
  standalone: true,
  imports: [ContactListComponent],
  template: `
    <contacts-list
      [contacts]="contacts"
      [selectedId]="selectedId"
      (contactSelected)="onSelected($event)"
    />
  `,
})
class TestHostComponent {
  contacts = MOCK_CONTACTS;
  selectedId: string | undefined = undefined;
  selectedContact?: Contact;
  onSelected(contact: Contact) {
    this.selectedContact = contact;
  }
}

describe('ContactListComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let hostComponent: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        TestHostComponent,
        ContactListComponent,
        ContactListItemComponent,
        NoopAnimationsModule, // Required for the animation trigger to exist safely
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
  });

  it('should render correct number of items', () => {
    fixture.detectChanges();
    const items = fixture.debugElement.queryAll(By.css('contacts-list-item'));
    expect(items.length).toBe(2);
  });

  it('should highlight the selected contact based on input', () => {
    hostComponent.selectedId = 'urn:contacts:user:user-123';
    fixture.detectChanges();

    const items = fixture.debugElement.queryAll(By.css('contacts-list-item'));
    expect(items[0].nativeElement.classList).toContain('bg-blue-50');
    expect(items[0].nativeElement.classList).toContain('border-l-4');
  });

  // describe('Physics & Intentions', () => {
  //   it('should have animations configured', () => {
  //     // Access the compiled component definition
  //     // We cast to 'any' because ɵcmp is internal, but stable in Ivy
  //     const componentDef = (ContactListComponent as any).ɵcmp;

  //     // 1. Verify animations exist in the metadata
  //     // In Angular's compiled output, animations are stored in `data.animation`
  //     const animations = componentDef?.data?.animation;

  //     // 2. The Defensive Assertion
  //     // Fails only if 'animations: []' is removed or empty
  //     expect(animations).toBeDefined();
  //     expect(animations.length).toBeGreaterThan(0);
  //   });

  //   it('should explicitly include the "discard" animation', () => {
  //     const animations =
  //       (ContactListComponent as any).ɵcmp.data.animation || [];
  //     const hasFade = animations.some((a: any) => a.name === 'discard');

  //     expect(hasFade).toBe(true);
  //   });
  // });

  describe('Physics & Intentions', () => {
    it('should enforce the "Discard" intention', () => {
      // One line. Readable. Fails with a clear error message.
      expectIntention(ContactListComponent, DISCARD_TRIGGER_NAME);
    });
  });
});
