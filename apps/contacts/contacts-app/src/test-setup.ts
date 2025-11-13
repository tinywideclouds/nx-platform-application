// apps/contacts-app/src/test-setup.ts

import 'vitest-dom/extend-expect';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

// Initialize the Angular testing environment.
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
  {
    // We are running in a zoneless application, so we must
    // set teardown to false.
    teardown: { destroyAfterEach: false },
  }
);