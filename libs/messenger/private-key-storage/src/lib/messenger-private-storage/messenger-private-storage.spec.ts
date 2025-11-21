import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessengerPrivateStorage } from './messenger-private-storage';

describe('MessengerPrivateStorage', () => {
  let component: MessengerPrivateStorage;
  let fixture: ComponentFixture<MessengerPrivateStorage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessengerPrivateStorage],
    }).compileComponents();

    fixture = TestBed.createComponent(MessengerPrivateStorage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
