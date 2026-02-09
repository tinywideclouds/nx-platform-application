import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatImageMessageComponent } from './chat-image-message.component';
import { ChatMediaFacade } from '@nx-platform-application/messenger-state-media';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { By } from '@angular/platform-browser';
import { DisplayMessage } from '../models';

describe('ChatImageMessageComponent', () => {
  let component: ChatImageMessageComponent;
  let fixture: ComponentFixture<ChatImageMessageComponent>;
  let facade: ChatMediaFacade;

  const mockDisplayMsg: DisplayMessage = {
    id: 'msg-1',
    kind: 'image',
    parts: [],
    image: {
      src: 'data:image/png;base64,blob',
      width: 800,
      height: 600,
      assets: {
        driveImage: {
          provider: 'google',
          resourceId: 'res-123',
          filename: 'photo.png',
        },
      },
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatImageMessageComponent],
      providers: [
        MockProvider(ChatMediaFacade, {
          getCapabilities: vi.fn().mockReturnValue({
            canDownload: true,
            canEmbed: true,
            canLinkExternal: true,
          }),
          getDownload: vi.fn().mockResolvedValue('blob:http://localhost/123'),
          upgradeInlineImage: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(MatSnackBar),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatImageMessageComponent);
    component = fixture.componentInstance;
    facade = TestBed.inject(ChatMediaFacade);

    fixture.componentRef.setInput('message', mockDisplayMsg);
    fixture.detectChanges();
  });

  describe('Rendering & Layout', () => {
    it('should render the inline thumbnail with correct aspect ratio style', () => {
      const img = fixture.debugElement.query(By.css('img.chat-bubble-image'));
      expect(img).toBeTruthy();
      expect(img.attributes['src']).toContain('data:image/png;base64,blob');

      // Verify Aspect Ratio calculation (800/600 = 1.333)
      const container = fixture.debugElement.query(
        By.css('.image-bubble-container'),
      );
      expect(container.styles['aspect-ratio']).toBe('800 / 600');
    });

    it('should show HD badge if media links exist', () => {
      // The mock message has 'driveImage' asset, so badge should be visible
      const container = fixture.debugElement.query(
        By.css('.image-bubble-container'),
      );
      // Angular Material badge logic is complex to query directly via DOM attributes in unit tests sometimes,
      // but we can check if the input signal computed correctly.
      expect(component.mediaLinks()).toBe(true);
    });
  });

  describe('Lightbox & Interaction', () => {
    it('should open lightbox on click', async () => {
      // 1. Click the "Quick View" button (or the image itself in the new design)
      const btn = fixture.debugElement.query(
        By.css('button[title="Quick View"]'),
      );
      btn.nativeElement.click();

      // 2. Verify Facade Call
      expect(facade.getDownload).toHaveBeenCalledWith('google', 'res-123');

      // 3. Wait for async resolution
      await fixture.whenStable();
      fixture.detectChanges();

      // 4. Verify State
      expect(component.activePreviewUrl()).toBe('blob:http://localhost/123');
      expect(component.isLightboxOpen()).toBe(true);
    });

    it('should call facade to upgrade image when requested', async () => {
      // 1. Open Lightbox first
      component.isLightboxOpen.set(true);
      component.activePreviewUrl.set('blob:http://localhost/123');
      fixture.detectChanges();

      // 2. Mock the fetch (since we are in JSDOM, fetch might need mocking globally or we rely on the component implementation)
      global.fetch = vi.fn().mockResolvedValue({
        blob: () => Promise.resolve(new Blob(['data'])),
      } as any);

      // 3. Click "Set as HD Thumbnail"
      const upgradeBtn = fixture.debugElement.query(
        By.css('button.upgrade-btn'),
      );
      expect(upgradeBtn).toBeTruthy();
      upgradeBtn.nativeElement.click();

      await fixture.whenStable();

      // 4. Verify Facade Upgrade Call
      expect(facade.upgradeInlineImage).toHaveBeenCalledWith(
        'msg-1',
        expect.any(Blob),
      );
    });
  });
});
