// libs/contacts/contacts-ui/src/lib/components/contact-page-form/contact-form.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { ContactFormComponent } from './contact-form.component';
import { Contact } from '@nx-platform-application/contacts-data-access';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips'; // <-- Import

const mockContact: Contact = {
  id: URN.parse('urn:sm:user:user-123'),
  alias: 'johndoe',
  email: 'john@example.com',
  firstName: 'John',
  surname: 'Doe',
  phoneNumbers: ['+15550100'],
  emailAddresses: ['john@work.com'],
  serviceContacts: {
    messenger: {
      id: URN.parse('urn:sm:service:msg-uuid-1'),
      alias: 'jd_messenger',
      lastSeen: '2023-01-01T12:00:00Z' as ISODateTimeString,
    },
  },
};

// Mock linked identities
const mockIdentities = [
  URN.parse('urn:auth:google:bob@google.com'),
  URN.parse('urn:auth:apple:bob@mac.com'),
];

describe('ContactFormComponent (Signal-based)', () => {
  let fixture: ComponentFixture<ContactFormComponent>;
  let component: ContactFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ContactFormComponent,
        ReactiveFormsModule,
        NoopAnimationsModule,
        MatFormFieldModule,
        MatInputModule,
        MatIconModule,
        MatButtonModule,
        MatChipsModule,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ... (Existing tests remain unchanged) ...

  it('should display linked identities when provided', () => {
    // 1. Set inputs
    fixture.componentRef.setInput('contact', mockContact);
    fixture.componentRef.setInput('linkedIdentities', mockIdentities);
    fixture.detectChanges();

    // 2. Query for chips
    const chips = fixture.debugElement.queryAll(
      By.css('[data-testid="identity-chip"]')
    );

    // 3. Assert
    expect(chips.length).toBe(2);
    
    // Check content formatting
    const firstChipText = chips[0].nativeElement.textContent;
    expect(firstChipText).toContain('Google');
    expect(firstChipText).toContain('bob@google.com');
  });

  it('should not display linked identities section if empty', () => {
    fixture.componentRef.setInput('contact', mockContact);
    fixture.componentRef.setInput('linkedIdentities', []);
    fixture.detectChanges();

    const chips = fixture.debugElement.queryAll(
      By.css('[data-testid="identity-chip"]')
    );
    expect(chips.length).toBe(0);
  });
});