import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Component } from '@angular/core';
import { ContactGroup } from '@nx-platform-application/contacts-storage';
import { vi } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';

import { ContactGroupListItemComponent } from './contact-group-list-item.component';

const MOCK_GROUP: ContactGroup = {
  id: URN.parse('urn:contacts:group:grp-123'),
  name: 'Family',
  contactIds: [
    URN.parse('urn:contacts:user:user-1'),
    URN.parse('urn:contacts:user:user-2'),
  ],
};

describe('ContactGroupListItemComponent (Rendering)', () => {
  let fixture: ComponentFixture<ContactGroupListItemComponent>;
  let component: ContactGroupListItemComponent;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactGroupListItemComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactGroupListItemComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
  });

  it('should render the group name', () => {
    // FIX: Use setInput
    fixture.componentRef.setInput('group', MOCK_GROUP);
    fixture.detectChanges();

    const nameEl = el.querySelector('[data-testid="group-name"]');
    expect(nameEl).toBeTruthy();
    expect(nameEl?.textContent).toContain('Family');
  });

  it('should render the correct member count (plural)', () => {
    fixture.componentRef.setInput('group', MOCK_GROUP);
    fixture.detectChanges();

    const countEl = el.querySelector('.text-sm.text-gray-500');
    expect(countEl?.textContent?.trim()).toBe('2 members');
  });

  it('should render the correct member count (singular)', () => {
    const singularGroup = {
      ...MOCK_GROUP,
      contactIds: [URN.parse('urn:contacts:user:user-1')],
    };
    fixture.componentRef.setInput('group', singularGroup);
    fixture.detectChanges();

    const countEl = el.querySelector('.text-sm.text-gray-500');
    expect(countEl?.textContent?.trim()).toBe('1 member');
  });

  it('should render the correct member count (zero)', () => {
    const emptyGroup = { ...MOCK_GROUP, contactIds: [] };
    fixture.componentRef.setInput('group', emptyGroup);
    fixture.detectChanges();

    const countEl = el.querySelector('.text-sm.text-gray-500');
    expect(countEl?.textContent?.trim()).toBe('0 members');
  });
});

describe('ContactGroupListItemComponent (Events)', () => {
  @Component({
    standalone: true,
    imports: [ContactGroupListItemComponent],
    template: `
      <contacts-group-list-item [group]="group" (select)="onSelected($event)" />
    `,
  })
  class TestHostComponent {
    group = MOCK_GROUP;
    selectedGroup?: ContactGroup;
    onSelected(group: ContactGroup) {
      this.selectedGroup = group;
    }
  }

  let fixture: ComponentFixture<TestHostComponent>;
  let hostComponent: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should emit (select) with the group when clicked', () => {
    const selectSpy = vi.spyOn(hostComponent, 'onSelected');
    const componentEl = fixture.debugElement.query(
      By.css('contacts-group-list-item')
    );
    componentEl.triggerEventHandler('click');
    fixture.detectChanges();
    expect(selectSpy).toHaveBeenCalledWith(MOCK_GROUP);
    expect(hostComponent.selectedGroup).toBe(MOCK_GROUP);
  });
});
