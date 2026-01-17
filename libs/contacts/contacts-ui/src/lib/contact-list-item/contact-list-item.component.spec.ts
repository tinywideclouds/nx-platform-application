import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactListItemComponent } from './contact-list-item.component';
import { Contact } from '@nx-platform-application/contacts-types';
import { Temporal } from '@js-temporal/polyfill';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { SwipeableItemComponent } from '@nx-platform-application/platform-ui-lists';
import { Component, input, output } from '@angular/core';
import { By } from '@angular/platform-browser';

// --- MOCK THE GENERIC COMPONENT ---
// We don't want to test the physics engine here, just that we use it correctly.
@Component({
  selector: 'lib-swipeable-item',
  standalone: true,
  template: `
    <div data-testid="mock-swipe-container">
      <ng-content select="[item-content]"></ng-content>
      <ng-content select="[item-action]"></ng-content>
    </div>
  `,
})
class MockSwipeableItemComponent {
  enabled = input<boolean | undefined>(undefined);
  select = output<void>();
  swipe = output<void>();
  secondaryPress = output<MouseEvent>();

  reset(animate = true): Promise<void> {
    return Promise.resolve();
  }
}

// --- MOCK DATA ---
const MOCK_CONTACT: Contact = {
  id: URN.parse('urn:contacts:user:user-123'),
  alias: 'johndoe',
  email: 'john@example.com',
  firstName: 'John',
  surname: 'Doe',
  lastModified: Temporal.Now.instant().toString() as ISODateTimeString,
  phoneNumbers: [],
  emailAddresses: [],
  serviceContacts: {},
};

describe('ContactListItemComponent', () => {
  let fixture: ComponentFixture<ContactListItemComponent>;
  let component: ContactListItemComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactListItemComponent],
    })
      .overrideComponent(ContactListItemComponent, {
        remove: { imports: [SwipeableItemComponent] },
        add: { imports: [MockSwipeableItemComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ContactListItemComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('contact', MOCK_CONTACT);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render contact alias inside the generic wrapper', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('johndoe');
    expect(
      el.querySelector('[data-testid="mock-swipe-container"]'),
    ).toBeTruthy();
  });

  it('should call reset() on the child component', async () => {
    // 1. Get the mock child
    const childDebugEl = fixture.debugElement.query(
      By.directive(MockSwipeableItemComponent),
    );
    const childInstance =
      childDebugEl.componentInstance as MockSwipeableItemComponent;
    const resetSpy = vitest.spyOn(childInstance, 'reset');

    // 2. Call reset on the parent
    await component.reset(false);

    // 3. Verify delegation
    expect(resetSpy).toHaveBeenCalledWith(false);
  });
});
