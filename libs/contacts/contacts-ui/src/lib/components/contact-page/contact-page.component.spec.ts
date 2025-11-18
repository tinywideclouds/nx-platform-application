// libs/contacts/contacts-ui/src/lib/components/contact-page/contact-page.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { vi } from 'vitest';
import { ContactPageComponent } from './contact-page.component';
import { Subject } from 'rxjs';
import { By } from '@angular/platform-browser';
import { URN } from '@nx-platform-application/platform-types';
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Component, Input, Output, EventEmitter, signal } from '@angular/core';

// --- 1. Import Real Components for Removal ---
// We need these references to tell TestBed to remove them
import { ContactDetailComponent } from '../contact-detail/contact-detail.component';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';

// --- 2. Define Mocks ---

@Component({
  selector: 'contacts-page-toolbar',
  standalone: true,
  template: '<ng-content></ng-content>',
  exportAs: 'toolbar'
})
class MockContactsPageToolbarComponent {
  @Input() title = '';
  mode = signal<'full' | 'compact'>('full');
}

@Component({
  selector: 'contacts-detail',
  standalone: true,
  template: '<div>Mock Detail</div>'
})
class MockContactDetailComponent {
  @Input() contactId!: URN;
  @Input() startInEditMode = false;
  @Output() saved = new EventEmitter<void>();
}

const mockContactUrnString = 'urn:sm:user:user-123';
const mockActivatedRoute = {
  paramMap: new Subject(),
};

describe('ContactPageComponent (Router Wrapper)', () => {
  let fixture: ComponentFixture<ContactPageComponent>;
  let component: ContactPageComponent;
  let router: Router;

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([]),
        NoopAnimationsModule,
        ContactPageComponent, 
      ],
      providers: [
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    })
    .overrideComponent(ContactPageComponent, {
      // FIX: Explicitly remove the real components
      remove: { 
        imports: [
          ContactDetailComponent,
          ContactsPageToolbarComponent 
        ] 
      },
      // Add the mocks in their place
      add: { 
        imports: [
          MockContactDetailComponent, 
          MockContactsPageToolbarComponent
        ] 
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(ContactPageComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');
    
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should navigate on (close) from TOOLBAR', () => {
    mockActivatedRoute.paramMap.next({ get: () => mockContactUrnString });
    fixture.detectChanges();
    
    const closeBtn = fixture.debugElement.query(By.css('[data-testid="close-button"]'));
    expect(closeBtn).toBeTruthy();

    closeBtn.nativeElement.click();
    expect(router.navigate).toHaveBeenCalledWith(['/contacts'], expect.anything());
  });

  it('should navigate on (saved) from CHILD', () => {
    mockActivatedRoute.paramMap.next({ get: () => mockContactUrnString });
    fixture.detectChanges();

    const detail = fixture.debugElement.query(By.directive(MockContactDetailComponent));
    expect(detail).toBeTruthy();
    
    detail.triggerEventHandler('saved', null);

    expect(router.navigate).toHaveBeenCalledWith(['/contacts'], expect.anything());
  });
});