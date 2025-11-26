import { ComponentFixture, TestBed } from '@angular/core/testing';
import { KeyContactsCloudAccess } from './key-contacts-cloud-access';

describe('KeyContactsCloudAccess', () => {
  let component: KeyContactsCloudAccess;
  let fixture: ComponentFixture<KeyContactsCloudAccess>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KeyContactsCloudAccess],
    }).compileComponents();

    fixture = TestBed.createComponent(KeyContactsCloudAccess);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
