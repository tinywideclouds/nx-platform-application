import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LlmSessionFormComponent } from './session-form.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import {
  LlmSession,
  SessionAttachment,
} from '@nx-platform-application/llm-types';
import { LlmDataSourcesStateService } from '@nx-platform-application/data-sources/features/state';
import { Temporal } from '@js-temporal/polyfill';

describe('LlmSessionFormComponent', () => {
  let component: LlmSessionFormComponent;
  let fixture: ComponentFixture<LlmSessionFormComponent>;

  // Mock the state service required by the child hierarchy/stepper components
  const mockStateService = {
    caches: signal([]),
    groupedCaches: signal({}),
    activeProfiles: signal([]),
    selectCache: vi.fn(),
  };

  const mockSession: LlmSession = {
    id: URN.parse('urn:llm:session:123'),
    title: 'Initial Title',
    lastModified: Temporal.Now.instant().toString() as ISODateTimeString,
    geminiCache: 'cachedContents/mock-123',
    attachments: [
      {
        id: 'att-1',
        cacheId: URN.parse('urn:repo:test:1'),
        target: 'gemini-cache',
      },
      {
        id: 'att-2',
        cacheId: URN.parse('urn:repo:test:2'),
        target: 'inline-context',
      },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LlmSessionFormComponent, BrowserAnimationsModule],
      providers: [
        { provide: LlmDataSourcesStateService, useValue: mockStateService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LlmSessionFormComponent);
    component = fixture.componentInstance;

    // Bind the initial session state
    fixture.componentRef.setInput('session', mockSession);
    fixture.detectChanges();
  });

  describe('Title Editing', () => {
    it('should initialize with the session title', () => {
      expect(component.editTitleValue()).toBe('Initial Title');
      expect(component.isEditingTitle()).toBe(false);
    });

    it('should enter edit mode when requested', () => {
      component.startTitleEdit();
      expect(component.isEditingTitle()).toBe(true);
    });

    it('should emit the saved title and exit edit mode', () => {
      const emitSpy = vi.spyOn(component.save, 'emit');

      component.startTitleEdit();
      component.editTitleValue.set('Updated Session Name');
      component.saveTitle();

      expect(emitSpy).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Updated Session Name' }),
      );
      expect(component.isEditingTitle()).toBe(false);
    });
  });

  describe('Attachment Orchestration & Cache Drift', () => {
    it('should toggle adding source state', () => {
      component.startAddingSource();
      expect(component.isAddingSource()).toBe(true);

      component.cancelAddingSource();
      expect(component.isAddingSource()).toBe(false);
    });

    it('should emit delete when onDelete is called', () => {
      const deleteSpy = vi.spyOn(component.delete, 'emit');
      component.onDelete();
      expect(deleteSpy).toHaveBeenCalled();
    });

    describe('Adding Attachments', () => {
      it('should append a new inline-context without clearing geminiCache', () => {
        const emitSpy = vi.spyOn(component.save, 'emit');

        const newAtt: SessionAttachment = {
          id: 'att-new',
          cacheId: URN.parse('urn:repo:new:1'),
          target: 'inline-context',
        };

        component.confirmAddSource(newAtt);

        const savedSession = emitSpy.mock.calls[0][0];
        expect(savedSession.attachments.length).toBe(3);
        // Ensure cache is retained
        expect(savedSession.geminiCache).toBe('cachedContents/mock-123');
      });

      it('should clear geminiCache when a gemini-cache target is added (Cache Drift)', () => {
        const emitSpy = vi.spyOn(component.save, 'emit');

        const newAtt: SessionAttachment = {
          id: 'att-new',
          cacheId: URN.parse('urn:repo:new:2'),
          target: 'gemini-cache',
        };

        component.confirmAddSource(newAtt);

        const savedSession = emitSpy.mock.calls[0][0];
        expect(savedSession.attachments.length).toBe(3);
        // Ensure cache is wiped
        expect(savedSession.geminiCache).toBeUndefined();
      });
    });

    describe('Removing Attachments', () => {
      it('should remove an inline-context without clearing geminiCache', () => {
        const emitSpy = vi.spyOn(component.save, 'emit');

        // Remove the inline context attachment
        component.removeAttachment('att-2');

        const savedSession = emitSpy.mock.calls[0][0];
        expect(savedSession.attachments.length).toBe(1);
        expect(savedSession.attachments[0].id).toBe('att-1');
        // Ensure cache is retained
        expect(savedSession.geminiCache).toBe('cachedContents/mock-123');
      });

      it('should clear geminiCache when a gemini-cache target is removed (Cache Drift)', () => {
        const emitSpy = vi.spyOn(component.save, 'emit');

        // Remove the gemini-cache attachment
        component.removeAttachment('att-1');

        const savedSession = emitSpy.mock.calls[0][0];
        expect(savedSession.attachments.length).toBe(1);
        expect(savedSession.attachments[0].id).toBe('att-2');
        // Ensure cache is wiped
        expect(savedSession.geminiCache).toBeUndefined();
      });
    });
  });
});
