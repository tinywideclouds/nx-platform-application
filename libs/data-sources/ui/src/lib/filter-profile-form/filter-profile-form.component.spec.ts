import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FilterProfileFormComponent } from './filter-profile-form.component';
import { YamlRulesService } from '@nx-platform-application/data-sources/features/state';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';
import { FilterProfile } from '@nx-platform-application/data-sources-types';

describe('FilterProfileFormComponent', () => {
  let component: FilterProfileFormComponent;
  let fixture: ComponentFixture<FilterProfileFormComponent>;

  const mockYamlService = {
    parse: vi
      .fn()
      .mockReturnValue({ include: ['**/*.ts'], exclude: ['vendor/**'] }),
    stringify: vi.fn().mockReturnValue('include:\n  - "**/*.ts"'),
  };

  const mockProfile: FilterProfile = {
    id: URN.parse('urn:profile:1'),
    name: 'Frontend Types',
    rulesYaml: 'mock yaml',
    createdAt: '2026-03-09T10:00:00Z',
    updatedAt: '2026-03-09T10:00:00Z',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilterProfileFormComponent, BrowserAnimationsModule],
      providers: [{ provide: YamlRulesService, useValue: mockYamlService }],
    }).compileComponents();

    fixture = TestBed.createComponent(FilterProfileFormComponent);
    component = fixture.componentInstance;
  });

  it('should initialize draft state when editing an active profile', () => {
    fixture.componentRef.setInput('activeProfile', mockProfile);
    fixture.componentRef.setInput('isEditing', true);
    fixture.detectChanges();

    expect(component.draftName()).toBe('Frontend Types');
    expect(mockYamlService.parse).toHaveBeenCalledWith('mock yaml');
    expect(component.draftIncludes()).toEqual(['**/*.ts']);
    expect(component.draftExcludes()).toEqual(['vendor/**']);
  });

  it('should correctly add and remove chips from draft state', () => {
    fixture.componentRef.setInput('isEditing', true);
    fixture.detectChanges();

    // Add Include
    component.addInclude({
      value: 'src/**/*.go',
      chipInput: { clear: vi.fn() },
    } as any);
    expect(component.draftIncludes()).toContain('src/**/*.go');

    // Remove Include
    component.removeInclude('**/*.ts');
    expect(component.draftIncludes()).not.toContain('**/*.ts');

    // Add Exclude
    component.addExclude({
      value: '.git/**',
      chipInput: { clear: vi.fn() },
    } as any);
    expect(component.draftExcludes()).toContain('.git/**');

    // Remove Exclude
    component.removeExclude('vendor/**');
    expect(component.draftExcludes()).not.toContain('vendor/**');
  });

  it('should emit the stringified payload when saving', () => {
    fixture.componentRef.setInput('isEditing', true);
    component.draftName.set('New Name');
    fixture.detectChanges();

    const emitSpy = vi.spyOn(component.save, 'emit');

    component.onSave();

    expect(mockYamlService.stringify).toHaveBeenCalledWith({
      include: component.draftIncludes(),
      exclude: component.draftExcludes(),
    });

    expect(emitSpy).toHaveBeenCalledWith({
      name: 'New Name',
      rulesYaml: 'include:\n  - "**/*.ts"', // From our stringify mock
    });
  });

  it('should emit URNs for edit and delete actions', () => {
    fixture.componentRef.setInput('activeProfile', mockProfile);
    fixture.componentRef.setInput('isEditing', false);
    fixture.detectChanges();

    const editSpy = vi.spyOn(component.editRequested, 'emit');
    const deleteSpy = vi.spyOn(component.deleteRequested, 'emit');

    component.onEdit();
    expect(editSpy).toHaveBeenCalledWith(mockProfile.id);

    component.onDelete();
    expect(deleteSpy).toHaveBeenCalledWith(mockProfile.id);
  });
});
