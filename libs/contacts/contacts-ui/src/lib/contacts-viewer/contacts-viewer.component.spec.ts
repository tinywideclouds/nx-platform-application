// libs/contacts/contacts-ui/src/lib/components/contacts-viewer/contacts-viewer.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Router, ActivatedRoute, convertToParamMap } from '@angular/router';
import { Subject } from 'rxjs';
import { map } from 'rxjs/operators'; // ✅ Needed for the fix
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

// --- ARTIFACTS UNDER TEST ---
import { ContactsViewerComponent } from './contacts-viewer.component';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';

// --- REAL DEPENDENCIES (Needed for removal override) ---
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
  @Input() contactId: URN | undefined;
  @Output() saved = new EventEmitter<void>();
  @Output() deleted = new EventEmitter<void>();
}

@Component({
  selector: 'contacts-page',
  standalone: true,
  template: '',
})
class StubContactPageComponent {
  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}

@Component({
  selector: 'contacts-group-page',
  standalone: true,
  template: '',
})
class StubContactGroupPageComponent {
  @Input() groupId: URN | undefined;
  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}

// --- MOCK DATA ---
const mockContactUrn = 'urn:contacts:user:123';
const mockContact: Contact = {
  id: URN.parse(mockContactUrn),
  alias: 'Alice',
} as any;

describe('ContactsViewerComponent', () => {
  let component: ContactsViewerComponent;
  let fixture: ComponentFixture<ContactsViewerComponent>;
  let router: Router;
  let queryParamsSubject = new Subject<any>();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactsViewerComponent, NoopAnimationsModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            // ✅ CRITICAL FIX: Provide queryParamMap as an Observable
            // This satisfies `toSignal(this.route.queryParamMap)`
            queryParamMap: queryParamsSubject.pipe(
              map((params) => convertToParamMap(params)),
            ),
            // We also keep queryParams just in case legacy code uses it
            queryParams: queryParamsSubject.asObservable(),
            snapshot: {
              queryParams: {},
              queryParamMap: convertToParamMap({}),
            },
          },
        },
      ],
    })
      .overrideComponent(ContactsViewerComponent, {
        remove: {
          imports: [
            ContactsSidebarComponent,
            ContactDetailComponent,
            ContactPageComponent,
            ContactGroupPageComponent,
          ],
        },
        add: {
          imports: [
            StubSidebarComponent,
            StubContactDetailComponent,
            StubContactPageComponent,
            StubContactGroupPageComponent,
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ContactsViewerComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);

    vi.spyOn(router, 'navigate').mockImplementation(() =>
      Promise.resolve(true),
    );

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should clear selection when Contact Page emits (saved)', () => {
    queryParamsSubject.next({ new: 'contact' });
    fixture.detectChanges();

    const page = fixture.debugElement.query(
      By.directive(StubContactPageComponent),
    );
    expect(page).toBeTruthy();

    page.componentInstance.saved.emit();

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { selectedId: null, new: null },
      }),
    );
  });

  it('should clear selection when Group Page emits (cancelled)', () => {
    queryParamsSubject.next({ new: 'group' });
    fixture.detectChanges();

    const page = fixture.debugElement.query(
      By.directive(StubContactGroupPageComponent),
    );
    expect(page).toBeTruthy();

    page.componentInstance.cancelled.emit();

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { selectedId: null, new: null },
      }),
    );
  });
});
