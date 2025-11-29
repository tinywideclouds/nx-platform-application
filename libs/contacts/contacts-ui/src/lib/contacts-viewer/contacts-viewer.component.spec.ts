import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Router, ActivatedRoute, convertToParamMap } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

// --- ARTIFACTS UNDER TEST ---
import { ContactsViewerComponent } from './contacts-viewer.component';
import {
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-storage';
import { URN } from '@nx-platform-application/platform-types';

// --- REAL DEPENDENCIES (Needed for removal) ---
import { MasterDetailLayoutComponent } from '@nx-platform-application/platform-ui-toolkit';
import { ContactsSidebarComponent } from '../contacts-sidebar/contacts-sidebar.component';
import { ContactDetailComponent } from '../contact-detail/contact-detail.component';
import { ContactGroupPageComponent } from '../contact-group-page/contact-group-page.component';
import { ContactPageComponent } from '../contact-page/contact-page.component';

// --- STUBS ---

@Component({
  selector: 'contacts-sidebar',
  standalone: true,
  template: '',
})
class StubSidebarComponent {
  @Input() selectedId: string | undefined;
  @Input() tabIndex = 0;
  @Output() contactSelected = new EventEmitter<Contact>();
  @Output() groupSelected = new EventEmitter<ContactGroup>();
  @Output() tabChange = new EventEmitter<any>();
}

@Component({
  selector: 'contacts-detail',
  standalone: true,
  template: '',
})
class StubContactDetailComponent {
  @Input() contactId!: URN;
}

@Component({
  selector: 'contacts-group-page',
  standalone: true,
  template: '',
})
class StubGroupPageComponent {
  @Input() groupId: URN | undefined;
}

@Component({
  selector: 'contacts-page',
  standalone: true,
  template: '',
})
class StubContactPageComponent {
  // No inputs needed for creation mode in this context
}

@Component({
  selector: 'lib-master-detail-layout',
  standalone: true,
  template:
    '<ng-content select="[sidebar]"></ng-content><ng-content select="[main]"></ng-content>',
})
class StubLayoutComponent {
  @Input() showDetail = false;
}

// --- MOCK DATA ---
const mockContactUrn = 'urn:contacts:user:123';
const mockContact = { id: URN.parse(mockContactUrn) } as Contact;

describe('ContactsViewerComponent', () => {
  let fixture: ComponentFixture<ContactsViewerComponent>;
  let component: ContactsViewerComponent;
  let router: Router;
  let queryParamsSubject: Subject<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    queryParamsSubject = new Subject();

    await TestBed.configureTestingModule({
      imports: [ContactsViewerComponent, NoopAnimationsModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: queryParamsSubject.asObservable(),
            snapshot: { queryParamMap: convertToParamMap({}) },
          },
        },
      ],
    })
      .overrideComponent(ContactsViewerComponent, {
        remove: {
          imports: [
            MasterDetailLayoutComponent,
            ContactsSidebarComponent,
            ContactDetailComponent,
            ContactGroupPageComponent,
            ContactPageComponent,
          ],
        },
        add: {
          imports: [
            StubLayoutComponent,
            StubSidebarComponent,
            StubContactDetailComponent,
            StubGroupPageComponent,
            StubContactPageComponent,
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ContactsViewerComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');

    fixture.detectChanges();
  });

  // --- STATE DERIVATION TESTS ---

  it('should parse selectedId Input into selectedUrn Signal', async () => {
    fixture.componentRef.setInput('selectedId', mockContactUrn);
    await fixture.whenStable();
    expect(component.selectedUrn()?.toString()).toBe(mockContactUrn);
  });

  it('should calculate activeTab and tabIndex from QueryParams', async () => {
    // 1. Default State (Contacts)
    expect(component.activeTab()).toBe('contacts');
    expect(component.tabIndex()).toBe(0);

    // 2. Groups State
    queryParamsSubject.next(convertToParamMap({ tab: 'groups' }));
    await fixture.whenStable();
    expect(component.activeTab()).toBe('groups');
    expect(component.tabIndex()).toBe(1);

    // 3. Manage State
    queryParamsSubject.next(convertToParamMap({ tab: 'manage' }));
    await fixture.whenStable();
    expect(component.activeTab()).toBe('manage');
    expect(component.tabIndex()).toBe(2);
  });

  // --- CREATION MODE TESTS (NEW) ---

  it('should identify Creation Mode for Contact from QueryParams', async () => {
    queryParamsSubject.next(convertToParamMap({ new: 'contact' }));
    await fixture.whenStable();

    expect(component.createMode()).toBe('contact');
    fixture.detectChanges();

    // Check if the Contact Page Stub is rendered
    const page = fixture.debugElement.query(
      By.directive(StubContactPageComponent)
    );
    expect(page).toBeTruthy();
  });

  it('should identify Creation Mode for Group from QueryParams', async () => {
    queryParamsSubject.next(convertToParamMap({ new: 'group' }));
    await fixture.whenStable();

    expect(component.createMode()).toBe('group');
    fixture.detectChanges();

    // Check if the Group Page Stub is rendered
    const page = fixture.debugElement.query(
      By.directive(StubGroupPageComponent)
    );
    expect(page).toBeTruthy();
  });

  // --- ACTION -> ROUTER TESTS ---

  it('should update URL when Sidebar emits tabChange', () => {
    const sidebar = fixture.debugElement.query(
      By.directive(StubSidebarComponent)
    );
    sidebar.componentInstance.tabChange.emit({ index: 1 });

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { tab: 'groups', selectedId: null, new: null },
        queryParamsHandling: 'merge',
      })
    );
  });

  it('should update URL when Sidebar emits contactSelected (Default Mode)', () => {
    const sidebar = fixture.debugElement.query(
      By.directive(StubSidebarComponent)
    );
    sidebar.componentInstance.contactSelected.emit(mockContact);

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { selectedId: mockContactUrn, new: null },
        queryParamsHandling: 'merge',
      })
    );
  });

  it('should emit Output instead of navigating when in Selection Mode', () => {
    fixture.componentRef.setInput('selectionMode', true);
    fixture.detectChanges();

    const spy = vi.spyOn(component.contactSelected, 'emit');
    const sidebar = fixture.debugElement.query(
      By.directive(StubSidebarComponent)
    );

    sidebar.componentInstance.contactSelected.emit(mockContact);

    expect(spy).toHaveBeenCalledWith(mockContact);
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
