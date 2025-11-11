import 'fake-indexeddb/auto';
import { WebSocket } from 'ws';
import { webcrypto } from 'node:crypto';
// Polyfill window.crypto.subtle for jsdom
if (!global.crypto) {
  (global as any).crypto = webcrypto;
}

import '@angular/compiler';
// Import the setup-snapshots for compatibility instead of setup-zone
import '@analogjs/vitest-angular/setup-snapshots';
import { provideZonelessChangeDetection, NgModule } from '@angular/core';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';

// Create a small NgModule to provide the Zoneless detection
@NgModule({
  providers: [provideZonelessChangeDetection()],
})
export class ZonelessTestModule {}

console.log('zoneless test');

getTestBed().initTestEnvironment(
  [BrowserTestingModule, ZonelessTestModule],
  platformBrowserTesting()
);

if (!global.crypto.subtle) {
  (global as any).crypto.subtle = webcrypto.subtle;
}
// Force the jsdom environment to use this 'ws' library
(global as any).WebSocket = WebSocket;
