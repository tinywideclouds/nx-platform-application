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
      // Import the component-under-test and the testing module for routing
      imports: [AppComponent, RouterTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('should create the app', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should have a router-outlet', () => {
    const outlet = el.querySelector('router-outlet');
    expect(outlet).toBeTruthy();
  });

  it('should have a navigation link to "Messenger"', () => {
    // Find the element by its text and check its 'href'
    const link = fixture.debugElement
      .queryAll(By.css('a'))
      .find((a) => a.nativeElement.textContent?.includes('Messenger'));

    expect(link).toBeTruthy();
    // The RouterTestingModule updates the href to be '/messenger'
    expect(link?.properties['href']).toBe('/messenger');
  });

  it('should have a navigation link to "All Contacts"', () => {
    const link = fixture.debugElement
      .queryAll(By.css('a'))
      .find((a) => a.nativeElement.textContent?.includes('All Contacts'));

    expect(link).toBeTruthy();
    expect(link?.properties['href']).toBe('/all-contacts');
  });
});