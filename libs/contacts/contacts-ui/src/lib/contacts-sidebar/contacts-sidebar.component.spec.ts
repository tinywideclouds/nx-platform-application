import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactsSidebarComponent } from './contacts-sidebar.component';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { of } from 'rxjs';
import { MockComponent, MockProvider } from 'ng-mocks';
import { provideRouter } from '@angular/router';

// Child Components
import { ContactListComponent } from '../contact-list/contact-list.component';
import { ContactGroupListComponent } from '../contact-group-list/contact-group-list.component';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';

describe('ContactsSidebarComponent', () => {
  let fixture: ComponentFixture<ContactsSidebarComponent>;
  let component: ContactsSidebarComponent;

  beforeEach(async () => {
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
          contacts$: of([]),
          groups$: of([]),
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
});
