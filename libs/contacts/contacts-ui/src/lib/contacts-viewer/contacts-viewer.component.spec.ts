import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Router, ActivatedRoute, convertToParamMap } from '@angular/router';
import { Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { ContactsViewerComponent } from './contacts-viewer.component';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';

import { ContactsSidebarComponent } from '../contacts-sidebar/contacts-sidebar.component';
import { ContactGroupPageComponent } from '../contact-group-page/contact-group-page.component';
import { ContactPageComponent } from '../contact-page/contact-page.component';

// --- STUBS ---

@Component({ selector: 'contacts-sidebar', standalone: true, template: '' })
class StubSidebarComponent {
  @Input() selectedId: string | undefined;
  @Input() tabIndex = 0;
  @Output() contactSelected = new EventEmitter<Contact>();
  @Output() groupSelected = new EventEmitter<ContactGroup>();
  @Output() tabChange = new EventEmitter<any>();
}

@Component({ selector: 'contacts-page', standalone: true, template: '' })
class StubContactPageComponent {
  @Input() selectedUrn: URN | undefined;
  @Output() saved = new EventEmitter<Contact>();
  @Output() deleted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}

@Component({ selector: 'contacts-group-page', standalone: true, template: '' })
class StubContactGroupPageComponent {
  @Input() groupId: URN | undefined;
  @Output() saved = new EventEmitter<ContactGroup>();
  @Output() deleted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}

const mockContact: Contact = { id: URN.parse('urn:contacts:user:123') } as any;

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
            queryParamMap: queryParamsSubject.pipe(
              map((params) => convertToParamMap(params)),
            ),
            queryParams: queryParamsSubject.asObservable(),
            snapshot: { queryParams: {}, queryParamMap: convertToParamMap({}) },
          },
        },
      ],
    })
      .overrideComponent(ContactsViewerComponent, {
        remove: {
          imports: [
            ContactsSidebarComponent,
            ContactPageComponent,
            ContactGroupPageComponent,
          ],
        },
        add: {
          imports: [
            StubSidebarComponent,
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

  it('should navigate to specific ID (View Mode) when Contact Page emits (saved)', () => {
    queryParamsSubject.next({ new: 'contact' });
    fixture.detectChanges();

    const page = fixture.debugElement.query(
      By.directive(StubContactPageComponent),
    );
    expect(page).toBeTruthy();

    page.componentInstance.saved.emit(mockContact);

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { selectedId: 'urn:contacts:user:123', new: null },
      }),
    );
  });

  it('should clear selection when Contact Page emits (deleted)', () => {
    // 1. Setup Input State (Manually simulate the Router binding input)
    fixture.componentRef.setInput('selectedId', 'urn:contacts:user:123');
    fixture.detectChanges();

    // 2. Query Page
    const page = fixture.debugElement.query(
      By.directive(StubContactPageComponent),
    );
    expect(page).toBeTruthy(); // Ensure page exists

    // 3. Simulate Delete
    page.componentInstance.deleted.emit();

    // 4. Expect Navigation
    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { selectedId: null, new: null },
      }),
    );
  });
});
