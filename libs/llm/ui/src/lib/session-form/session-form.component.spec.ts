import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LlmSessionFormComponent } from './session-form.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { LlmSession } from '@nx-platform-application/llm-types';
import { DataSourcesService } from '@nx-platform-application/data-sources-features-state';
import { LlmSessionActions } from '@nx-platform-application/llm-domain-session';
import { CompiledCacheService } from '@nx-platform-application/llm-domain-compiled-cache';
import { DataSourceResolver } from '@nx-platform-application/llm-features-workspace';
import { Temporal } from '@js-temporal/polyfill';

describe('LlmSessionFormComponent', () => {
  let component: LlmSessionFormComponent;
  let fixture: ComponentFixture<LlmSessionFormComponent>;

  const mockDataSources = {
    loadAllDataSources: vi.fn(),
    loadAllDataGroups: vi.fn(),
    bundles: signal([]),
    dataGroups: signal([]),
  };

  const mockActions = {
    removeContext: vi.fn(),
    attachContext: vi.fn(),
    defaultModel: 'gemini-3-flash-preview',
  };

  const mockCache = {
    compileCache: vi.fn(),
    activeCaches: signal([]),
    isCompiling: signal(false),
  };

  const mockResolver = {
    resolve: vi.fn(),
  };

  const mockSession: LlmSession = {
    id: URN.parse('urn:llm:session:123'),
    title: 'Initial Title',
    llmModel: 'gemini-3-flash-preview',
    lastModified: Temporal.Now.instant().toString() as ISODateTimeString,
    strategy: {
      primaryModel: 'gemini-3-flash-preview',
      secondaryModel: 'gemini-3.1-pro-preview',
      secondaryModelLimit: 1,
      fallbackStrategy: 'inline',
      useCacheIfAvailable: true,
    },
    inlineContexts: [],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LlmSessionFormComponent, BrowserAnimationsModule],
      providers: [
        { provide: DataSourcesService, useValue: mockDataSources },
        { provide: LlmSessionActions, useValue: mockActions },
        { provide: CompiledCacheService, useValue: mockCache },
        { provide: DataSourceResolver, useValue: mockResolver },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LlmSessionFormComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('session', mockSession);
    fixture.detectChanges();
  });

  describe('Model Strategy Management', () => {
    it('should emit updated primary model and top-level llmModel when changed', () => {
      const emitSpy = vi.spyOn(component.save, 'emit');
      component.updateStrategy('primaryModel', 'gemini-3.1-pro-preview');

      expect(emitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          llmModel: 'gemini-3.1-pro-preview',
          strategy: expect.objectContaining({
            primaryModel: 'gemini-3.1-pro-preview',
          }),
        }),
      );
    });

    it('should set limit to 1 turn when onOverrideStrategyChange is called with "flick"', () => {
      const emitSpy = vi.spyOn(component.save, 'emit');
      component.onOverrideStrategyChange('flick');
      expect(emitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          strategy: expect.objectContaining({ secondaryModelLimit: 1 }),
        }),
      );
    });

    it('should set limit to 2 turns when onOverrideStrategyChange is called with "alert"', () => {
      const emitSpy = vi.spyOn(component.save, 'emit');
      component.onOverrideStrategyChange('alert');
      expect(emitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          strategy: expect.objectContaining({ secondaryModelLimit: 2 }),
        }),
      );
    });

    it('should update the cache fallback strategy correctly', () => {
      const emitSpy = vi.spyOn(component.save, 'emit');
      component.updateStrategy('fallbackStrategy', 'history_only');
      expect(emitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          strategy: expect.objectContaining({
            fallbackStrategy: 'history_only',
          }),
        }),
      );
    });
  });

  describe('Compilation Hand-off', () => {
    it('should strictly use the primaryModel from the strategy when requesting compilation', async () => {
      mockResolver.resolve.mockResolvedValue([]);
      await component.onCompileRequest({ intent: {} as any });

      expect(mockCache.compileCache).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-3-flash-preview',
        }),
      );
    });
  });

  describe('UI Title State', () => {
    it('should emit the saved title', () => {
      const emitSpy = vi.spyOn(component.save, 'emit');
      component.startTitleEdit();
      component.editTitleValue.set('Updated');
      component.saveTitle();

      expect(emitSpy).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Updated' }),
      );
    });
  });
});
