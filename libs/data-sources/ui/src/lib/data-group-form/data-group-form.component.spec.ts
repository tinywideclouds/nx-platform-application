import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataGroupFormComponent } from './data-group-form.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';
import {
  DataSource,
  DataGroup,
} from '@nx-platform-application/data-sources-types';

describe('DataGroupFormComponent', () => {
  let component: DataGroupFormComponent;
  let fixture: ComponentFixture<DataGroupFormComponent>;

  const mockStreams: DataSource[] = [
    {
      id: URN.parse('urn:datasource:stream:1'),
      targetId: URN.parse('urn:ingestiontarget:1'),
      name: 'Frontend Stream',
      description: '',
      rulesYaml: '',
      createdAt: '',
      updatedAt: '',
      analysis: {
        totalFiles: 10,
        totalSizeBytes: 1000,
        extensions: { '.ts': 6, '.html': 4 },
        directories: ['src/app', 'src/lib'],
      },
    },
    {
      id: URN.parse('urn:datasource:stream:2'),
      targetId: URN.parse('urn:ingestiontarget:1'),
      name: 'Backend Stream',
      description: '',
      rulesYaml: '',
      createdAt: '',
      updatedAt: '',
      analysis: {
        totalFiles: 5,
        totalSizeBytes: 500,
        extensions: { '.ts': 2, '.css': 3 },
        directories: ['src/app', 'src/assets'],
      },
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataGroupFormComponent, BrowserAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(DataGroupFormComponent);
    component = fixture.componentInstance;
  });

  describe('Initialization and State', () => {
    it('should initialize an empty form with one stream slot when creating new', () => {
      fixture.componentRef.setInput('isEditing', true);
      fixture.componentRef.setInput('availableStreams', mockStreams);
      fixture.detectChanges();

      expect(component.name()).toBe('');
      expect(component.sources().length).toBe(1);
      expect(component.sources()[0]).toBe(''); // Empty slot
      expect(component.isFormValid()).toBe(false);
    });

    it('should populate the form when an existing group is provided', () => {
      const existingGroup: DataGroup = {
        id: URN.parse('urn:datagroup:1'),
        name: 'Full Stack Context',
        description: 'Testing',
        dataSourceIds: [URN.parse('urn:datasource:stream:1')],
      };

      fixture.componentRef.setInput('isEditing', false);
      fixture.componentRef.setInput('group', existingGroup);
      fixture.componentRef.setInput('availableStreams', mockStreams);
      fixture.detectChanges();

      expect(component.name()).toBe('Full Stack Context');
      expect(component.description()).toBe('Testing');
      expect(component.sources()).toEqual(['urn:datasource:stream:1']);
      expect(component.isFormValid()).toBe(true);
    });
  });

  describe('Live Aggregation', () => {
    it('should accurately aggregate file analysis across selected streams', () => {
      fixture.componentRef.setInput('isEditing', true);
      fixture.componentRef.setInput('availableStreams', mockStreams);

      // Simulate user selecting both streams
      component.sources.set([
        'urn:datasource:stream:1',
        'urn:datasource:stream:2',
      ]);
      fixture.detectChanges();

      const agg = component.aggregatedAnalysis();

      expect(agg).not.toBeNull();
      // 10 + 5
      expect(agg?.totalFiles).toBe(15);
      // 1000 + 500
      expect(agg?.totalSizeBytes).toBe(1500);
      // { .ts: 6+2, .html: 4, .css: 3 }
      expect(agg?.extensions['.ts']).toBe(8);
      expect(agg?.extensions['.html']).toBe(4);
      expect(agg?.extensions['.css']).toBe(3);
      // Deduplicated directories
      expect(agg?.directories).toEqual(
        expect.arrayContaining(['src/app', 'src/lib', 'src/assets']),
      );
      expect(agg?.directories.length).toBe(3);
    });

    it('should return null for aggregation if no valid streams are selected', () => {
      fixture.componentRef.setInput('isEditing', true);
      fixture.componentRef.setInput('availableStreams', mockStreams);

      // Simulate empty slot
      component.sources.set(['']);
      fixture.detectChanges();

      expect(component.aggregatedAnalysis()).toBeNull();
    });
  });

  describe('Form Actions', () => {
    it('should allow adding and removing source slots', () => {
      fixture.componentRef.setInput('isEditing', true);
      fixture.componentRef.setInput('availableStreams', mockStreams);
      fixture.detectChanges();

      expect(component.sources().length).toBe(1);

      component.addSource();
      expect(component.sources().length).toBe(2);

      component.removeSource(0);
      expect(component.sources().length).toBe(1);
    });

    it('should emit the correct payload on save', () => {
      fixture.componentRef.setInput('isEditing', true);
      fixture.componentRef.setInput('availableStreams', mockStreams);

      component.name.set('New Group');
      component.description.set('A test group');
      component.sources.set(['urn:datasource:stream:1']);
      fixture.detectChanges();

      const emitSpy = vi.spyOn(component.save, 'emit');

      component.onSubmit();

      expect(emitSpy).toHaveBeenCalledWith({
        name: 'New Group',
        description: 'A test group',
        dataSourceIds: [URN.parse('urn:datasource:stream:1')],
      });
    });

    it('should not emit save if the form is invalid', () => {
      fixture.componentRef.setInput('isEditing', true);
      fixture.componentRef.setInput('availableStreams', mockStreams);

      // Missing name makes it invalid
      component.name.set('');
      component.sources.set(['urn:datasource:stream:1']);
      fixture.detectChanges();

      const emitSpy = vi.spyOn(component.save, 'emit');

      component.onSubmit();

      expect(emitSpy).not.toHaveBeenCalled();
    });
  });
});
