import 'zone.js';
import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserTestingModule, // Import this instead
  platformBrowserTesting, // Import this instead
} from '@angular/platform-browser/testing'; // From the correct package

// Initialize the Angular testing environment.
getTestBed().initTestEnvironment(
  BrowserTestingModule,
  platformBrowserTesting(), // Use the modern APIs
);
