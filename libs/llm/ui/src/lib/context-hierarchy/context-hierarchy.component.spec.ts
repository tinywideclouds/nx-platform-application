import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LlmContextHierarchyComponent } from './context-hierarchy.component';
import { URN } from '@nx-platform-application/platform-types';
import { DataSourcesService } from '@nx-platform-application/data-sources/features/state';
import { signal } from '@angular/core';

describe('LlmContextHierarchyComponent', () => {
  let component: LlmContextHierarchyComponent;
  let fixture: ComponentFixture<LlmContextHierarchyComponent>;

  const mockStateService = {
    bundles: signal([
      {
        id: URN.parse('urn:data-source:repo:test:1'),
        repo: 'test/repo',
        branch: 'main',
      },
    ]),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LlmContextHierarchyComponent],
      providers: [{ provide: DataSourcesService, useValue: mockStateService }],
    }).compileComponents();

    fixture = TestBed.createComponent(LlmContextHierarchyComponent);
    component = fixture.componentInstance;
  });

  it('should correctly group attachments by target', () => {
    fixture.componentRef.setInput('session', null);
    fixture.componentRef.setInput('attachments', [
      {
        id: URN.parse('urn:llm:attachment:1'),
        dataSourceId: URN.parse('urn:data-source:repo:test:1'),
        target: 'inline-context',
      },
      {
        id: URN.parse('urn:llm:attachment:2'),
        dataSourceId: URN.parse('urn:data-source:repo:test:2'),
        target: 'inline-context',
      },
      {
        id: URN.parse('urn:llm:attachment:3'),
        dataSourceId: URN.parse('urn:data-source:repo:test:3'),
        target: 'system-instruction',
      },
    ]);
    fixture.detectChanges();

    const groups = component.groupedAttachments();
    expect(groups.inlineContext.length).toBe(2);
    expect(groups.systemInstruction.length).toBe(1);
  });

  it('should resolve rich data source bundle details if available', () => {
    const details = component.getDataSourceBundleDetails(
      URN.parse('urn:data-source:repo:test:1'),
    );
    expect(details?.repo).toBe('test/repo');
    expect(details?.branch).toBe('main');
  });

  it('should return undefined for unknown bundle details', () => {
    const details = component.getDataSourceBundleDetails(
      URN.parse('urn:data-source:repo:unknown:1'),
    );
    expect(details).toBeUndefined();
  });
});
