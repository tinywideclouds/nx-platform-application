import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactsUi } from './contacts-ui';

describe('ContactsUi', () => {
  let component: ContactsUi;
  let fixture: ComponentFixture<ContactsUi>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactsUi],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactsUi);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
