import '@angular/compiler';
import '@analogjs/vitest-angular/setup-snapshots';
import { provideZonelessChangeDetection, NgModule } from '@angular/core';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';
import { vi } from 'vitest';

/**
 * Mock ResizeObserver for jsdom environment
 */
const MockResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

vi.stubGlobal('ResizeObserver', MockResizeObserver);

// FIX: Mock scrollTo for JSDOM to prevent AutoScrollDirective errors
HTMLElement.prototype.scrollTo = vi.fn();

@NgModule({
  providers: [provideZonelessChangeDetection()],
})
export class ZonelessTestModule {}

getTestBed().initTestEnvironment(
  [BrowserTestingModule, ZonelessTestModule],
  platformBrowserTesting(),
);
