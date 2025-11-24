import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactAvatarComponent } from './contact-avatar.component';

describe('ContactAvatarComponent', () => {
  let component: ContactAvatarComponent;
  let fixture: ComponentFixture<ContactAvatarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactAvatarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactAvatarComponent);
    component = fixture.componentInstance;
  });

  it('should display initials when profilePictureUrl is missing', () => {
    // FIX: Use setInput for signals
    fixture.componentRef.setInput('initials', 'JD');
    fixture.componentRef.setInput('profilePictureUrl', undefined);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const img = el.querySelector('img');
    const initials = el.querySelector('[data-testid="initials"]');

    expect(img).toBeFalsy();
    expect(initials).toBeTruthy();
    expect(initials?.textContent?.trim()).toBe('JD');
  });

  it('should display image when profilePictureUrl is present', () => {
    // FIX: Use setInput for signals
    fixture.componentRef.setInput('initials', 'JD');
    fixture.componentRef.setInput('profilePictureUrl', 'http://example.com/img.png');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const img = el.querySelector('img');
    const initials = el.querySelector('[data-testid="initials"]');

    expect(initials).toBeFalsy();
    expect(img).toBeTruthy();
    expect(img?.src).toBe('http://example.com/img.png');
  });
});