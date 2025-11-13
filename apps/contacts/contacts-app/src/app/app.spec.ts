// apps/contacts-app/src/app/app.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';
import { AppComponent } from './app';

describe('AppComponent (Harness)', () => {
  let fixture: ComponentFixture<AppComponent>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent, RouterTestingModule],
      // No providers needed, handled in test-setup.ts
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  // --- This test passes ---
  it('should create the app', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  // --- This test passes ---
  it('should have a router-outlet', () => {
    const outlet = el.querySelector('router-outlet');
    expect(outlet).toBeTruthy();
  });

  // --- THIS TEST IS NOW FIXED ---
  it('should have a navigation link to "Messenger"', () => {
    const link = fixture.debugElement
      .queryAll(By.css('a'))
      .find((a) => a.nativeElement.textContent?.includes('Messenger'));

    expect(link).toBeTruthy();
    // Check the 'attributes' not the 'properties'
    expect(link?.attributes['href']).toBe('/messenger');
  });

  // --- THIS TEST IS NOW FIXED ---
  it('should have a navigation link to "All Contacts"', () => {
    const link = fixture.debugElement
      .queryAll(By.css('a'))
      .find((a) => a.nativeElement.textContent?.includes('All Contacts'));

    expect(link).toBeTruthy();
    // Check the 'attributes' not the 'properties'
    expect(link?.attributes['href']).toBe('/all-contacts');
  });
});