import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthUi } from './auth-ui';

describe('AuthUi', () => {
  let component: AuthUi;
  let fixture: ComponentFixture<AuthUi>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthUi],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthUi);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
