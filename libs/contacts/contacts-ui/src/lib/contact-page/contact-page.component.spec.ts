import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactPageComponent } from './contact-page.component';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { By } from '@angular/platform-browser';
import { URN } from '@nx-platform-application/platform-types';

// ng-mocks
import { MockComponent } from 'ng-mocks';
import { ContactDetailComponent } from '../contact-detail/contact-detail.component';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';

const mockContactUrnString = 'urn:contacts:user:user-123';

describe('ContactPageComponent', () => {
  let fixture: ComponentFixture<ContactPageComponent>;
  let component: ContactPageComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ContactPageComponent,
        MockComponent(ContactDetailComponent),
        MockComponent(ContactsPageToolbarComponent),
      ],
      providers: [
        // ✅ 1. Removed MockProvider(Router) - Not needed anymore!
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: mockContactUrnString })),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit (cancelled) on (close) from TOOLBAR', () => {
    // ✅ 2. Spy on the Output
    const spy = vi.spyOn(component.cancelled, 'emit');

    component.onClose();

    expect(spy).toHaveBeenCalled();
  });

  it('should emit (saved) on (saved) from CHILD', () => {
    // ✅ 3. Spy on the Output
    const spy = vi.spyOn(component.saved, 'emit');

    const detail = fixture.debugElement.query(
      By.directive(ContactDetailComponent),
    );
    expect(detail).toBeTruthy();

    detail.componentInstance.saved.emit();

    expect(spy).toHaveBeenCalled();
  });

  it('should emit (cancelled) on (deleted) from CHILD', () => {
    // Treating delete as a "close/cancel" action for the page context
    const spy = vi.spyOn(component.cancelled, 'emit');

    const detail = fixture.debugElement.query(
      By.directive(ContactDetailComponent),
    );
    detail.componentInstance.deleted.emit();

    expect(spy).toHaveBeenCalled();
  });
});
