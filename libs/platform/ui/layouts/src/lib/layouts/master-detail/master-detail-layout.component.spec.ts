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

    // Initialize required signal input
    fixture.componentRef.setInput('showDetail', false);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Mobile View Logic', () => {
    it('should show Sidebar and hide Main when showDetail is false (List Mode)', () => {
      fixture.componentRef.setInput('showDetail', false);
      fixture.detectChanges();

      const sidebar = fixture.debugElement.query(By.css('.md-sidebar'));
      const main = fixture.debugElement.query(By.css('.md-main'));

      // .hidden-on-narrow is the class used by the CSS Container Query to toggle visibility
      expect(sidebar.classes['hidden-on-narrow']).toBeFalsy();
      expect(main.classes['hidden-on-narrow']).toBeTruthy();
    });

    it('should hide Sidebar and show Main when showDetail is true (Detail Mode)', () => {
      fixture.componentRef.setInput('showDetail', true);
      fixture.detectChanges();

      const sidebar = fixture.debugElement.query(By.css('.md-sidebar'));
      const main = fixture.debugElement.query(By.css('.md-main'));

      expect(sidebar.classes['hidden-on-narrow']).toBeTruthy();
      expect(main.classes['hidden-on-narrow']).toBeFalsy();
    });
  });
});
