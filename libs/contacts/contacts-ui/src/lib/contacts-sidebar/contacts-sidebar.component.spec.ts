import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactsSidebarComponent } from './contacts-sidebar.component';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-storage';
import { BehaviorSubject } from 'rxjs';
import { MockComponent, MockProvider } from 'ng-mocks';
import { provideRouter } from '@angular/router';
import { URN } from '@nx-platform-application/platform-types';

// Child Components
import { ContactListComponent } from '../contact-list/contact-list.component';
import { ContactGroupListComponent } from '../contact-group-list/contact-group-list.component';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';

const mockContacts: Contact[] = [
  {
    id: URN.parse('urn:contacts:user:1'),
    alias: 'Alice',
    firstName: 'Alice',
    surname: 'Wonder',
    email: 'alice@test.com',
  } as Contact,
  {
    id: URN.parse('urn:contacts:user:2'),
    alias: 'Bob',
    firstName: 'Bob',
    surname: 'Builder',
    email: 'bob@test.com',
  } as Contact,
];

describe('ContactsSidebarComponent', () => {
  let fixture: ComponentFixture<ContactsSidebarComponent>;
  let component: ContactsSidebarComponent;
  let contacts$ = new BehaviorSubject<Contact[]>([]);
  let groups$ = new BehaviorSubject<ContactGroup[]>([]);

  beforeEach(async () => {
    contacts$ = new BehaviorSubject<Contact[]>([]);

    await TestBed.configureTestingModule({
      imports: [
        ContactsSidebarComponent,
        MockComponent(ContactListComponent),
        MockComponent(ContactGroupListComponent),
        MockComponent(ContactsPageToolbarComponent),
      ],
      providers: [
        provideRouter([]),
        MockProvider(ContactsStorageService, {
          contacts$: contacts$,
          groups$: groups$,
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactsSidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show all contacts when filter is empty', () => {
    contacts$.next(mockContacts);
    fixture.detectChanges();

    const result = component.filteredContacts();
    expect(result.length).toBe(2);
  });

  it('should filter contacts by alias (case insensitive)', () => {
    contacts$.next(mockContacts);
    fixture.componentRef.setInput('filterQuery', 'alice');
    fixture.detectChanges();

    const result = component.filteredContacts();
    expect(result.length).toBe(1);
    expect(result[0].alias).toBe('Alice');
  });

  it('should return empty array if no matches', () => {
    contacts$.next(mockContacts);
    fixture.componentRef.setInput('filterQuery', 'charlie');
    fixture.detectChanges();

    const result = component.filteredContacts();
    expect(result.length).toBe(0);
  });
});
