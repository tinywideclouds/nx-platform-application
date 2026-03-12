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
    dataGroups: signal([
      {
        id: URN.parse('urn:data-source:group:blueprint-1'),
        name: 'My Blueprint',
        sources: [{}, {}],
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

  it('should resolve rich repository details including the branch', () => {
    const details = component.getDataSourceBundleDetails(
      URN.parse('urn:data-source:repo:test:1'),
    );
    expect(details?.repo).toBe('test/repo');
    expect(details?.branch).toBe('main');
  });

  it('should resolve rich blueprint details including the name', () => {
    const details = component.getDataGroupDetails(
      URN.parse('urn:data-source:group:blueprint-1'),
    );
    expect(details?.name).toBe('My Blueprint');
  });
});
