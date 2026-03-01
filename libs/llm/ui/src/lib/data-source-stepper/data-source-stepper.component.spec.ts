import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LlmDataSourceStepperComponent } from './data-source-stepper.component';
import { LlmDataSourcesStateService } from '@nx-platform-application/llm-features-data-sources';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

describe('LlmDataSourceStepperComponent', () => {
  let component: LlmDataSourceStepperComponent;
  let fixture: ComponentFixture<LlmDataSourceStepperComponent>;

  const mockStateService = {
    groupedCaches: signal({
      'test-group': [
        { id: 'urn:repo:test:1', branch: 'main', status: 'ready' },
      ],
    }),
    activeProfiles: signal([{ id: 'urn:profile:test:1', name: 'Profile 1' }]),
    selectCache: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LlmDataSourceStepperComponent, BrowserAnimationsModule],
      providers: [
        { provide: LlmDataSourcesStateService, useValue: mockStateService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LlmDataSourceStepperComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should call selectCache on the state service when a repo is chosen', async () => {
    await component.onCacheSelected('urn:repo:test:1');
    expect(component.selectedCacheId()).toBe('urn:repo:test:1');
    expect(mockStateService.selectCache).toHaveBeenCalledWith(
      'urn:repo:test:1',
    );
  });

  it('should emit the configured SessionAttachment when confirmed', () => {
    const emitSpy = vi.spyOn(component.addSource, 'emit');

    // Set up step choices
    component.selectedCacheId.set('urn:repo:test:1');
    component.selectedProfileId.set('urn:profile:test:1');
    component.selectedTarget.set('system-instruction');

    component.confirmAddSource();

    expect(emitSpy).toHaveBeenCalled();
    const emittedData = emitSpy.mock.calls[0][0];

    expect(emittedData.cacheId.toString()).toBe('urn:repo:test:1');
    expect(emittedData.profileId?.toString()).toBe('urn:profile:test:1');
    expect(emittedData.target).toBe('system-instruction');
    expect(emittedData.id).toBeDefined(); // UUID generated
  });
});
