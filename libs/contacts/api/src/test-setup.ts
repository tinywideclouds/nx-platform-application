import '@angular/compiler';
import '@analogjs/vitest-angular/setup-snapshots';
import 'fake-indexeddb/auto';
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
  platformBrowserTesting(),
);
