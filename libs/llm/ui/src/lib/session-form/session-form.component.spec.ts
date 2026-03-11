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
import { DataSourcesService } from '@nx-platform-application/data-sources/features/state';
import { LlmSessionActions } from '@nx-platform-application/llm-domain-session';
import { Temporal } from '@js-temporal/polyfill';

describe('LlmSessionFormComponent', () => {
  let component: LlmSessionFormComponent;
  let fixture: ComponentFixture<LlmSessionFormComponent>;

  const mockDataSources = {
    bundles: signal([]),
  };

  const mockActions = {
    removeContext: vi.fn(),
  };

  const mockSession: LlmSession = {
    id: URN.parse('urn:llm:session:123'),
    title: 'Initial Title',
    lastModified: Temporal.Now.instant().toString() as ISODateTimeString,
    inlineContexts: [
      {
        id: URN.parse('urn:llm:attachment:1'),
        resourceUrn: URN.parse('urn:data-source:repo:test:1'),
        resourceType: 'source',
      },
    ],
    systemContexts: [],
    compiledContext: undefined,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LlmSessionFormComponent, BrowserAnimationsModule],
      providers: [
        { provide: DataSourcesService, useValue: mockDataSources },
        { provide: LlmSessionActions, useValue: mockActions },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LlmSessionFormComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('session', mockSession);
    fixture.detectChanges();
  });

  describe('Title Editing', () => {
    it('should initialize with the session title', () => {
      expect(component.editTitleValue()).toBe('Initial Title');
    });

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

  describe('Attachment Actions', () => {
    it('should call domain actions to remove an inline attachment', async () => {
      const targetId = URN.parse('urn:llm:attachment:1');
      await component.onRemoveAttachment(targetId, 'inlineContexts');

      expect(mockActions.removeContext).toHaveBeenCalledWith(
        mockSession.id,
        targetId,
        'inlineContexts',
      );
    });
  });

  it('should emit delete when onDelete is called', () => {
    const deleteSpy = vi.spyOn(component.delete, 'emit');
    component.onDelete();
    expect(deleteSpy).toHaveBeenCalled();
  });
});
