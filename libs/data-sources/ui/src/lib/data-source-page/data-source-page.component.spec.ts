import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FilterProfilesComponent } from './filter-profiles.component';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';
import { FilterProfile } from '@nx-platform-application/data-sources-types';
import { of } from 'rxjs';

describe('FilterProfilesComponent', () => {
  let component: FilterProfilesComponent;
  let fixture: ComponentFixture<FilterProfilesComponent>;

  const mockBreakpointObserver = {
    observe: vi.fn().mockReturnValue(of({ matches: false } as BreakpointState)),
  };

  const mockProfiles: FilterProfile[] = [
    {
      id: URN.parse('urn:profile:1'),
      name: 'Backend',
      rulesYaml: '',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: URN.parse('urn:profile:2'),
      name: 'Frontend',
      rulesYaml: '',
      createdAt: '',
      updatedAt: '',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilterProfilesComponent, BrowserAnimationsModule],
      providers: [
        { provide: BreakpointObserver, useValue: mockBreakpointObserver },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FilterProfilesComponent);
    component = fixture.componentInstance;
  });

  it('should select a profile and compute the activeProfile', () => {
    fixture.componentRef.setInput('profiles', mockProfiles);
    fixture.detectChanges();

    component.selectProfile(mockProfiles[1].id);

    expect(component.selectedProfileId()?.toString()).toBe('urn:profile:2');
    expect(component.activeProfile()?.name).toBe('Frontend');
    expect(component.isEditing()).toBe(false);
  });

  it('should clear selection and set isEditing to true when createNew is called', () => {
    fixture.componentRef.setInput('profiles', mockProfiles);
    component.selectProfile(mockProfiles[0].id);
    fixture.detectChanges();

    component.createNew();

    expect(component.selectedProfileId()).toBeNull();
    expect(component.activeProfile()).toBeNull();
    expect(component.isEditing()).toBe(true);
  });

  it('should automatically clear the selected ID if it is removed from the profiles input', () => {
    fixture.componentRef.setInput('profiles', mockProfiles);
    component.selectProfile(mockProfiles[0].id);
    fixture.detectChanges();

    // Emulate the profile being deleted externally by passing an array without it
    fixture.componentRef.setInput('profiles', [mockProfiles[1]]);
    fixture.detectChanges();

    expect(component.selectedProfileId()).toBeNull();
  });

  it('should handle mobile mat-select emissions correctly', () => {
    fixture.componentRef.setInput('profiles', mockProfiles);
    fixture.detectChanges();

    // Select existing
    component.onMobileSelect(mockProfiles[0].id);
    expect(component.selectedProfileId()?.toString()).toBe('urn:profile:1');

    // Select NEW
    component.onMobileSelect('NEW');
    expect(component.selectedProfileId()).toBeNull();
    expect(component.isEditing()).toBe(true);
  });

  it('should emit save events wrapping the payload and the selected URN (if editing)', () => {
    fixture.componentRef.setInput('profiles', mockProfiles);
    component.selectProfile(mockProfiles[0].id);
    component.isEditing.set(true);
    fixture.detectChanges();

    const saveSpy = vi.spyOn(component.save, 'emit');
    const mockPayload = { name: 'Updated', rulesYaml: '' };

    component.onSave(mockPayload);

    expect(saveSpy).toHaveBeenCalledWith({
      payload: mockPayload,
      profileId: mockProfiles[0].id,
    });
    expect(component.isEditing()).toBe(false);
  });
});
