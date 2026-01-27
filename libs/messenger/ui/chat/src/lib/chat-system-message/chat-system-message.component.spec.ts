import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatSystemMessageComponent } from './chat-system-message.component';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';

// Test Host to verify Content Projection
@Component({
  standalone: true,
  imports: [ChatSystemMessageComponent],
  template: `
    <chat-system-message [icon]="icon">
      <span class="test-content">User Name joined</span>
    </chat-system-message>
  `,
})
class TestHostComponent {
  icon = 'login';
}

describe('ChatSystemMessageComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, ChatSystemMessageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render the provided icon', () => {
    // 1. Check initial state
    const iconEl = fixture.debugElement.query(By.css('mat-icon'));
    expect(iconEl.nativeElement.textContent).toContain('login');

    // 2. Update signal input via host binding (Angular 17+ Signals)
    // Since we are using a host component, we update the host property
    component.icon = 'logout';
    fixture.detectChanges();

    expect(iconEl.nativeElement.textContent).toContain('logout');
  });

  it('should project content correctly', () => {
    const contentEl = fixture.debugElement.query(By.css('.test-content'));
    expect(contentEl).toBeTruthy();
    expect(contentEl.nativeElement.textContent).toContain('User Name joined');
  });
});
