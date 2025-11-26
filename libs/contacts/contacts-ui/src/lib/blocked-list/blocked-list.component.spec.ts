// libs/contacts/contacts-ui/src/lib/components/blocked-list/blocked-list.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BlockedListComponent } from './blocked-list.component';
import { BlockedIdentity } from '@nx-platform-application/contacts-storage';
import { URN } from '@nx-platform-application/platform-types';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { vi } from 'vitest';

const MOCK_BLOCKED: BlockedIdentity[] = [
  {
    urn: URN.parse('urn:auth:google:spammer'),
    blockedAt: '2023-01-01T00:00:00Z' as any,
    reason: 'Spam',
  },
];

describe('BlockedListComponent', () => {
  let fixture: ComponentFixture<BlockedListComponent>;
  let component: BlockedListComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlockedListComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(BlockedListComponent);
    component = fixture.componentInstance;

    // Set input
    fixture.componentRef.setInput('blocked', MOCK_BLOCKED);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render blocked items inside expansion panel', () => {
    // Open panel first? MatExpansionPanel usually renders content anyway,
    // but it might be hidden.
    const title = fixture.debugElement.query(By.css('mat-panel-title'));
    expect(title.nativeElement.textContent).toContain('Blocked Users (1)');

    const listItem = fixture.debugElement.query(By.css('mat-list-item'));
    expect(listItem).toBeTruthy();
    expect(listItem.nativeElement.textContent).toContain('google:spammer');
    expect(listItem.nativeElement.textContent).toContain('Spam');
  });

  it('should emit unblock event when delete button is clicked', () => {
    const unblockSpy = vi.spyOn(component.unblock, 'emit');

    const button = fixture.debugElement.query(
      By.css('[data-testid="unblock-button"]')
    );
    button.nativeElement.click();

    expect(unblockSpy).toHaveBeenCalledWith(MOCK_BLOCKED[0]);
  });
});
