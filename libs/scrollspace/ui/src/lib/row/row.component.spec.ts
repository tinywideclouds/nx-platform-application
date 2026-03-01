import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScrollspaceRowComponent } from './row.component';
import {
  ScrollItem,
  ScrollActor,
} from '@nx-platform-application/scrollspace-types';
import { URN } from '@nx-platform-application/platform-types';
import { Temporal } from '@js-temporal/polyfill';
import { provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// --- Mock Data ---
const mockActor: ScrollActor = {
  id: URN.parse('urn:app:user:alice'),
  displayName: 'Alice',
  isSelf: false,
};

const mockItem: ScrollItem<string> = {
  id: 'msg-1', // Viewport ID (string)
  type: 'content',
  timestamp: Temporal.Now.instant(),
  actor: mockActor,
  layout: {
    alignment: 'start',
    isContinuous: false, // Standard margin
  },
  renderingWeight: 1,
  data: 'Hello',
};

describe('ScrollspaceRowComponent', () => {
  let component: ScrollspaceRowComponent;
  let fixture: ComponentFixture<ScrollspaceRowComponent>;

  beforeEach(async () => {
    // FIX: Mock IntersectionObserver for JSDOM
    globalThis.IntersectionObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    await TestBed.configureTestingModule({
      imports: [ScrollspaceRowComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(ScrollspaceRowComponent);
    component = fixture.componentInstance;
  });

  describe('Layout & Clustering', () => {
    it('should apply standard margins when NOT continuous', () => {
      fixture.componentRef.setInput('item', mockItem);
      fixture.detectChanges();

      const row = fixture.debugElement.query(By.css('.group')).nativeElement;
      expect(row.classList).toContain('mb-6');
      expect(row.classList).not.toContain('mb-1');
    });

    it('should apply clustered margins when continuous (The 5s Rule)', () => {
      const continuousItem = {
        ...mockItem,
        layout: { ...mockItem.layout, isContinuous: true },
      };
      fixture.componentRef.setInput('item', continuousItem);
      fixture.detectChanges();

      const row = fixture.debugElement.query(By.css('.group')).nativeElement;
      expect(row.classList).toContain('mb-1');
      expect(row.classList).not.toContain('mb-6');
    });

    it('should hide avatar when continuous', () => {
      const continuousItem = {
        ...mockItem,
        layout: { ...mockItem.layout, isContinuous: true },
      };
      fixture.componentRef.setInput('item', continuousItem);
      fixture.detectChanges();

      const avatarColumn = fixture.debugElement.query(By.css('.w-8.mr-2'));
      const avatarCircle = avatarColumn.query(By.css('.rounded-full'));
      expect(avatarCircle).toBeNull();
    });
  });

  describe('Adornments (Read Cursors)', () => {
    // FIX: Make the test async
    it('should render read cursors when present', async () => {
      const itemWithCursors: ScrollItem<string> = {
        ...mockItem,
        adornments: {
          cursors: [
            {
              id: URN.parse('urn:app:user:bob'),
              displayName: 'Bob',
              color: '#ff0000',
            },
            {
              id: URN.parse('urn:app:user:charlie'),
              displayName: 'Charlie',
              color: '#00ff00',
            },
          ],
        },
      };

      fixture.componentRef.setInput('item', itemWithCursors);

      // FIX: Await stability to let Zoneless CD run its microtasks
      await fixture.whenStable();
      fixture.detectChanges();

      const cursorContainer = fixture.debugElement.query(
        By.css('.cursor-container'),
      );
      expect(cursorContainer).toBeTruthy();

      const cursors = cursorContainer.queryAll(By.css('.cursor-avatar'));
      expect(cursors.length).toBe(2);
    });
  });
});
