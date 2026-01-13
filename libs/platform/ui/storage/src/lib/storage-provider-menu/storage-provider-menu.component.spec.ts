import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { StorageProviderMenuComponent } from './storage-provider-menu.component';
import { StorageOption } from '@nx-platform-application/platform-types';

// Local Mock of the Interface if not available in test context
const mockOptions: StorageOption[] = [
  { id: 'google', name: 'Google Drive' },
  { id: 'dropbox', name: 'Dropbox' },
];

describe('StorageProviderMenuComponent', () => {
  let component: StorageProviderMenuComponent;
  let fixture: ComponentFixture<StorageProviderMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StorageProviderMenuComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StorageProviderMenuComponent);
    component = fixture.componentInstance;
  });

  it('should render a button for each option', () => {
    component.options = mockOptions;
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.css('button'));
    expect(buttons.length).toBe(2);
    expect(buttons[0].nativeElement.textContent).toContain(
      'Connect Google Drive',
    );
    expect(buttons[1].nativeElement.textContent).toContain('Connect Dropbox');
  });

  it('should emit the provider ID when clicked', () => {
    // 1. Setup
    component.options = mockOptions;
    fixture.detectChanges();
    const spy = vi.spyOn(component.select, 'emit');

    // 2. Act (Click the first button)
    const googleBtn = fixture.debugElement.queryAll(By.css('button'))[0];
    googleBtn.triggerEventHandler('click', null);

    // 3. Assert
    expect(spy).toHaveBeenCalledWith('google');
  });

  it('should disable buttons when disabled input is true', () => {
    component.options = mockOptions;
    component.disabled = true;
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.css('button'));
    expect(buttons[0].nativeElement.disabled).toBe(true);
    expect(buttons[1].nativeElement.disabled).toBe(true);
  });
});
