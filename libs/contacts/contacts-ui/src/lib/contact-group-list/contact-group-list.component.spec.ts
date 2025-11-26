import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ContactGroup } from '@nx-platform-application/contacts-storage';
import { URN } from '@nx-platform-application/platform-types';

import { ContactGroupListComponent } from './contact-group-list.component';
import { ContactGroupListItemComponent } from '../contact-group-list-item/contact-group-list-item.component';

const MOCK_GROUPS: ContactGroup[] = [
  {
    id: URN.parse('urn:sm:group:grp-123'),
    name: 'Family',
    contactIds: [],
  },
  {
    id: URN.parse('urn:sm:group:grp-456'),
    name: 'Work',
    contactIds: [],
  },
];

@Component({
  standalone: true,
  imports: [ContactGroupListComponent],
  template: `
    <contacts-group-list
      [groups]="groups"
      [selectedId]="selectedId"
      (groupSelected)="onSelected($event)"
    />
  `,
})
class TestHostComponent {
  groups = MOCK_GROUPS;
  selectedId: string | undefined = undefined;
  selectedGroup?: ContactGroup;
  onSelected(group: ContactGroup) {
    this.selectedGroup = group;
  }
}

describe('ContactGroupListComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let hostComponent: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        TestHostComponent,
        ContactGroupListComponent,
        ContactGroupListItemComponent,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
  });

  it('should render correct number of items', () => {
    fixture.detectChanges();
    const items = fixture.debugElement.queryAll(
      By.css('contacts-group-list-item')
    );
    expect(items.length).toBe(2);
  });

  it('should highlight the selected group based on input', () => {
    hostComponent.selectedId = 'urn:sm:group:grp-456'; // Select the second one
    fixture.detectChanges();

    const items = fixture.debugElement.queryAll(
      By.css('contacts-group-list-item')
    );

    // First item (not selected)
    expect(items[0].nativeElement.classList).not.toContain('bg-blue-50');

    // Second item (selected)
    expect(items[1].nativeElement.classList).toContain('bg-blue-50');
    expect(items[1].nativeElement.classList).toContain('border-l-4');
  });
});
