import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LlmSessionMemoryComponent } from './session-memory.component';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { convertToParamMap, ParamMap } from '@angular/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';
import { signal } from '@angular/core';

// Mock child components to avoid deep rendering issues
import { Component, input } from '@angular/core';
@Component({ selector: 'llm-memory-sidebar', standalone: true, template: '' })
class MockSidebar {
  selectedDigestId = input();
}
@Component({
  selector: 'llm-manual-digest-builder',
  standalone: true,
  template: '',
})
class MockBuilder {}
@Component({ selector: 'llm-digest-detail', standalone: true, template: '' })
class MockDetail {
  digestId = input();
}

describe('LlmSessionMemoryComponent', () => {
  let component: LlmSessionMemoryComponent;
  let fixture: ComponentFixture<LlmSessionMemoryComponent>;
  let queryParamMapSubject: Subject<ParamMap>;
  let mockRouter: any;

  beforeEach(async () => {
    queryParamMapSubject = new Subject<ParamMap>();
    mockRouter = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [
        LlmSessionMemoryComponent,
        MockSidebar,
        MockBuilder,
        MockDetail,
      ],
      providers: [
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: queryParamMapSubject.asObservable() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LlmSessionMemoryComponent);
    component = fixture.componentInstance;
  });

  it('should default to "empty" view when no query params are present', () => {
    // Emit empty params immediately to initialize the signal
    queryParamMapSubject.next(convertToParamMap({}));
    fixture.detectChanges();

    expect(component.activeDigestId()).toBeNull();
    expect(component.activeView()).toBe('empty');
  });

  it('should switch to "builder" view when builder=true is in the URL', () => {
    queryParamMapSubject.next(convertToParamMap({ builder: 'true' }));
    fixture.detectChanges();

    expect(component.activeView()).toBe('builder');
  });

  it('should parse digest URN and switch to "digest" view when digest is in URL', () => {
    const testUrn = 'urn:llm:digest:123';
    queryParamMapSubject.next(convertToParamMap({ digest: testUrn }));
    fixture.detectChanges();

    expect(component.activeDigestId()?.toString()).toBe(testUrn);
    expect(component.activeView()).toBe('digest');
  });

  it('should navigate and clear builder param when onSelectDigest is called', () => {
    const targetId = URN.parse('urn:llm:digest:999');
    component.onSelectDigest(targetId);

    expect(mockRouter.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { digest: 'urn:llm:digest:999', builder: null },
        queryParamsHandling: 'merge',
      }),
    );
  });

  it('should navigate and clear digest param when onOpenBuilder is called', () => {
    component.onOpenBuilder();

    expect(mockRouter.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { builder: 'true', digest: null },
        queryParamsHandling: 'merge',
      }),
    );
  });
});
