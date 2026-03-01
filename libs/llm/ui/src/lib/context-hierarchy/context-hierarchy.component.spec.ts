import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LlmContextHierarchyComponent } from './context-hierarchy.component';
import { URN } from '@nx-platform-application/platform-types';
import { LlmDataSourcesStateService } from '@nx-platform-application/llm-features-data-sources';
import { signal } from '@angular/core';

describe('LlmContextHierarchyComponent', () => {
  let component: LlmContextHierarchyComponent;
  let fixture: ComponentFixture<LlmContextHierarchyComponent>;

  const mockStateService = {
    caches: signal([
      { id: 'urn:repo:test:1', repo: 'test/repo', branch: 'main' },
    ]),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LlmContextHierarchyComponent],
      providers: [
        { provide: LlmDataSourcesStateService, useValue: mockStateService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LlmContextHierarchyComponent);
    component = fixture.componentInstance;
  });

  it('should correctly group attachments by target', () => {
    fixture.componentRef.setInput('session', null);
    fixture.componentRef.setInput('attachments', [
      {
        id: '1',
        cacheId: URN.parse('urn:repo:test:1'),
        target: 'gemini-cache',
      },
      {
        id: '2',
        cacheId: URN.parse('urn:repo:test:2'),
        target: 'inline-context',
      },
      {
        id: '3',
        cacheId: URN.parse('urn:repo:test:3'),
        target: 'inline-context',
      },
    ]);
    fixture.detectChanges();

    const groups = component.groupedAttachments();
    expect(groups.geminiCache.length).toBe(1);
    expect(groups.inlineContext.length).toBe(2);
    expect(groups.systemInstruction.length).toBe(0);
  });

  it('should resolve rich cache details if available', () => {
    const details = component.getCacheDetails(URN.parse('urn:repo:test:1'));
    expect(details?.repo).toBe('test/repo');
    expect(details?.branch).toBe('main');
  });

  it('should return undefined for unknown cache details', () => {
    const details = component.getCacheDetails(URN.parse('urn:repo:unknown:1'));
    expect(details).toBeUndefined();
  });
});
