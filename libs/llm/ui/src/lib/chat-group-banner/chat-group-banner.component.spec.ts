import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LlmFocusedGroupBannerComponent } from './chat-group-banner.component';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('LlmFocusedGroupBannerComponent', () => {
  let component: LlmFocusedGroupBannerComponent;
  let fixture: ComponentFixture<LlmFocusedGroupBannerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LlmFocusedGroupBannerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LlmFocusedGroupBannerComponent);
    component = fixture.componentInstance;
  });

  it('should emit clear and branch events', () => {
    fixture.componentRef.setInput('focusedUrn', 'urn:123');
    fixture.componentRef.setInput('groupName', 'My Group');
    fixture.detectChanges();

    const clearSpy = vi.spyOn(component.clear, 'emit');
    const branchSpy = vi.spyOn(component.branch, 'emit');

    const buttons = fixture.nativeElement.querySelectorAll('button');

    // Branch button
    buttons[0].click();
    expect(branchSpy).toHaveBeenCalled();

    // Clear button
    buttons[1].click();
    expect(clearSpy).toHaveBeenCalled();
  });
});
