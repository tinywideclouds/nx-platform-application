import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { ToyComponent } from './toy';
import { ToyService } from './toy.service';

describe('ToyComponent with direct import', () => {
  let fixture: ComponentFixture<ToyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToyComponent],
      providers: [ToyService],
    }).compileComponents();

    fixture = TestBed.createComponent(ToyComponent);
  });

  it(
    'should work with fakeAsync',
    fakeAsync(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('p').textContent).toBe(
        'Loading...',
      );

      tick(500); // Advance the clock

      fixture.detectChanges(); // Update the UI

      expect(fixture.nativeElement.querySelector('p').textContent).toBe(
        'Success',
      );
    }),
  );
});

