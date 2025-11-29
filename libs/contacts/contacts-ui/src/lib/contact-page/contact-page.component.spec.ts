import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactPageComponent } from './contact-page.component';
import { Router, ActivatedRoute, convertToParamMap } from '@angular/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { By } from '@angular/platform-browser';
import { URN } from '@nx-platform-application/platform-types';

// ng-mocks
import { MockComponent, MockProvider } from 'ng-mocks';
import { ContactDetailComponent } from '../contact-detail/contact-detail.component';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';

const mockContactUrnString = 'urn:contacts:user:user-123';

describe('ContactPageComponent', () => {
  let fixture: ComponentFixture<ContactPageComponent>;
  let component: ContactPageComponent;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ContactPageComponent,
        MockComponent(ContactDetailComponent),
        MockComponent(ContactsPageToolbarComponent),
      ],
      providers: [
        MockProvider(Router),
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
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should navigate on (close) from TOOLBAR', () => {
    const spy = vi.spyOn(router, 'navigate');

    // We can simulate the click if the mock template is structured correctly,
    // OR we can test the method directly.
    // Given the template puts the button inside the toolbar projection, we test logic:
    component.onClose();

    expect(spy).toHaveBeenCalledWith(['/contacts'], {
      queryParams: { tab: 'contacts' },
    });
  });

  it('should navigate on (saved) from CHILD', () => {
    const spy = vi.spyOn(router, 'navigate');

    // Find Mock Detail Component
    const detail = fixture.debugElement.query(
      By.directive(ContactDetailComponent)
    );
    expect(detail).toBeTruthy();

    // Emit Output
    detail.componentInstance.saved.emit({} as any);

    expect(spy).toHaveBeenCalledWith(['/contacts'], {
      queryParams: { tab: 'contacts' },
    });
  });
});
