import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactsViewerComponent } from './contacts-viewer.component';
import {
  ActivatedRoute,
  ParamMap,
  Router,
  convertToParamMap,
} from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabChangeEvent } from '@angular/material/tabs';

// Types
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';

// Test Utils
import { BehaviorSubject, of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Component, input, output } from '@angular/core';
import { By } from '@angular/platform-browser';

// --- MANUAL MOCKS ---

@Component({
  selector: 'platform-master-detail-layout',
  template:
    '<ng-content select="[sidebar]"></ng-content><ng-content select="[main]"></ng-content>',
  standalone: true,
})
class MockLayoutComponent {
  showDetail = input<boolean>(false);
  isNarrowChange = output<boolean>();
}

@Component({
  selector: 'contacts-sidebar',
  template: '',
  standalone: true,
})
class MockSidebarComponent {
  selectedId = input<string | null>(null);
  tabIndex = input<number>(0);
  contactSelected = output<Contact>();
  groupSelected = output<ContactGroup>();
  contactEditRequested = output<Contact>();
  contactDeleted = output<void>();
  tabChange = output<MatTabChangeEvent>();
}

@Component({
  selector: 'contacts-page',
  template: '',
  standalone: true,
})
class MockContactPageComponent {
  selectedUrn = input<URN>();
  isMobile = input<boolean>(false);
  saved = output<Contact>();
  deleted = output<void>();
  cancelled = output<void>();
  editRequested = output<Contact>();
}

@Component({
  selector: 'contacts-group-page',
  template: '',
  standalone: true,
})
class MockGroupPageComponent {
  groupId = input<URN>();
  saved = output<ContactGroup>();
  deleted = output<void>();
  cancelled = output<void>();
}

describe('ContactsViewerComponent', () => {
  let component: ContactsViewerComponent;
  let fixture: ComponentFixture<ContactsViewerComponent>;
  let router: Router;

  // FIX: Declare here, but initialize in beforeEach to prevent state leaks
  let queryParamsSubject: BehaviorSubject<ParamMap>;

  beforeEach(async () => {
    // FIX: Fresh subject for every test
    queryParamsSubject = new BehaviorSubject(convertToParamMap({}));

    // Robust Route Mock
    const mockActivatedRoute = {
      queryParamMap: queryParamsSubject.asObservable(),
      paramMap: of(convertToParamMap({})),
      snapshot: {
        paramMap: convertToParamMap({}),
        queryParamMap: convertToParamMap({}),
      },
      data: of({}),
      url: of([]),
    };

    await TestBed.configureTestingModule({
      imports: [ContactsViewerComponent],
      providers: [
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    })
      .overrideComponent(ContactsViewerComponent, {
        set: {
          imports: [
            MatButtonModule,
            MatIconModule,
            MockLayoutComponent,
            MockSidebarComponent,
            MockContactPageComponent,
            MockGroupPageComponent,
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ContactsViewerComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  function setQueryParams(params: Record<string, string | null>) {
    const cleanParams: Record<string, string> = {};
    Object.entries(params).forEach(([k, v]) => {
      if (v !== null) cleanParams[k] = v;
    });
    queryParamsSubject.next(convertToParamMap(cleanParams));
    fixture.detectChanges();
  }

  describe('Child Component Rendering', () => {
    it('should render Contact Page when a Contact URN is selected', () => {
      const id = URN.create('user', '123', 'contacts').toString();
      fixture.componentRef.setInput('selectedId', id);
      fixture.detectChanges();

      const page = fixture.debugElement.query(
        By.directive(MockContactPageComponent),
      );
      expect(page).toBeTruthy();
      expect(page.componentInstance.selectedUrn().toString()).toBe(id);
    });

    it('should render Group Page when createMode is "group"', () => {
      setQueryParams({ new: 'group' });
      const page = fixture.debugElement.query(
        By.directive(MockGroupPageComponent),
      );
      expect(page).toBeTruthy();
    });
  });

  describe('Orchestration & Navigation', () => {
    it('should navigate to update URL when Sidebar emits tab change', () => {
      const sidebar = fixture.debugElement.query(
        By.directive(MockSidebarComponent),
      );
      (sidebar.componentInstance as MockSidebarComponent).tabChange.emit({
        index: 1,
      } as MatTabChangeEvent);

      expect(router.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: expect.objectContaining({ tab: 'groups' }),
        }),
      );
    });

    it('should handle "Saved" event from Contact Page', () => {
      // 1. Setup State: Clean Params + Selected ID
      const id = URN.create('user', '123', 'contacts').toString();
      fixture.componentRef.setInput('selectedId', id);
      setQueryParams({}); // Ensure 'tab' is not 'groups'
      fixture.detectChanges();

      // 2. Query Page (Should exist now)
      const page = fixture.debugElement.query(
        By.directive(MockContactPageComponent),
      );
      expect(page).toBeTruthy(); // Sanity check

      // 3. Emit Saved
      const contact = { id: URN.create('user', '123', 'contacts') } as Contact;
      (page.componentInstance as MockContactPageComponent).saved.emit(contact);

      expect(router.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: expect.objectContaining({
            selectedId: contact.id.toString(),
            new: null,
          }),
        }),
      );
    });

    it('should handle "Deleted" event (Clear Selection)', () => {
      const id = URN.create('user', '123', 'contacts').toString();
      fixture.componentRef.setInput('selectedId', id);
      setQueryParams({});
      fixture.detectChanges();

      const page = fixture.debugElement.query(
        By.directive(MockContactPageComponent),
      );
      (page.componentInstance as MockContactPageComponent).deleted.emit();

      expect(router.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: expect.objectContaining({ selectedId: null }),
        }),
      );
    });

    it('should handle "Cancelled" event logic', () => {
      setQueryParams({ mode: null });
      component.onEditCancel();

      expect(router.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: expect.objectContaining({ selectedId: null }),
        }),
      );
    });
  });
});
