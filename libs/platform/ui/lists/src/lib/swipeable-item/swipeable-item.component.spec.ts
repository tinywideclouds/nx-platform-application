import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SwipeableItemComponent } from './swipeable-item.component';
import { Component, ViewChild } from '@angular/core';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';

@Component({
  standalone: true,
  imports: [SwipeableItemComponent],
  template: `
    <lib-swipeable-item
      (select)="onSelect()"
      (swipe)="onSwipe()"
      (secondaryPress)="onRightClick($event)"
    >
      <div item-content>My Content</div>
      <button item-action>Delete</button>
    </lib-swipeable-item>
  `,
})
class TestHostComponent {
  @ViewChild(SwipeableItemComponent) component!: SwipeableItemComponent;
  onSelect = vi.fn();
  onSwipe = vi.fn();
  onRightClick = vi.fn();
}

describe('SwipeableItemComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, SwipeableItemComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render content projections', () => {
    const content = fixture.nativeElement.textContent;
    expect(content).toContain('My Content');
    expect(content).toContain('Delete');
  });

  it('should emit select when content is clicked', () => {
    const contentWrapper = fixture.debugElement.query(
      By.css('.content-wrapper'),
    );
    contentWrapper.triggerEventHandler('click', null);
    expect(host.onSelect).toHaveBeenCalled();
  });

  it('should emit secondaryPress on right click', () => {
    const event = new MouseEvent('contextmenu');
    const swipeItem = fixture.debugElement.query(By.css('lib-swipeable-item'));

    swipeItem.triggerEventHandler('contextmenu', event);
    expect(host.onRightClick).toHaveBeenCalledWith(event);
  });

  it('should hard reset (scrollLeft=0) when reset(false) is called', async () => {
    const container = fixture.nativeElement.querySelector('.swipe-container');

    // Simulate dirty state
    container.scrollLeft = 100;

    // Call reset with animate=false
    await host.component.reset(false);

    // Assert immediate snap
    expect(container.scrollLeft).toBe(0);
  });
});
