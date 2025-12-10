import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessengerToolbarComponent } from './messenger-toolbar.component';
import { User, URN } from '@nx-platform-application/platform-types';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';

const mockUser: User = {
  id: URN.parse('urn:contacts:user:me'),
  alias: 'Me',
  email: 'me@test.com',
};

describe('MessengerToolbarComponent', () => {
  let component: MessengerToolbarComponent;
  let fixture: ComponentFixture<MessengerToolbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessengerToolbarComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(MessengerToolbarComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('currentUser', mockUser);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render user initials', () => {
    // When no profile URL, it renders initials div
    fixture.componentRef.setInput('currentUser', {
      ...mockUser,
      profileUrl: undefined,
    });
    fixture.detectChanges();

    const avatar = fixture.debugElement.query(
      By.css('.rounded-full.bg-gray-600')
    );
    expect(avatar.nativeElement.textContent).toContain('ME');
  });

  // REMOVED: viewCompose test as functionality was removed

  it('should emit viewContacts event', () => {
    const spy = vi.spyOn(component.viewContacts, 'emit');
    const btn = fixture.debugElement.query(
      By.css('button[matTooltip="Contacts"]')
    );

    btn.nativeElement.click();
    expect(spy).toHaveBeenCalled();
  });
});
