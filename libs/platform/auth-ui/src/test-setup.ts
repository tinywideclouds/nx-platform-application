import '@angular/compiler';
import '@analogjs/vitest-angular/setup-zone';

import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';
import { getTestBed } from '@angular/core/testing';

getTestBed().initTestEnvironment(
  BrowserTestingModule,
  platformBrowserTesting()
);

// to use proxy zone we must replace the above with the deprecated modules

// import {
//   BrowserDynamicTestingModule,
//   platformBrowserDynamicTesting,
// } from '@angular/platform-browser-dynamic/testing';
// import { getTestBed } from '@angular/core/testing';
//
// getTestBed().initTestEnvironment(
//   BrowserDynamicTestingModule,
//   platformBrowserDynamicTesting()
// );
