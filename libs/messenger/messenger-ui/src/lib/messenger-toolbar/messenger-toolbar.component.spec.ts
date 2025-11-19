import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessengerToolbarComponent } from './messenger-toolbar.component';
import { User, URN } from '@nx-platform-application/platform-types';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';

const mockUser: User = {
  id: URN.parse('urn:sm:user:me'),
  alias: 'Me',
  email: 'me@test.com'
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
    const avatar = fixture.debugElement.query(By.css('.rounded-full'));
    expect(avatar.nativeElement.textContent).toContain('ME');
  });

  it('should emit compose event', () => {
    const spy = vi.spyOn(component.compose, 'emit');
    const btn = fixture.debugElement.query(By.css('button[aria-label="Compose Message"]'));
    btn.nativeElement.click();
    expect(spy).toHaveBeenCalled();
  });

  it('should emit address book event', () => {
    const spy = vi.spyOn(component.openAddressBook, 'emit');
    const btn = fixture.debugElement.query(By.css('button[aria-label="Open Contacts"]'));
    btn.nativeElement.click();
    expect(spy).toHaveBeenCalled();
  });
});