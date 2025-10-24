import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatDataAccess } from './chat-data-access';

describe('ChatDataAccess', () => {
  let component: ChatDataAccess;
  let fixture: ComponentFixture<ChatDataAccess>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatDataAccess],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatDataAccess);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
