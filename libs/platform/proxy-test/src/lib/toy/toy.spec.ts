// src/lib/toy/toy.spec.ts
import {
  ComponentFixture,
  TestBed,
} from '@angular/core/testing';
import { ToyComponent } from './toy';
import { ToyService } from './toy.service';
import { Subject } from 'rxjs'; // Import Subject for manual control

describe('ToyComponent in Zoneless mode (RxJS Spy)', () => {
  let fixture: ComponentFixture<ToyComponent>;
  let toyServiceSpy: ToyService;
  let dataSubject: Subject<string>;

  beforeEach(async () => {
    // 1. Setup the Subject: This is the controllable Observable stream.
    dataSubject = new Subject<string>();

    // 2. Setup the Spy: Mocks the service to return our controllable Subject.
    toyServiceSpy = {
      getData: () => dataSubject.asObservable(),
    } as ToyService;

    await TestBed.configureTestingModule({
      imports: [ToyComponent],
      providers: [
        // 3. Provide the Spy/Mock
        { provide: ToyService, useValue: toyServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ToyComponent);
  });

  it('should load data correctly using manual RxJS control', async () => {
    // 4. Initial render: toSignal subscribes to the EMPTY Subject. Status is 'Loading...'.
    fixture.detectChanges();

    // ASSERTION 1: Guaranteed to be 'Loading...' because no data has been pushed.
    expect(fixture.nativeElement.querySelector('p').textContent).toBe('Loading...');

    // --- ASYNCHRONOUS PHASE (Controlled by Test) ---

    // 5. Manually push the 'Success' value. The Signal updates in a microtask.
    dataSubject.next('Success');
    dataSubject.complete();

    // 6. Wait for the signal update microtask to complete.
    await fixture.whenStable();

    // 7. Force a final change detection to refresh the DOM.
    fixture.detectChanges();

    // 8. Final assertion.
    expect(fixture.nativeElement.querySelector('p').textContent).toBe('Success');
  });
});
