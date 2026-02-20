import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScrollspaceViewportComponent } from './viewport.component';
import { ScrollItem } from '@nx-platform-application/scrollspace-types';
import { provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { Temporal } from '@js-temporal/polyfill';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('ScrollspaceViewportComponent', () => {
  let component: ScrollspaceViewportComponent<string>;
  let fixture: ComponentFixture<ScrollspaceViewportComponent<string>>;
  let viewportEl: HTMLElement;

  const mockItem: ScrollItem<string> = {
    id: '1',
    type: 'content',
    timestamp: Temporal.Now.instant(),
    layout: { alignment: 'start', isContinuous: false },
    renderingWeight: 1,
    data: 'test',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScrollspaceViewportComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(
      ScrollspaceViewportComponent,
    ) as ComponentFixture<ScrollspaceViewportComponent<string>>;
    component = fixture.componentInstance;

    // Provide required Inputs
    fixture.componentRef.setInput('rowTemplate', {} as any);
    fixture.componentRef.setInput('items', []);

    fixture.detectChanges();
    viewportEl = fixture.debugElement.query(
      By.css('.overflow-y-auto'),
    ).nativeElement;
  });

  describe('Scroll Logic (Sticky Tail)', () => {
    it('should scroll to bottom when sticky is active', async () => {
      // Mock Viewport State: At Bottom (Sticky)
      // clientHeight=100, scrollHeight=1000, scrollTop=900 (1000-100)
      Object.defineProperty(viewportEl, 'scrollHeight', {
        value: 1000,
        configurable: true,
      });
      Object.defineProperty(viewportEl, 'scrollTop', {
        value: 900,
        configurable: true,
      });
      Object.defineProperty(viewportEl, 'clientHeight', {
        value: 100,
        configurable: true,
      });

      const scrollSpy = vi.spyOn(viewportEl, 'scrollTo');

      // Trigger logic via Public Method (mimicking the Effect's action)
      // Note: In unit tests, `afterNextRender` is hard to trigger automatically,
      // so we test the logic method directly if visible, or verify the 'scrollToBottom' method.
      component.scrollToBottom();

      expect(scrollSpy).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' });
      expect(component.showScrollButton()).toBe(false);
    });

    it('should show button when user is scrolled up (History Reading)', () => {
      // 1. Simulate User Scrolled Up
      Object.defineProperty(viewportEl, 'scrollHeight', {
        value: 1000,
        configurable: true,
      });
      Object.defineProperty(viewportEl, 'scrollTop', {
        value: 500,
        configurable: true,
      }); // Far from bottom
      Object.defineProperty(viewportEl, 'clientHeight', {
        value: 100,
        configurable: true,
      });

      // Trigger Scroll Event
      viewportEl.dispatchEvent(new Event('scroll'));
      fixture.detectChanges();

      // 2. Verify State
      expect(component.showScrollButton()).toBe(true);
    });
  });

  describe('History Paging', () => {
    it('should emit scrolledToTop when scrollTop is 0', () => {
      let emitted = false;
      component.scrolledToTop.subscribe(() => (emitted = true));

      Object.defineProperty(viewportEl, 'scrollTop', {
        value: 0,
        configurable: true,
      });
      viewportEl.dispatchEvent(new Event('scroll'));

      expect(emitted).toBe(true);
    });
  });

  describe('Shadow History Spacer', () => {
    it('should render spacer div when height > 0', () => {
      fixture.componentRef.setInput('historySpacerHeight', 500);
      fixture.detectChanges();

      const spacer = fixture.debugElement.query(
        By.css('[style.height.px="500"]'),
      );
      expect(spacer).toBeTruthy();
    });

    it('should NOT render spacer div when height is 0', () => {
      fixture.componentRef.setInput('historySpacerHeight', 0);
      fixture.detectChanges();

      const spacer = fixture.debugElement.query(
        By.css('[style.height.px="0"]'),
      );
      expect(spacer).toBeNull();
    });
  });
});
