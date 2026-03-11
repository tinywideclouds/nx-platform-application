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

  it('should resolve rich data source bundle details if available', () => {
    const details = component.getDataSourceBundleDetails(
      URN.parse('urn:data-source:repo:test:1'),
    );
    expect(details?.repo).toBe('test/repo');
    expect(details?.branch).toBe('main');
  });

  it('should accept and display explicit intent buckets', () => {
    fixture.componentRef.setInput('session', {
      id: URN.parse('urn:llm:session:1'),
    });
    fixture.componentRef.setInput('inlineAttachments', [
      {
        id: URN.parse('urn:llm:attachment:1'),
        resourceUrn: URN.parse('urn:data-source:repo:test:1'),
        resourceType: 'source',
      },
    ]);
    fixture.detectChanges();

    expect(component.inlineAttachments().length).toBe(1);
    expect(component.inlineAttachments()[0].resourceUrn.toString()).toBe(
      'urn:data-source:repo:test:1',
    );
  });
});
