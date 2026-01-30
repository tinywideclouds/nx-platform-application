import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatWindowHeaderComponent } from './chat-window-header.component';
import { By } from '@angular/platform-browser';

describe('ChatWindowHeaderComponent', () => {
  let fixture: ComponentFixture<ChatWindowHeaderComponent>;
  let component: ChatWindowHeaderComponent;

  const getButtonByIcon = (iconName: string) => {
    const buttons = fixture.debugElement.queryAll(By.css('button'));
    return buttons.find(
      (btn) => btn.nativeElement.textContent.trim() === iconName,
    );
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatWindowHeaderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatWindowHeaderComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('title', 'Test Chat');
  });

  describe('Group Type Logic', () => {
    it('should show NO extra actions for a P2P User (groupType = null)', () => {
      fixture.componentRef.setInput('groupType', null);
      fixture.detectChanges();

      expect(getButtonByIcon('campaign')).toBeFalsy(); // Broadcast
      expect(getButtonByIcon('add_circle_outline')).toBeFalsy(); // Fork
      expect(getButtonByIcon('info_outline')).toBeTruthy(); // Info
    });

    it('should show ONLY Fork action for Local Group (groupType = "local")', () => {
      fixture.componentRef.setInput('groupType', 'local');
      fixture.detectChanges();

      expect(getButtonByIcon('campaign')).toBeFalsy(); // No Broadcast
      expect(getButtonByIcon('add_circle_outline')).toBeTruthy(); // Has Fork
      expect(getButtonByIcon('info_outline')).toBeTruthy();
    });

    it('should show BOTH actions for Network Group (groupType = "network")', () => {
      fixture.componentRef.setInput('groupType', 'network');
      fixture.detectChanges();

      expect(getButtonByIcon('campaign')).toBeTruthy(); // Has Broadcast
      expect(getButtonByIcon('add_circle_outline')).toBeTruthy(); // Has Fork
      expect(getButtonByIcon('info_outline')).toBeTruthy();
    });
  });

  describe('Events', () => {
    it('should emit fork event', () => {
      fixture.componentRef.setInput('groupType', 'local');
      fixture.detectChanges();

      const spy = vi.spyOn(component.fork, 'emit');
      getButtonByIcon('add_circle_outline')?.nativeElement.click();

      expect(spy).toHaveBeenCalled();
    });

    it('should emit broadcast event', () => {
      fixture.componentRef.setInput('groupType', 'network');
      fixture.detectChanges();

      const spy = vi.spyOn(component.broadcast, 'emit');
      getButtonByIcon('campaign')?.nativeElement.click();

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Mode Logic', () => {
    it('should show actions in CHAT mode', () => {
      fixture.componentRef.setInput('mode', 'chat');
      fixture.componentRef.setInput('groupType', 'local'); // Enable group buttons
      fixture.detectChanges();

      expect(getButtonByIcon('info_outline')).toBeTruthy();
      expect(getButtonByIcon('add_circle_outline')).toBeTruthy();
    });

    it('should hide actions in DETAILS mode', () => {
      fixture.componentRef.setInput('mode', 'details');
      fixture.componentRef.setInput('groupType', 'local');
      fixture.detectChanges();

      expect(getButtonByIcon('info_outline')).toBeFalsy();
      expect(getButtonByIcon('add_circle_outline')).toBeFalsy();
      expect(getButtonByIcon('campaign')).toBeFalsy();
    });
  });
});
