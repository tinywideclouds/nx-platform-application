import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MasterDetailLayoutComponent } from './master-detail-layout.component';

describe('MasterDetailLayoutComponent', () => {
  let component: MasterDetailLayoutComponent;
  let fixture: ComponentFixture<MasterDetailLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MasterDetailLayoutComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MasterDetailLayoutComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('showDetail', false); // Default state
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Mobile Behavior (Class Logic)', () => {
    // Note: In CSS Container Queries, these classes are conditionally applied
    // or overridden by media queries, but the Angular logic applies them to the DOM regardless.

    it('should show Sidebar and hide Main when showDetail is false', () => {
      fixture.componentRef.setInput('showDetail', false);
      fixture.detectChanges();

      const sidebar = fixture.debugElement.query(By.css('.md-sidebar'));
      const main = fixture.debugElement.query(By.css('.md-main'));

      // In narrow mode logic:
      // Sidebar should NOT have 'hidden-on-narrow'
      expect(sidebar.classes['hidden-on-narrow']).toBeFalsy();
      // Main SHOULD have 'hidden-on-narrow'
      expect(main.classes['hidden-on-narrow']).toBeTruthy();
    });

    it('should hide Sidebar and show Main when showDetail is true', () => {
      fixture.componentRef.setInput('showDetail', true);
      fixture.detectChanges();

      const sidebar = fixture.debugElement.query(By.css('.md-sidebar'));
      const main = fixture.debugElement.query(By.css('.md-main'));

      // In narrow mode logic:
      // Sidebar SHOULD have 'hidden-on-narrow'
      expect(sidebar.classes['hidden-on-narrow']).toBeTruthy();
      // Main should NOT have 'hidden-on-narrow'
      expect(main.classes['hidden-on-narrow']).toBeFalsy();
    });
  });
});
