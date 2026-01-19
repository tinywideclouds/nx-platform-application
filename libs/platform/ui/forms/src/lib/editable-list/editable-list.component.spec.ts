import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditableListComponent } from './editable-list.component';
import { EmailSchema } from './../validators';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('EditableListComponent', () => {
  let component: EditableListComponent;
  let fixture: ComponentFixture<EditableListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditableListComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(EditableListComponent);
    component = fixture.componentInstance;

    // Setup required inputs
    fixture.componentRef.setInput('label', 'Test Emails');
    fixture.componentRef.setInput('schema', EmailSchema);

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Staging Area (Adding Items)', () => {
    it('should start with empty items', () => {
      expect(component.items().length).toBe(0);
    });

    it('should validate staging input and disable add button if invalid', () => {
      // 1. Enter invalid email
      component.stagingValue.set('not-an-email');
      fixture.detectChanges();

      // 2. Check validation computed
      expect(component.isStagingValid()).toBe(false);

      // 3. Check UI button state
      const addButton = fixture.debugElement.query(
        By.css('button[mat-mini-fab]'),
      );
      expect(addButton.nativeElement.disabled).toBe(true);
    });

    it('should allow adding a valid item', () => {
      // 1. Enter valid email
      component.stagingValue.set('test@example.com');
      fixture.detectChanges();

      expect(component.isStagingValid()).toBe(true);

      // 2. Click Add
      const addButton = fixture.debugElement.query(
        By.css('button[mat-mini-fab]'),
      );
      addButton.nativeElement.click();
      fixture.detectChanges();

      // 3. Verify Model Update
      expect(component.items()).toEqual(['test@example.com']);

      // 4. Verify Staging Cleared
      expect(component.stagingValue()).toBe('');
    });
  });

  describe('Row Actions (Remove)', () => {
    beforeEach(() => {
      component.items.set(['item1@test.com', 'item2@test.com']);
      fixture.detectChanges();
    });

    it('should remove an item at index', () => {
      component.remove(0);
      fixture.detectChanges();
      expect(component.items()).toEqual(['item2@test.com']);
    });
  });

  describe('Row Editing', () => {
    beforeEach(() => {
      component.items.set(['old@test.com']);
      fixture.detectChanges();
    });

    it('should enter edit mode when edit button clicked', () => {
      // Find edit button (first one)
      const editBtn = fixture.debugElement.query(
        By.css('button[color="primary"]'),
      );
      editBtn.nativeElement.click();
      fixture.detectChanges();

      expect(component.editingIndex()).toBe(0);
      expect(component.editingValue()).toBe('old@test.com');
    });

    it('should save valid edits', () => {
      // Start edit
      component.startEdit(0, 'old@test.com');
      fixture.detectChanges();

      // Change value
      component.editingValue.set('new@test.com');
      fixture.detectChanges();

      // Save
      component.saveEdit();
      fixture.detectChanges();

      expect(component.items()[0]).toBe('new@test.com');
      expect(component.editingIndex()).toBeNull(); // Should exit edit mode
    });

    it('should not save invalid edits', () => {
      component.startEdit(0, 'old@test.com');

      // Invalid value
      component.editingValue.set('bad-email');
      fixture.detectChanges();

      expect(component.isEditingValid()).toBe(false);

      // Try saving
      component.saveEdit();
      fixture.detectChanges();

      // Should still be in edit mode and value unchanged in list
      expect(component.items()[0]).toBe('old@test.com');
      expect(component.editingIndex()).toBe(0);
    });

    it('should cancel edit and revert value', () => {
      component.startEdit(0, 'old@test.com');
      component.editingValue.set('draft-change@test.com');

      component.cancelEdit();
      fixture.detectChanges();

      expect(component.items()[0]).toBe('old@test.com'); // Unchanged
      expect(component.editingIndex()).toBeNull();
    });
  });

  describe('Readonly Mode', () => {
    beforeEach(() => {
      component.items.set(['readonly@test.com']);
      fixture.componentRef.setInput('readonly', true);
      fixture.detectChanges();
    });

    it('should NOT show the "Add" section', () => {
      const addSection = fixture.debugElement.query(
        By.css('button[mat-mini-fab]'),
      );
      expect(addSection).toBeNull();
    });

    it('should NOT show Edit/Delete buttons in rows', () => {
      const editButtons = fixture.debugElement.queryAll(
        By.css('button[mat-icon-button]'),
      );
      // In readonly, we expect ZERO action buttons in the list item
      expect(editButtons.length).toBe(0);
    });

    it('should guard public methods against execution', () => {
      // Attempt manual invocation
      component.add();
      component.remove(0);
      component.startEdit(0, 'test');

      // Assert state did not change
      expect(component.items().length).toBe(1);
      expect(component.editingIndex()).toBeNull();
    });
  });
});
